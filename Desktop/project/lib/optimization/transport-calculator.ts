// Transportation mode and travel time calculations

import type { 
  TransportMode, 
  TransportConfig, 
  RouteSegment 
} from './algorithm-types'
import type { Location } from './types'
import type { DestinationCluster } from './normalization-types'
import { calculateHaversineDistance } from './geographical-clustering'
import { calculateCachedDistance } from './distance-cache'

// Default transport configuration
const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  walkingSpeedKmh: 5,
  walkingMaxDistanceKm: 2,
  drivingSpeedKmh: 60,
  drivingMaxDistanceKm: 300,
  flyingSpeedKmh: 500
}

/**
 * Determine transport mode based on distance
 */
export function determineTransportMode(
  distanceKm: number,
  config: TransportConfig = DEFAULT_TRANSPORT_CONFIG
): TransportMode {
  if (distanceKm <= config.walkingMaxDistanceKm) {
    return 'walking'
  } else if (distanceKm <= config.drivingMaxDistanceKm) {
    return 'driving'
  } else {
    return 'flying'
  }
}

/**
 * Estimate travel time based on distance and transport mode
 */
export function estimateTravelTime(
  distanceKm: number,
  mode: TransportMode,
  config: TransportConfig = DEFAULT_TRANSPORT_CONFIG
): number {
  switch (mode) {
    case 'walking':
      return distanceKm / config.walkingSpeedKmh
      
    case 'driving':
      // Add buffer for parking, traffic, etc.
      const drivingTime = distanceKm / config.drivingSpeedKmh
      return drivingTime * 1.2 // 20% buffer
      
    case 'flying':
      // Add fixed time for airport procedures
      const flyingTime = distanceKm / config.flyingSpeedKmh
      const airportTime = 3 // 3 hours for check-in, security, boarding, baggage
      return flyingTime + airportTime
      
    default:
      throw new Error(`Unknown transport mode: ${mode}`)
  }
}

/**
 * Calculate route segment between two locations
 */
export function calculateRouteSegment(
  from: Location | DestinationCluster,
  to: Location | DestinationCluster,
  config: TransportConfig = DEFAULT_TRANSPORT_CONFIG
): RouteSegment {
  // Extract locations
  const fromLocation = 'centerLocation' in from ? from.centerLocation : from
  const toLocation = 'centerLocation' in to ? to.centerLocation : to
  
  // Calculate distance with caching
  const distanceKm = calculateCachedDistance(
    fromLocation,
    toLocation,
    (from, to) => calculateHaversineDistance(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    )
  )
  
  // Determine transport mode
  const transportMode = determineTransportMode(distanceKm, config)
  
  // Estimate travel time
  const estimatedTimeHours = estimateTravelTime(distanceKm, transportMode, config)
  
  return {
    fromCluster: 'centerLocation' in from ? from : null,
    toCluster: 'centerLocation' in to ? to : null,
    distanceKm,
    transportMode,
    estimatedTimeHours
  }
}

/**
 * Calculate total route distance and time
 */
