/**
 * Timeout and Resource Management Utilities for Voypath Optimization
 * 
 * Comprehensive timeout management system that handles algorithm timeouts,
 * resource constraints, and graceful degradation under various conditions.
 */

import { OptimizationTimeoutError } from '../types/api-errors'

export interface TimeoutConfig {
  defaultTimeoutMs: number
  maxTimeoutMs: number
  minTimeoutMs: number
  gracePeriodMs: number
  enableGracefulDegradation: boolean
  progressCheckIntervalMs: number
}

export interface ResourceLimits {
  maxMemoryMB: number
  maxCpuTimeMs: number
  maxIterations: number
  maxDestinations: number
  maxGroupMembers: number
}

export interface TimeoutContext {
  operationName: string
  startTime: number
  timeoutMs: number
  progressCallback?: (progress: number) => void
  resourceMonitoring?: boolean
}

/**
 * Advanced timeout manager with resource monitoring and graceful degradation
 */
export class TimeoutManager {
  private activeOperations = new Map<string, TimeoutContext>()
  private resourceMonitor?: ResourceMonitor
  private config: TimeoutConfig

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = {
      defaultTimeoutMs: 5000,
      maxTimeoutMs: 30000,
      minTimeoutMs: 1000,
      gracePeriodMs: 1000,
      enableGracefulDegradation: true,
      progressCheckIntervalMs: 500,
      ...config
    }

