// Enhanced complete optimization pipeline with multi-day scheduling

import type { PreprocessedData } from './types'
import type { 
  OptimizationResult,
  OptimizationConfig,
  RouteSolution
} from './algorithm-types'
import type { DetailedItinerary, RouteGenerationConfig } from './detailed-route-types'
import type { MultiDayItinerary } from './daily-schedule-types'
// import type { EnhancedDailyConfig } from './enhanced-day-splitter'
import type { DailyScheduleConfig } from './daily-schedule-types'

// Temporary interface until enhanced-day-splitter is fixed
interface EnhancedDailyConfig extends DailyScheduleConfig {
  accommodationQuality?: 'budget' | 'standard' | 'premium'
}

import { normalizeAndClusterData } from './normalization-clustering'
import { optimizeRoute } from './route-optimizer'
import { analyzeFairnessDistribution } from './fairness-calculator'
import { getTransportStats } from './transport-calculator'
import { generateDetailedItinerary } from './detailed-route-generator'
// import { splitIntoDaysEnhanced } from './enhanced-day-splitter' // Temporarily disabled due to interface mismatches
import { formatItineraryAsText } from './route-visualizer'
import { calculateTotalAccommodationCost } from './accommodation-suggester'

// Enhanced optimization result with multi-day scheduling
export interface EnhancedOptimizationResult {
  success: boolean
  route: RouteSolution | null
  optimization: OptimizationResult | null
  linearItinerary: DetailedItinerary | null
  multiDayItinerary: MultiDayItinerary | null
  summary: {
    totalDestinations: number
    selectedDestinations: number
    totalDays: number
    totalDistanceKm: number
    fairnessScore: number
    feasible: boolean
    estimatedAccommodationCost: number
    averageDestinationsPerDay: number
    totalActiveHours: number
    totalTravelHours: number
  }
  fairnessAnalysis: {
    isBalanced: boolean
    disparityLevel: 'low' | 'medium' | 'high'
    recommendations: string[]
  }
  transportAnalysis: {
    walkingSegments: number
    walkingDistanceKm: number
    drivingSegments: number
    drivingDistanceKm: number
    flyingSegments: number
    flyingDistanceKm: number
    modeChanges: number
  }
  scheduleAnalysis: {
    paceDistribution: {
      relaxed: number
      moderate: number
      packed: number
    }
    hasRestDayRecommendation: boolean
    restDayMessage?: string
    accommodationQuality: 'budget' | 'standard' | 'premium'
    mealBreaksPerDay: number
  }
  warnings: string[]
  errors: string[]
}

// Extended configuration for complete optimization
export interface CompleteOptimizationConfig {
  optimization?: Partial<OptimizationConfig>
  routeGeneration?: Partial<RouteGenerationConfig>
  dailySchedule?: Partial<EnhancedDailyConfig>
  enableMultiDayScheduling: boolean
  accommodationQuality?: 'budget' | 'standard' | 'premium'
}

/**
 * Enhanced complete optimization pipeline with multi-day scheduling
 */
