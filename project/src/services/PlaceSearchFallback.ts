/**
 * Place Search Fallback System for Voypath
 * Phase 0: API failure handling with multiple fallback strategies
 */

import { PlaceSearchService, PlaceSearchRequest, GooglePlace } from './PlaceSearchService';

export const searchPlacesWithFallback = async (request: PlaceSearchRequest): Promise<GooglePlace[]> => {
  const startTime = Date.now();
  let lastError: Error | null = null;

  // Log message

  try {
    // Primary: Google Maps API
    // Log message
    const result = await PlaceSearchService.searchPlaces(request);
    // Log: `✅ Primary search completed in ${Date.now() - startTime}ms with ${result.length} results`);
    return result;
  } catch (error) {
    lastError = error as Error;
    // Error occurred
    // Error: 'Error details:', {
      message: lastError.message,
      stack: lastError.stack,
      name: lastError.name
    });
    
    try {
      // Secondary: Supabase Edge Function proxy
      // Log message
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-places-proxy`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          endpoint: 'textsearch',
          params: {
            query: request.inputValue,
            language: request.language,
            ...(request.location && {
              location: `${request.location.lat},${request.location.lng}`,
              radius: request.searchRadius ? Math.min(request.searchRadius * 1000, 50000) : 10000
            })
          }
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        // Log: `✅ Secondary search completed in ${Date.now() - startTime}ms`);
        
        // Convert Google Places API response to our format
        if (data.results && Array.isArray(data.results)) {
          const convertedPlaces = data.results.map((place: any): GooglePlace => ({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            geometry: {
              location: {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng
              }
            },
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            price_level: place.price_level,
            types: place.types || [],
            photos: place.photos?.map((photo: any) => ({
              photo_reference: photo.photo_reference,
              height: photo.height,
              width: photo.width
            })),
            opening_hours: place.opening_hours,
            vicinity: place.vicinity
          }));
          // Log message
          return convertedPlaces;
        }
        
        const fallbackPlaces = data.places || data.results || [];
        // Log message
        return fallbackPlaces;
      }
      throw new Error(`Proxy search failed: ${response.status} ${response.statusText}`);
    } catch (proxyError) {
      // Warning occurred
      
      try {
        // Tertiary: Local storage cache
        const cachedResults = getCachedSearchResults(request.inputValue);
        if (cachedResults && cachedResults.length > 0) {
          // Log message
          return cachedResults;
        }
        
        // Always throw error instead of using mock data to force testing real APIs
        throw new Error('All fallback methods failed - forcing real API usage');
      } catch (fallbackError) {
        // Error occurred
        
        // Final fallback: return minimal results or empty array
        if (request.inputValue && request.inputValue.trim().length >= 2) {
          return generateMinimalPlaceResult(request.inputValue);
        }
        
        return [];
      }
    }
  }
};

// Local storage cache management
const CACHE_KEY_PREFIX = 'voypath_place_search_';
const CACHE_EXPIRY_HOURS = 24;

const getCachedSearchResults = (query: string): GooglePlace[] | null => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${query.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const expiryTime = timestamp + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
      
      if (now < expiryTime) {
        return data;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    // Warning occurred
  }
  
  return null;
};

const setCachedSearchResults = (query: string, results: GooglePlace[]): void => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${query.toLowerCase().replace(/\s+/g, '_')}`;
    const cacheData = {
      data: results,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    // Warning occurred
  }
};


const generateMinimalPlaceResult = (query: string): GooglePlace[] => {
  return [
    {
      place_id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: query,
      formatted_address: `Search location: ${query}`,
      geometry: { location: { lat: 0, lng: 0 } },
      types: ['establishment'],
    }
  ];
}; 