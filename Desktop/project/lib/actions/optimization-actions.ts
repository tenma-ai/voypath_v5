'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { fetchOptimizationData } from '@/lib/optimization/data-fetcher'
import { preprocessOptimizationData } from '@/lib/optimization/data-preprocessor'
import { performCompleteOptimizationV2 } from '@/lib/optimization/complete-optimizer-v2'
import { IntegratedRouteManager } from '@/lib/services/integrated-route-manager'
import { createClient } from '@/lib/supabase/server'
import type { PreprocessedData } from '@/lib/optimization/types'
import type { StoredRouteData, OptimizationMetrics } from '@/lib/types/route-storage'

// Internal types for server actions (not exported)
enum OptimizationErrorType {
  INSUFFICIENT_DATA = 'insufficient_data',
  INVALID_COORDINATES = 'invalid_coordinates',
  MISSING_PREFERENCES = 'missing_preferences',
  NO_FEASIBLE_SOLUTION = 'no_feasible_solution',
  OPTIMIZATION_TIMEOUT = 'optimization_timeout',
  CLUSTERING_FAILED = 'clustering_failed',
  DATABASE_ERROR = 'database_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  PERMISSION_DENIED = 'permission_denied',
  GEOCODING_FAILED = 'geocoding_failed',
  MAPS_API_ERROR = 'maps_api_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

interface OptimizationError {
  type: OptimizationErrorType
  message: string
  details?: any
  userMessage: string
  suggestedActions: string[]
  retryable: boolean
}

interface OptimizationProgress {
  stage: 'preprocessing' | 'clustering' | 'optimizing' | 'generating' | 'scheduling' | 'saving'
  progress: number // 0-100
  message: string
  estimatedTimeRemaining?: number
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface OptimizationResponse {
  status: 'success' | 'error' | 'partial'
  data?: StoredRouteData
  error?: OptimizationError
  fallbackData?: StoredRouteData
  processingTime?: number
  performanceMetrics?: PerformanceMetrics
  warnings?: string[]
}

interface PerformanceMetrics {
  totalProcessingTime: number
  stageTimings: {
    dataPreprocessing: number
    clustering: number
    optimization: number
    routeGeneration: number
    scheduling: number
    databaseStorage: number
  }
  resourceUsage: {
    memoryPeak: number
    cpuTime: number
    databaseQueries: number
  }
  qualityMetrics: {
    fairnessScore: number
    routeEfficiency: number
    userSatisfactionEstimate: number
  }
}

class PerformanceTracker {
  private startTime: number
  private stageStartTime: number = 0
  private metrics: Partial<PerformanceMetrics> = { stageTimings: {} as any, resourceUsage: {} as any, qualityMetrics: {} as any }
  
  constructor() {
    this.startTime = performance.now()
  }
  
  startStage(stageName: keyof PerformanceMetrics['stageTimings']) {
    this.stageStartTime = performance.now()
  }
  
  endStage(stageName: keyof PerformanceMetrics['stageTimings']) {
    if (!this.metrics.stageTimings) this.metrics.stageTimings = {} as any
    this.metrics.stageTimings![stageName] = performance.now() - this.stageStartTime
  }
  
  recordQualityMetrics(optimizationResult: any) {
    this.metrics.qualityMetrics = {
      fairnessScore: optimizationResult.fairnessScore || 0,
      routeEfficiency: this.calculateRouteEfficiency(optimizationResult),
      userSatisfactionEstimate: this.estimateUserSatisfaction(optimizationResult)
    }
  }
  
  private calculateRouteEfficiency(result: any): number {
    if (!result.totalDistance || !result.totalDuration) return 0
    return Math.min(1, 1000 / (result.totalDistance / result.totalDuration))
  }
  
  private estimateUserSatisfaction(result: any): number {
    return result.fairnessScore || 0.5
  }
  
  getMetrics(): PerformanceMetrics {
    this.metrics.totalProcessingTime = performance.now() - this.startTime
    return this.metrics as PerformanceMetrics
  }
}

class ProgressReporter {
  private groupId: string
  private supabase: any
  
  constructor(groupId: string) {
    this.groupId = groupId
    this.supabase = createClient('' as any)
  }
  
