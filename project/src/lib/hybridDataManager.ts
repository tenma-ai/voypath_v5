/**
 * Hybrid Data Management System
 * Handles data storage with multiple fallback layers for scalability
 */

import { SessionManager, ScalableSession } from './sessionManager'

export interface PlaceData {
  id?: string
  trip_id: string
  name: string
  category: string
  address: string
  latitude: number | null
  longitude: number | null
  google_place_id?: string
  google_rating?: number
  google_review_count?: number
  google_metadata?: Record<string, any>
  wish_level: number
  stay_duration_minutes: number
  visit_date?: string
  notes?: string
  created_at?: string
  updated_at?: string
  session_id?: string
  device_fingerprint?: string
  user_id?: string
}

export interface DataOperation {
  layer: 'primary' | 'cache' | 'local' | 'sync_queue'
  status: 'success' | 'error' | 'pending'
  data?: any
  error?: string
}

export class HybridDataManager {
  private static readonly STORAGE_KEY = 'voypath_places'
  private static readonly SYNC_QUEUE_KEY = 'voypath_sync_queue'

  /**
   * Save place data with hybrid storage strategy
   */
  static async savePlaceData(
    placeData: PlaceData, 
    session: ScalableSession
  ): Promise<{ operations: DataOperation[]; success: boolean; place: PlaceData }> {
    const operations: DataOperation[] = []
    
    // Prepare data with session information
    const enrichedData: PlaceData = {
      ...placeData,
      session_id: session.sessionId,
      device_fingerprint: session.deviceFingerprint,
      user_id: session.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Generate ID if not provided
    if (!enrichedData.id) {
      enrichedData.id = `place_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    try {
      // Strategy 1: Try primary storage (Supabase database)
      const primaryResult = await this.saveToPrimaryStorage(enrichedData, session)
      operations.push({ 
        layer: 'primary', 
        status: 'success', 
        data: primaryResult 
      })

      // Strategy 2: Update cache if primary succeeds
      try {
        await this.updateCache(session.sessionId, enrichedData)
        operations.push({ layer: 'cache', status: 'success' })
      } catch (cacheError) {
        operations.push({ 
          layer: 'cache', 
          status: 'error', 
          error: String(cacheError) 
        })
      }

      return { operations, success: true, place: primaryResult }

    } catch (primaryError) {
      // Warning: 'Primary storage failed, using fallback strategy:', primaryError)
      
      // Strategy 3: Fallback to local storage
      try {
        const localResult = await this.saveToLocalStorage(enrichedData)
        operations.push({ 
          layer: 'local', 
          status: 'success', 
          data: localResult 
        })

        // Strategy 4: Add to sync queue for later synchronization
        await this.addToSyncQueue(enrichedData, session)
        operations.push({ layer: 'sync_queue', status: 'pending' })

        return { operations, success: true, place: localResult }

      } catch (localError) {
        operations.push({ 
          layer: 'local', 
          status: 'error', 
          error: String(localError) 
        })
        
        throw new Error(`All storage strategies failed: ${primaryError}, ${localError}`)
      }
    }
  }

  /**
   * Get place data with hybrid retrieval strategy
   */
  static async getPlaceData(session: ScalableSession): Promise<PlaceData[]> {
    try {
      // Strategy 1: Try cache first for best performance
      const cached = await this.getCachedData(session.sessionId)
      if (cached && cached.length > 0) {
        return cached
      }

      // Strategy 2: Try primary storage
      const primaryData = await this.getFromPrimaryStorage(session)
      if (primaryData && primaryData.length > 0) {
        // Update cache for next time
        await this.setCachedData(session.sessionId, primaryData)
        return primaryData
      }

    } catch (error) {
      // Warning: 'Primary/cache retrieval failed, using local storage:', error)
    }

    // Strategy 3: Fallback to local storage
    return await this.getFromLocalStorage(session.sessionId)
  }

  /**
   * Synchronize local data with server when connection is available
   */
  static async syncPendingData(session: ScalableSession): Promise<void> {
    const syncQueue = this.getSyncQueue()
    if (syncQueue.length === 0) return

    const syncedItems: string[] = []

    for (const item of syncQueue) {
      try {
        await this.saveToPrimaryStorage(item.data, session)
        syncedItems.push(item.id)
        // Item synced
      } catch (error) {
        // Warning: 'Failed to sync item:', item.id, error)
        // Keep in queue for next sync attempt
      }
    }

    // Remove successfully synced items from queue
    if (syncedItems.length > 0) {
      const remainingQueue = syncQueue.filter(item => !syncedItems.includes(item.id))
      this.setSyncQueue(remainingQueue)
    }
  }

  /**
   * Save to primary storage (Supabase database)
   */
  private static async saveToPrimaryStorage(
    data: PlaceData, 
    session: ScalableSession
  ): Promise<PlaceData> {
    const { supabase } = await import('./supabase')

    // Choose table based on session type
    const tableName = session.isGuest ? 'guest_places' : 'places'
    
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return result
  }

  /**
   * Get from primary storage
   */
  private static async getFromPrimaryStorage(session: ScalableSession): Promise<PlaceData[]> {
    const { supabase } = await import('./supabase')

    const tableName = session.isGuest ? 'guest_places' : 'places'
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('session_id', session.sessionId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data || []
  }

  /**
   * Cache management
   */
  private static async updateCache(sessionId: string, data: PlaceData): Promise<void> {
    // In a production environment, this would use Redis
    // For now, we'll use a simple in-memory cache with localStorage backup
    const existing = await this.getCachedData(sessionId) || []
    const updated = [data, ...existing.filter(item => item.id !== data.id)]
    await this.setCachedData(sessionId, updated)
  }

  private static async getCachedData(sessionId: string): Promise<PlaceData[] | null> {
    try {
      const cached = localStorage.getItem(`cache_places_${sessionId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Check if cache is fresh (less than 1 hour old)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
          return parsed.data
        }
      }
    } catch (error) {
      // Warning: 'Cache retrieval failed:', error)
    }
    return null
  }

