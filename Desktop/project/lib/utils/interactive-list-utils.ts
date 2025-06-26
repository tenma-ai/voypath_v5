// Utility functions for interactive list functionality
import type { 
  EditingPermissions, 
  UserContext, 
  GroupSettings, 
  InteractiveListItem,
  ReorderImpact,
  OptimizationSuggestion,
  ExclusionImpact,
  TimeAdjustmentControl,
  UserPreference
} from '@/lib/types/interactive-list'

// Permission calculation
export function calculateUserPermissions(
  user: UserContext, 
  groupSettings: GroupSettings
): EditingPermissions {
  const isAdmin = user.role === 'admin'
  const isCreator = user.isCreator
  
  return {
    canReorderDestinations: 
      groupSettings.allowOrderChange === 'all' ||
      (groupSettings.allowOrderChange === 'admin_only' && isAdmin) ||
      (groupSettings.allowOrderChange === 'specific_members' && 
       groupSettings.orderChangeMembers?.includes(user.id)) || false,
    
    canAdjustTimes: 
      groupSettings.allowTimeAdjust === 'all' ||
      (groupSettings.allowTimeAdjust === 'admin_only' && (isAdmin || isCreator)) ||
      false,
    
    canRemoveDestinations: isAdmin || isCreator,
    canAddDestinations: 
      groupSettings.allowDestinationAdd === 'all' || 
      (groupSettings.allowDestinationAdd === 'admin_only' && isAdmin) ||
      false,
    
    canEditPreferences: true, // Users can always edit their own preferences
    canViewAllPreferences: isAdmin || isCreator,
    canEditSettings: isAdmin || isCreator
  }
}

// Distance calculation between two coordinates
export function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371 // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180
  const dLon = (coord2.lng - coord1.lng) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Calculate total distance for an itinerary order
export function calculateTotalDistance(items: InteractiveListItem[]): number {
  if (items.length < 2) return 0
  
  return items.slice(0, -1).reduce((total, item, index) => {
    const nextItem = items[index + 1]
    return total + calculateDistance(item.coordinates, nextItem.coordinates)
  }, 0)
}

// Calculate total time for an itinerary
export function calculateTotalTime(items: InteractiveListItem[]): number {
  const activityTime = items.reduce((total, item) => total + item.allocatedTime, 0)
  const transportTime = items.slice(0, -1).reduce((total, item) => {
    return total + (item.transportToNext?.duration || 15)
  }, 0)
  return activityTime + transportTime
}

// Calculate reorder impact
export function calculateReorderImpact(
  oldOrder: InteractiveListItem[], 
  newOrder: InteractiveListItem[]
): ReorderImpact {
  const oldDistance = calculateTotalDistance(oldOrder)
  const newDistance = calculateTotalDistance(newOrder)
  const oldTime = calculateTotalTime(oldOrder)
  const newTime = calculateTotalTime(newOrder)
  
  const distanceChange = newDistance - oldDistance
  const timeChange = newTime - oldTime
  const efficiencyImpact = oldDistance > 0 ? (newDistance / oldDistance) - 1 : 0
  
  // Calculate satisfaction impact (simplified)
  const satisfactionImpact = newOrder.reduce((total, item, index) => {
    const oldIndex = oldOrder.findIndex(oldItem => oldItem.id === item.id)
    const positionChange = Math.abs(index - oldIndex)
    return total + (positionChange * -0.1) // Negative impact for position changes
  }, 0) / newOrder.length
  
  // Generate recommendation
  let recommendation: 'approve' | 'caution' | 'reject' = 'approve'
  const reasons: string[] = []
  
  if (distanceChange > 5) {
    recommendation = 'caution'
    reasons.push(`Increases total distance by ${distanceChange.toFixed(1)}km`)
  }
  
  if (distanceChange > 15) {
    recommendation = 'reject'
    reasons.push('Significantly increases travel distance')
  }
  
  if (timeChange > 60) {
    recommendation = 'caution'
    reasons.push(`Adds ${Math.round(timeChange)} minutes to schedule`)
  }
  
  if (satisfactionImpact < -0.3) {
    recommendation = 'caution'
    reasons.push('May negatively impact user satisfaction')
  }
  
  if (reasons.length === 0) {
    reasons.push('Reordering looks good!')
  }
  
  return {
    distanceChange,
    timeChange,
    efficiencyImpact,
    satisfactionImpact,
    recommendation,
    reasons
  }
}

