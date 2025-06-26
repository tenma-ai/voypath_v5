// Caching and performance optimization for route data

import type {
  StoredRouteData,
  OptimizedRoute,
  CacheEntry,
  RouteOperationMetrics
} from '@/lib/types/route-storage'
import {
  CacheInvalidationError
} from '@/lib/types/route-storage'

/**
 * Multi-level caching system for route data
 */
export class RouteDataCache {
  private memoryCache = new Map<string, CacheEntry<StoredRouteData>>()
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_MEMORY_ENTRIES = 50
  private readonly LOCAL_STORAGE_PREFIX = 'voypath_route_'
  private readonly LOCAL_STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
  
  // Performance metrics
  private metrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    errors: 0
  }

  /**
   * Get route from cache with fallback strategy
   */
  async getRoute(groupId: string, fetchFromDb: () => Promise<OptimizedRoute | null>): Promise<StoredRouteData | null> {
    const startTime = performance.now()
    let cacheHit = false
    let result: StoredRouteData | null = null

    try {
      // Try memory cache first
      const cached = this.getFromMemoryCache(groupId)
      if (cached) {
        cacheHit = true
        result = cached
        this.metrics.hits++
        return cached
      }

      // Try local storage (for guest users and offline support)
      const localCached = this.getFromLocalStorage(groupId)
      if (localCached) {
        // Update memory cache
        this.setInMemoryCache(groupId, localCached)
        cacheHit = true
        result = localCached
        this.metrics.hits++
        return localCached
      }

      // Fetch from database
      this.metrics.misses++
      const dbResult = await fetchFromDb()
      
      if (dbResult?.route_data) {
        result = dbResult.route_data
        // Store in both caches
        this.setInMemoryCache(groupId, dbResult.route_data, dbResult.version)
        this.saveToLocalStorage(groupId, dbResult.route_data, dbResult.version)
      }

      return result
    } catch (error) {
      this.metrics.errors++
      console.error('Cache error:', error)
      // Fallback to database
      const dbResult = await fetchFromDb()
      return dbResult?.route_data || null
    } finally {
      // Record performance metrics
      this.recordMetrics('get_route', performance.now() - startTime, cacheHit, groupId)
    }
  }

  /**
   * Set route in cache
   */
  setRoute(groupId: string, routeData: StoredRouteData, version: number) {
    try {
      this.setInMemoryCache(groupId, routeData, version)
      this.saveToLocalStorage(groupId, routeData, version)
    } catch (error) {
      console.error('Failed to set cache:', error)
    }
  }

  /**
   * Invalidate cache for a group
   */
  invalidateCache(groupId: string) {
    try {
      this.memoryCache.delete(groupId)
      this.removeFromLocalStorage(groupId)
      this.metrics.invalidations++
    } catch (error) {
      this.metrics.errors++
      throw new CacheInvalidationError(
        `Failed to invalidate cache for group ${groupId}`,
        groupId,
        'all'
      )
    }
  }

  /**
   * Memory cache operations
   */
  private getFromMemoryCache(groupId: string): StoredRouteData | null {
    const entry = this.memoryCache.get(groupId)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expires_at) {
      this.memoryCache.delete(groupId)
      return null
    }

    return entry.data
  }

  private setInMemoryCache(groupId: string, data: StoredRouteData, version: number = 0) {
    // Clean up old entries if cache is full
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      this.cleanupMemoryCache()
    }

    const entry: CacheEntry<StoredRouteData> = {
      data,
      timestamp: Date.now(),
      expires_at: Date.now() + this.CACHE_EXPIRY_MS,
      version,
      group_id: groupId
    }

    this.memoryCache.set(groupId, entry)
  }

  private cleanupMemoryCache() {
    // Remove expired entries first
    const now = Date.now()
    const entries = Array.from(this.memoryCache.entries())
    for (const [key, entry] of entries) {
      if (now > entry.expires_at) {
        this.memoryCache.delete(key)
      }
    }

    // If still too many, remove oldest entries
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      const entries = Array.from(this.memoryCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, this.memoryCache.size - this.MAX_MEMORY_ENTRIES + 10)
      toRemove.forEach(([key]) => this.memoryCache.delete(key))
    }
  }

  /**
   * Local storage operations
   */
  private getFromLocalStorage(groupId: string): StoredRouteData | null {
    try {
      if (typeof window === 'undefined') return null

      const key = this.LOCAL_STORAGE_PREFIX + groupId
      const stored = localStorage.getItem(key)
      
      if (!stored) return null

      const parsed = JSON.parse(stored)
      
      // Check if expired
      if (Date.now() > parsed.expires_at) {
        localStorage.removeItem(key)
        return null
      }

      return parsed.data
    } catch (error) {
      console.error('Error reading from local storage:', error)
      return null
    }
  }

  private saveToLocalStorage(groupId: string, data: StoredRouteData, version: number = 0) {
    try {
      if (typeof window === 'undefined') return

      const key = this.LOCAL_STORAGE_PREFIX + groupId
      const entry = {
        data,
        timestamp: Date.now(),
        expires_at: Date.now() + this.LOCAL_STORAGE_EXPIRY_MS,
        version,
        group_id: groupId
      }

      localStorage.setItem(key, JSON.stringify(entry))
    } catch (error) {
      console.error('Error saving to local storage:', error)
      // Ignore errors (storage quota, private browsing, etc.)
    }
  }

  private removeFromLocalStorage(groupId: string) {
    try {
      if (typeof window === 'undefined') return

      const key = this.LOCAL_STORAGE_PREFIX + groupId
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing from local storage:', error)
    }
  }

  /**
   * Cache validation
   */
  isValidCache(groupId: string): boolean {
    const entry = this.memoryCache.get(groupId)
    return entry ? Date.now() <= entry.expires_at : false
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.metrics,
      memoryEntries: this.memoryCache.size,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0
    }
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.memoryCache.clear()
    
    if (typeof window !== 'undefined') {
      // Clear local storage entries
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.LOCAL_STORAGE_PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    }
  }

  /**
   * Preload routes for better performance
   */
  async preloadRoutes(groupIds: string[], fetchFunction: (groupId: string) => Promise<OptimizedRoute | null>) {
    const promises = groupIds.map(async (groupId) => {
      try {
        if (!this.isValidCache(groupId)) {
          const route = await fetchFunction(groupId)
          if (route?.route_data) {
            this.setRoute(groupId, route.route_data, route.version)
          }
        }
      } catch (error) {
        console.error(`Failed to preload route for group ${groupId}:`, error)
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(
    operation: string,
    duration: number,
    cacheHit: boolean,
    groupId: string,
    success: boolean = true
  ) {
    const metric: RouteOperationMetrics = {
      operation,
      duration_ms: duration,
      rows_affected: 1,
      cache_hit: cacheHit,
      group_id: groupId,
      timestamp: new Date().toISOString(),
      success
    }

    // Log performance metrics (could be sent to analytics service)
    if (duration > 1000) {
      console.warn('Slow cache operation:', metric)
    }
  }
}

/**
 * Batch operations for better performance
 */
export class BatchOperationManager {
  private pendingOperations = new Map<string, Array<() => Promise<any>>>()
  private batchTimeouts = new Map<string, NodeJS.Timeout>()
  private readonly BATCH_DELAY_MS = 100
  private readonly MAX_BATCH_SIZE = 10

  /**
   * Add operation to batch
   */
  addToBatch<T>(
    batchKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedOperation = async () => {
        try {
          const result = await operation()
          resolve(result)
          return result
        } catch (error) {
          reject(error)
          throw error
        }
      }

      // Add to pending operations
      if (!this.pendingOperations.has(batchKey)) {
        this.pendingOperations.set(batchKey, [])
      }
      
      const operations = this.pendingOperations.get(batchKey)!
      operations.push(wrappedOperation)

      // Execute immediately if batch is full
      if (operations.length >= this.MAX_BATCH_SIZE) {
        this.executeBatch(batchKey)
        return
      }

      // Schedule batch execution
      if (!this.batchTimeouts.has(batchKey)) {
        const timeout = setTimeout(() => {
          this.executeBatch(batchKey)
        }, this.BATCH_DELAY_MS)
        
        this.batchTimeouts.set(batchKey, timeout)
      }
    })
  }

  /**
   * Execute batch operations
   */
  private async executeBatch(batchKey: string) {
    const operations = this.pendingOperations.get(batchKey)
    const timeout = this.batchTimeouts.get(batchKey)

    if (timeout) {
      clearTimeout(timeout)
      this.batchTimeouts.delete(batchKey)
    }

    if (!operations || operations.length === 0) {
      return
    }

    // Clear pending operations
    this.pendingOperations.delete(batchKey)

    // Execute all operations in parallel
    try {
      await Promise.all(operations.map(op => op()))
    } catch (error) {
      console.error(`Batch execution failed for ${batchKey}:`, error)
    }
  }

  /**
   * Force execute all pending batches
   */
  async flushAll() {
    const batchKeys = Array.from(this.pendingOperations.keys())
    await Promise.all(batchKeys.map(key => this.executeBatch(key)))
  }
}

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  private queryCache = new Map<string, { result: any; timestamp: number }>()
  private readonly QUERY_CACHE_TTL = 60000 // 1 minute

  /**
   * Cache query results
   */
  async cachedQuery<T>(
    queryKey: string,
    queryFunction: () => Promise<T>,
    ttl: number = this.QUERY_CACHE_TTL
  ): Promise<T> {
    const cached = this.queryCache.get(queryKey)
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result
    }

    const result = await queryFunction()
    this.queryCache.set(queryKey, {
      result,
      timestamp: Date.now()
    })

    return result
  }

  /**
   * Build optimized JSONB queries
   */
  buildJsonbQuery(
    baseQuery: any,
    jsonbColumn: string,
    filters: Record<string, any>
  ) {
    let query = baseQuery

    Object.entries(filters).forEach(([path, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(`${jsonbColumn}->>${path}`, value)
      }
    })

    return query
  }

  /**
   * Clear query cache
   */
  clearQueryCache() {
    this.queryCache.clear()
  }
}

// Export singleton instances
export const routeDataCache = new RouteDataCache()
export const batchOperationManager = new BatchOperationManager()
export const queryOptimizer = new QueryOptimizer()

export default {
  routeDataCache,
  batchOperationManager,
  queryOptimizer
}