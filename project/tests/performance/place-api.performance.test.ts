/**
 * Place API Performance Tests
 * Benchmark response times and throughput for Place management API
 * Implements TODO-088: Place API テスト自動化 - Performance Testing
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
const PERFORMANCE_THRESHOLD_MS = 500 // 500ms threshold
const LOAD_TEST_ITERATIONS = 50
const CONCURRENT_REQUESTS = 10

// Test client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Performance measurement utilities
interface PerformanceMetrics {
  averageTime: number
  minTime: number
  maxTime: number
  totalTime: number
  throughput: number
  successRate: number
}

const measurePerformance = async (
  testFunction: () => Promise<any>,
  iterations: number = 10
): Promise<PerformanceMetrics> => {
  const times: number[] = []
  let successes = 0

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now()
    try {
      await testFunction()
      successes++
    } catch (error) {
      console.warn(`Performance test iteration ${i + 1} failed:`, error)
    }
    const endTime = performance.now()
    times.push(endTime - startTime)
  }

  const totalTime = times.reduce((sum, time) => sum + time, 0)
  const averageTime = totalTime / iterations
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const throughput = (successes / (totalTime / 1000)) // requests per second
  const successRate = (successes / iterations) * 100

  return {
    averageTime,
    minTime,
    maxTime,
    totalTime,
    throughput,
    successRate
  }
}

const measureConcurrentPerformance = async (
  testFunction: () => Promise<any>,
  concurrentRequests: number = 5
): Promise<PerformanceMetrics> => {
  const startTime = performance.now()
  const promises = Array(concurrentRequests).fill(0).map(() => testFunction())
  
  const results = await Promise.allSettled(promises)
  const endTime = performance.now()
  
  const totalTime = endTime - startTime
  const successes = results.filter(result => result.status === 'fulfilled').length
  const successRate = (successes / concurrentRequests) * 100
  const throughput = successes / (totalTime / 1000)

  return {
    averageTime: totalTime / concurrentRequests,
    minTime: totalTime / concurrentRequests,
    maxTime: totalTime / concurrentRequests,
    totalTime,
    throughput,
    successRate
  }
}

// Test data setup
let testTripId: string
let testUserId: string
const testPlaceIds: string[] = []

describe('Place API Performance Tests', () => {
  beforeAll(async () => {
    // Setup test data
    const { data: userData } = await supabase.auth.signInAnonymously()
    testUserId = userData.user?.id || 'test-user'

    // Create test trip
    const { data: tripData } = await supabase
      .from('trips')
      .insert({
        name: 'Performance Test Trip',
        created_by: testUserId,
        departure_location: 'Tokyo Station'
      })
      .select()
      .single()

    testTripId = tripData.id

    // Add user as trip member
    await supabase
      .from('trip_members')
      .insert({
        trip_id: testTripId,
        user_id: testUserId,
        role: 'admin'
      })
  }, 30000)

  afterAll(async () => {
    // Cleanup test data
    if (testPlaceIds.length > 0) {
      await supabase
        .from('places')
        .delete()
        .in('id', testPlaceIds)
    }

    if (testTripId) {
      await supabase
        .from('trips')
        .delete()
        .eq('id', testTripId)
    }
  }, 30000)

  describe('Place Creation Performance', () => {
    it('should create places within performance threshold', async () => {
      const createPlace = async () => {
        const { data } = await supabase
          .from('places')
          .insert({
            trip_id: testTripId,
            name: `Performance Test Place ${Date.now()}`,
            latitude: 35.6762 + Math.random() * 0.01,
            longitude: 139.6503 + Math.random() * 0.01,
            address: 'Tokyo, Japan',
            category: 'restaurant',
            added_by: testUserId
          })
          .select()
          .single()

        if (data) testPlaceIds.push(data.id)
        return data
      }

      const metrics = await measurePerformance(createPlace, 20)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      expect(metrics.successRate).toBeGreaterThan(95)
      expect(metrics.throughput).toBeGreaterThan(1)

      console.log('Place Creation Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`,
        successRate: `${metrics.successRate.toFixed(2)}%`
      })
    }, 60000)

    it('should handle concurrent place creation', async () => {
      const createPlace = async () => {
        const { data } = await supabase
          .from('places')
          .insert({
            trip_id: testTripId,
            name: `Concurrent Test Place ${Date.now()}-${Math.random()}`,
            latitude: 35.6762 + Math.random() * 0.01,
            longitude: 139.6503 + Math.random() * 0.01,
            address: 'Tokyo, Japan',
            category: 'attraction',
            added_by: testUserId
          })
          .select()
          .single()

        if (data) testPlaceIds.push(data.id)
        return data
      }

      const metrics = await measureConcurrentPerformance(createPlace, CONCURRENT_REQUESTS)

      expect(metrics.successRate).toBeGreaterThan(80)
      expect(metrics.totalTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2)

      console.log('Concurrent Place Creation:', {
        totalTime: `${metrics.totalTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`,
        successRate: `${metrics.successRate.toFixed(2)}%`
      })
    }, 30000)
  })

  describe('Place Retrieval Performance', () => {
    it('should retrieve place lists efficiently', async () => {
      const getPlaces = async () => {
        const { data } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', testTripId)
          .limit(50)

        return data
      }

      const metrics = await measurePerformance(getPlaces, 30)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 2)
      expect(metrics.successRate).toBe(100)
      expect(metrics.throughput).toBeGreaterThan(5)

      console.log('Place List Retrieval:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`
      })
    }, 30000)

    it('should handle geographic searches efficiently', async () => {
      const geoSearch = async () => {
        const { data } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', testTripId)
          .gte('latitude', 35.65)
          .lte('latitude', 35.70)
          .gte('longitude', 139.60)
          .lte('longitude', 139.70)

        return data
      }

      const metrics = await measurePerformance(geoSearch, 25)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      expect(metrics.successRate).toBe(100)

      console.log('Geographic Search Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`
      })
    }, 30000)
  })

  describe('Place Update Performance', () => {
    it('should update places efficiently', async () => {
      // Ensure we have places to update
      if (testPlaceIds.length === 0) {
        const { data } = await supabase
          .from('places')
          .insert({
            trip_id: testTripId,
            name: 'Update Test Place',
            latitude: 35.6762,
            longitude: 139.6503,
            address: 'Tokyo, Japan',
            category: 'restaurant',
            added_by: testUserId
          })
          .select()
          .single()

        if (data) testPlaceIds.push(data.id)
      }

      const updatePlace = async () => {
        const placeId = testPlaceIds[0]
        const { data } = await supabase
          .from('places')
          .update({
            name: `Updated Place ${Date.now()}`,
            description: 'Performance test update'
          })
          .eq('id', placeId)
          .select()

        return data
      }

      const metrics = await measurePerformance(updatePlace, 20)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      expect(metrics.successRate).toBeGreaterThan(95)

      console.log('Place Update Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        successRate: `${metrics.successRate.toFixed(2)}%`
      })
    }, 30000)
  })

  describe('Bulk Operations Performance', () => {
    it('should handle bulk place insertion efficiently', async () => {
      const bulkInsert = async () => {
        const places = Array(10).fill(0).map((_, index) => ({
          trip_id: testTripId,
          name: `Bulk Place ${Date.now()}-${index}`,
          latitude: 35.6762 + (index * 0.001),
          longitude: 139.6503 + (index * 0.001),
          address: `Tokyo Location ${index}`,
          category: 'restaurant',
          added_by: testUserId
        }))

        const { data } = await supabase
          .from('places')
          .insert(places)
          .select()

        if (data) {
          testPlaceIds.push(...data.map(place => place.id))
        }
        return data
      }

      const metrics = await measurePerformance(bulkInsert, 5)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2)
      expect(metrics.successRate).toBeGreaterThan(90)

      console.log('Bulk Insert Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        successRate: `${metrics.successRate.toFixed(2)}%`
      })
    }, 30000)

    it('should handle bulk updates efficiently', async () => {
      if (testPlaceIds.length < 5) {
        // Add more test places if needed
        const places = Array(5).fill(0).map((_, index) => ({
          trip_id: testTripId,
          name: `Bulk Update Test ${index}`,
          latitude: 35.6762,
          longitude: 139.6503,
          address: 'Tokyo, Japan',
          category: 'restaurant',
          added_by: testUserId
        }))

        const { data } = await supabase
          .from('places')
          .insert(places)
          .select()

        if (data) {
          testPlaceIds.push(...data.map(place => place.id))
        }
      }

      const bulkUpdate = async () => {
        const updatePromises = testPlaceIds.slice(0, 5).map(placeId =>
          supabase
            .from('places')
            .update({
              description: `Bulk updated at ${Date.now()}`
            })
            .eq('id', placeId)
        )

        return Promise.all(updatePromises)
      }

      const metrics = await measurePerformance(bulkUpdate, 10)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 3)
      expect(metrics.successRate).toBeGreaterThan(90)

      console.log('Bulk Update Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        successRate: `${metrics.successRate.toFixed(2)}%`
      })
    }, 30000)
  })

  describe('Search and Filter Performance', () => {
    it('should handle complex filtering efficiently', async () => {
      const complexFilter = async () => {
        const { data } = await supabase
          .from('places')
          .select(`
            *,
            trips:trip_id(name),
            users:added_by(display_name)
          `)
          .eq('trip_id', testTripId)
          .in('category', ['restaurant', 'attraction', 'shopping'])
          .not('description', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20)

        return data
      }

      const metrics = await measurePerformance(complexFilter, 20)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      expect(metrics.successRate).toBe(100)

      console.log('Complex Filter Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`
      })
    }, 30000)

    it('should handle text search efficiently', async () => {
      const textSearch = async () => {
        const { data } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', testTripId)
          .or('name.ilike.%test%,description.ilike.%test%,address.ilike.%tokyo%')
          .limit(10)

        return data
      }

      const metrics = await measurePerformance(textSearch, 15)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      expect(metrics.successRate).toBe(100)

      console.log('Text Search Performance:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`
      })
    }, 30000)
  })

  describe('Load Testing', () => {
    it('should maintain performance under load', async () => {
      const loadTest = async () => {
        const operations = [
          // Read operations (70% of load)
          ...Array(7).fill(() => supabase.from('places').select('*').eq('trip_id', testTripId).limit(10)),
          // Write operations (30% of load)
          ...Array(3).fill(() => supabase.from('places').insert({
            trip_id: testTripId,
            name: `Load Test ${Date.now()}-${Math.random()}`,
            latitude: 35.6762 + Math.random() * 0.01,
            longitude: 139.6503 + Math.random() * 0.01,
            address: 'Tokyo, Japan',
            category: 'restaurant',
            added_by: testUserId
          }).select().single().then(result => {
            if (result.data) testPlaceIds.push(result.data.id)
            return result
          }))
        ]

        const randomOperation = operations[Math.floor(Math.random() * operations.length)]
        return randomOperation()
      }

      const metrics = await measurePerformance(loadTest, LOAD_TEST_ITERATIONS)

      expect(metrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2)
      expect(metrics.successRate).toBeGreaterThan(85)
      expect(metrics.throughput).toBeGreaterThan(1)

      console.log('Load Test Results:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        throughput: `${metrics.throughput.toFixed(2)} req/s`,
        successRate: `${metrics.successRate.toFixed(2)}%`,
        totalOperations: LOAD_TEST_ITERATIONS
      })
    }, 120000)
  })

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage', async () => {
      const initialMemory = process.memoryUsage()
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await supabase
          .from('places')
          .select('*')
          .eq('trip_id', testTripId)
          .limit(5)
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100

      expect(memoryIncreasePercent).toBeLessThan(50) // Less than 50% increase

      console.log('Memory Usage:', {
        initial: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        final: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`,
        increasePercent: `${memoryIncreasePercent.toFixed(2)}%`
      })
    }, 30000)
  })
})