"use server";

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { MyPlaceData } from '@/lib/types/places';
import { optimizeTripRoute } from '@/lib/actions/optimization-actions';

// For backward compatibility
interface AddPlaceToMyPlacesParams {
  userId: string | null;
  sessionId: string;
  groupId: string;
  name: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
  preferenceScore: number;
  preferredDuration: number;
  preferredDate: string | null;
  notes: string;
  isPersonalFavorite: boolean;
}

interface UpdateMyPlaceParams {
  id: string;
  preferenceScore?: number;
  preferredDuration?: number;
  preferredDate?: string | null;
  notes?: string;
  isPersonalFavorite?: boolean;
}

/**
 * Add a place to the user's personal wishlist (my_places table)
 */
export async function addPlaceToMyPlaces(params: Partial<MyPlaceData> | AddPlaceToMyPlacesParams) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Get the user ID from the session if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    // Convert between different parameter formats if needed
    const insertData: any = {};
    
    // Map fields based on whether we have a new or old format
    if ('place_id' in params) {
      // New format (MyPlaceData)
      insertData.user_id = userId || params.user_id;
      insertData.session_id = params.session_id;
      insertData.group_id = params.group_id;
      insertData.name = params.name;
      insertData.address = params.address;
      insertData.place_id = params.place_id;
      insertData.latitude = params.latitude;
      insertData.longitude = params.longitude;
      insertData.preference_score = params.preference_score;
      insertData.preferred_duration = params.preferred_duration;
      insertData.preferred_date = params.preferred_date;
      insertData.notes = params.notes;
      insertData.is_personal_favorite = params.is_personal_favorite;
    } else {
      // Old format (AddPlaceToMyPlacesParams)
      const oldParams = params as AddPlaceToMyPlacesParams;
      insertData.user_id = userId || oldParams.userId;
      insertData.session_id = oldParams.sessionId;
      insertData.group_id = oldParams.groupId;
      insertData.name = oldParams.name;
      insertData.address = oldParams.address;
      insertData.place_id = oldParams.placeId;
      insertData.latitude = oldParams.latitude;
      insertData.longitude = oldParams.longitude;
      insertData.preference_score = oldParams.preferenceScore;
      insertData.preferred_duration = oldParams.preferredDuration;
      insertData.preferred_date = oldParams.preferredDate;
      insertData.notes = oldParams.notes;
      insertData.is_personal_favorite = oldParams.isPersonalFavorite;
    }
    
    // Generate unique place_id if it's 'temp' or empty
    if (!insertData.place_id || insertData.place_id === 'temp') {
      insertData.place_id = `place_${insertData.latitude}_${insertData.longitude}_${Date.now()}`;
    }
    
    console.log('🔍 Inserting into my_places:', {
      ...insertData,
      actualUserId: userId,
      sessionIdFromParams: 'session_id' in params ? params.session_id : (params as AddPlaceToMyPlacesParams).sessionId
    });
    
    // Insert into my_places table with conflict handling
    const { data: myPlaceData, error } = await supabase
      .from('my_places')
      .insert(insertData)
      .select()
      .single();
      
    if (error) {
      console.error('Error adding place to my_places:', error);
      throw new Error('Failed to add place to wishlist');
    }
    
    // 🎯 AUTOMATIC INTEGRATION: Add to trip destinations and user preferences
    try {
      // 1. Check if destination already exists in trip
      const { data: existingDestination } = await supabase
        .from('destinations')
        .select('id')
        .eq('group_id', insertData.group_id)
        .eq('place_id', insertData.place_id)
        .single();
        
      let destinationId;
      
      if (existingDestination) {
        // Use existing destination
        destinationId = existingDestination.id;
      } else {
        // Create destination in destinations table
        const { data: newDestination, error: destinationError } = await supabase
          .from('destinations')
          .insert({
            group_id: insertData.group_id,
            name: insertData.name,
            address: insertData.address,
            place_id: insertData.place_id,
            latitude: insertData.latitude,
            longitude: insertData.longitude,
            created_by: userId,
          })
          .select()
          .single();
          
        if (destinationError) {
          console.warn('Warning: Could not create destination automatically:', destinationError);
          // Don't fail the my_places creation, just warn
        } else {
          destinationId = newDestination.id;
        }
      }
      
      // 2. Create user preference if destination was created/found
      if (destinationId) {
        // Check if user preference already exists
        let query = supabase
          .from('user_preferences')
          .select('id')
          .eq('group_id', insertData.group_id)
          .eq('destination_id', destinationId);
          
        if (userId) {
          query = query.eq('user_id', userId);
        } else {
          query = query.eq('session_id', insertData.session_id);
        }
        
        const { data: existingPreference } = await query.single();
        
        if (!existingPreference) {
          // Create user preference
          const { error: preferenceError } = await supabase
            .from('user_preferences')
            .insert({
              group_id: insertData.group_id,
              user_id: userId,
              session_id: insertData.session_id,
              destination_id: destinationId,
              preference_score: insertData.preference_score,
              preferred_duration: insertData.preferred_duration,
              notes: insertData.notes,
              is_personal_favorite: insertData.is_personal_favorite,
            });
            
          if (preferenceError) {
            console.warn('Warning: Could not create user preference automatically:', preferenceError);
            // Don't fail the my_places creation, just warn
          } else {
            console.log('✅ Automatically added to trip destinations and preferences');
          }
        }
      }
    } catch (autoIntegrationError) {
      console.warn('Warning: Auto-integration to trip failed:', autoIntegrationError);
      // Don't fail the my_places creation - the user can manually add later
    }
    
    // 🎯 自動最適化は無効化（手動でOptimizeボタンを押す必要がある）
    // try {
    //   await triggerAutomaticOptimization(insertData.group_id, insertData.session_id);
    // } catch (optimizationError) {
    //   console.warn('⚠️ Auto-optimization failed but place was added successfully:', optimizationError);
    //   // エラーでもMy Places追加は成功させる
    // }
    
    return { success: true, id: myPlaceData.id, autoAddedToTrip: true };
  } catch (error) {
    console.error('Error in addPlaceToMyPlaces:', error);
    throw new Error('Failed to add place to wishlist');
  }
}

