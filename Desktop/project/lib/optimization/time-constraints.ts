// Time constraint processing for trip optimization

import type { TimeConstraints, DestinationCluster } from './normalization-types'
import type { TripGroups } from '@/lib/database.types'

// Default daily available hours for sightseeing
const DEFAULT_DAILY_HOURS = 9

/**
 * Process time constraints from trip group data
 */
export function processTimeConstraints(tripGroup: TripGroups): TimeConstraints {
  const startDate = tripGroup.start_date ? new Date(tripGroup.start_date) : null
  const endDate = tripGroup.end_date ? new Date(tripGroup.end_date) : null
  
  // If no start date is provided, use a default "auto" mode without strict time constraints
  if (!startDate) {
    console.warn('No start date provided, using flexible time constraint mode')
    return {
      mode: 'auto',
      startDate: new Date(), // Use current date as default
      endDate: endDate || undefined,
      dailyHours: DEFAULT_DAILY_HOURS,
      totalAvailableHours: undefined
    }
  }
  
  // Determine constraint mode
  const mode = tripGroup.auto_calculate_end_date || !endDate ? 'auto' : 'fixed'
  
  // Calculate total available hours for fixed mode
  let totalAvailableHours: number | undefined
  
  if (mode === 'fixed' && endDate) {
    const days = calculateDaysBetween(startDate, endDate)
    totalAvailableHours = days * DEFAULT_DAILY_HOURS
  }
  
  return {
    mode,
    startDate,
    endDate: endDate || undefined,
    dailyHours: DEFAULT_DAILY_HOURS,
    totalAvailableHours
  }
}

/**
 * Calculate number of days between two dates (inclusive)
 */
function calculateDaysBetween(start: Date, end: Date): number {
  const startTime = start.getTime()
  const endTime = end.getTime()
  const diffTime = Math.abs(endTime - startTime)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // +1 to make it inclusive
}

/**
 * Check if clusters fit within time constraints
 */
export function validateTimeConstraints(
  clusters: DestinationCluster[],
  constraints: TimeConstraints
): {
  isValid: boolean
  totalRequiredHours: number
  totalAvailableHours: number | null
  requiredDays: number
  issues: string[]
} {
  // Calculate total required time
  const totalRequiredHours = clusters.reduce(
    (sum, cluster) => sum + cluster.averageStayTime,
    0
  )
  
  // Add travel time between clusters (rough estimate: 2 hours between clusters)
  const travelTime = Math.max(0, (clusters.length - 1) * 2)
  const totalWithTravel = totalRequiredHours + travelTime
  
  // Calculate required days
  const requiredDays = Math.ceil(totalWithTravel / constraints.dailyHours)
  
  const issues: string[] = []
  let isValid = true
  
  if (constraints.mode === 'fixed' && constraints.totalAvailableHours) {
    if (totalWithTravel > constraints.totalAvailableHours) {
      isValid = false
      issues.push(
        `Trip requires ${totalWithTravel} hours but only ${constraints.totalAvailableHours} hours are available`
      )
      issues.push(
        `Consider removing ${Math.ceil((totalWithTravel - constraints.totalAvailableHours) / clusters[0].averageStayTime)} destinations`
      )
    }
  }
  
  return {
    isValid,
    totalRequiredHours: totalWithTravel,
    totalAvailableHours: constraints.totalAvailableHours || null,
    requiredDays,
    issues
  }
}

/**
 * Suggest end date for auto-calculate mode
 */
