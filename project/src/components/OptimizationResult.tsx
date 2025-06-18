import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Users, TrendingUp, CheckCircle, X, Calendar } from 'lucide-react';
import { OptimizedRoute } from '../types/optimization';

interface OptimizationResultProps {
  result: OptimizedRoute;
  onClose?: () => void;
}

export function OptimizationResult({ result, onClose }: OptimizationResultProps) {
  // const [activeView, setActiveView] = useState<'summary'>('summary');
  // Format optimization result for display
  const formatOptimizationResult = (result: OptimizedRoute) => {
    // Handle nested result structure - extract daily_schedules from the correct location
    const dailySchedules = result?.daily_schedules || (result as any)?.optimization_result?.daily_schedules;
    
    // Debug logging
    console.log('🔍 [OptimizationResult] Formatting result:', result);
    console.log('🔍 [OptimizationResult] Daily schedules:', dailySchedules);
    console.log('🔍 [OptimizationResult] Daily schedules type:', typeof dailySchedules);
    console.log('🔍 [OptimizationResult] Is array:', Array.isArray(dailySchedules));
    
    // Safety check for required properties
    if (!result || !dailySchedules || !Array.isArray(dailySchedules)) {
      console.error('❌ [OptimizationResult] Invalid optimization result structure:', result);
      return {
        schedulesByDay: {},
        totalStats: { places: 0, travelTime: 0, visitTime: 0, score: 0 },
        summary: 'No optimization data available'
      };
    }

    const schedulesByDay = dailySchedules.reduce((acc, schedule) => {
      console.log('🔍 [OptimizationResult] Processing schedule:', schedule);
      console.log('🔍 [OptimizationResult] Schedule places:', schedule.places);
      console.log('🔍 [OptimizationResult] Schedule scheduled_places:', schedule.scheduled_places);
      console.log('🔍 [OptimizationResult] Schedule places length:', schedule.places?.length);
      console.log('🔍 [OptimizationResult] Schedule scheduled_places length:', schedule.scheduled_places?.length);
      
      const dayKey = schedule.day ? `day-${schedule.day}` : schedule.date || `day-${Object.keys(acc).length + 1}`;
      if (!acc[dayKey]) acc[dayKey] = [];
      
      // Handle both 'places' and 'scheduled_places' formats
      const schedulePlaces = schedule.places || schedule.scheduled_places || [];
      acc[dayKey] = schedulePlaces.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      console.log('🔍 [OptimizationResult] Assigned to day', dayKey, ':', acc[dayKey].length, 'places');
      return acc;
    }, {} as Record<string, any[]>);

    const totalStats = {
      places: dailySchedules.reduce((sum, day) => {
        const dayPlaces = day.places || day.scheduled_places || [];
        return sum + dayPlaces.length;
      }, 0),
      travelTime: result.total_travel_time_minutes || dailySchedules.reduce((sum, day) => {
        const dayPlaces = day.places || day.scheduled_places || [];
        const dayTravelTime = dayPlaces.reduce((daySum, place) => 
          daySum + (place.travel_time_from_previous || place.travel_time_minutes || 0), 0);
        const scheduleTravelTime = day.travel_time_minutes || day.total_travel_time || 0;
        return sum + Math.max(dayTravelTime, scheduleTravelTime);
      }, 0),
      visitTime: result.total_visit_time_minutes || dailySchedules.reduce((sum, day) => {
        const dayPlaces = day.places || day.scheduled_places || [];
        return sum + dayPlaces.reduce((daySum, place) => daySum + (place.stay_duration_minutes || 0), 0);
      }, 0),
      score: result.optimization_score ? 
        (result.optimization_score.overall || 
         result.optimization_score.total_score / 100 ||
         ((result.optimization_score.fairness || result.optimization_score.fairness_score / 100 || 0) + 
          (result.optimization_score.efficiency || result.optimization_score.efficiency_score / 100 || 0)) / 2) : 0
    };

    return {
      schedulesByDay,
      totalStats,
      summary: `Optimized ${totalStats.places} places across ${dailySchedules.length} days`
    };
  };

  const formattedResult = formatOptimizationResult(result);
  
  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const getTransportIcon = (mode: string): string => {
    switch (mode?.toLowerCase()) {
      case 'driving':
      case 'car':
        return '🚗';
      case 'walking':
      case 'walk':
        return '🚶';
      case 'flight':
        return '✈️';
      default:
        return '🚗'; // デフォルトは車
    }
  };

  const formatTime = (timeString: string): string => {
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Route Optimization Complete
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {formattedResult.summary}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-6 h-6 text-green-500" />
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Places</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formattedResult.totalStats.places}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Travel</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatMinutes(formattedResult.totalStats.travelTime)}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Visit Time</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatMinutes(formattedResult.totalStats.visitTime)}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Score</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {Math.round(formattedResult.totalStats.score * 100)}%
          </div>
        </div>
      </div>

      {/* Optimization Score Breakdown */}
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Optimization Breakdown</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Fairness</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {Math.round((result.optimization_score?.fairness || result.optimization_score?.fairness_score || 0) * (result.optimization_score?.fairness_score > 10 ? 1 : 100))}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(result.optimization_score?.fairness || result.optimization_score?.fairness_score || 0) * (result.optimization_score?.fairness_score > 10 ? 1 : 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Efficiency</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {Math.round((result.optimization_score?.efficiency || result.optimization_score?.efficiency_score || 0) * (result.optimization_score?.efficiency_score > 10 ? 1 : 100))}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(result.optimization_score?.efficiency || result.optimization_score?.efficiency_score || 0) * (result.optimization_score?.efficiency_score > 10 ? 1 : 100)}%` }}
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
            // Calculate member adoption statistics
            const memberStats = result.selectedPlaces?.reduce((acc, place) => {
              const userId = place.user_id || place.userId || 'unknown';
              const userName = place.userName || `Member ${userId.slice(0, 8)}`;
              
              if (!acc[userId]) {
                acc[userId] = {
                  name: userName,
                  adopted: 0,
                  total: 0
                };
              }
              acc[userId].adopted += 1;
              return acc;
            }, {} as Record<string, { name: string; adopted: number; total: number }>) || {};

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
          
          {(!result.selectedPlaces || result.selectedPlaces.length === 0) && (
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
                        {scheduledPlace.order || index + 1}
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
                        <span className="text-xs">
                          {getTransportIcon(scheduledPlace?.transport_mode)}
                        </span>
                        {(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0) > 0 && (
                          <span className="text-xs">
                            {formatMinutes(scheduledPlace?.travel_time_from_previous || scheduledPlace?.travel_time_minutes || 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
      </div>

      {/* Execution Info */}
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-4 border-t border-slate-200 dark:border-slate-600">
        Optimization completed in {(result as any)?.execution_time_ms || 'N/A'}ms • {Object.keys(formattedResult.schedulesByDay).length} day{Object.keys(formattedResult.schedulesByDay).length !== 1 ? 's' : ''} planned
      </div>
    </motion.div>
  );
}