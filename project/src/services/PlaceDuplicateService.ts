/**
 * Place Duplicate Detection and Merging Service
 * Handles detection of duplicate places and merging logic with user preference priority
 */

import { supabase } from '../lib/supabase';
import { MemberColorService } from './MemberColorService';

export interface PlaceBase {
  id: string;
  name: string;
  google_place_id?: string;
  latitude: number;
  longitude: number;
  address?: string;
  trip_id: string;
  user_id: string;
  wish_level: number;
  stay_duration_minutes: number;
  notes?: string;
  created_at: string;
  status?: string;
  is_selected_for_optimization?: boolean;
  scheduled?: boolean;
}

export interface DuplicateGroup {
  google_place_id?: string;
  places: PlaceBase[];
  mergeStrategy: 'longest_duration' | 'highest_wish_level' | 'first_created';
  recommendedMerge: PlaceBase;
}

export class PlaceDuplicateService {
  /**
   * Detect if a place would be a duplicate when adding to a trip
   */
  static async checkForDuplicates(
    tripId: string, 
    placeToAdd: {
      google_place_id?: string;
      name: string;
      latitude: number;
      longitude: number;
    }
  ): Promise<PlaceBase[]> {
    try {
      const duplicates: PlaceBase[] = [];

      // Check by Google Place ID first (most reliable)
      if (placeToAdd.google_place_id) {
        const { data: googleIdDuplicates } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .eq('google_place_id', placeToAdd.google_place_id);

        if (googleIdDuplicates) {
          duplicates.push(...googleIdDuplicates);
        }
      }

      // If no Google Place ID matches, check by coordinates (within ~100m radius)
      if (duplicates.length === 0) {
        const { data: locationDuplicates } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .gte('latitude', placeToAdd.latitude - 0.001) // ~111m
          .lte('latitude', placeToAdd.latitude + 0.001)
          .gte('longitude', placeToAdd.longitude - 0.001)
          .lte('longitude', placeToAdd.longitude + 0.001);

        if (locationDuplicates) {
          // Further filter by distance calculation
          const nearbyPlaces = locationDuplicates.filter(place => {
            const distance = this.calculateDistance(
              placeToAdd.latitude, placeToAdd.longitude,
              place.latitude, place.longitude
            );
            return distance < 100; // 100 meters
          });
          duplicates.push(...nearbyPlaces);
        }
      }

      // If still no matches, check by name similarity for same trip
      if (duplicates.length === 0) {
        const { data: nameDuplicates } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId)
          .ilike('name', `%${placeToAdd.name}%`);

        if (nameDuplicates) {
          // Filter by name similarity score
          const similarPlaces = nameDuplicates.filter(place => {
            const similarity = this.calculateNameSimilarity(placeToAdd.name, place.name);
            return similarity > 0.8; // 80% similarity
          });
          duplicates.push(...similarPlaces);
        }
      }

      // Log message
      return duplicates;

    } catch (error) {
      // Error occurred
      return [];
    }
  }

  /**
   * Get all duplicate groups in a trip
   */
  static async findAllDuplicatesInTrip(tripId: string): Promise<DuplicateGroup[]> {
    try {
      const { data: allPlaces } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (!allPlaces || allPlaces.length === 0) {
        return [];
      }

      const duplicateGroups: DuplicateGroup[] = [];
      const processedPlaces = new Set<string>();

      // Group by Google Place ID first
      const placesByGoogleId = new Map<string, PlaceBase[]>();
      allPlaces.forEach(place => {
        if (place.google_place_id && !processedPlaces.has(place.id)) {
          if (!placesByGoogleId.has(place.google_place_id)) {
            placesByGoogleId.set(place.google_place_id, []);
          }
          placesByGoogleId.get(place.google_place_id)!.push(place);
        }
      });

      // Create duplicate groups from Google Place ID matches
      placesByGoogleId.forEach((places, googlePlaceId) => {
        if (places.length > 1) {
          places.forEach(place => processedPlaces.add(place.id));
          duplicateGroups.push({
            google_place_id: googlePlaceId,
            places,
            mergeStrategy: this.determineMergeStrategy(places),
            recommendedMerge: this.createMergedPlace(places)
          });
        }
      });

      // Check remaining places for location-based duplicates
      const remainingPlaces = allPlaces.filter(place => !processedPlaces.has(place.id));
      
      for (let i = 0; i < remainingPlaces.length; i++) {
        const place1 = remainingPlaces[i];
        if (processedPlaces.has(place1.id)) continue;

        const locationGroup = [place1];
        
        for (let j = i + 1; j < remainingPlaces.length; j++) {
          const place2 = remainingPlaces[j];
          if (processedPlaces.has(place2.id)) continue;

          const distance = this.calculateDistance(
            place1.latitude, place1.longitude,
            place2.latitude, place2.longitude
          );

          if (distance < 100) { // 100 meters
            locationGroup.push(place2);
            processedPlaces.add(place2.id);
          }
        }

        if (locationGroup.length > 1) {
          processedPlaces.add(place1.id);
          duplicateGroups.push({
            places: locationGroup,
            mergeStrategy: this.determineMergeStrategy(locationGroup),
            recommendedMerge: this.createMergedPlace(locationGroup)
          });
        }
      }

      // Log message
      return duplicateGroups;

    } catch (error) {
      // Error occurred
      return [];
    }
  }

  /**
   * Merge duplicate places with user preference priority
   */
  static async mergeDuplicatePlaces(duplicateGroup: DuplicateGroup): Promise<boolean> {
    try {
      const { places, recommendedMerge } = duplicateGroup;
      
      if (places.length < 2) {
        return false;
      }

      // Merging places

      // Keep the recommended merge place, update it with merged data
      const keepPlace = places.find(p => p.id === recommendedMerge.id) || places[0];
      const placesToRemove = places.filter(p => p.id !== keepPlace.id);

      // Update the kept place with merged data
      const { error: updateError } = await supabase
        .from('places')
        .update({
          wish_level: recommendedMerge.wish_level,
          stay_duration_minutes: recommendedMerge.stay_duration_minutes,
          notes: recommendedMerge.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', keepPlace.id);

      if (updateError) {
        throw updateError;
      }

      // Remove duplicate places
      const { error: deleteError } = await supabase
        .from('places')
        .delete()
        .in('id', placesToRemove.map(p => p.id));

      if (deleteError) {
        throw deleteError;
      }

      // Log message
      return true;

    } catch (error) {
      // Error occurred
      return false;
    }
  }

  /**
   * Auto-merge all duplicates in a trip
   */
  static async autoMergeAllDuplicates(tripId: string): Promise<number> {
    try {
      const duplicateGroups = await this.findAllDuplicatesInTrip(tripId);
      let mergedCount = 0;

      for (const group of duplicateGroups) {
        const success = await this.mergeDuplicatePlaces(group);
        if (success) {
          mergedCount++;
        }
      }

      // Log message
      return mergedCount;

    } catch (error) {
      // Error occurred
      return 0;
    }
  }

  /**
   * Determine the best merge strategy based on place characteristics
   */
  private static determineMergeStrategy(places: PlaceBase[]): 'longest_duration' | 'highest_wish_level' | 'first_created' {
    // If wish levels vary significantly, prioritize highest wish level
    const wishLevels = places.map(p => p.wish_level);
    const maxWish = Math.max(...wishLevels);
    const minWish = Math.min(...wishLevels);
    
    if (maxWish - minWish >= 2) {
      return 'highest_wish_level';
    }

    // If durations vary significantly, prioritize longest duration
    const durations = places.map(p => p.stay_duration_minutes);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    if (maxDuration - minDuration >= 60) { // 1 hour difference
      return 'longest_duration';
    }

    // Default to first created (chronological priority)
    return 'first_created';
  }

  /**
   * Create a merged place object with optimal values
   */
  private static createMergedPlace(places: PlaceBase[]): PlaceBase {
    const strategy = this.determineMergeStrategy(places);
    
    // Sort places by the chosen strategy
    let sortedPlaces: PlaceBase[];
    
    switch (strategy) {
      case 'highest_wish_level':
        sortedPlaces = [...places].sort((a, b) => b.wish_level - a.wish_level);
        break;
      case 'longest_duration':
        sortedPlaces = [...places].sort((a, b) => b.stay_duration_minutes - a.stay_duration_minutes);
        break;
      default: // first_created
        sortedPlaces = [...places].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }

    const primaryPlace = sortedPlaces[0];
    
    // Merge notes from all places
    const allNotes = places
      .map(p => p.notes)
      .filter(note => note && note.trim())
      .join(' | ');

    return {
      ...primaryPlace,
      // Take the highest wish level
      wish_level: Math.max(...places.map(p => p.wish_level)),
      // Take the longest duration
      stay_duration_minutes: Math.max(...places.map(p => p.stay_duration_minutes)),
      // Combine notes
      notes: allNotes || primaryPlace.notes,
      // Keep optimization status if any place was selected
      is_selected_for_optimization: places.some(p => p.is_selected_for_optimization),
      // Keep scheduled status if any place was scheduled
      scheduled: places.some(p => p.scheduled)
    };
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  private static calculateNameSimilarity(name1: string, name2: string): number {
    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(s1, s2);
    return (maxLength - distance) / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Generate user-friendly duplicate detection summary
   */
  static async getDuplicateSummary(tripId: string): Promise<{
    totalDuplicateGroups: number;
    totalDuplicatePlaces: number;
    potentialSavings: string;
    groups: DuplicateGroup[];
  }> {
    try {
      const groups = await this.findAllDuplicatesInTrip(tripId);
      const totalDuplicatePlaces = groups.reduce((sum, group) => sum + group.places.length, 0);
      const wouldRemove = groups.reduce((sum, group) => sum + (group.places.length - 1), 0);
      
      return {
        totalDuplicateGroups: groups.length,
        totalDuplicatePlaces,
        potentialSavings: `${wouldRemove} duplicate${wouldRemove !== 1 ? 's' : ''} can be merged`,
        groups
      };
    } catch (error) {
      // Error occurred
      return {
        totalDuplicateGroups: 0,
        totalDuplicatePlaces: 0,
        potentialSavings: 'Unable to calculate',
        groups: []
      };
    }
  }
}