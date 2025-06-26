/**
 * Performance Tracking and Monitoring System for Voypath Optimization
 * 
 * Comprehensive performance monitoring that tracks processing times,
 * resource usage, and quality metrics for optimization operations.
 */

export interface PerformanceMetrics {
  totalProcessingTime: number
  stageTimings: {
    dataPreprocessing: number
    clustering: number
    optimization: number
    routeGeneration: number
    scheduling: number
    databaseStorage: number
  }
  resourceUsage: {
    memoryPeak: number
    cpuTime: number
    databaseQueries: number
    apiCalls: number
  }
  qualityMetrics: {
    fairnessScore: number
    routeEfficiency: number
    userSatisfactionEstimate: number
    solutionCompleteness: number
  }
  metadata: {
    groupId: string
    userId?: string
    sessionId?: string
    timestamp: string
    version: string
  }
}

export interface StageMetrics {
  stageName: keyof PerformanceMetrics['stageTimings']
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  errors?: string[]
  warnings?: string[]
  details?: any
}

export class PerformanceTracker {
  private startTime: number
  private stageStartTime: number = 0
  private currentStage: string | null = null
  private metrics: Partial<PerformanceMetrics> = {}
  private stageHistory: StageMetrics[] = []
  private memoryUsage: number[] = []
  private dbQueryCount = 0
  private apiCallCount = 0

  constructor(
    private groupId: string,
    private userId?: string,
    private sessionId?: string
  ) {
    this.startTime = performance.now()
    this.metrics = {
      stageTimings: {
        dataPreprocessing: 0,
        clustering: 0,
        optimization: 0,
        routeGeneration: 0,
        scheduling: 0,
        databaseStorage: 0
      },
      resourceUsage: {
        memoryPeak: 0,
        cpuTime: 0,
        databaseQueries: 0,
        apiCalls: 0
      },
      qualityMetrics: {
        fairnessScore: 0,
        routeEfficiency: 0,
        userSatisfactionEstimate: 0,
        solutionCompleteness: 0
      },
      metadata: {
        groupId: this.groupId,
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    }
  }

  /**
   * Start tracking a specific optimization stage
   */
  startStage(stageName: keyof PerformanceMetrics['stageTimings']): void {
    // End previous stage if exists
    if (this.currentStage) {
      this.endCurrentStage()
    }

    this.currentStage = stageName
    this.stageStartTime = performance.now()
    
    // Record memory usage at stage start
    this.recordMemoryUsage()
    
    this.stageHistory.push({
      stageName,
      startTime: this.stageStartTime,
      success: false
    })
  }

  /**
   * End the current optimization stage
   */
  endStage(
    stageName: keyof PerformanceMetrics['stageTimings'], 
    success: boolean = true,
    errors?: string[],
    warnings?: string[],
    details?: any
  ): number {
    if (this.currentStage !== stageName) {
      console.warn(`Stage mismatch: expected ${this.currentStage}, got ${stageName}`)
    }

    const duration = performance.now() - this.stageStartTime
    
    if (!this.metrics.stageTimings) {
      this.metrics.stageTimings = {} as any
    }
    
    this.metrics.stageTimings![stageName] = duration

    // Update stage history
    const currentStageRecord = this.stageHistory[this.stageHistory.length - 1]
    if (currentStageRecord && currentStageRecord.stageName === stageName) {
      currentStageRecord.endTime = performance.now()
      currentStageRecord.duration = duration
      currentStageRecord.success = success
      currentStageRecord.errors = errors
      currentStageRecord.warnings = warnings
      currentStageRecord.details = details
    }

    // Record memory usage at stage end
    this.recordMemoryUsage()

    this.currentStage = null
    return duration
  }

  /**
   * End current stage (internal helper)
   */
  private endCurrentStage(): void {
    if (this.currentStage) {
      this.endStage(this.currentStage as any, false, ['Stage interrupted'])
    }
  }

  /**
   * Record database query execution
   */
  recordDatabaseQuery(queryType: string, duration?: number): void {
    this.dbQueryCount++
    if (this.metrics.resourceUsage) {
      this.metrics.resourceUsage.databaseQueries = this.dbQueryCount
    }
  }

  /**
   * Record API call execution
   */
  recordApiCall(apiType: string, duration?: number): void {
    this.apiCallCount++
    if (this.metrics.resourceUsage) {
      this.metrics.resourceUsage.apiCalls = this.apiCallCount
    }
  }

  /**
   * Record quality metrics from optimization result
   */
  recordQualityMetrics(optimizationResult: any): void {
    if (!this.metrics.qualityMetrics) {
      this.metrics.qualityMetrics = {} as any
    }

    // Calculate fairness score
    this.metrics.qualityMetrics!.fairnessScore = 
      optimizationResult?.bestRoute?.fairnessScore || 0

    // Calculate route efficiency
    this.metrics.qualityMetrics!.routeEfficiency = 
      this.calculateRouteEfficiency(optimizationResult?.bestRoute)

    // Estimate user satisfaction
    this.metrics.qualityMetrics!.userSatisfactionEstimate = 
      this.estimateUserSatisfaction(optimizationResult)

    // Calculate solution completeness
    this.metrics.qualityMetrics!.solutionCompleteness = 
      this.calculateSolutionCompleteness(optimizationResult)
  }

  /**
   * Record memory usage at current point
   */
  private recordMemoryUsage(): void {
    // In browser environment, we use performance.memory if available
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memInfo = (performance as any).memory
      const currentMemory = memInfo.usedJSHeapSize || 0
      this.memoryUsage.push(currentMemory)
      
      if (this.metrics.resourceUsage) {
        this.metrics.resourceUsage.memoryPeak = Math.max(
          this.metrics.resourceUsage.memoryPeak,
          currentMemory
        )
      }
    }
  }

