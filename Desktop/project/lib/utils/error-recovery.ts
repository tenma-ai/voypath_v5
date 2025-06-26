/**
 * Error Recovery and Fallback Mechanisms for Voypath Optimization
 * 
 * Comprehensive error recovery system that provides graceful degradation
 * and fallback strategies when optimization fails or encounters issues.
 */

import type { OptimizationError, OptimizationResponse } from '../types/api-errors'
import { OptimizationErrorType, classifyError } from '../types/api-errors'
import type { PreprocessedData } from '../optimization/types'

// Import optimization modules
import { getOptimizationData } from '../optimization'
import { performCompleteOptimizationV2 } from '../optimization/complete-optimizer-v2'
import type { CompleteOptimizationConfig } from '../optimization/complete-optimizer-v2'

export interface FallbackStrategy {
  name: string
  description: string
  execute: (groupId: string, currentUser: any, originalError?: OptimizationError) => Promise<OptimizationResponse>
  applicableErrors: OptimizationErrorType[]
  priority: number
}

export interface RecoveryContext {
  groupId: string
  currentUser: any
  originalError?: OptimizationError
  attemptNumber: number
  startTime: number
}

/**
 * Multi-level fallback strategy manager
 */
export class OptimizationFallbackManager {
  private strategies: FallbackStrategy[] = []
  
  constructor() {
    this.initializeStrategies()
  }
  
  private initializeStrategies(): void {
    this.strategies = [
      // Strategy 1: Relaxed optimization with reduced features
      {
        name: 'relaxed_optimization',
        description: 'Simplified optimization with reduced complexity',
        execute: this.performRelaxedOptimization.bind(this),
        applicableErrors: [
          OptimizationErrorType.OPTIMIZATION_TIMEOUT,
          OptimizationErrorType.NO_FEASIBLE_SOLUTION,
          OptimizationErrorType.CLUSTERING_FAILED
        ],
        priority: 1
      },
      
      // Strategy 2: Greedy algorithm (fast but suboptimal)
      {
        name: 'greedy_optimization',
        description: 'Fast greedy algorithm with basic optimization',
        execute: this.performGreedyOptimization.bind(this),
        applicableErrors: [
          OptimizationErrorType.OPTIMIZATION_TIMEOUT,
          OptimizationErrorType.ROUTE_CALCULATION_FAILED,
          OptimizationErrorType.CLUSTERING_FAILED
        ],
        priority: 2
      },
      
      // Strategy 3: Preference-based ordering
      {
        name: 'preference_ordering',
        description: 'Simple ordering based on preference scores',
        execute: this.performPreferenceBasedOrdering.bind(this),
        applicableErrors: [
          OptimizationErrorType.OPTIMIZATION_TIMEOUT,
          OptimizationErrorType.NO_FEASIBLE_SOLUTION,
          OptimizationErrorType.ROUTE_CALCULATION_FAILED
        ],
        priority: 3
      },
      
      // Strategy 4: Distance-based ordering
      {
        name: 'distance_ordering',
        description: 'Geographic ordering by nearest neighbor',
        execute: this.performDistanceBasedOrdering.bind(this),
        applicableErrors: [
          OptimizationErrorType.INSUFFICIENT_DATA,
          OptimizationErrorType.MISSING_PREFERENCES,
          OptimizationErrorType.OPTIMIZATION_TIMEOUT
        ],
        priority: 4
      },
      
      // Strategy 5: Input order with timing
      {
        name: 'input_order',
        description: 'Return destinations in input order with estimated timing',
        execute: this.returnInputOrderWithTiming.bind(this),
        applicableErrors: [
          OptimizationErrorType.INSUFFICIENT_DATA,
          OptimizationErrorType.INVALID_COORDINATES,
          OptimizationErrorType.CLUSTERING_FAILED
        ],
        priority: 5
      }
    ]
  }
  
