/**
 * TravelPayouts Flight Search Service
 * Provides real-time flight search and booking affiliate links
 */

export interface FlightOption {
  airline: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  currency: string;
  bookingUrl: string;
  gates?: string;
  matchesSchedule?: boolean; // Indicates if this flight matches the planned schedule
}

export class TravelPayoutsService {
  private static readonly API_KEY = import.meta.env.VITE_TRAVELPAYOUTS_API_KEY;
  private static readonly MARKER = import.meta.env.VITE_TRAVELPAYOUTS_MARKER || 'default';
  private static readonly BASE_URL = 'https://api.travelpayouts.com';

  /**
   * Search for flights between two airports with optional time preferences
   * @param fromIATA - Departure airport IATA code
   * @param toIATA - Arrival airport IATA code
   * @param date - Departure date in YYYY-MM-DD format
   * @param timePreferences - Optional time preferences from existing route data
   * @returns Array of flight options
   */
  static async searchFlights(
    fromIATA: string, 
    toIATA: string, 
    date: string,
    timePreferences?: {
      departureTime?: string; // HH:MM format
      arrivalTime?: string;   // HH:MM format
      duration?: string;      // Duration string like "6h" or "2h 30m"
    }
  ): Promise<FlightOption[]> {
    console.log('🔍 TravelPayouts Config:', {
      hasApiKey: !!this.API_KEY,
      apiKey: this.API_KEY?.substring(0, 8) + '...',
      marker: this.MARKER
    });

    if (!this.API_KEY) {
      console.warn('TravelPayouts API key not configured');
      return [];
    }

    try {
      // TravelPayouts Flight Search API
      const searchUrl = `${this.BASE_URL}/v1/prices/direct`;
      const params = new URLSearchParams({
        origin: fromIATA,
        destination: toIATA,
        depart_date: date,
        token: this.API_KEY,
        currency: 'JPY'
      });

      const response = await fetch(`${searchUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`TravelPayouts API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        console.warn('No flight data returned from TravelPayouts');
        return [];
      }

      // Transform API response to FlightOption format
      return this.transformFlightData(data.data, fromIATA, toIATA, date, timePreferences);
      
    } catch (error) {
      console.error('TravelPayouts flight search failed:', error);
      return [];
    }
  }

  /**
   * Get cheap flights for a route (alternative endpoint)
   * @param fromIATA - Departure airport IATA code
   * @param toIATA - Arrival airport IATA code
   * @param date - Departure date in YYYY-MM-DD format
   * @returns Array of flight options
   */
  static async getCheapFlights(
    fromIATA: string,
    toIATA: string, 
    date: string
  ): Promise<FlightOption[]> {
    if (!this.API_KEY) {
      console.warn('TravelPayouts API key not configured');
      return [];
    }

    try {
      const searchUrl = `${this.BASE_URL}/v1/prices/cheap`;
      const params = new URLSearchParams({
        origin: fromIATA,
        destination: toIATA,
        depart_date: date,
        token: this.API_KEY,
        currency: 'JPY'
      });

      const response = await fetch(`${searchUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`TravelPayouts API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        return [];
      }

      return this.transformFlightData(data.data, fromIATA, toIATA, date, timePreferences);
      
    } catch (error) {
      console.error('TravelPayouts cheap flights search failed:', error);
      return [];
    }
  }

  /**
   * Transform TravelPayouts API response to our FlightOption format
   */
  private static transformFlightData(
    apiData: any, 
    fromIATA: string, 
    toIATA: string, 
    date: string,
    timePreferences?: {
      departureTime?: string;
      arrivalTime?: string;
      duration?: string;
    }
  ): FlightOption[] {
    const flights: FlightOption[] = [];

    // Handle different API response formats
    if (Array.isArray(apiData)) {
      // Direct flights array
      apiData.forEach((flight, index) => {
        flights.push(this.createFlightOption(flight, fromIATA, toIATA, date, index, timePreferences));
      });
    } else if (typeof apiData === 'object') {
      // Object with flight data
      Object.values(apiData).forEach((flight: any, index) => {
        if (flight && typeof flight === 'object') {
          flights.push(this.createFlightOption(flight, fromIATA, toIATA, date, index, timePreferences));
        }
      });
    }

    // Sort by schedule match first, then by price
    return flights.sort((a, b) => {
      // Prioritize flights that match the schedule
      if (a.matchesSchedule && !b.matchesSchedule) return -1;
      if (!a.matchesSchedule && b.matchesSchedule) return 1;
      // Then sort by price
      return a.price - b.price;
    });
  }

