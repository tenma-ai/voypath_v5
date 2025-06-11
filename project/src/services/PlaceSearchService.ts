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

    // Track API usage
    googleMapsLoader.trackAPIUsage('places_text_search', 1, 0.032);

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(
        document.createElement('div')
      );

      // Prepare search request with proper location handling
      const searchRequest: any = {
        query: request.inputValue,
        language: request.language
      };

      // Add location and radius if provided
      if (request.location) {
        searchRequest.location = new google.maps.LatLng(request.location.lat, request.location.lng);
        searchRequest.radius = request.searchRadius ? request.searchRadius * 1000 : 50000;
      } else {
        // If no location provided, use a default location (Tokyo) for better results
        searchRequest.location = new google.maps.LatLng(35.6762, 139.6503);
        searchRequest.radius = 50000;
      }

      // Note: type filtering can be very restrictive, so we'll skip it for broader results
      // The type filtering will be done post-processing if needed
      // if (request.placeTypes && request.placeTypes.length > 0) {
      //   searchRequest.type = request.placeTypes[0];
      // }

      service.textSearch(searchRequest, (results: any[], status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places = results
            .slice(0, request.maxResults || 10)
            .map(PlaceSearchService.convertToGooglePlace);
          resolve(places);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          console.warn(`Places search failed with status: ${status}`);
          // Instead of rejecting, resolve with empty array to allow fallback
          resolve([]);
        }
      });
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
        open_now: place.opening_hours.open_now,
        weekday_text: place.opening_hours.weekday_text,
      } : undefined,
      vicinity: place.vicinity,
    };
  }

  static getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
  }
} 