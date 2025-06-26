// Database integration and route storage types

// Core stored route data structure for JSONB storage
export interface StoredRouteData {
  // Core optimization results
  status: 'success' | 'no_feasible_solution' | 'all_included' | 'over_capacity'
  optimizationMetrics: {
    fairnessScore: number
    totalDistance: number
    totalDuration: number
    clusterCount: number
    destinationCount: number
    averageSatisfaction: number
    efficiencyScore: number
  }
  
  // Detailed itinerary data
  multiDaySchedule: {
    days: Array<{
      date: string
      dayIndex: number
      destinations: Array<{
        destinationId: string
        name: string
        address: string
        coordinates: { lat: number, lng: number }
        startTime: string
        endTime: string
        allocatedDuration: number
        visitOrder: number
        dayVisitOrder: number
        wishfulUsers: Array<{
          userId: string | null
          sessionId: string | null
          displayName: string
          assignedColor: string
          originalRating: number
          standardizedScore: number
          requestedDuration: number
          satisfactionLevel: 'high' | 'medium' | 'low'
        }>
        transportToNext?: {
          mode: 'walk' | 'drive' | 'fly'
          distance: number
          estimatedTime: number
          cost?: number
          routePath: Array<{ lat: number, lng: number }>
          instructions?: string[]
        }
        notes?: string[]
        tags?: string[]
      }>
      accommodationSuggestion?: {
        location: { lat: number, lng: number }
        suggestedArea: string
        estimatedCost: number
        reasoning: string
        confidence: number
      }
      dailyStats: {
        totalDistance: number
        totalTime: number
        destinationCount: number
        averageSatisfaction: number
        intensity: 'light' | 'moderate' | 'packed'
      }
    }>
    totalStats: {
      tripDurationDays: number
      totalDestinations: number
      totalDistance: number
      totalTime: number
      averageDailyDistance: number
      averageDailyTime: number
      restDayRecommendations: string[]
    }
  }
  
  // Visualization-ready data
  visualizationData: {
    mapBounds: {
      north: number
      south: number
      east: number
      west: number
      center: { lat: number, lng: number }
      zoom: number
    }
    colorMappings: {
      [destinationId: string]: {
        primaryColor: string
        userCount: number
        popularityTier: 'single' | 'small_group' | 'popular'
        userColors: string[]
        blendedColor: string
      }
    }
    routeLines: Array<{
      from: { lat: number, lng: number }
      to: { lat: number, lng: number }
      mode: 'walk' | 'drive' | 'fly'
      color: string
      strokeWeight: number
      dashPattern?: number[]
    }>
    statisticalSummary: {
      walkingDistance: number
      drivingDistance: number
      flyingDistance: number
      walkingTime: number
      drivingTime: number
      flyingTime: number
      accommodationPoints: number
      averageDistanceBetweenDestinations: number
      routeEfficiency: number
    }
  }
  
  // Generation metadata
  generationInfo: {
    algorithmVersion: string
    generatedAt: string
    processingTime: number
    inputParameters: {
      startDate?: string
      endDate?: string
      departureLocation: string
      returnLocation?: string
      maxDailyDistance?: number
      maxDailyTime?: number
      transportPreferences: string[]
    }
    userPreferencesSnapshot: Array<{
      userId: string | null
      sessionId: string | null
      destinationId: string
      destinationName: string
      preferenceScore: number
      preferredDuration: number
      notes?: string
      isPersonalFavorite: boolean
      timestamp: string
    }>
    optimizationConstraints: {
      timeConstraints: any[]
      geographicalConstraints: any[]
      userRequirements: any[]
    }
  }
}

// Database record structure
export interface OptimizedRoute {
  id: string
  group_id: string
  route_data: StoredRouteData
  fairness_score: number
  total_distance: number
  total_duration: number
  created_at: string
  version: number
}

