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
      // For demo purposes, return mock data if API is not properly configured
      if (!this.serverToken || this.serverToken === 'your_uber_server_token_here') {
        return this.getMockRides(params);
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
      // Return mock data as fallback
      return this.getMockRides(params);
    }
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
      dropoff_longitude: params.destination_longitude.toString(),
      product_id: params.product_id,
      client_id: this.clientId
    });

    return `${baseUrl}?${queryParams}`;
  }

  /**
   * Generate mock ride data for demonstration
   */
  private getMockRides(params: UberRideSearchParams): UberRide[] {
    // Calculate approximate distance for mock pricing
    const distance = this.calculateDistance(
      params.pickup_latitude,
      params.pickup_longitude,
      params.destination_latitude,
      params.destination_longitude
    );

    const basePrice = Math.max(300, Math.round(distance * 120)); // Base price calculation

    return [
      {
        product_id: 'mock_uber_x',
        display_name: 'UberX',
        duration: `${Math.round(distance * 2 + 5)} min`,
        distance: `${distance.toFixed(1)} km`,
        price_estimate: `¥${basePrice} - ¥${basePrice + 200}`,
        capacity: 4
      },
      {
        product_id: 'mock_uber_comfort',
        display_name: 'Uber Comfort',
        duration: `${Math.round(distance * 2 + 3)} min`,
        distance: `${distance.toFixed(1)} km`,
        price_estimate: `¥${basePrice + 150} - ¥${basePrice + 350}`,
        capacity: 4
      },
      {
        product_id: 'mock_uber_xl',
        display_name: 'UberXL',
        duration: `${Math.round(distance * 2 + 7)} min`,
        distance: `${distance.toFixed(1)} km`,
        price_estimate: `¥${basePrice + 300} - ¥${basePrice + 500}`,
        capacity: 6
      }
    ];
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