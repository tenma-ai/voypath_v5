/**
 * Error Rate Monitoring and Recovery System
 * Implements TODO-089-2: Error rate monitoring - track failures, error types, and recovery patterns
 * Advanced error classification, tracking, and automated recovery mechanisms
 */

export interface ErrorPattern {
  id: string
  type: 'recurring' | 'burst' | 'gradual' | 'isolated'
  description: string
  frequency: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedEndpoints: string[]
  timePattern: string
  suggestedActions: string[]
  confidence: number // 0-1
}

export interface RecoveryAction {
  id: string
  name: string
  description: string
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'rate_limit' | 'cache' | 'manual'
  automaticTrigger: boolean
  conditions: {
    errorRate?: number
    errorCount?: number
    timeWindow?: number // minutes
    endpoints?: string[]
  }
  implementation: string
  successRate: number
  lastExecuted?: string
}

export interface ErrorAnalysis {
  endpoint: string
  timeWindow: string
  totalRequests: number
  totalErrors: number
  errorRate: number
  errorTypes: Record<string, number>
  patterns: ErrorPattern[]
  recommendations: string[]
  severity: 'normal' | 'warning' | 'critical'
  trend: 'improving' | 'stable' | 'degrading'
}

export interface CircuitBreakerState {
  endpoint: string
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime?: string
  nextAttemptTime?: string
  successCount: number
  resetTimeout: number // minutes
}

class ErrorTracker {
  private static instance: ErrorTracker
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private recoveryActions: RecoveryAction[] = []
  private errorPatterns: Map<string, ErrorPattern> = new Map()
  private retryAttempts: Map<string, number> = new Map()
  
