import { create } from 'zustand';
import { OptimizationResult } from '../types/optimization';
import { supabase, callSupabaseFunction } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isGuest: boolean;
  isPremium?: boolean;
  premiumExpiresAt?: string;
}

export interface Trip {
  id: string;
  departureLocation: string; // Required field - where the trip starts from
  name?: string; // Optional - auto-generated from departureLocation if not provided
  description?: string; // Optional
  destination?: string; // Optional - can be inferred from places
  startDate?: string; // Optional - for undated trips
  endDate?: string; // Optional - for undated trips
  memberCount: number;
  createdAt: string;
  ownerId: string;
  icon?: string; // Added trip icon field
  addPlaceDeadline?: string; // ISO string for deadline
  memberPermissions?: Record<string, 'admin' | 'member'>; // userId -> role
}

export interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  wishLevel: number;
  stayDuration: number;
  priceLevel: number;
  image?: string;
  scheduled: boolean;
  scheduledDate?: string;
  visitDate?: string; // When user wants to visit
  notes?: string;
  tripId?: string; // Associate place with trip
  userId?: string; // Who added this place
  // Database schema compatibility
  trip_id?: string;
  user_id?: string;
  // Optimization fields from database
  is_selected_for_optimization?: boolean;
  normalized_wish_level?: number;
  selection_round?: number;
  wish_level?: number;
  stay_duration_minutes?: number;
  google_place_id?: string;
  google_rating?: number;
  google_price_level?: number;
  estimated_cost?: number;
  created_at?: string;
  updated_at?: string;
  preferred_time_of_day?: 'morning' | 'noon' | 'afternoon' | 'night';
}

// Premium limits
export const LIMITS = {
  FREE: {
    TRIPS: 3,
    MEMBERS_PER_TRIP: 5,
    PLACES_PER_USER: 20,
  },
  PREMIUM: {
    TRIPS: Infinity,
    MEMBERS_PER_TRIP: Infinity,
    PLACES_PER_USER: Infinity,
  }
};

interface StoreState {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // User
  user: User | null;
  setUser: (user: User) => void;

  // Current trip
  currentTrip: Trip | null;
  setCurrentTrip: (trip: Trip) => Promise<void>;

  // Trips
  trips: Trip[];
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;

  // Places
  places: Place[];
  addPlace: (place: Place, options?: { skipDuplicateCheck?: boolean; autoMerge?: boolean }) => Promise<any>;
  updatePlace: (id: string, updates: Partial<Place>) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;

  // Duplicate management
  findDuplicatesInTrip: (tripId?: string) => Promise<any[]>;
  mergeDuplicateGroup: (duplicateGroup: any) => Promise<boolean>;
  autoMergeAllDuplicates: (tripId?: string) => Promise<number>;
  getDuplicateSummary: (tripId?: string) => Promise<any>;

  // Member Colors - Centralized color management
  memberColors: Record<string, string>;
  tripMembers: Array<{ user_id: string; name: string; email: string; assigned_color_index?: number; role?: 'admin' | 'member'; can_edit_places?: boolean }>;
  loadMemberColorsForTrip: (tripId: string) => Promise<void>;

  // UI State
  isOptimizing: boolean;
  setIsOptimizing: (optimizing: boolean) => void;
  isCreatingSystemPlaces: boolean;

  // Optimization Results
  optimizationResult: OptimizationResult | null;
  setOptimizationResult: (result: OptimizationResult | null) => void;
  
  // User-initiated optimization control
  hasUserOptimized: boolean;
  setHasUserOptimized: (value: boolean) => void;
  
  // Edit mode control - when true, optimization is disabled
  hasUserEditedSchedule: boolean;
  setHasUserEditedSchedule: (value: boolean) => void;
  
  
  // Success animation control
  showOptimizationSuccess: boolean;
  setShowOptimizationSuccess: (value: boolean) => void;

  // Active view mode (for showing/hiding buttons)
  activeView: 'map' | 'calendar';
  setActiveView: (view: 'map' | 'calendar') => void;

  // Selected day for ListView/MapView synchronization
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;

  // Real-time sync system for calendar edits
  scheduleUpdateQueue: any[];
  isProcessingScheduleUpdates: boolean;
  lastScheduleUpdateId: string | null;
  
  // Real-time schedule update functions
  updateScheduleInRealTime: (updateData: any) => Promise<void>;
  broadcastScheduleUpdate: (updateData: any) => void;
  syncOptimizationResults: () => Promise<void>;
  setupRealTimeSync: () => () => void;
  
  // Calendar edit functions
  movePlace: (placeId: string, sourceIndex: number, targetIndex: number, dayData: any) => Promise<void>;
  resizePlaceDuration: (placeId: string, newDuration: number, oldDuration: number) => Promise<void>;
  insertPlace: (placeData: any, insertionContext: any) => Promise<void>;
  deleteScheduledPlace: (placeId: string, dayData: any, blockIndex: number) => Promise<void>;
  updateDayPlaces: (day: number, places: any[]) => void;
  updateScheduleFromBackend: (schedule: any) => void;

  // API Integration
  createTripWithAPI: (tripData: TripCreateData) => Promise<Trip>;
  optimizeTrip: (tripId: string) => Promise<void>;
  loadPlacesFromAPI: (tripId: string) => Promise<void>;
  loadOptimizationResult: (tripId: string) => Promise<void>;
  createSystemPlaces: (tripId: string) => Promise<void>;

  // Database Integration
  loadTripsFromDatabase: () => Promise<void>;
  loadPlacesFromDatabase: (tripId?: string) => Promise<void>;
  initializeFromDatabase: () => Promise<void>;
  handlePendingTripJoin: () => Promise<void>;

  // Premium functions
  canCreateTrip: () => boolean;
  canJoinTrip: () => boolean;
  canAddMember: (tripId: string) => boolean;
  canAddPlace: (userId: string, tripId?: string) => boolean;
  getUserPlaceCount: (userId: string, tripId?: string) => number;
  upgradeToPremium: () => void;

  // Supabase real-time subscriptions
  realtimeChannels: RealtimeChannel[];
  setupSupabaseRealtime: () => void;
}

export interface TripCreateData {
  departure_location: string;
  name?: string;
  description?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
}

