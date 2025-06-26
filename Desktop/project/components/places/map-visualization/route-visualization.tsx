// Route visualization with transport mode differentiation

import { useEffect, useRef } from 'react'
import type { RouteSegmentConfig, TransportMode, RouteAnimation } from '@/lib/types/map-visualization'
import { getTransportModeColor } from './color-strategy'

interface RouteVisualizationProps {
  map: google.maps.Map | null
  segments: RouteSegmentConfig[]
  onRouteClick?: (segmentId: string) => void
  animation?: RouteAnimation
  isDarkMode?: boolean
}

// Default route styles by transport mode
const DEFAULT_ROUTE_STYLES: Record<TransportMode, google.maps.PolylineOptions> = {
  walking: {
    strokeColor: '#059669',
    strokeWeight: 3,
    strokeOpacity: 0.8,
    geodesic: true,
    icons: [{
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        scale: 2
      },
      offset: '0',
      repeat: '10px'
    }]
  },
  driving: {
    strokeColor: '#92400E',
    strokeWeight: 4,
    strokeOpacity: 0.8,
    geodesic: true,
    icons: [{
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        scale: 3
      },
      offset: '0',
      repeat: '20px'
    }]
  },
  flying: {
    strokeColor: '#1E3A8A',
    strokeWeight: 5,
    strokeOpacity: 0.8,
    geodesic: true,
    icons: [{
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        scale: 4
      },
      offset: '0',
      repeat: '30px'
    }]
  }
}

export function RouteVisualization({
  map,
  segments,
  onRouteClick,
  animation,
  isDarkMode
}: RouteVisualizationProps) {
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map())
  const labelsRef = useRef<Map<string, google.maps.InfoWindow>>(new Map())
  
  useEffect(() => {
    if (!map || !window.google?.maps) return
    
    // Clear existing polylines
    clearRoutes()
    
    // Create new polylines for each segment
    segments.forEach((segment, index) => {
      const polyline = createRoutePolyline(segment, map, isDarkMode)
      polylinesRef.current.set(segment.id, polyline)
      
      // Add click listener
      if (onRouteClick) {
        polyline.addListener('click', () => onRouteClick(segment.id))
      }
      
      // Create route label
      const label = createRouteLabel(segment, map)
      labelsRef.current.set(segment.id, label)
      
      // Apply animation if specified
      if (animation) {
        applyRouteAnimation(polyline, animation, index * 100)
      }
    })
    
    // Cleanup
    return () => {
      clearRoutes()
    }
  }, [map, segments, onRouteClick, animation, isDarkMode])
  
  const clearRoutes = () => {
    // Clear polylines
    polylinesRef.current.forEach(polyline => {
      polyline.setMap(null)
    })
    polylinesRef.current.clear()
    
    // Clear labels
    labelsRef.current.forEach(label => {
      label.close()
    })
    labelsRef.current.clear()
  }
  
  return null
}

/**
 * Create a polyline for a route segment
 */
function createRoutePolyline(
  segment: RouteSegmentConfig,
  map: google.maps.Map,
  isDarkMode?: boolean
): google.maps.Polyline {
  const baseStyle = DEFAULT_ROUTE_STYLES[segment.transportMode]
  
  // Adjust colors for dark mode
  const strokeColor = isDarkMode 
    ? adjustColorForDarkMode(baseStyle.strokeColor || '#000000')
    : baseStyle.strokeColor
  
  // Create curved path for flights
  const path = segment.transportMode === 'flying' 
    ? createCurvedPath(segment.path)
    : segment.path
  
  const polyline = new google.maps.Polyline({
    ...baseStyle,
    ...segment.style,
    path,
    map,
    strokeColor,
    clickable: true
  })
  
  // Add hover effect
  polyline.addListener('mouseover', () => {
    polyline.setOptions({
      strokeWeight: (baseStyle.strokeWeight || 3) + 2,
      strokeOpacity: 1
    })
  })
  
  polyline.addListener('mouseout', () => {
    polyline.setOptions({
      strokeWeight: baseStyle.strokeWeight,
      strokeOpacity: baseStyle.strokeOpacity
    })
  })
  
  return polyline
}

/**
 * Create curved path for flight routes
 */
function createCurvedPath(path: google.maps.LatLngLiteral[]): google.maps.LatLng[] {
  if (path.length !== 2) return path.map(p => new google.maps.LatLng(p.lat, p.lng))
  
  const start = path[0]
  const end = path[1]
  
  // Calculate great circle route with curve
  const distance = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(start.lat, start.lng),
    new google.maps.LatLng(end.lat, end.lng)
  )
  
  // Only curve for long distances (>500km)
  if (distance < 500000) {
    return path.map(p => new google.maps.LatLng(p.lat, p.lng))
  }
  
  // Create curved path with intermediate points
  const curvedPath: google.maps.LatLng[] = []
  const numPoints = 50
  
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints
    
    // Interpolate along great circle
    const point = google.maps.geometry.spherical.interpolate(
      new google.maps.LatLng(start.lat, start.lng),
      new google.maps.LatLng(end.lat, end.lng),
      fraction
    )
    
    // Add altitude simulation for visual curve
    const altitude = Math.sin(fraction * Math.PI) * 0.15 * Math.abs(end.lng - start.lng)
    const curvedPoint = new google.maps.LatLng(
      point.lat() + altitude,
      point.lng()
    )
    
    curvedPath.push(curvedPoint)
  }
  
  return curvedPath
}

/**
 * Create route label showing transport info
 */
