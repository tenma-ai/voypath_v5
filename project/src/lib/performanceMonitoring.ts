/**
 * Response Time and Performance Monitoring System
 * Implements TODO-089-3: Response time monitoring - track performance metrics and bottlenecks
 * Advanced performance analysis, bottleneck detection, and optimization recommendations
 */

export interface PerformanceThreshold {
  metric: string
  warning: number
  critical: number
  unit: 'ms' | 'percent' | 'count' | 'bytes'
}

export interface PerformanceAlert {
  id: string
  type: 'response_time' | 'throughput' | 'memory' | 'cpu' | 'database' | 'api'
  severity: 'info' | 'warning' | 'critical'
  message: string
  endpoint?: string
  metric: string
  currentValue: number
  threshold: number
  timestamp: string
  acknowledged: boolean
  resolvedAt?: string
}

export interface BottleneckAnalysis {
  endpoint: string
  type: 'database' | 'network' | 'computation' | 'memory' | 'external_api' | 'unknown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: {
    responseTimeIncrease: number // percentage
    throughputDecrease: number // percentage
    affectedRequests: number
  }
  recommendations: string[]
  confidence: number // 0-1
  detectedAt: string
}

export interface PerformanceProfile {
  endpoint: string
  timeWindow: string
  statistics: {
    mean: number
    median: number
    p95: number
    p99: number
    min: number
    max: number
    standardDeviation: number
  }
  distribution: {
    buckets: Array<{ range: string; count: number; percentage: number }>
  }
  trends: {
    direction: 'improving' | 'stable' | 'degrading'
    changeRate: number // percentage change per hour
    confidence: number
  }
  bottlenecks: BottleneckAnalysis[]
  optimization: {
    potential: number // percentage improvement possible
    recommendations: Array<{
      action: string
      expectedImprovement: number
      effort: 'low' | 'medium' | 'high'
      priority: number
    }>
  }
}

export interface ResourceMetrics {
  timestamp: string
  cpu: {
    usage: number // percentage
    cores: number
    load: number[]
  }
  memory: {
    used: number // bytes
    total: number // bytes
    percentage: number
    heap?: {
      used: number
      total: number
    }
  }
  network: {
    inbound: number // bytes/sec
    outbound: number // bytes/sec
    connections: number
  }
  database: {
    activeConnections: number
    maxConnections: number
    queryTime: number // average ms
    lockTime: number // average ms
  }
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private alerts: PerformanceAlert[] = []
  private resourceHistory: ResourceMetrics[] = []
  private performanceProfiles: Map<string, PerformanceProfile> = new Map()
  
  // Configurable thresholds
  private thresholds: PerformanceThreshold[] = [
    { metric: 'response_time_p95', warning: 1000, critical: 2000, unit: 'ms' },
    { metric: 'response_time_avg', warning: 500, critical: 1000, unit: 'ms' },
    { metric: 'error_rate', warning: 5, critical: 15, unit: 'percent' },
    { metric: 'throughput', warning: 10, critical: 5, unit: 'count' },
    { metric: 'cpu_usage', warning: 70, critical: 90, unit: 'percent' },
    { metric: 'memory_usage', warning: 80, critical: 95, unit: 'percent' },
    { metric: 'db_connections', warning: 80, critical: 95, unit: 'percent' }
  ]

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Analyze performance for a specific endpoint
   */
  analyzeEndpointPerformance(endpoint: string, timeWindow: '1h' | '24h' | '7d' = '1h'): PerformanceProfile {
    const { metricsCollector } = require('./monitoring')
    const windowMs = this.getTimeWindowMs(timeWindow)
    const since = new Date(Date.now() - windowMs).toISOString()
    
    const usage = metricsCollector.getUsageMetrics({ endpoint, since })
    const responseTimes = Array.isArray(usage) 
      ? usage.map(u => u.responseTime)
      : []
    
    if (responseTimes.length === 0) {
      return this.createEmptyProfile(endpoint, timeWindow)
    }
    
    // Calculate statistics
    const statistics = this.calculateStatistics(responseTimes)
    
    // Create distribution buckets
    const distribution = this.createDistribution(responseTimes)
    
    // Analyze trends
    const trends = this.analyzeTrends(endpoint, responseTimes, timeWindow)
    
    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(endpoint, responseTimes, usage)
    
    // Generate optimization recommendations
    const optimization = this.generateOptimizationRecommendations(statistics, bottlenecks)
    
    const profile: PerformanceProfile = {
      endpoint,
      timeWindow,
      statistics,
      distribution,
      trends,
      bottlenecks,
      optimization
    }
    
    this.performanceProfiles.set(endpoint, profile)
    return profile
  }