  /**
   * Calculate route efficiency metric
   */
  private calculateRouteEfficiency(route: any): number {
    if (!route || !route.destinations || route.destinations.length === 0) {
      return 0
    }

    try {
      const totalDistance = route.totalDistance || 0
      const destinationCount = route.destinations.length
      const idealDistance = this.calculateIdealDistance(route.destinations)
      
      if (idealDistance === 0) return 1
      
      // Efficiency = ideal distance / actual distance (higher is better)
      const efficiency = Math.min(idealDistance / totalDistance, 1)
      return Math.round(efficiency * 100) / 100
    } catch (error) {
      console.warn('Error calculating route efficiency:', error)
      return 0
    }
  }

  /**
   * Calculate ideal minimum distance for route
   */
  private calculateIdealDistance(destinations: any[]): number {
    if (destinations.length < 2) return 0
    
    // Simple minimum spanning tree approximation
    let totalDistance = 0
    for (let i = 1; i < destinations.length; i++) {
      const prev = destinations[i - 1]
      const curr = destinations[i]
      totalDistance += this.calculateDistance(prev, curr)
    }
    
    return totalDistance
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(point1: any, point2: any): number {
    if (!point1?.latitude || !point1?.longitude || !point2?.latitude || !point2?.longitude) {
      return 0
    }

    const R = 6371 // Earth's radius in kilometers
    const dLat = this.deg2rad(point2.latitude - point1.latitude)
    const dLon = this.deg2rad(point2.longitude - point1.longitude)
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(point1.latitude)) * Math.cos(this.deg2rad(point2.latitude)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180)
  }

  /**
   * Estimate user satisfaction based on optimization result
   */
  private estimateUserSatisfaction(optimizationResult: any): number {
    if (!optimizationResult || !optimizationResult.memberSatisfaction) {
      return 0
    }

    try {
      const satisfactionScores = optimizationResult.memberSatisfaction.map(
        (member: any) => member.satisfactionScore || 0
      )
      
      if (satisfactionScores.length === 0) return 0
      
      const averageSatisfaction = satisfactionScores.reduce((sum: number, score: number) => sum + score, 0) / satisfactionScores.length
      return Math.round(averageSatisfaction * 100) / 100
    } catch (error) {
      console.warn('Error estimating user satisfaction:', error)
      return 0
    }
  }

