/**
 * Trip Optimization Service - Phase 3 Integration
 * Handles all optimization stages: normalization, selection, and routing
 * Integrates with new Edge Functions pipeline
 */

import { supabase } from '../lib/supabase'
import { 
  Place, 
  Trip, 
  OptimizationSettings as TypedOptimizationSettings,
  OptimizationStage,
  OptimizationErrorType,
  EnhancedOptimizationError,
  LoadingState
} from '../types/optimization'
import { RetryHandler } from '../utils/RetryHandler'

export interface OptimizationSettings {
  fairness_weight?: number // 0.0 to 1.0, default 0.6
  efficiency_weight?: number // 0.0 to 1.0, default 0.4
  include_meals?: boolean // default true
  preferred_transport?: 'walking' | 'car' | 'flight'
}

export interface OptimizedRoute {
  daily_schedules: DailySchedule[]
  optimization_score: OptimizationScore
  execution_time_ms: number
  total_travel_time_minutes: number
  total_visit_time_minutes: number
  created_by: string
}

export interface DailySchedule {
  date: string
  scheduled_places: ScheduledPlace[]
  meal_breaks: MealBreak[]
  total_travel_time: number
  total_visit_time: number
}

export interface ScheduledPlace {
  place: any
  arrival_time: string
  departure_time: string
  travel_time_from_previous: number
  transport_mode: 'walking' | 'car' | 'flight'
  order_in_day: number
}

export interface MealBreak {
  type: 'breakfast' | 'lunch' | 'dinner'
  start_time: string
  end_time: string
  estimated_cost?: number
}

export interface OptimizationScore {
  overall: number
  fairness: number
  efficiency: number
  details: {
    user_adoption_balance: number
    wish_satisfaction_balance: number
    travel_efficiency: number
    time_constraint_compliance: number
  }
}

export interface OptimizationResult {
  success: boolean
  optimization_result: OptimizedRoute
  execution_time_ms: number
  result_id?: string
  cached: boolean
  message: string
}

// Optimization stage tracking
export type OptimizationStage = 'collecting' | 'normalizing' | 'selecting' | 'routing' | 'complete' | 'error'

export interface OptimizationProgress {
  stage: OptimizationStage
  progress: number // 0-100
  message: string
  executionTimeMs?: number
  error?: string
}

export interface NormalizationResult {
  success: boolean
  result: {
    tripId: string
    normalizedUsers: any[]
    totalPlaces: number
    groupFairnessScore: number
    executionTimeMs: number
  }
  cached: boolean
  message: string
}

export interface PlaceSelectionResult {
  success: boolean
  result: {
    tripId: string
    selectedPlaces: any[]
    totalPlacesConsidered: number
    selectionRounds: number
    finalFairnessScore: number
    userFairnessScores: Record<string, number>
    executionTimeMs: number
  }
  cached: boolean
  message: string
}

export class TripOptimizationService {
  private static readonly DEFAULT_SETTINGS: OptimizationSettings = {
    fairness_weight: 0.6,
    efficiency_weight: 0.4,
    include_meals: true,
    preferred_transport: 'car'
  }