export async function performCompleteOptimizationV2(
  preprocessedData: PreprocessedData,
  config: CompleteOptimizationConfig = { enableMultiDayScheduling: true }
): Promise<EnhancedOptimizationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    // Step 1: Normalize and cluster
    console.log('Starting enhanced optimization pipeline...')
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
      config.optimization
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
    
    // Step 4: Generate detailed linear itinerary
    console.log('Generating detailed itinerary...')
    const linearItinerary = await generateDetailedItinerary(
      bestRoute,
      preprocessedData,
      normalizedData.normalization.standardizedPreferences,
      config.routeGeneration
    )
    
    // Add itinerary warnings
    warnings.push(...linearItinerary.validation.warnings.map(w => w.message))
    
    // Step 5: Split into multi-day schedule if enabled
    let multiDayItinerary: MultiDayItinerary | null = null
    let scheduleAnalysis = createDefaultScheduleAnalysis()
    
    if (config.enableMultiDayScheduling) {
      console.log('Creating multi-day schedule...')
      
      const dailyConfig: Partial<EnhancedDailyConfig> = {
        ...config.dailySchedule,
        accommodationQuality: config.accommodationQuality || 'standard'
      }
      
      // multiDayItinerary = splitIntoDaysEnhanced(linearItinerary, dailyConfig) // Temporarily disabled
      multiDayItinerary = null as MultiDayItinerary | null // Will be implemented in future version
      
      // Add multi-day warnings
      if (multiDayItinerary?.validation) {
        warnings.push(...multiDayItinerary.validation.overallWarnings || [])
        if (multiDayItinerary.validation.overallErrors) {
          errors.push(...multiDayItinerary.validation.overallErrors)
        }
      }
      
      // Create schedule analysis
      scheduleAnalysis = multiDayItinerary ? createScheduleAnalysis(multiDayItinerary, config.accommodationQuality || 'standard') : createDefaultScheduleAnalysis()
    }
    
    // Step 6: Create comprehensive summary
    const summary = createEnhancedSummary(
      bestRoute,
      linearItinerary,
      multiDayItinerary,
      normalizedData,
      scheduleAnalysis
    )
    
    // Step 7: Enhance transport analysis with detailed data
    const enhancedTransportAnalysis = createEnhancedTransportAnalysis(
      transportAnalysis,
      linearItinerary,
      multiDayItinerary
    )
    
    console.log(`Optimization complete: ${summary.selectedDestinations}/${summary.totalDestinations} destinations selected`)
    console.log(`Schedule: ${summary.totalDays} days, ${summary.totalDistanceKm.toFixed(0)}km, fairness=${summary.fairnessScore.toFixed(2)}`)
    
    if (config.enableMultiDayScheduling && multiDayItinerary) {
      console.log(`Daily breakdown: ${scheduleAnalysis.paceDistribution.relaxed} relaxed, ${scheduleAnalysis.paceDistribution.moderate} moderate, ${scheduleAnalysis.paceDistribution.packed} packed days`)
      console.log(`Estimated accommodation cost: $${summary.estimatedAccommodationCost}`)
    }
    
    return {
      success: true,
      route: bestRoute,
      optimization: optimizationResult,
      linearItinerary,
      multiDayItinerary,
      summary,
      fairnessAnalysis,
      transportAnalysis: enhancedTransportAnalysis,
      scheduleAnalysis,
      warnings,
      errors
    }
  } catch (error) {
    console.error('Error in enhanced optimization:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown optimization error')
    return createErrorResult(errors, warnings)
  }
}

/**
 * Create enhanced summary combining all optimization aspects
 */
function createEnhancedSummary(
  route: RouteSolution,
  linearItinerary: DetailedItinerary,
  multiDayItinerary: MultiDayItinerary | null,
  normalizedData: any,
  scheduleAnalysis: any
): EnhancedOptimizationResult['summary'] {
  const baseData = {
    totalDestinations: normalizedData.clustering.clusters.length,
    selectedDestinations: route.clusters.length,
    totalDistanceKm: route.totalDistanceKm,
    fairnessScore: route.fairnessScore,
    feasible: route.feasible
  }
  
  if (multiDayItinerary) {
    const multiDayStats = multiDayItinerary.statistics
    // Calculate simple accommodation cost estimate
    const accommodationCost = {
      totalCostUSD: multiDayItinerary.accommodations.reduce((sum, acc) => 
        sum + (acc.estimatedCost.standard.min + acc.estimatedCost.standard.max) / 2, 0
      )
    }
    
    return {
      ...baseData,
      totalDays: multiDayItinerary.totalDays,
      estimatedAccommodationCost: accommodationCost.totalCostUSD,
      averageDestinationsPerDay: multiDayStats.averageDestinationsPerDay,
      totalActiveHours: multiDayStats.totalActiveHours,
      totalTravelHours: multiDayStats.totalTravelHours
    }
  } else {
    // Fallback to simple calculation
    const totalHours = route.totalTimeHours
    const estimatedDays = Math.ceil(totalHours / 9)
    
    return {
      ...baseData,
      totalDays: estimatedDays,
      estimatedAccommodationCost: estimatedDays > 1 ? (estimatedDays - 1) * 115 : 0, // Default standard rate
      averageDestinationsPerDay: route.clusters.length / estimatedDays,
      totalActiveHours: totalHours * 0.7, // Estimate 70% active time
      totalTravelHours: totalHours * 0.3  // Estimate 30% travel time
    }
  }
}

/**
 * Create schedule analysis from multi-day itinerary
 */
