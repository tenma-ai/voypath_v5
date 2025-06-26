'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { 
  OptimizationResponse,
  OptimizationError,
  OptimizationErrorType
} from '../types/api-errors'
import { 
  classifyError,
  OptimizationTimeoutError,
  ValidationError,
  DataInsufficientError,
  NoFeasibleSolutionError
} from '../types/api-errors'
import { PerformanceTracker, GlobalPerformanceMonitor } from '../utils/performance-tracker'

// Import optimization modules
import { fetchOptimizationData } from '../optimization/data-fetcher'
import { performCompleteOptimizationV2 } from '../optimization/complete-optimizer-v2'
import type { CompleteOptimizationConfig } from '../optimization/complete-optimizer-v2'

// Import database modules
import { createClient } from '../supabase/server'

// Configuration interface
interface OptimizationRequestOptions {
  enableMultiDayScheduling?: boolean
  accommodationQuality?: 'budget' | 'standard' | 'premium'
  timeoutMs?: number
  maxIterations?: number
}

/**
 * Main optimization endpoint server action
 * Orchestrates the entire optimization pipeline with comprehensive error handling
 */
export async function optimizeTripRoute(
  groupId: string,
  currentUser: { id: string | null, sessionId: string | null, isGuest: boolean },
  options?: OptimizationRequestOptions
): Promise<OptimizationResponse> {
  const startTime = Date.now()
  
  // Create performance tracker
  const perfTracker = GlobalPerformanceMonitor.getInstance().createTracker(
    groupId,
    currentUser.id || undefined,
    currentUser.sessionId || undefined
  )
  
  try {
    perfTracker.startStage('dataPreprocessing')
    
    // Step 1: Fetch raw data
    console.log(`Starting optimization for group ${groupId}`)
    const { data: rawOptimizationData, error: fetchError } = await fetchOptimizationData(groupId, currentUser)
    
    if (fetchError || !rawOptimizationData) {
      perfTracker.endStage('dataPreprocessing', false, [fetchError?.message || 'Failed to fetch data'])
      throw new Error(fetchError?.message || 'Failed to fetch optimization data')
    }
    
    // Step 2: Preprocess and validate data
    const { preprocessOptimizationData } = await import('../optimization/data-preprocessor')
    const { data: preprocessedData, validation } = await preprocessOptimizationData(rawOptimizationData)
    
    perfTracker.endStage('dataPreprocessing', true)
    
    if (!validation.isValid || !preprocessedData) {
      perfTracker.endStage('dataPreprocessing', false, validation.errors.map(e => e.message))
      
      if (validation.errors.some(e => e.message.includes('not authorized'))) {
        throw new Error('You are not authorized to optimize this trip')
      }
      
      if (validation.errors.some(e => e.message.includes('Insufficient data'))) {
        throw new DataInsufficientError(
          'Insufficient data for optimization',
          validation.errors.map(e => e.message)
        )
      }
      
      throw new ValidationError(
        'Data validation failed',
        validation.errors.map(e => e.message)
      )
    }

    // Step 2: Run optimization with timeout
    perfTracker.startStage('optimization')
    
    const optimizationConfig: CompleteOptimizationConfig = {
      enableMultiDayScheduling: options?.enableMultiDayScheduling ?? true,
      accommodationQuality: options?.accommodationQuality ?? 'standard',
      optimization: {
        maxIterations: options?.maxIterations ?? 100
      }
    }
    
    const optimizationResult = await optimizeWithTimeout(
      () => performCompleteOptimizationV2(preprocessedData, optimizationConfig),
      options?.timeoutMs ?? 5000
    )
    
    perfTracker.endStage('optimization', optimizationResult.success)
    
    if (!optimizationResult.success) {
      if (optimizationResult.errors.some(e => e.includes('timeout'))) {
        throw new OptimizationTimeoutError(
          'Optimization exceeded time limit',
          options?.timeoutMs ?? 5000
        )
      }
      
      if (optimizationResult.errors.some(e => e.includes('no feasible solution'))) {
        throw new NoFeasibleSolutionError(
          'No feasible solution found within constraints',
          { groupId: preprocessedData.groupId }
        )
      }
      
      throw new Error(`Optimization failed: ${optimizationResult.errors.join(', ')}`)
    }

    // Step 3: Record quality metrics
    perfTracker.recordQualityMetrics(optimizationResult)

    // Step 4: Save optimization result to database
    perfTracker.startStage('databaseStorage')
    
    const savedRoute = await saveOptimizationResult(groupId, {
      optimizationResult,
      metadata: {
        generatedBy: currentUser,
        generatedAt: new Date(),
        processingTime: Date.now() - startTime
      }
    })
    
    perfTracker.recordDatabaseQuery('saveOptimizationResult')
    perfTracker.endStage('databaseStorage', true)

    // Step 5: Cache invalidation and revalidation
    revalidatePath(`/trips/${groupId}`)
    revalidatePath(`/my-trip`)

    // Finalize performance tracking
    const finalMetrics = perfTracker.getMetrics()
    GlobalPerformanceMonitor.getInstance().finalizeTracker(perfTracker)
    
    console.log('Optimization completed successfully:')
    console.log(perfTracker.getSummary())

    return {
      status: 'success',
      data: {
        ...optimizationResult,
        savedRoute
      },
      processingTime: Date.now() - startTime,
      metadata: {
        generatedBy: currentUser,
        generatedAt: new Date(),
        processingTime: Date.now() - startTime
      }
    }
    
  } catch (error) {
    console.error('Optimization failed:', error)
    
    // Finalize performance tracking with error
    GlobalPerformanceMonitor.getInstance().finalizeTracker(perfTracker)
    
    return handleOptimizationError(error, groupId, currentUser, startTime)
  }
}

