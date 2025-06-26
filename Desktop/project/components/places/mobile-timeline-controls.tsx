'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  ZoomIn,
  ZoomOut,
  Clock,
  Users,
  MapPin,
  MoreHorizontal,
  Settings
} from 'lucide-react'
import type { 
  CalendarDisplayMode, 
  TimelineZoomLevel,
  DayTimeline 
} from '@/lib/types/calendar-visualization'

interface MobileTimelineControlsProps {
  currentDay?: DayTimeline
  displayMode: CalendarDisplayMode
  zoomLevel: TimelineZoomLevel
  canNavigate?: {
    previousDay: boolean
    nextDay: boolean
  }
  onDisplayModeChange: (mode: CalendarDisplayMode) => void
  onZoomChange: (level: TimelineZoomLevel) => void
  onNavigateDay?: (direction: 'previous' | 'next') => void
  onSettingsOpen?: () => void
  className?: string
}

interface SwipeGestureHook {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

/**
 * Custom hook for swipe gestures
 */
function useSwipeGesture({ 
  onSwipeLeft, 
  onSwipeRight, 
  threshold = 50 
}: SwipeGestureHook) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setTouchEnd(null)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    setTouchEnd({ x: touch.clientX, y: touch.clientY })
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distanceX = touchStart.x - touchEnd.x
    const distanceY = Math.abs(touchStart.y - touchEnd.y)
    
    // Only trigger swipe if horizontal distance is greater than vertical (horizontal swipe)
    if (Math.abs(distanceX) > threshold && Math.abs(distanceX) > distanceY) {
      if (distanceX > 0) {
        // Swipe left
        onSwipeLeft?.()
      } else {
        // Swipe right  
        onSwipeRight?.()
      }
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  }
}

/**
 * Day navigation component with swipe support
 */
function DayNavigator({ 
  currentDay, 
  canNavigate, 
  onNavigateDay 
}: {
  currentDay?: DayTimeline
  canNavigate?: { previousDay: boolean; nextDay: boolean }
  onNavigateDay?: (direction: 'previous' | 'next') => void
}) {
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => canNavigate?.nextDay && onNavigateDay?.('next'),
    onSwipeRight: () => canNavigate?.previousDay && onNavigateDay?.('previous')
  })

  if (!currentDay) return null

  const dateString = currentDay.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  })

  return (
    <div 
      className="flex items-center justify-between py-2 px-1 touch-manipulation"
      {...swipeHandlers}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigateDay?.('previous')}
        disabled={!canNavigate?.previousDay}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 text-center">
        <div className="font-medium text-sm">{dateString}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {currentDay.dailyStats.totalDestinations} places • {' '}
          <span className={cn(
            "capitalize",
            currentDay.dailyStats.dayCompactness === 'light' && "text-green-600 dark:text-green-400",
            currentDay.dailyStats.dayCompactness === 'moderate' && "text-yellow-600 dark:text-yellow-400", 
            currentDay.dailyStats.dayCompactness === 'packed' && "text-red-600 dark:text-red-400"
          )}>
            {currentDay.dailyStats.dayCompactness}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigateDay?.('next')}
        disabled={!canNavigate?.nextDay}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * View mode selector with haptic feedback
 */
function ViewModeSelector({
  displayMode,
  onDisplayModeChange
}: {
  displayMode: CalendarDisplayMode
  onDisplayModeChange: (mode: CalendarDisplayMode) => void
}) {
  const handleModeChange = (mode: CalendarDisplayMode) => {
    // Haptic feedback for supported devices
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
    onDisplayModeChange(mode)
  }

  const modes: { key: CalendarDisplayMode; icon: React.ReactNode; label: string }[] = [
    { key: 'overview', icon: <Grid className="h-3 w-3" />, label: 'Grid' },
    { key: 'timeline', icon: <Clock className="h-3 w-3" />, label: 'Timeline' },
    { key: 'detailed', icon: <List className="h-3 w-3" />, label: 'List' }
  ]

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {modes.map((mode) => (
        <Button
          key={mode.key}
          variant={displayMode === mode.key ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange(mode.key)}
          className="h-7 px-2 text-xs"
        >
          {mode.icon}
          <span className="ml-1 hidden sm:inline">{mode.label}</span>
        </Button>
      ))}
    </div>
  )
}

/**
 * Zoom controls with pinch gesture support
 */
