/**
 * WayAway Flight Search Service
 * Real-time flight data integration via TravelPayouts API
 */

export interface WayAwayFlightParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  currency?: string;
}

export interface WayAwayFlightData {
  airline: string;
  flight_number: string;
  departure_at: string;
  return_at?: string;
  price: number;
  transfers: number;
  expires_at: string;
  actual: boolean;
  distance: number;
  duration?: number;
}

export interface WayAwayAPIResponse {
  success: boolean;
  data: Record<string, WayAwayFlightData>;
  currency: string;
}

export class WayAwayService {
  private static readonly API_TOKEN = import.meta.env.VITE_TRAVELPAYOUTS_API_KEY || import.meta.env.TRAVELPAYOUTS_TOKEN;
  private static readonly MARKER = import.meta.env.WAYAWAY_MARKER || import.meta.env.VITE_TRAVELPAYOUTS_MARKER || '649297';
  private static readonly BASE_URL = 'https://api.travelpayouts.com/v1';

  /**
   * Search flight prices using WayAway Data API
   */
  static async searchFlightPrices(params: WayAwayFlightParams): Promise<WayAwayAPIResponse> {
    const { origin, destination, departDate, returnDate, currency = 'JPY' } = params;
    
    console.log('🔍 WayAway Search Config:', {
      hasToken: !!this.API_TOKEN,
      token: this.API_TOKEN?.substring(0, 8) + '...',
      marker: this.MARKER,
      params: { origin, destination, departDate, returnDate, currency }
    });

    if (!this.API_TOKEN) {
      throw new Error('WayAway API token not configured');
    }

    try {
      // Use ONLY Supabase Edge Function (TravelPayouts API requires server-side calls)
      const supabaseProxyUrl = `https://rdufxwoeneglyponagdz.supabase.co/functions/v1/wayaway-proxy`;
      const searchParams = new URLSearchParams({
        origin,
        destination,
        depart_date: departDate,
        currency,
        token: this.API_TOKEN
      });

      if (returnDate) {
        searchParams.append('return_date', returnDate);
      }

      console.log('🔍 Calling WayAway via Supabase Edge Function (server-side only):', `${supabaseProxyUrl}?${searchParams.toString()}`);

      const response = await fetch(`${supabaseProxyUrl}?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Supabase proxy error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      
      // Check if response is valid JSON (not HTML error page)
      if (typeof result === 'string' && result.includes('<!doctype')) {
        throw new Error('Supabase proxy returned HTML instead of JSON');
      }
      
      console.log('✅ WayAway Supabase proxy response received:', result);
      return result;
      
    } catch (error) {
      console.error('WayAway flight search failed (Supabase server-side proxy):', error);
      throw error;
    }
  }

  /**
   * Generate WayAway booking URL with affiliate tracking
   */
  static generateBookingUrl(params: WayAwayFlightParams): string {
    const { origin, destination, departDate, returnDate, currency = 'JPY' } = params;
    
    // Generate WayAway search URL
    const wayawayUrl = this.generateWayAwayUrl(origin, destination, departDate, returnDate, currency);
    
    // Create TravelPayouts affiliate link
    const marker = this.MARKER;
    const trs = '434567'; // TravelPayouts tracking ID  
    const p = '5976'; // WayAway partner ID
    const campaignId = '200'; // WayAway campaign ID
    
    // Use TravelPayouts official link format
    const encodedUrl = encodeURIComponent(wayawayUrl);
    
    const affiliateUrl = `https://tp.media/r?marker=${marker}&trs=${trs}&p=${p}&u=${encodedUrl}&campaign_id=${campaignId}`;
    
    console.log('🔗 Generated WayAway affiliate link:', {
      marker,
      trs,
      p,
      wayawayUrl,
      affiliateUrl
    });
    
    return affiliateUrl;
  }

  /**
   * Generate WayAway search URL
   */
  private static generateWayAwayUrl(
    origin: string,
    destination: string,
    departDate: string,
    returnDate?: string,
    currency: string = 'JPY'
  ): string {
    const baseUrl = 'https://wayaway.io/search';
    const params = new URLSearchParams({
      origin_iata: origin,
      destination_iata: destination,
      depart_date: departDate,
      adults: '1',
      children: '0',
      infants: '0',
      currency,
      marker: this.MARKER
    });

    if (returnDate) {
      params.append('return_date', returnDate);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Transform WayAway data to FlightOption format for VoyPath
   */
  static transformToFlightOptions(
    wayawayData: WayAwayAPIResponse,
    timePreferences?: {
      departureTime?: string;
      arrivalTime?: string;
      duration?: string;
    }
  ): Array<any> {
    if (!wayawayData.success || !wayawayData.data) {
      console.warn('No WayAway data to transform');
      return [];
    }

    const flights: any[] = [];
    
    Object.entries(wayawayData.data).forEach(([route, flightData]) => {
      const airline = this.getAirlineName(flightData.airline);
      const departureTime = this.formatTime(flightData.departure_at);
      const arrivalTime = this.formatTime(flightData.return_at || flightData.departure_at);
      const duration = this.calculateDuration(flightData.departure_at, flightData.return_at);
      
      // Check if this flight matches existing schedule
      const matchesSchedule = timePreferences?.departureTime === departureTime && 
                             timePreferences?.arrivalTime === arrivalTime;

      flights.push({
        airline: airline,
        flightNumber: `${flightData.airline}${flightData.flight_number}`,
        departure: departureTime,
        arrival: arrivalTime,
        duration: duration,
        price: flightData.price,
        currency: wayawayData.currency,
        transfers: flightData.transfers,
        bookingUrl: this.generateBookingUrl({
          origin: route.split('_')[0],
          destination: route.split('_')[1],
          departDate: flightData.departure_at.split('T')[0],
          returnDate: flightData.return_at ? flightData.return_at.split('T')[0] : undefined,
          currency: wayawayData.currency
        }),
        source: 'WayAway',
        actual: flightData.actual,
        distance: flightData.distance,
        expiresAt: flightData.expires_at,
        matchesSchedule: matchesSchedule
      });
    });

    // Sort by schedule match first, then by price
    return flights.sort((a, b) => {
      if (a.matchesSchedule && !b.matchesSchedule) return -1;
      if (!a.matchesSchedule && b.matchesSchedule) return 1;
      return a.price - b.price;
    });
  }

  /**
   * Utility functions
   */
  private static formatTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private static calculateDuration(departure: string, arrival?: string): string {
    if (!departure || !arrival) return '';
    const diff = new Date(arrival).getTime() - new Date(departure).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  private static getAirlineName(iataCode: string): string {
    const airlines: Record<string, string> = {
      'NH': 'ANA',
      'JL': 'JAL', 
      'UA': 'United Airlines',
      'AA': 'American Airlines',
      'DL': 'Delta Airlines',
      'UT': 'UTair',
      'SU': 'Aeroflot',
      'LH': 'Lufthansa',
      'AF': 'Air France',
      'BA': 'British Airways',
      'KL': 'KLM',
      'TK': 'Turkish Airlines',
      'EK': 'Emirates',
      'QR': 'Qatar Airways',
      'SQ': 'Singapore Airlines',
      'CX': 'Cathay Pacific',
      'OZ': 'Asiana Airlines',
      'KE': 'Korean Air'
    };
    return airlines[iataCode] || `${iataCode} Airlines`;
  }

  /**
   * Check if WayAway service is properly configured
   */
  static isConfigured(): boolean {
    return !!this.API_TOKEN && !!this.MARKER;
  }

  /**
   * Get service configuration for debugging
   */
  static getConfig() {
    return {
      hasToken: !!this.API_TOKEN,
      token: this.API_TOKEN?.substring(0, 8) + '...',
      marker: this.MARKER,
      baseUrl: this.BASE_URL
    };
  }
}