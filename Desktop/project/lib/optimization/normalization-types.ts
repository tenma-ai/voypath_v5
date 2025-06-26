// Types for Z-Score Normalization and Geographical Clustering

import type { ValidatedPreference, Location } from './types'
import type { Destinations, Places } from '@/lib/database.types'

// Standardized preference after Z-score normalization
export interface StandardizedPreference {
  userId: string | null
  sessionId: string | null
  destinationId: string
  originalScore: number      // Raw 1-5 rating
  standardizedScore: number  // Z-score normalized rating
  preferredDuration: number  // Hours
  userName: string          // For display purposes
  userColor: string         // Member assigned color
}

// User statistics for normalization
export interface UserStatistics {
  userId: string | null
  sessionId: string | null
  userKey: string           // Composite key for identification
  ratings: number[]
  mean: number
  standardDeviation: number
  ratingCount: number
}

// Destination cluster for geographical grouping
export interface DestinationCluster {
  id: string
  destinations: (Destinations | Places)[]
  centerLocation: Location
  totalDesirability: number     // Average standardized preference
  averageStayTime: number      // Average preferred duration in hours
  memberPreferences: Map<string, number> // User key -> aggregated preference
}

// Cluster analysis result
export interface ClusterAnalysis {
  clusters: DestinationCluster[]
  totalClusters: number
  averageClusterSize: number
  isolatedDestinations: string[] // IDs of destinations in single-destination clusters
}

// Time constraints for trip planning
export interface TimeConstraints {
  mode: 'fixed' | 'auto'
  startDate: Date
  endDate?: Date              // Required for fixed mode
  dailyHours: number         // Available hours per day (default: 9)
  totalAvailableHours?: number // Calculated for fixed mode
}

// Normalization result
export interface NormalizationResult {
  standardizedPreferences: StandardizedPreference[]
  userStatistics: Map<string, UserStatistics>
  warnings: string[]
}

// Clustering configuration
export interface ClusteringConfig {
  maxClusterRadius: number   // Maximum radius in km (default: 50)
  minClusterSize: number     // Minimum destinations to form cluster (default: 1)
  distanceCalculation: 'haversine' | 'euclidean'
}

// Distance cache for performance
export interface DistanceCache {
  get(from: Location, to: Location): number | undefined
  set(from: Location, to: Location, distance: number): void
  clear(): void
}

// Clustering result
export interface ClusteringResult {
  clusters: DestinationCluster[]
  analysis: ClusterAnalysis
  distanceMatrix: Map<string, Map<string, number>> // Pairwise distances between clusters
}