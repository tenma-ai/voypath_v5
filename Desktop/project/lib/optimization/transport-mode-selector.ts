// Transport mode selection based on distance

import type { Location } from './types'
import type { TransportMode } from './algorithm-types'
import type { RouteGenerationConfig } from './detailed-route-types'
import { calculateHaversineDistance } from './geographical-clustering'

// Transport mode details
export interface TransportModeDetails {
  mode: TransportMode
  icon: string
  speedKmh: number
  minDistanceKm: number
  maxDistanceKm: number
}

// Default transport configuration
export const DEFAULT_TRANSPORT_CONFIG: Pick<
  RouteGenerationConfig,
  'walkingSpeedKmh' | 'drivingSpeedKmh' | 'flyingSpeedKmh' | 
  'walkingMaxDistanceKm' | 'drivingMaxDistanceKm'
> = {
  walkingSpeedKmh: 5,
  walkingMaxDistanceKm: 2,
  drivingSpeedKmh: 60,
  drivingMaxDistanceKm: 300,
  flyingSpeedKmh: 500
}

// Transport mode definitions
export const TRANSPORT_MODES: TransportModeDetails[] = [
  {
    mode: 'walking',
    icon: '🚶',
    speedKmh: DEFAULT_TRANSPORT_CONFIG.walkingSpeedKmh,
    minDistanceKm: 0,
    maxDistanceKm: DEFAULT_TRANSPORT_CONFIG.walkingMaxDistanceKm
  },
  {
    mode: 'driving',
    icon: '🚗',
    speedKmh: DEFAULT_TRANSPORT_CONFIG.drivingSpeedKmh,
    minDistanceKm: DEFAULT_TRANSPORT_CONFIG.walkingMaxDistanceKm,
    maxDistanceKm: DEFAULT_TRANSPORT_CONFIG.drivingMaxDistanceKm
  },
  {
    mode: 'flying',
    icon: '✈️',
    speedKmh: DEFAULT_TRANSPORT_CONFIG.flyingSpeedKmh,
    minDistanceKm: DEFAULT_TRANSPORT_CONFIG.drivingMaxDistanceKm,
    maxDistanceKm: Infinity
  }
]

/**
 * Determine transport mode based on distance
 */
export function determineTransportMode(
  fromLocation: Location,
  toLocation: Location,
  config: Partial<RouteGenerationConfig> = {}
): {
  mode: TransportMode
  icon: string
  distanceKm: number
  estimatedTimeHours: number
  speedKmh: number
} {
  const finalConfig = { ...DEFAULT_TRANSPORT_CONFIG, ...config }
  
  // Calculate distance
  const distanceKm = calculateHaversineDistance(
    fromLocation.latitude,
    fromLocation.longitude,
    toLocation.latitude,
    toLocation.longitude
  )
  
  // Select transport mode based on distance
  let selectedMode: TransportModeDetails
  
  if (distanceKm <= finalConfig.walkingMaxDistanceKm) {
    selectedMode = TRANSPORT_MODES.find(m => m.mode === 'walking')!
  } else if (distanceKm <= finalConfig.drivingMaxDistanceKm) {
    selectedMode = TRANSPORT_MODES.find(m => m.mode === 'driving')!
  } else {
    selectedMode = TRANSPORT_MODES.find(m => m.mode === 'flying')!
  }
  
  // Update speed from config if provided
  if (config.walkingSpeedKmh && selectedMode.mode === 'walking') {
    selectedMode = { ...selectedMode, speedKmh: config.walkingSpeedKmh }
  } else if (config.drivingSpeedKmh && selectedMode.mode === 'driving') {
    selectedMode = { ...selectedMode, speedKmh: config.drivingSpeedKmh }
  } else if (config.flyingSpeedKmh && selectedMode.mode === 'flying') {
    selectedMode = { ...selectedMode, speedKmh: config.flyingSpeedKmh }
  }
  
  // Calculate travel time
  const estimatedTimeHours = calculateTravelTime(
    distanceKm,
    selectedMode.mode,
    selectedMode.speedKmh
  )
  
  return {
    mode: selectedMode.mode,
    icon: selectedMode.icon,
    distanceKm,
    estimatedTimeHours,
    speedKmh: selectedMode.speedKmh
  }
}

/**
 * Calculate realistic travel time including overhead
 */
export function calculateTravelTime(
  distanceKm: number,
  mode: TransportMode,
  speedKmh: number
): number {
  const baseTime = distanceKm / speedKmh
  
  switch (mode) {
    case 'walking':
      // Add small buffer for rest stops, traffic lights
      return baseTime * 1.1
      
    case 'driving':
      // Add 20% buffer for traffic, parking, rest stops
      return baseTime * 1.2
      
    case 'flying':
      // Add 3 hours for airport procedures
      return baseTime + 3.0
      
    default:
      return baseTime
  }
}

/**
 * Validate transport mode selection
 */
export function validateTransportMode(
  mode: TransportMode,
  distanceKm: number,
  config: Partial<RouteGenerationConfig> = {}
): {
  isValid: boolean
  warnings: string[]
} {
  const finalConfig = { ...DEFAULT_TRANSPORT_CONFIG, ...config }
  const warnings: string[] = []
  
  // Check for very short flights
  if (mode === 'flying' && distanceKm < 100) {
    warnings.push(
      `Flight selected for short distance (${distanceKm.toFixed(0)}km). Consider driving instead.`
    )
  }
  
  // Check for very long walks
  if (mode === 'walking' && distanceKm > 5) {
    warnings.push(
      `Walking selected for long distance (${distanceKm.toFixed(1)}km). This may be impractical.`
    )
  }
  
  // Check for inconsistent mode selection
  if (mode === 'walking' && distanceKm > finalConfig.walkingMaxDistanceKm) {
    warnings.push(
      `Walking selected but distance exceeds typical walking range`
    )
  }
  
  if (mode === 'driving' && distanceKm > finalConfig.drivingMaxDistanceKm) {
    warnings.push(
      `Driving selected but distance exceeds typical driving range`
    )
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}

/**
 * Get transport mode statistics for a journey
 */
export function calculateTransportStats(
  segments: Array<{ mode: TransportMode; distanceKm: number }>
): {
  totalSegments: number
  modeBreakdown: Map<TransportMode, { count: number; totalDistanceKm: number }>
  modeChanges: number
  dominantMode: TransportMode | null
} {
  const modeBreakdown = new Map<
    TransportMode,
    { count: number; totalDistanceKm: number }
  >()
  
  // Initialize breakdown
  for (const mode of ['walking', 'driving', 'flying'] as TransportMode[]) {
    modeBreakdown.set(mode, { count: 0, totalDistanceKm: 0 })
  }
  
  // Calculate statistics
  let previousMode: TransportMode | null = null
  let modeChanges = 0
  
  for (const segment of segments) {
    const stats = modeBreakdown.get(segment.mode)!
    stats.count++
    stats.totalDistanceKm += segment.distanceKm
    
    if (previousMode && previousMode !== segment.mode) {
      modeChanges++
    }
    previousMode = segment.mode
  }
  
  // Find dominant mode by distance
  let dominantMode: TransportMode | null = null
  let maxDistance = 0
  
  for (const [mode, stats] of Array.from(modeBreakdown.entries())) {
    if (stats.totalDistanceKm > maxDistance) {
      maxDistance = stats.totalDistanceKm
      dominantMode = mode
    }
  }
  
  return {
    totalSegments: segments.length,
    modeBreakdown,
    modeChanges,
    dominantMode
  }
}