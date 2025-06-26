// Enhanced time allocation with energy management and buffer times

import type { StandardizedPreference } from './normalization-types'
import type { RouteGenerationConfig } from './detailed-route-types'
// Simple destination interface for time allocation
interface Destination {
  id: string
  location: {
    latitude: number
    longitude: number
  }
}

export interface EnhancedTimeAllocation {
  destinationId: string
  allocatedHours: number
  bufferMinutes: number
  contributingUsers: string[]
  isDefault: boolean
  energyPeriod: 'morning' | 'afternoon' | 'evening'
  priorityLevel: 'high' | 'medium' | 'low'
}

export interface TimeOfDayContext {
  currentHour: number // 0-23
  dayProgress: number // 0-1
  previousActivityHours: number
  isAfterLunch: boolean
}

// Energy level multipliers for different times of day
const ENERGY_MULTIPLIERS = {
  morning: { morning: 1.0, afternoon: 0.9, evening: 0.8 },
  afternoon: { morning: 0.95, afternoon: 1.0, evening: 0.85 },
  evening: { morning: 0.8, afternoon: 0.9, evening: 1.0 }
}

/**
 * Determine priority level based on user ratings
 */
function determinePriorityLevel(
  preferences: StandardizedPreference[]
): 'high' | 'medium' | 'low' {
  if (preferences.length === 0) return 'medium'
  
  const avgRating = preferences.reduce(
    (sum, pref) => sum + pref.standardizedScore,
    0
  ) / preferences.length
  
  if (avgRating >= 0.8) return 'high'
  if (avgRating >= 0.5) return 'medium'
  return 'low'
}

/**
 * Determine optimal energy period for destination
 */
function determineOptimalEnergyPeriod(
  priorityLevel: 'high' | 'medium' | 'low',
  destinationType?: string
): 'morning' | 'afternoon' | 'evening' {
  // High priority destinations in morning when energy is highest
  if (priorityLevel === 'high') {
    return 'morning'
  }
  
  // Medium priority in afternoon
  if (priorityLevel === 'medium') {
    return 'afternoon'
  }
  
  // Low priority or dining/entertainment in evening
  return 'evening'
}

/**
 * Apply time of day adjustments to allocation
 */
function applyTimeOfDayAdjustment(
  baseHours: number,
  energyPeriod: 'morning' | 'afternoon' | 'evening',
  timeContext?: TimeOfDayContext
): number {
  if (!timeContext) return baseHours
  
  let currentPeriod: 'morning' | 'afternoon' | 'evening'
  
  if (timeContext.currentHour >= 9 && timeContext.currentHour < 12) {
    currentPeriod = 'morning'
  } else if (timeContext.currentHour >= 12 && timeContext.currentHour < 17) {
    currentPeriod = 'afternoon'
  } else {
    currentPeriod = 'evening'
  }
  
  // Apply energy multiplier
  const multiplier = ENERGY_MULTIPLIERS[energyPeriod][currentPeriod]
  let adjustedHours = baseHours * multiplier
  
  // Reduce time if late in the day or after long activities
  if (timeContext.dayProgress > 0.7) {
    adjustedHours *= 0.9
  }
  
  if (timeContext.previousActivityHours > 3) {
    adjustedHours *= 0.95
  }
  
  return adjustedHours
}

/**
 * Calculate buffer time based on destination and context
 */
function calculateBufferMinutes(
  priorityLevel: 'high' | 'medium' | 'low',
  isLastOfDay: boolean = false
): number {
  // Base buffer time
  let bufferMinutes = 15
  
  // Add more buffer for high-priority destinations
  if (priorityLevel === 'high') {
    bufferMinutes += 10
  }
  
  // Extra buffer if last destination of day
  if (isLastOfDay) {
    bufferMinutes += 15
  }
  
  return bufferMinutes
}

/**
 * Enhanced time allocation with energy management
 */
