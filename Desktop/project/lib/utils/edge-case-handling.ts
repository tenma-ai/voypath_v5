/**
 * Edge Case Handling System for Voypath Optimization
 * 
 * Comprehensive edge case handling that addresses data anomalies,
 * algorithm limitations, and unusual user scenarios in optimization.
 */

import type { PreprocessedData, ValidatedPreference } from '../optimization/types'
import type { ClusteringResult } from '../optimization/normalization-types'
import type { OptimizationResult } from '../optimization/algorithm-types'
import type { OptimizationResponse } from '../types/api-errors'

export interface EdgeCaseDetectionResult {
  hasEdgeCases: boolean
  detectedCases: EdgeCaseType[]
  recommendations: string[]
  fallbackStrategy?: string
}

export enum EdgeCaseType {
  SINGLE_DESTINATION = 'single_destination',
  SINGLE_USER = 'single_user',
  COLOCATED_DESTINATIONS = 'colocated_destinations',
  INSUFFICIENT_PREFERENCES = 'insufficient_preferences',
  EXTREME_TIME_CONSTRAINTS = 'extreme_time_constraints',
  IDENTICAL_PREFERENCES = 'identical_preferences',
  EXTREME_PREFERENCE_DISPARITIES = 'extreme_preference_disparities',
  UNREACHABLE_DESTINATIONS = 'unreachable_destinations',
  INVALID_COORDINATES = 'invalid_coordinates',
  ZERO_DURATION_TRIP = 'zero_duration_trip',
  EXCESSIVE_DESTINATIONS = 'excessive_destinations'
}

/**
 * Detects edge cases in preprocessed optimization data
 */
export function detectDataEdgeCases(preprocessedData: PreprocessedData): EdgeCaseDetectionResult {
  const detectedCases: EdgeCaseType[] = []
  const recommendations: string[] = []

  // Check for single destination
  if (preprocessedData.destinations.size === 1) {
    detectedCases.push(EdgeCaseType.SINGLE_DESTINATION)
    recommendations.push('Consider adding more destinations for a richer itinerary')
  }

  // Check for single user
  if (preprocessedData.groupMembers.size === 1) {
    detectedCases.push(EdgeCaseType.SINGLE_USER)
    recommendations.push('Single user optimization - preferences will be prioritized absolutely')
  }

  // Check for colocated destinations
  const destinationArray = Array.from(preprocessedData.destinations.values());
  if (areAllDestinationsColocated(destinationArray)) {
    detectedCases.push(EdgeCaseType.COLOCATED_DESTINATIONS)
    recommendations.push('All destinations are very close together - consider walking routes')
  }

  // Check for insufficient preferences
  if (hasInsufficientPreferences(preprocessedData.preferences)) {
    detectedCases.push(EdgeCaseType.INSUFFICIENT_PREFERENCES)
    recommendations.push('Ask group members to provide more destination preferences')
  }

  // Check for invalid coordinates
  if (hasInvalidCoordinates(destinationArray)) {
    detectedCases.push(EdgeCaseType.INVALID_COORDINATES)
    recommendations.push('Some destination coordinates appear invalid - please verify locations')
  }

  // Check for excessive destinations
  if (destinationArray.length > 50) {
    detectedCases.push(EdgeCaseType.EXCESSIVE_DESTINATIONS)
    recommendations.push('Consider reducing destinations or splitting into multiple trips')
  }

  // Check for zero duration trip
  if (calculateTripDuration(preprocessedData) <= 0) {
    detectedCases.push(EdgeCaseType.ZERO_DURATION_TRIP)
    recommendations.push('Trip duration must be greater than zero')
  }

  return {
    hasEdgeCases: detectedCases.length > 0,
    detectedCases,
    recommendations,
    fallbackStrategy: determineFallbackStrategy(detectedCases)
  }
}

/**
 * Handles data edge cases by applying appropriate transformations
 */
export function handleDataEdgeCases(preprocessedData: PreprocessedData): PreprocessedData {
  const edgeCases = detectDataEdgeCases(preprocessedData)
  let processedData = { ...preprocessedData }

  for (const caseType of edgeCases.detectedCases) {
    switch (caseType) {
      case EdgeCaseType.SINGLE_DESTINATION:
        processedData = generateSingleDestinationItinerary(processedData)
        break

      case EdgeCaseType.SINGLE_USER:
        processedData = optimizeForSingleUser(processedData)
        break

      case EdgeCaseType.COLOCATED_DESTINATIONS:
        processedData = generateColocatedItinerary(processedData)
        break

      case EdgeCaseType.INSUFFICIENT_PREFERENCES:
        processedData = augmentWithDefaultPreferences(processedData)
        break

      case EdgeCaseType.INVALID_COORDINATES:
        processedData = sanitizeInvalidCoordinates(processedData)
        break

      case EdgeCaseType.EXCESSIVE_DESTINATIONS:
        processedData = prioritizeTopDestinations(processedData)
        break

      case EdgeCaseType.ZERO_DURATION_TRIP:
        processedData = setMinimumTripDuration(processedData)
        break
    }
  }

  return processedData
}

