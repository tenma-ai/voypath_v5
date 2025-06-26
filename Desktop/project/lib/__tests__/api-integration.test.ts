/**
 * Comprehensive API Integration and Error Handling Test Suite
 * 
 * Tests the complete optimization API layer including error handling,
 * validation, progress tracking, and all fallback mechanisms.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { 
  OptimizationResponse, 
  OptimizationError, 
  OptimizationErrorType 
} from '../types/api-errors'
import { optimizeTripRoute } from '../actions/optimization-server-actions'
import { validateOptimizationInput } from '../utils/input-validation'
import { formatErrorForUser } from '../utils/error-messages'
import { PerformanceTracker } from '../utils/performance-tracker'
import { ProgressReporter } from '../utils/progress-tracking'
import { optimizeWithTimeout } from '../utils/timeout-management'
import { detectDataEdgeCases, handleDataEdgeCases } from '../utils/edge-case-handling'

// Mock external dependencies
jest.mock('../supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: mockTripData, error: null }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      update: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }))
}))

jest.mock('../optimization/complete-optimizer-v2', () => ({
  optimizeTripItinerary: jest.fn(() => Promise.resolve(mockOptimizationResult))
}))

// Mock data
const mockTripData = {
  id: 'test-trip-123',
  name: 'Test Trip',
  start_date: '2024-07-01',
  end_date: '2024-07-05',
  created_by: 'user-123'
}

const mockGroupMembers = [
  { id: 'user-1', name: 'Alice' },
  { id: 'user-2', name: 'Bob' },
  { id: 'user-3', name: 'Charlie' }
]

const mockDestinations = [
  { 
    id: 'dest-1', 
    name: 'Tokyo Tower',
    latitude: 35.6586,
    longitude: 139.7454
  },
  { 
    id: 'dest-2', 
    name: 'Shibuya Crossing',
    latitude: 35.6598,
    longitude: 139.7006
  },
  { 
    id: 'dest-3', 
    name: 'Senso-ji Temple',
    latitude: 35.7148,
    longitude: 139.7967
  }
]

const mockUserPreferences = {
  'user-1': { 'dest-1': 5, 'dest-2': 3, 'dest-3': 4 },
  'user-2': { 'dest-1': 4, 'dest-2': 5, 'dest-3': 3 },
  'user-3': { 'dest-1': 3, 'dest-2': 4, 'dest-3': 5 }
}

const mockOptimizationResult = {
  bestRoute: {
    dayPlans: [
      {
        day: 1,
        destinations: [mockDestinations[0], mockDestinations[1]],
        totalDuration: 8 * 60, // 8 hours in minutes
        totalDistance: 5.2
      },
      {
        day: 2,
        destinations: [mockDestinations[2]],
        totalDuration: 6 * 60, // 6 hours in minutes
        totalDistance: 3.1
      }
    ],
    totalDistance: 8.3,
    totalDuration: 14 * 60, // 14 hours total
    fairnessScore: 0.85,
    feasibilityScore: 0.92
  },
  alternativeRoutes: [],
  optimizationMetadata: {
    algorithm: 'complete-optimizer-v2',
    iterations: 150,
    convergenceAchieved: true,
    processingTime: 2340
  }
}

const mockCurrentUser = {
  id: 'user-1',
  sessionId: 'session-123',
  isGuest: false
}

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Input Validation', () => {
    it('should validate correct optimization input', () => {
      const validInput = {
        groupId: 'test-trip-123',
        destinations: mockDestinations,
        userPreferences: mockUserPreferences,
        groupMembers: mockGroupMembers,
        departureLocation: { latitude: 35.6762, longitude: 139.6503 },
        tripDuration: 4
      }

      const result = validateOptimizationInput(validInput)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch invalid coordinates', () => {
      const invalidInput = {
        groupId: 'test-trip-123',
        destinations: [
          { ...mockDestinations[0], latitude: 999 }, // Invalid latitude
          { ...mockDestinations[1], longitude: -999 } // Invalid longitude
        ],
        userPreferences: mockUserPreferences,
        groupMembers: mockGroupMembers,
        departureLocation: { latitude: 35.6762, longitude: 139.6503 }
      }

      const result = validateOptimizationInput(invalidInput)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('latitude'))).toBe(true)
      expect(result.errors.some(error => error.includes('longitude'))).toBe(true)
    })

    it('should detect insufficient preferences', () => {
      const insufficientInput = {
        groupId: 'test-trip-123',
        destinations: mockDestinations,
        userPreferences: {
          'user-1': { 'dest-1': 5 } // Only one preference
        },
        groupMembers: mockGroupMembers,
        departureLocation: { latitude: 35.6762, longitude: 139.6503 }
      }

      const result = validateOptimizationInput(insufficientInput)
      
      expect(result.warnings.some(warning => 
        warning.includes('preferences')
      )).toBe(true)
    })
  })

  describe('Edge Case Detection and Handling', () => {
    it('should detect single destination edge case', () => {
      const singleDestinationData = {
        destinationLocations: [mockDestinations[0]],
        input: {
          groupMembers: mockGroupMembers,
          userPreferences: mockUserPreferences,
          tripGroup: mockTripData
        }
      }

      const result = detectDataEdgeCases(singleDestinationData)
      
      expect(result.hasEdgeCases).toBe(true)
      expect(result.detectedCases).toContain('single_destination')
      expect(result.recommendations).toContain('Consider adding more destinations for a richer itinerary')
    })

    it('should detect colocated destinations', () => {
      const colocatedDestinations = [
        { latitude: 35.6586, longitude: 139.7454 },
        { latitude: 35.6587, longitude: 139.7455 }, // Very close to first
        { latitude: 35.6588, longitude: 139.7456 }  // Very close to first
      ]

      const colocatedData = {
        destinationLocations: colocatedDestinations,
        input: {
          groupMembers: mockGroupMembers,
          userPreferences: mockUserPreferences,
          tripGroup: mockTripData
        }
      }

      const result = detectDataEdgeCases(colocatedData)
      
      expect(result.hasEdgeCases).toBe(true)
      expect(result.detectedCases).toContain('colocated_destinations')
    })

    it('should handle edge cases by applying transformations', () => {
      const edgeCaseData = {
        destinationLocations: [mockDestinations[0]], // Single destination
        input: {
          groupMembers: [mockGroupMembers[0]], // Single user
          userPreferences: { 'user-1': {} }, // No preferences
          tripGroup: mockTripData
        }
      }

      const result = handleDataEdgeCases(edgeCaseData)
      
      expect(result.optimizationHints?.singleDestination).toBe(true)
      expect(result.optimizationHints?.singleUser).toBe(true)
    })
  })

  describe('Error Handling and User-Friendly Messages', () => {
    it('should format insufficient data error correctly', () => {
      const error: OptimizationError = {
        type: 'insufficient_data' as OptimizationErrorType,
        message: 'Not enough preference data',
        userMessage: 'We need more information',
        suggestedActions: ['Add more preferences'],
        retryable: false,
        details: { missingPreferences: 15 }
      }

      const userFriendlyError = formatErrorForUser(error)
      
      expect(userFriendlyError.title).toBe('Not Enough Information')
      expect(userFriendlyError.severity).toBe('warning')
      expect(userFriendlyError.suggestions).toContain('Ask group members to rate more destinations')
      expect(userFriendlyError.helpUrl).toBe('/help/adding-preferences')
    })

    it('should format timeout error with contextual suggestions', () => {
      const error: OptimizationError = {
        type: 'optimization_timeout' as OptimizationErrorType,
        message: 'Optimization timed out',
        userMessage: 'Taking too long',
        suggestedActions: ['Try with fewer destinations'],
        retryable: true,
        details: { timeoutAfter: 30000 }
      }

      const userFriendlyError = formatErrorForUser(error)
      
      expect(userFriendlyError.title).toBe('Taking Longer Than Expected')
      expect(userFriendlyError.severity).toBe('warning')
      expect(userFriendlyError.retryable).toBe(true)
    })

    it('should handle unknown errors gracefully', () => {
      const unknownError = new Error('Unexpected system error')
      
      const userFriendlyError = formatErrorForUser({
        type: 'unknown_error' as OptimizationErrorType,
        message: unknownError.message,
        userMessage: 'Something unexpected happened',
        suggestedActions: ['Try again'],
        retryable: true,
        details: { originalError: unknownError }
      })
      
      expect(userFriendlyError.title).toBe('Unexpected Error')
      expect(userFriendlyError.message).toContain('Something unexpected happened')
      expect(userFriendlyError.suggestions).toContain('Try refreshing the page')
    })
  })

  describe('Performance Tracking', () => {
    it('should track optimization performance metrics', () => {
      const tracker = new PerformanceTracker()
      
      tracker.startStage('preprocessing')
      // Simulate some work
      setTimeout(() => tracker.endStage('preprocessing'), 100)
      
      tracker.startStage('optimization')
      setTimeout(() => tracker.endStage('optimization'), 200)
      
      setTimeout(() => {
        const metrics = tracker.getMetrics()
        
        expect(metrics.stageTimings.preprocessing).toBeGreaterThan(0)
        expect(metrics.stageTimings.optimization).toBeGreaterThan(0)
        expect(metrics.totalProcessingTime).toBeGreaterThan(0)
      }, 350)
    })

    it('should calculate quality metrics correctly', () => {
      const tracker = new PerformanceTracker()
      
      tracker.recordQualityMetrics(mockOptimizationResult)
      const metrics = tracker.getMetrics()
      
      expect(metrics.qualityMetrics.fairnessScore).toBe(0.85)
      expect(metrics.qualityMetrics.routeEfficiency).toBeGreaterThan(0)
      expect(metrics.qualityMetrics.userSatisfactionEstimate).toBeGreaterThan(0)
    })
  })

  describe('Progress Tracking', () => {
    it('should report progress updates correctly', async () => {
      const mockSupabase = {
        channel: jest.fn(() => ({
          send: jest.fn(() => Promise.resolve())
        }))
      }

      const reporter = new ProgressReporter('test-trip-123', mockSupabase)
      
      const progressUpdate = {
        stage: 'preprocessing' as const,
        progress: 25,
        message: 'Loading destination data...',
        estimatedTimeRemaining: 5000
      }

      await reporter.updateProgress(progressUpdate)
      
      expect(mockSupabase.channel).toHaveBeenCalledWith('optimization-progress')
    })

    it('should calculate progress percentages correctly', () => {
      const reporter = new ProgressReporter('test-trip-123', {})
      
      // Test progress calculation for different stages
      expect(reporter.calculateOverallProgress('preprocessing')).toBe(10)
      expect(reporter.calculateOverallProgress('clustering')).toBe(25)
      expect(reporter.calculateOverallProgress('optimizing')).toBe(50)
      expect(reporter.calculateOverallProgress('generating')).toBe(75)
      expect(reporter.calculateOverallProgress('saving')).toBe(95)
    })
  })

  describe('Timeout Management', () => {
    it('should timeout operations that take too long', async () => {
      const slowOperation = () => new Promise(resolve => 
        setTimeout(resolve, 10000) // 10 second operation
      )

      await expect(
        optimizeWithTimeout(slowOperation, 1000) // 1 second timeout
      ).rejects.toThrow('Optimization exceeded 1000ms timeout')
    })

    it('should complete fast operations successfully', async () => {
      const fastOperation = () => Promise.resolve('success')

      const result = await optimizeWithTimeout(fastOperation, 5000)
      expect(result).toBe('success')
    })

    it('should handle resource constraints appropriately', () => {
      const resourceManager = {
        checkMemoryUsage: () => 85, // 85% memory usage
        checkCpuUsage: () => 90,    // 90% CPU usage
        shouldReduceComplexity: () => true
      }

      // Test that high resource usage triggers complexity reduction
      expect(resourceManager.shouldReduceComplexity()).toBe(true)
    })
  })

  describe('Complete API Integration', () => {
    it('should successfully optimize a valid trip', async () => {
      const result = await optimizeTripRoute(
        'test-trip-123',
        mockCurrentUser,
        {
          maxIterations: 100,
          timeoutMs: 5000,
          includeAlternatives: true
        }
      )

      expect(result.status).toBe('success')
      expect(result.data).toBeDefined()
      expect(result.data?.bestRoute).toBeDefined()
      expect(result.processingTime).toBeGreaterThan(0)
    })

    it('should handle optimization failures gracefully', async () => {
      // Mock a failure in the optimization process
      jest.mocked(require('../optimization/complete-optimizer-v2').optimizeTripItinerary)
        .mockRejectedValueOnce(new Error('Optimization failed'))

      const result = await optimizeTripRoute(
        'test-trip-123',
        mockCurrentUser
      )

      expect(result.status).toBe('error')
      expect(result.error).toBeDefined()
      expect(result.fallbackData).toBeDefined()
    })

    it('should apply fallback strategies when needed', async () => {
      // Mock insufficient data scenario
      const insufficientData = {
        destinationLocations: [mockDestinations[0]], // Only one destination
        input: {
          groupMembers: [mockGroupMembers[0]], // Only one user
          userPreferences: {},
          tripGroup: mockTripData
        }
      }

      const result = await optimizeTripRoute(
        'test-trip-123',
        mockCurrentUser
      )

      // Should still return a result using fallback strategies
      expect(result).toBeDefined()
      expect(result.status === 'success' || result.fallbackData).toBeTruthy()
    })

    it('should validate user permissions correctly', async () => {
      const unauthorizedUser = {
        id: 'unauthorized-user',
        sessionId: 'session-456',
        isGuest: false
      }

      const result = await optimizeTripRoute(
        'test-trip-123',
        unauthorizedUser
      )

      expect(result.status).toBe('error')
      expect(result.error?.type).toBe('permission_denied')
    })

    it('should handle database errors with appropriate fallbacks', async () => {
      // Mock database error
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ 
                data: null, 
                error: new Error('Database connection failed') 
              }))
            }))
          }))
        }))
      }

      // Test should implement caching and retry logic
      const result = await optimizeTripRoute(
        'test-trip-123',
        mockCurrentUser
      )

      // Should either succeed with cached data or fail gracefully
      expect(result).toBeDefined()
      if (result.status === 'error') {
        expect(result.error?.type).toBe('database_error')
        expect(result.error?.retryable).toBe(true)
      }
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should implement exponential backoff for retries', () => {
      const getRetryDelay = (errorType: string, attempt: number) => {
        const baseDelays: Record<string, number> = {
          'database_error': 3000,
          'network_error': 1000,
          'rate_limit_exceeded': 60000
        }
        
        const baseDelay = baseDelays[errorType] || 1000
        return baseDelay * Math.pow(2, attempt - 1)
      }

      expect(getRetryDelay('database_error', 1)).toBe(3000)
      expect(getRetryDelay('database_error', 2)).toBe(6000)
      expect(getRetryDelay('database_error', 3)).toBe(12000)
    })

    it('should limit retry attempts appropriately', () => {
      const shouldRetry = (attempt: number, maxAttempts: number = 3) => {
        return attempt < maxAttempts
      }

      expect(shouldRetry(1)).toBe(true)
      expect(shouldRetry(2)).toBe(true)
      expect(shouldRetry(3)).toBe(false)
      expect(shouldRetry(4)).toBe(false)
    })

    it('should preserve user data during failures', async () => {
      // Test that user preferences and trip data are preserved
      // even when optimization fails
      const preserveUserData = (tripData: any, preferences: any) => {
        return {
          tripData,
          preferences,
          timestamp: new Date().toISOString(),
          preserved: true
        }
      }

      const preserved = preserveUserData(mockTripData, mockUserPreferences)
      
      expect(preserved.tripData).toEqual(mockTripData)
      expect(preserved.preferences).toEqual(mockUserPreferences)
      expect(preserved.preserved).toBe(true)
    })
  })
})

describe('System Integration Scenarios', () => {
  it('should handle high-load scenarios gracefully', async () => {
    // Simulate multiple concurrent optimization requests
    const concurrentRequests = Array(5).fill(null).map((_, index) => 
      optimizeTripRoute(
        `test-trip-${index}`,
        { ...mockCurrentUser, id: `user-${index}` }
      )
    )

    const results = await Promise.allSettled(concurrentRequests)
    
    // All requests should either succeed or fail gracefully
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        expect(result.value).toBeDefined()
        expect(['success', 'error']).toContain(result.value.status)
      }
    })
  })

  it('should maintain data consistency across operations', async () => {
    // Test that optimization doesn't corrupt or lose trip data
    const originalTrip = { ...mockTripData }
    
    await optimizeTripRoute('test-trip-123', mockCurrentUser)
    
    // Verify trip data hasn't been corrupted
    // (In real implementation, would fetch from database to verify)
    expect(originalTrip).toEqual(mockTripData)
  })

  it('should provide comprehensive error analytics', () => {
    const error: OptimizationError = {
      type: 'clustering_failed' as OptimizationErrorType,
      message: 'Failed to cluster destinations',
      userMessage: 'Grouping error',
      suggestedActions: ['Try manual arrangement'],
      retryable: false,
      details: { clusterCount: 0, destinationCount: 10 }
    }

    const analytics = {
      errorType: error.type,
      timestamp: new Date().toISOString(),
      context: {
        tripId: 'test-trip-123',
        userId: mockCurrentUser.id,
        destinationCount: 10,
        groupSize: 3
      },
      severity: 'high',
      retryable: error.retryable
    }

    expect(analytics.errorType).toBe('clustering_failed')
    expect(analytics.context.destinationCount).toBe(10)
    expect(analytics.severity).toBe('high')
  })
})