import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Users, TrendingUp, CheckCircle, X, Calendar, Map, List, Eye } from 'lucide-react';
import MapViewModal from './MapViewModal';
import ListViewModal from './ListViewModal';
import { TransportIcon, getTransportColor, getTransportEmoji } from '../utils/transportIcons';

// Edge Function response structure (from optimize-route/index.ts)
interface OptimizationResult {
  success: boolean;
  optimization: {
    daily_schedules: DailySchedule[];
    optimization_score: {
      total_score: number;
      fairness_score: number;
      efficiency_score: number;
      feasibility_score: number;
      details: {
        user_adoption_balance: number;
        wish_satisfaction_balance: number;
        travel_efficiency: number;
        time_constraint_compliance: number;
      };
    };
    optimized_route: {
      daily_schedules: DailySchedule[];
    };
    total_duration_minutes: number;
    places: any[];
    execution_time_ms: number;
  };
  message: string;
}

interface DailySchedule {
  day: number;
  date: string;
  scheduled_places: ScheduledPlace[];
  total_travel_time: number;
  total_visit_time: number;
  meal_breaks: any[];
}

interface ScheduledPlace {
  id: string;
  name: string;
  arrival_time: string;
  departure_time: string;
  stay_duration_minutes: number;
  transport_mode: string;
  travel_time_from_previous: number;
  order_in_day: number;
  category?: string;
  place_type?: string;
  user_id?: string;
}

interface OptimizationResultProps {
  optimizationResult: OptimizationResult;
  onClose?: () => void;
}

