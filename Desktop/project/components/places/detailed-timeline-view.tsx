'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  MapPin,
  Edit3,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { 
  DayTimeline, 
  TimelineBlock, 
  TimelineZoomLevel 
} from '@/lib/types/calendar-visualization'
import { 
  formatDuration, 
  getTimeMarkers
} from '@/lib/utils/calendar-utils'

interface DetailedTimelineViewProps {
  dayTimeline: DayTimeline
  zoomLevel?: TimelineZoomLevel
  isEditable?: boolean
  onTimelineEdit?: (blockId: string, changes: Partial<TimelineBlock>) => void
  onZoomChange?: (level: TimelineZoomLevel) => void
  className?: string
}

interface TimelineBlockComponentProps {
  block: TimelineBlock
  zoomLevel: TimelineZoomLevel
  isEditable: boolean
  onEdit?: (changes: Partial<TimelineBlock>) => void
  onInteraction?: (type: 'tap' | 'longPress' | 'drag', data?: any) => void
}

interface TimelineGridProps {
  zoomLevel: TimelineZoomLevel
  className?: string
}

/**
 * Timeline grid with time markers
 */
function TimelineGrid({ zoomLevel, className }: TimelineGridProps) {
  // Adjust interval based on zoom level
  const interval = zoomLevel === 'compact' ? 2 : zoomLevel === 'standard' ? 1 : 0.5
  const timeMarkers = getTimeMarkers(9, 21, interval)
  
  return (
    <div className={cn("relative h-12 border-b border-gray-200 dark:border-gray-700", className)}>
      {/* Time markers */}
      <div className="absolute inset-0 flex">
        {timeMarkers.map((marker, index) => (
          <div
            key={marker.time}
            className="flex-1 relative border-r border-gray-100 dark:border-gray-800 last:border-r-0"
            style={{ 
              flexBasis: `${100 / timeMarkers.length}%`,
              minWidth: zoomLevel === 'compact' ? '50px' : '80px'
            }}
          >
            {/* Major time markers */}
            {(zoomLevel === 'compact' || index % 2 === 0) && (
              <div className="absolute top-0 left-0 text-xs text-gray-500 dark:text-gray-400 px-1">
                {marker.time}
              </div>
            )}
            
            {/* Grid lines */}
            <div className="absolute top-4 left-0 w-px h-8 bg-gray-200 dark:bg-gray-700" />
            
            {/* Sub-grid for expanded view */}
            {zoomLevel === 'expanded' && index < timeMarkers.length - 1 && (
              <div className="absolute top-6 left-1/2 w-px h-6 bg-gray-100 dark:bg-gray-800" />
            )}
          </div>
        ))}
      </div>
      
      {/* Now line if it's current day */}
      {/* This would require current time calculation */}
    </div>
  )
}

/**
 * Individual timeline block component
 */