    // Initialize resource monitor if available
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      this.resourceMonitor = new ResourceMonitor()
    }
  }

  /**
   * Execute function with comprehensive timeout and resource management
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number,
    context?: Partial<TimeoutContext>
  ): Promise<T> {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const actualTimeout = this.validateTimeout(timeoutMs || this.config.defaultTimeoutMs)
    
    const operationContext: TimeoutContext = {
      operationName: context?.operationName || 'unknown_operation',
      startTime: Date.now(),
      timeoutMs: actualTimeout,
      progressCallback: context?.progressCallback,
      resourceMonitoring: context?.resourceMonitoring ?? true
    }

    this.activeOperations.set(operationId, operationContext)

    try {
      // Start resource monitoring if enabled
      if (this.resourceMonitor && operationContext.resourceMonitoring) {
        this.resourceMonitor.startMonitoring(operationId)
      }

      // Create timeout promise
      const timeoutPromise = this.createTimeoutPromise(operationId, actualTimeout)
      
      // Create progress monitoring promise
      const progressPromise = this.createProgressMonitor(operationId)
      
      // Execute operation with timeout and monitoring
      const result = await Promise.race([
        operation(),
        timeoutPromise,
        progressPromise
      ]) as T

      // Clean up successful operation
      this.cleanupOperation(operationId)
      return result

    } catch (error) {
      // Handle timeout and other errors
      this.cleanupOperation(operationId)
      
      if (error instanceof OptimizationTimeoutError) {
        // Check if we can provide partial results
        if (this.config.enableGracefulDegradation) {
          const partialResult = await this.attemptGracefulDegradation(operationContext, error)
          if (partialResult !== null) {
            return partialResult as T
          }
        }
      }
      
      throw error
    }
  }

  /**
   * Execute with adaptive timeout based on complexity
   */
  async executeWithAdaptiveTimeout<T>(
    operation: () => Promise<T>,
    complexityMetrics: ComplexityMetrics,
    context?: Partial<TimeoutContext>
  ): Promise<T> {
    const adaptiveTimeout = this.calculateAdaptiveTimeout(complexityMetrics)
    return this.executeWithTimeout(operation, adaptiveTimeout, context)
  }

  /**
   * Execute with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseTimeoutMs?: number,
    context?: Partial<TimeoutContext>
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Increase timeout with each retry
        const timeoutMs = (baseTimeoutMs || this.config.defaultTimeoutMs) * Math.pow(1.5, attempt - 1)
        
        return await this.executeWithTimeout(operation, timeoutMs, {
          ...context,
          operationName: `${context?.operationName || 'retry_operation'}_attempt_${attempt}`
        })
        
      } catch (error) {
        lastError = error as Error
        
        // Don't retry certain types of errors
        if (this.isNonRetryableError(error)) {
          throw error
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          await this.sleep(backoffMs)
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed')
  }

  /**
   * Create timeout promise with resource monitoring
   */
  private createTimeoutPromise(operationId: string, timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        const context = this.activeOperations.get(operationId)
        const actualElapsed = context ? Date.now() - context.startTime : timeoutMs
        
        reject(new OptimizationTimeoutError(
          `Operation '${context?.operationName || 'unknown'}' exceeded ${timeoutMs}ms timeout (actual: ${actualElapsed}ms)`,
          timeoutMs
        ))
      }, timeoutMs)

      // Store timeout ID for cleanup
      const context = this.activeOperations.get(operationId)
      if (context) {
        (context as any).timeoutId = timeoutId
      }
    })
  }

  /**
   * Create progress monitoring system
   */
  private createProgressMonitor(operationId: string): Promise<never> {
    return new Promise((_, reject) => {
      const context = this.activeOperations.get(operationId)
      if (!context || !this.resourceMonitor) return

      const monitoringInterval = setInterval(() => {
        const elapsed = Date.now() - context.startTime
        const progress = Math.min(elapsed / context.timeoutMs, 1.0)
        
        // Check resource limits
        if (this.resourceMonitor) {
          const resourceStatus = this.resourceMonitor.checkResourceLimits(operationId)
          
          if (resourceStatus.exceeded) {
            clearInterval(monitoringInterval)
            reject(new Error(`Resource limit exceeded: ${resourceStatus.reason}`))
            return
          }
        }
        
        // Report progress if callback provided
        if (context.progressCallback) {
          context.progressCallback(progress * 100)
        }
        
        // Clean up if operation completed
        if (!this.activeOperations.has(operationId)) {
          clearInterval(monitoringInterval)
        }
        
      }, this.config.progressCheckIntervalMs)

      // Store interval ID for cleanup
      ;(context as any).monitoringInterval = monitoringInterval
    })
  }

  /**
   * Attempt graceful degradation when timeout occurs
   */
  private async attemptGracefulDegradation(
    context: TimeoutContext,
    error: OptimizationTimeoutError
  ): Promise<any> {
    // Check if we're in grace period
    const elapsed = Date.now() - context.startTime
    const gracePeriodEnd = context.timeoutMs + this.config.gracePeriodMs
    
    if (elapsed < gracePeriodEnd) {
      // Allow a brief grace period for cleanup and partial results
      await this.sleep(Math.min(this.config.gracePeriodMs, gracePeriodEnd - elapsed))
      
      // Check if partial results are available (implementation dependent)
      return this.checkForPartialResults(context)
    }
    
    return null
  }

  /**
   * Check for partial results (to be implemented by specific optimization modules)
   */
  private async checkForPartialResults(context: TimeoutContext): Promise<any> {
    // This would be implemented by specific optimization algorithms
    // to return their best current solution when interrupted
    return null
  }

  /**
   * Calculate adaptive timeout based on problem complexity
   */
  private calculateAdaptiveTimeout(metrics: ComplexityMetrics): number {
    let timeoutMs = this.config.defaultTimeoutMs
    
    // Adjust based on number of destinations
    if (metrics.destinationCount > 10) {
      timeoutMs *= 1.5
    }
    if (metrics.destinationCount > 20) {
      timeoutMs *= 2.0
    }
    
    // Adjust based on group size
    if (metrics.groupSize > 5) {
      timeoutMs *= 1.3
    }
    if (metrics.groupSize > 10) {
      timeoutMs *= 1.8
    }
    
    // Adjust based on geographic spread
    if (metrics.geographicSpreadKm > 1000) {
      timeoutMs *= 1.4
    }
    if (metrics.geographicSpreadKm > 5000) {
      timeoutMs *= 2.0
    }
    
    // Adjust based on preference density
    if (metrics.preferenceDensity < 0.3) {
      timeoutMs *= 0.8 // Less data to process
    }
    if (metrics.preferenceDensity > 0.8) {
      timeoutMs *= 1.2 // More data to process
    }
    
    return this.validateTimeout(Math.round(timeoutMs))
  }

  /**
   * Validate timeout value within acceptable bounds
   */
  private validateTimeout(timeoutMs: number): number {
    return Math.max(
      this.config.minTimeoutMs,
      Math.min(this.config.maxTimeoutMs, timeoutMs)
    )
  }

  /**
   * Clean up operation resources
   */
  private cleanupOperation(operationId: string): void {
    const context = this.activeOperations.get(operationId)
    
    if (context) {
      // Clear timeout
      if ((context as any).timeoutId) {
        clearTimeout((context as any).timeoutId)
      }
      
      // Clear monitoring interval
      if ((context as any).monitoringInterval) {
        clearInterval((context as any).monitoringInterval)
      }
      
      // Stop resource monitoring
      if (this.resourceMonitor) {
        this.resourceMonitor.stopMonitoring(operationId)
      }
      
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Don't retry validation errors, permission errors, etc.
      const nonRetryableTypes = [
        'ValidationError',
        'PermissionError',
        'AuthenticationError'
      ]
      
      return nonRetryableTypes.some(type => 
        error.name === type || error.message.includes(type.toLowerCase())
      )
    }
    
    return false
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get active operations count
   */
  getActiveOperationsCount(): number {
    return this.activeOperations.size
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): TimeoutContext | null {
    return this.activeOperations.get(operationId) || null
  }

  /**
   * Cancel specific operation
   */
  cancelOperation(operationId: string): boolean {
    const context = this.activeOperations.get(operationId)
    if (context) {
      this.cleanupOperation(operationId)
      return true
    }
    return false
  }

  /**
   * Cancel all active operations
   */
  cancelAllOperations(): number {
    const count = this.activeOperations.size
    const operationIds = Array.from(this.activeOperations.keys())
    for (const operationId of operationIds) {
      this.cleanupOperation(operationId)
    }
    return count
  }
}

