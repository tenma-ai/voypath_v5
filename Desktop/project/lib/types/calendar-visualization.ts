// Types for calendar and timeline visualization
import type { DestinationVisit, DetailedTransportSegment } from '@/lib/optimization/detailed-route-types'

// Calendar display modes
export type CalendarDisplayMode = 'overview' | 'detailed' | 'timeline'
export type TimelineZoomLevel = 'compact' | 'standard' | 'expanded'

// Daily timeline structure
export interface DayTimeline {
  date: Date
  dateString: string
  dayOfWeek: string
  timelineBlocks: TimelineBlock[]
  dailyStats: DayStatistics
  accommodationInfo?: AccommodationSuggestion
  isCurrentDay?: boolean
  isPackedDay: boolean
}

// Timeline block representing a destination visit
export interface TimelineBlock {
  id: string
  startPercent: number    // Position on timeline (0-100%)
  widthPercent: number   // Duration as percentage of day
  startTime: string      // "10:30"
  endTime: string        // "12:00"
  destination: DestinationVisit
  color: string          // User preference color
  borderStyle: 'solid' | 'dashed' | 'dotted'
  height: 'small' | 'medium' | 'large'
  transportNext?: TransportIndicator
  userCount: number
  isInteractive: boolean
}

// Transport information between destinations
export interface TransportIndicator {
  mode: 'walking' | 'driving' | 'flying'
  duration: string       // "30min"
  icon: string          // "🚗"
  color: string         // Transport mode color
  distance?: string     // "2.5km"
}

// Daily statistics
export interface DayStatistics {
  totalDestinations: number
  totalWalkingTime: number    // minutes
  totalDrivingTime: number    // minutes
  totalActivityTime: number   // minutes
  totalFreeTime: number      // minutes
  dayCompactness: 'light' | 'moderate' | 'packed'
  earliestStart: string      // "09:00"
  latestEnd: string         // "18:00"
  recommendedBreaks: number
}

// Accommodation suggestion
export interface AccommodationSuggestion {
  name: string
  type: 'hotel' | 'hostel' | 'airbnb' | 'ryokan'
  location: string
  distanceFromLastDestination: number // km
  estimatedTravelTime: number        // minutes
  priceRange: '$' | '$$' | '$$$'
  rating?: number
}

// Calendar configuration
export interface CalendarVisualizationConfig {
  displayMode: CalendarDisplayMode
  zoomLevel: TimelineZoomLevel
  timelineStart: number      // Hour (e.g., 9 for 9 AM)
  timelineEnd: number        // Hour (e.g., 21 for 9 PM)
  showTransportDetails: boolean
  showUserPreferences: boolean
  enableTimeEditing: boolean
  showAccommodations: boolean
  compactMobileView: boolean
}

// Calendar component props
export interface CalendarVisualizationProps {
  itinerary: any // Compatible with existing data
  multiDayItinerary?: any
  config?: Partial<CalendarVisualizationConfig>
  onDaySelect?: (date: Date) => void
  onDestinationSelect?: (destinationId: string) => void
  onTimeEdit?: (destinationId: string, newTime: { start: string; end: string }) => void
  onAccommodationSelect?: (accommodation: AccommodationSuggestion) => void
  className?: string
  selectedDate?: Date
  currentUserRole?: 'admin' | 'member' | 'viewer'
}

// Time calculation utilities
export interface TimePosition {
  hour: number
  minute: number
  totalMinutes: number
  percentage: number
}

// Calendar interaction events
export interface CalendarInteraction {
  type: 'day-select' | 'destination-tap' | 'timeline-zoom' | 'time-edit'
  target?: string
  data?: any
  timestamp: number
}

// Progressive disclosure state
export interface DisclosureState {
  expandedDays: Set<string>        // Date strings
  selectedDestination?: string
  detailLevel: 1 | 2 | 3          // Information depth
  showingPreferences: boolean
  editMode: boolean
}

// Trip balance analysis
export interface TripBalance {
  packedDays: number              // Days with 7+ hours
  lightDays: number               // Days with < 5 hours
  travelDays: number              // Transport-focused days
  restRecommendation: boolean
  averageActivitiesPerDay: number
  totalTripDays: number
}

// Accessibility options
export interface CalendarAccessibilityOptions {
  announceTimeChanges: boolean
  keyboardNavigation: boolean
  highContrastTimelines: boolean
  simplifiedView: boolean
  screenReaderDescriptions: boolean
  voiceNavigation: boolean
}

// Animation configuration
export interface CalendarAnimationConfig {
  enableAnimations: boolean
  transitionDuration: number      // milliseconds
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  staggerDelay: number           // milliseconds between blocks
}

// Responsive breakpoints
export interface CalendarBreakpoints {
  compact: number    // < 375px
  standard: number   // 375-768px
  expanded: number   // > 768px
}

// Calendar error states
export interface CalendarError {
  code: 'INVALID_DATE' | 'TIMELINE_OVERFLOW' | 'DATA_INCONSISTENCY'
  message: string
  affectedDay?: string
  fallbackStrategy: 'simplify' | 'skip' | 'retry'
}

// Multi-day pattern analysis
export interface TripPatterns {
  activityIntensity: number[]     // Per day (0-1)
  geographicClusters: string[]    // Day groupings by location
  activityTypes: ActivityTypePattern[]
  restDayRecommendations: string[] // Date strings
}

export interface ActivityTypePattern {
  day: string
  primaryType: 'cultural' | 'nature' | 'urban' | 'entertainment' | 'relaxation'
  secondaryTypes: string[]
  intensity: number
}

// Time zone handling
export interface TimeZoneConfig {
  tripTimeZone: string           // IANA timezone
  userTimeZone: string          // User's local timezone
  showBothTimeZones: boolean
  primaryTimeZone: 'trip' | 'user'
}

// Calendar legend
export interface CalendarLegend {
  colorMeanings: LegendColorItem[]
  timelineSymbols: LegendSymbolItem[]
  interactionHints: LegendInteractionItem[]
}

export interface LegendColorItem {
  color: string
  label: string
  description: string
  example?: string
}

export interface LegendSymbolItem {
  symbol: string
  label: string
  description: string
}

export interface LegendInteractionItem {
  gesture: string
  action: string
  description: string
}

// Accessibility settings for timeline
export interface AccessibilitySettings {
  announceUpdates?: boolean
  highContrast: boolean
  largeText: boolean
  screenReaderEnabled?: boolean
  screenReaderMode?: boolean
  keyboardNavigation: boolean
  voiceNavigation: boolean
  reducedMotion?: boolean
  hapticFeedback?: boolean
  announceTimeChanges?: boolean
  announceDestinationDetails?: boolean
  timeFormat?: string
}