  /**
   * Create a standardized FlightOption from API data
   */
  private static createFlightOption(
    flightData: any,
    fromIATA: string,
    toIATA: string, 
    date: string,
    index: number,
    timePreferences?: {
      departureTime?: string;
      arrivalTime?: string;
      duration?: string;
    }
  ): FlightOption {
    // Default values for missing data
    const airlineCode = flightData.airline || 'XX';
    const flightNumber = flightData.flight_number || `${airlineCode}${String(index + 1).padStart(3, '0')}`;
    const price = flightData.value || flightData.price || 0;
    
    // Use time preferences if available, otherwise generate realistic times
    let departureTime: string;
    let arrivalTime: string;
    let duration: string;
    let matchesSchedule = false;

    if (timePreferences?.departureTime && timePreferences?.arrivalTime) {
      // Use the exact times from the route popup
      departureTime = timePreferences.departureTime;
      arrivalTime = timePreferences.arrivalTime;
      duration = timePreferences.duration || this.calculateDuration(departureTime, arrivalTime);
      matchesSchedule = true;
    } else {
      // Generate realistic departure/arrival times if not provided
      const baseHour = 6 + (index * 2); // Stagger flight times
      departureTime = flightData.departure_at || `${String(baseHour).padStart(2, '0')}:${String((index * 15) % 60).padStart(2, '0')}`;
      arrivalTime = flightData.return_at || this.calculateArrivalTime(departureTime, 6); // Assume 6 hour flight
      duration = flightData.duration || '6h';

      // Check if generated times are close to preferences
      if (timePreferences?.departureTime) {
        const timeDiff = this.calculateTimeDifference(departureTime, timePreferences.departureTime);
        matchesSchedule = timeDiff <= 60; // Within 1 hour
      }
    }
    
    return {
      airline: this.getAirlineName(airlineCode),
      flightNumber: flightNumber,
      departure: departureTime,
      arrival: arrivalTime,
      duration: duration,
      price: Math.round(price),
      currency: 'JPY',
      bookingUrl: this.generateBookingUrl(fromIATA, toIATA, date, airlineCode),
      gates: flightData.gates,
      matchesSchedule: matchesSchedule
    };
  }

  /**
   * Calculate arrival time based on departure time and duration
   */
  private static calculateArrivalTime(departureTime: string, durationHours: number): string {
    const [hours, minutes] = departureTime.split(':').map(Number);
    const departureMinutes = hours * 60 + minutes;
    const arrivalMinutes = departureMinutes + (durationHours * 60);
    
    const arrivalHours = Math.floor(arrivalMinutes / 60) % 24;
    const arrivalMins = arrivalMinutes % 60;
    
    return `${String(arrivalHours).padStart(2, '0')}:${String(arrivalMins).padStart(2, '0')}`;
  }

  /**
   * Calculate duration between two times
   */
  private static calculateDuration(departureTime: string, arrivalTime: string): string {
    const [depHours, depMinutes] = departureTime.split(':').map(Number);
    const [arrHours, arrMinutes] = arrivalTime.split(':').map(Number);
    
    const depTotalMinutes = depHours * 60 + depMinutes;
    let arrTotalMinutes = arrHours * 60 + arrMinutes;
    
    // Handle overnight flights
    if (arrTotalMinutes < depTotalMinutes) {
      arrTotalMinutes += 24 * 60;
    }
    
    const durationMinutes = arrTotalMinutes - depTotalMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Calculate time difference in minutes between two times
   */
  private static calculateTimeDifference(time1: string, time2: string): number {
    const [hours1, minutes1] = time1.split(':').map(Number);
    const [hours2, minutes2] = time2.split(':').map(Number);
    
    const totalMinutes1 = hours1 * 60 + minutes1;
    const totalMinutes2 = hours2 * 60 + minutes2;
    
    return Math.abs(totalMinutes1 - totalMinutes2);
  }

  /**
   * Get airline name from IATA code
   */
  private static getAirlineName(code: string): string {
    const airlines: { [key: string]: string } = {
      'NH': 'ANA',
      'JL': 'JAL',
      'UA': 'United',
      'DL': 'Delta',
      'AA': 'American',
      'LH': 'Lufthansa',
      'BA': 'British Airways',
      'AF': 'Air France',
      'KL': 'KLM',
      'SQ': 'Singapore Airlines',
      'CX': 'Cathay Pacific',
      'TG': 'Thai Airways',
      'EK': 'Emirates',
      'QF': 'Qantas',
      'AC': 'Air Canada'
    };
    
    return airlines[code] || code;
  }

  /**
   * Generate TravelPayouts affiliate booking URL
   */
  private static generateBookingUrl(
    fromIATA: string,
    toIATA: string, 
    date: string,
    airline?: string
  ): string {
    const baseUrl = 'https://www.aviasales.com';
    const marker = this.MARKER || 'default';
    
    const params = new URLSearchParams({
      origin_iata: fromIATA,
      destination_iata: toIATA,
      depart_date: date,
      return_date: '',
      adults: '1',
      children: '0',
      infants: '0',
      marker: marker
    });

    if (airline) {
      params.append('airline', airline);
    }

    return `${baseUrl}/search/${fromIATA}${toIATA}${date.replace(/-/g, '')}?${params.toString()}`;
  }

  /**
   * Check if TravelPayouts service is properly configured
   */
  static isConfigured(): boolean {
    return !!this.API_KEY; // Only API_KEY is required
  }

  /**
   * Get configuration status for debugging
   */
  static getConfigStatus(): { apiKey: boolean; marker: boolean } {
    return {
      apiKey: !!this.API_KEY,
      marker: !!this.MARKER
    };
  }
}