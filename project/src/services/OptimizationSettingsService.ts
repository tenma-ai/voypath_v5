/**
 * Optimization Settings Service for Voypath
 * Phase 1: Trip-specific optimization constraints and rules management
 */

import { supabase } from '../lib/supabase';
import { 
  OptimizationSettings, 
  TripOptimizationSettings,
  MealBreakSettings,
  RouteConstraints,
  validateOptimizationSettings 
} from '../types/optimization';

export class OptimizationSettingsService {
  // Default settings
  private static readonly DEFAULT_SETTINGS: OptimizationSettings = {
    maxDailyHours: 8,
    maxPlacesPerOptimization: 20,
    walkingMaxKm: 0.8,
    carMinKm: 15,
    flightMinKm: 500,
    mealBreakSettings: {
      breakfast: { start: 8, duration: 45 },
      lunch: { start: 12, duration: 60 },
      dinner: { start: 18, duration: 90 }
    },
    algorithmVersion: 'mvp_v1',
    fairnessWeight: 1.0
  };

  // Get optimization settings for a trip
  static async getSettings(tripId: string): Promise<OptimizationSettings> {
    try {
      const { data, error } = await supabase
        .from('trip_optimization_settings')
        .select('*')
        .eq('trip_id', tripId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        // Error occurred
        throw new Error(`Settings fetch failed: ${error.message}`);
      }

      if (!data) {
        // Return default settings if none exist
        return OptimizationSettingsService.DEFAULT_SETTINGS;
      }

      // Convert database format to service format
      return OptimizationSettingsService.dbToSettings(data);
    } catch (error) {
      // Error occurred
      return OptimizationSettingsService.DEFAULT_SETTINGS;
    }
  }

