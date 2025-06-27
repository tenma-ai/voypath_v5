/**
 * Color fallback utilities to ensure colors are always visible
 * Now uses centralized MemberColorService for consistency
 */

import { MemberColorService } from '../services/MemberColorService';

/**
 * Get a valid color, using fallback if necessary
 */
export function getColorOrFallback(
  color: string | undefined | null,
  fallbackIndex: number = 0
): string {
  // Check if color is valid
  if (!color || 
      color === '' || 
      color === '#000000' || 
      color === 'undefined' || 
      color === 'null' ||
      color === 'black' ||
      color.toLowerCase() === 'rgb(0, 0, 0)' ||
      color.toLowerCase() === 'rgba(0, 0, 0, 1)') {
    console.warn(`🎨 Invalid color detected: "${color}", using fallback`);
    return MemberColorService.getColorByIndex(fallbackIndex).hex;
  }
  
  return color;
}

/**
 * Get color for a place based on user ID and member colors
 */
export function getPlaceColorWithFallback(
  place: any,
  memberColors: Record<string, string>,
  memberIndex: number = 0
): string {
  const userId = place.user_id || place.userId;
  
  if (!userId) {
    console.warn('🎨 No user ID found for place:', place.name);
    return MemberColorService.getColorByIndex(0).hex; // Default to first fallback color
  }
  
  const color = memberColors[userId];
  return getColorOrFallback(color, memberIndex);
}

/**
 * Debug helper to log color issues
 */
export function debugColorIssue(
  context: string,
  place: any,
  memberColors: Record<string, string>,
  resolvedColor: string
): void {
  console.group(`🎨 Color Debug: ${context}`);
  console.log('Place:', {
    id: place.id,
    name: place.name,
    user_id: place.user_id,
    userId: place.userId,
  });
  console.log('Available member colors:', memberColors);
  console.log('Resolved color:', resolvedColor);
  console.groupEnd();
}