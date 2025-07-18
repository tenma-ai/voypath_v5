/**
 * Enhanced Google Maps API Loader for Voypath
 * Phase 0: Unified API loading with usage tracking and constraints
 */

// Google Maps API type declarations
declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

interface GoogleMapsLoaderOptions {
  apiKey: string;
  libraries: string[];
  language: string;
  region: string;
}

interface UsageTrackingData {
  apiType: string;
  requestCount: number;
  costEstimate: number;
}

class GoogleMapsAPILoader {
  private static instance: GoogleMapsAPILoader;
  private google: any | null = null;
  private loadPromise: Promise<any> | null = null;
  private usageTracking: Map<string, number> = new Map();

  static getInstance(): GoogleMapsAPILoader {
    if (!GoogleMapsAPILoader.instance) {
      GoogleMapsAPILoader.instance = new GoogleMapsAPILoader();
    }
    return GoogleMapsAPILoader.instance;
  }

  async loadGoogleMapsAPI(options: GoogleMapsLoaderOptions): Promise<any> {
    if (this.google) return this.google;
    
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Google Maps API can only be loaded in browser environment'));
        return;
      }

      // Check if already loaded
      if (window.google && window.google.maps) {
        this.google = window.google;
        resolve(this.google);
        return;
      }

      // Validate API key
      if (!options.apiKey || options.apiKey.trim() === '') {
        reject(new Error('Google Maps API key is required'));
        return;
      }

      // Create unique callback name to avoid conflicts
      const callbackName = `initGoogleMaps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Google Maps API script dynamic loading with async parameter
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${options.apiKey}&libraries=${options.libraries.join(',')}&language=${options.language}&region=${options.region}&loading=async&callback=${callbackName}`;
      script.async = true;
      script.defer = true;

      (window as any)[callbackName] = () => {
        this.google = (window as any).google;
        this.trackAPIUsage('maps_initialization', 1, 0.01);
        
        // Clean up callback
        delete (window as any)[callbackName];
        
        resolve(this.google);
      };

      script.onerror = () => {
        // Clean up callback on error
        delete (window as any)[callbackName];
        reject(new Error('Failed to load Google Maps API'));
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  getGoogle(): any | null {
    return this.google;
  }

  trackAPIUsage(apiType: string, count: number = 1, estimatedCost: number = 0): void {
    const currentCount = this.usageTracking.get(apiType) || 0;
    this.usageTracking.set(apiType, currentCount + count);
    
    // Send usage data to Supabase for tracking
    this.sendUsageTracking({
      apiType,
      requestCount: count,
      costEstimate: estimatedCost
    });
  }

  private async sendUsageTracking(data: UsageTrackingData): Promise<void> {
    try {
      // This will be connected to Supabase later
      // Log message
    } catch (error) {
      // Warning occurred
    }
  }

  getUsageStats(): Map<string, number> {
    return new Map(this.usageTracking);
  }

  resetUsageStats(): void {
    this.usageTracking.clear();
  }
}

export const googleMapsLoader = GoogleMapsAPILoader.getInstance();
export default GoogleMapsAPILoader; 