function ZoomControls({
  zoomLevel,
  onZoomChange
}: {
  zoomLevel: TimelineZoomLevel
  onZoomChange: (level: TimelineZoomLevel) => void
}) {
  const levels: TimelineZoomLevel[] = ['compact', 'standard', 'expanded']
  const currentIndex = levels.indexOf(zoomLevel)

  const handleZoomIn = () => {
    if (currentIndex < levels.length - 1) {
      onZoomChange(levels[currentIndex + 1])
    }
  }

  const handleZoomOut = () => {
    if (currentIndex > 0) {
      onZoomChange(levels[currentIndex - 1])
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleZoomOut}
        disabled={currentIndex === 0}
        className="h-7 w-7 p-0"
      >
        <ZoomOut className="h-3 w-3" />
      </Button>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 px-2 min-w-16 text-center">
        {zoomLevel}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleZoomIn}
        disabled={currentIndex === levels.length - 1}
        className="h-7 w-7 p-0"
      >
        <ZoomIn className="h-3 w-3" />
      </Button>
    </div>
  )
}

/**
 * Quick stats display for mobile
 */
function QuickStats({ dayTimeline }: { dayTimeline: DayTimeline }) {
  const { dailyStats } = dayTimeline
  
  return (
    <div className="flex items-center justify-between py-2 text-xs text-gray-600 dark:text-gray-400">
      <div className="flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        <span>{dailyStats.totalDestinations}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>{dailyStats.earliestStart} - {dailyStats.latestEnd}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        <span>
          {dailyStats.totalActivityTime + dailyStats.totalWalkingTime + dailyStats.totalDrivingTime}min
        </span>
      </div>
      
      {dailyStats.recommendedBreaks > 0 && (
        <div className="text-amber-600 dark:text-amber-400 font-medium">
          ⚠️ {dailyStats.recommendedBreaks}
        </div>
      )}
    </div>
  )
}

/**
 * Main mobile timeline controls component
 */
export function MobileTimelineControls({
  currentDay,
  displayMode,
  zoomLevel,
  canNavigate,
  onDisplayModeChange,
  onZoomChange,
  onNavigateDay,
  onSettingsOpen,
  className
}: MobileTimelineControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Auto-collapse when display mode changes
  useEffect(() => {
    setIsExpanded(false)
  }, [displayMode])

  return (
    <div className={cn(
      "mobile-timeline-controls bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700",
      "sticky bottom-0 z-30 safe-area-pb",
      className
    )}>
      {/* Quick Stats (when day is selected) */}
      {currentDay && !isExpanded && (
        <QuickStats dayTimeline={currentDay} />
      )}

      {/* Main Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: View Mode */}
        <ViewModeSelector
          displayMode={displayMode}
          onDisplayModeChange={onDisplayModeChange}
        />

        {/* Center: Day Navigation (when timeline mode) */}
        {displayMode === 'timeline' && currentDay && (
          <div className="flex-1 mx-4">
            <DayNavigator
              currentDay={currentDay}
              canNavigate={canNavigate}
              onNavigateDay={onNavigateDay}
            />
          </div>
        )}

        {/* Right: Zoom and Settings */}
        <div className="flex items-center gap-2">
          {(displayMode === 'timeline' || displayMode === 'detailed') && (
            <ZoomControls
              zoomLevel={zoomLevel}
              onZoomChange={onZoomChange}
            />
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 md:hidden"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsOpen}
            className="h-7 w-7 p-0 hidden md:flex"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Controls (Mobile) */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
          {/* Additional day info */}
          {currentDay && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Activity time:</span>
                <div className="font-medium">
                  {Math.round(currentDay.dailyStats.totalActivityTime / 60 * 10) / 10}h
                </div>
              </div>
              
              <div>
                <span className="text-gray-500 dark:text-gray-400">Free time:</span>
                <div className="font-medium text-green-600 dark:text-green-400">
                  {Math.round(currentDay.dailyStats.totalFreeTime / 60 * 10) / 10}h
                </div>
              </div>
              
              <div>
                <span className="text-gray-500 dark:text-gray-400">Travel time:</span>
                <div className="font-medium">
                  {Math.round((currentDay.dailyStats.totalWalkingTime + currentDay.dailyStats.totalDrivingTime) / 60 * 10) / 10}h
                </div>
              </div>
              
              <div>
                <span className="text-gray-500 dark:text-gray-400">Compactness:</span>
                <div className={cn(
                  "font-medium capitalize",
                  currentDay.dailyStats.dayCompactness === 'light' && "text-green-600 dark:text-green-400",
                  currentDay.dailyStats.dayCompactness === 'moderate' && "text-yellow-600 dark:text-yellow-400",
                  currentDay.dailyStats.dayCompactness === 'packed' && "text-red-600 dark:text-red-400"
                )}>
                  {currentDay.dailyStats.dayCompactness}
                </div>
              </div>
            </div>
          )}

          {/* Settings button */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={onSettingsOpen}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Timeline Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileTimelineControls