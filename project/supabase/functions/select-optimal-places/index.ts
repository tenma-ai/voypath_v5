import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SelectOptimalPlacesRequest {
  trip_id?: string;
  max_places?: number;
  fairness_weight?: number;
  type?: 'keep_alive' | 'selection';
}

interface Place {
  id: string;
  name: string;
  category: string;
  latitude?: number;
  longitude?: number;
  wish_level: number;
  stay_duration_minutes: number;
  user_id: string;
  trip_id: string;
  source?: string;
  created_at: string;
}

interface NormalizedPlaceData {
  placeId: string;
  placeName: string;
  originalWishLevel: number;
  normalizedWishLevel: number;
  fairnessScore: number;
  categoryWeight: number;
}

interface UserNormalizationData {
  userId: string;
  userName: string;
  totalPlaces: number;
  avgWishLevel: number;
  normalizedPlaces: NormalizedPlaceData[];
  userWeight: number;
  fairnessContribution: number;
}

interface SelectedPlaceData {
  place: Place;
  selectionRound: number;
  selectionScore: number;
  userContributions: Record<string, number>;
  combinationFairnessScore: number;
}

interface PlaceSelectionResult {
  tripId: string;
  selectedPlaces: SelectedPlaceData[];
  totalPlacesConsidered: number;
  selectionRounds: number;
  finalFairnessScore: number;
  userFairnessScores: Record<string, number>;
  executionTimeMs: number;
  metadata: {
    algorithmVersion: string;
    maxPlaces: number;
    fairnessWeight: number;
    createdAt: string;
    selectionStrategy: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  }

