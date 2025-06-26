'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { DayTimeline, TimelineBlock } from '@/lib/types/calendar-visualization'
import { formatDuration } from '@/lib/utils/calendar-utils'

interface CalendarDateCellProps {
  dayTimeline: DayTimeline
  isSelected?: boolean
  isCurrentDay?: boolean
  displayMode?: 'compact' | 'standard' | 'expanded'
  onClick?: () => void
  onPlaceClick?: (place: any) => void
  className?: string
}

interface MiniTimelineProps {
  blocks: TimelineBlock[]
  displayMode: 'compact' | 'standard' | 'expanded'
  onPlaceClick?: (place: any) => void
}

/**
 * Mini timeline component for showing day overview
 */
function MiniTimeline({ blocks, displayMode, onPlaceClick }: MiniTimelineProps) {
  if (displayMode === 'compact') {
    // Super minimal - just colored dots
    return (
      <div className="flex gap-0.5 mt-1">
        {blocks.slice(0, 4).map((block, index) => (
          <div
            key={block.id}
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 cursor-pointer hover:scale-125 transition-transform"
            style={{ backgroundColor: block.color }}
            title={(block.destination as any).name || 'Destination'}
            onClick={(e) => {
              e.stopPropagation();
              onPlaceClick?.(block.destination);
            }}
          />
        ))}
        {blocks.length > 4 && (
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
        )}
      </div>
    )
  }

  if (displayMode === 'standard') {
    // Timeline bar with proportional blocks
    return (
      <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-800 rounded-full relative overflow-hidden">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="absolute top-0 h-full rounded-full transition-all duration-200 cursor-pointer hover:opacity-80"
            style={{
              left: `${block.startPercent}%`,
              width: `${Math.max(block.widthPercent, 2)}%`, // Minimum 2% width for visibility
              backgroundColor: block.color
            }}
            title={`${(block.destination as any).name || 'Destination'}\n${block.startTime} - ${block.endTime}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlaceClick?.(block.destination);
            }}
          />
        ))}
      </div>
    )
  }

  // Expanded - show mini blocks with icons
  return (
    <div className="mt-2 space-y-1">
      {blocks.slice(0, 3).map((block) => (
        <div 
          key={block.id} 
          className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded p-1 -m-1 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onPlaceClick?.(block.destination);
          }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: block.color }}
          />
          <div 
            className="truncate text-gray-600 dark:text-gray-400 flex-1 min-w-0"
            title={(block.destination as any).name || 'Destination'}
          >
            {(block.destination as any).name}
          </div>
          <div className="text-gray-500 text-xs flex-shrink-0 font-medium">
            {block.startTime} - {block.endTime}
          </div>
        </div>
      ))}
      {blocks.length > 3 && (
        <div className="text-xs text-gray-500 pl-3.5">
          +{blocks.length - 3} more
        </div>
      )}
    </div>
  )
}

/**
 * Calendar date cell component showing daily overview
 */
export function CalendarDateCell({
  dayTimeline,
  isSelected = false,
  isCurrentDay = false,
  displayMode = 'standard',
  onClick,
  onPlaceClick,
  className
}: CalendarDateCellProps) {
  const { date, timelineBlocks, dailyStats, isPackedDay } = dayTimeline
  const dayNumber = date.getDate()
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' })

  const handleClick = () => {
    onClick?.()
  }

  return (
    <div
      className={cn(
        "p-2 border border-gray-200 dark:border-gray-700 rounded-lg transition-all duration-200 cursor-pointer",
        "hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm",
        isSelected && "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30",
        isCurrentDay && "bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 border-blue-400",
        isPackedDay && "border-amber-300 dark:border-amber-600",
        displayMode === 'compact' && "p-1.5",
        displayMode === 'expanded' && "p-3",
        className
      )}
      onClick={handleClick}
    >
      {/* Date Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className={cn(
            "font-semibold",
            displayMode === 'compact' ? "text-sm" : "text-base",
            isCurrentDay && "text-blue-700 dark:text-blue-300"
          )}>
            {dayNumber}
          </span>
          {displayMode !== 'compact' && (
            <span className="text-xs text-gray-500 uppercase">
              {dayOfWeek}
            </span>
          )}
        </div>
        
        {/* Day Status Indicators */}
        <div className="flex items-center gap-1">
          {isCurrentDay && (
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
          {isPackedDay && (
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" title="Packed day" />
          )}
          {dailyStats.recommendedBreaks > 0 && (
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" title="Breaks recommended" />
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {displayMode !== 'compact' && timelineBlocks.length > 0 && (
        <div className="flex items-center justify-between mb-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="font-medium">{dailyStats.totalDestinations}</span>
              <span>places</span>
            </div>
            {(dailyStats.totalWalkingTime + dailyStats.totalDrivingTime) > 0 && (
              <div className="flex items-center gap-1">
                <span>🚶</span>
                <span>{formatDuration(dailyStats.totalWalkingTime + dailyStats.totalDrivingTime)}</span>
              </div>
            )}
          </div>
          
          {/* Time Range Display */}
          {dailyStats.earliestStart && dailyStats.latestEnd && (
            <div className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
              <span>🕐</span>
              <span>{dailyStats.earliestStart} - {dailyStats.latestEnd}</span>
            </div>
          )}
        </div>
      )}

      {/* Mini Timeline */}
      {timelineBlocks.length > 0 && (
        <MiniTimeline blocks={timelineBlocks} displayMode={displayMode} onPlaceClick={onPlaceClick} />
      )}

      {/* No Activities State */}
      {timelineBlocks.length === 0 && displayMode !== 'compact' && (
        <div className="text-center py-2 text-gray-400 dark:text-gray-600 text-xs">
          No activities
        </div>
      )}

      {/* Expanded Information */}
      {displayMode === 'expanded' && (
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Activity Time */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Activity:</span>
              <span className="font-medium">
                {formatDuration(dailyStats.totalActivityTime)}
              </span>
            </div>
            
            {/* Free Time */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Free:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatDuration(dailyStats.totalFreeTime)}
              </span>
            </div>
            
            {/* Day Schedule */}
            <div className="col-span-2 flex items-center justify-between">
              <span className="text-gray-500">Schedule:</span>
              <span className="font-medium">
                {dailyStats.earliestStart} - {dailyStats.latestEnd}
              </span>
            </div>
          </div>

          {/* Day Compactness Indicator */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  dailyStats.dayCompactness === 'light' && "bg-green-400 w-1/3",
                  dailyStats.dayCompactness === 'moderate' && "bg-yellow-400 w-2/3",
                  dailyStats.dayCompactness === 'packed' && "bg-red-400 w-full"
                )}
              />
            </div>
            <span className={cn(
              "text-xs font-medium capitalize",
              dailyStats.dayCompactness === 'light' && "text-green-600 dark:text-green-400",
              dailyStats.dayCompactness === 'moderate' && "text-yellow-600 dark:text-yellow-400",
              dailyStats.dayCompactness === 'packed' && "text-red-600 dark:text-red-400"
            )}>
              {dailyStats.dayCompactness}
            </span>
          </div>
        </div>
      )}

      {/* Accommodation Info */}
      {dayTimeline.accommodationInfo && displayMode === 'expanded' && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <span>🏨</span>
            <span className="truncate">
              {dayTimeline.accommodationInfo.name || 'Accommodation suggested'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarDateCell 