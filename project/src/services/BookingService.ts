import { supabase, handleNetworkFailure, resetNetworkFailureCount, retryOperation } from '../lib/supabase';
import type { Booking, FlightBooking, HotelBooking, TransportBooking } from '../types/booking';

export class BookingService {
  /**
   * Save a new booking to the database
   */
  static async saveBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<Booking> {
    try {
      const startTime = Date.now();
      console.log('🔍 Starting booking save:', {
        bookingType: booking.booking_type,
        timestamp: new Date().toISOString()
      });
      
      // Debug authentication status before booking save
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!import.meta.env.PROD) {
        console.log('🔍 Booking save - Auth status:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id ? session.user.id.substring(0, 8) + '...' : null,
          bookingUserId: booking.user_id ? booking.user_id.substring(0, 8) + '...' : null,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          sessionError: sessionError?.message,
          environment: import.meta.env.PROD ? 'production' : 'development'
        });
      }

      const { data, error } = await retryOperation(async () => {
        return await supabase
          .from('bookings')
          .insert({
            ...booking,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      });

      if (error) {
        const duration = Date.now() - startTime;
        console.error('🚨 Booking save failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          duration: `${duration}ms`,
          bookingData: {
            user_id: booking.user_id,
            trip_id: booking.trip_id,
            booking_type: booking.booking_type
          },
          timestamp: new Date().toISOString()
        });
        throw new Error(`Failed to save booking: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      console.log('✅ Booking saved successfully:', { 
        bookingId: data.id, 
        type: booking.booking_type,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
      resetNetworkFailureCount(); // Reset failure count on success
      return data as Booking;
    } catch (error) {
      // Handle network failures
      if (error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('fetch')
      )) {
        handleNetworkFailure(error, 'BookingService.saveBooking');
      }
      
      console.error('🚨 BookingService.saveBooking error:', error);
      throw error;
    }
  }

  /**
   * Get all bookings for a specific trip
   */
  static async getBookingsForTrip(tripId: string): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load bookings:', error);
        throw new Error(`Failed to load bookings: ${error.message}`);
      }

      return (data || []) as Booking[];
    } catch (error) {
      console.error('BookingService.getBookingsForTrip error:', error);
      throw error;
    }
  }

  /**
   * Get bookings by type for a specific trip
   */
  static async getBookingsByType(tripId: string, type: 'flight' | 'hotel' | 'walking' | 'car'): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('trip_id', tripId)
        .eq('booking_type', type)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load bookings by type:', error);
        throw new Error(`Failed to load ${type} bookings: ${error.message}`);
      }

      return (data || []) as Booking[];
    } catch (error) {
      console.error('BookingService.getBookingsByType error:', error);
      throw error;
    }
  }

  /**
   * Update an existing booking
   */
  static async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update booking:', error);
        throw new Error(`Failed to update booking: ${error.message}`);
      }

      return data as Booking;
    } catch (error) {
      console.error('BookingService.updateBooking error:', error);
      throw error;
    }
  }

  /**
   * Delete a booking
   */
  static async deleteBooking(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete booking:', error);
        throw new Error(`Failed to delete booking: ${error.message}`);
      }
    } catch (error) {
      console.error('BookingService.deleteBooking error:', error);
      throw error;
    }
  }

  /**
   * Get bookings created by a specific user for a trip
   */
  static async getUserBookingsForTrip(tripId: string, userId: string): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load user bookings:', error);
        throw new Error(`Failed to load user bookings: ${error.message}`);
      }

      return (data || []) as Booking[];
    } catch (error) {
      console.error('BookingService.getUserBookingsForTrip error:', error);
      throw error;
    }
  }


  /**
   * Save a flight booking with flight-specific data
   */
  static async saveFlightBooking(tripId: string, userId: string, flightData: {
    booking_link?: string;
    flight_number?: string;
    departure_time?: string;
    arrival_time?: string;
    price?: string;
    passengers?: number;
    route?: string;
    departure_date?: string;
    notes?: string;
  }): Promise<FlightBooking> {
    const booking: Omit<FlightBooking, 'id' | 'created_at' | 'updated_at'> = {
      trip_id: tripId,
      user_id: userId,
      booking_type: 'flight',
      booking_link: flightData.booking_link,
      flight_number: flightData.flight_number,
      departure_time: flightData.departure_time,
      arrival_time: flightData.arrival_time,
      price: flightData.price,
      passengers: flightData.passengers,
      route: flightData.route,
      departure_date: flightData.departure_date,
      notes: flightData.notes
    };

    return this.saveBooking(booking) as Promise<FlightBooking>;
  }

  /**
   * Save a hotel booking with hotel-specific data
   */
  static async saveHotelBooking(tripId: string, userId: string, hotelData: {
    booking_link?: string;
    hotel_name?: string;
    address?: string;
    check_in_time?: string;
    check_out_time?: string;
    check_in_date?: string;
    check_out_date?: string;
    guests?: number;
    price_per_night?: string;
    rating?: number;
    location?: string;
    notes?: string;
  }): Promise<HotelBooking> {
    const booking: Omit<HotelBooking, 'id' | 'created_at' | 'updated_at'> = {
      trip_id: tripId,
      user_id: userId,
      booking_type: 'hotel',
      booking_link: hotelData.booking_link,
      hotel_name: hotelData.hotel_name,
      address: hotelData.address,
      check_in_time: hotelData.check_in_time,
      check_out_time: hotelData.check_out_time,
      check_in_date: hotelData.check_in_date,
      check_out_date: hotelData.check_out_date,
      guests: hotelData.guests,
      price_per_night: hotelData.price_per_night,
      rating: hotelData.rating,
      location: hotelData.location,
      notes: hotelData.notes
    };

    return this.saveBooking(booking) as Promise<HotelBooking>;
  }

  /**
   * Save a transport booking with transport-specific data
   */
  static async saveTransportBooking(transportData: Omit<TransportBooking, 'id' | 'created_at' | 'updated_at'>): Promise<TransportBooking> {
    return this.saveBooking(transportData) as Promise<TransportBooking>;
  }

  /**
   * Add a booking to trip - converts booking to time constraints and triggers edit-schedule
   */
  static async addToTrip(tripId: string, userId: string, booking: Booking): Promise<void> {
    try {
      console.log('🔍 Adding booking to trip:', {
        bookingType: booking.booking_type,
        tripId: tripId.substring(0, 8) + '...',
        userId: userId.substring(0, 8) + '...'
      });

      if (booking.booking_type === 'hotel') {
        await this.addHotelToTrip(tripId, userId, booking as HotelBooking);
      } else if (booking.booking_type === 'flight') {
        await this.addFlightToTrip(tripId, userId, booking as FlightBooking);
      } else if (booking.booking_type === 'car' || booking.booking_type === 'walking') {
        await this.addTransportToTrip(tripId, userId, booking as TransportBooking);
      } else {
        throw new Error(`Unsupported booking type: ${booking.booking_type}`);
      }

      console.log('✅ Booking successfully added to trip');
      resetNetworkFailureCount();

    } catch (error) {
      console.error('🚨 BookingService.addToTrip failed:', error);
      await handleNetworkFailure(error);
      throw error;
    }
  }

  /**
   * Add hotel booking to trip as time-constrained place
   */
  static async addHotelToTrip(tripId: string, userId: string, booking: HotelBooking): Promise<void> {
    try {
      console.log('🏨 Adding hotel booking to trip as time-constrained place');

      // Check if hotel has Google Maps location data
      if (!booking.latitude || !booking.longitude || !booking.google_place_id) {
        throw new Error('Hotel must have location data (latitude, longitude, google_place_id) to be added to trip. Please select a hotel from Google Maps search.');
      }

      // Check for existing hotel places from this modal context to prevent duplicates
      const modalContext = `${booking.location}-${booking.check_in_date}`;
      const { data: existingHotels } = await supabase
        .from('places')
        .select('id, name')
        .eq('trip_id', tripId)
        .eq('source', 'google_maps_booking')
        .ilike('notes', `%${modalContext}%`);

      if (existingHotels && existingHotels.length > 0) {
        throw new Error(`A hotel has already been added for ${booking.location} on ${booking.check_in_date}. Only one hotel per modal context is allowed.`);
      }

      // Create ISO datetime strings for constraints
      const checkInDateTime = `${booking.check_in_date}T${booking.check_in_time}:00.000Z`;
      const checkOutDateTime = `${booking.check_out_date}T${booking.check_out_time}:00.000Z`;

      // Calculate stay duration in minutes
      const checkInTime = new Date(checkInDateTime);
      const checkOutTime = new Date(checkOutDateTime);
      const stayDurationMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      // Insert hotel as time-constrained place
      const { error: placeError } = await supabase
        .from('places')
        .insert({
          trip_id: tripId,
          user_id: userId,
          name: booking.hotel_name || 'Selected Hotel',
          latitude: booking.latitude,
          longitude: booking.longitude,
          address: booking.address,
          category: 'tourist_attraction', // Use existing valid category
          place_type: 'member_wish', // Use valid place_type
          constraint_arrival_time: checkInDateTime,
          constraint_departure_time: checkOutDateTime,
          stay_duration_minutes: Math.max(stayDurationMinutes, 720), // Minimum 12 hours
          wish_level: 5, // High priority for booked hotels
          source: 'google_maps_booking',
          google_place_id: booking.google_place_id,
          notes: `Hotel booking: ${booking.hotel_name || 'Hotel'} | Context: ${modalContext}`
        });

      if (placeError) {
        console.error('❌ Failed to create hotel place:', placeError.message);
        throw new Error(`Failed to add hotel to trip: ${placeError.message}`);
      }

      console.log('✅ Hotel successfully added as time-constrained place for optimization');
    } catch (error) {
      console.error('🚨 addHotelToTrip failed:', error);
      throw error;
    }
  }

  /**
   * Add flight booking to trip - updates airport place constraints
   */
  static async addFlightToTrip(tripId: string, userId: string, booking: FlightBooking): Promise<void> {
    try {
      console.log('✈️ Adding flight booking to trip as airport place constraints');

      if (!booking.route || !booking.departure_time || !booking.arrival_time || !booking.departure_date) {
        throw new Error('Flight must have route, departure/arrival times, and departure date to be added to trip.');
      }

      // Parse route: "Tokyo Haneda Airport (HND) → Beijing Daxing International Airport (PKX)"
      const routeParts = booking.route.split(' → ');
      if (routeParts.length < 2) {
        throw new Error('Invalid flight route format. Expected: "Departure Airport → Arrival Airport"');
      }

      const departureAirport = routeParts[0].trim();
      const arrivalAirport = routeParts[1].trim();

      // Create ISO datetime strings for constraints
      const departureDateTime = `${booking.departure_date}T${booking.departure_time}:00.000Z`;
      
      // Handle arrival time (might be next day for overnight flights)
      let arrivalDate = booking.departure_date;
      if (booking.departure_time && booking.arrival_time) {
        const depHour = parseInt(booking.departure_time.split(':')[0]);
        const arrHour = parseInt(booking.arrival_time.split(':')[0]);
        
        // If arrival time is much earlier than departure, assume next day
        if (arrHour < depHour && (depHour - arrHour) > 12) {
          const nextDay = new Date(booking.departure_date);
          nextDay.setDate(nextDay.getDate() + 1);
          arrivalDate = nextDay.toISOString().split('T')[0];
        }
      }
      const arrivalDateTime = `${arrivalDate}T${booking.arrival_time}:00.000Z`;

      // Find departure airport place (flexible search)
      let depPlace = null;
      try {
        // Try exact match first
        let { data: exactMatch } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .eq('name', departureAirport)
          .limit(1);
        
        if (exactMatch && exactMatch.length > 0) {
          depPlace = exactMatch[0];
        } else {
          // Try partial match with airport name without codes
          const airportNameOnly = departureAirport.replace(/\s*\([A-Z]{3,4}\)\s*/, '').trim();
          let { data: partialMatch } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId)
            .ilike('name', `%${airportNameOnly}%`)
            .limit(1);
          
          if (partialMatch && partialMatch.length > 0) {
            depPlace = partialMatch[0];
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for departure airport: ${error}`);
      }

      // Find arrival airport place (flexible search)
      let arrPlace = null;
      try {
        // Try exact match first
        let { data: exactMatch } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .eq('name', arrivalAirport)
          .limit(1);
        
        if (exactMatch && exactMatch.length > 0) {
          arrPlace = exactMatch[0];
        } else {
          // Try partial match with airport name without codes
          const airportNameOnly = arrivalAirport.replace(/\s*\([A-Z]{3,4}\)\s*/, '').trim();
          let { data: partialMatch } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId)
            .ilike('name', `%${airportNameOnly}%`)
            .limit(1);
          
          if (partialMatch && partialMatch.length > 0) {
            arrPlace = partialMatch[0];
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for arrival airport: ${error}`);
      }

      // Update departure airport constraints
      if (depPlace) {
        const { error: depError } = await supabase
          .from('places')
          .update({ constraint_departure_time: departureDateTime })
          .eq('id', depPlace.id);
        
        if (depError) {
          console.warn(`⚠️ Could not update departure airport constraint: ${depError.message}`);
        } else {
          console.log(`✅ Updated departure constraint: ${departureAirport} at ${departureDateTime}`);
        }
      } else {
        console.warn(`⚠️ Departure airport place not found: ${departureAirport}`);
      }

      // Update arrival airport constraints
      if (arrPlace) {
        const { error: arrError } = await supabase
          .from('places')
          .update({ constraint_arrival_time: arrivalDateTime })
          .eq('id', arrPlace.id);
        
        if (arrError) {
          console.warn(`⚠️ Could not update arrival airport constraint: ${arrError.message}`);
        } else {
          console.log(`✅ Updated arrival constraint: ${arrivalAirport} at ${arrivalDateTime}`);
        }
      } else {
        console.warn(`⚠️ Arrival airport place not found: ${arrivalAirport}`);
      }

      if (!depPlace && !arrPlace) {
        throw new Error(`No airport places found in trip for route: ${booking.route}. Please add airports to your trip first.`);
      }

      console.log('✅ Flight constraints successfully added to airport places');
    } catch (error) {
      console.error('🚨 addFlightToTrip failed:', error);
      throw error;
    }
  }

  /**
   * Add transport booking to trip - updates endpoint place constraints
   */
  static async addTransportToTrip(tripId: string, userId: string, booking: TransportBooking): Promise<void> {
    try {
      console.log(`🚗 Adding ${booking.booking_type} booking to trip as endpoint place constraints`);

      if (!booking.route || !booking.departure_time || !booking.arrival_time || !booking.departure_date) {
        throw new Error(`${booking.booking_type} must have route, departure/arrival times, and departure date to be added to trip.`);
      }

      // Parse route: "Location A → Location B"
      const routeParts = booking.route.split(' → ');
      if (routeParts.length < 2) {
        throw new Error('Invalid transport route format. Expected: "From Location → To Location"');
      }

      const fromLocation = routeParts[0].trim();
      const toLocation = routeParts[1].trim();

      // Create ISO datetime strings for constraints
      const departureDateTime = `${booking.departure_date}T${booking.departure_time}:00.000Z`;
      
      // Handle arrival time (might be next day for overnight transport)
      let arrivalDate = booking.departure_date;
      if (booking.departure_time && booking.arrival_time) {
        const depHour = parseInt(booking.departure_time.split(':')[0]);
        const arrHour = parseInt(booking.arrival_time.split(':')[0]);
        
        // If arrival time is much earlier than departure, assume next day
        if (arrHour < depHour && (depHour - arrHour) > 12) {
          const nextDay = new Date(booking.departure_date);
          nextDay.setDate(nextDay.getDate() + 1);
          arrivalDate = nextDay.toISOString().split('T')[0];
        }
      }
      const arrivalDateTime = `${arrivalDate}T${booking.arrival_time}:00.000Z`;

      // Find from location place (flexible search)
      let fromPlace = null;
      try {
        // Try exact match first
        let { data: exactMatch } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .eq('name', fromLocation)
          .limit(1);
        
        if (exactMatch && exactMatch.length > 0) {
          fromPlace = exactMatch[0];
        } else {
          // Try partial match
          let { data: partialMatch } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId)
            .ilike('name', `%${fromLocation}%`)
            .limit(1);
          
          if (partialMatch && partialMatch.length > 0) {
            fromPlace = partialMatch[0];
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for from location: ${error}`);
      }

      // Find to location place (flexible search)
      let toPlace = null;
      try {
        // Try exact match first
        let { data: exactMatch } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .eq('name', toLocation)
          .limit(1);
        
        if (exactMatch && exactMatch.length > 0) {
          toPlace = exactMatch[0];
        } else {
          // Try partial match
          let { data: partialMatch } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId)
            .ilike('name', `%${toLocation}%`)
            .limit(1);
          
          if (partialMatch && partialMatch.length > 0) {
            toPlace = partialMatch[0];
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for to location: ${error}`);
      }

      // Update from location constraints
      if (fromPlace) {
        const { error: fromError } = await supabase
          .from('places')
          .update({ constraint_departure_time: departureDateTime })
          .eq('id', fromPlace.id);
        
        if (fromError) {
          console.warn(`⚠️ Could not update from location constraint: ${fromError.message}`);
        } else {
          console.log(`✅ Updated departure constraint: ${fromLocation} at ${departureDateTime}`);
        }
      } else {
        console.warn(`⚠️ From location place not found: ${fromLocation}`);
      }

      // Update to location constraints
      if (toPlace) {
        const { error: toError } = await supabase
          .from('places')
          .update({ constraint_arrival_time: arrivalDateTime })
          .eq('id', toPlace.id);
        
        if (toError) {
          console.warn(`⚠️ Could not update to location constraint: ${toError.message}`);
        } else {
          console.log(`✅ Updated arrival constraint: ${toLocation} at ${arrivalDateTime}`);
        }
      } else {
        console.warn(`⚠️ To location place not found: ${toLocation}`);
      }

      if (!fromPlace && !toPlace) {
        throw new Error(`No places found in trip for route: ${booking.route}. Please add these locations to your trip first.`);
      }

      console.log(`✅ ${booking.booking_type} constraints successfully added to endpoint places`);
    } catch (error) {
      console.error(`🚨 addTransportToTrip failed:`, error);
      throw error;
    }
  }
}