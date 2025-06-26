// Accommodation suggestion algorithm for multi-day trips

import type { Location } from './types'
import type { DaySchedule, AccommodationSuggestion, AccommodationCostEstimate } from './daily-schedule-types'

// Major airports data for MVP (to be expanded)
const MAJOR_AIRPORTS: { [key: string]: Location } = {
  'TOKYO': { id: 'NRT', name: 'Narita Airport', latitude: 35.7720, longitude: 140.3929 },
  'OSAKA': { id: 'KIX', name: 'Kansai Airport', latitude: 34.4347, longitude: 135.2440 },
  'LONDON': { id: 'LHR', name: 'Heathrow Airport', latitude: 51.4700, longitude: -0.4543 },
  'PARIS': { id: 'CDG', name: 'Charles de Gaulle', latitude: 49.0097, longitude: 2.5479 },
  'NEWYORK': { id: 'JFK', name: 'JFK Airport', latitude: 40.6413, longitude: -73.7781 },
  'LOSANGELES': { id: 'LAX', name: 'LAX Airport', latitude: 33.9416, longitude: -118.4085 }
}

// Accommodation cost factors
interface AccommodationCostFactors {
  isCapitalCity: boolean
  isTouristDestination: boolean
  isRuralArea: boolean
  isHighSeason: boolean
}

/**
 * Calculate geographic center of day's destinations
 */
function calculateDayCenter(daySchedule: DaySchedule): Location {
  const destinations = daySchedule.destinations
  
  if (destinations.length === 0) {
    // Fallback to a default location if no destinations
    return { id: 'center', name: 'Center', latitude: 0, longitude: 0 }
  }
  
  const centerLat = destinations.reduce((sum, d) => sum + d.visit.location.latitude, 0) / destinations.length
  const centerLng = destinations.reduce((sum, d) => sum + d.visit.location.longitude, 0) / destinations.length
  
  return {
    id: 'day-center',
    name: 'Day Center',
    latitude: centerLat,
    longitude: centerLng
  }
}

/**
 * Calculate distance between two locations (Haversine formula)
 */
function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371 // Earth's radius in km
  const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180
  const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * Find nearest major city/airport for accommodation
 */
function findNearestHub(location: Location): { hub: Location, distance: number } {
  let nearestHub = MAJOR_AIRPORTS.TOKYO
  let minDistance = Infinity
  
  for (const airport of Object.values(MAJOR_AIRPORTS)) {
    const distance = calculateDistance(location, airport)
    if (distance < minDistance) {
      minDistance = distance
      nearestHub = airport
    }
  }
  
  return { hub: nearestHub, distance: minDistance }
}

/**
 * Determine accommodation cost factors based on location
 */
function determineLocationFactors(location: Location): AccommodationCostFactors {
  const { hub, distance } = findNearestHub(location)
  
  // Simple heuristics for MVP
  const isCapitalCity = distance < 50 // Within 50km of major hub
  const isTouristDestination = distance < 100 // Within 100km of major hub
  const isRuralArea = distance > 200 // Over 200km from major hub
  const isHighSeason = false // TODO: Add seasonal logic
  
  return { isCapitalCity, isTouristDestination, isRuralArea, isHighSeason }
}

/**
 * Estimate accommodation cost based on location
 */
export function estimateAccommodationCost(
  location: Location,
  qualityTier: 'budget' | 'standard' | 'premium' = 'standard'
): number {
  const baseCost = {
    budget: 65,    // $50-80 average
    standard: 115, // $80-150 average
    premium: 200   // $150+ average
  }[qualityTier]
  
  const factors = determineLocationFactors(location)
  let multiplier = 1.0
  
  // Apply location-based multipliers
  if (factors.isCapitalCity) multiplier *= 1.8
  else if (factors.isTouristDestination) multiplier *= 1.4
  else if (factors.isRuralArea) multiplier *= 0.7
  
  if (factors.isHighSeason) multiplier *= 1.3
  
  return Math.round(baseCost * multiplier)
}

/**
 * Suggest accommodation for a day considering next day's activities
 */
