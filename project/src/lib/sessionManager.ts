/**
 * Scalable Session Management System
 * Handles guest user sessions without relying on Supabase auth
 */

export interface ScalableSession {
  sessionId: string
  deviceFingerprint: string
  createdAt: string
  lastActiveAt: string
  expiresAt: string
  isGuest: boolean
  userId?: string
  metadata?: Record<string, any>
}

export class SessionManager {
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days
  private static readonly STORAGE_KEY = 'voypath_session'

  /**
   * Create a new guest session
   */
  static async createGuestSession(): Promise<ScalableSession> {
    const session: ScalableSession = {
      sessionId: this.generateSessionId(),
      deviceFingerprint: await this.generateDeviceFingerprint(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
      isGuest: true
    }

    // Save session to server if possible, fallback to local storage
    try {
      await this.saveSessionToServer(session)
    } catch (error) {
      // Warning: 'Failed to save session to server, using local storage:', error)
    }

    // Always save locally for offline access
    this.saveSessionLocally(session)
    
    return session
  }

  /**
   * Get current session
   */
  static async getCurrentSession(): Promise<ScalableSession | null> {
    try {
      // Try to get session from server first
      const serverSession = await this.getSessionFromServer()
      if (serverSession && !this.isSessionExpired(serverSession)) {
        this.saveSessionLocally(serverSession) // Update local cache
        return serverSession
      }
    } catch (error) {
      // Warning: 'Failed to get session from server, using local storage:', error)
    }

    // Fallback to local storage
    const localSession = this.getSessionFromLocal()
    if (localSession && !this.isSessionExpired(localSession)) {
      return localSession
    }

    return null
  }

  /**
   * Validate and refresh session
   */
  static async validateSession(sessionId?: string): Promise<ScalableSession | null> {
    const session = await this.getCurrentSession()
    if (!session) return null

    if (sessionId && session.sessionId !== sessionId) {
      return null
    }

    // Update last active time
    session.lastActiveAt = new Date().toISOString()
    
    try {
      await this.saveSessionToServer(session)
    } catch (error) {
      // Warning: 'Failed to update session on server:', error)
    }
    
    this.saveSessionLocally(session)
    return session
  }

  /**
   * Clear session (logout)
   */
  static async clearSession(): Promise<void> {
    const session = await this.getCurrentSession()
    if (session) {
      try {
        await this.deleteSessionFromServer(session.sessionId)
      } catch (error) {
        // Warning: 'Failed to delete session from server:', error)
      }
    }

    localStorage.removeItem(this.STORAGE_KEY)
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    if (crypto.randomUUID) {
      return crypto.randomUUID()
    }
    
    // Fallback for older browsers
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Generate device fingerprint for session identification
   */
  private static async generateDeviceFingerprint(): Promise<string> {
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      platform: navigator.platform,
      timestamp: Date.now()
    }

    // Create canvas fingerprint
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('Voypath fingerprint', 2, 2)
        fingerprint.canvas = canvas.toDataURL()
      }
    } catch (error) {
      // Warning: 'Canvas fingerprinting failed:', error)
    }

    const fingerprintString = JSON.stringify(fingerprint)
    
    // Simple hash function for fingerprint
    let hash = 0
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36).slice(0, 16)
  }

  /**
   * Save session to server
   */
  private static async saveSessionToServer(session: ScalableSession): Promise<void> {
    const { supabase } = await import('./supabase')
    
    const { error } = await supabase
      .from('user_sessions')
      .upsert({
        session_id: session.sessionId,
        device_fingerprint: session.deviceFingerprint,
        user_id: session.userId || null,
        is_guest: session.isGuest,
        created_at: session.createdAt,
        last_active_at: session.lastActiveAt,
        expires_at: session.expiresAt,
        metadata: session.metadata || {}
      })

    if (error) {
      throw error
    }
  }

  /**
   * Get session from server
   */
  private static async getSessionFromServer(): Promise<ScalableSession | null> {
    const localSession = this.getSessionFromLocal()
    if (!localSession) return null

    try {
      const { supabase } = await import('./supabase')
      
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', localSession.sessionId)
        .single()

      if (error || !data) return null

      return {
        sessionId: data.session_id,
        deviceFingerprint: data.device_fingerprint,
        createdAt: data.created_at,
        lastActiveAt: data.last_active_at,
        expiresAt: data.expires_at,
        isGuest: data.is_guest,
        userId: data.user_id,
        metadata: data.metadata
      }
    } catch (error) {
      // Warning: 'Failed to fetch session from server:', error)
      return null
    }
  }

  /**
   * Delete session from server
   */
  private static async deleteSessionFromServer(sessionId: string): Promise<void> {
    const { supabase } = await import('./supabase')
    
    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      throw error
    }
  }

  /**
   * Save session to local storage
   */
  private static saveSessionLocally(session: ScalableSession): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session))
    } catch (error) {
      // Warning: 'Failed to save session to local storage:', error)
    }
  }

  /**
   * Get session from local storage
   */
  private static getSessionFromLocal(): ScalableSession | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as ScalableSession
      }
    } catch (error) {
      // Warning: 'Failed to get session from local storage:', error)
    }
    return null
  }

  /**
   * Check if session is expired
   */
  private static isSessionExpired(session: ScalableSession): boolean {
    return new Date(session.expiresAt) <= new Date()
  }

  /**
   * Create user from existing guest session
   */
  static createUserFromSession(session: ScalableSession): any {
    return {
      id: session.userId || session.sessionId,
      name: 'Guest User',
      email: undefined,
      avatar: undefined,
      isGuest: session.isGuest,
      isPremium: false,
      sessionId: session.sessionId,
      deviceFingerprint: session.deviceFingerprint
    }
  }
}