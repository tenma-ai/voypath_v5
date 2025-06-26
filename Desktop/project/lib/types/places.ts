// Data types for Google Places API
export interface GooglePlaceData {
  place_id: string           // Always use place_id for consistency
  name: string
  formatted_address: string  // Google Places API standard
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  photos?: {
    getUrl: (options: { maxWidth: number, maxHeight: number }) => string
  }[]
  types?: string[]
  rating?: number
  price_level?: number
}

// Simplified search result structure
export interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photos?: string[];
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
}

// My Places personal wishlist data structure
export interface MyPlaceData {
  id?: string               // Database ID (auto-generated)
  group_id: string
  user_id?: string | null
  session_id?: string | null
  place_id: string          // Google Places ID
  name: string
  address: string
  latitude: number
  longitude: number
  preference_score: number
  preferred_duration: number
  preferred_date?: string | null
  notes?: string | null
  is_personal_favorite?: boolean
  created_at?: string
  updated_at?: string
}

// Group itinerary places (algorithm output)
export interface PlaceData {
  id?: string
  group_id: string
  name: string
  address: string
  latitude: number
  longitude: number
  visit_order?: number
  scheduled_date?: string
  duration?: number
  source_places?: string[] // IDs from my_places that contributed
  fairness_score?: number
  created_at?: string
}

// Helper function to convert Google Place to SearchResult
export function convertGooglePlaceToSearchResult(place: GooglePlaceData): SearchResult {
  // Extract photo URLs if available
  const photoUrls: string[] = [];
  if (place.photos && place.photos.length > 0) {
    place.photos.slice(0, 3).forEach(photo => {
      photoUrls.push(photo.getUrl({ maxWidth: 400, maxHeight: 300 }));
    });
  }

  return {
    place_id: place.place_id,
    name: place.name,
    address: place.formatted_address,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    photos: photoUrls,
    types: place.types
  };
}

// Helper function to convert SearchResult to MyPlaceData
export function prepareMyPlaceData(
  searchResult: SearchResult, 
  groupId: string,
  userId: string | null,
  sessionId: string | null,
  preferences: {
    preferenceScore: number,
    preferredDuration: number,
    preferredDate?: string | null,
    notes?: string | null,
    isPersonalFavorite?: boolean
  }
): MyPlaceData {
  return {
    group_id: groupId,
    user_id: userId,
    session_id: sessionId,
    place_id: searchResult.place_id,
    name: searchResult.name,
    address: searchResult.address,
    latitude: searchResult.latitude,
    longitude: searchResult.longitude,
    preference_score: preferences.preferenceScore,
    preferred_duration: preferences.preferredDuration,
    preferred_date: preferences.preferredDate || null,
    notes: preferences.notes || null,
    is_personal_favorite: preferences.isPersonalFavorite || false
  };
} 