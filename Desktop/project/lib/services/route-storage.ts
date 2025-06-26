// Database operations for route storage and management

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import type {
  StoredRouteData,
  OptimizedRoute,
  RouteQueryOptions,
  OptimizationMetrics,
  RouteVersion,
  RouteChangeLog,
  RouteUpdateConflict,
  ValidationResult,
  ValidationError
} from '@/lib/types/route-storage'
import {
  RouteStorageError,
  ConflictResolutionRequiredError
} from '@/lib/types/route-storage'

// Supabase client will be created in each method with server context

/**
 * Data validation utilities
 */
export function validateRouteData(routeData: StoredRouteData): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  // Validate required fields
  if (!routeData.status) {
    errors.push({ field: 'status', message: 'Missing route status' })
  }

  if (!routeData.multiDaySchedule?.days?.length) {
    errors.push({ field: 'multiDaySchedule.days', message: 'No scheduled days' })
  }

  if (!routeData.optimizationMetrics) {
    errors.push({ field: 'optimizationMetrics', message: 'Missing optimization metrics' })
  }

  // Validate data consistency
  routeData.multiDaySchedule?.days?.forEach((day, dayIndex) => {
    if (!day.date) {
      errors.push({ 
        field: `multiDaySchedule.days[${dayIndex}].date`, 
        message: 'Missing date for day'
      })
    }

    day.destinations?.forEach((dest, destIndex) => {
      if (!dest.destinationId) {
        errors.push({
          field: `multiDaySchedule.days[${dayIndex}].destinations[${destIndex}].destinationId`,
          message: 'Missing destination ID'
        })
      }

      if (dest.allocatedDuration <= 0) {
        errors.push({
          field: `multiDaySchedule.days[${dayIndex}].destinations[${destIndex}].allocatedDuration`,
          message: 'Invalid duration',
          value: dest.allocatedDuration
        })
      }

      if (!dest.startTime || !dest.endTime) {
        errors.push({
          field: `multiDaySchedule.days[${dayIndex}].destinations[${destIndex}].startTime`,
          message: 'Missing start or end time'
        })
      }

      // Validate coordinates
      if (!dest.coordinates || 
          typeof dest.coordinates.lat !== 'number' || 
          typeof dest.coordinates.lng !== 'number') {
        errors.push({
          field: `multiDaySchedule.days[${dayIndex}].destinations[${destIndex}].coordinates`,
          message: 'Invalid coordinates'
        })
      }

      // Check for reasonable coordinate ranges
      if (dest.coordinates && (
        Math.abs(dest.coordinates.lat) > 90 || 
        Math.abs(dest.coordinates.lng) > 180
      )) {
        warnings.push(`Day ${dayIndex + 1}, destination ${destIndex + 1}: Coordinates may be out of range`)
      }
    })
  })

  // Validate generation info
  if (!routeData.generationInfo?.algorithmVersion) {
    warnings.push('Missing algorithm version information')
  }

  if (!routeData.generationInfo?.generatedAt) {
    errors.push({ field: 'generationInfo.generatedAt', message: 'Missing generation timestamp' })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Core route storage operations
 */
export class RouteStorageService {
  
  /**
   * Save optimization result to database
   */
  async saveOptimizationResult(
    groupId: string,
    routeData: StoredRouteData,
    metrics: OptimizationMetrics,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<OptimizedRoute> {
    try {
      // Validate route data before saving
      const validation = validateRouteData(routeData)
      if (!validation.isValid) {
        throw new RouteStorageError(
          'Invalid route data',
          'VALIDATION_ERROR',
          validation.errors
        )
      }

      // Create version before update
      await this.createRouteVersion(groupId, routeData, {
        userId,
        sessionId,
        changeType: 'optimization',
        changeDescription: 'Automatic optimization result save'
      })

      const version = Date.now()
      
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .from('optimized_routes')
        .upsert({
          group_id: groupId,
          route_data: routeData,
          fairness_score: metrics.fairnessScore,
          total_distance: metrics.totalDistance,
          total_duration: metrics.totalDuration,
          version: version,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'group_id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (error) {
        throw new RouteStorageError(
          `Failed to save optimization result: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      // Log the change
      await this.logRouteChange({
        group_id: groupId,
        user_id: userId || null,
        session_id: sessionId || null,
        change_type: 'preference_update',
        old_value: null,
        new_value: { version, fairness_score: metrics.fairnessScore },
        impact_metrics: {
          fairness_score_change: 0,
          total_time_change: 0,
          total_distance_change: 0,
          affected_users: [],
          satisfaction_change: 0
        }
      })

      // 🎯 NEW: Extract and save individual places from optimization result
      await this.saveOptimizedPlaces(groupId, routeData)

      return data
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error saving route',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Get route by group ID
   */
  async getRoute(groupId: string): Promise<OptimizedRoute | null> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .from('optimized_routes')
        .select('*')
        .eq('group_id', groupId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // No route found
        }
        throw new RouteStorageError(
          `Failed to get route: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error fetching route',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Query routes with filters
   */
  async queryRoutes(options: RouteQueryOptions): Promise<OptimizedRoute[]> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      let query = supabase.from('optimized_routes').select('*')

      // Apply filters
      if (options.group_id) {
        query = query.eq('group_id', options.group_id)
      }

      if (options.date_range) {
        query = query
          .gte('created_at', options.date_range.start)
          .lte('created_at', options.date_range.end)
      }

      if (options.min_fairness_score) {
        query = query.gte('fairness_score', options.min_fairness_score)
      }

      if (options.max_distance) {
        query = query.lte('total_distance', options.max_distance)
      }

      if (options.max_duration) {
        query = query.lte('total_duration', options.max_duration)
      }

      // Apply ordering
      if (options.order_by) {
        query = query.order(options.order_by, { 
          ascending: options.order_direction === 'asc' 
        })
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new RouteStorageError(
          `Failed to query routes: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data || []
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error querying routes',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Update route with conflict detection
   */
  async updateRoute(
    groupId: string,
    updates: Partial<StoredRouteData>,
    currentVersion: number,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<OptimizedRoute> {
    try {
      // Get current route to check for conflicts
      const currentRoute = await this.getRoute(groupId)
      
      if (!currentRoute) {
        throw new RouteStorageError(
          'Route not found',
          'NOT_FOUND'
        )
      }

      // Check for version conflict
      if (currentRoute.version !== currentVersion) {
        const conflict: RouteUpdateConflict = {
          local_version: currentVersion,
          server_version: currentRoute.version,
          conflicting_fields: Object.keys(updates),
          local_changes: updates,
          server_changes: currentRoute.route_data,
          resolution_strategy: 'manual',
          conflict_id: `conflict_${Date.now()}`,
          created_at: new Date().toISOString()
        }

        throw new ConflictResolutionRequiredError(conflict)
      }

      // Merge updates with current data
      const updatedRouteData = {
        ...currentRoute.route_data,
        ...updates
      }

      // Validate updated data
      const validation = validateRouteData(updatedRouteData)
      if (!validation.isValid) {
        throw new RouteStorageError(
          'Invalid updated route data',
          'VALIDATION_ERROR',
          validation.errors
        )
      }

      // Create version before update
      await this.createRouteVersion(groupId, currentRoute.route_data, {
        userId,
        sessionId,
        changeType: 'manual_edit',
        changeDescription: 'Manual route update'
      })

      const newVersion = Date.now()

      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .from('optimized_routes')
        .update({
          route_data: updatedRouteData,
          version: newVersion,
          created_at: new Date().toISOString()
        })
        .eq('group_id', groupId)
        .select()
        .single()

      if (error) {
        throw new RouteStorageError(
          `Failed to update route: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data
    } catch (error) {
      if (error instanceof RouteStorageError || error instanceof ConflictResolutionRequiredError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error updating route',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Delete route
   */
  async deleteRoute(groupId: string): Promise<void> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { error } = await supabase
        .from('optimized_routes')
        .delete()
        .eq('group_id', groupId)

      if (error) {
        throw new RouteStorageError(
          `Failed to delete route: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error deleting route',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Version control operations
   */
  async createRouteVersion(
    groupId: string,
    routeData: StoredRouteData,
    changeInfo: {
      userId?: string | null
      sessionId?: string | null
      changeType: string
      changeDescription: string
    }
  ): Promise<number> {
    try {
      const version = Date.now()

      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { error } = await supabase
        .from('route_versions')
        .insert({
          group_id: groupId,
          version: version,
          user_id: changeInfo.userId,
          session_id: changeInfo.sessionId,
          change_type: changeInfo.changeType,
          change_description: changeInfo.changeDescription,
          route_data_snapshot: routeData,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to create route version:', error)
        // Don't throw error as this is not critical for main operation
      }

      return version
    } catch (error) {
      console.error('Unexpected error creating route version:', error)
      return Date.now()
    }
  }

  /**
   * Get route versions
   */
  async getRouteVersions(groupId: string, limit: number = 10): Promise<RouteVersion[]> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .from('route_versions')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new RouteStorageError(
          `Failed to get route versions: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data || []
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error getting route versions',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * Log route changes
   */
  async logRouteChange(changeLog: Omit<RouteChangeLog, 'id' | 'timestamp' | 'created_at'>): Promise<void> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { error } = await supabase
        .from('route_change_logs')
        .insert({
          ...changeLog,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to log route change:', error)
        // Don't throw error as this is not critical for main operation
      }
    } catch (error) {
      console.error('Unexpected error logging route change:', error)
    }
  }

  /**
   * Get route change history
   */
  async getRouteChangeHistory(groupId: string, limit: number = 50): Promise<RouteChangeLog[]> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .from('route_change_logs')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new RouteStorageError(
          `Failed to get route change history: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data || []
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error getting route change history',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  /**
   * 🎯 NEW: Save optimized places to places table
   * Extract individual place records from JSON route data
   */
  async saveOptimizedPlaces(groupId: string, routeData: StoredRouteData): Promise<void> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);

      // First, delete existing places for this group
      const { error: deleteError } = await supabase
        .from('places')
        .delete()
        .eq('group_id', groupId)

      if (deleteError) {
        console.error('Failed to delete existing places:', deleteError)
      }

      // Extract places from route data
      const places: any[] = []
      let globalVisitOrder = 0

      routeData.multiDaySchedule?.days?.forEach((day) => {
        day.destinations?.forEach((dest) => {
          globalVisitOrder++
          places.push({
            group_id: groupId,
            name: dest.name,
            address: dest.address || '',
            latitude: dest.coordinates?.lat || 0,
            longitude: dest.coordinates?.lng || 0,
            place_id: dest.destinationId || null,
            visit_order: globalVisitOrder,
            scheduled_date: day.date || null,
            scheduled_duration: dest.allocatedDuration || 60,
            duration: dest.allocatedDuration || 60, // Add duration field
            source_places: [], // TODO: Track source my_places IDs
            fairness_score: null, // Can be calculated if needed
            transport_mode: dest.transportToNext?.mode || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        })
      })

      // Insert new places
      if (places.length > 0) {
        const { error: insertError } = await supabase
          .from('places')
          .insert(places)

        if (insertError) {
          console.error('Failed to insert optimized places:', insertError)
          // Don't throw - this shouldn't break the main optimization flow
        } else {
          console.log(`✅ Saved ${places.length} optimized places to places table`)
        }
      }
    } catch (error) {
      console.error('Error saving optimized places:', error)
      // Don't throw - this shouldn't break the main optimization flow
    }
  }

  /**
   * JSONB query utilities
   */
  async findRoutesContainingDestination(destinationId: string): Promise<OptimizedRoute[]> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .rpc('find_routes_containing_destination', {
          destination_id: destinationId
        })

      if (error) {
        throw new RouteStorageError(
          `Failed to find routes containing destination: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data || []
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error finding routes by destination',
        'UNKNOWN_ERROR',
        error
      )
    }
  }

  async findRoutesForUser(userId: string): Promise<OptimizedRoute[]> {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .rpc('find_routes_for_user', {
          user_id: userId
        })

      if (error) {
        throw new RouteStorageError(
          `Failed to find routes for user: ${error.message}`,
          'DATABASE_ERROR',
          error
        )
      }

      return data || []
    } catch (error) {
      if (error instanceof RouteStorageError) {
        throw error
      }
      throw new RouteStorageError(
        'Unexpected error finding routes by user',
        'UNKNOWN_ERROR',
        error
      )
    }
  }
}

// Export singleton instance
export const routeStorageService = new RouteStorageService()
export default routeStorageService