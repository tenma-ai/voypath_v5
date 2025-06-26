/**
 * Progress Tracking and User Feedback System for Voypath Optimization
 * 
 * Real-time progress tracking system that provides user feedback during
 * optimization operations using Supabase Realtime for live updates.
 */

import { createClient } from '@supabase/supabase-js'

export interface OptimizationProgress {
  stage: 'preprocessing' | 'clustering' | 'optimizing' | 'generating' | 'scheduling' | 'saving' | 'completed' | 'error'
  progress: number // 0-100
  message: string
  estimatedTimeRemaining?: number
  details?: {
    currentStep?: string
    totalSteps?: number
    currentIteration?: number
    maxIterations?: number
    processingRate?: number
  }
  timestamp: string
}

export interface ProgressReportConfig {
  enableRealtimeUpdates: boolean
  updateIntervalMs: number
  enableProgressEstimation: boolean
  enableDetailedLogging: boolean
}

export class ProgressReporter {
  private groupId: string
  private userId?: string
  private sessionId?: string
  private supabase: any
  private channel: any
  private config: ProgressReportConfig
  private startTime: number
  private stageStartTimes: Map<string, number> = new Map()
  private progressHistory: OptimizationProgress[] = []

  constructor(
    groupId: string,
    supabaseClient: any,
    userId?: string,
    sessionId?: string,
    config: Partial<ProgressReportConfig> = {}
  ) {
    this.groupId = groupId
    this.userId = userId
    this.sessionId = sessionId
    this.supabase = supabaseClient
    this.startTime = Date.now()
    
    this.config = {
      enableRealtimeUpdates: true,
      updateIntervalMs: 500,
      enableProgressEstimation: true,
      enableDetailedLogging: false,
      ...config
    }
    
    this.initializeRealtimeChannel()
  }

  /**
   * Initialize Supabase Realtime channel for progress broadcasting
   */
  private initializeRealtimeChannel(): void {
    if (!this.config.enableRealtimeUpdates) return
    
    try {
      this.channel = this.supabase
        .channel(`optimization-progress-${this.groupId}`)
        .on('broadcast', { event: 'progress-update' }, (payload: any) => {
          // Handle incoming progress updates if needed
          if (this.config.enableDetailedLogging) {
            console.log('Progress broadcast received:', payload)
          }
        })
        .subscribe()
    } catch (error) {
      console.warn('Failed to initialize realtime channel:', error)
      this.config.enableRealtimeUpdates = false
    }
  }

