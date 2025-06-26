// Time allocation for destinations based on user preferences

import type { StandardizedPreference } from './normalization-types'
import type { RouteGenerationConfig } from './detailed-route-types'

// Default configuration for time allocation
export const DEFAULT_TIME_CONFIG: Pick<
  RouteGenerationConfig,
  'minDestinationHours' | 'maxDestinationHours' | 'defaultDestinationHours'
> = {
  minDestinationHours: 0.5, // 30 minutes minimum
  maxDestinationHours: 8.0, // 8 hours maximum
  defaultDestinationHours: 2.0 // 2 hours default
}

/**
 * Allocate time for a destination based on user preferences
 * Takes the average of all user preferred durations
 */
export function allocateDestinationTime(
  destinationId: string,
  userPreferences: StandardizedPreference[],
  config: Partial<RouteGenerationConfig> = {}
): {
  allocatedHours: number
  contributingUsers: string[]
  isDefault: boolean
} {
  const finalConfig = { ...DEFAULT_TIME_CONFIG, ...config }
  
  // Find all preferences for this destination
  const relevantPrefs = userPreferences.filter(
    pref => pref.destinationId === destinationId
  )
  
  // If no preferences, use default
  if (relevantPrefs.length === 0) {
    return {
      allocatedHours: finalConfig.defaultDestinationHours,
      contributingUsers: [],
      isDefault: true
    }
  }
  
  // Calculate average preferred duration
  const totalDuration = relevantPrefs.reduce(
    (sum, pref) => sum + pref.preferredDuration,
    0
  )
  const averageDuration = totalDuration / relevantPrefs.length
  
  // Apply bounds
  const boundedDuration = Math.max(
    finalConfig.minDestinationHours,
    Math.min(finalConfig.maxDestinationHours, averageDuration)
  )
  
  // Get contributing user IDs
  const contributingUsers = relevantPrefs.map(
    pref => pref.userId || pref.sessionId || 'unknown'
  )
  
  return {
    allocatedHours: boundedDuration,
    contributingUsers,
    isDefault: false
  }
}

/**
 * Calculate time allocation for all destinations in a cluster
 */
export function allocateClusterTime(
  destinationIds: string[],
  userPreferences: StandardizedPreference[],
  config: Partial<RouteGenerationConfig> = {}
): {
  totalHours: number
  destinationAllocations: Map<string, number>
  averageHoursPerDestination: number
} {
  const destinationAllocations = new Map<string, number>()
  let totalHours = 0
  
  for (const destinationId of destinationIds) {
    const allocation = allocateDestinationTime(
      destinationId,
      userPreferences,
      config
    )
    destinationAllocations.set(destinationId, allocation.allocatedHours)
    totalHours += allocation.allocatedHours
  }
  
  const averageHoursPerDestination = 
    destinationIds.length > 0 ? totalHours / destinationIds.length : 0
  
  return {
    totalHours,
    destinationAllocations,
    averageHoursPerDestination
  }
}

/**
 * Validate time allocation results
 */
export function validateTimeAllocation(
  allocatedHours: number,
  config: Partial<RouteGenerationConfig> = {}
): {
  isValid: boolean
  issues: string[]
} {
  const finalConfig = { ...DEFAULT_TIME_CONFIG, ...config }
  const issues: string[] = []
  
  // Check bounds
  if (allocatedHours < finalConfig.minDestinationHours) {
    issues.push(
      `Allocated time ${allocatedHours}h is below minimum ${finalConfig.minDestinationHours}h`
    )
  }
  
  if (allocatedHours > finalConfig.maxDestinationHours) {
    issues.push(
      `Allocated time ${allocatedHours}h exceeds maximum ${finalConfig.maxDestinationHours}h`
    )
  }
  
  // Check for invalid values
  if (isNaN(allocatedHours) || !isFinite(allocatedHours)) {
    issues.push('Allocated time is not a valid number')
  }
  
  if (allocatedHours < 0) {
    issues.push('Allocated time cannot be negative')
  }
  
  return {
    isValid: issues.length === 0,
    issues
  }
}

/**
 * Adjust time allocations to fit within daily constraints
 */
export function adjustTimeAllocationsForDailyLimit(
  destinationAllocations: Map<string, number>,
  dailyHours: number,
  travelTimeHours: number
): Map<string, number> {
  const availableVisitHours = dailyHours - travelTimeHours
  
  // If allocations fit, return as-is
  const totalAllocated = Array.from(destinationAllocations.values()).reduce(
    (sum, hours) => sum + hours,
    0
  )
  
  if (totalAllocated <= availableVisitHours) {
    return destinationAllocations
  }
  
  // Scale down proportionally
  const scaleFactor = availableVisitHours / totalAllocated
  const adjusted = new Map<string, number>()
  
  for (const [destinationId, hours] of Array.from(destinationAllocations.entries())) {
    // Maintain minimum time even after scaling
    const scaledHours = Math.max(
      DEFAULT_TIME_CONFIG.minDestinationHours,
      hours * scaleFactor
    )
    adjusted.set(destinationId, scaledHours)
  }
  
  return adjusted
}