export const useStore = create<StoreState>()((set, get) => ({
      // Theme
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      // User
      user: null,
      setUser: (user) => set({ user }),

      // Current trip
      currentTrip: null,
      setCurrentTrip: async (trip) => {
        console.log('🎯 setCurrentTrip called:', {
          tripId: trip.id,
          tripName: trip.name
        });
        
        const currentOptimizationResult = get().optimizationResult;
        const currentTripId = get().currentTrip?.id;
        const currentHasUserOptimized = get().hasUserOptimized;
        const currentHasUserEditedSchedule = get().hasUserEditedSchedule;
        
        console.log('📊 Current state before setting trip:', {
          currentTripId,
          currentHasUserOptimized,
          currentHasUserEditedSchedule
        });
        
        // Check if this is truly a different trip vs. navigation return
        // Only consider it a new trip if we had a current trip AND it's different
        const isActuallyNewTrip = currentTripId && currentTripId !== trip.id;
        console.log('🔍 Trip analysis:', { isActuallyNewTrip });
        
        // Check localStorage for edit state before any state changes
        const savedEditState = localStorage.getItem(`hasUserEditedSchedule_${trip.id}`);
        
        // Debug: List all localStorage keys that contain edit state
        const allLocalStorageKeys = Object.keys(localStorage).filter(key => key.includes('hasUserEditedSchedule'));
        console.log('💾 localStorage edit state for trip:', {
          tripId: trip.id,
          savedEditState,
          key: `hasUserEditedSchedule_${trip.id}`,
          allEditStateKeys: allLocalStorageKeys,
          allEditStateValues: allLocalStorageKeys.reduce((acc, key) => {
            acc[key] = localStorage.getItem(key);
            return acc;
          }, {} as Record<string, string | null>)
        });
        
        
        set({ 
          currentTrip: trip, 
          showOptimizationSuccess: false  // Reset success animation when switching trips
        });
        
        // Save current trip ID to localStorage for persistence
        if (trip) {
          localStorage.setItem('currentTripId', trip.id);
        }
        
        if (trip) {
          try {
            // Always reload member colors
            await get().loadMemberColorsForTrip(trip.id);
            
            // Always load data first
            await get().loadPlacesFromDatabase(trip.id);
            
            if (isActuallyNewTrip) {
              console.log('🔄 Switching to new trip - resetting states');
              // Switching to a completely different trip - reset states but still check localStorage
              set({ 
                hasUserOptimized: false,
                hasUserEditedSchedule: false,
                optimizationResult: null
              });
              
              // Still check localStorage for this trip's edit state
              if (savedEditState === 'true') {
                console.log('✅ Found saved edit state for new trip, restoring');
                set({ hasUserEditedSchedule: true });
              }
            } else {
              console.log('🔄 Same trip or initial load - checking localStorage');
              // Same trip or initial load - always check localStorage
              if (savedEditState === 'true') {
                console.log('✅ Setting hasUserEditedSchedule to true from localStorage');
                set({ hasUserEditedSchedule: true });
              } else {
                console.log('❌ No saved edit state found, keeping current state');
              }
            }
            
            // Load optimization result after potential reset
            await get().loadOptimizationResult(trip.id);
            
            // Final state check
            const finalState = get();
            console.log('🏁 Final state after setCurrentTrip:', {
              hasUserOptimized: finalState.hasUserOptimized,
              hasUserEditedSchedule: finalState.hasUserEditedSchedule,
              optimizationResult: !!finalState.optimizationResult
            });
            
          } catch (error) {
            console.error('Failed to load trip data:', error);
          }
        }
      },

      // Trips
      trips: [],
      addTrip: (trip) =>
        set((state) => ({ trips: [...state.trips, trip] })),
      updateTrip: async (id, updates) => {
        try {
          // Use trip-management Edge Function for consistency
          const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
          if (authError) {
            throw new Error('Authentication required');
          }
          if (!currentUser) {
            throw new Error('User not authenticated');
          }

          // Prepare update data for trip-management API
          const updateData: any = {
            trip_id: id
          };

          // Handle both camelCase and snake_case field names for compatibility
          // Only include fields that are not undefined and not null
          if (updates.name !== undefined && updates.name !== null) updateData.name = updates.name;
          if (updates.description !== undefined && updates.description !== null) updateData.description = updates.description;
          if (updates.departureLocation !== undefined && updates.departureLocation !== null) updateData.departure_location = updates.departureLocation;
          if (updates.departure_location !== undefined && updates.departure_location !== null) updateData.departure_location = updates.departure_location;
          if (updates.departure_latitude !== undefined) updateData.departure_latitude = updates.departure_latitude;
          if (updates.departure_longitude !== undefined) updateData.departure_longitude = updates.departure_longitude;
          if (updates.destination !== undefined && updates.destination !== null) updateData.destination = updates.destination;
          if (updates.destination_latitude !== undefined) updateData.destination_latitude = updates.destination_latitude;
          if (updates.destination_longitude !== undefined) updateData.destination_longitude = updates.destination_longitude;
          if (updates.startDate !== undefined && updates.startDate !== null) updateData.start_date = updates.startDate;
          if (updates.start_date !== undefined && updates.start_date !== null) updateData.start_date = updates.start_date;
          if (updates.endDate !== undefined && updates.endDate !== null) updateData.end_date = updates.endDate;
          if (updates.end_date !== undefined && updates.end_date !== null) updateData.end_date = updates.end_date;
          if (updates.addPlaceDeadline !== undefined && updates.addPlaceDeadline !== null) updateData.add_place_deadline = updates.addPlaceDeadline;

          console.log('🚀 Updating trip via API with data:', updateData);
          console.log('🔑 Current auth session check...');
          
          const { data: session, error: sessionError } = await supabase.auth.getSession();
          console.log('📊 Session status:', {
            has_session: !!session?.session,
            user_id: session?.session?.user?.id,
            session_error: sessionError
          });
          
          // Call trip-management Edge Function with PUT method
          console.log('📞 Calling Edge Function...');
          const { data, error } = await supabase.functions.invoke('trip-management', {
            body: updateData,
            method: 'PUT'
          });

          console.log('📥 Edge Function response:', { data, error });

          if (error) {
            console.error('❌ Failed to update trip via API:', error);
            console.error('❌ Error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            throw new Error(error.message || 'Failed to update trip');
          }
          
          console.log('Trip updated successfully via API:', data);
          console.log('Response data structure:', JSON.stringify(data, null, 2));

          // Update local state with the response data
          if (data && data.trip) {
            const updatedTrip = data.trip;
            console.log('Updating local state with trip data:', updatedTrip);
            set((state) => ({
              trips: state.trips.map((trip) =>
                trip.id === id ? updatedTrip : trip
              ),
              currentTrip: state.currentTrip?.id === id 
                ? updatedTrip 
                : state.currentTrip,
            }));
            console.log('Local state updated successfully');
          } else {
            console.log('No trip data in response, using fallback update');
            // Fallback: update with provided updates if no trip data returned
            set((state) => ({
              trips: state.trips.map((trip) =>
                trip.id === id ? { ...trip, ...updates } : trip
              ),
              currentTrip: state.currentTrip?.id === id 
                ? { ...state.currentTrip, ...updates } 
                : state.currentTrip,
            }));
          }

        } catch (error) {
          console.error('Trip update error:', error);
          throw error;
        }
      },
      deleteTrip: async (id) => {
        try {
          // Delete from database first
          const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', id);

          if (error) {
            // Failed to delete trip from database
            throw error;
          }

          // Remove from local state
          set((state) => ({
            trips: state.trips.filter((trip) => trip.id !== id),
            // If deleted trip was current trip, clear it
            currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
          }));

        } catch (error) {
          // Failed to delete trip
          throw error;
        }
      },

      // Places
      places: [],

      // Member Colors - Centralized color management
      memberColors: {},
      tripMembers: [],
      loadMemberColorsForTrip: async (tripId: string) => {
        const { MemberColorService } = await import('../services/MemberColorService');

        try {
          // Load trip members first
          const { data: membersData, error: membersError } = await supabase
            .from('trip_members')
            .select('user_id, role, assigned_color_index, can_edit_places')
            .eq('trip_id', tripId);


          if (membersError) {
            // Error loading trip members
            
            // Try to use fallback colors for current user at least
            const { user } = get();
            if (user) {
              const fallbackColorMap: Record<string, string> = {};
              const fallbackColor = MemberColorService.getColorByIndex(1);
              fallbackColorMap[user.id] = fallbackColor?.hex || '#0077BE';
              set({ memberColors: fallbackColorMap, tripMembers: [] });
            } else {
              set({ memberColors: {}, tripMembers: [] });
            }
            return;
          }

          // If no members found, set empty state and return
          if (!membersData || membersData.length === 0) {
            
            // Try to use fallback colors for current user at least
            const { user } = get();
            if (user) {
              const fallbackColorMap: Record<string, string> = {};
              const fallbackColor = MemberColorService.getColorByIndex(1);
              fallbackColorMap[user.id] = fallbackColor?.hex || '#0077BE';
              set({ memberColors: fallbackColorMap, tripMembers: [] });
            } else {
              set({ memberColors: {}, tripMembers: [] });
            }
            return;
          }

          // Load user data for each member
          const userIds = membersData.map(m => m.user_id);
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', userIds);


          if (usersError) {
            // Error loading users
            // Continue with members data only, without user details
          }

          // Format trip members data
          const formattedMembers = membersData.map((member: any) => {
            const userData = usersData?.find(u => u.id === member.user_id);
            return {
              user_id: member.user_id,
              name: userData?.name || userData?.email || 'Unknown User',
              email: userData?.email || '',
              assigned_color_index: member.assigned_color_index,
              role: member.role,
              can_edit_places: member.can_edit_places
            };
          });

          // Load member colors using MemberColorService
          const colorMapping = await (await import('../services/MemberColorService')).MemberColorService.getSimpleColorMapping(tripId);
          
          // Apply fallback colors if any are missing or invalid
          const finalColorMapping: Record<string, string> = {};
          membersData.forEach((member, index) => {
            const existingColor = colorMapping[member.user_id];
            if (!existingColor || existingColor === '#000000' || existingColor === 'undefined' || existingColor === '') {
              const fallbackColor = MemberColorService.getColorByIndex(index + 1) || MemberColorService.getColorByIndex(1);
              finalColorMapping[member.user_id] = fallbackColor?.hex || '#0077BE';
            } else {
              finalColorMapping[member.user_id] = existingColor;
            }
          });
          
          // Validate color assignment and fix any issues
          const validation = await (await import('../services/MemberColorService')).MemberColorService.validateColorAssignment(tripId);
          
          if (!validation.valid) {
            await (await import('../services/MemberColorService')).MemberColorService.fixDuplicateColors(tripId);
            await (await import('../services/MemberColorService')).MemberColorService.autoAssignMissingColors(tripId);
            // Reload colors after fixing
            const fixedColors = await (await import('../services/MemberColorService')).MemberColorService.getSimpleColorMapping(tripId);
            
            // Apply fallback colors again to fixed colors
            const finalFixedColors: Record<string, string> = {};
            membersData.forEach((member, index) => {
              const fixedColor = fixedColors[member.user_id];
              if (!fixedColor || fixedColor === '#000000' || fixedColor === 'undefined' || fixedColor === '') {
                const fallbackColor = MemberColorService.getColorByIndex(index + 1) || MemberColorService.getColorByIndex(1);
                finalFixedColors[member.user_id] = fallbackColor?.hex || '#0077BE';
              } else {
                finalFixedColors[member.user_id] = fixedColor;
              }
            });
            
            set({ memberColors: finalFixedColors, tripMembers: formattedMembers });
          } else {
            set({ memberColors: finalColorMapping, tripMembers: formattedMembers });
          }

        } catch (error) {
          // Failed to load member colors
          
          // Apply emergency fallback colors
          const { user } = get();
          if (user) {
            const emergencyColorMap: Record<string, string> = {};
            emergencyColorMap[user.id] = MemberColorService.getColorByIndex(0).hex;
            set({ memberColors: emergencyColorMap, tripMembers: [] });
          } else {
            set({ memberColors: {}, tripMembers: [] });
          }
        }
      },
      addPlace: async (place, options?: { skipDuplicateCheck?: boolean; autoMerge?: boolean }) => {
        const { currentTrip, user } = get();
        
        // Ensure we have current trip and user
        if (!currentTrip) {
          throw new Error('No current trip selected');
        }
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Check for duplicates unless explicitly skipped
        if (!options?.skipDuplicateCheck) {
          try {
            const { PlaceDuplicateService } = await import('../services/PlaceDuplicateService');
            const duplicates = await PlaceDuplicateService.checkForDuplicates(currentTrip.id, {
              google_place_id: place.google_place_id,
              name: place.name,
              latitude: place.latitude,
              longitude: place.longitude
            });

            if (duplicates.length > 0) {
              
              if (options?.autoMerge) {
                // Auto-merge with existing place (take highest values)
                const existingPlace = duplicates[0];
                const mergedData = {
                  wish_level: Math.max(existingPlace.wish_level, place.wish_level || place.wishLevel || 5),
                  stay_duration_minutes: Math.max(
                    existingPlace.stay_duration_minutes, 
                    Math.max(30, place.stay_duration_minutes || (place.stayDuration || 2) * 60)
                  ),
                  notes: [existingPlace.notes, place.notes].filter(Boolean).join(' | ') || null
                };

                // Update existing place instead of creating new one
                await get().updatePlace(existingPlace.id, mergedData);
                return { merged: true, existingPlace, duplicates };
              } else {
                // Return duplicates for UI handling
                return { duplicates, requiresUserDecision: true };
              }
            }
          } catch (error) {
            // Duplicate check failed, proceeding with place addition
          }
        }

        // Ensure place has correct trip and user IDs
        const placeWithIds = {
          ...place,
          trip_id: currentTrip.id,
          tripId: currentTrip.id,
          user_id: user.id,
          userId: user.id
        };
        
        // Persist to database first for consistency
        try {
          const { addPlaceToDatabase } = await import('../lib/supabase');
          
          const placeData = {
            id: placeWithIds.id,
            name: placeWithIds.name,
            category: placeWithIds.category || 'attraction',
            latitude: placeWithIds.latitude,
            longitude: placeWithIds.longitude,
            wish_level: placeWithIds.wish_level || placeWithIds.wishLevel || 5,
            stay_duration_minutes: Math.max(30, placeWithIds.stay_duration_minutes || (placeWithIds.stayDuration || 2) * 60),
            trip_id: currentTrip.id,
            user_id: user.id,
            display_color_hex: placeWithIds.display_color_hex || '#0077BE',
            color_type: placeWithIds.color_type || 'single',
            place_type: placeWithIds.place_type || 'member_wish',
            source: placeWithIds.source || 'user',
            address: placeWithIds.address,
            rating: placeWithIds.rating,
            price_level: placeWithIds.price_level || placeWithIds.priceLevel,
            estimated_cost: placeWithIds.estimated_cost,
            google_place_id: placeWithIds.google_place_id,
            google_rating: placeWithIds.google_rating,
            google_price_level: placeWithIds.google_price_level,
            google_types: placeWithIds.google_types,
            notes: placeWithIds.notes,
            image_url: placeWithIds.image_url,
            images: placeWithIds.images,
            preferred_time_of_day: placeWithIds.preferred_time_of_day,
            is_selected_for_optimization: false,  // Places start as pending, not auto-selected for optimization
            status: 'pending'  // New places are pending until user decides to optimize
          };

          const result = await addPlaceToDatabase(placeData);
          
          // Reload places for current trip to ensure consistency
          await get().loadPlacesFromDatabase(currentTrip.id);
          
          return { success: true, place: result.place };
          
        } catch (error) {
          // Failed to save place to database
          throw error;
        }
      },
      updatePlace: async (id, updates) => {
        // Update local state immediately
        set((state) => ({
          places: state.places.map((place) =>
            place.id === id ? { ...place, ...updates } : place
          ),
        }));

        // Persist to database
        try {
          const { supabase } = await import('../lib/supabase');
          
          const updateData: any = {};
          if (updates.name) updateData.name = updates.name;
          if (updates.wishLevel !== undefined) updateData.wish_level = updates.wishLevel;
          if (updates.stayDuration !== undefined) updateData.stay_duration_minutes = updates.stayDuration * 60;
          if (updates.scheduled !== undefined) updateData.is_selected_for_optimization = updates.scheduled;
          if (updates.visitDate) updateData.visit_date = updates.visitDate;
          if (updates.notes) updateData.notes = updates.notes;
          if (updates.preferred_time_of_day !== undefined) updateData.preferred_time_of_day = updates.preferred_time_of_day;

          const { error } = await supabase
            .from('places')
            .update(updateData)
            .eq('id', id);

          if (error) {
            // Failed to update place in database
            // Could implement rollback here if needed
          } else {
          }
        } catch (error) {
          // Failed to update place
        }
      },
      deletePlace: async (id) => {
        // Remove from local state immediately
        set((state) => ({
          places: state.places.filter((place) => place.id !== id),
        }));

        // Delete from database
        try {
          const { supabase } = await import('../lib/supabase');
          
          const { error } = await supabase
            .from('places')
            .delete()
            .eq('id', id);

          if (error) {
            // Failed to delete place from database
          } else {
          }
        } catch (error) {
          // Failed to delete place
        }
      },

      // Duplicate management
      findDuplicatesInTrip: async (tripId?: string) => {
        const { currentTrip } = get();
        const targetTripId = tripId || currentTrip?.id;
        
        if (!targetTripId) {
          throw new Error('No trip ID provided');
        }

        try {
          const { PlaceDuplicateService } = await import('../services/PlaceDuplicateService');
          return await PlaceDuplicateService.findAllDuplicatesInTrip(targetTripId);
        } catch (error) {
          // Failed to find duplicates
          return [];
        }
      },

      mergeDuplicateGroup: async (duplicateGroup) => {
        try {
          const { PlaceDuplicateService } = await import('../services/PlaceDuplicateService');
          const success = await PlaceDuplicateService.mergeDuplicatePlaces(duplicateGroup);
          
          if (success) {
            // Reload places to reflect the merge
            const { currentTrip } = get();
            if (currentTrip) {
              await get().loadPlacesFromDatabase(currentTrip.id);
            }
          }
          
          return success;
        } catch (error) {
          // Failed to merge duplicate group
          return false;
        }
      },

      autoMergeAllDuplicates: async (tripId?: string) => {
        const { currentTrip } = get();
        const targetTripId = tripId || currentTrip?.id;
        
        if (!targetTripId) {
          throw new Error('No trip ID provided');
        }

        try {
          const { PlaceDuplicateService } = await import('../services/PlaceDuplicateService');
          const mergedCount = await PlaceDuplicateService.autoMergeAllDuplicates(targetTripId);
          
          // Reload places to reflect the merges
          await get().loadPlacesFromDatabase(targetTripId);
          
          return mergedCount;
        } catch (error) {
          // Failed to auto-merge duplicates
          return 0;
        }
      },

      getDuplicateSummary: async (tripId?: string) => {
        const { currentTrip } = get();
        const targetTripId = tripId || currentTrip?.id;
        
        if (!targetTripId) {
          return {
            totalDuplicateGroups: 0,
            totalDuplicatePlaces: 0,
            potentialSavings: 'No trip selected',
            groups: []
          };
        }

        try {
          const { PlaceDuplicateService } = await import('../services/PlaceDuplicateService');
          return await PlaceDuplicateService.getDuplicateSummary(targetTripId);
        } catch (error) {
          // Failed to get duplicate summary
          return {
            totalDuplicateGroups: 0,
            totalDuplicatePlaces: 0,
            potentialSavings: 'Error calculating',
            groups: []
          };
        }
      },

      // UI State
      isOptimizing: false,
      setIsOptimizing: (optimizing) => set({ isOptimizing: optimizing }),
      isCreatingSystemPlaces: false,

      // Optimization Results
      optimizationResult: null,
      setOptimizationResult: (result) => set({ optimizationResult: result }),
      
      // User-initiated optimization control
      hasUserOptimized: false,
      setHasUserOptimized: (value) => {
        set({ hasUserOptimized: value });
      },
      
      // Edit mode control - when true, optimization is disabled
      hasUserEditedSchedule: false,
      setHasUserEditedSchedule: (value) => {
        const { currentTrip } = get();
        console.log('🔄 setHasUserEditedSchedule called:', {
          value,
          currentTripId: currentTrip?.id,
          stackTrace: new Error().stack
        });
        
        set({ hasUserEditedSchedule: value });
        
        // Persist edit state to localStorage with trip context
        if (currentTrip) {
          if (value) {
            localStorage.setItem(`hasUserEditedSchedule_${currentTrip.id}`, 'true');
            console.log('💾 Saved edit state to localStorage:', `hasUserEditedSchedule_${currentTrip.id}=true`);
          } else {
            localStorage.removeItem(`hasUserEditedSchedule_${currentTrip.id}`);
            console.log('🗑️ Removed edit state from localStorage:', `hasUserEditedSchedule_${currentTrip.id}`);
          }
        } else {
          console.warn('⚠️ No currentTrip available when setting edit state');
        }
      },
      
      
      // Success animation control - only triggers once per optimization
      showOptimizationSuccess: false,
      setShowOptimizationSuccess: (value) => {
        set({ showOptimizationSuccess: value });
      },

      // Active view mode
      activeView: 'map',
      setActiveView: (view) => {
        set({ activeView: view });
      },

      // Selected day for ListView/MapView synchronization
      selectedDay: null,
      setSelectedDay: (day) => {
        set({ selectedDay: day });
      },
      
      // Real-time sync system
      scheduleUpdateQueue: [],
      isProcessingScheduleUpdates: false,
      lastScheduleUpdateId: null,
      
      // Real-time schedule update functions
      updateScheduleInRealTime: async (updateData: any) => {
        const { currentTrip, isProcessingScheduleUpdates } = get();
        if (!currentTrip || isProcessingScheduleUpdates) return;
        
        try {
          set({ isProcessingScheduleUpdates: true });
          
          // Add to update queue
          const updateId = crypto.randomUUID();
          const queuedUpdate = { ...updateData, id: updateId, timestamp: Date.now() };
          
          set(state => ({
            scheduleUpdateQueue: [...state.scheduleUpdateQueue, queuedUpdate],
            lastScheduleUpdateId: updateId
          }));
          
          // Broadcast to other views immediately (optimistic UI)
          get().broadcastScheduleUpdate(queuedUpdate);
          
          // Process through edge function in background
          await get().processScheduleUpdateQueue();
          
        } catch (error) {
          console.error('Failed to update schedule in real-time:', error);
        } finally {
          set({ isProcessingScheduleUpdates: false });
        }
      },
      
      broadcastScheduleUpdate: (updateData: any) => {
        // Emit custom event for real-time sync between views
        window.dispatchEvent(new CustomEvent('voypath-schedule-update', {
          detail: updateData
        }));
        
        // Update optimization result immediately for UI responsiveness
        const { optimizationResult } = get();
        if (optimizationResult?.optimization?.daily_schedules) {
          const updatedSchedules = get().applyUpdateToSchedules(optimizationResult.optimization.daily_schedules, updateData);
          set({
            optimizationResult: {
              ...optimizationResult,
              optimization: {
                ...optimizationResult.optimization,
                daily_schedules: updatedSchedules
              }
            }
          });
        }
      },
      
      applyUpdateToSchedules: (schedules: any[], updateData: any) => {
        // Apply the update to the current schedules for immediate UI feedback
        return schedules.map(schedule => {
          if (updateData.action === 'reorder' && schedule.day === updateData.data?.dayData?.day) {
            const places = [...schedule.scheduled_places];
            const [movedPlace] = places.splice(updateData.data.sourceIndex, 1);
            places.splice(updateData.data.targetIndex, 0, movedPlace);
            return { ...schedule, scheduled_places: places };
          }
          
          if (updateData.action === 'resize' && schedule.scheduled_places) {
            return {
              ...schedule,
              scheduled_places: schedule.scheduled_places.map((place: any) => {
                if ((place.id || place.place_name) === updateData.data.placeId) {
                  return {
                    ...place,
                    stay_duration_minutes: updateData.data.newDuration
                  };
                }
                return place;
              })
            };
          }
          
          return schedule;
        });
      },
      
      processScheduleUpdateQueue: async () => {
        const { scheduleUpdateQueue, currentTrip } = get();
        if (scheduleUpdateQueue.length === 0 || !currentTrip) return;
        
        try {
          // Process updates in batches
          const updates = [...scheduleUpdateQueue];
          set({ scheduleUpdateQueue: [] });
          
          // Try to call edge function for background processing
          try {
            const { supabase } = await import('../lib/supabase');
            
            for (const update of updates) {
              try {
                const { data, error } = await supabase.functions.invoke('edit-schedule', {
                  body: {
                    trip_id: currentTrip.id,
                    action: update.action,
                    data: update.data,
                    update_id: update.id,
                    user_id: useStore.getState().user?.id
                  }
                });
                
                if (error) {
                  console.warn('Schedule update failed (UI already updated):', error);
                  continue;
                }
                
                // Update optimization result with server response if available
                if (data?.updated_schedule) {
                  set({ optimizationResult: data.updated_schedule });
                }
                
              } catch (error) {
                console.warn('Failed to process individual schedule update (UI already updated):', error);
              }
            }
          } catch (error) {
            // Edge function not available or failed - this is okay, UI is already updated
            console.warn('Edge function not available for background processing:', error);
          }
          
        } catch (error) {
          console.error('Failed to process schedule update queue:', error);
        }
      },
      
      syncOptimizationResults: async () => {
        const { currentTrip } = get();
        if (!currentTrip) return;
        
        try {
          await get().loadOptimizationResult(currentTrip.id);
        } catch (error) {
          console.error('Failed to sync optimization results:', error);
        }
      },
      
      // Calendar edit functions
      movePlace: async (placeId: string, sourceIndex: number, targetIndex: number, dayData: any) => {
        // First, immediately update the UI for responsiveness
        const { optimizationResult, setOptimizationResult } = get();
        
        if (optimizationResult && optimizationResult.optimization?.daily_schedules) {
          const updatedSchedules = optimizationResult.optimization.daily_schedules.map((schedule: any) => {
            if (schedule.day === dayData.day) {
              const places = [...schedule.scheduled_places];
              const [movedPlace] = places.splice(sourceIndex, 1);
              places.splice(targetIndex, 0, movedPlace);
              
              // Update order_in_day for all places
              const reorderedPlaces = places.map((place: any, index: number) => ({
                ...place,
                order_in_day: index + 1
              }));
              
              return { ...schedule, scheduled_places: reorderedPlaces };
            }
            return schedule;
          });
          
          // Update the optimization result immediately
          setOptimizationResult({
            ...optimizationResult,
            optimization: {
              ...optimizationResult.optimization,
              daily_schedules: updatedSchedules
            }
          });
        }
        
        // Then update via real-time sync system (background)
        try {
          await get().updateScheduleInRealTime({
            action: 'reorder',
            data: {
              placeId,
              sourceIndex,
              targetIndex,
              dayData
            }
          });
        } catch (error) {
          console.warn('Background reorder update failed:', error);
          // UI already updated, so this is just a warning
        }
      },
      
      resizePlaceDuration: async (placeId: string, newDuration: number, oldDuration: number) => {
        // First, immediately update the UI for responsiveness
        const { optimizationResult, setOptimizationResult } = get();
        
        if (optimizationResult && optimizationResult.optimization?.daily_schedules) {
          const updatedSchedules = optimizationResult.optimization.daily_schedules.map((daySchedule: any) => {
            const updatedPlaces = daySchedule.scheduled_places.map((place: any) => {
              if ((place.id || place.place_name) === placeId) {
                const updatedPlace = { ...place, stay_duration_minutes: newDuration };
                
                // Recalculate departure time
                if (place.arrival_time) {
                  const [hours, minutes] = place.arrival_time.split(':').map(Number);
                  const arrivalMinutes = hours * 60 + minutes;
                  const departureMinutes = arrivalMinutes + newDuration;
                  
                  const formatTime = (totalMinutes: number): string => {
                    const cappedMinutes = Math.min(totalMinutes, 23 * 60 + 59);
                    const h = Math.floor(cappedMinutes / 60);
                    const m = cappedMinutes % 60;
                    const validH = Math.max(8, Math.min(23, h));
                    return `${validH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                  };
                  
                  updatedPlace.departure_time = formatTime(departureMinutes);
                }
                
                return updatedPlace;
              }
              return place;
            });
            
            return { ...daySchedule, scheduled_places: updatedPlaces };
          });
          
          // Update the optimization result immediately
          setOptimizationResult({
            ...optimizationResult,
            optimization: {
              ...optimizationResult.optimization,
              daily_schedules: updatedSchedules
            }
          });
        }
        
        // Then update via real-time sync system (background)
        try {
          await get().updateScheduleInRealTime({
            action: 'resize',
            data: {
              placeId,
              newDuration,
              oldDuration
            }
          });
        } catch (error) {
          console.warn('Background duration update failed:', error);
          // UI already updated, so this is just a warning
        }
      },
      
      insertPlace: async (placeData: any, insertionContext: any) => {
        await get().updateScheduleInRealTime({
          action: 'insert',
          data: {
            placeData,
            insertionContext
          }
        });
      },
      
      deleteScheduledPlace: async (placeId: string, dayData: any, blockIndex: number) => {
        await get().updateScheduleInRealTime({
          action: 'delete',
          data: {
            placeId,
            dayData,
            blockIndex
          }
        });
      },

      // Premium functions
      canCreateTrip: () => {
        const { user, trips } = get();
        if (!user) return false;
        
        const isPremium = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
        const totalUserTrips = trips.length; // All trips (owned + member)
        
        
        return isPremium || totalUserTrips < LIMITS.FREE.TRIPS;
      },

      canJoinTrip: () => {
        const { user, trips } = get();
        if (!user) return false;
        
        const isPremium = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
        const totalUserTrips = trips.length; // All trips (owned + member)
        
        
        return isPremium || totalUserTrips < LIMITS.FREE.TRIPS;
      },

      canAddMember: (tripId: string) => {
        const { user, trips } = get();
        if (!user) return false;
        
        const trip = trips.find(t => t.id === tripId);
        if (!trip) return false;
        
        const isPremium = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
        
        return isPremium || trip.memberCount < LIMITS.FREE.MEMBERS_PER_TRIP;
      },

      canAddPlace: (userId: string, tripId?: string) => {
        const { user } = get();
        if (!user) return false;
        
        const isPremium = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
        const userPlaceCount = get().getUserPlaceCount(userId, tripId);
        
        return isPremium || userPlaceCount < LIMITS.FREE.PLACES_PER_USER;
      },

      getUserPlaceCount: (userId: string, tripId?: string) => {
        const { places } = get();
        return places.filter(place => 
          place.userId === userId && 
          (!tripId || place.tripId === tripId)
        ).length;
      },

      upgradeToPremium: () => {
        const { user } = get();
        if (!user) return;
        
        const premiumExpiresAt = new Date();
        premiumExpiresAt.setFullYear(premiumExpiresAt.getFullYear() + 1);
        
        set({
          user: {
            ...user,
            isPremium: true,
            premiumExpiresAt: premiumExpiresAt.toISOString(),
          }
        });
      },

      // Database Loading Functions
      loadTripsFromDatabase: async (): Promise<void> => {
        try {
          const { user } = get();
          if (!user) {
            // No user found, skipping trips loading
            return;
          }

          // Load trips where user is owner or member
          
          // First, get trips where user is owner
          const { data: ownedTrips, error: ownedError } = await supabase
            .from('trips')
            .select(`
              id, name, departure_location, description, destination, 
              start_date, end_date, owner_id, created_at, total_members
            `)
            .eq('owner_id', user.id);

          if (ownedError) {
            // Failed to load owned trips
            return;
          }

          // Then, get trips where user is a member
          const { data: memberTrips, error: memberError } = await supabase
            .from('trip_members')
            .select(`
              trips!inner (
                id, name, departure_location, description, destination, 
                start_date, end_date, owner_id, created_at, total_members
              )
            `)
            .eq('user_id', user.id)
            .neq('trips.owner_id', user.id); // Exclude trips where user is owner (to avoid duplicates)

          if (memberError) {
            // Failed to load member trips
            return;
          }

          // Combine owned and member trips with deduplication
          const tripIds = new Set();
          const allTrips = [
            ...(ownedTrips || []),
            ...(memberTrips?.map(mt => mt.trips) || [])
          ].filter(trip => {
            if (tripIds.has(trip.id)) {
              return false;
            }
            tripIds.add(trip.id);
            return true;
          });

          const userOwnedTrips = allTrips.filter(trip => trip.owner_id === user.id);
          const userMemberTrips = allTrips.filter(trip => trip.owner_id !== user.id);


          // Sort by created_at descending and limit to 20
          const tripsData = allTrips
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20);

          if (tripsData && Array.isArray(tripsData)) {
            const trips: Trip[] = tripsData.map(trip => ({
              id: trip.id,
              name: trip.name || `${trip.departure_location} Trip`,
              departureLocation: trip.departure_location,
              description: trip.description,
              destination: trip.destination,
              startDate: trip.start_date,
              endDate: trip.end_date,
              memberCount: trip.total_members || 1,
              createdAt: trip.created_at,
              ownerId: trip.owner_id
            }));
            
            set({ trips });
            
            // Try to restore the previously selected trip or use the one from the URL
            const currentPath = window.location.pathname;
            const tripIdFromUrl = currentPath.match(/\/trip\/([^\/]+)/)?.[1];
            
            if (tripIdFromUrl) {
              // If we have a trip ID in the URL, use that
              const tripFromUrl = trips.find(t => t.id === tripIdFromUrl);
              if (tripFromUrl) {
                await get().setCurrentTrip(tripFromUrl);
              } else if (!get().currentTrip && trips.length > 0) {
                // URL trip not found, fall back to first trip
                await get().setCurrentTrip(trips[0]);
              }
            } else if (!get().currentTrip) {
              // Try to restore from localStorage
              const storedTripId = localStorage.getItem('currentTripId');
              if (storedTripId) {
                const storedTrip = trips.find(t => t.id === storedTripId);
                if (storedTrip) {
                  await get().setCurrentTrip(storedTrip);
                } else if (trips.length > 0) {
                  // Stored trip not found, fall back to first trip
                  await get().setCurrentTrip(trips[0]);
                }
              } else if (trips.length > 0) {
                // No stored trip, use first trip
                await get().setCurrentTrip(trips[0]);
              }
            }
          }
        } catch (error) {
          // Failed to load trips from database
        }
      },

      loadPlacesFromDatabase: async (tripId?: string): Promise<void> => {
        try {
          const { user, currentTrip } = get();
          if (!user) {
            // No user found, skipping places loading
            return;
          }

          // Use current trip if no tripId specified
          const targetTripId = tripId || currentTrip?.id;
          if (!targetTripId) {
            set({ places: [] }); // Clear places if no trip selected
            return;
          }

          // Always filter by specific trip to avoid mixing places
          const { data: placesData, error } = await supabase
            .from('places')
            .select(`
              id, name, category, place_type, source, wish_level, stay_duration_minutes,
              latitude, longitude, is_selected_for_optimization, 
              normalized_wish_level, selection_round, trip_id, user_id, created_at,
              scheduled, scheduled_date, scheduled_time_start, scheduled_time_end
            `)
            .eq('trip_id', targetTripId)
            .order('created_at', { ascending: true });

          if (error) {
            // Failed to load places from database
            return;
          }
          
          if (placesData && Array.isArray(placesData)) {
            const dbPlaces: Place[] = placesData.map(place => ({
              id: place.id,
              name: place.name,
              category: place.category,
              address: `${place.name} Location`,
              latitude: place.latitude || 0,
              longitude: place.longitude || 0,
              rating: 4.5,
              wishLevel: place.wish_level || 5,
              stayDuration: (place.stay_duration_minutes || 120) / 60,
              priceLevel: 2,
              scheduled: place.is_selected_for_optimization || false,
              scheduledDate: place.scheduled_date ? new Date(place.scheduled_date).toLocaleDateString() : undefined,
              scheduled_date: place.scheduled_date,
              created_at: place.created_at,
              tripId: place.trip_id,
              trip_id: place.trip_id,
              userId: place.user_id,
              user_id: place.user_id,
              // CRITICAL: Include place_type and source
              place_type: place.place_type,
              source: place.source,
              is_selected_for_optimization: place.is_selected_for_optimization,
              normalized_wish_level: place.normalized_wish_level,
              selection_round: place.selection_round,
              wish_level: place.wish_level,
              stay_duration_minutes: place.stay_duration_minutes
            }));
            
            set({ places: dbPlaces });
            
            // Create system places if they don't exist (only once per trip load)
            // Only create system places if this is the first load for this trip
            const systemPlacesExist = dbPlaces.some(p => p.place_type === 'departure' || p.place_type === 'destination');
            if (targetTripId && !get().isCreatingSystemPlaces && !systemPlacesExist) {
              const { createSystemPlaces } = get();
              await createSystemPlaces(targetTripId);
            }
          }
        } catch (error) {
          // Failed to load places from database
        }
      },

      initializeFromDatabase: async (): Promise<void> => {
        const { loadTripsFromDatabase, optimizationResult } = get();
        
        // Preserve existing optimization results during initialization
        const existingOptimizationResult = optimizationResult;
        
        try {
          await loadTripsFromDatabase();
          
          // Only refresh data if we don't have optimization results
          const { currentTrip } = get();
          if (currentTrip) {
            // Load member colors first for consistent color display
            await get().loadMemberColorsForTrip(currentTrip.id);
            
            // Load places data
            await get().loadPlacesFromDatabase(currentTrip.id);
            
            // Load optimization results from database
            // The loadOptimizationResult function will preserve existing results if no new ones are found
            await get().loadOptimizationResult(currentTrip.id);
          }
        } catch (error) {
          // Failed to initialize from database
          // Restore optimization results even if initialization fails
          if (existingOptimizationResult) {
            set({ 
              optimizationResult: existingOptimizationResult,
              hasUserOptimized: true // Restore the optimization state as well
            });
          }
        }
      },

      // API Integration
      createTripWithAPI: async (tripData: TripCreateData): Promise<Trip> => {
        console.log('🎯 createTripWithAPI called with data:', tripData);
        
        const { user, canCreateTrip } = get();
        console.log('👤 Current user from store:', user);
        
        if (!user) throw new Error('User not authenticated');
        
        // Double-check trip creation limits
        if (!canCreateTrip()) {
          throw new Error('You have reached the trip limit for your current plan. Please upgrade to Premium to create more trips.');
        }
        
        console.log('✅ Trip creation checks passed');

        try {
          // Use trip-management API for proper coordinate handling
          console.log('🔐 Checking authentication...');
          const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
          console.log('🔐 Auth check result - user:', currentUser?.id, 'error:', authError);
          
          if (authError) {
            console.error('🔐 Authentication error:', authError);
            throw new Error('Authentication required');
          }
          if (!currentUser) {
            console.error('🔐 No current user found');
            throw new Error('User not authenticated');
          }

          // Call trip-management Edge Function with coordinate data
          console.log('🚀 Calling trip-management API with data:', JSON.stringify(tripData, null, 2));
          console.log('🚀 Supabase client config check:', {
            url: import.meta.env.VITE_SUPABASE_URL,
            hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
            anonKeyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...'
          });
          
          const { data, error } = await supabase.functions.invoke('trip-management', {
            body: tripData
          });

          console.log('📡 API Response - data:', data);
          console.log('📡 API Response - error:', error);

          if (error) {
            console.error('❌ API Error details:', error);
            throw new Error(error.message || 'Failed to create trip');
          }

          if (!data || !data.trip) {
            console.error('❌ Invalid API response structure:', {
              hasData: !!data,
              dataKeys: data ? Object.keys(data) : [],
              hasTrip: data?.trip ? true : false,
              dataType: typeof data
            });
            throw new Error('Invalid response from trip creation');
          }

          const createdTrip = data.trip;

          // 状態更新
          set(state => ({
            trips: [...state.trips, createdTrip],
            isLoading: false
          }));

          // 作成したtripを現在のtripとして設定
          console.log('🎯 Setting created trip as current trip:', createdTrip.id);
          await get().setCurrentTrip(createdTrip);

          return createdTrip;
        } catch (error) {
          console.error('💥 createTripWithAPI error caught:', error);
          console.error('💥 Error type:', typeof error);
          console.error('💥 Error name:', error instanceof Error ? error.name : 'Unknown');
          console.error('💥 Error message:', error instanceof Error ? error.message : String(error));
          console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          // Failed to create trip
          throw error;
        }
      },

      optimizeTrip: async (tripId: string): Promise<void> => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        set({ isOptimizing: true });

        try {
          // Use TripOptimizationService for production optimization
          const { TripOptimizationService } = await import('../services/TripOptimizationService');
          
          const result = await TripOptimizationService.optimizeTrip(
            tripId,
            {
              fairness_weight: 0.6,
              efficiency_weight: 0.4,
              include_meals: true,
              preferred_transport: 'car'
            },
            (progress) => {
            }
          );

          if (result.success && result.optimization_result) {
            // Store the complete optimization result structure
            set({ optimizationResult: result.optimization_result });
            
            // Refresh places data to get updated schedules
            await get().loadPlacesFromDatabase(tripId);
            
          } else {
            throw new Error('Optimization failed to return valid results');
          }
          
        } catch (error) {
          // Failed to optimize trip
          throw error;
        } finally {
          set({ isOptimizing: false });
        }
      },

      loadPlacesFromAPI: async (tripId: string): Promise<void> => {
        try {

          const { data: places, error } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId);

          if (error) {
            // Failed to load places from API
            return;
          }

          // Convert database format to frontend format
          const formattedPlaces: Place[] = places.map(place => ({
            id: place.id,
            name: place.name,
            category: place.category,
            address: place.address || '',
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating || place.google_rating || 0,
            wishLevel: place.wish_level,
            stayDuration: place.stay_duration_minutes,
            priceLevel: place.price_level || place.google_price_level || 0,
            image: place.image_url,
            scheduled: place.scheduled,
            scheduledDate: place.scheduled_date,
            visitDate: place.visit_date,
            notes: place.notes,
            tripId: place.trip_id,
            userId: place.user_id,
            // CRITICAL: Include place_type and source for system places identification
            place_type: place.place_type,
            source: place.source,
            // Database schema compatibility
            trip_id: place.trip_id,
            user_id: place.user_id,
            wish_level: place.wish_level,
            stay_duration_minutes: place.stay_duration_minutes,
            google_place_id: place.google_place_id,
            google_rating: place.google_rating,
            google_price_level: place.google_price_level,
            estimated_cost: place.estimated_cost,
            created_at: place.created_at,
            updated_at: place.updated_at,
            scheduled_date: place.scheduled_date,
            scheduled_time_start: place.scheduled_time_start,
            scheduled_time_end: place.scheduled_time_end
          }));

          // Update the places in store
          set((state) => ({
            places: [
              ...state.places.filter(p => p.trip_id !== tripId && p.tripId !== tripId),
              ...formattedPlaces
            ]
          }));

          
        } catch (error) {
          // Failed to load places from API
        }
      },

      loadOptimizationResult: async (tripId: string): Promise<void> => {
        try {
          
          // Get current optimization result to preserve if needed
          const { optimizationResult: currentOptimizationResult } = get();
          
          // Check if table exists before querying
          const { data: results, error } = await supabase
            .from('optimization_results')
            .select('*')
            .eq('trip_id', tripId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const result = results?.[0] || null;

          if (error) {
            // If table doesn't exist or query fails, preserve existing result
            // Don't overwrite with null if we have existing results
            if (!currentOptimizationResult) {
              set({ optimizationResult: null });
            }
            return;
          }

          if (result) {
            
            // Convert database result to OptimizationResult format
            // optimized_route is an array of daily schedules directly
            const dailySchedules = Array.isArray(result.optimized_route) ? result.optimized_route : [];
            
            // Extract all places from all daily schedules
            const allPlaces = dailySchedules.flatMap(day => day.scheduled_places || []);
            
            const optimizationResult: OptimizationResult = {
              success: true,
              optimization: {
                daily_schedules: dailySchedules,
                optimization_score: result.optimization_score || { total_score: 0, fairness_score: 0, efficiency_score: 0, details: { user_adoption_balance: 0, wish_satisfaction_balance: 0, travel_efficiency: 0, time_constraint_compliance: 0 } },
                optimized_route: { daily_schedules: dailySchedules },
                total_duration_minutes: result.total_travel_time_minutes + result.total_visit_time_minutes || 0,
                places: allPlaces,
                execution_time_ms: result.execution_time_ms || 0
              },
              message: 'Optimization loaded from database'
            };


            // Check if this is an edited schedule (created by edit-schedule edge function)
            const isEditedSchedule = result.algorithm_version === 'edit-schedule-v1' || result.edit_action;
            const currentEditState = get().hasUserEditedSchedule;
            
            console.log('🔍 loadOptimizationResult - edit state analysis:', {
              isEditedSchedule,
              currentEditState,
              algorithm_version: result.algorithm_version,
              edit_action: result.edit_action,
              willSetEditState: isEditedSchedule || currentEditState
            });
            
            // Check localStorage for current trip's edit state to ensure we don't override it
            const { currentTrip } = get();
            const localStorageEditState = currentTrip 
              ? localStorage.getItem(`hasUserEditedSchedule_${currentTrip.id}`) === 'true'
              : false;
            
            console.log('🔍 loadOptimizationResult - localStorage check:', {
              localStorageEditState,
              currentEditState,
              finalEditState: isEditedSchedule || currentEditState || localStorageEditState
            });
            
            set({ 
              optimizationResult: optimizationResult,
              // Set hasUserOptimized to true when we have valid optimization results
              hasUserOptimized: true,
              // Set hasUserEditedSchedule if this was created by editing OR stored in localStorage
              hasUserEditedSchedule: isEditedSchedule || currentEditState || localStorageEditState
            });
          } else {
            // No results found in database, preserve existing if available
            if (!currentOptimizationResult) {
              set({ optimizationResult: null });
            }
          }
          
        } catch (error) {
          // Failed to load optimization result
          // Preserve existing result on error
          const { optimizationResult: currentResult } = get();
          if (!currentResult) {
            set({ optimizationResult: null });
          }
        }
      },

      createSystemPlaces: async (tripId: string): Promise<void> => {
        try {
          const { isCreatingSystemPlaces } = get();
          if (isCreatingSystemPlaces) {
            return;
          }
          
          set({ isCreatingSystemPlaces: true });
          
          const { user, currentTrip } = get();
          if (!user || !currentTrip) return;

          // Get trip information
          const { data: trip, error: tripError } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();

          if (tripError || !trip) {
            // Failed to get trip for system places
            return;
          }

          // Check if system places already exist with comprehensive checks
          const { data: existingSystemPlaces, error: systemPlacesError } = await supabase
            .from('places')
            .select('id, place_type, category, source')
            .eq('trip_id', tripId)
            .or('place_type.in.(departure,destination),category.in.(transportation,departure_point,destination_point),source.eq.system');


          // Only recreate system places if they don't exist or are incomplete
          if (existingSystemPlaces && existingSystemPlaces.length > 0) {
            return; // Don't recreate if they already exist
          }

          const systemPlaces = [];

          // Create departure place
          if (trip.departure_location) {
            systemPlaces.push({
              name: `Departure: ${trip.departure_location}`,
              category: 'transportation',
              address: trip.departure_location,
              latitude: 35.6812, // Tokyo Station coordinates as default
              longitude: 139.7671,
              rating: 0,
              wish_level: 5, // High priority for system places
              stay_duration_minutes: 60, // Minimum 60 minutes for system places
              price_level: 1,
              scheduled: true,
              scheduled_date: trip.start_date,
              scheduled_time_start: '08:00:00',
              scheduled_time_end: '08:00:00',
              visit_date: trip.start_date,
              trip_id: tripId,
              user_id: user.id,
              place_type: 'departure',
              source: 'system'
            });
          }

          // Create destination place (always create for round trips)
          if (trip.destination) {
            systemPlaces.push({
              name: trip.destination === 'same as departure location' || trip.destination === trip.departure_location 
                ? `Destination: ${trip.departure_location}` 
                : `Destination: ${trip.destination}`,
              category: 'transportation',
              address: trip.destination === 'same as departure location' 
                ? trip.departure_location 
                : trip.destination,
              latitude: 35.6812, // Default coordinates
              longitude: 139.7671,
              rating: 0,
              wish_level: 5,
              stay_duration_minutes: 60, // Minimum 60 minutes for system places
              price_level: 1,
              scheduled: true,
              scheduled_date: trip.end_date,
              scheduled_time_start: '18:00:00',
              scheduled_time_end: '18:00:00',
              visit_date: trip.end_date,
              trip_id: tripId,
              user_id: user.id,
              place_type: 'destination',
              source: 'system'
            });
          }

          // Insert system places
          if (systemPlaces.length > 0) {
            const { error: insertError } = await supabase
              .from('places')
              .insert(systemPlaces);

            if (insertError) {
              // Failed to create system places
            } else {
              // Reload places to include the new system places
              await get().loadPlacesFromAPI(tripId);
            }
          }
          
        } catch (error) {
          // Failed to create system places
        } finally {
          set({ isCreatingSystemPlaces: false });
        }
      },

      // Real-time event listener setup
      setupRealTimeSync: () => {
        // Listen for schedule updates from other views
        const handleScheduleUpdate = (event: CustomEvent) => {
          const updateData = event.detail;
          console.log('Received schedule update:', updateData);
          
          // Trigger re-render in listening components
          window.dispatchEvent(new CustomEvent('voypath-data-changed', {
            detail: { type: 'schedule', data: updateData }
          }));
        };
        
        window.addEventListener('voypath-schedule-update', handleScheduleUpdate as EventListener);
        
        return () => {
          window.removeEventListener('voypath-schedule-update', handleScheduleUpdate as EventListener);
        };
      },
      
      // Handle pending trip join after authentication
      handlePendingTripJoin: async (): Promise<void> => {
        try {
          const pendingTripData = localStorage.getItem('voypath_pending_trip');
          if (!pendingTripData) {
            return;
          }

          const pendingTrip = JSON.parse(pendingTripData);

          // Clear pending trip data
          localStorage.removeItem('voypath_pending_trip');

          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            // No authenticated user found for pending trip join
            return;
          }

          // Get current session for auth token
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            // No session found for pending trip join
            return;
          }

          // Check if user is already a member
          try {
            const { data: memberResponse, error: memberError } = await supabase.functions.invoke('trip-member-management', {
              body: {
                action: 'get-members',
                tripId: pendingTrip.tripId
              }
            });

            if (!memberError && memberResponse) {
              // User already a member
            } else {
              // Add user as trip member directly
              const { error } = await supabase
                .from('trip_members')
                .insert({
                  trip_id: pendingTrip.tripId,
                  user_id: session.user.id,
                  role: 'member',
                  joined_at: new Date().toISOString()
                });

              if (error && !error.message.includes('duplicate')) {
                // Failed to add user to trip
                throw error;
              }
            }
          } catch (memberError) {
            // Add user as trip member directly
            const { error } = await supabase
              .from('trip_members')
              .insert({
                trip_id: pendingTrip.tripId,
                user_id: session.user.id,
                role: 'member',
                joined_at: new Date().toISOString()
              });

            if (error && !error.message.includes('duplicate')) {
              // Failed to add user to trip
            }
          }

          // Reload trips to include the new trip
          await get().loadTripsFromDatabase();
          
          // Navigate to the trip
          window.location.href = `/trip/${pendingTrip.tripId}`;

        } catch (error) {
          // Error processing pending trip join
        }
      },

      // Supabase real-time subscriptions
      realtimeChannels: [],
      setupSupabaseRealtime: () => {
        // TEMPORARILY DISABLED - Testing if Realtime is causing 5-minute timeout issues
        // This function sets up real-time subscriptions that may be hitting connection limits
        console.log('⚠️ setupSupabaseRealtime temporarily disabled for debugging');
        return;
        
        const { currentTrip, loadPlacesFromDatabase, loadOptimizationResult } = get();
        if (!currentTrip?.id) return;
        
        // Cleanup existing channels
        get().realtimeChannels.forEach(channel => supabase.removeChannel(channel));
        set({ realtimeChannels: [] });
        
        // Subscribe to places
        const placesChannel = supabase
          .channel(`places:${currentTrip.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'places',
            filter: `trip_id=eq.${currentTrip.id}`
          }, async (payload) => {
            await loadPlacesFromDatabase(currentTrip.id);
            await loadOptimizationResult(currentTrip.id);
          })
          .subscribe();
        
        // Subscribe to optimization_results
        const optChannel = supabase
          .channel(`optimization_results:${currentTrip.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'optimization_results',
            filter: `trip_id=eq.${currentTrip.id}`
          }, async (payload) => {
            await loadOptimizationResult(currentTrip.id);
          })
          .subscribe();
        
        set({ realtimeChannels: [placesChannel, optChannel] });
      },

      // Calendar edit helper functions
      updateDayPlaces: (day: number, places: any[]) => {
        const { optimizationResult, setOptimizationResult } = get();
        
        if (optimizationResult?.optimization?.daily_schedules) {
          const updatedSchedules = optimizationResult.optimization.daily_schedules.map((schedule: any) => {
            if (schedule.day === day) {
              return {
                ...schedule,
                scheduled_places: places.map((place: any, index: number) => ({
                  ...place,
                  order_in_day: index + 1
                }))
              };
            }
            return schedule;
          });
          
          setOptimizationResult({
            ...optimizationResult,
            optimization: {
              ...optimizationResult.optimization,
              daily_schedules: updatedSchedules
            }
          });
        }
      },

      updateScheduleFromBackend: (schedule: any) => {
        const { optimizationResult } = get();
        
        if (schedule && optimizationResult) {
          if (schedule.optimization?.daily_schedules) {
            const existingSchedules = optimizationResult.optimization?.daily_schedules || [];
            const newSchedules = schedule.optimization.daily_schedules;
            
            const scheduleMap = new Map();
            existingSchedules.forEach((daySchedule: any) => {
              scheduleMap.set(daySchedule.day, daySchedule);
            });
            
            newSchedules.forEach((daySchedule: any) => {
              scheduleMap.set(daySchedule.day, daySchedule);
            });
            
            const mergedSchedules = Array.from(scheduleMap.values()).sort((a: any, b: any) => a.day - b.day);
            
            set({
              optimizationResult: {
                ...optimizationResult,
                optimization: {
                  ...optimizationResult.optimization,
                  daily_schedules: mergedSchedules
                }
              }
            });
          } else {
            set({ optimizationResult: schedule });
          }
        } else if (schedule && !optimizationResult) {
          set({ optimizationResult: schedule });
        }
      },
    }));

// Debug functions for localStorage troubleshooting
if (typeof window !== 'undefined') {
  // Expose debug functions globally for console access
  (window as any).voypath_debug = {
    // Check edit state for current trip
    checkEditState: () => {
      const state = useStore.getState();
      const tripId = state.currentTrip?.id;
      if (!tripId) {
        console.log('No current trip');
        return;
      }
      
      const localStorageValue = localStorage.getItem(`hasUserEditedSchedule_${tripId}`);
      const storeValue = state.hasUserEditedSchedule;
      
      console.log('Edit State Debug:', {
        tripId,
        localStorageValue,
        storeValue,
        allEditKeys: Object.keys(localStorage).filter(k => k.includes('hasUserEditedSchedule'))
      });
    },
    
    // Manually set edit state
    setEditState: (value: boolean) => {
      const state = useStore.getState();
      state.setHasUserEditedSchedule(value);
      console.log('Set edit state to:', value);
    },
    
    // Clear all edit state from localStorage
    clearAllEditStates: () => {
      const keys = Object.keys(localStorage).filter(k => k.includes('hasUserEditedSchedule'));
      keys.forEach(key => localStorage.removeItem(key));
      console.log('Cleared edit state keys:', keys);
    }
  };
}

// Apply theme to document
if (typeof window !== 'undefined') {
  const store = useStore.getState();
  if (store.theme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  useStore.subscribe((state) => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
}