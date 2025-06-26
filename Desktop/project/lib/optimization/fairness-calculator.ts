// Fairness calculation using Gini coefficient

import type { 
  DestinationCluster, 
  StandardizedPreference 
} from './normalization-types'
import type { 
  UserSatisfaction, 
  GiniResult 
} from './algorithm-types'

/**
 * Calculate fairness score using Gini coefficient
 * Lower Gini = more equal distribution of satisfaction
 * Fairness score = 1 - |Gini| (higher is better)
 */
export function calculateFairness(
  selectedClusters: DestinationCluster[],
  standardizedPreferences: StandardizedPreference[],
  userKeys: Set<string>
): GiniResult {
  // Step 1: Calculate satisfaction for each user
  const userSatisfactions = calculateUserSatisfactions(
    selectedClusters,
    standardizedPreferences,
    userKeys
  )
  
  // Handle edge case: single user
  if (userSatisfactions.length <= 1) {
    return {
      giniCoefficient: 0,
      fairnessScore: 1, // Perfect fairness for single user
      userSatisfactions,
      lowestSatisfaction: userSatisfactions[0] || null,
      highestSatisfaction: userSatisfactions[0] || null
    }
  }
  
  // Step 2: Calculate Gini coefficient
  const gini = calculateGiniCoefficient(userSatisfactions)
  
  // Step 3: Convert to fairness score
  const fairnessScore = 1 - Math.abs(gini)
  
  // Step 4: Find extremes
  const sortedSatisfactions = [...userSatisfactions].sort(
    (a, b) => a.satisfactionScore - b.satisfactionScore
  )
  
  return {
    giniCoefficient: gini,
    fairnessScore,
    userSatisfactions,
    lowestSatisfaction: sortedSatisfactions[0],
    highestSatisfaction: sortedSatisfactions[sortedSatisfactions.length - 1]
  }
}

/**
 * Calculate satisfaction scores for all users
 */
function calculateUserSatisfactions(
  selectedClusters: DestinationCluster[],
  standardizedPreferences: StandardizedPreference[],
  userKeys: Set<string>
): UserSatisfaction[] {
  // Create preference lookup map
  const preferenceMap = new Map<string, StandardizedPreference[]>()
  for (const pref of standardizedPreferences) {
    const userKey = pref.userId || pref.sessionId || 'unknown'
    const userPrefs = preferenceMap.get(userKey) || []
    userPrefs.push(pref)
    preferenceMap.set(userKey, userPrefs)
  }
  
  // Calculate satisfaction for each user
  const satisfactions: UserSatisfaction[] = []
  
  for (const userKey of Array.from(userKeys)) {
    const userPrefs = preferenceMap.get(userKey) || []
    
    // Sum standardized scores for selected destinations
    let satisfactionScore = 0
    let selectedDestinations = 0
    
    for (const cluster of selectedClusters) {
      for (const destination of cluster.destinations) {
        const pref = userPrefs.find(p => p.destinationId === destination.id)
        if (pref) {
          satisfactionScore += pref.standardizedScore
          selectedDestinations++
        }
      }
    }
    
    // Get user display info from first preference
    const firstPref = userPrefs[0]
    const userName = firstPref?.userName || 'Unknown User'
    
    satisfactions.push({
      userId: firstPref?.userId || null,
      sessionId: firstPref?.sessionId || null,
      userKey,
      userName,
      satisfactionScore,
      selectedDestinations,
      totalDestinations: userPrefs.length
    })
  }
  
  return satisfactions
}

/**
 * Calculate Gini coefficient from satisfaction scores
 * Gini = (2 * Σ(rank * satisfaction)) / (n * totalSatisfaction) - (n+1)/n
 */
