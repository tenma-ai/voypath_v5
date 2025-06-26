// Main detailed route generation system

import type { 
  DetailedItinerary,
  DestinationVisit,
  DetailedTransportSegment,
  RouteGenerationConfig,
  ItinerarySummary,
  ItineraryValidation,
  ValidationError,
  ValidationWarning,
  TransportModeSummary,
  UserSatisfactionSummary
} from './detailed-route-types'
import type { PreprocessedData, Location } from './types'
import type { GroupMembers } from '@/lib/database.types'
import type { RouteSolution } from './algorithm-types'
import type { StandardizedPreference, DestinationCluster } from './normalization-types'

import { optimizeClusterInternally } from './cluster-internal-optimizer'
import { allocateDestinationTime } from './time-allocator'
import { determineTransportMode } from './transport-mode-selector'
import { findWishfulUsers, calculateUserSatisfactionStats } from './user-association'
import { v4 as uuidv4 } from 'uuid'

// Default configuration
const DEFAULT_CONFIG: RouteGenerationConfig = {
  startTime: 9, // 9:00 AM
  dailyHours: 9, // 9 hours per day
  minDestinationHours: 0.5,
  maxDestinationHours: 8.0,
  defaultDestinationHours: 2.0,
  walkingSpeedKmh: 5,
  drivingSpeedKmh: 60,
  flyingSpeedKmh: 500,
  walkingMaxDistanceKm: 2,
  drivingMaxDistanceKm: 300
}

/**
 * Generate detailed itinerary from optimized route solution
 */
export async function generateDetailedItinerary(
  routeSolution: RouteSolution,
  preprocessedData: PreprocessedData,
  preferences: StandardizedPreference[],
  config: Partial<RouteGenerationConfig> = {}
): Promise<DetailedItinerary> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Initialize tracking variables
  const destinationVisits: DestinationVisit[] = []
  const transportSegments: DetailedTransportSegment[] = []
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  
  // Start date and time
  const startDate = new Date(preprocessedData.tripDuration.startDate || Date.now())
  startDate.setHours(finalConfig.startTime, 0, 0, 0)
  let currentTime = new Date(startDate)
  let currentLocation = preprocessedData.departureLocation
  let globalVisitOrder = 0
  
  // Process each cluster in the route
  for (let clusterIndex = 0; clusterIndex < routeSolution.clusters.length; clusterIndex++) {
    const cluster = routeSolution.clusters[clusterIndex]
    
    // Generate transport segment to cluster
    if (clusterIndex > 0 || currentLocation.id !== cluster.centerLocation.id) {
      const transportSegment = generateTransportSegment(
        currentLocation,
        cluster.centerLocation,
        currentTime,
        clusterIndex === 0 ? 'Departure' : getDestinationName(routeSolution.clusters[clusterIndex - 1].destinations[0]),
        getDestinationName(cluster.destinations[0]),
        finalConfig
      )
      
      transportSegments.push(transportSegment)
      currentTime = new Date(transportSegment.arrivalTime)
      
      // Validate transport segment
      const segmentValidation = validateTransportSegment(transportSegment)
      warnings.push(...segmentValidation.warnings.map(w => ({
        ...w,
        affectedSegment: transportSegment.segmentId
      })))
    }
    
    // Optimize internal cluster routing
    const clusterDestinations = cluster.destinations.map(dest => ({
      id: dest.id,
      location: {
        id: dest.id,
        name: getDestinationName(dest),
        latitude: dest.latitude || 0,
        longitude: dest.longitude || 0
      }
    }))
    
    const clusterRoute = optimizeClusterInternally(
      clusterDestinations,
      currentLocation,
      cluster.averageStayTime
    )
    
    // Process each destination in the cluster
    for (let destIndex = 0; destIndex < clusterRoute.orderedDestinations.length; destIndex++) {
      const destination = clusterRoute.orderedDestinations[destIndex]
      
      // Generate intra-cluster transport if not first destination
      if (destIndex > 0) {
        const prevDest = clusterRoute.orderedDestinations[destIndex - 1]
        const intraTransport = generateTransportSegment(
          prevDest.location,
          destination.location,
          currentTime,
          prevDest.location.name,
          destination.location.name,
          finalConfig
        )
        
        transportSegments.push(intraTransport)
        currentTime = new Date(intraTransport.arrivalTime)
      }
      
      // Allocate time for destination
      const timeAllocation = allocateDestinationTime(
        destination.id,
        preferences,
        finalConfig
      )
      
      // Find wishful users for this destination
      const wishfulUsers = findWishfulUsers(
        destination.id,
        preferences,
        Array.from(preprocessedData.groupMembers.values())
      )
      
      // Create destination visit
      const arrivalTime = new Date(currentTime)
      const departureTime = new Date(
        arrivalTime.getTime() + timeAllocation.allocatedHours * 60 * 60 * 1000
      )
      
      const visit: DestinationVisit = {
        destinationId: destination.id,
        destinationName: destination.location.name,
        location: destination.location,
        arrivalTime,
        departureTime,
        allocatedHours: timeAllocation.allocatedHours,
        wishfulUsers,
        isClusterEntry: destIndex === 0,
        clusterId: cluster.id,
        clusterName: `Cluster ${clusterIndex + 1}`,
        visitOrder: globalVisitOrder++
      }
      
      destinationVisits.push(visit)
      currentTime = departureTime
      currentLocation = destination.location
    }
  }
  
  // Generate return transport segment
  const returnLocation = preprocessedData.returnLocation || preprocessedData.departureLocation
  if (currentLocation.id !== returnLocation.id) {
    const returnSegment = generateTransportSegment(
      currentLocation,
      returnLocation,
      currentTime,
      destinationVisits[destinationVisits.length - 1]?.destinationName || 'Last destination',
      'Return',
      finalConfig
    )
    
    transportSegments.push(returnSegment)
    currentTime = new Date(returnSegment.arrivalTime)
  }
  
  // Calculate end date
  const endDate = new Date(currentTime)
  
  // Generate summary
  const summary = generateItinerarySummary(
    destinationVisits,
    transportSegments,
    preferences,
    Array.from(preprocessedData.groupMembers.values())
  )
  
  // Perform comprehensive validation
  const validation = validateItinerary(
    destinationVisits,
    transportSegments,
    startDate,
    endDate,
    preprocessedData.tripDuration
  )
  
  return {
    tripId: preprocessedData.groupId,
    startDate,
    endDate,
    departureLocation: preprocessedData.departureLocation,
    returnLocation: preprocessedData.returnLocation,
    destinationVisits,
    transportSegments,
    summary,
    validation
  }
}

