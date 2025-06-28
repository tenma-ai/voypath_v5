/**
 * Realistic Route Calculator Service
 * Implements geographic constraint-aware route generation
 * Completely excludes sea routes and ensures realistic transportation
 */

import { supabase, callSupabaseFunction } from '../lib/supabase';

// Types
export interface GeographicRegion {
  id: string;
  name: string;
  country: string;
  centerLat: number;
  centerLng: number;
  hasAirport: boolean;
  hasRailway: boolean;
  hasHighway: boolean;
  islandStatus: 'mainland' | 'major_island' | 'remote_island';
  accessibleRegions: string[]; // Regions accessible by land transport
}

export interface TransportConstraint {
  fromRegionId: string;
  toRegionId: string;
  availableModes: TransportMode[];
  minTravelTime: number; // minutes
  maxTravelTime: number; // minutes
  requiresTransfer: boolean;
  isRealistic: boolean;
}

export interface RouteSegment {
  fromPlaceId: string;
  toPlaceId: string;
  transportMode: TransportMode;
  travelTime: number; // minutes
  distance: number; // km
  routePoints: [number, number][]; // [lat, lng] coordinates
  isRealistic: boolean;
  constraints: string[];
}

export interface OptimizedRoute {
  segments: RouteSegment[];
  totalTravelTime: number;
  totalDistance: number;
  isCompletelyRealistic: boolean;
  unrealisticSegments: string[];
  suggestions: string[];
}

export type TransportMode = 'walking' | 'public_transport' | 'car' | 'bicycle' | 'taxi' | 'flight';

// Japanese regional data with realistic constraints
const JAPANESE_REGIONS: GeographicRegion[] = [
  {
    id: 'hokkaido',
    name: '北海道',
    country: 'Japan',
    centerLat: 43.0642,
    centerLng: 141.3469,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'major_island',
    accessibleRegions: [] // Connected via ferry/flight only
  },
  {
    id: 'tohoku',
    name: '東北地方',
    country: 'Japan',
    centerLat: 38.7183,
    centerLng: 140.1023,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'mainland',
    accessibleRegions: ['kanto', 'chubu']
  },
  {
    id: 'kanto',
    name: '関東地方',
    country: 'Japan',
    centerLat: 35.6762,
    centerLng: 139.6503,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'mainland',
    accessibleRegions: ['tohoku', 'chubu']
  },
  {
    id: 'chubu',
    name: '中部地方',
    country: 'Japan',
    centerLat: 36.2048,
    centerLng: 138.2529,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'mainland',
    accessibleRegions: ['kanto', 'tohoku', 'kansai']
  },
  {
    id: 'kansai',
    name: '関西地方',
    country: 'Japan',
    centerLat: 34.6937,
    centerLng: 135.5023,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'mainland',
    accessibleRegions: ['chubu', 'chugoku']
  },
  {
    id: 'chugoku',
    name: '中国地方',
    country: 'Japan',
    centerLat: 34.3853,
    centerLng: 132.4553,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'mainland',
    accessibleRegions: ['kansai', 'kyushu']
  },
  {
    id: 'kyushu',
    name: '九州地方',
    country: 'Japan',
    centerLat: 31.7717,
    centerLng: 130.6594,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'major_island',
    accessibleRegions: ['chugoku'] // Connected via bridge/tunnel
  },
  {
    id: 'shikoku',
    name: '四国地方',
    country: 'Japan',
    centerLat: 33.7617,
    centerLng: 133.2917,
    hasAirport: true,
    hasRailway: true,
    hasHighway: true,
    islandStatus: 'major_island',
    accessibleRegions: ['kansai', 'chugoku'] // Connected via bridges
  },
  {
    id: 'okinawa',
    name: '沖縄県',
    country: 'Japan',
    centerLat: 26.2123,
    centerLng: 127.6792,
    hasAirport: true,
    hasRailway: false,
    hasHighway: true,
    islandStatus: 'remote_island',
    accessibleRegions: [] // Flight only
  }
];

export class RealisticRouteCalculator {
  private static readonly MAX_WALKING_DISTANCE = 10; // km
  private static readonly MAX_BICYCLE_DISTANCE = 50; // km
  private static readonly MIN_FLIGHT_DISTANCE = 100; // km
  private static readonly UNREALISTIC_COMBINATIONS = [
    'walking_over_water',
    'bicycle_over_water', 
    'car_over_water',
    'public_transport_over_water'
  ];


