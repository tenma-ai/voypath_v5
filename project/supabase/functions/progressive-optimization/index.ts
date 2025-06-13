import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProgressiveOptimizationRequest {
  tripId: string;
  userId: string;
  enableProgressStream?: boolean;
  settings?: {
    fairness_weight?: number;
    efficiency_weight?: number;
    preferred_transport?: string;
    include_meals?: boolean;
  };
}

interface OptimizationProgress {
  stage: 'collecting' | 'normalizing' | 'selecting' | 'routing' | 'complete' | 'error';
  progress: number;
  message: string;
  executionTimeMs?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      tripId, 
      userId, 
      enableProgressStream = true,
      settings = {}
    }: ProgressiveOptimizationRequest = await req.json();

    if (!tripId || !userId) {
      throw new Error('tripId and userId are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Execute progressive optimization
    const result = await optimizeRouteProgressive({
      tripId,
      userId,
      settings,
      progressCallback: enableProgressStream ? 
        (stage: string, percentage: number, message: string) => 
          updateOptimizationProgress(tripId, userId, stage, percentage, message, supabase) :
        undefined,
      supabase
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Progressive optimization error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// Progressive optimization implementation
async function optimizeRouteProgressive(request: {
  tripId: string;
  userId: string;
  settings: any;
  progressCallback?: (stage: string, percentage: number, message: string) => Promise<void>;
  supabase: any;
}) {
  const { tripId, userId, settings, progressCallback, supabase } = request;
  const startTime = Date.now();

  try {
    // Stage 1: Data collection (10-30%)
    if (progressCallback) await progressCallback('collecting', 10, 'Collecting member places...');
    
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId);

    if (placesError) throw new Error(`Failed to fetch places: ${placesError.message}`);
    if (!places || places.length === 0) {
      throw new Error('No places found for this trip');
    }

    if (progressCallback) await progressCallback('collecting', 30, `Found ${places.length} places to optimize`);

    // Stage 2: Normalization (30-50%)
    if (progressCallback) await progressCallback('normalizing', 30, 'Normalizing member preferences...');
    
    const normalizedPlaces = await normalizeAllUsers(places, supabase);
    
    if (progressCallback) await progressCallback('normalizing', 50, 'Preference normalization complete');

    // Stage 3: Selection (50-70%)
    if (progressCallback) await progressCallback('selecting', 50, 'Selecting optimal place combination...');
    
    const selectedPlaces = await selectOptimalCombination(
      normalizedPlaces, 
      settings.fairness_weight || 0.6,
      supabase
    );
    
    if (progressCallback) await progressCallback('selecting', 70, `Selected ${selectedPlaces.length} optimal places`);

    // Stage 4: Route optimization (70-90%)
    if (progressCallback) await progressCallback('routing', 70, 'Optimizing travel route...');
    
    const optimizedRoute = await optimizeGreedyRoute(selectedPlaces, settings);
    
    if (progressCallback) await progressCallback('routing', 90, 'Route optimization complete');

    // Stage 5: Save and broadcast (90-100%)
    if (progressCallback) await progressCallback('complete', 95, 'Saving optimization results...');
    
    const finalResult = await saveAndBroadcast(optimizedRoute, tripId, userId, supabase);
    
    const executionTime = Date.now() - startTime;
    if (progressCallback) await progressCallback('complete', 100, 'Optimization completed successfully!');

    return {
      success: true,
      optimization_result: finalResult,
      execution_time_ms: executionTime,
      places_considered: places.length,
      places_selected: selectedPlaces.length
    };

  } catch (error) {
    console.error('Optimization error:', error);
    
    if (progressCallback) {
      await progressCallback('error', 0, `Error: ${error.message}`);
    }
    
    // Save error to database
    await updateOptimizationProgress(
      tripId, 
      userId, 
      'error', 
      0, 
      `Optimization failed: ${error.message}`, 
      supabase
    );
    
    throw error;
  }
}

// Helper functions
async function normalizeAllUsers(places: any[], supabase: any) {
  // Group places by user
  const userPlaces = places.reduce((groups, place) => {
    if (!groups[place.user_id]) groups[place.user_id] = [];
    groups[place.user_id].push(place);
    return groups;
  }, {});

  const normalizedUsers = [];

  for (const [userId, userPlaceList] of Object.entries(userPlaces)) {
    const avgWishLevel = (userPlaceList as any[]).reduce((sum, p) => sum + p.wish_level, 0) / (userPlaceList as any[]).length;
    
    const normalizedPlaces = (userPlaceList as any[]).map(place => ({
      ...place,
      normalized_wish_level: place.wish_level / avgWishLevel,
      user_avg_wish_level: avgWishLevel
    }));

    // Calculate user weight (basic implementation)
    const userWeight = calculateUserWeight(userPlaceList as any[], avgWishLevel);

    normalizedUsers.push({
      userId,
      totalPlaces: (userPlaceList as any[]).length,
      avgWishLevel,
      normalizedPlaces,
      userWeight
    });
  }

  return normalizedUsers;
}

function calculateUserWeight(userPlaces: any[], avgWishLevel: number): number {
  const placeCount = userPlaces.length;
  
  // Basic weight calculation with edge case handling
  const wishLevels = userPlaces.map(p => p.wish_level);
  const uniqueWishLevels = new Set(wishLevels);
  const isAllSameWish = uniqueWishLevels.size === 1;
  const isAllMaxWish = avgWishLevel >= 4.8;
  
  let weight = 1.0;
  
  // Apply penalties for edge cases
  if (isAllSameWish) weight *= 0.7;
  if (isAllMaxWish) weight *= 0.8;
  if (placeCount > 10) weight *= 0.6; // Too many places penalty
  
  return Math.max(0.1, weight); // Minimum weight guarantee
}

async function selectOptimalCombination(normalizedUsers: any[], fairnessWeight: number, supabase: any) {
  const allPlaces = normalizedUsers.flatMap(user => user.normalizedPlaces);
  const maxPlaces = Math.min(15, Math.max(5, Math.floor(allPlaces.length * 0.3))); // 30% of total, 5-15 range
  
  // Sort by normalized wish level weighted by user weight
  const weightedPlaces = allPlaces.map(place => {
    const user = normalizedUsers.find(u => u.userId === place.user_id);
    const weightedScore = place.normalized_wish_level * (user?.userWeight || 1.0);
    return { ...place, weighted_score: weightedScore };
  });
  
  // Select top places ensuring fairness
  const selectedPlaces = [];
  const userCounts: Record<string, number> = {};
  
  // Initialize user counts
  normalizedUsers.forEach(user => {
    userCounts[user.userId] = 0;
  });
  
  // Sort by weighted score
  weightedPlaces.sort((a, b) => b.weighted_score - a.weighted_score);
  
  for (const place of weightedPlaces) {
    if (selectedPlaces.length >= maxPlaces) break;
    
    const currentUserCount = userCounts[place.user_id] || 0;
    const maxPerUser = Math.ceil(maxPlaces / normalizedUsers.length);
    
    // Apply fairness constraint
    if (currentUserCount < maxPerUser || selectedPlaces.length < normalizedUsers.length) {
      selectedPlaces.push(place);
      userCounts[place.user_id] = currentUserCount + 1;
    }
  }
  
  return selectedPlaces;
}

async function optimizeGreedyRoute(places: any[], settings: any) {
  // Simple greedy optimization - start from first place, always go to nearest unvisited
  if (places.length === 0) return [];
  
  const route = [places[0]];
  const unvisited = places.slice(1);
  
  while (unvisited.length > 0) {
    const current = route[route.length - 1];
    let nearest = unvisited[0];
    let minDistance = calculateDistance(current, nearest);
    
    for (const place of unvisited) {
      const distance = calculateDistance(current, place);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = place;
      }
    }
    
    route.push(nearest);
    unvisited.splice(unvisited.indexOf(nearest), 1);
  }
  
  return route.map((place, index) => ({
    ...place,
    order: index + 1,
    estimated_arrival_time: index === 0 ? '09:00' : undefined,
    estimated_departure_time: undefined
  }));
}

function calculateDistance(place1: any, place2: any): number {
  if (!place1.latitude || !place1.longitude || !place2.latitude || !place2.longitude) {
    return Math.random() * 10; // Random fallback
  }
  
  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in km
  const dLat = (place2.latitude - place1.latitude) * Math.PI / 180;
  const dLon = (place2.longitude - place1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(place1.latitude * Math.PI / 180) * Math.cos(place2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function saveAndBroadcast(optimizedRoute: any[], tripId: string, userId: string, supabase: any) {
  // Update places with optimization results
  for (const place of optimizedRoute) {
    await supabase
      .from('places')
      .update({
        is_selected_for_optimization: true,
        optimization_metadata: {
          order: place.order,
          estimated_arrival_time: place.estimated_arrival_time,
          optimized_at: new Date().toISOString()
        }
      })
      .eq('id', place.id);
  }
  
  // Save optimization result summary
  const optimizationSummary = {
    trip_id: tripId,
    user_id: userId,
    total_places: optimizedRoute.length,
    optimization_data: {
      route: optimizedRoute,
      algorithm_version: '1.0.0',
      optimized_at: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  };
  
  return optimizationSummary;
}

async function updateOptimizationProgress(
  tripId: string, 
  userId: string, 
  stage: string, 
  percentage: number, 
  message: string, 
  supabase: any
) {
  try {
    await supabase
      .from('optimization_progress')
      .upsert({
        trip_id: tripId,
        user_id: userId,
        stage,
        progress_percentage: percentage,
        stage_message: message,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'trip_id,user_id'
      });
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

function getCurrentStage(percentage: number): string {
  if (percentage <= 20) return 'collecting';
  if (percentage <= 50) return 'normalizing';
  if (percentage <= 70) return 'selecting';
  if (percentage <= 90) return 'routing';
  return 'complete';
}