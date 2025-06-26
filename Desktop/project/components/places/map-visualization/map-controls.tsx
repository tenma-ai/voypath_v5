// Mobile-friendly map controls and UI

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Info, Layers, Navigation, Maximize2, List } from 'lucide-react'
import type { MapState, MapDisplayMode, MapLegend, LegendItem } from '@/lib/types/map-visualization'
import { createColorLegendItems } from './color-strategy'
import { createTransportLegendItems } from './route-visualization'

interface MapControlsProps {
  map: google.maps.Map | null
  mapState: MapState
  onMapStateChange: (state: Partial<MapState>) => void
  onDisplayModeChange: (mode: MapDisplayMode) => void
  totalDays?: number
  currentDay?: number
  onDayChange?: (day: number) => void
  isDarkMode?: boolean
  className?: string
}

export function MapControls({
  map,
  mapState,
  onMapStateChange,
  onDisplayModeChange,
  totalDays,
  currentDay,
  onDayChange,
  isDarkMode,
  className
}: MapControlsProps) {
  const [isLegendOpen, setIsLegendOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Handle fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])
  
  const toggleFullscreen = async () => {
    if (!map) return
    
    const mapContainer = map.getDiv().parentElement
    if (!mapContainer) return
    
    try {
      if (!document.fullscreenElement) {
        await mapContainer.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }
  
  const centerOnCurrentLocation = () => {
    if (!navigator.geolocation || !map) return
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        map.setCenter(pos)
        map.setZoom(15)
        
        // Add current location marker
        new google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          title: 'Your location'
        })
      },
      (error) => {
        console.error('Geolocation error:', error)
      }
    )
  }
  
  const resetMapView = () => {
    if (!map || !mapState.bounds) return
    map.fitBounds(mapState.bounds)
  }
  
  return (
    <div className={`map-controls ${className || ''}`}>
      {/* Mobile-optimized control buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Display mode toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-1">
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant={mapState.displayMode === 'full-trip' ? 'default' : 'ghost'}
              onClick={() => onDisplayModeChange('full-trip')}
              className="justify-start text-xs"
              aria-label="Show full trip"
            >
              <List className="w-4 h-4 mr-1" />
              Full Trip
            </Button>
            {totalDays && totalDays > 1 && (
              <Button
                size="sm"
                variant={mapState.displayMode === 'daily' ? 'default' : 'ghost'}
                onClick={() => onDisplayModeChange('daily')}
                className="justify-start text-xs"
                aria-label="Show daily view"
              >
                <Layers className="w-4 h-4 mr-1" />
                Daily
              </Button>
            )}
          </div>
        </div>
        
        {/* Day selector for daily mode */}
        {mapState.displayMode === 'daily' && totalDays && totalDays > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Day {currentDay || 1} of {totalDays}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDayChange?.((currentDay || 1) - 1)}
                disabled={currentDay === 1}
                className="flex-1 text-xs"
                aria-label="Previous day"
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDayChange?.((currentDay || 1) + 1)}
                disabled={currentDay === totalDays}
                className="flex-1 text-xs"
                aria-label="Next day"
              >
                Next
              </Button>
            </div>
          </div>
        )}
        
        {/* Utility controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-1 flex flex-col gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={centerOnCurrentLocation}
            className="w-10 h-10"
            aria-label="Center on current location"
          >
            <Navigation className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={resetMapView}
            className="w-10 h-10"
            aria-label="Reset map view"
          >
            <Maximize2 className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="w-10 h-10"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </Button>
        </div>
      </div>
      
      {/* Legend button */}
      <div className="absolute bottom-4 left-4 z-10">
        <Sheet open={isLegendOpen} onOpenChange={setIsLegendOpen}>
          <SheetTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="shadow-md"
              aria-label="Show map legend"
            >
              <Info className="w-4 h-4 mr-2" />
              Legend
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Map Legend</SheetTitle>
            </SheetHeader>
            <MapLegendContent isDarkMode={isDarkMode} />
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Touch gesture hints */}
      <TouchGestureHints />
    </div>
  )
}