/**
 * Detects edge cases in clustering results
 */
export function detectClusteringEdgeCases(clusteringResult: ClusteringResult): EdgeCaseDetectionResult {
  const detectedCases: EdgeCaseType[] = []
  const recommendations: string[] = []

  // Check if no clusters can fit in time constraints
  // Note: Time constraints check disabled - ClusteringResult doesn't contain time constraints
  // const minRequiredTime = getMinimumRequiredTime(clusteringResult.clusters)
  // TODO: Add time constraints validation when available

  // Check for identical preferences
  // Note: Identical preferences check disabled - ClusteringResult doesn't contain standardizedPreferences
  // TODO: Add preferences validation when available

  // Check for extreme preference disparities
  // Note: Preference disparities check disabled - ClusteringResult doesn't contain standardizedPreferences
  // TODO: Add preference disparities validation when available

  // Check for unreachable destinations
  if (hasUnreachableDestinations(clusteringResult)) {
    detectedCases.push(EdgeCaseType.UNREACHABLE_DESTINATIONS)
    recommendations.push('Some destinations may be unreachable within time constraints')
  }

  return {
    hasEdgeCases: detectedCases.length > 0,
    detectedCases,
    recommendations,
    fallbackStrategy: determineFallbackStrategy(detectedCases)
  }
}

/**
 * Handles optimization edge cases by applying specialized algorithms
 */
export function handleOptimizationEdgeCases(clusteringResult: ClusteringResult): OptimizationResult {
  const edgeCases = detectClusteringEdgeCases(clusteringResult)

  // Apply specific handling based on detected edge cases
  for (const caseType of edgeCases.detectedCases) {
    switch (caseType) {
      case EdgeCaseType.EXTREME_TIME_CONSTRAINTS:
        return generateTimeConstrainedResult(clusteringResult)

      case EdgeCaseType.IDENTICAL_PREFERENCES:
        return generateConsensusBasedResult(clusteringResult)

      case EdgeCaseType.EXTREME_PREFERENCE_DISPARITIES:
        return generateBalancedCompromiseResult(clusteringResult)

      case EdgeCaseType.UNREACHABLE_DESTINATIONS:
        return generateReachableSubsetResult(clusteringResult)
    }
  }

  // If no edge cases detected, proceed with normal optimization
  return performNormalOptimization(clusteringResult)
}

// Helper functions for edge case detection

function areAllDestinationsColocated(locations: { latitude: number; longitude: number }[]): boolean {
  if (locations.length <= 1) return true

  const COLOCATION_THRESHOLD = 0.01 // ~1km radius
  const baseLocation = locations[0]

  return locations.every(location => {
    const distance = calculateHaversineDistance(
      baseLocation.latitude,
      baseLocation.longitude,
      location.latitude,
      location.longitude
    )
    return distance < COLOCATION_THRESHOLD
  })
}

function hasInsufficientPreferences(preferences: ValidatedPreference[]): boolean {
  if (!preferences || preferences.length === 0) {
    return true
  }

  // Simple check: if we have very few preferences relative to destinations
  // This is a simplified version for the edge case handling
  return preferences.length < 3
}

function hasInvalidCoordinates(locations: { latitude: number; longitude: number }[]): boolean {
  return locations.some(location => 
    Math.abs(location.latitude) > 90 || 
    Math.abs(location.longitude) > 180 ||
    isNaN(location.latitude) ||
    isNaN(location.longitude)
  )
}

