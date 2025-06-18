-- This SQL script fixes the optimize-route edge function issue
-- The main issue is that the function references 'supabase' instead of 'supabaseClient'

-- Note: This is for manual execution in Supabase SQL Editor
-- The actual fix needs to be deployed through Supabase Dashboard

/*
Key fixes needed in optimize-route/index.ts:

1. Line 210: Pass supabaseClient parameter
   const optimizedRoute = await optimizeRoute(supabaseClient, trip, places, members, requestData.settings);

2. Line 359: Add supabaseClient parameter to function
   async function optimizeRoute(
     supabaseClient: any,
     trip: TripData,
     places: Place[],
     members: any[],
     settings?: OptimizationSettings
   ): Promise<OptimizedRoute> {

3. Line 408: Use supabaseClient instead of supabase
   const { data: allPlaces, error: allPlacesError } = await supabaseClient
     .from('places')
     .select('*')
     .eq('trip_id', trip.id)
     .order('created_at');

4. Line 389: Remove user reference
   _dev_user_id: '2600c340-0ecd-4166-860f-ac4798888344'
*/

-- Check if the optimization is working by querying recent results
SELECT 
  id,
  trip_id,
  created_at,
  algorithm_version,
  is_active,
  execution_time_ms
FROM optimization_results
WHERE trip_id = '76f2f51d-48f3-40d2-b795-cf533a561c2f'
ORDER BY created_at DESC
LIMIT 5;