export function allocateDestinationTimeEnhanced(
  destinationId: string,
  destination: Destination | undefined,
  userPreferences: StandardizedPreference[],
  config: Partial<RouteGenerationConfig> = {},
  timeContext?: TimeOfDayContext
): EnhancedTimeAllocation {
  const finalConfig = {
    minDestinationHours: 0.5,
    maxDestinationHours: 8.0,
    defaultDestinationHours: 2.0,
    ...config
  }
  
  // Find preferences for this destination
  const relevantPrefs = userPreferences.filter(
    pref => pref.destinationId === destinationId
  )
  
  // Determine priority and energy period
  const priorityLevel = determinePriorityLevel(relevantPrefs)
  const energyPeriod = determineOptimalEnergyPeriod(priorityLevel)
  
  // Calculate base allocation
  let allocatedHours: number
  let contributingUsers: string[] = []
  let isDefault = false
  
  if (relevantPrefs.length === 0) {
    allocatedHours = finalConfig.defaultDestinationHours
    isDefault = true
  } else {
    // Average preferred duration
    const totalDuration = relevantPrefs.reduce(
      (sum, pref) => sum + pref.preferredDuration,
      0
    )
    allocatedHours = totalDuration / relevantPrefs.length
    
    contributingUsers = relevantPrefs.map(
      pref => pref.userId || pref.sessionId || 'unknown'
    )
  }
  
  // Apply time of day adjustments
  allocatedHours = applyTimeOfDayAdjustment(
    allocatedHours,
    energyPeriod,
    timeContext
  )
  
  // Apply bounds
  allocatedHours = Math.max(
    finalConfig.minDestinationHours,
    Math.min(finalConfig.maxDestinationHours, allocatedHours)
  )
  
  // Calculate buffer time
  const bufferMinutes = calculateBufferMinutes(priorityLevel)
  
  return {
    destinationId,
    allocatedHours,
    bufferMinutes,
    contributingUsers,
    isDefault,
    energyPeriod,
    priorityLevel
  }
}

/**
 * Redistribute time within a day for better balance
 */
export function redistributeDayTime(
  allocations: EnhancedTimeAllocation[],
  availableHours: number,
  preservePriority: boolean = true
): EnhancedTimeAllocation[] {
  const totalAllocated = allocations.reduce(
    (sum, a) => sum + a.allocatedHours + (a.bufferMinutes / 60),
    0
  )
  
  // If within limits, return as-is
  if (totalAllocated <= availableHours) {
    return allocations
  }
  
  // Need to reduce time
  const reductionNeeded = totalAllocated - availableHours
  const reductionFactor = availableHours / totalAllocated
  
  return allocations.map(allocation => {
    let newHours = allocation.allocatedHours
    let newBuffer = allocation.bufferMinutes
    
    if (preservePriority) {
      // Reduce low priority more than high priority
      const priorityMultiplier = {
        high: 0.9,
        medium: 0.8,
        low: 0.6
      }[allocation.priorityLevel]
      
      newHours = allocation.allocatedHours * reductionFactor * priorityMultiplier
      newBuffer = allocation.bufferMinutes * reductionFactor
    } else {
      // Uniform reduction
      newHours = allocation.allocatedHours * reductionFactor
      newBuffer = allocation.bufferMinutes * reductionFactor
    }
    
    // Ensure minimum times
    newHours = Math.max(0.5, newHours)
    newBuffer = Math.max(10, newBuffer)
    
    return {
      ...allocation,
      allocatedHours: newHours,
      bufferMinutes: Math.round(newBuffer)
    }
  })
}

/**
 * Suggest time redistribution for under-packed days
 */
export function suggestTimeAdditions(
  allocations: EnhancedTimeAllocation[],
  availableHours: number,
  currentTotal: number
): Map<string, number> {
  const suggestions = new Map<string, number>()
  const extraHours = availableHours - currentTotal
  
  if (extraHours <= 0) return suggestions
  
  // Distribute extra time prioritizing high-rated destinations
  const sortedByPriority = [...allocations].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priorityLevel] - priorityOrder[a.priorityLevel]
  })
  
  // Give more time to top destinations
  let remainingExtra = extraHours
  for (let i = 0; i < sortedByPriority.length && remainingExtra > 0; i++) {
    const allocation = sortedByPriority[i]
    const currentHours = allocation.allocatedHours
    
    // Can add up to 50% more time
    const maxAddition = Math.min(currentHours * 0.5, remainingExtra)
    
    if (maxAddition > 0.25) { // Only suggest if meaningful addition
      suggestions.set(allocation.destinationId, currentHours + maxAddition)
      remainingExtra -= maxAddition
    }
  }
  
  return suggestions
}