// Main entry point for optimization data layer

export * from './types'
export * from './data-fetcher'
export * from './data-validator'
export * from './data-preprocessor'
export * from './normalization-types'
export * from './z-score-normalization'
export * from './geographical-clustering'
export * from './time-constraints'
export { DistanceCache } from './distance-cache'
export { normalizeAndClusterData } from './normalization-clustering'
export * from './algorithm-types'
export * from './fairness-calculator'
export { 
  getTransportStats, 
  estimateTravelTime as estimateTransportTravelTime 
} from './transport-calculator'
export * from './tsp-optimizer'
export * from './route-optimizer'
export * from './complete-optimizer'
export type { 
  DetailedItinerary, 
  RouteGenerationConfig, 
  DetailedTransportSegment, 
  ItineraryValidation,
  ValidationError as DetailedValidationError 
} from './detailed-route-types'
export * from './cluster-internal-optimizer'
export * from './time-allocator'
export * from './transport-mode-selector'
export * from './user-association'
export * from './detailed-route-generator'
export * from './route-visualizer'
export * from './daily-schedule-types'
export * from './accommodation-suggester'
export * from './enhanced-time-allocator'
// export * from './enhanced-day-splitter' // Temporarily disabled
export * from './complete-optimizer-v2'

import { 
  fetchOptimizationData, 
  getCurrentUserContext,
  checkGroupMembership 
} from './data-fetcher'
import { preprocessOptimizationData } from './data-preprocessor'
import type { PreprocessedData, ValidationResult } from './types'

/**
 * Main function to fetch and preprocess optimization data
 * This is the primary interface for the optimization algorithm
 */
export async function getOptimizationData(
  groupId: string
): Promise<{
  data: PreprocessedData | null
  validation: ValidationResult
  error: Error | null
}> {
  try {
    // Get current user context
    const currentUser = await getCurrentUserContext()
    
    // Check if user is member of the group
    const isMember = await checkGroupMembership(groupId, currentUser)
    if (!isMember) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [{
            code: 'UNAUTHORIZED',
            message: 'You are not a member of this trip group'
          }],
          warnings: []
        },
        error: new Error('Unauthorized access')
      }
    }
    
    // Fetch all optimization data
    const { data: rawData, error: fetchError } = await fetchOptimizationData(
      groupId,
      currentUser
    )
    
    if (fetchError || !rawData) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [{
            code: 'FETCH_ERROR',
            message: fetchError?.message || 'Failed to fetch optimization data'
          }],
          warnings: []
        },
        error: fetchError
      }
    }
    
    // Preprocess and validate the data
    const { data: preprocessedData, validation } = await preprocessOptimizationData(rawData)
    
    return {
      data: preprocessedData,
      validation,
      error: null
    }
  } catch (error) {
    console.error('Error in getOptimizationData:', error)
    return {
      data: null,
      validation: {
        isValid: false,
        errors: [{
          code: 'SYSTEM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown system error'
        }],
        warnings: []
      },
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

/**
 * Complete optimization pipeline with normalization and clustering
 */
export async function optimizeTripRoute(groupId: string) {
  const { data, validation, error } = await getOptimizationData(groupId)
  
  if (!data || !validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings
    }
  }
  
  // Apply Z-score normalization and geographical clustering
  const { normalizeAndClusterData } = await import('./normalization-clustering')
  const optimizationResult = await normalizeAndClusterData(data)
  
  if (!optimizationResult.validation.isValid) {
    return {
      success: false,
      errors: optimizationResult.validation.issues,
      warnings: optimizationResult.validation.warnings
    }
  }
  
  console.log('Optimization complete:', {
    groupId: data.groupId,
    clusters: optimizationResult.summary.totalClusters,
    days: optimizationResult.summary.totalRequiredDays,
    feasible: optimizationResult.summary.feasibleWithinConstraints
  })
  
  return {
    success: true,
    data: {
      normalization: {
        userCount: optimizationResult.normalization.userStatistics.size,
        preferenceCount: optimizationResult.normalization.standardizedPreferences.length
      },
      clustering: {
        clusters: optimizationResult.clustering.clusters.map(cluster => ({
          id: cluster.id,
          destinationCount: cluster.destinations.length,
          centerLocation: cluster.centerLocation,
          desirability: cluster.totalDesirability,
          stayTime: cluster.averageStayTime
        })),
        totalClusters: optimizationResult.summary.totalClusters
      },
      timeConstraints: {
        mode: optimizationResult.timeConstraints.mode,
        startDate: optimizationResult.timeConstraints.startDate,
        endDate: optimizationResult.timeConstraints.endDate,
        requiredDays: optimizationResult.summary.totalRequiredDays
      },
      summary: optimizationResult.summary,
      warnings: optimizationResult.validation.warnings
    }
  }
}