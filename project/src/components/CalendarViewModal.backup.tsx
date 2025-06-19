import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  X
} from 'lucide-react';

const transportColors = {
  walking: '#FCD34D', // Yellow
  car: '#10B981',     // Green  
  flight: '#3B82F6',  // Blue
  default: '#6B7280'  // Gray
};

interface CalendarViewModalProps {
  result: any;
  onClose: () => void;
}

export function CalendarViewModal({ result, onClose }: CalendarViewModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Extract daily schedules from optimization result
  const dailySchedules = useMemo(() => {
    if (!result?.optimization?.daily_schedules) return [];
    return result.optimization.daily_schedules;
  }, [result]);

  // Create a map of dates to schedules
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, any>();
    
    // If dates are available, use them directly
    dailySchedules.forEach((schedule: any) => {
      if (schedule.date) {
        map.set(schedule.date, schedule);
      } else {
        // Generate dates based on day number (starting from today)
        const today = new Date();
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + (schedule.day - 1));
        const dateString = scheduleDate.toISOString().split('T')[0];
        map.set(dateString, schedule);
      }
    });
    return map;
  }, [dailySchedules]);

  // Get calendar dates for current month
  const calendarDates = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const dates = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }, [currentMonth]);

  const selectedSchedule = selectedDate ? schedulesByDate.get(selectedDate) : null;

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
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

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getMemberColor = (userId?: string): string => {
    if (!userId) return '#9CA3AF';
    // Generate a consistent color based on user ID
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981'];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getTransportColor = (mode: string): string => {
    return transportColors[mode as keyof typeof transportColors] || transportColors.default;
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
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Trip Calendar
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
          {/* Calendar Content */}
          <div className="p-6 space-y-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {dailySchedules.length} scheduled day{dailySchedules.length !== 1 ? 's' : ''}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                
                <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 min-w-[140px] text-center">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h4>
                
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDates.map((date, index) => {
                const dateString = getDateString(date);
                const schedule = schedulesByDate.get(dateString);
                const hasSchedule = !!schedule;
                const isSelected = selectedDate === dateString;
                const currentMonthDate = isCurrentMonth(date);
                const todayDate = isToday(date);

                return (
                  <motion.button
                    key={index}
                    onClick={() => setSelectedDate(hasSchedule ? dateString : null)}
                    className={`
                      relative p-3 h-20 rounded-lg text-left transition-all
                      ${currentMonthDate ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'}
                      ${todayDate ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800' : ''}
                      ${hasSchedule ? 'bg-secondary-50 dark:bg-secondary-900/20 hover:bg-secondary-100 dark:hover:bg-secondary-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                      ${isSelected ? 'ring-2 ring-primary-500' : ''}
                      ${!currentMonthDate ? 'opacity-50' : ''}
                    `}
                    disabled={!hasSchedule}
                    whileHover={{ scale: hasSchedule ? 1.02 : 1 }}
                    whileTap={{ scale: hasSchedule ? 0.98 : 1 }}
                  >
                    <div className="font-medium">
                      {date.getDate()}
                    </div>
                    
                    {hasSchedule && (
                      <div className="mt-1 space-y-1">
                        <div className="w-full h-1 bg-primary-500 rounded-full opacity-60" />
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {schedule.scheduled_places?.length || 0} places
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Selected Day Details */}
            <AnimatePresence>
              {selectedSchedule && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Day {selectedSchedule.day} - {new Date(selectedDate!).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
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

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {selectedSchedule.scheduled_places?.map((place: any, index: number) => {
                      const memberColor = getMemberColor(place.user_id);
                      const isSystemPlace = place.place_type === 'departure' || place.place_type === 'destination';

                      return (
                        <motion.div
                          key={place.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white dark:bg-slate-800 rounded-lg p-4"
                        >
                          <div className="flex items-start space-x-3">
                            {/* Place marker */}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-medium ${
                                isSystemPlace ? 'bg-slate-600' : ''
                              }`}
                              style={!isSystemPlace ? { backgroundColor: memberColor } : undefined}
                            >
                              {place.order_in_day}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {place.name}
                              </h5>
                              
                              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {formatTime(place.arrival_time)} - {formatTime(place.departure_time)}
                              </div>
                              
                              <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                {formatDuration(place.stay_duration_minutes)} stay
                                {place.category && ` • ${place.category}`}
                              </div>

                              {/* Travel info */}
                              {place.travel_time_from_previous > 0 && index > 0 && (
                                <div className="flex items-center space-x-2 mt-2">
                                  <div 
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: getTransportColor(place.transport_mode) }}
                                  />
                                  <span className="text-xs text-slate-500 dark:text-slate-500">
                                    {formatDuration(place.travel_time_from_previous)} travel
                                  </span>
                                </div>
                              )}

                              {/* Member indicator */}
                              {place.user_id && !isSystemPlace && (
                                <div className="flex items-center space-x-1 mt-2">
                                  <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: memberColor }}
                                  >
                                    <Users className="w-2 h-2 text-white" />
                                  </div>
                                  <span className="text-xs text-slate-500 dark:text-slate-500">
                                    Member {place.user_id.slice(0, 8)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}