  async updateProgress(progress: OptimizationProgress) {
    try {
      await this.supabase
        .channel('optimization-progress')
        .send({
          type: 'broadcast',
          event: 'progress-update',
          payload: {
            groupId: this.groupId,
            progress
          }
        })
    } catch (error) {
      console.warn('Failed to broadcast progress:', error)
    }
  }
  
  async reportStageCompletion(stage: string, timeTaken: number) {
    await this.updateProgress({
      stage: stage as any,
      progress: this.calculateOverallProgress(stage),
      message: `Completed ${stage} in ${timeTaken.toFixed(1)}s`,
      estimatedTimeRemaining: this.estimateRemainingTime(stage)
    })
  }
  
  private calculateOverallProgress(stage: string): number {
    const stageProgress = {
      'preprocessing': 20,
      'clustering': 40,
      'optimizing': 70,
      'generating': 85,
      'scheduling': 95,
      'saving': 100
    }
    return (stageProgress as any)[stage] || 0
  }
  
  private estimateRemainingTime(stage: string): number {
    const timeEstimates = {
      'preprocessing': 4000,
      'clustering': 3000,
      'optimizing': 2000,
      'generating': 1000,
      'scheduling': 500,
      'saving': 200
    }
    return (timeEstimates as any)[stage] || 1000
  }
}

// Validation rules
interface ValidationRule {
  field: string
  validator: (value: any) => boolean
  errorMessage: string
  required: boolean
}

const optimizationValidationRules: ValidationRule[] = [
  {
    field: 'groupId',
    validator: (id) => typeof id === 'string' && id.length > 0,
    errorMessage: 'Valid group ID is required',
    required: true
  }
  // Note: departureLocation validation moved to data preprocessing stage
  // where the actual trip group data is available
]

function validateOptimizationInput(input: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  optimizationValidationRules.forEach(rule => {
    const value = input[rule.field]
    
    if (rule.required && !value) {
      errors.push(`${rule.field} is required`)
    } else if (value && !rule.validator(value)) {
      errors.push(rule.errorMessage)
    }
  })
  
  return { isValid: errors.length === 0, errors, warnings }
}

async function validateOptimizationData(
  preprocessedData: PreprocessedData
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate coordinates are realistic
  if ((preprocessedData as any).destinationLocations) {
    (preprocessedData as any).destinationLocations.forEach((location: any, index: number) => {
      if (Math.abs(location.latitude) > 90) {
        errors.push(`Destination ${index + 1}: Invalid latitude ${location.latitude}`)
      }
      if (Math.abs(location.longitude) > 180) {
        errors.push(`Destination ${index + 1}: Invalid longitude ${location.longitude}`)
      }
    })
  }
  
  // Validate preference data completeness
  if ((preprocessedData as any).input?.userPreferences) {
    const preferenceCoverage = calculatePreferenceCoverage((preprocessedData as any).input)
    if (preferenceCoverage < 0.5) {
      warnings.push('Less than 50% of destinations have user preferences. This may affect optimization quality.')
    }
  }
  
  // Validate time constraints are reasonable
  if ((preprocessedData as any).input?.tripGroup?.start_date) {
    const startDate = new Date((preprocessedData as any).input.tripGroup.start_date)
    if (startDate < new Date()) {
      errors.push('Trip start date cannot be in the past')
    }
  }
  
  // Validate group size limitations
  if ((preprocessedData as any).input?.groupMembers?.length > 20) {
    warnings.push('Large groups (20+ members) may experience longer optimization times')
  }
  
  return { isValid: errors.length === 0, errors, warnings }
}

function calculatePreferenceCoverage(input: any): number {
  if (!input.userPreferences || !input.destinations) return 0
  
  const destinationsWithPreferences = new Set(
    input.userPreferences.map((pref: any) => pref.destination_id)
  )
  
  return destinationsWithPreferences.size / input.destinations.length
}

// Error handling and classification
function classifyError(error: unknown): OptimizationError {
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('insufficient data')) {
      return {
        type: OptimizationErrorType.INSUFFICIENT_DATA,
        message: error.message,
        userMessage: 'Not enough destination preferences to create an optimal route',
        suggestedActions: [
          'Ask group members to rate more destinations',
          'Add more destinations to choose from',
          'Provide time preferences for existing destinations'
        ],
        retryable: true
      }
    }
    
