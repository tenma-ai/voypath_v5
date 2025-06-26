// Types for the core optimization algorithm

import type { DestinationCluster, TimeConstraints } from './normalization-types'
import type { Location } from './types'

// Transportation mode for travel between clusters
export type TransportMode = 'walking' | 'driving' | 'flying'

// Route segment between two clusters
export interface RouteSegment {
  fromCluster: DestinationCluster | null // null for departure location
  toCluster: DestinationCluster | null   // null for return location
  distanceKm: number
  transportMode: TransportMode
  estimatedTimeHours: number
}

// Complete route solution
export interface RouteSolution {
  clusters: DestinationCluster[]
  segments: RouteSegment[]
  totalDistanceKm: number
  totalTimeHours: number
  fairnessScore: number
  quantityScore: number
  compositeScore: number
  memberSatisfaction: Map<string, number>
  feasible: boolean
  issues: string[]
}

// User satisfaction data
export interface UserSatisfaction {
  userId: string | null
  sessionId: string | null
  userKey: string
  userName: string
  satisfactionScore: number
  selectedDestinations: number
  totalDestinations: number
}

// Algorithm configuration
export interface OptimizationConfig {
  maxIterations: number             // Maximum heuristic iterations (default: 50)
  fairnessWeight: number           // Weight for fairness in composite score (default: 0.6)
  quantityWeight: number           // Weight for quantity in composite score (default: 0.4)
  earlyTerminationThreshold: number // Stop if fairness score exceeds this (default: 0.95)
  randomExplorations: number       // Number of random solutions to explore (default: 15)
  topCandidatesToImprove: number   // Number of top candidates for 2-opt improvement (default: 5)
}

// Transport mode configuration
export interface TransportConfig {
  walkingSpeedKmh: number         // Walking speed (default: 5)
  walkingMaxDistanceKm: number    // Max walking distance (default: 2)
  drivingSpeedKmh: number         // Average driving speed (default: 60)
  drivingMaxDistanceKm: number    // Max driving distance before flying (default: 300)
  flyingSpeedKmh: number          // Effective flying speed including airport time (default: 500)
}

// Algorithm execution result
export interface OptimizationResult {
  bestSolution: RouteSolution
  allSolutions: RouteSolution[]
  executionTimeMs: number
  iterationsPerformed: number
  earlyTermination: boolean
}

// Gini coefficient calculation result
export interface GiniResult {
  giniCoefficient: number
  fairnessScore: number
  userSatisfactions: UserSatisfaction[]
  lowestSatisfaction: UserSatisfaction | null
  highestSatisfaction: UserSatisfaction | null
}

// 2-opt improvement result
export interface TwoOptResult {
  improved: boolean
  originalDistance: number
  newDistance: number
  improvementPercent: number
  swapsPerformed: number
}

// Candidate generation strategy
export type GenerationStrategy = 
  | 'desirability_greedy'
  | 'quantity_maximizing' 
  | 'random_exploration'
  | 'balanced_satisfaction'

// Algorithm statistics for debugging
export interface AlgorithmStats {
  candidatesGenerated: number
  feasibleSolutions: number
  infeasibleSolutions: number
  averageFairness: number
  bestFairness: number
  averageQuantity: number
  bestQuantity: number
  twoOptImprovements: number
  cacheHits: number
}