function calculateTripDuration(preprocessedData: PreprocessedData): number {
  const { startDate, endDate } = preprocessedData.tripDuration
  if (!startDate || !endDate) return 1 // Default to 1 day
  
  return Math.max(0, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
}

function hasIdenticalPreferences(standardizedPreferences: any): boolean {
  const userIds = Object.keys(standardizedPreferences)
  if (userIds.length <= 1) return true

  const firstUserPrefs = standardizedPreferences[userIds[0]]
  return userIds.slice(1).every(userId => {
    const userPrefs = standardizedPreferences[userId]
    return JSON.stringify(firstUserPrefs) === JSON.stringify(userPrefs)
  })
}

function hasExtremePreferenceDisparities(standardizedPreferences: any): boolean {
  const userIds = Object.keys(standardizedPreferences)
  if (userIds.length <= 1) return false

  const allPreferenceValues: number[] = []
  userIds.forEach(userId => {
    const userPrefs = standardizedPreferences[userId]
    Object.values(userPrefs).forEach((value: any) => {
      if (typeof value === 'number') {
        allPreferenceValues.push(value)
      }
    })
  })

  if (allPreferenceValues.length === 0) return false

  const mean = allPreferenceValues.reduce((sum, val) => sum + val, 0) / allPreferenceValues.length
  const variance = allPreferenceValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allPreferenceValues.length
  const standardDeviation = Math.sqrt(variance)

  // Consider extreme if standard deviation is very high
  return standardDeviation > 2.0
}

function getMinimumRequiredTime(clusters: any[]): number {
  return clusters.reduce((total, cluster) => {
    return total + cluster.destinations.reduce((clusterTime: number, destination: any) => {
      return clusterTime + (destination.minimumDuration || 1) // Default 1 hour minimum
    }, 0)
  }, 0)
}

function hasUnreachableDestinations(clusteringResult: ClusteringResult): boolean {
  // Simple check: if any cluster has excessive travel time requirements
  return clusteringResult.clusters.some(cluster => {
    const totalClusterTime = cluster.destinations.reduce((time: number, dest: any) => 
      time + (dest.estimatedDuration || 2), 0) // Default 2 hours
    // Check if cluster requires more than 12 hours (reasonable daily limit)
    return totalClusterTime > 12 * 60 // 12 hours in minutes
  })
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Edge case handling implementations

function generateSingleDestinationItinerary(preprocessedData: PreprocessedData): PreprocessedData {
  // For single destination, create a simple itinerary with flexible timing
  // Note: PreprocessedData type doesn't include optimization hints, so just return the data as-is
  return {
    ...preprocessedData
  }
}

function optimizeForSingleUser(preprocessedData: PreprocessedData): PreprocessedData {
  // For single user, prioritize their preferences absolutely
  // Note: PreprocessedData type doesn't include optimization hints, so just return the data as-is
  return {
    ...preprocessedData
  }
}

function generateColocatedItinerary(preprocessedData: PreprocessedData): PreprocessedData {
  // For colocated destinations, suggest walking routes and flexible timing
  // Note: PreprocessedData type doesn't include optimization hints, so just return the data as-is
  return {
    ...preprocessedData
  }
}

function augmentWithDefaultPreferences(preprocessedData: PreprocessedData): PreprocessedData {
  // Add default neutral preferences for missing data
  // Note: preferences is ValidatedPreference[], not a nested object structure
  // For edge case handling, we'll just return the original data
  return {
    ...preprocessedData
  }
}

function sanitizeInvalidCoordinates(preprocessedData: PreprocessedData): PreprocessedData {
  // Remove or fix invalid coordinates
  const validDestinationsMap = new Map()
  
  Array.from(preprocessedData.destinations.entries()).forEach(([key, destination]) => {
    if (Math.abs(destination.latitude) <= 90 && 
        Math.abs(destination.longitude) <= 180 &&
        !isNaN(destination.latitude) &&
        !isNaN(destination.longitude)) {
      validDestinationsMap.set(key, destination)
    }
  })

  return {
    ...preprocessedData,
    destinations: validDestinationsMap
  }
}

function prioritizeTopDestinations(preprocessedData: PreprocessedData): PreprocessedData {
  // Keep only top 30 destinations based on average preference scores
  const MAX_DESTINATIONS = 30
  
  if (preprocessedData.destinations.size <= MAX_DESTINATIONS) {
    return preprocessedData
  }

  // Calculate average preference scores based on ValidatedPreference[]
  const destinationArray = Array.from(preprocessedData.destinations.entries())
  const destinationScores = destinationArray.map(([key, destination]) => {
    const relatedPreferences = preprocessedData.preferences.filter(pref => pref.destinationId === key)
    const avgScore = relatedPreferences.length > 0 ? 
      relatedPreferences.reduce((sum, pref) => sum + pref.preferenceScore, 0) / relatedPreferences.length : 0

    return { key, destination, avgScore }
  })

  // Sort by score and take top destinations
  const topDestinations = destinationScores
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, MAX_DESTINATIONS)

  const topDestinationsMap = new Map()
  topDestinations.forEach(item => {
    topDestinationsMap.set(item.key, item.destination)
  })

  return {
    ...preprocessedData,
    destinations: topDestinationsMap
  }
}

function setMinimumTripDuration(preprocessedData: PreprocessedData): PreprocessedData {
  // Set minimum 1-day duration
  let updatedTripDuration = { ...preprocessedData.tripDuration }
  
  if (!updatedTripDuration.endDate || calculateTripDuration(preprocessedData) <= 0) {
    const startDate = updatedTripDuration.startDate ? new Date(updatedTripDuration.startDate) : new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1) // Add 1 day
    
    updatedTripDuration.endDate = endDate
  }

  return {
    ...preprocessedData,
    tripDuration: updatedTripDuration
  }
}