function calculateGiniCoefficient(satisfactions: UserSatisfaction[]): number {
  const n = satisfactions.length
  if (n === 0) return 0
  
  // Sort by satisfaction score (ascending)
  const sorted = [...satisfactions].sort(
    (a, b) => a.satisfactionScore - b.satisfactionScore
  )
  
  // Calculate total satisfaction
  const totalSatisfaction = sorted.reduce(
    (sum, s) => sum + s.satisfactionScore,
    0
  )
  
  // Handle edge case: no satisfaction
  if (totalSatisfaction === 0) return 0
  
  // Calculate weighted sum
  let weightedSum = 0
  sorted.forEach((satisfaction, index) => {
    const rank = index + 1
    weightedSum += rank * satisfaction.satisfactionScore
  })
  
  // Apply Gini formula
  const gini = (2 * weightedSum) / (n * totalSatisfaction) - (n + 1) / n
  
  // Ensure result is in valid range [-1, 1]
  return Math.max(-1, Math.min(1, gini))
}

/**
 * Analyze fairness distribution and provide insights
 */
export function analyzeFairnessDistribution(
  giniResult: GiniResult
): {
  isBalanced: boolean
  disparityLevel: 'low' | 'medium' | 'high'
  recommendations: string[]
} {
  const { fairnessScore, lowestSatisfaction, highestSatisfaction } = giniResult
  
  // Determine balance level
  const isBalanced = fairnessScore >= 0.7
  
  // Calculate disparity level
  let disparityLevel: 'low' | 'medium' | 'high'
  if (fairnessScore >= 0.8) {
    disparityLevel = 'low'
  } else if (fairnessScore >= 0.6) {
    disparityLevel = 'medium'
  } else {
    disparityLevel = 'high'
  }
  
  // Generate recommendations
  const recommendations: string[] = []
  
  if (lowestSatisfaction && highestSatisfaction && fairnessScore < 0.7) {
    const gap = highestSatisfaction.satisfactionScore - lowestSatisfaction.satisfactionScore
    
    if (gap > 2) {
      recommendations.push(
        `Consider adding more destinations preferred by ${lowestSatisfaction.userName}`
      )
    }
    
    if (lowestSatisfaction.selectedDestinations < lowestSatisfaction.totalDestinations * 0.3) {
      recommendations.push(
        `${lowestSatisfaction.userName} has very few selected destinations (${lowestSatisfaction.selectedDestinations}/${lowestSatisfaction.totalDestinations})`
      )
    }
  }
  
  if (fairnessScore < 0.5) {
    recommendations.push(
      'The current selection heavily favors some members over others'
    )
    recommendations.push(
      'Consider manually adjusting the destination selection for better balance'
    )
  }
  
  return {
    isBalanced,
    disparityLevel,
    recommendations
  }
}

/**
 * Calculate incremental fairness impact of adding/removing a cluster
 * Useful for greedy optimization
 */
export function calculateIncrementalFairness(
  currentClusters: DestinationCluster[],
  candidateCluster: DestinationCluster,
  standardizedPreferences: StandardizedPreference[],
  userKeys: Set<string>,
  operation: 'add' | 'remove'
): {
  currentFairness: number
  newFairness: number
  fairnessChange: number
  recommendation: 'accept' | 'reject' | 'neutral'
} {
  // Calculate current fairness
  const currentResult = calculateFairness(
    currentClusters,
    standardizedPreferences,
    userKeys
  )
  
  // Calculate new fairness with change
  let newClusters: DestinationCluster[]
  if (operation === 'add') {
    newClusters = [...currentClusters, candidateCluster]
  } else {
    newClusters = currentClusters.filter(c => c.id !== candidateCluster.id)
  }
  
  const newResult = calculateFairness(
    newClusters,
    standardizedPreferences,
    userKeys
  )
  
  const fairnessChange = newResult.fairnessScore - currentResult.fairnessScore
  
  // Make recommendation
  let recommendation: 'accept' | 'reject' | 'neutral'
  if (fairnessChange > 0.05) {
    recommendation = 'accept'
  } else if (fairnessChange < -0.05) {
    recommendation = 'reject'
  } else {
    recommendation = 'neutral'
  }
  
  return {
    currentFairness: currentResult.fairnessScore,
    newFairness: newResult.fairnessScore,
    fairnessChange,
    recommendation
  }
}