/**
 * Resource monitoring system
 */
export class ResourceMonitor {
  private activeMonitoring = new Map<string, ResourceMonitoringContext>()
  private resourceLimits: ResourceLimits

  constructor(limits: Partial<ResourceLimits> = {}) {
    this.resourceLimits = {
      maxMemoryMB: 100,
      maxCpuTimeMs: 30000,
      maxIterations: 1000,
      maxDestinations: 50,
      maxGroupMembers: 20,
      ...limits
    }
  }

  /**
   * Start monitoring resources for an operation
   */
  startMonitoring(operationId: string): void {
    const context: ResourceMonitoringContext = {
      operationId,
      startTime: Date.now(),
      startMemory: this.getCurrentMemoryUsage(),
      peakMemory: 0,
      iterationCount: 0
    }
    
    this.activeMonitoring.set(operationId, context)
  }

  /**
   * Check if resource limits are exceeded
   */
  checkResourceLimits(operationId: string): ResourceLimitResult {
    const context = this.activeMonitoring.get(operationId)
    if (!context) {
      return { exceeded: false }
    }

    // Check memory usage
    const currentMemory = this.getCurrentMemoryUsage()
    context.peakMemory = Math.max(context.peakMemory, currentMemory)
    
    if (currentMemory > this.resourceLimits.maxMemoryMB) {
      return {
        exceeded: true,
        reason: `Memory usage (${currentMemory.toFixed(1)}MB) exceeded limit (${this.resourceLimits.maxMemoryMB}MB)`,
        currentUsage: { memory: currentMemory }
      }
    }

    // Check CPU time
    const elapsedTime = Date.now() - context.startTime
    if (elapsedTime > this.resourceLimits.maxCpuTimeMs) {
      return {
        exceeded: true,
        reason: `CPU time (${elapsedTime}ms) exceeded limit (${this.resourceLimits.maxCpuTimeMs}ms)`,
        currentUsage: { cpuTime: elapsedTime }
      }
    }

    // Check iteration count
    if (context.iterationCount > this.resourceLimits.maxIterations) {
      return {
        exceeded: true,
        reason: `Iteration count (${context.iterationCount}) exceeded limit (${this.resourceLimits.maxIterations})`,
        currentUsage: { iterations: context.iterationCount }
      }
    }

    return { exceeded: false }
  }

