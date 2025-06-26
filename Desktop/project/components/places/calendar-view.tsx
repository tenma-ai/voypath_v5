'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CalendarDateCell } from './calendar-date-cell'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Grid3X3,
  List,
  ZoomIn,
  ZoomOut,
  CalendarDays
} from 'lucide-react'
import type { 
  DayTimeline, 
  CalendarDisplayMode, 
  TimelineZoomLevel,
  TripBalance,
  TripPatterns 
} from '@/lib/types/calendar-visualization'
// import type { DetailedRouteSegment } from '@/lib/optimization/detailed-route-types' // Type not found
import { 
  createDayTimeline,
  groupSegmentsByDay,
  analyzeTripBalance,
  analyzeTripPatterns,
  determineZoomLevel 
} from '@/lib/utils/calendar-utils'

interface CalendarViewProps {
  routeSegments: any[] // DetailedRouteSegment[] - type temporarily replaced
  userColors?: Map<string, string>
  tripStartDate?: Date
  tripEndDate?: Date
  className?: string
  onDayClick?: (dayTimeline: DayTimeline) => void
  onTimelineEdit?: (dayTimeline: DayTimeline, changes: any) => void
}

interface CalendarHeaderProps {
  currentDate: Date
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  displayMode: CalendarDisplayMode
  onDisplayModeChange: (mode: CalendarDisplayMode) => void
  zoomLevel: TimelineZoomLevel
  onZoomChange: (level: TimelineZoomLevel) => void
  tripBalance?: TripBalance
}

/**
 * Calendar header with navigation and controls
 */
