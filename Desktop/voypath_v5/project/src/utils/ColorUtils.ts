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
  
  // Log for debugging
  console.log('🎨 [ColorUtils] Getting color for place:', {
    placeName: place.name,
    placeUserId: place.user_id || place.userId,
    placeType: place.place_type,
    availableColors: Object.keys(memberColors),
    memberCount: tripMembers.length
  });

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
 * Check if place is a system place (departure/destination)
 */
export function isSystemPlace(place: PlaceWithColorInfo): boolean {
  return place.place_type === 'departure' || 
         place.place_type === 'destination' ||
         place.category === 'departure_point' ||
         place.category === 'destination_point' ||
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
  const { memberColors, tripMembers, currentTrip } = useStore.getState();
  
  console.log(`🔍 [ColorUtils] Debug - ${context}:`, {
    tripId: currentTrip?.id,
    tripName: currentTrip?.name,
    memberColors,
    tripMembers: tripMembers.map(m => ({
      userId: m.user_id,
      name: m.name,
      colorIndex: m.assigned_color_index,
      assignedColor: memberColors[m.user_id]
    }))
  });
}