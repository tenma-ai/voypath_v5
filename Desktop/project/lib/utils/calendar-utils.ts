// Calendar utility functions for time calculations and timeline positioning

import type { 
  TimePosition, 
  DayTimeline, 
  TimelineBlock, 
  DayStatistics,
  TripBalance,
  TripPatterns,
  ActivityTypePattern 
} from '@/lib/types/calendar-visualization'
import type { DestinationVisit, DetailedTransportSegment } from '@/lib/optimization/detailed-route-types'

/**
 * Convert time string to TimePosition object
 */
export function parseTimeString(timeStr: string): TimePosition {
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = parseInt(minuteStr, 10)
  const totalMinutes = hour * 60 + minute
  
  // Calculate percentage of day (0-100%)
  const percentage = (totalMinutes / (24 * 60)) * 100
  
  return {
    hour,
    minute,
    totalMinutes,
    percentage
  }
}

/**
 * Convert minutes to time string (HH:MM)
 */
export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Calculate position and width percentages for timeline blocks
 */
export function calculateTimelinePosition(
  startTime: string,
  endTime: string,
  timelineStart: number = 9, // 9 AM
  timelineEnd: number = 21   // 9 PM
): { startPercent: number; widthPercent: number } {
  const start = parseTimeString(startTime)
  const end = parseTimeString(endTime)
  
  // Timeline bounds in minutes
  const timelineStartMinutes = timelineStart * 60
  const timelineEndMinutes = timelineEnd * 60
  const timelineDurationMinutes = timelineEndMinutes - timelineStartMinutes
  
  // Clamp times to timeline bounds
  const clampedStart = Math.max(start.totalMinutes, timelineStartMinutes)
  const clampedEnd = Math.min(end.totalMinutes, timelineEndMinutes)
  
  // Calculate positions relative to timeline
  const startOffset = clampedStart - timelineStartMinutes
  const duration = clampedEnd - clampedStart
  
  const startPercent = (startOffset / timelineDurationMinutes) * 100
  const widthPercent = (duration / timelineDurationMinutes) * 100
  
  return {
    startPercent: Math.max(0, Math.min(100, startPercent)),
    widthPercent: Math.max(0, Math.min(100 - startPercent, widthPercent))
  }
}

/**
 * Create timeline blocks from destination visits
 */
export function createTimelineBlocks(
  visits: DestinationVisit[],
  transports: DetailedTransportSegment[],
  date: Date,
  config: {
    timelineStart?: number
    timelineEnd?: number
    userColors?: Record<string, string>
  } = {}
): TimelineBlock[] {
  const blocks: TimelineBlock[] = []
  
  visits.forEach((visit, index) => {
    // Format times (assuming visit has start/end times)
    const startTime = visit.arrivalTime ? visit.arrivalTime.toTimeString().slice(0, 5) : '09:00'
    const endTime = visit.departureTime ? visit.departureTime.toTimeString().slice(0, 5) : '10:00'
    
    // Calculate timeline position
    const position = calculateTimelinePosition(
      startTime,
      endTime,
      config.timelineStart,
      config.timelineEnd
    )
    
    // Determine user count and color
    const userCount = visit.wishfulUsers?.length || 1
    const color = getUserPreferenceColor(visit.wishfulUsers || [], config.userColors)
    
    // Get transport to next destination
    const transportNext = transports[index] ? createTransportIndicator(transports[index]) : undefined
    
    // Determine block height based on duration and importance
    const duration = parseTimeString(endTime).totalMinutes - parseTimeString(startTime).totalMinutes
    const height = duration > 180 ? 'large' : duration > 90 ? 'medium' : 'small'
    
    blocks.push({
      id: `block-${visit.destinationId}-${date.toISOString().split('T')[0]}`,
      startPercent: position.startPercent,
      widthPercent: position.widthPercent,
      startTime,
      endTime,
      destination: visit,
      color,
      borderStyle: userCount > 1 ? 'solid' : 'dashed',
      height,
      transportNext,
      userCount,
      isInteractive: true
    })
  })
  
  return blocks.sort((a, b) => a.startPercent - b.startPercent)
}

/**
 * Create transport indicator for timeline
 */
function createTransportIndicator(transport: DetailedTransportSegment) {
  const modeIcons = {
    walking: '🚶',
    driving: '🚗',
    flying: '✈️'
  }
  
  const modeColors = {
    walking: '#059669',
    driving: '#92400E', 
    flying: '#1E3A8A'
  }
  
  const mode = transport.transportMode as keyof typeof modeIcons
  
  return {
    mode,
    duration: `${Math.round(transport.estimatedTimeHours * 60)}min`,
    icon: modeIcons[mode] || '🚶',
    color: modeColors[mode] || '#6B7280',
    distance: `${transport.distanceKm.toFixed(1)}km`
  }
}

/**
 * Get color for user preferences
 */
