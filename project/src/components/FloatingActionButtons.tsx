import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

export function FloatingActionButtons() {
  const location = useLocation();
  const { currentTrip, places, user, isOptimizing, setIsOptimizing, setOptimizationResult, setHasUserOptimized, setShowOptimizationSuccess, hasUserOptimized } = useStore();
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [shouldBlinkPlusButton, setShouldBlinkPlusButton] = useState(false);
  const [shouldBlinkOptimizeButton, setShouldBlinkOptimizeButton] = useState(false);

  // Check if deadline has passed
  const isDeadlinePassed = () => {
    if (!currentTrip?.addPlaceDeadline) return false;
    return new Date() > new Date(currentTrip.addPlaceDeadline);
  };

  // Check if plus button should blink for first time guidance
  useEffect(() => {
    if (!currentTrip || !user || !places) return;

    // Check if this is the first time for this user in this trip
    const guidanceKey = `firstTimeGuidance_${user.id}_${currentTrip.id}`;
    const hasSeenGuidance = localStorage.getItem(guidanceKey);
    
    // Get user's places for this trip
    const userPlaces = places.filter(place => 
      place.user_id === user.id && 
      place.source !== 'system' // Exclude departure/destination places
    );
    
    // Blink if no places exist and user hasn't seen guidance
    setShouldBlinkPlusButton(!hasSeenGuidance && userPlaces.length === 0);
  }, [currentTrip?.id, user?.id, places]);

  // Check if optimize button should blink
  useEffect(() => {
    if (!currentTrip || !user || !places) return;

    // Check if this is the first time for optimize guidance
    const optimizeGuidanceKey = `optimizeGuidance_${user.id}_${currentTrip.id}`;
    const hasSeenOptimizeGuidance = localStorage.getItem(optimizeGuidanceKey);
    
    // Get user's places for this trip (excluding system places)
    const userPlaces = places.filter(place => 
      place.user_id === user.id && 
      place.source !== 'system' // Exclude departure/destination places
    );
    
    // Blink if user has places but hasn't optimized yet and hasn't seen guidance
    setShouldBlinkOptimizeButton(
      !hasSeenOptimizeGuidance && 
      userPlaces.length > 0 && 
      !hasUserOptimized
    );
  }, [currentTrip?.id, user?.id, places, hasUserOptimized]);

  // Get places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );
  const hasPlaces = tripPlaces.length > 0;

  // Get user's places for this trip (excluding system places like departure/destination)
  const userPlaces = places.filter(place => 
    currentTrip && 
    (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) &&
    place.user_id === user?.id && 
    place.source !== 'system'
  );
  const hasUserPlaces = userPlaces.length > 0;


  // Handle optimization
  const handleOptimization = async () => {
    if (!currentTrip?.id || !user) {
      setOptimizationError('Trip ID and user authentication are required');
      return;
    }

    if (!hasUserPlaces) {
      setOptimizationError('Please add places to your trip before optimizing');
      return;
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      // Log message
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
          // Log message
        }
      );

      if (result.success && result.optimization) {
        // Log message
        setOptimizationResult(result);
        setShowOptimizationSuccess(true); // Trigger success animation
      } else {
        // Error occurred
        setOptimizationError(result.error || 'Optimization failed');
      }
    } catch (error) {
      // Error occurred
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
  
  // Early return if essential data is not available
  if (!currentTrip || !user || (!isPlanPage && !isPlacesPage)) {
    return null;
  }

  return (
    <>
      {/* Optimize Route Button - Bottom position */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-center">
        <div className="fixed bottom-20 right-4 z-40 flex flex-col items-center">
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            if (shouldBlinkOptimizeButton && currentTrip && user) {
              const optimizeGuidanceKey = `optimizeGuidance_${user.id}_${currentTrip.id}`;
              localStorage.setItem(optimizeGuidanceKey, 'true');
              setShouldBlinkOptimizeButton(false);
            }
            if (hasUserPlaces) {
              handleOptimization();
            } else {
              setOptimizationError('Please add places to your trip before optimizing');
            }
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={shouldBlinkOptimizeButton ? {
            opacity: [1, 0.5, 1],
            scale: [1, 1.1, 1],
            y: [0, -5, 0]
          } : { opacity: 1, scale: 1 }}
          transition={shouldBlinkOptimizeButton ? {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          } : { duration: 0.3, delay: 0.3 }}
        >
          <div className={`w-14 h-14 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden group ${
            isOptimizing
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : hasUserPlaces
              ? 'bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600'
              : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 opacity-60'
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
              <>
                <Wand2 className="w-6 h-6 text-white relative z-10" />
                {/* Circular Text */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56">
                  <defs>
                    <path
                      id="circle-path"
                      d="M 28 28 m -20 0 a 20 20 0 1 1 40 0 a 20 20 0 1 1 -40 0"
                    />
                  </defs>
                  <text className="text-[6px] fill-white font-medium" style={{ letterSpacing: '0.5px' }}>
                    <textPath href="#circle-path" startOffset="12.5%">
                      OPTIMIZE
                    </textPath>
                  </text>
                </svg>
              </>
            )}
          </div>
        </motion.button>
        
        </div>

      {/* Add Place Button - Top position, show if deadline hasn't passed */}
      {!isDeadlinePassed() && (
        <Link
          to="/add-place"
          className="fixed bottom-36 right-4 z-40"
          onClick={() => {
            if (shouldBlinkPlusButton && currentTrip && user) {
              const guidanceKey = `firstTimeGuidance_${user.id}_${currentTrip.id}`;
              localStorage.setItem(guidanceKey, 'true');
              setShouldBlinkPlusButton(false);
            }
          }}
        >
          <motion.div
            className="w-14 h-14 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center group relative overflow-hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={shouldBlinkPlusButton ? {
              opacity: [1, 0.5, 1],
              scale: [1, 1.1, 1],
              boxShadow: [
                '0 0 20px rgba(99, 102, 241, 0.5)',
                '0 0 30px rgba(99, 102, 241, 0.8)',
                '0 0 20px rgba(99, 102, 241, 0.5)'
              ]
            } : { opacity: 1, scale: 1 }}
            transition={shouldBlinkPlusButton ? {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            } : { duration: 0.3, delay: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <Plus className="w-6 h-6 text-white relative z-10" />
            
            {/* Circular Text */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56">
              <defs>
                <path
                  id="add-circle-path"
                  d="M 28 28 m -20 0 a 20 20 0 1 1 40 0 a 20 20 0 1 1 -40 0"
                />
              </defs>
              <text className="text-[5.5px] fill-white font-medium" style={{ letterSpacing: '0.3px' }}>
                <textPath href="#add-circle-path" startOffset="9%">
                  ADD PLACES
                </textPath>
              </text>
            </svg>
            
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