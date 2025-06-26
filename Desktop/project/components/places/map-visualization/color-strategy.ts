// Color strategy implementation for multi-user destinations

import type { WishfulUserDisplay, ColorTier, ColorBlendResult } from '@/lib/types/map-visualization'

// Default color configuration
export const DEFAULT_COLOR_CONFIG = {
  singleUserOpacity: 0.7,
  smallGroupBaseColor: '#38BDF8', // Sky blue
  popularDestinationColor: '#F59E0B', // Amber
  popularThreshold: 5,
  noInterestColor: '#E5E7EB', // Gray
  borderColor: '#FFFFFF',
  borderWidth: 2
}

/**
 * Determine color tier based on number of wishful users
 */
export function determineColorTier(wishfulUsers: WishfulUserDisplay[]): ColorTier {
  const userCount = wishfulUsers.length
  
  if (userCount === 0) {
    return {
      tier: 1,
      userCount: 0,
      color: DEFAULT_COLOR_CONFIG.noInterestColor,
      opacity: 0.5,
      description: 'No user interest'
    }
  }
  
  if (userCount === 1) {
    return {
      tier: 1,
      userCount: 1,
      color: wishfulUsers[0].color,
      opacity: DEFAULT_COLOR_CONFIG.singleUserOpacity,
      description: `${wishfulUsers[0].displayName}'s choice`
    }
  }
  
  if (userCount >= DEFAULT_COLOR_CONFIG.popularThreshold) {
    return {
      tier: 3,
      userCount,
      color: DEFAULT_COLOR_CONFIG.popularDestinationColor,
      opacity: 1.0,
      description: `Popular choice (${userCount} members)`
    }
  }
  
  // 2-4 users: Tier 2
  return {
    tier: 2,
    userCount,
    color: DEFAULT_COLOR_CONFIG.smallGroupBaseColor,
    opacity: 0.85,
    description: `Group choice (${userCount} members)`
  }
}

/**
 * Blend sky blue with user colors for small groups
 */
export function blendWithSkyBlue(userColors: string[]): ColorBlendResult {
  const baseColor = DEFAULT_COLOR_CONFIG.smallGroupBaseColor
  
  if (userColors.length === 0) {
    return { color: baseColor, opacity: 0.85 }
  }
  
  // For 2-4 users, create a subtle blend
  // We'll use the sky blue as primary and add hints of user colors
  const dominantUserColor = getMostFrequentColor(userColors)
  
  // Convert colors to RGB for blending
  const baseRgb = hexToRgb(baseColor)
  const userRgb = hexToRgb(dominantUserColor)
  
  if (!baseRgb || !userRgb) {
    return { color: baseColor, opacity: 0.85 }
  }
  
  // Blend with 70% sky blue, 30% user color
  const blendedRgb = {
    r: Math.round(baseRgb.r * 0.7 + userRgb.r * 0.3),
    g: Math.round(baseRgb.g * 0.7 + userRgb.g * 0.3),
    b: Math.round(baseRgb.b * 0.7 + userRgb.b * 0.3)
  }
  
  const blendedColor = rgbToHex(blendedRgb.r, blendedRgb.g, blendedRgb.b)
  
  return {
    color: blendedColor,
    opacity: 0.85,
    gradient: createRadialGradient(baseColor, userColors)
  }
}

/**
 * Calculate marker size based on popularity
 */
export function calculateMarkerSize(wishfulUsers: WishfulUserDisplay[], baseSize: number = 32): number {
  const userCount = wishfulUsers.length
  
  if (userCount === 0) return baseSize * 0.8
  if (userCount === 1) return baseSize
  
  // Scale up for popular destinations, max 1.5x
  const popularityMultiplier = Math.min(1.5, 1 + (userCount * 0.1))
  return Math.round(baseSize * popularityMultiplier)
}

/**
 * Generate marker style based on color tier
 */
export function generateMarkerStyle(
  colorTier: ColorTier,
  size: number
): {
  background: string
  border: string
  boxShadow: string
  width: string
  height: string
} {
  const backgroundColor = adjustColorOpacity(colorTier.color, colorTier.opacity)
  
  // Add subtle effects based on tier
  let boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
  
  if (colorTier.tier === 3) {
    // Popular destinations get a glow effect
    boxShadow = `0 0 0 3px ${adjustColorOpacity(colorTier.color, 0.3)}, 0 2px 8px rgba(0,0,0,0.2)`
  } else if (colorTier.tier === 2) {
    // Group destinations get a softer shadow
    boxShadow = '0 2px 6px rgba(0,0,0,0.15)'
  }
  
  return {
    background: backgroundColor,
    border: `${DEFAULT_COLOR_CONFIG.borderWidth}px solid ${DEFAULT_COLOR_CONFIG.borderColor}`,
    boxShadow,
    width: `${size}px`,
    height: `${size}px`
  }
}

/**
 * Create a radial gradient for group destinations
 */
function createRadialGradient(centerColor: string, edgeColors: string[]): string {
  if (edgeColors.length === 0) return centerColor
  
  // Create a subtle radial gradient
  const gradientStops = [
    `${centerColor} 0%`,
    `${centerColor} 60%`
  ]
  
  // Add edge color hints
  edgeColors.slice(0, 2).forEach((color, index) => {
    const position = 70 + (index * 15)
    gradientStops.push(`${adjustColorOpacity(color, 0.3)} ${position}%`)
  })
  
  gradientStops.push(`${centerColor} 100%`)
  
  return `radial-gradient(circle, ${gradientStops.join(', ')})`
}

/**
 * Get the most frequent color from an array
 */
function getMostFrequentColor(colors: string[]): string {
  const colorCounts = colors.reduce((acc, color) => {
    acc[color] = (acc[color] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return Object.entries(colorCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || colors[0]
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}

/**
 * Generate transport mode colors
 */
export function getTransportModeColor(mode: 'walking' | 'driving' | 'flying'): string {
  const colors = {
    walking: '#059669',   // Green
    driving: '#92400E',   // Brown
    flying: '#1E3A8A'     // Dark blue
  }
  
  return colors[mode]
}

/**
 * Create color legend items
 */
export function createColorLegendItems() {
  return [
    {
      type: 'marker' as const,
      color: DEFAULT_COLOR_CONFIG.noInterestColor,
      label: 'No interest',
      description: 'No members selected this destination'
    },
    {
      type: 'marker' as const,
      color: 'var(--user-color)',
      label: 'Individual choice',
      description: 'Selected by one member'
    },
    {
      type: 'marker' as const,
      color: DEFAULT_COLOR_CONFIG.smallGroupBaseColor,
      label: 'Small group (2-4)',
      description: 'Selected by 2-4 members'
    },
    {
      type: 'marker' as const,
      color: DEFAULT_COLOR_CONFIG.popularDestinationColor,
      label: 'Popular (5+)',
      description: 'Selected by 5 or more members'
    }
  ]
}

/**
 * Get contrasting text color for background
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return '#000000'
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  
  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/**
 * Apply theme adjustments for dark mode
 */
export function applyDarkModeAdjustments(color: string, isDarkMode: boolean): string {
  if (!isDarkMode) return color
  
  const rgb = hexToRgb(color)
  if (!rgb) return color
  
  // Lighten colors slightly for dark mode
  const factor = 1.2
  const adjusted = {
    r: Math.min(255, Math.round(rgb.r * factor)),
    g: Math.min(255, Math.round(rgb.g * factor)),
    b: Math.min(255, Math.round(rgb.b * factor))
  }
  
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b)
}