import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Users, Settings, Wand2, Clock, AlertCircle, List, Sparkles, Camera } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MapView } from '../components/MapView';
import { ListView } from '../components/ListView';
import { CalendarView } from '../components/CalendarView';
import { OptimizationModal } from '../components/OptimizationModal';
import { OptimizationResult } from '../components/OptimizationResult';
import { TripSettingsModal } from '../components/TripSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';

export function TripDetailPage() {
  const [activeView, setActiveView] = useState<'map' | 'list' | 'calendar'>('map');
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tripIcon, setTripIcon] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const { currentTrip, places, trips, isOptimizing, optimizationResult, setOptimizationResult, setIsOptimizing, updateTrip, user, loadPlacesFromAPI, loadOptimizationResult, createSystemPlaces, initializeFromDatabase } = useStore();

  // Initialize data from database if needed
  useEffect(() => {
    const initializeData = async () => {
      try {
        if (trips.length === 0 || places.length === 0) {
          await initializeFromDatabase();
        }
      } catch (error) {
        console.error('Failed to initialize trip data:', error);
      }
    };

    initializeData();
  }, [trips.length, places.length, initializeFromDatabase]);

  // Use current trip - redirect to home if none selected
  if (!currentTrip) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No Trip Selected
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            Please select or create a trip to view details
          </p>
        </div>
      </div>
    );
  }

  const trip = currentTrip;

  // Load places and optimization result on component mount
  useEffect(() => {
    if (trip.id) { // Load for all real trips
      createSystemPlaces?.(trip.id); // Creates system places if they don't exist
      loadPlacesFromAPI?.(trip.id);
      loadOptimizationResult?.(trip.id);
    }
  }, [trip.id, currentTrip, loadPlacesFromAPI, loadOptimizationResult, createSystemPlaces]);

  // Get places for current trip
  const tripPlaces = places.filter(place => 
    trip ? (place.trip_id === trip.id || place.tripId === trip.id) : false
  );
  const hasPlaces = tripPlaces.length > 0;

  // Handle optimization
  const handleOptimization = async () => {
    if (!trip.id || !user) {
      setOptimizationError('Trip ID and user authentication are required');
      return;
    }

    if (!hasPlaces) {
      setOptimizationError('Please add places to your trip before optimizing');
      return;
    }

    // Close modal and start optimization
    setShowOptimizationModal(false);
    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      // Import TripOptimizationService dynamically
      const { TripOptimizationService } = await import('../services/TripOptimizationService');
      
      // Execute real optimization
      const result = await TripOptimizationService.optimizeTrip(
        trip.id,
        {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'car' // Use car/flight/walking only
        },
        (progress) => {
          setOptimizationProgress(progress.progress);
        }
      );

      if (result.success && result.optimization_result) {
        setOptimizationResult(result.optimization_result);
        
        // Refresh places data to show updated schedule
        if (loadPlacesFromAPI) {
          await loadPlacesFromAPI(trip.id);
        }
      } else {
        throw new Error('Optimization failed to return valid results');
      }
    } catch (error) {
      console.error('Optimization failed:', error);
      setOptimizationError(error instanceof Error ? error.message : 'Optimization failed');
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress(0);
    }
  };

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setTripIcon(result);
        if (currentTrip) {
          updateTrip(currentTrip.id, { icon: result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const end = new Date(endDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${start} - ${end}`;
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;
    
    return {
      text: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      isExpired
    };
  };

  const formatDeadlineCompact = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;
    
    return {
      text: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      isExpired
    };
  };

  const viewOptions = [
    { 
      key: 'map', 
      label: 'Map', 
      icon: MapPin, 
      gradient: 'from-emerald-500 to-teal-600',
      bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20'
    },
    { 
      key: 'list', 
      label: 'Timeline', 
      icon: List, 
      gradient: 'from-purple-500 to-violet-600',
      bgColor: 'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20'
    },
    { 
      key: 'calendar', 
      label: 'Calendar', 
      icon: Calendar, 
      gradient: 'from-orange-500 to-amber-600',
      bgColor: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
    },
  ];

  const deadline = trip.addPlaceDeadline ? formatDeadline(trip.addPlaceDeadline) : null;
  const deadlineCompact = trip.addPlaceDeadline ? formatDeadlineCompact(trip.addPlaceDeadline) : null;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Fixed Trip Header - Proper spacing from top */}
      <div className="relative mt-16 p-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-5 -right-5 w-16 h-16 bg-gradient-to-br from-primary-400/10 to-secondary-500/10 rounded-full blur-xl"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                {/* Trip Icon with Upload */}
                <div className="relative group">
                  <motion.div
                    className="w-12 h-12 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-soft overflow-hidden relative"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  >
                    {trip.icon ? (
                      <img 
                        src={trip.icon} 
                        alt="Trip Icon" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Sparkles className="w-6 h-6 text-white" />
                    )}
                    
                    {/* Upload Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </motion.div>
                  
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIconUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {/* Upload Tooltip */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
                    Upload Icon
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                      {trip.name}
                    </h1>
                    {/* Settings Button */}
                    <motion.button
                      onClick={() => setShowSettingsModal(true)}
                      className="p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300 group"
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Settings className="w-5 h-5 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                    </motion.button>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    {trip.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-sm text-slate-600 dark:text-slate-400">
              <motion.div 
                className="flex items-center space-x-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
                whileHover={{ scale: 1.02 }}
              >
                <MapPin className="w-4 h-4 text-primary-500" />
                <span className="font-medium">From: {trip.departureLocation}</span>
              </motion.div>
              {trip.destination && (
                <motion.div 
                  className="flex items-center space-x-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
                  whileHover={{ scale: 1.02 }}
                >
                  <MapPin className="w-4 h-4 text-secondary-500" />
                  <span className="font-medium">To: {trip.destination}</span>
                </motion.div>
              )}
              {trip.startDate && trip.endDate && (
                <motion.div 
                  className="flex items-center space-x-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
                  whileHover={{ scale: 1.02 }}
                >
                  <Calendar className="w-4 h-4 text-accent-500" />
                  <span className="font-medium">{formatDateRange(trip.startDate, trip.endDate)}</span>
                </motion.div>
              )}
              <motion.div 
                className="flex items-center space-x-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
                whileHover={{ scale: 1.02 }}
              >
                <Users className="w-4 h-4 text-green-500" />
                <span className="font-medium">{trip.memberCount}</span>
              </motion.div>
            </div>

            {/* Compact Deadline Display */}
            {deadlineCompact && (
              <motion.div 
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm border ${
                  deadlineCompact.isExpired
                    ? 'bg-red-50/80 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50'
                    : 'bg-amber-50/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/50'
                }`}
                whileHover={{ scale: 1.02 }}
              >
                <Clock className="w-3 h-3" />
                <span>{deadlineCompact.isExpired ? 'Expired' : deadlineCompact.text}</span>
              </motion.div>
            )}
          </div>

          {/* Full Deadline Warning - Compact */}
          {deadline && (deadline.isExpired || new Date(trip.addPlaceDeadline!).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-3 p-3 rounded-xl border backdrop-blur-sm ${
                deadline.isExpired
                  ? 'bg-red-50/80 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/50'
                  : 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className={`w-4 h-4 ${
                  deadline.isExpired ? 'text-red-500' : 'text-amber-500'
                }`} />
                <span className={`text-sm font-semibold ${
                  deadline.isExpired 
                    ? 'text-red-700 dark:text-red-300' 
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {deadline.isExpired 
                    ? `Deadline expired: ${deadline.text}`
                    : `Deadline: ${deadline.text}`
                  }
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div className="relative p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex justify-center">
          <div className="bg-slate-100/80 dark:bg-slate-700/80 rounded-2xl p-1 flex backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50">
            {viewOptions.map(({ key, label, icon: Icon, gradient }) => (
              <motion.button
                key={key}
                onClick={() => setActiveView(key as any)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center space-x-2 ${
                  activeView === key
                    ? 'text-white shadow-soft'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Active Background */}
                {activeView === key && (
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-xl`}
                    layoutId="activeViewBg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content with Enhanced Transitions */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: 20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="h-full"
          >
            {activeView === 'map' && <MapView />}
            {activeView === 'list' && <ListView />}
            {activeView === 'calendar' && <CalendarView />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Route Optimization Button - FIXED POSITION: Exactly same as My Places Add Button */}
      <div className="fixed bottom-20 right-4 z-40">
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={hasPlaces ? handleOptimization : () => setOptimizationError('Please add places to your trip before optimizing')}
          className={`w-14 h-14 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden group ${
            isOptimizing
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : 'bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600'
          }`}
        >
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
              {/* Circular Progress Ring */}
              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                {/* Background Circle */}
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="2"
                />
                {/* Progress Circle */}
                <motion.circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 12 }}
                  animate={{ 
                    strokeDashoffset: 2 * Math.PI * 12 * (1 - optimizationProgress / 100)
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </svg>
              {/* Center Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <Wand2 className="w-6 h-6 text-white relative z-10" />
          )}

          {/* Enhanced Tooltip */}
          <div className="absolute right-full mr-3 px-3 py-2 bg-slate-900/90 dark:bg-slate-700/90 backdrop-blur-sm text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none shadow-glow border border-slate-700/50">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold">
                {isOptimizing ? `Optimizing ${optimizationProgress}%` : 'Optimize Route'}
              </span>
            </div>
            <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-slate-900/90 dark:border-l-slate-700/90"></div>
          </div>
        </motion.button>
      </div>

      {/* Modals */}
      <OptimizationModal
        isOpen={showOptimizationModal}
        onClose={() => setShowOptimizationModal(false)}
        tripId={currentTrip?.id || ''}
      />
      <TripSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      
      {/* Optimization Result Display */}
      <AnimatePresence>
        {optimizationResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setOptimizationResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-4xl max-h-[90vh] w-full overflow-y-auto"
            >
              <OptimizationResult
                result={optimizationResult}
                onClose={() => setOptimizationResult(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}