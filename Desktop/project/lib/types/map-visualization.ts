// Types for interactive map visualization

import type { Location } from '@/lib/optimization/types'
import type { DetailedItinerary, DestinationVisit, DetailedTransportSegment } from '@/lib/optimization/detailed-route-types'
import type { MultiDayItinerary, DaySchedule } from '@/lib/optimization/daily-schedule-types'

// Re-export types that are needed by other files
export type { DestinationVisit, DetailedTransportSegment }

// Map display modes
export type MapDisplayMode = 'full-trip' | 'daily' | 'destination-focus'
export type TransportMode = 'walking' | 'driving' | 'flying'

// Color tier system for multi-user destinations
export interface ColorTier {
  tier: 1 | 2 | 3
  userCount: number
  color: string
  opacity: number
  description: string
}

// Marker types and configurations
export interface MarkerConfig {
  destinationId: string
  position: google.maps.LatLngLiteral
  color: string
  size: number
  orderNumber: number
  wishfulUsers: WishfulUserDisplay[]
  isStart?: boolean
  isEnd?: boolean
  clusterId?: string
}

export interface WishfulUserDisplay {
  userId: string
  displayName: string
  color: string
  rating: number
}

// Route visualization
export interface RouteSegmentConfig {
  id: string
  path: google.maps.LatLngLiteral[]
  transportMode: TransportMode
  style: RouteStyle
  distance: number
  duration: number
  fromName: string
  toName: string
}

export interface RouteStyle {
  strokeColor: string
  strokeWeight: number
  strokeOpacity: number
  strokeDasharray?: string
  icons?: google.maps.IconSequence[]
}

// Map controls and UI
export interface MapControlsConfig {
  zoomControl: boolean
  mapTypeControl: boolean
  streetViewControl: boolean
  fullscreenControl: boolean
  customControls?: CustomControl[]
}

export interface CustomControl {
  id: string
  position: google.maps.ControlPosition
  element: HTMLElement
  onClick?: () => void
}

// Information overlays
export interface MarkerInfoWindow {
  destinationId: string
  content: InfoWindowContent
  position: google.maps.LatLngLiteral
  pixelOffset?: google.maps.Size
}

export interface InfoWindowContent {
  title: string
  address?: string
  visitTime: string
  wishfulUsers: WishfulUserDisplay[]
  nextTransport?: {
    mode: TransportMode
    duration: string
    destination: string
  }
}

// Map state and interactions
export interface MapState {
  center: google.maps.LatLngLiteral
  zoom: number
  bounds?: google.maps.LatLngBounds
  selectedDestination?: string
  hoveredRoute?: string
  displayMode: MapDisplayMode
  currentDay?: number
}

export interface MapInteraction {
  type: 'marker-click' | 'route-click' | 'map-click' | 'zoom-change' | 'center-change'
  target?: string
  position?: google.maps.LatLngLiteral
  data?: any
}

// Performance optimization
export interface MapPerformanceConfig {
  clusteringEnabled: boolean
  clusteringThreshold: number
  lazyLoadMarkers: boolean
  debounceDelay: number
  maxMarkersVisible: number
}

// Accessibility
export interface MapAccessibilityConfig {
  announceRouteChanges: boolean
  keyboardNavigation: boolean
  highContrastMode: boolean
  reduceMotion: boolean
  screenReaderDescriptions: boolean
}

// Complete map configuration
export interface MapVisualizationConfig {
  mapOptions: google.maps.MapOptions
  controls: MapControlsConfig
  performance: MapPerformanceConfig
  accessibility: MapAccessibilityConfig
  colorStrategy: ColorStrategyConfig
  routeStyles: Record<TransportMode, RouteStyle>
}

export interface ColorStrategyConfig {
  singleUserOpacity: number
  smallGroupBaseColor: string
  popularDestinationColor: string
  popularThreshold: number
  noInterestColor: string
}

// Map component props
export interface MapVisualizationProps {
  itinerary: DetailedItinerary | null
  multiDayItinerary?: MultiDayItinerary | null
  config?: Partial<MapVisualizationConfig>
  onMarkerClick?: (destinationId: string) => void
  onRouteClick?: (segmentId: string) => void
  onMapStateChange?: (state: MapState) => void
  className?: string
  height?: string | number
}

// Map instance management
export interface MapInstance {
  map: google.maps.Map
  markers: Map<string, google.maps.marker.AdvancedMarkerElement>
  routes: Map<string, google.maps.Polyline>
  infoWindows: Map<string, google.maps.InfoWindow>
  controls: Map<string, CustomControl>
  state: MapState
}

// Utility types
export interface BoundsCalculation {
  bounds: google.maps.LatLngBounds
  center: google.maps.LatLngLiteral
  zoom: number
}

export interface ColorBlendResult {
  color: string
  opacity: number
  gradient?: string
}

// Animation configurations
export interface MarkerAnimation {
  type: 'drop' | 'bounce' | 'pulse'
  duration: number
  delay?: number
}

export interface RouteAnimation {
  type: 'draw' | 'dash' | 'fade'
  duration: number
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

// Error states
export interface MapError {
  code: 'LOAD_FAILED' | 'INVALID_DATA' | 'API_ERROR' | 'PERMISSION_DENIED'
  message: string
  fallback?: 'static-image' | 'list-view' | 'retry'
}

// Legend configuration
export interface MapLegend {
  position: google.maps.ControlPosition
  items: LegendItem[]
  collapsible: boolean
  defaultCollapsed: boolean
}

export interface LegendItem {
  type: 'marker' | 'route' | 'info'
  icon?: string
  color?: string
  label: string
  description?: string
}

// Accessibility types
export interface AccessibilityOptions {
  screenReader: boolean
  voiceNavigation: boolean
  highContrast: boolean
  largeText: boolean
  reducedMotion: boolean
  keyboardNavigation: boolean
}

export interface VoiceNavigationState {
  isPlaying: boolean
  currentIndex: number
  autoPlay: boolean
}