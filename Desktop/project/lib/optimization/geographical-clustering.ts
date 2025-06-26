// Geographical Clustering for destination grouping

import type { Location } from './types'
import type { Destinations, Places } from '@/lib/database.types'
import type {
  DestinationCluster,
  ClusteringConfig,
  ClusteringResult,
  ClusterAnalysis,
  StandardizedPreference
} from './normalization-types'

// Default clustering configuration
const DEFAULT_CONFIG: ClusteringConfig = {
  maxClusterRadius: 50, // 50km radius
  minClusterSize: 1,    // Allow single-destination clusters
  distanceCalculation: 'haversine'
}

/**
 * Group destinations into geographical clusters
 */
export function clusterDestinations(
  destinations: (Destinations | Places)[],
  standardizedPreferences: StandardizedPreference[],
  config: Partial<ClusteringConfig> = {}
): ClusteringResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Convert destinations to locations, filtering out null values
  const locations = destinations
    .map(dest => {
      const location = destinationToLocation(dest)
      return location ? {
        id: dest.id,
        destination: dest,
        location,
        clustered: false
      } : null
    })
    .filter(Boolean) as {
      id: string;
      destination: Destinations | Places;
      location: Location;
      clustered: boolean;
    }[]
  
  // Build preference lookup map
  const preferenceMap = buildPreferenceMap(standardizedPreferences)
  
  // Perform clustering
  const clusters: DestinationCluster[] = []
  
  for (const location of locations) {
    if (location.clustered) continue
    
    // Find all unclustered destinations within radius
    const neighbors = findNeighbors(
      location,
      locations,
      finalConfig.maxClusterRadius
    )
    
    // Mark all neighbors as clustered
    neighbors.forEach(neighbor => {
      neighbor.clustered = true
    })
    
    // Create cluster
    const cluster = createCluster(
      neighbors.map(n => n.destination),
      preferenceMap
    )
    clusters.push(cluster)
  }
  
  // Sort clusters by desirability
  clusters.sort((a, b) => b.totalDesirability - a.totalDesirability)
  
  // Calculate cluster analysis
  const analysis = analyzeClusteringResult(clusters)
  
  // Build distance matrix between clusters
  const distanceMatrix = buildClusterDistanceMatrix(clusters)
  
  return {
    clusters,
    analysis,
    distanceMatrix
  }
}

/**
 * Convert destination to location object
 */
function destinationToLocation(dest: Destinations | Places): Location | null {
  // Handle both old destinations table and new places table
  if ('name' in dest && 'visit_order' in dest) {
    // Places table - check if it has valid coordinates
    if (dest.latitude === null || dest.longitude === null) {
      console.warn(`Skipping place ${dest.name} due to missing coordinates`)
      return null
    }
    return {
      id: dest.id,
      latitude: dest.latitude,
      longitude: dest.longitude,
      name: dest.name, // Updated field name
      address: dest.address || undefined
    }
  } else {
    // Destinations table - check if it has valid coordinates
    if (dest.latitude === null || dest.longitude === null) {
      console.warn(`Skipping destination ${dest.name} due to missing coordinates`)
      return null
    }
    return {
      id: dest.id,
      latitude: dest.latitude,
      longitude: dest.longitude,
      name: dest.name,
      address: dest.address || undefined
    }
  }
}

/**
 * Find all neighbors within specified radius
 */
function findNeighbors(
  target: any,
  locations: any[],
  maxRadius: number
): any[] {
  const neighbors = [target] // Include the target itself
  
  for (const location of locations) {
    if (location.clustered || location.id === target.id) continue
    
    const distance = calculateHaversineDistance(
      target.location.latitude,
      target.location.longitude,
      location.location.latitude,
      location.location.longitude
    )
    
    if (distance <= maxRadius) {
      neighbors.push(location)
    }
  }
  
  return neighbors
}

/**
 * Calculate Haversine distance between two points
 * Returns distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  
  return distance
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Create a cluster from destinations
 */
function createCluster(
  destinations: (Destinations | Places)[],
  preferenceMap: Map<string, StandardizedPreference[]>
): DestinationCluster {
  // Calculate center location (geographic centroid), filtering out null values
  const validLocations = destinations
    .map(d => destinationToLocation(d))
    .filter(Boolean) as Location[]
  
  const centerLocation = calculateCentroid(validLocations)
  
  // Calculate cluster metrics
  const memberPreferences = new Map<string, number>()
  let totalDesirability = 0
  let totalDuration = 0
  let preferenceCount = 0
  
  for (const dest of destinations) {
    const destPrefs = preferenceMap.get(dest.id) || []
    
    for (const pref of destPrefs) {
      const userKey = pref.userId || pref.sessionId || 'unknown'
      const currentScore = memberPreferences.get(userKey) || 0
      memberPreferences.set(userKey, currentScore + pref.standardizedScore)
      
      totalDesirability += pref.standardizedScore
      totalDuration += pref.preferredDuration
      preferenceCount++
    }
  }
  
  // Calculate averages
  const avgDesirability = preferenceCount > 0 ? totalDesirability / preferenceCount : 0
  const avgStayTime = preferenceCount > 0 ? totalDuration / preferenceCount : 2 // Default 2 hours
  
  return {
    id: crypto.randomUUID(),
    destinations,
    centerLocation,
    totalDesirability: avgDesirability,
    averageStayTime: avgStayTime,
    memberPreferences
  }
}