/**
 * Update a place in the user's personal wishlist
 */
export async function updateMyPlace(params: UpdateMyPlaceParams) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Prepare update object with only provided fields
    const updateData: any = {};
    
    if (params.preferenceScore !== undefined) updateData.preference_score = params.preferenceScore;
    if (params.preferredDuration !== undefined) updateData.preferred_duration = params.preferredDuration;
    if (params.preferredDate !== undefined) updateData.preferred_date = params.preferredDate;
    if (params.notes !== undefined) updateData.notes = params.notes;
    if (params.isPersonalFavorite !== undefined) updateData.is_personal_favorite = params.isPersonalFavorite;
    
    // Update timestamp
    updateData.updated_at = new Date().toISOString();
    
    // Update in database
    const { data, error } = await supabase
      .from('my_places')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating place in my_places:', error);
      throw new Error('Failed to update place in wishlist');
    }
    
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Error in updateMyPlace:', error);
    throw new Error('Failed to update place in wishlist');
  }
}

/**
 * Get all places in the user's personal wishlist for a specific trip with adoption status
 */
export async function getMyPlacesForTrip(groupId: string, sessionId: string) {
  try {
    console.log('🔍 getMyPlacesForTrip called with:', { groupId, sessionId });
    
    // Create Supabase client with cookies
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    console.log('🔍 Supabase client created successfully');
    
    // Get the user ID from the session if authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    console.log('🔍 Authentication result:', { 
      userId: userId ? 'authenticated' : 'guest', 
      authError: authError?.message 
    });
    
    // Validate inputs
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    if (!sessionId && !userId) {
      throw new Error('Either sessionId or userId is required');
    }
    
    // First, test if my_places table is accessible at all
    console.log('🔍 Testing my_places table access...');
    const { count, error: testError } = await supabase
      .from('my_places')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);
    
    console.log('🔍 Table access test:', { count, testError: testError?.message });
    
    // Query to get places
    let query = supabase
      .from('my_places')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    // Add user/session filter based on authentication status
    if (userId) {
      query = query.eq('user_id', userId);
      console.log('🔍 Querying by user_id:', userId);
    } else {
      query = query.eq('session_id', sessionId);
      console.log('🔍 Querying by session_id:', sessionId);
    }
    
    console.log('🔍 Executing query...');
    const { data, error } = await query;
    console.log('🔍 Query result:', { 
      dataLength: data?.length, 
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      errorHint: error?.hint
    });
      
    if (error) {
      console.error('Error fetching places from my_places:', error);
      throw new Error(`Failed to fetch places from wishlist: ${error.message}`);
    }
    
    // Get optimized places from places table to check adoption status
    const { data: optimizedPlaces } = await supabase
      .from('places')
      .select('name, latitude, longitude, visit_order, scheduled_date, scheduled_duration')
      .eq('group_id', groupId);
    
    // Transform data for frontend with adoption status
    const places = data.map(place => {
      // Check if this place is adopted in the optimized plan
      const adoptedPlace = optimizedPlaces?.find(opt => 
        opt.name === place.name || 
        (Math.abs(opt.latitude - place.latitude) < 0.001 && 
         Math.abs(opt.longitude - place.longitude) < 0.001)
      );
      
      return {
        id: place.id,
        name: place.name,
        address: place.address,
        placeId: place.place_id,
        latitude: place.latitude,
        longitude: place.longitude,
        preferenceScore: place.preference_score,
        preferredDuration: place.preferred_duration,
        preferredDate: place.preferred_date,
        notes: place.notes,
        isPersonalFavorite: place.is_personal_favorite,
        createdAt: place.created_at,
        // 🎯 Adoption status
        isAdopted: !!adoptedPlace,
        adoptedDetails: adoptedPlace ? {
          visitOrder: adoptedPlace.visit_order,
          scheduledDate: adoptedPlace.scheduled_date,
          allocatedDuration: adoptedPlace.scheduled_duration
        } : null
      };
    });
    
    return { success: true, places };
  } catch (error) {
    console.error('Error in getMyPlacesForTrip:', error);
    
    // より詳細なエラー情報を提供
    let errorMessage = 'Failed to fetch places from wishlist';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Add a My Place to the actual trip (copy from my_places to destinations + user_preferences)
 */
export async function addMyPlaceToTrip(myPlaceId: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Get the user ID from the session if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    // 1. Get the My Place data
    const { data: myPlace, error: fetchError } = await supabase
      .from('my_places')
      .select('*')
      .eq('id', myPlaceId)
      .single();
      
    if (fetchError || !myPlace) {
      console.error('Error fetching my place:', fetchError);
      throw new Error('My Place not found');
    }
    
    // 2. Check if destination already exists in trip
    const { data: existingDestination } = await supabase
      .from('destinations')
      .select('id')
      .eq('group_id', myPlace.group_id)
      .eq('place_id', myPlace.place_id)
      .single();
      
    let destinationId;
    
    if (existingDestination) {
      // Use existing destination
      destinationId = existingDestination.id;
    } else {
      // 3. Create destination in destinations table
      const { data: newDestination, error: destinationError } = await supabase
        .from('destinations')
        .insert({
          group_id: myPlace.group_id,
          name: myPlace.name,
          address: myPlace.address,
          place_id: myPlace.place_id,
          latitude: myPlace.latitude,
          longitude: myPlace.longitude,
          created_by: userId,
        })
        .select()
        .single();
        
      if (destinationError) {
        console.error('Error creating destination:', destinationError);
        throw new Error('Failed to create destination');
      }
      
      destinationId = newDestination.id;
    }
    
    // 4. Check if user preference already exists
    let query = supabase
      .from('user_preferences')
      .select('id')
      .eq('group_id', myPlace.group_id)
      .eq('destination_id', destinationId);
      
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('session_id', myPlace.session_id);
    }
    
    const { data: existingPreference } = await query.single();
    
    if (existingPreference) {
      return { success: true, message: 'Place already in trip' };
    }
    
    // 5. Create user preference
    const { error: preferenceError } = await supabase
      .from('user_preferences')
      .insert({
        group_id: myPlace.group_id,
        user_id: userId,
        session_id: myPlace.session_id,
        destination_id: destinationId,
        preference_score: myPlace.preference_score,
        preferred_duration: myPlace.preferred_duration,
        notes: myPlace.notes,
        is_personal_favorite: myPlace.is_personal_favorite,
      });
      
    if (preferenceError) {
      console.error('Error creating user preference:', preferenceError);
      throw new Error('Failed to create user preference');
    }
    
    return { success: true, message: 'Successfully added to trip' };
  } catch (error) {
    console.error('Error in addMyPlaceToTrip:', error);
    throw new Error('Failed to add place to trip');
  }
}

