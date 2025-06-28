/**
 * Retry Handler Utility for Optimization System
 * Provides exponential backoff retry logic with error categorization
 */

import { OptimizationErrorType, EnhancedOptimizationError, OptimizationStage } from '../types/optimization';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: OptimizationErrorType[];
  signal?: AbortSignal;
}

export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    operationName = 'operation'
  ): Promise<T> {
    let lastError: Error;
    const correlationId = this.generateCorrelationId();
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      // Check if operation was aborted
      if (options.signal?.aborted) {
        throw this.createEnhancedError(
          OptimizationErrorType.TIMEOUT_ERROR,
          'Operation was cancelled',
          'OPERATION_CANCELLED',
          'routing',
          false,
          correlationId,
          { attempt, operationName }
        );
      }

      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on the last attempt
        if (attempt === options.maxRetries) break;
        
        const enhancedError = this.enhanceError(error as Error, 'routing', correlationId);
        const isRetryable = this.isRetryableError(enhancedError, options.retryableErrors);
        
        if (!isRetryable) {
          throw enhancedError;
        }
        
        const delay = Math.min(
          options.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          options.maxDelay
        );
        
        // Warning: `${operationName} failed (attempt ${attempt + 1}/${options.maxRetries + 1}), retrying in ${delay}ms:`, enhancedError.message);
        
        await this.delay(delay);
      }
    }
    
    // Enhance the final error before throwing
    const finalError = this.enhanceError(lastError, 'routing', correlationId);
    throw finalError;
  }

  static isRetryableError(
    error: EnhancedOptimizationError | Error,
    retryableErrorTypes: OptimizationErrorType[]
  ): boolean {
    if ('type' in error) {
      return error.retryable && retryableErrorTypes.includes(error.type);
    }
    
    // For regular errors, check message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return retryableErrorTypes.includes(OptimizationErrorType.NETWORK_ERROR);
    }
    
    if (message.includes('timeout')) {
      return retryableErrorTypes.includes(OptimizationErrorType.TIMEOUT_ERROR);
    }
    
    return false;
  }

  static enhanceError(
    error: Error,
    stage: OptimizationStage,
    correlationId: string,
    context?: Record<string, unknown>
  ): EnhancedOptimizationError {
    if (error.name === 'EnhancedOptimizationError') {
      return error as unknown as EnhancedOptimizationError;
    }

    const errorType = this.categorizeError(error);
    const isRetryable = this.determineRetryability(errorType, error);

    return this.createEnhancedError(
      errorType,
      error.message,
      this.generateErrorCode(errorType),
      stage,
      isRetryable,
      correlationId,
      { originalError: error.name, ...context }
    );
  }

  static createEnhancedError(
    type: OptimizationErrorType,
    message: string,
    code: string,
    stage: OptimizationStage,
    retryable: boolean,
    correlationId: string,
    context?: Record<string, unknown>
  ): EnhancedOptimizationError {
    const error = new Error(message) as unknown as EnhancedOptimizationError;
    error.name = 'EnhancedOptimizationError';
    error.type = type;
    error.code = code;
    error.stage = stage;
    error.retryable = retryable;
    error.context = context;
    error.timestamp = new Date().toISOString();
    error.correlationId = correlationId;
    
    return error;
  }

  private static categorizeError(error: Error): OptimizationErrorType {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('fetch') || message.includes('network') || 
        message.includes('connection') || error.name === 'TypeError') {
      return OptimizationErrorType.NETWORK_ERROR;
    }
    
    // Timeout errors
    if (message.includes('timeout') || error.name === 'AbortError') {
      return OptimizationErrorType.TIMEOUT_ERROR;
    }
    
    // Permission errors
    if (message.includes('unauthorized') || message.includes('forbidden') || 
        message.includes('permission')) {
      return OptimizationErrorType.PERMISSION_ERROR;
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || 
        message.includes('required')) {
      return OptimizationErrorType.VALIDATION_ERROR;
    }
    
    // Resource errors
    if (message.includes('not found') || message.includes('resource') || 
        message.includes('limit')) {
      return OptimizationErrorType.RESOURCE_ERROR;
    }
    
    // Edge Function errors
    if (message.includes('edge function') || message.includes('supabase')) {
      return OptimizationErrorType.EDGE_FUNCTION_ERROR;
    }
    
    // Database errors
    if (message.includes('database') || message.includes('sql') || 
        message.includes('constraint')) {
      return OptimizationErrorType.DATABASE_ERROR;
    }
    
    return OptimizationErrorType.UNKNOWN_ERROR;
  }

  private static determineRetryability(type: OptimizationErrorType, error: Error): boolean {
    switch (type) {
      case OptimizationErrorType.NETWORK_ERROR:
      case OptimizationErrorType.TIMEOUT_ERROR:
      case OptimizationErrorType.RESOURCE_ERROR:
      case OptimizationErrorType.DATABASE_ERROR:
        return true;
      
      case OptimizationErrorType.VALIDATION_ERROR:
      case OptimizationErrorType.PERMISSION_ERROR:
        return false;
      
      case OptimizationErrorType.EDGE_FUNCTION_ERROR:
        // Retry edge function errors unless they're validation-related
        return !error.message.toLowerCase().includes('validation');
      
      case OptimizationErrorType.UNKNOWN_ERROR:
      default:
        return true; // Default to retryable for unknown errors
    }
  }

  private static generateErrorCode(type: OptimizationErrorType): string {
    const timestamp = Date.now().toString(36);
    const prefix = type.split('_')[0].substring(0, 3).toUpperCase();
    return `${prefix}_${timestamp}`;
  }

  private static generateCorrelationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Preset retry configurations
  static get DEFAULT_RETRY_CONFIG(): RetryOptions {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      retryableErrors: [
        OptimizationErrorType.NETWORK_ERROR,
        OptimizationErrorType.TIMEOUT_ERROR,
        OptimizationErrorType.RESOURCE_ERROR,
        OptimizationErrorType.UNKNOWN_ERROR
      ]
    };
  }

  static get AGGRESSIVE_RETRY_CONFIG(): RetryOptions {
    return {
      maxRetries: 5,
      baseDelay: 500,
      maxDelay: 8000,
      retryableErrors: [
        OptimizationErrorType.NETWORK_ERROR,
        OptimizationErrorType.TIMEOUT_ERROR,
        OptimizationErrorType.RESOURCE_ERROR,
        OptimizationErrorType.EDGE_FUNCTION_ERROR,
        OptimizationErrorType.DATABASE_ERROR,
        OptimizationErrorType.UNKNOWN_ERROR
      ]
    };
  }

  static get CONSERVATIVE_RETRY_CONFIG(): RetryOptions {
    return {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      retryableErrors: [
        OptimizationErrorType.NETWORK_ERROR,
        OptimizationErrorType.TIMEOUT_ERROR
      ]
    };
  }
}