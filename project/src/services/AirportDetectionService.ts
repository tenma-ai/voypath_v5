/**
 * Airport Detection Service
 * Interfaces with the AirportDB Edge Function for flight route optimization
 */

import { supabase } from '../lib/supabase';

export interface AirportDetectionOptions {
  searchRadiusKm?: number;
  flightType?: 'commercial' | 'international' | 'domestic' | 'any';
  airportSize?: 'large' | 'medium' | 'small' | 'any';
}

export interface AirportData {
  iataCode: string;
  icaoCode: string;
  airportName: string;
  cityName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  airportType: string;
  commercialService: boolean;
  internationalService: boolean;
  distanceKm: number;
  capabilityScore: number;
  capabilityBreakdown: {
    commercialScore: number;
    internationalScore: number;
    accessibilityScore: number;
    sizeScore: number;
    overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export interface AirportDetectionResult {
  hasAirport: boolean;
  nearestAirport: AirportData | null;
  airportsInRadius: AirportData[];
  searchRadiusKm: number;
  source: 'cache' | 'airportdb' | 'fallback';
  executionTimeMs: number;
  requestId: string;
}

export interface BatchLocation {
  id: string;
  latitude: number;
  longitude: number;
}

export interface BatchAirportDetectionResult {
  batchId: string;
  results: Array<{
    locationId: string;
    location: { latitude: number; longitude: number };
    detection: AirportDetectionResult;
  }>;
  totalExecutionTimeMs: number;
  summary: {
    totalLocations: number;
    locationsWithAirports: number;
    averageAirportsPerLocation: number;
    cacheHitRate: number;
  };
}

class AirportDetectionService {
  private static instance: AirportDetectionService;
  
  static getInstance(): AirportDetectionService {
    if (!this.instance) {
      this.instance = new AirportDetectionService();
    }
    return this.instance;
  }

  /**
   * Check if a location has nearby airports
   * Primary function for route optimization transport mode decisions
   */
  async hasAirport(
    latitude: number,
    longitude: number,
    options: AirportDetectionOptions = {}
  ): Promise<boolean> {
    try {
      const result = await this.detectAirports(latitude, longitude, options);
      return result.hasAirport;
    } catch (error) {
      // Warning occurred
      return false; // Safe fallback for optimization algorithms
    }
  }

  /**
   * Get detailed airport information for a location
   */
  async detectAirports(
    latitude: number,
    longitude: number,
    options: AirportDetectionOptions = {}
  ): Promise<AirportDetectionResult> {
    const {
      searchRadiusKm = 50,
      flightType = 'any',
      airportSize = 'any'
    } = options;

    try {
      const { data, error } = await supabase.functions.invoke('detect-airports-airportdb', {
        body: {
          location: { latitude, longitude },
          searchRadiusKm,
          flightType,
          airportSize,
          batchMode: false
        }
      });

      if (error) {
        throw new Error(`Airport detection failed: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error('Airport detection returned unsuccessful result');
      }

      return data.result;
    } catch (error) {
      // Error occurred
      
      // Return safe fallback result
      return {
        hasAirport: false,
        nearestAirport: null,
        airportsInRadius: [],
        searchRadiusKm,
        source: 'fallback',
        executionTimeMs: 0,
        requestId: 'fallback-' + Date.now()
      };
    }
  }

  /**
   * Batch airport detection for multiple locations
   * Useful for route optimization with multiple places
   */
  async detectAirportsBatch(
    locations: BatchLocation[],
    options: AirportDetectionOptions = {}
  ): Promise<BatchAirportDetectionResult> {
    const {
      searchRadiusKm = 50,
      flightType = 'any',
      airportSize = 'any'
    } = options;

    try {
      const { data, error } = await supabase.functions.invoke('detect-airports-airportdb', {
        body: {
          locations,
          searchRadiusKm,
          flightType,
          airportSize,
          batchMode: true
        }
      });

      if (error) {
        throw new Error(`Batch airport detection failed: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error('Batch airport detection returned unsuccessful result');
      }

      return data.result;
    } catch (error) {
      // Error occurred
      
      // Return safe fallback result
      return {
        batchId: 'fallback-' + Date.now(),
        results: locations.map(location => ({
          locationId: location.id,
          location: { latitude: location.latitude, longitude: location.longitude },
          detection: {
            hasAirport: false,
            nearestAirport: null,
            airportsInRadius: [],
            searchRadiusKm,
            source: 'fallback',
            executionTimeMs: 0,
            requestId: 'batch-fallback-' + Date.now()
          }
        })),
        totalExecutionTimeMs: 0,
        summary: {
          totalLocations: locations.length,
          locationsWithAirports: 0,
          averageAirportsPerLocation: 0,
          cacheHitRate: 0
        }
      };
    }
  }

  /**
   * Find the nearest airport to a location
   * Returns the best airport based on capability score
   */
  async findNearestAirport(
    latitude: number,
    longitude: number,
    options: AirportDetectionOptions = {}
  ): Promise<AirportData | null> {
    const result = await this.detectAirports(latitude, longitude, options);
    return result.nearestAirport;
  }

  /**
   * Check if two locations can be connected by flight
   * Used by route optimization algorithms
   */
  async canConnectByFlight(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    options: AirportDetectionOptions = {}
  ): Promise<{
    canConnect: boolean;
    fromAirport: AirportData | null;
    toAirport: AirportData | null;
    flightDistance?: number;
  }> {
    try {
      // Check both locations in batch for efficiency
      const batchResult = await this.detectAirportsBatch([
        { id: 'from', latitude: fromLat, longitude: fromLng },
        { id: 'to', latitude: toLat, longitude: toLng }
      ], options);

      const fromResult = batchResult.results.find(r => r.locationId === 'from')?.detection;
      const toResult = batchResult.results.find(r => r.locationId === 'to')?.detection;

      const fromAirport = fromResult?.nearestAirport || null;
      const toAirport = toResult?.nearestAirport || null;

      const canConnect = !!(fromAirport && toAirport);

      // Calculate flight distance if both airports exist
      let flightDistance: number | undefined;
      if (fromAirport && toAirport) {
        flightDistance = this.calculateDistance(
          fromAirport.latitude,
          fromAirport.longitude,
          toAirport.latitude,
          toAirport.longitude
        );
      }

      return {
        canConnect,
        fromAirport,
        toAirport,
        flightDistance
      };
    } catch (error) {
      // Error occurred
      return {
        canConnect: false,
        fromAirport: null,
        toAirport: null
      };
    }
  }

  /**
   * Get airports within a specific radius with filtering
   * Implements geographic radius-based search (TODO 034)
   */
  async getAirportsInRadius(
    latitude: number,
    longitude: number,
    radiusKm: number,
    filters: {
      minCapabilityScore?: number;
      requireCommercial?: boolean;
      requireInternational?: boolean;
      airportTypes?: string[];
    } = {}
  ): Promise<AirportData[]> {
    const result = await this.detectAirports(latitude, longitude, {
      searchRadiusKm: radiusKm,
      flightType: filters.requireInternational ? 'international' : 
                 filters.requireCommercial ? 'commercial' : 'any',
      airportSize: 'any'
    });

    let airports = result.airportsInRadius;

    // Apply additional filters
    if (filters.minCapabilityScore) {
      airports = airports.filter(airport => 
        airport.capabilityScore >= filters.minCapabilityScore!
      );
    }

    if (filters.requireCommercial) {
      airports = airports.filter(airport => airport.commercialService);
    }

    if (filters.requireInternational) {
      airports = airports.filter(airport => airport.internationalService);
    }

    if (filters.airportTypes && filters.airportTypes.length > 0) {
      airports = airports.filter(airport => 
        filters.airportTypes!.includes(airport.airportType)
      );
    }

    return airports;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

// Export singleton instance
export const airportDetectionService = AirportDetectionService.getInstance();

// Export individual functions for convenience
export const hasAirport = (
  latitude: number,
  longitude: number,
  options?: AirportDetectionOptions
) => airportDetectionService.hasAirport(latitude, longitude, options);

export const detectAirports = (
  latitude: number,
  longitude: number,
  options?: AirportDetectionOptions
) => airportDetectionService.detectAirports(latitude, longitude, options);

export const findNearestAirport = (
  latitude: number,
  longitude: number,
  options?: AirportDetectionOptions
) => airportDetectionService.findNearestAirport(latitude, longitude, options);

export const canConnectByFlight = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  options?: AirportDetectionOptions
) => airportDetectionService.canConnectByFlight(fromLat, fromLng, toLat, toLng, options);

export default airportDetectionService;