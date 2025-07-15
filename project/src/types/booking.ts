// Booking types for server-side storage (matches actual database schema)
export interface BaseBooking {
  id?: string;
  trip_id: string;
  user_id: string;
  booking_type: 'flight' | 'hotel' | 'walking' | 'car';
  booking_link?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FlightBooking extends BaseBooking {
  booking_type: 'flight';
  flight_number?: string;
  departure_time?: string;
  arrival_time?: string;
  departure_date?: string;
  arrival_date?: string;
  price?: string;
  passengers?: number;
  route?: string;
  
  // Hotel fields should be null/undefined for flights
  hotel_name?: undefined;
  address?: undefined;
  check_in_time?: undefined;
  check_out_time?: undefined;
  check_in_date?: undefined;
  check_out_date?: undefined;
  guests?: undefined;
  price_per_night?: undefined;
  rating?: undefined;
  location?: undefined;
}

export interface HotelBooking extends BaseBooking {
  booking_type: 'hotel';
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
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
  
  // Flight fields should be null/undefined for hotels
  flight_number?: undefined;
  departure_time?: undefined;
  arrival_time?: undefined;
  passengers?: undefined;
  route?: undefined;
  departure_date?: undefined;
  price?: undefined;
}

export interface TransportBooking extends BaseBooking {
  booking_type: 'walking' | 'car';
  route?: string;
  departure_date?: string;
  arrival_date?: string;
  departure_time: string;
  arrival_time: string;
  price?: number;
  passengers: number;
  transport_info?: {
    route_details?: string;
    walking_distance?: string;
    walking_duration?: string;
    line_number?: string;
    platform?: string;
    direction?: string;
    departure_station?: string;
    arrival_station?: string;
  };
  
  // Flight and hotel fields should be undefined for transport
  flight_number?: undefined;
  hotel_name?: undefined;
  address?: undefined;
  check_in_time?: undefined;
  check_out_time?: undefined;
  check_in_date?: undefined;
  check_out_date?: undefined;
  guests?: undefined;
  price_per_night?: undefined;
  rating?: undefined;
  location?: undefined;
}

export type Booking = FlightBooking | HotelBooking | TransportBooking;

// Form data interfaces (for UI state)
export interface FlightBookingFormData {
  bookingLink: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  passengers: number;
  route: string;
  departureDate: string;
}

export interface HotelBookingFormData {
  bookingLink: string;
  hotelName: string;
  address: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  guests: number;
  pricePerNight: string;
  rating: number;
  location: string;
}