  /**
   * Update optimization progress with automatic broadcasting
   */
  async updateProgress(progress: Partial<OptimizationProgress>): Promise<void> {
    const timestamp = new Date().toISOString()
    
    const fullProgress: OptimizationProgress = {
      stage: progress.stage || 'preprocessing',
      progress: Math.max(0, Math.min(100, progress.progress || 0)),
      message: progress.message || 'Processing...',
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      details: progress.details,
      timestamp
    }
    
    // Add to history
    this.progressHistory.push(fullProgress)
    
    // Log progress if detailed logging is enabled
    if (this.config.enableDetailedLogging) {
      console.log(`Progress [${fullProgress.stage}]: ${fullProgress.progress}% - ${fullProgress.message}`)
    }
    
    // Broadcast to connected clients
    if (this.config.enableRealtimeUpdates && this.channel) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'progress-update',
          payload: {
            groupId: this.groupId,
            userId: this.userId,
            sessionId: this.sessionId,
            progress: fullProgress
          }
        })
      } catch (error) {
        console.warn('Failed to broadcast progress update:', error)
      }
    }
  }

  /**
   * Report stage completion with timing analysis
   */
  async reportStageCompletion(
    stage: OptimizationProgress['stage'],
    success: boolean = true,
    details?: any
  ): Promise<void> {
    const stageStartTime = this.stageStartTimes.get(stage) || Date.now()
    const stageDuration = Date.now() - stageStartTime
    
    const message = success 
      ? `Completed ${stage} in ${(stageDuration / 1000).toFixed(1)}s`
      : `Failed at ${stage} after ${(stageDuration / 1000).toFixed(1)}s`
    
    const progress = this.calculateStageProgress(stage)
    const estimatedTimeRemaining = this.estimateRemainingTime(stage, success)
    
    await this.updateProgress({
      stage: success ? this.getNextStage(stage) : 'error',
      progress,
      message,
      estimatedTimeRemaining,
      details: {
        ...details,
        stageDuration,
        success
      }
    })
  }

  /**
   * Start tracking a new stage
   */
  async startStage(
    stage: OptimizationProgress['stage'],
    message?: string,
    totalSteps?: number
  ): Promise<void> {
    this.stageStartTimes.set(stage, Date.now())
    
    await this.updateProgress({
      stage,
      progress: this.calculateStageProgress(stage),
      message: message || `Starting ${stage}...`,
      details: {
        totalSteps,
        currentStep: "1"
      }
    })
  }

  /**
   * Update progress within a stage
   */
  async updateStageProgress(
    stage: OptimizationProgress['stage'],
    currentStep: number,
    totalSteps: number,
    stepMessage?: string
  ): Promise<void> {
    const stageBaseProgress = this.calculateStageProgress(stage)
    const stageProgressRange = this.getStageProgressRange(stage)
    const stepProgress = (currentStep / totalSteps) * stageProgressRange
    
    await this.updateProgress({
      stage,
      progress: stageBaseProgress + stepProgress,
      message: stepMessage || `${stage}: Step ${currentStep}/${totalSteps}`,
      estimatedTimeRemaining: this.estimateRemainingTime(stage),
      details: {
        currentStep: currentStep.toString(),
        totalSteps
      }
    })
  }

  /**
   * Report optimization iteration progress
   */
  async updateIterationProgress(
    currentIteration: number,
    maxIterations: number,
    currentBestScore?: number,
    message?: string
  ): Promise<void> {
    const stage = 'optimizing'
    const stageBaseProgress = this.calculateStageProgress(stage)
    const stageProgressRange = this.getStageProgressRange(stage)
    const iterationProgress = (currentIteration / maxIterations) * stageProgressRange
    
    const iterationMessage = message || 
      `Optimization: ${currentIteration}/${maxIterations}${currentBestScore ? ` (best: ${currentBestScore.toFixed(3)})` : ''}`
    
    await this.updateProgress({
      stage,
      progress: stageBaseProgress + iterationProgress,
      message: iterationMessage,
      estimatedTimeRemaining: this.estimateRemainingTime(stage),
      details: {
        currentIteration,
        maxIterations,
        processingRate: this.calculateProcessingRate(currentIteration)
      }
    })
  }

  /**
   * Report completion with final summary
   */
  async reportCompletion(
    success: boolean,
    finalMessage?: string,
    resultSummary?: any
  ): Promise<void> {
    const totalTime = Date.now() - this.startTime
    
    await this.updateProgress({
      stage: success ? 'completed' : 'error',
      progress: 100,
      message: finalMessage || (success 
        ? `Optimization completed in ${(totalTime / 1000).toFixed(1)}s`
        : 'Optimization failed'
      ),
      estimatedTimeRemaining: 0,
      details: {}
    })
  }

  /**
   * Report error with context
   */
  async reportError(
    error: Error | string,
    stage?: OptimizationProgress['stage'],
    recoveryOptions?: string[]
  ): Promise<void> {
    const errorMessage = typeof error === 'string' ? error : error.message
    
    await this.updateProgress({
      stage: 'error',
      progress: this.getLastProgress(),
      message: `Error: ${errorMessage}`,
      details: {}
    })
  }

  /**
   * Get current progress state
   */
  getCurrentProgress(): OptimizationProgress | null {
    return this.progressHistory.length > 0 
      ? this.progressHistory[this.progressHistory.length - 1]
      : null
  }

  /**
   * Get progress history
   */
  getProgressHistory(): OptimizationProgress[] {
    return [...this.progressHistory]
  }

  /**
   * Calculate overall progress based on stage
   */
  private calculateStageProgress(stage: OptimizationProgress['stage']): number {
    const stageMap: Record<OptimizationProgress['stage'], number> = {
      preprocessing: 0,
      clustering: 15,
      optimizing: 30,
      generating: 70,
      scheduling: 85,
      saving: 95,
      completed: 100,
      error: this.getLastProgress()
    }
    
    return stageMap[stage] || 0
  }

  /**
   * Get progress range for each stage
   */
  private getStageProgressRange(stage: OptimizationProgress['stage']): number {
    const rangeMap: Record<OptimizationProgress['stage'], number> = {
      preprocessing: 15,
      clustering: 15,
      optimizing: 40,
      generating: 15,
      scheduling: 10,
      saving: 5,
      completed: 0,
      error: 0
    }
    
    return rangeMap[stage] || 0
  }

  /**
   * Get next stage in pipeline
   */
  private getNextStage(currentStage: OptimizationProgress['stage']): OptimizationProgress['stage'] {
    const stageOrder: OptimizationProgress['stage'][] = [
      'preprocessing',
      'clustering', 
      'optimizing',
      'generating',
      'scheduling',
      'saving',
      'completed'
    ]
    
    const currentIndex = stageOrder.indexOf(currentStage)
    return currentIndex >= 0 && currentIndex < stageOrder.length - 1
      ? stageOrder[currentIndex + 1]
      : 'completed'
  }

  /**
   * Estimate remaining processing time
   */
  private estimateRemainingTime(
    currentStage: OptimizationProgress['stage'],
    stageSuccess: boolean = true
  ): number | undefined {
    if (!this.config.enableProgressEstimation) return undefined
    
    const elapsedTime = Date.now() - this.startTime
    const currentProgress = this.calculateStageProgress(currentStage)
    
    if (currentProgress <= 0) return undefined
    
    // Simple linear estimation based on current progress
    const estimatedTotalTime = (elapsedTime / currentProgress) * 100
    const remaining = Math.max(0, estimatedTotalTime - elapsedTime)
    
    // Apply stage-specific adjustments
    const stageMultipliers: Record<OptimizationProgress['stage'], number> = {
      preprocessing: 0.8,  // Usually faster than estimated
      clustering: 1.0,    // Consistent timing
      optimizing: 1.5,    // Can take longer
      generating: 0.9,    // Usually predictable
      scheduling: 1.1,    // Slight overhead
      saving: 0.5,        // Usually very fast
      completed: 0,
      error: 0
    }
    
    const multiplier = stageMultipliers[currentStage] || 1.0
    return Math.round(remaining * multiplier)
  }

  /**
   * Calculate processing rate for iterations
   */
  private calculateProcessingRate(currentIteration: number): number {
    const stage = 'optimizing'
    const stageStartTime = this.stageStartTimes.get(stage)
    
    if (!stageStartTime || currentIteration <= 0) return 0
    
    const elapsedTime = Date.now() - stageStartTime
    return currentIteration / (elapsedTime / 1000) // iterations per second
  }

  /**
   * Get last recorded progress value
   */
  private getLastProgress(): number {
    const lastProgress = this.getCurrentProgress()
    return lastProgress ? lastProgress.progress : 0
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.channel) {
      try {
        await this.supabase.removeChannel(this.channel)
      } catch (error) {
        console.warn('Error cleaning up realtime channel:', error)
      }
    }
  }
}

