// Day splitting algorithm for multi-day itineraries

import type { 
  DaySchedule,
  DailyScheduleConfig,
  ScheduledDestination,
  ScheduledTransport,
  DaySummary,
  DayValidation,
  DayWarning,
  DayError
} from './daily-schedule-types'
import type { 
  DestinationVisit,
  DetailedTransportSegment,
  DetailedItinerary
} from './detailed-route-types'

// Default daily schedule configuration
export const DEFAULT_DAILY_CONFIG: DailyScheduleConfig = {
  startTimeHour: 9, // 9 AM
  endTimeHour: 18, // 6 PM
  maxDailyHours: 9,
  lunchStartHour: 12,
  lunchDuration: 1,
  bufferMinutes: 15,
  morningEnergyHours: 3, // 9 AM - 12 PM
  afternoonEnergyHours: 3, // 1 PM - 4 PM
  eveningEnergyHours: 2 // 4 PM - 6 PM
}

/**
 * Split linear itinerary into day-by-day schedules
 */
export function splitIntoDays(
  itinerary: DetailedItinerary,
  config: DailyScheduleConfig = DEFAULT_DAILY_CONFIG
): DaySchedule[] {
  const daySchedules: DaySchedule[] = []
  let currentDay: DaySchedule | null = null
  let dayNumber = 1
  let currentDate = new Date(itinerary.startDate)
  let dayStartTime = createDayStartTime(currentDate, config)
  let accumulatedHours = 0
  
  // Process each destination visit
  for (let i = 0; i < itinerary.destinationVisits.length; i++) {
    const visit = itinerary.destinationVisits[i]
    const transportBefore = findTransportBefore(visit, itinerary.transportSegments)
    
    // Calculate time needed for this destination
    const transportTime = transportBefore?.estimatedTimeHours || 0
    const visitTime = visit.allocatedHours
    const bufferTime = config.bufferMinutes / 60
    const totalTimeNeeded = transportTime + visitTime + bufferTime
    
    // Check if we need to start a new day
    const wouldExceedDailyLimit = accumulatedHours + totalTimeNeeded > config.maxDailyHours
    const wouldExceedEndTime = wouldExceedDayEndTime(
      dayStartTime,
      accumulatedHours + totalTimeNeeded,
      config
    )
    const isLongTransport = transportTime > 4 // Long transport suggests overnight
    
    if (currentDay && (wouldExceedDailyLimit || wouldExceedEndTime || isLongTransport)) {
      // Complete current day
      currentDay = finalizeDaySchedule(currentDay, config)
      daySchedules.push(currentDay)
      
      // Start new day
      dayNumber++
      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + 1)
      dayStartTime = createDayStartTime(currentDate, config)
      accumulatedHours = 0
      currentDay = null
    }
    
    // Initialize new day if needed
    if (!currentDay) {
      currentDay = createNewDay(dayNumber, currentDate, dayStartTime, config)
    }
    
    // Add destination to current day
    const scheduledTime = new Date(
      dayStartTime.getTime() + accumulatedHours * 60 * 60 * 1000
    )
    
    const scheduledDestination = createScheduledDestination(
      visit,
      scheduledTime,
      accumulatedHours,
      config
    )
    
    currentDay.destinations.push(scheduledDestination)
    
    // Add transport if exists
    if (transportBefore) {
      const scheduledTransport = createScheduledTransport(
        transportBefore,
        scheduledTime,
        accumulatedHours,
        config
      )
      currentDay.transportSegments.push(scheduledTransport)
    }
    
    // Update accumulated time
    accumulatedHours += totalTimeNeeded
  }
  
  // Finalize last day
  if (currentDay) {
    currentDay = finalizeDaySchedule(currentDay, config)
    daySchedules.push(currentDay)
  }
  
  // Add final transport if returning
  const finalTransport = itinerary.transportSegments[itinerary.transportSegments.length - 1]
  if (finalTransport && finalTransport.toName === 'Return') {
    const lastDay = daySchedules[daySchedules.length - 1]
    if (lastDay) {
      const scheduledTransport = createScheduledTransport(
        finalTransport,
        lastDay.endTime,
        0,
        config
      )
      lastDay.transportSegments.push(scheduledTransport)
    }
  }
  
  return daySchedules
}

/**
 * Create a new day schedule
 */
function createNewDay(
  dayNumber: number,
  date: Date,
  startTime: Date,
  config: DailyScheduleConfig
): DaySchedule {
  const endTime = new Date(startTime)
  endTime.setHours(config.endTimeHour, 0, 0, 0)
  
  return {
    dayNumber,
    date: new Date(date),
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    destinations: [],
    transportSegments: [],
    meals: [],
    accommodation: null,
    summary: createEmptySummary(),
    validation: { isValid: true, warnings: [], errors: [] }
  }
}

