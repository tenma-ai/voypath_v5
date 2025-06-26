// Data validation functions for optimization input

import type {
  OptimizationInput,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  Location,
  ValidatedPreference
} from './types'
import { ValidationErrorCode } from './types'
import { COORDINATE_RANGES, PREFERENCE_CONSTRAINTS } from './types'

/**
 * Validate complete optimization input data
 */
export function validateOptimizationInput(
  input: OptimizationInput
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  
  // Validate trip group
  validateTripGroup(input.tripGroup, errors, warnings)
  
  // Validate destinations
  if (input.destinations.length === 0 && input.places.length === 0) {
    warnings.push({
      code: 'NO_DESTINATIONS',
      message: 'No destinations found for optimization'
    })
  } else {
    // Validate individual destinations
    input.destinations.forEach(dest => {
      validateDestination(dest, errors, warnings)
    })
    
    // Validate places (two-tier system)
    input.places.forEach(place => {
      validatePlace(place, errors, warnings)
    })
  }
  
  // Validate group members
  if (input.groupMembers.length === 0) {
    errors.push({
      code: ValidationErrorCode.MISSING_GROUP_MEMBERS,
      message: 'No group members found'
    })
  } else {
    validateGroupMembers(input.groupMembers, errors, warnings)
  }
  
  // Validate preferences
  validatePreferences(
    input.userPreferences,
    input.groupMembers,
    input.destinations,
    errors,
    warnings
  )
  
  // Check for orphaned data
  checkOrphanedData(input, errors, warnings)
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate trip group data
 */
function validateTripGroup(
  tripGroup: any,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check required departure location
  if (!tripGroup.departure_location) {
    errors.push({
      code: ValidationErrorCode.MISSING_DEPARTURE_LOCATION,
      message: 'Departure location is required',
      field: 'departure_location'
    })
  }
  
  // Validate departure coordinates if provided
  if (tripGroup.departure_location_lat !== null || tripGroup.departure_location_lng !== null) {
    if (!isValidCoordinate(tripGroup.departure_location_lat, 'latitude') ||
        !isValidCoordinate(tripGroup.departure_location_lng, 'longitude')) {
      errors.push({
        code: ValidationErrorCode.INVALID_COORDINATES,
        message: 'Invalid departure location coordinates',
        field: 'departure_location_lat/lng',
        value: {
          lat: tripGroup.departure_location_lat,
          lng: tripGroup.departure_location_lng
        }
      })
    }
  } else {
    warnings.push({
      code: 'MISSING_DEPARTURE_COORDINATES',
      message: 'Departure location coordinates not set',
      suggestion: 'Add coordinates for accurate distance calculations'
    })
  }
  
  // Validate date range if both dates provided
  if (tripGroup.start_date && tripGroup.end_date) {
    const startDate = new Date(tripGroup.start_date)
    const endDate = new Date(tripGroup.end_date)
    
    if (startDate > endDate) {
      errors.push({
        code: ValidationErrorCode.INVALID_DATE_RANGE,
        message: 'Start date must be before end date',
        field: 'start_date/end_date',
        value: {
          start: tripGroup.start_date,
          end: tripGroup.end_date
        }
      })
    }
  }
  
  // Validate permission settings
  const validOrderChangeOptions = ['all', 'admin_only', 'specific_members']
  if (!validOrderChangeOptions.includes(tripGroup.allow_order_change)) {
    warnings.push({
      code: 'INVALID_PERMISSION_SETTING',
      message: `Invalid order change permission: ${tripGroup.allow_order_change}`,
      field: 'allow_order_change',
      suggestion: 'Use one of: all, admin_only, specific_members'
    })
  }
}

/**
 * Validate destination data
 */
function validateDestination(
  destination: any,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!destination.name) {
    errors.push({
      code: 'MISSING_DESTINATION_NAME',
      message: `Destination ${destination.id} has no name`,
      field: 'name',
      value: destination.id
    })
  }
  
  // Check coordinates
  if (destination.latitude === null || destination.longitude === null) {
    errors.push({
      code: ValidationErrorCode.INVALID_COORDINATES,
      message: `Destination "${destination.name}" has missing coordinates`,
      field: 'latitude/longitude',
      value: destination.id
    })
  } else if (!isValidCoordinate(destination.latitude, 'latitude') ||
             !isValidCoordinate(destination.longitude, 'longitude')) {
    errors.push({
      code: ValidationErrorCode.INVALID_COORDINATES,
      message: `Destination "${destination.name}" has invalid coordinates`,
      field: 'latitude/longitude',
      value: {
        lat: destination.latitude,
        lng: destination.longitude
      }
    })
  }
}

/**
 * Validate place data (two-tier system)
 */
function validatePlace(
  place: any,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!place.place_name) {
    errors.push({
      code: 'MISSING_PLACE_NAME',
      message: `Place ${place.id} has no name`,
      field: 'place_name',
      value: place.id
    })
  }
  
  // Check coordinates
  if (!isValidCoordinate(place.latitude, 'latitude') ||
      !isValidCoordinate(place.longitude, 'longitude')) {
    errors.push({
      code: ValidationErrorCode.INVALID_COORDINATES,
      message: `Place "${place.place_name}" has invalid coordinates`,
      field: 'latitude/longitude',
      value: {
        lat: place.latitude,
        lng: place.longitude
      }
    })
  }
  
  // Validate visit order if set
  if (place.visit_order !== null && place.visit_order < 0) {
    warnings.push({
      code: 'INVALID_VISIT_ORDER',
      message: `Place "${place.place_name}" has negative visit order`,
      field: 'visit_order',
      suggestion: 'Use positive integers for visit order'
    })
  }
}