    if (error.message.includes('timeout') || error.message.includes('exceeded')) {
      return {
        type: OptimizationErrorType.OPTIMIZATION_TIMEOUT,
        message: error.message,
        userMessage: 'Optimization is taking longer than expected',
        suggestedActions: [
          'Use the current result and refine manually',
          'Try again with fewer destinations',
          'Simplify your preferences'
        ],
        retryable: true
      }
    }
    
    if (error.message.includes('no feasible solution')) {
      return {
        type: OptimizationErrorType.NO_FEASIBLE_SOLUTION,
        message: error.message,
        userMessage: 'Could not fit all desired destinations in the available time',
        suggestedActions: [
          'Extend your trip duration',
          'Reduce time spent at some destinations',
          'Remove some lower-priority destinations',
          'Consider splitting into multiple trips'
        ],
        retryable: false
      }
    }
    
    if (error.message.includes('database') || error.message.includes('connection')) {
      return {
        type: OptimizationErrorType.DATABASE_ERROR,
        message: error.message,
        userMessage: 'Database connection issue',
        suggestedActions: [
          'Please try again in a moment',
          'Check your internet connection'
        ],
        retryable: true
      }
    }
  }
  
  // Default error
  return {
    type: OptimizationErrorType.OPTIMIZATION_TIMEOUT,
    message: error?.toString() || 'Unknown error',
    userMessage: 'An unexpected error occurred during optimization',
    suggestedActions: ['Please try again', 'Contact support if the problem persists'],
    retryable: true
  }
}