  /**
   * Full optimization pipeline: normalize → select → route
   */
  static async optimizeTrip(
    tripId: string,
    settings: Partial<OptimizationSettings> = {},
    onProgress?: (progress: OptimizationProgress) => void
  ): Promise<OptimizationResult> {
    try {
      const optimizationSettings = { ...this.DEFAULT_SETTINGS, ...settings }
      
      console.log('Starting full optimization pipeline for trip:', tripId)
      console.log('Settings:', optimizationSettings)

      // Stage 1: Normalize preferences
      onProgress?.({ 
        stage: 'normalizing', 
        progress: 10, 
        message: 'Normalizing user preferences...' 
      })
      
      const normalizationResult = await this.normalizePreferences(tripId)
      
      if (!normalizationResult.success) {
        throw new Error('Preference normalization failed')
      }

      // Stage 2: Select optimal places
      onProgress?.({ 
        stage: 'selecting', 
        progress: 40, 
        message: 'Selecting optimal places...' 
      })
      
      const selectionResult = await this.selectOptimalPlaces(tripId, {
        max_places: 20,
        fairness_weight: optimizationSettings.fairness_weight
      })

      if (!selectionResult.success) {
        throw new Error('Place selection failed')
      }

      // Stage 3: Optimize route using constrained generation
      onProgress?.({ 
        stage: 'routing', 
        progress: 70, 
        message: 'Optimizing route and scheduling...' 
      })

      const result = await this.optimizeRouteWithConstraints(tripId, optimizationSettings)
      
      // Stage 4: Update places with schedule information
      if (result.success && result.optimization_result) {
        onProgress?.({ 
          stage: 'complete', 
          progress: 90, 
          message: 'Updating place schedules...' 
        })
        
        await this.updatePlacesWithSchedule(tripId, result.optimization_result)
      }
      
      onProgress?.({ 
        stage: 'complete', 
        progress: 100, 
        message: 'Optimization completed successfully!',
        executionTimeMs: result.execution_time_ms
      })
      
      console.log('Full optimization completed:', result)
      
      return result
    } catch (error) {
      console.error('Full optimization error:', error)
      onProgress?.({ 
        stage: 'error', 
        progress: 0, 
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Step 1: Normalize user preferences
   */
  static async normalizePreferences(tripId: string): Promise<NormalizationResult> {
    try {
      console.log('Normalizing preferences for trip:', tripId)

      const response = await supabase.functions.invoke('normalize-preferences', {
        body: {
          trip_id: tripId,
          force_refresh: false
        }
      })

      if (response.error) {
        throw new Error(response.error.message || 'Normalization failed')
      }

      return response.data as NormalizationResult
    } catch (error) {
      console.error('Preference normalization error:', error)
      throw error
    }
  }

  /**
   * Step 2: Select optimal places
   */
  static async selectOptimalPlaces(
    tripId: string,
    options: {
      max_places?: number
      fairness_weight?: number
    } = {}
  ): Promise<PlaceSelectionResult> {
    try {
      console.log('Selecting optimal places for trip:', tripId)

      const response = await supabase.functions.invoke('select-optimal-places', {
        body: {
          trip_id: tripId,
          max_places: options.max_places || 20,
          fairness_weight: options.fairness_weight || 0.6
        }
      })

      if (response.error) {
        throw new Error(response.error.message || 'Place selection failed')
      }

      return response.data as PlaceSelectionResult
    } catch (error) {
      console.error('Place selection error:', error)
      throw error
    }
  }

  /**
   * Step 3: Optimize route using comprehensive constrained route generation
   */
  static async optimizeRouteWithConstraints(
    tripId: string, 
    settings: OptimizationSettings = {}
  ): Promise<OptimizationResult> {
    console.log('Optimizing route with constrained generation for trip:', tripId)
    
    // First, get trip data to extract places and departure info
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (tripError) {
      throw new Error(`Failed to get trip data: ${tripError.message}`)
    }

    // Get places for the trip
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at')

    if (placesError) {
      throw new Error(`Failed to get places: ${placesError.message}`)
    }

    // Separate system places (departure/destination) from user places
    const systemPlaces = places?.filter(p => p.source === 'system') || []
    const userPlaces = places?.filter(p => p.source !== 'system') || []
    
    const departurePlace = systemPlaces.find(p => 
      p.category === 'departure_point' || p.place_type === 'departure'
    ) || userPlaces[0] // Fallback to first user place if no system departure

    if (!departurePlace) {
      throw new Error('No departure location found for trip')
    }

    const destinationPlace = systemPlaces.find(p => 
      p.category === 'destination_point' || p.place_type === 'destination'
    )

    const constraintsSettings = {
      maxDailyHours: 12,
      mealBreaks: {
        breakfast: { start: 8, duration: 60 },
        lunch: { start: 12, duration: 90 },
        dinner: { start: 18, duration: 120 }
      },
      transportModes: {
        walkingMaxKm: 1,
        publicTransportMaxKm: 20,
        carMinKm: 20,
        flightMinKm: 200
      }
    }

    const response = await supabase.functions.invoke('constrained-route-generation', {
      body: {
        tripId: tripId,
        userId: trip.owner_id,
        places: userPlaces.map(p => ({
          id: p.id,
          name: p.name,
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          wish_level: p.wish_level,
          stay_duration_minutes: p.stay_duration_minutes,
          user_id: p.user_id,
          category: p.category
        })),
        departure: {
          id: departurePlace.id,
          name: departurePlace.name,
          latitude: parseFloat(departurePlace.latitude),
          longitude: parseFloat(departurePlace.longitude),
          wish_level: departurePlace.wish_level,
          stay_duration_minutes: departurePlace.stay_duration_minutes,
          user_id: departurePlace.user_id,
          category: departurePlace.category
        },
        destination: destinationPlace ? {
          id: destinationPlace.id,
          name: destinationPlace.name,
          latitude: parseFloat(destinationPlace.latitude),
          longitude: parseFloat(destinationPlace.longitude),
          wish_level: destinationPlace.wish_level,
          stay_duration_minutes: destinationPlace.stay_duration_minutes,
          user_id: destinationPlace.user_id,
          category: destinationPlace.category
        } : null,
        constraints: constraintsSettings
      }
    })

    if (response.error) {
      throw new Error(response.error.message || 'Constrained route generation failed')
    }

    // Convert the constrained route format to the expected OptimizationResult format
    const constrainedResult = response.data
    
    const optimizedRoute: OptimizedRoute = {
      daily_schedules: constrainedResult.result.dailyRoutes.map((route: any) => ({
        date: route.date,
        scheduled_places: route.places.map((place: any, index: number) => ({
          place: {
            id: place.id,
            name: place.name,
            category: place.category,
            latitude: place.latitude,
            longitude: place.longitude,
            wish_level: place.wish_level,
            stay_duration_minutes: place.stay_duration_minutes,
            user_id: place.user_id,
            trip_id: tripId
          },
          arrival_time: place.arrivalTime,
          departure_time: place.departureTime,
          travel_time_from_previous: place.travelTimeMinutes || 0,
          transport_mode: place.transportToNext || 'walking',
          order_in_day: index + 1
        })),
        meal_breaks: route.mealBreaks.map((meal: any) => ({
          type: meal.type,
          start_time: meal.startTime,
          end_time: meal.endTime,
          estimated_cost: meal.type === 'breakfast' ? 800 : meal.type === 'lunch' ? 1200 : 2000
        })),
        total_travel_time: constrainedResult.result.totalTravelTime,
        total_visit_time: constrainedResult.result.totalVisitTime
      })),
      optimization_score: constrainedResult.result.optimizationScore,
      execution_time_ms: constrainedResult.executionTimeMs,
      total_travel_time_minutes: constrainedResult.result.totalTravelTime,
      total_visit_time_minutes: constrainedResult.result.totalVisitTime,
      created_by: trip.owner_id
    }

    return {
      success: true,
      optimization_result: optimizedRoute,
      execution_time_ms: constrainedResult.executionTimeMs,
      cached: false,
      message: 'Route optimized successfully with constrained generation'
    }
  }

  /**
   * Test Edge Functions connectivity
   */
  static async testConnectivity(): Promise<{ normalize: boolean, select: boolean, route: boolean }> {
    const results = { normalize: false, select: false, route: false }

    try {
      // Test normalize-preferences
      const normalizeResponse = await supabase.functions.invoke('normalize-preferences', {
        body: { type: 'keep_alive' }
      })
      results.normalize = normalizeResponse.data?.message === 'pong'

      // Test select-optimal-places
      const selectResponse = await supabase.functions.invoke('select-optimal-places', {
        body: { type: 'keep_alive' }
      })
      results.select = selectResponse.data?.message === 'pong'

      // Test optimize-route
      const routeResponse = await supabase.functions.invoke('optimize-route', {
        body: { type: 'keep_alive' }
      })
      results.route = routeResponse.data?.message === 'pong'

    } catch (error) {
      console.error('Connectivity test error:', error)
    }

    return results
  }

  /**
   * Get optimization result for a trip
   */
  static async getOptimizationResult(tripId: string): Promise<OptimizedRoute | null> {
    try {
      const { data, error } = await supabase
        .from('optimization_results')
        .select('*')
        .eq('trip_id', tripId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        console.log('No optimization result found for trip:', tripId)
        return null
      }

      return {
        daily_schedules: data.optimized_route,
        optimization_score: data.optimization_score,
        execution_time_ms: data.execution_time_ms,
        total_travel_time_minutes: data.total_travel_time_minutes,
        total_visit_time_minutes: data.total_visit_time_minutes,
        created_by: data.created_by
      }
    } catch (error) {
      console.error('Error fetching optimization result:', error)
      return null
    }
  }

  /**
   * Format optimization result for display
   */
  static formatOptimizationResult(result: OptimizedRoute): {
    summary: string
    schedulesByDay: { [date: string]: ScheduledPlace[] }
    totalStats: {
      places: number
      travelTime: number
      visitTime: number
      score: number
    }
  } {
    const schedulesByDay: { [date: string]: ScheduledPlace[] } = {}
    let totalPlaces = 0

    result.daily_schedules.forEach(schedule => {
      schedulesByDay[schedule.date] = schedule.scheduled_places
      totalPlaces += schedule.scheduled_places.length
    })

    const summary = `Optimized ${totalPlaces} places across ${result.daily_schedules.length} days. ` +
      `Overall score: ${(result.optimization_score.overall * 100).toFixed(0)}% ` +
      `(Fairness: ${(result.optimization_score.fairness * 100).toFixed(0)}%, ` +
      `Efficiency: ${(result.optimization_score.efficiency * 100).toFixed(0)}%)`

    return {
      summary,
      schedulesByDay,
      totalStats: {
        places: totalPlaces,
        travelTime: result.total_travel_time_minutes,
        visitTime: result.total_visit_time_minutes,
        score: result.optimization_score.overall
      }
    }
  }

  /**
   * Get readable time from minutes
   */
  static formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    
    if (hours === 0) {
      return `${mins}min`
    } else if (mins === 0) {
      return `${hours}h`
    } else {
      return `${hours}h ${mins}min`
    }
  }

  /**
   * Get transport mode icon
   */
  static getTransportIcon(mode: string): string {
    switch (mode) {
      case 'walking':
      case 'walk':
        return '🚶'
      case 'car':
        return '🚗'
      case 'flight':
        return '✈️'
      default:
        return '🚗' // デフォルトは車
    }
  }

  /**
   * Get optimization statistics for UI display (compatibility method)
   */
  static getOptimizationStats(places: any[]): {
    total: number
    scheduled: number
    unscheduled: number
    mustVisit: number
    highPriority: number
    totalDuration: number
  } {
    const scheduled = places.filter(p => p.scheduled)
    const unscheduled = places.filter(p => !p.scheduled)
    
    return {
      total: places.length,
      scheduled: scheduled.length,
      unscheduled: unscheduled.length,
      mustVisit: places.filter(p => p.wishLevel === 5).length,
      highPriority: places.filter(p => p.wishLevel >= 4).length,
      totalDuration: scheduled.reduce((sum, p) => sum + (p.stayDuration || 0), 0)
    }
  }

  // Enhanced error handling utilities
  private static combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    
    const validSignals = signals.filter(signal => signal !== undefined) as AbortSignal[];
    
    if (validSignals.length === 0) {
      return controller.signal;
    }
    
    const abortHandler = () => {
      controller.abort();
    };
    
    validSignals.forEach(signal => {
      if (signal.aborted) {
        controller.abort();
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    });
    
    return controller.signal;
  }

  private static getRetryConfig(configType: 'default' | 'aggressive' | 'conservative' = 'default') {
    switch (configType) {
      case 'aggressive':
        return RetryHandler.AGGRESSIVE_RETRY_CONFIG;
      case 'conservative':
        return RetryHandler.CONSERVATIVE_RETRY_CONFIG;
      case 'default':
      default:
        return RetryHandler.DEFAULT_RETRY_CONFIG;
    }
  }

  /**
   * Update places with schedule information from optimization result
   */
  static async updatePlacesWithSchedule(tripId: string, optimizedRoute: OptimizedRoute): Promise<void> {
    try {
      console.log('Updating places with schedule for trip:', tripId)
      
      // First, reset all places to unscheduled
      await supabase
        .from('places')
        .update({
          scheduled: false,
          scheduled_date: null,
          scheduled_time_start: null,
          scheduled_time_end: null,
          transport_mode: null,
          travel_time_from_previous: null
        })
        .eq('trip_id', tripId)

      // Then update scheduled places from optimization result
      for (const daySchedule of optimizedRoute.daily_schedules) {
        for (const scheduledPlace of daySchedule.scheduled_places) {
          await supabase
            .from('places')
            .update({
              scheduled: true,
              scheduled_date: daySchedule.date,
              scheduled_time_start: scheduledPlace.arrival_time,
              scheduled_time_end: scheduledPlace.departure_time,
              transport_mode: scheduledPlace.transport_mode,
              travel_time_from_previous: scheduledPlace.travel_time_from_previous
            })
            .eq('id', scheduledPlace.place.id)
            .eq('trip_id', tripId)
        }
      }
      
      console.log('Places updated with schedule successfully')
    } catch (error) {
      console.error('Error updating places with schedule:', error)
      throw error
    }
  }

  // Enhanced connectivity check with timeout
  static async checkEdgeFunctionConnectivity(timeoutMs = 10000): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No authentication session available');
      }

      const testUrl = `${supabase.supabaseUrl}/functions/v1/normalize-preferences`;
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ test: true }),
        signal: controller.signal,
      });

      // We expect this to fail with a validation error, which means the service is reachable
      if (response.status !== 400 && !response.ok) {
        throw new Error(`Edge Functions unavailable: ${response.status}`);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Edge Functions connectivity check timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}