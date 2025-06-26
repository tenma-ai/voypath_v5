// Meal scheduling and lunch break integration

import type { 
  DaySchedule,
  MealBreak,
  DailyScheduleConfig,
  ScheduledDestination
} from './daily-schedule-types'
import type { Location } from './types'
import { calculateHaversineDistance } from './geographical-clustering'

/**
 * Insert lunch breaks into daily schedules
 */
export function insertLunchBreaks(
  daySchedule: DaySchedule,
  config: DailyScheduleConfig
): DaySchedule {
  const updatedSchedule = { ...daySchedule, meals: [...daySchedule.meals] }
  
  // Check if lunch break is needed
  const startHour = updatedSchedule.startTime.getHours()
  const endHour = updatedSchedule.endTime.getHours()
  
  // Skip if day doesn't cross lunch time
  if (endHour <= config.lunchStartHour || startHour >= config.lunchStartHour + 1) {
    return updatedSchedule
  }
  
  // Find optimal lunch position
  const lunchPosition = findOptimalLunchPosition(
    updatedSchedule.destinations,
    config
  )
  
  if (lunchPosition) {
    const lunchBreak = createLunchBreak(
      lunchPosition.afterDestination,
      lunchPosition.beforeDestination,
      config
    )
    
    // Adjust schedule timing
    updatedSchedule.meals.push(lunchBreak)
    adjustScheduleForLunch(updatedSchedule, lunchBreak, lunchPosition.index, config)
  }
  
  return updatedSchedule
}

/**
 * Find optimal position for lunch break
 */
function findOptimalLunchPosition(
  destinations: ScheduledDestination[],
  config: DailyScheduleConfig
): {
  index: number
  afterDestination: ScheduledDestination
  beforeDestination: ScheduledDestination | null
} | null {
  if (destinations.length === 0) return null
  
  const lunchTime = new Date(destinations[0].scheduledArrival)
  lunchTime.setHours(config.lunchStartHour, 0, 0, 0)
  
  // Find destinations around lunch time
  for (let i = 0; i < destinations.length; i++) {
    const current = destinations[i]
    const next = destinations[i + 1]
    
    // Check if current destination ends around lunch time
    const currentEndHour = current.scheduledDeparture.getHours()
    const currentEndMinutes = current.scheduledDeparture.getMinutes()
    const currentEndTime = currentEndHour + currentEndMinutes / 60
    
    // Ideal lunch window: 11:30 - 13:00
    if (currentEndTime >= 11.5 && currentEndTime <= 13) {
      return {
        index: i,
        afterDestination: current,
        beforeDestination: next || null
      }
    }
    
    // If destination spans lunch time, place lunch after it
    if (current.scheduledArrival.getHours() < config.lunchStartHour &&
        current.scheduledDeparture.getHours() >= config.lunchStartHour) {
      return {
        index: i,
        afterDestination: current,
        beforeDestination: next || null
      }
    }
  }
  
  // Default: place after destination closest to noon
  let closestIndex = 0
  let closestDiff = Infinity
  
  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i]
    const departureTime = dest.scheduledDeparture.getHours() + 
                         dest.scheduledDeparture.getMinutes() / 60
    const diff = Math.abs(departureTime - config.lunchStartHour)
    
    if (diff < closestDiff) {
      closestDiff = diff
      closestIndex = i
    }
  }
  
  return {
    index: closestIndex,
    afterDestination: destinations[closestIndex],
    beforeDestination: destinations[closestIndex + 1] || null
  }
}

/**
 * Create lunch break
 */
function createLunchBreak(
  afterDestination: ScheduledDestination,
  beforeDestination: ScheduledDestination | null,
  config: DailyScheduleConfig
): MealBreak {
  // Determine lunch location
  let lunchLocation: Location
  let nearbyDestination: string
  
  if (beforeDestination) {
    // Place lunch between two destinations
    lunchLocation = interpolateLocation(
      afterDestination.visit.location,
      beforeDestination.visit.location
    )
    nearbyDestination = `Between ${afterDestination.visit.destinationName} and ${beforeDestination.visit.destinationName}`
  } else {
    // Place lunch near last destination
    lunchLocation = afterDestination.visit.location
    nearbyDestination = afterDestination.visit.destinationName
  }
  
  // Set lunch timing
  const startTime = new Date(afterDestination.scheduledDeparture)
  startTime.setMinutes(startTime.getMinutes() + config.bufferMinutes)
  
  const endTime = new Date(startTime)
  endTime.setHours(startTime.getHours() + config.lunchDuration)
  
  return {
    type: 'lunch',
    startTime,
    endTime,
    location: lunchLocation,
    nearbyDestination
  }
}

/**
 * Interpolate location between two points
 */
function interpolateLocation(loc1: Location, loc2: Location): Location {
  return {
    id: `lunch-${Date.now()}`,
    latitude: (loc1.latitude + loc2.latitude) / 2,
    longitude: (loc1.longitude + loc2.longitude) / 2,
    name: 'Lunch location',
    address: 'Near attractions'
  }
}

/**
 * Adjust schedule timing for lunch break
 */