/**
 * Create day start time
 */
function createDayStartTime(date: Date, config: DailyScheduleConfig): Date {
  const startTime = new Date(date)
  startTime.setHours(config.startTimeHour, 0, 0, 0)
  return startTime
}

/**
 * Check if time would exceed day end
 */
function wouldExceedDayEndTime(
  dayStart: Date,
  hoursFromStart: number,
  config: DailyScheduleConfig
): boolean {
  const projectedTime = new Date(
    dayStart.getTime() + hoursFromStart * 60 * 60 * 1000
  )
  return projectedTime.getHours() >= config.endTimeHour
}

/**
 * Create scheduled destination
 */
function createScheduledDestination(
  visit: DestinationVisit,
  scheduledTime: Date,
  hoursIntoDay: number,
  config: DailyScheduleConfig
): ScheduledDestination {
  const arrival = new Date(scheduledTime)
  const departure = new Date(
    arrival.getTime() + visit.allocatedHours * 60 * 60 * 1000
  )
  
  // Determine energy period
  let energyPeriod: 'morning' | 'afternoon' | 'evening'
  if (hoursIntoDay < config.morningEnergyHours) {
    energyPeriod = 'morning'
  } else if (hoursIntoDay < config.morningEnergyHours + 1 + config.afternoonEnergyHours) {
    energyPeriod = 'afternoon'
  } else {
    energyPeriod = 'evening'
  }
  
  return {
    visit,
    scheduledArrival: arrival,
    scheduledDeparture: departure,
    energyPeriod,
    isRushed: visit.allocatedHours < 1,
    isExtended: visit.allocatedHours > 4
  }
}

/**
 * Create scheduled transport
 */
function createScheduledTransport(
  segment: DetailedTransportSegment,
  scheduledTime: Date,
  hoursIntoDay: number,
  config: DailyScheduleConfig
): ScheduledTransport {
  const departure = new Date(scheduledTime)
  const arrival = new Date(
    departure.getTime() + segment.estimatedTimeHours * 60 * 60 * 1000
  )
  
  // Check if crosses lunch
  const departureHour = departure.getHours()
  const arrivalHour = arrival.getHours()
  const crossesLunch = departureHour < config.lunchStartHour && 
                      arrivalHour > config.lunchStartHour
  
  return {
    segment,
    scheduledDeparture: departure,
    scheduledArrival: arrival,
    crossesLunch,
    isDayTransition: segment.estimatedTimeHours > 4
  }
}

/**
 * Find transport segment before a destination
 */
function findTransportBefore(
  visit: DestinationVisit,
  segments: DetailedTransportSegment[]
): DetailedTransportSegment | null {
  return segments.find(s => 
    s.toLocation.latitude === visit.location.latitude &&
    s.toLocation.longitude === visit.location.longitude
  ) || null
}

/**
 * Finalize day schedule with summary and validation
 */
function finalizeDaySchedule(
  day: DaySchedule,
  config: DailyScheduleConfig
): DaySchedule {
  // Update end time based on actual schedule
  if (day.destinations.length > 0) {
    const lastDestination = day.destinations[day.destinations.length - 1]
    day.endTime = new Date(lastDestination.scheduledDeparture)
  }
  
  // Calculate summary
  day.summary = calculateDaySummary(day, config)
  
  // Validate day
  day.validation = validateDaySchedule(day, config)
  
  return day
}

/**
 * Calculate day summary statistics
 */
function calculateDaySummary(
  day: DaySchedule,
  config: DailyScheduleConfig
): DaySummary {
  const totalDestinations = day.destinations.length
  
  // Calculate hours
  let totalActiveHours = 0
  let totalTravelHours = 0
  let walkingDistanceKm = 0
  let totalDistanceKm = 0
  
  for (const dest of day.destinations) {
    totalActiveHours += dest.visit.allocatedHours
  }
  
  for (const transport of day.transportSegments) {
    totalTravelHours += transport.segment.estimatedTimeHours
    totalDistanceKm += transport.segment.distanceKm
    
    if (transport.segment.transportMode === 'walking') {
      walkingDistanceKm += transport.segment.distanceKm
    }
  }
  
  const totalRestHours = day.meals.reduce(
    (sum, meal) => sum + (meal.endTime.getTime() - meal.startTime.getTime()) / (1000 * 60 * 60),
    0
  )
  
  const totalDayHours = (day.endTime.getTime() - day.startTime.getTime()) / (1000 * 60 * 60)
  const utilizationRate = totalDayHours > 0 
    ? ((totalActiveHours + totalTravelHours) / config.maxDailyHours) * 100
    : 0
  
  // Determine pace rating
  let paceRating: 'relaxed' | 'moderate' | 'packed'
  if (utilizationRate < 60) {
    paceRating = 'relaxed'
  } else if (utilizationRate < 85) {
    paceRating = 'moderate'
  } else {
    paceRating = 'packed'
  }
  
  return {
    totalDestinations,
    totalActiveHours,
    totalTravelHours,
    totalRestHours,
    walkingDistanceKm,
    totalDistanceKm,
    utilizationRate,
    paceRating
  }
}

