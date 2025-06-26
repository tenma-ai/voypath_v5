"use server";

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface AddPlaceParams {
  tripId: string;
  name: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
  preferredDuration?: number; // Preferred duration in minutes
  notes?: string;
  preferenceScore?: number; // Score from 1-5
  isPersonalFavorite?: boolean;
  userId?: string;
  sessionId: string;
}

interface UpdatePlaceParams {
  id: string;
  name?: string;
  address?: string;
  preferredDuration?: number;
  notes?: string;
  preferenceScore?: number;
  isPersonalFavorite?: boolean;
}

export async function addPlaceToTrip({
  tripId,
  name,
  address,
  placeId,
  latitude,
  longitude,
  preferredDuration = 60, // Default 1 hour
  notes = '',
  preferenceScore = 3, // Default medium interest
  isPersonalFavorite = false,
  userId,
  sessionId,
}: AddPlaceParams) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // 1. First save or retrieve the destination in the destinations table
    let destinationId;
    
    // Search for existing destination (same trip_id and place_id)
    const { data: existingDestination } = await supabase
      .from('destinations')
      .select('id')
      .eq('group_id', tripId)
      .eq('place_id', placeId)
      .single();
      
    if (existingDestination) {
      // Use existing destination
      destinationId = existingDestination.id;
    } else {
      // Create a new destination
      const { data: newDestination, error: destinationError } = await supabase
        .from('destinations')
        .insert({
          group_id: tripId,
          name,
          address,
          place_id: placeId,
          latitude,
          longitude,
          created_by: userId,
        })
        .select()
        .single();
        
      if (destinationError) {
        console.error('Error adding destination:', destinationError);
        throw new Error('Failed to add destination');
      }
      
      destinationId = newDestination.id;
    }
    
    // 2. Save to user_preferences table
    const { data: preference, error: preferenceError } = await supabase
      .from('user_preferences')
      .insert({
        group_id: tripId,
        user_id: userId,
        session_id: sessionId,
        destination_id: destinationId,
        preference_score: preferenceScore,
        preferred_duration: preferredDuration,
        notes,
        is_personal_favorite: isPersonalFavorite,
      })
      .select()
      .single();
      
    if (preferenceError) {
      console.error('Error adding preference:', preferenceError);
      throw new Error('Failed to add preference');
    }
    
    return { success: true, preferenceId: preference.id, destinationId };
  } catch (error) {
    console.error('Error in addPlaceToTrip:', error);
    throw new Error('Failed to add place to trip');
  }
}

export async function updatePlacePreference({
  id,
  preferredDuration,
  notes,
  preferenceScore,
  isPersonalFavorite,
}: UpdatePlaceParams) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Prepare fields to update
    const updateFields: any = {};
    
    if (preferredDuration !== undefined) updateFields.preferred_duration = preferredDuration;
    if (notes !== undefined) updateFields.notes = notes;
    if (preferenceScore !== undefined) updateFields.preference_score = preferenceScore;
    if (isPersonalFavorite !== undefined) updateFields.is_personal_favorite = isPersonalFavorite;
    
    // Execute update
    const { data, error } = await supabase
      .from('user_preferences')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating preference:', error);
      throw new Error('Failed to update preference');
    }
    
    return { success: true, preference: data };
  } catch (error) {
    console.error('Error in updatePlacePreference:', error);
    throw new Error('Failed to update place preference');
  }
}

export async function deletePlaceFromTrip(preferenceId: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Delete from user_preferences
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('id', preferenceId);
      
    if (error) {
      console.error('Error deleting place preference:', error);
      throw new Error('Failed to delete place');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in deletePlaceFromTrip:', error);
    throw new Error('Failed to delete place from trip');
  }
}

export async function getPlacesForTrip(tripId: string, sessionId: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Get all destinations related to the trip and the user's own preferences
    const { data, error } = await supabase
      .from('destinations')
      .select(`
        id,
        name,
        address,
        latitude,
        longitude,
        place_id,
        created_at,
        user_preferences!inner(
          id,
          preference_score,
          preferred_duration,
          notes,
          is_personal_favorite,
          session_id
        )
      `)
      .eq('group_id', tripId)
      .eq('user_preferences.session_id', sessionId);
      
    if (error) {
      console.error('Error fetching places:', error);
      throw new Error('Failed to fetch places');
    }
    
    // Format the data
    const places = data.map(item => {
      const preference = item.user_preferences[0];
      return {
        id: preference.id, // Preference ID
        destinationId: item.id,
        name: item.name,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        placeId: item.place_id,
        preferenceScore: preference.preference_score,
        preferredDuration: preference.preferred_duration,
        notes: preference.notes,
        isPersonalFavorite: preference.is_personal_favorite,
      };
    });
    
    return { success: true, places };
  } catch (error) {
    console.error('Error in getPlacesForTrip:', error);
    throw new Error('Failed to get places for trip');
  }
} 