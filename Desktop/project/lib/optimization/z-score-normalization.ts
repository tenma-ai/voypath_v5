// Z-Score Normalization for fair preference comparison

import type { 
  ValidatedPreference 
} from './types'
import type {
  StandardizedPreference,
  UserStatistics,
  NormalizationResult
} from './normalization-types'

/**
 * Apply Z-Score normalization to user preferences
 * This ensures fair comparison between users with different rating patterns
 */
export function normalizePreferences(
  preferences: ValidatedPreference[]
): NormalizationResult {
  const warnings: string[] = []
  
  // Step 1: Group preferences by user
  const userPreferencesMap = groupPreferencesByUser(preferences)
  
  // Step 2: Calculate statistics for each user
  const userStatistics = new Map<string, UserStatistics>()
  
  for (const [userKey, userPrefs] of Array.from(userPreferencesMap.entries())) {
    const stats = calculateUserStatistics(userKey, userPrefs)
    userStatistics.set(userKey, stats)
    
    // Add warning for users with limited ratings
    if (stats.ratingCount < 3) {
      warnings.push(
        `User ${getUserDisplayName(userPrefs[0])} has only ${stats.ratingCount} ratings. Normalization may be less reliable.`
      )
    }
    
    // Add warning for users with zero standard deviation
    if (stats.standardDeviation === 0) {
      warnings.push(
        `User ${getUserDisplayName(userPrefs[0])} gave the same rating (${stats.mean}) to all destinations.`
      )
    }
  }
  
  // Step 3: Apply Z-score transformation
  const standardizedPreferences: StandardizedPreference[] = []
  
  for (const preference of preferences) {
    const userKey = getUserKey(preference)
    const stats = userStatistics.get(userKey)
    
    if (!stats) {
      console.warn(`No statistics found for user ${userKey}`)
      continue
    }
    
    const standardizedScore = calculateZScore(
      preference.preferenceScore,
      stats.mean,
      stats.standardDeviation
    )
    
    standardizedPreferences.push({
      userId: preference.userId,
      sessionId: preference.sessionId,
      destinationId: preference.destinationId,
      originalScore: preference.preferenceScore,
      standardizedScore,
      preferredDuration: preference.preferredDuration,
      userName: preference.userDisplayName,
      userColor: preference.userColor
    })
  }
  
  return {
    standardizedPreferences,
    userStatistics,
    warnings
  }
}

/**
 * Group preferences by user (handling both guest and authenticated users)
 */
function groupPreferencesByUser(
  preferences: ValidatedPreference[]
): Map<string, ValidatedPreference[]> {
  const userPrefsMap = new Map<string, ValidatedPreference[]>()
  
  for (const preference of preferences) {
    const userKey = getUserKey(preference)
    const userPrefs = userPrefsMap.get(userKey) || []
    userPrefs.push(preference)
    userPrefsMap.set(userKey, userPrefs)
  }
  
  return userPrefsMap
}

/**
 * Get unique user key for grouping
 */
function getUserKey(preference: ValidatedPreference): string {
  return preference.userId || preference.sessionId || 'unknown'
}

/**
 * Get user display name for warnings
 */
function getUserDisplayName(preference: ValidatedPreference): string {
  return preference.userDisplayName || 'Unknown User'
}

/**
 * Calculate statistics for a user's ratings
 */
function calculateUserStatistics(
  userKey: string,
  preferences: ValidatedPreference[]
): UserStatistics {
  const ratings = preferences.map(p => p.preferenceScore)
  const mean = calculateMean(ratings)
  const standardDeviation = calculateStandardDeviation(ratings, mean)
  
  return {
    userId: preferences[0].userId,
    sessionId: preferences[0].sessionId,
    userKey,
    ratings,
    mean,
    standardDeviation: standardDeviation === 0 ? 1 : standardDeviation, // Avoid division by zero
    ratingCount: ratings.length
  }
}

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStandardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) return 0
  
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const avgSquaredDiff = calculateMean(squaredDiffs)
  return Math.sqrt(avgSquaredDiff)
}

/**
 * Calculate Z-score for a value
 */
function calculateZScore(
  value: number,
  mean: number,
  standardDeviation: number
): number {
  if (standardDeviation === 0) return 0
  return (value - mean) / standardDeviation
}

/**
 * Analyze normalization results for quality assurance
 */
export function analyzeNormalizationQuality(
  result: NormalizationResult
): {
  isValid: boolean
  issues: string[]
  statistics: {
    meanOfMeans: number
    meanOfStdDevs: number
    usersWithSingleRating: number
    usersWithIdenticalRatings: number
  }
} {
  const issues: string[] = []
  const statsArray = Array.from(result.userStatistics.values())
  
  // Calculate overall statistics
  const means = statsArray.map(s => s.mean)
  const stdDevs = statsArray.map(s => s.standardDeviation)
  
  const meanOfMeans = calculateMean(means)
  const meanOfStdDevs = calculateMean(stdDevs)
  
  // Check for issues
  const usersWithSingleRating = statsArray.filter(s => s.ratingCount === 1).length
  const usersWithIdenticalRatings = statsArray.filter(s => s.standardDeviation === 0).length
  
  if (usersWithSingleRating > 0) {
    issues.push(`${usersWithSingleRating} users have only one rating`)
  }
  
  if (usersWithIdenticalRatings > 0) {
    issues.push(`${usersWithIdenticalRatings} users gave identical ratings to all destinations`)
  }
  
  // Check if normalization produced reasonable results
  const normalizedScores = result.standardizedPreferences.map(p => p.standardizedScore)
  const normalizedMean = calculateMean(normalizedScores)
  const normalizedStdDev = calculateStandardDeviation(normalizedScores, normalizedMean)
  
  // Normalized scores should have mean ≈ 0 and stdDev ≈ 1
  if (Math.abs(normalizedMean) > 0.1) {
    issues.push(`Normalized scores have non-zero mean: ${normalizedMean.toFixed(3)}`)
  }
  
  if (Math.abs(normalizedStdDev - 1) > 0.2) {
    issues.push(`Normalized scores have non-unit standard deviation: ${normalizedStdDev.toFixed(3)}`)
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    statistics: {
      meanOfMeans,
      meanOfStdDevs,
      usersWithSingleRating,
      usersWithIdenticalRatings
    }
  }
}

/**
 * Convert standardized scores back to interpretable format
 * Useful for displaying results to users
 */
export function interpretStandardizedScore(score: number): {
  level: 'very_low' | 'low' | 'neutral' | 'high' | 'very_high'
  description: string
  percentile: number
} {
  // Based on standard normal distribution
  if (score < -1.5) {
    return {
      level: 'very_low',
      description: 'Much lower than user\'s average preference',
      percentile: 7 // Below ~7th percentile
    }
  } else if (score < -0.5) {
    return {
      level: 'low',
      description: 'Below user\'s average preference',
      percentile: 31 // ~31st percentile
    }
  } else if (score < 0.5) {
    return {
      level: 'neutral',
      description: 'Near user\'s average preference',
      percentile: 50 // ~50th percentile
    }
  } else if (score < 1.5) {
    return {
      level: 'high',
      description: 'Above user\'s average preference',
      percentile: 69 // ~69th percentile
    }
  } else {
    return {
      level: 'very_high',
      description: 'Much higher than user\'s average preference',
      percentile: 93 // Above ~93rd percentile
    }
  }
}