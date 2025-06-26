'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Type,
  Contrast,
  Navigation,
  Keyboard,
  Play,
  Pause,
  SkipForward,
  SkipBack
} from 'lucide-react'
import type { 
  DayTimeline, 
  TimelineBlock,
  AccessibilitySettings 
} from '@/lib/types/calendar-visualization'
import { formatDuration } from '@/lib/utils/calendar-utils'

interface AccessibleTimelineProps {
  dayTimeline: DayTimeline
  accessibilitySettings?: AccessibilitySettings
  onSettingsChange?: (settings: AccessibilitySettings) => void
  className?: string
}

interface AccessibilityControlsProps {
  settings: AccessibilitySettings
  onSettingsChange: (settings: AccessibilitySettings) => void
  isExpanded: boolean
  onToggleExpanded: () => void
}

interface ScreenReaderAnnouncementsProps {
  dayTimeline: DayTimeline
  currentBlock?: TimelineBlock
  isPlaying: boolean
  onNavigate: (direction: 'previous' | 'next' | 'first' | 'last') => void
}

/**
 * Default accessibility settings
 */
const defaultAccessibilitySettings: AccessibilitySettings = {
  screenReaderEnabled: false,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  keyboardNavigation: true,
  voiceNavigation: false,
  hapticFeedback: true,
  announceTimeChanges: true,
  announceDestinationDetails: true,
  timeFormat: '24h'
}

/**
 * Screen reader announcements component
 */
