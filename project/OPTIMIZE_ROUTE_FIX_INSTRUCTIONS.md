# Fix Instructions for optimize-route Edge Function

## Issue
The optimize-route edge function has a bug where it references an undefined `supabase` variable instead of the properly initialized `supabaseClient`.

## Fix Required
In the `optimize-route/index.ts` file, make these changes:

### 1. Line 210 - Pass supabaseClient to optimizeRoute function
```typescript
// Change from:
const optimizedRoute = await optimizeRoute(trip, places, members, requestData.settings);

// To:
const optimizedRoute = await optimizeRoute(supabaseClient, trip, places, members, requestData.settings);
```

### 2. Line 359 - Add supabaseClient parameter to function signature
```typescript
// Change from:
async function optimizeRoute(
  trip: TripData,
  places: Place[],
  members: any[],
  settings?: OptimizationSettings
): Promise<OptimizedRoute> {

// To:
async function optimizeRoute(
  supabaseClient: any,
  trip: TripData,
  places: Place[],
  members: any[],
  settings?: OptimizationSettings
): Promise<OptimizedRoute> {
```

### 3. Line 408 - Use supabaseClient instead of supabase
```typescript
// Change from:
const { data: allPlaces, error: allPlacesError } = await supabase

// To:
const { data: allPlaces, error: allPlacesError } = await supabaseClient
```

### 4. Line 389 - Remove user reference
```typescript
// Change from:
_dev_user_id: user.id === '2600c340-0ecd-4166-860f-ac4798888344' ? user.id : undefined

// To:
_dev_user_id: '2600c340-0ecd-4166-860f-ac4798888344'
```

## Deployment Steps
1. Make the above changes to the `optimize-route/index.ts` file
2. Deploy using Supabase Dashboard or CLI:
   ```bash
   npx supabase functions deploy optimize-route
   ```

## Testing
After deployment, test the optimization flow:
1. Go to http://127.0.0.1:5175
2. Navigate to trip 76f2f51d-48f3-40d2-b795-cf533a561c2f
3. Click "Optimize Route"
4. The optimization should now proceed past stage 6 without the "supabase is not defined" error

## Other Issues Found
1. **Departure/Destination in MyPlaces**: Already fixed in code - filters out place_type 'departure' and 'destination'
2. **Geocoding Error**: The destination field has value "same as departure location" which causes geocoding to fail
3. **Google Maps Warning**: Using deprecated Marker API - should upgrade to AdvancedMarkerElement