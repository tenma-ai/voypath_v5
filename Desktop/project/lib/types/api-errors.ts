/**
 * API Error Types and Classification System for Voypath Optimization
 * 
 * Comprehensive error handling system that categorizes different types of errors
 * and provides structured error responses with recovery strategies.
 */

export enum OptimizationErrorType {
  // Data-related errors
  INSUFFICIENT_DATA = 'insufficient_data',
  INVALID_COORDINATES = 'invalid_coordinates',
  MISSING_PREFERENCES = 'missing_preferences',
  INVALID_DESTINATIONS = 'invalid_destinations',
  MISSING_GROUP_DATA = 'missing_group_data',
  
  // Algorithm-related errors
  NO_FEASIBLE_SOLUTION = 'no_feasible_solution',
  OPTIMIZATION_TIMEOUT = 'optimization_timeout',
  CLUSTERING_FAILED = 'clustering_failed',
  ROUTE_CALCULATION_FAILED = 'route_calculation_failed',
  FAIRNESS_CALCULATION_FAILED = 'fairness_calculation_failed',
  
  // Infrastructure-related errors
  DATABASE_ERROR = 'database_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  PERMISSION_DENIED = 'permission_denied',
  SESSION_EXPIRED = 'session_expired',
  STORAGE_ERROR = 'storage_error',
  
  // External service errors
  GEOCODING_FAILED = 'geocoding_failed',
  MAPS_API_ERROR = 'maps_api_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  NETWORK_ERROR = 'network_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  
  // Validation errors
  VALIDATION_ERROR = 'validation_error',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  TYPE_ERROR = 'type_error',
  
  // Unknown errors
  UNKNOWN_ERROR = 'unknown_error'
}

export interface OptimizationError {
  type: OptimizationErrorType
  message: string
  details?: any
  userMessage: string
  suggestedActions: string[]
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  context?: {
    groupId?: string
    userId?: string
    sessionId?: string
    function?: string
    stack?: string
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  data?: any
}

export interface OptimizationResponse {
  status: 'success' | 'error' | 'partial_success'
  data?: any
  error?: OptimizationError
  warnings?: string[]
  processingTime?: number
  fallbackData?: any
  metadata?: {
    generatedBy?: any
    generatedAt?: Date
    processingTime?: number
    version?: string
  }
}

export class OptimizationTimeoutError extends Error {
  public readonly type = OptimizationErrorType.OPTIMIZATION_TIMEOUT
  
  constructor(message: string, public readonly timeoutMs: number) {
    super(message)
    this.name = 'OptimizationTimeoutError'
  }
}

export class ValidationError extends Error {
  public readonly type = OptimizationErrorType.VALIDATION_ERROR
  
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class DataInsufficientError extends Error {
  public readonly type = OptimizationErrorType.INSUFFICIENT_DATA
  
  constructor(message: string, public readonly requiredData: string[]) {
    super(message)
    this.name = 'DataInsufficientError'
  }
}

export class NoFeasibleSolutionError extends Error {
  public readonly type = OptimizationErrorType.NO_FEASIBLE_SOLUTION
  