  /**
   * Execute fallback strategies in order of priority
   */
  async executeWithFallbacks(context: RecoveryContext): Promise<OptimizationResponse> {
    const applicableStrategies = this.strategies
      .filter(strategy => 
        !context.originalError || 
        strategy.applicableErrors.includes(context.originalError.type)
      )
      .sort((a, b) => a.priority - b.priority)
    
    if (applicableStrategies.length === 0) {
      return this.createFinalErrorResponse(context)
    }
    
    for (let index = 0; index < applicableStrategies.length; index++) {
      const strategy = applicableStrategies[index];
      try {
        console.log(`Attempting fallback strategy ${index + 1}/${applicableStrategies.length}: ${strategy.name}`)
        
        const result = await strategy.execute(
          context.groupId,
          context.currentUser,
          context.originalError
        )
        
        if (result.status === 'success' || result.status === 'partial_success') {
          console.log(`Fallback strategy '${strategy.name}' succeeded`)
          
          // Add fallback metadata
          result.metadata = {
            ...result.metadata,
            generatedBy: {
              fallbackStrategy: strategy.name,
              fallbackDescription: strategy.description,
              originalError: context.originalError
            }
          }
          
          return result
        }
        
      } catch (error) {
        console.warn(`Fallback strategy '${strategy.name}' failed:`, error)
        
        // Continue to next strategy
        if (index === applicableStrategies.length - 1) {
          // This was the last strategy
          return this.createFinalErrorResponse(context, error)
        }
      }
    }
    
    return this.createFinalErrorResponse(context)
  }
  
  /**
   * Strategy 1: Relaxed optimization with reduced complexity
   */
  private async performRelaxedOptimization(
    groupId: string,
    currentUser: any,
    originalError?: OptimizationError
  ): Promise<OptimizationResponse> {
    
    const { data: preprocessedData } = await getOptimizationData(groupId)
    if (!preprocessedData) {
      throw new Error('Failed to fetch data for relaxed optimization')
    }
    
    // Use simplified configuration
    const relaxedConfig: CompleteOptimizationConfig = {
      enableMultiDayScheduling: false, // Disable complex scheduling
      accommodationQuality: 'standard',
      optimization: {
        maxIterations: 50, // Reduced iterations
        fairnessWeight: 0, // Disable fairness calculations
        quantityWeight: 1, // Focus only on quantity
        earlyTerminationThreshold: 0.5 // Lower threshold for faster completion
      }
    }
    
    const result = await performCompleteOptimizationV2(preprocessedData, relaxedConfig)
    
    if (result.success) {
      return {
        status: 'partial_success',
        data: result,
        warnings: [
          'Optimization completed with simplified settings due to complexity',
          'Multi-day scheduling was disabled for faster processing',
          'Some advanced features were simplified'
        ]
      }
    }
    
    throw new Error('Relaxed optimization failed')
  }
  
  /**
   * Strategy 2: Fast greedy algorithm
   */
  private async performGreedyOptimization(
    groupId: string,
    currentUser: any,
    originalError?: OptimizationError
  ): Promise<OptimizationResponse> {
    
    const { data: preprocessedData } = await getOptimizationData(groupId)
    if (!preprocessedData) {
      throw new Error('Failed to fetch data for greedy optimization')
    }
    
    const greedyResult = this.executeGreedyAlgorithm(preprocessedData)
    
    return {
      status: 'partial_success',
      data: greedyResult,
      warnings: [
        'Used fast greedy algorithm due to optimization constraints',
        'Result may not be globally optimal but should be reasonable',
        'Consider using fewer destinations for better optimization'
      ],
      metadata: {
        generatedBy: {
          algorithm: 'greedy',
          fallbackReason: originalError?.type || 'unknown'
        }
      }
    }
  }
  
  /**
   * Strategy 3: Preference-based ordering
   */
  private async performPreferenceBasedOrdering(
    groupId: string,
    currentUser: any,
    originalError?: OptimizationError
  ): Promise<OptimizationResponse> {
    
    const { data: preprocessedData } = await getOptimizationData(groupId)
    if (!preprocessedData) {
      throw new Error('Failed to fetch data for preference-based ordering')
    }
    
    const preferenceResult = this.executePreferenceOrdering(preprocessedData)
    
    return {
      status: 'partial_success',
      data: preferenceResult,
      warnings: [
        'Destinations ordered by preference scores only',
        'Route may not be geographically optimal',
        'Consider adding more preference data for better results'
      ],
      metadata: {
        generatedBy: {
          algorithm: 'preference_based',
          fallbackReason: originalError?.type || 'unknown'
        }
      }
    }
  }
  
  /**
   * Strategy 4: Distance-based ordering (nearest neighbor)
   */
  private async performDistanceBasedOrdering(
    groupId: string,
    currentUser: any,
    originalError?: OptimizationError
  ): Promise<OptimizationResponse> {
    
    const { data: preprocessedData } = await getOptimizationData(groupId)
    if (!preprocessedData) {
      throw new Error('Failed to fetch data for distance-based ordering')
    }
    
    const distanceResult = this.executeNearestNeighbor(preprocessedData)
    
    return {
      status: 'partial_success',
      data: distanceResult,
      warnings: [
        'Route optimized for minimal travel distance only',
        'User preferences were not considered due to insufficient data',
        'Add destination ratings for preference-based optimization'
      ],
      metadata: {
        generatedBy: {
          algorithm: 'nearest_neighbor',
          fallbackReason: originalError?.type || 'unknown'
        }
      }
    }
  }
  
