/**
 * Trip Optimization Type Definitions for Voypath
 * Phase 1: Complete optimization algorithm interfaces
 */

// Error handling types
export enum OptimizationErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  EDGE_FUNCTION_ERROR = 'EDGE_FUNCTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface EnhancedOptimizationError {
  type: OptimizationErrorType;
  message: string;
  code: string;
  stage: OptimizationStage;
  retryable: boolean;
  context?: Record<string, unknown>;
  timestamp: string;
  correlationId: string;
}

export interface LoadingState {
  isLoading: boolean;
  stage: OptimizationStage | null;
  canCancel: boolean;
  estimatedTimeRemaining?: number;
  retryCount: number;
  startTime?: number;
}

// Core data interfaces
export interface Place {
  id: string;
  name: string;
  category: string;
  address?: string;
  latitude?: number; // 修正: nullable対応 (DB整合性)
  longitude?: number; // 修正: nullable対応 (DB整合性)
  wish_level: number;
  stay_duration_minutes: number;
  user_id: string;
  trip_id: string;
  
  // DB互換フィールド追加
  rating?: number;
  price_level?: number;
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  images?: string[];
  scheduled?: boolean;
  scheduled_date?: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  status?: 'scheduled' | 'unscheduled' | 'pending';
  visit_date?: string;
  preferred_time_slots?: string[];
  transport_mode?: string;
  travel_time_from_previous?: number;
  notes?: string;
  tags?: string[];
  external_id?: string;
  source?: string;
  
  // 最適化関連フィールド
  normalized_weight?: number;
  normalized_wish_level?: number;
  user_avg_wish_level?: number;
  fairness_contribution_score?: number;
  is_selected_for_optimization?: boolean;
  selection_round?: number;
  optimization_metadata?: Record<string, any>;
  place_type?: 'member_wish' | 'group_selected' | 'departure' | 'destination';
  
  // Google Places統合
  google_place_id?: string;
  google_rating?: number;
  google_user_ratings_total?: number;
  google_price_level?: number;
  google_types?: string[];
  google_photos_data?: Record<string, any>;
  google_opening_hours?: Record<string, any>;
  search_source_location?: string;
  place_search_metadata?: Record<string, any>;
  
  // メンバーカラー関連
  display_color?: string;
  display_color_hex?: string;
  color_type?: string;
  member_contribution?: Record<string, any>;
  member_contributors?: string[];
  
  // タイムスタンプ
  created_at?: string;
  updated_at?: string;
  
  // Member preferences for voting/rating
  member_preferences?: MemberPreference[];
}

export interface MemberPreference {
  member_id: string;
  member_name?: string;
  wish_level: number;
  notes?: string;
  created_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  is_guest?: boolean;
  avatar_url?: string;
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  owner_id: string; // 修正: created_by -> owner_id (DB整合性)
  departure_location: string; // 追加: 必須フィールド
  add_place_deadline?: string;
  max_members?: number;
  is_public?: boolean;
  icon?: string;
  tags?: string[];
  budget_range?: Record<string, any>;
  optimization_preferences?: Record<string, any>;
  total_places?: number;
  total_members?: number;
  last_optimized_at?: string;
  created_at: string;
  updated_at: string;
}

// Optimization request interfaces
export interface OptimizeRequest {
  tripId: string;
  userId: string;
  type?: 'keep_alive' | 'optimization';
  maxPlaces?: number;
  settings?: OptimizationSettings;
}

export interface OptimizationSettings {
  maxDailyHours: number;
  maxPlacesPerOptimization: number;
  walkingMaxKm: number;
  carMinKm: number;
  flightMinKm: number;
  mealBreakSettings: MealBreakSettings;
  algorithmVersion: string;
  fairnessWeight: number;
}

export interface MealBreakSettings {
  breakfast: { start: number; duration: number };
  lunch: { start: number; duration: number };
  dinner: { start: number; duration: number };
}

// Route constraint interfaces
export interface RouteConstraints {
  maxDailyHours: number;
  mealBreaks: {
    breakfast: { start: number; duration: number };
    lunch: { start: number; duration: number };
    dinner: { start: number; duration: number };
  };
  transportModes: {
    walkingMaxKm: number;
    carMinKm: number;
    flightMinKm: number;
  };
}

// Meal break interface for constrained route generation
export interface MealBreak {
  type: 'breakfast' | 'lunch' | 'dinner';
  startTime: string;
  endTime: string;
  duration: number;
  suggestedLocation?: string;
  estimatedCost?: number;
}

export type TransportMode = 'walking' | 'public_transport' | 'car' | 'flight';

export interface PlaceWithTransport extends Place {
  transportToNext: TransportMode | null;
  travelTimeMinutes?: number;
  travelDistance?: number;
  estimatedCost?: number;
}

export interface PlaceWithTiming extends PlaceWithTransport {
  arrivalTime?: string;
  departureTime?: string;
  scheduledDate?: string;
}

