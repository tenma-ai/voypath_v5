// Types for detailed route generation and itinerary

import type { Location } from './types'
import type { GroupMembers } from '@/lib/database.types'
import type { StandardizedPreference, DestinationCluster } from './normalization-types'
import type { TransportMode } from './algorithm-types'

// Detailed destination visit information
export interface DestinationVisit {
  destinationId: string
  destinationName: string
  location: Location
  arrivalTime: Date
  departureTime: Date
  allocatedHours: number
  wishfulUsers: WishfulUser[]
  isClusterEntry: boolean // First destination in cluster
  clusterId: string
  clusterName: string
  visitOrder: number // Global order in itinerary
}

// User who wished for this destination
export interface WishfulUser {
  member: GroupMembers
  preference: StandardizedPreference
  originalRating: number
  assignedColor: string
}

// Transport segment with detailed information
export interface DetailedTransportSegment {
  segmentId: string
  fromLocation: Location
  fromName: string
  toLocation: Location
  toName: string
  transportMode: TransportMode
  transportIcon: string
  distanceKm: number
  estimatedTimeHours: number
  departureTime: Date
  arrivalTime: Date
  routePath: Location[] // For MVP: just [from, to]
  warnings: string[]
}

// Complete detailed itinerary
export interface DetailedItinerary {
  tripId: string
  startDate: Date
  endDate: Date
  departureLocation: Location
  returnLocation: Location | null
  destinationVisits: DestinationVisit[]
  transportSegments: DetailedTransportSegment[]
  summary: ItinerarySummary
  validation: ItineraryValidation
}

// Summary statistics
export interface ItinerarySummary {
  totalDestinations: number
  totalClusters: number
  totalDays: number
  totalDistanceKm: number
  totalTravelTimeHours: number
  totalVisitTimeHours: number
  transportModes: TransportModeSummary
  userSatisfactionSummary: UserSatisfactionSummary[]
}

// Transport mode breakdown
export interface TransportModeSummary {
  walkingSegments: number
  walkingDistanceKm: number
  drivingSegments: number
  drivingDistanceKm: number
  flyingSegments: number
  flyingDistanceKm: number
}

// User satisfaction summary
export interface UserSatisfactionSummary {
  member: GroupMembers
  visitedWishlistCount: number
  totalWishlistCount: number
  satisfactionPercentage: number
}

// Validation results
export interface ItineraryValidation {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  affectedSegment?: string
  affectedDestination?: string
}

export interface ValidationWarning {
  code: string
  message: string
  affectedSegment?: string
  affectedDestination?: string
}

// Configuration for route generation
export interface RouteGenerationConfig {
  startTime: number // Start hour of day (e.g., 9 for 9:00 AM)
  dailyHours: number // Hours available per day (e.g., 9)
  minDestinationHours: number // Minimum time at destination
  maxDestinationHours: number // Maximum time at destination
  defaultDestinationHours: number // Default if no preferences
  walkingSpeedKmh: number
  drivingSpeedKmh: number
  flyingSpeedKmh: number
  walkingMaxDistanceKm: number
  drivingMaxDistanceKm: number
}