/**
 * Progress tracking hooks for React components
 */
export function useOptimizationProgress(
  groupId: string,
  supabaseClient: any
): {
  progress: OptimizationProgress | null
  isOptimizing: boolean
  error: string | null
} {
  // This would be implemented as a React hook in a React component file
  // For now, providing the interface structure
  
  return {
    progress: null,
    isOptimizing: false,
    error: null
  }
}

/**
 * Create progress reporter instance
 */
export function createProgressReporter(
  groupId: string,
  supabaseClient: any,
  userId?: string,
  sessionId?: string,
  config?: Partial<ProgressReportConfig>
): ProgressReporter {
  return new ProgressReporter(groupId, supabaseClient, userId, sessionId, config)
}

/**
 * Progress estimation utilities
 */
export class ProgressEstimator {
  private historicalData: Map<string, number[]> = new Map()
  
  /**
   * Record stage completion time for future estimation
   */
  recordStageTime(stage: string, duration: number): void {
    if (!this.historicalData.has(stage)) {
      this.historicalData.set(stage, [])
    }
    
    const times = this.historicalData.get(stage)!
    times.push(duration)
    
    // Keep only last 10 recordings for moving average
    if (times.length > 10) {
      times.shift()
    }
  }
  
  /**
   * Estimate stage duration based on historical data
   */
  estimateStageDuration(stage: string): number | null {
    const times = this.historicalData.get(stage)
    
    if (!times || times.length === 0) {
      return null
    }
    
    // Calculate moving average
    const average = times.reduce((sum, time) => sum + time, 0) / times.length
    return Math.round(average)
  }
  