  /**
   * Strategy 5: Input order with timing estimates
   */
  private async returnInputOrderWithTiming(
    groupId: string,
    currentUser: any,
    originalError?: OptimizationError
  ): Promise<OptimizationResponse> {
    
    const { data: preprocessedData } = await getOptimizationData(groupId)
    if (!preprocessedData) {
      throw new Error('Failed to fetch data for input order processing')
    }
    
    const inputOrderResult = this.processInputOrder(preprocessedData)
    
    return {
      status: 'partial_success',
      data: inputOrderResult,
      warnings: [
        'Destinations shown in original input order',
        'No optimization was applied due to data limitations',
        'This is a basic itinerary - consider providing more information for optimization'
      ],
      metadata: {
        generatedBy: {
          algorithm: 'input_order',
          fallbackReason: originalError?.type || 'unknown'
        }
      }
    }
  }
  
  /**
   * Execute greedy algorithm
   */
  private executeGreedyAlgorithm(preprocessedData: PreprocessedData): any {
    const destinations = Array.from(preprocessedData.destinations.values())
    const preferences = preprocessedData.preferences || []
    
    // Calculate simple preference scores
    const destinationScores = new Map<string, number>()
    
    for (const pref of preferences) {
      const current = destinationScores.get(pref.destinationId) || 0
      destinationScores.set(pref.destinationId, current + (pref.preferenceScore || 3))
    }
    
    // Sort destinations by combined score (preference + distance factor)
    const startLocation = preprocessedData.departureLocation || destinations[0]
    const sortedDestinations = destinations
      .map(dest => ({
        ...dest,
        score: (destinationScores.get(dest.id) || 3) / Math.max(1, this.calculateDistance(startLocation, dest) / 1000)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(10, destinations.length)) // Limit to top 10 for feasibility
    
    return {
      success: true,
      route: sortedDestinations,
      summary: {
        totalDestinations: destinations.length,
        selectedDestinations: sortedDestinations.length,
        totalDistanceKm: this.calculateTotalDistance(sortedDestinations),
        fairnessScore: 0.7, // Estimated score
        isGreedy: true
      }
    }
  }
  
  /**
   * Execute preference-based ordering
   */
  private executePreferenceOrdering(preprocessedData: PreprocessedData): any {
    const destinations = Array.from(preprocessedData.destinations.values())
    const preferences = preprocessedData.preferences || []
    
    // Calculate average preference scores
    const avgScores = new Map<string, { total: number, count: number }>()
    
    for (const pref of preferences) {
      const current = avgScores.get(pref.destinationId) || { total: 0, count: 0 }
      avgScores.set(pref.destinationId, {
        total: current.total + (pref.preferenceScore || 3),
        count: current.count + 1
      })
    }
    
    // Sort by average preference score
    const sortedDestinations = destinations
      .map(dest => {
        const scoreData = avgScores.get(dest.id) || { total: 3, count: 1 }
        return {
          ...dest,
          avgScore: scoreData.total / scoreData.count
        }
      })
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, Math.min(12, destinations.length))
    
    return {
      success: true,
      route: sortedDestinations,
      summary: {
        totalDestinations: destinations.length,
        selectedDestinations: sortedDestinations.length,
        totalDistanceKm: this.calculateTotalDistance(sortedDestinations),
        fairnessScore: 0.8, // Higher since based on preferences
        isPreferenceBased: true
      }
    }
  }
  
  /**
   * Execute nearest neighbor algorithm
   */
  private executeNearestNeighbor(preprocessedData: PreprocessedData): any {
    const destinations = Array.from(preprocessedData.destinations.values())
    const startLocation = preprocessedData.departureLocation || destinations[0]
    
    const route = [startLocation]
    const remaining = destinations.filter(d => d.id !== startLocation.id)
    
    // Nearest neighbor algorithm
    while (remaining.length > 0 && route.length < 15) { // Limit to 15 destinations
      const current = route[route.length - 1]
      let nearestIndex = 0
      let nearestDistance = Infinity
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = this.calculateDistance(current, remaining[i])
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = i
        }
      }
      
      route.push(remaining[nearestIndex])
      remaining.splice(nearestIndex, 1)
    }
    
