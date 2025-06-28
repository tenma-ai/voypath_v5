import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Wand2, MapPin, AlertCircle, CheckCircle, Car } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { TripOptimizationService, OptimizationProgress } from '../services/TripOptimizationService';
import { OptimizationProgressService } from '../services/OptimizationProgressService';
import { OptimizationKeepAliveService } from '../services/OptimizationKeepAliveService';
// import { LoadingState, OptimizationErrorType, EnhancedOptimizationError } from '../types/optimization';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
}

export function OptimizationModal({ isOpen, onClose, tripId }: OptimizationModalProps) {
  const [settings, setSettings] = useState({
    fairness_weight: 0.6,
    efficiency_weight: 0.4,
    include_meals: true,
    preferred_transport: 'public_transport' as 'walking' | 'public_transport' | 'car',
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [connectivity, setConnectivity] = useState({ normalize: false, select: false, route: false });
  const [progressSubscription, setProgressSubscription] = useState<(() => void) | null>(null);

  const { setOptimizationResult, currentUser, setHasUserOptimized, setShowOptimizationSuccess } = useStore();

  // Check Edge Functions connectivity on mount
  useEffect(() => {
    if (isOpen) {
      checkConnectivity();
      checkExistingOptimization();
    }
  }, [isOpen, tripId]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (progressSubscription) {
        progressSubscription();
        setProgressSubscription(null);
      }
    };
  }, [progressSubscription]);

  const checkConnectivity = async () => {
    try {
      const results = await TripOptimizationService.testConnectivity();
      setConnectivity(results);
      
      if (!results.normalize || !results.select || !results.route) {
        setError('Some optimization services are unavailable. Please try again later.');
      }
    } catch (error) {
      console.error('Connectivity check failed:', error);
      setError('Unable to connect to optimization services.');
    }
  };

  const checkExistingOptimization = async () => {
    if (!tripId) {
      console.log('No trip ID provided, skipping optimization status check');
      return;
    }
    
    try {
      const status = await OptimizationProgressService.getOptimizationStatus(tripId);
      if (status.isRunning) {
        setIsOptimizing(true);
        setProgress({
          stage: status.currentStage || 'routing',
          progress: status.progress,
          message: status.message
        });
        
        // Subscribe to progress updates
        const unsubscribe = OptimizationProgressService.subscribeToTripProgress(
          tripId,
          (progressUpdate) => {
            setProgress(progressUpdate);
            
            if (progressUpdate.stage === 'complete') {
              setIsOptimizing(false);
              setTimeout(() => {
                onClose();
                resetState();
              }, 2000);
            } else if (progressUpdate.stage === 'error') {
              setError(progressUpdate.error || 'Optimization failed');
              setIsOptimizing(false);
            }
          }
        );
        setProgressSubscription(() => unsubscribe);
      }
    } catch (error) {
      console.error('Error checking existing optimization:', error);
    }
  };

  const resetState = () => {
    setProgress(null);
    setError(null);
    setIsOptimizing(false);
    if (progressSubscription) {
      progressSubscription();
      setProgressSubscription(null);
    }
  };

  const handleOptimize = async () => {
    if (!tripId || !currentUser) {
      setError('Trip ID and user authentication are required');
      return;
    }

    // Check connectivity first
    const allServicesConnected = connectivity.normalize && connectivity.select && connectivity.route;
    if (!allServicesConnected) {
      setError('Not all optimization services are available. Please try again later.');
      return;
    }

    console.log('🔍 [OptimizationModal] Starting optimization trigger - setting hasUserOptimized to true');
    setHasUserOptimized(true);
    
    setIsOptimizing(true);
    setError(null);
    setProgress({ stage: 'collecting', progress: 0, message: 'Starting optimization...' });

    try {
      // Warm up functions for optimal performance
      await OptimizationKeepAliveService.warmUpForOptimization();

      // Subscribe to progress updates
      const unsubscribe = OptimizationProgressService.subscribeToTripProgress(
        tripId,
        (progressUpdate) => {
          setProgress(progressUpdate);
          
          // Update database progress
          OptimizationProgressService.updateProgressFromService(
            tripId,
            currentUser.id,
            progressUpdate
          ).catch(console.error);

          if (progressUpdate.stage === 'complete') {
            setIsOptimizing(false);
            setTimeout(() => {
              onClose();
              resetState();
            }, 2000);
          } else if (progressUpdate.stage === 'error') {
            setError(progressUpdate.error || 'Optimization failed');
            setIsOptimizing(false);
          }
        }
      );
      setProgressSubscription(() => unsubscribe);

      // Execute optimization with progress callback
      const result = await TripOptimizationService.optimizeTrip(
        tripId, 
        settings,
        (progress) => {
          setProgress(progress);
          
          // Update database progress
          OptimizationProgressService.updateProgressFromService(
            tripId,
            currentUser.id,
            progress
          ).catch(console.error);
        }
      );

      if (result.success) {
        setOptimizationResult(result.optimization_result);
        setShowOptimizationSuccess(true); // Trigger success animation
        
        // Final progress update
        const finalProgress = { 
          stage: 'complete' as const, 
          progress: 100, 
          message: 'Optimization completed successfully!',
          executionTimeMs: result.execution_time_ms
        };
        setProgress(finalProgress);
        
        // Update database
        await OptimizationProgressService.updateProgressFromService(
          tripId,
          currentUser.id,
          finalProgress
        );
        
        // Close modal after delay
        setTimeout(() => {
          onClose();
          resetState();
        }, 2000);
      } else {
        throw new Error('Optimization failed');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Optimization failed';
      setError(errorMessage);
      
      // Update database with error
      if (currentUser) {
        const errorProgress = {
          stage: 'error' as const,
          progress: 0,
          message: 'Optimization failed',
          error: errorMessage
        };
        setProgress(errorProgress);
        
        OptimizationProgressService.updateProgressFromService(
          tripId,
          currentUser.id,
          errorProgress
        ).catch(console.error);
      }
      
      setIsOptimizing(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Route Optimization
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            {/* Progress Display */}
            {(isOptimizing || progress) && progress && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  {/* Stage Display */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {OptimizationProgressService.getStageDisplayInfo(progress.stage).icon}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {OptimizationProgressService.getStageDisplayInfo(progress.stage).title}
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          {progress.message}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        {progress.progress}%
                      </div>
                      {progress.executionTimeMs && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          {OptimizationProgressService.formatExecutionTime ? 
                            OptimizationProgressService.formatExecutionTime(progress.executionTimeMs) :
                            `${Math.round(progress.executionTimeMs / 1000)}s`
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>

                  {/* Stage Indicators */}
                  <div className="flex justify-between mt-3 text-xs">
                    {['collecting', 'normalizing', 'selecting', 'routing', 'complete'].map((stage, index) => {
                      const isActive = progress.stage === stage;
                      const isCompleted = ['collecting', 'normalizing', 'selecting', 'routing', 'complete'].indexOf(progress.stage) > index;
                      
                      return (
                        <div key={stage} className={`flex flex-col items-center space-y-1 ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 
                          isCompleted ? 'text-green-600 dark:text-green-400' : 
                          'text-slate-400 dark:text-slate-500'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            isActive ? 'bg-blue-600 animate-pulse' : 
                            isCompleted ? 'bg-green-600' : 
                            'bg-slate-300 dark:bg-slate-600'
                          }`} />
                          <span className="capitalize text-[10px]">
                            {stage === 'collecting' ? 'Collect' :
                             stage === 'normalizing' ? 'Normalize' :
                             stage === 'selecting' ? 'Select' :
                             stage === 'routing' ? 'Route' : 'Done'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Connectivity Status */}
            {!isOptimizing && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Service Status:</div>
                <div className="flex space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    {connectivity.normalize ? 
                      <CheckCircle className="w-3 h-3 text-green-500" /> : 
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    }
                    <span>Normalize</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {connectivity.select ? 
                      <CheckCircle className="w-3 h-3 text-green-500" /> : 
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    }
                    <span>Select</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {connectivity.route ? 
                      <CheckCircle className="w-3 h-3 text-green-500" /> : 
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    }
                    <span>Route</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fairness vs Efficiency Balance */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Optimization Balance
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400">
                      Fairness Priority
                    </label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {Math.round(settings.fairness_weight * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.fairness_weight}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      fairness_weight: parseFloat(e.target.value),
                      efficiency_weight: 1 - parseFloat(e.target.value)
                    })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>Equal representation</span>
                    <span>Travel efficiency</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transportation */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                <Car className="w-4 h-4 mr-2" />
                Preferred Transportation
              </h3>
              <select
                value={settings.preferred_transport}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  preferred_transport: e.target.value as 'walking' | 'public_transport' | 'car'
                })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                disabled={isOptimizing}
              >
                <option value="walking">Walking Priority</option>
                <option value="public_transport">Public Transport</option>
                <option value="car">Car/Taxi</option>
              </select>
            </div>

            {/* Additional Options */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                Additional Options
              </h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.include_meals}
                    onChange={(e) => setSettings({ ...settings, include_meals: e.target.checked })}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                    disabled={isOptimizing}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Include meal and rest breaks
                  </span>
                </label>
              </div>
            </div>

            {/* Optimization Info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                💡 This optimization uses advanced algorithms to balance fairness among group members 
                while minimizing travel time and maximizing visit satisfaction.
              </p>
            </div>
          </div>

          <div className="flex space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              disabled={isOptimizing}
              className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOptimizing ? 'Optimizing...' : 'Cancel'}
            </button>
            <button
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-lg hover:from-primary-600 hover:to-secondary-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'Optimizing...' : 'Optimize Route'}</span>
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}