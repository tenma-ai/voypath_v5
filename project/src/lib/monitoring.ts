/**
 * Place API Monitoring and Metrics System
 * Implements TODO-089: Place API 監視・メトリクス実装
 * Real-time monitoring, error tracking, and business metrics collection
 */

export interface APIMetrics {
  requestCount: number
  errorCount: number
  averageResponseTime: number
  peakResponseTime: number
  throughput: number // requests per second
  errorRate: number // percentage
  uptime: number // percentage
  timestamp: string
}

export interface ErrorMetric {
  id: string
  type: 'validation' | 'database' | 'network' | 'auth' | 'business' | 'unknown'
  message: string
  endpoint: string
  userId?: string
  tripId?: string
  stackTrace?: string
  requestData?: any
  responseTime: number
  timestamp: string
  resolved: boolean
  occurrenceCount: number
}

export interface UsageMetric {
  endpoint: string
  method: string
  userId?: string
  tripId?: string
  responseTime: number
  statusCode: number
  timestamp: string
  userAgent?: string
  ip?: string
  requestSize: number
  responseSize: number
  features: string[] // Used features in the request
}

export interface BusinessMetric {
  metric: string
  value: number
  metadata: Record<string, any>
  userId?: string
  tripId?: string
  timestamp: string
}

export interface PerformanceMetric {
  endpoint: string
  p50: number // 50th percentile
  p95: number // 95th percentile
  p99: number // 99th percentile
  minTime: number
  maxTime: number
  averageTime: number
  requestCount: number
  timeWindow: string // '1m', '5m', '1h', etc.
  timestamp: string
}

class MetricsCollector {
  private metrics: Map<string, APIMetrics> = new Map()
  private errors: ErrorMetric[] = []
  private usage: UsageMetric[] = []
  private business: BusinessMetric[] = []
  private performance: Map<string, number[]> = new Map() // endpoint -> response times
  private maxHistorySize = 10000
  private retentionPeriod = 24 * 60 * 60 * 1000 // 24 hours

  // Singleton instance
  private static instance: MetricsCollector
  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  /**
   * Record API usage metrics
   */
  recordUsage(metric: Omit<UsageMetric, 'timestamp'>): void {
    const usage: UsageMetric = {
      ...metric,
      timestamp: new Date().toISOString()
    }

    this.usage.push(usage)
    this.recordPerformance(metric.endpoint, metric.responseTime)
    this.updateAPIMetrics(metric.endpoint, metric.responseTime, metric.statusCode >= 400)
    
    // Cleanup old data
    this.cleanupOldData()
  }

  /**
   * Record error metrics
   */
  recordError(error: Omit<ErrorMetric, 'id' | 'timestamp' | 'resolved' | 'occurrenceCount'>): void {
    const errorId = this.generateErrorId(error)
    const existingError = this.errors.find(e => e.id === errorId && !e.resolved)

    if (existingError) {
      existingError.occurrenceCount++
      existingError.timestamp = new Date().toISOString()
    } else {
      const errorMetric: ErrorMetric = {
        id: errorId,
        ...error,
        timestamp: new Date().toISOString(),
        resolved: false,
        occurrenceCount: 1
      }
      this.errors.push(errorMetric)
    }

    this.updateAPIMetrics(error.endpoint, error.responseTime, true)
  }

  /**
   * Record business metrics
   */
  recordBusiness(metric: Omit<BusinessMetric, 'timestamp'>): void {
    const businessMetric: BusinessMetric = {
      ...metric,
      timestamp: new Date().toISOString()
    }
    this.business.push(businessMetric)
  }

  /**
   * Get current API metrics for an endpoint
   */
  getAPIMetrics(endpoint?: string): APIMetrics | APIMetrics[] {
    if (endpoint) {
      return this.metrics.get(endpoint) || this.createEmptyMetrics(endpoint)
    }
    return Array.from(this.metrics.values())
  }