export interface DailyRoute {
  date: string;
  places: PlaceWithTiming[];
  totalMinutes: number;
  totalDistance: number;
  estimatedCost: number;
  mealBreaks: Array<{
    type: 'breakfast' | 'lunch' | 'dinner';
    startTime: string;
    duration: number;
  }>;
}

export interface DetailedSchedule {
  tripId: string;
  dailyRoutes: DailyRoute[];
  totalDays: number;
  groupFairnessScore: number;
  userFairnessScores: Record<string, number>;
  totalEstimatedCost: number;
  optimizationMetadata: {
    algorithmVersion: string;
    executionTimeMs: number;
    placesConsidered: number;
    placesSelected: number;
    optimizationRounds: number;
    createdAt: string;
  };
}

// Progress tracking interfaces
export type OptimizationStage = 'collecting' | 'normalizing' | 'selecting' | 'routing' | 'complete';

export interface OptimizationProgress {
  id: string;
  trip_id: string;
  user_id: string;
  stage: OptimizationStage;
  progress_percentage: number;
  stage_message: string;
  execution_time_ms?: number;
  error_message?: string;
  enhanced_error?: EnhancedOptimizationError;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Normalization interfaces
export interface NormalizationRequest {
  tripId: string;
  userId: string;
}

export interface NormalizationResult {
  tripId: string;
  normalizedUsers: UserNormalizationData[];
  totalPlaces: number;
  executionTimeMs: number;
}

export interface UserNormalizationData {
  userId: string;
  userName: string;
  totalPlaces: number;
  avgWishLevel: number;
  normalizedPlaces: NormalizedPlaceData[];
  userWeight: number;
  fairnessContribution: number;
}

export interface NormalizedPlaceData {
  placeId: string;
  originalWishLevel: number;
  normalizedWishLevel: number;
  fairnessScore: number;
}

// Selection interfaces
export interface PlaceSelectionRequest {
  tripId: string;
  userId: string;
  maxPlaces?: number;
  fairnessWeight?: number;
}

export interface PlaceSelectionResult {
  tripId: string;
  selectedPlaces: SelectedPlaceData[];
  totalPlacesConsidered: number;
  selectionRounds: number;
  fairnessScores: Record<string, number>;
  executionTimeMs: number;
}

export interface SelectedPlaceData {
  place: Place;
  selectionRound: number;
  selectionScore: number;
  userContributions: Record<string, number>;
}

// Routing interfaces
export interface RoutingRequest {
  tripId: string;
  userId: string;
  selectedPlaces: Place[];
  constraints: RouteConstraints;
  settings: OptimizationSettings;
}

export interface RoutingResult {
  tripId: string;
  dailyRoutes: DailyRoute[];
  totalDays: number;
  optimizationScore: number;
  executionTimeMs: number;
}

// Utility types
export interface OptimizationError {
  code: string;
  message: string;
  stage: OptimizationStage;
  details?: Record<string, any>;
}

export interface OptimizationMetrics {
  totalExecutionTime: number;
  stageExecutionTimes: Record<OptimizationStage, number>;
  memoryUsage?: number;
  apiCallsCount: number;
  cacheHitRate?: number;
}

// Database entity interfaces
export interface TripOptimizationSettings {
  trip_id: string;
  max_daily_hours: number;
  max_places_per_optimization: number;
  walking_max_km: number;
  car_min_km: number;
  flight_min_km: number;
  meal_break_settings: MealBreakSettings;
  algorithm_version: string;
  fairness_weight: number;
  created_at: string;
  updated_at: string;
}

export interface OptimizationCache {
  id: string;
  trip_id: string;
  places_hash: string;
  settings_hash: string;
  result_data: DetailedSchedule;
  expires_at: string;
  last_accessed_at: string;
  created_at: string;
}

// Validation utilities
export const validatePlace = (place: Partial<Place>): place is Place => {
  return !!(
    place.id &&
    place.name &&
    place.category &&
    typeof place.latitude === 'number' &&
    typeof place.longitude === 'number' &&
    typeof place.wish_level === 'number' &&
    typeof place.stay_duration_minutes === 'number' &&
    place.user_id &&
    place.trip_id &&
    place.place_type
  );
};

export const validateOptimizationSettings = (settings: Partial<OptimizationSettings>): settings is OptimizationSettings => {
  return !!(
    typeof settings.maxDailyHours === 'number' &&
    settings.maxDailyHours >= 4 &&
    settings.maxDailyHours <= 16 &&
    typeof settings.maxPlacesPerOptimization === 'number' &&
    settings.maxPlacesPerOptimization >= 5 &&
    settings.maxPlacesPerOptimization <= 50 &&
    typeof settings.walkingMaxKm === 'number' &&
    typeof settings.carMinKm === 'number' &&
    typeof settings.flightMinKm === 'number' &&
    settings.mealBreakSettings &&
    settings.algorithmVersion &&
    typeof settings.fairnessWeight === 'number'
  );
};