/**
 * Google Places Service - フロントエンド統合
 * Google Places API との統合を管理
 */

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
  }[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  vicinity?: string;
  website?: string;
  formatted_phone_number?: string;
}

interface PlaceDetails extends GooglePlace {
  reviews?: {
    rating: number;
    text: string;
    author_name: string;
    time: number;
  }[];
  url?: string;
  utc_offset?: number;
}

interface SearchRequest {
  query: string;
  location?: {
    lat: number;
    lng: number;
  };
  radius?: number;
  type?: string;
}

export class GooglePlacesService {
  private static readonly SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  private static readonly SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  private static readonly PROXY_URL = `${GooglePlacesService.SUPABASE_URL}/functions/v1/google-places-proxy`;

  /**
   * テキスト検索による場所検索
   */
  static async searchPlaces(request: SearchRequest): Promise<GooglePlace[]> {
    try {
      // First try: Use Supabase Edge Function
      try {
        const params = new URLSearchParams({
          endpoint: 'textsearch',
          query: request.query,
        });

        if (request.location) {
          params.append('location', `${request.location.lat},${request.location.lng}`);
        }

        if (request.radius) {
          params.append('radius', request.radius.toString());
        }

        if (request.type) {
          params.append('type', request.type);
        }

        const response = await fetch(`${this.PROXY_URL}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'X-Cache-Strategy': 'intelligent',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
            return data.results || [];
          }
        }
      } catch (proxyError) {
        // Warning occurred
      }

      // Fallback: Use direct Google Maps API with JavaScript
      const google = await this.loadGoogleMapsAPI();
      if (google && google.maps && google.maps.places) {
        return this.searchWithGoogleMapsJS(request, google);
      }

      // Final fallback: Return empty array
      return [];
    } catch (error) {
      // Error occurred
      return [];
    }
  }

  /**
   * Load Google Maps JavaScript API
   */
  private static async loadGoogleMapsAPI(): Promise<typeof google | null> {
    try {
      const { loadGoogleMapsAPI } = await import('../lib/googleMaps');
      return await loadGoogleMapsAPI();
    } catch (error) {
      // Warning occurred
      return null;
    }
  }

  /**
   * Search using Google Maps JavaScript API
   */
  private static searchWithGoogleMapsJS(request: SearchRequest, google: typeof window.google): Promise<GooglePlace[]> {
    return new Promise((resolve) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const searchRequest: google.maps.places.TextSearchRequest = {
        query: request.query,
        location: request.location ? new google.maps.LatLng(request.location.lat, request.location.lng) : undefined,
        radius: request.radius,
        type: request.type as any,
      };

      service.textSearch(searchRequest, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places: GooglePlace[] = results.map(place => ({
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
            photos: place.photos?.map(photo => ({
              photo_reference: photo.photo_reference,
              height: photo.height,
              width: photo.width,
            })),
            opening_hours: place.opening_hours ? {
              open_now: place.opening_hours.open_now,
              weekday_text: place.opening_hours.weekday_text,
            } : undefined,
            vicinity: place.vicinity,
          }));
          resolve(places);
        } else {
          resolve([]);
        }
      });
    });
  }


  /**
   * 近場検索（位置情報ベース）
   */
  static async searchNearby(
    location: { lat: number; lng: number },
    radius: number = 1000,
    type?: string
  ): Promise<GooglePlace[]> {
    try {
      const params = new URLSearchParams({
        endpoint: 'nearbysearch',
        location: `${location.lat},${location.lng}`,
        radius: radius.toString(),
      });

      if (type) {
        params.append('type', type);
      }

      // Use integrated Supabase Edge Function
      const response = await fetch(`${this.PROXY_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'X-Cache-Strategy': 'intelligent', // Enable intelligent caching
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Proxy error: ${data.error}`);
      }
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      return data.results || [];
    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  /**
   * 場所の詳細情報取得
   */
  static async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const params = new URLSearchParams({
        endpoint: 'details',
        place_id: placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'geometry',
          'rating',
          'user_ratings_total',
          'price_level',
          'types',
          'photos',
          'opening_hours',
          'vicinity',
          'website',
          'formatted_phone_number',
          'reviews',
          'url',
          'utc_offset'
        ].join(','),
      });

      // Use integrated Supabase Edge Function
      const response = await fetch(`${this.PROXY_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'X-Cache-Strategy': 'intelligent', // Enable intelligent caching
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Proxy error: ${data.error}`);
      }
      
      if (data.status !== 'OK') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      return data.result || null;
    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  /**
   * 写真URL取得
   */
  static getPlacePhotoUrl(
    photoReference: string,
    maxWidth: number = 400,
    maxHeight?: number
  ): string {
    const params = new URLSearchParams({
      endpoint: 'photo',
      photoreference: photoReference,
      maxwidth: maxWidth.toString(),
    });

    if (maxHeight) {
      params.append('maxheight', maxHeight.toString());
    }

    return `${this.PROXY_URL}?${params}`;
  }

  /**
   * 住所→座標変換（Geocoding）
   */
  static async geocodeAddress(address: string): Promise<{
    lat: number;
    lng: number;
    formatted_address: string;
    place_id?: string;
  } | null> {
    try {
      const params = new URLSearchParams({
        endpoint: 'geocode',
        address: address,
      });

      // Use integrated Supabase Edge Function
      const response = await fetch(`${this.PROXY_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'X-Cache-Strategy': 'intelligent', // Enable intelligent caching
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Proxy error: ${data.error}`);
      }
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Geocoding API error: ${data.status}`);
      }

      if (!data.results || data.results.length === 0) {
        return null;
      }

      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id,
      };
    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  /**
   * 座標→住所変換（逆Geocoding）
   */
  static async reverseGeocode(lat: number, lng: number): Promise<{
    formatted_address: string;
    place_id?: string;
    address_components: any[];
  } | null> {
    try {
      const params = new URLSearchParams({
        endpoint: 'geocode',
        latlng: `${lat},${lng}`,
      });

      // Use integrated Supabase Edge Function
      const response = await fetch(`${this.PROXY_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'X-Cache-Strategy': 'intelligent', // Enable intelligent caching
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Proxy error: ${data.error}`);
      }
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Reverse geocoding API error: ${data.status}`);
      }

      if (!data.results || data.results.length === 0) {
        return null;
      }

      const result = data.results[0];
      return {
        formatted_address: result.formatted_address,
        place_id: result.place_id,
        address_components: result.address_components,
      };
    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  /**
   * Google Placeデータを内部Place形式に変換
   */
  static convertToInternalPlace(googlePlace: GooglePlace, tripId: string, userId: string): any {
    return {
      name: googlePlace.name,
      category: this.inferCategoryFromTypes(googlePlace.types),
      address: googlePlace.formatted_address,
      latitude: googlePlace.geometry.location.lat,
      longitude: googlePlace.geometry.location.lng,
      
      // Google Places API fields
      google_place_id: googlePlace.place_id,
      google_rating: googlePlace.rating || null,
      google_review_count: googlePlace.user_ratings_total || null,
      google_photo_references: googlePlace.photos?.map(p => p.photo_reference) || [],
      google_opening_hours: googlePlace.opening_hours || null,
      google_price_level: googlePlace.price_level || null,
      google_place_types: googlePlace.types,
      google_vicinity: googlePlace.vicinity || null,
      google_formatted_address: googlePlace.formatted_address,
      
      // Default values
      wish_level: 3,
      stay_duration_minutes: 60,
      price_level: googlePlace.price_level || null,
      source: 'google_places',
      
      // Relations
      trip_id: tripId,
      user_id: userId,
    };
  }

  /**
   * Google Places typesからカテゴリを推定
   */
  static inferCategoryFromTypes(types: string[]): string {
    const typeMapping: { [key: string]: string } = {
      restaurant: 'restaurant',
      food: 'restaurant',
      meal_takeaway: 'restaurant',
      meal_delivery: 'restaurant',
      tourist_attraction: 'tourist_attraction',
      amusement_park: 'amusement_park',
      museum: 'museum',
      art_gallery: 'museum',
      park: 'park',
      shopping_mall: 'shopping',
      store: 'shopping',
      lodging: 'accommodation',
      hospital: 'hospital',
      pharmacy: 'hospital',
      gas_station: 'gas_station',
      transit_station: 'transportation',
      subway_station: 'transportation',
      bus_station: 'transportation',
      airport: 'transportation',
    };

    for (const type of types) {
      if (typeMapping[type]) {
        return typeMapping[type];
      }
    }

    return 'other';
  }

  /**
   * API使用量チェック（オプション）
   */
  static async checkApiQuota(): Promise<{
    remaining: number;
    resetTime: Date;
  }> {
    // 実装はサーバーサイドで行う
    // ここではモック値を返す
    return {
      remaining: 1000,
      resetTime: new Date(),
    };
  }
}

export type { GooglePlace, PlaceDetails, SearchRequest };