function ScreenReaderAnnouncements({
  dayTimeline,
  currentBlock: selectedBlock,
  isPlaying,
  onNavigate
}: ScreenReaderAnnouncementsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const announceRef = useRef<HTMLDivElement>(null)

  const { timelineBlocks, dailyStats } = dayTimeline

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying && timelineBlocks.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1
          if (next >= timelineBlocks.length) {
            setIsAutoPlaying(false)
            return prev
          }
          return next
        })
      }, 3000) // 3 seconds per announcement

      return () => clearInterval(interval)
    }
  }, [isAutoPlaying, timelineBlocks.length])

  // Generate announcement text
  const generateAnnouncement = (block: TimelineBlock) => {
    const timeRange = `from ${block.startTime} to ${block.endTime}`
    const duration = `lasting ${Math.round((parseFloat(block.endTime.split(':')[0]) * 60 + parseFloat(block.endTime.split(':')[1])) - 
      (parseFloat(block.startTime.split(':')[0]) * 60 + parseFloat(block.startTime.split(':')[1])))} minutes`
    
    let announcement = `${(block.destination as any).name || 'Destination'}, ${timeRange}, ${duration}`
    
    if (block.userCount > 1) {
      announcement += `, ${block.userCount} people interested`
    }
    
    if (block.transportNext) {
      announcement += `, followed by ${block.transportNext.duration} ${block.transportNext.mode} to next destination`
    }
    
    return announcement
  }

  const handleNavigate = (direction: 'previous' | 'next' | 'first' | 'last') => {
    switch (direction) {
      case 'first':
        setCurrentIndex(0)
        break
      case 'last':
        setCurrentIndex(timelineBlocks.length - 1)
        break
      case 'previous':
        setCurrentIndex(prev => Math.max(0, prev - 1))
        break
      case 'next':
        setCurrentIndex(prev => Math.min(timelineBlocks.length - 1, prev + 1))
        break
    }
    onNavigate(direction)
  }

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying)
  }

  if (timelineBlocks.length === 0) {
    return (
      <div className="text-center py-4 text-gray-600 dark:text-gray-400">
        <p role="status" aria-live="polite">
          No activities scheduled for {dayTimeline.date.toLocaleDateString()}
        </p>
      </div>
    )
  }

  const currentBlock = timelineBlocks[currentIndex]

  return (
    <div className="space-y-4">
      {/* Day Overview */}
      <div 
        role="region" 
        aria-label="Day overview"
        className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
      >
        <h3 className="font-semibold mb-2">
          {dayTimeline.date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </h3>
        <p role="status" aria-live="polite">
          {dailyStats.totalDestinations} destinations planned, 
          {formatDuration(dailyStats.totalActivityTime)} of activities, 
          {formatDuration(dailyStats.totalWalkingTime + dailyStats.totalDrivingTime)} of travel time.
          Day intensity: {dailyStats.dayCompactness}.
        </p>
      </div>

      {/* Navigation Controls */}
      <div 
        role="group" 
        aria-label="Timeline navigation"
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate('first')}
            aria-label="Go to first destination"
            disabled={currentIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate('previous')}
            aria-label="Previous destination"
            disabled={currentIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoPlay}
            aria-label={isAutoPlaying ? "Pause auto-play" : "Start auto-play"}
          >
            {isAutoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate('next')}
            aria-label="Next destination"
            disabled={currentIndex === timelineBlocks.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate('last')}
            aria-label="Go to last destination"
            disabled={currentIndex === timelineBlocks.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {currentIndex + 1} of {timelineBlocks.length}
        </div>
      </div>

      {/* Current Destination Announcement */}
      <div 
        ref={announceRef}
        role="main"
        aria-live="polite"
        aria-atomic="true"
        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <div className="space-y-2">
          <h4 className="text-lg font-semibold">{(currentBlock.destination as any).name || 'Destination'}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Time:</span>
              <span className="ml-2">{currentBlock.startTime} - {currentBlock.endTime}</span>
            </div>
            
            <div>
              <span className="text-gray-500 dark:text-gray-400">Interest level:</span>
              <span className="ml-2">{currentBlock.userCount} {currentBlock.userCount === 1 ? 'person' : 'people'}</span>
            </div>
            
            {(currentBlock.destination as any).address && (
              <div className="md:col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Address:</span>
                <span className="ml-2">{(currentBlock.destination as any).address}</span>
              </div>
            )}
            
            {currentBlock.transportNext && (
              <div className="md:col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Next:</span>
                <span className="ml-2">
                  {currentBlock.transportNext.duration} by {currentBlock.transportNext.mode}
                  {currentBlock.transportNext.distance && ` (${currentBlock.transportNext.distance})`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Timeline List (for screen readers) */}
      <details className="mt-4">
        <summary className="cursor-pointer font-medium">
          Complete Timeline List (for screen readers)
        </summary>
        <ol className="mt-2 space-y-2 pl-4">
          {timelineBlocks.map((block, index) => (
            <li 
              key={block.id}
              className={cn(
                "p-2 rounded",
                index === currentIndex && "bg-blue-50 dark:bg-blue-900/20"
              )}
            >
              <button
                onClick={() => setCurrentIndex(index)}
                className="text-left w-full hover:underline focus:underline"
                aria-current={index === currentIndex ? "step" : undefined}
              >
                {generateAnnouncement(block)}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}

/**
 * Accessibility controls panel
 */
function AccessibilityControls({
  settings,
  onSettingsChange,
  isExpanded,
  onToggleExpanded
}: AccessibilityControlsProps) {
  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <Button
        variant="ghost"
        onClick={onToggleExpanded}
        className="w-full justify-between p-3"
        aria-expanded={isExpanded}
        aria-controls="accessibility-settings"
      >
        <span className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Accessibility Settings
        </span>
        <span className={cn("transition-transform", isExpanded && "rotate-180")}>
          ▼
        </span>
      </Button>

      {isExpanded && (
        <div id="accessibility-settings" className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* Visual Settings */}
          <div>
            <h4 className="font-medium mb-2">Visual</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={(e) => updateSetting('highContrast', e.target.checked)}
                  className="rounded"
                />
                <Contrast className="h-4 w-4" />
                <span>High contrast mode</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.largeText}
                  onChange={(e) => updateSetting('largeText', e.target.checked)}
                  className="rounded"
                />
                <Type className="h-4 w-4" />
                <span>Large text</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
                  className="rounded"
                />
                <EyeOff className="h-4 w-4" />
                <span>Reduced motion</span>
              </label>
            </div>
          </div>

          {/* Audio Settings */}
          <div>
            <h4 className="font-medium mb-2">Audio</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.screenReaderEnabled}
                  onChange={(e) => updateSetting('screenReaderEnabled', e.target.checked)}
                  className="rounded"
                />
                <Volume2 className="h-4 w-4" />
                <span>Screen reader mode</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.announceTimeChanges}
                  onChange={(e) => updateSetting('announceTimeChanges', e.target.checked)}
                  className="rounded"
                  disabled={!settings.screenReaderEnabled}
                />
                <span>Announce time changes</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.announceDestinationDetails}
                  onChange={(e) => updateSetting('announceDestinationDetails', e.target.checked)}
                  className="rounded"
                  disabled={!settings.screenReaderEnabled}
                />
                <span>Announce destination details</span>
              </label>
            </div>
          </div>

          {/* Navigation Settings */}
          <div>
            <h4 className="font-medium mb-2">Navigation</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.keyboardNavigation}
                  onChange={(e) => updateSetting('keyboardNavigation', e.target.checked)}
                  className="rounded"
                />
                <Keyboard className="h-4 w-4" />
                <span>Keyboard navigation</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.hapticFeedback}
                  onChange={(e) => updateSetting('hapticFeedback', e.target.checked)}
                  className="rounded"
                />
                <Navigation className="h-4 w-4" />
                <span>Haptic feedback</span>
              </label>
            </div>
          </div>

          {/* Time Format */}
          <div>
            <h4 className="font-medium mb-2">Time Format</h4>
            <select
              value={settings.timeFormat}
              onChange={(e) => updateSetting('timeFormat', e.target.value as '12h' | '24h')}
              className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded"
            >
              <option value="12h">12-hour (AM/PM)</option>
              <option value="24h">24-hour</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Main accessible timeline component
 */
export function AccessibleTimeline({
  dayTimeline,
  accessibilitySettings = defaultAccessibilitySettings,
  onSettingsChange,
  className
}: AccessibleTimelineProps) {
  const [settings, setSettings] = useState(accessibilitySettings)
  const [controlsExpanded, setControlsExpanded] = useState(false)
  const [currentBlock, setCurrentBlock] = useState<TimelineBlock | undefined>()

  // Update settings
  const handleSettingsChange = (newSettings: AccessibilitySettings) => {
    setSettings(newSettings)
    onSettingsChange?.(newSettings)
  }

  // Handle navigation
  const handleNavigate = (direction: 'previous' | 'next' | 'first' | 'last') => {
    // Haptic feedback
    if (settings.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }

  // Apply accessibility classes
  const timelineClasses = cn(
    "accessible-timeline",
    settings.highContrast && "high-contrast",
    settings.largeText && "large-text",
    settings.reducedMotion && "reduced-motion",
    className
  )

  return (
    <div className={timelineClasses}>
      {/* Accessibility Controls */}
      <div className="mb-6">
        <AccessibilityControls
          settings={settings}
          onSettingsChange={handleSettingsChange}
          isExpanded={controlsExpanded}
          onToggleExpanded={() => setControlsExpanded(!controlsExpanded)}
        />
      </div>

      {/* Screen Reader Mode */}
      {settings.screenReaderEnabled ? (
        <ScreenReaderAnnouncements
          dayTimeline={dayTimeline}
          currentBlock={currentBlock}
          isPlaying={false}
          onNavigate={handleNavigate}
        />
      ) : (
        /* Alternative text-based timeline for when screen reader is off */
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {dayTimeline.date.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          
          <div className="space-y-3">
            {dayTimeline.timelineBlocks.map((block, index) => (
              <div 
                key={block.id}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                tabIndex={settings.keyboardNavigation ? 0 : undefined}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{(block.destination as any).name || 'Destination'}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {block.startTime} - {block.endTime}
                      {block.userCount > 1 && ` • ${block.userCount} people interested`}
                    </p>
                    {(block.destination as any).address && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {(block.destination as any).address}
                      </p>
                    )}
                  </div>
                  
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 ml-3"
                    style={{ backgroundColor: block.color }}
                    aria-label={`Interest level indicator`}
                  />
                </div>
                
                {block.transportNext && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
                    Next: {block.transportNext.duration} by {block.transportNext.mode}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skip link for keyboard users */}
      {settings.keyboardNavigation && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
        >
          Skip to main content
        </a>
      )}
    </div>
  )
}

export default AccessibleTimeline