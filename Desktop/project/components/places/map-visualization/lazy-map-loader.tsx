// Lazy map loader with intersection observer for performance
'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useInView } from 'react-intersection-observer'
import dynamic from 'next/dynamic'
import { MapVisualizationProps } from '@/lib/types/map-visualization'
import { Skeleton } from '@/components/ui/skeleton'

// Dynamically import the heavy map component
const InteractiveMap = dynamic(
  () => import('./interactive-map').then(mod => ({ default: mod.InteractiveMap })),
  {
    loading: () => <MapSkeleton />,
    ssr: false // Disable SSR for map to reduce initial bundle
  }
)

interface LazyMapLoaderProps extends MapVisualizationProps {
  loadThreshold?: number
  rootMargin?: string
  enablePreload?: boolean
  fallbackHeight?: string
}

export function LazyMapLoader({
  loadThreshold = 0.1,
  rootMargin = '100px',
  enablePreload = true,
  fallbackHeight = '400px',
  ...mapProps
}: LazyMapLoaderProps) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isPreloading, setIsPreloading] = useState(false)
  const loadTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Intersection observer to detect when map enters viewport
  const { ref, inView } = useInView({
    threshold: loadThreshold,
    rootMargin,
    triggerOnce: true
  })
  
  // Network-aware loading
  useEffect(() => {
    if (!inView) return
    
    // Check connection quality
    const connection = (navigator as any).connection
    const isSlowConnection = connection && (
      connection.effectiveType === 'slow-2g' ||
      connection.effectiveType === '2g' ||
      connection.saveData
    )
    
    // Delay loading on slow connections
    const delay = isSlowConnection ? 1000 : 200
    
    loadTimeoutRef.current = setTimeout(() => {
      setShouldLoad(true)
    }, delay)
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
    }
  }, [inView])
  
  // Preload map assets when user is likely to need them
  useEffect(() => {
    if (!enablePreload) return
    
    const preloadTriggers = [
      'mouseenter',
      'touchstart',
      'focus',
      'scroll'
    ]
    
    const startPreload = () => {
      if (isPreloading) return
      setIsPreloading(true)
      
      // Preload Google Maps API if not already loaded
      if (!window.google?.maps) {
        const link = document.createElement('link')
        link.rel = 'dns-prefetch'
        link.href = 'https://maps.googleapis.com'
        document.head.appendChild(link)
      }
    }
    
    preloadTriggers.forEach(event => {
      document.addEventListener(event, startPreload, { 
        once: true, 
        passive: true 
      })
    })
    
    return () => {
      preloadTriggers.forEach(event => {
        document.removeEventListener(event, startPreload)
      })
    }
  }, [enablePreload, isPreloading])
  
  return (
    <div 
      ref={ref}
      className={`map-loader-container ${mapProps.className || ''}`}
      style={{ 
        height: mapProps.height || fallbackHeight,
        minHeight: '200px'
      }}
    >
      {shouldLoad ? (
        <ErrorBoundary fallback={() => <MapError />}>
          <Suspense fallback={<MapSkeleton />}>
            <InteractiveMap {...mapProps} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <MapPlaceholder 
          onLoadRequest={() => setShouldLoad(true)}
          height={String(mapProps.height || fallbackHeight)}
        />
      )}
    </div>
  )
}

/**
 * Map skeleton loading state
 */
function MapSkeleton() {
  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg relative overflow-hidden">
      <Skeleton className="w-full h-full" />
      
      {/* Simulate map elements */}
      <div className="absolute inset-0 p-4">
        {/* Control buttons skeleton */}
        <div className="absolute top-4 right-4 space-y-2">
          <Skeleton className="w-12 h-8 rounded" />
          <Skeleton className="w-12 h-8 rounded" />
          <Skeleton className="w-12 h-8 rounded" />
        </div>
        
        {/* Legend button skeleton */}
        <div className="absolute bottom-4 left-4">
          <Skeleton className="w-20 h-8 rounded" />
        </div>
        
        {/* Simulate markers */}
        <div className="absolute top-1/3 left-1/3">
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
        <div className="absolute top-1/2 right-1/3">
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
        <div className="absolute bottom-1/3 left-1/2">
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
      
      {/* Loading text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          Loading map...
        </div>
      </div>
    </div>
  )
}

/**
 * Map placeholder before loading
 */
function MapPlaceholder({ 
  onLoadRequest, 
  height 
}: { 
  onLoadRequest: () => void
  height: string 
}) {
  return (
    <div 
      className="w-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border-2 border-dashed border-blue-200 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:from-blue-100 hover:to-blue-150 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-colors"
      style={{ height }}
      onClick={onLoadRequest}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onLoadRequest()
        }
      }}
      aria-label="Load interactive map"
    >
      {/* Map icon */}
      <div className="w-16 h-16 mb-4 bg-blue-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
        <svg 
          className="w-8 h-8 text-blue-600 dark:text-gray-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
          />
        </svg>
      </div>
      
      {/* Call to action */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Interactive Route Map
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-xs">
          Tap to load your optimized travel route with destinations and transport modes
        </p>
        <div className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Load Map
        </div>
      </div>
      
      {/* Network status indicator */}
      <NetworkStatusIndicator />
    </div>
  )
}

/**
 * Network status indicator for performance awareness
 */
function NetworkStatusIndicator() {
  const [connectionType, setConnectionType] = useState<string>('')
  
  useEffect(() => {
    const connection = (navigator as any).connection
    if (connection) {
      setConnectionType(connection.effectiveType || 'unknown')
      
      const updateConnection = () => {
        setConnectionType(connection.effectiveType || 'unknown')
      }
      
      connection.addEventListener('change', updateConnection)
      return () => connection.removeEventListener('change', updateConnection)
    }
  }, [])
  
  if (!connectionType || connectionType === 'unknown') return null
  
  const isSlowConnection = connectionType === 'slow-2g' || connectionType === '2g'
  
  return (
    <div className="absolute top-2 right-2">
      <div className={`px-2 py-1 rounded text-xs font-medium ${
        isSlowConnection 
          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      }`}>
        {connectionType.toUpperCase()}
      </div>
    </div>
  )
}

/**
 * Map error fallback
 */
function MapError() {
  return (
    <div className="w-full h-full bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
      <div className="w-12 h-12 mb-4 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
        Failed to load map
      </h3>
      <p className="text-xs text-red-700 dark:text-red-300 text-center max-w-xs mb-4">
        There was an error loading the interactive map. Please check your connection and try again.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

/**
 * Error boundary for map component
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError(_: Error) {
    return { hasError: true }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Map component error:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback
      return <Fallback />
    }
    
    return this.props.children
  }
}

import React from 'react'