/**
 * Options for optimization configuration
 */
export interface OptimizationOptions {
  enableMultiDayScheduling?: boolean
  accommodationQuality?: 'budget' | 'standard' | 'premium'
  maxIterations?: number
  timeoutMs?: number
  enableFallback?: boolean
}

/**
 * Timeout wrapper for optimization functions
 */
async function optimizeWithTimeout<T>(
  optimizationFunction: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new OptimizationTimeoutError(`Optimization exceeded ${timeoutMs}ms timeout`, timeoutMs))
    }, timeoutMs)
    
    optimizationFunction()
      .then(result => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Enhanced error handling with fallback strategies
 */
async function handleOptimizationError(
  error: unknown, 
  groupId: string, 
  currentUser: any,
  startTime: number
): Promise<OptimizationResponse> {
  
  const optimizationError = classifyError(error, {
    groupId,
    userId: currentUser.id,
    sessionId: currentUser.sessionId,
    function: 'optimizeTripRoute'
  })
  
  // Log error for monitoring
  console.error('Optimization error:', {
    type: optimizationError.type,
    message: optimizationError.message,
    groupId,
    userId: currentUser.id,
    processingTime: Date.now() - startTime
  })
  
  // Attempt fallback strategies based on error type
  switch (optimizationError.type) {
    case 'optimization_timeout' as OptimizationErrorType:
      // Try with relaxed constraints
      return attemptRelaxedOptimization(groupId, currentUser, startTime)
      
    case 'insufficient_data' as OptimizationErrorType:
      // Generate partial solution with warnings
      return generatePartialSolution(groupId, currentUser, optimizationError)
      
    case 'no_feasible_solution' as OptimizationErrorType:
      // Return alternative suggestions
      return generateAlternativeSuggestions(groupId, currentUser, optimizationError)
      
    case 'database_error' as OptimizationErrorType:
      // Cache result locally and retry later
      return cacheAndRetryLater(groupId, optimizationError)
      
    default:
      // Return user-friendly error response
      return {
        status: 'error',
        error: optimizationError,
        processingTime: Date.now() - startTime,
        fallbackData: await getLastKnownGoodRoute(groupId)
      }
  }
}

/**
 * Attempt optimization with relaxed constraints
 */
async function attemptRelaxedOptimization(
  groupId: string,
  currentUser: any,
  startTime: number
): Promise<OptimizationResponse> {
  
  try {
    console.log('Attempting optimization with relaxed constraints...')
    
    const { data: rawOptimizationData } = await fetchOptimizationData(groupId, currentUser)
    if (!rawOptimizationData) {
      throw new Error('Failed to fetch data for relaxed optimization')
    }
    
    // Preprocess the data
    const { preprocessOptimizationData } = await import('../optimization/data-preprocessor')
    const { data: processedData } = await preprocessOptimizationData(rawOptimizationData)
    
    if (!processedData) {
      throw new Error('Failed to preprocess data for relaxed optimization')
    }
    
    // Use simplified configuration with shorter timeout
    const relaxedConfig: CompleteOptimizationConfig = {
      enableMultiDayScheduling: false, // Disable complex scheduling
      optimization: {
        maxIterations: 50 // Reduced iterations
      }
    }
    
    const result = await optimizeWithTimeout(
      () => performCompleteOptimizationV2(processedData, relaxedConfig),
      2000
    )
    
    if (result.success) {
      return {
        status: 'partial_success',
        data: result,
        warnings: [
          'Optimization completed with simplified settings due to time constraints',
          'Multi-day scheduling was disabled for faster processing'
        ],
        processingTime: Date.now() - startTime
      }
    }
    
    throw new Error('Relaxed optimization also failed')
    
  } catch (error) {
    return {
      status: 'error',
      error: classifyError(error, { groupId, function: 'attemptRelaxedOptimization' }),
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Generate partial solution with available data
 */
async function generatePartialSolution(
  groupId: string,
  currentUser: any,
  originalError: OptimizationError
): Promise<OptimizationResponse> {
  
  try {
    // Attempt to get whatever data is available
    const { data: rawOptimizationData } = await fetchOptimizationData(groupId, currentUser)
    
    if (rawOptimizationData && rawOptimizationData.destinations.length > 0) {
      // Create a simple ordered list based on coordinates
      const simpleRoute = createSimpleRoute(rawOptimizationData)
      
      return {
        status: 'partial_success',
        data: simpleRoute,
        warnings: [
          'Generated simplified route due to insufficient preference data',
          'Ask group members to provide more destination ratings for better optimization'
        ],
        error: originalError,
        processingTime: Date.now() - Date.now()
      }
    }
    
    throw new Error('No destination data available')
    
  } catch (error) {
    return {
      status: 'error',
      error: originalError,
      processingTime: Date.now() - Date.now()
    }
  }
}

/**
 * Generate alternative suggestions when no feasible solution exists
 */
async function generateAlternativeSuggestions(
  groupId: string,
  currentUser: any,
  originalError: OptimizationError
): Promise<OptimizationResponse> {
  
  try {
    const { data: preprocessedData } = await fetchOptimizationData(groupId, currentUser)
    
    if (preprocessedData) {
      const alternatives = generateConstraintAlternatives(preprocessedData)
      
      return {
        status: 'error',
        error: originalError,
        data: {
          alternatives,
          suggestions: [
            'Consider extending your trip duration',
            'Reduce time spent at some destinations',
            'Remove some lower-priority destinations',
            'Split the trip into multiple shorter trips'
          ]
        },
        processingTime: Date.now() - Date.now()
      }
    }
    
    throw new Error('Unable to generate alternatives')
    
  } catch (error) {
    return {
      status: 'error',
      error: originalError,
      processingTime: Date.now() - Date.now()
    }
  }
}

/**
 * Cache result and schedule retry
 */
async function cacheAndRetryLater(
  groupId: string,
  error: OptimizationError
): Promise<OptimizationResponse> {
  
  return {
    status: 'error',
    error,
    data: {
      retryRecommended: true,
      retryAfterMs: 60000, // Retry after 1 minute
      cachedData: null
    },
    processingTime: 0
  }
}

/**
 * Get last known good route from database
 */
async function getLastKnownGoodRoute(groupId: string): Promise<any> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { data: routes, error } = await supabase
      .from('optimized_routes')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error || !routes || routes.length === 0) {
      return null
    }
    
    return routes[0]
  } catch (error) {
    console.error('Error fetching last known good route:', error)
    return null
  }
}

/**
 * Save optimization result to database
 */
async function saveOptimizationResult(
  groupId: string,
  result: any
): Promise<any> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const routeData = {
      group_id: groupId,
      route_data: result.optimizationResult,
      fairness_score: result.optimizationResult.summary?.fairnessScore || 0,
      total_distance: result.optimizationResult.summary?.totalDistanceKm || 0,
      total_duration: Math.round((result.optimizationResult.summary?.totalActiveHours || 0) * 60),
      version: 2
    }
    
    const { data, error } = await supabase
      .from('optimized_routes')
      .insert(routeData)
      .select()
      .single()
    
    if (error) {
      console.error('Error saving optimization result:', error)
      throw new Error(`Database save failed: ${error.message}`)
    }
    
    return data
  } catch (error) {
    console.error('Error in saveOptimizationResult:', error)
    throw error
  }
}

