/**
 * Phase 1 Optimization Services Integration Tests
 * Tests for OptimizationProgressService and OptimizationSettingsService
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { OptimizationProgressService } from '../services/OptimizationProgressService';
import { OptimizationSettingsService } from '../services/OptimizationSettingsService';
import { 
  OptimizationStage, 
  OptimizationSettings,
  validateOptimizationSettings 
} from '../types/optimization';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  neq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lt: vi.fn(() => mockSupabase),
  is: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  single: vi.fn(),
  order: vi.fn(() => mockSupabase),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({ subscribe: vi.fn() })),
    subscribe: vi.fn()
  })),
  removeChannel: vi.fn()
};

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('OptimizationProgressService', () => {
  const mockTripId = 'test-trip-123';
  const mockUserId = 'test-user-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should update progress successfully', async () => {
    const mockProgress = {
      id: 'progress-1',
      trip_id: mockTripId,
      user_id: mockUserId,
      stage: 'collecting' as OptimizationStage,
      progress_percentage: 25,
      stage_message: 'Collecting member preferences...',
      execution_time_ms: 1500,
      error_message: null,
      metadata: { test: 'data' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: mockProgress,
      error: null
    });

    const result = await OptimizationProgressService.updateProgress(
      mockTripId,
      mockUserId,
      'collecting',
      25,
      'Collecting member preferences...',
      1500,
      undefined,
      { test: 'data' }
    );

    expect(result).toEqual(mockProgress);
    expect(mockSupabase.from).toHaveBeenCalledWith('optimization_progress');
    expect(mockSupabase.upsert).toHaveBeenCalled();
  });

  test('should get progress for trip and user', async () => {
    const mockProgress = {
      id: 'progress-1',
      trip_id: mockTripId,
      user_id: mockUserId,
      stage: 'normalizing' as OptimizationStage,
      progress_percentage: 50,
      stage_message: 'Normalizing preferences...',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: mockProgress,
      error: null
    });

    const result = await OptimizationProgressService.getProgress(mockTripId, mockUserId);

    expect(result).toEqual(mockProgress);
    expect(mockSupabase.eq).toHaveBeenCalledWith('trip_id', mockTripId);
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
  });

  test('should handle missing progress gracefully', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' } // No rows returned
    });

    const result = await OptimizationProgressService.getProgress(mockTripId, mockUserId);

    expect(result).toBeNull();
  });

  test('should calculate overall progress correctly', () => {
    expect(OptimizationProgressService.calculateOverallProgress('collecting', 50)).toBe(5);
    expect(OptimizationProgressService.calculateOverallProgress('normalizing', 50)).toBe(20);
    expect(OptimizationProgressService.calculateOverallProgress('selecting', 50)).toBe(45);
    expect(OptimizationProgressService.calculateOverallProgress('routing', 50)).toBe(75);
    expect(OptimizationProgressService.calculateOverallProgress('complete', 100)).toBe(100);
  });

  test('should update stage progress with defaults', async () => {
    const mockProgress = {
      id: 'progress-1',
      trip_id: mockTripId,
      user_id: mockUserId,
      stage: 'selecting' as OptimizationStage,
      progress_percentage: 75,
      stage_message: 'Selecting optimal places for the trip...',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: mockProgress,
      error: null
    });

    const result = await OptimizationProgressService.updateStageProgress(
      mockTripId,
      mockUserId,
      'selecting',
      75
    );

    expect(result.stage_message).toBe('Selecting optimal places for the trip...');
  });
});

describe('OptimizationSettingsService', () => {
  const mockTripId = 'test-trip-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should get default settings when none exist', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' } // No rows returned
    });

    const result = await OptimizationSettingsService.getSettings(mockTripId);

    expect(result.maxDailyHours).toBe(8);
    expect(result.maxPlacesPerOptimization).toBe(20);
    expect(result.algorithmVersion).toBe('mvp_v1');
    expect(result.fairnessWeight).toBe(1.0);
  });

  test('should update settings successfully', async () => {
    const customSettings: Partial<OptimizationSettings> = {
      maxDailyHours: 10,
      maxPlacesPerOptimization: 25,
      fairnessWeight: 1.2
    };

    const mockDbSettings = {
      trip_id: mockTripId,
      max_daily_hours: 10,
      max_places_per_optimization: 25,
      walking_max_km: 0.8,
      car_min_km: 15,
      flight_min_km: 500,
      meal_break_settings: {
        breakfast: { start: 8, duration: 45 },
        lunch: { start: 12, duration: 60 },
        dinner: { start: 18, duration: 90 }
      },
      algorithm_version: 'mvp_v1',
      fairness_weight: 1.2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: mockDbSettings,
      error: null
    });

    const result = await OptimizationSettingsService.updateSettings(mockTripId, customSettings);

    expect(result.maxDailyHours).toBe(10);
    expect(result.maxPlacesPerOptimization).toBe(25);
    expect(result.fairnessWeight).toBe(1.2);
    expect(mockSupabase.upsert).toHaveBeenCalled();
  });

  test('should validate constraints correctly', () => {
    const validSettings: Partial<OptimizationSettings> = {
      maxDailyHours: 8,
      maxPlacesPerOptimization: 20,
      walkingMaxKm: 1.0,
      fairnessWeight: 1.0
    };

    const validation = OptimizationSettingsService.validateConstraints(validSettings);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should reject invalid constraints', () => {
    const invalidSettings: Partial<OptimizationSettings> = {
      maxDailyHours: 25, // Too high
      maxPlacesPerOptimization: 100, // Too high
      walkingMaxKm: 10, // Too high
      fairnessWeight: 5.0 // Too high
    };

    const validation = OptimizationSettingsService.validateConstraints(invalidSettings);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should get route constraints from settings', () => {
    const settings: OptimizationSettings = {
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

    const constraints = OptimizationSettingsService.getRouteConstraints(settings);

    expect(constraints.maxDailyHours).toBe(8);
    expect(constraints.transportModes.walkingMaxKm).toBe(0.8);
    expect(constraints.mealBreaks.breakfast.duration).toBe(45);
  });

  test('should provide preset templates', () => {
    const presets = OptimizationSettingsService.getPresets();

    expect(presets.relaxed).toBeDefined();
    expect(presets.intensive).toBeDefined();
    expect(presets.budget).toBeDefined();
    expect(presets.family).toBeDefined();

    expect(presets.relaxed.maxDailyHours).toBe(10);
    expect(presets.intensive.maxDailyHours).toBe(12);
    expect(presets.budget.maxDailyHours).toBe(6);
    expect(presets.family.maxDailyHours).toBe(8);
  });

  test('should apply preset successfully', async () => {
    const mockDbSettings = {
      trip_id: mockTripId,
      max_daily_hours: 10,
      max_places_per_optimization: 15,
      walking_max_km: 1.2,
      car_min_km: 15,
      flight_min_km: 500,
      meal_break_settings: {
        breakfast: { start: 8, duration: 45 },
        lunch: { start: 12, duration: 60 },
        dinner: { start: 18, duration: 90 }
      },
      algorithm_version: 'mvp_v1',
      fairness_weight: 0.8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: mockDbSettings,
      error: null
    });

    const result = await OptimizationSettingsService.applyPreset(mockTripId, 'relaxed');

    expect(result.maxDailyHours).toBe(10);
    expect(result.fairnessWeight).toBe(0.8);
  });
});

describe('Type Validation', () => {
  test('should validate optimization settings correctly', () => {
    const validSettings: OptimizationSettings = {
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

    expect(validateOptimizationSettings(validSettings)).toBe(true);
  });

  test('should reject invalid optimization settings', () => {
    const invalidSettings = {
      maxDailyHours: 'not a number',
      maxPlacesPerOptimization: 20
    } as any;

    expect(validateOptimizationSettings(invalidSettings)).toBe(false);
  });
});

describe('Integration Flow', () => {
  test('should handle complete optimization flow', async () => {
    const tripId = 'integration-trip';
    const userId = 'integration-user';

    // Mock settings retrieval
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' }
    });

    // Mock progress updates
    const progressSteps = [
      { stage: 'collecting' as OptimizationStage, percentage: 10 },
      { stage: 'normalizing' as OptimizationStage, percentage: 30 },
      { stage: 'selecting' as OptimizationStage, percentage: 60 },
      { stage: 'routing' as OptimizationStage, percentage: 90 },
      { stage: 'complete' as OptimizationStage, percentage: 100 }
    ];

    progressSteps.forEach((step, index) => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: `progress-${index}`,
          trip_id: tripId,
          user_id: userId,
          stage: step.stage,
          progress_percentage: step.percentage,
          stage_message: `Step ${index + 1}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        error: null
      });
    });

    // Get settings (should use defaults)
    const settings = await OptimizationSettingsService.getSettings(tripId);
    expect(settings.maxDailyHours).toBe(8);

    // Simulate progress updates
    for (const step of progressSteps) {
      const progress = await OptimizationProgressService.updateStageProgress(
        tripId,
        userId,
        step.stage,
        step.percentage
      );
      expect(progress.stage).toBe(step.stage);
      expect(progress.progress_percentage).toBe(step.percentage);
    }
  });
});