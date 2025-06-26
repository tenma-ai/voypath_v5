/**
 * Comprehensive Input Validation System for Voypath Optimization API
 * 
 * Multi-layer validation system that validates optimization inputs at both
 * client and server levels with detailed error reporting and suggestions.
 */

import type { ValidationResult, OptimizationError } from '../types/api-errors'
import { ValidationError } from '../types/api-errors'

export interface ValidationRule {
  field: string
  validator: (value: any, context?: any) => boolean
  errorMessage: string
  required: boolean
  sanitizer?: (value: any) => any
  severity: 'error' | 'warning'
}

export interface ValidationContext {
  groupId?: string
  userId?: string
  sessionId?: string
  isGuest?: boolean
  existingData?: any
}

/**
 * Core validation rules for optimization input
 */
export const optimizationValidationRules: ValidationRule[] = [
  // Group data validation
  {
    field: 'groupId',
    validator: (id) => typeof id === 'string' && id.length > 0 && /^[a-fA-F0-9-]{36}$/.test(id),
    errorMessage: 'Valid group ID is required (UUID format)',
    required: true,
    severity: 'error'
  },
  
  // Destination validation
  {
    field: 'destinations',
    validator: (destinations) => Array.isArray(destinations) && destinations.length > 0,
    errorMessage: 'At least one destination is required',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'destinations',
    validator: (destinations) => Array.isArray(destinations) && destinations.length <= 50,
    errorMessage: 'Too many destinations (maximum 50 allowed)',
    required: false,
    severity: 'error'
  },
  
  // Departure location validation
  {
    field: 'departureLocation',
    validator: (location) => location && typeof location === 'object',
    errorMessage: 'Departure location is required',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'departureLocation.latitude',
    validator: (lat) => typeof lat === 'number' && lat >= -90 && lat <= 90,
    errorMessage: 'Valid departure location latitude is required (-90 to 90)',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'departureLocation.longitude',
    validator: (lng) => typeof lng === 'number' && lng >= -180 && lng <= 180,
    errorMessage: 'Valid departure location longitude is required (-180 to 180)',
    required: true,
    severity: 'error'
  },
  
  // Date validation
  {
    field: 'startDate',
    validator: (date) => !date || (typeof date === 'string' && !isNaN(Date.parse(date))),
    errorMessage: 'Start date must be a valid date string',
    required: false,
    severity: 'error'
  },
  
  {
    field: 'endDate',
    validator: (date) => !date || (typeof date === 'string' && !isNaN(Date.parse(date))),
    errorMessage: 'End date must be a valid date string',
    required: false,
    severity: 'error'
  },
  
  // Group members validation
  {
    field: 'groupMembers',
    validator: (members) => Array.isArray(members) && members.length > 0,
    errorMessage: 'At least one group member is required',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'groupMembers',
    validator: (members) => Array.isArray(members) && members.length <= 20,
    errorMessage: 'Too many group members (maximum 20 allowed for optimal performance)',
    required: false,
    severity: 'warning'
  },
  
  // User preferences validation
  {
    field: 'userPreferences',
    validator: (prefs) => Array.isArray(prefs),
    errorMessage: 'User preferences must be an array',
    required: true,
    severity: 'error'
  }
]

/**
 * Deep validation rules for complex nested objects
 */
export const deepValidationRules: ValidationRule[] = [
  // Destination coordinate validation
  {
    field: 'destinations[].latitude',
    validator: (lat) => typeof lat === 'number' && lat >= -90 && lat <= 90,
    errorMessage: 'All destinations must have valid latitude coordinates',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'destinations[].longitude',
    validator: (lng) => typeof lng === 'number' && lng >= -180 && lng <= 180,
    errorMessage: 'All destinations must have valid longitude coordinates',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'destinations[].name',
    validator: (name) => typeof name === 'string' && name.trim().length > 0,
    errorMessage: 'All destinations must have valid names',
    required: true,
    severity: 'error'
  },
  
  // User preference validation
  {
    field: 'userPreferences[].preference_score',
    validator: (score) => typeof score === 'number' && score >= 1 && score <= 5,
    errorMessage: 'Preference scores must be between 1 and 5',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'userPreferences[].preferred_duration',
    validator: (duration) => !duration || (typeof duration === 'number' && duration > 0 && duration <= 168),
    errorMessage: 'Preferred duration must be positive and reasonable (max 168 hours/week)',
    required: false,
    severity: 'warning'
  },
  
  // Group member validation
  {
    field: 'groupMembers[].display_name',
    validator: (name) => typeof name === 'string' && name.trim().length > 0,
    errorMessage: 'All group members must have display names',
    required: true,
    severity: 'error'
  },
  
  {
    field: 'groupMembers[].assigned_color',
    validator: (color) => typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color),
    errorMessage: 'All group members must have valid hex color codes',
    required: true,
    severity: 'error'
  }
]

/**
 * Client-side validation function
 */
