// Optimize destination order within a cluster using nearest neighbor TSP

import type { Location } from './types'
import { calculateHaversineDistance } from './geographical-clustering'

// Simple destination interface for internal optimization
interface Destination {
  id: string
  location: Location
}

// Internal cluster optimization result
export interface ClusterInternalRoute {
  orderedDestinations: Destination[]
  entryDestination: Destination
  totalDistanceKm: number
  estimatedTimeHours: number
}

/**
 * Optimize the order of destinations within a cluster
 * Uses nearest neighbor TSP starting from the entry point
 */
export function optimizeClusterInternally(
  clusterDestinations: Destination[],
  entryLocation: Location,
  averageStayHours: number
): ClusterInternalRoute {
  if (clusterDestinations.length === 0) {
    return {
      orderedDestinations: [],
      entryDestination: clusterDestinations[0],
      totalDistanceKm: 0,
      estimatedTimeHours: 0
    }
  }
  
  if (clusterDestinations.length === 1) {
    return {
      orderedDestinations: clusterDestinations,
      entryDestination: clusterDestinations[0],
      totalDistanceKm: 0,
      estimatedTimeHours: averageStayHours
    }
  }
  
  // Find the entry destination (closest to arrival point)
  const entryDestination = findNearestDestination(entryLocation, clusterDestinations)
  
  // Build route using nearest neighbor
  const route: Destination[] = [entryDestination]
  const unvisited = new Set(
    clusterDestinations.filter(d => d.id !== entryDestination.id)
  )
  let currentLocation = entryDestination.location
  let totalDistance = 0
  
  // Continue adding nearest unvisited destinations
  while (unvisited.size > 0) {
    let nearest: Destination | null = null
    let minDistance = Infinity
    
    for (const destination of Array.from(unvisited)) {
      const distance = calculateHaversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.location.latitude,
        destination.location.longitude
      )
      
      if (distance < minDistance) {
        minDistance = distance
        nearest = destination
      }
    }
    
    if (nearest) {
      route.push(nearest)
      unvisited.delete(nearest)
      totalDistance += minDistance
      currentLocation = nearest.location
    }
  }
  
  // Calculate total time (visit time + intra-cluster travel)
  const intraClusterTravelTime = calculateIntraClusterTravelTime(totalDistance)
  const totalTimeHours = averageStayHours * clusterDestinations.length + intraClusterTravelTime
  
  return {
    orderedDestinations: route,
    entryDestination,
    totalDistanceKm: totalDistance,
    estimatedTimeHours: totalTimeHours
  }
}

/**
 * Find the destination closest to a given location
 */
function findNearestDestination(
  location: Location,
  destinations: Destination[]
): Destination {
  let nearest = destinations[0]
  let minDistance = Infinity
  
  for (const destination of destinations) {
    const distance = calculateHaversineDistance(
      location.latitude,
      location.longitude,
      destination.location.latitude,
      destination.location.longitude
    )
    
    if (distance < minDistance) {
      minDistance = distance
      nearest = destination
    }
  }
  
  return nearest
}

/**
 * Calculate travel time for intra-cluster movement
 * Assumes walking speed for short distances within clusters
 */
function calculateIntraClusterTravelTime(distanceKm: number): number {
  const walkingSpeedKmh = 5 // Walking/local transport
  return distanceKm / walkingSpeedKmh
}

/**
 * Validate cluster internal route
 */
export function validateClusterRoute(route: ClusterInternalRoute): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []
  
  // Check for empty route
  if (route.orderedDestinations.length === 0) {
    issues.push('Cluster route has no destinations')
  }
  
  // Check for duplicate destinations
  const uniqueIds = new Set(route.orderedDestinations.map(d => d.id))
  if (uniqueIds.size !== route.orderedDestinations.length) {
    issues.push('Cluster route contains duplicate destinations')
  }
  
  // Check for negative distance or time
  if (route.totalDistanceKm < 0) {
    issues.push('Cluster route has negative distance')
  }
  
  if (route.estimatedTimeHours < 0) {
    issues.push('Cluster route has negative time estimate')
  }
  
  // Check for unrealistic intra-cluster distance (> 50km)
  if (route.totalDistanceKm > 50) {
    issues.push(`Cluster internal distance ${route.totalDistanceKm.toFixed(1)}km exceeds expected cluster size`)
  }
  
  return {
    isValid: issues.length === 0,
    issues
  }
}