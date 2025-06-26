// Comprehensive accessibility features for map visualization
'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetDescription 
} from '@/components/ui/sheet'
import { 
  Eye, 
  Volume2, 
  Keyboard, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack,
  Settings,
  Type,
  Contrast
} from 'lucide-react'
import type { 
  MapVisualizationProps, 
  DestinationVisit, 
  RouteSegmentConfig,
  AccessibilityOptions,
  VoiceNavigationState
} from '@/lib/types/map-visualization'

interface AccessibilityFeaturesProps {
  itinerary?: any
  onDestinationFocus?: (destinationId: string) => void
  onRouteAnnounce?: (segment: RouteSegmentConfig) => void
  isActive?: boolean
}

export function AccessibilityFeatures({
  itinerary,
  onDestinationFocus,
  onRouteAnnounce,
  isActive = false
}: AccessibilityFeaturesProps) {
  const [options, setOptions] = useState<AccessibilityOptions>({
    screenReader: false,
    voiceNavigation: false,
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    keyboardNavigation: true
  })
  
  const [voiceState, setVoiceState] = useState<VoiceNavigationState>({
    isPlaying: false,
    currentIndex: 0,
    autoPlay: false
  })
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  
  // Initialize accessibility features
  useEffect(() => {
    // Detect screen reader
    const hasScreenReader = 
      window.speechSynthesis !== undefined ||
      navigator.userAgent.includes('NVDA') ||
      navigator.userAgent.includes('JAWS') ||
      navigator.userAgent.includes('VoiceOver')
    
    // Detect user preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches
    
    setOptions(prev => ({
      ...prev,
      screenReader: hasScreenReader,
      reducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast
    }))
    
    speechSynthesisRef.current = window.speechSynthesis
    
    // Load saved preferences
    const savedOptions = localStorage.getItem('map-accessibility-options')
    if (savedOptions) {
      try {
        const parsed = JSON.parse(savedOptions)
        setOptions(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('Failed to load accessibility options:', error)
      }
    }
  }, [])
  
  // Save preferences when changed
  useEffect(() => {
    localStorage.setItem('map-accessibility-options', JSON.stringify(options))
    
    // Apply global styles
    document.documentElement.classList.toggle('high-contrast', options.highContrast)
    document.documentElement.classList.toggle('large-text', options.largeText)
    document.documentElement.classList.toggle('reduced-motion', options.reducedMotion)
  }, [options])
  
  // Keyboard navigation
  useEffect(() => {
    if (!options.keyboardNavigation || !isActive) return
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          navigateToNext()
          break
          
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          navigateToPrevious()
          break
          
        case 'Enter':
        case ' ':
          event.preventDefault()
          toggleVoiceNavigation()
          break
          
        case 'Escape':
          event.preventDefault()
          stopVoiceNavigation()
          break
          
        case 'h':
          if (event.altKey) {
            event.preventDefault()
            announceHelp()
          }
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [options.keyboardNavigation, isActive, voiceState])
  
  const navigateToNext = () => {
    if (!itinerary?.destinationVisits) return
    
    const nextIndex = Math.min(
      voiceState.currentIndex + 1,
      itinerary.destinationVisits.length - 1
    )
    
    setVoiceState(prev => ({ ...prev, currentIndex: nextIndex }))
    
    const destination = itinerary.destinationVisits[nextIndex]
    if (destination) {
      onDestinationFocus?.(destination.destinationId)
      announceDestination(destination, nextIndex + 1)
    }
  }
  
  const navigateToPrevious = () => {
    if (!itinerary?.destinationVisits) return
    
    const prevIndex = Math.max(voiceState.currentIndex - 1, 0)
    
    setVoiceState(prev => ({ ...prev, currentIndex: prevIndex }))
    
    const destination = itinerary.destinationVisits[prevIndex]
    if (destination) {
      onDestinationFocus?.(destination.destinationId)
      announceDestination(destination, prevIndex + 1)
    }
  }
  
  const toggleVoiceNavigation = () => {
    if (voiceState.isPlaying) {
      pauseVoiceNavigation()
    } else {
      startVoiceNavigation()
    }
  }
  
  const startVoiceNavigation = () => {
    if (!options.voiceNavigation || !itinerary?.destinationVisits) return
    
    setVoiceState(prev => ({ ...prev, isPlaying: true }))
    
    const destination = itinerary.destinationVisits[voiceState.currentIndex]
    if (destination) {
      announceDestination(destination, voiceState.currentIndex + 1)
    }
  }
  
  const pauseVoiceNavigation = () => {
    setVoiceState(prev => ({ ...prev, isPlaying: false }))
    
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.pause()
    }
  }
  
  const stopVoiceNavigation = () => {
    setVoiceState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      currentIndex: 0 
    }))
    
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel()
    }
  }
  
  const announceDestination = (destination: DestinationVisit, order: number) => {
    if (!options.voiceNavigation || !speechSynthesisRef.current) return
    
    const text = createDestinationAnnouncement(destination, order)
    speak(text)
  }
  
  const announceRoute = (segment: RouteSegmentConfig) => {
    if (!options.voiceNavigation || !speechSynthesisRef.current) return
    
    const text = createRouteAnnouncement(segment)
    speak(text)
  }
  
  const announceHelp = () => {
    const helpText = `
      Map navigation help. 
      Use arrow keys to move between destinations.
      Press Enter or Space to start voice guidance.
      Press Escape to stop voice guidance.
      Press Alt + H to repeat this help.
      There are ${itinerary?.destinationVisits?.length || 0} destinations in your trip.
    `
    speak(helpText)
  }
  
  const speak = (text: string) => {
    if (!speechSynthesisRef.current) return
    
    // Cancel any ongoing speech
    speechSynthesisRef.current.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 0.8
    
    // Handle completion
    utterance.onend = () => {
      if (voiceState.autoPlay && voiceState.isPlaying) {
        setTimeout(() => {
          navigateToNext()
        }, 1000)
      }
    }
    
    currentUtteranceRef.current = utterance
    speechSynthesisRef.current.speak(utterance)
  }
  
  const createDestinationAnnouncement = (destination: DestinationVisit, order: number): string => {
    const parts = [
      `Destination ${order}`,
      destination.location.name || 'Unknown location',
      `Allocated time: ${destination.allocatedHours} hours`
    ]
    
    if (destination.wishfulUsers.length > 0) {
      const userNames = destination.wishfulUsers.map(u => u.member.display_name).join(', ')
      parts.push(`Requested by: ${userNames}`)
    }
    
    return parts.join('. ') + '.'
  }
  
  const createRouteAnnouncement = (segment: RouteSegmentConfig): string => {
    const mode = segment.transportMode === 'flying' ? 'flight' : 
                 segment.transportMode === 'driving' ? 'drive' : 'walk'
    
    return `Next: ${mode} for ${formatDuration(segment.duration)} to ${segment.toName}.`
  }
  
  const formatDuration = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`
    }
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    
    if (minutes === 0) {
      return `${wholeHours} hour${wholeHours > 1 ? 's' : ''}`
    }
    return `${wholeHours} hour${wholeHours > 1 ? 's' : ''} and ${minutes} minutes`
  }
  
  const updateOption = <K extends keyof AccessibilityOptions>(
    key: K, 
    value: AccessibilityOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }
  
  if (!isActive) return null
  
  return (
    <div className="accessibility-features">
      {/* Voice Navigation Controls */}
      {options.voiceNavigation && (
        <div className="fixed bottom-20 left-4 right-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Voice Navigation</h3>
              <div className="text-xs text-gray-500">
                {voiceState.currentIndex + 1} of {itinerary?.destinationVisits?.length || 0}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={navigateToPrevious}
                disabled={voiceState.currentIndex === 0}
                aria-label="Previous destination"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              
              <Button
                size="sm"
                onClick={toggleVoiceNavigation}
                aria-label={voiceState.isPlaying ? 'Pause voice navigation' : 'Start voice navigation'}
              >
                {voiceState.isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={navigateToNext}
                disabled={voiceState.currentIndex === (itinerary?.destinationVisits?.length || 1) - 1}
                aria-label="Next destination"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              
              <div className="flex-1" />
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVoiceState(prev => ({ ...prev, autoPlay: !prev.autoPlay }))}
                aria-label={voiceState.autoPlay ? 'Disable auto-play' : 'Enable auto-play'}
                className={voiceState.autoPlay ? 'bg-blue-100 dark:bg-blue-900' : ''}
              >
                Auto
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Accessibility Settings */}
      <div className="fixed top-4 left-4 z-40">
        <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="shadow-md"
              aria-label="Accessibility settings"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Accessibility Settings</SheetTitle>
              <SheetDescription>
                Customize the map experience for your needs
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 space-y-6">
              {/* Voice Navigation */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Voice Navigation
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.voiceNavigation}
                      onChange={(e) => updateOption('voiceNavigation', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Enable voice announcements</span>
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Provides audio descriptions of destinations and routes
                  </p>
                </div>
              </div>
              
              {/* Visual Enhancements */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Contrast className="w-4 h-4" />
                  Visual
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.highContrast}
                      onChange={(e) => updateOption('highContrast', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">High contrast mode</span>
                  </label>
                  
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.largeText}
                      onChange={(e) => updateOption('largeText', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Large text</span>
                  </label>
                  
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.reducedMotion}
                      onChange={(e) => updateOption('reducedMotion', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Reduce animations</span>
                  </label>
                </div>
              </div>
              
              {/* Keyboard Navigation */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Keyboard className="w-4 h-4" />
                  Keyboard
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.keyboardNavigation}
                      onChange={(e) => updateOption('keyboardNavigation', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Keyboard navigation</span>
                  </label>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                    <h4 className="text-xs font-medium mb-2">Keyboard Shortcuts</h4>
                    <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                      <div>→ / ↓ : Next destination</div>
                      <div>← / ↑ : Previous destination</div>
                      <div>Enter / Space : Toggle voice</div>
                      <div>Escape : Stop voice</div>
                      <div>Alt + H : Help</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Test Voice */}
              {options.voiceNavigation && (
                <div>
                  <Button
                    onClick={() => speak('Voice navigation is working correctly.')}
                    variant="outline"
                    className="w-full"
                  >
                    Test Voice
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Screen Reader Announcements */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
        id="accessibility-announcements"
      />
      
      {/* Invisible skip links for screen readers */}
      <div className="sr-only">
        <a href="#map-content" className="skip-link">
          Skip to map content
        </a>
        <a href="#map-controls" className="skip-link">
          Skip to map controls
        </a>
        <a href="#map-legend" className="skip-link">
          Skip to map legend
        </a>
      </div>
    </div>
  )
}

// Screen reader utilities
export function announceToScreenReader(message: string) {
  const announcement = document.getElementById('accessibility-announcements')
  if (announcement) {
    announcement.textContent = message
    setTimeout(() => {
      announcement.textContent = ''
    }, 1000)
  }
}

// Focus management
export function manageFocus(elementId: string) {
  const element = document.getElementById(elementId)
  if (element) {
    element.focus()
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// High contrast styles
export const highContrastStyles = `
  .high-contrast {
    --background: #000000;
    --foreground: #ffffff;
    --primary: #ffffff;
    --primary-foreground: #000000;
    --border: #ffffff;
  }
  
  .high-contrast .custom-map-marker {
    border-width: 3px !important;
    box-shadow: 0 0 0 2px #ffffff !important;
  }
  
  .high-contrast .map-route {
    stroke-width: 6px !important;
    stroke: #ffffff !important;
  }
`

// Large text styles
export const largeTextStyles = `
  .large-text {
    font-size: 1.125rem;
  }
  
  .large-text .custom-map-marker {
    font-size: 1rem !important;
  }
  
  .large-text button {
    min-height: 48px;
    font-size: 1rem;
  }
`

// Reduced motion styles
export const reducedMotionStyles = `
  .reduced-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
`