function createRouteLabel(
  segment: RouteSegmentConfig,
  map: google.maps.Map
): google.maps.InfoWindow {
  // Calculate midpoint of route
  const midpoint = segment.path.length === 2
    ? {
        lat: (segment.path[0].lat + segment.path[1].lat) / 2,
        lng: (segment.path[0].lng + segment.path[1].lng) / 2
      }
    : segment.path[Math.floor(segment.path.length / 2)]
  
  // Create label content
  const content = createLabelContent(segment)
  
  const infoWindow = new google.maps.InfoWindow({
    content,
    position: midpoint,
    disableAutoPan: true,
    maxWidth: 150
  })
  
  // Custom styling for minimal overlay
  infoWindow.setOptions({
    pixelOffset: new google.maps.Size(0, -20)
  } as any)
  
  // Show label on map
  infoWindow.open(map)
  
  return infoWindow
}

/**
 * Create label content for route segment
 */
function createLabelContent(segment: RouteSegmentConfig): HTMLElement {
  const container = document.createElement('div')
  container.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #374151;
    background: rgba(255, 255, 255, 0.95);
    padding: 4px 8px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    white-space: nowrap;
  `
  
  // Transport icon
  const modeIcons: Record<TransportMode, string> = {
    walking: '🚶',
    driving: '🚗',
    flying: '✈️'
  }
  
  const icon = document.createElement('span')
  icon.textContent = modeIcons[segment.transportMode]
  icon.style.fontSize = '14px'
  container.appendChild(icon)
  
  // Duration
  const duration = document.createElement('span')
  duration.textContent = formatDuration(segment.duration)
  duration.style.fontWeight = '500'
  container.appendChild(duration)
  
  // Distance for longer routes
  if (segment.distance > 10) {
    const distance = document.createElement('span')
    distance.textContent = `• ${segment.distance.toFixed(0)}km`
    distance.style.color = '#6B7280'
    distance.style.fontSize = '11px'
    container.appendChild(distance)
  }
  
  return container
}

/**
 * Format duration for display
 */
function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`
  }
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (minutes === 0) {
    return `${wholeHours}h`
  }
  return `${wholeHours}h ${minutes}m`
}

/**
 * Apply animation to route
 */
function applyRouteAnimation(
  polyline: google.maps.Polyline,
  animation: RouteAnimation,
  delay: number
) {
  switch (animation.type) {
    case 'draw':
      animateRouteDraw(polyline, animation.duration, delay)
      break
      
    case 'dash':
      animateRouteDash(polyline, animation.duration)
      break
      
    case 'fade':
      animateRouteFade(polyline, animation.duration, delay)
      break
  }
}

/**
 * Animate route drawing
 */
function animateRouteDraw(polyline: google.maps.Polyline, duration: number, delay: number) {
  const path = polyline.getPath()
  const pathArray = path.getArray()
  
  // Hide polyline initially
  polyline.setOptions({ strokeOpacity: 0 })
  
  // Create a new polyline for animation
  const animatedPolyline = new google.maps.Polyline({
    ...polyline.get('options'),
    path: [],
    strokeOpacity: polyline.get('strokeOpacity') || 0.8
  })
  animatedPolyline.setMap(polyline.getMap())
  
  // Animate path
  let step = 0
  const numSteps = pathArray.length
  const interval = duration / numSteps
  
  setTimeout(() => {
    const timer = setInterval(() => {
      if (step >= numSteps) {
        clearInterval(timer)
        // Replace with original polyline
        polyline.setOptions({ strokeOpacity: polyline.get('strokeOpacity') || 0.8 })
        animatedPolyline.setMap(null)
        return
      }
      
      const animatedPath = animatedPolyline.getPath()
      animatedPath.push(pathArray[step])
      step++
    }, interval)
  }, delay)
}

/**
 * Animate route dashing
 */
function animateRouteDash(polyline: google.maps.Polyline, duration: number) {
  let offset = 0
  const icons = polyline.get('icons') || []
  
  if (icons.length === 0) return
  
  const animate = () => {
    offset = (offset + 1) % 200
    
    const updatedIcons = icons.map((icon: any) => ({
      ...icon,
      offset: offset + 'px'
    }))
    
    polyline.setOptions({ icons: updatedIcons })
    
    if (offset < 200) {
      requestAnimationFrame(animate)
    }
  }
  
  animate()
}

/**
 * Animate route fade in
 */
function animateRouteFade(polyline: google.maps.Polyline, duration: number, delay: number) {
  polyline.setOptions({ strokeOpacity: 0 })
  
  setTimeout(() => {
    const targetOpacity = 0.8
    const steps = 30
    const increment = targetOpacity / steps
    let currentOpacity = 0
    
    const timer = setInterval(() => {
      currentOpacity += increment
      if (currentOpacity >= targetOpacity) {
        currentOpacity = targetOpacity
        clearInterval(timer)
      }
      polyline.setOptions({ strokeOpacity: currentOpacity })
    }, duration / steps)
  }, delay)
}

/**
 * Adjust color for dark mode
 */
function adjustColorForDarkMode(color: string): string {
  // Simple brightness adjustment for dark mode
  // In production, use the color strategy utility
  return color
}

/**
 * Create transport legend items
 */
export function createTransportLegendItems() {
  return [
    {
      type: 'route' as const,
      color: '#059669',
      label: 'Walking',
      description: 'Short distances on foot'
    },
    {
      type: 'route' as const,
      color: '#92400E',
      label: 'Driving',
      description: 'Car or bus transport'
    },
    {
      type: 'route' as const,
      color: '#1E3A8A',
      label: 'Flying',
      description: 'Air travel between cities'
    }
  ]
}