  /**
   * Calculate solution completeness (how many preferences were satisfied)
   */
  private calculateSolutionCompleteness(optimizationResult: any): number {
    if (!optimizationResult || !optimizationResult.bestRoute) {
      return 0
    }

    try {
      const route = optimizationResult.bestRoute
      const totalDestinations = optimizationResult.inputDestinations?.length || 0
      const includedDestinations = route.destinations?.length || 0
      
      if (totalDestinations === 0) return 1
      
      const completeness = includedDestinations / totalDestinations
      return Math.round(completeness * 100) / 100
    } catch (error) {
      console.warn('Error calculating solution completeness:', error)
      return 0
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    // End current stage if still running
    if (this.currentStage) {
      this.endCurrentStage()
    }

    // Calculate total processing time
    this.metrics.totalProcessingTime = performance.now() - this.startTime

    // Update final resource usage
    if (this.metrics.resourceUsage) {
      this.metrics.resourceUsage.cpuTime = this.metrics.totalProcessingTime
      this.metrics.resourceUsage.databaseQueries = this.dbQueryCount
      this.metrics.resourceUsage.apiCalls = this.apiCallCount
    }

    return this.metrics as PerformanceMetrics
  }

  /**
   * Get stage history for detailed analysis
   */
  getStageHistory(): StageMetrics[] {
    return [...this.stageHistory]
  }

  /**
   * Generate performance summary for logging
   */
  getSummary(): string {
    const metrics = this.getMetrics()
    
    return `
Performance Summary:
- Total Time: ${metrics.totalProcessingTime.toFixed(2)}ms
- Stages: ${Object.entries(metrics.stageTimings).map(([stage, time]) => `${stage}=${time.toFixed(2)}ms`).join(', ')}
- Memory Peak: ${(metrics.resourceUsage.memoryPeak / 1024 / 1024).toFixed(2)}MB
- DB Queries: ${metrics.resourceUsage.databaseQueries}
- API Calls: ${metrics.resourceUsage.apiCalls}
- Fairness Score: ${metrics.qualityMetrics.fairnessScore}
- Route Efficiency: ${metrics.qualityMetrics.routeEfficiency}
- User Satisfaction: ${metrics.qualityMetrics.userSatisfactionEstimate}
- Solution Completeness: ${metrics.qualityMetrics.solutionCompleteness}
    `.trim()
  }

  /**
   * Check if performance is within acceptable thresholds
   */
  isPerformanceAcceptable(): boolean {
    const metrics = this.getMetrics()
    
    // Define acceptable thresholds
    const thresholds = {
      maxTotalTime: 5000, // 5 seconds
      maxMemoryMB: 100, // 100MB
      minFairnessScore: 0.6, // 60%
      minRouteEfficiency: 0.7, // 70%
      minSolutionCompleteness: 0.8 // 80%
    }

    const memoryMB = metrics.resourceUsage.memoryPeak / 1024 / 1024
    
    return (
      metrics.totalProcessingTime <= thresholds.maxTotalTime &&
      memoryMB <= thresholds.maxMemoryMB &&
      metrics.qualityMetrics.fairnessScore >= thresholds.minFairnessScore &&
      metrics.qualityMetrics.routeEfficiency >= thresholds.minRouteEfficiency &&
      metrics.qualityMetrics.solutionCompleteness >= thresholds.minSolutionCompleteness
    )
  }
}

/**
 * Global performance tracking utility for monitoring optimization across the app
 */
export class GlobalPerformanceMonitor {
  private static instance: GlobalPerformanceMonitor
  private trackers = new Map<string, PerformanceTracker>()
  private aggregatedMetrics: PerformanceMetrics[] = []

  static getInstance(): GlobalPerformanceMonitor {
    if (!GlobalPerformanceMonitor.instance) {
      GlobalPerformanceMonitor.instance = new GlobalPerformanceMonitor()
    }
    return GlobalPerformanceMonitor.instance
  }

  createTracker(groupId: string, userId?: string, sessionId?: string): PerformanceTracker {
    const trackerId = `${groupId}-${Date.now()}`
    const tracker = new PerformanceTracker(groupId, userId, sessionId)
    this.trackers.set(trackerId, tracker)
    return tracker
  }

  finalizeTracker(tracker: PerformanceTracker): void {
    const metrics = tracker.getMetrics()
    this.aggregatedMetrics.push(metrics)
    
    // Remove tracker from active trackers
    for (const [id, t] of Array.from(this.trackers.entries())) {
      if (t === tracker) {
        this.trackers.delete(id)
        break
      }
    }
  }

  getAggregatedMetrics(): PerformanceMetrics[] {
    return [...this.aggregatedMetrics]
  }

  getAveragePerformance(): Partial<PerformanceMetrics> {
    if (this.aggregatedMetrics.length === 0) return {}
    
    const totals = this.aggregatedMetrics.reduce((acc, metrics) => ({
      totalProcessingTime: acc.totalProcessingTime + metrics.totalProcessingTime,
      fairnessScore: acc.fairnessScore + metrics.qualityMetrics.fairnessScore,
      routeEfficiency: acc.routeEfficiency + metrics.qualityMetrics.routeEfficiency,
      userSatisfaction: acc.userSatisfaction + metrics.qualityMetrics.userSatisfactionEstimate
    }), { totalProcessingTime: 0, fairnessScore: 0, routeEfficiency: 0, userSatisfaction: 0 })

    const count = this.aggregatedMetrics.length
    
    return {
      totalProcessingTime: totals.totalProcessingTime / count,
      qualityMetrics: {
        fairnessScore: totals.fairnessScore / count,
        routeEfficiency: totals.routeEfficiency / count,
        userSatisfactionEstimate: totals.userSatisfaction / count,
        solutionCompleteness: 0
      }
    }
  }
}