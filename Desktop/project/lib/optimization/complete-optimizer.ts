// Complete optimization pipeline integration

import type { PreprocessedData } from './types'
import type { 
  OptimizationResult,
  OptimizationConfig,
  RouteSolution
} from './algorithm-types'
import type { DetailedItinerary, RouteGenerationConfig } from './detailed-route-types'
import { normalizeAndClusterData } from './normalization-clustering'
import { optimizeRoute } from './route-optimizer'
import { analyzeFairnessDistribution } from './fairness-calculator'
import { getTransportStats } from './transport-calculator'
import { generateDetailedItinerary } from './detailed-route-generator'
import { formatItineraryAsText } from './route-visualizer'

// Main optimization result with all details
export interface CompleteOptimizationResult {
  success: boolean
  route: RouteSolution | null
  optimization: OptimizationResult | null
  detailedItinerary: DetailedItinerary | null
  summary: {
    totalDestinations: number
    selectedDestinations: number
    totalDays: number
    totalDistanceKm: number
    fairnessScore: number
    feasible: boolean
  }
  fairnessAnalysis: {
    isBalanced: boolean
    disparityLevel: 'low' | 'medium' | 'high'
    recommendations: string[]
  }
  transportAnalysis: {
    walkingSegments: number
    drivingSegments: number
    flyingSegments: number
    modeChanges: number
  }
  warnings: string[]
  errors: string[]
}

/**
 * Complete optimization pipeline
 * Normalizes preferences, clusters destinations, optimizes route, and generates detailed itinerary
 */
export async function performCompleteOptimization(
  preprocessedData: PreprocessedData,
  optimizationConfig?: Partial<OptimizationConfig>,
  routeGenerationConfig?: Partial<RouteGenerationConfig>
): Promise<CompleteOptimizationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    // Step 1: Normalize and cluster
    console.log('Starting complete optimization pipeline...')
    const normalizedData = await normalizeAndClusterData(preprocessedData)
    
    if (!normalizedData.validation.isValid) {
      errors.push(...normalizedData.validation.issues)
      return createErrorResult(errors, warnings)
    }
    
    warnings.push(...normalizedData.validation.warnings)
    
    // Step 2: Optimize route
    console.log('Running route optimization...')
    const optimizationResult = optimizeRoute(
      normalizedData,
      preprocessedData.departureLocation,
      preprocessedData.returnLocation,
      optimizationConfig
    )
    
    // Step 3: Analyze results
    const bestRoute = optimizationResult.bestSolution
    const fairnessAnalysis = analyzeFairnessDistribution({
      giniCoefficient: 1 - bestRoute.fairnessScore,
      fairnessScore: bestRoute.fairnessScore,
      userSatisfactions: Array.from(bestRoute.memberSatisfaction.entries()).map(
        ([userKey, score]) => ({
          userId: null,
          sessionId: null,
          userKey,
          userName: userKey,
          satisfactionScore: score,
          selectedDestinations: bestRoute.clusters.length,
          totalDestinations: normalizedData.clustering.clusters.length
        })
      ),
      lowestSatisfaction: null,
      highestSatisfaction: null
    })
    
    const transportAnalysis = getTransportStats(bestRoute.segments)
    
    // Step 4: Create summary
    const summary = {
      totalDestinations: normalizedData.clustering.clusters.length,
      selectedDestinations: bestRoute.clusters.length,
      totalDays: Math.ceil(bestRoute.totalTimeHours / 9), // 9 hours per day
      totalDistanceKm: bestRoute.totalDistanceKm,
      fairnessScore: bestRoute.fairnessScore,
      feasible: bestRoute.feasible
    }
    
    // Add any route-specific issues
    warnings.push(...bestRoute.issues)
    
    console.log(`Optimization complete: ${summary.selectedDestinations}/${summary.totalDestinations} destinations selected`)
    console.log(`Route: ${summary.totalDays} days, ${summary.totalDistanceKm.toFixed(0)}km, fairness=${summary.fairnessScore.toFixed(2)}`)
    
    // Step 5: Generate detailed itinerary
    console.log('Generating detailed itinerary...')
    const detailedItinerary = await generateDetailedItinerary(
      bestRoute,
      preprocessedData,
      normalizedData.normalization.standardizedPreferences,
      routeGenerationConfig
    )
    
    // Add itinerary warnings
    warnings.push(...detailedItinerary.validation.warnings.map(w => w.message))
    
    // Update summary with detailed information
    if (detailedItinerary.summary.totalDays !== summary.totalDays) {
      summary.totalDays = detailedItinerary.summary.totalDays
    }
    
    return {
      success: true,
      route: bestRoute,
      optimization: optimizationResult,
      detailedItinerary,
      summary,
      fairnessAnalysis,
      transportAnalysis,
      warnings,
      errors
    }
  } catch (error) {
    console.error('Error in complete optimization:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown optimization error')
    return createErrorResult(errors, warnings)
  }
}

