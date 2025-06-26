// Types for day-by-day scheduling and time allocation

import type { Location } from './types'
import type { DestinationVisit, DetailedTransportSegment } from './detailed-route-types'

// Daily schedule configuration
export interface DailyScheduleConfig {
  startTimeHour: number // 9 AM default
  endTimeHour: number // 6 PM default
  maxDailyHours: number // 9 hours max sightseeing
  lunchStartHour: number // 12 PM
  lunchDuration: number // 1 hour
  bufferMinutes: number // 15 minutes between destinations
  morningEnergyHours: number // 9 AM - 12 PM high energy
  afternoonEnergyHours: number // 1 PM - 4 PM good energy
  eveningEnergyHours: number // 4 PM - 6 PM lower energy
}

// Single day schedule
export interface DaySchedule {
  dayNumber: number
  date: Date
  startTime: Date
  endTime: Date
  destinations: ScheduledDestination[]
  transportSegments: ScheduledTransport[]
  meals: MealBreak[]
  accommodation: AccommodationSuggestion | null
  summary: DaySummary
  validation: DayValidation
}

// Scheduled destination with specific timing
export interface ScheduledDestination {
  visit: DestinationVisit
  scheduledArrival: Date
  scheduledDeparture: Date
  energyPeriod: 'morning' | 'afternoon' | 'evening'
  isRushed: boolean
  isExtended: boolean
}

// Scheduled transport with timing
export interface ScheduledTransport {
  segment: DetailedTransportSegment
  scheduledDeparture: Date
  scheduledArrival: Date
  crossesLunch: boolean
  isDayTransition: boolean
}

// Meal break information
export interface MealBreak {
  type: 'lunch' | 'dinner'
  startTime: Date
  endTime: Date
  location: Location
  nearbyDestination: string
}

// Accommodation suggestion
export interface AccommodationSuggestion {
  location: Location
  searchRadius: number
  estimatedCostUSD: AccommodationCostEstimate
  nextDayAccess: {
    destinationName: string
    distanceKm: number
    travelTimeHours: number
  } | null
  reasoning: string
}

// Cost estimation
export interface AccommodationCostEstimate {
  budget: { min: number; max: number }
  standard: { min: number; max: number }
  premium: { min: number; max: number }
  locationMultiplier: number
  factors: string[]
}

// Daily summary statistics
export interface DaySummary {
  totalDestinations: number
  totalActiveHours: number
  totalTravelHours: number
  totalRestHours: number
  walkingDistanceKm: number
  totalDistanceKm: number
  utilizationRate: number // Percentage of available time used
  paceRating: 'relaxed' | 'moderate' | 'packed'
}

// Daily validation results
export interface DayValidation {
  isValid: boolean
  warnings: DayWarning[]
  errors: DayError[]
}

export interface DayWarning {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface DayError {
  code: string
  message: string
}

// Multi-day itinerary
export interface MultiDayItinerary {
  tripId: string
  startDate: Date
  endDate: Date
  totalDays: number
  daySchedules: DaySchedule[]
  accommodations: AccommodationPlan[]
  statistics: TripStatistics
  validation: ItineraryValidation
}

// Accommodation plan for entire trip
export interface AccommodationPlan {
  nightNumber: number
  date: Date
  location: Location
  estimatedCost: AccommodationCostEstimate
  nearbyAttractions: string[]
  checkInTime: Date
  checkOutTime: Date
}

// Comprehensive trip statistics
export interface TripStatistics {
  totalDestinations: number
  averageDestinationsPerDay: number
  totalDistanceKm: number
  distanceByMode: {
    walking: number
    driving: number
    flying: number
  }
  totalActiveHours: number
  totalTravelHours: number
  totalRestHours: number
  dailyPaceVariance: number
  estimatedCarbonKg: number
  estimatedAccommodationCost: {
    budget: { total: number; perNight: number }
    standard: { total: number; perNight: number }
    premium: { total: number; perNight: number }
  }
  currencyConsiderations: string[]
}

// Itinerary-wide validation
export interface ItineraryValidation {
  isValid: boolean
  dayValidations: Map<number, DayValidation>
  overallWarnings: string[]
  overallErrors: string[]
  suggestions: string[]
}

// Day optimization request
export interface DayOptimizationRequest {
  destinations: DestinationVisit[]
  availableHours: number
  priorityDestinationIds: string[]
  energyManagement: boolean
}

// Day optimization result
export interface DayOptimizationResult {
  optimizedSchedule: ScheduledDestination[]
  removedDestinations: DestinationVisit[]
  timeAdjustments: Map<string, { original: number; adjusted: number }>
  efficiency: number
}