/**
 * Unified Place Selection Data Types for Voypath
 * Phase 0: Support for 6 input locations with context information
 */

import { GooglePlacePhoto } from '../services/PlaceSearchService';

export interface SelectedPlaceData {
  // Google Maps API core information
  google_place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  photos?: GooglePlacePhoto[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  
  // Context information (6 input locations support)
  source_location: 'create_trip_departure' | 'create_trip_destination' | 'map_view' | 'list_view' | 'calendar_view' | 'my_places';
  selected_date?: string;
  selected_time_slot?: string;
}

export interface PlaceInputContext {
  source: SelectedPlaceData['source_location'];
  date?: string;
  timeSlot?: string;
  tripId?: string;
}

export interface PlaceDetailForm {
  selectedPlace: SelectedPlaceData;
  wish_level: 1 | 2 | 3 | 4 | 5;
  stay_duration_minutes: number;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  estimated_cost?: number;
  transport_mode?: 'walking' | 'public_transport' | 'car' | 'bicycle' | 'taxi';
  category: string;
  image_url?: string;
} 