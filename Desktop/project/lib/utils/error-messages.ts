import type { OptimizationError } from '../types/api-errors'
import { OptimizationErrorType } from '../types/api-errors'

export interface UserFriendlyError {
  title: string
  message: string
  suggestions: string[]
  icon: string
  severity: 'error' | 'warning' | 'info'
  technicalDetails?: any
  retryable: boolean
  timestamp: string
  helpUrl?: string
}

export interface ErrorMessageTemplate {
  title: string
  message: string
  suggestions: string[]
  icon: string
  severity: 'error' | 'warning' | 'info'
  helpUrl?: string
}

// Multilingual error messages
const errorMessages: Record<string, Record<OptimizationErrorType, ErrorMessageTemplate>> = {
  en: {
    [OptimizationErrorType.INSUFFICIENT_DATA]: {
      title: "Not Enough Information",
      message: "We need more destination preferences to create an optimal route for your group.",
      suggestions: [
        "Ask group members to rate more destinations",
        "Add more destinations to choose from",
        "Provide time preferences for existing destinations",
        "Share the trip link with all group members"
      ],
      icon: "⚠️",
      severity: "warning",
      helpUrl: "/help/adding-preferences"
    },
  
    [OptimizationErrorType.NO_FEASIBLE_SOLUTION]: {
      title: "Route Not Possible",
      message: "We couldn't fit all desired destinations within your available time and constraints.",
      suggestions: [
        "Extend your trip duration by a few days",
        "Reduce time spent at some destinations",
        "Remove some lower-priority destinations",
        "Consider splitting into multiple shorter trips",
        "Adjust travel pace preferences"
      ],
      icon: "🚫",
      severity: "error",
      helpUrl: "/help/trip-constraints"
    },
  
    [OptimizationErrorType.OPTIMIZATION_TIMEOUT]: {
      title: "Taking Longer Than Expected",
      message: "Optimization is complex for your group size and preferences. We've found a good solution so far.",
      suggestions: [
        "Use the current result and refine manually",
        "Try again with fewer destinations",
        "Simplify group preferences",
        "Contact support if this keeps happening"
      ],
      icon: "⏱️",
      severity: "warning"
    },
  
    [OptimizationErrorType.CLUSTERING_FAILED]: {
      title: "Grouping Error",
      message: "We had trouble organizing destinations into logical groups for your trip.",
      suggestions: [
        "Check that destinations are in reasonable locations",
        "Ensure destinations have valid coordinates",
        "Try with fewer destinations",
        "Manual arrangement may work better"
      ],
      icon: "🔗",
      severity: "error"
    },
  
    [OptimizationErrorType.INVALID_COORDINATES]: {
      title: "Invalid Location Data",
      message: "Some destination coordinates appear to be invalid or outside valid ranges.",
      suggestions: [
        "Check that all destinations have valid addresses",
        "Verify locations on the map before optimizing",
        "Remove any placeholder or test destinations",
        "Try searching for locations again"
      ],
      icon: "📍",
      severity: "error"
    },
  
    [OptimizationErrorType.MISSING_PREFERENCES]: {
      title: "Missing User Preferences",
      message: "Group members haven't provided enough preferences for optimization.",
      suggestions: [
        "Invite all group members to join the trip",
        "Ask members to rate destinations they're interested in",
        "Set default preferences for missing members",
        "Continue with available preferences"
      ],
      icon: "👥",
      severity: "warning"
    },
  
    [OptimizationErrorType.DATABASE_ERROR]: {
      title: "Temporary Service Issue",
      message: "We're experiencing a temporary issue saving your optimization. Your data is safe.",
      suggestions: [
        "Try again in a moment",
        "Check your internet connection",
        "Your trip data has been preserved",
        "Contact support if this persists"
      ],
      icon: "💾",
      severity: "error"
    },
  
    [OptimizationErrorType.AUTHENTICATION_ERROR]: {
      title: "Access Issue",
      message: "We need to verify your access to this trip before optimizing.",
      suggestions: [
        "Sign in to your account",
        "Check that you're a member of this trip",
        "Ask the trip creator to invite you",
        "Refresh the page and try again"
      ],
      icon: "🔐",
      severity: "error"
    },
  
    [OptimizationErrorType.PERMISSION_DENIED]: {
      title: "Permission Required",
      message: "You don't have permission to optimize this trip's route.",
      suggestions: [
        "Ask the trip organizer for editing permissions",
        "Join the trip as an active member",
        "Create your own copy of this trip",
        "Contact the trip creator"
      ],
      icon: "🚷",
      severity: "error"
    },
  
    [OptimizationErrorType.GEOCODING_FAILED]: {
      title: "Location Lookup Failed",
      message: "We couldn't find geographic coordinates for some destinations.",
      suggestions: [
        "Check destination names and addresses",
        "Use more specific location descriptions",
        "Add city or country information",
        "Try alternative location names"
      ],
      icon: "🗺️",
      severity: "error"
    },
  
    [OptimizationErrorType.MAPS_API_ERROR]: {
      title: "Map Service Issue",
      message: "Our mapping service is temporarily unavailable for route calculations.",
      suggestions: [
        "Try again in a few minutes",
        "Check your internet connection",
        "Use manual route planning temporarily",
        "Contact support if this continues"
      ],
      icon: "🗺️",
      severity: "error"
    },
  
    [OptimizationErrorType.RATE_LIMIT_EXCEEDED]: {
      title: "Too Many Requests",
      message: "You've reached the limit for optimization requests. Please wait before trying again.",
      suggestions: [
        "Wait a few minutes before optimizing again",
        "Consider upgrading for more requests",
        "Refine your trip before re-optimizing",
        "Contact support for assistance"
      ],
      icon: "⚡",
      severity: "warning",
      helpUrl: "/help/rate-limits"
    },

    [OptimizationErrorType.VALIDATION_ERROR]: {
      title: "Invalid Trip Data",
      message: "Some information about your trip doesn't meet our requirements.",
      suggestions: [
        "Check all required fields are filled",
        "Verify dates are in the correct format",
        "Ensure group size is reasonable",
        "Review destination information"
      ],
      icon: "📋",
      severity: "error"
    },

    [OptimizationErrorType.NETWORK_ERROR]: {
      title: "Connection Problem",
      message: "We couldn't connect to our optimization service. Check your internet connection.",
      suggestions: [
        "Check your internet connection",
        "Try refreshing the page",
        "Wait a moment and try again",
        "Switch to a different network if possible"
      ],
      icon: "📡",
      severity: "error"
    },

    [OptimizationErrorType.INVALID_DESTINATIONS]: {
      title: "Invalid Destinations",
      message: "Some destinations in your trip are invalid or inaccessible.",
      suggestions: [
        "Check destination names and addresses",
        "Remove any duplicate destinations",
        "Verify all locations exist and are accessible",
        "Use specific addresses instead of general areas"
      ],
      icon: "📍",
      severity: "error"
    },

    [OptimizationErrorType.MISSING_GROUP_DATA]: {
      title: "Incomplete Group Information",
      message: "We're missing essential information about your travel group.",
      suggestions: [
        "Ensure all group members have joined the trip",
        "Complete your group profile information",
        "Verify group size and preferences",
        "Contact missing members to join the trip"
      ],
      icon: "👥",
      severity: "warning"
    },

    [OptimizationErrorType.ROUTE_CALCULATION_FAILED]: {
      title: "Route Calculation Error",
      message: "We couldn't calculate routes between your destinations.",
      suggestions: [
        "Check that all destinations are reachable",
        "Verify destination coordinates are correct",
        "Try with fewer destinations",
        "Contact support if this persists"
      ],
      icon: "🛣️",
      severity: "error"
    },

    [OptimizationErrorType.FAIRNESS_CALCULATION_FAILED]: {
      title: "Fairness Analysis Error",
      message: "We couldn't analyze preference fairness for your group.",
      suggestions: [
        "Ensure all group members have provided preferences",
        "Check that preferences are properly formatted",
        "Try manual optimization as a fallback",
        "Contact support for assistance"
      ],
      icon: "⚖️",
      severity: "error"
    },

    [OptimizationErrorType.SESSION_EXPIRED]: {
      title: "Session Expired",
      message: "Your session has expired. Please sign in again to continue.",
      suggestions: [
        "Refresh the page and sign in again",
        "Check your internet connection",
        "Clear browser cookies if needed",
        "Contact support if sign-in fails"
      ],
      icon: "⏰",
      severity: "warning"
    },

    [OptimizationErrorType.STORAGE_ERROR]: {
      title: "Storage Issue",
      message: "We couldn't save your optimization results due to a storage error.",
      suggestions: [
        "Try saving again in a moment",
        "Check available storage space",
        "Clear browser cache and retry",
        "Contact support if the problem persists"
      ],
      icon: "💾",
      severity: "error"
    },

    [OptimizationErrorType.SERVICE_UNAVAILABLE]: {
      title: "Service Temporarily Unavailable",
      message: "Our optimization service is temporarily down for maintenance.",
      suggestions: [
        "Try again in a few minutes",
        "Check our status page for updates",
        "Use manual planning as a temporary solution",
        "Sign up for service notifications"
      ],
      icon: "🚧",
      severity: "error"
    },

    [OptimizationErrorType.CONSTRAINT_VIOLATION]: {
      title: "Constraint Violation",
      message: "Your trip requirements conflict with available options.",
      suggestions: [
        "Review your time and budget constraints",
        "Consider more flexible travel dates",
        "Adjust destination priorities",
        "Reduce the number of must-visit places"
      ],
      icon: "⛔",
      severity: "error"
    },

    [OptimizationErrorType.TYPE_ERROR]: {
      title: "Data Type Error",
      message: "Some of your trip data is in an unexpected format.",
      suggestions: [
        "Check date formats are correct",
        "Verify numeric values for duration and budget",
        "Refresh the page and try again",
        "Contact support with details of what you entered"
      ],
      icon: "🔤",
      severity: "error"
    },

    [OptimizationErrorType.UNKNOWN_ERROR]: {
      title: "Unexpected Error",
      message: "Something unexpected happened. Our team has been notified.",
      suggestions: [
        "Try refreshing the page",
        "Clear your browser cache",
        "Try again in a few minutes",
        "Contact support with error details"
      ],
      icon: "❌",
      severity: "error"
    }
  }
}