export function suggestAccommodation(
  currentDay: DaySchedule,
  nextDay: DaySchedule | null,
  qualityPreference: 'budget' | 'standard' | 'premium' = 'standard'
): AccommodationSuggestion {
  // Calculate center of current day's activities
  const dayCenter = calculateDayCenter(currentDay)
  
  // If there's a next day, consider its first destination
  let optimalLocation = dayCenter
  let description = `Near day's activities`
  
  if (nextDay) {
    const nextDayFirstDestination = nextDay.destinations[0]
    if (nextDayFirstDestination) {
      // Find point between day center and next day's first destination
      // Weighted 70% towards current day, 30% towards next day
      optimalLocation = {
        id: 'accommodation',
        name: 'Suggested Accommodation Area',
        latitude: dayCenter.latitude * 0.7 + nextDayFirstDestination.visit.location.latitude * 0.3,
        longitude: dayCenter.longitude * 0.7 + nextDayFirstDestination.visit.location.longitude * 0.3
      }
      description = `Between today's destinations and tomorrow's first stop`
    }
  }
  
  // Find nearest hub for better accommodation options
  const { hub, distance } = findNearestHub(optimalLocation)
  const baseCost = estimateAccommodationCost(optimalLocation, qualityPreference)
  const costEstimate: AccommodationCostEstimate = {
    budget: { min: baseCost * 0.7, max: baseCost * 1.2 },
    standard: { min: baseCost * 0.8, max: baseCost * 1.5 },
    premium: { min: baseCost * 1.2, max: baseCost * 2.5 },
    locationMultiplier: 1.0,
    factors: ['Location-based pricing']
  }
  
  // Generate search areas within reasonable distance
  const searchAreas = [
    {
      name: 'City Center',
      distanceKm: Math.min(distance, 10),
      estimatedCost: baseCost * 1.2
    },
    {
      name: 'Near Activities',
      distanceKm: 5,
      estimatedCost: baseCost
    },
    {
      name: 'Transport Hub Area',
      distanceKm: Math.min(distance + 5, 15),
      estimatedCost: baseCost * 0.9
    }
  ]
  
  return {
    location: optimalLocation,
    searchRadius: 10, // 10km search radius
    estimatedCostUSD: costEstimate,
    nextDayAccess: nextDay && nextDay.destinations[0] ? {
      destinationName: nextDay.destinations[0].visit.destinationName,
      distanceKm: distance,
      travelTimeHours: distance / 50 // Rough estimate
    } : null,
    reasoning: description
  }
}

/**
 * Suggest accommodations for entire multi-day itinerary
 */
export function suggestAllAccommodations(
  dailySchedules: DaySchedule[],
  qualityPreference: 'budget' | 'standard' | 'premium' = 'standard'
): AccommodationSuggestion[] {
  const suggestions: AccommodationSuggestion[] = []
  
  // Don't need accommodation for single day trips
  if (dailySchedules.length <= 1) {
    return suggestions
  }
  
  // Suggest accommodation for each day except the last
  for (let i = 0; i < dailySchedules.length - 1; i++) {
    const currentDay = dailySchedules[i]
    const nextDay = dailySchedules[i + 1] || null
    
    const suggestion = suggestAccommodation(currentDay, nextDay, qualityPreference)
    suggestions.push(suggestion)
  }
  
  return suggestions
}

/**
 * Calculate total estimated accommodation cost for trip
 */
export function calculateTotalAccommodationCost(
  suggestions: AccommodationSuggestion[]
): {
  totalCostUSD: number
  costBreakdown: { day: number, cost: number }[]
  averageCostPerNight: number
} {
  const costBreakdown = suggestions.map((s, index) => ({
    day: index + 1,
    cost: (s.estimatedCostUSD.standard.min + s.estimatedCostUSD.standard.max) / 2
  }))
  
  const totalCostUSD = costBreakdown.reduce((sum, item) => sum + item.cost, 0)
  const averageCostPerNight = suggestions.length > 0 ? totalCostUSD / suggestions.length : 0
  
  return {
    totalCostUSD,
    costBreakdown,
    averageCostPerNight
  }
}