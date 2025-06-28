import { create } from 'zustand';
import { OptimizationResult } from '../types/optimization';
import { supabase, callSupabaseFunction } from '../lib/supabase';

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
}

// Premium limits
export const LIMITS = {
  FREE: {
    TRIPS: 3,
    MEMBERS_PER_TRIP: 5,
    PLACES_PER_USER: 10,
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
  addPlace: (place: Place) => Promise<void>;
  updatePlace: (id: string, updates: Partial<Place>) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;

  // Member Colors - Centralized color management
  memberColors: Record<string, string>;
  tripMembers: Array<{ user_id: string; name: string; email: string; assigned_color_index?: number }>;
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
  
  // Success animation control
  showOptimizationSuccess: boolean;
  setShowOptimizationSuccess: (value: boolean) => void;

  // API Integration
  createTripWithAPI: (tripData: TripCreateData) => Promise<Trip>;
  optimizeTrip: (tripId: string) => Promise<void>;
  loadPlacesFromAPI: (tripId: string) => Promise<void>;
  loadOptimizationResult: (tripId: string) => Promise<void>;
  createSystemPlaces: (tripId: string) => Promise<void>;

  // Premium functions
  canCreateTrip: () => boolean;
  canAddMember: (tripId: string) => boolean;
  canAddPlace: (userId: string, tripId?: string) => boolean;
  getUserPlaceCount: (userId: string, tripId?: string) => number;
  upgradeToPremium: () => void;
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
        const currentOptimizationResult = get().optimizationResult;
        const currentTripId = get().currentTrip?.id;
        const currentHasUserOptimized = get().hasUserOptimized;
        
        // Only reset hasUserOptimized when actually switching to a different trip
        const isNewTrip = currentTripId !== trip.id;
        const newHasUserOptimized = isNewTrip ? false : currentHasUserOptimized;
        
        console.log(`🎯 [setCurrentTrip] Trip: ${trip.name}, isNewTrip: ${isNewTrip}, currentHasUserOptimized: ${currentHasUserOptimized}, newHasUserOptimized: ${newHasUserOptimized}`);
        
        set({ 
          currentTrip: trip, 
          hasUserOptimized: newHasUserOptimized,
          showOptimizationSuccess: false  // Reset success animation when switching trips
        });
        
        // Save current trip ID to localStorage for persistence
        if (trip) {
          localStorage.setItem('currentTripId', trip.id);
        }
        
        if (trip) {
          try {
            // Only reload data if switching to a different trip
            if (currentTripId !== trip.id) {
              console.log(`🔄 Switching to trip: ${trip.name}`);
              console.log(`🎨 [Store] About to load colors for trip: ${trip.id}`);
              
              // Reset hasUserOptimized when switching to a different trip
              // This ensures places appear as pending until user explicitly optimizes
              // But will be set back to true if optimization results are found
              set({ hasUserOptimized: false });
              console.log(`🔄 Reset hasUserOptimized to false for new trip (will be restored if optimization results exist)`);
              
              await get().loadMemberColorsForTrip(trip.id); // Load colors first
              await get().loadPlacesFromDatabase(trip.id);
              await get().loadOptimizationResult(trip.id);
            } else {
              console.log(`✅ Already on trip: ${trip.name}, preserving optimization results`);
              // Still reload colors to ensure consistency
              console.log(`🎨 [Store] Reloading colors for current trip: ${trip.id}`);
              await get().loadMemberColorsForTrip(trip.id);
              // Preserve optimization results if staying on same trip
              if (currentOptimizationResult) {
                set({ 
                  optimizationResult: currentOptimizationResult,
                  hasUserOptimized: true // Preserve the optimization state
                });
              }
            }
            console.log(`🔄 Current trip set to: ${trip.name} (${trip.id})`);
            
            // Debug: Check the state after loading
            const { memberColors, tripMembers } = get();
            console.log(`🎨 [Store] After loading - memberColors:`, memberColors);
            console.log(`🎨 [Store] After loading - tripMembers:`, tripMembers);
          } catch (error) {
            console.error('Failed to load data for new trip:', error);
          }
        }
      },

      // Trips
      trips: [],
      addTrip: (trip) =>
        set((state) => ({ trips: [...state.trips, trip] })),
      updateTrip: async (id, updates) => {
        try {
          // Update in database first
          const dbUpdates: any = {};
          if (updates.name !== undefined) dbUpdates.name = updates.name;
          if (updates.description !== undefined) dbUpdates.description = updates.description;
          if (updates.departureLocation !== undefined) dbUpdates.departure_location = updates.departureLocation;
          if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
          if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
          if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
          if (updates.addPlaceDeadline !== undefined) dbUpdates.add_place_deadline = updates.addPlaceDeadline;

          const { error } = await supabase
            .from('trips')
            .update(dbUpdates)
            .eq('id', id);

          if (error) {
            console.error('Failed to update trip in database:', error);
            throw error;
          }

          // Update local state
          set((state) => ({
            trips: state.trips.map((trip) =>
              trip.id === id ? { ...trip, ...updates } : trip
            ),
            // Update currentTrip if it's the one being updated
            currentTrip: state.currentTrip?.id === id 
              ? { ...state.currentTrip, ...updates } 
              : state.currentTrip,
          }));

          console.log('✅ Trip updated successfully');
        } catch (error) {
          console.error('Failed to update trip:', error);
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
            console.error('Failed to delete trip from database:', error);
            throw error;
          }

          // Remove from local state
          set((state) => ({
            trips: state.trips.filter((trip) => trip.id !== id),
            // If deleted trip was current trip, clear it
            currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
          }));

          console.log('✅ Trip deleted successfully');
        } catch (error) {
          console.error('Failed to delete trip:', error);
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
          console.log('🎨 [Store] ===== STARTING loadMemberColorsForTrip =====');
          console.log('🎨 [Store] Loading member colors and data for trip:', tripId);
          
          // Load trip members first
          console.log('🎨 [Store] Querying trip_members table...');
          const { data: membersData, error: membersError } = await supabase
            .from('trip_members')
            .select('user_id, role, assigned_color_index')
            .eq('trip_id', tripId);

          console.log('🎨 [Store] Trip members query result:', { membersData, membersError });

          if (membersError) {
            console.error('🎨 [Store] Error loading trip members:', membersError);
            console.error('🎨 [Store] Error code:', membersError.code);
            console.error('🎨 [Store] Error message:', membersError.message);
            console.error('🎨 [Store] Error details:', membersError.details);
            
            // Try to use fallback colors for current user at least
            const { user } = get();
            if (user) {
              const fallbackColorMap: Record<string, string> = {};
              const fallbackColor = MemberColorService.getColorByIndex(1);
              fallbackColorMap[user.id] = fallbackColor?.hex || '#0077BE';
              console.log('🎨 [Store] Using fallback color for current user:', fallbackColorMap);
              set({ memberColors: fallbackColorMap, tripMembers: [] });
            } else {
              set({ memberColors: {}, tripMembers: [] });
            }
            return;
          }

          // If no members found, set empty state and return
          if (!membersData || membersData.length === 0) {
            console.log('🎨 [Store] No members found for trip:', tripId);
            console.log('🎨 [Store] This trip may not have any members in trip_members table');
            
            // Try to use fallback colors for current user at least
            const { user } = get();
            if (user) {
              const fallbackColorMap: Record<string, string> = {};
              const fallbackColor = MemberColorService.getColorByIndex(1);
              fallbackColorMap[user.id] = fallbackColor?.hex || '#0077BE';
              console.log('🎨 [Store] Using fallback color for current user (no members):', fallbackColorMap);
              set({ memberColors: fallbackColorMap, tripMembers: [] });
            } else {
              set({ memberColors: {}, tripMembers: [] });
            }
            return;
          }

          // Load user data for each member
          console.log('🎨 [Store] Loading user data for members...');
          const userIds = membersData.map(m => m.user_id);
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', userIds);

          console.log('🎨 [Store] Users query result:', { usersData, usersError });

          if (usersError) {
            console.error('🎨 [Store] Error loading users:', usersError);
            // Continue with members data only, without user details
          }

          // Format trip members data
          const formattedMembers = membersData.map((member: any) => {
            const userData = usersData?.find(u => u.id === member.user_id);
            return {
              user_id: member.user_id,
              name: userData?.name || userData?.email || 'Unknown User',
              email: userData?.email || '',
              assigned_color_index: member.assigned_color_index
            };
          });

          console.log('🎨 [Store] Formatted members:', formattedMembers);

          // Load member colors using MemberColorService
          console.log('🎨 [Store] Loading colors via MemberColorService...');
          const colorMapping = await (await import('../services/MemberColorService')).MemberColorService.getSimpleColorMapping(tripId);
          console.log('🎨 [Store] Raw color mapping:', colorMapping);
          
          // Apply fallback colors if any are missing or invalid
          const finalColorMapping: Record<string, string> = {};
          membersData.forEach((member, index) => {
            const existingColor = colorMapping[member.user_id];
            if (!existingColor || existingColor === '#000000' || existingColor === 'undefined' || existingColor === '') {
              console.warn(`🎨 [Store] Using fallback color for member ${member.user_id}`);
              const fallbackColor = MemberColorService.getColorByIndex(index + 1) || MemberColorService.getColorByIndex(1);
              finalColorMapping[member.user_id] = fallbackColor?.hex || '#0077BE';
            } else {
              finalColorMapping[member.user_id] = existingColor;
            }
          });
          
          console.log('🎨 [Store] Final color mapping with fallbacks:', finalColorMapping);
          
          // Validate color assignment and fix any issues
          console.log('🎨 [Store] Validating color assignments...');
          const validation = await (await import('../services/MemberColorService')).MemberColorService.validateColorAssignment(tripId);
          console.log('🎨 [Store] Validation result:', validation);
          
          if (!validation.valid) {
            console.warn('🎨 [Store] Color assignment issues detected, fixing...', validation.issues);
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
            
            console.log('🎨 [Store] Setting fixed colors with fallbacks to store:', finalFixedColors);
            set({ memberColors: finalFixedColors, tripMembers: formattedMembers });
            console.log('🎨 [Store] Fixed and loaded colors:', finalFixedColors);
          } else {
            console.log('🎨 [Store] Setting colors with fallbacks to store:', finalColorMapping);
            set({ memberColors: finalColorMapping, tripMembers: formattedMembers });
            console.log('🎨 [Store] Loaded colors (no issues):', finalColorMapping);
          }

          console.log('🎨 [Store] Trip members loaded:', formattedMembers);
          console.log('🎨 [Store] ===== FINISHED loadMemberColorsForTrip =====');
          
          // Verify the state was set correctly
          const { memberColors: finalColors, tripMembers: finalMembers } = get();
          console.log('🎨 [Store] Final state verification:', { finalColors, finalMembers });
        } catch (error) {
          console.error('🎨 [Store] Failed to load member colors:', error);
          console.error('🎨 [Store] Error details:', error);
          
          // Apply emergency fallback colors
          const { user } = get();
          if (user) {
            const emergencyColorMap: Record<string, string> = {};
            emergencyColorMap[user.id] = MemberColorService.getColorByIndex(0).hex;
            console.log('🎨 [Store] Using emergency fallback color for current user:', emergencyColorMap);
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
              console.log('🔍 [Store] Found potential duplicates:', duplicates);
              
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
                console.log('✅ [Store] Auto-merged with existing place');
                return { merged: true, existingPlace, duplicates };
              } else {
                // Return duplicates for UI handling
                return { duplicates, requiresUserDecision: true };
              }
            }
          } catch (error) {
            console.warn('Duplicate check failed, proceeding with place addition:', error);
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
            is_selected_for_optimization: false,  // Places start as pending, not auto-selected for optimization
            status: 'pending'  // New places are pending until user decides to optimize
          };

          const result = await addPlaceToDatabase(placeData);
          console.log('✅ Place saved to database:', result);
          
          // Reload places for current trip to ensure consistency
          await get().loadPlacesFromDatabase(currentTrip.id);
          
          return { success: true, place: result.place };
          
        } catch (error) {
          console.error('Failed to save place to database:', error);
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

          const { error } = await supabase
            .from('places')
            .update(updateData)
            .eq('id', id);

          if (error) {
            console.error('Failed to update place in database:', error);
            // Could implement rollback here if needed
          } else {
            console.log('✅ Place updated in database successfully');
          }
        } catch (error) {
          console.error('Failed to update place:', error);
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
            console.error('Failed to delete place from database:', error);
          } else {
            console.log('✅ Place deleted from database successfully');
          }
        } catch (error) {
          console.error('Failed to delete place:', error);
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
          console.error('Failed to find duplicates:', error);
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
          console.error('Failed to merge duplicate group:', error);
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
          console.error('Failed to auto-merge duplicates:', error);
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
          console.error('Failed to get duplicate summary:', error);
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
        console.log(`🎯 [setHasUserOptimized] Setting hasUserOptimized to: ${value}`);
        set({ hasUserOptimized: value });
      },
      
      // Success animation control - only triggers once per optimization
      showOptimizationSuccess: false,
      setShowOptimizationSuccess: (value) => {
        console.log(`🎉 [setShowOptimizationSuccess] Setting showOptimizationSuccess to: ${value}`);
        set({ showOptimizationSuccess: value });
      },

      // Premium functions
      canCreateTrip: () => {
        const { user, trips } = get();
        if (!user) return false;
        
        const isPremium = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
        const userTrips = trips.filter(trip => trip.ownerId === user.id);
        
        return isPremium || userTrips.length < LIMITS.FREE.TRIPS;
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
            console.log('No user found, skipping trips loading');
            return;
          }

          // Load trips where user is owner or member
          console.log('🔍 Loading trips for user:', user.id);
          
          // First, get trips where user is owner
          const { data: ownedTrips, error: ownedError } = await supabase
            .from('trips')
            .select(`
              id, name, departure_location, description, destination, 
              start_date, end_date, owner_id, created_at, total_members
            `)
            .eq('owner_id', user.id);

          if (ownedError) {
            console.error('Failed to load owned trips:', ownedError);
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
            console.error('Failed to load member trips:', memberError);
            return;
          }

          // Combine owned and member trips
          const allTrips = [
            ...(ownedTrips || []),
            ...(memberTrips?.map(mt => mt.trips) || [])
          ];

          console.log('📊 Loaded trips:', {
            ownedTrips: ownedTrips?.length || 0,
            memberTrips: memberTrips?.length || 0,
            totalTrips: allTrips.length
          });

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
            console.log(`✅ Loaded ${trips.length} trips from database`);
            
            // Try to restore the previously selected trip or use the one from the URL
            const currentPath = window.location.pathname;
            const tripIdFromUrl = currentPath.match(/\/trip\/([^\/]+)/)?.[1];
            
            if (tripIdFromUrl) {
              // If we have a trip ID in the URL, use that
              const tripFromUrl = trips.find(t => t.id === tripIdFromUrl);
              if (tripFromUrl) {
                console.log('🔄 [LoadTrips] Restoring trip from URL:', tripFromUrl.name);
                await get().setCurrentTrip(tripFromUrl);
              } else if (!get().currentTrip && trips.length > 0) {
                // URL trip not found, fall back to first trip
                console.log('🎨 [LoadTrips] URL trip not found, setting first trip as current...');
                await get().setCurrentTrip(trips[0]);
              }
            } else if (!get().currentTrip) {
              // Try to restore from localStorage
              const storedTripId = localStorage.getItem('currentTripId');
              if (storedTripId) {
                const storedTrip = trips.find(t => t.id === storedTripId);
                if (storedTrip) {
                  console.log('🔄 [LoadTrips] Restoring trip from localStorage:', storedTrip.name);
                  await get().setCurrentTrip(storedTrip);
                } else if (trips.length > 0) {
                  // Stored trip not found, fall back to first trip
                  console.log('🎨 [LoadTrips] Stored trip not found, setting first trip as current...');
                  await get().setCurrentTrip(trips[0]);
                }
              } else if (trips.length > 0) {
                // No stored trip, use first trip
                console.log('🎨 [LoadTrips] No stored trip, setting first trip as current...');
                await get().setCurrentTrip(trips[0]);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load trips from database:', error);
        }
      },

      loadPlacesFromDatabase: async (tripId?: string): Promise<void> => {
        try {
          const { user, currentTrip } = get();
          if (!user) {
            console.log('No user found, skipping places loading');
            return;
          }

          // Use current trip if no tripId specified
          const targetTripId = tripId || currentTrip?.id;
          if (!targetTripId) {
            console.log('⚠️ No trip ID specified, cannot load places');
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
            console.error('Failed to load places from database:', error);
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
            console.log(`✅ Loaded ${dbPlaces.length} places from database${targetTripId ? ` for trip ${targetTripId}` : ''}`);
            
            // Debug: Log places for current trip
            if (targetTripId) {
              const tripPlaces = dbPlaces.filter(p => p.trip_id === targetTripId);
              console.log(`📍 Places for current trip (${targetTripId}):`, tripPlaces.length);
            }
            
            // Create system places if they don't exist (only once per trip load)
            // Only create system places if this is the first load for this trip
            const systemPlacesExist = dbPlaces.some(p => p.place_type === 'departure' || p.place_type === 'destination');
            if (targetTripId && !get().isCreatingSystemPlaces && !systemPlacesExist) {
              console.log('🔧 No system places found, creating them for trip:', targetTripId);
              const { createSystemPlaces } = get();
              await createSystemPlaces(targetTripId);
            } else if (systemPlacesExist) {
              console.log('✅ System places already exist for trip:', targetTripId);
            }
          }
        } catch (error) {
          console.error('Failed to load places from database:', error);
        }
      },

      initializeFromDatabase: async (): Promise<void> => {
        const { loadTripsFromDatabase, optimizationResult } = get();
        
        // Preserve existing optimization results during initialization
        const existingOptimizationResult = optimizationResult;
        console.log('🔒 Preserving optimization result during initialization:', !!existingOptimizationResult);
        
        try {
          await loadTripsFromDatabase();
          
          // Only refresh data if we don't have optimization results
          const { currentTrip } = get();
          if (currentTrip) {
            console.log(`🔄 Initializing data for trip: ${currentTrip.name}`);
            
            // Load member colors first for consistent color display
            console.log('🎨 [InitDB] Loading member colors during initialization...');
            await get().loadMemberColorsForTrip(currentTrip.id);
            
            // Load places data
            await get().loadPlacesFromDatabase(currentTrip.id);
            
            // Load optimization results from database
            // The loadOptimizationResult function will preserve existing results if no new ones are found
            console.log('📊 Checking for optimization results in database');
            await get().loadOptimizationResult(currentTrip.id);
            
            // Check if optimization result was preserved
            const { optimizationResult: finalResult } = get();
            console.log(`✅ Initialized app with data for trip: ${currentTrip.name}`);
            console.log('📊 Final optimization result status:', !!finalResult);
          } else {
            console.log('🔄 Initialized app with trips data (no current trip selected)');
          }
        } catch (error) {
          console.error('Failed to initialize from database:', error);
          // Restore optimization results even if initialization fails
          if (existingOptimizationResult) {
            console.log('🔄 Restoring optimization result after initialization error');
            set({ 
              optimizationResult: existingOptimizationResult,
              hasUserOptimized: true // Restore the optimization state as well
            });
          }
        }
      },

      // API Integration
      createTripWithAPI: async (tripData: TripCreateData): Promise<Trip> => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        try {
          console.log('Creating trip in Supabase database');
          console.log('Current user from store:', user);
          
          // Check current authentication status
          const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
          console.log('Current authenticated user:', currentUser);
          if (authError) {
            console.error('Auth error:', authError);
            throw new Error('Authentication required');
          }
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
          // Generate UUID with timestamp to avoid conflicts
          const generateUUID = () => {
            const hex = (n: number) => n.toString(16).padStart(2, '0');
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            
            // Set version (4) and variant bits
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            
            const uuid = [
              bytes.slice(0, 4),
              bytes.slice(4, 6),
              bytes.slice(6, 8),
              bytes.slice(8, 10),
              bytes.slice(10, 16)
            ].map((group, i) => 
              Array.from(group).map(hex).join('')
            ).join('-');
            
            return uuid;
          };

          // First ensure user exists in database
          const { error: userError } = await supabase
            .from('users')
            .upsert({
              id: user.id,
              email: user.email || 'dev@voypath.com',
              name: user.name || user.user_metadata?.name || 'Development User',
              is_guest: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_active_at: new Date().toISOString()
            }, { onConflict: 'id' });

          if (userError) {
            console.error('Failed to ensure user exists:', userError);
            throw userError;
          }

          const tripId = generateUUID();
          const createdTrip = {
            id: tripId,
            name: tripData.name || `${tripData.departure_location} Trip`,
            departure_location: tripData.departure_location,
            description: tripData.description,
            destination: tripData.destination,
            start_date: tripData.start_date,
            end_date: tripData.end_date,
            owner_id: currentUser.id, // Use authenticated user ID
          };

          // Save to Supabase database with retry on conflict
          let savedTrip;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (attempts < maxAttempts) {
            const { data, error } = await supabase
              .from('trips')
              .insert(createdTrip)
              .select()
              .single();

            if (!error) {
              savedTrip = data;
              break;
            }

            if (error.code === '23505' || error.code === '409') {
              // UUID conflict, generate new one and retry
              attempts++;
              createdTrip.id = generateUUID();
              console.log(`Trip ID conflict, retrying with new ID: ${createdTrip.id} (attempt ${attempts})`);
            } else {
              console.error('Failed to save trip to database:', error);
              throw error;
            }
          }

          if (!savedTrip) {
            throw new Error('Failed to create trip after multiple attempts');
          }

          console.log('Trip created successfully in database:', savedTrip);

          // User already added at the beginning of the function

          // Add owner as trip member
          const { error: memberError } = await supabase
            .from('trip_members')
            .insert({
              trip_id: savedTrip.id,
              user_id: user.id,
              role: 'admin',
              joined_at: new Date().toISOString(),
              can_add_places: true,
              can_edit_places: true,
              can_optimize: true,
              can_invite_members: true
            });

          if (memberError) {
            console.error('Failed to add trip member:', memberError);
            throw memberError;
          }

          // Convert to frontend format
          const newTrip: Trip = {
            id: savedTrip.id,
            name: savedTrip.name,
            departureLocation: savedTrip.departure_location,
            description: savedTrip.description,
            destination: savedTrip.destination,
            startDate: savedTrip.start_date,
            endDate: savedTrip.end_date,
            memberCount: savedTrip.total_members || 1,
            createdAt: savedTrip.created_at,
            ownerId: savedTrip.owner_id,
          };

          // Update store state
          set((state) => ({ 
            trips: [...state.trips, newTrip],
            currentTrip: newTrip 
          }));

          return newTrip;
        } catch (error) {
          console.error('Failed to create trip:', error);
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
              console.log('Optimization progress:', progress);
            }
          );

          if (result.success && result.optimization_result) {
            // Store the complete optimization result structure
            set({ optimizationResult: result.optimization_result });
            
            // Refresh places data to get updated schedules
            await get().loadPlacesFromDatabase(tripId);
            
            console.log('Optimization completed successfully:', result);
          } else {
            throw new Error('Optimization failed to return valid results');
          }
          
        } catch (error) {
          console.error('Failed to optimize trip:', error);
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
            console.error('Failed to load places from API:', error);
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

          console.log(`Loaded ${formattedPlaces.length} places from database for trip ${tripId}`);
          
        } catch (error) {
          console.error('Failed to load places from API:', error);
        }
      },

      loadOptimizationResult: async (tripId: string): Promise<void> => {
        try {
          console.log('🔍 Loading optimization results for trip:', tripId);
          
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
            console.warn('Optimization results table not found or query failed:', error.message);
            console.log('Preserving existing optimization result:', currentOptimizationResult);
            // Don't overwrite with null if we have existing results
            if (!currentOptimizationResult) {
              set({ optimizationResult: null });
            }
            return;
          }

          if (result) {
            console.log('🔍 [useStore] Raw database result:', result);
            console.log('🔍 [useStore] optimized_route:', result.optimized_route);
            console.log('🔍 [useStore] daily_schedules:', result.optimized_route?.daily_schedules);
            
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

            console.log('🔍 [useStore] Converted optimizationResult:', optimizationResult);
            console.log('🔍 [useStore] Converted daily_schedules:', optimizationResult.optimization.daily_schedules);

            set({ 
              optimizationResult: optimizationResult,
              // Set hasUserOptimized to true when we have valid optimization results
              // This ensures the UI displays the optimization even after page reload
              hasUserOptimized: true
            });
            console.log(`✅ Loaded optimization result for trip ${tripId} - setting hasUserOptimized to true`);
          } else {
            // No results found in database, preserve existing if available
            console.log('No optimization results found in database');
            if (!currentOptimizationResult) {
              set({ optimizationResult: null });
            } else {
              console.log('Preserving existing optimization result');
            }
          }
          
        } catch (error) {
          console.error('Failed to load optimization result:', error);
          // Preserve existing result on error
          const { optimizationResult: currentResult } = get();
          if (!currentResult) {
            set({ optimizationResult: null });
          } else {
            console.log('Preserving existing optimization result after error');
          }
        }
      },

      createSystemPlaces: async (tripId: string): Promise<void> => {
        try {
          const { isCreatingSystemPlaces } = get();
          if (isCreatingSystemPlaces) {
            console.log('⚠️ System places creation already in progress for trip', tripId);
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
            console.error('Failed to get trip for system places:', tripError);
            return;
          }

          // Check if system places already exist with comprehensive checks
          const { data: existingSystemPlaces, error: systemPlacesError } = await supabase
            .from('places')
            .select('id, place_type, category, source')
            .eq('trip_id', tripId)
            .or('place_type.in.(departure,destination),category.in.(transportation,departure_point,destination_point),source.eq.system');

          console.log('🗑️ Checking existing system places for trip:', tripId);
          console.log('🗑️ Existing system places:', existingSystemPlaces);
          console.log('🗑️ System places error:', systemPlacesError);
          console.log('🗑️ Trip departure_location:', trip.departure_location);
          console.log('🗑️ Trip destination:', trip.destination);

          // Only recreate system places if they don't exist or are incomplete
          if (existingSystemPlaces && existingSystemPlaces.length > 0) {
            console.log('✅ System places already exist for trip', tripId, '- skipping creation');
            return; // Don't recreate if they already exist
          }
          
          console.log('🔧 Creating new system places for trip:', tripId);

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
              console.error('Failed to create system places:', insertError);
            } else {
              console.log(`Created ${systemPlaces.length} system places for trip ${tripId}`);
              // Reload places to include the new system places
              await get().loadPlacesFromAPI(tripId);
            }
          }
          
        } catch (error) {
          console.error('Failed to create system places:', error);
        } finally {
          set({ isCreatingSystemPlaces: false });
        }
      },

      // Handle pending trip join after authentication
      handlePendingTripJoin: async (): Promise<void> => {
        try {
          const pendingTripData = localStorage.getItem('voypath_pending_trip');
          if (!pendingTripData) {
            return;
          }

          const pendingTrip = JSON.parse(pendingTripData);
          console.log('🔗 Processing pending trip join:', pendingTrip);

          // Clear pending trip data
          localStorage.removeItem('voypath_pending_trip');

          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            console.error('No authenticated user found for pending trip join');
            return;
          }

          // Get current session for auth token
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.error('No session found for pending trip join');
            return;
          }

          // Check if user is already a member
          try {
            const memberResponse = await fetch(`https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/members/${pendingTrip.tripId}`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
            });

            if (memberResponse.ok) {
              console.log('✅ User already a member of pending trip');
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
                console.error('Failed to add user to trip:', error);
                throw error;
              } else {
                console.log('✅ User added as trip member');
              }
            }
          } catch (memberError) {
            console.log('Adding user as trip member...');
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
              console.error('Failed to add user to trip:', error);
            } else {
              console.log('✅ User added as trip member');
            }
          }

          // Reload trips to include the new trip
          await get().loadTripsFromDatabase();
          
          // Navigate to the trip
          window.location.href = `/trip/${pendingTrip.tripId}`;

        } catch (error) {
          console.error('Error processing pending trip join:', error);
        }
      },
    }));

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