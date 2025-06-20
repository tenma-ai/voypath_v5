import React from 'react';
import { X, Clock, MapPin, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface Place {
  id: string;
  name: string;
  address: string;
  position: { lat: number; lng: number };
  rating?: number;
}

interface OptimizedPlace extends Place {
  arrivalTime: string;
  departureTime: string;
  duration: number;
}

interface CalendarViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  optimizationResult: {
    places: OptimizedPlace[];
    totalDistance: number;
    totalDuration: number;
    totalTravelTime: number;
  } | null;
  onSwitchToMap?: () => void;
  onSwitchToList?: () => void;
}

const CalendarViewModal: React.FC<CalendarViewModalProps> = ({
  isOpen,
  onClose,
  optimizationResult,
  onSwitchToMap,
  onSwitchToList
}) => {
  if (!isOpen || !optimizationResult) return null;

  // formatOptimizationResult function - exact same as OptimizationResult.tsx
  const formatOptimizationResult = (result: any) => {
    // Extract daily_schedules directly from Edge Function response
    const dailySchedules = result?.optimization?.daily_schedules;
    
    // Safety check for required properties
    if (!result?.optimization || !dailySchedules || !Array.isArray(dailySchedules)) {
      return {
        schedulesByDay: {},
        totalStats: { places: 0, travelTime: 0, visitTime: 0, score: 0 },
        summary: 'No optimization data available'
      };
    }

    // Group schedules by day
    const schedulesByDay: Record<string, any> = {};
    let totalPlaces = 0;
    
    dailySchedules.forEach((schedule: any) => {
      const dayKey = `day-${schedule.day}`;
      schedulesByDay[dayKey] = {
        day: schedule.day,
        date: schedule.date,
        places: schedule.scheduled_places || [],
        totalTravelTime: schedule.total_travel_time || 0,
        totalVisitTime: schedule.total_visit_time || 0
      };
      
      totalPlaces += (schedule.scheduled_places || []).length;
    });

    return {
      schedulesByDay,
      totalStats: {
        places: totalPlaces,
        travelTime: result.optimization.total_duration_minutes || 0,
        visitTime: dailySchedules.reduce((sum: number, day: any) => {
          return sum + (day.total_visit_time || 0);
        }, 0),
        score: result.optimization.optimization_score ? 
          (result.optimization.optimization_score.total_score / 100) : 0
      },
      summary: `${totalPlaces} places optimized across ${Object.keys(schedulesByDay).length} days`
    };
  };

  const formattedResult = formatOptimizationResult(optimizationResult);

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}時間${mins > 0 ? `${mins}分` : ''}` : `${mins}分`;
  };

  const formatDistance = (distance: number) => {
    return distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${Math.round(distance)}m`;
  };

  // Generate time slots for calendar view
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const getPlaceForTimeSlot = (time: string, targetDate: string) => {
    // Find the schedule for the target date
    const daySchedule = Object.values(formattedResult.schedulesByDay).find((schedule: any) => 
      schedule.date === targetDate
    );
    
    if (!daySchedule) return null;
    
    return daySchedule.places.find((place: any) => {
      if (!place.arrival_time || !place.departure_time) return false;
      return time >= place.arrival_time && time < place.departure_time;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            カレンダービュー
          </h2>
          
          {/* View Toggle Buttons */}
          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 rounded-lg p-1 flex">
              {onSwitchToMap && (
                <button
                  onClick={onSwitchToMap}
                  className="px-2 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Map
                </button>
              )}
              {onSwitchToList && (
                <button
                  onClick={onSwitchToList}
                  className="px-2 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Timeline
                </button>
              )}
              <button
                className="px-2 py-1 rounded text-xs font-medium bg-primary-500 text-white"
                disabled
              >
                Calendar
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-2 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-blue-600">{formattedResult.totalStats.places}</div>
              <div className="text-xs text-gray-600">スポット</div>
            </div>
            <div>
              <div className="text-sm font-bold text-green-600">
                {formatDuration(formattedResult.totalStats.travelTime)}
              </div>
              <div className="text-xs text-gray-600">移動時間</div>
            </div>
            <div>
              <div className="text-sm font-bold text-purple-600">
                {formatDuration(formattedResult.totalStats.visitTime)}
              </div>
              <div className="text-xs text-gray-600">滞在時間</div>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-4">
            {Object.keys(formattedResult.schedulesByDay).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">最適化データがありません</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(formattedResult.schedulesByDay).map(([dayKey, dayData]) => (
                  <div key={dayKey} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Day Header */}
                    <div className="bg-blue-50 px-3 py-2 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-blue-900">
                        Day {dayData.day} - {new Date(dayData.date).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long'
                        })}
                      </h3>
                    </div>
                    
                    {/* Time slots for this day */}
                    <div className="p-4">
                      <div className="space-y-2">
                        {timeSlots.map((time, index) => {
                          const place = getPlaceForTimeSlot(time, dayData.date);
                          const isHourMark = time.endsWith(':00');
                          
                          return (
                            <div
                              key={time}
                              className={`flex items-center space-x-4 py-1 ${
                                isHourMark ? 'border-t border-gray-200 pt-2' : ''
                              }`}
                            >
                              <div className={`w-12 text-xs ${isHourMark ? 'font-semibold' : 'text-gray-500'}`}>
                                {time}
                              </div>
                              
                              <div className="flex-1">
                                {place ? (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <h4 className="text-sm font-semibold text-blue-900">{place.place_name || place.name}</h4>
                                        <div className="flex items-center text-blue-600 text-xs mt-1">
                                          <Clock className="w-3 h-3 mr-1" />
                                          <span>
                                            {formatTime(place.arrival_time)} - {formatTime(place.departure_time)}
                                            ({formatDuration(place.stay_duration_minutes || 60)})
                                          </span>
                                        </div>
                                      </div>
                                      {place.rating && (
                                        <div className="text-xs text-yellow-600">
                                          ★ {place.rating.toFixed(1)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-2 border-l-2 border-gray-100 ml-2"></div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CalendarViewModal;