/**
 * Gets the user's preferred language, falling back to English
 */
function getUserLanguage(): string {
  if (typeof window !== 'undefined') {
    return window.navigator.language.split('-')[0] || 'en'
  }
  return 'en'
}

/**
 * Formats an optimization error into a user-friendly error message
 */
export function formatErrorForUser(
  error: OptimizationError,
  language?: string
): UserFriendlyError {
  const userLang = language || getUserLanguage()
  const messages = errorMessages[userLang] || errorMessages.en
  const template = messages[error.type] || messages[OptimizationErrorType.UNKNOWN_ERROR]

  return {
    title: template.title,
    message: template.message,
    suggestions: template.suggestions,
    icon: template.icon,
    severity: template.severity,
    retryable: error.retryable,
    timestamp: new Date().toISOString(),
    technicalDetails: error.details,
    helpUrl: template.helpUrl
  }
}

/**
 * Creates a user-friendly error from a raw error object
 */
export function createUserFriendlyError(
  rawError: unknown,
  context?: string,
  language?: string
): UserFriendlyError {
  let optimizationError: OptimizationError

  if (rawError && typeof rawError === 'object' && 'type' in rawError) {
    optimizationError = rawError as OptimizationError
  } else {
    optimizationError = {
      type: OptimizationErrorType.UNKNOWN_ERROR,
      message: rawError instanceof Error ? rawError.message : 'Unknown error occurred',
      userMessage: 'An unexpected error occurred',
      suggestedActions: ['Try again', 'Contact support if the problem persists'],
      retryable: true,
      severity: 'high',
      timestamp: new Date().toISOString(),
      details: { context, originalError: rawError }
    }
  }

  return formatErrorForUser(optimizationError, language)
}

