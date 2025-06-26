/**
 * Enhanced Optimization Progress Visualization - Phase 8 Implementation
 * TODO 134: Implement optimization progress visualization
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  BarChart3, 
  Zap, 
  Target, 
  Users, 
  MapPin, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  Gauge,
  Timer
} from 'lucide-react';
import { OptimizationProgress } from '../services/TripOptimizationService';

interface OptimizationProgressVisualizationProps {
  progress: OptimizationProgress;
  isActive: boolean;
  executionStats?: {
    startTime: number;
    estimatedTotal: number;
    placesCount: number;
    membersCount: number;
  };
  onCancel?: () => void;
}

interface StageMetrics {
  stage: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  estimatedDuration: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

export function OptimizationProgressVisualization({ 
  progress, 
  isActive, 
  executionStats,
  onCancel 
}: OptimizationProgressVisualizationProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [detailedMetrics] = useState<Record<string, unknown> | null>(null);

  // Update current time for real-time calculations
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    
    return () => clearInterval(interval);
  }, [isActive]);

  // Stage configuration with enhanced metadata
  const stageConfig: Record<string, StageMetrics> = {
    collecting: {
      stage: 'collecting',
      icon: <Activity className="w-5 h-5" />,
      title: 'Collecting Data',
      description: 'Gathering trip information and member preferences',
      estimatedDuration: 2000,
      color: 'blue',
      gradientFrom: '#3B82F6',
      gradientTo: '#1D4ED8'
    },
    normalizing: {
      stage: 'normalizing',
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Normalizing Preferences',
      description: 'Balancing wish levels across all members',
      estimatedDuration: 3000,
      color: 'purple',
      gradientFrom: '#8B5CF6',
      gradientTo: '#7C3AED'
    },
    selecting: {
      stage: 'selecting',
      icon: <Target className="w-5 h-5" />,
      title: 'Selecting Places',
      description: 'Choosing optimal places for the itinerary',
      estimatedDuration: 4000,
      color: 'orange',
      gradientFrom: '#F59E0B',
      gradientTo: '#D97706'
    },
    routing: {
      stage: 'routing',
      icon: <Zap className="w-5 h-5" />,
      title: 'Route Optimization',
      description: 'Calculating best travel routes and schedules',
      estimatedDuration: 8000,
      color: 'green',
      gradientFrom: '#10B981',
      gradientTo: '#059669'
    },
    complete: {
      stage: 'complete',
      icon: <CheckCircle className="w-5 h-5" />,
      title: 'Complete',
      description: 'Optimization finished successfully',
      estimatedDuration: 0,
      color: 'emerald',
      gradientFrom: '#10B981',
      gradientTo: '#047857'
    },
    error: {
      stage: 'error',
      icon: <AlertCircle className="w-5 h-5" />,
      title: 'Error',
      description: 'Optimization encountered an error',
      estimatedDuration: 0,
      color: 'red',
      gradientFrom: '#EF4444',
      gradientTo: '#DC2626'
    }
  };

  const currentStage = stageConfig[progress.stage] || stageConfig.collecting;
  const elapsedTime = executionStats ? currentTime - executionStats.startTime : 0;
  const estimatedTotal = executionStats?.estimatedTotal || 15000; // 15 seconds default

  // Calculate stage progression
  const stages = ['collecting', 'normalizing', 'selecting', 'routing', 'complete'];
  const currentStageIndex = stages.indexOf(progress.stage);
  const overallProgress = currentStageIndex >= 0 ? 
    ((currentStageIndex * 25) + (progress.progress * 0.25)) : progress.progress;

  // Real-time performance metrics
  const performanceMetrics = {
    efficiency: Math.min(100, Math.max(0, 100 - (elapsedTime / estimatedTotal) * 50)),
    throughput: executionStats?.placesCount ? 
      Math.round((progress.progress / 100) * executionStats.placesCount) : 0,
    processingRate: elapsedTime > 0 ? 
      Math.round((progress.progress / (elapsedTime / 1000)) * 10) / 10 : 0
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header with Real-time Stats */}
      <div 
        className="p-6 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${currentStage.gradientFrom} 0%, ${currentStage.gradientTo} 100%)`
        }}
      >
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12 animate-pulse" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: isActive ? 360 : 0 }}
                transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: "linear" }}
                className="p-2 bg-white/20 rounded-xl"
              >
                {currentStage.icon}
              </motion.div>
              <div>
                <h3 className="text-xl font-bold">{currentStage.title}</h3>
                <p className="text-white/80 text-sm">{currentStage.description}</p>
              </div>
            </div>
            
            {/* Real-time Timer */}
            <div className="text-right">
              <div className="flex items-center space-x-2 text-white/90 mb-1">
                <Timer className="w-4 h-4" />
                <span className="text-sm font-mono">
                  {Math.floor(elapsedTime / 1000)}s
                </span>
              </div>
              <div className="text-xs text-white/70">
                ETA: {Math.max(0, Math.round((estimatedTotal - elapsedTime) / 1000))}s
              </div>
            </div>
          </div>

          {/* Progress Message */}
          <div className="mb-4">
            <p className="text-white/90 text-sm font-medium">
              {progress.message}
            </p>
          </div>

          {/* Primary Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white/90">
                Stage Progress
              </span>
              <span className="text-lg font-bold text-white">
                {progress.progress}%
              </span>
            </div>
            
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <motion.div 
                className="bg-white h-full rounded-full relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${progress.progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                />
              </motion.div>
            </div>

            {/* Overall Progress */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/70">Overall Progress</span>
              <span className="text-white/90 font-medium">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1">
              <motion.div 
                className="bg-white/60 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stage Pipeline Visualization */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/50">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Optimization Pipeline
        </h4>
        
        <div className="flex items-center justify-between space-x-2">
          {stages.map((stage, index) => {
            const stageInfo = stageConfig[stage];
            const isActive = progress.stage === stage;
            const isCompleted = currentStageIndex > index;
            const isCurrentStage = currentStageIndex === index;
            
            return (
              <React.Fragment key={stage}>
                <motion.div
                  className={`flex flex-col items-center space-y-2 flex-1`}
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      isActive 
                        ? 'bg-primary-500 text-white shadow-lg' 
                        : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-xs font-medium ${
                      isActive 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : isCompleted 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {stageInfo.title.split(' ')[0]}
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-slate-500 dark:text-slate-400"
                      >
                        {progress.progress}%
                      </motion.div>
                    )}
                  </div>
                </motion.div>
                
                {index < stages.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    isCompleted 
                      ? 'bg-green-500' 
                      : isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-slate-200 dark:to-slate-600' 
                      : 'bg-slate-200 dark:bg-slate-600'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="p-6 space-y-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Real-time Performance
        </h4>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <Gauge className="w-5 h-5 text-blue-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {Math.round(performanceMetrics.efficiency)}%
            </div>
            <div className="text-xs text-blue-500 dark:text-blue-300">
              Efficiency
            </div>
          </div>

          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <MapPin className="w-5 h-5 text-green-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {performanceMetrics.throughput}
            </div>
            <div className="text-xs text-green-500 dark:text-green-300">
              Places Processed
            </div>
          </div>

          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {performanceMetrics.processingRate}
            </div>
            <div className="text-xs text-purple-500 dark:text-purple-300">
              %/sec Rate
            </div>
          </div>
        </div>

        {/* Trip Statistics */}
        {executionStats && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Trip Context
            </h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  {executionStats.placesCount} places
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  {executionStats.membersCount} members
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        {onCancel && isActive && progress.stage !== 'complete' && progress.stage !== 'error' && (
          <motion.button
            onClick={onCancel}
            className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Cancel Optimization
          </motion.button>
        )}
      </div>
    </div>
  );
}