export function validateOptimizationInput(
  input: any,
  context?: ValidationContext
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Apply basic validation rules
  for (const rule of optimizationValidationRules) {
    const value = getNestedValue(input, rule.field)
    
    if (rule.required && (value === undefined || value === null)) {
      if (rule.severity === 'error') {
        errors.push(`${rule.field} is required`)
      } else {
        warnings.push(`${rule.field} is recommended`)
      }
      continue
    }
    
    if (value !== undefined && value !== null && !rule.validator(value, context)) {
      if (rule.severity === 'error') {
        errors.push(rule.errorMessage)
      } else {
        warnings.push(rule.errorMessage)
      }
    }
  }
  
  // Apply deep validation for arrays and nested objects
  if (input.destinations && Array.isArray(input.destinations)) {
    for (let i = 0; i < input.destinations.length; i++) {
      const destination = input.destinations[i]
      
      if (!destination.latitude || typeof destination.latitude !== 'number' || 
          Math.abs(destination.latitude) > 90) {
        errors.push(`Destination ${i + 1}: Invalid latitude ${destination.latitude}`)
      }
      
      if (!destination.longitude || typeof destination.longitude !== 'number' || 
          Math.abs(destination.longitude) > 180) {
        errors.push(`Destination ${i + 1}: Invalid longitude ${destination.longitude}`)
      }
      
      if (!destination.name || typeof destination.name !== 'string' || 
          destination.name.trim().length === 0) {
        errors.push(`Destination ${i + 1}: Name is required`)
      }
    }
  }
  
  // Validate user preferences if present
  if (input.userPreferences && Array.isArray(input.userPreferences)) {
    for (let i = 0; i < input.userPreferences.length; i++) {
      const pref = input.userPreferences[i]
      
      if (pref.preference_score && (pref.preference_score < 1 || pref.preference_score > 5)) {
        errors.push(`Preference ${i + 1}: Score must be between 1 and 5`)
      }
      
      if (pref.preferred_duration && (pref.preferred_duration <= 0 || pref.preferred_duration > 168)) {
        warnings.push(`Preference ${i + 1}: Duration should be reasonable (1-168 hours)`)
      }
    }
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings,
    data: sanitizeInput(input)
  }
}

/**
 * Server-side deep validation with additional context
 */
export async function validateOptimizationData(
  preprocessedData: any,
  context?: ValidationContext
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    // Validate coordinate realism
    if (preprocessedData.destinationLocations) {
      for (let i = 0; i < preprocessedData.destinationLocations.length; i++) {
        const location = preprocessedData.destinationLocations[i]
        
        if (Math.abs(location.latitude) > 90) {
          errors.push(`Destination ${i + 1}: Invalid latitude ${location.latitude}`)
        }
        if (Math.abs(location.longitude) > 180) {
          errors.push(`Destination ${i + 1}: Invalid longitude ${location.longitude}`)
        }
        
        // Check if coordinates are reasonable (not null island, etc.)
        if (location.latitude === 0 && location.longitude === 0) {
          warnings.push(`Destination ${i + 1}: Coordinates appear to be at null island (0,0)`)
        }
      }
    }
    
    // Validate preference data completeness
    const preferenceCoverage = calculatePreferenceCoverage(preprocessedData.input)
    if (preferenceCoverage < 0.3) {
      errors.push('Insufficient preference data. At least 30% of destinations need user ratings.')
    } else if (preferenceCoverage < 0.5) {
      warnings.push('Less than 50% of destinations have user preferences. This may affect optimization quality.')
    }
    
    // Validate time constraints are reasonable
    if (preprocessedData.input.tripGroup?.start_date) {
      const startDate = new Date(preprocessedData.input.tripGroup.start_date)
      const now = new Date()
      
      if (startDate < now) {
        // Allow past dates with warning for testing/demo purposes
        warnings.push('Trip start date is in the past')
      }
      
      // Check if end date is after start date
      if (preprocessedData.input.tripGroup.end_date) {
        const endDate = new Date(preprocessedData.input.tripGroup.end_date)
        if (endDate <= startDate) {
          errors.push('Trip end date must be after start date')
        }
        
        // Check for reasonable trip duration
        const durationMs = endDate.getTime() - startDate.getTime()
        const durationDays = durationMs / (24 * 60 * 60 * 1000)
        
        if (durationDays > 365) {
          warnings.push('Trip duration is very long (>1 year). Consider splitting into multiple trips.')
        } else if (durationDays < 1) {
          warnings.push('Trip duration is very short (<1 day). Some destinations may not fit.')
        }
      }
    }
    
    // Validate group size limitations
    const memberCount = preprocessedData.input.groupMembers?.length || 0
    if (memberCount > 20) {
      warnings.push('Large groups (20+ members) may experience longer optimization times')
    } else if (memberCount === 0) {
      errors.push('No group members found')
    }
    
    // Validate destination distribution
    if (preprocessedData.destinationLocations?.length > 0) {
      const distances = calculateDestinationDistances(preprocessedData.destinationLocations)
      const maxDistance = Math.max(...distances)
      
      if (maxDistance > 20000) { // > 20,000km (half earth circumference)
        warnings.push('Destinations are very spread out globally. Consider regional grouping.')
      }
    }
    
    // Validate preference consistency
    if (preprocessedData.input.userPreferences?.length > 0) {
      const inconsistencies = findPreferenceInconsistencies(preprocessedData.input.userPreferences)
      if (inconsistencies.length > 0) {
        warnings.push(...inconsistencies)
      }
    }
    
    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings,
      data: preprocessedData
    }
  } catch (error) {
    console.error('Error during deep validation:', error)
    errors.push('Validation system error occurred')
    return { isValid: false, errors, warnings }
  }
}