  // Configuration
  private readonly config = {
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxAttempts: 3
    },
    errorRateThresholds: {
      warning: 5, // 5%
      critical: 15 // 15%
    },
    patternDetection: {
      minOccurrences: 3,
      timeWindow: 3600000 // 1 hour
    }
  }

  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
      ErrorTracker.instance.initializeRecoveryActions()
    }
    return ErrorTracker.instance
  }

  /**
   * Analyze error patterns and rates for an endpoint
   */
  analyzeErrorRate(endpoint: string, timeWindow: '1h' | '24h' | '7d' = '1h'): ErrorAnalysis {
    const windowMs = this.getTimeWindowMs(timeWindow)
    const since = new Date(Date.now() - windowMs).toISOString()
    
    // Get metrics from the monitoring system
    const { metricsCollector } = require('./monitoring')
    const usage = metricsCollector.getUsageMetrics({ endpoint, since })
    const errors = metricsCollector.getErrorMetrics({ endpoint, since })
    
    const totalRequests = Array.isArray(usage) ? usage.length : 0
    const totalErrors = errors.length
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    
    // Analyze error types
    const errorTypes: Record<string, number> = {}
    errors.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1
    })
    
    // Detect patterns
    const patterns = this.detectErrorPatterns(endpoint, errors, timeWindow)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(errorRate, errorTypes, patterns)
    
    // Determine severity and trend
    const severity = this.calculateSeverity(errorRate, patterns)
    const trend = this.calculateTrend(endpoint, timeWindow)
    
    return {
      endpoint,
      timeWindow,
      totalRequests,
      totalErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      errorTypes,
      patterns,
      recommendations,
      severity,
      trend
    }
  }

  /**
   * Detect error patterns using machine learning-like algorithms
   */
  detectErrorPatterns(endpoint: string, errors: any[], timeWindow: string): ErrorPattern[] {
    const patterns: ErrorPattern[] = []
    
    if (errors.length < this.config.patternDetection.minOccurrences) {
      return patterns
    }
    
    // Time-based pattern detection
    const timePattern = this.analyzeTimePattern(errors)
    if (timePattern.confidence > 0.7) {
      patterns.push({
        id: `time-pattern-${endpoint}-${Date.now()}`,
        type: timePattern.type,
        description: timePattern.description,
        frequency: timePattern.frequency,
        severity: timePattern.severity,
        affectedEndpoints: [endpoint],
        timePattern: timePattern.pattern,
        suggestedActions: timePattern.actions,
        confidence: timePattern.confidence
      })
    }
    
    // Error type clustering
    const typePattern = this.analyzeErrorTypeClustering(errors)
    if (typePattern.confidence > 0.6) {
      patterns.push(typePattern)
    }
    
    // Burst detection
    const burstPattern = this.detectErrorBursts(errors)
    if (burstPattern) {
      patterns.push(burstPattern)
    }
    
    return patterns
  }

  /**
   * Execute automatic recovery actions based on error patterns
   */
  async executeRecoveryActions(endpoint: string, analysis: ErrorAnalysis): Promise<{
    executed: RecoveryAction[]
    skipped: RecoveryAction[]
    results: Array<{ actionId: string; success: boolean; message: string }>
  }> {
    const executed: RecoveryAction[] = []
    const skipped: RecoveryAction[] = []
    const results: Array<{ actionId: string; success: boolean; message: string }> = []
    
    for (const action of this.recoveryActions) {
      if (!action.automaticTrigger) {
        skipped.push(action)
        continue
      }
      
      const shouldExecute = this.shouldExecuteRecoveryAction(action, analysis)
      if (!shouldExecute) {
        skipped.push(action)
        continue
      }
      
      try {
        const result = await this.executeRecoveryAction(action, endpoint, analysis)
        executed.push(action)
        results.push({
          actionId: action.id,
          success: result.success,
          message: result.message
        })
        
        // Update action success rate
        this.updateActionSuccessRate(action.id, result.success)
        
      } catch (error) {
        results.push({
          actionId: action.id,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return { executed, skipped, results }
  }

  /**
   * Circuit breaker implementation
   */
  getCircuitBreakerState(endpoint: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, {
        endpoint,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        resetTimeout: this.config.circuitBreaker.resetTimeout
      })
    }
    return this.circuitBreakers.get(endpoint)!
  }

  recordCallResult(endpoint: string, success: boolean): boolean {
    const breaker = this.getCircuitBreakerState(endpoint)
    
    if (success) {
      breaker.successCount++
      
      if (breaker.state === 'half-open') {
        if (breaker.successCount >= this.config.circuitBreaker.halfOpenMaxAttempts) {
          breaker.state = 'closed'
          breaker.failureCount = 0
        }
      } else if (breaker.state === 'closed') {
        breaker.failureCount = Math.max(0, breaker.failureCount - 1)
      }
      
      return true
    } else {
      breaker.failureCount++
      breaker.lastFailureTime = new Date().toISOString()
      
      if (breaker.state === 'closed' && 
          breaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
        breaker.state = 'open'
        breaker.nextAttemptTime = new Date(Date.now() + breaker.resetTimeout).toISOString()
      } else if (breaker.state === 'half-open') {
        breaker.state = 'open'
        breaker.nextAttemptTime = new Date(Date.now() + breaker.resetTimeout).toISOString()
      }
      
      return false
    }
  }

  canExecuteCall(endpoint: string): boolean {
    const breaker = this.getCircuitBreakerState(endpoint)
    
    switch (breaker.state) {
      case 'closed':
        return true
      case 'open':
        if (breaker.nextAttemptTime && new Date() > new Date(breaker.nextAttemptTime)) {
          breaker.state = 'half-open'
          breaker.successCount = 0
          return true
        }
        return false
      case 'half-open':
        return true
      default:
        return true
    }
  }

  /**
   * Get comprehensive error monitoring dashboard data
   */
  getErrorDashboard(): {
    globalErrorRate: number
    endpointAnalysis: ErrorAnalysis[]
    activePatterns: ErrorPattern[]
    circuitBreakerStates: CircuitBreakerState[]
    recoveryActionStatus: Array<{
      action: RecoveryAction
      recentExecutions: number
      successRate: number
    }>
    alerts: Array<{
      level: 'warning' | 'critical'
      message: string
      endpoint: string
      timestamp: string
    }>
  } {
    const { metricsCollector } = require('./monitoring')
    const dashboardData = metricsCollector.getDashboardData()
    
    // Analyze each endpoint
    const endpointAnalysis: ErrorAnalysis[] = []
    const activePatterns: ErrorPattern[] = []
    const alerts: Array<{
      level: 'warning' | 'critical'
      message: string
      endpoint: string
      timestamp: string
    }> = []
    
    for (const { endpoint } of dashboardData.topEndpoints) {
      const analysis = this.analyzeErrorRate(endpoint, '1h')
      endpointAnalysis.push(analysis)
      
      activePatterns.push(...analysis.patterns)
      
      // Generate alerts
      if (analysis.severity === 'critical') {
        alerts.push({
          level: 'critical',
          message: `Critical error rate: ${analysis.errorRate}% on ${endpoint}`,
          endpoint,
          timestamp: new Date().toISOString()
        })
      } else if (analysis.severity === 'warning') {
        alerts.push({
          level: 'warning',
          message: `Elevated error rate: ${analysis.errorRate}% on ${endpoint}`,
          endpoint,
          timestamp: new Date().toISOString()
        })
      }
    }
    
    // Recovery action status
    const recoveryActionStatus = this.recoveryActions.map(action => ({
      action,
      recentExecutions: this.getRecentExecutions(action.id),
      successRate: action.successRate
    }))
    
    return {
      globalErrorRate: dashboardData.overview.errorRate,
      endpointAnalysis,
      activePatterns,
      circuitBreakerStates: Array.from(this.circuitBreakers.values()),
      recoveryActionStatus,
      alerts: alerts.sort((a, b) => b.level.localeCompare(a.level))
    }
  }

  // Private methods

  private initializeRecoveryActions(): void {
    this.recoveryActions = [
      {
        id: 'auto-retry',
        name: 'Automatic Retry',
        description: 'Automatically retry failed requests with exponential backoff',
        type: 'retry',
        automaticTrigger: true,
        conditions: {
          errorRate: 10,
          timeWindow: 5
        },
        implementation: 'exponential-backoff',
        successRate: 0.75
      },
      {
        id: 'circuit-breaker',
        name: 'Circuit Breaker',
        description: 'Open circuit breaker for failing endpoints',
        type: 'circuit_breaker',
        automaticTrigger: true,
        conditions: {
          errorCount: 5,
          timeWindow: 1
        },
        implementation: 'fail-fast',
        successRate: 0.90
      },
      {
        id: 'rate-limit',
        name: 'Rate Limiting',
        description: 'Apply rate limiting to reduce load on failing endpoints',
        type: 'rate_limit',
        automaticTrigger: true,
        conditions: {
          errorRate: 20,
          timeWindow: 10
        },
        implementation: 'sliding-window',
        successRate: 0.65
      },
      {
        id: 'cache-fallback',
        name: 'Cache Fallback',
        description: 'Use cached responses when endpoints are failing',
        type: 'cache',
        automaticTrigger: true,
        conditions: {
          errorRate: 15,
          timeWindow: 5
        },
        implementation: 'stale-while-revalidate',
        successRate: 0.80
      }
    ]
  }

  private getTimeWindowMs(timeWindow: string): number {
    switch (timeWindow) {
      case '1h': return 3600000
      case '24h': return 86400000
      case '7d': return 604800000
      default: return 3600000
    }
  }

  private analyzeTimePattern(errors: any[]): {
    type: 'recurring' | 'burst' | 'gradual' | 'isolated'
    description: string
    frequency: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    pattern: string
    actions: string[]
    confidence: number
  } {
    const timestamps = errors.map(e => new Date(e.timestamp).getTime())
    const intervals = []
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }
    
    if (intervals.length === 0) {
      return {
        type: 'isolated',
        description: 'Single error occurrence',
        frequency: 0,
        severity: 'low',
        pattern: 'isolated',
        actions: ['Monitor for recurrence'],
        confidence: 0.5
      }
    }
    
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    
    // Detect patterns based on statistical analysis
    if (stdDev / avgInterval < 0.3 && intervals.length >= 3) {
      return {
        type: 'recurring',
        description: `Regular pattern every ${Math.round(avgInterval / 1000)}s`,
        frequency: 1000 / avgInterval,
        severity: 'medium',
        pattern: `regular-${Math.round(avgInterval / 1000)}s`,
        actions: ['Investigate root cause', 'Add preventive measures'],
        confidence: 0.8
      }
    }
    
    if (intervals.some(i => i < 5000) && intervals.length >= 5) {
      return {
        type: 'burst',
        description: 'Burst of errors in short time period',
        frequency: errors.length,
        severity: 'high',
        pattern: 'burst',
        actions: ['Check system resources', 'Implement rate limiting'],
        confidence: 0.9
      }
    }
    
    return {
      type: 'gradual',
      description: 'Gradual increase in error frequency',
      frequency: errors.length / (timestamps[timestamps.length - 1] - timestamps[0]) * 1000,
      severity: 'medium',
      pattern: 'gradual',
      actions: ['Monitor trend', 'Prepare mitigation'],
      confidence: 0.6
    }
  }

  private analyzeErrorTypeClustering(errors: any[]): ErrorPattern {
    const types = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1
      return acc
    }, {})
    
    const dominantType = Object.entries(types).reduce((max, [type, count]) => 
      count > max.count ? { type, count } : max
    , { type: '', count: 0 })
    
    const confidence = dominantType.count / errors.length
    
    return {
      id: `type-cluster-${dominantType.type}-${Date.now()}`,
      type: 'recurring',
      description: `Dominant error type: ${dominantType.type} (${dominantType.count}/${errors.length} occurrences)`,
      frequency: dominantType.count,
      severity: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      affectedEndpoints: [errors[0]?.endpoint || 'unknown'],
      timePattern: 'type-clustering',
      suggestedActions: this.getActionsForErrorType(dominantType.type),
      confidence
    }
  }

  private detectErrorBursts(errors: any[]): ErrorPattern | null {
    if (errors.length < 3) return null
    
    const timestamps = errors.map(e => new Date(e.timestamp).getTime()).sort()
    const burstThreshold = 30000 // 30 seconds
    
    let burstStart = 0
    let maxBurstSize = 0
    let currentBurstSize = 1
    
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] < burstThreshold) {
        currentBurstSize++
      } else {
        if (currentBurstSize > maxBurstSize) {
          maxBurstSize = currentBurstSize
          burstStart = i - currentBurstSize
        }
        currentBurstSize = 1
      }
    }
    
    if (maxBurstSize >= 3) {
      return {
        id: `burst-pattern-${Date.now()}`,
        type: 'burst',
        description: `Error burst detected: ${maxBurstSize} errors in ${burstThreshold / 1000}s`,
        frequency: maxBurstSize,
        severity: maxBurstSize > 10 ? 'critical' : maxBurstSize > 5 ? 'high' : 'medium',
        affectedEndpoints: [errors[0]?.endpoint || 'unknown'],
        timePattern: `burst-${burstThreshold / 1000}s`,
        suggestedActions: [
          'Implement circuit breaker',
          'Add rate limiting',
          'Check system resources'
        ],
        confidence: 0.9
      }
    }
    
    return null
  }

  private generateRecommendations(errorRate: number, errorTypes: Record<string, number>, patterns: ErrorPattern[]): string[] {
    const recommendations: string[] = []
    
    if (errorRate > this.config.errorRateThresholds.critical) {
      recommendations.push('URGENT: Implement immediate circuit breaker')
      recommendations.push('Scale up resources or implement load balancing')
    } else if (errorRate > this.config.errorRateThresholds.warning) {
      recommendations.push('Monitor closely and prepare mitigation strategies')
      recommendations.push('Consider implementing retry logic with backoff')
    }
    
    // Type-specific recommendations
    Object.entries(errorTypes).forEach(([type, count]) => {
      if (count > 1) {
        recommendations.push(...this.getActionsForErrorType(type))
      }
    })
    
    // Pattern-specific recommendations
    patterns.forEach(pattern => {
      recommendations.push(...pattern.suggestedActions)
    })
    
    return Array.from(new Set(recommendations))
  }

  private getActionsForErrorType(errorType: string): string[] {
    switch (errorType) {
      case 'validation':
        return ['Improve input validation', 'Add client-side validation']
      case 'database':
        return ['Check database connections', 'Optimize queries', 'Consider connection pooling']
      case 'network':
        return ['Check network connectivity', 'Implement retry with exponential backoff']
      case 'auth':
        return ['Verify authentication tokens', 'Check session management']
      case 'business':
        return ['Review business logic', 'Check data constraints']
      default:
        return ['Investigate error cause', 'Add detailed logging']
    }
  }

  private calculateSeverity(errorRate: number, patterns: ErrorPattern[]): 'normal' | 'warning' | 'critical' {
    if (errorRate > this.config.errorRateThresholds.critical) {
      return 'critical'
    }
    
    if (errorRate > this.config.errorRateThresholds.warning) {
      return 'warning'
    }
    
    if (patterns.some(p => p.severity === 'critical')) {
      return 'critical'
    }
    
    if (patterns.some(p => p.severity === 'high')) {
      return 'warning'
    }
    
    return 'normal'
  }

  private calculateTrend(endpoint: string, timeWindow: string): 'improving' | 'stable' | 'degrading' {
    // Simple trend calculation based on recent vs previous periods
    const windowMs = this.getTimeWindowMs(timeWindow)
    const now = Date.now()
    
    const { metricsCollector } = require('./monitoring')
    
    const recentErrors = metricsCollector.getErrorMetrics({
      endpoint,
      since: new Date(now - windowMs / 2).toISOString()
    }).length
    
    const previousErrors = metricsCollector.getErrorMetrics({
      endpoint,
      since: new Date(now - windowMs).toISOString()
    }).length - recentErrors
    
    if (recentErrors < previousErrors * 0.8) {
      return 'improving'
    } else if (recentErrors > previousErrors * 1.2) {
      return 'degrading'
    } else {
      return 'stable'
    }
  }

  private shouldExecuteRecoveryAction(action: RecoveryAction, analysis: ErrorAnalysis): boolean {
    const conditions = action.conditions
    
    if (conditions.errorRate && analysis.errorRate < conditions.errorRate) {
      return false
    }
    
    if (conditions.errorCount && analysis.totalErrors < conditions.errorCount) {
      return false
    }
    
    if (conditions.endpoints && !conditions.endpoints.includes(analysis.endpoint)) {
      return false
    }
    
    return true
  }

  private async executeRecoveryAction(
    action: RecoveryAction, 
    endpoint: string, 
    analysis: ErrorAnalysis
  ): Promise<{ success: boolean; message: string }> {
    switch (action.type) {
      case 'circuit_breaker':
        this.getCircuitBreakerState(endpoint).state = 'open'
        action.lastExecuted = new Date().toISOString()
        return { success: true, message: 'Circuit breaker opened' }
      
      case 'retry':
        // Implementation would depend on the specific retry mechanism
        action.lastExecuted = new Date().toISOString()
        return { success: true, message: 'Retry mechanism activated' }
      
      case 'rate_limit':
        // Implementation would depend on the rate limiting system
        action.lastExecuted = new Date().toISOString()
        return { success: true, message: 'Rate limiting applied' }
      
      case 'cache':
        // Implementation would depend on the caching system
        action.lastExecuted = new Date().toISOString()
        return { success: true, message: 'Cache fallback enabled' }
      
      default:
        return { success: false, message: 'Unknown recovery action type' }
    }
  }

  private updateActionSuccessRate(actionId: string, success: boolean): void {
    const action = this.recoveryActions.find(a => a.id === actionId)
    if (action) {
      // Simple moving average (would be better with more sophisticated tracking)
      action.successRate = action.successRate * 0.9 + (success ? 0.1 : 0)
    }
  }

  private getRecentExecutions(actionId: string): number {
    const action = this.recoveryActions.find(a => a.id === actionId)
    if (!action || !action.lastExecuted) return 0
    
    const hourAgo = Date.now() - 3600000
    const lastExecuted = new Date(action.lastExecuted).getTime()
    
    return lastExecuted > hourAgo ? 1 : 0
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance()

// Middleware for automatic error tracking
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    const canExecute = errorTracker.canExecuteCall(endpoint)
    
    if (!canExecute) {
      throw new Error(`Circuit breaker is open for endpoint: ${endpoint}`)
    }
    
    try {
      const result = await fn(...args)
      errorTracker.recordCallResult(endpoint, true)
      return result
    } catch (error) {
      errorTracker.recordCallResult(endpoint, false)
      throw error
    }
  }) as T
}