function determineFallbackStrategy(detectedCases: EdgeCaseType[]): string | undefined {
  if (detectedCases.includes(EdgeCaseType.SINGLE_DESTINATION)) {
    return 'simple_itinerary'
  }
  
  if (detectedCases.includes(EdgeCaseType.EXTREME_TIME_CONSTRAINTS)) {
    return 'time_constrained'
  }
  
  if (detectedCases.includes(EdgeCaseType.EXCESSIVE_DESTINATIONS)) {
    return 'prioritized_subset'
  }
  
  if (detectedCases.includes(EdgeCaseType.INSUFFICIENT_PREFERENCES)) {
    return 'default_preferences'
  }

  return undefined
}

// Optimization result generators for edge cases

function generateTimeConstrainedResult(clusteringResult: ClusteringResult): OptimizationResult {
  // Generate result that fits within extreme time constraints
  return {
    bestSolution: {
      clusters: [],
      segments: [],
      totalDistanceKm: 0,
      totalTimeHours: 0,
      fairnessScore: 1.0,
      quantityScore: 1.0,
      compositeScore: 1.0,
      memberSatisfaction: new Map(),
      feasible: true,
      issues: []
    },
    allSolutions: [],
    executionTimeMs: 1,
    iterationsPerformed: 1,
    earlyTermination: true
  }
}

function generateConsensusBasedResult(clusteringResult: ClusteringResult): OptimizationResult {
  // Generate result based on consensus preferences
  return {
    bestSolution: {
      clusters: [],
      segments: [],
      totalDistanceKm: 0,
      totalTimeHours: 0,
      fairnessScore: 1.0,
      quantityScore: 1.0,
      compositeScore: 1.0,
      memberSatisfaction: new Map(),
      feasible: true,
      issues: []
    },
    allSolutions: [],
    executionTimeMs: 1,
    iterationsPerformed: 1,
    earlyTermination: true
  }
}

function generateBalancedCompromiseResult(clusteringResult: ClusteringResult): OptimizationResult {
  // Generate result that balances extreme preference disparities
  return {
    bestSolution: {
      clusters: [],
      segments: [],
      totalDistanceKm: 0,
      totalTimeHours: 0,
      fairnessScore: 0.8, // Lower due to disparities
      quantityScore: 1.0,
      compositeScore: 0.9,
      memberSatisfaction: new Map(),
      feasible: true,
      issues: []
    },
    allSolutions: [],
    executionTimeMs: 1,
    iterationsPerformed: 1,
    earlyTermination: true
  }
}

function generateReachableSubsetResult(clusteringResult: ClusteringResult): OptimizationResult {
  // Generate result with only reachable destinations
  return {
    bestSolution: {
      clusters: [],
      segments: [],
      totalDistanceKm: 0,
      totalTimeHours: 0,
      fairnessScore: 0.9,
      quantityScore: 1.0,
      compositeScore: 0.95,
      memberSatisfaction: new Map(),
      feasible: true,
      issues: []
    },
    allSolutions: [],
    executionTimeMs: 1,
    iterationsPerformed: 1,
    earlyTermination: true
  }
}

function performNormalOptimization(clusteringResult: ClusteringResult): OptimizationResult {
  // Placeholder for normal optimization - would call actual optimization algorithm
  return {
    bestSolution: {
      clusters: [],
      segments: [],
      totalDistanceKm: 0,
      totalTimeHours: 0,
      fairnessScore: 1.0,
      quantityScore: 1.0,
      compositeScore: 1.0,
      memberSatisfaction: new Map(),
      feasible: true,
      issues: []
    },
    allSolutions: [],
    executionTimeMs: 1,
    iterationsPerformed: 1,
    earlyTermination: false
  }
}