export function suggestEndDate(
  startDate: Date,
  clusters: DestinationCluster[]
): {
  suggestedEndDate: Date
  totalDays: number
  dailySchedule: DailySchedule[]
} {
  // Calculate total required hours including travel
  const totalRequiredHours = clusters.reduce(
    (sum, cluster) => sum + cluster.averageStayTime,
    0
  )
  const travelTime = Math.max(0, (clusters.length - 1) * 2)
  const totalWithTravel = totalRequiredHours + travelTime
  
  // Calculate required days
  const requiredDays = Math.ceil(totalWithTravel / DEFAULT_DAILY_HOURS)
  
  // Calculate suggested end date
  const suggestedEndDate = new Date(startDate)
  suggestedEndDate.setDate(suggestedEndDate.getDate() + requiredDays - 1)
  
  // Create daily schedule
  const dailySchedule = createDailySchedule(clusters, requiredDays)
  
  return {
    suggestedEndDate,
    totalDays: requiredDays,
    dailySchedule
  }
}

// Daily schedule structure
interface DailySchedule {
  day: number
  date: Date
  clusters: DestinationCluster[]
  totalHours: number
}

/**
 * Create a daily schedule distributing clusters across days
 */
function createDailySchedule(
  clusters: DestinationCluster[],
  totalDays: number
): DailySchedule[] {
  const schedule: DailySchedule[] = []
  const hoursPerDay = DEFAULT_DAILY_HOURS
  
  let currentDay = 1
  let currentDayHours = 0
  let currentDayClusters: DestinationCluster[] = []
  
  for (const cluster of clusters) {
    // Check if adding this cluster exceeds daily limit
    if (currentDayHours + cluster.averageStayTime > hoursPerDay && currentDayClusters.length > 0) {
      // Move to next day
      currentDay++
      currentDayHours = 0
      currentDayClusters = []
    }
    
    // Add cluster to current day
    currentDayClusters.push(cluster)
    currentDayHours += cluster.averageStayTime
    
    // If this is the last cluster or day is full, save the day
    if (cluster === clusters[clusters.length - 1] || currentDayHours >= hoursPerDay * 0.8) {
      schedule.push({
        day: currentDay,
        date: new Date(), // Will be updated with actual dates
        clusters: [...currentDayClusters],
        totalHours: currentDayHours
      })
      
      if (cluster !== clusters[clusters.length - 1]) {
        currentDay++
        currentDayHours = 0
        currentDayClusters = []
      }
    }
  }
  
  return schedule
}

/**
 * Filter clusters to fit within time constraints
 * Removes lowest desirability clusters until constraints are met
 */
export function filterClustersForTimeConstraints(
  clusters: DestinationCluster[],
  constraints: TimeConstraints
): {
  filteredClusters: DestinationCluster[]
  removedClusters: DestinationCluster[]
  totalHours: number
} {
  if (constraints.mode === 'auto') {
    // No filtering needed for auto mode
    return {
      filteredClusters: clusters,
      removedClusters: [],
      totalHours: clusters.reduce((sum, c) => sum + c.averageStayTime, 0)
    }
  }
  
  const maxHours = constraints.totalAvailableHours || 0
  const sortedClusters = [...clusters].sort((a, b) => b.totalDesirability - a.totalDesirability)
  
  const filteredClusters: DestinationCluster[] = []
  const removedClusters: DestinationCluster[] = []
  let totalHours = 0
  
  for (const cluster of sortedClusters) {
    const clusterTime = cluster.averageStayTime
    const travelTime = filteredClusters.length > 0 ? 2 : 0 // Rough travel time estimate
    
    if (totalHours + clusterTime + travelTime <= maxHours) {
      filteredClusters.push(cluster)
      totalHours += clusterTime + travelTime
    } else {
      removedClusters.push(cluster)
    }
  }
  
  return {
    filteredClusters,
    removedClusters,
    totalHours
  }
}

/**
 * Estimate travel time between clusters
 * For MVP, use simple distance-based estimation
 */
export function estimateTravelTime(distanceKm: number): number {
  if (distanceKm < 50) {
    return 0.5 // 30 minutes for short distances
  } else if (distanceKm < 200) {
    return 1.5 // 1.5 hours for medium distances
  } else if (distanceKm < 500) {
    return 3 // 3 hours for long distances (includes airport time)
  } else {
    return 4 // 4 hours for very long distances (flight)
  }
}