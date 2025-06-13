/**
 * Unified Place Search Service for Voypath
 * Phase 0: Core service class for Google Maps Places API integration
 */

import { googleMapsLoader } from '../lib/googleMapsLoader';

export interface PlaceSearchRequest {
  inputValue: string;
  location?: { lat: number; lng: number };
  searchRadius?: number; // km
  placeTypes?: string[];
  language: 'en';
  maxResults?: number;
}

export interface GooglePlace {
  place_id: string;
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
}

export interface GooglePlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

export class PlaceSearchService {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (PlaceSearchService.initialized) return;

    try {
      await googleMapsLoader.loadGoogleMapsAPI({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: ['places', 'geometry'],
        language: 'en',
        region: 'US'
      });
      PlaceSearchService.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Maps API:', error);
      throw error;
    }
  }

  static async searchPlaces(request: PlaceSearchRequest): Promise<GooglePlace[]> {
    await PlaceSearchService.initialize();
    
    const google = googleMapsLoader.getGoogle();
    if (!google) {
      throw new Error('Google Maps API not loaded');
    }

    // Validate input
    if (!request.inputValue || request.inputValue.trim().length < 2) {
      return [];
    }

    // Track API usage
    googleMapsLoader.trackAPIUsage('places_text_search', 1, 0.032);

    return new Promise((resolve, reject) => {
      try {
        const service = new google.maps.places.PlacesService(
          document.createElement('div')
        );

        // Prepare search request with proper location handling
        const searchRequest: any = {
          query: request.inputValue.trim(),
          language: request.language
        };

        // Add location and radius if provided
        if (request.location) {
          searchRequest.location = new google.maps.LatLng(request.location.lat, request.location.lng);
          searchRequest.radius = request.searchRadius ? Math.min(request.searchRadius * 1000, 50000) : 10000;
        }

        // Add place type filtering if provided
        if (request.placeTypes && request.placeTypes.length > 0) {
          searchRequest.type = request.placeTypes[0];
        }

        const timeout = setTimeout(() => {
          console.warn('Places search timeout');
          resolve([]);
        }, 10000); // 10 second timeout

        service.textSearch(searchRequest, (results: any[], status: any) => {
          clearTimeout(timeout);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            const places = results
              .slice(0, request.maxResults || 10)
              .map(PlaceSearchService.convertToGooglePlace)
              .filter(place => place.place_id && place.name); // Filter out invalid results
            resolve(places);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            console.warn(`Places search failed with status: ${status}`);
            // Try to provide fallback or reject depending on the error
            if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
              reject(new Error('API quota exceeded'));
            } else if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              reject(new Error('API request denied'));
            } else {
              resolve([]); // For other errors, return empty array to allow fallback
            }
          }
        });
      } catch (error) {
        console.error('Error in searchPlaces:', error);
        reject(error);
      }
    });
  }

  private static convertToGooglePlace(place: any): GooglePlace {
    return {
      place_id: place.place_id || '',
      name: place.name || '',
      formatted_address: place.formatted_address || '',
      geometry: {
        location: {
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        },
      },
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      types: place.types || [],
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
      })),
      opening_hours: place.opening_hours ? {
        // Note: open_now is deprecated, but keeping for backward compatibility until migration to new Places API
        open_now: undefined, // Removed deprecated field
        weekday_text: place.opening_hours.weekday_text,
      } : undefined,
      vicinity: place.vicinity,
    };
  }

  static getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.warn('Google Maps API key not found for photo URL generation');
      return '';
    }
    
    if (!photoReference) {
      console.warn('Photo reference is required for photo URL generation');
      return '';
    }
    
    // Track photo API usage
    googleMapsLoader.trackAPIUsage('places_photo', 1, 0.007);
    
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
  }

  static async getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
    await PlaceSearchService.initialize();
    
    const google = googleMapsLoader.getGoogle();
    if (!google) {
      throw new Error('Google Maps API not loaded');
    }

    if (!placeId) {
      return null;
    }

    // Track API usage
    googleMapsLoader.trackAPIUsage('place_details', 1, 0.017);

    return new Promise((resolve, reject) => {
      try {
        const service = new google.maps.places.PlacesService(
          document.createElement('div')
        );

        const request = {
          placeId: placeId,
          fields: [
            'place_id', 'name', 'formatted_address', 'geometry',
            'rating', 'user_ratings_total', 'price_level', 'types',
            'photos', 'opening_hours', 'vicinity'
          ]
        };

        const timeout = setTimeout(() => {
          console.warn('Place details timeout');
          resolve(null);
        }, 10000);

        service.getDetails(request, (place: any, status: any) => {
          clearTimeout(timeout);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const googlePlace = PlaceSearchService.convertToGooglePlace(place);
            resolve(googlePlace);
          } else {
            console.warn(`Place details failed with status: ${status}`);
            resolve(null);
          }
        });
      } catch (error) {
        console.error('Error in getPlaceDetails:', error);
        reject(error);
      }
    });
  }
} 