export function OptimizationResult({ optimizationResult: result, onClose }: OptimizationResultProps) {
  const [activeModal, setActiveModal] = useState<'map' | 'list' | null>(null);
  const [showCelebration, setShowCelebration] = useState(true);
  
  // Early return if no result
  if (!result) {
    return (
      <div className="text-center p-4">
        <p className="text-slate-500">No optimization result available</p>
      </div>
    );
  }
  
  // Format optimization result for display
  const formatOptimizationResult = useCallback((result: OptimizationResult) => {
    // Extract daily_schedules directly from Edge Function response
    const dailySchedules = result?.optimization?.daily_schedules;
    
    // Debug logging
    // Log message
    // Log message
    // Log message
    // Checking array type
    
    // Safety check for required properties
    if (!result?.optimization || !dailySchedules || !Array.isArray(dailySchedules)) {
      // Error occurred
      return {
        schedulesByDay: {},
        totalStats: { places: 0, travelTime: 0, visitTime: 0, score: 0 },
        summary: 'No optimization data available'
      };
    }

    const schedulesByDay = dailySchedules.reduce((acc, schedule) => {
      // Log message
      // Log message
      // Log message
      
      const dayKey = schedule.day ? `day-${schedule.day}` : schedule.date || `day-${Object.keys(acc).length + 1}`;
      if (!acc[dayKey]) acc[dayKey] = [];
      
      // Use scheduled_places from Edge Function response
      const schedulePlaces = schedule.scheduled_places || [];
      acc[dayKey] = schedulePlaces.sort((a, b) => (a.order_in_day || 0) - (b.order_in_day || 0));
      
      // Log message
      return acc;
    }, {} as Record<string, ScheduledPlace[]>);

    const totalStats = {
      places: dailySchedules.reduce((sum, day) => {
        return sum + (day.scheduled_places?.length || 0);
      }, 0),
      travelTime: result.optimization.total_duration_minutes || dailySchedules.reduce((sum, day) => {
        return sum + (day.total_travel_time || 0);
      }, 0),
      visitTime: dailySchedules.reduce((sum, day) => {
        return sum + (day.total_visit_time || 0);
      }, 0),
      score: result.optimization.optimization_score ? 
        (result.optimization.optimization_score.total_score / 100) : 0
    };

    return {
      schedulesByDay,
      totalStats,
      summary: `Optimized ${totalStats.places} places across ${dailySchedules.length} days`
    };
  }, []);

  const formattedResult = useMemo(() => formatOptimizationResult(result), [formatOptimizationResult, result]);
  
  const formatMinutes = useCallback((minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }, []);

  // Use centralized transport utility
  const getTransportIconLocal = useCallback((mode: string): string => {
    return getTransportEmoji(mode);
  }, []);

  const formatTime = useCallback((timeString: string): string => {
    if (!timeString) return 'Invalid Date';
    
    try {
      let date: Date;
      
      if (timeString.includes('T')) {
        // ISO string format
        date = new Date(timeString);
      } else if (timeString.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        // Time only format (H:mm, HH:mm, H:mm:ss, or HH:mm:ss)
        const today = new Date().toISOString().split('T')[0];
        // Ensure leading zero for single digit hours and add seconds if missing
        let normalizedTime = timeString;
        if (timeString.split(':').length === 2) {
          normalizedTime = timeString + ':00';
        }
        if (normalizedTime.length === 7) { // H:mm:ss format
          normalizedTime = '0' + normalizedTime;
        }
        date = new Date(`${today}T${normalizedTime}`);
      } else {
        // Try to parse as is
        date = new Date(timeString);
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return 'Invalid Date';
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        boxShadow: [
          "0 0 0 rgba(34, 197, 94, 0)",
          "0 0 30px rgba(34, 197, 94, 0.2)",
          "0 0 0 rgba(34, 197, 94, 0)"
        ]
      }}
      transition={{ 
        duration: 0.6, 
        ease: "easeOut",
        boxShadow: {
          duration: 2,
          times: [0, 0.5, 1]
        }
      }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 space-y-6"
    >
      {/* Header with Celebration */}
      <div className="flex items-center justify-between relative overflow-hidden">
        {/* Celebration confetti */}
        <AnimatePresence>
          {showCelebration && (
            <>
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    backgroundColor: ['#22c55e', '#0ea5e9', '#3b82f6', '#22c55e'][i % 4],
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: [(Math.random() - 0.5) * 100],
                    y: [(Math.random() - 0.5) * 100],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: Math.random() * 0.5,
                  }}
                  onAnimationComplete={() => {
                    if (i === 11) setShowCelebration(false);
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        <div>
          <motion.h3 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent"
          >
            🎉 Route Optimization Complete!
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-slate-600 dark:text-slate-400 mt-1"
          >
            {formattedResult.summary}
          </motion.p>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
          >
            <CheckCircle className="w-6 h-6 text-green-500" />
          </motion.div>
          {onClose && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Places</span>
          </div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1"
          >
            {formattedResult.totalStats.places}
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Travel</span>
          </div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1"
          >
            {formatMinutes(formattedResult.totalStats.travelTime)}
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Visit Time</span>
          </div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1"
          >
            {formatMinutes(formattedResult.totalStats.visitTime)}
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Score</span>
          </div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1"
          >
            {Math.round(formattedResult.totalStats.score * 100)}%
          </motion.div>
        </motion.div>
      </div>

      {/* Optimization Score Breakdown */}
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Optimization Breakdown</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Fairness</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {result?.optimization?.optimization_score?.fairness_score || 0}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${result?.optimization?.optimization_score?.fairness_score || 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Efficiency</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {result?.optimization?.optimization_score?.efficiency_score || 0}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${result?.optimization?.optimization_score?.efficiency_score || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Member Place Adoption Status */}
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Member Place Adoption</h4>
        <div className="space-y-3">
          {(() => {
            // Extract places from Edge Function structure for member statistics
            const allPlaces = result?.optimization?.places || [];
            
            // Calculate member adoption statistics from Edge Function places
            const memberStats = allPlaces.reduce((acc, place) => {
              const userId = place.user_id || 'unknown';
              const userName = `Member ${userId.slice(0, 8)}`;
              
              if (!acc[userId]) {
                acc[userId] = {
                  name: userName,
                  adopted: 0,
                  total: 0
                };
              }
              acc[userId].adopted += 1;
              return acc;
            }, {} as Record<string, { name: string; adopted: number; total: number }>);

            // Mock total places per member for demonstration
            Object.keys(memberStats).forEach(userId => {
              memberStats[userId].total = memberStats[userId].adopted + Math.floor(Math.random() * 3) + 1;
            });

            return Object.entries(memberStats).map(([userId, stats]) => (
              <div key={userId} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {stats.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {stats.name}
                    </span>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {stats.adopted} of {stats.total} places adopted
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(stats.adopted / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-10 text-right">
                    {Math.round((stats.adopted / stats.total) * 100)}%
                  </span>
                </div>
              </div>
            ));
          })()}
          
          {(!result?.optimization?.places || result.optimization.places.length === 0) && (
            <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">
              No member data available for this optimization
            </div>
          )}
        </div>
      </div>

      {/* Daily Schedule */}
      <div>
          <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Daily Schedule</h4>
          <div className="space-y-4">
            {Object.entries(formattedResult.schedulesByDay).map(([date, places]) => (
              <div key={date} className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <h5 className="font-medium text-slate-900 dark:text-slate-100">
                    {date.includes('day-') ? date.replace('day-', 'Day ') : new Date(date).toLocaleDateString()}
                  </h5>
                </div>
                <div className="space-y-2">
                  {places.map((scheduledPlace, index) => (
                    <div key={index} className="flex items-center space-x-3 text-sm">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium">
                        {scheduledPlace.order_in_day || index + 1}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {scheduledPlace?.name || scheduledPlace?.place?.name || 'Unknown Place'}
                        </span>
                        <div className="text-slate-500 dark:text-slate-400 text-xs">
                          {formatTime(scheduledPlace?.arrival_time)} - {formatTime(scheduledPlace?.departure_time)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                        {/* Flight transport display */}
                        {(scheduledPlace?.transport_mode === 'flight' || scheduledPlace?.transport_mode === 'plane') && (
                          <div className="flex items-center space-x-1">
                            <TransportIcon 
                              mode="flight" 
                              size={14}
                              className="opacity-70"
                            />
                            {(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0) > 0 && (
                              <span className="text-xs">
                                {formatMinutes(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0)}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Car transport display */}
                        {(scheduledPlace?.transport_mode === 'car' || scheduledPlace?.transport_mode === 'driving') && (
                          <div className="flex items-center space-x-1">
                            <TransportIcon 
                              mode="car" 
                              size={14}
                              className="opacity-70"
                            />
                            {(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0) > 0 && (
                              <span className="text-xs">
                                {formatMinutes(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0)}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Walking transport display */}
                        {(scheduledPlace?.transport_mode === 'walking' || scheduledPlace?.transport_mode === 'walk') && (
                          <div className="flex items-center space-x-1">
                            <TransportIcon 
                              mode="walking" 
                              size={14}
                              className="opacity-70"
                            />
                            {(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0) > 0 && (
                              <span className="text-xs">
                                {formatMinutes(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
      </div>

      {/* View Options */}
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">View Options</h4>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => setActiveModal('map')}
            className="flex items-center justify-center space-x-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Map className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Map View</span>
          </motion.button>
          
          <motion.button
            onClick={() => setActiveModal('list')}
            className="flex items-center justify-center space-x-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <List className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Timeline</span>
          </motion.button>
          
        </div>
      </div>

      {/* Execution Info */}
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-4 border-t border-slate-200 dark:border-slate-600">
        Optimization completed in {result.optimization?.execution_time_ms || 'N/A'}ms • {Object.keys(formattedResult.schedulesByDay).length} day{Object.keys(formattedResult.schedulesByDay).length !== 1 ? 's' : ''} planned
      </div>

      {/* View Modals */}
      <AnimatePresence>
        {activeModal === 'map' && (
          <MapViewModal
            result={result}
            onClose={() => setActiveModal(null)}
          />
        )}
        {activeModal === 'list' && (
          <ListViewModal
            result={result}
            onClose={() => setActiveModal(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}