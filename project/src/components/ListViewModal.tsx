import React from 'react';
import { X, Clock, MapPin, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { TransportIcon, getTransportColor } from '../utils/transportIcons';

interface Place {
  id: string;
  name: string;
  address: string;
  placeId?: string;
  position: {
    lat: number;
    lng: number;
  };
  types?: string[];
  rating?: number;
  priceLevel?: number;
  photos?: string[];
  openingHours?: {
    isOpen?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
}

interface OptimizedPlace extends Place {
  arrivalTime: string;
  departureTime: string;
  duration: number;
  travelTime?: number;
  travelDistance?: number;
}

interface ListViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  optimizationResult: {
    places: OptimizedPlace[];
    totalDistance: number;
    totalDuration: number;
    totalTravelTime: number;
  } | null;
  onSwitchToMap?: () => void;
  onSwitchToCalendar?: () => void;
}

const ListViewModal: React.FC<ListViewModalProps> = ({
  isOpen,
  onClose,
  optimizationResult,
  onSwitchToMap,
  onSwitchToCalendar
}) => {
  const { hasUserOptimized } = useStore();
  
  if (!isOpen || !hasUserOptimized || !optimizationResult) return null;

  // formatOptimizationResult function - exact same as OptimizationResult.tsx
  const formatOptimizationResult = (result: any) => {
    // Extract daily_schedules directly from Edge Function response
    const dailySchedules = result?.optimization?.daily_schedules;
    
    // Debug logging
    console.log('🔍 ListViewModal - formatOptimizationResult called with:', result);
    console.log('🔍 Daily schedules:', dailySchedules);
    console.log('🔍 Daily schedules type:', typeof dailySchedules);
    console.log('🔍 Is array:', Array.isArray(dailySchedules));
    
    // Safety check for required properties
    if (!result?.optimization || !dailySchedules || !Array.isArray(dailySchedules)) {
      // Error occurred
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
      // Log message
      // Log message
      // Log message
      
      const dayKey = `day-${schedule.day}`;
      schedulesByDay[dayKey] = {
        day: schedule.day,
        date: schedule.date,
        places: schedule.scheduled_places || [],
        totalTravelTime: schedule.total_travel_time || 0,
        totalVisitTime: schedule.total_visit_time || 0
      };
      
      totalPlaces += (schedule.scheduled_places || []).length;
      // Assigning places to day
    });

    return {
      schedulesByDay,
      totalStats: {
        places: totalPlaces,
        travelTime: result.optimization.total_duration_minutes || dailySchedules.reduce((sum: number, day: any) => {
          return sum + (day.total_travel_time || 0);
        }, 0),
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
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  const formatDistance = (distance: number) => {
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(1)}km`;
    }
    return `${Math.round(distance)}m`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] pt-20 pb-20 sm:pt-6 sm:pb-6 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[calc(100vh-10rem)] sm:max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">最適化されたルート</h2>
          
          {/* View Toggle Buttons */}
          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 rounded-lg p-1 flex">
              {onSwitchToMap && (
                <button
                  onClick={onSwitchToMap}
                  className="px-3 py-1.5 rounded text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Map
                </button>
              )}
              <button
                className="px-3 py-1.5 rounded text-sm font-medium bg-primary-500 text-white"
                disabled
              >
                Timeline
              </button>
              {onSwitchToCalendar && (
                <button
                  onClick={onSwitchToCalendar}
                  className="px-3 py-1.5 rounded text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Calendar
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">{formattedResult.totalStats.places}</div>
              <div className="text-sm text-gray-600">スポット</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {formatDuration(formattedResult.totalStats.travelTime)}
              </div>
              <div className="text-sm text-gray-600">移動時間</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">
                {formatDuration(formattedResult.totalStats.visitTime)}
              </div>
              <div className="text-sm text-gray-600">滞在時間</div>
            </div>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-4">
            {Object.keys(formattedResult.schedulesByDay).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">最適化データがありません</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(formattedResult.schedulesByDay).map(([dayKey, dayData]) => (
                  <div key={dayKey} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Day Header */}
                    <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-blue-900">
                          Day {dayData.day} - {new Date(dayData.date).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </h3>
                        <div className="text-sm text-blue-700">
                          {dayData.places.length} スポット
                        </div>
                      </div>
                    </div>
                    
                    {/* Places for this day */}
                    <div className="p-4 space-y-4">
                      {dayData.places.map((place: any, index: number) => {
                        console.log(`🔍 Place ${index} data:`, place);
                        console.log(`🔍 Place ${index} transport details:`, {
                          name: place.place_name || place.name,
                          transport_mode: place.transport_mode,
                          travel_time_from_previous: place.travel_time_from_previous,
                          travel_to_next: place.travel_to_next,
                          'travel_to_next.transport_mode': place.travel_to_next?.transport_mode,
                          'travel_to_next.duration_minutes': place.travel_to_next?.duration_minutes
                        });
                        return (
                        <div key={place.place_id || place.id || index} className="relative">
                          {/* Timeline connector */}
                          {index < dayData.places.length - 1 && (
                            <div className="absolute left-6 top-12 w-0.5 h-12 bg-gray-300"></div>
                          )}
                          
                          <div className="flex items-start space-x-4">
                            {/* Timeline dot */}
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                              {index + 1}
                            </div>
                            
                            {/* Place info */}
                            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-1">{place.place_name || place.name}</h4>
                                  <div className="flex items-center text-gray-600 text-sm mb-2">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    <span>{place.address || 'Address unknown'}</span>
                                  </div>
                                  
                                  {/* Time info */}
                                  <div className="flex items-center space-x-4 text-sm">
                                    <div className="flex items-center text-green-600">
                                      <Clock className="w-4 h-4 mr-1" />
                                      <span>Arrival: {formatTime(place.arrival_time)}</span>
                                    </div>
                                    <div className="flex items-center text-blue-600">
                                      <Clock className="w-4 h-4 mr-1" />
                                      <span>Departure: {formatTime(place.departure_time)}</span>
                                    </div>
                                    <div className="text-gray-600">
                                      Stay: {formatDuration(place.stay_duration_minutes || 60)}
                                    </div>
                                  </div>
                                  
                                  {/* Travel info to next place - using MapView legend icons and flight-style UI */}
                                  {(place.travel_to_next || place.travel_time_from_previous) && (
                                    <div className="mt-2 space-y-2">
                                      {/* Display transport mode from travel_to_next */}
                                      {place.travel_to_next?.transport_mode && (
                                        <div className="flex items-center space-x-2">
                                          {/* Flight display - using exact flight logic */}
                                          {(place.travel_to_next.transport_mode === 'flight' || place.travel_to_next.transport_mode === 'plane' || place.travel_to_next.transport_mode?.toLowerCase().includes('flight')) && (
                                            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs">
                                              <TransportIcon mode="flight" className="w-3 h-3" size={12} />
                                              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getTransportColor('flight') }} />
                                              <span>Flight - {formatDuration(place.travel_to_next.duration_minutes)}</span>
                                            </div>
                                          )}
                                          
                                          {/* Car display - using exact flight logic */}
                                          {(place.travel_to_next.transport_mode === 'car' || place.travel_to_next.transport_mode === 'driving') && (
                                            <div className="flex items-center space-x-1 px-2 py-1 bg-amber-700 text-white rounded text-xs">
                                              <TransportIcon mode="car" className="w-3 h-3" size={12} />
                                              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getTransportColor('car') }} />
                                              <span>Car - {formatDuration(place.travel_to_next.duration_minutes)}</span>
                                            </div>
                                          )}
                                          
                                          {/* Walking display - using exact flight logic */}
                                          {(place.travel_to_next.transport_mode === 'walking' || place.travel_to_next.transport_mode === 'walk') && (
                                            <div className="flex items-center space-x-1 px-2 py-1 bg-gray-600 text-white rounded text-xs">
                                              <TransportIcon mode="walking" className="w-3 h-3" size={12} />
                                              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getTransportColor('walking') }} />
                                              <span>Walking - {formatDuration(place.travel_to_next.duration_minutes)}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Also check for transport mode in current place */}
                                      {place.transport_mode && (
                                        <div className="flex items-center space-x-2">
                                          {/* Flight display - using exact flight logic */}
                                          {(place.transport_mode === 'flight' || place.transport_mode === 'plane' || place.transport_mode?.toLowerCase().includes('flight')) && (
                                            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs">
                                              <TransportIcon mode="flight" className="w-3 h-3" size={12} />
                                              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getTransportColor('flight') }} />
                                              <span>Flight - {formatDuration(place.travel_time_from_previous || 0)}</span>
                                            </div>
                                          )}
                                          
                                          {/* Car display - using exact flight logic */}
                                          {(place.transport_mode === 'car' || place.transport_mode === 'driving') && (
                                            <div className="flex items-center space-x-1 px-2 py-1 bg-amber-700 text-white rounded text-xs">
                                              <TransportIcon mode="car" className="w-3 h-3" size={12} />
                                              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getTransportColor('car') }} />
                                              <span>Car - {formatDuration(place.travel_time_from_previous || 0)}</span>
                                            </div>
                                          )}
                                          
                                          {/* Walking display - using exact flight logic */}
                                          {(place.transport_mode === 'walking' || place.transport_mode === 'walk') && (
                                            <div className="flex items-center space-x-1 px-2 py-1 bg-gray-600 text-white rounded text-xs">
                                              <TransportIcon mode="walking" className="w-3 h-3" size={12} />
                                              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: getTransportColor('walking') }} />
                                              <span>Walking - {formatDuration(place.travel_time_from_previous || 0)}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Fallback: Original travel info display */}
                                      {place.travel_to_next && !place.travel_to_next.transport_mode && (
                                        <div className="p-2 bg-gray-50 rounded text-sm">
                                          <div className="flex items-center text-gray-600">
                                            <Navigation className="w-4 h-4 mr-1" />
                                            <span>
                                              次のスポットまで: {formatDuration(place.travel_to_next.duration_minutes)}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Rating */}
                                {place.rating && (
                                  <div className="ml-4 text-right">
                                    <div className="text-sm text-gray-600">評価</div>
                                    <div className="text-lg font-bold text-yellow-500">
                                      ★ {place.rating.toFixed(1)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
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

export default ListViewModal;