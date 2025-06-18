import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Clock, Users, Calendar as CalendarIcon, Sparkles, AlertCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Place, TripMember } from '../types/optimization';
import { PlaceColorCalculator } from '../utils/PlaceColorCalculator';
import { calculatePlaceColor, getCSSProperties, PlaceColorResult } from '../utils/PlaceColorHelper';
import { supabase } from '../lib/supabase';

interface CalendarEvent {
  id: string;
  name: string;
  time?: string;
  duration?: number;
  type: 'place' | 'meal' | 'trip';
  priority: number;
  assignedTo?: string[];
  category: string;
  spanDays?: number;
  isSpanning?: boolean;
  place?: Place;
}

type EventsByDate = Record<string, CalendarEvent[]>;

export function CalendarView() {
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  
  const { places, currentTrip, isLoading, optimizationResult } = useStore();

  // カレンダーイベントのスタイルを取得する関数
  const getEventStyle = (event: CalendarEvent): React.CSSProperties => {
    if (event.type !== 'place' || !event.place) {
      return {
        backgroundColor: '#6B7280', // デフォルト色
        color: 'white'
      };
    }
    
    // 色表示ロジックを適用
    const colorResult = calculatePlaceColor(event.place, tripMembers);
    const cssProperties = getCSSProperties(colorResult);
    
    return {
      ...cssProperties,
      color: 'white',
      border: colorResult.type === 'gold' ? '2px solid #FFA500' : '1px solid rgba(255,255,255,0.2)',
      borderRadius: '8px',
      padding: '8px 12px',
      minHeight: '48px',
      display: 'flex',
      alignItems: 'center'
    };
  };
  
  // Filter places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );
  
  // Load trip members
  useEffect(() => {
    const loadTripMembers = async () => {
      if (!currentTrip?.id) return;
      
      const { data, error } = await supabase
        .from('trip_members')
        .select('*, user:users(*)')
        .eq('trip_id', currentTrip.id);
        
      if (!error && data) {
        setTripMembers(data as TripMember[]);
      }
    };
    
    loadTripMembers();
  }, [currentTrip?.id]);
  
  // Get place color info using PlaceColorCalculator
  const getPlaceColorInfo = useCallback((place: Place) => {
    return PlaceColorCalculator.calculatePlaceColorInfo(
      place,
      tripMembers,
      tripPlaces
    );
  }, [tripMembers, tripPlaces]);
  
  // Get background style for events based on place color info
  const getEventBackgroundStyle = useCallback((event: CalendarEvent) => {
    if (!event.place) {
      // Default style for non-place events
      return {
        backgroundColor: '#6B7280',
        color: 'white'
      };
    }
    
    const colorInfo = getPlaceColorInfo(event.place);
    const styles = PlaceColorCalculator.generatePlaceStyles(colorInfo);
    
    if (colorInfo.display_type === 'gold') {
      return {
        background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
        color: 'white',
        boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
      };
    } else if (colorInfo.display_type === 'gradient' && colorInfo.colors.length > 1) {
      return {
        ...styles,
        color: 'white'
      };
    } else {
      return {
        backgroundColor: colorInfo.colors[0] || '#6B7280',
        color: 'white'
      };
    }
  }, [getPlaceColorInfo]);
  
  // Trip period - use real trip dates with fallback
  const startDateStr = currentTrip?.start_date || currentTrip?.startDate;
  const endDateStr = currentTrip?.end_date || currentTrip?.endDate;
  const tripStart = startDateStr ? new Date(startDateStr) : new Date('2024-05-15');
  const tripEnd = endDateStr ? new Date(endDateStr) : new Date('2024-05-22');
  
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Generate trip period days
  const getTripDays = useCallback(() => {
    const days = [];
    const currentDate = new Date(tripStart);
    
    while (currentDate <= tripEnd) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [tripStart, tripEnd]);

  // Display events from optimization results ONLY
  const eventsByDate = useMemo(() => {
    if (!currentTrip) return {};

    console.log('CalendarView Debug:', {
      currentTrip,
      // Check both camelCase and snake_case
      departureLocation: currentTrip.departureLocation,
      departure_location: (currentTrip as any).departure_location,
      destination: currentTrip.destination,
      destination_snake: (currentTrip as any).destination,
      startDate: currentTrip.start_date || (currentTrip as any).startDate,
      endDate: currentTrip.end_date || (currentTrip as any).endDate,
      tripStart,
      tripEnd,
      tripDaysLength: getTripDays().length,
      optimizationResult: !!optimizationResult,
      hasDailySchedules: !!optimizationResult?.optimization?.daily_schedules,
      dailySchedulesCount: optimizationResult?.optimization?.daily_schedules?.length || 0
    });

    const events: EventsByDate = {};
    
    // ONLY display results if we have optimization results with daily schedules
    if (optimizationResult?.optimization?.daily_schedules?.length > 0) {
      console.log('📅 CalendarView: Displaying optimization results with', optimizationResult.optimization.daily_schedules.length, 'days');
      
      optimizationResult.optimization.daily_schedules.forEach((daySchedule, dayIndex) => {
        const tripStartDate = currentTrip.start_date || currentTrip.startDate || new Date().toISOString();
        const date = new Date(tripStartDate);
        date.setDate(date.getDate() + dayIndex);
        const dateStr = formatDate(date);
        
        if (!events[dateStr]) events[dateStr] = [];
        
        // Add departure on first day
        if (dayIndex === 0) {
          const departureLocation = currentTrip.departureLocation || (currentTrip as any).departure_location;
          if (departureLocation) {
            events[dateStr].push({
              id: 'departure',
              name: `Departure from ${departureLocation}`,
              time: 'Start of trip',
              type: 'trip' as const,
              priority: 5,
              assignedTo: [],
              category: 'travel',
              isSpanning: false
            });
          }
        }
        
        // Add scheduled places
        daySchedule.scheduled_places.forEach(place => {
          events[dateStr].push({
            id: place.id,
            name: place.name,
            duration: place.stay_duration_minutes || 60,
            type: 'place' as const,
            priority: place.wish_level || 5,
            assignedTo: place.user_id ? [place.user_id] : [],
            category: place.place_type === 'airport' ? 'airport' : place.category || 'Other',
            isSpanning: false,
            place: place
          });
        });
        
        // Add destination on last day
        if (dayIndex === optimizationResult.optimization.daily_schedules.length - 1) {
          const destination = currentTrip.destination || (currentTrip as any).destination;
          if (destination) {
            events[dateStr].push({
              id: 'arrival',
              name: `Arrival at ${destination}`,
              time: 'End of trip',
              type: 'trip' as const,
              priority: 5,
              assignedTo: [],
              category: 'travel',
              isSpanning: false
            });
          }
        }
      });
      
      // Sort events by priority and time
      Object.keys(events).forEach(dateStr => {
        events[dateStr].sort((a, b) => b.priority - a.priority);
      });
      
      return events;
    }
    
    // NO optimization results - return empty events
    console.log('❌ CalendarView: No optimization results to display');
    return {};
  }, [currentTrip, optimizationResult, getTripDays]);

  const tripDays = getTripDays();

  if (!currentTrip) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-white dark:bg-dark-secondary rounded-lg shadow-soft p-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            トリップが選択されていません
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            トリップを作成または選択して、カレンダーを表示しましょう
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                旅行カレンダー
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentTrip.name} - {tripDays.length}日間
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {Object.values(eventsByDate).flat().filter(e => e.type === 'place').length} places scheduled
          </div>
        </div>

        {/* Trip Overview */}
        <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">From:</span>
                <span className="ml-1 font-medium text-gray-800 dark:text-white">
                  {tripStart.toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">To:</span>
                <span className="ml-1 font-medium text-gray-800 dark:text-white">
                  {tripEnd.toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Places</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Meals</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span>Travel</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tripDays.map((day, index) => {
          const dateStr = formatDate(day);
          const dayEvents = eventsByDate[dateStr] || [];
          
          return (
            <div
              key={dateStr}
              className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft overflow-hidden"
            >
              {/* Day Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Day {index + 1}</h3>
                    <p className="text-sm opacity-90">
                      {day.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-75">
                      {dayEvents.length} events
                    </div>
                  </div>
                </div>
              </div>

              {/* Events List */}
              <div className="p-3 space-y-2 min-h-[200px]">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event, eventIndex) => (
                      <div
                        key={event.id}
                        className="group cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div 
                          className="p-3 rounded-lg text-sm shadow-sm hover:shadow-md transition-all"
                          style={getEventStyle(event)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">
                                {event.name}
                              </h4>
                              {event.duration && (
                                <div className="flex items-center mt-1 text-xs opacity-90">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {event.duration}min
                                </div>
                              )}
                              {event.time && (
                                <div className="text-xs opacity-75 mt-1">
                                  {event.time}
                                </div>
                              )}
                            </div>
                            {event.assignedTo && event.assignedTo.length > 0 && (
                              <div className="flex items-center ml-2">
                                <Users className="w-3 h-3 opacity-75" />
                                <span className="text-xs ml-1 opacity-75">
                                  {event.assignedTo.length}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                      <div className="text-center">
                        <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No events</p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Detail Modal */}
        {selectedEvent && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="bg-white dark:bg-dark-secondary rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {selectedEvent.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {selectedEvent.category} • {selectedEvent.type}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {selectedEvent.duration && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4 mr-2" />
                    Duration: {selectedEvent.duration} minutes
                  </div>
                )}

                {selectedEvent.time && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Time: {selectedEvent.time}
                  </div>
                )}

                {selectedEvent.assignedTo && selectedEvent.assignedTo.length > 0 && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4 mr-2" />
                    Assigned to: {selectedEvent.assignedTo.length} member(s)
                  </div>
                )}

                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Priority: {selectedEvent.priority}/10
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}