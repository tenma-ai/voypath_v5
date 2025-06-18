import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Place {
  id: string;
  name: string;
  category: string;
  latitude?: number;
  longitude?: number;
  wish_level: number; // 1-5
  stay_duration_minutes: number;
  visit_date?: string;
  user_id: string;
  trip_id: string;
  source?: string;
  created_at: string;
}

interface Member {
  user_id: string;
  trip_id: string;
  member_color: string;
  can_add_places: boolean;
  can_optimize: boolean;
  is_admin: boolean;
}

interface OptimizationSettings {
  fairness_weight?: number;
  efficiency_weight?: number;
  include_meals?: boolean;
  preferred_transport?: 'walking' | 'car' | 'flight';
}

interface NormalizedPlace extends Place {
  normalized_weight: number;
  fairness_factor: number;
  user_place_count: number;
  relative_importance: number;
}

interface NormalizationRequest {
  trip_id: string;
  places: Place[];
  members: Member[];
  settings: OptimizationSettings;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: NormalizationRequest = await req.json();

    if (!requestData.trip_id || !requestData.places || !requestData.members) {
      throw new Error('trip_id, places, and members are required');
    }

    console.log(`🔄 Normalizing preferences for trip ${requestData.trip_id} with ${requestData.places.length} places and ${requestData.members.length} members`);

    // Step 3.1: Calculate user place distribution
    const userPlaceCounts = calculateUserPlaceCounts(requestData.places);
    
    // Step 3.2: Apply fairness normalization
    const fairnessNormalizedPlaces = applyFairnessNormalization(
      requestData.places, 
      userPlaceCounts, 
      requestData.members
    );

    // Step 3.3: Apply wish level normalization
    const wishNormalizedPlaces = applyWishLevelNormalization(fairnessNormalizedPlaces);

    // Step 3.4: Apply temporal preferences (visit_date priority)
    const temporalNormalizedPlaces = applyTemporalNormalization(wishNormalizedPlaces);

    // Step 3.5: Apply category balancing
    const categoryBalancedPlaces = applyCategoryBalancing(temporalNormalizedPlaces);

    // Step 3.6: Calculate final normalized weights
    const finalNormalizedPlaces = calculateFinalWeights(
      categoryBalancedPlaces, 
      requestData.settings
    );

    // Step 3.7: Record normalization metrics for analytics
    await recordNormalizationMetrics(
      supabaseClient,
      requestData.trip_id,
      requestData.places,
      finalNormalizedPlaces
    );

    console.log(`✅ Preferences normalized: ${finalNormalizedPlaces.length} places processed`);

