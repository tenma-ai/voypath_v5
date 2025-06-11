/**
 * Place Search Service Tests
 * Phase 0: Google Maps API integration verification
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import { PlaceSearchService, PlaceSearchRequest } from '../services/PlaceSearchService';

// Mock Google Maps API for testing
const mockGoogleMaps = {
  maps: {
    places: {
      PlacesService: vi.fn().mockImplementation(() => ({
        textSearch: vi.fn((request: any, callback: any) => {
          // Mock successful response
          const mockResults = [
            {
              place_id: 'test_place_id',
              name: 'Test Location',
              formatted_address: 'Test Address, Test City',
              geometry: {
                location: {
                  lat: () => 35.6762,
                  lng: () => 139.6503
                }
              },
              rating: 4.5,
              user_ratings_total: 100,
              types: ['establishment', 'point_of_interest']
            }
          ];
          
          callback(mockResults, 'OK');
        })
      })),
      PlacesServiceStatus: {
        OK: 'OK',
        ZERO_RESULTS: 'ZERO_RESULTS'
      }
    },
    LatLng: vi.fn().mockImplementation((lat: any, lng: any) => ({ lat, lng }))
  }
};

// Mock environment variables
vi.mock('../lib/googleMapsLoader', () => ({
  googleMapsLoader: {
    loadGoogleMapsAPI: vi.fn().mockResolvedValue(mockGoogleMaps),
    getGoogle: vi.fn().mockReturnValue(mockGoogleMaps),
    trackAPIUsage: vi.fn()
  }
}));

describe('PlaceSearchService', () => {
  beforeAll(async () => {
    // Mock environment variable
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test_api_key');
  });

  test('should initialize successfully', async () => {
    await expect(PlaceSearchService.initialize()).resolves.not.toThrow();
  });

  test('should search places successfully', async () => {
    const searchRequest: PlaceSearchRequest = {
      inputValue: 'Tokyo Station',
      language: 'en',
      maxResults: 5
    };

    const result = await PlaceSearchService.searchPlaces(searchRequest);
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('place_id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('formatted_address');
      expect(result[0]).toHaveProperty('geometry');
    }
  });

  test('should handle empty search query', async () => {
    const searchRequest: PlaceSearchRequest = {
      inputValue: '',
      language: 'en'
    };

    // This should not throw but may return empty results
    await expect(PlaceSearchService.searchPlaces(searchRequest)).resolves.toBeDefined();
  });

  test('should generate photo URL correctly', () => {
    const photoReference = 'test_photo_reference';
    const maxWidth = 400;
    
    const photoUrl = PlaceSearchService.getPhotoUrl(photoReference, maxWidth);
    
    expect(photoUrl).toContain('maps.googleapis.com');
    expect(photoUrl).toContain(photoReference);
    expect(photoUrl).toContain(maxWidth.toString());
  });

  test('should convert place data correctly', () => {
    // This tests the private convertToGooglePlace method indirectly
    const searchRequest: PlaceSearchRequest = {
      inputValue: 'Test Place',
      language: 'en',
      maxResults: 1
    };

    return PlaceSearchService.searchPlaces(searchRequest).then(result => {
      if (result.length > 0) {
        const place = result[0];
        expect(place.place_id).toBe('test_place_id');
        expect(place.name).toBe('Test Location');
        expect(place.formatted_address).toBe('Test Address, Test City');
        expect(place.geometry.location.lat).toBe(35.6762);
        expect(place.geometry.location.lng).toBe(139.6503);
      }
    });
  });

  test('should handle location-based search', async () => {
    const searchRequest: PlaceSearchRequest = {
      inputValue: 'restaurant',
      location: { lat: 35.6762, lng: 139.6503 },
      searchRadius: 5,
      language: 'en',
      maxResults: 3
    };

    const result = await PlaceSearchService.searchPlaces(searchRequest);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should handle place type filtering', async () => {
    const searchRequest: PlaceSearchRequest = {
      inputValue: 'food',
      placeTypes: ['restaurant'],
      language: 'en',
      maxResults: 5
    };

    const result = await PlaceSearchService.searchPlaces(searchRequest);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should return empty array for very short queries', async () => {
    const searchRequest: PlaceSearchRequest = {
      inputValue: 'a',
      language: 'en'
    };

    const result = await PlaceSearchService.searchPlaces(searchRequest);
    expect(result).toEqual([]);
  });
}); 