/**
 * Generates contextual help suggestions based on error type and trip data
 */
export function generateContextualSuggestions(
  error: OptimizationError,
  tripData?: any
): string[] {
  const baseSuggestions = formatErrorForUser(error).suggestions
  const contextualSuggestions = [...baseSuggestions]

  if (tripData) {
    switch (error.type) {
      case OptimizationErrorType.INSUFFICIENT_DATA:
        if (tripData.groupMembers?.length > 5) {
          contextualSuggestions.push("With a large group, consider setting up preference deadlines")
        }
        if (tripData.destinations?.length < 3) {
          contextualSuggestions.push("Add more destination options for better optimization")
        }
        break

      case OptimizationErrorType.NO_FEASIBLE_SOLUTION:
        if (tripData.duration && tripData.destinations?.length > tripData.duration * 3) {
          contextualSuggestions.push("You have many destinations for the trip duration - consider prioritizing")
        }
        if (tripData.transportMode === 'walking') {
          contextualSuggestions.push("Consider enabling other transport modes for longer distances")
        }
        break

      case OptimizationErrorType.OPTIMIZATION_TIMEOUT:
        if (tripData.groupMembers?.length > 10) {
          contextualSuggestions.push("Large groups require more processing time - this is normal")
        }
        if (tripData.destinations?.length > 20) {
          contextualSuggestions.push("Try optimizing with your top 15-20 destinations first")
        }
        break
    }
  }

  return contextualSuggestions
}

