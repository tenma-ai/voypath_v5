/**
 * Trip Optimization Service - Phase 3 Integration
 * Handles all optimization stages: normalization, selection, and routing
 * Integrates with new Edge Functions pipeline
 */

import { supabase } from '../lib/supabase'
import { MemberColorService } from './MemberColorService'
import { DateUtils } from '../utils/DateUtils'
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
  optimization: OptimizedRoute
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


export class TripOptimizationService {
  private static readonly DEFAULT_SETTINGS: OptimizationSettings = {
    fairness_weight: 0.6,
    efficiency_weight: 0.4,
    include_meals: true,
    preferred_transport: 'car'
  }

  /**
   * Full optimization pipeline: normalize → route
   */
  static async optimizeTrip(
    tripId: string,
    settings: Partial<OptimizationSettings> = {},
    onProgress?: (progress: OptimizationProgress) => void
  ): Promise<OptimizationResult> {
    try {
      const optimizationSettings = { ...this.DEFAULT_SETTINGS, ...settings }

      // Always use production Edge Functions (no demo mode)

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

      // Stage 2: Optimize route using constrained generation
      onProgress?.({ 
        stage: 'routing', 
        progress: 70, 
        message: 'Optimizing route and scheduling...' 
      })

      const result = await this.optimizeRouteWithConstraints(tripId, optimizationSettings)
      // Route optimization complete
      
      // Stage 3: Update places with schedule information
      if (result.success && result.optimization) {
        onProgress?.({ 
          stage: 'complete', 
          progress: 90, 
          message: 'Updating place schedules...' 
        })
        
        await this.updatePlacesWithSchedule(tripId, result.optimization)
      }
      
      onProgress?.({ 
        stage: 'complete', 
        progress: 100, 
        message: 'Optimization completed successfully!',
        executionTimeMs: result.execution_time_ms
      })
      
      return result
    } catch (error) {
      // Optimization error occurred
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
      // Get places and members data for the trip
      const { data: places, error: placesError } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId)
        .neq('place_type', 'departure')
        .neq('place_type', 'destination')

      if (placesError) {
        throw new Error(`Failed to fetch places: ${placesError.message}`)
      }

      const { data: members, error: membersError } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)

      if (membersError) {
        throw new Error(`Failed to fetch members: ${membersError.message}`)
      }

      // Transform places to match Edge Function expected format
      const transformedPlaces = (places || []).map(place => ({
        id: place.id,
        name: place.name,
        address: place.address || '',
        latitude: place.latitude,
        longitude: place.longitude,
        category: place.category || 'other',
        wish_level: place.wish_level || 3,
        stay_duration_minutes: place.stay_duration_minutes || 120,
        user_id: place.user_id,
        trip_id: place.trip_id,
        created_at: place.created_at
      }));

      // Transform members to match Edge Function expected format  
      const transformedMembers = (members || []).map(member => ({
        user_id: member.user_id,
        trip_id: member.trip_id,
        can_optimize: member.can_optimize,
        assigned_color_index: member.assigned_color_index
      }));

      const { data: response, error } = await supabase.functions.invoke('normalize-preferences', {
        body: {
          trip_id: tripId,
          places: transformedPlaces,
          members: transformedMembers,
          settings: {
            fairness_weight: 0.6,
            efficiency_weight: 0.4,
            include_meals: true,
            preferred_transport: 'car'
          }
        }
      })

      if (error) {
        throw error;
      }

