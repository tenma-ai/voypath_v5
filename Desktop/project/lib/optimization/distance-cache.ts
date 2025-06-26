// Distance cache implementation for performance optimization

import type { Location } from './types'
import type { DistanceCache as IDistanceCache } from './normalization-types'

/**
 * Simple in-memory distance cache
 * Caches calculated distances between locations to avoid redundant calculations
 */
export class DistanceCache implements IDistanceCache {
  private cache: Map<string, number> = new Map()
  
  /**
   * Generate a unique key for a location pair
   * Always generates the same key regardless of order
   */
  private generateKey(from: Location, to: Location): string {
    // Sort IDs to ensure consistent key regardless of order
    const ids = [from.id, to.id].sort()
    return `${ids[0]}-${ids[1]}`
  }
  
  /**
   * Get cached distance between two locations
   */
  get(from: Location, to: Location): number | undefined {
    const key = this.generateKey(from, to)
    return this.cache.get(key)
  }
  
  /**
   * Cache distance between two locations
   */
  set(from: Location, to: Location, distance: number): void {
    const key = this.generateKey(from, to)
    this.cache.set(key, distance)
  }
  
  /**
   * Clear all cached distances
   */
  clear(): void {
    this.cache.clear()
  }
  
  /**
   * Get cache size (for monitoring)
   */
  get size(): number {
    return this.cache.size
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    estimatedMemoryKB: number
  } {
    // Rough estimate: each entry uses ~100 bytes
    const estimatedMemoryKB = (this.cache.size * 100) / 1024
    
    return {
      size: this.cache.size,
      estimatedMemoryKB
    }
  }
}

/**
 * Global distance cache instance
 * Shared across optimization runs for better performance
 */
export const globalDistanceCache = new DistanceCache()

/**
 * Calculate distance with caching
 * Wrapper function that uses the cache automatically
 */
export function calculateCachedDistance(
  from: Location,
  to: Location,
  calculator: (from: Location, to: Location) => number,
  cache: IDistanceCache = globalDistanceCache
): number {
  // Check cache first
  const cached = cache.get(from, to)
  if (cached !== undefined) {
    return cached
  }
  
  // Calculate and cache
  const distance = calculator(from, to)
  cache.set(from, to, distance)
  
  return distance
}