/**
 * Generate transport segment between locations
 */
function generateTransportSegment(
  fromLocation: Location,
  toLocation: Location,
  departureTime: Date,
  fromName: string,
  toName: string,
  config: RouteGenerationConfig
): DetailedTransportSegment {
  const transport = determineTransportMode(fromLocation, toLocation, config)
  
  const arrivalTime = new Date(
    departureTime.getTime() + transport.estimatedTimeHours * 60 * 60 * 1000
  )
  
  const warnings: string[] = []
  
  // Add warnings for edge cases
  if (transport.mode === 'flying' && transport.distanceKm < 100) {
    warnings.push(`Short flight of ${transport.distanceKm.toFixed(0)}km may be inefficient`)
  }
  
  if (transport.mode === 'walking' && transport.distanceKm > 5) {
    warnings.push(`Long walk of ${transport.distanceKm.toFixed(1)}km may be tiring`)
  }
  
  return {
    segmentId: uuidv4(),
    fromLocation,
    fromName,
    toLocation,
    toName,
    transportMode: transport.mode,
    transportIcon: transport.icon,
    distanceKm: transport.distanceKm,
    estimatedTimeHours: transport.estimatedTimeHours,
    departureTime,
    arrivalTime,
    routePath: [fromLocation, toLocation], // Straight line for MVP
    warnings
  }
}

/**
 * Generate itinerary summary
 */
