/**
 * Optimization Progress Service for Voypath
 * Phase 3: Enhanced real-time progress tracking with Edge Functions integration
 */

import { supabase } from '../lib/supabase';
import { 
  OptimizationProgress, 
  OptimizationStage, 
  OptimizationMetrics,
  OptimizationError,
  OptimizationErrorType,
  EnhancedOptimizationError
} from '../types/optimization';
import { OptimizationProgress as ServiceProgress } from './TripOptimizationService';

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
    metadata?: Record<string, unknown>
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
        // Error occurred
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
      // Error occurred
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
        // Error occurred
        throw new Error(`Progress fetch failed: ${error.message}`);
      }

      return data as OptimizationProgress | null;
    } catch (error) {
      // Error occurred
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
        // Error occurred
        throw new Error(`Trip progress fetch failed: ${error.message}`);
      }

      return data as OptimizationProgress[];
    } catch (error) {
      // Error occurred
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
          // Log message
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
          // Error occurred
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
        // Error occurred
        throw new Error(`Progress cleanup failed: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      // Error occurred
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
      metadata?: Record<string, unknown>;
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

  // Phase 3: Enhanced progress calculation with error handling
  static calculateOverallProgress(stage: OptimizationStage, stageProgress: number): number {
    const stageWeights: Record<OptimizationStage, { min: number; max: number }> = {
      collecting: { min: 0, max: 5 },
      normalizing: { min: 5, max: 25 },
      selecting: { min: 25, max: 65 },
      routing: { min: 65, max: 95 },
      complete: { min: 100, max: 100 }
    };

    const weight = stageWeights[stage];
    if (!weight) return 0;
    
    const progress = weight.min + ((weight.max - weight.min) * stageProgress / 100);
    
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  // Phase 3: Convert service progress to database progress format
  static async updateProgressFromService(
    tripId: string,
    userId: string,
    serviceProgress: ServiceProgress
  ): Promise<void> {
    const overallProgress = this.calculateOverallProgress(
      serviceProgress.stage, 
      serviceProgress.progress
    );

    await this.updateStageProgress(tripId, userId, serviceProgress.stage, overallProgress, {
      message: serviceProgress.message,
      executionTimeMs: serviceProgress.executionTimeMs,
      metadata: {
        serviceStage: serviceProgress.stage,
        serviceProgress: serviceProgress.progress,
        timestamp: new Date().toISOString()
      },
      error: serviceProgress.error ? {
        code: 'OPTIMIZATION_ERROR',
        message: serviceProgress.error,
        stage: serviceProgress.stage
      } : undefined
    });
  }

  // Phase 3: Enhanced stage display with better UI integration
  static getStageDisplayInfo(stage: OptimizationStage): {
    title: string
    description: string
    icon: string
    color: string
    estimatedDuration: string
  } {
    switch (stage) {
      case 'collecting':
        return {
          title: 'Collecting Data',
          description: 'Gathering places and user preferences...',
          icon: '📊',
          color: 'blue',
          estimatedDuration: '5-10s'
        }
      case 'normalizing':
        return {
          title: 'Normalizing Preferences',
          description: 'Balancing user preferences for fairness...',
          icon: '⚖️',
          color: 'yellow',
          estimatedDuration: '10-20s'
        }
      case 'selecting':
        return {
          title: 'Selecting Places',
          description: 'Choosing optimal places for the trip...',
          icon: '🎯',
          color: 'orange',
          estimatedDuration: '15-30s'
        }
      case 'routing':
        return {
          title: 'Optimizing Route',
          description: 'Creating the best travel schedule...',
          icon: '🗺️',
          color: 'purple',
          estimatedDuration: '20-40s'
        }
      case 'complete':
        return {
          title: 'Complete',
          description: 'Optimization finished successfully!',
          icon: '✅',
          color: 'green',
          estimatedDuration: 'Done'
        }
      default:
        return {
          title: 'Processing',
          description: 'Working on your optimization...',
          icon: '⏳',
          color: 'gray',
          estimatedDuration: 'Unknown'
        }
    }
  }

  // Phase 3: Enhanced subscription with better error handling
  static subscribeToTripProgress(
    tripId: string,
    callback: (progress: ServiceProgress) => void
  ): () => void {
    const channel = supabase
      .channel(`optimization_${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'optimization_progress',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          try {
            if (payload.new) {
              const dbProgress = payload.new as OptimizationProgress;
              const serviceProgress: ServiceProgress = {
                stage: dbProgress.stage,
                progress: dbProgress.progress_percentage,
                message: dbProgress.stage_message,
                executionTimeMs: dbProgress.execution_time_ms,
                error: dbProgress.error_message
              };
              callback(serviceProgress);
            }
          } catch (error) {
            // Error occurred
          }
        }
      )
      .subscribe((status) => {
        // Log message
      });

    return () => {
      // Log message
      supabase.removeChannel(channel);
    };
  }

  // Phase 3: Get current optimization status
  static async getOptimizationStatus(tripId: string): Promise<{
    isRunning: boolean
    currentStage?: OptimizationStage
    progress: number
    message: string
    error?: string
    lastUpdated?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('optimization_progress')
        .select('*')
        .eq('trip_id', tripId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        return {
          isRunning: false,
          progress: 0,
          message: 'No optimization in progress'
        };
      }

      const isRunning = data.stage !== 'complete' && !data.error_message;

      return {
        isRunning,
        currentStage: data.stage,
        progress: data.progress_percentage,
        message: data.stage_message,
        error: data.error_message,
        lastUpdated: data.updated_at
      };
    } catch (error) {
      // Error occurred
      return {
        isRunning: false,
        progress: 0,
        message: 'Error checking optimization status',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
      // Error occurred
      return {
        activeOptimizations: 0,
        completedToday: 0,
        failedToday: 0,
        averageExecutionTime: 0
      };
    }
  }
}