// Integrated route management service combining all database integration features

import { routeStorageService, validateRouteData } from './route-storage'
import { realtimeSyncService } from './real-time-sync'
import { routeDataCache, batchOperationManager } from './route-cache'
import type {
  StoredRouteData,
  OptimizedRoute,
  OptimizationMetrics,
  RouteUpdateConflict,
  RouteChangeLog,
  ValidationResult
} from '@/lib/types/route-storage'
import type { RealtimeSubscriptionOptions, ActiveUser } from './real-time-sync'

export interface RouteManagerOptions {
  groupId: string
  userId?: string | null
  sessionId?: string | null
  enableRealtime?: boolean
  enableCaching?: boolean
  onRouteUpdate?: (route: OptimizedRoute) => void
  onConflict?: (conflict: RouteUpdateConflict) => void
  onError?: (error: Error) => void
}

export interface RouteUpdateResult {
  success: boolean
  route?: OptimizedRoute
  conflict?: RouteUpdateConflict
  error?: Error
  cached: boolean
  version: number
}

/**
 * Integrated route management service
 * Combines storage, caching, real-time sync, and conflict resolution
 */
export class IntegratedRouteManager {
  private subscriptions = new Map<string, any>()
  private options: RouteManagerOptions

  constructor(options: RouteManagerOptions) {
    this.options = options
    
    if (options.enableRealtime !== false) {
      this.setupRealtimeSync()
    }
  }

  /**
   * Setup real-time synchronization
   */
  private async setupRealtimeSync() {
    try {
      const realtimeOptions: RealtimeSubscriptionOptions = {
        groupId: this.options.groupId,
        userId: this.options.userId,
        sessionId: this.options.sessionId,
        onRouteUpdate: (route) => {
          // Update cache when route is updated via real-time
          if (this.options.enableCaching !== false) {
            routeDataCache.setRoute(this.options.groupId, route.route_data, route.version)
          }
          this.options.onRouteUpdate?.(route)
        },
        onRouteDeleted: (groupId) => {
          // Clear cache when route is deleted
          if (this.options.enableCaching !== false) {
            routeDataCache.invalidateCache(groupId)
          }
        },
        onConflict: this.options.onConflict,
        onError: this.options.onError
      }

      const subscription = await realtimeSyncService.subscribeToRouteUpdates(realtimeOptions)
      this.subscriptions.set(this.options.groupId, subscription)
    } catch (error) {
      console.error('Failed to setup real-time sync:', error)
      this.options.onError?.(error as Error)
    }
  }

  /**
   * Get route with caching and fallback strategies
   */
  async getRoute(): Promise<RouteUpdateResult> {
    try {
      const fetchFromDb = async () => {
        return await routeStorageService.getRoute(this.options.groupId)
      }

      let route: StoredRouteData | null = null
      let cached = false
      let dbRoute: OptimizedRoute | null = null

      if (this.options.enableCaching !== false) {
        route = await routeDataCache.getRoute(this.options.groupId, fetchFromDb)
        cached = route !== null
        
        if (!route) {
          dbRoute = await fetchFromDb()
          route = dbRoute?.route_data || null
        }
      } else {
        dbRoute = await fetchFromDb()
        route = dbRoute?.route_data || null
      }

      if (!route || !dbRoute) {
        return {
          success: false,
          error: new Error('Route not found'),
          cached: false,
          version: 0
        }
      }

      return {
        success: true,
        route: dbRoute,
        cached,
        version: dbRoute.version
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        cached: false,
        version: 0
      }
    }
  }

  /**
   * Save optimization result with full integration
   */
  async saveOptimizationResult(
    routeData: StoredRouteData,
    metrics: OptimizationMetrics
  ): Promise<RouteUpdateResult> {
    try {
      // Use batch operation for better performance
      const route = await batchOperationManager.addToBatch(
        `save-${this.options.groupId}`,
        async () => {
          return await routeStorageService.saveOptimizationResult(
            this.options.groupId,
            routeData,
            metrics,
            this.options.userId,
            this.options.sessionId
          )
        }
      )

      // Update cache
      if (this.options.enableCaching !== false) {
        routeDataCache.setRoute(this.options.groupId, routeData, route.version)
      }

      // Broadcast update
      if (this.options.enableRealtime !== false) {
        await realtimeSyncService.broadcastRouteUpdate(
          this.options.groupId,
          route,
          {
            userId: this.options.userId,
            sessionId: this.options.sessionId,
            changeType: 'optimization'
          }
        )
      }

      return {
        success: true,
        route,
        cached: false,
        version: route.version
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        cached: false,
        version: 0
      }
    }
  }

  /**
   * Update route with conflict detection and resolution
   */
  async updateRoute(
    updates: Partial<StoredRouteData>,
    currentVersion: number,
    changeType: string = 'manual_edit'
  ): Promise<RouteUpdateResult> {
    try {
      const route = await routeStorageService.updateRoute(
        this.options.groupId,
        updates,
        currentVersion,
        this.options.userId,
        this.options.sessionId
      )

      // Update cache
      if (this.options.enableCaching !== false) {
        routeDataCache.setRoute(this.options.groupId, route.route_data, route.version)
      }

      // Broadcast update
      if (this.options.enableRealtime !== false) {
        await realtimeSyncService.broadcastRouteUpdate(
          this.options.groupId,
          route,
          {
            userId: this.options.userId,
            sessionId: this.options.sessionId,
            changeType,
            changedFields: Object.keys(updates)
          }
        )
      }

      return {
        success: true,
        route,
        cached: false,
        version: route.version
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ConflictResolutionRequiredError') {
        const conflict = (error as any).conflict
        
        // Broadcast conflict to other clients
        if (this.options.enableRealtime !== false) {
          await realtimeSyncService.broadcastConflict(this.options.groupId, conflict)
        }

        return {
          success: false,
          conflict,
          cached: false,
          version: conflict.server_version
        }
      }

      return {
        success: false,
        error: error as Error,
        cached: false,
        version: 0
      }
    }
  }

