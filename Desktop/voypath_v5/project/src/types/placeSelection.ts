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
  vicinity?: string;
  
  // Context information (6 input locations support)
  source_location: 'create_trip_departure' | 'create_trip_destination' | 'map_view' | 'list_view' | 'calendar_view' | 'my_places';
  selected_date?: string;
  selected_time_slot?: string;
  
  // Additional metadata
  search_timestamp?: string;
  user_id?: string;
  trip_id?: string;
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

// Utility functions for place selection
export const createSelectedPlaceData = (
  googlePlace: any,
  sourceLocation: SelectedPlaceData['source_location'],
  context?: {
    date?: string;
    timeSlot?: string;
    userId?: string;
    tripId?: string;
  }
): SelectedPlaceData => {
  return {
    google_place_id: googlePlace.place_id,
    name: googlePlace.name,
    formatted_address: googlePlace.formatted_address,
    geometry: googlePlace.geometry,
    rating: googlePlace.rating,
    user_ratings_total: googlePlace.user_ratings_total,
    price_level: googlePlace.price_level,
    types: googlePlace.types || [],
    photos: googlePlace.photos,
    opening_hours: googlePlace.opening_hours,
    vicinity: googlePlace.vicinity,
    source_location: sourceLocation,
    selected_date: context?.date,
    selected_time_slot: context?.timeSlot,
    search_timestamp: new Date().toISOString(),
    user_id: context?.userId,
    trip_id: context?.tripId
  };
};

export const validateSelectedPlace = (place: Partial<SelectedPlaceData>): boolean => {
  return !!(
    place.google_place_id &&
    place.name &&
    place.formatted_address &&
    place.geometry?.location?.lat &&
    place.geometry?.location?.lng &&
    place.source_location
  );
};

// Constants for source locations
export const PLACE_SOURCE_LOCATIONS = {
  CREATE_TRIP_DEPARTURE: 'create_trip_departure' as const,
  CREATE_TRIP_DESTINATION: 'create_trip_destination' as const,
  MAP_VIEW: 'map_view' as const,
  LIST_VIEW: 'list_view' as const,
  CALENDAR_VIEW: 'calendar_view' as const,
  MY_PLACES: 'my_places' as const
} as const;

export type PlaceSourceLocation = typeof PLACE_SOURCE_LOCATIONS[keyof typeof PLACE_SOURCE_LOCATIONS]; 