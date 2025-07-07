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
  source?: string; // Source of flight data (WayAway, mock_wayaway, etc.)
}

export class TravelPayoutsService {
  private static readonly API_KEY = import.meta.env.VITE_TRAVELPAYOUTS_API_KEY;
  private static readonly MARKER = '649297'; // Trip.com affiliate marker
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
    console.log('🔍 Using WayAway real flight data integration');
    
    // Try to get real flight data from WayAway first
    try {
      const { WayAwayService } = await import('./WayAwayService');
      
      console.log('🔍 WayAway Service Configuration Check:', WayAwayService.getConfig());
      
      if (WayAwayService.isConfigured()) {
        console.log('✅ WayAway service configured, searching real flights...', {
          fromIATA,
          toIATA,
          date,
          timePreferences
        });
        
        const wayawayData = await WayAwayService.searchFlightPrices({
          origin: fromIATA,
          destination: toIATA,
          departDate: date,
          currency: 'JPY'
        });

        console.log('🔍 WayAway API Response:', wayawayData);

        if (wayawayData.success && wayawayData.data && Object.keys(wayawayData.data).length > 0) {
          console.log('✅ Real flight data received from WayAway, transforming to flight options...');
          const transformedFlights = WayAwayService.transformToFlightOptions(wayawayData, timePreferences);
          console.log('✅ Transformed flights:', transformedFlights);
          return transformedFlights;
        } else {
          console.warn('⚠️ WayAway returned empty or unsuccessful data:', wayawayData);
          console.warn('⚠️ Falling back to mock data');
        }
      } else {
        console.warn('⚠️ WayAway service not configured, using mock data');
        console.warn('Configuration details:', WayAwayService.getConfig());
      }
    } catch (error) {
      console.error('❌ WayAway integration failed:', error);
      console.warn('⚠️ Falling back to mock data due to error');
    }
    
    // Fallback to mock data with WayAway affiliate links
    console.warn('No results found from API - using mock data with WayAway links');
    return this.getMockFlightDataWithWayAway(fromIATA, toIATA, timePreferences, date);
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

      return this.transformFlightData(data.data, fromIATA, toIATA, date);
      
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
  public static generateBookingUrl(
    fromIATA: string,
    toIATA: string, 
    date: string,
    airline?: string
  ): string {
    // Generate Trip.com search URL
    const tripComUrl = this.generateTripComUrl(fromIATA, toIATA, date);
    
    // Create TravelPayouts affiliate link (official format)
    const marker = this.MARKER;
    const trs = '434567'; // TravelPayouts tracking ID  
    const p = '8626'; // Trip.com partner ID
    const campaignId = '121';
    
    // Use TravelPayouts official link format with proper tracking
    const encodedUrl = encodeURIComponent(tripComUrl);
    
    // Add debugging info
    console.log('🔗 Generated affiliate link:', {
      marker,
      trs,
      p,
      tripComUrl,
      encodedUrl,
      finalUrl: `https://tp.media/r?marker=${marker}&trs=${trs}&p=${p}&u=${encodedUrl}&campaign_id=${campaignId}`
    });
    
    return `https://tp.media/r?marker=${marker}&trs=${trs}&p=${p}&u=${encodedUrl}&campaign_id=${campaignId}`;
  }

  /**
   * Generate Trip.com search URL
   */
  public static generateTripComUrl(
    fromIATA: string,
    toIATA: string,
    date: string
  ): string {
    // Convert IATA codes to city codes for Trip.com
    const fromCity = this.iataToCityCode(fromIATA);
    const toCity = this.iataToCityCode(toIATA);
    
    const params = new URLSearchParams({
      dcity: fromCity,
      acity: toCity,
      ddate: date,
      dairport: fromIATA.toLowerCase(),
      triptype: 'ow', // one way
      class: 'y', // economy
      lowpricesource: 'searchform',
      quantity: '1',
      searchboxarg: 't',
      nonstoponly: 'off',
      locale: 'ja-JP',
      curr: 'JPY'
    });

    return `https://jp.trip.com/flights/showfarefirst?${params.toString()}`;
  }

