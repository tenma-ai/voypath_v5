// Types for optimization algorithm data structures

import type { 
  TripGroups, 
  Destinations, 
  UserPreferences, 
  GroupMembers,
  Places,
  Users 
} from '@/lib/database.types'

// Core location interface for optimization
export interface Location {
  id: string
  latitude: number
  longitude: number
  name: string
  address?: string
}

// User context for handling both guest and authenticated users
export interface UserContext {
  id: string | null
  sessionId: string | null
  isGuest: boolean
  displayName?: string
  assignedColor?: string
}

// Validated preference with user information
export interface ValidatedPreference {
  userId: string | null
  sessionId: string | null
  destinationId: string
  preferenceScore: number // 1-5
  preferredDuration: number // hours
  userDisplayName: string
  userColor: string
}

// Main input structure for optimization algorithm
export interface OptimizationInput {
  groupId: string
  tripGroup: TripGroups
  destinations: Destinations[]
  places: Places[] // For two-tier system
  userPreferences: UserPreferences[]
  groupMembers: GroupMembers[]
  currentUser: UserContext
}

// Preprocessed data ready for optimization
export interface PreprocessedData {
  groupId: string
  departureLocation: Location
  returnLocation: Location | null
  destinations: Map<string, Location>
  preferences: ValidatedPreference[]
  groupMembers: Map<string, GroupMembers>
  tripDuration: {
    startDate: Date | null
    endDate: Date | null
    autoCalculate: boolean
  }
  constraints: {
    allowOrderChange: 'all' | 'admin_only' | 'specific_members'
    allowDestinationAdd: 'all' | 'approval_required'
    orderChangeMembers: string[]
  }
}

// Validation result structure
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  field?: string
  value?: any
}

export interface ValidationWarning {
  code: string
  message: string
  field?: string
  suggestion?: string
}

// Error codes for validation
export enum ValidationErrorCode {
  MISSING_DEPARTURE_LOCATION = 'MISSING_DEPARTURE_LOCATION',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_PREFERENCE_SCORE = 'INVALID_PREFERENCE_SCORE',
  MISSING_USER_REFERENCE = 'MISSING_USER_REFERENCE',
  ORPHANED_PREFERENCE = 'ORPHANED_PREFERENCE',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  MISSING_GROUP_MEMBERS = 'MISSING_GROUP_MEMBERS',
  DUPLICATE_DESTINATION = 'DUPLICATE_DESTINATION'
}

// Distance calculation cache key
export interface DistanceCacheKey {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
}

// Optimization constraints
export interface OptimizationConstraints {
  maxDailyDistance?: number // km
  maxDrivingHours?: number // hours per day
  preferredDailyStartTime?: string // HH:mm format
  preferredDailyEndTime?: string // HH:mm format
}

// Result of data fetching operation
export interface DataFetchResult<T> {
  data: T | null
  error: Error | null
}

// Coordinate validation ranges
export const COORDINATE_RANGES = {
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 }
} as const

// Preference score constraints
export const PREFERENCE_CONSTRAINTS = {
  minScore: 1,
  maxScore: 5,
  defaultScore: 3
} as const