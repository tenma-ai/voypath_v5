/**
 * Color fallback utilities to ensure colors are always visible
 */

export const FALLBACK_COLORS = [
  '#0077BE', // Ocean Blue
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Light Blue
  '#96CEB4', // Green
  '#FFD93D', // Yellow
  '#95A99C', // Gray Green
  '#DDA0DD', // Plum
  '#F4A460', // Sandy Brown
  '#20B2AA', // Light Sea Green
];

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
    return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
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
    return FALLBACK_COLORS[0]; // Default to first fallback color
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