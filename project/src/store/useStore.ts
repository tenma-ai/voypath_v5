import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  // API Integration
  createTripWithAPI: (tripData: TripCreateData) => Promise<Trip>;
  optimizeTrip: (tripId: string) => Promise<void>;

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

      // API Integration
      createTripWithAPI: async (tripData: TripCreateData): Promise<Trip> => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        try {
          const response = await fetch('/api/supabase/functions/trip-management', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.id}`, // In real implementation, use proper JWT token
            },
            body: JSON.stringify(tripData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create trip');
          }

          const result = await response.json();
          const newTrip: Trip = {
            id: result.trip.id,
            departureLocation: result.trip.departure_location,
            name: result.trip.name,
            description: result.trip.description,
            destination: result.trip.destination,
            startDate: result.trip.start_date,
            endDate: result.trip.end_date,
            memberCount: result.trip.total_members || 1,
            createdAt: result.trip.created_at,
            ownerId: result.trip.owner_id,
          };

          // Add to local store
          set((state) => ({ 
            trips: [...state.trips, newTrip],
            currentTrip: newTrip 
          }));

          return newTrip;
        } catch (error) {
          console.error('Failed to create trip with API:', error);
          // Fallback to local storage for demo
          const fallbackTrip: Trip = {
            id: `trip-${Date.now()}`,
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

          // Update places with optimized schedule if needed
          // This would typically update the places array with scheduling information
          
        } catch (error) {
          console.error('Failed to optimize trip:', error);
          throw error;
        } finally {
          set({ isOptimizing: false });
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