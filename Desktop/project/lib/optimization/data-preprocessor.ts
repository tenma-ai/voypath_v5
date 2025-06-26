// Data preprocessing functions for optimization algorithm

import type {
  OptimizationInput,
  PreprocessedData,
  Location,
  ValidatedPreference,
  ValidationResult
} from './types'
import { validateOptimizationInput, coordinatesToLocation } from './data-validator'
import { fetchUserDetails } from './data-fetcher'

/**
 * Main preprocessing function
 * Converts raw database data into structured format for optimization
 */
export async function preprocessOptimizationData(
  input: OptimizationInput
): Promise<{ data: PreprocessedData | null; validation: ValidationResult }> {
  // First validate the input
  const validation = validateOptimizationInput(input)
  
  if (!validation.isValid) {
    console.error('Validation errors:', validation.errors)
    return { data: null, validation }
  }
  
  try {
    // Process departure and return locations
    const departureLocation = createDepartureLocation(input.tripGroup)
    const returnLocation = createReturnLocation(input.tripGroup, departureLocation)
    
    // Process destinations (combine legacy destinations and new places)
    const destinationMap = await processDestinations(input)
    
    // Process group members
    const memberMap = processGroupMembers(input.groupMembers)
    
    // Process and validate preferences
    const validatedPreferences = await processPreferences(
      input.userPreferences,
      memberMap,
      destinationMap
    )
    
    // Process trip duration
    const tripDuration = processTripDuration(input.tripGroup)
    
    // Process constraints
    const constraints = processConstraints(input.tripGroup)
    
    const preprocessedData: PreprocessedData = {
      groupId: input.groupId,
      departureLocation,
      returnLocation,
      destinations: destinationMap,
      preferences: validatedPreferences,
      groupMembers: memberMap,
      tripDuration,
      constraints
    }
    
    return { data: preprocessedData, validation }
  } catch (error) {
    console.error('Error preprocessing data:', error)
    validation.errors.push({
      code: 'PREPROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Unknown preprocessing error'
    })
    return { data: null, validation }
  }
}

/**
 * Create departure location from trip group
 */
function createDepartureLocation(tripGroup: any): Location {
  console.log('🔍 createDepartureLocation input:', {
    departure_location: tripGroup.departure_location,
    departure_location_lat: tripGroup.departure_location_lat,
    departure_location_lng: tripGroup.departure_location_lng,
    hasCoords: !!(tripGroup.departure_location_lat && tripGroup.departure_location_lng)
  });
  
  if (tripGroup.departure_location_lat && tripGroup.departure_location_lng) {
    const location = {
      id: 'departure',
      latitude: tripGroup.departure_location_lat,
      longitude: tripGroup.departure_location_lng,
      name: tripGroup.departure_location,
      address: tripGroup.departure_location
    };
    console.log('✅ Created departure location:', location);
    return location;
  }
  
  // If coordinates not set, throw error (should be caught in validation)
  console.error('❌ Missing departure coordinates in createDepartureLocation');
  throw new Error('Departure location coordinates are required for optimization')
}

/**
 * Create return location (may be same as departure)
 */
function createReturnLocation(
  tripGroup: any,
  departureLocation: Location
): Location | null {
  // If no return location specified, use departure
  if (!tripGroup.return_location) {
    return null // null means use departure location
  }
  
  // If return location is same as departure
  if (tripGroup.return_location === tripGroup.departure_location) {
    return null
  }
  
  // For MVP, return location must have coordinates
  // In future, could implement geocoding here
  throw new Error('Different return location not yet supported - coordinates required')
}

/**
 * Process destinations and places into unified map
 */
async function processDestinations(
  input: OptimizationInput
): Promise<Map<string, Location>> {
  const destinationMap = new Map<string, Location>()
  
  // Process legacy destinations table
  input.destinations.forEach(dest => {
    if (dest.latitude !== null && dest.longitude !== null) {
      const location = coordinatesToLocation(
        dest.latitude,
        dest.longitude,
        dest.name,
        dest.id
      )
      if (location) {
        destinationMap.set(dest.id, location)
      }
    }
  })
  
  // Process new places table (takes precedence)
  input.places.forEach(place => {
    // Skip places without valid coordinates
    if (place.latitude === null || place.longitude === null) {
      console.warn(`Skipping place ${place.name} due to missing coordinates`)
      return
    }
    
    const location: Location = {
      id: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name, // Updated field name based on schema
      address: place.address || undefined
    }
    destinationMap.set(place.id, location)
  })
  
  return destinationMap
}

