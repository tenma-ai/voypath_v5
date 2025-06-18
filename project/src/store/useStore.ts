import { create } from 'zustand';
import { OptimizedRoute } from '../services/TripOptimizationService';
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
  setCurrentTrip: (trip: Trip) => void;

  // Trips
  trips: Trip[];
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;

  // Places
  places: Place[];
  addPlace: (place: Place) => Promise<void>;
  updatePlace: (id: string, updates: Partial<Place>) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;

  // UI State
  isOptimizing: boolean;
  setIsOptimizing: (optimizing: boolean) => void;
  isCreatingSystemPlaces: boolean;

  // Optimization Results
  optimizationResult: OptimizedRoute | null;
  setOptimizationResult: (result: OptimizedRoute | null) => void;

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
        set({ currentTrip: trip, places: [] }); // Clear places when switching trips
        if (trip) {
          try {
            await get().loadPlacesFromDatabase(trip.id);
            console.log(`🔄 Switched to trip: ${trip.name}, loaded places for trip ${trip.id}`);
          } catch (error) {
            console.error('Failed to load places for new trip:', error);
          }
        }
      },

      // Trips
      trips: [],
      addTrip: (trip) =>
        set((state) => ({ trips: [...state.trips, trip] })),
      updateTrip: (id, updates) =>
        set((state) => ({
          trips: state.trips.map((trip) =>
            trip.id === id ? { ...trip, ...updates } : trip
          ),
          // Update currentTrip if it's the one being updated
          currentTrip: state.currentTrip?.id === id 
            ? { ...state.currentTrip, ...updates } 
            : state.currentTrip,
        })),
      deleteTrip: (id) =>
        set((state) => ({
          trips: state.trips.filter((trip) => trip.id !== id),
        })),

      // Places
      places: [],
      addPlace: async (place) => {
        const { currentTrip, user } = get();
        
        // Ensure we have current trip and user
        if (!currentTrip) {
          throw new Error('No current trip selected');
        }
        if (!user) {
          throw new Error('User not authenticated');
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
            images: placeWithIds.images
          };

          const result = await addPlaceToDatabase(placeData);
          console.log('✅ Place saved to database:', result);
          
          // Reload places for current trip to ensure consistency
          await get().loadPlacesFromDatabase(currentTrip.id);
          
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

      // UI State
      isOptimizing: false,
      setIsOptimizing: (optimizing) => set({ isOptimizing: optimizing }),
      isCreatingSystemPlaces: false,

      // Optimization Results
      optimizationResult: null,
      setOptimizationResult: (result) => set({ optimizationResult: result }),

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
          // Note: For now, we'll just load trips by owner_id to avoid the complex OR query
          const { data: tripsData, error } = await supabase
            .from('trips')
            .select(`
              id, name, departure_location, description, destination, 
              start_date, end_date, owner_id, created_at
            `)
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
          
          if (error) {
            console.error('Failed to load trips from database:', error);
            return;
          }

          if (tripsData && Array.isArray(tripsData)) {
            const trips: Trip[] = tripsData.map(trip => ({
              id: trip.id,
              name: trip.name || `${trip.departure_location} Trip`,
              departureLocation: trip.departure_location,
              description: trip.description,
              destination: trip.destination,
              startDate: trip.start_date,
              endDate: trip.end_date,
              memberCount: 1,
              createdAt: trip.created_at,
              ownerId: trip.owner_id
            }));
            
            set({ trips });
            console.log(`✅ Loaded ${trips.length} trips from database`);
            
            // Set the first trip as current if no current trip is set
            if (!get().currentTrip && trips.length > 0) {
              set({ currentTrip: trips[0] });
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
              latitude: place.latitude || 35.6762,
              longitude: place.longitude || 139.6503,
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
            if (targetTripId && !get().isCreatingSystemPlaces) {
              const { createSystemPlaces } = get();
              await createSystemPlaces(targetTripId);
            }
          }
        } catch (error) {
          console.error('Failed to load places from database:', error);
        }
      },

      initializeFromDatabase: async (): Promise<void> => {
        const { loadTripsFromDatabase, loadPlacesFromDatabase } = get();
        
        // Always load from database for scalable architecture
        try {
          await loadTripsFromDatabase();
          
          // Load places only for current trip (if any)
          const { currentTrip } = get();
          if (currentTrip) {
            await loadPlacesFromDatabase(currentTrip.id);
            console.log(`🔄 Initialized app with fresh database data for trip: ${currentTrip.name}`);
          } else {
            console.log('🔄 Initialized app with trips data (no current trip selected)');
          }
        } catch (error) {
          console.error('Failed to initialize from database:', error);
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
            memberCount: 1,
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
          // Clear any cached optimization results and always start fresh
          console.log('🗑️ Clearing cached optimization results for trip:', tripId);
          set({ optimizationResult: null });
          
          // Check if table exists before querying
          const { data: result, error } = await supabase
            .from('optimization_results')
            .select('*')
            .eq('trip_id', tripId)
            .eq('is_active', true)
            .maybeSingle(); // Use maybeSingle instead of single to handle no results

          if (error) {
            // If table doesn't exist or query fails, just set null result
            console.warn('Optimization results table not found or query failed:', error.message);
            set({ optimizationResult: null });
            return;
          }

          if (result) {
            console.log('🔍 [useStore] Raw database result:', result);
            console.log('🔍 [useStore] optimized_route:', result.optimized_route);
            console.log('🔍 [useStore] daily_schedules:', result.optimized_route?.daily_schedules);
            
            // Convert database result to OptimizedRoute format
            const optimizedRoute: OptimizedRoute = {
              daily_schedules: result.optimized_route?.daily_schedules || [],
              optimization_score: result.optimization_score || { overall: 0, fairness: 0, efficiency: 0 },
              execution_time_ms: result.execution_time_ms || 0,
              total_travel_time_minutes: result.total_travel_time_minutes || 0,
              total_visit_time_minutes: result.total_visit_time_minutes || 0,
              created_by: result.created_by || ''
            };

            console.log('🔍 [useStore] Converted optimizedRoute:', optimizedRoute);
            console.log('🔍 [useStore] Converted daily_schedules:', optimizedRoute.daily_schedules);

            set({ optimizationResult: optimizedRoute });
            console.log(`✅ Loaded optimization result for trip ${tripId}`);
          } else {
            set({ optimizationResult: null });
          }
          
        } catch (error) {
          console.error('Failed to load optimization result:', error);
          set({ optimizationResult: null });
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

          // Always recreate system places to ensure they exist correctly
          if (existingSystemPlaces && existingSystemPlaces.length > 0) {
            console.log('🗑️ Deleting existing system places for trip', tripId);
            const { error: deleteError } = await supabase
              .from('places')
              .delete()
              .eq('trip_id', tripId)
              .or('place_type.in.(departure,destination),source.eq.system');
            
            if (deleteError) {
              console.error('❌ Failed to delete existing system places:', deleteError);
            } else {
              console.log('✅ Existing system places deleted successfully');
            }
          }
          
          console.log('✅ No existing system places found - creating new ones');

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

          // Create destination place only if different from departure
          if (trip.destination && trip.destination !== 'same as departure location') {
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