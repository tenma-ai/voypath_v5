'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CalendarView } from './calendar-view'
import { DetailedTimelineView } from './detailed-timeline-view'
import { MobileTimelineControls } from './mobile-timeline-controls'
import { AccessibleTimeline } from './accessible-timeline'
import { TimelineSettings, defaultTimelineSettings } from './timeline-settings'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  Calendar,
  Clock,
  List,
  Settings,
  Map,
  Share2
} from 'lucide-react'
import type { 
  DayTimeline, 
  CalendarDisplayMode
  // TimelineSettings as ITimelineSettings - not exported yet
} from '@/lib/types/calendar-visualization'
// import type { OptimizedItinerary } from '@/lib/optimization/types' - not exported yet

interface TripCalendarIntegrationProps {
  itinerary: any // OptimizedItinerary - type not exported yet
  tripId: string
  isLoading?: boolean
  onDateSelect?: (date: Date) => void
  onDestinationClick?: (destinationId: string, date: Date) => void
  onTimeAdjust?: (destinationId: string, newTime: Date) => void
  onShare?: () => void
  className?: string
}

/**
 * Main integration component that combines all calendar visualization features
 * Handles responsive layout, settings management, and component coordination
 */
export function TripCalendarIntegration({
  itinerary,
  tripId,
  isLoading = false,
  onDateSelect,
  onDestinationClick,
  onTimeAdjust,
  onShare,
  className
}: TripCalendarIntegrationProps) {
  // Responsive detection
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')
  
  // State management
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'list'>('calendar')
  const [settings, setSettings] = useState<any>(defaultTimelineSettings)
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false)

  // Generate timeline data from itinerary
  const timelineData = useMemo(() => {
    if (!itinerary?.scheduledDays) return []
    
    return itinerary.scheduledDays.map((day: any, index: number): DayTimeline => {
      const date = new Date(itinerary.startDate)
      date.setDate(date.getDate() + index)
      
      // Convert destinations to timeline blocks
      const timelineBlocks = day.destinations.map((dest: any, destIndex: number) => {
        const startTime = new Date(`${date.toDateString()} ${dest.startTime || '09:00'}`)
        const endTime = new Date(startTime.getTime() + (dest.allocatedTime || 60) * 60000)
        
        // Calculate position percentages for 9-hour day (9 AM - 6 PM)
        const startPercent = Math.max(0, Math.min(100, 
          ((startTime.getHours() + startTime.getMinutes()/60) - settings.startHour) / 
          (settings.endHour - settings.startHour) * 100
        ))
        
        const widthPercent = Math.max(2, Math.min(100 - startPercent,
          (dest.allocatedTime || 60) / 60 / (settings.endHour - settings.startHour) * 100
        ))

        // Determine color based on user preferences
        let color = '#6B7280' // default gray
        if (dest.interestedUsers?.length === 1) {
          color = dest.interestedUsers[0].color || '#3B82F6'
        } else if (dest.interestedUsers && dest.interestedUsers.length > 1) {
          if (dest.interestedUsers.length >= 5) {
            color = '#F59E0B' // amber for popular
          } else {
            color = '#0EA5E9' // sky blue for group
          }
        }

        return {
          id: `${dest.placeId}-${destIndex}`,
          startPercent,
          widthPercent,
          startTime: startTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: settings.timeFormat === '12h'
          }),
          endTime: endTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: settings.timeFormat === '12h'
          }),
          destination: {
            id: dest.placeId,
            name: dest.name,
            address: dest.address || '',
            coordinates: dest.coordinates,
            allocatedTime: dest.allocatedTime || 60,
            interestedUsers: dest.interestedUsers || []
          },
          color,
          userCount: dest.interestedUsers?.length || 0,
          transportNext: destIndex < day.destinations.length - 1 ? {
            mode: day.transport?.[destIndex]?.mode || 'walking',
            duration: day.transport?.[destIndex]?.duration || 15,
            distance: day.transport?.[destIndex]?.distance || 1000
          } : undefined
        }
      })

      // Calculate daily statistics
      const totalActivityTime = day.destinations.reduce((sum: number, dest: any) => sum + (dest.allocatedTime || 60), 0)
      const totalWalkingTime = day.transport?.reduce((sum: number, t: any) => 
        sum + (t.mode === 'walking' ? t.duration : 0), 0) || 0
      const totalDrivingTime = day.transport?.reduce((sum: number, t: any) => 
        sum + (t.mode !== 'walking' ? t.duration : 0), 0) || 0
      
      const workingHours = (settings.endHour - settings.startHour) * 60 // in minutes
      const totalFreeTime = workingHours - totalActivityTime - totalWalkingTime - totalDrivingTime
      
      // Determine day compactness
      let dayCompactness: 'light' | 'moderate' | 'packed' = 'light'
      if (totalActivityTime > workingHours * 0.7) dayCompactness = 'packed'
      else if (totalActivityTime > workingHours * 0.5) dayCompactness = 'moderate'

      const earliestStart = timelineBlocks.length > 0 ? timelineBlocks[0].startTime : '09:00'
      const latestEnd = timelineBlocks.length > 0 ? 
        timelineBlocks[timelineBlocks.length - 1].endTime : '18:00'

      return {
        date,
        dateString: date.toISOString().split('T')[0],
        dayOfWeek: date.toLocaleDateString('en', { weekday: 'long' }),
        timelineBlocks,
        dailyStats: {
          totalDestinations: day.destinations.length,
          totalActivityTime,
          totalWalkingTime,
          totalDrivingTime,
          totalFreeTime,
          dayCompactness,
          earliestStart,
          latestEnd,
          recommendedBreaks: dayCompactness === 'packed' ? 2 : dayCompactness === 'moderate' ? 1 : 0
        },
        isPackedDay: dayCompactness === 'packed',
        accommodationInfo: day.accommodation ? {
          name: day.accommodation.name || 'Accommodation',
          type: 'hotel' as const,
          location: day.accommodation.address || '',
          distanceFromLastDestination: 0,
          estimatedTravelTime: 0,
          priceRange: '$$' as const
        } : undefined
      }
    })
  }, [itinerary, settings])

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    onDateSelect?.(date)
  }

  // Handle view mode changes based on device
  useEffect(() => {
    if (isMobile && viewMode === 'timeline') {
      setViewMode('calendar')
    }
  }, [isMobile, viewMode])

  // Check for accessibility needs
  useEffect(() => {
    const hasAccessibilityNeeds = settings.screenReaderMode || 
                                 settings.voiceAnnouncements || 
                                 settings.highContrast
    setIsAccessibilityMode(hasAccessibilityNeeds)
  }, [settings])

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="space-y-2 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500">Loading calendar...</p>
        </div>
      </div>
    )
  }

  if (!timelineData.length) {
    return (
      <div className={cn("flex items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg", className)}>
        <div className="text-center space-y-2">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
          <p className="text-gray-500">No itinerary data available</p>
          <p className="text-sm text-gray-400">Create a trip to see the calendar view</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile Controls for small screens */}
      {isMobile && (
        <MobileTimelineControls
          currentDay={timelineData.find((day: any) => 
            selectedDate && day.dateString === selectedDate.toISOString().split('T')[0]
          )}
          displayMode={'timeline'}
          zoomLevel={'standard'}
          onDisplayModeChange={() => {}}
          onZoomChange={() => {}}
          className="mb-4"
        />
      )}

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Header with controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Trip Calendar</h2>
          
          <div className="flex items-center gap-2">
            {/* Share Button */}
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare} className="gap-2">
                <Share2 className="h-4 w-4" />
                {!isMobile && "Share"}
              </Button>
            )}
            
            {/* Settings */}
            <TimelineSettings
              settings={settings}
              onSettingsChange={setSettings}
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                {!isMobile && "Settings"}
              </Button>
            </TimelineSettings>
          </div>
        </div>

        {/* View Mode Tabs (Desktop/Tablet) */}
        {!isMobile && (
          <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="mt-4">
              <CalendarView
                routeSegments={[]}
                tripStartDate={selectedDate || undefined}
                onDayClick={(dayTimeline: DayTimeline) => handleDateSelect(dayTimeline.date)}
              />
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <DetailedTimelineView
                dayTimeline={timelineData.find((day: any) => 
                  selectedDate && day.dateString === selectedDate.toISOString().split('T')[0]
                ) || timelineData[0]}
                zoomLevel={'standard'}
                isEditable={true}
              />
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              <AccessibleTimeline
                dayTimeline={timelineData.find((day: any) => 
                  selectedDate && day.dateString === selectedDate.toISOString().split('T')[0]
                ) || timelineData[0]}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Mobile Single View */}
        {isMobile && (
          <div className="space-y-4">
            {isAccessibilityMode ? (
              <AccessibleTimeline
                dayTimeline={timelineData.find((day: any) => 
                  selectedDate && day.dateString === selectedDate.toISOString().split('T')[0]
                ) || timelineData[0]}
              />
            ) : (
              <CalendarView
                routeSegments={[]}
                tripStartDate={selectedDate || undefined}
                onDayClick={(dayTimeline: DayTimeline) => handleDateSelect(dayTimeline.date)}
                className="mobile-optimized"
              />
            )}
          </div>
        )}

        {/* Selected Date Detail (if applicable) */}
        {selectedDate && !isMobile && viewMode === 'calendar' && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-3">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h3>
            <DetailedTimelineView
              dayTimeline={timelineData.find((day: any) => 
                day.date.toDateString() === selectedDate.toDateString()
              ) || timelineData[0]}
              zoomLevel={'compact'}
              isEditable={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default TripCalendarIntegration