// Calculate user satisfaction for a destination
export function calculateUserSatisfaction(
  item: InteractiveListItem,
  userId: string
): number {
  const userPref = item.interestedUsers.find(u => u.userId === userId)
  if (!userPref) return 0
  
  const requestedTime = userPref.requestedTime
  const allocatedTime = item.allocatedTime
  const rating = userPref.rating
  
  // Satisfaction is based on how close allocated time is to requested time
  // and weighted by the user's interest rating
  const timeRatio = Math.min(allocatedTime / requestedTime, 1)
  const ratingWeight = rating / 5
  
  return timeRatio * ratingWeight
}

// Generate optimization suggestions
export function generateOptimizationSuggestions(
  items: InteractiveListItem[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  
  // Check for geographic clustering opportunities
  for (let i = 0; i < items.length - 1; i++) {
    for (let j = i + 2; j < items.length; j++) {
      const item1 = items[i]
      const item2 = items[j]
      const distance = calculateDistance(item1.coordinates, item2.coordinates)
      
      if (distance < 0.5) { // Very close destinations
        suggestions.push({
          id: `cluster-${item1.id}-${item2.id}`,
          type: 'reorder',
          confidence: 0.8,
          priority: 'medium',
          impact: {
            timeSaving: 0.25,
            distanceReduction: distance * 0.7,
            costSaving: 0,
            satisfactionImprovement: 0.1,
            efficiencyGain: 0.15
          },
          title: 'Group nearby destinations',
          description: `${item1.name} and ${item2.name} are very close together`,
          actionRequired: 'Reorder to visit these destinations consecutively',
          affectedDestinations: [item1.id, item2.id],
          canAutoImplement: true,
          implementationComplexity: 'simple',
          requiresApproval: false
        })
      }
    }
  }
  
  // Check for over-allocated destinations
  items.forEach(item => {
    const avgRequestedTime = item.originalPreferences.users.reduce(
      (sum, user) => sum + user.requestedTime, 0
    ) / item.originalPreferences.users.length
    
    if (item.allocatedTime > avgRequestedTime * 1.5) {
      suggestions.push({
        id: `time-reduce-${item.id}`,
        type: 'time_adjust',
        confidence: 0.6,
        priority: 'low',
        impact: {
          timeSaving: (item.allocatedTime - avgRequestedTime) / 60,
          distanceReduction: 0,
          costSaving: 0,
          satisfactionImprovement: 0.05,
          efficiencyGain: 0.1
        },
        title: 'Reduce time allocation',
        description: `${item.name} has more time than users requested`,
        actionRequired: `Consider reducing time from ${item.allocatedTime} to ${Math.round(avgRequestedTime)} minutes`,
        affectedDestinations: [item.id],
        canAutoImplement: false,
        implementationComplexity: 'simple',
        requiresApproval: true
      })
    }
  })
  
  // Check for potential rest breaks
  let cumulativeTime = 0
  items.forEach((item, index) => {
    cumulativeTime += item.allocatedTime + (item.transportToNext?.duration || 0)
    
    if (cumulativeTime > 240 && index < items.length - 1) { // 4+ hours without break
      suggestions.push({
        id: `rest-break-${index}`,
        type: 'rest_break',
        confidence: 0.7,
        priority: 'medium',
        impact: {
          timeSaving: 0,
          distanceReduction: 0,
          costSaving: 0,
          satisfactionImprovement: 0.2,
          efficiencyGain: 0.1
        },
        title: 'Add rest break',
        description: `Consider adding a break after ${item.name}`,
        actionRequired: 'Add 30-60 minute break for food/rest',
        affectedDestinations: [],
        canAutoImplement: false,
        implementationComplexity: 'moderate',
        requiresApproval: true
      })
      cumulativeTime = 0 // Reset after suggesting break
    }
  })
  
  return suggestions.sort((a, b) => {
    // Sort by priority and confidence
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    const aPriority = priorityOrder[a.priority]
    const bPriority = priorityOrder[b.priority]
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority
    }
    
    return b.confidence - a.confidence
  })
}