/**
 * Validate group members
 */
function validateGroupMembers(
  members: any[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const colorSet = new Set<string>()
  
  members.forEach(member => {
    // Check user reference
    if (!member.user_id && !member.session_id) {
      errors.push({
        code: ValidationErrorCode.MISSING_USER_REFERENCE,
        message: `Member "${member.display_name}" has no user or session reference`,
        field: 'user_id/session_id',
        value: member.id
      })
    }
    
    // Check color assignment
    if (!member.assigned_color || !isValidHexColor(member.assigned_color)) {
      warnings.push({
        code: 'INVALID_COLOR',
        message: `Member "${member.display_name}" has invalid color: ${member.assigned_color}`,
        field: 'assigned_color',
        suggestion: 'Use valid HEX color format (#RRGGBB)'
      })
    } else if (colorSet.has(member.assigned_color)) {
      warnings.push({
        code: 'DUPLICATE_COLOR',
        message: `Color ${member.assigned_color} is used by multiple members`,
        field: 'assigned_color'
      })
    } else {
      colorSet.add(member.assigned_color)
    }
    
    // Validate role
    const validRoles = ['admin', 'member', 'viewer']
    if (!validRoles.includes(member.role)) {
      warnings.push({
        code: 'INVALID_ROLE',
        message: `Member "${member.display_name}" has invalid role: ${member.role}`,
        field: 'role',
        suggestion: 'Use one of: admin, member, viewer'
      })
    }
  })
}

/**
 * Validate user preferences
 */
function validatePreferences(
  preferences: any[],
  members: any[],
  destinations: any[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Create lookup maps - include both user_id and session_id as keys for each member
  const memberMap = new Map()
  members.forEach(m => {
    if (m.user_id) memberMap.set(m.user_id, m)
    if (m.session_id) memberMap.set(m.session_id, m)
  })
  
  // 🔍 DEBUG: Log memberMap construction
  console.log('🔍 MemberMap debug (all keys):', Array.from(memberMap.keys()));
  console.log('🔍 Members used for map:', members.map(m => ({
    id: m.id,
    user_id: m.user_id,
    session_id: m.session_id,
    keys_added: [m.user_id, m.session_id].filter(Boolean)
  })));
  const destinationMap = new Map(
    destinations.map(d => [d.id, d])
  )
  
  preferences.forEach(pref => {
    // Check user reference
    const userKey = pref.user_id || pref.session_id
    if (!userKey) {
      errors.push({
        code: ValidationErrorCode.MISSING_USER_REFERENCE,
        message: 'Preference has no user reference',
        field: 'user_id/session_id',
        value: pref.id
      })
    } else if (!memberMap.has(userKey)) {
      errors.push({
        code: ValidationErrorCode.ORPHANED_PREFERENCE,
        message: 'Preference references non-existent member',
        field: 'user_id/session_id',
        value: userKey
      })
    }
    
    // Check destination reference
    if (!destinationMap.has(pref.destination_id)) {
      errors.push({
        code: ValidationErrorCode.ORPHANED_PREFERENCE,
        message: 'Preference references non-existent destination',
        field: 'destination_id',
        value: pref.destination_id
      })
    }
    
    // Validate preference score
    if (!isValidPreferenceScore(pref.preference_score)) {
      errors.push({
        code: ValidationErrorCode.INVALID_PREFERENCE_SCORE,
        message: `Invalid preference score: ${pref.preference_score}`,
        field: 'preference_score',
        value: pref.preference_score
      })
    }
    
    // Validate duration if set
    if (pref.preferred_duration !== null && pref.preferred_duration <= 0) {
      warnings.push({
        code: 'INVALID_DURATION',
        message: `Invalid preferred duration: ${pref.preferred_duration} hours`,
        field: 'preferred_duration',
        suggestion: 'Use positive duration in hours'
      })
    }
  })
}

/**
 * Check for orphaned data relationships
 */
function checkOrphanedData(
  input: OptimizationInput,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check if all destinations have at least one preference
  const destinationsWithPrefs = new Set(
    input.userPreferences.map(p => p.destination_id)
  )
  
  input.destinations.forEach(dest => {
    if (!destinationsWithPrefs.has(dest.id)) {
      warnings.push({
        code: 'DESTINATION_NO_PREFERENCES',
        message: `Destination "${dest.name}" has no user preferences`,
        field: 'destination_id',
        suggestion: 'Consider removing unused destinations'
      })
    }
  })
}

/**
 * Helper: Validate coordinate value
 */
function isValidCoordinate(
  value: number | null,
  type: 'latitude' | 'longitude'
): boolean {
  if (value === null) return false
  
  const range = COORDINATE_RANGES[type]
  return value >= range.min && value <= range.max
}

/**
 * Helper: Validate HEX color format
 */
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color)
}

/**
 * Helper: Validate preference score
 */
function isValidPreferenceScore(score: number): boolean {
  return (
    Number.isInteger(score) &&
    score >= PREFERENCE_CONSTRAINTS.minScore &&
    score <= PREFERENCE_CONSTRAINTS.maxScore
  )
}

/**
 * Convert coordinates to Location object
 */
export function coordinatesToLocation(
  lat: number,
  lng: number,
  name: string,
  id?: string
): Location | null {
  if (!isValidCoordinate(lat, 'latitude') || !isValidCoordinate(lng, 'longitude')) {
    return null
  }
  
  return {
    id: id || crypto.randomUUID(),
    latitude: lat,
    longitude: lng,
    name
  }
}