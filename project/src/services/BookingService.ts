import { supabase } from '../lib/supabase';
import type { Booking, FlightBooking, HotelBooking } from '../types/booking';

export class BookingService {
  /**
   * Save a new booking to the database
   */
  static async saveBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<Booking> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          ...booking,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save booking:', error);
        throw new Error(`Failed to save booking: ${error.message}`);
      }

      return data as Booking;
    } catch (error) {
      console.error('BookingService.saveBooking error:', error);
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
  static async getBookingsByType(tripId: string, type: 'flight' | 'hotel'): Promise<Booking[]> {
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
}