  try {
    const requestData: SelectOptimalPlacesRequest = await req.json();
    
    // Handle keep-alive ping first (no auth required)
    if (requestData.type === 'keep_alive') {
      return new Response(
        JSON.stringify({ message: 'pong', timestamp: new Date().toISOString() }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // For all other operations, require authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }
    
    if (!requestData.trip_id) {
      throw new Error('trip_id is required');
    }

    // Validate user has access to this trip
    await validateTripAccess(supabaseClient, user.id, requestData.trip_id);

    const maxPlaces = requestData.max_places || 20;
    const fairnessWeight = requestData.fairness_weight || 0.6;

    // Check for cached result
    const cachedResult = await getCachedSelection(supabaseClient, requestData.trip_id, maxPlaces, fairnessWeight);
    if (cachedResult) {
      return new Response(
        JSON.stringify({
          success: true,
          result: cachedResult,
          cached: true,
          message: 'Using cached place selection result'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Execute place selection
    const startTime = Date.now();
    const selectionResult = await selectOptimalPlaces(
      supabaseClient, 
      requestData.trip_id, 
      maxPlaces, 
      fairnessWeight
    );
    const executionTime = Date.now() - startTime;

    // Cache the result
    await setCachedSelection(supabaseClient, requestData.trip_id, selectionResult);

    // Record usage event
    await recordSelectionEvent(supabaseClient, user.id, requestData.trip_id, {
      execution_time_ms: executionTime,
      places_selected: selectionResult.selectedPlaces.length,
      places_considered: selectionResult.totalPlacesConsidered,
      fairness_score: selectionResult.finalFairnessScore
    });

    return new Response(
      JSON.stringify({
        success: true,
        result: selectionResult,
        cached: false,
        message: 'Places selected successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Place Selection Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function validateTripAccess(supabase: any, userId: string, tripId: string) {
  const { data: membership, error } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    throw new Error('You are not a member of this trip');
  }
}

async function selectOptimalPlaces(
  supabase: any, 
  tripId: string, 
  maxPlaces: number, 
  fairnessWeight: number
): Promise<PlaceSelectionResult> {
  const startTime = Date.now();

  // Get normalized preferences (call normalization function first)
  const normalizationResult = await getNormalizedPreferences(supabase, tripId);
  
  if (!normalizationResult || normalizationResult.normalizedUsers.length === 0) {
    throw new Error('No normalized preferences available. Please ensure users have added places.');
  }

  // Get all places with user information
  const { data: allPlaces, error: placesError } = await supabase
    .from('places')
    .select(`
      *,
      user:users(id, name)
    `)
    .eq('trip_id', tripId)
    .neq('source', 'system') // Exclude system-generated places
    .order('wish_level', { ascending: false });

  if (placesError) {
    throw new Error(`Failed to fetch places: ${placesError.message}`);
  }

  if (!allPlaces || allPlaces.length === 0) {
    throw new Error('No places found for this trip');
  }

  // Create enhanced places with normalization data
  const enhancedPlaces = enhancePlacesWithNormalization(allPlaces, normalizationResult.normalizedUsers);
  
  // Perform iterative fair selection
  const selectedPlaces = performIterativeFairSelection(
    enhancedPlaces, 
    normalizationResult.normalizedUsers,
    maxPlaces, 
    fairnessWeight
  );

  // Calculate final fairness scores
  const userFairnessScores = calculateUserFairnessScores(
    selectedPlaces,
    normalizationResult.normalizedUsers
  );

  const finalFairnessScore = calculateGroupFairnessScore(Object.values(userFairnessScores));

  return {
    tripId,
    selectedPlaces,
    totalPlacesConsidered: allPlaces.length,
    selectionRounds: Math.min(maxPlaces, allPlaces.length),
    finalFairnessScore,
    userFairnessScores,
    executionTimeMs: Date.now() - startTime,
    metadata: {
      algorithmVersion: '2.0',
      maxPlaces,
      fairnessWeight,
      createdAt: new Date().toISOString(),
      selectionStrategy: 'iterative_fair_selection'
    }
  };
}

async function getNormalizedPreferences(supabase: any, tripId: string) {
  try {
    // Call the normalize-preferences function
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/normalize-preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        trip_id: tripId,
        force_refresh: false
      })
    });

    if (!response.ok) {
      console.warn('Normalization service unavailable, using fallback');
      return null;
    }

    const data = await response.json();
    return data.success ? data.result : null;
  } catch (error) {
    console.warn('Error calling normalization service:', error);
    return null;
  }
}

function enhancePlacesWithNormalization(
  places: Place[], 
  normalizedUsers: UserNormalizationData[]
): (Place & { normalizedWishLevel: number; userWeight: number })[] {
  return places.map(place => {
    const userNormalization = normalizedUsers.find(u => u.userId === place.user_id);
    
    if (!userNormalization) {
      // Fallback for places without normalization data
      return {
        ...place,
        normalizedWishLevel: place.wish_level / 5.0, // Simple normalization
        userWeight: 1.0
      };
    }

    const normalizedPlace = userNormalization.normalizedPlaces.find(np => np.placeId === place.id);
    
    return {
      ...place,
      normalizedWishLevel: normalizedPlace?.normalizedWishLevel || (place.wish_level / 5.0),
      userWeight: userNormalization.userWeight
    };
  });
}

function performIterativeFairSelection(
  places: (Place & { normalizedWishLevel: number; userWeight: number })[],
  normalizedUsers: UserNormalizationData[],
  maxPlaces: number,
  fairnessWeight: number
): SelectedPlaceData[] {
  const selectedPlaces: SelectedPlaceData[] = [];
  const remainingPlaces = [...places];
  const userSelectionCounts: Record<string, number> = {};

  // Initialize user selection counts
  normalizedUsers.forEach(user => {
    userSelectionCounts[user.userId] = 0;
  });

  let selectionRound = 1;

  while (selectedPlaces.length < maxPlaces && remainingPlaces.length > 0) {
    let bestPlace: (Place & { normalizedWishLevel: number; userWeight: number }) | null = null;
    let bestScore = -1;
    let bestCombinationFairnessScore = 0;

    // Evaluate each remaining place
    for (const place of remainingPlaces) {
      // Calculate selection score combining wish level and fairness
      const wishScore = place.normalizedWishLevel * place.userWeight;
      
      // Calculate fairness impact of selecting this place
      const currentUserCount = userSelectionCounts[place.user_id] || 0;
      const fairnessImpact = calculateFairnessImpact(
        place.user_id,
        currentUserCount,
        normalizedUsers,
        userSelectionCounts
      );

      // Combine wish score and fairness impact
      const combinedScore = (1 - fairnessWeight) * wishScore + fairnessWeight * fairnessImpact;
      
      // Calculate what the group fairness would be if we select this place
      const tempUserCounts = { ...userSelectionCounts };
      tempUserCounts[place.user_id] = (tempUserCounts[place.user_id] || 0) + 1;
      const tempFairnessScore = calculateTemporaryFairnessScore(tempUserCounts, normalizedUsers);

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestPlace = place;
        bestCombinationFairnessScore = tempFairnessScore;
      }
    }

    if (bestPlace) {
      // Calculate user contributions for this selection
      const userContributions: Record<string, number> = {};
      normalizedUsers.forEach(user => {
        const userPlaceCount = user.normalizedPlaces.length;
        const userSelectedCount = userSelectionCounts[user.userId] || 0;
        userContributions[user.userId] = userPlaceCount > 0 ? userSelectedCount / userPlaceCount : 0;
      });

      selectedPlaces.push({
        place: bestPlace,
        selectionRound,
        selectionScore: bestScore,
        userContributions,
        combinationFairnessScore: bestCombinationFairnessScore
      });

      // Update user selection count
      userSelectionCounts[bestPlace.user_id] = (userSelectionCounts[bestPlace.user_id] || 0) + 1;
      
      // Remove selected place from remaining places
      const index = remainingPlaces.findIndex(p => p.id === bestPlace!.id);
      if (index > -1) {
        remainingPlaces.splice(index, 1);
      }

      selectionRound++;
    } else {
      // No more places can be selected
      break;
    }
  }

  return selectedPlaces;
}

function calculateFairnessImpact(
  userId: string,
  currentUserCount: number,
  normalizedUsers: UserNormalizationData[],
  userSelectionCounts: Record<string, number>
): number {
  const user = normalizedUsers.find(u => u.userId === userId);
  if (!user) return 0;

  // Calculate current fairness level for this user
  const userTotalPlaces = user.totalPlaces;
  const currentFairness = userTotalPlaces > 0 ? currentUserCount / userTotalPlaces : 0;

  // Calculate average fairness across all users
  let totalFairness = 0;
  let validUsers = 0;
  
  normalizedUsers.forEach(u => {
    if (u.totalPlaces > 0) {
      const userCount = userSelectionCounts[u.userId] || 0;
      totalFairness += userCount / u.totalPlaces;
      validUsers++;
    }
  });

  const avgFairness = validUsers > 0 ? totalFairness / validUsers : 0;

  // Fairness impact is higher if this user is currently underrepresented
  const fairnessGap = Math.max(0, avgFairness - currentFairness);
  
  // Boost selection probability for underrepresented users
  return fairnessGap + 0.1; // Small base boost to avoid zero scores
}

function calculateTemporaryFairnessScore(
  userCounts: Record<string, number>,
  normalizedUsers: UserNormalizationData[]
): number {
  const fairnessRatios: number[] = [];

  normalizedUsers.forEach(user => {
    if (user.totalPlaces > 0) {
      const userCount = userCounts[user.userId] || 0;
      const ratio = userCount / user.totalPlaces;
      fairnessRatios.push(ratio);
    }
  });

  if (fairnessRatios.length === 0) return 1.0;
  if (fairnessRatios.length === 1) return 1.0;

  // Calculate coefficient of variation (lower is more fair)
  const mean = fairnessRatios.reduce((sum, ratio) => sum + ratio, 0) / fairnessRatios.length;
  const variance = fairnessRatios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / fairnessRatios.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

  // Convert to fairness score (1 is perfectly fair, 0 is completely unfair)
  return Math.exp(-coefficientOfVariation);
}

function calculateUserFairnessScores(
  selectedPlaces: SelectedPlaceData[],
  normalizedUsers: UserNormalizationData[]
): Record<string, number> {
  const userFairnessScores: Record<string, number> = {};

  normalizedUsers.forEach(user => {
    const userSelectedPlaces = selectedPlaces.filter(sp => sp.place.user_id === user.userId);
    const userSelectedCount = userSelectedPlaces.length;
    const userTotalPlaces = user.totalPlaces;

    if (userTotalPlaces === 0) {
      userFairnessScores[user.userId] = 0;
    } else {
      // Calculate sum of normalized wish levels for selected places
      const selectedWishSum = userSelectedPlaces.reduce((sum, sp) => {
        const normalizedPlace = user.normalizedPlaces.find(np => np.placeId === sp.place.id);
        return sum + (normalizedPlace?.normalizedWishLevel || 0);
      }, 0);

      // Calculate total sum of user's normalized wish levels
      const totalWishSum = user.normalizedPlaces.reduce((sum, np) => sum + np.normalizedWishLevel, 0);

      userFairnessScores[user.userId] = totalWishSum > 0 ? selectedWishSum / totalWishSum : 0;
    }
  });

  return userFairnessScores;
}

function calculateGroupFairnessScore(fairnessScores: number[]): number {
  if (fairnessScores.length === 0) return 1.0;
  if (fairnessScores.length === 1) return fairnessScores[0];

  const mean = fairnessScores.reduce((sum, score) => sum + score, 0) / fairnessScores.length;
  const variance = fairnessScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / fairnessScores.length;

  // Lower variance = higher fairness
  return Math.exp(-variance * 5);
}

async function getCachedSelection(
  supabase: any, 
  tripId: string, 
  maxPlaces: number, 
  fairnessWeight: number
): Promise<PlaceSelectionResult | null> {
  try {
    const settingsHash = generateSelectionHash(maxPlaces, fairnessWeight);
    
    const { data, error } = await supabase
      .from('optimization_cache')
      .select('result')
      .eq('trip_id', tripId)
      .eq('settings_hash', settingsHash)
      .gt('expires_at', new Date().toISOString())
      .eq('metadata->>type', 'place_selection_result')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('Error fetching cached selection:', error);
      return null;
    }

    return data?.result as PlaceSelectionResult || null;
  } catch (error) {
    console.warn('Error accessing selection cache:', error);
    return null;
  }
}

async function setCachedSelection(supabase: any, tripId: string, result: PlaceSelectionResult) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute cache

  const placesHash = generatePlacesHash(result.selectedPlaces.map(sp => sp.place));
  const settingsHash = generateSelectionHash(result.metadata.maxPlaces, result.metadata.fairnessWeight);

  try {
    await supabase
      .from('optimization_cache')
      .upsert({
        trip_id: tripId,
        places_hash: placesHash,
        settings_hash: settingsHash,
        result,
        expires_at: expiresAt.toISOString(),
        metadata: {
          type: 'place_selection_result',
          version: '2.0',
          places_selected: result.selectedPlaces.length,
          fairness_score: result.finalFairnessScore
        }
      });
  } catch (error) {
    console.warn('Failed to cache selection result:', error);
  }
}

function generateSelectionHash(maxPlaces: number, fairnessWeight: number): string {
  const hashInput = `${maxPlaces}:${fairnessWeight.toFixed(2)}`;
  return btoa(hashInput).slice(0, 16);
}

function generatePlacesHash(places: Place[]): string {
  const hashInput = places
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(p => `${p.id}:${p.wish_level}`)
    .join('|');
  
  return btoa(hashInput).slice(0, 32);
}

async function recordSelectionEvent(supabase: any, userId: string, tripId: string, metadata: any) {
  try {
    await supabase
      .from('usage_events')
      .insert({
        user_id: userId,
        event_type: 'place_selection_completed',
        event_category: 'optimization',
        trip_id: tripId,
        metadata
      });
  } catch (error) {
    console.warn('Failed to record selection event:', error);
  }
}