    return new Response(
      JSON.stringify({
        success: true,
        normalized_places: finalNormalizedPlaces,
        normalization_stats: {
          total_places: finalNormalizedPlaces.length,
          users_count: Object.keys(userPlaceCounts).length,
          avg_places_per_user: Object.values(userPlaceCounts).reduce((a, b) => a + b, 0) / Object.keys(userPlaceCounts).length,
          fairness_adjustment_applied: true,
          category_balancing_applied: true
        },
        message: 'Preferences normalized successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Normalization Error:', error);
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

function calculateUserPlaceCounts(places: Place[]): Record<string, number> {
  return places.reduce((acc, place) => {
    acc[place.user_id] = (acc[place.user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function applyFairnessNormalization(
  places: Place[], 
  userPlaceCounts: Record<string, number>, 
  members: Member[]
): NormalizedPlace[] {
  const totalPlaces = places.length;
  const activeMembers = members.filter(m => m.can_add_places).length;
  const idealPlacesPerUser = totalPlaces / activeMembers;

  return places.map(place => {
    const userCount = userPlaceCounts[place.user_id] || 1;
    
    // Fairness factor: reduce weight for users with many places
    // Uses square root to avoid too harsh penalties
    const fairnessFactor = Math.sqrt(idealPlacesPerUser / userCount);
    
    // Ensure fairness factor is within reasonable bounds (0.3 to 1.5)
    const boundedFairnessFactor = Math.max(0.3, Math.min(1.5, fairnessFactor));

    return {
      ...place,
      normalized_weight: 0, // Will be calculated in final step
      fairness_factor: boundedFairnessFactor,
      user_place_count: userCount,
      relative_importance: place.wish_level / 5 // Base importance (0-1)
    } as NormalizedPlace;
  });
}

function applyWishLevelNormalization(places: NormalizedPlace[]): NormalizedPlace[] {
  // Normalize wish levels within each user's places to prevent gaming
  const userGroups = groupPlacesByUser(places);
  
  return places.map(place => {
    const userPlaces = userGroups[place.user_id] || [];
    const userWishLevels = userPlaces.map(p => p.wish_level);
    const maxWishLevel = Math.max(...userWishLevels);
    const minWishLevel = Math.min(...userWishLevels);
    
    // Normalize within user's range to prevent all 5s
    let normalizedWishLevel: number;
    if (maxWishLevel === minWishLevel) {
      normalizedWishLevel = 0.8; // Default if all same level
    } else {
      normalizedWishLevel = 0.2 + 0.8 * (place.wish_level - minWishLevel) / (maxWishLevel - minWishLevel);
    }

    return {
      ...place,
      relative_importance: normalizedWishLevel
    };
  });
}

function applyTemporalNormalization(places: NormalizedPlace[]): NormalizedPlace[] {
  return places.map(place => {
    let temporalBonus = 1.0;
    
    // Boost places with specific visit dates
    if (place.visit_date) {
      temporalBonus = 1.2;
    }
    
    // Additional boost for places with earlier preferred dates
    if (place.visit_date) {
      const visitDate = new Date(place.visit_date);
      const now = new Date();
      const daysFromNow = (visitDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      // Slight boost for sooner dates (but not too much)
      if (daysFromNow >= 0 && daysFromNow <= 7) {
        temporalBonus *= 1.1;
      }
    }

    return {
      ...place,
      relative_importance: place.relative_importance * temporalBonus
    };
  });
}

function applyCategoryBalancing(places: NormalizedPlace[]): NormalizedPlace[] {
  // Count places by category
  const categoryCounts = places.reduce((acc, place) => {
    acc[place.category] = (acc[place.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPlaces = places.length;

  return places.map(place => {
    const categoryCount = categoryCounts[place.category] || 1;
    const categoryRatio = categoryCount / totalPlaces;
    
    // Apply mild balancing - don't let any category dominate too much
    let categoryBalance = 1.0;
    if (categoryRatio > 0.5) {
      // If category has more than 50% of places, apply mild penalty
      categoryBalance = 0.9;
    } else if (categoryRatio < 0.1) {
      // If category has less than 10% of places, apply mild boost
      categoryBalance = 1.1;
    }

    return {
      ...place,
      relative_importance: place.relative_importance * categoryBalance
    };
  });
}

function calculateFinalWeights(
  places: NormalizedPlace[], 
  settings: OptimizationSettings
): NormalizedPlace[] {
  return places.map(place => {
    // Combine all factors
    const baseWeight = place.relative_importance;
    const fairnessAdjustment = place.fairness_factor;
    
    // Apply settings-based adjustments
    let settingsMultiplier = 1.0;
    if (settings.fairness_weight && settings.fairness_weight > 0.7) {
      // High fairness setting - emphasize fairness more
      settingsMultiplier = fairnessAdjustment;
    } else if (settings.efficiency_weight && settings.efficiency_weight > 0.7) {
      // High efficiency setting - emphasize wish levels more
      settingsMultiplier = baseWeight;
    } else {
      // Balanced approach
      settingsMultiplier = (baseWeight + fairnessAdjustment) / 2;
    }

    const finalWeight = baseWeight * fairnessAdjustment * settingsMultiplier;
    
    // Ensure weight is within reasonable bounds (0.1 to 2.0)
    const boundedWeight = Math.max(0.1, Math.min(2.0, finalWeight));

    return {
      ...place,
      normalized_weight: boundedWeight
    };
  });
}

function groupPlacesByUser(places: NormalizedPlace[]): Record<string, NormalizedPlace[]> {
  return places.reduce((acc, place) => {
    if (!acc[place.user_id]) {
      acc[place.user_id] = [];
    }
    acc[place.user_id].push(place);
    return acc;
  }, {} as Record<string, NormalizedPlace[]>);
}

async function recordNormalizationMetrics(
  supabase: any,
  tripId: string,
  originalPlaces: Place[],
  normalizedPlaces: NormalizedPlace[]
): Promise<void> {
  try {
    // Calculate metrics
    const userCounts = calculateUserPlaceCounts(originalPlaces);
    const weights = normalizedPlaces.map(p => p.normalized_weight);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const weightVariance = weights.reduce((sum, w) => sum + Math.pow(w - avgWeight, 2), 0) / weights.length;

    const metrics = {
      trip_id: tripId,
      total_places: normalizedPlaces.length,
      unique_users: Object.keys(userCounts).length,
      places_per_user: userCounts,
      avg_normalized_weight: avgWeight,
      weight_variance: weightVariance,
      category_distribution: normalizedPlaces.reduce((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // Store metrics for analytics
    await supabase
      .from('optimization_metrics')
      .insert({
        trip_id: tripId,
        metric_type: 'preference_normalization',
        metric_data: metrics,
        created_at: new Date().toISOString()
      });

  } catch (error) {
    console.warn('Failed to record normalization metrics:', error);
    // Don't fail the main operation if metrics recording fails
  }
}