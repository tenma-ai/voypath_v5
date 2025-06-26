// Main interactive map component with mobile-first design

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGoogleMaps } from '@/hooks/use-google-maps'
import { CustomMarker, createInfoWindowContent } from './custom-markers'
import { RouteVisualization } from './route-visualization'
import { MapControls } from './map-controls'
import { AccessibilityFeatures, announceToScreenReader } from './accessibility-features'
import { determineColorTier } from './color-strategy'
import { 
  MobilePerformanceManager, 
  MapMemoryManager,
  ViewportMarkerManager,
  TouchOptimizer
} from './performance-utils'
import type { 
  MapVisualizationProps, 
  MapState, 
  MapInstance, 
  MarkerConfig, 
  RouteSegmentConfig,
  MapDisplayMode,
  WishfulUserDisplay
} from '@/lib/types/map-visualization'
import type { DetailedItinerary, DestinationVisit } from '@/lib/optimization/detailed-route-types'

const DEFAULT_MAP_OPTIONS: google.maps.MapOptions = {
  zoom: 10,
  center: { lat: 35.6762, lng: 139.6503 }, // Tokyo default
  mapTypeId: google.maps.MapTypeId.ROADMAP,
  gestureHandling: 'greedy', // Mobile-friendly
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi.business',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'transit',
      elementType: 'labels.icon',
      stylers: [{ visibility: 'off' }]
    }
  ]
}

// Get adaptive map options based on device performance
function getAdaptiveMapOptions(): google.maps.MapOptions {
  const perfManager = MobilePerformanceManager.getInstance()
  const adaptiveOptions = perfManager.getAdaptiveMapOptions()
  
  return {
    ...DEFAULT_MAP_OPTIONS,
    ...adaptiveOptions
  }
}