/**
 * Map legend content
 */
function MapLegendContent({ isDarkMode }: { isDarkMode?: boolean }) {
  const colorItems = createColorLegendItems()
  const transportItems = createTransportLegendItems()
  
  return (
    <div className="mt-4 space-y-6">
      {/* Destination colors */}
      <div>
        <h3 className="font-medium text-sm mb-3">Destination Colors</h3>
        <div className="space-y-2">
          {colorItems.map((item, index) => (
            <LegendItemRow key={index} item={item} />
          ))}
        </div>
      </div>
      
      {/* Transport modes */}
      <div>
        <h3 className="font-medium text-sm mb-3">Transport Modes</h3>
        <div className="space-y-2">
          {transportItems.map((item, index) => (
            <LegendItemRow key={index} item={item} />
          ))}
        </div>
      </div>
      
      {/* Interactions */}
      <div>
        <h3 className="font-medium text-sm mb-3">Map Interactions</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div>• <strong>Tap marker:</strong> View destination details</div>
          <div>• <strong>Long press marker:</strong> Show user preferences</div>
          <div>• <strong>Pinch:</strong> Zoom in/out</div>
          <div>• <strong>Drag:</strong> Pan around map</div>
          <div>• <strong>Double tap:</strong> Zoom to location</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Legend item row
 */
function LegendItemRow({ item }: { item: LegendItem }) {
  return (
    <div className="flex items-center gap-3">
      {item.type === 'marker' ? (
        <div
          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: item.color }}
        />
      ) : item.type === 'route' ? (
        <div
          className="w-8 h-1 rounded"
          style={{ backgroundColor: item.color }}
        />
      ) : null}
      <div className="flex-1">
        <div className="text-sm font-medium">{item.label}</div>
        {item.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {item.description}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Touch gesture hints for first-time users
 */
function TouchGestureHints() {
  const [showHints, setShowHints] = useState(false)
  
  useEffect(() => {
    // Show hints for first-time users
    const hasSeenHints = localStorage.getItem('map-hints-seen')
    if (!hasSeenHints) {
      setShowHints(true)
      setTimeout(() => {
        setShowHints(false)
        localStorage.setItem('map-hints-seen', 'true')
      }, 5000)
    }
  }, [])
  
  if (!showHints) return null
  
  return (
    <div className="absolute inset-x-4 top-20 z-20 pointer-events-none">
      <div className="bg-black/80 text-white text-sm rounded-lg p-3 text-center animate-pulse">
        <div className="mb-1 font-medium">Touch Gestures</div>
        <div className="flex justify-around text-xs">
          <div>👆 Tap</div>
          <div>🤏 Pinch</div>
          <div>👆👆 Double</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Create custom map control
 */
export function createCustomControl(
  controlDiv: HTMLElement,
  map: google.maps.Map,
  options: {
    position: google.maps.ControlPosition
    title: string
    icon: string
    onClick: () => void
  }
) {
  // Create control UI
  const controlUI = document.createElement('button')
  controlUI.className = 'custom-map-control'
  controlUI.title = options.title
  controlUI.style.cssText = `
    background-color: #fff;
    border: 2px solid #fff;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,.3);
    cursor: pointer;
    margin: 10px;
    padding: 8px;
    text-align: center;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `
  controlDiv.appendChild(controlUI)
  
  // Create control icon
  const controlIcon = document.createElement('div')
  controlIcon.innerHTML = options.icon
  controlIcon.style.cssText = `
    font-size: 20px;
    line-height: 1;
  `
  controlUI.appendChild(controlIcon)
  
  // Setup click event
  controlUI.addEventListener('click', options.onClick)
  
  // Add hover effects
  controlUI.addEventListener('mouseenter', () => {
    controlUI.style.backgroundColor = '#f5f5f5'
  })
  
  controlUI.addEventListener('mouseleave', () => {
    controlUI.style.backgroundColor = '#fff'
  })
  
  // Add to map
  map.controls[options.position].push(controlDiv)
}