  /**
   * Record iteration for monitoring
   */
  recordIteration(operationId: string): void {
    const context = this.activeMonitoring.get(operationId)
    if (context) {
      context.iterationCount++
    }
  }

  /**
   * Stop monitoring resources
   */
  stopMonitoring(operationId: string): ResourceSummary | null {
    const context = this.activeMonitoring.get(operationId)
    if (!context) return null

    const summary: ResourceSummary = {
      operationId,
      duration: Date.now() - context.startTime,
      peakMemoryMB: context.peakMemory,
      totalIterations: context.iterationCount,
      memoryEfficiency: this.calculateMemoryEfficiency(context),
      timeEfficiency: this.calculateTimeEfficiency(context)
    }

    this.activeMonitoring.delete(operationId)
    return summary
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memInfo = (performance as any).memory
      return (memInfo.usedJSHeapSize || 0) / (1024 * 1024)
    }
    return 0
  }

  /**
   * Calculate memory efficiency
   */
  private calculateMemoryEfficiency(context: ResourceMonitoringContext): number {
    if (context.peakMemory === 0) return 1.0
    return Math.min(1.0, this.resourceLimits.maxMemoryMB / context.peakMemory)
  }

  /**
   * Calculate time efficiency
   */
  private calculateTimeEfficiency(context: ResourceMonitoringContext): number {
    const duration = Date.now() - context.startTime
    if (duration === 0) return 1.0
    return Math.min(1.0, this.resourceLimits.maxCpuTimeMs / duration)
  }
}

/**
 * Interfaces for type safety
 */
export interface ComplexityMetrics {
  destinationCount: number
  groupSize: number
  geographicSpreadKm: number
  preferenceDensity: number // 0-1, ratio of preferences to total possible
  constraintComplexity?: number // Custom complexity score
}

interface ResourceMonitoringContext {
  operationId: string
  startTime: number
  startMemory: number
  peakMemory: number
  iterationCount: number
}

interface ResourceLimitResult {
  exceeded: boolean
  reason?: string
  currentUsage?: {
    memory?: number
    cpuTime?: number
    iterations?: number
  }
}

interface ResourceSummary {
  operationId: string
  duration: number
  peakMemoryMB: number
  totalIterations: number
  memoryEfficiency: number // 0-1
  timeEfficiency: number // 0-1
}

/**
 * Global timeout manager instance
 */
export const globalTimeoutManager = new TimeoutManager()

/**
 * Convenience function for simple timeout operations
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName?: string
): Promise<T> {
  return globalTimeoutManager.executeWithTimeout(operation, timeoutMs, {
    operationName: operationName || 'anonymous_operation'
  })
}

/**
 * Convenience function for adaptive timeout based on complexity
 */
export async function withAdaptiveTimeout<T>(
  operation: () => Promise<T>,
  metrics: ComplexityMetrics,
  operationName?: string
): Promise<T> {
  return globalTimeoutManager.executeWithAdaptiveTimeout(operation, metrics, {
    operationName: operationName || 'adaptive_operation'
  })
}

/**
 * Convenience function for operations with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseTimeoutMs?: number,
  operationName?: string
): Promise<T> {
  return globalTimeoutManager.executeWithRetry(operation, maxRetries, baseTimeoutMs, {
    operationName: operationName || 'retry_operation'
  })
}