/**
 * Process group members into map
 */
function processGroupMembers(
  members: any[]
): Map<string, any> {
  const memberMap = new Map()
  
  members.forEach(member => {
    // Use user_id if available, otherwise session_id
    const key = member.user_id || member.session_id
    if (key) {
      memberMap.set(key, member)
    }
  })
  
  return memberMap
}

/**
 * Process and validate user preferences
 */
async function processPreferences(
  preferences: any[],
  memberMap: Map<string, any>,
  destinationMap: Map<string, Location>
): Promise<ValidatedPreference[]> {
  const validatedPreferences: ValidatedPreference[] = []
  
  // Get unique user/session IDs for fetching user details
  const userIds = preferences
    .map(p => p.user_id)
    .filter(Boolean) as string[]
  const sessionIds = preferences
    .map(p => p.session_id)
    .filter(Boolean) as string[]
  
  // Fetch user details for display names
  const { data: userDetailsMap } = await fetchUserDetails(userIds, sessionIds)
  
  preferences.forEach(pref => {
    const userKey = pref.user_id || pref.session_id
    const member = memberMap.get(userKey)
    const destination = destinationMap.get(pref.destination_id)
    
    // Skip if member or destination not found
    if (!member || !destination) {
      console.warn(`Skipping preference: member=${userKey}, destination=${pref.destination_id}`)
      return
    }
    
    // Get display name from member or user details
    let displayName = member.display_name
    if (!displayName && userDetailsMap) {
      const userDetails = userDetailsMap.get(userKey)
      displayName = userDetails?.full_name || userDetails?.display_initials || 'Unknown User'
    }
    
    validatedPreferences.push({
      userId: pref.user_id,
      sessionId: pref.session_id,
      destinationId: pref.destination_id,
      preferenceScore: pref.preference_score,
      preferredDuration: pref.preferred_duration || 2, // Default 2 hours
      userDisplayName: displayName,
      userColor: member.assigned_color
    })
  })
  
  return validatedPreferences
}

/**
 * Process trip duration information
 */
function processTripDuration(tripGroup: any): PreprocessedData['tripDuration'] {
  return {
    startDate: tripGroup.start_date ? new Date(tripGroup.start_date) : null,
    endDate: tripGroup.end_date ? new Date(tripGroup.end_date) : null,
    autoCalculate: tripGroup.auto_calculate_end_date
  }
}

/**
 * Process permission constraints
 */
function processConstraints(tripGroup: any): PreprocessedData['constraints'] {
  return {
    allowOrderChange: tripGroup.allow_order_change as 'all' | 'admin_only' | 'specific_members',
    allowDestinationAdd: tripGroup.allow_destination_add as 'all' | 'approval_required',
    orderChangeMembers: tripGroup.order_change_members || []
  }
}

/**
 * Calculate preference statistics for a destination
 */
export function calculateDestinationStats(
  destinationId: string,
  preferences: ValidatedPreference[]
): {
  averageScore: number
  totalPreferences: number
  preferringUsers: string[]
} {
  const destPrefs = preferences.filter(p => p.destinationId === destinationId)
  
  if (destPrefs.length === 0) {
    return {
      averageScore: 0,
      totalPreferences: 0,
      preferringUsers: []
    }
  }
  
  const totalScore = destPrefs.reduce((sum, p) => sum + p.preferenceScore, 0)
  const preferringUsers = destPrefs
    .filter(p => p.preferenceScore >= 4) // Score 4 or 5
    .map(p => p.userDisplayName)
  
  return {
    averageScore: totalScore / destPrefs.length,
    totalPreferences: destPrefs.length,
    preferringUsers
  }
}

/**
 * Group preferences by user for fairness calculation
 */
export function groupPreferencesByUser(
  preferences: ValidatedPreference[]
): Map<string, ValidatedPreference[]> {
  const userPrefsMap = new Map<string, ValidatedPreference[]>()
  
  preferences.forEach(pref => {
    const userKey = pref.userId || pref.sessionId || 'unknown'
    const userPrefs = userPrefsMap.get(userKey) || []
    userPrefs.push(pref)
    userPrefsMap.set(userKey, userPrefs)
  })
  
  return userPrefsMap
}