    return {
      success: true,
      route: route.slice(1), // Remove start location
      summary: {
        totalDestinations: destinations.length,
        selectedDestinations: route.length - 1,
        totalDistanceKm: this.calculateTotalDistance(route),
        fairnessScore: 0.5, // Neutral since no preferences considered
        isDistanceBased: true
      }
    }
  }
  
  /**
   * Process input order with basic timing
   */
  private processInputOrder(preprocessedData: PreprocessedData): any {
    const destinations = Array.from(preprocessedData.destinations.values()).slice(0, 10) // Limit to 10
    
    // Add basic timing estimates
    const destinationsWithTiming = destinations.map((dest, index) => ({
      ...dest,
      estimatedDuration: 4, // 4 hours default
      order: index + 1
    }))
    
    return {
      success: true,
      route: destinationsWithTiming,
      summary: {
        totalDestinations: preprocessedData.destinations.size,
        selectedDestinations: destinations.length,
        totalDistanceKm: this.calculateTotalDistance(destinations),
        fairnessScore: 0.6, // Neutral-positive
        isInputOrder: true
      }
    }
  }
  
  /**
   * Create final error response when all strategies fail
   */
  private createFinalErrorResponse(
    context: RecoveryContext,
    lastError?: unknown
  ): OptimizationResponse {
    
    const finalError = classifyError(
      lastError || context.originalError || new Error('All optimization strategies failed'),
      {
        groupId: context.groupId,
        userId: context.currentUser.id,
        function: 'fallback_final'
      }
    )
    
    return {
      status: 'error',
      error: finalError,
      processingTime: Date.now() - context.startTime,
      data: {
        suggestedActions: [
          'Try reducing the number of destinations',
          'Ensure all destinations have valid coordinates',
          'Add more user preferences for better optimization',
          'Consider splitting into multiple shorter trips',
          'Contact support if the issue persists'
        ],
        fallbackAttempts: context.attemptNumber
      }
    }
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: any, point2: any): number {
    if (!point1?.latitude || !point2?.latitude || !point1?.longitude || !point2?.longitude) {
      return 1000 // Default 1000km for missing coordinates
    }
    
    const R = 6371 // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180
    const dLng = (point2.longitude - point1.longitude) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }
  
  /**
   * Calculate total distance for a route
   */
  private calculateTotalDistance(points: any[]): number {
    if (points.length < 2) return 0
    
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += this.calculateDistance(points[i-1], points[i])
    }
    return total
  }
}

/**
 * Global fallback manager instance
 */
export const fallbackManager = new OptimizationFallbackManager()

/**
 * Execute optimization with comprehensive fallback strategies
 */
export async function executeOptimizationWithFallbacks(
  groupId: string,
  currentUser: any,
  originalError?: OptimizationError
): Promise<OptimizationResponse> {
  
  const context: RecoveryContext = {
    groupId,
    currentUser,
    originalError,
    attemptNumber: 1,
    startTime: Date.now()
  }
  
  return fallbackManager.executeWithFallbacks(context)
}

/**
 * Check if error is recoverable with fallback strategies
 */
export function isRecoverableError(error: OptimizationError): boolean {
  const recoverableTypes = [
    OptimizationErrorType.OPTIMIZATION_TIMEOUT,
    OptimizationErrorType.NO_FEASIBLE_SOLUTION,
    OptimizationErrorType.CLUSTERING_FAILED,
    OptimizationErrorType.ROUTE_CALCULATION_FAILED,
    OptimizationErrorType.INSUFFICIENT_DATA,
    OptimizationErrorType.MISSING_PREFERENCES
  ]
  
  return recoverableTypes.includes(error.type)
}

/**
 * Get recommended fallback strategy for specific error
 */
export function getRecommendedFallbackStrategy(errorType: OptimizationErrorType): string | null {
  const strategyMap: Record<OptimizationErrorType, string> = {
    [OptimizationErrorType.OPTIMIZATION_TIMEOUT]: 'relaxed_optimization',
    [OptimizationErrorType.NO_FEASIBLE_SOLUTION]: 'relaxed_optimization',
    [OptimizationErrorType.CLUSTERING_FAILED]: 'greedy_optimization',
    [OptimizationErrorType.ROUTE_CALCULATION_FAILED]: 'preference_ordering',
    [OptimizationErrorType.INSUFFICIENT_DATA]: 'distance_ordering',
    [OptimizationErrorType.MISSING_PREFERENCES]: 'distance_ordering',
    [OptimizationErrorType.INVALID_COORDINATES]: 'input_order'
  } as any
  
  return strategyMap[errorType] || null
}