/**
 * Validate day schedule
 */
function validateDaySchedule(
  day: DaySchedule,
  config: DailyScheduleConfig
): DayValidation {
  const warnings: DayWarning[] = []
  const errors: DayError[] = []
  
  // Check for overtime
  const totalHours = day.summary.totalActiveHours + day.summary.totalTravelHours
  if (totalHours > config.maxDailyHours) {
    errors.push({
      code: 'EXCEEDS_DAILY_LIMIT',
      message: `Day ${day.dayNumber} has ${totalHours.toFixed(1)} hours of activities (limit: ${config.maxDailyHours})`
    })
  }
  
  // Check for too many destinations
  if (day.summary.totalDestinations > 6) {
    warnings.push({
      code: 'TOO_MANY_DESTINATIONS',
      message: `Day ${day.dayNumber} has ${day.summary.totalDestinations} destinations which may be tiring`,
      severity: 'medium'
    })
  }
  
  // Check for excessive walking
  if (day.summary.walkingDistanceKm > 10) {
    warnings.push({
      code: 'EXCESSIVE_WALKING',
      message: `Day ${day.dayNumber} includes ${day.summary.walkingDistanceKm.toFixed(1)}km of walking`,
      severity: 'high'
    })
  }
  
  // Check for late finish
  if (day.endTime.getHours() >= config.endTimeHour) {
    warnings.push({
      code: 'LATE_FINISH',
      message: `Day ${day.dayNumber} ends after ${config.endTimeHour}:00`,
      severity: 'low'
    })
  }
  
  // Check pace
  if (day.summary.paceRating === 'packed') {
    warnings.push({
      code: 'PACKED_SCHEDULE',
      message: `Day ${day.dayNumber} has a very packed schedule (${day.summary.utilizationRate.toFixed(0)}% utilization)`,
      severity: 'medium'
    })
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

/**
 * Create empty summary
 */
function createEmptySummary(): DaySummary {
  return {
    totalDestinations: 0,
    totalActiveHours: 0,
    totalTravelHours: 0,
    totalRestHours: 0,
    walkingDistanceKm: 0,
    totalDistanceKm: 0,
    utilizationRate: 0,
    paceRating: 'relaxed'
  }
}

/**
 * Merge consecutive days if under-utilized
 */
export function optimizeDaySplits(
  daySchedules: DaySchedule[],
  config: DailyScheduleConfig = DEFAULT_DAILY_CONFIG
): DaySchedule[] {
  const optimized: DaySchedule[] = []
  
  for (let i = 0; i < daySchedules.length; i++) {
    const currentDay = daySchedules[i]
    const nextDay = daySchedules[i + 1]
    
    if (!nextDay) {
      optimized.push(currentDay)
      continue
    }
    
    // Check if days can be merged
    const currentUtilization = currentDay.summary.utilizationRate
    const nextUtilization = nextDay.summary.utilizationRate
    const combinedHours = currentDay.summary.totalActiveHours + 
                         currentDay.summary.totalTravelHours +
                         nextDay.summary.totalActiveHours +
                         nextDay.summary.totalTravelHours
    
    if (currentUtilization < 50 && nextUtilization < 50 && combinedHours <= config.maxDailyHours) {
      // Merge days
      const merged = mergeDays(currentDay, nextDay, config)
      optimized.push(merged)
      i++ // Skip next day
    } else {
      optimized.push(currentDay)
    }
  }
  
  return optimized
}

/**
 * Merge two days into one
 */
function mergeDays(
  day1: DaySchedule,
  day2: DaySchedule,
  config: DailyScheduleConfig
): DaySchedule {
  const merged: DaySchedule = {
    ...day1,
    destinations: [...day1.destinations, ...day2.destinations],
    transportSegments: [...day1.transportSegments, ...day2.transportSegments],
    meals: [...day1.meals, ...day2.meals],
    endTime: day2.endTime
  }
  
  // Recalculate schedule times
  let currentTime = merged.startTime
  for (const dest of merged.destinations) {
    dest.scheduledArrival = new Date(currentTime)
    dest.scheduledDeparture = new Date(
      currentTime.getTime() + dest.visit.allocatedHours * 60 * 60 * 1000
    )
    currentTime = dest.scheduledDeparture
  }
  
  // Update summary and validation
  merged.summary = calculateDaySummary(merged, config)
  merged.validation = validateDaySchedule(merged, config)
  
  return merged
}