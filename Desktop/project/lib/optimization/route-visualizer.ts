// Route visualization and formatting helpers

import type { 
  DetailedItinerary,
  DestinationVisit,
  DetailedTransportSegment
} from './detailed-route-types'
import type { Location as OptimizationLocation } from './types'

// Alias for browser Location to avoid conflicts
type BrowserLocation = any

/**
 * Format detailed itinerary as human-readable text
 */
export function formatItineraryAsText(itinerary: DetailedItinerary): string {
  let output = '## 🗺️ Detailed Trip Itinerary\n\n'
  
  // Trip overview
  output += '### 📊 Trip Overview\n'
  output += `- **Duration**: ${itinerary.summary.totalDays} days\n`
  output += `- **Start**: ${formatDate(itinerary.startDate)}\n`
  output += `- **End**: ${formatDate(itinerary.endDate)}\n`
  output += `- **Destinations**: ${itinerary.summary.totalDestinations} locations across ${itinerary.summary.totalClusters} regions\n`
  output += `- **Total Distance**: ${itinerary.summary.totalDistanceKm.toFixed(0)} km\n`
  output += `- **Travel Time**: ${itinerary.summary.totalTravelTimeHours.toFixed(1)} hours\n`
  output += `- **Visit Time**: ${itinerary.summary.totalVisitTimeHours.toFixed(1)} hours\n\n`
  
  // Transport summary
  output += '### 🚀 Transportation\n'
  const modes = itinerary.summary.transportModes
  if (modes.walkingSegments > 0) {
    output += `- 🚶 Walking: ${modes.walkingSegments} segments (${modes.walkingDistanceKm.toFixed(1)} km)\n`
  }
  if (modes.drivingSegments > 0) {
    output += `- 🚗 Driving: ${modes.drivingSegments} segments (${modes.drivingDistanceKm.toFixed(0)} km)\n`
  }
  if (modes.flyingSegments > 0) {
    output += `- ✈️ Flying: ${modes.flyingSegments} segments (${modes.flyingDistanceKm.toFixed(0)} km)\n`
  }
  output += '\n'
  
  // User satisfaction
  output += '### 👥 Group Satisfaction\n'
  for (const userStat of itinerary.summary.userSatisfactionSummary) {
    const emoji = userStat.satisfactionPercentage >= 70 ? '😊' : 
                  userStat.satisfactionPercentage >= 40 ? '😐' : '😕'
    output += `- ${emoji} **${userStat.member.display_name}**: ${userStat.visitedWishlistCount}/${userStat.totalWishlistCount} wishes (${userStat.satisfactionPercentage.toFixed(0)}%)\n`
  }
  output += '\n'
  
  // Daily breakdown
  output += '### 📅 Day-by-Day Itinerary\n\n'
  output += formatDailyItinerary(itinerary.destinationVisits, itinerary.transportSegments)
  
  // Warnings
  if (itinerary.validation.warnings.length > 0) {
    output += '\n### ⚠️ Notes and Warnings\n'
    for (const warning of itinerary.validation.warnings) {
      output += `- ${warning.message}\n`
    }
  }
  
  return output
}

/**
 * Format daily itinerary breakdown
 */
function formatDailyItinerary(
  visits: DestinationVisit[],
  segments: DetailedTransportSegment[]
): string {
  let output = ''
  let currentDay = 1
  let currentDate: string | null = null
  
  // Create segment lookup map
  const segmentsByArrival = new Map<string, DetailedTransportSegment>()
  for (const segment of segments) {
    const key = `${segment.toLocation.latitude},${segment.toLocation.longitude}`
    segmentsByArrival.set(key, segment)
  }
  
  for (const visit of visits) {
    const visitDate = visit.arrivalTime.toDateString()
    
    // Start new day section if needed
    if (visitDate !== currentDate) {
      currentDate = visitDate
      output += `#### Day ${currentDay} - ${formatDate(visit.arrivalTime)}\n\n`
      currentDay++
    }
    
    // Find transport to this destination
    const arrivalKey = `${visit.location.latitude},${visit.location.longitude}`
    const transportSegment = segmentsByArrival.get(arrivalKey)
    
    // Transport info
    if (transportSegment) {
      output += `${transportSegment.transportIcon} **${formatTime(transportSegment.departureTime)}** - Depart from ${transportSegment.fromName}\n`
      output += `   → ${transportSegment.distanceKm.toFixed(0)}km ${transportSegment.transportMode} (${formatDuration(transportSegment.estimatedTimeHours)})\n\n`
    }
    
    // Destination info
    output += `📍 **${formatTime(visit.arrivalTime)} - ${formatTime(visit.departureTime)}** ${visit.destinationName}\n`
    output += `   ⏱️ ${formatDuration(visit.allocatedHours)} visit\n`
    
    // Show who wanted this destination
    if (visit.wishfulUsers.length > 0) {
      const users = visit.wishfulUsers.map(wu => 
        `${wu.member.display_name} (${wu.originalRating}⭐)`
      ).join(', ')
      output += `   👥 Wished by: ${users}\n`
    }
    
    output += '\n'
  }
  
  // Add final return segment
  const lastSegment = segments[segments.length - 1]
  if (lastSegment && lastSegment.toName === 'Return') {
    output += `${lastSegment.transportIcon} **${formatTime(lastSegment.departureTime)}** - Return journey\n`
    output += `   → ${lastSegment.distanceKm.toFixed(0)}km ${lastSegment.transportMode} (${formatDuration(lastSegment.estimatedTimeHours)})\n`
    output += `   Arrive at ${formatTime(lastSegment.arrivalTime)}\n`
  }
  
  return output
}