/**
 * Calculate preference coverage percentage
 */
function calculatePreferenceCoverage(input: any): number {
  if (!input.destinations || !input.userPreferences) {
    return 0
  }
  
  const totalDestinations = input.destinations.length
  const destinationsWithPreferences = new Set(
    input.userPreferences.map((pref: any) => pref.destination_id)
  ).size
  
  return totalDestinations > 0 ? destinationsWithPreferences / totalDestinations : 0
}

/**
 * Calculate distances between destinations
 */
function calculateDestinationDistances(destinations: any[]): number[] {
  const distances: number[] = []
  
  for (let i = 0; i < destinations.length - 1; i++) {
    for (let j = i + 1; j < destinations.length; j++) {
      const dist = calculateHaversineDistance(
        destinations[i].latitude,
        destinations[i].longitude,
        destinations[j].latitude,
        destinations[j].longitude
      )
      distances.push(dist)
    }
  }
  
  return distances
}

/**
 * Calculate distance using Haversine formula
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * Find inconsistencies in user preferences
 */
function findPreferenceInconsistencies(preferences: any[]): string[] {
  const inconsistencies: string[] = []
  
  // Group preferences by destination
  const preferencesByDestination = new Map<string, any[]>()
  for (const pref of preferences) {
    const destId = pref.destination_id
    if (!preferencesByDestination.has(destId)) {
      preferencesByDestination.set(destId, [])
    }
    preferencesByDestination.get(destId)!.push(pref)
  }
  
  // Check for extreme score variations
  for (const [destId, destPrefs] of Array.from(preferencesByDestination.entries())) {
    if (destPrefs.length > 1) {
      const scores = destPrefs.map(p => p.preference_score).filter(s => s != null)
      if (scores.length > 1) {
        const minScore = Math.min(...scores)
        const maxScore = Math.max(...scores)
        
        if (maxScore - minScore >= 4) {
          inconsistencies.push(`Destination ${destId}: Extreme preference variation (${minScore} to ${maxScore})`)
        }
      }
    }
  }
  
  return inconsistencies
}

/**
 * Get nested object value by dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (key.includes('[') && key.includes(']')) {
      // Handle array notation like 'destinations[]'
      const baseKey = key.substring(0, key.indexOf('['))
      return current?.[baseKey]
    }
    return current?.[key]
  }, obj)
}

/**
 * Sanitize input data
 */
function sanitizeInput(input: any): any {
  if (!input || typeof input !== 'object') {
    return input
  }
  
  const sanitized = { ...input }
  
  // Sanitize strings
  if (sanitized.groupId && typeof sanitized.groupId === 'string') {
    sanitized.groupId = sanitized.groupId.trim()
  }
  
  // Sanitize destinations
  if (sanitized.destinations && Array.isArray(sanitized.destinations)) {
    sanitized.destinations = sanitized.destinations.map((dest: any) => ({
      ...dest,
      name: typeof dest.name === 'string' ? dest.name.trim() : dest.name,
      latitude: typeof dest.latitude === 'number' ? Math.round(dest.latitude * 1000000) / 1000000 : dest.latitude,
      longitude: typeof dest.longitude === 'number' ? Math.round(dest.longitude * 1000000) / 1000000 : dest.longitude
    }))
  }
  
  // Sanitize coordinates
  if (sanitized.departureLocation) {
    if (typeof sanitized.departureLocation.latitude === 'number') {
      sanitized.departureLocation.latitude = Math.round(sanitized.departureLocation.latitude * 1000000) / 1000000
    }
    if (typeof sanitized.departureLocation.longitude === 'number') {
      sanitized.departureLocation.longitude = Math.round(sanitized.departureLocation.longitude * 1000000) / 1000000
    }
  }
  
  return sanitized
}

/**
 * Validate specific field with custom validator
 */
export function validateField(
  value: any, 
  fieldName: string, 
  customValidator?: (value: any) => boolean
): { isValid: boolean; error?: string } {
  
  const rule = optimizationValidationRules.find(r => r.field === fieldName)
  
  if (rule) {
    if (rule.required && (value === undefined || value === null)) {
      return { isValid: false, error: `${fieldName} is required` }
    }
    
    if (value !== undefined && value !== null && !rule.validator(value)) {
      return { isValid: false, error: rule.errorMessage }
    }
  }
  
  if (customValidator && !customValidator(value)) {
    return { isValid: false, error: `Custom validation failed for ${fieldName}` }
  }
  
  return { isValid: true }
}

/**
 * Create validation error from validation result
 */
export function createValidationError(result: ValidationResult): ValidationError {
  return new ValidationError(
    `Validation failed: ${result.errors.join(', ')}`,
    result.errors
  )
}