function adjustScheduleForLunch(
  schedule: DaySchedule,
  lunchBreak: MealBreak,
  afterIndex: number,
  config: DailyScheduleConfig
): void {
  const lunchDuration = (lunchBreak.endTime.getTime() - lunchBreak.startTime.getTime()) / 
                       (1000 * 60 * 60)
  
  // Shift all destinations after lunch
  for (let i = afterIndex + 1; i < schedule.destinations.length; i++) {
    const dest = schedule.destinations[i]
    dest.scheduledArrival = new Date(
      dest.scheduledArrival.getTime() + lunchDuration * 60 * 60 * 1000
    )
    dest.scheduledDeparture = new Date(
      dest.scheduledDeparture.getTime() + lunchDuration * 60 * 60 * 1000
    )
  }
  
  // Shift transport segments
  for (const transport of schedule.transportSegments) {
    if (transport.scheduledDeparture > lunchBreak.startTime) {
      transport.scheduledDeparture = new Date(
        transport.scheduledDeparture.getTime() + lunchDuration * 60 * 60 * 1000
      )
      transport.scheduledArrival = new Date(
        transport.scheduledArrival.getTime() + lunchDuration * 60 * 60 * 1000
      )
    }
  }
  
  // Update day end time
  if (schedule.destinations.length > 0) {
    const lastDest = schedule.destinations[schedule.destinations.length - 1]
    schedule.endTime = new Date(lastDest.scheduledDeparture)
  }
}

/**
 * Add dinner break if day extends late
 */
export function addDinnerIfNeeded(
  daySchedule: DaySchedule,
  config: DailyScheduleConfig
): DaySchedule {
  const updatedSchedule = { ...daySchedule }
  
  // Check if day extends past 6 PM
  if (updatedSchedule.endTime.getHours() < 18) {
    return updatedSchedule
  }
  
  // Find last destination
  const lastDestination = updatedSchedule.destinations[updatedSchedule.destinations.length - 1]
  if (!lastDestination) return updatedSchedule
  
  // Create dinner break
  const dinnerStart = new Date(lastDestination.scheduledDeparture)
  dinnerStart.setMinutes(dinnerStart.getMinutes() + config.bufferMinutes)
  
  const dinnerEnd = new Date(dinnerStart)
  dinnerEnd.setHours(dinnerStart.getHours() + 1.5) // 1.5 hours for dinner
  
  const dinnerBreak: MealBreak = {
    type: 'dinner',
    startTime: dinnerStart,
    endTime: dinnerEnd,
    location: lastDestination.visit.location,
    nearbyDestination: lastDestination.visit.destinationName
  }
  
  updatedSchedule.meals.push(dinnerBreak)
  updatedSchedule.endTime = dinnerEnd
  
  return updatedSchedule
}

/**
 * Find nearby restaurants for meal breaks
 */
export function suggestMealLocations(
  mealBreak: MealBreak,
  destinations: ScheduledDestination[]
): {
  nearbyOptions: string[]
  walkingDistance: boolean
  estimatedCost: { budget: number; standard: number; premium: number }
} {
  // Find destinations within walking distance (1km)
  const nearbyDestinations = destinations.filter(dest => {
    const distance = calculateHaversineDistance(
      mealBreak.location.latitude,
      mealBreak.location.longitude,
      dest.visit.location.latitude,
      dest.visit.location.longitude
    )
    return distance <= 1.0
  })
  
  const nearbyOptions = nearbyDestinations.map(
    dest => `Near ${dest.visit.destinationName}`
  )
  
  // Cost estimation based on location type
  let costMultiplier = 1.0
  if (nearbyDestinations.some(d => d.visit.destinationName.includes('Museum'))) {
    costMultiplier = 1.2 // Tourist area
  }
  if (nearbyDestinations.some(d => d.visit.destinationName.includes('Market'))) {
    costMultiplier = 0.8 // Local area
  }
  
  const estimatedCost = {
    budget: 10 * costMultiplier,
    standard: 20 * costMultiplier,
    premium: 40 * costMultiplier
  }
  
  return {
    nearbyOptions,
    walkingDistance: nearbyOptions.length > 0,
    estimatedCost
  }
}

/**
 * Validate meal scheduling
 */
export function validateMealSchedule(
  daySchedule: DaySchedule,
  config: DailyScheduleConfig
): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []
  
  // Check for lunch if day crosses noon
  const crossesNoon = daySchedule.startTime.getHours() < 12 && 
                     daySchedule.endTime.getHours() >= 13
  const hasLunch = daySchedule.meals.some(m => m.type === 'lunch')
  
  if (crossesNoon && !hasLunch) {
    issues.push('Day crosses lunch time but no lunch break scheduled')
  }
  
  // Check for overlapping meals
  for (let i = 0; i < daySchedule.meals.length - 1; i++) {
    const current = daySchedule.meals[i]
    const next = daySchedule.meals[i + 1]
    
    if (current.endTime > next.startTime) {
      issues.push(`${current.type} and ${next.type} breaks overlap`)
    }
  }
  
  // Check meal timing
  for (const meal of daySchedule.meals) {
    if (meal.type === 'lunch') {
      const lunchHour = meal.startTime.getHours()
      if (lunchHour < 11 || lunchHour > 14) {
        issues.push(`Lunch scheduled at unusual time: ${lunchHour}:00`)
      }
    }
    
    if (meal.type === 'dinner') {
      const dinnerHour = meal.startTime.getHours()
      if (dinnerHour < 17 || dinnerHour > 21) {
        issues.push(`Dinner scheduled at unusual time: ${dinnerHour}:00`)
      }
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  }
}