  /**
   * Convert IATA airport code to city code for Trip.com
   */
  public static iataToCityCode(iata: string): string {
    const cityMap: { [key: string]: string } = {
      'JFK': 'nyc', 'LGA': 'nyc', 'EWR': 'nyc', // New York
      'NRT': 'tyo', 'HND': 'tyo', // Tokyo
      'LAX': 'lax', // Los Angeles
      'CKG': 'ckg', // Chongqing
      'PEK': 'bjs', 'PKX': 'bjs', // Beijing
      'PVG': 'sha', 'SHA': 'sha', // Shanghai
      'ICN': 'sel', 'GMP': 'sel', // Seoul
      'BKK': 'bkk', // Bangkok
      'SIN': 'sin', // Singapore
      'HKG': 'hkg', // Hong Kong
      'TPE': 'tpe', // Taipei
      'KUL': 'kul', // Kuala Lumpur
      'MNL': 'mnl', // Manila
      'CGK': 'jkt', // Jakarta
      'BOM': 'bom', // Mumbai
      'DEL': 'del', // Delhi
      'DXB': 'dxb', // Dubai
      'DOH': 'doh', // Doha
      'LHR': 'lon', 'LGW': 'lon', 'STN': 'lon', // London
      'CDG': 'par', 'ORY': 'par', // Paris
      'FRA': 'fra', // Frankfurt
      'AMS': 'ams', // Amsterdam
      'ZUR': 'zur', // Zurich
      'SYD': 'syd', // Sydney
      'MEL': 'mel', // Melbourne
      'YVR': 'yvr', // Vancouver
      'YYZ': 'yyz', // Toronto
      'GRU': 'sao', // São Paulo
      'GIG': 'rio', // Rio de Janeiro
      'MAD': 'mad', // Madrid
      'BCN': 'bcn', // Barcelona
      'FCO': 'rom', // Rome
      'MXP': 'mil', // Milan
    };
    
    return cityMap[iata.toUpperCase()] || iata.toLowerCase();
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

  /**
   * Generate mock flight data for demonstration when API key is not available
   */
  private static getMockFlightData(
    fromIATA: string,
    toIATA: string, 
    timePreferences?: {
      departureTime?: string;
      arrivalTime?: string;
      duration?: string;
    },
    date?: string
  ): FlightOption[] {
    const airlines = ['ANA', 'JAL', 'United', 'Delta', 'Lufthansa'];
    const flights: FlightOption[] = [];

    // Create a flight that matches the schedule exactly
    if (timePreferences?.departureTime && timePreferences?.arrivalTime) {
      flights.push({
        airline: 'ANA',
        flightNumber: 'NH123',
        departure: timePreferences.departureTime,
        arrival: timePreferences.arrivalTime,
        duration: timePreferences.duration || '6h',
        price: 45000,
        currency: 'JPY',
        bookingUrl: this.generateBookingUrl(fromIATA, toIATA, date || new Date().toISOString().split('T')[0], 'NH'),
        matchesSchedule: true
      });
    }

    // Add additional mock flights
    for (let i = 0; i < 4; i++) {
      const airline = airlines[i % airlines.length];
      const airlineCode = airline === 'ANA' ? 'NH' : airline === 'JAL' ? 'JL' : airline.substring(0, 2);
      const baseHour = 7 + (i * 3);
      const departureTime = `${String(baseHour).padStart(2, '0')}:${String((i * 20) % 60).padStart(2, '0')}`;
      const arrivalTime = this.calculateArrivalTime(departureTime, 6);
      
      // Skip if this would be identical to the exact match
      if (timePreferences?.departureTime === departureTime) continue;

      flights.push({
        airline: airline,
        flightNumber: `${airlineCode}${String(100 + i * 111).substring(0, 3)}`,
        departure: departureTime,
        arrival: arrivalTime,
        duration: '6h',
        price: 35000 + (i * 8000) + Math.floor(Math.random() * 5000),
        currency: 'JPY',
        bookingUrl: this.generateBookingUrl(fromIATA, toIATA, date || new Date().toISOString().split('T')[0], airlineCode),
        matchesSchedule: false
      });
    }

    // Sort by schedule match first, then by price
    return flights.sort((a, b) => {
      if (a.matchesSchedule && !b.matchesSchedule) return -1;
      if (!a.matchesSchedule && b.matchesSchedule) return 1;
      return a.price - b.price;
    });
  }

  /**
   * Generate mock flight data with WayAway affiliate links
   */
  private static getMockFlightDataWithWayAway(
    fromIATA: string,
    toIATA: string, 
    timePreferences?: {
      departureTime?: string;
      arrivalTime?: string;
      duration?: string;
    },
    date?: string
  ): FlightOption[] {
    const airlines = ['ANA', 'JAL', 'United', 'Delta', 'Lufthansa'];
    const flights: FlightOption[] = [];

    // Create a flight that matches the schedule exactly
    if (timePreferences?.departureTime && timePreferences?.arrivalTime) {
      flights.push({
        airline: 'ANA',
        flightNumber: 'NH123',
        departure: timePreferences.departureTime,
        arrival: timePreferences.arrivalTime,
        duration: timePreferences.duration || '6h',
        price: 45000,
        currency: 'JPY',
        bookingUrl: this.generateWayAwayBookingUrl(fromIATA, toIATA, date || new Date().toISOString().split('T')[0]),
        matchesSchedule: true,
        source: 'mock_wayaway'
      });
    }

    // Add additional mock flights with WayAway links
    for (let i = 0; i < 4; i++) {
      const airline = airlines[i % airlines.length];
      const airlineCode = airline === 'ANA' ? 'NH' : airline === 'JAL' ? 'JL' : airline.substring(0, 2);
      const baseHour = 7 + (i * 3);
      const departureTime = `${String(baseHour).padStart(2, '0')}:${String((i * 20) % 60).padStart(2, '0')}`;
      const arrivalTime = this.calculateArrivalTime(departureTime, 6);
      
      // Skip if this would be identical to the exact match
      if (timePreferences?.departureTime === departureTime) continue;

      flights.push({
        airline: airline,
        flightNumber: `${airlineCode}${String(100 + i * 111).substring(0, 3)}`,
        departure: departureTime,
        arrival: arrivalTime,
        duration: '6h',
        price: 35000 + (i * 8000) + Math.floor(Math.random() * 5000),
        currency: 'JPY',
        bookingUrl: this.generateWayAwayBookingUrl(fromIATA, toIATA, date || new Date().toISOString().split('T')[0]),
        matchesSchedule: false,
        source: 'mock_wayaway'
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
   * Generate WayAway booking URL for fallback mock data
   */
  private static generateWayAwayBookingUrl(
    fromIATA: string,
    toIATA: string,
    date: string
  ): string {
    // WayAway affiliate link parameters
    const marker = '649297';
    const trs = '434567';
    const p = '5976'; // WayAway partner ID
    const campaignId = '200'; // WayAway campaign ID
    
    // Generate WayAway search URL
    const wayawayUrl = `https://wayaway.io/search?origin_iata=${fromIATA}&destination_iata=${toIATA}&depart_date=${date}&adults=1&children=0&infants=0&currency=JPY&marker=${marker}`;
    
    // Create TravelPayouts affiliate link
    const encodedUrl = encodeURIComponent(wayawayUrl);
    return `https://tp.media/r?marker=${marker}&trs=${trs}&p=${p}&u=${encodedUrl}&campaign_id=${campaignId}`;
  }
}