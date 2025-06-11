/**
 * Place Search Fallback System for Voypath
 * Phase 0: API failure handling with multiple fallback strategies
 */

import { PlaceSearchService, PlaceSearchRequest, GooglePlace } from './PlaceSearchService';

export const searchPlacesWithFallback = async (request: PlaceSearchRequest): Promise<GooglePlace[]> => {
  try {
    // Primary: Google Maps API
    return await PlaceSearchService.searchPlaces(request);
  } catch (error) {
    console.warn('Google Maps API failed, using fallback:', error);
    
    try {
      // Secondary: Edge Function proxy (to be implemented later)
      const response = await fetch('/api/places/search-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Proxy search failed');
    } catch (proxyError) {
      console.warn('Proxy API failed, using mock data:', proxyError);
      
      // Tertiary: Mock data (development only)
      if (import.meta.env.DEV) {
        return generateMockSearchResults(request.inputValue);
      }
      
      throw new Error('All search methods failed');
    }
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