/**
 * Create simple route when optimization fails
 */
function createSimpleRoute(preprocessedData: any): any {
  // Simple coordinate-based ordering (nearest neighbor)
  const destinations = preprocessedData.destinationLocations
  
  if (destinations.length === 0) {
    return null
  }
  
  // Start from departure location or first destination
  const start = preprocessedData.departureLocation || destinations[0]
  const orderedDestinations = [start]
  const remaining = [...destinations]
  
  // Simple nearest neighbor algorithm
  while (remaining.length > 0) {
    const current = orderedDestinations[orderedDestinations.length - 1]
    let nearestIndex = 0
    let nearestDistance = Infinity
    
    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(current, remaining[i])
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }
    
    orderedDestinations.push(remaining[nearestIndex])
    remaining.splice(nearestIndex, 1)
  }
  
  return {
    success: true,
    route: orderedDestinations,
    summary: {
      totalDestinations: destinations.length,
      selectedDestinations: destinations.length,
      totalDistanceKm: calculateTotalDistance(orderedDestinations),
      fairnessScore: 0.5, // Neutral score
      isSimplified: true
    }
  }
}

/**
 * Generate constraint alternatives
 */
function generateConstraintAlternatives(preprocessedData: any): any[] {
  const alternatives = []
  
  const currentDuration = preprocessedData.input.tripGroup.end_date 
    ? new Date(preprocessedData.input.tripGroup.end_date).getTime() - new Date(preprocessedData.input.tripGroup.start_date).getTime()
    : 7 * 24 * 60 * 60 * 1000 // Default 7 days
  
  const durationDays = Math.ceil(currentDuration / (24 * 60 * 60 * 1000))
  
  // Suggest longer duration
  alternatives.push({
    type: 'extend_duration',
    suggestion: `Extend trip to ${durationDays + 2} days`,
    impact: 'Allows visiting all preferred destinations with comfortable pacing'
  })
  
  // Suggest reducing destinations
  const totalDestinations = preprocessedData.destinationLocations.length
  alternatives.push({
    type: 'reduce_destinations',
    suggestion: `Focus on top ${Math.floor(totalDestinations * 0.7)} destinations`,
    impact: 'Creates a more relaxed itinerary with higher satisfaction'
  })
  
  // Suggest regional focus
  alternatives.push({
    type: 'regional_focus',
    suggestion: 'Split into regional sub-trips',
    impact: 'Reduces travel time and allows deeper exploration of each area'
  })
  
  return alternatives
}

/**
 * Calculate distance between two points
 */
function calculateDistance(point1: any, point2: any): number {
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
function calculateTotalDistance(points: any[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i-1], points[i])
  }
  return total
}