  /**
   * Monitor system resources
   */
  recordResourceMetrics(metrics: Omit<ResourceMetrics, 'timestamp'>): void {
    const resourceMetrics: ResourceMetrics = {
      ...metrics,
      timestamp: new Date().toISOString()
    }
    
    this.resourceHistory.push(resourceMetrics)
    
    // Keep only last 24 hours of data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    this.resourceHistory = this.resourceHistory.filter(
      m => new Date(m.timestamp).getTime() > cutoff
    )
    
    // Check for resource-based alerts
    this.checkResourceAlerts(resourceMetrics)
  }

  /**
   * Detect performance bottlenecks using ML-like algorithms
   */
  detectBottlenecks(endpoint: string, responseTimes: number[], usage: any[]): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []
    
    if (responseTimes.length < 10) return bottlenecks
    
    // Database bottleneck detection
    const dbBottleneck = this.detectDatabaseBottleneck(responseTimes, usage)
    if (dbBottleneck) bottlenecks.push(dbBottleneck)
    
    // Network bottleneck detection
    const networkBottleneck = this.detectNetworkBottleneck(responseTimes, usage)
    if (networkBottleneck) bottlenecks.push(networkBottleneck)
    
    // Memory bottleneck detection
    const memoryBottleneck = this.detectMemoryBottleneck(responseTimes)
    if (memoryBottleneck) bottlenecks.push(memoryBottleneck)
    
    // External API bottleneck detection
    const apiBottleneck = this.detectExternalAPIBottleneck(endpoint, responseTimes)
    if (apiBottleneck) bottlenecks.push(apiBottleneck)
    
    return bottlenecks
  }

  /**
   * Generate performance alerts
   */
  checkPerformanceAlerts(endpoint: string, metrics: any): PerformanceAlert[] {
    const newAlerts: PerformanceAlert[] = []
    
    for (const threshold of this.thresholds) {
      const value = this.extractMetricValue(metrics, threshold.metric)
      if (value === null) continue
      
      let severity: 'info' | 'warning' | 'critical' | null = null
      
      if (value >= threshold.critical) {
        severity = 'critical'
      } else if (value >= threshold.warning) {
        severity = 'warning'
      }
      
      if (severity) {
        const alert: PerformanceAlert = {
          id: `perf-${threshold.metric}-${endpoint}-${Date.now()}`,
          type: this.getAlertType(threshold.metric),
          severity,
          message: this.generateAlertMessage(threshold.metric, value, threshold),
          endpoint,
          metric: threshold.metric,
          currentValue: value,
          threshold: severity === 'critical' ? threshold.critical : threshold.warning,
          timestamp: new Date().toISOString(),
          acknowledged: false
        }
        
        newAlerts.push(alert)
        this.alerts.push(alert)
      }
    }
    
    return newAlerts
  }

  /**
   * Get comprehensive performance dashboard
   */
  getPerformanceDashboard(): {
    overview: {
      avgResponseTime: number
      p95ResponseTime: number
      throughput: number
      errorRate: number
      systemHealth: 'healthy' | 'warning' | 'critical'
    }
    endpointProfiles: PerformanceProfile[]
    activeAlerts: PerformanceAlert[]
    resourceMetrics: ResourceMetrics[]
    topBottlenecks: BottleneckAnalysis[]
    recommendations: Array<{
      priority: 'high' | 'medium' | 'low'
      category: string
      action: string
      impact: string
    }>
  } {
    const { metricsCollector } = require('./monitoring')
    const dashboardData = metricsCollector.getDashboardData()
    
    // Calculate overview metrics
    const overview = {
      avgResponseTime: dashboardData.overview.averageResponseTime,
      p95ResponseTime: 0, // Would need to calculate from performance metrics
      throughput: this.calculateThroughput(),
      errorRate: dashboardData.overview.errorRate,
      systemHealth: this.calculateSystemHealth()
    }
    
    // Get endpoint profiles
    const endpointProfiles = Array.from(this.performanceProfiles.values())
    
    // Get active alerts
    const activeAlerts = this.alerts.filter(a => !a.acknowledged && !a.resolvedAt)
    
    // Get recent resource metrics
    const recentResourceMetrics = this.resourceHistory.slice(-10)
    
    // Collect top bottlenecks
    const topBottlenecks = endpointProfiles
      .flatMap(p => p.bottlenecks)
      .sort((a, b) => b.confidence * (b.severity === 'critical' ? 4 : b.severity === 'high' ? 3 : b.severity === 'medium' ? 2 : 1) - 
                      a.confidence * (a.severity === 'critical' ? 4 : a.severity === 'high' ? 3 : a.severity === 'medium' ? 2 : 1))
      .slice(0, 5)
    
    // Generate system-wide recommendations
    const recommendations = this.generateSystemRecommendations(endpointProfiles, activeAlerts, topBottlenecks)
    
    return {
      overview,
      endpointProfiles,
      activeAlerts,
      resourceMetrics: recentResourceMetrics,
      topBottlenecks,
      recommendations
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      return true
    }
    return false
  }

  /**
   * Mark an alert as resolved
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolvedAt = new Date().toISOString()
      return true
    }
    return false
  }

  // Private methods

  private calculateStatistics(values: number[]): PerformanceProfile['statistics'] {
    if (values.length === 0) {
      return { mean: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, standardDeviation: 0 }
    }
    
    const sorted = [...values].sort((a, b) => a - b)
    const len = sorted.length
    
    const mean = values.reduce((sum, v) => sum + v, 0) / len
    const median = len % 2 === 0 
      ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
      : sorted[Math.floor(len / 2)]
    
    const p95 = sorted[Math.floor(len * 0.95)]
    const p99 = sorted[Math.floor(len * 0.99)]
    const min = Math.min(...values)
    const max = Math.max(...values)
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / len
    const standardDeviation = Math.sqrt(variance)
    
    return { mean, median, p95, p99, min, max, standardDeviation }
  }

  private createDistribution(values: number[]): PerformanceProfile['distribution'] {
    if (values.length === 0) {
      return { buckets: [] }
    }
    
    const min = Math.min(...values)
    const max = Math.max(...values)
    const bucketCount = Math.min(10, Math.max(5, Math.floor(values.length / 10)))
    const bucketSize = (max - min) / bucketCount
    
    const buckets = []
    for (let i = 0; i < bucketCount; i++) {
      const start = min + i * bucketSize
      const end = i === bucketCount - 1 ? max : start + bucketSize
      const count = values.filter(v => v >= start && v <= end).length
      const percentage = (count / values.length) * 100
      
      buckets.push({
        range: `${Math.round(start)}-${Math.round(end)}ms`,
        count,
        percentage: Math.round(percentage * 100) / 100
      })
    }
    
    return { buckets }
  }

  private analyzeTrends(endpoint: string, responseTimes: number[], timeWindow: string): PerformanceProfile['trends'] {
    if (responseTimes.length < 10) {
      return { direction: 'stable', changeRate: 0, confidence: 0 }
    }
    
    // Simple linear regression to detect trends
    const n = responseTimes.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = responseTimes
    
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const correlation = this.calculateCorrelation(x, y)
    
    const direction = slope > 0.1 ? 'degrading' : slope < -0.1 ? 'improving' : 'stable'
    const changeRate = Math.abs(slope) * 3600 // per hour
    const confidence = Math.abs(correlation)
    
    return { direction, changeRate, confidence }
  }

  private detectDatabaseBottleneck(responseTimes: number[], usage: any[]): BottleneckAnalysis | null {
    // Look for patterns that suggest database issues
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    
    if (avgResponseTime > 1000) {
      // Check if there are patterns suggesting database slowness
      const recentMetrics = this.resourceHistory.slice(-5)
      const avgDbConnections = recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.database.activeConnections, 0) / recentMetrics.length
        : 0
      
      const avgQueryTime = recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.database.queryTime, 0) / recentMetrics.length
        : 0
      
      if (avgQueryTime > 100 || avgDbConnections > 50) {
        return {
          endpoint: usage[0]?.endpoint || 'unknown',
          type: 'database',
          severity: avgQueryTime > 500 ? 'critical' : avgQueryTime > 200 ? 'high' : 'medium',
          description: `Database bottleneck detected: avg query time ${avgQueryTime}ms, ${avgDbConnections} connections`,
          impact: {
            responseTimeIncrease: ((avgResponseTime - 500) / 500) * 100,
            throughputDecrease: 20,
            affectedRequests: responseTimes.length
          },
          recommendations: [
            'Optimize database queries',
            'Add database indexes',
            'Consider connection pooling',
            'Review query execution plans'
          ],
          confidence: 0.8,
          detectedAt: new Date().toISOString()
        }
      }
    }
    
    return null
  }

  private detectNetworkBottleneck(responseTimes: number[], usage: any[]): BottleneckAnalysis | null {
    // Network issues often show high variance in response times
    const variance = this.calculateVariance(responseTimes)
    const stdDev = Math.sqrt(variance)
    const mean = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    
    if (stdDev / mean > 0.5 && mean > 200) {
      return {
        endpoint: usage[0]?.endpoint || 'unknown',
        type: 'network',
        severity: stdDev / mean > 1.0 ? 'high' : 'medium',
        description: `Network bottleneck: high response time variance (σ=${Math.round(stdDev)}ms)`,
        impact: {
          responseTimeIncrease: ((mean - 100) / 100) * 100,
          throughputDecrease: 15,
          affectedRequests: responseTimes.length
        },
        recommendations: [
          'Check network connectivity',
          'Implement request compression',
          'Consider CDN for static assets',
          'Optimize payload sizes'
        ],
        confidence: 0.7,
        detectedAt: new Date().toISOString()
      }
    }
    
    return null
  }

  private detectMemoryBottleneck(responseTimes: number[]): BottleneckAnalysis | null {
    const recentMetrics = this.resourceHistory.slice(-5)
    if (recentMetrics.length === 0) return null
    
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / recentMetrics.length
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    
    if (avgMemoryUsage > 85 && avgResponseTime > 800) {
      return {
        endpoint: 'system',
        type: 'memory',
        severity: avgMemoryUsage > 95 ? 'critical' : 'high',
        description: `Memory bottleneck: ${Math.round(avgMemoryUsage)}% memory usage`,
        impact: {
          responseTimeIncrease: ((avgResponseTime - 300) / 300) * 100,
          throughputDecrease: 25,
          affectedRequests: responseTimes.length
        },
        recommendations: [
          'Increase available memory',
          'Optimize memory usage',
          'Implement garbage collection tuning',
          'Review memory leaks'
        ],
        confidence: 0.9,
        detectedAt: new Date().toISOString()
      }
    }
    
    return null
  }

  private detectExternalAPIBottleneck(endpoint: string, responseTimes: number[]): BottleneckAnalysis | null {
    // Check if this endpoint involves external API calls
    if (endpoint.includes('google') || endpoint.includes('external') || endpoint.includes('api')) {
      const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      
      if (avgResponseTime > 1500) {
        return {
          endpoint,
          type: 'external_api',
          severity: avgResponseTime > 3000 ? 'critical' : avgResponseTime > 2000 ? 'high' : 'medium',
          description: `External API bottleneck: avg response time ${Math.round(avgResponseTime)}ms`,
          impact: {
            responseTimeIncrease: ((avgResponseTime - 500) / 500) * 100,
            throughputDecrease: 30,
            affectedRequests: responseTimes.length
          },
          recommendations: [
            'Implement API response caching',
            'Add request timeouts',
            'Consider API rate limiting',
            'Implement fallback mechanisms'
          ],
          confidence: 0.8,
          detectedAt: new Date().toISOString()
        }
      }
    }
    
    return null
  }

  private generateOptimizationRecommendations(
    statistics: PerformanceProfile['statistics'],
    bottlenecks: BottleneckAnalysis[]
  ): PerformanceProfile['optimization'] {
    const recommendations: Array<{
      action: string
      expectedImprovement: number
      effort: 'low' | 'medium' | 'high'
      priority: number
    }> = []
    
    let potential = 0
    
    // Base recommendations based on statistics
    if (statistics.p95 > 1000) {
      recommendations.push({
        action: 'Implement response caching',
        expectedImprovement: 30,
        effort: 'medium',
        priority: 8
      })
      potential += 30
    }
    
    if (statistics.mean > 500) {
      recommendations.push({
        action: 'Optimize database queries',
        expectedImprovement: 25,
        effort: 'high',
        priority: 7
      })
      potential += 25
    }
    
    // Bottleneck-specific recommendations
    bottlenecks.forEach(bottleneck => {
      const improvement = bottleneck.severity === 'critical' ? 40 : 
                         bottleneck.severity === 'high' ? 30 : 20
      
      bottleneck.recommendations.forEach(rec => {
        recommendations.push({
          action: rec,
          expectedImprovement: improvement,
          effort: bottleneck.type === 'database' ? 'high' : 'medium',
          priority: bottleneck.severity === 'critical' ? 10 : 
                   bottleneck.severity === 'high' ? 8 : 6
        })
      })
      
      potential += improvement
    })
    
    // Sort by priority
    recommendations.sort((a, b) => b.priority - a.priority)
    
    return {
      potential: Math.min(potential, 80), // Cap at 80% improvement
      recommendations: recommendations.slice(0, 5) // Top 5 recommendations
    }
  }

  private calculateThroughput(): number {
    const { metricsCollector } = require('./monitoring')
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const usage = metricsCollector.getUsageMetrics({ since: oneHourAgo })
    
    return Array.isArray(usage) ? usage.length / 60 : 0 // requests per minute
  }

  private calculateSystemHealth(): 'healthy' | 'warning' | 'critical' {
    const activeAlerts = this.alerts.filter(a => !a.acknowledged && !a.resolvedAt)
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical')
    const warningAlerts = activeAlerts.filter(a => a.severity === 'warning')
    
    if (criticalAlerts.length > 0) return 'critical'
    if (warningAlerts.length > 2) return 'warning'
    return 'healthy'
  }

  private generateSystemRecommendations(
    profiles: PerformanceProfile[],
    alerts: PerformanceAlert[],
    bottlenecks: BottleneckAnalysis[]
  ): Array<{
    priority: 'high' | 'medium' | 'low'
    category: string
    action: string
    impact: string
  }> {
    const recommendations = []
    
    // Critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical')
    if (criticalAlerts.length > 0) {
      recommendations.push({
        priority: 'high' as const,
        category: 'Critical Issues',
        action: 'Address critical performance alerts immediately',
        impact: 'Prevents system outages and ensures service availability'
      })
    }
    
    // Database bottlenecks
    const dbBottlenecks = bottlenecks.filter(b => b.type === 'database')
    if (dbBottlenecks.length > 0) {
      recommendations.push({
        priority: 'high' as const,
        category: 'Database Performance',
        action: 'Optimize database queries and connections',
        impact: 'Improves response times by 25-40%'
      })
    }
    
    // High response times
    const slowProfiles = profiles.filter(p => p.statistics.p95 > 1000)
    if (slowProfiles.length > 0) {
      recommendations.push({
        priority: 'medium' as const,
        category: 'Response Time',
        action: 'Implement caching and optimize slow endpoints',
        impact: 'Reduces P95 response times by 20-30%'
      })
    }
    
    return recommendations.slice(0, 5)
  }

  private getTimeWindowMs(timeWindow: string): number {
    switch (timeWindow) {
      case '1h': return 3600000
      case '24h': return 86400000
      case '7d': return 604800000
      default: return 3600000
    }
  }

  private createEmptyProfile(endpoint: string, timeWindow: string): PerformanceProfile {
    return {
      endpoint,
      timeWindow,
      statistics: { mean: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, standardDeviation: 0 },
      distribution: { buckets: [] },
      trends: { direction: 'stable', changeRate: 0, confidence: 0 },
      bottlenecks: [],
      optimization: { potential: 0, recommendations: [] }
    }
  }

  private extractMetricValue(metrics: any, metricName: string): number | null {
    switch (metricName) {
      case 'response_time_p95':
        return metrics.p95 || null
      case 'response_time_avg':
        return metrics.averageResponseTime || null
      case 'error_rate':
        return metrics.errorRate || null
      case 'throughput':
        return metrics.throughput || null
      default:
        return null
    }
  }

  private getAlertType(metric: string): PerformanceAlert['type'] {
    if (metric.includes('response_time')) return 'response_time'
    if (metric.includes('throughput')) return 'throughput'
    if (metric.includes('cpu')) return 'cpu'
    if (metric.includes('memory')) return 'memory'
    if (metric.includes('db')) return 'database'
    return 'api'
  }

  private generateAlertMessage(metric: string, value: number, threshold: PerformanceThreshold): string {
    return `${metric} is ${value}${threshold.unit} (threshold: ${threshold.warning}${threshold.unit})`
  }

  private checkResourceAlerts(metrics: ResourceMetrics): void {
    // CPU usage alert
    if (metrics.cpu.usage > 90) {
      this.alerts.push({
        id: `cpu-alert-${Date.now()}`,
        type: 'cpu',
        severity: 'critical',
        message: `High CPU usage: ${metrics.cpu.usage}%`,
        metric: 'cpu_usage',
        currentValue: metrics.cpu.usage,
        threshold: 90,
        timestamp: metrics.timestamp,
        acknowledged: false
      })
    }
    
    // Memory usage alert
    if (metrics.memory.percentage > 95) {
      this.alerts.push({
        id: `memory-alert-${Date.now()}`,
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${metrics.memory.percentage}%`,
        metric: 'memory_usage',
        currentValue: metrics.memory.percentage,
        threshold: 95,
        timestamp: metrics.timestamp,
        acknowledged: false
      })
    }
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)
    const sumYY = y.reduce((sum, val) => sum + val * val, 0)
    
    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY))
    
    return denominator !== 0 ? numerator / denominator : 0
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

// Middleware for automatic performance monitoring
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now()
    
    try {
      const result = await fn(...args)
      const responseTime = performance.now() - startTime
      
      // Record performance metrics
      const profile = performanceMonitor.analyzeEndpointPerformance(endpoint, '1h')
      const alerts = performanceMonitor.checkPerformanceAlerts(endpoint, {
        averageResponseTime: responseTime,
        p95: profile.statistics.p95,
        errorRate: 0
      })
      
      return result
    } catch (error) {
      const responseTime = performance.now() - startTime
      
      // Record error performance impact
      const alerts = performanceMonitor.checkPerformanceAlerts(endpoint, {
        averageResponseTime: responseTime,
        errorRate: 100
      })
      
      throw error
    }
  }) as T
}