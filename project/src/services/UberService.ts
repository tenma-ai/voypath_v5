interface UberRideSearchParams {
  pickup_latitude: number;
  pickup_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
}

interface UberBookingParams {
  product_id: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
}

interface UberRide {
  product_id: string;
  display_name: string;
  duration: string;
  distance: string;
  price_estimate: string;
  capacity: number;
  image?: string;
}

class UberServiceClass {
  private baseUrl: string;
  private clientId: string;
  private serverToken: string;

  constructor() {
    const isDev = import.meta.env.DEV;
    this.baseUrl = isDev 
      ? import.meta.env.VITE_UBER_SANDBOX_URL 
      : import.meta.env.VITE_UBER_PRODUCTION_URL;
    this.clientId = import.meta.env.VITE_UBER_CLIENT_ID;
    this.serverToken = import.meta.env.VITE_UBER_SERVER_TOKEN;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.serverToken}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en_US',
    };
  }

  /**
   * Search for available Uber rides
   */
  async searchRides(params: UberRideSearchParams): Promise<UberRide[]> {
    try {
      // Check if API is properly configured
      if (!this.serverToken || this.serverToken === 'your_uber_server_token_here' || this.serverToken === '') {
        // Return fallback ride option when API is not configured
        return this.getFallbackRides(params);
      }

      const url = `${this.baseUrl}/v1.2/products`;
      const queryParams = new URLSearchParams({
        latitude: params.pickup_latitude.toString(),
        longitude: params.pickup_longitude.toString()
      });

      const response = await fetch(`${url}?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Uber API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Get price estimates
      const priceEstimates = await this.getPriceEstimates(params);
      const timeEstimates = await this.getTimeEstimates(params);

      // Combine products with price and time estimates
      return data.products.map((product: any) => {
        const priceEstimate = priceEstimates.find((p: any) => p.product_id === product.product_id);
        const timeEstimate = timeEstimates.find((t: any) => t.product_id === product.product_id);

        return {
          product_id: product.product_id,
          display_name: product.display_name,
          duration: timeEstimate ? `${Math.round(timeEstimate.estimate / 60)} min` : 'Unknown',
          distance: priceEstimate ? priceEstimate.distance : 'Unknown',
          price_estimate: priceEstimate ? priceEstimate.estimate : 'Quote not available',
          capacity: product.capacity || 4,
          image: product.image
        };
      });

    } catch (error) {
      console.error('Failed to search Uber rides:', error);
      // Return fallback rides when API fails
      return this.getFallbackRides(params);
    }
  }

  /**
   * Get fallback ride options when API is not available
   */
  private getFallbackRides(params: UberRideSearchParams): UberRide[] {
    const distance = this.calculateDistance(
      params.pickup_latitude,
      params.pickup_longitude,
      params.destination_latitude,
      params.destination_longitude
    );

    const estimatedTime = Math.round((distance / 40) * 60); // Assume 40 km/h average speed
    const estimatedPrice = `$${(distance * 2.5).toFixed(0)}-${(distance * 4.0).toFixed(0)}`;

    return [
      {
        product_id: 'fallback_uberx',
        display_name: 'UberX',
        duration: `${estimatedTime} min`,
        distance: `${distance.toFixed(1)} km`,
        price_estimate: estimatedPrice,
        capacity: 4
      },
      {
        product_id: 'fallback_comfort',
        display_name: 'Comfort',
        duration: `${estimatedTime + 2} min`,
        distance: `${distance.toFixed(1)} km`,
        price_estimate: `$${(distance * 3.0).toFixed(0)}-${(distance * 5.0).toFixed(0)}`,
        capacity: 4
      }
    ];
  }

  /**
   * Get price estimates for the route
   */
  private async getPriceEstimates(params: UberRideSearchParams) {
    const url = `${this.baseUrl}/v1.2/estimates/price`;
    const queryParams = new URLSearchParams({
      start_latitude: params.pickup_latitude.toString(),
      start_longitude: params.pickup_longitude.toString(),
      end_latitude: params.destination_latitude.toString(),
      end_longitude: params.destination_longitude.toString()
    });

    const response = await fetch(`${url}?${queryParams}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Price estimates error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.prices || [];
  }

  /**
   * Get time estimates for pickup
   */
  private async getTimeEstimates(params: UberRideSearchParams) {
    const url = `${this.baseUrl}/v1.2/estimates/time`;
    const queryParams = new URLSearchParams({
      start_latitude: params.pickup_latitude.toString(),
      start_longitude: params.pickup_longitude.toString()
    });

    const response = await fetch(`${url}?${queryParams}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Time estimates error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.times || [];
  }

  /**
   * Create an Uber booking (redirect to Uber app/website)
   */
  async createBooking(params: UberBookingParams): Promise<string | null> {
    try {
      // For guest rides, we typically redirect to Uber's booking flow
      // This generates a deep link or web URL for booking
      
      const bookingUrl = this.generateBookingUrl(params);
      return bookingUrl;

    } catch (error) {
      console.error('Failed to create Uber booking:', error);
      throw error;
    }
  }

  /**
   * Generate Uber booking URL for web/mobile redirect
   */
  private generateBookingUrl(params: UberBookingParams): string {
    const baseUrl = 'https://m.uber.com/ul/';
    const queryParams = new URLSearchParams({
      action: 'setPickup',
      pickup_latitude: params.pickup_latitude.toString(),
      pickup_longitude: params.pickup_longitude.toString(),
      dropoff_latitude: params.destination_latitude.toString(),
      dropoff_longitude: params.destination_longitude.toString()
    });

    // Only add product_id and client_id if they exist
    if (params.product_id && !params.product_id.startsWith('fallback_')) {
      queryParams.append('product_id', params.product_id);
    }
    if (this.clientId && this.clientId !== 'your_uber_client_id_here') {
      queryParams.append('client_id', this.clientId);
    }

    return `${baseUrl}?${queryParams}`;
  }


  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if Uber API is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.clientId && 
      this.serverToken && 
      this.clientId !== 'your_uber_client_id_here' &&
      this.serverToken !== 'your_uber_server_token_here'
    );
  }
}

export const UberService = new UberServiceClass();
export type { UberRide, UberRideSearchParams, UberBookingParams };