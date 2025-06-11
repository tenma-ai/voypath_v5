/**
 * Place Search Fallback System for Voypath
 * Phase 0: API failure handling with multiple fallback strategies
 */

import { PlaceSearchService, PlaceSearchRequest, GooglePlace } from './PlaceSearchService';

export const searchPlacesWithFallback = async (request: PlaceSearchRequest): Promise<GooglePlace[]> => {
  const startTime = Date.now();
  let lastError: Error | null = null;

  try {
    // Primary: Google Maps API
    console.log('Attempting primary search with Google Maps API');
    const result = await PlaceSearchService.searchPlaces(request);
    console.log(`Primary search completed in ${Date.now() - startTime}ms`);
    return result;
  } catch (error) {
    lastError = error as Error;
    console.warn('Google Maps API failed, trying fallback:', error);
    
    try {
      // Secondary: Supabase Edge Function proxy
      console.log('Attempting secondary search via Supabase proxy');
      const response = await fetch('/api/places/search-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Secondary search completed in ${Date.now() - startTime}ms`);
        return data.places || data;
      }
      throw new Error(`Proxy search failed: ${response.status} ${response.statusText}`);
    } catch (proxyError) {
      console.warn('Proxy API failed, trying local fallback:', proxyError);
      
      try {
        // Tertiary: Local storage cache
        const cachedResults = getCachedSearchResults(request.inputValue);
        if (cachedResults && cachedResults.length > 0) {
          console.log('Using cached search results');
          return cachedResults;
        }
        
        // Quaternary: Mock data (development only)
        if (import.meta.env.DEV) {
          console.log('Using mock data for development');
          const mockResults = generateMockSearchResults(request.inputValue);
          setCachedSearchResults(request.inputValue, mockResults);
          return mockResults;
        }
        
        throw new Error('No fallback options available');
      } catch (fallbackError) {
        console.error('All fallback methods failed:', fallbackError);
        
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
    console.warn('Failed to get cached search results:', error);
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
    console.warn('Failed to cache search results:', error);
  }
};

const generateMockSearchResults = (query: string): GooglePlace[] => {
  const mockPlaces = [
    {
      place_id: `mock_${query.toLowerCase().replace(/\s+/g, '_')}_1`,
      name: `${query} Station`,
      formatted_address: `1-1 ${query}, Central District, Tokyo, Japan`,
      geometry: { location: { lat: 35.6762 + (Math.random() - 0.5) * 0.01, lng: 139.6503 + (Math.random() - 0.5) * 0.01 } },
      rating: 4.0 + Math.random(),
      user_ratings_total: Math.floor(Math.random() * 1000) + 100,
      types: ['transit_station', 'establishment', 'point_of_interest'],
    },
    {
      place_id: `mock_${query.toLowerCase().replace(/\s+/g, '_')}_2`,
      name: `${query} Shopping Center`,
      formatted_address: `2-5 ${query}, Shopping District, Tokyo, Japan`,
      geometry: { location: { lat: 35.6762 + (Math.random() - 0.5) * 0.01, lng: 139.6503 + (Math.random() - 0.5) * 0.01 } },
      rating: 4.2 + Math.random() * 0.5,
      user_ratings_total: Math.floor(Math.random() * 800) + 50,
      types: ['shopping_mall', 'establishment', 'point_of_interest'],
    },
    {
      place_id: `mock_${query.toLowerCase().replace(/\s+/g, '_')}_3`,
      name: `${query} Park`,
      formatted_address: `3-10 ${query}, Green District, Tokyo, Japan`,
      geometry: { location: { lat: 35.6762 + (Math.random() - 0.5) * 0.01, lng: 139.6503 + (Math.random() - 0.5) * 0.01 } },
      rating: 4.1 + Math.random() * 0.3,
      user_ratings_total: Math.floor(Math.random() * 500) + 30,
      types: ['park', 'establishment', 'point_of_interest'],
    }
  ];

  return mockPlaces.slice(0, Math.min(3, Math.max(1, Math.floor(Math.random() * 3) + 1)));
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