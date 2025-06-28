# Backend Design and Frontend Integration

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Backend Infrastructure](#backend-infrastructure)
3. [Database Design](#database-design)
4. [Authentication System](#authentication-system)
5. [API Layer](#api-layer)
6. [Real-time Features](#real-time-features)
7. [Frontend Integration](#frontend-integration)
8. [State Management](#state-management)
9. [Data Flow Patterns](#data-flow-patterns)
10. [Error Handling](#error-handling)
11. [Performance Optimization](#performance-optimization)
12. [Security Implementation](#security-implementation)

## Architecture Overview

### System Architecture
Voypath follows a modern serverless architecture with clear separation between frontend and backend concerns:

```
Frontend (React/TypeScript)
    ↓ HTTP/WebSocket
Supabase API Gateway
    ↓
Edge Functions (Deno)
    ↓
PostgreSQL Database
```

### Technology Stack
- **Frontend**: React 18.3.1, TypeScript 5.5.3, Zustand (state management)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Runtime**: Deno for Edge Functions
- **Real-time**: WebSocket subscriptions via Supabase Realtime
- **Authentication**: Supabase Auth with multiple providers
- **File Storage**: Supabase Storage
- **Payment**: Stripe integration

## Backend Infrastructure

### Supabase Configuration
```typescript
// lib/supabase.ts
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);
```

### Edge Functions Architecture
Edge Functions provide server-side business logic with the following structure:

```typescript
// Standard Edge Function Pattern
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Business logic implementation
    const result = await processRequest(req);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

### Core Edge Functions

#### 1. Route Optimization (`optimize-route`)
**Purpose**: Core algorithm for trip route optimization
**Input**: Trip ID, optimization parameters
**Output**: Optimized daily schedules with travel times

```typescript
interface OptimizationRequest {
  tripId: string;
  maxPlacesPerDay?: number;
  transportPreference?: 'car' | 'walking' | 'public_transport';
  optimizationLevel?: 'balanced' | 'time_efficient' | 'comprehensive';
}

interface OptimizationResult {
  daily_schedules: DailySchedule[];
  total_travel_time: number;
  fairness_score: number;
  optimization_metadata: object;
}
```

#### 2. Trip Management (`trip-management`)
**Purpose**: CRUD operations for trips
**Operations**: Create, read, update, delete trips with validation

#### 3. Member Management (`trip-member-management`)
**Purpose**: Trip membership and role management
**Operations**: Invite, join, remove members, role changes

#### 4. Trip Sharing (`trip-sharing-v3`)
**Purpose**: Generate secure share links for public trip viewing
**Features**: Token generation, expiration handling, analytics

#### 5. Stripe Integration
**Functions**: `create-checkout-session`, `create-portal-session`, `stripe-webhook`
**Purpose**: Premium subscription management and payment processing

## Database Design

### Schema Overview
The database uses PostgreSQL with the following key design principles:
- UUID primary keys for security
- JSONB for flexible metadata storage
- Row Level Security (RLS) for data isolation
- PostGIS for geographic data
- Comprehensive indexing for performance

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_guest BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  theme_preference TEXT DEFAULT 'light',
  language_preference TEXT DEFAULT 'en',
  notification_settings JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'
);
```

#### Trips Table
```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  departure_location TEXT NOT NULL,
  departure_coordinates POINT,
  departure_date DATE NOT NULL,
  arrival_date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  max_members INTEGER DEFAULT 10,
  add_place_deadline TIMESTAMPTZ,
  is_optimized BOOLEAN DEFAULT false,
  optimization_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Places Table
```sql
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  place_name TEXT NOT NULL,
  place_id TEXT, -- Google Places ID
  coordinates POINT NOT NULL,
  category TEXT,
  place_type TEXT DEFAULT 'visit',
  wish_level INTEGER DEFAULT 3 CHECK (wish_level >= 1 AND wish_level <= 5),
  duration_minutes INTEGER DEFAULT 120,
  notes TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optimization specific fields
  is_selected BOOLEAN DEFAULT false,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  day_number INTEGER,
  optimization_metadata JSONB DEFAULT '{}'
);
```

#### Trip Members Table
```sql
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role member_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(trip_id, user_id)
);
```

#### Messages Table (Chat System)
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  message_type message_type DEFAULT 'text',
  reply_to UUID REFERENCES messages(id),
  place_id UUID REFERENCES places(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Member Colors Table
```sql
CREATE TABLE member_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  hex_value TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(trip_id, user_id),
  UNIQUE(trip_id, color_name)
);
```

### Row Level Security (RLS) Policies

#### Users Table Policies
```sql
-- Users can only view/edit their own profile
CREATE POLICY "users_select_own" ON users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users 
  FOR UPDATE USING (auth.uid() = id);
```

#### Trips Table Policies
```sql
-- Users can view trips they are members of
CREATE POLICY "trips_select_member" ON trips 
  FOR SELECT USING (
    id IN (
      SELECT trip_id FROM trip_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only trip creators can update trips
CREATE POLICY "trips_update_creator" ON trips 
  FOR UPDATE USING (created_by = auth.uid());
```

#### Places Table Policies
```sql
-- Users can view places in trips they are members of
CREATE POLICY "places_select_member" ON places 
  FOR SELECT USING (
    trip_id IN (
      SELECT trip_id FROM trip_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can only insert/update their own places
CREATE POLICY "places_insert_own" ON places 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "places_update_own" ON places 
  FOR UPDATE USING (user_id = auth.uid());
```

### Database Indexes
```sql
-- Performance indexes
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_places_trip_id ON places(trip_id);
CREATE INDEX idx_places_user_id ON places(user_id);
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX idx_messages_trip_id ON messages(trip_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Geographic indexes (PostGIS)
CREATE INDEX idx_places_coordinates ON places USING GIST(coordinates);
CREATE INDEX idx_trips_departure_coordinates ON trips USING GIST(departure_coordinates);

-- Partial indexes for optimization
CREATE INDEX idx_places_selected ON places(trip_id) WHERE is_selected = true;
CREATE INDEX idx_active_trip_members ON trip_members(trip_id) WHERE is_active = true;
```

## Authentication System

### Multi-Provider Authentication
```typescript
// Authentication configuration
const authConfig = {
  providers: {
    google: {
      enabled: true,
      redirectTo: `${window.location.origin}/auth/callback`
    },
    github: {
      enabled: true,
      redirectTo: `${window.location.origin}/auth/callback`
    },
    email: {
      enabled: true,
      confirmEmail: false // For faster onboarding
    }
  }
};
```

### Guest User System
```typescript
// Guest user creation
export const createGuestUser = async (): Promise<User> => {
  const { data, error } = await supabase.auth.signUp({
    email: `guest-${crypto.randomUUID()}@voypath.local`,
    password: crypto.randomUUID(),
    options: {
      data: {
        name: `Guest User ${Math.floor(Math.random() * 1000)}`,
        is_guest: true
      }
    }
  });
  
  if (error) throw error;
  return data.user;
};
```

### Session Management
```typescript
// Authentication state management in Zustand store
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  
  // Actions
  signIn: (provider: Provider) => Promise<void>;
  signOut: () => Promise<void>;
  upgradeGuestAccount: (email: string, password: string) => Promise<void>;
}

// Session persistence and restoration
export const initializeAuth = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    useStore.getState().setSession(session);
    await loadUserProfile(session.user.id);
  }
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      useStore.getState().setSession(session);
      await loadUserProfile(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      useStore.getState().clearSession();
    }
  });
};
```

## API Layer

### Service Architecture
The frontend uses a service layer pattern to abstract API interactions:

```typescript
// Base service class
abstract class BaseService {
  protected supabase = supabase;
  
  protected async handleRequest<T>(
    operation: () => Promise<PostgrestResponse<T>>
  ): Promise<T> {
    const { data, error } = await operation();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(error.message);
    }
    
    return data;
  }
  
  protected async handleRpcRequest<T>(
    functionName: string, 
    params: object
  ): Promise<T> {
    const { data, error } = await this.supabase.rpc(functionName, params);
    
    if (error) {
      console.error('RPC error:', error);
      throw new Error(error.message);
    }
    
    return data;
  }
}
```

### Trip Management Service
```typescript
export class TripService extends BaseService {
  async createTrip(tripData: CreateTripData): Promise<Trip> {
    return this.handleRequest(() =>
      this.supabase
        .from('trips')
        .insert({
          ...tripData,
          created_by: this.getCurrentUserId()
        })
        .select('*')
        .single()
    );
  }
  
  async getTrips(): Promise<Trip[]> {
    return this.handleRequest(() =>
      this.supabase
        .from('trips')
        .select(`
          *,
          trip_members!inner(
            user_id,
            role,
            users(name, avatar_url)
          ),
          places(count)
        `)
        .eq('trip_members.user_id', this.getCurrentUserId())
        .eq('trip_members.is_active', true)
        .order('created_at', { ascending: false })
    );
  }
  
  async optimizeTrip(tripId: string, options: OptimizationOptions): Promise<OptimizationResult> {
    const { data, error } = await this.supabase.functions.invoke('optimize-route', {
      body: { tripId, ...options }
    });
    
    if (error) throw error;
    return data;
  }
}
```

### Places Service
```typescript
export class PlacesService extends BaseService {
  async addPlace(placeData: CreatePlaceData): Promise<Place> {
    // Check for duplicates first
    const duplicate = await this.findDuplicatePlace(
      placeData.trip_id, 
      placeData.coordinates
    );
    
    if (duplicate) {
      throw new Error('This place has already been added to the trip');
    }
    
    return this.handleRequest(() =>
      this.supabase
        .from('places')
        .insert({
          ...placeData,
          user_id: this.getCurrentUserId()
        })
        .select('*')
        .single()
    );
  }
  
  private async findDuplicatePlace(
    tripId: string, 
    coordinates: [number, number]
  ): Promise<Place | null> {
    const [longitude, latitude] = coordinates;
    
    const { data } = await this.supabase.rpc('find_nearby_places', {
      trip_id: tripId,
      search_lat: latitude,
      search_lng: longitude,
      radius_km: 0.1 // 100 meters radius
    });
    
    return data && data.length > 0 ? data[0] : null;
  }
}
```

### Member Color Service
```typescript
export class MemberColorService extends BaseService {
  private static readonly AVAILABLE_COLORS = [
    { name: 'red', hex: '#EF4444' },
    { name: 'blue', hex: '#3B82F6' },
    { name: 'green', hex: '#10B981' },
    // ... 17 more colors
  ];
  
  async assignMemberColor(tripId: string, userId: string): Promise<MemberColor> {
    // Find available colors for this trip
    const usedColors = await this.getUsedColors(tripId);
    const availableColors = this.AVAILABLE_COLORS.filter(
      color => !usedColors.includes(color.name)
    );
    
    if (availableColors.length === 0) {
      throw new Error('No available colors for this trip');
    }
    
    // Assign the first available color
    const colorToAssign = availableColors[0];
    
    return this.handleRequest(() =>
      this.supabase
        .from('member_colors')
        .insert({
          trip_id: tripId,
          user_id: userId,
          color_name: colorToAssign.name,
          hex_value: colorToAssign.hex
        })
        .select('*')
        .single()
    );
  }
  
  async getMemberColor(tripId: string, userId: string): Promise<MemberColor | null> {
    const { data } = await this.supabase
      .from('member_colors')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .single();
    
    return data;
  }
}
```

## Real-time Features

### WebSocket Subscriptions
```typescript
// Real-time chat implementation
export class ChatService extends BaseService {
  private subscription: RealtimeSubscription | null = null;
  
  subscribeToMessages(tripId: string, callback: (message: Message) => void) {
    this.subscription = this.supabase
      .channel(`messages:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();
  }
  
  async sendMessage(tripId: string, content: string, type: MessageType = 'text'): Promise<Message> {
    return this.handleRequest(() =>
      this.supabase
        .from('messages')
        .insert({
          trip_id: tripId,
          user_id: this.getCurrentUserId(),
          content,
          message_type: type
        })
        .select(`
          *,
          user:users(name, avatar_url),
          place:places(place_name)
        `)
        .single()
    );
  }
  
  unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
```

### Live Place Updates
```typescript
// Real-time place updates
export const subscribeToPlaceUpdates = (
  tripId: string, 
  onUpdate: (place: Place) => void
) => {
  return supabase
    .channel(`places:${tripId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'places',
        filter: `trip_id=eq.${tripId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          onUpdate(payload.new as Place);
        } else if (payload.eventType === 'UPDATE') {
          onUpdate(payload.new as Place);
        } else if (payload.eventType === 'DELETE') {
          onUpdate({ ...payload.old, deleted: true } as Place);
        }
      }
    )
    .subscribe();
};
```

## Frontend Integration

### State Management with Zustand
```typescript
// Main application store
interface AppState {
  // Authentication
  user: User | null;
  session: Session | null;
  
  // Trip data
  currentTrip: Trip | null;
  trips: Trip[];
  places: Place[];
  
  // UI state
  loading: {
    trips: boolean;
    places: boolean;
    optimization: boolean;
  };
  
  // Real-time data
  messages: Message[];
  memberColors: Record<string, string>;
  tripMembers: TripMember[];
  
  // Actions
  setCurrentTrip: (trip: Trip | null) => void;
  addPlace: (place: Place) => void;
  updatePlace: (id: string, updates: Partial<Place>) => void;
  removePlace: (id: string) => void;
  
  // Async actions
  loadTrips: () => Promise<void>;
  loadPlaces: (tripId: string) => Promise<void>;
  optimizeTrip: (tripId: string, options: OptimizationOptions) => Promise<void>;
}

// Store implementation with persistence
export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      currentTrip: null,
      trips: [],
      places: [],
      loading: {
        trips: false,
        places: false,
        optimization: false
      },
      messages: [],
      memberColors: {},
      tripMembers: [],
      
      // Synchronous actions
      setCurrentTrip: (trip) => set({ currentTrip: trip }),
      
      addPlace: (place) => set((state) => ({
        places: [...state.places, place]
      })),
      
      updatePlace: (id, updates) => set((state) => ({
        places: state.places.map(place => 
          place.id === id ? { ...place, ...updates } : place
        )
      })),
      
      removePlace: (id) => set((state) => ({
        places: state.places.filter(place => place.id !== id)
      })),
      
      // Async actions
      loadTrips: async () => {
        set((state) => ({ loading: { ...state.loading, trips: true } }));
        
        try {
          const trips = await TripService.getTrips();
          set({ trips });
        } catch (error) {
          console.error('Failed to load trips:', error);
          throw error;
        } finally {
          set((state) => ({ loading: { ...state.loading, trips: false } }));
        }
      },
      
      loadPlaces: async (tripId) => {
        set((state) => ({ loading: { ...state.loading, places: true } }));
        
        try {
          const places = await PlacesService.getPlaces(tripId);
          set({ places });
        } catch (error) {
          console.error('Failed to load places:', error);
          throw error;
        } finally {
          set((state) => ({ loading: { ...state.loading, places: false } }));
        }
      },
      
      optimizeTrip: async (tripId, options) => {
        set((state) => ({ loading: { ...state.loading, optimization: true } }));
        
        try {
          const result = await TripService.optimizeTrip(tripId, options);
          
          // Update places with optimization results
          set((state) => ({
            places: state.places.map(place => {
              const optimizedPlace = result.optimized_places.find(
                op => op.place_id === place.id
              );
              return optimizedPlace ? { ...place, ...optimizedPlace } : place;
            })
          }));
          
          // Update trip with optimization flag
          set((state) => ({
            currentTrip: state.currentTrip ? {
              ...state.currentTrip,
              is_optimized: true
            } : null
          }));
          
        } catch (error) {
          console.error('Failed to optimize trip:', error);
          throw error;
        } finally {
          set((state) => ({ loading: { ...state.loading, optimization: false } }));
        }
      }
    }),
    {
      name: 'voypath-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        currentTrip: state.currentTrip,
        memberColors: state.memberColors
      })
    }
  )
);
```

### React Hook Integration
```typescript
// Custom hooks for data fetching
export const useTrips = () => {
  const { trips, loading, loadTrips } = useStore();
  
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);
  
  return { trips, loading: loading.trips, refetch: loadTrips };
};

export const usePlaces = (tripId: string | null) => {
  const { places, loading, loadPlaces } = useStore();
  
  useEffect(() => {
    if (tripId) {
      loadPlaces(tripId);
    }
  }, [tripId, loadPlaces]);
  
  return { places, loading: loading.places };
};

// Real-time hooks
export const useRealtimeMessages = (tripId: string | null) => {
  const { messages, addMessage } = useStore();
  
  useEffect(() => {
    if (!tripId) return;
    
    const chatService = new ChatService();
    
    chatService.subscribeToMessages(tripId, (message) => {
      addMessage(message);
    });
    
    return () => {
      chatService.unsubscribe();
    };
  }, [tripId, addMessage]);
  
  return messages;
};
```

## Data Flow Patterns

### Optimistic Updates
```typescript
// Optimistic place addition
export const useOptimisticPlaceAddition = () => {
  const { addPlace, updatePlace, removePlace } = useStore();
  
  return async (placeData: CreatePlaceData) => {
    // Create temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticPlace: Place = {
      ...placeData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: getCurrentUserId()
    };
    
    // Add optimistically
    addPlace(optimisticPlace);
    
    try {
      // Perform actual API call
      const realPlace = await PlacesService.addPlace(placeData);
      
      // Replace optimistic place with real data
      removePlace(tempId);
      addPlace(realPlace);
      
      return realPlace;
    } catch (error) {
      // Remove optimistic place on error
      removePlace(tempId);
      throw error;
    }
  };
};
```

### Error Boundary Integration
```typescript
// Error boundary for handling API errors
interface ApiErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ApiErrorBoundary extends Component<
  PropsWithChildren<{}>,
  ApiErrorBoundaryState
> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): ApiErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('API Error:', error, errorInfo);
    
    // Report to error tracking service
    this.reportError(error, errorInfo);
  }
  
  private reportError(error: Error, errorInfo: ErrorInfo) {
    // Integration with error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry, LogRocket, etc.
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Error Handling

### Centralized Error Management
```typescript
// Error types
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
}

// Error handling service
export class ErrorHandlingService {
  static handleApiError(error: any): AppError {
    if (error.message?.includes('auth')) {
      return {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Please sign in to continue',
        timestamp: new Date()
      };
    }
    
    if (error.message?.includes('permission')) {
      return {
        type: ErrorType.PERMISSION_ERROR,
        message: 'You do not have permission to perform this action',
        timestamp: new Date()
      };
    }
    
    if (error.message?.includes('quota')) {
      return {
        type: ErrorType.QUOTA_EXCEEDED,
        message: 'You have reached your usage limit. Please upgrade to continue.',
        timestamp: new Date()
      };
    }
    
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date()
    };
  }
  
  static displayError(error: AppError) {
    // Integration with toast notification system
    toast.error(error.message);
    
    // Log for debugging
    console.error('App Error:', error);
  }
}
```

### Retry Logic
```typescript
// Exponential backoff retry utility
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          break;
        }
        
        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }
  
  private static isRetryableError(error: any): boolean {
    // Retry network errors, timeouts, and 5xx status codes
    return error.name === 'NetworkError' ||
           error.message?.includes('timeout') ||
           (error.status >= 500 && error.status < 600);
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Performance Optimization

### Database Query Optimization
```sql
-- Optimized query for trip list with member counts
EXPLAIN ANALYZE
SELECT 
  t.*,
  COUNT(tm.user_id) as member_count,
  COUNT(p.id) as place_count
FROM trips t
LEFT JOIN trip_members tm ON t.id = tm.trip_id AND tm.is_active = true
LEFT JOIN places p ON t.id = p.trip_id
WHERE t.id IN (
  SELECT trip_id 
  FROM trip_members 
  WHERE user_id = $1 AND is_active = true
)
GROUP BY t.id
ORDER BY t.updated_at DESC;
```

### Frontend Performance
```typescript
// React.memo for expensive components
export const PlaceCard = React.memo<PlaceCardProps>(({ place, memberColors }) => {
  const placeColor = useMemo(() => 
    calculatePlaceColor(place, memberColors), 
    [place, memberColors]
  );
  
  return (
    <div className="place-card" style={{ borderColor: placeColor }}>
      {/* Place card content */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return prevProps.place.id === nextProps.place.id &&
         prevProps.place.updated_at === nextProps.place.updated_at &&
         JSON.stringify(prevProps.memberColors) === JSON.stringify(nextProps.memberColors);
});

// Virtual scrolling for large lists
export const VirtualizedPlaceList = ({ places }: { places: Place[] }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={places.length}
      itemSize={120}
      itemData={places}
    >
      {({ index, style, data }) => (
        <div style={style}>
          <PlaceCard place={data[index]} />
        </div>
      )}
    </FixedSizeList>
  );
};
```

### Caching Strategy
```typescript
// React Query integration for caching
export const useCachedTrips = () => {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => TripService.getTrips(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });
};

// Service Worker for offline caching
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/trips')) {
    event.respondWith(
      caches.open('voypath-api').then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            // Serve from cache
            fetch(event.request).then(fetchResponse => {
              cache.put(event.request, fetchResponse.clone());
            });
            return response;
          }
          
          // Fetch and cache
          return fetch(event.request).then(fetchResponse => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

## Security Implementation

### Input Validation
```typescript
// Zod schemas for validation
import { z } from 'zod';

export const createTripSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  departure_location: z.string().min(1),
  departure_date: z.string().datetime(),
  arrival_date: z.string().datetime(),
  max_members: z.number().min(1).max(50).default(10)
}).refine(data => new Date(data.arrival_date) > new Date(data.departure_date), {
  message: "Arrival date must be after departure date",
  path: ["arrival_date"]
});

export const createPlaceSchema = z.object({
  place_name: z.string().min(1).max(200),
  coordinates: z.array(z.number()).length(2),
  category: z.string().optional(),
  wish_level: z.number().min(1).max(5).default(3),
  duration_minutes: z.number().min(15).max(1440).default(120),
  notes: z.string().max(1000).optional()
});

// Validation middleware
export const validateInput = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  };
};
```

### API Security
```typescript
// Rate limiting for Edge Functions
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (userId: string, maxRequests: number = 100): boolean => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  const userLimit = rateLimiter.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimiter.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    return false;
  }
  
  userLimit.count++;
  return true;
};

// SQL injection prevention
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['";]/g, '') // Remove SQL injection characters
    .trim()
    .substring(0, 1000); // Limit length
};
```

### Content Security Policy
```typescript
// CSP configuration
const cspConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://maps.googleapis.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'https://*.googleapis.com', 'https://*.supabase.co'],
  'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
  'font-src': ["'self'", 'https://fonts.gstatic.com']
};

// Environment-specific configuration
export const getCSPHeader = () => {
  const directives = Object.entries(cspConfig)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
  
  return `${directives}; upgrade-insecure-requests`;
};
```

This comprehensive documentation covers the complete backend design and frontend integration of the Voypath application, providing detailed insights into the architecture, implementation patterns, and best practices used throughout the system.