function createScheduleAnalysis(
  multiDayItinerary: MultiDayItinerary,
  accommodationQuality: 'budget' | 'standard' | 'premium'
): any {
  const days = multiDayItinerary.daySchedules
  const statistics = multiDayItinerary.statistics
  
  // Calculate average meal breaks
  const totalMealBreaks = days.reduce((sum, day) => sum + day.meals.length, 0)
  const avgMealBreaksPerDay = days.length > 0 ? totalMealBreaks / days.length : 0
  
  // Calculate pace distribution from day summaries
  const paceCounts = { relaxed: 0, moderate: 0, packed: 0 }
  days.forEach(day => {
    paceCounts[day.summary.paceRating]++
  })
  
  return {
    paceDistribution: paceCounts,
    hasRestDayRecommendation: false, // Simplified for now
    restDayMessage: null,
    accommodationQuality,
    mealBreaksPerDay: avgMealBreaksPerDay
  }
}

/**
 * Create default schedule analysis when multi-day is disabled
 */
function createDefaultScheduleAnalysis(): any {
  return {
    paceDistribution: {
      relaxed: 0,
      moderate: 0,
      packed: 0
    },
    hasRestDayRecommendation: false,
    accommodationQuality: 'standard',
    mealBreaksPerDay: 1
  }
}

/**
 * Create enhanced transport analysis with multi-day data
 */
function createEnhancedTransportAnalysis(
  baseAnalysis: any,
  linearItinerary: DetailedItinerary,
  multiDayItinerary: MultiDayItinerary | null
): any {
  // Calculate detailed distances from segments
  let walkingKm = 0, drivingKm = 0, flyingKm = 0
  
  for (const segment of linearItinerary.transportSegments) {
    switch (segment.transportMode) {
      case 'walking':
        walkingKm += segment.distanceKm
        break
      case 'driving':
        drivingKm += segment.distanceKm
        break
      case 'flying':
        flyingKm += segment.distanceKm
        break
    }
  }
  
  return {
    ...baseAnalysis,
    walkingDistanceKm: walkingKm,
    drivingDistanceKm: drivingKm,
    flyingDistanceKm: flyingKm
  }
}

/**
 * Create error result
 */
function createErrorResult(
  errors: string[],
  warnings: string[]
): EnhancedOptimizationResult {
  return {
    success: false,
    route: null,
    optimization: null,
    linearItinerary: null,
    multiDayItinerary: null,
    summary: {
      totalDestinations: 0,
      selectedDestinations: 0,
      totalDays: 0,
      totalDistanceKm: 0,
      fairnessScore: 0,
      feasible: false,
      estimatedAccommodationCost: 0,
      averageDestinationsPerDay: 0,
      totalActiveHours: 0,
      totalTravelHours: 0
    },
    fairnessAnalysis: {
      isBalanced: false,
      disparityLevel: 'high',
      recommendations: []
    },
    transportAnalysis: {
      walkingSegments: 0,
      walkingDistanceKm: 0,
      drivingSegments: 0,
      drivingDistanceKm: 0,
      flyingSegments: 0,
      flyingDistanceKm: 0,
      modeChanges: 0
    },
    scheduleAnalysis: createDefaultScheduleAnalysis(),
    warnings,
    errors
  }
}

/**
 * Generate human-readable multi-day itinerary
 */
