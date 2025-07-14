/**
 * Get country code from coordinates using reverse geocoding
 */
export class CountryUtils {
  /**
   * Get country code from latitude and longitude
   * Returns a 2-letter country code for use with Navitime
   */
  static async getCountryCodeFromCoordinates(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const addressComponents = data.results[0].address_components;
        
        // Find the country component
        const countryComponent = addressComponents.find((component: any) =>
          component.types.includes('country')
        );
        
        if (countryComponent && countryComponent.short_name) {
          return countryComponent.short_name.toLowerCase();
        }
      }
      
      // Default fallback to Japan
      return 'jp';
    } catch (error) {
      console.error('Failed to get country code from coordinates:', error);
      // Default fallback to Japan
      return 'jp';
    }
  }

  /**
   * Get country code from coordinates with caching and fallback logic
   */
  static async getCountryCodeWithFallback(lat?: number, lng?: number): Promise<string> {
    // If no coordinates provided, default to Japan
    if (!lat || !lng) {
      return 'jp';
    }

    // Check if coordinates are likely in common countries for quick lookup
    const quickCountryCode = this.getQuickCountryCode(lat, lng);
    if (quickCountryCode) {
      return quickCountryCode;
    }

    // Fall back to API call
    return await this.getCountryCodeFromCoordinates(lat, lng);
  }

  /**
   * Quick country detection based on coordinate ranges
   * This avoids API calls for common countries
   */
  private static getQuickCountryCode(lat: number, lng: number): string | null {
    // Japan
    if (lat >= 24 && lat <= 46 && lng >= 123 && lng <= 146) {
      return 'jp';
    }
    
    // South Korea
    if (lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132) {
      return 'kr';
    }
    
    // United States (continental)
    if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) {
      return 'us';
    }
    
    // United Kingdom
    if (lat >= 49.5 && lat <= 61 && lng >= -8 && lng <= 2) {
      return 'gb';
    }
    
    // Germany
    if (lat >= 47 && lat <= 55 && lng >= 5.5 && lng <= 15.5) {
      return 'de';
    }
    
    // France
    if (lat >= 41 && lat <= 51.5 && lng >= -5.5 && lng <= 10) {
      return 'fr';
    }
    
    // Italy
    if (lat >= 35.5 && lat <= 47.5 && lng >= 6 && lng <= 19) {
      return 'it';
    }
    
    // Spain
    if (lat >= 35.5 && lat <= 44 && lng >= -10 && lng <= 5) {
      return 'es';
    }
    
    // Australia
    if (lat >= -44 && lat <= -10 && lng >= 112 && lng <= 154) {
      return 'au';
    }
    
    // China
    if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) {
      return 'cn';
    }
    
    // India
    if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 97) {
      return 'in';
    }
    
    // Thailand
    if (lat >= 5.5 && lat <= 20.5 && lng >= 97 && lng <= 106) {
      return 'th';
    }
    
    // Singapore
    if (lat >= 1.1 && lat <= 1.5 && lng >= 103.6 && lng <= 104.1) {
      return 'sg';
    }
    
    // Hong Kong
    if (lat >= 22.1 && lat <= 22.6 && lng >= 113.8 && lng <= 114.5) {
      return 'hk';
    }
    
    // Taiwan
    if (lat >= 21.5 && lat <= 25.5 && lng >= 119.5 && lng <= 122.5) {
      return 'tw';
    }
    
    return null;
  }

  /**
   * Get Navitime URL with dynamic country code
   */
  static async generateNavitimeUrl(fromLat?: number, fromLng?: number): Promise<string> {
    const countryCode = await this.getCountryCodeWithFallback(fromLat, fromLng);
    return `https://transit.navitime.com/en/${countryCode}/`;
  }
}