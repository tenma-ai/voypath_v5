// User association and color mapping for destinations

import type { GroupMembers } from '@/lib/database.types'
import type { StandardizedPreference } from './normalization-types'
import type { WishfulUser } from './detailed-route-types'

// Color palette for user assignment
const USER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B595', // Peach
  '#C7CEEA'  // Lavender
]

/**
 * Find all users who expressed interest in a destination
 */
export function findWishfulUsers(
  destinationId: string,
  preferences: StandardizedPreference[],
  groupMembers: GroupMembers[]
): WishfulUser[] {
  // Find all preferences for this destination
  const destinationPrefs = preferences.filter(
    pref => pref.destinationId === destinationId
  )
  
  // Map preferences to group members
  const wishfulUsers: WishfulUser[] = []
  
  for (const pref of destinationPrefs) {
    // Find corresponding group member
    const member = findGroupMembers(pref, groupMembers)
    
    if (member) {
      wishfulUsers.push({
        member,
        preference: pref,
        originalRating: pref.originalScore,
        assignedColor: member.assigned_color || getUserColor(member, groupMembers)
      })
    }
  }
  
  // Sort by rating (highest first) for consistent ordering
  wishfulUsers.sort((a, b) => b.originalRating - a.originalRating)
  
  return wishfulUsers
}

/**
 * Find group member corresponding to a preference
 */
function findGroupMembers(
  preference: StandardizedPreference,
  groupMembers: GroupMembers[]
): GroupMembers | null {
  // Try to match by user ID first
  if (preference.userId) {
    const member = groupMembers.find(m => m.user_id === preference.userId)
    if (member) return member
  }
  
  // Try to match by session ID for guests
  if (preference.sessionId) {
    const member = groupMembers.find(m => m.session_id === preference.sessionId)
    if (member) return member
  }
  
  // Try to match by name as fallback
  const member = groupMembers.find(
    m => m.display_name === preference.userName
  )
  
  return member || null
}

/**
 * Get or assign color for a user
 */
function getUserColor(member: GroupMembers, allMembers: GroupMembers[]): string {
  // If member already has a color, use it
  if (member.assigned_color) {
    return member.assigned_color
  }
  
  // Find member index for consistent color assignment
  const memberIndex = allMembers.findIndex(
    m => (m.user_id && m.user_id === member.user_id) || 
         (m.session_id && m.session_id === member.session_id)
  )
  
  // Assign color based on index
  if (memberIndex >= 0) {
    return USER_COLORS[memberIndex % USER_COLORS.length]
  }
  
  // Default color if not found
  return USER_COLORS[0]
}

/**
 * Create user satisfaction summary for all destinations
 */
export function createUserSatisfactionMap(
  destinationIds: string[],
  preferences: StandardizedPreference[],
  groupMembers: GroupMembers[]
): Map<string, Set<string>> {
  const satisfactionMap = new Map<string, Set<string>>()
  
  // Initialize map for all members
  for (const member of groupMembers) {
    const memberKey = member.user_id || member.session_id || member.display_name
    satisfactionMap.set(memberKey, new Set())
  }
  
  // Add satisfied destinations for each member
  for (const destinationId of destinationIds) {
    const destinationPrefs = preferences.filter(
      pref => pref.destinationId === destinationId
    )
    
    for (const pref of destinationPrefs) {
      const memberKey = pref.userId || pref.sessionId || pref.userName
      const memberDestinations = satisfactionMap.get(memberKey)
      if (memberDestinations) {
        memberDestinations.add(destinationId)
      }
    }
  }
  
  return satisfactionMap
}

/**
 * Calculate user satisfaction statistics
 */
export function calculateUserSatisfactionStats(
  visitedDestinationIds: string[],
  preferences: StandardizedPreference[],
  groupMembers: GroupMembers[]
): {
  member: GroupMembers
  visitedWishlistCount: number
  totalWishlistCount: number
  satisfactionPercentage: number
  visitedDestinations: string[]
  missedDestinations: string[]
}[] {
  const stats = []
  
  for (const member of groupMembers) {
    // Find all preferences for this member
    const memberPrefs = preferences.filter(pref => 
      (member.user_id && pref.userId === member.user_id) ||
      (member.session_id && pref.sessionId === member.session_id) ||
      (pref.userName === member.display_name)
    )
    
    // Find which of their preferences are visited
    const visitedDestinations = memberPrefs
      .filter(pref => visitedDestinationIds.includes(pref.destinationId))
      .map(pref => pref.destinationId)
    
    const missedDestinations = memberPrefs
      .filter(pref => !visitedDestinationIds.includes(pref.destinationId))
      .map(pref => pref.destinationId)
    
    const satisfactionPercentage = memberPrefs.length > 0
      ? (visitedDestinations.length / memberPrefs.length) * 100
      : 0
    
    stats.push({
      member,
      visitedWishlistCount: visitedDestinations.length,
      totalWishlistCount: memberPrefs.length,
      satisfactionPercentage,
      visitedDestinations,
      missedDestinations
    })
  }
  
  return stats
}

/**
 * Validate user associations
 */
export function validateUserAssociations(
  wishfulUsers: WishfulUser[],
  groupMembers: GroupMembers[]
): {
  isValid: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  
  // Check for users without colors
  const usersWithoutColors = wishfulUsers.filter(wu => !wu.assignedColor)
  if (usersWithoutColors.length > 0) {
    warnings.push(
      `${usersWithoutColors.length} users without assigned colors`
    )
  }
  
  // Check for preferences without matching group members
  const memberIds = new Set(
    groupMembers.map(m => m.user_id || m.session_id || m.display_name)
  )
  
  const unmatchedPrefs = wishfulUsers.filter(wu => {
    const memberId = wu.member.user_id || wu.member.session_id || wu.member.display_name
    return !memberIds.has(memberId)
  })
  
  if (unmatchedPrefs.length > 0) {
    warnings.push(
      `${unmatchedPrefs.length} preferences without matching group members`
    )
  }
  
  // Check for duplicate user assignments
  const userCounts = new Map<string, number>()
  for (const wu of wishfulUsers) {
    const key = wu.member.user_id || wu.member.session_id || wu.member.display_name
    userCounts.set(key, (userCounts.get(key) || 0) + 1)
  }
  
  const duplicates = Array.from(userCounts.entries()).filter(([_, count]) => count > 1)
  if (duplicates.length > 0) {
    warnings.push(
      `Found duplicate user assignments for destination`
    )
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}