function TimelineBlockComponent({ 
  block, 
  zoomLevel, 
  isEditable, 
  onEdit,
  onInteraction 
}: TimelineBlockComponentProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)

  // Touch/mouse event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isEditable) return
    
    const touch = e.touches[0]
    const startTime = Date.now()
    
    const longPressTimer = setTimeout(() => {
      onInteraction?.('longPress', { block, touch })
      setIsExpanded(true)
    }, 500)
    
    const handleTouchEnd = () => {
      clearTimeout(longPressTimer)
      const duration = Date.now() - startTime
      
      if (duration < 200) {
        onInteraction?.('tap', { block })
        setIsExpanded(!isExpanded)
      }
      
      document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleClick = () => {
    if (isEditable) {
      setIsExpanded(!isExpanded)
    }
    onInteraction?.('tap', { block })
  }

  // Determine block height based on zoom and importance
  const getBlockHeight = () => {
    const baseHeight = zoomLevel === 'compact' ? 24 : zoomLevel === 'standard' ? 32 : 40
    const importanceMultiplier = block.userCount > 3 ? 1.2 : block.userCount > 1 ? 1.1 : 1
    return Math.round(baseHeight * importanceMultiplier)
  }

  const blockHeight = getBlockHeight()

  return (
    <div
      ref={blockRef}
      className={cn(
        "absolute top-16 rounded-md border transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:z-10",
        isDragging && "z-20 shadow-lg",
        isExpanded && "z-30 shadow-xl",
        block.borderStyle === 'solid' ? "border-2" : "border border-dashed",
        isEditable && "hover:border-opacity-80"
      )}
      style={{
        left: `${block.startPercent}%`,
        width: `${Math.max(block.widthPercent, 2)}%`, // Minimum 2% width
        height: `${blockHeight}px`,
        backgroundColor: block.color,
        borderColor: block.color
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
    >
      {/* Block content */}
      <div className="h-full p-1 flex items-center justify-between text-white text-xs font-medium">
        <div className="truncate flex-1 min-w-0">
          {zoomLevel === 'compact' ? (
            // Show only first letter or icon in compact mode
            <span className="text-xs">{block.destination.destinationName.charAt(0)}</span>
          ) : (
            // Show full or truncated name
            <span 
              className="truncate"
              title={block.destination.destinationName}
            >
              {block.destination.destinationName}
            </span>
          )}
        </div>
        
        {/* User count indicator */}
        {zoomLevel !== 'compact' && block.userCount > 1 && (
          <div className="flex-shrink-0 ml-1">
            <div className="w-4 h-4 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold">{block.userCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Transport indicator */}
      {block.transportNext && zoomLevel !== 'compact' && (
        <div
          className="absolute -right-6 top-1/2 transform -translate-y-1/2 text-lg"
          title={`${block.transportNext.mode} - ${block.transportNext.duration}`}
        >
          {block.transportNext.icon}
        </div>
      )}

      {/* Expanded details popup */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40 min-w-64">
          <div className="space-y-2">
            {/* Destination info */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {block.destination.destinationName}
              </h4>
              {block.destination.location.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {block.destination.location.address}
                </p>
              )}
            </div>

            {/* Time info */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{block.startTime} - {block.endTime}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{block.userCount} interested</span>
              </div>
            </div>

            {/* Transport info */}
            {block.transportNext && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{block.transportNext.icon}</span>
                  <span>{block.transportNext.duration} to next</span>
                  {block.transportNext.distance && (
                    <span className="text-xs">({block.transportNext.distance})</span>
                  )}
                </div>
              </div>
            )}

            {/* Edit controls */}
            {isEditable && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edit Time
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                    Move
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Main detailed timeline view component
 */
export function DetailedTimelineView({
  dayTimeline,
  zoomLevel = 'standard',
  isEditable = false,
  onTimelineEdit,
  onZoomChange,
  className
}: DetailedTimelineViewProps) {
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const { date, timelineBlocks, dailyStats } = dayTimeline
  const dateString = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  // Handle block interactions
  const handleBlockInteraction = (type: 'tap' | 'longPress' | 'drag', data?: any) => {
    const { block } = data
    
    switch (type) {
      case 'tap':
        setSelectedBlock(selectedBlock === block.id ? null : block.id)
        break
      case 'longPress':
        if (isEditable) {
          // Show edit options
          setSelectedBlock(block.id)
        }
        break
      case 'drag':
        if (isEditable && onTimelineEdit) {
          // Handle drag to reposition
          console.log('Drag initiated for block:', block.id)
        }
        break
    }
  }

  // Handle block edits
  const handleBlockEdit = (blockId: string, changes: Partial<TimelineBlock>) => {
    onTimelineEdit?.(blockId, changes)
  }

  // Zoom controls
  const handleZoomIn = () => {
    const levels: TimelineZoomLevel[] = ['compact', 'standard', 'expanded']
    const currentIndex = levels.indexOf(zoomLevel)
    if (currentIndex < levels.length - 1) {
      onZoomChange?.(levels[currentIndex + 1])
    }
  }

  const handleZoomOut = () => {
    const levels: TimelineZoomLevel[] = ['compact', 'standard', 'expanded']
    const currentIndex = levels.indexOf(zoomLevel)
    if (currentIndex > 0) {
      onZoomChange?.(levels[currentIndex - 1])
    }
  }

  return (
    <div className={cn("detailed-timeline-view bg-white dark:bg-gray-900", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {dateString}
          </h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            <span>{dailyStats.totalDestinations} destinations</span>
            <span>{formatDuration(dailyStats.totalActivityTime)} activities</span>
            <span>{formatDuration(dailyStats.totalWalkingTime + dailyStats.totalDrivingTime)} travel</span>
            <span className={cn(
              "font-medium capitalize",
              dailyStats.dayCompactness === 'light' && "text-green-600 dark:text-green-400",
              dailyStats.dayCompactness === 'moderate' && "text-yellow-600 dark:text-yellow-400",
              dailyStats.dayCompactness === 'packed' && "text-red-600 dark:text-red-400"
            )}>
              {dailyStats.dayCompactness}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomLevel === 'compact'}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomLevel === 'expanded'}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline container */}
      <div 
        ref={timelineRef}
        className="timeline-container overflow-x-auto"
        style={{
          minHeight: '200px',
          maxHeight: zoomLevel === 'expanded' ? '400px' : '300px'
        }}
      >
        <div className="relative min-w-full" style={{ minWidth: '800px' }}>
          {/* Time grid */}
          <TimelineGrid zoomLevel={zoomLevel} />

          {/* Timeline blocks */}
          <div className="relative" style={{ height: '150px' }}>
            {timelineBlocks.map((block) => (
              <TimelineBlockComponent
                key={block.id}
                block={block}
                zoomLevel={zoomLevel}
                isEditable={isEditable}
                onEdit={(changes) => handleBlockEdit(block.id, changes)}
                onInteraction={handleBlockInteraction}
              />
            ))}
            
            {/* Empty state */}
            {timelineBlocks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600">
                <div className="text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No activities scheduled for this day</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day summary */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Schedule:</span>
            <div className="font-medium">
              {dailyStats.earliestStart} - {dailyStats.latestEnd}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500 dark:text-gray-400">Free time:</span>
            <div className="font-medium text-green-600 dark:text-green-400">
              {formatDuration(dailyStats.totalFreeTime)}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500 dark:text-gray-400">Transport:</span>
            <div className="font-medium">
              {formatDuration(dailyStats.totalWalkingTime + dailyStats.totalDrivingTime)}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500 dark:text-gray-400">Breaks needed:</span>
            <div className="font-medium">
              {dailyStats.recommendedBreaks > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {dailyStats.recommendedBreaks} recommended
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Accommodation info */}
        {dayTimeline.accommodationInfo && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">🏨 Accommodation:</span>
              <span className="font-medium">
                {dayTimeline.accommodationInfo.name || 'Suggested nearby'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DetailedTimelineView