// Version control and change tracking
export interface RouteVersion {
  id: string
  group_id: string
  version: number
  timestamp: Date
  user_id: string | null
  session_id: string | null
  change_type: 'optimization' | 'manual_edit' | 'user_preference_update' | 'reorder' | 'time_adjust'
  change_description: string
  route_data_snapshot: StoredRouteData
  created_at: string
}

export interface RouteChangeLog {
  id: string
  group_id: string
  user_id: string | null
  session_id: string | null
  change_type: 'destination_reorder' | 'time_adjustment' | 'destination_exclude' | 'preference_update' | 'destination_add' | 'destination_remove'
  target_destination_id?: string
  old_value: any
  new_value: any
  impact_metrics: {
    fairness_score_change: number
    total_time_change: number
    total_distance_change: number
    affected_users: string[]
    satisfaction_change: number
  }
  timestamp: string
  created_at: string
}

// Real-time update events
export interface RouteUpdateEvent {
  type: 'route_updated' | 'route_created' | 'route_deleted' | 'preferences_changed'
  group_id: string
  user_id?: string | null
  session_id?: string | null
  timestamp: string
  data: any
}

// Conflict resolution
export interface RouteUpdateConflict {
  local_version: number
  server_version: number
  conflicting_fields: string[]
  local_changes: Partial<StoredRouteData>
  server_changes: Partial<StoredRouteData>
  resolution_strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual'
  conflict_id: string
  created_at: string
}

// Cache management
export interface CacheEntry<T> {
  data: T
  timestamp: number
  expires_at: number
  version: number
  group_id: string
}

// Query filters and options
export interface RouteQueryOptions {
  group_id?: string
  user_id?: string
  session_id?: string
  date_range?: {
    start: string
    end: string
  }
  min_fairness_score?: number
  max_distance?: number
  max_duration?: number
  include_deleted?: boolean
  limit?: number
  offset?: number
  order_by?: 'created_at' | 'fairness_score' | 'total_distance' | 'total_duration'
  order_direction?: 'asc' | 'desc'
}

// Optimization metrics for storage
export interface OptimizationMetrics {
  fairnessScore: number
  totalDistance: number
  totalDuration: number
  clusterCount: number
  destinationCount: number
  processingTime: number
  algorithmVersion: string
  userSatisfactionScores: { [userId: string]: number }
  routeEfficiency: number
  accommodationOptimization: number
}

// Batch operations
export interface BatchRouteOperation {
  operation_type: 'bulk_update' | 'bulk_delete' | 'bulk_reorder'
  group_ids: string[]
  parameters: any
  user_id?: string | null
  session_id?: string | null
  timestamp: string
}

// Database indexes and performance
export interface RouteIndexDefinition {
  name: string
  table: string
  columns: string[]
  type: 'btree' | 'gin' | 'gist' | 'hash'
  unique?: boolean
  where?: string
}

// Error types
export class RouteStorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'RouteStorageError'
  }
}

export class ConflictResolutionRequiredError extends Error {
  constructor(
    public conflict: RouteUpdateConflict,
    message = 'Manual conflict resolution required'
  ) {
    super(message)
    this.name = 'ConflictResolutionRequiredError'
  }
}

export class CacheInvalidationError extends Error {
  constructor(
    message: string,
    public group_id: string,
    public cache_type: string
  ) {
    super(message)
    this.name = 'CacheInvalidationError'
  }
}

// Data validation
export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
}

// Performance monitoring
export interface RouteOperationMetrics {
  operation: string
  duration_ms: number
  rows_affected: number
  cache_hit: boolean
  group_id: string
  user_id?: string | null
  timestamp: string
  success: boolean
  error_message?: string
}

// Backup and recovery
export interface RouteBackup {
  backup_id: string
  group_id: string
  backup_type: 'full' | 'incremental'
  data: StoredRouteData[]
  metadata: {
    created_at: string
    version_range: { from: number, to: number }
    size_bytes: number
    compression: string
  }
}

// Migration support
export interface SchemaMigration {
  version: string
  description: string
  up_sql: string
  down_sql: string
  applied_at?: string
}

export default StoredRouteData