  constructor(message: string, public readonly constraints: any) {
    super(message)
    this.name = 'NoFeasibleSolutionError'
  }
}

/**
 * Error classification utility to convert unknown errors into structured OptimizationError objects
 */
export function classifyError(error: unknown, context?: any): OptimizationError {
  const timestamp = new Date().toISOString()
  
  // Handle known error types
  if (error instanceof OptimizationTimeoutError) {
    return {
      type: OptimizationErrorType.OPTIMIZATION_TIMEOUT,
      message: error.message,
      details: { timeoutMs: error.timeoutMs },
      userMessage: 'Optimization is taking longer than expected. We\'ve provided the best solution found so far.',
      suggestedActions: [
        'Use the current result and refine manually',
        'Try again with fewer destinations',
        'Simplify your preferences'
      ],
      retryable: true,
      severity: 'medium',
      timestamp,
      context
    }
  }
  
  if (error instanceof ValidationError) {
    return {
      type: OptimizationErrorType.VALIDATION_ERROR,
      message: error.message,
      details: { validationErrors: error.validationErrors },
      userMessage: 'Some of the provided data is invalid or incomplete.',
      suggestedActions: [
        'Check the highlighted fields',
        'Ensure all required information is provided',
        'Verify coordinates are valid'
      ],
      retryable: true,
      severity: 'high',
      timestamp,
      context
    }
  }
  
  if (error instanceof DataInsufficientError) {
    return {
      type: OptimizationErrorType.INSUFFICIENT_DATA,
      message: error.message,
      details: { requiredData: error.requiredData },
      userMessage: 'We need more information to create an optimal route.',
      suggestedActions: [
        'Ask group members to rate more destinations',
        'Add more destinations to choose from',
        'Provide time preferences for existing destinations'
      ],
      retryable: true,
      severity: 'medium',
      timestamp,
      context
    }
  }
  
  if (error instanceof NoFeasibleSolutionError) {
    return {
      type: OptimizationErrorType.NO_FEASIBLE_SOLUTION,
      message: error.message,
      details: { constraints: error.constraints },
      userMessage: 'We couldn\'t fit all desired destinations in the available time.',
      suggestedActions: [
        'Extend your trip duration',
        'Reduce time spent at some destinations',
        'Remove some lower-priority destinations',
        'Consider splitting into multiple trips'
      ],
      retryable: true,
      severity: 'medium',
      timestamp,
      context
    }
  }
  
  // Handle database errors
  if (error instanceof Error && error.message.includes('database')) {
    return {
      type: OptimizationErrorType.DATABASE_ERROR,
      message: error.message,
      details: { originalError: error },
      userMessage: 'We\'re experiencing database connectivity issues. Please try again.',
      suggestedActions: [
        'Wait a moment and try again',
        'Check your internet connection',
        'Contact support if the problem persists'
      ],
      retryable: true,
      severity: 'high',
      timestamp,
      context
    }
  }
  
  // Handle network errors
  if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
    return {
      type: OptimizationErrorType.NETWORK_ERROR,
      message: error.message,
      details: { originalError: error },
      userMessage: 'Network connection issue. Please check your internet connection.',
      suggestedActions: [
        'Check your internet connection',
        'Try again in a moment',
        'Switch to a different network if available'
      ],
      retryable: true,
      severity: 'medium',
      timestamp,
      context
    }
  }
  
  // Handle Google Maps API errors
  if (error instanceof Error && error.message.includes('maps')) {
    return {
      type: OptimizationErrorType.MAPS_API_ERROR,
      message: error.message,
      details: { originalError: error },
      userMessage: 'Maps service is temporarily unavailable.',
      suggestedActions: [
        'Try again in a few minutes',
        'Use manual coordinate entry if available',
        'Contact support if the issue persists'
      ],
      retryable: true,
      severity: 'medium',
      timestamp,
      context
    }
  }
  
  // Default unknown error
  return {
    type: OptimizationErrorType.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    details: { originalError: error },
    userMessage: 'Something went wrong while planning your trip. Please try again.',
    suggestedActions: [
      'Try again in a moment',
      'Refresh the page',
      'Contact support if the problem persists'
    ],
    retryable: true,
    severity: 'high',
    timestamp,
    context
  }
}

/**
 * Error severity assessment utility
 */
export function getErrorSeverity(errorType: OptimizationErrorType): 'low' | 'medium' | 'high' | 'critical' {
  switch (errorType) {
    case OptimizationErrorType.UNKNOWN_ERROR:
    case OptimizationErrorType.DATABASE_ERROR:
    case OptimizationErrorType.AUTHENTICATION_ERROR:
    case OptimizationErrorType.VALIDATION_ERROR:
      return 'high'
      
    case OptimizationErrorType.SERVICE_UNAVAILABLE:
    case OptimizationErrorType.PERMISSION_DENIED:
      return 'critical'
      
    case OptimizationErrorType.INSUFFICIENT_DATA:
    case OptimizationErrorType.NO_FEASIBLE_SOLUTION:
    case OptimizationErrorType.OPTIMIZATION_TIMEOUT:
    case OptimizationErrorType.CLUSTERING_FAILED:
    case OptimizationErrorType.NETWORK_ERROR:
    case OptimizationErrorType.MAPS_API_ERROR:
      return 'medium'
      
    default:
      return 'low'
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(errorType: OptimizationErrorType): boolean {
  const nonRetryableErrors = [
    OptimizationErrorType.VALIDATION_ERROR,
    OptimizationErrorType.PERMISSION_DENIED,
    OptimizationErrorType.AUTHENTICATION_ERROR,
    OptimizationErrorType.CONSTRAINT_VIOLATION,
    OptimizationErrorType.TYPE_ERROR
  ]
  
  return !nonRetryableErrors.includes(errorType)
}