  private static async setCachedData(sessionId: string, data: PlaceData[]): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(`cache_places_${sessionId}`, JSON.stringify(cacheData))
    } catch (error) {
      // Warning: 'Cache storage failed:', error)
    }
  }

  /**
   * Local storage management
   */
  private static async saveToLocalStorage(data: PlaceData): Promise<PlaceData> {
    const existing = await this.getFromLocalStorage(data.session_id || '')
    const updated = [data, ...existing.filter(item => item.id !== data.id)]
    
    const storageData = {
      places: updated,
      lastUpdated: new Date().toISOString()
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData))
    return data
  }

  private static async getFromLocalStorage(sessionId: string): Promise<PlaceData[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.places?.filter((place: PlaceData) => 
          place.session_id === sessionId
        ) || []
      }
    } catch (error) {
      // Warning: 'Local storage retrieval failed:', error)
    }
    return []
  }

  /**
   * Sync queue management
   */
  private static async addToSyncQueue(data: PlaceData, session: ScalableSession): Promise<void> {
    const queue = this.getSyncQueue()
    const queueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data,
      session: session.sessionId,
      timestamp: Date.now(),
      retries: 0
    }
    
    queue.push(queueItem)
    this.setSyncQueue(queue)
  }

  private static getSyncQueue(): any[] {
    try {
      const stored = localStorage.getItem(this.SYNC_QUEUE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      // Warning: 'Sync queue retrieval failed:', error)
      return []
    }
  }

  private static setSyncQueue(queue: any[]): void {
    try {
      localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue))
    } catch (error) {
      // Warning: 'Sync queue storage failed:', error)
    }
  }

  /**
   * Migrate guest data to user account
   */
  static async migrateGuestDataToUser(
    guestSessionId: string, 
    newUserId: string
  ): Promise<{ success: boolean; migratedCount: number }> {
    try {
      const { supabase } = await import('./supabase')

      // Get all guest data
      const { data: guestPlaces, error: fetchError } = await supabase
        .from('guest_places')
        .select('*')
        .eq('session_id', guestSessionId)

      if (fetchError) throw fetchError

      if (!guestPlaces || guestPlaces.length === 0) {
        return { success: true, migratedCount: 0 }
      }

      // Migrate data to user tables
      const migratedPlaces = guestPlaces.map(place => ({
        ...place,
        id: undefined, // Let database generate new ID
        user_id: newUserId,
        migrated_from_session: guestSessionId,
        migration_completed_at: new Date().toISOString()
      }))

      const { error: insertError } = await supabase
        .from('places')
        .insert(migratedPlaces)

      if (insertError) throw insertError

      // Mark guest data as migrated
      const { error: updateError } = await supabase
        .from('guest_places')
        .update({
          migrated_to_user_id: newUserId,
          migration_completed_at: new Date().toISOString()
        })
        .eq('session_id', guestSessionId)

      if (updateError) throw updateError

      // Clear local cache
      localStorage.removeItem(`cache_places_${guestSessionId}`)

      return { success: true, migratedCount: guestPlaces.length }

    } catch (error) {
      // Error: 'Migration failed:', error)
      return { success: false, migratedCount: 0 }
    }
  }

  /**
   * Clean up old guest data
   */
  static async cleanupOldGuestData(olderThanDays: number = 90): Promise<void> {
    try {
      const { supabase } = await import('./supabase')
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

      await supabase
        .from('guest_places')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .is('migrated_to_user_id', null)

    } catch (error) {
      // Error: 'Cleanup failed:', error)
    }
  }
}