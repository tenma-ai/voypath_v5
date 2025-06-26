// Custom marker implementation using Google Maps Advanced Markers

import { useEffect, useRef } from 'react'
import type { MarkerConfig, MarkerAnimation, WishfulUserDisplay } from '@/lib/types/map-visualization'
import { determineColorTier, calculateMarkerSize, generateMarkerStyle, getContrastingTextColor } from './color-strategy'

interface CustomMarkerProps {
  map: google.maps.Map | null
  config: MarkerConfig
  onClick?: (destinationId: string) => void
  onLongPress?: (destinationId: string) => void
  animation?: MarkerAnimation
  isSelected?: boolean
  isDarkMode?: boolean
}

export function CustomMarker({
  map,
  config,
  onClick,
  onLongPress,
  animation,
  isSelected,
  isDarkMode = false
}: CustomMarkerProps) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return
    
    // Create marker content
    const content = createMarkerContent(config, isSelected, isDarkMode)
    
    // Create advanced marker
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: config.position,
      content,
      title: `Destination ${config.orderNumber}`,
      collisionBehavior: google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY
    })
    
    markerRef.current = marker
    
    // Add click listener
    if (onClick) {
      marker.addListener('click', () => onClick(config.destinationId))
    }
    
    // Add touch event listeners for long press
    if (onLongPress && content instanceof HTMLElement) {
      // Touch events for mobile
      content.addEventListener('touchstart', handleTouchStart)
      content.addEventListener('touchend', handleTouchEnd)
      content.addEventListener('touchcancel', handleTouchEnd)
      
      // Mouse events for desktop
      content.addEventListener('mousedown', handleMouseDown)
      content.addEventListener('mouseup', handleMouseUp)
      content.addEventListener('mouseleave', handleMouseUp)
    }
    
    // Apply animation if specified
    if (animation) {
      applyMarkerAnimation(content, animation)
    }
    
    // Cleanup
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null
        markerRef.current = null
      }
      clearLongPressTimer()
    }
  }, [map, config, onClick, onLongPress, animation, isSelected, isDarkMode])
  
  // Update marker appearance when selected state changes
  useEffect(() => {
    if (markerRef.current && markerRef.current.content) {
      updateMarkerSelection(markerRef.current.content as HTMLElement, isSelected)
    }
  }, [isSelected])
  
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    startLongPressTimer()
  }
  
  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    clearLongPressTimer()
  }
  
  const handleMouseDown = () => {
    startLongPressTimer()
  }
  
  const handleMouseUp = () => {
    clearLongPressTimer()
  }
  
  const startLongPressTimer = () => {
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      if (onLongPress) {
        onLongPress(config.destinationId)
      }
    }, 500) // 500ms for long press
  }
  
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }
  
  return null
}

/**
 * Create marker HTML content
 */
function createMarkerContent(
  config: MarkerConfig,
  isSelected?: boolean,
  isDarkMode?: boolean
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'custom-map-marker'
  
  // Determine color and size
  const colorTier = determineColorTier(config.wishfulUsers)
  const size = calculateMarkerSize(config.wishfulUsers)
  const style = generateMarkerStyle(colorTier, size)
  
  // Apply styles
  Object.assign(container.style, {
    ...style,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    cursor: 'pointer',
    position: 'relative',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none'
  })
  
  // Add number label
  const label = document.createElement('div')
  label.textContent = config.orderNumber.toString()
  label.style.cssText = `
    color: ${getContrastingTextColor(colorTier.color)};
    font-size: ${Math.max(14, size * 0.4)}px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1;
    pointer-events: none;
  `
  container.appendChild(label)
  
  // Add special indicators
  if (config.isStart) {
    addStartIndicator(container, size)
  }
  
  if (config.isEnd) {
    addEndIndicator(container, size)
  }
  
  // Add selection state
  if (isSelected) {
    updateMarkerSelection(container, true)
  }
  
  // Add accessibility attributes
  container.setAttribute('role', 'button')
  container.setAttribute('aria-label', `Destination ${config.orderNumber}, ${config.wishfulUsers.length} interested members`)
  container.setAttribute('tabindex', '0')
  
  return container
}

/**
 * Add start point indicator
 */
function addStartIndicator(container: HTMLElement, size: number) {
  const indicator = document.createElement('div')
  indicator.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 16px;
    height: 16px;
    background: #059669;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `
  indicator.textContent = 'S'
  container.appendChild(indicator)
}

/**
 * Add end point indicator
 */
function addEndIndicator(container: HTMLElement, size: number) {
  const indicator = document.createElement('div')
  indicator.style.cssText = `
    position: absolute;
    bottom: -8px;
    right: -8px;
    width: 16px;
    height: 16px;
    background: #DC2626;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `
  indicator.textContent = 'E'
  container.appendChild(indicator)
}