  // Create or update optimization settings for a trip
  static async updateSettings(
    tripId: string, 
    settings: Partial<OptimizationSettings>
  ): Promise<OptimizationSettings> {
    try {
      // Merge with defaults
      const fullSettings = {
        ...OptimizationSettingsService.DEFAULT_SETTINGS,
        ...settings
      };

      // Validate settings
      if (!validateOptimizationSettings(fullSettings)) {
        throw new Error('Invalid optimization settings provided');
      }

      // Convert to database format
      const dbData = OptimizationSettingsService.settingsToDb(tripId, fullSettings);

      const { data, error } = await supabase
        .from('trip_optimization_settings')
        .upsert(dbData, { 
          onConflict: 'trip_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        // Error occurred
        throw new Error(`Settings update failed: ${error.message}`);
      }

      return OptimizationSettingsService.dbToSettings(data);
    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  // Reset settings to defaults
  static async resetToDefaults(tripId: string): Promise<OptimizationSettings> {
    return await OptimizationSettingsService.updateSettings(
      tripId, 
      OptimizationSettingsService.DEFAULT_SETTINGS
    );
  }

  // Delete settings (will fall back to defaults)
  static async deleteSettings(tripId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('trip_optimization_settings')
        .delete()
        .eq('trip_id', tripId);

      if (error) {
        // Error occurred
        throw new Error(`Settings deletion failed: ${error.message}`);
      }
    } catch (error) {
      // Error occurred
      throw error;
    }
  }

  // Get route constraints based on settings
  static getRouteConstraints(settings: OptimizationSettings): RouteConstraints {
    return {
      maxDailyHours: settings.maxDailyHours,
      mealBreaks: {
        breakfast: settings.mealBreakSettings.breakfast,
        lunch: settings.mealBreakSettings.lunch,
        dinner: settings.mealBreakSettings.dinner
      },
      transportModes: {
        walkingMaxKm: settings.walkingMaxKm,
        carMinKm: settings.carMinKm,
        flightMinKm: settings.flightMinKm
      }
    };
  }

  // Validate specific constraint values
  static validateConstraints(settings: Partial<OptimizationSettings>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (settings.maxDailyHours !== undefined) {
      if (settings.maxDailyHours < 4 || settings.maxDailyHours > 16) {
        errors.push('Daily hours must be between 4 and 16');
      }
    }

    if (settings.maxPlacesPerOptimization !== undefined) {
      if (settings.maxPlacesPerOptimization < 5 || settings.maxPlacesPerOptimization > 50) {
        errors.push('Max places per optimization must be between 5 and 50');
      }
    }

    if (settings.walkingMaxKm !== undefined) {
      if (settings.walkingMaxKm < 0.1 || settings.walkingMaxKm > 5.0) {
        errors.push('Walking max distance must be between 0.1 and 5.0 km');
      }
    }

    if (settings.carMinKm !== undefined) {
      if (settings.carMinKm < 1.0 || settings.carMinKm > 100.0) {
        errors.push('Car min distance must be between 1.0 and 100.0 km');
      }
    }

    if (settings.flightMinKm !== undefined) {
      if (settings.flightMinKm < 100.0 || settings.flightMinKm > 2000.0) {
        errors.push('Flight min distance must be between 100.0 and 2000.0 km');
      }
    }

    if (settings.fairnessWeight !== undefined) {
      if (settings.fairnessWeight < 0.0 || settings.fairnessWeight > 2.0) {
        errors.push('Fairness weight must be between 0.0 and 2.0');
      }
    }

    // Validate meal break settings
    if (settings.mealBreakSettings) {
      const { breakfast, lunch, dinner } = settings.mealBreakSettings;
      
      if (breakfast) {
        if (breakfast.start < 0 || breakfast.start > 23) {
          errors.push('Breakfast start time must be between 0 and 23');
        }
        if (breakfast.duration < 15 || breakfast.duration > 120) {
          errors.push('Breakfast duration must be between 15 and 120 minutes');
        }
      }
      
      if (lunch) {
        if (lunch.start < 0 || lunch.start > 23) {
          errors.push('Lunch start time must be between 0 and 23');
        }
        if (lunch.duration < 30 || lunch.duration > 180) {
          errors.push('Lunch duration must be between 30 and 180 minutes');
        }
      }
      
      if (dinner) {
        if (dinner.start < 0 || dinner.start > 23) {
          errors.push('Dinner start time must be between 0 and 23');
        }
        if (dinner.duration < 45 || dinner.duration > 240) {
          errors.push('Dinner duration must be between 45 and 240 minutes');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get all settings for multiple trips (for admin/monitoring)
  static async getBulkSettings(tripIds: string[]): Promise<Record<string, OptimizationSettings>> {
    try {
      const { data, error } = await supabase
        .from('trip_optimization_settings')
        .select('*')
        .in('trip_id', tripIds);

      if (error) {
        // Error occurred
        throw new Error(`Bulk settings fetch failed: ${error.message}`);
      }

      const result: Record<string, OptimizationSettings> = {};
      
      // Add existing settings
      if (data) {
        data.forEach(dbSettings => {
          result[dbSettings.trip_id] = OptimizationSettingsService.dbToSettings(dbSettings);
        });
      }
      
      // Add defaults for missing trips
      tripIds.forEach(tripId => {
        if (!result[tripId]) {
          result[tripId] = OptimizationSettingsService.DEFAULT_SETTINGS;
        }
      });

      return result;
    } catch (error) {
      // Error occurred
      // Return defaults for all trips on error
      const result: Record<string, OptimizationSettings> = {};
      tripIds.forEach(tripId => {
        result[tripId] = OptimizationSettingsService.DEFAULT_SETTINGS;
      });
      return result;
    }
  }

  // Utility: Convert database format to service format
  private static dbToSettings(dbData: TripOptimizationSettings): OptimizationSettings {
    return {
      maxDailyHours: dbData.max_daily_hours,
      maxPlacesPerOptimization: dbData.max_places_per_optimization,
      walkingMaxKm: dbData.walking_max_km,
      carMinKm: dbData.car_min_km,
      flightMinKm: dbData.flight_min_km,
      mealBreakSettings: dbData.meal_break_settings,
      algorithmVersion: dbData.algorithm_version,
      fairnessWeight: dbData.fairness_weight
    };
  }

  // Utility: Convert service format to database format
  private static settingsToDb(tripId: string, settings: OptimizationSettings): Omit<TripOptimizationSettings, 'created_at' | 'updated_at'> {
    return {
      trip_id: tripId,
      max_daily_hours: settings.maxDailyHours,
      max_places_per_optimization: settings.maxPlacesPerOptimization,
      walking_max_km: settings.walkingMaxKm,
      car_min_km: settings.carMinKm,
      flight_min_km: settings.flightMinKm,
      meal_break_settings: settings.mealBreakSettings,
      algorithm_version: settings.algorithmVersion,
      fairness_weight: settings.fairnessWeight
    };
  }

  // Create settings preset templates
  static getPresets(): Record<string, OptimizationSettings> {
    return {
      relaxed: {
        ...OptimizationSettingsService.DEFAULT_SETTINGS,
        maxDailyHours: 10,
        maxPlacesPerOptimization: 15,
        walkingMaxKm: 1.2,
        fairnessWeight: 0.8
      },
      
      intensive: {
        ...OptimizationSettingsService.DEFAULT_SETTINGS,
        maxDailyHours: 12,
        maxPlacesPerOptimization: 30,
        walkingMaxKm: 0.5,
        fairnessWeight: 1.2
      },
      
      budget: {
        ...OptimizationSettingsService.DEFAULT_SETTINGS,
        maxDailyHours: 6,
        maxPlacesPerOptimization: 12,
        walkingMaxKm: 1.5,
        carMinKm: 25,
        flightMinKm: 1000,
        fairnessWeight: 1.0
      },
      
      family: {
        ...OptimizationSettingsService.DEFAULT_SETTINGS,
        maxDailyHours: 8,
        maxPlacesPerOptimization: 10,
        walkingMaxKm: 0.6,
        mealBreakSettings: {
          breakfast: { start: 8, duration: 60 },
          lunch: { start: 12, duration: 90 },
          dinner: { start: 18, duration: 120 }
        },
        fairnessWeight: 1.5
      }
    };
  }

  // Apply a preset to a trip
  static async applyPreset(tripId: string, presetName: string): Promise<OptimizationSettings> {
    const presets = OptimizationSettingsService.getPresets();
    const preset = presets[presetName];
    
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    
    return await OptimizationSettingsService.updateSettings(tripId, preset);
  }
}