/**
 * Copy all My Places to the actual trip
 */
export async function copyAllMyPlacesToTrip(groupId: string, sessionId: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Get all my places for this trip
    const { places } = await getMyPlacesForTrip(groupId, sessionId);
    
    let successCount = 0;
    let errors: string[] = [];
    
    // Copy each place to trip
    for (const place of places) {
      try {
        await addMyPlaceToTrip(place.id);
        successCount++;
      } catch (error) {
        errors.push(`Failed to add ${place.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return { 
      success: true, 
      message: `Added ${successCount} places to trip${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      errors 
    };
  } catch (error) {
    console.error('Error in copyAllMyPlacesToTrip:', error);
    throw new Error('Failed to copy places to trip');
  }
}

/**
 * Delete a place from the user's personal wishlist
 */
export async function deleteMyPlace(id: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    const { error } = await supabase
      .from('my_places')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting place from my_places:', error);
      throw new Error('Failed to delete place from wishlist');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in deleteMyPlace:', error);
    throw new Error('Failed to delete place from wishlist');
  }
}

/**
 * 🆕 自動最適化トリガー関数
 * My Places追加後に自動的に最適化を実行
 */
async function triggerAutomaticOptimization(groupId: string, sessionId: string) {
  try {
    console.log('🚀 Starting automatic optimization for group:', groupId);
    
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // グループの全destinations数をチェック
    const { data: destinations, error: destError } = await supabase
      .from('destinations')
      .select('id')
      .eq('group_id', groupId);
    
    if (destError) {
      console.warn('Failed to check destinations:', destError);
      return;
    }
    
    // グループメンバーが存在するかチェック（最適化に必要）
    const { data: members, error: memberError } = await supabase
      .from('group_members')
      .select('id, user_id, session_id')
      .eq('group_id', groupId);
    
    if (memberError || !members || members.length === 0) {
      console.warn('⚠️ Group members not found, skipping optimization for now:', memberError?.message);
      // Skip optimization if members aren't set up yet
      // The user can manually trigger optimization later
      return;
    }
    
    // トリップ情報もチェック（最適化に必要）
    const { data: tripInfo, error: tripError } = await supabase
      .from('trip_groups')
      .select('departure_location, departure_location_lat, departure_location_lng')
      .eq('id', groupId)
      .single();
    
    console.log('🔍 Trip info for optimization:', {
      tripInfo,
      tripError: tripError?.message,
      hasCoordinates: !!(tripInfo?.departure_location_lat && tripInfo?.departure_location_lng)
    });
    
    // 1箇所以上あれば最適化実行
    if (destinations && destinations.length >= 1) {
      console.log(`📊 Found ${destinations.length} destinations, triggering optimization...`);
      
      // 出発地座標がない場合は最適化をスキップ
      if (!tripInfo?.departure_location_lat || !tripInfo?.departure_location_lng) {
        console.warn('⚠️ Skipping optimization: departure coordinates missing');
        return;
      }
      
      const userContext = {
        id: null,
        sessionId: sessionId,
        isGuest: true
      };
      
      // 最適化実行
      const result = await optimizeTripRoute(groupId, userContext);
      
      if (result.status === 'success') {
        console.log('✅ Auto-optimization completed successfully');
        
        // 🎯 リアルタイム更新通知
        await broadcastOptimizationUpdate(groupId, result.data);
      } else {
        console.warn('⚠️ Auto-optimization failed:', result.error);
      }
    } else {
      console.log('📍 No destinations found, skipping optimization');
    }
  } catch (error) {
    console.warn('⚠️ Auto-optimization failed:', error);
    // エラーでもMy Places追加は成功させる
  }
}

/**
 * 🆕 リアルタイム更新ブロードキャスト関数
 * 最適化完了をグループメンバーに通知
 */
async function broadcastOptimizationUpdate(groupId: string, optimizationData: any) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Supabase Realtimeでグループメンバーに通知
    const { error } = await supabase
      .from('optimization_updates')
      .insert({
        group_id: groupId,
        update_type: 'route_optimized',
        data: optimizationData,
        timestamp: new Date().toISOString()
      });
    
    if (error) {
      console.warn('Failed to broadcast optimization update:', error);
    } else {
      console.log('📡 Optimization update broadcasted successfully');
    }
  } catch (error) {
    console.warn('Failed to broadcast update:', error);
  }
} 