/**
 * Update marker selection state
 */
function updateMarkerSelection(container: HTMLElement, isSelected?: boolean) {
  if (isSelected) {
    container.style.transform = 'scale(1.2)'
    container.style.zIndex = '1000'
    // Add pulsing animation
    container.animate([
      { transform: 'scale(1.2)' },
      { transform: 'scale(1.3)' },
      { transform: 'scale(1.2)' }
    ], {
      duration: 1000,
      iterations: Infinity
    })
  } else {
    container.style.transform = 'scale(1)'
    container.style.zIndex = 'auto'
    // Remove animations
    container.getAnimations().forEach(animation => animation.cancel())
  }
}

/**
 * Apply marker animation
 */
function applyMarkerAnimation(content: HTMLElement, animation: MarkerAnimation) {
  switch (animation.type) {
    case 'drop':
      content.animate([
        { transform: 'translateY(-100px)', opacity: '0' },
        { transform: 'translateY(0)', opacity: '1' }
      ], {
        duration: animation.duration,
        delay: animation.delay || 0,
        easing: 'ease-out',
        fill: 'both'
      })
      break
      
    case 'bounce':
      content.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-20px)' },
        { transform: 'translateY(0)' },
        { transform: 'translateY(-10px)' },
        { transform: 'translateY(0)' }
      ], {
        duration: animation.duration,
        delay: animation.delay || 0,
        easing: 'ease-out'
      })
      break
      
    case 'pulse':
      content.animate([
        { transform: 'scale(1)', opacity: '1' },
        { transform: 'scale(1.2)', opacity: '0.8' },
        { transform: 'scale(1)', opacity: '1' }
      ], {
        duration: animation.duration,
        delay: animation.delay || 0,
        iterations: Infinity
      })
      break
  }
}

/**
 * Create marker info window content
 */
export function createInfoWindowContent(
  config: MarkerConfig,
  visitTime: string,
  nextTransport?: { mode: string; duration: string; destination: string }
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'marker-info-window'
  container.style.cssText = `
    padding: 12px;
    min-width: 200px;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `
  
  // Title
  const title = document.createElement('h3')
  title.style.cssText = `
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1F2937;
  `
  title.textContent = `Stop ${config.orderNumber}`
  container.appendChild(title)
  
  // Visit time
  const timeDiv = document.createElement('div')
  timeDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: #6B7280;
    font-size: 14px;
  `
  timeDiv.innerHTML = `⏱️ ${visitTime}`
  container.appendChild(timeDiv)
  
  // Wishful users
  if (config.wishfulUsers.length > 0) {
    const usersTitle = document.createElement('div')
    usersTitle.style.cssText = `
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 4px;
    `
    usersTitle.textContent = 'Interested members:'
    container.appendChild(usersTitle)
    
    const usersList = document.createElement('div')
    usersList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    `
    
    config.wishfulUsers.forEach(user => {
      const userItem = document.createElement('div')
      userItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      `
      
      const colorDot = document.createElement('span')
      colorDot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: ${user.color};
        flex-shrink: 0;
      `
      
      const userName = document.createElement('span')
      userName.textContent = user.displayName
      userName.style.color = '#4B5563'
      
      const rating = document.createElement('span')
      rating.textContent = '⭐'.repeat(user.rating)
      rating.style.fontSize = '11px'
      
      userItem.appendChild(colorDot)
      userItem.appendChild(userName)
      userItem.appendChild(rating)
      usersList.appendChild(userItem)
    })
    
    container.appendChild(usersList)
  }
  
  // Next transport
  if (nextTransport) {
    const transportDiv = document.createElement('div')
    transportDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid #E5E7EB;
      font-size: 13px;
      color: #6B7280;
    `
    
    const modeIcons: Record<string, string> = {
      walking: '🚶',
      driving: '🚗',
      flying: '✈️'
    }
    
    transportDiv.innerHTML = `
      ${modeIcons[nextTransport.mode] || '🚗'} 
      ${nextTransport.duration} to ${nextTransport.destination}
    `
    container.appendChild(transportDiv)
  }
  
  return container
}

/**
 * Batch create markers for performance
 */
export function createMarkerBatch(
  map: google.maps.Map,
  configs: MarkerConfig[],
  onClick?: (destinationId: string) => void
): google.maps.marker.AdvancedMarkerElement[] {
  return configs.map((config, index) => {
    const content = createMarkerContent(config)
    
    // Add staggered animation
    content.style.opacity = '0'
    setTimeout(() => {
      content.style.transition = 'opacity 0.3s ease'
      content.style.opacity = '1'
    }, index * 50) // 50ms delay between markers
    
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: config.position,
      content,
      title: `Destination ${config.orderNumber}`
    })
    
    if (onClick) {
      marker.addListener('click', () => onClick(config.destinationId))
    }
    
    return marker
  })
}