  /**
   * Get error metrics with filtering
   */
  getErrorMetrics(options: {
    type?: ErrorMetric['type']
    endpoint?: string
    resolved?: boolean
    limit?: number
    since?: string
  } = {}): ErrorMetric[] {
    let filtered = this.errors

    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type)
    }
    if (options.endpoint) {
      filtered = filtered.filter(e => e.endpoint === options.endpoint)
    }
    if (options.resolved !== undefined) {
      filtered = filtered.filter(e => e.resolved === options.resolved)
    }
    if (options.since) {
      const sinceDate = new Date(options.since)
      filtered = filtered.filter(e => new Date(e.timestamp) >= sinceDate)
    }

    // Sort by timestamp (newest first) and limit
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    if (options.limit) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered
  }

  /**
   * Get usage metrics with aggregation
   */
  getUsageMetrics(options: {
    endpoint?: string
    userId?: string
    tripId?: string
    since?: string
    groupBy?: 'endpoint' | 'user' | 'trip' | 'hour' | 'day'
    limit?: number
  } = {}): any {
    let filtered = this.usage

    if (options.endpoint) {
      filtered = filtered.filter(u => u.endpoint === options.endpoint)
    }
    if (options.userId) {
      filtered = filtered.filter(u => u.userId === options.userId)
    }
    if (options.tripId) {
      filtered = filtered.filter(u => u.tripId === options.tripId)
    }
    if (options.since) {
      const sinceDate = new Date(options.since)
      filtered = filtered.filter(u => new Date(u.timestamp) >= sinceDate)
    }

    if (options.groupBy) {
      return this.aggregateUsageMetrics(filtered, options.groupBy)
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit) // Get latest N records
    }

    return filtered
  }

  /**
   * Get performance metrics for endpoints
   */
  getPerformanceMetrics(endpoint?: string): PerformanceMetric | PerformanceMetric[] {
    if (endpoint) {
      const times = this.performance.get(endpoint) || []
      return this.calculatePerformanceMetric(endpoint, times)
    }

    const allMetrics: PerformanceMetric[] = []
    for (const [ep, times] of this.performance.entries()) {
      allMetrics.push(this.calculatePerformanceMetric(ep, times))
    }
    return allMetrics
  }

  /**
   * Get business metrics with aggregation
   */
  getBusinessMetrics(options: {
    metric?: string
    userId?: string
    tripId?: string
    since?: string
    groupBy?: 'metric' | 'user' | 'trip' | 'hour' | 'day'
  } = {}): BusinessMetric[] | any {
    let filtered = this.business

    if (options.metric) {
      filtered = filtered.filter(b => b.metric === options.metric)
    }
    if (options.userId) {
      filtered = filtered.filter(b => b.userId === options.userId)
    }
    if (options.tripId) {
      filtered = filtered.filter(b => b.tripId === options.tripId)
    }
    if (options.since) {
      const sinceDate = new Date(options.since)
      filtered = filtered.filter(b => new Date(b.timestamp) >= sinceDate)
    }

    if (options.groupBy) {
      return this.aggregateBusinessMetrics(filtered, options.groupBy)
    }

    return filtered
  }

  /**
   * Get real-time dashboard data
   */
  getDashboardData(): {
    overview: {
      totalRequests: number
      totalErrors: number
      errorRate: number
      averageResponseTime: number
      activeUsers: number
      uptime: number
    }
    recentErrors: ErrorMetric[]
    topEndpoints: Array<{ endpoint: string; requests: number; avgTime: number }>
    performanceAlerts: Array<{ endpoint: string; issue: string; severity: 'low' | 'medium' | 'high' }>
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recentUsage = this.getUsageMetrics({ since: oneHourAgo }) as UsageMetric[]
    const recentErrors = this.getErrorMetrics({ since: oneHourAgo, limit: 10 })

    const totalRequests = recentUsage.length
    const totalErrors = recentUsage.filter(u => u.statusCode >= 400).length
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    const averageResponseTime = recentUsage.length > 0 
      ? recentUsage.reduce((sum, u) => sum + u.responseTime, 0) / recentUsage.length 
      : 0

    const activeUsers = new Set(recentUsage.map(u => u.userId).filter(Boolean)).size

    // Calculate endpoint statistics
    const endpointStats = this.aggregateUsageMetrics(recentUsage, 'endpoint')
    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        requests: stats.count,
        avgTime: stats.averageResponseTime
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5)

    // Performance alerts
    const performanceAlerts = this.generatePerformanceAlerts()

    return {
      overview: {
        totalRequests,
        totalErrors,
        errorRate: Math.round(errorRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        activeUsers,
        uptime: this.calculateUptime()
      },
      recentErrors,
      topEndpoints,
      performanceAlerts
    }
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      return true
    }
    return false
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics.clear()
    this.errors.length = 0
    this.usage.length = 0
    this.business.length = 0
    this.performance.clear()
  }

  // Private methods

  private updateAPIMetrics(endpoint: string, responseTime: number, isError: boolean): void {
    const existing = this.metrics.get(endpoint) || this.createEmptyMetrics(endpoint)
    
    existing.requestCount++
    if (isError) existing.errorCount++
    
    // Update response time statistics
    const totalTime = existing.averageResponseTime * (existing.requestCount - 1) + responseTime
    existing.averageResponseTime = totalTime / existing.requestCount
    existing.peakResponseTime = Math.max(existing.peakResponseTime, responseTime)
    
    // Calculate error rate
    existing.errorRate = (existing.errorCount / existing.requestCount) * 100
    
    existing.timestamp = new Date().toISOString()
    
    this.metrics.set(endpoint, existing)
  }

  private recordPerformance(endpoint: string, responseTime: number): void {
    if (!this.performance.has(endpoint)) {
      this.performance.set(endpoint, [])
    }
    
    const times = this.performance.get(endpoint)!
    times.push(responseTime)
    
    // Keep only last 1000 measurements per endpoint
    if (times.length > 1000) {
      times.splice(0, times.length - 1000)
    }
  }

  private createEmptyMetrics(endpoint: string): APIMetrics {
    return {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      peakResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      uptime: 100,
      timestamp: new Date().toISOString()
    }
  }

  private generateErrorId(error: Omit<ErrorMetric, 'id' | 'timestamp' | 'resolved' | 'occurrenceCount'>): string {
    // Create consistent ID based on error characteristics
    const key = `${error.type}-${error.endpoint}-${error.message.substring(0, 100)}`
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
  }

  private calculatePerformanceMetric(endpoint: string, times: number[]): PerformanceMetric {
    if (times.length === 0) {
      return {
        endpoint,
        p50: 0,
        p95: 0,
        p99: 0,
        minTime: 0,
        maxTime: 0,
        averageTime: 0,
        requestCount: 0,
        timeWindow: '1h',
        timestamp: new Date().toISOString()
      }
    }

    const sorted = [...times].sort((a, b) => a - b)
    const len = sorted.length

    return {
      endpoint,
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      averageTime: times.reduce((sum, t) => sum + t, 0) / len,
      requestCount: len,
      timeWindow: '1h',
      timestamp: new Date().toISOString()
    }
  }

  private aggregateUsageMetrics(usage: UsageMetric[], groupBy: string): any {
    const groups: Record<string, any> = {}

    for (const metric of usage) {
      let key: string

      switch (groupBy) {
        case 'endpoint':
          key = metric.endpoint
          break
        case 'user':
          key = metric.userId || 'anonymous'
          break
        case 'trip':
          key = metric.tripId || 'no-trip'
          break
        case 'hour':
          key = new Date(metric.timestamp).toISOString().substring(0, 13)
          break
        case 'day':
          key = new Date(metric.timestamp).toISOString().substring(0, 10)
          break
        default:
          key = 'all'
      }

      if (!groups[key]) {
        groups[key] = {
          count: 0,
          errors: 0,
          totalResponseTime: 0,
          averageResponseTime: 0,
          features: new Set<string>()
        }
      }

      const group = groups[key]
      group.count++
      if (metric.statusCode >= 400) group.errors++
      group.totalResponseTime += metric.responseTime
      group.averageResponseTime = group.totalResponseTime / group.count
      
      metric.features.forEach(feature => group.features.add(feature))
    }

    // Convert Sets to Arrays
    Object.values(groups).forEach((group: any) => {
      group.features = Array.from(group.features)
    })

    return groups
  }

  private aggregateBusinessMetrics(business: BusinessMetric[], groupBy: string): any {
    const groups: Record<string, any> = {}

    for (const metric of business) {
      let key: string

      switch (groupBy) {
        case 'metric':
          key = metric.metric
          break
        case 'user':
          key = metric.userId || 'anonymous'
          break
        case 'trip':
          key = metric.tripId || 'no-trip'
          break
        case 'hour':
          key = new Date(metric.timestamp).toISOString().substring(0, 13)
          break
        case 'day':
          key = new Date(metric.timestamp).toISOString().substring(0, 10)
          break
        default:
          key = 'all'
      }

      if (!groups[key]) {
        groups[key] = {
          count: 0,
          totalValue: 0,
          averageValue: 0,
          minValue: metric.value,
          maxValue: metric.value,
          metrics: []
        }
      }

      const group = groups[key]
      group.count++
      group.totalValue += metric.value
      group.averageValue = group.totalValue / group.count
      group.minValue = Math.min(group.minValue, metric.value)
      group.maxValue = Math.max(group.maxValue, metric.value)
      group.metrics.push(metric.metric)
    }

    return groups
  }

  private generatePerformanceAlerts(): Array<{ endpoint: string; issue: string; severity: 'low' | 'medium' | 'high' }> {
    const alerts: Array<{ endpoint: string; issue: string; severity: 'low' | 'medium' | 'high' }> = []

    for (const [endpoint, times] of this.performance.entries()) {
      if (times.length === 0) continue

      const metrics = this.calculatePerformanceMetric(endpoint, times)
      
      // High response time alert
      if (metrics.averageTime > 1000) {
        alerts.push({
          endpoint,
          issue: `High average response time: ${metrics.averageTime.toFixed(2)}ms`,
          severity: 'high'
        })
      } else if (metrics.averageTime > 500) {
        alerts.push({
          endpoint,
          issue: `Elevated response time: ${metrics.averageTime.toFixed(2)}ms`,
          severity: 'medium'
        })
      }

      // P95 response time alert
      if (metrics.p95 > 2000) {
        alerts.push({
          endpoint,
          issue: `High P95 response time: ${metrics.p95.toFixed(2)}ms`,
          severity: 'medium'
        })
      }
    }

    // Error rate alerts
    for (const [endpoint, apiMetrics] of this.metrics.entries()) {
      if (apiMetrics.errorRate > 10) {
        alerts.push({
          endpoint,
          issue: `High error rate: ${apiMetrics.errorRate.toFixed(2)}%`,
          severity: 'high'
        })
      } else if (apiMetrics.errorRate > 5) {
        alerts.push({
          endpoint,
          issue: `Elevated error rate: ${apiMetrics.errorRate.toFixed(2)}%`,
          severity: 'medium'
        })
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
  }

  private calculateUptime(): number {
    // Simple uptime calculation based on error rates
    const allMetrics = Array.from(this.metrics.values())
    if (allMetrics.length === 0) return 100

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0)
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0)
    
    if (totalRequests === 0) return 100
    
    const successRate = ((totalRequests - totalErrors) / totalRequests) * 100
    return Math.max(0, Math.min(100, successRate))
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.retentionPeriod
    
    // Cleanup usage metrics
    this.usage = this.usage.filter(u => new Date(u.timestamp).getTime() > cutoffTime)
    
    // Cleanup business metrics
    this.business = this.business.filter(b => new Date(b.timestamp).getTime() > cutoffTime)
    
    // Cleanup resolved errors older than retention period
    this.errors = this.errors.filter(e => 
      !e.resolved || new Date(e.timestamp).getTime() > cutoffTime
    )

    // Limit array sizes
    if (this.usage.length > this.maxHistorySize) {
      this.usage = this.usage.slice(-this.maxHistorySize)
    }
    if (this.business.length > this.maxHistorySize) {
      this.business = this.business.slice(-this.maxHistorySize)
    }
    if (this.errors.length > this.maxHistorySize) {
      this.errors = this.errors.slice(-this.maxHistorySize)
    }
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance()

// Middleware function for automatic metrics collection
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  endpoint: string,
  features: string[] = []
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now()
    let statusCode = 200
    let error: any = null

    try {
      const result = await fn(...args)
      return result
    } catch (err) {
      error = err
      statusCode = 500
      throw err
    } finally {
      const responseTime = performance.now() - startTime

      // Record usage metrics
      metricsCollector.recordUsage({
        endpoint,
        method: 'POST', // Most API calls are POST
        responseTime,
        statusCode,
        requestSize: JSON.stringify(args).length,
        responseSize: 0, // Would need actual response size
        features
      })

      // Record error if any
      if (error) {
        metricsCollector.recordError({
          type: error.name === 'ValidationError' ? 'validation' : 
                error.name === 'DatabaseError' ? 'database' :
                error.name === 'AuthError' ? 'auth' : 'unknown',
          message: error.message || 'Unknown error',
          endpoint,
          responseTime,
          stackTrace: error.stack
        })
      }
    }
  }) as T
}