/**
 * Create error result
 */
function createErrorResult(
  errors: string[],
  warnings: string[]
): CompleteOptimizationResult {
  return {
    success: false,
    route: null,
    optimization: null,
    detailedItinerary: null,
    summary: {
      totalDestinations: 0,
      selectedDestinations: 0,
      totalDays: 0,
      totalDistanceKm: 0,
      fairnessScore: 0,
      feasible: false
    },
    fairnessAnalysis: {
      isBalanced: false,
      disparityLevel: 'high',
      recommendations: []
    },
    transportAnalysis: {
      walkingSegments: 0,
      drivingSegments: 0,
      flyingSegments: 0,
      modeChanges: 0
    },
    warnings,
    errors
  }
}

/**
 * Generate human-readable itinerary from optimization result
 */
export function generateItinerary(result: CompleteOptimizationResult): string {
  if (!result.success || !result.route || !result.detailedItinerary) {
    return 'Optimization failed. Please check errors and warnings.'
  }
  
  // Use the detailed itinerary formatter
  return formatItineraryAsText(result.detailedItinerary)
}

/**
 * Export optimization result to shareable format
 */
export function exportOptimizationResult(
  result: CompleteOptimizationResult
): {
  success: boolean
  data: any
  format: 'json'
} {
  if (!result.success || !result.route || !result.detailedItinerary) {
    return {
      success: false,
      data: null,
      format: 'json'
    }
  }
  
  const exportData = {
    summary: result.summary,
    itinerary: {
      startDate: result.detailedItinerary.startDate.toISOString(),
      endDate: result.detailedItinerary.endDate.toISOString(),
      destinations: result.detailedItinerary.destinationVisits.map(visit => ({
        id: visit.destinationId,
        name: visit.destinationName,
        arrivalTime: visit.arrivalTime.toISOString(),
        departureTime: visit.departureTime.toISOString(),
        allocatedHours: visit.allocatedHours,
        location: {
          latitude: visit.location.latitude,
          longitude: visit.location.longitude
        },
        wishfulUsers: visit.wishfulUsers.map(wu => ({
          name: wu.member.display_name,
          rating: wu.originalRating,
          color: wu.assignedColor
        })),
        clusterId: visit.clusterId,
        visitOrder: visit.visitOrder
      })),
      transportSegments: result.detailedItinerary.transportSegments.map(segment => ({
        from: segment.fromName,
        to: segment.toName,
        mode: segment.transportMode,
        icon: segment.transportIcon,
        distanceKm: segment.distanceKm,
        estimatedHours: segment.estimatedTimeHours,
        departureTime: segment.departureTime.toISOString(),
        arrivalTime: segment.arrivalTime.toISOString()
      }))
    },
    fairness: {
      score: result.fairnessAnalysis.isBalanced,
      level: result.fairnessAnalysis.disparityLevel,
      memberSatisfaction: Array.from(result.route.memberSatisfaction.entries()).map(
        ([member, score]) => ({ member, score })
      )
    },
    transport: result.transportAnalysis,
    userSatisfaction: result.detailedItinerary.summary.userSatisfactionSummary.map(us => ({
      userName: us.member.display_name,
      visitedCount: us.visitedWishlistCount,
      totalCount: us.totalWishlistCount,
      percentage: us.satisfactionPercentage
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      optimizationTimeMs: result.optimization?.executionTimeMs || 0,
      algorithm: 'Multi-objective optimization with fairness weighting'
    }
  }
  
  return {
    success: true,
    data: exportData,
    format: 'json'
  }
}