  /**
   * Get improvement suggestions based on historical performance
   */
  getPerformanceSuggestions(): string[] {
    const suggestions: string[] = []
    
    // Analyze optimization stage performance
    const optimizingTimes = this.historicalData.get('optimizing') || []
    if (optimizingTimes.length > 0) {
      const avgOptimizingTime = optimizingTimes.reduce((sum, time) => sum + time, 0) / optimizingTimes.length
      
      if (avgOptimizingTime > 5000) { // More than 5 seconds
        suggestions.push('Consider reducing the number of destinations for faster optimization')
      }
      
      if (avgOptimizingTime > 10000) { // More than 10 seconds
        suggestions.push('Try using simplified optimization settings for better performance')
      }
    }
    
    return suggestions
  }
}

/**
 * Global progress estimator instance
 */
export const globalProgressEstimator = new ProgressEstimator()

/**
 * Standard progress messages for consistent user experience
 */
export const PROGRESS_MESSAGES = {
  PREPROCESSING_START: 'Gathering trip data and preferences...',
  PREPROCESSING_VALIDATION: 'Validating destinations and coordinates...',
  PREPROCESSING_COMPLETE: 'Data preprocessing completed',
  
  CLUSTERING_START: 'Analyzing destination relationships...',
  CLUSTERING_GROUPING: 'Creating geographical clusters...',
  CLUSTERING_OPTIMIZATION: 'Optimizing cluster arrangements...',
  CLUSTERING_COMPLETE: 'Destination clustering completed',
  
  OPTIMIZING_START: 'Finding optimal route...',
  OPTIMIZING_ITERATION: 'Testing route combinations...',
  OPTIMIZING_FAIRNESS: 'Balancing member preferences...',
  OPTIMIZING_COMPLETE: 'Route optimization completed',
  
  GENERATING_START: 'Creating detailed itinerary...',
  GENERATING_ROUTES: 'Calculating travel routes...',
  GENERATING_TIMING: 'Scheduling activities...',
  GENERATING_COMPLETE: 'Itinerary generation completed',
  
  SCHEDULING_START: 'Creating daily schedules...',
  SCHEDULING_DAYS: 'Organizing multi-day itinerary...',
  SCHEDULING_ACCOMMODATION: 'Finding accommodation options...',
  SCHEDULING_COMPLETE: 'Daily scheduling completed',
  
  SAVING_START: 'Saving optimization results...',
  SAVING_DATABASE: 'Storing itinerary data...',
  SAVING_COMPLETE: 'Results saved successfully',
  
  COMPLETED: 'Optimization completed successfully!',
  ERROR_GENERIC: 'An error occurred during optimization',
  ERROR_TIMEOUT: 'Optimization timed out - using best result found',
  ERROR_NO_SOLUTION: 'No feasible solution found with current constraints'
} as const