/**
 * Format itinerary for calendar view
 */
export function formatItineraryForCalendar(itinerary: DetailedItinerary): {
  events: CalendarEvent[]
  dateRange: { start: Date; end: Date }
} {
  const events: CalendarEvent[] = []
  
  // Add destination visits as events
  for (const visit of itinerary.destinationVisits) {
    events.push({
      id: `visit-${visit.destinationId}`,
      title: visit.destinationName,
      start: visit.arrivalTime,
      end: visit.departureTime,
      type: 'visit',
      location: visit.location,
      description: `Stay for ${formatDuration(visit.allocatedHours)}`,
      color: visit.wishfulUsers[0]?.assignedColor || '#6B7280',
      users: visit.wishfulUsers.map(wu => wu.member.display_name)
    })
  }
  
  // Add transport segments as events
  for (const segment of itinerary.transportSegments) {
    events.push({
      id: `transport-${segment.segmentId}`,
      title: `${segment.transportIcon} ${segment.fromName} → ${segment.toName}`,
      start: segment.departureTime,
      end: segment.arrivalTime,
      type: 'transport',
      location: null,
      description: `${segment.distanceKm.toFixed(0)}km by ${segment.transportMode}`,
      color: '#9CA3AF',
      users: []
    })
  }
  
  return {
    events,
    dateRange: {
      start: itinerary.startDate,
      end: itinerary.endDate
    }
  }
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: 'visit' | 'transport'
  location: OptimizationLocation | null
  description: string
  color: string
  users: string[]
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }
  return date.toLocaleDateString('en-US', options)
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format duration in hours
 */
function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`
  } else if (hours === 1) {
    return '1 hour'
  } else if (Math.floor(hours) === hours) {
    return `${hours} hours`
  } else {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }
}

/**
 * Generate map data for visualization
 */
export function generateMapData(itinerary: DetailedItinerary): {
  destinations: MapDestination[]
  routes: MapRoute[]
  bounds: GeographicBounds
} {
  const destinations: MapDestination[] = []
  const routes: MapRoute[] = []
  
  // Add all destination visits
  for (const visit of itinerary.destinationVisits) {
    destinations.push({
      id: visit.destinationId,
      name: visit.destinationName,
      location: visit.location,
      arrivalTime: visit.arrivalTime,
      departureTime: visit.departureTime,
      duration: visit.allocatedHours,
      userColors: visit.wishfulUsers.map(wu => wu.assignedColor),
      isClusterEntry: visit.isClusterEntry,
      visitOrder: visit.visitOrder
    })
  }
  
  // Add all transport routes
  for (const segment of itinerary.transportSegments) {
    routes.push({
      id: segment.segmentId,
      from: segment.fromLocation,
      to: segment.toLocation,
      mode: segment.transportMode,
      icon: segment.transportIcon,
      distance: segment.distanceKm,
      duration: segment.estimatedTimeHours
    })
  }
  
  // Calculate bounds
  const allLocations = [
    ...destinations.map(d => d.location),
    itinerary.departureLocation,
    itinerary.returnLocation || itinerary.departureLocation
  ]
  
  const bounds = calculateGeographicBounds(allLocations)
  
  return { destinations, routes, bounds }
}

interface MapDestination {
  id: string
  name: string
  location: OptimizationLocation
  arrivalTime: Date
  departureTime: Date
  duration: number
  userColors: string[]
  isClusterEntry: boolean
  visitOrder: number
}

interface MapRoute {
  id: string
  from: OptimizationLocation
  to: OptimizationLocation
  mode: string
  icon: string
  distance: number
  duration: number
}

interface GeographicBounds {
  north: number
  south: number
  east: number
  west: number
  center: { latitude: number; longitude: number }
}

function calculateGeographicBounds(locations: OptimizationLocation[]): GeographicBounds {
  if (locations.length === 0) {
    return {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
      center: { latitude: 0, longitude: 0 }
    }
  }
  
  let north = -90
  let south = 90
  let east = -180
  let west = 180
  
  for (const loc of locations) {
    north = Math.max(north, loc.latitude)
    south = Math.min(south, loc.latitude)
    east = Math.max(east, loc.longitude)
    west = Math.min(west, loc.longitude)
  }
  
  return {
    north,
    south,
    east,
    west,
    center: {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2
    }
  }
}