// Calculate exclusion impact
export function calculateExclusionImpact(
  destination: InteractiveListItem,
  allItems: InteractiveListItem[]
): ExclusionImpact {
  const timeSaved = destination.allocatedTime + (destination.transportToNext?.duration || 0)
  const costSaved = (destination.estimatedCost || 0) + (destination.transportToNext?.cost || 0)
  
  // Calculate route optimization if destination is removed
  const remainingItems = allItems.filter(item => item.id !== destination.id)
  const oldDistance = calculateTotalDistance(allItems)
  const newDistance = calculateTotalDistance(remainingItems)
  
  return {
    destination,
    timeSaved,
    costSaved,
    usersAffected: destination.interestedUsers,
    satisfactionChange: destination.interestedUsers.reduce((acc, user) => {
      acc[user.userId] = -user.rating / 5 // Negative impact based on rating
      return acc
    }, {} as { [key: string]: number }),
    routeOptimization: {
      distanceReduced: Math.max(0, oldDistance - newDistance),
      timeReduced: timeSaved,
      newTransportOptions: [] // Would be calculated based on actual routing
    },
    recommendations: [
      timeSaved > 60 ? `Saves ${Math.round(timeSaved)} minutes` : '',
      costSaved > 0 ? `Saves $${costSaved.toFixed(2)}` : '',
      destination.interestedUsers.length > 1 ? `Affects ${destination.interestedUsers.length} users` : ''
    ].filter(Boolean)
  }
}

// Create time adjustment control data
export function createTimeAdjustmentControl(
  item: InteractiveListItem,
  allItems: InteractiveListItem[]
): TimeAdjustmentControl {
  const userPrefs = item.originalPreferences.users
  const minRequested = Math.min(...userPrefs.map(u => u.requestedTime))
  const maxRequested = Math.max(...userPrefs.map(u => u.requestedTime))
  
  // Calculate impact of time changes
  const currentIndex = allItems.findIndex(i => i.id === item.id)
  const nextItem = currentIndex >= 0 && currentIndex < allItems.length - 1 ? 
    allItems[currentIndex + 1] : null
  
  return {
    currentValue: item.allocatedTime,
    suggestedRange: [Math.max(15, minRequested * 0.8), maxRequested * 1.2],
    originalPreferences: userPrefs.reduce((acc, user) => {
      acc[user.userId] = user.requestedTime
      return acc
    }, {} as { [userId: string]: number }),
    impactDisplay: {
      scheduleChange: item.allocatedTime > 60 ? 
        `Current: ${Math.round(item.allocatedTime)}min` : 
        `Current: ${item.allocatedTime}min`,
      nextDestinationDelay: nextItem ? 
        `Affects timing to ${nextItem.name}` : 
        'Last destination',
      satisfactionChange: 0, // Would be calculated based on actual change
      usersAffected: userPrefs.map(u => u.userName)
    }
  }
}

// Format time duration for display
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  } else {
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor((minutes % 1440) / 60)
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
}

// Generate drag handle styles for touch optimization
export function getDragHandleStyles(isDragging: boolean, isDisabled: boolean) {
  return {
    opacity: isDisabled ? 0.3 : isDragging ? 1 : 0.6,
    cursor: isDisabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    transition: isDragging ? 'none' : 'opacity 0.2s ease'
  }
}