/**
 * Google Maps JavaScript API Loader
 * Handles dynamic loading and initialization of Google Maps API
 */

// Google Maps API types extension
declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

export interface GoogleMapsConfig {
  apiKey: string;
  libraries: string[];
  language?: string;
  region?: string;
}

class GoogleMapsLoader {
  private static instance: GoogleMapsLoader;
  private loadPromise: Promise<typeof google> | null = null;
  private isLoaded = false;

  private constructor() {}

  static getInstance(): GoogleMapsLoader {
    if (!GoogleMapsLoader.instance) {
      GoogleMapsLoader.instance = new GoogleMapsLoader();
    }
    return GoogleMapsLoader.instance;
  }

  /**
   * Load Google Maps JavaScript API
   */
  async loadGoogleMapsAPI(config?: Partial<GoogleMapsConfig>): Promise<typeof google> {
    // Return existing instance if already loaded
    if (this.isLoaded && window.google) {
      return window.google;
    }

    // Return existing promise if loading is in progress
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const apiKey = config?.apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables.');
    }

    const defaultConfig: GoogleMapsConfig = {
      apiKey,
      libraries: ['places', 'geometry', 'drawing'],
      language: 'en',
      region: 'US'
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.loadPromise = new Promise((resolve, reject) => {
      try {
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          if (window.google) {
            this.isLoaded = true;
            resolve(window.google);
            return;
          }
        }

        // Create script element
        const script = document.createElement('script');
        const params = new URLSearchParams({
          key: finalConfig.apiKey,
          libraries: finalConfig.libraries.join(','),
          language: finalConfig.language || 'en',
          region: finalConfig.region || 'US',
          callback: 'initGoogleMaps'
        });

        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.async = true;
        script.defer = true;

        // Global callback function
        window.initGoogleMaps = () => {
          if (window.google) {
            this.isLoaded = true;
            resolve(window.google);
          } else {
            reject(new Error('Google Maps API failed to load'));
          }
        };

        script.onerror = () => {
          reject(new Error('Failed to load Google Maps JavaScript API'));
        };

        // Add script to document
        document.head.appendChild(script);

      } catch (error) {
        reject(error);
      }
    });

    return this.loadPromise;
  }

  /**
   * Check if Google Maps API is loaded
   */
  isGoogleMapsLoaded(): boolean {
    return this.isLoaded && !!window.google;
  }

  /**
   * Get Google Maps API instance
   */
  getGoogleMapsAPI(): typeof google | null {
    return this.isGoogleMapsLoaded() ? window.google : null;
  }
}

// Export singleton instance
const googleMapsLoader = GoogleMapsLoader.getInstance();

// Convenience functions
export const loadGoogleMapsAPI = (config?: Partial<GoogleMapsConfig>) => 
  googleMapsLoader.loadGoogleMapsAPI(config);

export const isGoogleMapsLoaded = () => 
  googleMapsLoader.isGoogleMapsLoaded();

export const getGoogleMapsAPI = () => 
  googleMapsLoader.getGoogleMapsAPI();

export default googleMapsLoader;