function generateItinerarySummary(
  visits: DestinationVisit[],
  segments: DetailedTransportSegment[],
  preferences: StandardizedPreference[],
  groupMembers: GroupMembers[]
): ItinerarySummary {
  // Calculate totals
  const totalDestinations = visits.length
  const totalClusters = new Set(visits.map(v => v.clusterId)).size
  const totalVisitTimeHours = visits.reduce((sum, v) => sum + v.allocatedHours, 0)
  const totalTravelTimeHours = segments.reduce((sum, s) => sum + s.estimatedTimeHours, 0)
  const totalDistanceKm = segments.reduce((sum, s) => sum + s.distanceKm, 0)
  
  // Calculate duration in days
  const firstVisit = visits[0]
  const lastVisit = visits[visits.length - 1]
  const lastSegment = segments[segments.length - 1]
  
  const tripStartTime = firstVisit?.arrivalTime || new Date()
  const tripEndTime = lastSegment?.arrivalTime || lastVisit?.departureTime || new Date()
  const totalDays = Math.ceil(
    (tripEndTime.getTime() - tripStartTime.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  // Calculate transport mode breakdown
  const transportModes: TransportModeSummary = {
    walkingSegments: 0,
    walkingDistanceKm: 0,
    drivingSegments: 0,
    drivingDistanceKm: 0,
    flyingSegments: 0,
    flyingDistanceKm: 0
  }
  
  for (const segment of segments) {
    switch (segment.transportMode) {
      case 'walking':
        transportModes.walkingSegments++
        transportModes.walkingDistanceKm += segment.distanceKm
        break
      case 'driving':
        transportModes.drivingSegments++
        transportModes.drivingDistanceKm += segment.distanceKm
        break
      case 'flying':
        transportModes.flyingSegments++
        transportModes.flyingDistanceKm += segment.distanceKm
        break
    }
  }
  
  // Calculate user satisfaction
  const visitedDestinationIds = visits.map(v => v.destinationId)
  const userSatisfactionSummary = calculateUserSatisfactionStats(
    visitedDestinationIds,
    preferences,
    groupMembers
  ).map(stats => ({
    member: stats.member,
    visitedWishlistCount: stats.visitedWishlistCount,
    totalWishlistCount: stats.totalWishlistCount,
    satisfactionPercentage: stats.satisfactionPercentage
  }))
  
  return {
    totalDestinations,
    totalClusters,
    totalDays,
    totalDistanceKm,
    totalTravelTimeHours,
    totalVisitTimeHours,
    transportModes,
    userSatisfactionSummary
  }
}

/**
 * Validate transport segment
 */
function validateTransportSegment(
  segment: DetailedTransportSegment
): {
  warnings: ValidationWarning[]
} {
  const warnings: ValidationWarning[] = []
  
  // Check for very short flights
  if (segment.transportMode === 'flying' && segment.distanceKm < 100) {
    warnings.push({
      code: 'SHORT_FLIGHT',
      message: `Flight of ${segment.distanceKm.toFixed(0)}km is unusually short`
    })
  }
  
  // Check for very long walks
  if (segment.transportMode === 'walking' && segment.distanceKm > 5) {
    warnings.push({
      code: 'LONG_WALK',
      message: `Walking ${segment.distanceKm.toFixed(1)}km may be impractical`
    })
  }
  
  // Check for negative travel time
  if (segment.estimatedTimeHours < 0) {
    warnings.push({
      code: 'NEGATIVE_TIME',
      message: 'Transport segment has negative travel time'
    })
  }
  
  return { warnings }
}

/**
 * Comprehensive itinerary validation
 */
function validateItinerary(
  visits: DestinationVisit[],
  segments: DetailedTransportSegment[],
  startDate: Date,
  endDate: Date,
  tripDuration: { startDate: Date | null; endDate: Date | null; autoCalculate: boolean }
): ItineraryValidation {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  
  // Check time progression
  let previousTime = startDate
  
  for (const visit of visits) {
    if (visit.arrivalTime < previousTime) {
      errors.push({
        code: 'TIME_REVERSAL',
        message: `Destination ${visit.destinationName} arrives before previous departure`,
        affectedDestination: visit.destinationId
      })
    }
    
    if (visit.departureTime < visit.arrivalTime) {
      errors.push({
        code: 'NEGATIVE_VISIT_TIME',
        message: `Destination ${visit.destinationName} has departure before arrival`,
        affectedDestination: visit.destinationId
      })
    }
    
    previousTime = visit.departureTime
  }
  
  // Check time window constraints
  if (!tripDuration.autoCalculate && tripDuration.endDate) {
    if (endDate > tripDuration.endDate) {
      errors.push({
        code: 'EXCEEDS_TIME_WINDOW',
        message: `Itinerary ends after fixed end date`
      })
    }
  }
  
  // Check for duplicate destinations
  const destinationIds = new Set<string>()
  for (const visit of visits) {
    if (destinationIds.has(visit.destinationId)) {
      warnings.push({
        code: 'DUPLICATE_DESTINATION',
        message: `Destination ${visit.destinationName} appears multiple times`,
        affectedDestination: visit.destinationId
      })
    }
    destinationIds.add(visit.destinationId)
  }
  
  // Check for very long days
  const visitsByDay = new Map<string, DestinationVisit[]>()
  for (const visit of visits) {
    const dayKey = visit.arrivalTime.toDateString()
    const dayVisits = visitsByDay.get(dayKey) || []
    dayVisits.push(visit)
    visitsByDay.set(dayKey, dayVisits)
  }
  
  for (const [day, dayVisits] of Array.from(visitsByDay.entries())) {
    const dayStart = Math.min(...dayVisits.map(v => v.arrivalTime.getTime()))
    const dayEnd = Math.max(...dayVisits.map(v => v.departureTime.getTime()))
    const dayHours = (dayEnd - dayStart) / (1000 * 60 * 60)
    
    if (dayHours > 12) {
      warnings.push({
        code: 'LONG_DAY',
        message: `Day ${day} has ${dayHours.toFixed(1)} hours of activities`
      })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Helper function to safely get destination name from either destinations or places table
 */
function getDestinationName(destination: any): string {
  // Handle both destinations table (has 'name') and places table (has 'place_name')
  return destination.name || destination.place_name || 'Unknown Location'
}