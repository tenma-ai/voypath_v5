/**
 * Preference Normalization Service for Voypath
 * Client-side service that calls the Edge Function for server-side normalization
 * All heavy calculations are performed in Edge Functions for scalability
 */

import { supabase } from '../lib/supabase';
import { Place, User } from '../types/optimization';

export interface UserNormalizationData {
  userId: string;
  userName: string;
  totalPlaces: number;
  avgWishLevel: number;
  normalizedPlaces: NormalizedPlaceData[];
  userWeight: number;
  fairnessContribution: number;
}

export interface NormalizedPlaceData {
  placeId: string;
  placeName: string;
  originalWishLevel: number;
  normalizedWishLevel: number;
  fairnessScore: number;
  categoryWeight: number;
}

export interface NormalizationResult {
  tripId: string;
  normalizedUsers: UserNormalizationData[];
  totalPlaces: number;
  groupFairnessScore: number;
  executionTimeMs: number;
  metadata: {
    algorithmVersion: string;
    createdAt: string;
    edgeCaseHandling: string[];
  };
}

export class PreferenceNormalizationService {
  /**
   * Normalize user preferences for a trip using Edge Function
   */
  static async normalizeUserPreferences(
    tripId: string, 
    forceRefresh: boolean = false
  ): Promise<NormalizationResult> {
    try {
      // Starting preference normalization

      const response = await supabase.functions.invoke('normalize-preferences', {
        body: {
          trip_id: tripId,
          force_refresh: forceRefresh
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Normalization failed');
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'Normalization failed');
      }

      // Log message
      return data.result as NormalizationResult;

    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  /**
   * Get cached normalization result if available
   */
  static async getCachedNormalization(tripId: string): Promise<NormalizationResult | null> {
    try {
      const { data, error } = await supabase
        .from('optimization_cache')
        .select('result')
        .eq('trip_id', tripId)
        .gt('expires_at', new Date().toISOString())
        .eq('metadata->>type', 'normalization_result')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Warning occurred
        return null;
      }

      return data?.result as NormalizationResult || null;
    } catch (error) {
      // Warning occurred
      return null;
    }
  }

  /**
   * Individual user fairness score calculation
   */
  static calculatePersonalFairnessScore(
    user: UserNormalizationData,
    selectedPlaces: Place[]
  ): number {
    if (user.normalizedPlaces.length === 0) return 0.0;

    // Calculate sum of normalized wish levels for selected places by this user
    const userSelectedSum = selectedPlaces
      .filter(place => place.user_id === user.userId)
      .reduce((sum, place) => {
        const normalizedPlace = user.normalizedPlaces.find(np => np.placeId === place.id);
        return sum + (normalizedPlace?.normalizedWishLevel || 0);
      }, 0);

    // Calculate total sum of user's normalized wish levels
    const userTotalSum = user.normalizedPlaces.reduce(
      (sum, place) => sum + place.normalizedWishLevel, 
      0
    );

    return userTotalSum === 0 ? 0 : userSelectedSum / userTotalSum;
  }
}