/**
 * Calculate geographic centroid of locations
 */
function calculateCentroid(locations: Location[]): Location {
  if (locations.length === 0) {
    throw new Error('Cannot calculate centroid of empty location array')
  }
  
  if (locations.length === 1) {
    return { ...locations[0] }
  }
  
  // Convert to Cartesian coordinates for accurate centroid calculation
  let x = 0, y = 0, z = 0
  
  for (const location of locations) {
    const lat = toRadians(location.latitude)
    const lon = toRadians(location.longitude)
    
    x += Math.cos(lat) * Math.cos(lon)
    y += Math.cos(lat) * Math.sin(lon)
    z += Math.sin(lat)
  }
  
  const total = locations.length
  x /= total
  y /= total
  z /= total
  
  // Convert back to latitude/longitude
  const centralLon = Math.atan2(y, x)
  const centralLat = Math.atan2(z, Math.sqrt(x * x + y * y))
  
  return {
    id: 'centroid',
    latitude: centralLat * 180 / Math.PI,
    longitude: centralLon * 180 / Math.PI,
    name: `Center of ${locations.length} locations`
  }
}

/**
 * Build preference lookup map
 */
function buildPreferenceMap(
  preferences: StandardizedPreference[]
): Map<string, StandardizedPreference[]> {
  const map = new Map<string, StandardizedPreference[]>()
  
  for (const pref of preferences) {
    const destPrefs = map.get(pref.destinationId) || []
    destPrefs.push(pref)
    map.set(pref.destinationId, destPrefs)
  }
  
  return map
}

/**
 * Analyze clustering results
 */
function analyzeClusteringResult(clusters: DestinationCluster[]): ClusterAnalysis {
  const clusterSizes = clusters.map(c => c.destinations.length)
  const avgClusterSize = clusterSizes.length > 0
    ? clusterSizes.reduce((sum, size) => sum + size, 0) / clusterSizes.length
    : 0
  
  const isolatedDestinations = clusters
    .filter(c => c.destinations.length === 1)
    .map(c => c.destinations[0].id)
  
  return {
    clusters,
    totalClusters: clusters.length,
    averageClusterSize: avgClusterSize,
    isolatedDestinations
  }
}

/**
 * Build distance matrix between all clusters
 */
function buildClusterDistanceMatrix(
  clusters: DestinationCluster[]
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>()
  
  for (const cluster1 of clusters) {
    const distances = new Map<string, number>()
    
    for (const cluster2 of clusters) {
      if (cluster1.id === cluster2.id) {
        distances.set(cluster2.id, 0)
      } else {
        const distance = calculateHaversineDistance(
          cluster1.centerLocation.latitude,
          cluster1.centerLocation.longitude,
          cluster2.centerLocation.latitude,
          cluster2.centerLocation.longitude
        )
        distances.set(cluster2.id, distance)
      }
    }
    
    matrix.set(cluster1.id, distances)
  }
  
  return matrix
}

/**
 * Find optimal cluster visiting order (simple nearest neighbor for MVP)
 */
export function findOptimalClusterOrder(
  departureLocation: Location,
  clusters: DestinationCluster[],
  returnLocation?: Location
): DestinationCluster[] {
  if (clusters.length === 0) return []
  if (clusters.length === 1) return clusters
  
  const visited = new Set<string>()
  const orderedClusters: DestinationCluster[] = []
  let currentLocation = departureLocation
  
  // Nearest neighbor algorithm
  while (visited.size < clusters.length) {
    let nearestCluster: DestinationCluster | null = null
    let minDistance = Infinity
    
    for (const cluster of clusters) {
      if (visited.has(cluster.id)) continue
      
      const distance = calculateHaversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        cluster.centerLocation.latitude,
        cluster.centerLocation.longitude
      )
      
      if (distance < minDistance) {
        minDistance = distance
        nearestCluster = cluster
      }
    }
    
    if (nearestCluster) {
      orderedClusters.push(nearestCluster)
      visited.add(nearestCluster.id)
      currentLocation = nearestCluster.centerLocation
    }
  }
  
  return orderedClusters
}

/**
 * Validate clustering results
 */
export function validateClusteringResult(result: ClusteringResult): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []
  
  // Check if all clusters have valid center locations
  for (const cluster of result.clusters) {
    const { latitude, longitude } = cluster.centerLocation
    
    if (latitude < -90 || latitude > 90) {
      issues.push(`Cluster ${cluster.id} has invalid latitude: ${latitude}`)
    }
    
    if (longitude < -180 || longitude > 180) {
      issues.push(`Cluster ${cluster.id} has invalid longitude: ${longitude}`)
    }
    
    if (cluster.destinations.length === 0) {
      issues.push(`Cluster ${cluster.id} has no destinations`)
    }
  }
  
  // Check for duplicate destination assignments
  const destinationIds = new Set<string>()
  for (const cluster of result.clusters) {
    for (const dest of cluster.destinations) {
      if (destinationIds.has(dest.id)) {
        issues.push(`Destination ${dest.id} appears in multiple clusters`)
      }
      destinationIds.add(dest.id)
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  }
}