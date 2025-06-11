/**
 * Optimization Progress Service for Voypath
 * Phase 1: Real-time progress tracking with Supabase integration
 */

import { supabase } from '../lib/supabase';
import { 
  OptimizationProgress, 
  OptimizationStage, 
  OptimizationMetrics,
  OptimizationError 
} from '../types/optimization';

export class OptimizationProgressService {
  private static progressListeners = new Map<string, ((progress: OptimizationProgress) => void)[]>();
  private static currentProgress = new Map<string, OptimizationProgress>();

  // Create or update optimization progress
  static async updateProgress(
    tripId: string,
    userId: string,
    stage: OptimizationStage,
    percentage: number,
    message: string,
    executionTimeMs?: number,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<OptimizationProgress> {
    try {
      const progressData = {
        trip_id: tripId,
        user_id: userId,
        stage,
        progress_percentage: Math.min(100, Math.max(0, percentage)),
        stage_message: message,
        execution_time_ms: executionTimeMs,
        error_message: errorMessage,
        metadata: metadata || {},
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('optimization_progress')
        .upsert(progressData, { 
          onConflict: 'trip_id,user_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to update optimization progress:', error);
        throw new Error(`Progress update failed: ${error.message}`);
      }

      const progress = data as OptimizationProgress;
      
      // Update local cache
      const progressKey = `${tripId}_${userId}`;
      OptimizationProgressService.currentProgress.set(progressKey, progress);
      
      // Notify listeners
      OptimizationProgressService.notifyListeners(tripId, progress);
      
      return progress;
    } catch (error) {
      console.error('Error updating optimization progress:', error);
      throw error;
    }
  }

  // Get current progress for a trip
  static async getProgress(tripId: string, userId: string): Promise<OptimizationProgress | null> {
    try {
      const { data, error } = await supabase
        .from('optimization_progress')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Failed to get optimization progress:', error);
        throw new Error(`Progress fetch failed: ${error.message}`);
      }

      return data as OptimizationProgress | null;
    } catch (error) {
      console.error('Error getting optimization progress:', error);
      return null;
    }
  }

  // Get all progress entries for a trip (useful for admin/debugging)
  static async getTripProgress(tripId: string): Promise<OptimizationProgress[]> {
    try {
      const { data, error } = await supabase
        .from('optimization_progress')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get trip progress:', error);
        throw new Error(`Trip progress fetch failed: ${error.message}`);
      }

      return data as OptimizationProgress[];
    } catch (error) {
      console.error('Error getting trip progress:', error);
      return [];
    }
  }

  // Subscribe to real-time progress updates
  static subscribeToProgress(
    tripId: string, 
    callback: (progress: OptimizationProgress) => void
  ): () => void {
    // Add to listeners
    if (!OptimizationProgressService.progressListeners.has(tripId)) {
      OptimizationProgressService.progressListeners.set(tripId, []);
    }
    OptimizationProgressService.progressListeners.get(tripId)!.push(callback);

    // Set up Supabase realtime subscription
    const channel = supabase
      .channel(`optimization_progress_${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'optimization_progress',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          console.log('Optimization progress change:', payload);
          if (payload.new) {
            const progress = payload.new as OptimizationProgress;
            OptimizationProgressService.notifyListeners(tripId, progress);
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      // Remove from listeners
      const listeners = OptimizationProgressService.progressListeners.get(tripId);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
        if (listeners.length === 0) {
          OptimizationProgressService.progressListeners.delete(tripId);
        }
      }

      // Unsubscribe from Supabase
      supabase.removeChannel(channel);
    };
  }

  // Notify all listeners for a trip
  private static notifyListeners(tripId: string, progress: OptimizationProgress): void {
    const listeners = OptimizationProgressService.progressListeners.get(tripId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(progress);
        } catch (error) {
          console.error('Error in progress listener:', error);
        }
      });
    }
  }

  // Clean up old progress entries
  static async cleanupOldProgress(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      const { data, error } = await supabase
        .from('optimization_progress')
        .delete()
        .lt('created_at', cutoffTime.toISOString())
        .select('id');

      if (error) {
        console.error('Failed to cleanup old progress:', error);
        throw new Error(`Progress cleanup failed: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up old progress:', error);
      return 0;
    }
  }

  // Create standardized progress updates for each stage
  static async updateStageProgress(
    tripId: string,
    userId: string,
    stage: OptimizationStage,
    percentage: number,
    details?: {
      message?: string;
      executionTimeMs?: number;
      metadata?: Record<string, any>;
      error?: OptimizationError;
    }
  ): Promise<OptimizationProgress> {
    const stageMessages: Record<OptimizationStage, string> = {
      collecting: 'Collecting member preferences and places...',
      normalizing: 'Normalizing user preferences for fairness...',
      selecting: 'Selecting optimal places for the trip...',
      routing: 'Calculating optimal daily routes...',
      complete: 'Optimization complete!'
    };

    const message = details?.message || stageMessages[stage];
    const errorMessage = details?.error ? `${details.error.code}: ${details.error.message}` : undefined;

    return await OptimizationProgressService.updateProgress(
      tripId,
      userId,
      stage,
      percentage,
      message,
      details?.executionTimeMs,
      errorMessage,
      details?.metadata
    );
  }

  // Calculate overall progress from individual stages
  static calculateOverallProgress(stage: OptimizationStage, stageProgress: number): number {
    const stageWeights: Record<OptimizationStage, { min: number; max: number }> = {
      collecting: { min: 0, max: 10 },
      normalizing: { min: 10, max: 30 },
      selecting: { min: 30, max: 60 },
      routing: { min: 60, max: 90 },
      complete: { min: 90, max: 100 }
    };

    const weight = stageWeights[stage];
    const progress = weight.min + ((weight.max - weight.min) * stageProgress / 100);
    
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  // Get progress statistics for monitoring
  static async getProgressStatistics(): Promise<{
    activeOptimizations: number;
    completedToday: number;
    failedToday: number;
    averageExecutionTime: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [activeResult, completedResult, failedResult] = await Promise.all([
        // Active optimizations
        supabase
          .from('optimization_progress')
          .select('id')
          .neq('stage', 'complete')
          .is('error_message', null),

        // Completed today
        supabase
          .from('optimization_progress')
          .select('execution_time_ms')
          .eq('stage', 'complete')
          .gte('created_at', todayISO)
          .is('error_message', null),

        // Failed today
        supabase
          .from('optimization_progress')
          .select('id')
          .gte('created_at', todayISO)
          .not('error_message', 'is', null)
      ]);

      const completedCount = completedResult.data?.length || 0;
      const averageExecutionTime = completedCount > 0 
        ? (completedResult.data?.reduce((sum, item) => sum + (item.execution_time_ms || 0), 0) || 0) / completedCount 
        : 0;

      return {
        activeOptimizations: activeResult.data?.length || 0,
        completedToday: completedCount,
        failedToday: failedResult.data?.length || 0,
        averageExecutionTime: Math.round(averageExecutionTime)
      };
    } catch (error) {
      console.error('Error getting progress statistics:', error);
      return {
        activeOptimizations: 0,
        completedToday: 0,
        failedToday: 0,
        averageExecutionTime: 0
      };
    }
  }
}