// TSP-based route optimization algorithms

import type { DestinationCluster } from './normalization-types'
import type { Location } from './types'
import type { TwoOptResult } from './algorithm-types'
import { calculateHaversineDistance } from './geographical-clustering'
import { calculateCachedDistance } from './distance-cache'

/**
 * Nearest Neighbor TSP heuristic
 * Builds a route by always visiting the nearest unvisited cluster
 */
export function nearestNeighborTSP(
  departureLocation: Location,
  clusters: DestinationCluster[],
  returnLocation: Location | null
): DestinationCluster[] {
  if (clusters.length <= 1) return clusters
  
  const unvisited = new Set(clusters.map((_, index) => index))
  const route: DestinationCluster[] = []
  let currentLocation = departureLocation
  
  // Build route by selecting nearest neighbor
  while (unvisited.size > 0) {
    let nearestIndex = -1
    let minDistance = Infinity
    
    // Find nearest unvisited cluster
    for (const index of Array.from(unvisited)) {
      const cluster = clusters[index]
      const distance = calculateCachedDistance(
        currentLocation,
        cluster.centerLocation,
        (from, to) => calculateHaversineDistance(
          from.latitude,
          from.longitude,
          to.latitude,
          to.longitude
        )
      )
      
      if (distance < minDistance) {
        minDistance = distance
        nearestIndex = index
      }
    }
    
    // Add nearest cluster to route
    if (nearestIndex !== -1) {
      route.push(clusters[nearestIndex])
      unvisited.delete(nearestIndex)
      currentLocation = clusters[nearestIndex].centerLocation
    }
  }
  
  return route
}

/**
 * 2-opt improvement algorithm
 * Improves existing route by swapping segments
 */
export function twoOptImprovement(
  route: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null
): { improvedRoute: DestinationCluster[]; result: TwoOptResult } {
  if (route.length < 4) {
    // Too few clusters to improve
    return {
      improvedRoute: route,
      result: {
        improved: false,
        originalDistance: calculateTotalDistance(route, departureLocation, returnLocation),
        newDistance: calculateTotalDistance(route, departureLocation, returnLocation),
        improvementPercent: 0,
        swapsPerformed: 0
      }
    }
  }
  
  let currentRoute = [...route]
  let improved = true
  let swapsPerformed = 0
  const originalDistance = calculateTotalDistance(route, departureLocation, returnLocation)
  
  // Keep improving until no more improvements found
  while (improved) {
    improved = false
    
    // Try all possible 2-opt swaps
    for (let i = 0; i < currentRoute.length - 1; i++) {
      for (let j = i + 2; j < currentRoute.length; j++) {
        // Calculate current segment distances
        const currentSegmentDistance = calculateSegmentDistance(
          currentRoute,
          i,
          j,
          departureLocation,
          returnLocation
        )
        
        // Create new route with reversed segment
        const newRoute = twoOptSwap(currentRoute, i, j)
        
        // Calculate new segment distances
        const newSegmentDistance = calculateSegmentDistance(
          newRoute,
          i,
          j,
          departureLocation,
          returnLocation
        )
        
        // Accept improvement
        if (newSegmentDistance < currentSegmentDistance) {
          currentRoute = newRoute
          improved = true
          swapsPerformed++
          break // Start over with new route
        }
      }
      
      if (improved) break
    }
  }
  
  const newDistance = calculateTotalDistance(currentRoute, departureLocation, returnLocation)
  const improvementPercent = ((originalDistance - newDistance) / originalDistance) * 100
  
  return {
    improvedRoute: currentRoute,
    result: {
      improved: swapsPerformed > 0,
      originalDistance,
      newDistance,
      improvementPercent,
      swapsPerformed
    }
  }
}

/**
 * Perform 2-opt swap on route
 */
function twoOptSwap(
  route: DestinationCluster[],
  i: number,
  j: number
): DestinationCluster[] {
  const newRoute = [...route]
  
  // Reverse the segment between i+1 and j
  let left = i + 1
  let right = j
  
  while (left < right) {
    const temp = newRoute[left]
    newRoute[left] = newRoute[right]
    newRoute[right] = temp
    left++
    right--
  }
  
  return newRoute
}

/**
 * Calculate distance for a segment of the route
 */
function calculateSegmentDistance(
  route: DestinationCluster[],
  i: number,
  j: number,
  departureLocation: Location,
  returnLocation: Location | null
): number {
  let distance = 0
  
  // Handle edge from i to i+1
  if (i === -1) {
    // From departure to first cluster
    distance += getDistance(departureLocation, route[0].centerLocation)
  } else if (i < route.length - 1) {
    distance += getDistance(
      route[i].centerLocation,
      route[i + 1].centerLocation
    )
  }
  
  // Handle edge from j to j+1
  if (j === route.length - 1) {
    // From last cluster to return
    const finalLocation = returnLocation || departureLocation
    distance += getDistance(route[j].centerLocation, finalLocation)
  } else if (j < route.length - 1) {
    distance += getDistance(
      route[j].centerLocation,
      route[j + 1].centerLocation
    )
  }
  
  return distance
}

/**
 * Calculate total distance of a route
 */
export function calculateTotalDistance(
  route: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null
): number {
  if (route.length === 0) return 0
  
  let totalDistance = 0
  const finalLocation = returnLocation || departureLocation
  
  // Departure to first cluster
  totalDistance += getDistance(departureLocation, route[0].centerLocation)
  
  // Between clusters
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += getDistance(
      route[i].centerLocation,
      route[i + 1].centerLocation
    )
  }
  
  // Last cluster to return
  totalDistance += getDistance(
    route[route.length - 1].centerLocation,
    finalLocation
  )
  
  return totalDistance
}

/**
 * Helper function to get cached distance
 */
function getDistance(from: Location, to: Location): number {
  return calculateCachedDistance(
    from,
    to,
    (f, t) => calculateHaversineDistance(
      f.latitude,
      f.longitude,
      t.latitude,
      t.longitude
    )
  )
}

/**
 * Generate a random route permutation
 */
export function generateRandomRoute(
  clusters: DestinationCluster[]
): DestinationCluster[] {
  const route = [...clusters]
  
  // Fisher-Yates shuffle
  for (let i = route.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = route[i]
    route[i] = route[j]
    route[j] = temp
  }
  
  return route
}

/**
 * Generate route starting with specific clusters
 */
export function generateRouteWithStart(
  startClusters: DestinationCluster[],
  remainingClusters: DestinationCluster[],
  departureLocation: Location
): DestinationCluster[] {
  // Start with specified clusters
  const route = [...startClusters]
  
  // Add remaining clusters using nearest neighbor
  const unvisited = new Set(remainingClusters)
  let currentLocation = startClusters.length > 0
    ? startClusters[startClusters.length - 1].centerLocation
    : departureLocation
  
  while (unvisited.size > 0) {
    let nearest: DestinationCluster | null = null
    let minDistance = Infinity
    
    for (const cluster of Array.from(unvisited)) {
      const distance = getDistance(currentLocation, cluster.centerLocation)
      if (distance < minDistance) {
        minDistance = distance
        nearest = cluster
      }
    }
    
    if (nearest) {
      route.push(nearest)
      unvisited.delete(nearest)
      currentLocation = nearest.centerLocation
    }
  }
  
  return route
}