export function calculateRouteMetrics(
  departureLocation: Location,
  clusters: DestinationCluster[],
  returnLocation: Location | null,
  config: TransportConfig = DEFAULT_TRANSPORT_CONFIG
): {
  segments: RouteSegment[]
  totalDistanceKm: number
  totalTimeHours: number
  transportModes: Set<TransportMode>
} {
  const segments: RouteSegment[] = []
  let totalDistanceKm = 0
  let totalTimeHours = 0
  const transportModes = new Set<TransportMode>()
  
  // Handle empty route
  if (clusters.length === 0) {
    if (returnLocation && returnLocation.id !== departureLocation.id) {
      const segment = calculateRouteSegment(departureLocation, returnLocation, config)
      segments.push(segment)
      totalDistanceKm += segment.distanceKm
      totalTimeHours += segment.estimatedTimeHours
      transportModes.add(segment.transportMode)
    }
    
    return { segments, totalDistanceKm, totalTimeHours, transportModes }
  }
  
  // Departure to first cluster
  const firstSegment = calculateRouteSegment(departureLocation, clusters[0], config)
  segments.push(firstSegment)
  totalDistanceKm += firstSegment.distanceKm
  totalTimeHours += firstSegment.estimatedTimeHours
  transportModes.add(firstSegment.transportMode)
  
  // Between clusters
  for (let i = 0; i < clusters.length - 1; i++) {
    const segment = calculateRouteSegment(clusters[i], clusters[i + 1], config)
    segments.push(segment)
    totalDistanceKm += segment.distanceKm
    totalTimeHours += segment.estimatedTimeHours
    transportModes.add(segment.transportMode)
  }
  
  // Last cluster to return location
  const finalLocation = returnLocation || departureLocation
  const lastSegment = calculateRouteSegment(
    clusters[clusters.length - 1],
    finalLocation,
    config
  )
  segments.push(lastSegment)
  totalDistanceKm += lastSegment.distanceKm
  totalTimeHours += lastSegment.estimatedTimeHours
  transportModes.add(lastSegment.transportMode)
  
  // Add time for visiting destinations
  const visitTimeHours = clusters.reduce(
    (sum, cluster) => sum + cluster.averageStayTime,
    0
  )
  totalTimeHours += visitTimeHours
  
  return {
    segments,
    totalDistanceKm,
    totalTimeHours,
    transportModes
  }
}

/**
 * Validate route feasibility
 */
export function validateRouteFeasibility(
  totalTimeHours: number,
  availableTimeHours: number | undefined,
  transportModes: Set<TransportMode>
): {
  feasible: boolean
  issues: string[]
} {
  const issues: string[] = []
  
  // Check time constraint
  if (availableTimeHours !== undefined && totalTimeHours > availableTimeHours) {
    issues.push(
      `Route requires ${totalTimeHours.toFixed(1)} hours but only ${availableTimeHours.toFixed(1)} hours available`
    )
  }
  
  // Check for practical constraints
  if (transportModes.has('flying') && transportModes.size > 2) {
    issues.push(
      'Route involves multiple transport mode changes including flights'
    )
  }
  
  return {
    feasible: issues.length === 0,
    issues
  }
}

/**
 * Optimize transport modes for a route
 * Sometimes driving might be better than a short flight
 */
export function optimizeTransportModes(
  segments: RouteSegment[],
  config: TransportConfig = DEFAULT_TRANSPORT_CONFIG
): RouteSegment[] {
  return segments.map(segment => {
    // Skip if not flying
    if (segment.transportMode !== 'flying') {
      return segment
    }
    
    // Check if driving would be reasonable
    const drivingTime = estimateTravelTime(
      segment.distanceKm,
      'driving',
      config
    )
    const flyingTime = segment.estimatedTimeHours
    
    // If driving is less than 5 hours and not much slower than flying, prefer driving
    if (drivingTime < 5 && drivingTime < flyingTime * 1.5) {
      return {
        ...segment,
        transportMode: 'driving',
        estimatedTimeHours: drivingTime
      }
    }
    
    return segment
  })
}

/**
 * Get transport mode statistics for display
 */
export function getTransportStats(segments: RouteSegment[]): {
  walkingSegments: number
  walkingDistanceKm: number
  drivingSegments: number
  drivingDistanceKm: number
  flyingSegments: number
  flyingDistanceKm: number
  modeChanges: number
} {
  const stats = {
    walkingSegments: 0,
    walkingDistanceKm: 0,
    drivingSegments: 0,
    drivingDistanceKm: 0,
    flyingSegments: 0,
    flyingDistanceKm: 0,
    modeChanges: 0
  }
  
  let previousMode: TransportMode | null = null
  
  for (const segment of segments) {
    switch (segment.transportMode) {
      case 'walking':
        stats.walkingSegments++
        stats.walkingDistanceKm += segment.distanceKm
        break
      case 'driving':
        stats.drivingSegments++
        stats.drivingDistanceKm += segment.distanceKm
        break
      case 'flying':
        stats.flyingSegments++
        stats.flyingDistanceKm += segment.distanceKm
        break
    }
    
    if (previousMode && previousMode !== segment.transportMode) {
      stats.modeChanges++
    }
    previousMode = segment.transportMode
  }
  
  return stats
}