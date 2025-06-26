/**
 * Business Metrics Collection System
 * Tracks feature usage, user engagement, and business KPIs
 */

import { supabase } from './supabase'

export interface BusinessMetric {
  id?: string
  user_id?: string
  session_id?: string
  event_type: string
  feature_name: string
  metric_name: string
  metric_value: number
  metadata?: Record<string, any>
  timestamp?: string
  created_at?: string
}

export interface FeatureUsageMetric {
  feature_name: string
  total_usage: number
  unique_users: number
  avg_session_duration: number
  conversion_rate?: number
  last_used: string
}

export interface UserEngagementMetric {
  user_id: string
  session_duration: number
  features_used: string[]
  actions_count: number
  last_active: string
  engagement_score: number
}

export interface BusinessKPI {
  metric_name: string
  current_value: number
  previous_value: number
  change_percentage: number
  trend: 'increasing' | 'decreasing' | 'stable'
  target_value?: number
  achievement_rate?: number
}

class BusinessMetricsService {
  private sessionId: string
  private sessionStartTime: Date
  private featureUsageBuffer: BusinessMetric[] = []

  constructor() {
    this.sessionId = this.generateSessionId()
    this.sessionStartTime = new Date()
    this.initializeSession()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async initializeSession(): Promise<void> {
    try {
      await this.recordMetric({
        event_type: 'session',
        feature_name: 'app',
        metric_name: 'session_start',
        metric_value: 1,
        metadata: {
          session_id: this.sessionId,
          user_agent: navigator.userAgent,
          timestamp: this.sessionStartTime.toISOString()
        }
      })
    } catch (error) {
      console.warn('Failed to initialize business metrics session:', error)
    }
  }

  /**
   * Record a business metric event
   */
  async recordMetric(metric: Omit<BusinessMetric, 'id' | 'timestamp' | 'created_at'>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const metricData: BusinessMetric = {
        ...metric,
        user_id: user?.id,
        session_id: this.sessionId,
        timestamp: new Date().toISOString()
      }

      const { error } = await supabase
        .from('business_metrics')
        .insert(metricData)

      if (error) {
        console.error('Failed to record business metric:', error)
        // Buffer the metric for retry
        this.featureUsageBuffer.push(metricData)
        return false
      }

      return true
    } catch (error) {
      console.error('Error recording business metric:', error)
      return false
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(featureName: string, action: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordMetric({
      event_type: 'feature_usage',
      feature_name: featureName,
      metric_name: action,
      metric_value: 1,
      metadata: {
        ...metadata,
        action_timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Track user engagement events
   */
  async trackEngagement(engagementType: string, value: number, metadata?: Record<string, any>): Promise<void> {
    await this.recordMetric({
      event_type: 'user_engagement',
      feature_name: 'engagement',
      metric_name: engagementType,
      metric_value: value,
      metadata
    })
  }

  /**
   * Track conversion events
   */
  async trackConversion(conversionType: string, value: number, metadata?: Record<string, any>): Promise<void> {
    await this.recordMetric({
      event_type: 'conversion',
      feature_name: 'business',
      metric_name: conversionType,
      metric_value: value,
      metadata: {
        ...metadata,
        conversion_timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Track time spent on feature
   */
  async trackTimeSpent(featureName: string, durationMs: number, metadata?: Record<string, any>): Promise<void> {
    await this.recordMetric({
      event_type: 'time_tracking',
      feature_name: featureName,
      metric_name: 'time_spent',
      metric_value: durationMs,
      metadata: {
        ...metadata,
        duration_seconds: Math.round(durationMs / 1000)
      }
    })
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsageStats(dateRange?: { start: string; end: string }): Promise<FeatureUsageMetric[]> {
    try {
      let query = supabase
        .from('business_metrics')
        .select('feature_name, metric_name, metric_value, user_id, timestamp')
        .eq('event_type', 'feature_usage')

      if (dateRange) {
        query = query
          .gte('timestamp', dateRange.start)
          .lte('timestamp', dateRange.end)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch feature usage stats:', error)
        return []
      }

      // Process data to calculate statistics
      const featureStats = new Map<string, {
        total_usage: number
        unique_users: Set<string>
        last_used: string
      }>()

      data?.forEach(metric => {
        const existing = featureStats.get(metric.feature_name) || {
          total_usage: 0,
          unique_users: new Set(),
          last_used: metric.timestamp
        }

        existing.total_usage += metric.metric_value
        if (metric.user_id) {
          existing.unique_users.add(metric.user_id)
        }
        if (metric.timestamp > existing.last_used) {
          existing.last_used = metric.timestamp
        }

        featureStats.set(metric.feature_name, existing)
      })

      return Array.from(featureStats.entries()).map(([feature_name, stats]) => ({
        feature_name,
        total_usage: stats.total_usage,
        unique_users: stats.unique_users.size,
        avg_session_duration: 0, // Would need additional time tracking data
        last_used: stats.last_used
      }))
    } catch (error) {
      console.error('Error fetching feature usage stats:', error)
      return []
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(userId?: string, dateRange?: { start: string; end: string }): Promise<UserEngagementMetric[]> {
    try {
      let query = supabase
        .from('business_metrics')
        .select('user_id, feature_name, metric_name, metric_value, timestamp')
        .eq('event_type', 'user_engagement')

      if (userId) {
        query = query.eq('user_id', userId)
      }

      if (dateRange) {
        query = query
          .gte('timestamp', dateRange.start)
          .lte('timestamp', dateRange.end)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch user engagement metrics:', error)
        return []
      }

      // Process data to calculate engagement metrics
      const userEngagement = new Map<string, {
        session_duration: number
        features_used: Set<string>
        actions_count: number
        last_active: string
      }>()

      data?.forEach(metric => {
        if (!metric.user_id) return

        const existing = userEngagement.get(metric.user_id) || {
          session_duration: 0,
          features_used: new Set(),
          actions_count: 0,
          last_active: metric.timestamp
        }

        if (metric.metric_name === 'session_duration') {
          existing.session_duration += metric.metric_value
        }
        existing.features_used.add(metric.feature_name)
        existing.actions_count += 1
        if (metric.timestamp > existing.last_active) {
          existing.last_active = metric.timestamp
        }

        userEngagement.set(metric.user_id, existing)
      })

      return Array.from(userEngagement.entries()).map(([user_id, metrics]) => ({
        user_id,
        session_duration: metrics.session_duration,
        features_used: Array.from(metrics.features_used),
        actions_count: metrics.actions_count,
        last_active: metrics.last_active,
        engagement_score: this.calculateEngagementScore(metrics)
      }))
    } catch (error) {
      console.error('Error fetching user engagement metrics:', error)
      return []
    }
  }

  /**
   * Get business KPIs
   */
  async getBusinessKPIs(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<BusinessKPI[]> {
    try {
      const now = new Date()
      const periodStart = new Date(now)
      const previousPeriodStart = new Date(now)

      switch (period) {
        case 'daily':
          periodStart.setDate(now.getDate() - 1)
          previousPeriodStart.setDate(now.getDate() - 2)
          break
        case 'weekly':
          periodStart.setDate(now.getDate() - 7)
          previousPeriodStart.setDate(now.getDate() - 14)
          break
        case 'monthly':
          periodStart.setMonth(now.getMonth() - 1)
          previousPeriodStart.setMonth(now.getMonth() - 2)
          break
      }

      // Fetch current period data
      const { data: currentData } = await supabase
        .from('business_metrics')
        .select('metric_name, metric_value, event_type')
        .gte('timestamp', periodStart.toISOString())
        .lte('timestamp', now.toISOString())

      // Fetch previous period data
      const { data: previousData } = await supabase
        .from('business_metrics')
        .select('metric_name, metric_value, event_type')
        .gte('timestamp', previousPeriodStart.toISOString())
        .lt('timestamp', periodStart.toISOString())

      const currentKPIs = this.aggregateKPIs(currentData || [])
      const previousKPIs = this.aggregateKPIs(previousData || [])

      return this.calculateKPITrends(currentKPIs, previousKPIs)
    } catch (error) {
      console.error('Error fetching business KPIs:', error)
      return []
    }
  }

  /**
   * Track page/component views
   */
  async trackPageView(pageName: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackFeatureUsage('navigation', 'page_view', {
      page_name: pageName,
      ...metadata
    })
  }

  /**
   * Track button clicks
   */
  async trackButtonClick(buttonName: string, location: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackFeatureUsage('interaction', 'button_click', {
      button_name: buttonName,
      location,
      ...metadata
    })
  }

  /**
   * Track form submissions
   */
  async trackFormSubmission(formName: string, success: boolean, metadata?: Record<string, any>): Promise<void> {
    await this.trackFeatureUsage('forms', 'form_submission', {
      form_name: formName,
      success,
      ...metadata
    })
  }

  /**
   * Track search queries
   */
  async trackSearch(query: string, resultsCount: number, metadata?: Record<string, any>): Promise<void> {
    await this.trackFeatureUsage('search', 'search_query', {
      query: query.substring(0, 100), // Limit query length for storage
      results_count: resultsCount,
      ...metadata
    })
  }

  /**
   * End current session and record session metrics
   */
  async endSession(): Promise<void> {
    try {
      const sessionDuration = Date.now() - this.sessionStartTime.getTime()
      
      await this.recordMetric({
        event_type: 'session',
        feature_name: 'app',
        metric_name: 'session_end',
        metric_value: sessionDuration,
        metadata: {
          session_id: this.sessionId,
          duration_ms: sessionDuration,
          duration_minutes: Math.round(sessionDuration / 60000)
        }
      })

      // Flush any buffered metrics
      await this.flushBufferedMetrics()
    } catch (error) {
      console.warn('Failed to end business metrics session:', error)
    }
  }

  /**
   * Flush any buffered metrics
   */
  private async flushBufferedMetrics(): Promise<void> {
    if (this.featureUsageBuffer.length === 0) return

    try {
      const { error } = await supabase
        .from('business_metrics')
        .insert(this.featureUsageBuffer)

      if (!error) {
        this.featureUsageBuffer = []
      }
    } catch (error) {
      console.error('Failed to flush buffered metrics:', error)
    }
  }

  /**
   * Calculate engagement score based on user metrics
   */
  private calculateEngagementScore(metrics: {
    session_duration: number
    features_used: Set<string>
    actions_count: number
  }): number {
    const durationScore = Math.min(metrics.session_duration / (30 * 60 * 1000), 1) * 40 // Max 40 points for 30min session
    const featureScore = Math.min(metrics.features_used.size / 10, 1) * 30 // Max 30 points for 10 features
    const activityScore = Math.min(metrics.actions_count / 50, 1) * 30 // Max 30 points for 50 actions

    return Math.round(durationScore + featureScore + activityScore)
  }

  /**
   * Aggregate raw metrics into KPIs
   */
  private aggregateKPIs(data: BusinessMetric[]): Map<string, number> {
    const kpis = new Map<string, number>()

    data.forEach(metric => {
      const key = `${metric.event_type}_${metric.metric_name}`
      const existing = kpis.get(key) || 0
      kpis.set(key, existing + metric.metric_value)
    })

    return kpis
  }

  /**
   * Calculate KPI trends comparing current vs previous period
   */
  private calculateKPITrends(current: Map<string, number>, previous: Map<string, number>): BusinessKPI[] {
    const kpis: BusinessKPI[] = []

    current.forEach((currentValue, metricName) => {
      const previousValue = previous.get(metricName) || 0
      const changePercentage = previousValue > 0 ? 
        ((currentValue - previousValue) / previousValue) * 100 : 
        currentValue > 0 ? 100 : 0

      const trend: 'increasing' | 'decreasing' | 'stable' = 
        Math.abs(changePercentage) < 5 ? 'stable' :
        changePercentage > 0 ? 'increasing' : 'decreasing'

      kpis.push({
        metric_name: metricName,
        current_value: currentValue,
        previous_value: previousValue,
        change_percentage: Math.round(changePercentage * 100) / 100,
        trend
      })
    })

    return kpis.sort((a, b) => Math.abs(b.change_percentage) - Math.abs(a.change_percentage))
  }
}

// Export singleton instance
export const businessMetrics = new BusinessMetricsService()

// Set up automatic session end on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    businessMetrics.endSession()
  })

  // Flush buffered metrics periodically
  setInterval(() => {
    businessMetrics['flushBufferedMetrics']()
  }, 30000) // Every 30 seconds
}