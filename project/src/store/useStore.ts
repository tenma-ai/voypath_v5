import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OptimizedRoute } from '../services/TripOptimizationService';

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
  addPlace: (place: Place) => void;
  updatePlace: (id: string, updates: Partial<Place>) => void;
  deletePlace: (id: string) => void;

  // UI State
  isOptimizing: boolean;
  setIsOptimizing: (optimizing: boolean) => void;

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

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
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
      setCurrentTrip: (trip) => set({ currentTrip: trip }),

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
      addPlace: (place) =>
        set((state) => ({ places: [...state.places, place] })),
      updatePlace: (id, updates) =>
        set((state) => ({
          places: state.places.map((place) =>
            place.id === id ? { ...place, ...updates } : place
          ),
        })),
      deletePlace: (id) =>
        set((state) => ({
          places: state.places.filter((place) => place.id !== id),
        })),

      // UI State
      isOptimizing: false,
      setIsOptimizing: (optimizing) => set({ isOptimizing: optimizing }),

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
          const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/rest/v1/rpc/execute_sql', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08',
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08'
            },
            body: JSON.stringify({
              query: `
                SELECT 
                  id, name, departure_location, description, destination, 
                  start_date, end_date, owner_id, created_at
                FROM trips 
                ORDER BY created_at DESC 
                LIMIT 20;
              `
            })
          });
          
          const tripsData = await response.json();
          
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
          const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/rest/v1/rpc/execute_sql', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08',
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08'
            },
            body: JSON.stringify({
              query: `
                SELECT 
                  id, name, category, place_type, wish_level, stay_duration_minutes,
                  latitude, longitude, is_selected_for_optimization, 
                  normalized_wish_level, selection_round, trip_id, user_id, created_at
                FROM places 
                ${tripId ? `WHERE trip_id = '${tripId}'` : ''}
                ORDER BY created_at;
              `
            })
          });
          
          const placesData = await response.json();
          
          if (placesData && Array.isArray(placesData)) {
            const places: Place[] = placesData.map(place => ({
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
              scheduledDate: place.is_selected_for_optimization ? '7/1' : undefined,
              tripId: place.trip_id,
              trip_id: place.trip_id,
              userId: place.user_id,
              user_id: place.user_id,
              is_selected_for_optimization: place.is_selected_for_optimization,
              normalized_wish_level: place.normalized_wish_level,
              selection_round: place.selection_round,
              wish_level: place.wish_level,
              stay_duration_minutes: place.stay_duration_minutes
            }));
            
            set({ places });
          }
        } catch (error) {
          console.error('Failed to load places from database:', error);
        }
      },

      initializeFromDatabase: async (): Promise<void> => {
        const { loadTripsFromDatabase, loadPlacesFromDatabase } = get();
        await loadTripsFromDatabase();
        await loadPlacesFromDatabase();
      },

      // API Integration
      createTripWithAPI: async (tripData: TripCreateData): Promise<Trip> => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        try {
          // For demo purposes, skip API call and go directly to local storage
          console.log('Creating trip locally for demo purposes');
          throw new Error('Demo mode - using local storage');
        } catch (error) {
          console.log('Using local storage for trip creation:', error.message);
          // Fallback to local storage for demo - generate proper UUID
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          };
          
          const fallbackTrip: Trip = {
            id: generateUUID(),
            departureLocation: tripData.departure_location,
            name: tripData.name || `${tripData.departure_location} Trip`,
            description: tripData.description,
            destination: tripData.destination,
            startDate: tripData.start_date,
            endDate: tripData.end_date,
            memberCount: 1,
            createdAt: new Date().toISOString(),
            ownerId: user.id,
          };

          set((state) => ({ 
            trips: [...state.trips, fallbackTrip],
            currentTrip: fallbackTrip 
          }));

          return fallbackTrip;
        }
      },

      optimizeTrip: async (tripId: string): Promise<void> => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        set({ isOptimizing: true });

        try {
          const response = await fetch('/api/supabase/functions/optimize-route', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.id}`, // In real implementation, use proper JWT token
            },
            body: JSON.stringify({ trip_id: tripId }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to optimize trip');
          }

          const result = await response.json();
          console.log('Optimization completed:', result);

          // Update places with optimized schedule from database
          await get().loadPlacesFromAPI(tripId);
          
        } catch (error) {
          console.error('Failed to optimize trip:', error);
          throw error;
        } finally {
          set({ isOptimizing: false });
        }
      },

      loadPlacesFromAPI: async (tripId: string): Promise<void> => {
        try {
          // Import Supabase client dynamically to avoid bundling issues
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
          const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';
          const supabase = createClient(supabaseUrl, supabaseKey);

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
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
          const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data: result, error } = await supabase
            .from('optimization_results')
            .select('*')
            .eq('trip_id', tripId)
            .eq('is_active', true)
            .single();

          if (error) {
            console.error('Failed to load optimization result:', error);
            set({ optimizationResult: null });
            return;
          }

          if (result) {
            // Convert database result to OptimizedRoute format
            const optimizedRoute: OptimizedRoute = {
              daily_schedules: result.optimized_route || [],
              optimization_score: result.optimization_score || { overall: 0, fairness: 0, efficiency: 0 },
              execution_time_ms: result.execution_time_ms || 0,
              total_travel_time_minutes: result.total_travel_time_minutes || 0,
              total_visit_time_minutes: result.total_visit_time_minutes || 0,
              created_by: result.created_by || ''
            };

            set({ optimizationResult: optimizedRoute });
            console.log(`Loaded optimization result for trip ${tripId}`);
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
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
          const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';
          const supabase = createClient(supabaseUrl, supabaseKey);
          
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

          // Check if system places already exist
          const { data: existingSystemPlaces } = await supabase
            .from('places')
            .select('id, place_type')
            .eq('trip_id', tripId)
            .in('place_type', ['departure', 'destination']);

          if (existingSystemPlaces && existingSystemPlaces.length > 0) {
            console.log('System places already exist for trip', tripId);
            return;
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
              stay_duration_minutes: 0,
              price_level: 0,
              scheduled: true,
              scheduled_date: trip.start_date,
              scheduled_time_start: '08:00:00',
              scheduled_time_end: '08:00:00',
              visit_date: trip.start_date,
              trip_id: tripId,
              user_id: user.id,
              place_type: 'departure',
              source: 'system_generated'
            });
          }

          // Create destination place if different from departure
          if (trip.destination && trip.destination !== trip.departure_location) {
            systemPlaces.push({
              name: `Destination: ${trip.destination}`,
              category: 'transportation',
              address: trip.destination,
              latitude: 35.6812, // Default coordinates
              longitude: 139.7671,
              rating: 0,
              wish_level: 5,
              stay_duration_minutes: 0,
              price_level: 0,
              scheduled: true,
              scheduled_date: trip.end_date,
              scheduled_time_start: '18:00:00',
              scheduled_time_end: '18:00:00',
              visit_date: trip.end_date,
              trip_id: tripId,
              user_id: user.id,
              place_type: 'destination',
              source: 'system_generated'
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
        }
      },
    }),
    {
      name: 'voypath-storage',
      partialize: (state) => ({
        theme: state.theme,
        user: state.user,
        trips: state.trips,
        places: state.places,
        currentTrip: state.currentTrip,
      }),
    }
  )
);

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