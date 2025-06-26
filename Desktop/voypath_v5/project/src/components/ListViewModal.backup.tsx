import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  MapPin, 
  Users, 
  ChevronRight, 
  Calendar as CalendarIcon,
  X,
  Car,
  Plane,
  User
} from 'lucide-react';

const transportIcons = {
  walking: User,
  car: Car,
  flight: Plane,
  default: Car
};

const transportColors = {
  walking: '#FCD34D', // Yellow
  car: '#10B981',     // Green  
  flight: '#3B82F6',  // Blue
  default: '#6B7280'  // Gray
};

interface ListViewModalProps {
  result: any;
  onClose: () => void;
}

export function ListViewModal({ result, onClose }: ListViewModalProps) {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [expandedPlaces, setExpandedPlaces] = useState<Set<string>>(new Set());

  // Extract daily schedules from optimization result
  const dailySchedules = useMemo(() => {
    if (!result?.optimization?.daily_schedules) return [];
    return result.optimization.daily_schedules;
  }, [result]);

  const selectedSchedule = useMemo(() => {
    return dailySchedules.find((schedule: any) => schedule.day === selectedDay) || dailySchedules[0];
  }, [dailySchedules, selectedDay]);

  const togglePlaceExpansion = (placeId: string) => {
    setExpandedPlaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(placeId)) {
        newSet.delete(placeId);
      } else {
        newSet.add(placeId);
      }
      return newSet;
    });
  };

  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    
    try {
      if (timeString.includes('T')) {
        return new Date(timeString).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      } else if (timeString.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        const [hour, minute] = timeString.split(':');
        return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      }
      return timeString;
    } catch {
      return timeString;
    }
  };

  const formatDuration = (minutes: number): string => {
    if (!minutes) return '0min';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const getTransportIcon = (mode: string) => {
    const IconComponent = transportIcons[mode as keyof typeof transportIcons] || transportIcons.default;
    return IconComponent;
  };

  const getTransportColor = (mode: string): string => {
    return transportColors[mode as keyof typeof transportColors] || transportColors.default;
  };

  const getMemberColor = (userId?: string): string => {
    if (!userId) return '#9CA3AF';
    // Generate a consistent color based on user ID
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981'];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Trip Timeline
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-4rem)]">
          {/* Day Selector */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dailySchedules.map((schedule: any) => (
                <button
                  key={schedule.day}
                  onClick={() => setSelectedDay(schedule.day)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedDay === schedule.day
                      ? 'bg-primary-500 text-white shadow-glow'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <div>Day {schedule.day}</div>
                  <div className="text-xs opacity-75">
                    {schedule.scheduled_places?.length || 0} places
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {selectedSchedule && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Day {selectedSchedule.day} Schedule
                </h4>
                <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>Travel: {formatDuration(selectedSchedule.total_travel_time)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>Visit: {formatDuration(selectedSchedule.total_visit_time)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedSchedule.scheduled_places?.map((place: any, index: number) => {
                  const isExpanded = expandedPlaces.has(place.id);
                  const memberColor = getMemberColor(place.user_id);
                  const TransportIcon = getTransportIcon(place.transport_mode);
                  const transportColor = getTransportColor(place.transport_mode);
                  const isSystemPlace = place.place_type === 'departure' || place.place_type === 'destination';

                  return (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative"
                    >
                      {/* Timeline connector */}
                      {index < selectedSchedule.scheduled_places.length - 1 && (
                        <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 -z-10" />
                      )}

                      {/* Travel segment */}
                      {index > 0 && place.travel_time_from_previous > 0 && (
                        <div className="flex items-center space-x-3 mb-2 ml-8">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: transportColor }}
                          >
                            <TransportIcon className="w-4 h-4 text-white" />
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDuration(place.travel_time_from_previous)} by {place.transport_mode || 'car'}
                          </div>
                        </div>
                      )}

                      {/* Place card */}
                      <div
                        className={`flex items-start space-x-4 p-4 rounded-lg transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${
                          isExpanded ? 'bg-slate-50 dark:bg-slate-700' : ''
                        }`}
                        onClick={() => !isSystemPlace && togglePlaceExpansion(place.id)}
                      >
                        {/* Place marker */}
                        <div className="flex-shrink-0 relative">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shadow-medium ${
                              isSystemPlace ? 'bg-slate-600' : ''
                            }`}
                            style={!isSystemPlace ? { backgroundColor: memberColor } : undefined}
                          >
                            {place.order_in_day}
                          </div>
                          
                          {/* System place indicator */}
                          {isSystemPlace && (
                            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                              place.place_type === 'departure' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          )}
                        </div>

                        {/* Place content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {place.name}
                            </h5>
                            <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                              <span>{formatTime(place.arrival_time)}</span>
                              <span>-</span>
                              <span>{formatTime(place.departure_time)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-1">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {formatDuration(place.stay_duration_minutes)} stay
                              {place.category && ` • ${place.category}`}
                            </div>
                            
                            {!isSystemPlace && (
                              <ChevronRight 
                                className={`w-5 h-5 text-slate-400 transition-transform ${
                                  isExpanded ? 'rotate-90' : ''
                                }`} 
                              />
                            )}
                          </div>

                          {/* Member indicator */}
                          {place.user_id && !isSystemPlace && (
                            <div className="flex items-center space-x-2 mt-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                style={{ backgroundColor: memberColor }}
                              >
                                <Users className="w-3 h-3" />
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Added by Member {place.user_id.slice(0, 8)}
                              </span>
                            </div>
                          )}

                          {/* Expanded content */}
                          <AnimatePresence>
                            {isExpanded && !isSystemPlace && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600"
                              >
                                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                  {place.address && <p>📍 {place.address}</p>}
                                  {place.rating && <p>⭐ Rating: {place.rating}/5</p>}
                                  {place.wish_level && <p>❤️ Priority: {place.wish_level}/5</p>}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}