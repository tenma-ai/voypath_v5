import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Play, Pause, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import { OptimizationProgressService } from '../services/OptimizationProgressService';
import { OptimizationKeepAliveService } from '../services/OptimizationKeepAliveService';
import { TripOptimizationService, OptimizationProgress } from '../services/TripOptimizationService';
import { supabase } from '../lib/supabase';

interface OptimizeRouteButtonProps {
  tripId: string;
  className?: string;
}

const STAGE_LABELS = {
  collecting: 'Collecting Data',
  normalizing: 'Normalizing Preferences', 
  selecting: 'Selecting Places',
  routing: 'Optimizing Route',
  complete: 'Complete',
  error: 'Error'
};

const STAGE_COLORS = {
  collecting: 'from-blue-500 to-blue-600',
  normalizing: 'from-purple-500 to-purple-600',
  selecting: 'from-green-500 to-green-600', 
  routing: 'from-orange-500 to-orange-600',
  complete: 'from-emerald-500 to-emerald-600',
  error: 'from-red-500 to-red-600'
};

export function OptimizeRouteButton({ tripId, className = '' }: OptimizeRouteButtonProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [connectivity, setConnectivity] = useState({ normalize: false, select: false, route: false });
  
  const { user: currentUser, places, setOptimizationResult, setUser } = useStore();

  // Create a guest user if none exists (for testing)
  React.useEffect(() => {
    if (!currentUser) {
      const guestUser = {
        id: 'guest-user-' + Date.now(),
        name: 'Guest User',
        email: 'guest@example.com',
        isGuest: true,
        isPremium: false
      };
      setUser(guestUser);
    }
  }, [currentUser, setUser]);

  // Get places for current trip
  const tripPlaces = places.filter(place => place.trip_id === tripId || place.tripId === tripId);
  const hasPlaces = tripPlaces.length > 0;
  const isReady = hasPlaces && currentUser && !isOptimizing;
  
  // Debug logging
  useEffect(() => {
    console.log('OptimizeRouteButton Debug:', {
      tripId,
      placesCount: places.length,
      tripPlacesCount: tripPlaces.length,
      hasPlaces,
      currentUser: !!currentUser,
      isOptimizing,
      isReady
    });
  }, [tripId, places.length, tripPlaces.length, hasPlaces, currentUser, isOptimizing, isReady]);

  useEffect(() => {
    checkConnectivity();
    checkExistingOptimization();
  }, [tripId]);

  const checkConnectivity = async () => {
    try {
      const results = await TripOptimizationService.testConnectivity();
      setConnectivity(results);
    } catch (error) {
      console.error('Connectivity check failed:', error);
    }
  };

  const checkExistingOptimization = async () => {
    try {
      // Skip database checks in demo mode - just return no running optimization
      console.log('Skipping optimization status check in demo mode');
      return;
    } catch (error) {
      console.error('Error checking existing optimization:', error);
    }
  };

  const subscribeToProgress = () => {
    const subscription = supabase
      .channel(`optimization_progress_${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'optimization_progress',
        filter: `trip_id=eq.${tripId}`
      }, (payload) => {
        const data = payload.new as any;
        if (data) {
          const progressUpdate: OptimizationProgress = {
            stage: data.stage,
            progress: data.progress_percentage || 0,
            message: data.stage_message || '',
            error: data.error_message
          };
          
          setProgress(progressUpdate);
          
          if (data.stage === 'complete') {
            setIsOptimizing(false);
            setTimeout(() => {
              setShowProgress(false);
              setProgress(null);
            }, 3000);
          } else if (data.stage === 'error') {
            setError(data.error_message || 'Optimization failed');
            setIsOptimizing(false);
            setTimeout(() => {
              setShowProgress(false);
              setProgress(null);
              setError(null);
            }, 5000);
          }
        }
      })
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleOptimize = async () => {
    if (!tripId || !currentUser) {
      setError('Trip ID and user authentication are required');
      return;
    }

    if (!hasPlaces) {
      setError('Please add places to your trip before optimizing');
      return;
    }

    // Execute real optimization process
    setIsOptimizing(true);
    setShowProgress(true);
    setError(null);
    setProgress({ stage: 'collecting', progress: 0, message: 'Starting optimization...' });
    
    // Clear any cached optimization results first
    console.log('🗑️ Clearing cached optimization results before new optimization');
    setOptimizationResult(null);
    
    // Also clear from database (best effort)
    try {
      await supabase
        .from('optimization_results')
        .delete()
        .eq('trip_id', tripId);
      console.log('✅ Cleared database optimization cache');
    } catch (error) {
      console.warn('⚠️ Could not clear database cache (continuing anyway):', error);
    }

    try {
      // Execute real optimization
      const result = await TripOptimizationService.optimizeTrip(
        tripId,
        {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'car' // Use car/flight/walking only
        },
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      if (result.success && result.optimization_result) {
        setOptimizationResult(result.optimization_result);
        
        // Refresh places data to show updated schedule
        const { data: updatedPlaces } = await supabase
          .from('places')
          .select('*')
          .eq('trip_id', tripId);
          
        if (updatedPlaces) {
          // Update store with refreshed places
          const { places: allPlaces } = useStore.getState();
          const otherTripPlaces = allPlaces.filter(p => p.trip_id !== tripId && p.tripId !== tripId);
          useStore.setState({ places: [...otherTripPlaces, ...updatedPlaces] });
        }
      }

      setTimeout(() => {
        setIsOptimizing(false);
        setShowProgress(false);
        setProgress(null);
      }, 1000);

    } catch (error) {
      console.error('Optimization failed:', error);
      setError(error instanceof Error ? error.message : 'Optimization failed');
      setIsOptimizing(false);
      setTimeout(() => {
        setShowProgress(false);
        setProgress(null);
        setError(null);
      }, 5000);
    }
  };

  const getButtonContent = () => {
    if (error) {
      return (
        <>
          <AlertCircle className="w-5 h-5" />
          <span>Error</span>
        </>
      );
    }

    if (isOptimizing && progress) {
      return (
        <>
          <Loader className="w-5 h-5 animate-spin" />
          <span>{STAGE_LABELS[progress.stage] || 'Processing'}</span>
        </>
      );
    }

    if (!hasPlaces) {
      return (
        <>
          <Wand2 className="w-5 h-5" />
          <span>Add Places First</span>
        </>
      );
    }

    return (
      <>
        <Play className="w-5 h-5" />
        <span>Optimize Route</span>
      </>
    );
  };

  const getButtonColor = () => {
    if (error) return 'from-red-500 to-red-600';
    if (isOptimizing && progress) return STAGE_COLORS[progress.stage] || 'from-blue-500 to-blue-600';
    if (!hasPlaces) return 'from-gray-400 to-gray-500';
    return 'from-primary-500 via-secondary-500 to-primary-600';
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      {/* Progress Display */}
      <AnimatePresence>
        {showProgress && progress && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 min-w-[300px]"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Route Optimization
              </h3>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {progress.progress}%
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600 dark:text-slate-300">
                  {STAGE_LABELS[progress.stage] || progress.stage}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {progress.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full bg-gradient-to-r ${STAGE_COLORS[progress.stage] || 'from-blue-500 to-blue-600'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
            
            {/* Status Message */}
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {progress.message}
            </div>
            
            {/* Error Display */}
            {error && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optimize Button */}
      <motion.button
        onClick={handleOptimize}
        disabled={!isReady || isOptimizing}
        className={`
          relative px-6 py-4 rounded-2xl font-semibold text-white shadow-2xl 
          bg-gradient-to-r ${getButtonColor()}
          hover:shadow-3xl hover:scale-105 active:scale-95
          transition-all duration-300 ease-out
          flex items-center space-x-3
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          min-w-[180px] justify-center
        `}
        whileHover={isReady ? { scale: 1.05, y: -2 } : {}}
        whileTap={isReady ? { scale: 0.95 } : {}}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          duration: 0.3 
        }}
      >
        {/* Background Animation */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
        
        {/* Button Content */}
        <div className="relative z-10 flex items-center space-x-3">
          {getButtonContent()}
        </div>

        {/* Loading Pulse Effect */}
        {isOptimizing && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-white/10"
            animate={{ 
              opacity: [0, 0.5, 0],
              scale: [1, 1.02, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </motion.button>
    </div>
  );
}