export function InteractiveMap({
  itinerary,
  multiDayItinerary,
  config,
  onMarkerClick,
  onRouteClick,
  onMapStateChange,
  className = '',
  height = '400px'
}: MapVisualizationProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapInstance | null>(null)
  const [mapState, setMapState] = useState<MapState>({
    center: { lat: 35.6762, lng: 139.6503 }, // Tokyo default
    zoom: DEFAULT_MAP_OPTIONS.zoom!,
    displayMode: 'full-trip',
    currentDay: 1
  })
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [accessibilityActive, setAccessibilityActive] = useState(false)
  
  // Performance and memory management
  const memoryManagerRef = useRef<MapMemoryManager>()
  const viewportManagerRef = useRef<ViewportMarkerManager>()
  const perfManagerRef = useRef<MobilePerformanceManager>()
  
  const { isLoaded, loadError } = useGoogleMaps()
  
  // Initialize performance managers
  useEffect(() => {
    perfManagerRef.current = MobilePerformanceManager.getInstance()
    memoryManagerRef.current = MapMemoryManager.getInstance()
  }, [])
  
  // Detect dark mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDarkMode(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  // Calculate total days
  const totalDays = multiDayItinerary?.daySchedules.length || 1
  
  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !itinerary) return
    
    try {
      // Use adaptive map options for performance
      const adaptiveOptions = getAdaptiveMapOptions()
      const map = new google.maps.Map(mapRef.current, {
        ...adaptiveOptions,
        ...config?.mapOptions
      })
      
      mapInstanceRef.current = {
        map,
        markers: new Map(),
        routes: new Map(),
        infoWindows: new Map(),
        controls: new Map(),
        state: mapState
      }
      
      // Initialize viewport manager for performance
      if (viewportManagerRef.current) {
        viewportManagerRef.current = new ViewportMarkerManager(
          map, 
          perfManagerRef.current?.getMaxMarkers()
        )
      }
      
      // Setup memory management
      if (memoryManagerRef.current && mapRef.current) {
        memoryManagerRef.current.observeMapContainer(
          mapRef.current,
          () => {
            // Map is visible - resume updates
            map.setOptions({ restriction: null })
          },
          () => {
            // Map is hidden - pause updates for performance
            if (perfManagerRef.current?.getPerformanceTier() === 'low') {
              clearMapElements()
            }
          }
        )
      }
      
      // Add touch optimization
      mapRef.current.addEventListener('touchstart', TouchOptimizer.recordTouch, { passive: true })
      mapRef.current.addEventListener('touchmove', TouchOptimizer.recordTouch, { passive: true })
      mapRef.current.addEventListener('touchend', TouchOptimizer.recordTouch, { passive: true })
      
      // Calculate optimal bounds
      const bounds = calculateMapBounds(itinerary)
      if (bounds) {
        map.fitBounds(bounds)
        setMapState(prev => ({ ...prev, bounds }))
      }
      
      // Announce map load for accessibility
      announceToScreenReader(`Interactive map loaded with ${itinerary.destinationVisits.length} destinations`)
      
      setIsLoading(false)
    } catch (err) {
      console.error('Map initialization error:', err)
      setError('Failed to initialize map')
      setIsLoading(false)
    }
  }, [isLoaded, itinerary, config?.mapOptions])
  
  // Update map display based on mode and current day
  useEffect(() => {
    if (!mapInstanceRef.current || !itinerary) return
    
    const { map } = mapInstanceRef.current
    
    // Clear existing markers and routes
    clearMapElements()
    
    // Get destinations for current display mode
    const displayData = getDisplayData(
      itinerary,
      multiDayItinerary,
      mapState.displayMode,
      mapState.currentDay || 1
    )
    
    if (displayData) {
      // Add markers
      displayData.destinations.forEach((dest: any, index: number) => {
        const markerConfig = createMarkerConfig(dest, index + 1)
        addMarkerToMap(markerConfig)
      })
      
      // Add routes
      displayData.routes.forEach(route => {
        addRouteToMap(route)
      })
      
      // Fit bounds to displayed content
      if (displayData.bounds) {
        map.fitBounds(displayData.bounds)
      }
    }
  }, [mapState.displayMode, mapState.currentDay, itinerary, multiDayItinerary])
  
  // Handle marker click
  const handleMarkerClick = useCallback((destinationId: string) => {
    setSelectedDestination(destinationId)
    
    // Show info window
    const destination = itinerary?.destinationVisits.find(d => d.destinationId === destinationId)
    if (destination && mapInstanceRef.current) {
      showDestinationInfo(destination)
      
      // Announce for accessibility
      const visitOrder = destination.visitOrder
      announceToScreenReader(`Selected destination ${visitOrder}: ${destination.location.name}`)
    }
    
    onMarkerClick?.(destinationId)
  }, [itinerary, onMarkerClick])
  
  // Handle accessibility destination focus
  const handleDestinationFocus = useCallback((destinationId: string) => {
    const destination = itinerary?.destinationVisits.find(d => d.destinationId === destinationId)
    if (destination && mapInstanceRef.current) {
      const { map } = mapInstanceRef.current
      
      // Center map on destination
      map.setCenter({
        lat: destination.location.latitude,
        lng: destination.location.longitude
      })
      map.setZoom(15)
      
      // Highlight marker
      setSelectedDestination(destinationId)
      showDestinationInfo(destination)
    }
  }, [itinerary])
  
  // Handle map state changes
  const handleMapStateChange = useCallback((updates: Partial<MapState>) => {
    setMapState(prev => {
      const newState = { ...prev, ...updates }
      mapInstanceRef.current!.state = newState
      onMapStateChange?.(newState)
      return newState
    })
  }, [onMapStateChange])
  
  // Handle display mode change
  const handleDisplayModeChange = useCallback((mode: MapDisplayMode) => {
    handleMapStateChange({ displayMode: mode })
  }, [handleMapStateChange])
  
  // Handle day change
  const handleDayChange = useCallback((day: number) => {
    if (day >= 1 && day <= totalDays) {
      handleMapStateChange({ currentDay: day })
    }
  }, [totalDays, handleMapStateChange])
  
  // Clear map elements
  const clearMapElements = () => {
    if (!mapInstanceRef.current) return
    
    const { markers, routes, infoWindows } = mapInstanceRef.current
    
    markers.forEach(marker => {
      marker.map = null
    })
    markers.clear()
    
    routes.forEach(route => {
      route.setMap(null)
    })
    routes.clear()
    
    infoWindows.forEach(window => {
      window.close()
    })
    infoWindows.clear()
  }
  
  // Add marker to map
  const addMarkerToMap = (config: MarkerConfig) => {
    if (!mapInstanceRef.current) return
    
    const { map, markers } = mapInstanceRef.current
    
    // Remove existing marker if it exists
    const existingMarker = markers.get(config.destinationId)
    if (existingMarker) {
      existingMarker.map = null
    }
    
    // Create new marker
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: config.position,
      content: createMarkerContent(config),
      title: `Destination ${config.orderNumber}`
    })
    
    // Add click listener
    marker.addListener('click', () => handleMarkerClick(config.destinationId))
    
    markers.set(config.destinationId, marker)
  }
  
  // Add route to map
  const addRouteToMap = (route: RouteSegmentConfig) => {
    if (!mapInstanceRef.current) return
    
    const { map, routes } = mapInstanceRef.current
    
    const polyline = new google.maps.Polyline({
      path: route.path,
      ...route.style,
      map
    })
    
    if (onRouteClick) {
      polyline.addListener('click', () => onRouteClick(route.id))
    }
    
    routes.set(route.id, polyline)
  }
  
  // Show destination info window
  const showDestinationInfo = (destination: DestinationVisit) => {
    if (!mapInstanceRef.current) return
    
    const { map, infoWindows } = mapInstanceRef.current
    
    // Close existing info windows
    infoWindows.forEach(window => window.close())
    infoWindows.clear()
    
    // Create info window content
    const content = createInfoWindowContent(
      createMarkerConfig(destination, destination.visitOrder),
      `${destination.allocatedHours}h visit`
    )
    
    const infoWindow = new google.maps.InfoWindow({
      content,
      position: {
        lat: destination.location.latitude,
        lng: destination.location.longitude
      },
      maxWidth: 300
    })
    
    infoWindow.open(map)
    infoWindows.set(destination.destinationId, infoWindow)
  }
  
  // Error and loading states
  if (loadError) {
    return (
      <div className={`map-error ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="text-gray-500 mb-2">Failed to load map</div>
            <button 
              onClick={() => window.location.reload()}
              className="text-blue-500 hover:text-blue-600"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (isLoading || !isLoaded) {
    return (
      <div className={`map-loading ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={`map-error ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="text-red-500 mb-2">{error}</div>
            <button 
              onClick={() => setError(null)}
              className="text-blue-500 hover:text-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (memoryManagerRef.current) {
        memoryManagerRef.current.cleanupAll()
      }
      TouchOptimizer.clearHistory()
    }
  }, [])

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Map container */}
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg overflow-hidden"
        role="application"
        aria-label={`Interactive trip map with ${itinerary?.destinationVisits?.length || 0} destinations`}
        tabIndex={0}
        onFocus={() => setAccessibilityActive(true)}
        onBlur={() => setAccessibilityActive(false)}
        id="map-content"
      />
      
      {/* Map controls */}
      {mapInstanceRef.current && (
        <MapControls
          map={mapInstanceRef.current.map}
          mapState={mapState}
          onMapStateChange={handleMapStateChange}
          onDisplayModeChange={handleDisplayModeChange}
          totalDays={totalDays}
          currentDay={mapState.currentDay}
          onDayChange={handleDayChange}
          isDarkMode={isDarkMode}
        />
      )}
      
      {/* Accessibility features */}
      <AccessibilityFeatures
        itinerary={itinerary}
        onDestinationFocus={handleDestinationFocus}
        onRouteAnnounce={(segment) => {
          // Handle route announcement
          announceToScreenReader(`Next: ${segment.transportMode} for ${segment.duration} to ${segment.toName}`)
        }}
        isActive={accessibilityActive}
      />
      
      {/* Performance indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceIndicator />
      )}
    </div>
  )
}

// Helper functions

function calculateMapBounds(itinerary: DetailedItinerary): google.maps.LatLngBounds | null {
  if (!itinerary.destinationVisits.length) return null
  
  const bounds = new google.maps.LatLngBounds()
  
  itinerary.destinationVisits.forEach(dest => {
    bounds.extend({
      lat: dest.location.latitude,
      lng: dest.location.longitude
    })
  })
  
  return bounds
}

function getDisplayData(
  itinerary: DetailedItinerary,
  multiDayItinerary: any,
  mode: MapDisplayMode,
  currentDay: number
) {
  if (mode === 'full-trip') {
    return {
      destinations: itinerary.destinationVisits,
      routes: createRouteSegments(itinerary),
      bounds: calculateMapBounds(itinerary)
    }
  }
  
  if (mode === 'daily' && multiDayItinerary) {
    const daySchedule = multiDayItinerary.dailySchedules[currentDay - 1]
    if (!daySchedule) return null
    
    const dayDestinations = daySchedule.activities
      .filter((a: any) => a.type === 'destination')
      .map((a: any) => a.visitDetails)
      .filter(Boolean)
    
    return {
      destinations: dayDestinations,
      routes: createDayRouteSegments(daySchedule),
      bounds: calculateDayBounds(dayDestinations)
    }
  }
  
  return null
}

function createMarkerConfig(destination: DestinationVisit, orderNumber: number): MarkerConfig {
  const wishfulUsers: WishfulUserDisplay[] = destination.wishfulUsers.map(wu => ({
    userId: wu.member.user_id || wu.member.session_id || '',
    displayName: wu.member.display_name,
    color: wu.assignedColor,
    rating: wu.originalRating
  }))
  
  return {
    destinationId: destination.destinationId,
    position: {
      lat: destination.location.latitude,
      lng: destination.location.longitude
    },
    color: determineColorTier(wishfulUsers).color,
    size: 32,
    orderNumber,
    wishfulUsers
  }
}

function createRouteSegments(itinerary: DetailedItinerary): RouteSegmentConfig[] {
  return itinerary.transportSegments.map((segment, index) => ({
    id: segment.segmentId,
    path: [
      { lat: segment.fromLocation.latitude, lng: segment.fromLocation.longitude },
      { lat: segment.toLocation.latitude, lng: segment.toLocation.longitude }
    ],
    transportMode: segment.transportMode as any,
    style: getRouteStyle(segment.transportMode as any),
    distance: segment.distanceKm,
    duration: segment.estimatedTimeHours,
    fromName: segment.fromName,
    toName: segment.toName
  }))
}

function createDayRouteSegments(daySchedule: any): RouteSegmentConfig[] {
  // Implementation for daily route segments
  return []
}

function calculateDayBounds(destinations: DestinationVisit[]): google.maps.LatLngBounds | null {
  if (!destinations.length) return null
  
  const bounds = new google.maps.LatLngBounds()
  destinations.forEach(dest => {
    bounds.extend({
      lat: dest.location.latitude,
      lng: dest.location.longitude
    })
  })
  
  return bounds
}

function getRouteStyle(mode: 'walking' | 'driving' | 'flying') {
  const styles = {
    walking: { strokeColor: '#059669', strokeWeight: 3, strokeOpacity: 0.8 },
    driving: { strokeColor: '#92400E', strokeWeight: 4, strokeOpacity: 0.8 },
    flying: { strokeColor: '#1E3A8A', strokeWeight: 5, strokeOpacity: 0.8 }
  }
  return styles[mode]
}

function createMarkerContent(config: MarkerConfig): HTMLElement {
  const container = document.createElement('div')
  container.className = 'custom-marker'
  container.style.cssText = `
    width: ${config.size}px;
    height: ${config.size}px;
    background-color: ${config.color};
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    cursor: pointer;
  `
  
  container.textContent = config.orderNumber.toString()
  return container
}

/**
 * Performance indicator component for development
 */
function PerformanceIndicator() {
  const [perfData, setPerfData] = useState({
    tier: 'unknown' as 'high' | 'medium' | 'low' | 'unknown',
    fps: 0,
    memory: null as any
  })
  
  useEffect(() => {
    const perfManager = MobilePerformanceManager.getInstance()
    const memoryManager = MapMemoryManager.getInstance()
    
    const updatePerf = () => {
      setPerfData({
        tier: perfManager.getPerformanceTier(),
        fps: 0, // Would be updated by frame rate monitor
        memory: memoryManager.getMemoryUsage()
      })
    }
    
    updatePerf()
    const interval = setInterval(updatePerf, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-2 rounded font-mono">
      <div>Tier: {perfData.tier}</div>
      {perfData.memory && (
        <div>Memory: {Math.round(perfData.memory.percentage)}%</div>
      )}
    </div>
  )
}