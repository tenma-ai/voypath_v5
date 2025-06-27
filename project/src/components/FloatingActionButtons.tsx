import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

export function FloatingActionButtons() {
  const location = useLocation();
  const { currentTrip, places, user, isOptimizing, setIsOptimizing, setOptimizationResult, setHasUserOptimized, setShowOptimizationSuccess } = useStore();
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  // Check if deadline has passed
  const isDeadlinePassed = () => {
    if (!currentTrip?.addPlaceDeadline) return false;
    return new Date() > new Date(currentTrip.addPlaceDeadline);
  };

  // Get places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );
  const hasPlaces = tripPlaces.length > 0;

  // Handle optimization
  const handleOptimization = async () => {
    if (!currentTrip?.id || !user) {
      setOptimizationError('Trip ID and user authentication are required');
      return;
    }

    if (!hasPlaces) {
      setOptimizationError('Please add places to your trip before optimizing');
      return;
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      console.log('🔍 [FloatingActionButtons] Starting optimization trigger - setting hasUserOptimized to true');
      setHasUserOptimized(true);
      
      // Import TripOptimizationService dynamically
      const { TripOptimizationService } = await import('../services/TripOptimizationService');
      
      // Execute real optimization
      const result = await TripOptimizationService.optimizeTrip(
        currentTrip.id,
        {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'car'
        },
        (progress) => {
          console.log('Optimization progress:', progress);
        }
      );

      if (result.success && result.optimization) {
        console.log('✅ Optimization successful!', result);
        setOptimizationResult(result);
        setShowOptimizationSuccess(true); // Trigger success animation
      } else {
        console.error('❌ Optimization failed:', result.error);
        setOptimizationError(result.error || 'Optimization failed');
      }
    } catch (error) {
      console.error('❌ Optimization error:', error);
      setOptimizationError(error instanceof Error ? error.message : 'An error occurred during optimization');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Don't show buttons on certain pages
  const hiddenPaths = ['/', '/profile', '/premium-success', '/premium-cancel', '/add-place'];
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }
  
  // Check if we're on Plan or Places page
  const isPlanPage = location.pathname === '/my-trip';
  const isPlacesPage = location.pathname === '/my-trip/my-places';

  return (
    <>
      {/* Optimize Route Button - Bottom position */}
      <motion.button
        className="fixed bottom-20 right-4 z-40"
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={hasPlaces ? handleOptimization : () => setOptimizationError('Please add places to your trip before optimizing')}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className={`w-14 h-14 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden group ${
          isOptimizing
            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
            : 'bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Sparkle effects */}
          <div className="absolute inset-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white rounded-full"
                style={{
                  left: `${25 + i * 25}%`,
                  top: `${25 + i * 20}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.7,
                }}
              />
            ))}
          </div>

          {isOptimizing ? (
            <div className="relative w-8 h-8 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6"
              >
                <Wand2 className="w-6 h-6 text-white" />
              </motion.div>
            </div>
          ) : (
            <Wand2 className="w-6 h-6 text-white relative z-10" />
          )}
          
          {/* Tooltip */}
          <div className="absolute right-full mr-3 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
            Optimize Route
            <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-slate-700"></div>
          </div>
        </div>
      </motion.button>

      {/* Add Place Button - Top position, only show if deadline hasn't passed */}
      {!isDeadlinePassed() && (
        <Link
          to="/add-place"
          className="fixed bottom-36 right-4 z-40"
        >
          <motion.div
            className="w-14 h-14 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center group relative overflow-hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <Plus className="w-6 h-6 text-white relative z-10" />
            
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
              Add
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-slate-700"></div>
            </div>
          </motion.div>
        </Link>
      )}

      {/* Error notification */}
      {optimizationError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-44 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg max-w-xs"
        >
          {optimizationError}
        </motion.div>
      )}
    </>
  );
}