  /**
   * Calculate distance between two points using Haversine formula
   */
  private static calculateDistance(
    lat1: number, 
    lng1: number, 
    lat2: number, 
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Determine which region a coordinate belongs to
   */
  static async getRegionForCoordinate(lat: number, lng: number): Promise<GeographicRegion | null> {
    try {
      // Try using the integrated geographic lookup service
      const response = await callSupabaseFunction('geographic-lookup', {
        latitude: lat,
        longitude: lng
      }, 'POST');
      
      return response.region || null;
    } catch (error) {
      // Warning occurred
      
      // Fallback to database query
      const { data: regions, error: dbError } = await supabase
        .from('geographic_regions')
        .select('*');

      if (dbError || !regions) {
        // Error occurred
        // Final fallback to hardcoded regions
        let closestRegion: GeographicRegion | null = null;
        let minDistance = Infinity;

        for (const region of JAPANESE_REGIONS) {
          const distance = this.calculateDistance(lat, lng, region.centerLat, region.centerLng);
          if (distance < minDistance) {
            minDistance = distance;
            closestRegion = region;
          }
        }
        return closestRegion;
      }

      let closestRegion: GeographicRegion | null = null;
      let minDistance = Infinity;

      for (const region of regions) {
        const distance = this.calculateDistance(lat, lng, region.center_lat, region.center_lng);
        if (distance < minDistance) {
          minDistance = distance;
          closestRegion = {
            id: region.id,
            name: region.name,
            country: region.country,
            centerLat: region.center_lat,
            centerLng: region.center_lng,
            hasAirport: region.has_airport,
            hasRailway: region.has_railway,
            hasHighway: region.has_highway,
            islandStatus: region.island_status,
            accessibleRegions: region.accessible_regions || []
          };
        }
      }

      return closestRegion;
    }
  }

  /**
   * Check if two regions are connected by land transport
   */
  private static areRegionsConnectedByLand(region1: GeographicRegion, region2: GeographicRegion): boolean {
    // Same region is always connected
    if (region1.id === region2.id) return true;

    // Check if region1 can access region2 directly
    if (region1.accessibleRegions.includes(region2.id)) return true;
    if (region2.accessibleRegions.includes(region1.id)) return true;

    return false;
  }

  /**
   * Determine realistic transport modes between two locations
   */
  static async analyzeTransportOptions(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<{
    availableModes: TransportMode[];
    isRealistic: boolean;
    constraints: string[];
    recommendations: string[];
  }> {
    const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng);
    const fromRegion = await this.getRegionForCoordinate(fromLat, fromLng);
    const toRegion = await this.getRegionForCoordinate(toLat, toLng);

    const availableModes: TransportMode[] = [];
    const constraints: string[] = [];
    const recommendations: string[] = [];

    if (!fromRegion || !toRegion) {
      return {
        availableModes: [],
        isRealistic: false,
        constraints: ['Coordinates outside supported regions'],
        recommendations: ['Please select locations within Japan']
      };
    }

    const sameRegion = fromRegion.id === toRegion.id;
    const landConnected = this.areRegionsConnectedByLand(fromRegion, toRegion);

    // Walking analysis
    if (distance <= this.MAX_WALKING_DISTANCE) {
      if (sameRegion || landConnected) {
        availableModes.push('walking');
      } else {
        constraints.push('Walking over water is not possible');
        recommendations.push('Consider public transport or flight for inter-region travel');
      }
    }

    // Bicycle analysis
    if (distance <= this.MAX_BICYCLE_DISTANCE) {
      if (sameRegion || landConnected) {
        availableModes.push('bicycle');
      } else {
        constraints.push('Cycling over water is not possible');
      }
    }

    // Car analysis
    if (sameRegion || landConnected) {
      if (fromRegion.hasHighway && toRegion.hasHighway) {
        availableModes.push('car');
        availableModes.push('taxi');
      }
    } else {
      constraints.push('Car travel over water is not possible');
      recommendations.push('Use flight for island-to-island travel');
    }

    // Public transport analysis
    if (sameRegion || landConnected) {
      if (fromRegion.hasRailway && toRegion.hasRailway) {
        availableModes.push('public_transport');
      }
    } else {
      constraints.push('Ground transportation over water is not possible');
    }

    // Flight analysis
    if (distance >= this.MIN_FLIGHT_DISTANCE) {
      if (fromRegion.hasAirport && toRegion.hasAirport) {
        availableModes.push('flight');
        if (!landConnected) {
          recommendations.push('Flight is the only realistic option for this route');
        }
      } else {
        constraints.push('No airports available for flight option');
        recommendations.push('Consider traveling to nearest airport first');
      }
    }

    const isRealistic = availableModes.length > 0;

    return {
      availableModes,
      isRealistic,
      constraints,
      recommendations
    };
  }

  /**
   * Calculate realistic travel time for given transport mode and distance
   */
  static calculateRealisticTravelTime(
    mode: TransportMode,
    distance: number,
    fromRegion: GeographicRegion,
    toRegion: GeographicRegion
  ): number {
    const sameRegion = fromRegion.id === toRegion.id;
    const transferPenalty = sameRegion ? 0 : 60; // 1 hour for transfers

    switch (mode) {
      case 'walking':
        return distance * 12 + transferPenalty; // 5 km/h average speed

      case 'bicycle':
        return distance * 4 + transferPenalty; // 15 km/h average speed

      case 'car':
        if (sameRegion) {
          return distance * 1.5 + transferPenalty; // 40 km/h urban average
        } else {
          return distance * 1.2 + transferPenalty; // 50 km/h highway average
        }

      case 'taxi':
        return distance * 1.8 + transferPenalty; // Slower than car due to traffic

      case 'public_transport':
        if (sameRegion) {
          return distance * 2.5 + transferPenalty; // Local transport
        } else {
          return distance * 1.5 + transferPenalty + 30; // Express + waiting time
        }

      case 'flight':
        const flightTime = Math.max(60, distance * 0.15); // Min 1 hour, 400+ km/h
        const airportTime = 120; // 2 hours for check-in, security, boarding
        return flightTime + airportTime + transferPenalty;

      default:
        return distance * 2; // Fallback
    }
  }

  /**
   * Generate realistic route segment between two places
   */
  static async generateRouteSegment(
    fromPlace: { id: string; latitude: number; longitude: number },
    toPlace: { id: string; latitude: number; longitude: number },
    preferredMode?: TransportMode
  ): Promise<RouteSegment> {
    const analysis = await this.analyzeTransportOptions(
      fromPlace.latitude,
      fromPlace.longitude,
      toPlace.latitude,
      toPlace.longitude
    );

    const distance = this.calculateDistance(
      fromPlace.latitude,
      fromPlace.longitude,
      toPlace.latitude,
      toPlace.longitude
    );

    const fromRegion = await this.getRegionForCoordinate(fromPlace.latitude, fromPlace.longitude);
    const toRegion = await this.getRegionForCoordinate(toPlace.latitude, toPlace.longitude);

    // Select best transport mode
    let selectedMode: TransportMode;
    if (preferredMode && analysis.availableModes.includes(preferredMode)) {
      selectedMode = preferredMode;
    } else if (analysis.availableModes.length > 0) {
      // Priority: public_transport -> car -> flight -> walking -> bicycle -> taxi
      const modePriority: TransportMode[] = ['public_transport', 'car', 'flight', 'walking', 'bicycle', 'taxi'];
      selectedMode = modePriority.find(mode => analysis.availableModes.includes(mode)) || analysis.availableModes[0];
    } else {
      selectedMode = 'walking'; // Fallback (will be marked as unrealistic)
    }

    const travelTime = this.calculateRealisticTravelTime(selectedMode, distance, fromRegion, toRegion);

    // Generate route points (simplified - in reality would use routing API)
    const routePoints: [number, number][] = [
      [fromPlace.latitude, fromPlace.longitude],
      [toPlace.latitude, toPlace.longitude]
    ];

    return {
      fromPlaceId: fromPlace.id,
      toPlaceId: toPlace.id,
      transportMode: selectedMode,
      travelTime,
      distance,
      routePoints,
      isRealistic: analysis.isRealistic,
      constraints: analysis.constraints
    };
  }

  /**
   * Optimize complete route with geographic constraints
   */
  static async optimizeRouteWithConstraints(
    places: Array<{ id: string; latitude: number; longitude: number; name: string }>,
    departureLocation: { latitude: number; longitude: number }
  ): Promise<OptimizedRoute> {
    if (places.length === 0) {
      return {
        segments: [],
        totalTravelTime: 0,
        totalDistance: 0,
        isCompletelyRealistic: true,
        unrealisticSegments: [],
        suggestions: []
      };
    }

    // Add departure as starting point
    const allPoints = [
      { id: 'departure', latitude: departureLocation.latitude, longitude: departureLocation.longitude },
      ...places
    ];

    // Simple nearest neighbor algorithm with constraint checking
    // In production, would use more sophisticated TSP solver
    const route: typeof allPoints = [allPoints[0]]; // Start with departure
    const remaining = allPoints.slice(1);
    let currentPoint = allPoints[0];

    while (remaining.length > 0) {
      let bestNext = remaining[0];
      let bestScore = Infinity;

      for (const candidate of remaining) {
        const analysis = await this.analyzeTransportOptions(
          currentPoint.latitude,
          currentPoint.longitude,
          candidate.latitude,
          candidate.longitude
        );

        const distance = this.calculateDistance(
          currentPoint.latitude,
          currentPoint.longitude,
          candidate.latitude,
          candidate.longitude
        );

        // Score based on distance and realism
        const realismPenalty = analysis.isRealistic ? 0 : 1000;
        const score = distance + realismPenalty;

        if (score < bestScore) {
          bestScore = score;
          bestNext = candidate;
        }
      }

      route.push(bestNext);
      remaining.splice(remaining.indexOf(bestNext), 1);
      currentPoint = bestNext;
    }

    // Generate segments
    const segments: RouteSegment[] = [];
    let totalTravelTime = 0;
    let totalDistance = 0;
    const unrealisticSegments: string[] = [];

    for (let i = 0; i < route.length - 1; i++) {
      const segment = await this.generateRouteSegment(route[i], route[i + 1]);
      segments.push(segment);
      totalTravelTime += segment.travelTime;
      totalDistance += segment.distance;

      if (!segment.isRealistic) {
        unrealisticSegments.push(`${route[i].id} → ${route[i + 1].id}`);
      }
    }

    const isCompletelyRealistic = unrealisticSegments.length === 0;
    const suggestions: string[] = [];

    if (!isCompletelyRealistic) {
      suggestions.push('Some route segments are geographically unrealistic');
      suggestions.push('Consider removing places that require sea travel');
      suggestions.push('Group places by accessible regions');
    }

    if (segments.some(s => s.transportMode === 'flight')) {
      suggestions.push('Route includes flights - consider airport transfer times');
    }

    return {
      segments,
      totalTravelTime,
      totalDistance,
      isCompletelyRealistic,
      unrealisticSegments,
      suggestions
    };
  }

  /**
   * Validate route for geographic realism
   */
  static validateRouteRealism(route: OptimizedRoute): {
    isValid: boolean;
    violations: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  } {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check for water crossings with inappropriate transport
    route.segments.forEach(segment => {
      if (segment.constraints.includes('over water') && 
          ['walking', 'bicycle', 'car', 'public_transport'].includes(segment.transportMode)) {
        violations.push(`${segment.transportMode} over water: ${segment.fromPlaceId} → ${segment.toPlaceId}`);
      }
    });

    // Check for excessively long walking/cycling segments
    route.segments.forEach(segment => {
      if (segment.transportMode === 'walking' && segment.distance > this.MAX_WALKING_DISTANCE) {
        violations.push(`Walking distance too long: ${segment.distance.toFixed(1)}km`);
        recommendations.push('Consider public transport or taxi for long distances');
      }
      if (segment.transportMode === 'bicycle' && segment.distance > this.MAX_BICYCLE_DISTANCE) {
        violations.push(`Cycling distance too long: ${segment.distance.toFixed(1)}km`);
        recommendations.push('Consider train or bus for medium distances');
      }
    });

    // Check for flights that are too short
    route.segments.forEach(segment => {
      if (segment.transportMode === 'flight' && segment.distance < this.MIN_FLIGHT_DISTANCE) {
        violations.push(`Flight too short: ${segment.distance.toFixed(1)}km`);
        recommendations.push('Use ground transport for short distances');
      }
    });

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (violations.length === 0) {
      severity = 'low';
    } else if (violations.some(v => v.includes('over water'))) {
      severity = 'critical';
    } else if (violations.length > 3) {
      severity = 'high';
    } else {
      severity = 'medium';
    }

    return {
      isValid: violations.length === 0,
      violations,
      severity,
      recommendations
    };
  }

  /**
   * Get alternative routes for unrealistic segments
   */
  static async getAlternativeRoutes(
    fromPlace: { id: string; latitude: number; longitude: number },
    toPlace: { id: string; latitude: number; longitude: number }
  ): Promise<{
    alternatives: RouteSegment[];
    recommendation: string;
  }> {
    const analysis = await this.analyzeTransportOptions(
      fromPlace.latitude,
      fromPlace.longitude,
      toPlace.latitude,
      toPlace.longitude
    );

    const alternatives: RouteSegment[] = [];
    
    // Generate alternatives for each available mode
    for (const mode of analysis.availableModes) {
      const segment = await this.generateRouteSegment(fromPlace, toPlace, mode);
      alternatives.push(segment);
    }

    let recommendation = 'No realistic alternatives available';
    if (alternatives.length > 0) {
      const best = alternatives.reduce((prev, curr) => 
        curr.travelTime < prev.travelTime ? curr : prev
      );
      recommendation = `Recommended: ${best.transportMode} (${Math.round(best.travelTime)}min, ${best.distance.toFixed(1)}km)`;
    }

    return {
      alternatives,
      recommendation
    };
  }
}

// Export types for use in other modules
export default RealisticRouteCalculator;