// Timeout wrapper
async function optimizeWithTimeout<T>(
  optimizationFunction: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Optimization exceeded ${timeoutMs}ms timeout`))
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

// Edge case handlers
function handleDataEdgeCases(preprocessedData: PreprocessedData): PreprocessedData {
  // Handle single destination
  if ((preprocessedData as any).destinationLocations?.length === 1) {
    console.log('Handling single destination case')
    return preprocessedData
  }
  
  // Handle single user
  if ((preprocessedData as any).input?.groupMembers?.length === 1) {
    console.log('Handling single user case')
    return preprocessedData
  }
  
  // Handle missing preferences
  if ((preprocessedData as any).input?.userPreferences?.length === 0) {
    console.log('Handling missing preferences case')
    // Add default preferences
    if ((preprocessedData as any).input.destinations) {
      (preprocessedData as any).input.userPreferences = (preprocessedData as any).input.destinations.map((dest: any) => ({
        destination_id: dest.id,
        preference_score: 3,
        preferred_duration: 60
      }))
    }
  }
  
  return preprocessedData
}

// Main optimization server action
export async function optimizeTripRoute(
  groupId: string,
  currentUser: { id: string | null, sessionId: string | null, isGuest: boolean },
  options?: any
): Promise<OptimizationResponse> {
  const tracker = new PerformanceTracker()
  const progressReporter = new ProgressReporter(groupId)
  
  try {
    // Step 1: Input validation
    const inputValidation = validateOptimizationInput({ groupId, currentUser })
    if (!inputValidation.isValid) {
      return {
        status: 'error',
        error: {
          type: OptimizationErrorType.INVALID_COORDINATES,
          message: inputValidation.errors.join(', '),
          userMessage: 'Invalid input data',
          suggestedActions: ['Please check your input and try again'],
          retryable: true
        }
      }
    }
    
    // Step 2: Data preprocessing and validation
    tracker.startStage('dataPreprocessing')
    await progressReporter.updateProgress({
      stage: 'preprocessing',
      progress: 10,
      message: 'Loading trip data and user preferences...'
    })
    
    // Fetch raw optimization data first
    const { data: rawOptimizationData, error: fetchError } = await fetchOptimizationData(
      groupId, 
      currentUser
    )
    
    if (fetchError || !rawOptimizationData) {
      console.error('🔍 Failed to fetch optimization data:', fetchError?.message)
      return {
        status: 'error',
        error: {
          type: OptimizationErrorType.DATABASE_ERROR,
          message: fetchError?.message || 'Failed to fetch optimization data',
          userMessage: 'Could not load trip data for optimization',
          suggestedActions: ['Check your trip data and try again'],
          retryable: true
        }
      }
    }
    
    // Now preprocess the raw data
    const { data: preprocessedData, validation } = await preprocessOptimizationData(rawOptimizationData)
    
    if (!validation.isValid) {
      console.error('🔍 Preprocessing validation failed:', validation.errors)
      return {
        status: 'error',
        error: {
          type: OptimizationErrorType.INVALID_COORDINATES,
          message: validation.errors.map(e => e.message).join(', '),
          userMessage: 'Trip data validation failed',
          suggestedActions: validation.errors.map(e => e.message),
          retryable: true
        }
      }
    }
    
    const validationResult = await validateOptimizationData(preprocessedData!)
    
    if (!validationResult.isValid) {
      return {
        status: 'error',
        error: {
          type: OptimizationErrorType.INSUFFICIENT_DATA,
          message: validationResult.errors.join(', '),
          userMessage: 'Data validation failed',
          suggestedActions: validationResult.errors,
          retryable: true
        }
      }
    }
    
    // Handle edge cases
    const processedData = handleDataEdgeCases(preprocessedData!)
    
    // 🎯 NEW: 単一場所のエッジケース処理
    if (preprocessedData!.destinations?.size === 1) {
      return await handleSingleDestinationCase(groupId, preprocessedData!, tracker);
    }
    
    tracker.endStage('dataPreprocessing')
    
    // Step 3: Run optimization with timeout
    tracker.startStage('optimization')
    await progressReporter.updateProgress({
      stage: 'optimizing',
      progress: 50,
      message: 'Finding optimal route...'
    })
    
    const optimizationResult = await optimizeWithTimeout(
      () => performCompleteOptimizationV2(preprocessedData!, { enableMultiDayScheduling: true }),
      10000 // 10 second timeout
    )
    
    tracker.endStage('optimization')
    tracker.recordQualityMetrics(optimizationResult)
    
    // Step 4: Database storage
    tracker.startStage('databaseStorage')
    await progressReporter.updateProgress({
      stage: 'saving',
      progress: 90,
      message: 'Saving optimization results...'
    })
    
    const routeManager = IntegratedRouteManager.create(
      groupId,
      currentUser.id,
      currentUser.sessionId
    )
    
    const storageResult = await routeManager.saveOptimizationResult(
      optimizationResult as unknown as StoredRouteData,
      {
        fairnessScore: optimizationResult.summary?.fairnessScore || 0,
        totalDistance: optimizationResult.summary?.totalDistanceKm || 0,
        totalDuration: optimizationResult.summary?.totalActiveHours || 0,
        processingTime: tracker.getMetrics().totalProcessingTime
      } as OptimizationMetrics
    )
    
    if (!storageResult.success) {
      throw new Error(`Storage failed: ${storageResult.error?.message}`)
    }

    // 🎯 NEW: Save individual records to places table for easy access
    await saveOptimizationToPlacesTable(groupId, optimizationResult as unknown as StoredRouteData);
    
    tracker.endStage('databaseStorage')
    
    // Step 5: Cache invalidation and revalidation
    revalidatePath(`/my-trip`)
    revalidatePath(`/trips/${groupId}`)
    
    await progressReporter.updateProgress({
      stage: 'saving',
      progress: 100,
      message: 'Optimization complete!'
    })
    
    return {
      status: 'success',
      data: storageResult.route?.route_data,
      processingTime: tracker.getMetrics().totalProcessingTime,
      performanceMetrics: tracker.getMetrics(),
      warnings: validationResult.warnings
    }
    
  } catch (error) {
    return handleOptimizationError(error, groupId, currentUser, tracker.getMetrics())
  }
}

// Error handler with fallback strategies
async function handleOptimizationError(
  error: unknown,
  groupId: string,
  currentUser: any,
  metrics: PerformanceMetrics
): Promise<OptimizationResponse> {
  const optimizationError = classifyError(error)
  
  console.error('Optimization error:', optimizationError)
  
  // Try fallback strategies for recoverable errors
  if (optimizationError.retryable) {
    try {
      const fallbackResult = await attemptFallbackOptimization(groupId, currentUser)
      if (fallbackResult) {
        return {
          status: 'partial',
          data: fallbackResult,
          error: optimizationError,
          performanceMetrics: metrics,
          warnings: ['Used simplified optimization due to error']
        }
      }
    } catch (fallbackError) {
      console.error('Fallback optimization also failed:', fallbackError)
    }
  }
  
  return {
    status: 'error',
    error: optimizationError,
    performanceMetrics: metrics
  }
}

// Simplified fallback optimization
async function attemptFallbackOptimization(
  groupId: string,
  currentUser: any
): Promise<StoredRouteData | null> {
  try {
    // Simple fallback: just order destinations by average preference score
    const { data: rawOptimizationData, error: fetchError } = await fetchOptimizationData(
      groupId, 
      currentUser
    )
    
    if (fetchError || !rawOptimizationData?.destinations || !rawOptimizationData?.userPreferences) {
      return null
    }
    
    // Calculate average scores and sort
    const destinationScores = new Map()
    
    rawOptimizationData.destinations.forEach((dest: any) => {
      const preferences = rawOptimizationData.userPreferences.filter(
        (pref: any) => pref.destination_id === dest.id
      )
      
      const avgScore = preferences.length > 0
        ? preferences.reduce((sum: number, pref: any) => sum + pref.preference_score, 0) / preferences.length
        : 3 // Default score
      
      destinationScores.set(dest.id, avgScore)
    })
    
    // Sort destinations by score
    const sortedDestinations = rawOptimizationData.destinations.sort(
      (a: any, b: any) => destinationScores.get(b.id) - destinationScores.get(a.id)
    )
    
    // Create simple route data
    const fallbackRouteData: StoredRouteData = {
      status: 'success',
      optimizationMetrics: {
        fairnessScore: 0.7,
        totalDistance: 0,
        totalDuration: sortedDestinations.length * 120, // 2 hours per destination
        clusterCount: 1,
        destinationCount: sortedDestinations.length,
        averageSatisfaction: 0.7,
        efficiencyScore: 0.7
      },
      multiDaySchedule: {
        days: [{
          date: new Date().toISOString().split('T')[0],
          dayIndex: 0,
          destinations: sortedDestinations.map((dest: any, index: number) => ({
            destinationId: dest.id,
            name: dest.name,
            address: dest.address || '',
            coordinates: { lat: dest.latitude, lng: dest.longitude },
            startTime: `${9 + index * 2}:00`,
            endTime: `${11 + index * 2}:00`,
            allocatedDuration: 120,
            visitOrder: index + 1,
            dayVisitOrder: index + 1,
            wishfulUsers: []
          })),
          dailyStats: {
            totalDistance: 0,
            totalTime: sortedDestinations.length * 120,
            destinationCount: sortedDestinations.length,
            averageSatisfaction: 0.7,
            intensity: 'moderate'
          }
        }],
        totalStats: {
          tripDurationDays: 1,
          totalDestinations: sortedDestinations.length,
          totalDistance: 0,
          totalTime: sortedDestinations.length * 120,
          averageDailyDistance: 0,
          averageDailyTime: sortedDestinations.length * 120,
          restDayRecommendations: []
        }
      },
      visualizationData: {
        mapBounds: {
          north: 0,
          south: 0,
          east: 0,
          west: 0,
          center: { lat: 0, lng: 0 },
          zoom: 10
        },
        colorMappings: {},
        routeLines: [],
        statisticalSummary: {
          walkingDistance: 0,
          drivingDistance: 0,
          flyingDistance: 0,
          walkingTime: 0,
          drivingTime: 0,
          flyingTime: 0,
          accommodationPoints: 1,
          averageDistanceBetweenDestinations: 0,
          routeEfficiency: 0.7
        }
      },
      generationInfo: {
        algorithmVersion: 'fallback-v1.0',
        generatedAt: new Date().toISOString(),
        processingTime: 0.1,
        inputParameters: {
          startDate: new Date().toISOString().split('T')[0],
          departureLocation: 'Unknown',
          maxDailyDistance: 300,
          maxDailyTime: 600,
          transportPreferences: ['drive']
        },
        userPreferencesSnapshot: [],
        optimizationConstraints: {
          timeConstraints: [],
          geographicalConstraints: [],
          userRequirements: []
        }
      }
    }
    
    return fallbackRouteData
  } catch (error) {
    console.error('Fallback optimization failed:', error)
    return null
  }
}

/**
 * 🆕 単一場所専用の最適化処理
 * 1つの場所しかない場合は100%採用として即座に処理
 */
async function handleSingleDestinationCase(
  groupId: string, 
  preprocessedData: PreprocessedData, 
  tracker: PerformanceTracker
): Promise<OptimizationResponse> {
  console.log('🎯 Handling single destination case - 100% adoption');
  
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { cookies } = await import('next/headers');
    
    // Handle the case where cookies() might not be available in some contexts
    let supabase;
    try {
      const cookieStore = cookies();
      supabase = createClient(cookieStore);
    } catch (cookieError) {
      console.warn('Cookie context not available, falling back to direct client');
      // Create a basic client without cookies for optimization context
      const { createClient: createDirectClient } = await import('@supabase/supabase-js');
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }

    // 単一destination情報を取得
    const { data: destinations, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('group_id', groupId)
      .limit(1);

    if (destError || !destinations || destinations.length === 0) {
      return {
        status: 'error',
        error: {
          type: OptimizationErrorType.INSUFFICIENT_DATA,
          message: 'No destination found',
          userMessage: 'No destination to optimize',
          suggestedActions: ['Add places to your wishlist'],
          retryable: true
        }
      };
    }

    const destination = destinations[0];

    // user_preferencesからのデータ取得
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('group_id', groupId)
      .eq('destination_id', destination.id);

    const preferredDuration = preferences && preferences.length > 0 
      ? preferences[0].preferred_duration 
      : 60; // デフォルト1時間

    // placesテーブルに既存レコードがあるかチェック
    const { data: existingPlaces } = await supabase
      .from('places')
      .select('id')
      .eq('group_id', groupId);

    // 既存レコードがあれば削除（新しい最適化で置き換え）
    if (existingPlaces && existingPlaces.length > 0) {
      await supabase
        .from('places')
        .delete()
        .eq('group_id', groupId);
    }

    // 単一場所を100%採用としてplacesテーブルに保存
    const optimizedPlace = {
      group_id: groupId,
      name: destination.name,
      address: destination.address,
      latitude: destination.latitude,
      longitude: destination.longitude,
      place_id: destination.place_id,
      visit_order: 1,
      scheduled_date: null,
      scheduled_duration: preferredDuration,
      fairness_score: 1.0,
      created_at: new Date().toISOString()
    };

    const { error: placesError } = await supabase
      .from('places')
      .insert(optimizedPlace);

    if (placesError) {
      console.error('Failed to save single destination:', placesError);
      return {
        status: 'error',
        error: {
          type: OptimizationErrorType.DATABASE_ERROR,
          message: placesError.message,
          userMessage: 'Failed to save optimization result',
          suggestedActions: ['Try again'],
          retryable: true
        }
      };
    }

    console.log('✅ Single destination saved successfully');

    // Create simplified route data for single destination
    const singleDestinationRouteData: StoredRouteData = {
      status: 'success',
      optimizationMetrics: {
        fairnessScore: 1.0,
        totalDistance: 0,
        totalDuration: preferredDuration,
        clusterCount: 1,
        destinationCount: 1,
        averageSatisfaction: 1.0,
        efficiencyScore: 1.0
      },
      multiDaySchedule: {
        days: [{
          date: new Date().toISOString().split('T')[0],
          dayIndex: 0,
          destinations: [{
            destinationId: destination.id,
            name: destination.name,
            address: destination.address || '',
            coordinates: { lat: destination.latitude, lng: destination.longitude },
            startTime: '10:00',
            endTime: `${10 + Math.floor(preferredDuration / 60)}:${(preferredDuration % 60).toString().padStart(2, '0')}`,
            allocatedDuration: preferredDuration,
            visitOrder: 1,
            dayVisitOrder: 1,
            wishfulUsers: []
          }],
          dailyStats: {
            totalDistance: 0,
            totalTime: preferredDuration,
            destinationCount: 1,
            averageSatisfaction: 1.0,
            intensity: 'light'
          }
        }],
        totalStats: {
          tripDurationDays: 1,
          totalDestinations: 1,
          totalDistance: 0,
          totalTime: preferredDuration,
          averageDailyDistance: 0,
          averageDailyTime: preferredDuration,
          restDayRecommendations: []
        }
      },
      visualizationData: {
        mapBounds: {
          north: destination.latitude + 0.01,
          south: destination.latitude - 0.01,
          east: destination.longitude + 0.01,
          west: destination.longitude - 0.01,
          center: { lat: destination.latitude, lng: destination.longitude },
          zoom: 15
        },
        colorMappings: {},
        routeLines: [],
        statisticalSummary: {
          walkingDistance: 0,
          drivingDistance: 0,
          flyingDistance: 0,
          walkingTime: 0,
          drivingTime: 0,
          flyingTime: 0,
          accommodationPoints: 1,
          averageDistanceBetweenDestinations: 0,
          routeEfficiency: 1.0
        }
      },
      generationInfo: {
        algorithmVersion: 'single-destination-v1.0',
        generatedAt: new Date().toISOString(),
        processingTime: tracker.getMetrics().totalProcessingTime,
        inputParameters: {
          startDate: new Date().toISOString().split('T')[0],
          departureLocation: 'Single destination selected',
          transportPreferences: ['walking']
        },
        userPreferencesSnapshot: [],
        optimizationConstraints: {
          timeConstraints: [],
          geographicalConstraints: [],
          userRequirements: []
        }
      }
    };

    // 成功レスポンス
    return {
      status: 'success',
      data: singleDestinationRouteData
    };

  } catch (error) {
    console.error('Single destination case failed:', error);
    return {
      status: 'error',
      error: {
        type: OptimizationErrorType.DATABASE_ERROR,
        message: (error as Error).message,
        userMessage: 'Failed to process single destination',
        suggestedActions: ['Try again'],
        retryable: true
      }
    };
  }
}

/**
 * 🆕 最適化結果をplacesテーブルに個別レコードとして保存
 * JSONB形式の`optimized_routes`と併用して、クエリ性能を向上
 */
async function saveOptimizationToPlacesTable(
  groupId: string, 
  optimizationResult: StoredRouteData
): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { cookies } = await import('next/headers');
    
    // Handle the case where cookies() might not be available in some contexts
    let supabase;
    try {
      const cookieStore = cookies();
      supabase = createClient(cookieStore);
    } catch (cookieError) {
      console.warn('Cookie context not available, falling back to direct client');
      // Create a basic client without cookies for optimization context
      const { createClient: createDirectClient } = await import('@supabase/supabase-js');
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }

    console.log('🎯 Saving optimization results to places table...');

    // 既存の最適化結果をクリア
    const { error: deleteError } = await supabase
      .from('places')
      .delete()
      .eq('group_id', groupId);

    if (deleteError) {
      console.warn('Warning: Could not clear existing places:', deleteError);
    }

    // 最適化結果から個別のplaceレコードを作成
    const placesToInsert: any[] = [];
    let globalVisitOrder = 1;

    if (optimizationResult.multiDaySchedule?.days) {
      for (const day of optimizationResult.multiDaySchedule.days) {
        if (day.destinations) {
          for (const dest of day.destinations) {
            placesToInsert.push({
              group_id: groupId,
              name: dest.name,
              address: dest.address || null,
              latitude: dest.coordinates?.lat || null,
              longitude: dest.coordinates?.lng || null,
              place_id: dest.destinationId || null,
              visit_order: globalVisitOrder,
              scheduled_date: day.date || null,
              scheduled_duration: dest.allocatedDuration || 60,
              source_places: [], // Could be enhanced to track which my_places contributed
              fairness_score: optimizationResult.optimizationMetrics?.fairnessScore || 0.5,
              transport_mode: 'drive', // Default, could be enhanced from route data
              created_at: new Date().toISOString()
            });
            globalVisitOrder++;
          }
        }
      }
    }

    if (placesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('places')
        .insert(placesToInsert);

      if (insertError) {
        console.error('Failed to save places to database:', insertError);
        throw new Error(`Failed to save optimization results to places table: ${insertError.message}`);
      }

      console.log(`✅ Successfully saved ${placesToInsert.length} places to places table`);
    } else {
      console.log('⚠️ No places to save to places table');
    }

  } catch (error) {
    console.error('Error saving optimization to places table:', error);
    // エラーでも本体の最適化は成功させる（JSONBには保存済み）
    console.warn('⚠️ Places table storage failed, but JSONB storage succeeded');
  }
}

// Additional utilities are available as internal classes but not exported from server actions
