/**
 * Trip Optimization Type Definitions for Voypath
 * Phase 1: Complete optimization algorithm interfaces
 */

// Core data interfaces
export interface Place {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  wish_level: number;
  stay_duration_minutes: number;
  user_id: string;
  trip_id: string;
  normalized_wish_level?: number;
  place_type: 'member_wish' | 'group_selected' | 'departure' | 'destination';
  
  // Additional place metadata
  google_place_id?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  vicinity?: string;
  
  // Optimization metadata
  fairness_contribution_score?: number;
  is_selected_for_optimization?: boolean;
  selection_round?: number;
  optimization_metadata?: Record<string, any>;
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
  start_date?: string;
  end_date?: string;
  created_by: string;
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
  maxDailyHours: 8;
  mealBreaks: {
    breakfast: { start: 8; duration: 45 };
    lunch: { start: 12; duration: 60 };
    dinner: { start: 18; duration: 90 };
  };
  transportModes: {
    walkingMaxKm: 0.8;
    carMinKm: 15;
    flightMinKm: 500;
  };
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