  /**
   * Resolve conflict and update route
   */
  async resolveConflict(
    conflict: RouteUpdateConflict,
    resolution: 'server_wins' | 'client_wins' | 'merge',
    mergedData?: StoredRouteData
  ): Promise<RouteUpdateResult> {
    try {
      let finalData: Partial<StoredRouteData>

      switch (resolution) {
        case 'server_wins':
          // No update needed, just return current server version
          const currentRoute = await this.getRoute()
          return currentRoute

        case 'client_wins':
          finalData = conflict.local_changes
          break

        case 'merge':
          if (!mergedData) {
            throw new Error('Merged data required for merge resolution')
          }
          finalData = mergedData
          break

        default:
          throw new Error('Invalid resolution strategy')
      }

      // Force update with resolved data
      const route = await routeStorageService.updateRoute(
        this.options.groupId,
        finalData,
        conflict.server_version, // Use server version to force update
        this.options.userId,
        this.options.sessionId
      )

      // Update cache
      if (this.options.enableCaching !== false) {
        routeDataCache.setRoute(this.options.groupId, route.route_data, route.version)
      }

      // Broadcast resolution
      if (this.options.enableRealtime !== false) {
        await realtimeSyncService.broadcastRouteUpdate(
          this.options.groupId,
          route,
          {
            userId: this.options.userId,
            sessionId: this.options.sessionId,
            changeType: 'conflict_resolution'
          }
        )
      }

      return {
        success: true,
        route,
        cached: false,
        version: route.version
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        cached: false,
        version: 0
      }
    }
  }

  /**
   * Get route versions for history/rollback
   */
  async getRouteVersions(limit: number = 10) {
    try {
      return await routeStorageService.getRouteVersions(this.options.groupId, limit)
    } catch (error) {
      this.options.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Get route change history
   */
  async getChangeHistory(limit: number = 50) {
    try {
      return await routeStorageService.getRouteChangeHistory(this.options.groupId, limit)
    } catch (error) {
      this.options.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Get active users for collaboration features
   */
  getActiveUsers(): ActiveUser[] {
    return realtimeSyncService.getActiveUsers(this.options.groupId)
  }

  /**
   * Update user's editing status
   */
  async updateEditingStatus(editingInfo?: { destinationId?: string; field?: string }) {
    if (this.options.enableRealtime !== false) {
      await realtimeSyncService.updateEditingStatus(
        this.options.groupId,
        this.options.userId || null,
        this.options.sessionId || null,
        editingInfo
      )
    }
  }

  /**
   * Validate route data before operations
   */
  validateRouteData(routeData: StoredRouteData): ValidationResult {
    return validateRouteData(routeData)
  }

  /**
   * Clear cache for this group
   */
  clearCache() {
    if (this.options.enableCaching !== false) {
      routeDataCache.invalidateCache(this.options.groupId)
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return routeDataCache.getStats()
  }

  /**
   * Get connection status for real-time features
   */
  getConnectionStatus() {
    return {
      isConnected: realtimeSyncService.isConnected(),
      connectionState: realtimeSyncService.getConnectionState()
    }
  }

  /**
   * Force reconnection for real-time features
   */
  async reconnect() {
    if (this.options.enableRealtime !== false) {
      await realtimeSyncService.reconnect()
      await this.setupRealtimeSync()
    }
  }

  /**
   * Cleanup and dispose of resources
   */
  async dispose() {
    try {
      // Unsubscribe from real-time updates
      if (this.options.enableRealtime !== false) {
        await realtimeSyncService.unsubscribe(this.options.groupId)
      }

      // Clear subscriptions
      this.subscriptions.clear()

      // Flush any pending batch operations
      await batchOperationManager.flushAll()
    } catch (error) {
      console.error('Error disposing route manager:', error)
    }
  }

  /**
   * Static factory method to create manager with default options
   */
  static create(
    groupId: string,
    userId?: string | null,
    sessionId?: string | null,
    options?: Partial<RouteManagerOptions>
  ): IntegratedRouteManager {
    return new IntegratedRouteManager({
      groupId,
      userId,
      sessionId,
      enableRealtime: true,
      enableCaching: true,
      ...options
    })
  }

  /**
   * Batch operations for multiple route updates
   */
  static async batchUpdateRoutes(
    updates: Array<{
      groupId: string
      routeData: StoredRouteData
      metrics: OptimizationMetrics
      userId?: string | null
      sessionId?: string | null
    }>
  ): Promise<RouteUpdateResult[]> {
    const results = await Promise.allSettled(
      updates.map(async (update) => {
        const manager = IntegratedRouteManager.create(
          update.groupId,
          update.userId,
          update.sessionId,
          { enableRealtime: false } // Disable real-time for batch operations
        )

        try {
          const result = await manager.saveOptimizationResult(
            update.routeData,
            update.metrics
          )
          await manager.dispose()
          return result
        } catch (error) {
          await manager.dispose()
          return {
            success: false,
            error: error as Error,
            cached: false,
            version: 0
          }
        }
      })
    )

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: new Error('Batch operation failed'),
        cached: false,
        version: 0
      }
    )
  }
}

export default IntegratedRouteManager