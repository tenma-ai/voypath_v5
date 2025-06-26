// Data fetching functions for optimization algorithm

import { createClient } from '@/lib/supabase/server'
import type { 
  OptimizationInput, 
  DataFetchResult, 
  UserContext 
} from './types'
import type {
  TripGroups,
  Destinations,
  UserPreferences,
  GroupMembers,
  Places,
  Users
} from '@/lib/database.types'

/**
 * Get current user context (guest or authenticated)
 */
export async function getCurrentUserContext(): Promise<UserContext> {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  
  // Try to get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    return {
      id: user.id,
      sessionId: null,
      isGuest: false
    }
  }
  
  // Handle guest user - get session from localStorage or generate new
  // Note: This would typically be handled client-side
  const sessionId = crypto.randomUUID() // In real implementation, retrieve from client
  
  return {
    id: null,
    sessionId,
    isGuest: true
  }
}

/**
 * Fetch all optimization data for a trip group
 */
export async function fetchOptimizationData(
  groupId: string,
  currentUser: UserContext
): Promise<DataFetchResult<OptimizationInput>> {
  const { createClient } = await import('@/lib/supabase/server');
  const { cookies } = await import('next/headers');
  
  // Handle the case where cookies() might not be available in some contexts
  let supabase;
  try {
    const cookieStore = cookies();
    supabase = createClient(cookieStore);
  } catch (cookieError) {
    console.warn('Cookie context not available, falling back to direct client');
    // Create a basic client without cookies for optimization context
    const { createClient: createDirectClient } = await import('@supabase/supabase-js');
    supabase = createDirectClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  
  try {
    console.log('🔍 fetchOptimizationData called for groupId:', groupId);
    
    // Fetch trip group details
    const { data: tripGroup, error: tripError } = await supabase
      .from('trip_groups')
      .select('*')
      .eq('id', groupId)
      .single()
    
    console.log('🔍 Trip group fetched:', { 
      tripGroup: tripGroup ? {
        id: tripGroup.id,
        departure_location: tripGroup.departure_location,
        departure_location_lat: tripGroup.departure_location_lat,
        departure_location_lng: tripGroup.departure_location_lng
      } : null,
      tripError: tripError?.message 
    });
    
    if (tripError) throw new Error(`Failed to fetch trip group: ${tripError.message}`)
    if (!tripGroup) throw new Error('Trip group not found')
    
    // Fetch all related data in parallel
    const [
      destinationsResult,
      placesResult,
      preferencesResult,
      membersResult
    ] = await Promise.all([
      // Fetch destinations (legacy table)
      supabase
        .from('destinations')
        .select('*')
        .eq('group_id', groupId),
      
      // Fetch places (new two-tier system)
      supabase
        .from('places')
        .select('*')
        .eq('group_id', groupId)
        .order('visit_order', { ascending: true, nullsFirst: false }),
      
      // Fetch user preferences
      supabase
        .from('user_preferences')
        .select('*')
        .eq('group_id', groupId),
      
      // Fetch group members
      supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
    ])
    
    // Check for errors
    if (destinationsResult.error) throw new Error(`Failed to fetch destinations: ${destinationsResult.error.message}`)
    if (placesResult.error) throw new Error(`Failed to fetch places: ${placesResult.error.message}`)
    if (preferencesResult.error) throw new Error(`Failed to fetch preferences: ${preferencesResult.error.message}`)
    if (membersResult.error) throw new Error(`Failed to fetch members: ${membersResult.error.message}`)
    
    const optimizationInput = {
      groupId,
      tripGroup,
      destinations: destinationsResult.data || [],
      places: placesResult.data || [],
      userPreferences: preferencesResult.data || [],
      groupMembers: membersResult.data || [],
      currentUser
    };
    
    console.log('🔍 Optimization input prepared:', {
      groupId,
      hasTripGroup: !!tripGroup,
      destinationsCount: optimizationInput.destinations.length,
      placesCount: optimizationInput.places.length,
      preferencesCount: optimizationInput.userPreferences.length,
      membersCount: optimizationInput.groupMembers.length,
      departureCoords: {
        lat: tripGroup?.departure_location_lat,
        lng: tripGroup?.departure_location_lng
      }
    });
    
    // 🔍 DEBUG: Log member and preference details
    console.log('🔍 Members debug:', optimizationInput.groupMembers.map(m => ({
      id: m.id,
      user_id: m.user_id,
      session_id: m.session_id,
      display_name: m.display_name
    })));
    
    console.log('🔍 Preferences debug:', optimizationInput.userPreferences.map(p => ({
      id: p.id,
      user_id: p.user_id,
      session_id: p.session_id,
      destination_id: p.destination_id
    })));
    
    return {
      data: optimizationInput,
      error: null
    }
  } catch (error) {
    console.error('Error fetching optimization data:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}

/**
 * Fetch user details for preference validation
 */
export async function fetchUserDetails(
  userIds: string[],
  sessionIds: string[]
): Promise<DataFetchResult<Map<string, Users>>> {
  const { createClient } = await import('@/lib/supabase/server');
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // Remove duplicates and nulls
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
    const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)))
    
    // Fetch users by ID or session ID
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .or(`id.in.(${uniqueUserIds.join(',')}),session_id.in.(${uniqueSessionIds.join(',')})`)
    
    if (error) throw new Error(`Failed to fetch users: ${error.message}`)
    
    // Create map for quick lookup
    const userMap = new Map<string, Users>()
    users?.forEach(user => {
      if (user.id) userMap.set(user.id, user)
      if (user.session_id) userMap.set(user.session_id, user)
    })
    
    return {
      data: userMap,
      error: null
    }
  } catch (error) {
    console.error('Error fetching user details:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}

/**
 * Check if current user is a member of the group
 */
export async function checkGroupMembership(
  groupId: string,
  currentUser: UserContext
): Promise<boolean> {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  
  try {
    let query = supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
    
    // Add user condition based on type
    if (currentUser.isGuest && currentUser.sessionId) {
      query = query.eq('session_id', currentUser.sessionId)
    } else if (!currentUser.isGuest && currentUser.id) {
      query = query.eq('user_id', currentUser.id)
    } else {
      return false
    }
    
    const { data, error } = await query.single()
    
    return !error && !!data
  } catch (error) {
    console.error('Error checking group membership:', error)
    return false
  }
}

/**
 * Get member's role in the group
 */
export async function getMemberRole(
  groupId: string,
  currentUser: UserContext
): Promise<'admin' | 'member' | 'viewer' | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  
  try {
    let query = supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
    
    // Add user condition based on type
    if (currentUser.isGuest && currentUser.sessionId) {
      query = query.eq('session_id', currentUser.sessionId)
    } else if (!currentUser.isGuest && currentUser.id) {
      query = query.eq('user_id', currentUser.id)
    } else {
      return null
    }
    
    const { data, error } = await query.single()
    
    if (error || !data) return null
    
    return data.role as 'admin' | 'member' | 'viewer'
  } catch (error) {
    console.error('Error getting member role:', error)
    return null
  }
}

/**
 * Batch fetch multiple trip groups
 */
export async function fetchMultipleTripGroups(
  groupIds: string[]
): Promise<DataFetchResult<TripGroups[]>> {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  
  try {
    const { data, error } = await supabase
      .from('trip_groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(`Failed to fetch trip groups: ${error.message}`)
    
    return {
      data: data || [],
      error: null
    }
  } catch (error) {
    console.error('Error fetching multiple trip groups:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}