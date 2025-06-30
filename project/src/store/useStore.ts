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
  canJoinTrip: () => boolean;
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
              // Reset hasUserOptimized when switching to a different trip
              // This ensures places appear as pending until user explicitly optimizes
              // But will be set back to true if optimization results are found
              set({ hasUserOptimized: false });
              
              await get().loadMemberColorsForTrip(trip.id); // Load colors first
              await get().loadPlacesFromDatabase(trip.id);
              await get().loadOptimizationResult(trip.id);
            } else {
              // Still reload colors to ensure consistency
              await get().loadMemberColorsForTrip(trip.id);
              // Preserve optimization results if staying on same trip
              if (currentOptimizationResult) {
                set({ 
                  optimizationResult: currentOptimizationResult,
                  hasUserOptimized: true // Preserve the optimization state
                });
              }
            }
          } catch (error) {
            // Failed to load data for new trip
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
            // Failed to update trip in database
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

        } catch (error) {
          // Failed to update trip
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
      
      // Success animation control - only triggers once per optimization
      showOptimizationSuccess: false,
      setShowOptimizationSuccess: (value) => {
        set({ showOptimizationSuccess: value });
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
        const { user, canCreateTrip } = get();
        if (!user) throw new Error('User not authenticated');
        
        // Double-check trip creation limits
        if (!canCreateTrip()) {
          throw new Error('You have reached the trip limit for your current plan. Please upgrade to Premium to create more trips.');
        }

        try {
          // Use trip-management API for proper coordinate handling
          const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
          if (authError) {
            throw new Error('Authentication required');
          }
          if (!currentUser) {
            throw new Error('User not authenticated');
          }

          // Call trip-management Edge Function with coordinate data
          const response = await fetch('/api/trip-management', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              action: 'create',
              ...tripData
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create trip');
          }

          const result = await response.json();
          const createdTrip = result.trip;

          // 状態更新
          set(state => ({
            trips: [...state.trips, createdTrip],
            isLoading: false
          }));

          return createdTrip;
        } catch (error) {
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


            set({ 
              optimizationResult: optimizationResult,
              // Set hasUserOptimized to true when we have valid optimization results
              // This ensures the UI displays the optimization even after page reload
              hasUserOptimized: true
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
            const memberResponse = await fetch(`https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/members/${pendingTrip.tripId}`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
            });

            if (memberResponse.ok) {
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