// Severity levels for different error types
export enum ErrorSeverity {
  LOW = 'low',      // Warnings, non-blocking issues
  MEDIUM = 'medium', // Errors that can be worked around
  HIGH = 'high',     // Blocking errors that prevent optimization
  CRITICAL = 'critical' // System-level errors
}

export function getErrorSeverity(errorType: OptimizationErrorType): ErrorSeverity {
  const severityMap: Record<OptimizationErrorType, ErrorSeverity> = {
    [OptimizationErrorType.INSUFFICIENT_DATA]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.INVALID_COORDINATES]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.MISSING_PREFERENCES]: ErrorSeverity.LOW,
    [OptimizationErrorType.INVALID_DESTINATIONS]: ErrorSeverity.HIGH,
    [OptimizationErrorType.MISSING_GROUP_DATA]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.NO_FEASIBLE_SOLUTION]: ErrorSeverity.HIGH,
    [OptimizationErrorType.OPTIMIZATION_TIMEOUT]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.CLUSTERING_FAILED]: ErrorSeverity.HIGH,
    [OptimizationErrorType.ROUTE_CALCULATION_FAILED]: ErrorSeverity.HIGH,
    [OptimizationErrorType.FAIRNESS_CALCULATION_FAILED]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.DATABASE_ERROR]: ErrorSeverity.HIGH,
    [OptimizationErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
    [OptimizationErrorType.PERMISSION_DENIED]: ErrorSeverity.HIGH,
    [OptimizationErrorType.SESSION_EXPIRED]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.STORAGE_ERROR]: ErrorSeverity.HIGH,
    [OptimizationErrorType.GEOCODING_FAILED]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.MAPS_API_ERROR]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.RATE_LIMIT_EXCEEDED]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
    [OptimizationErrorType.SERVICE_UNAVAILABLE]: ErrorSeverity.CRITICAL,
    [OptimizationErrorType.VALIDATION_ERROR]: ErrorSeverity.HIGH,
    [OptimizationErrorType.CONSTRAINT_VIOLATION]: ErrorSeverity.HIGH,
    [OptimizationErrorType.TYPE_ERROR]: ErrorSeverity.HIGH,
    [OptimizationErrorType.UNKNOWN_ERROR]: ErrorSeverity.HIGH
  }
  
  return severityMap[errorType] || ErrorSeverity.HIGH
}

// Get appropriate color for error display
export function getErrorColor(severity: ErrorSeverity): string {
  const colorMap = {
    [ErrorSeverity.LOW]: 'text-blue-600 bg-blue-50 border-blue-200',
    [ErrorSeverity.MEDIUM]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    [ErrorSeverity.HIGH]: 'text-red-600 bg-red-50 border-red-200',
    [ErrorSeverity.CRITICAL]: 'text-red-800 bg-red-100 border-red-300'
  }
  
  return colorMap[severity]
}

// Progress stage descriptions for user feedback
export const stageDescriptions = {
  preprocessing: {
    title: "Preparing Data",
    description: "Loading your destinations and preferences...",
    tips: "This usually takes 1-2 seconds"
  },
  clustering: {
    title: "Analyzing Locations",
    description: "Grouping nearby destinations for efficiency...",
    tips: "We're looking at travel distances and time zones"
  },
  optimizing: {
    title: "Finding Best Route",
    description: "Calculating the optimal path through your destinations...",
    tips: "This is the most complex step and may take a few seconds"
  },
  generating: {
    title: "Creating Itinerary",
    description: "Building your detailed day-by-day schedule...",
    tips: "Adding transportation details and timing"
  },
  scheduling: {
    title: "Finalizing Schedule",
    description: "Optimizing timing and adding accommodations...",
    tips: "Almost done!"
  },
  saving: {
    title: "Saving Results",
    description: "Storing your optimized route...",
    tips: "Your route will be available to all group members"
  }
}