function CalendarHeader({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  onToday,
  displayMode,
  onDisplayModeChange,
  zoomLevel,
  onZoomChange,
  tripBalance
}: CalendarHeaderProps) {
  const monthYear = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Main Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {monthYear}
          </h2>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="h-8 px-3"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Today
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Display Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <Button
              variant={displayMode === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('overview')}
              className="h-7 px-2"
            >
              <Grid3X3 className="h-3 w-3 mr-1" />
              Overview
            </Button>
            
            <Button
              variant={displayMode === 'detailed' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('detailed')}
              className="h-7 px-2"
            >
              <List className="h-3 w-3 mr-1" />
              Detailed
            </Button>
            
            <Button
              variant={displayMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('timeline')}
              className="h-7 px-2"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Timeline
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const levels: TimelineZoomLevel[] = ['compact', 'standard', 'expanded']
                const currentIndex = levels.indexOf(zoomLevel)
                if (currentIndex > 0) {
                  onZoomChange(levels[currentIndex - 1])
                }
              }}
              disabled={zoomLevel === 'compact'}
              className="h-7 w-7 p-0"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const levels: TimelineZoomLevel[] = ['compact', 'standard', 'expanded']
                const currentIndex = levels.indexOf(zoomLevel)
                if (currentIndex < levels.length - 1) {
                  onZoomChange(levels[currentIndex + 1])
                }
              }}
              disabled={zoomLevel === 'expanded'}
              className="h-7 w-7 p-0"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Trip Summary */}
      {tripBalance && (
        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Trip Overview:</span>
            <span className="font-medium">{tripBalance.totalTripDays} days</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span>{tripBalance.lightDays} light</span>
            </div>
            
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full" />
              <span>{tripBalance.totalTripDays - tripBalance.lightDays - tripBalance.packedDays} moderate</span>
            </div>
            
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span>{tripBalance.packedDays} packed</span>
            </div>
          </div>

          {tripBalance.restRecommendation && (
            <div className="text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Consider adding rest days
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Main calendar view component
 */
export function CalendarView({
  routeSegments,
  userColors = new Map(),
  tripStartDate,
  tripEndDate,
  className,
  onDayClick,
  onTimelineEdit
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(tripStartDate || new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('overview')
  const [zoomLevel, setZoomLevel] = useState<TimelineZoomLevel>('standard')

  // Responsive zoom level
  useEffect(() => {
    const handleResize = () => {
      const zoomResult = determineZoomLevel([], window.innerWidth)
      // Map the function result to TimelineZoomLevel
      const mappedZoomLevel: TimelineZoomLevel = 
        zoomResult === 'hour' ? 'compact' :
        zoomResult === 'halfHour' ? 'standard' : 'expanded'
      setZoomLevel(mappedZoomLevel)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Process route segments into day timelines
  const dayTimelines = useMemo(() => {
    const dayGroups = groupSegmentsByDay(routeSegments)
    const timelines: DayTimeline[] = []

    // Create timeline for each day
    Object.entries(dayGroups).forEach(([dateString, segments]) => {
      const date = new Date(dateString)
      
      // Convert timeline blocks to destination visits (simplified)
      const destinationVisits = segments.map((s, index) => ({
        destinationId: s.destination?.destinationId || `dest-${index}`,
        destinationName: s.destination?.destinationName || 'Unknown Place',
        location: s.destination?.location || {
          latitude: 0,
          longitude: 0,
          address: ''
        },
        arrivalTime: new Date(`${dateString} ${s.startTime}`),
        departureTime: new Date(`${dateString} ${s.endTime}`),
        allocatedHours: 1,
        wishfulUsers: s.destination?.wishfulUsers || [],
        isClusterEntry: s.destination?.isClusterEntry || index === 0,
        clusterId: s.destination?.clusterId || 'cluster-1',
        clusterName: s.destination?.clusterName || 'Main Cluster',
        visitOrder: s.destination?.visitOrder || index + 1
      }))

      const transportSegments: any[] = [] // Empty for now

      const dayTimeline = createDayTimeline(
        date,
        destinationVisits,
        transportSegments,
        { userColors: userColors ? Object.fromEntries(userColors) : {} }
      )

      timelines.push(dayTimeline)
    })

    return timelines.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [routeSegments, userColors])

  // Trip analysis
  const tripBalance = useMemo(() => {
    return analyzeTripBalance(dayTimelines)
  }, [dayTimelines])

  const tripPatterns = useMemo(() => {
    return analyzeTripPatterns(dayTimelines)
  }, [dayTimelines])

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() - 1)
      return newDate
    })
  }

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + 1)
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startCalendar = new Date(firstDay)
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay())
    
    const days: Date[] = []
    const current = new Date(startCalendar)
    
    // Generate 6 weeks of days
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }
    }
    
    return days
  }

  const calendarDays = getCalendarDays()
  const today = new Date()

  // Handle day click
  const handleDayClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    const dayTimeline = dayTimelines.find(dt => 
      dt.dateString === dateString
    )
    
    if (dayTimeline) {
      setSelectedDay(dateString)
      onDayClick?.(dayTimeline)
    }
  }

  // Determine cell display mode based on zoom level and display mode
  const getCellDisplayMode = (): 'compact' | 'standard' | 'expanded' => {
    if (displayMode === 'overview') {
      return zoomLevel === 'expanded' ? 'standard' : 'compact'
    } else if (displayMode === 'detailed') {
      return zoomLevel === 'compact' ? 'standard' : 'expanded'
    } else {
      return zoomLevel
    }
  }

  const cellDisplayMode = getCellDisplayMode()

  return (
    <div className={cn("calendar-view", className)}>
      <CalendarHeader
        currentDate={currentDate}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        tripBalance={tripBalance}
      />

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((date, index) => {
          const dateString = date.toISOString().split('T')[0]
          const dayTimeline = dayTimelines.find(dt => dt.dateString === dateString)
          const isCurrentMonth = date.getMonth() === currentDate.getMonth()
          const isToday = date.toDateString() === today.toDateString()
          const isSelected = selectedDay === dateString

          if (!dayTimeline || !isCurrentMonth) {
            // Empty cell for days outside current month or without timeline data
            return (
              <div
                key={index}
                className={cn(
                  "p-2 border border-gray-200 dark:border-gray-700 rounded-lg",
                  !isCurrentMonth && "text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-800/50",
                  cellDisplayMode === 'compact' && "p-1.5",
                  cellDisplayMode === 'expanded' && "p-3"
                )}
              >
                <span className="text-sm">{date.getDate()}</span>
              </div>
            )
          }

          return (
            <CalendarDateCell
              key={dateString}
              dayTimeline={dayTimeline}
              isSelected={isSelected}
              isCurrentDay={isToday}
              displayMode={cellDisplayMode}
              onClick={() => handleDayClick(date)}
              className="min-h-[80px] md:min-h-[120px]"
            />
          )
        })}
      </div>

      {/* Trip Patterns Analysis */}
      {displayMode === 'detailed' && tripPatterns && (
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Trip Patterns Analysis</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Activity Intensity */}
            <div>
              <h4 className="font-medium mb-2">Activity Intensity</h4>
              <div className="space-y-1">
                {tripPatterns.activityIntensity.map((intensity, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="w-12">Day {index + 1}:</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full"
                        style={{ width: `${intensity * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(intensity * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Types */}
            <div>
              <h4 className="font-medium mb-2">Activity Types</h4>
              <div className="space-y-1">
                {tripPatterns.activityTypes.map((activity, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="w-12">Day {index + 1}:</span>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      activity.primaryType === 'urban' && "bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-200",
                      activity.primaryType === 'nature' && "bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-200",
                      activity.primaryType === 'cultural' && "bg-purple-100 text-purple-800 dark:bg-purple-800/30 dark:text-purple-200"
                    )}>
                      {activity.primaryType}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rest Recommendations */}
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <div className="space-y-2 text-sm">
                {tripPatterns.restDayRecommendations.length > 0 ? (
                  tripPatterns.restDayRecommendations.map((date, index) => (
                    <div key={index} className="text-amber-600 dark:text-amber-400">
                      ⚠️ Consider rest on {date}
                    </div>
                  ))
                ) : (
                  <div className="text-green-600 dark:text-green-400">
                    ✅ Trip pacing looks good
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarView