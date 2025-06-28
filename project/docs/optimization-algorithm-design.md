# Optimization Algorithm Design

## Table of Contents
1. [Algorithm Overview](#algorithm-overview)
2. [Core Optimization Pipeline](#core-optimization-pipeline)
3. [Place Selection Algorithms](#place-selection-algorithms)
4. [Route Optimization](#route-optimization)
5. [Fairness Algorithms](#fairness-algorithms)
6. [Supporting Algorithms](#supporting-algorithms)
7. [Mathematical Formulations](#mathematical-formulations)
8. [Algorithm Parameters](#algorithm-parameters)
9. [Performance Analysis](#performance-analysis)
10. [Implementation Details](#implementation-details)

## Algorithm Overview

### System Architecture
The Voypath optimization engine employs a multi-stage algorithmic pipeline designed to solve the complex problem of group travel planning while maintaining fairness among participants and optimizing for efficiency.

```
Input: User Places + Trip Constraints
    ↓
1. Data Preprocessing & Validation
    ↓
2. Duplicate Detection & Merging
    ↓
3. Preference Normalization
    ↓
4. Fair Place Selection
    ↓
5. Route Optimization (TSP)
    ↓
6. Airport Insertion for Long Distance
    ↓
7. Daily Schedule Generation
    ↓
Output: Optimized Itinerary with Daily Schedules
```

### Problem Definition
**Primary Objective**: Generate an optimal travel itinerary that:
- Maximizes group satisfaction through fair place selection
- Minimizes total travel time and distance
- Respects time constraints and practical travel limitations
- Ensures equitable representation of all members' preferences

**Constraints**:
- Trip duration limits (max days available)
- Daily time limits (10-12 hours of activities)
- Transportation mode restrictions
- Member quota limits (max places per person)

## Core Optimization Pipeline

### Main Function: `optimize-route`
**Location**: `/supabase/functions/optimize-route/index.ts`

```typescript
export default async function optimizeRoute(request: OptimizationRequest): Promise<OptimizationResult> {
  // Stage 1: Input validation and data collection (Lines 904-937)
  const { tripId, memberId, constraints } = await validateInput(request);
  const { trip, places, members } = await collectTripData(tripId);
  
  // Stage 2: Data preprocessing (Lines 939-965)
  const cleanedPlaces = await preprocessPlaces(places);
  const deduplicatedPlaces = removeDuplicatePlaces(cleanedPlaces);
  
  // Stage 3: Preference normalization (Lines 966-967)
  const normalizedPlaces = normalizePreferences(deduplicatedPlaces, members);
  
  // Stage 4: Fair place selection (Lines 968-970)
  const selectedPlaces = await selectOptimalPlaces(normalizedPlaces, constraints);
  
  // Stage 5: Route optimization (Lines 975-978)
  const optimizedRoute = optimizeRouteOrder(selectedPlaces);
  const routeWithAirports = await insertAirportsIfNeeded(optimizedRoute);
  
  // Stage 6: Schedule generation (Lines 980-982)
  const dailySchedules = createDailySchedule(routeWithAirports, trip.departure_date);
  
  // Stage 7: Result compilation
  return compileOptimizationResult(dailySchedules, selectedPlaces);
}
```

### Input Data Structure
```typescript
interface OptimizationRequest {
  trip_id: string;
  member_id: string;
  constraints: {
    time_constraint_minutes?: number;
    distance_constraint_km?: number;
    budget_constraint_yen?: number;
    max_places?: number;
  };
  settings: {
    fairness_weight: number;      // 0.0 - 1.0
    efficiency_weight: number;    // 0.0 - 1.0
    include_meals: boolean;
    preferred_transport: 'car' | 'public_transport' | 'walking';
  };
}
```

### Output Data Structure
```typescript
interface OptimizationResult {
  success: boolean;
  optimization: {
    daily_schedules: DailySchedule[];
    optimization_score: OptimizationScore;
    total_duration_minutes: number;
    places: OptimizedPlace[];
    execution_time_ms: number;
    metadata: {
      algorithm_version: string;
      fairness_score: number;
      efficiency_score: number;
      total_distance_km: number;
    };
  };
}
```

## Place Selection Algorithms

### Fair Place Selection Algorithm
**Function**: `filterPlacesByFairness` (Lines 89-153)

**Algorithm Type**: Round-Robin with Weighted Preference Ordering

```typescript
function filterPlacesByFairness(
  places: Place[], 
  maxPlaces: number, 
  availableDays: number | null
): Place[] {
  // 1. Time-based constraint calculation
  const timeBasedMaxPlaces = calculateTimeConstrainedPlaces(places, availableDays);
  const effectiveMaxPlaces = Math.min(maxPlaces, timeBasedMaxPlaces);
  
  // 2. Separate system places (departure/destination) from user places
  const systemPlaces = places.filter(p => p.place_type !== 'visit');
  const visitPlaces = places.filter(p => p.place_type === 'visit');
  
  // 3. Group places by user
  const userGroups = groupPlacesByUser(visitPlaces);
  
  // 4. Sort each user's places by preference (descending)
  sortUserPlacesByPreference(userGroups);
  
  // 5. Round-robin selection
  const selectedPlaces = roundRobinSelection(userGroups, effectiveMaxPlaces);
  
  return [...systemPlaces, ...selectedPlaces];
}
```

### Time-Constrained Place Calculation
```typescript
function calculateTimeConstrainedPlaces(places: Place[], availableDays: number | null): number {
  if (availableDays === null) return Infinity;
  
  const maxMinutesPerDay = 600; // 10 hours
  const totalAvailableMinutes = availableDays * maxMinutesPerDay;
  
  // Calculate average times
  const avgStayTime = places.reduce((sum, p) => sum + (p.stay_duration_minutes || 120), 0) / places.length;
  const avgTravelTime = estimateAverageTravelTime(places); // ~45 minutes average
  const avgTimePerPlace = avgStayTime + avgTravelTime;
  
  return Math.floor(totalAvailableMinutes / avgTimePerPlace);
}
```

### Round-Robin Selection Implementation
```typescript
function roundRobinSelection(userGroups: Map<string, Place[]>, maxPlaces: number): Place[] {
  const selectedPlaces: Place[] = [];
  let round = 0;
  
  while (selectedPlaces.length < maxPlaces && hasRemainingPlaces(userGroups)) {
    for (const [userId, userPlaces] of userGroups) {
      if (userPlaces.length > 0 && selectedPlaces.length < maxPlaces) {
        const selectedPlace = userPlaces.shift()!;
        selectedPlace.selection_round = round + 1;
        selectedPlace.selection_order = selectedPlaces.length + 1;
        selectedPlaces.push(selectedPlace);
      }
    }
    round++;
  }
  
  return selectedPlaces;
}
```

### User Place Grouping and Sorting
```typescript
function groupPlacesByUser(places: Place[]): Map<string, Place[]> {
  const userGroups = new Map<string, Place[]>();
  
  places.forEach(place => {
    if (!userGroups.has(place.user_id)) {
      userGroups.set(place.user_id, []);
    }
    userGroups.get(place.user_id)!.push(place);
  });
  
  return userGroups;
}

function sortUserPlacesByPreference(userGroups: Map<string, Place[]>): void {
  userGroups.forEach(userPlaces => {
    userPlaces.sort((a, b) => {
      // Primary: normalized wish level (descending)
      if (a.normalized_wish_level !== b.normalized_wish_level) {
        return b.normalized_wish_level - a.normalized_wish_level;
      }
      // Secondary: original wish level (descending)
      if (a.wish_level !== b.wish_level) {
        return b.wish_level - a.wish_level;
      }
      // Tertiary: creation time (first added gets priority)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  });
}
```

## Route Optimization

### Distance Calculation: Haversine Formula
```typescript
function calculateDistance(point1: [number, number], point2: [number, number]): number {
  const R = 6371; // Earth's radius in kilometers
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}
```

### Transportation Mode Determination
```typescript
function determineTransportMode(
  distance: number, 
  fromAirport: boolean = false, 
  toAirport: boolean = false
): TransportMode {
  // Distance-based primary determination
  if (distance <= 2) {
    return 'walking';     // 0-2km: Walking
  }
  if (distance <= 500) {
    return 'car';         // 2-500km: Car/taxi
  }
  // Long distance: Flight
  return 'flight';        // >500km: Flight
}
```

### Travel Time Calculation
```typescript
function calculateTravelTime(distance: number, mode: TransportMode): number {
  if (mode === 'flight') {
    // Realistic flight time calculation with airport procedures
    if (distance > 8000) {
      return 660; // 11 hours (8h flight + 3h airport procedures)
    } else if (distance > 3000) {
      return 480; // 8 hours (6h flight + 2h airport procedures)
    } else if (distance > 1000) {
      return 300; // 5 hours (3h flight + 2h airport procedures)
    } else {
      return 120; // 2 hours (1h flight + 1h airport procedures)
    }
  }
  
  // Ground transportation speeds (km/h)
  const speeds = {
    walking: 5,
    car: 80,
    public_transport: 40,
    bicycle: 15,
    taxi: 60
  };
  
  const baseTime = (distance / speeds[mode]) * 60; // Convert to minutes
  
  // Add overhead time for preparation and waiting
  const overhead = {
    walking: 5,
    car: 20,
    public_transport: 15,
    bicycle: 10,
    taxi: 15
  };
  
  return Math.round(baseTime + overhead[mode]);
}
```

### TSP Route Optimization: Greedy Nearest Neighbor
```typescript
function optimizeRouteOrder(places: Place[]): Place[] {
  if (places.length <= 2) return places;
  
  // 1. Separate special places
  const departure = places.find(p => p.place_type === 'departure');
  const destination = places.find(p => p.place_type === 'destination');
  const visitPlaces = places.filter(p => 
    p.place_type !== 'departure' && p.place_type !== 'destination'
  );
  
  if (visitPlaces.length === 0) {
    return [departure, destination].filter(Boolean);
  }
  
  // 2. Apply greedy nearest neighbor algorithm
  const route: Place[] = [];
  const remaining = [...visitPlaces];
  let current = departure || visitPlaces[0];
  
  // Start with departure point
  if (departure) {
    route.push(departure);
  }
  
  // Greedy selection of nearest unvisited places
  while (remaining.length > 0) {
    let nearestPlace = remaining[0];
    let minDistance = calculateDistance(
      [current.latitude, current.longitude],
      [nearestPlace.latitude, nearestPlace.longitude]
    );
    
    // Find nearest remaining place
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(
        [current.latitude, current.longitude],
        [remaining[i].latitude, remaining[i].longitude]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPlace = remaining[i];
      }
    }
    
    // Add to route and remove from remaining
    route.push(nearestPlace);
    remaining.splice(remaining.indexOf(nearestPlace), 1);
    current = nearestPlace;
  }
  
  // End with destination
  if (destination && destination !== departure) {
    route.push(destination);
  }
  
  return route;
}
```

### Airport Detection and Insertion
```typescript
async function insertAirportsIfNeeded(places: Place[]): Promise<Place[]> {
  const result: Place[] = [];
  
  for (let i = 0; i < places.length; i++) {
    const currentPlace = places[i];
    result.push(currentPlace);
    
    if (i < places.length - 1) {
      const nextPlace = places[i + 1];
      const distance = calculateDistance(
        [currentPlace.latitude, currentPlace.longitude],
        [nextPlace.latitude, nextPlace.longitude]
      );
      
      const transportMode = determineTransportMode(distance);
      
      if (transportMode === 'flight') {
        // Insert departure airport if current place is not an airport
        if (!currentPlace.is_airport) {
          const departureAirport = await findNearestAirport(
            currentPlace.latitude, 
            currentPlace.longitude
          );
          if (departureAirport) {
            result.push(createAirportPlace(departureAirport, 'departure_airport'));
          }
        }
        
        // Insert arrival airport if next place is not an airport
        if (!nextPlace.is_airport) {
          const arrivalAirport = await findNearestAirport(
            nextPlace.latitude, 
            nextPlace.longitude
          );
          if (arrivalAirport && arrivalAirport.id !== departureAirport?.id) {
            result.push(createAirportPlace(arrivalAirport, 'arrival_airport'));
          }
        }
      }
    }
  }
  
  return result;
}
```

## Fairness Algorithms

### Preference Normalization Algorithm
**Function**: `normalize-preferences` Edge Function

```typescript
function normalizePreferences(
  places: Place[], 
  members: Member[], 
  settings: OptimizationSettings
): Place[] {
  // 1. Group places by user
  const userGroups = new Map<string, Place[]>();
  places.forEach(place => {
    if (place.place_type === 'visit') {
      if (!userGroups.has(place.user_id)) {
        userGroups.set(place.user_id, []);
      }
      userGroups.get(place.user_id)!.push(place);
    }
  });
  
  // 2. Calculate per-user normalization
  userGroups.forEach((userPlaces, userId) => {
    const userPlaceCount = userPlaces.length;
    
    userPlaces.forEach(place => {
      // Step 1: Base preference normalization (1-5 scale to 0-1)
      const basePreference = place.wish_level / 5;
      
      // Step 2: Fairness factor (penalty for having many places)
      const fairnessFactor = Math.sqrt(1 / userPlaceCount);
      
      // Step 3: Settings-based multiplier
      let settingsMultiplier = 1.0;
      
      if (settings.fairness_weight > 0.7) {
        // High fairness setting: prioritize fairness
        settingsMultiplier = fairnessFactor;
      } else if (settings.efficiency_weight > 0.7) {
        // High efficiency setting: prioritize preferences
        settingsMultiplier = basePreference;
      } else {
        // Balanced setting: average of both
        settingsMultiplier = (basePreference + fairnessFactor) / 2;
      }
      
      // Step 4: Calculate final normalized value
      const normalizedValue = basePreference * fairnessFactor * settingsMultiplier;
      
      // Step 5: Clamp to valid range [0.1, 1.0]
      place.normalized_wish_level = Math.max(0.1, Math.min(1.0, normalizedValue));
    });
  });
  
  return places;
}
```

### Member Equity Calculation
```typescript
function calculateFairnessScore(places: Place[]): number {
  const visitPlaces = places.filter(p => p.place_type === 'visit');
  
  if (visitPlaces.length === 0) return 1.0;
  
  // Count places per user
  const userCounts = new Map<string, number>();
  visitPlaces.forEach(place => {
    userCounts.set(place.user_id, (userCounts.get(place.user_id) || 0) + 1);
  });
  
  // Calculate variance in place distribution
  const counts = Array.from(userCounts.values());
  const avgCount = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  
  const variance = counts.reduce((sum, count) => 
    sum + Math.pow(count - avgCount, 2), 0
  ) / counts.length;
  
  // Fairness score: 1.0 = perfectly fair, 0.0 = completely unfair
  const fairnessScore = avgCount > 0 ? Math.max(0, 1 - variance / avgCount) : 1.0;
  
  return fairnessScore;
}
```

### Quota Management
```typescript
function enforceQuotaLimits(places: Place[], quotaSettings: QuotaSettings): Place[] {
  const userGroups = groupPlacesByUser(places.filter(p => p.place_type === 'visit'));
  const result: Place[] = places.filter(p => p.place_type !== 'visit');
  
  // Apply per-user quota limits
  userGroups.forEach((userPlaces, userId) => {
    const userLimit = quotaSettings.maxPlacesPerUser || 10;
    const limitedPlaces = userPlaces.slice(0, userLimit);
    
    limitedPlaces.forEach((place, index) => {
      place.quota_order = index + 1;
      place.within_quota = true;
    });
    
    result.push(...limitedPlaces);
  });
  
  return result;
}
```

## Supporting Algorithms

### Duplicate Place Detection and Merging
```typescript
function removeDuplicatePlaces(places: Place[]): Place[] {
  const DUPLICATE_THRESHOLD_KM = 0.1; // 100 meters
  const placeGroups = new Map<string, Place[]>();
  
  // 1. Group potentially duplicate places
  places.forEach(place => {
    const locationKey = createLocationKey(place);
    
    if (!placeGroups.has(locationKey)) {
      placeGroups.set(locationKey, []);
    }
    placeGroups.get(locationKey)!.push(place);
  });
  
  // 2. Merge duplicate groups
  const mergedPlaces: Place[] = [];
  
  placeGroups.forEach(groupPlaces => {
    if (groupPlaces.length === 1) {
      mergedPlaces.push(groupPlaces[0]);
    } else {
      const mergedPlace = mergeDuplicatePlaces(groupPlaces);
      mergedPlaces.push(mergedPlace);
    }
  });
  
  return mergedPlaces;
}

function createLocationKey(place: Place): string {
  // Create location key with reduced precision for grouping
  const lat = place.latitude.toFixed(4);  // ~11m precision
  const lng = place.longitude.toFixed(4); // ~11m precision
  const name = place.place_name.toLowerCase().trim();
  
  return `${lat}-${lng}-${name}`;
}

function mergeDuplicatePlaces(places: Place[]): Place {
  // 1. Select primary place (longest stay duration)
  const primaryPlace = places.reduce((max, place) => 
    (place.stay_duration_minutes || 120) > (max.stay_duration_minutes || 120) ? place : max
  );
  
  // 2. Merge contributors and color information
  const contributors = places.map(p => ({
    user_id: p.user_id,
    user_name: p.user_name,
    display_color_hex: p.display_color_hex || '#0077BE',
    wish_level: p.wish_level || 3
  }));
  
  // 3. Determine merged place properties
  const mergedPlace: Place = {
    ...primaryPlace,
    member_contribution: contributors,
    color_type: contributors.length === 1 ? 'single' : 
               contributors.length <= 4 ? 'gradient' : 'popular',
    merged_from_count: places.length,
    wish_level: Math.round(
      contributors.reduce((sum, c) => sum + c.wish_level, 0) / contributors.length
    )
  };
  
  return mergedPlace;
}
```

### Daily Schedule Creation
```typescript
function createDailySchedule(
  places: Place[], 
  tripStartDate: string | null = null, 
  availableDays: number | null = null
): DailySchedule[] {
  const schedules: DailySchedule[] = [];
  const maxDailyHours = 10; // 10 hours of activities per day
  const maxDailyMinutes = maxDailyHours * 60;
  
  let currentDay = 1;
  let currentPlaces: Place[] = [];
  let currentTime = 0; // Minutes used in current day
  let timeCounter = 9 * 60; // Start at 9:00 AM
  
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    
    // Calculate time required for this place
    const travelTime = place.travel_time_from_previous || 0;
    const stayTime = place.stay_duration_minutes || 120;
    const totalPlaceTime = travelTime + stayTime;
    
    // Check if we exceed available days
    if (availableDays !== null && currentDay > availableDays) {
      break;
    }
    
    // Flight creates a new day automatically
    if (place.transport_mode === 'flight' && currentPlaces.length > 0) {
      schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
      currentDay++;
      currentPlaces = [];
      currentTime = 0;
      timeCounter = 9 * 60; // Reset to 9:00 AM
    }
    // Time limit exceeded - start new day
    else if (currentTime + totalPlaceTime > maxDailyMinutes && currentPlaces.length > 0) {
      schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
      currentDay++;
      currentPlaces = [];
      currentTime = 0;
      timeCounter = 9 * 60; // Reset to 9:00 AM
    }
    
    // Add travel time
    if (travelTime > 0) {
      timeCounter += travelTime;
    }
    
    // Set arrival time (constrain to reasonable hours)
    const arrivalTime = Math.min(timeCounter, 20 * 60); // Latest 20:00
    place.arrival_time = formatTime(arrivalTime);
    
    // Calculate stay duration (adjust if too late)
    const adjustedStayTime = Math.min(stayTime, 20 * 60 - arrivalTime);
    place.stay_duration_actual = adjustedStayTime;
    
    // Set departure time
    const departureTime = arrivalTime + adjustedStayTime;
    place.departure_time = formatTime(departureTime);
    
    // Update counters
    timeCounter = departureTime;
    currentTime += totalPlaceTime;
    
    // Add to current day
    currentPlaces.push(place);
  }
  
  // Add final day if there are remaining places
  if (currentPlaces.length > 0) {
    schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
  }
  
  return schedules;
}

function createDaySchedule(
  dayNumber: number, 
  places: Place[], 
  tripStartDate: string | null
): DailySchedule {
  // Calculate schedule date
  let scheduleDate: string | null = null;
  if (tripStartDate) {
    const startDate = new Date(tripStartDate);
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + (dayNumber - 1));
    scheduleDate = currentDate.toISOString().split('T')[0];
  }
  
  return {
    day: dayNumber,
    date: scheduleDate,
    scheduled_places: places.map(place => ({
      ...place,
      day_number: dayNumber,
      scheduled_date: scheduleDate
    })),
    total_activities_minutes: places.reduce((sum, p) => 
      sum + (p.stay_duration_actual || p.stay_duration_minutes || 120), 0
    ),
    total_travel_minutes: places.reduce((sum, p) => 
      sum + (p.travel_time_from_previous || 0), 0
    )
  };
}
```

## Mathematical Formulations

### 1. Haversine Distance Formula
The great-circle distance between two points on Earth:

```
d = 2R × arcsin(√(sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)))
```

Where:
- `R = 6371 km` (Earth's radius)
- `φ₁, φ₂` = latitude of point 1 and point 2 (in radians)
- `Δφ = φ₂ - φ₁` (difference in latitudes)
- `Δλ = λ₂ - λ₁` (difference in longitudes)

### 2. Preference Normalization Formula
For user `i` with `nᵢ` places and wish level `wⱼ` for place `j`:

```
normalized_wishⱼ = (wⱼ / 5) × √(1 / nᵢ) × multiplier
```

Where:
- `wⱼ / 5`: Base preference (0-1 scale)
- `√(1 / nᵢ)`: Fairness factor (penalty for many places)
- `multiplier`: Settings-based adjustment

### 3. Fairness Score Calculation
For `n` users with place counts `c₁, c₂, ..., cₙ`:

```
μ = (Σcᵢ) / n                    (mean count)
σ² = Σ(cᵢ - μ)² / n              (variance)
fairness = max(0, 1 - σ²/μ)      (fairness score)
```

### 4. Total Optimization Score
Weighted combination of multiple factors:

```
score = w₁ × efficiency + w₂ × satisfaction + w₃ × fairness + w₄ × feasibility
```

Default weights: `w₁ = 0.3, w₂ = 0.2, w₃ = 0.2, w₄ = 0.3`

### 5. Time Constraint Calculation
Maximum places based on available time:

```
max_places = ⌊(days × 600) / (avg_stay + avg_travel)⌋
```

Where `600` = 10 hours × 60 minutes per day

## Algorithm Parameters

### Core Configuration
```typescript
const ALGORITHM_CONFIG = {
  // Time constraints
  MAX_DAILY_HOURS: 10,              // Maximum activities per day
  START_TIME: 9 * 60,               // 9:00 AM start
  END_TIME: 20 * 60,                // 8:00 PM end
  
  // Distance thresholds
  WALKING_MAX_KM: 2,                // Maximum walking distance
  CAR_MAX_KM: 500,                  // Maximum driving distance
  FLIGHT_MIN_KM: 500,               // Minimum distance for flight
  
  // Optimization limits
  MAX_PLACES_TOTAL: 50,             // Maximum total places
  MAX_PLACES_PER_USER: 15,          // Maximum per user
  MAX_OPTIMIZATION_TIME: 60000,     // 60 second timeout
  
  // Fairness parameters
  FAIRNESS_WEIGHT: 0.6,             // 60% fairness priority
  EFFICIENCY_WEIGHT: 0.4,           // 40% efficiency priority
  
  // Duplicate detection
  DUPLICATE_THRESHOLD_KM: 0.1,      // 100m radius for duplicates
  LOCATION_PRECISION: 4,            // Decimal places for lat/lng
  
  // Airport search
  AIRPORT_SEARCH_RADIUS_KM: 100,    // Airport search radius
  MIN_AIRPORT_DISTANCE_KM: 50       // Minimum distance between airports
};
```

### Transportation Speed Constants
```typescript
const TRANSPORT_SPEEDS = {
  walking: 5,                       // km/h
  car: 80,                          // km/h
  public_transport: 40,             // km/h
  bicycle: 15,                      // km/h
  taxi: 60,                         // km/h
  flight: 800                       // km/h (handled separately)
};

const TRANSPORT_OVERHEAD = {
  walking: 5,                       // 5 min preparation
  car: 20,                          // 20 min for parking/preparation
  public_transport: 15,             // 15 min waiting time
  bicycle: 10,                      // 10 min preparation
  taxi: 15,                         // 15 min waiting + preparation
  flight: 120                       // 2+ hours for airport procedures
};
```

### Optimization Weights
```typescript
const OPTIMIZATION_WEIGHTS = {
  distance_efficiency: 0.3,         // Route efficiency weight
  preference_satisfaction: 0.2,     // User satisfaction weight
  fairness_score: 0.2,             // Member equity weight
  time_feasibility: 0.3            // Schedule practicality weight
};
```

## Performance Analysis

### Time Complexity
- **Input Processing**: O(n) where n = number of places
- **Duplicate Detection**: O(n²) for pairwise comparison
- **Preference Normalization**: O(n) 
- **Fair Selection**: O(n × m) where m = number of members
- **Route Optimization (TSP)**: O(n²) for greedy nearest neighbor
- **Airport Insertion**: O(n × k) where k = API calls
- **Schedule Generation**: O(n)

**Overall Complexity**: O(n²) dominated by route optimization

### Space Complexity
- **Place Storage**: O(n) for place objects
- **Distance Matrix**: O(n²) for route calculations (generated on-demand)
- **Grouping Structures**: O(n) for user groupings
- **Result Storage**: O(n) for optimized results

**Overall Space**: O(n²) for worst-case distance matrix

### Performance Optimizations
1. **Lazy Distance Calculation**: Compute distances only when needed
2. **Early Termination**: Stop optimization if time limit reached
3. **Caching**: Cache airport searches and distance calculations
4. **Batch Processing**: Group API calls for efficiency
5. **Incremental Updates**: Update only changed portions

### Scalability Limits
```typescript
const PERFORMANCE_LIMITS = {
  MAX_PLACES_FOR_OPTIMAL: 20,       // Optimal performance up to 20 places
  MAX_PLACES_ACCEPTABLE: 50,        // Acceptable performance up to 50 places
  MAX_PROCESSING_TIME_MS: 60000,    // 60 second timeout
  MEMORY_LIMIT_MB: 128,             // Edge Function memory limit
  
  // API rate limits
  GOOGLE_PLACES_QPM: 100,           // Queries per minute
  AIRPORT_SEARCH_QPM: 50            // Airport API queries per minute
};
```

## Implementation Details

### Error Handling
```typescript
class OptimizationError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public details?: any
  ) {
    super(message);
    this.name = 'OptimizationError';
  }
}

// Error types
const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  INSUFFICIENT_PLACES: 'INSUFFICIENT_PLACES',
  TIME_CONSTRAINT_VIOLATION: 'TIME_CONSTRAINT_VIOLATION',
  ROUTE_OPTIMIZATION_FAILED: 'ROUTE_OPTIMIZATION_FAILED',
  AIRPORT_SEARCH_FAILED: 'AIRPORT_SEARCH_FAILED',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED'
};
```

### Logging and Monitoring
```typescript
function logOptimizationMetrics(result: OptimizationResult): void {
  const metrics = {
    algorithm_version: '2.1.0',
    execution_time_ms: result.execution_time_ms,
    places_count: result.optimization.places.length,
    fairness_score: result.optimization.optimization_score.fairness,
    efficiency_score: result.optimization.optimization_score.efficiency,
    total_distance_km: result.optimization.metadata.total_distance_km
  };
  
  console.log('Optimization completed:', metrics);
  
  // Send to monitoring service in production
  if (Deno.env.get('ENVIRONMENT') === 'production') {
    sendToMonitoring('optimization_completed', metrics);
  }
}
```

### Testing Framework
```typescript
// Unit tests for core algorithms
describe('Optimization Algorithms', () => {
  test('Haversine distance calculation', () => {
    const tokyo = [35.6762, 139.6503];
    const osaka = [34.6937, 135.5023];
    const distance = calculateDistance(tokyo, osaka);
    expect(distance).toBeCloseTo(400, 10); // ~400km
  });
  
  test('Fair place selection', () => {
    const places = createTestPlaces();
    const selected = filterPlacesByFairness(places, 10, 5);
    expect(selected.length).toBeLessThanOrEqual(10);
    verifyFairDistribution(selected);
  });
  
  test('Route optimization', () => {
    const places = createTestRoute();
    const optimized = optimizeRouteOrder(places);
    expect(optimized.length).toBe(places.length);
    verifyRouteEfficiency(optimized);
  });
});
```

This comprehensive optimization system combines multiple algorithms to solve the complex multi-objective optimization problem of group travel planning, balancing fairness, efficiency, and practical constraints while maintaining high performance and reliability.