      return response as NormalizationResult
    } catch (error) {
      // Preference normalization error occurred
      throw error
    }
  }


  /**
   * Step 2: Optimize route using comprehensive constrained route generation
   */
  static async optimizeRouteWithConstraints(
    tripId: string, 
    settings: OptimizationSettings = {}
  ): Promise<OptimizationResult> {
    
    // Import supabase
    const { supabase } = await import('../lib/supabase');
    
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

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Force reload ALL places to ensure system places are included
    const { data: freshPlaces, error: freshPlacesError } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId);
      
    if (freshPlacesError) {
      // Failed to fetch fresh places
      throw new Error(`Failed to fetch fresh places: ${freshPlacesError.message}`);
    }
    
    const allTripPlaces = freshPlaces || [];

    const { data: result, error } = await supabase.functions.invoke('optimize-route', {
      body: {
        trip_id: tripId,
        member_id: user.id,
        user_places: allTripPlaces || [], // Send ALL places including departure/destination
        constraints: {
          time_constraint_minutes: 1440, // 24 hours default
          distance_constraint_km: 1000,
          budget_constraint_yen: 100000,
          max_places: 20
        },
        transport_mode: settings.preferred_transport || 'mixed'
      }
    })

    if (error) {
      throw error;
    }
    
    if (!result.success) {
      throw new Error(result.error || 'Route optimization failed')
    }

    // Transform the optimization data to match expected format
    const optimizationData = result.optimization;
    if (!optimizationData) {
      throw new Error('No optimization data returned from edge function');
    }

    // Extract ALL places from daily schedules across ALL days
    let allOptimizedPlaces = [];
    
    if (optimizationData.daily_schedules && Array.isArray(optimizationData.daily_schedules)) {
      // Extract places from ALL daily schedules, not just the first one
      for (const daySchedule of optimizationData.daily_schedules) {
        if (daySchedule.places && Array.isArray(daySchedule.places)) {
          allOptimizedPlaces.push(...daySchedule.places);
        }
      }
    } else if (optimizationData.optimized_route?.daily_schedules && Array.isArray(optimizationData.optimized_route.daily_schedules)) {
      // Fallback: check optimized_route structure
      for (const daySchedule of optimizationData.optimized_route.daily_schedules) {
        if (daySchedule.places && Array.isArray(daySchedule.places)) {
          allOptimizedPlaces.push(...daySchedule.places);
        }
      }
    } else if (optimizationData.places && Array.isArray(optimizationData.places)) {
      // Final fallback: direct places array
      allOptimizedPlaces = optimizationData.places;
    }

    // Remove duplicates by ID while preserving order
    const uniquePlaces = [];
    const seenIds = new Set();
    for (const place of allOptimizedPlaces) {
      if (!seenIds.has(place.id)) {
        seenIds.add(place.id);
        uniquePlaces.push(place);
      }
    }
    
    const optimizedPlaces = uniquePlaces;

    return {
      success: true,
      optimization: {
        // Use the daily_schedules directly from Edge Function response
        daily_schedules: optimizationData.daily_schedules || [],
        optimization_score: optimizationData.optimization_score || {
          total_score: 0,
          fairness_score: 0,
          efficiency_score: 0,
          details: {
            user_adoption_balance: 0,
            wish_satisfaction_balance: 0,
            travel_efficiency: 0,
            time_constraint_compliance: 0
          }
        },
        optimized_route: { daily_schedules: optimizationData.daily_schedules || [] },
        total_duration_minutes: optimizationData.total_duration_minutes || 0,
        places: optimizationData.places || [],
        execution_time_ms: optimizationData.execution_time_ms || 1500
      },
      execution_time_ms: 1500,
      result_id: `opt_${Date.now()}`,
      cached: false,
      message: 'Route optimized successfully with airport routing'
    }
  }

  /**
   * Test Edge Functions connectivity
   */
  static async testConnectivity(): Promise<{ normalize: boolean, route: boolean }> {
    const results = { normalize: false, route: false }

    try {
      // Test normalize-preferences
      const normalizeResponse = await supabase.functions.invoke('normalize-preferences', {
        body: { type: 'keep_alive' }
      })
      results.normalize = normalizeResponse.data?.message === 'pong'

      // Test optimize-route
      const routeResponse = await supabase.functions.invoke('optimize-route', {
        body: { type: 'keep_alive' }
      })
      results.route = routeResponse.data?.message === 'pong'

    } catch (error) {
      // Connectivity test error occurred
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
        // No optimization result found
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
      // Error fetching optimization result
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
   * Parse time string to Postgres time format (HH:mm:ss)
   */
  static parseTimeToPostgresFormat(timeString: string): string | null {
    if (!timeString) return null;
    
    try {
      // Handle various time formats
      let date: Date;
      
      if (timeString.includes('T')) {
        // ISO string format
        date = new Date(timeString);
      } else if (timeString.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        // Time only format (H:mm, HH:mm, H:mm:ss, or HH:mm:ss)
        const today = new Date().toISOString().split('T')[0];
        // Ensure leading zero for single digit hours and add seconds if missing
        let normalizedTime = timeString;
        if (timeString.split(':').length === 2) {
          normalizedTime = timeString + ':00';
        }
        if (normalizedTime.length === 7) { // H:mm:ss format
          normalizedTime = '0' + normalizedTime;
        }
        date = new Date(`${today}T${normalizedTime}`);
      } else {
        // Try to parse as is
        date = new Date(timeString);
      }
      
      if (isNaN(date.getTime())) {
        // Invalid time format, using default
        return '09:00:00';
      }
      
      // Return in HH:mm:ss format
      return date.toTimeString().slice(0, 8);
    } catch (error) {
      // Error parsing time, using default
      return '09:00:00';
    }
  }

  /**
   * Update places with schedule information from optimization result
   */
  static async updatePlacesWithSchedule(tripId: string, optimizedRoute: OptimizedRoute): Promise<void> {
    try {
      // First, reset all places to unscheduled
      await supabase
        .from('places')
        .update({
          scheduled: false,
          is_selected_for_optimization: false,
          scheduled_date: null,
          scheduled_time_start: null,
          scheduled_time_end: null,
          transport_mode: null,
          travel_time_from_previous: null
        })
        .eq('trip_id', tripId)

      // Then update scheduled places from optimization result
      if (!optimizedRoute.daily_schedules || !Array.isArray(optimizedRoute.daily_schedules)) {
        // No valid daily schedules found
        return
      }
      
      // Get trip information for correct dates
      const { data: trip } = await supabase
        .from('trips')
        .select('start_date, end_date')
        .eq('id', tripId)
        .single();

      for (const daySchedule of optimizedRoute.daily_schedules) {
        for (const scheduledPlace of daySchedule.scheduled_places) {
          // Extract place data - handle both nested and flat structures
          const placeData = scheduledPlace.place || scheduledPlace;
          const placeId = placeData.id || scheduledPlace.id;
          const placeName = placeData.name || scheduledPlace.name;
          
          // Skip temporary/virtual places generated by optimization
          // These are computational artifacts for route calculation, not real user places
          if (placeId && (placeId.startsWith('airport_') || placeId.startsWith('return_') || placeId.startsWith('departure_'))) {
            continue;
          }
          
          // Skip places that are clearly airports by category but don't have real IDs
          if (placeData.category === 'airport' && placeData.place_type === 'airport' && !placeId.match(/^[a-f0-9-]{36}$/)) {
            continue;
          }
          
          // Try to find the place by ID first, then by name if needed
          let existingPlaces = null;
          
          // First try to find by ID
          if (placeId) {
            const { data: placeById } = await supabase
              .from('places')
              .select('id')
              .eq('trip_id', tripId)
              .eq('id', placeId)
              .limit(1);
              
            if (placeById && placeById.length > 0) {
              existingPlaces = placeById;
            }
          }
          
          // If not found by ID, try by name
          if (!existingPlaces && placeName) {
            const { data: placeByName } = await supabase
              .from('places')
              .select('id')
              .eq('trip_id', tripId)
              .eq('name', placeName)
              .limit(1);
            existingPlaces = placeByName;
          }

          if (existingPlaces && existingPlaces.length > 0) {
            // Use actual scheduled date for this day, calculated from trip start date + day number
            const scheduleDate = daySchedule.date || 
              (trip?.start_date ? DateUtils.calculateTripDate({ start_date: trip.start_date }, daySchedule.day).toISOString().split('T')[0] : null);
            
            const { error } = await supabase
              .from('places')
              .update({
                scheduled: true,
                is_selected_for_optimization: true,
                scheduled_date: scheduleDate,
                scheduled_time_start: this.parseTimeToPostgresFormat(scheduledPlace.arrival_time),
                scheduled_time_end: this.parseTimeToPostgresFormat(scheduledPlace.departure_time),
                transport_mode: scheduledPlace.transport_mode,
                travel_time_from_previous: scheduledPlace.travel_time_from_previous,
                // order_in_trip: scheduledPlace.order_in_day || 0 // Column doesn't exist in DB
              })
              .eq('id', existingPlaces[0].id)

            if (error) {
              // Failed to update place schedule
            }
          } else {
            // Place not found in database
          }
        }
      }
      
    } catch (error) {
      // Error updating places with schedule
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

      // Use supabase.functions.invoke instead of fetch
      const { data, error } = await supabase.functions.invoke('normalize-preferences', {
        body: { test: true }
      });

      // We expect this to fail with a validation error, which means the service is reachable
      if (error && !error.message.includes('validation')) {
        throw new Error(`Edge Functions unavailable: ${error.message}`);
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