// Helper function to get user-friendly stage info
export function getStageInfo(stage: string) {
  return stageDescriptions[stage as keyof typeof stageDescriptions] || {
    title: "Processing",
    description: "Working on your request...",
    tips: "Please wait while we complete this step"
  }
}

// Retry delay calculation based on error type
export function getRetryDelay(errorType: OptimizationErrorType, attemptNumber: number): number {
  const baseDelays: Record<OptimizationErrorType, number> = {
    [OptimizationErrorType.INSUFFICIENT_DATA]: 0, // No retry needed
    [OptimizationErrorType.INVALID_COORDINATES]: 0, // No retry needed
    [OptimizationErrorType.MISSING_PREFERENCES]: 0, // No retry needed
    [OptimizationErrorType.INVALID_DESTINATIONS]: 0, // No retry needed
    [OptimizationErrorType.MISSING_GROUP_DATA]: 0, // No retry needed
    [OptimizationErrorType.NO_FEASIBLE_SOLUTION]: 0, // No retry needed
    [OptimizationErrorType.OPTIMIZATION_TIMEOUT]: 1000, // 1 second base
    [OptimizationErrorType.CLUSTERING_FAILED]: 2000, // 2 seconds base
    [OptimizationErrorType.ROUTE_CALCULATION_FAILED]: 3000, // 3 seconds base
    [OptimizationErrorType.FAIRNESS_CALCULATION_FAILED]: 2000, // 2 seconds base
    [OptimizationErrorType.DATABASE_ERROR]: 3000, // 3 seconds base
    [OptimizationErrorType.AUTHENTICATION_ERROR]: 5000, // 5 seconds base
    [OptimizationErrorType.PERMISSION_DENIED]: 0, // No retry needed
    [OptimizationErrorType.SESSION_EXPIRED]: 0, // No retry needed
    [OptimizationErrorType.STORAGE_ERROR]: 3000, // 3 seconds base
    [OptimizationErrorType.GEOCODING_FAILED]: 2000, // 2 seconds base
    [OptimizationErrorType.MAPS_API_ERROR]: 5000, // 5 seconds base
    [OptimizationErrorType.RATE_LIMIT_EXCEEDED]: 60000, // 1 minute base
    [OptimizationErrorType.NETWORK_ERROR]: 3000, // 3 seconds base
    [OptimizationErrorType.SERVICE_UNAVAILABLE]: 10000, // 10 seconds base
    [OptimizationErrorType.VALIDATION_ERROR]: 0, // No retry needed
    [OptimizationErrorType.CONSTRAINT_VIOLATION]: 0, // No retry needed
    [OptimizationErrorType.TYPE_ERROR]: 0, // No retry needed
    [OptimizationErrorType.UNKNOWN_ERROR]: 3000 // 3 seconds base
  }
  
  const baseDelay = baseDelays[errorType] || 3000
  
  // Exponential backoff: base * (2 ^ attemptNumber)
  return baseDelay * Math.pow(2, attemptNumber - 1)
}


/**
 * Determines if an error should trigger automatic retry
 */
export function shouldAutoRetry(error: OptimizationError, attemptCount: number): boolean {
  const maxAttempts = 3
  
  if (attemptCount >= maxAttempts) {
    return false
  }

  const retryableErrors = [
    OptimizationErrorType.DATABASE_ERROR,
    OptimizationErrorType.NETWORK_ERROR,
    OptimizationErrorType.MAPS_API_ERROR,
    OptimizationErrorType.OPTIMIZATION_TIMEOUT
  ]

  return error.retryable && retryableErrors.includes(error.type)
}

/**
 * Creates error analytics data for tracking
 */
export function createErrorAnalytics(error: OptimizationError, context?: any) {
  return {
    errorType: error.type,
    errorMessage: error.message,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    context: {
      tripId: context?.tripId,
      userId: context?.userId,
      groupSize: context?.groupSize,
      destinationCount: context?.destinationCount,
      ...context
    },
    retryable: error.retryable,
    severity: formatErrorForUser(error).severity
  }
}

export { errorMessages }

export default {
  formatErrorForUser,
  createUserFriendlyError,
  generateContextualSuggestions,
  getErrorSeverity,
  getErrorColor,
  getStageInfo,
  getRetryDelay,
  shouldAutoRetry,
  createErrorAnalytics,
  stageDescriptions
}