function getUserPreferenceColor(
  userPreferences: any[], 
  userColors: Record<string, string> = {}
): string {
  const userCount = userPreferences.length
  
  // Multi-user color strategy
  if (userCount >= 5) {
    return '#F59E0B' // Amber for popular destinations
  } else if (userCount >= 2) {
    return '#0EA5E9' // Sky blue for group destinations
  } else if (userCount === 1) {
    const userId = userPreferences[0]?.userId
    return userColors[userId] || '#8B5CF6' // Individual color
  }
  
  return '#6B7280' // Default gray
}

/**
 * Calculate daily statistics
 */
export function calculateDayStatistics(
  visits: DestinationVisit[],
  transports: DetailedTransportSegment[]
): DayStatistics {
  const totalDestinations = visits.length
  
  // Calculate transport times by mode
  let totalWalkingTime = 0
  let totalDrivingTime = 0
  
  transports.forEach(transport => {
    const timeInMinutes = transport.estimatedTimeHours * 60
    if (transport.transportMode === 'walking') {
      totalWalkingTime += timeInMinutes
    } else {
      totalDrivingTime += timeInMinutes
    }
  })
  
  // Calculate activity time
  let totalActivityTime = 0
  let earliestStart = '23:59'
  let latestEnd = '00:00'
  
  visits.forEach(visit => {
    const startTime = visit.arrivalTime ? visit.arrivalTime.toTimeString().slice(0, 5) : '09:00'
    const endTime = visit.departureTime ? visit.departureTime.toTimeString().slice(0, 5) : '10:00'
    
    const start = parseTimeString(startTime)
    const end = parseTimeString(endTime)
    
    totalActivityTime += end.totalMinutes - start.totalMinutes
    
    if (startTime < earliestStart) earliestStart = startTime
    if (endTime > latestEnd) latestEnd = endTime
  })
  
  // Calculate free time (assumes 12-hour active day)
  const activeDay = 12 * 60 // 12 hours in minutes
  const totalFreeTime = activeDay - totalActivityTime - totalWalkingTime - totalDrivingTime
  
  // Determine day compactness
  const totalActiveTime = totalActivityTime + totalWalkingTime + totalDrivingTime
  let dayCompactness: 'light' | 'moderate' | 'packed'
  
  if (totalActiveTime < 5 * 60) {
    dayCompactness = 'light'
  } else if (totalActiveTime < 7 * 60) {
    dayCompactness = 'moderate'
  } else {
    dayCompactness = 'packed'
  }
  
  // Recommend breaks for packed days
  const recommendedBreaks = dayCompactness === 'packed' ? Math.ceil(totalDestinations / 3) : 0
  
  return {
    totalDestinations,
    totalWalkingTime: Math.round(totalWalkingTime),
    totalDrivingTime: Math.round(totalDrivingTime),
    totalActivityTime: Math.round(totalActivityTime),
    totalFreeTime: Math.max(0, Math.round(totalFreeTime)),
    dayCompactness,
    earliestStart,
    latestEnd,
    recommendedBreaks
  }
}

/**
 * Create daily timeline from itinerary data
 */
export function createDayTimeline(
  date: Date,
  visits: DestinationVisit[],
  transports: DetailedTransportSegment[],
  config: {
    timelineStart?: number
    timelineEnd?: number
    userColors?: Record<string, string>
    accommodationSuggestion?: any
  } = {}
): DayTimeline {
  const dateString = date.toISOString().split('T')[0]
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
  
  const timelineBlocks = createTimelineBlocks(visits, transports, date, config)
  const dailyStats = calculateDayStatistics(visits, transports)
  
  // Check if it's a packed day
  const isPackedDay = dailyStats.dayCompactness === 'packed'
  
  // Check if it's current day (within 24 hours)
  const now = new Date()
  const isCurrentDay = Math.abs(now.getTime() - date.getTime()) < 24 * 60 * 60 * 1000
  
  return {
    date,
    dateString,
    dayOfWeek,
    timelineBlocks,
    dailyStats,
    accommodationInfo: config.accommodationSuggestion,
    isCurrentDay,
    isPackedDay
  }
}

/**
 * Analyze trip balance across multiple days
 */
export function analyzeTripBalance(dayTimelines: DayTimeline[]): TripBalance {
  const packedDays = dayTimelines.filter(day => day.isPackedDay).length
  const lightDays = dayTimelines.filter(day => day.dailyStats.dayCompactness === 'light').length
  const travelDays = dayTimelines.filter(day => 
    day.dailyStats.totalDrivingTime + day.dailyStats.totalWalkingTime > 3 * 60 // 3+ hours transport
  ).length
  
  const totalActivities = dayTimelines.reduce((sum, day) => sum + day.dailyStats.totalDestinations, 0)
  const averageActivitiesPerDay = totalActivities / dayTimelines.length
  
  // Recommend rest if more than 40% of days are packed
  const restRecommendation = (packedDays / dayTimelines.length) > 0.4
  
  return {
    packedDays,
    lightDays,
    travelDays,
    restRecommendation,
    averageActivitiesPerDay: Math.round(averageActivitiesPerDay * 10) / 10,
    totalTripDays: dayTimelines.length
  }
}