export function generateMultiDayItinerary(result: EnhancedOptimizationResult): string {
  if (!result.success || !result.multiDayItinerary) {
    return generateSimpleItinerary(result)
  }
  
  const lines: string[] = []
  const itinerary = result.multiDayItinerary
  
  // Header
  lines.push('=== MULTI-DAY TRAVEL ITINERARY ===')
  lines.push(`Trip Duration: ${itinerary.daySchedules.length} days`)
  lines.push(`Total Destinations: ${result.summary.totalDestinations}`)
  lines.push(`Total Distance: ${result.summary.totalDistanceKm.toFixed(0)}km`)
  lines.push(`Estimated Accommodation Cost: $${result.summary.estimatedAccommodationCost}`)
  lines.push(`Fairness Score: ${(result.summary.fairnessScore * 100).toFixed(0)}%`)
  lines.push('')
  
  // Daily schedules
  for (const day of itinerary.daySchedules) {
    const dayOfWeek = day.date.toLocaleDateString('en-US', { weekday: 'long' })
    lines.push(`--- Day ${day.dayNumber}: ${dayOfWeek}, ${day.date.toLocaleDateString()} ---`)
    lines.push(`Schedule: ${day.startTime.toLocaleTimeString()} - ${day.endTime.toLocaleTimeString()}`)
    lines.push(`Pace: ${day.summary.paceRating.toUpperCase()}`)
    lines.push('')
    
    // Destinations
    for (const destination of day.destinations) {
      const timeStr = destination.scheduledArrival.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      lines.push(`${timeStr} - ${destination.visit.destinationName}`)
    }
    
    // Meals
    for (const meal of day.meals) {
      lines.push(`${meal.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 🍽️ ${meal.type}`)
    }
    
    // Accommodation
    if (day.accommodation) {
      lines.push('')
      lines.push(`🏨 Accommodation: ${day.accommodation.reasoning}`)
      const avgCost = (day.accommodation.estimatedCostUSD.standard.min + day.accommodation.estimatedCostUSD.standard.max) / 2
      lines.push(`   Estimated cost: $${avgCost.toFixed(0)}/night`)
      lines.push(`   Search radius: ${day.accommodation.searchRadius}km`)
    }
    
    lines.push('')
  }
  
  // Summary statistics
  lines.push('=== TRIP SUMMARY ===')
  lines.push(`Average ${result.summary.averageDestinationsPerDay.toFixed(1)} destinations per day`)
  lines.push(`Daily pace: ${result.scheduleAnalysis.paceDistribution.relaxed} relaxed, ${result.scheduleAnalysis.paceDistribution.moderate} moderate, ${result.scheduleAnalysis.paceDistribution.packed} packed`)
  
  if (result.scheduleAnalysis.hasRestDayRecommendation) {
    lines.push('')
    lines.push(`⚠️ ${result.scheduleAnalysis.restDayMessage}`)
  }
  
  // Transport breakdown
  lines.push('')
  lines.push('Transport breakdown:')
  lines.push(`✈️ Flying: ${result.transportAnalysis.flyingDistanceKm.toFixed(0)}km`)
  lines.push(`🚗 Driving: ${result.transportAnalysis.drivingDistanceKm.toFixed(0)}km`)
  lines.push(`🚶 Walking: ${result.transportAnalysis.walkingDistanceKm.toFixed(1)}km`)
  
  return lines.join('\n')
}

/**
 * Generate simple itinerary when multi-day is not available
 */
function generateSimpleItinerary(result: EnhancedOptimizationResult): string {
  if (!result.success || !result.linearItinerary) {
    return 'Optimization failed. Please check errors and warnings.'
  }
  
  return formatItineraryAsText(result.linearItinerary)
}

/**
 * Export optimization result to shareable format
 */
export function exportEnhancedOptimizationResult(
  result: EnhancedOptimizationResult
): {
  success: boolean
  data: any
  format: 'json'
} {
  if (!result.success) {
    return {
      success: false,
      data: { errors: result.errors, warnings: result.warnings },
      format: 'json'
    }
  }
  
  const exportData = {
    summary: result.summary,
    schedule: result.multiDayItinerary ? {
      days: result.multiDayItinerary.daySchedules.map(day => ({
        dayNumber: day.dayNumber,
        date: day.date.toISOString(),
        dayOfWeek: day.date.toLocaleDateString('en-US', { weekday: 'long' }),
        startTime: day.startTime.toISOString(),
        endTime: day.endTime.toISOString(),
        pace: day.summary.paceRating,
        destinationCount: day.summary.totalDestinations,
        travelHours: day.summary.totalTravelHours,
        activeHours: day.summary.totalActiveHours,
        destinations: day.destinations.map(dest => ({
          name: dest.visit.destinationName,
          arrivalTime: dest.scheduledArrival.toISOString(),
          departureTime: dest.scheduledDeparture.toISOString()
        })),
        accommodation: day.accommodation ? {
          location: day.accommodation.location,
          estimatedCostUSD: day.accommodation.estimatedCostUSD,
          reasoning: day.accommodation.reasoning
        } : null
      })),
      accommodations: result.multiDayItinerary.accommodations,
      totalAccommodationCost: result.summary.estimatedAccommodationCost
    } : null,
    fairness: result.fairnessAnalysis,
    transport: result.transportAnalysis,
    metadata: {
      generatedAt: new Date().toISOString(),
      optimizationTimeMs: result.optimization?.executionTimeMs || 0,
      algorithm: 'Multi-objective optimization with fairness weighting and daily scheduling'
    }
  }
  
  return {
    success: true,
    data: exportData,
    format: 'json'
  }
}