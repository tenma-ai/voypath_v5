/**
 * Centralized Color Utilities for Place Display
 * Provides consistent color logic across all views (Map, Calendar, List)
 */

import { useStore } from '../store/useStore';
import { calculatePlaceColor, PlaceColorResult } from './PlaceColorHelper';

export interface PlaceWithColorInfo {
  id: string;
  name: string;
  user_id?: string;
  userId?: string;
  place_type?: string;
  category?: string;
  [key: string]: any;
}

/**
 * Get consistent place color and styling information
 * Uses centralized store data for consistency across all views
 */
export function getPlaceColor(place: PlaceWithColorInfo): PlaceColorResult {
  const { memberColors, tripMembers } = useStore.getState();
  
  // Getting color for place

  // Format members data for PlaceColorHelper
  const formattedMembers = tripMembers.map(member => ({
    id: member.user_id,
    name: member.name,
    color: memberColors[member.user_id] || '#6B7280' // fallback gray
  }));

  // Calculate color using the centralized logic
  return calculatePlaceColor(place, formattedMembers, memberColors);
}

/**
 * Get place creator information
 */
export function getPlaceCreator(place: PlaceWithColorInfo): { userId: string; name: string; color: string } | null {
  // Check for system place first
  if (isSystemPlace(place)) {
    return {
      userId: 'system',
      name: 'System',
      color: '#000000' // Black color for system places
    };
  }

  const { memberColors, tripMembers } = useStore.getState();
  
  const userId = place.user_id || place.userId;
  if (!userId) return null;

  const member = tripMembers.find(m => m.user_id === userId);
  const color = memberColors[userId] || '#6B7280';

  return {
    userId,
    name: member?.name || 'Unknown User',
    color
  };
}

/**
 * Check if place is a system place (departure/destination/return)
 */
export function isSystemPlace(place: PlaceWithColorInfo): boolean {
  return place.source === 'system' ||
         place.place_type === 'departure' || 
         place.place_type === 'destination' ||
         place.category === 'departure_point' ||
         place.category === 'destination_point' ||
         place.category === 'return_point' ||
         place.category === 'transportation';
}

/**
 * Get fallback color for places without contributors
 */
export function getFallbackColor(): string {
  return '#6B7280'; // gray-500
}

/**
 * Get system place color (departure/destination)
 */
export function getSystemPlaceColor(): string {
  return '#374151'; // gray-700
}

/**
 * Debug function to log color state
 */
export function debugColorState(context: string): void {
  // Debug function for color state analysis
}