/**
 * Analyze trip patterns for recommendations
 */
export function analyzeTripPatterns(dayTimelines: DayTimeline[]): TripPatterns {
  const activityIntensity = dayTimelines.map(day => {
    const maxActivity = 10 * 60 // 10 hours as max
    const totalActivity = day.dailyStats.totalActivityTime + day.dailyStats.totalWalkingTime
    return Math.min(totalActivity / maxActivity, 1)
  })
  
  // Simple geographic clustering (would need actual geo data)
  const geographicClusters = dayTimelines.map((_, index) => `cluster-${Math.floor(index / 2)}`)
  
  // Activity type analysis (simplified)
  const activityTypes: ActivityTypePattern[] = dayTimelines.map((day, index) => ({
    day: day.dateString,
    primaryType: day.dailyStats.totalDestinations > 5 ? 'urban' : 
                 day.dailyStats.totalWalkingTime > 2 * 60 ? 'nature' : 'cultural',
    secondaryTypes: ['entertainment'],
    intensity: activityIntensity[index]
  }))
  
  // Recommend rest days between high-intensity days
  const restDayRecommendations: string[] = []
  for (let i = 0; i < activityIntensity.length - 1; i++) {
    if (activityIntensity[i] > 0.8 && activityIntensity[i + 1] > 0.8) {
      const restDate = new Date(dayTimelines[i + 1].date)
      restDate.setDate(restDate.getDate() - 0.5)
      restDayRecommendations.push(restDate.toISOString().split('T')[0])
    }
  }
  
  return {
    activityIntensity,
    geographicClusters,
    activityTypes,
    restDayRecommendations
  }
}

/**
 * Format time duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (remainingMinutes === 0) {
    return `${hours}h`
  }
  
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Check if time overlaps between blocks
 */
export function hasTimeOverlap(block1: TimelineBlock, block2: TimelineBlock): boolean {
  const start1 = parseTimeString(block1.startTime).totalMinutes
  const end1 = parseTimeString(block1.endTime).totalMinutes
  const start2 = parseTimeString(block2.startTime).totalMinutes
  const end2 = parseTimeString(block2.endTime).totalMinutes
  
  return start1 < end2 && start2 < end1
}

/**
 * Resolve timeline conflicts by adjusting positions
 */
export function resolveTimelineConflicts(blocks: TimelineBlock[]): TimelineBlock[] {
  const resolved = [...blocks].sort((a, b) => a.startPercent - b.startPercent)
  
  for (let i = 0; i < resolved.length - 1; i++) {
    const current = resolved[i]
    const next = resolved[i + 1]
    
    if (hasTimeOverlap(current, next)) {
      // Adjust next block to start after current block ends
      const currentEnd = parseTimeString(current.endTime).totalMinutes
      const adjustedStart = minutesToTimeString(currentEnd + 15) // 15 min buffer
      
      const newPosition = calculateTimelinePosition(
        adjustedStart,
        next.endTime
      )
      
      resolved[i + 1] = {
        ...next,
        startTime: adjustedStart,
        startPercent: newPosition.startPercent,
        widthPercent: newPosition.widthPercent
      }
    }
  }
  
  return resolved
}

/**
 * Determine zoom level based on timeline density
 */
export function determineZoomLevel(
  timelineBlocks: TimelineBlock[],
  availableWidth: number
): 'hour' | 'halfHour' | 'quarter' {
  const density = timelineBlocks.length / (availableWidth / 100)
  
  if (density > 0.8) {
    return 'hour'
  } else if (density > 0.4) {
    return 'halfHour'
  } else {
    return 'quarter'
  }
}

/**
 * Group timeline segments by day
 */
export function groupSegmentsByDay(
  timelineBlocks: TimelineBlock[]
): Record<string, TimelineBlock[]> {
  const grouped: Record<string, TimelineBlock[]> = {}
  
  timelineBlocks.forEach(block => {
    // Extract day from block ID (assumes format: block-destinationId-YYYY-MM-DD)
    const dayMatch = block.id.match(/(\d{4}-\d{2}-\d{2})/)
    const day = dayMatch ? dayMatch[1] : 'unknown'
    
    if (!grouped[day]) {
      grouped[day] = []
    }
    grouped[day].push(block)
  })
  
  return grouped
}

/**
 * Get time markers for timeline display
 */
export function getTimeMarkers(
  startHour: number = 9,
  endHour: number = 21,
  interval: number = 1
): Array<{ time: string; position: number }> {
  const markers = []
  const totalHours = endHour - startHour
  
  for (let hour = startHour; hour <= endHour; hour += interval) {
    const position = ((hour - startHour) / totalHours) * 100
    const timeString = `${hour.toString().padStart(2, '0')}:00`
    
    markers.push({
      time: timeString,
      position: Math.min(100, Math.max(0, position))
    })
  }
  
  return markers
}