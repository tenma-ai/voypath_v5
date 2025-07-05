import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, Star, Users, ChevronRight, Eye, EyeOff, Sparkles, AlertCircle, Navigation, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Place } from '../types/optimization';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { GooglePlace } from '../services/PlaceSearchService';
import { calculatePlaceColor, getCSSProperties, PlaceColorResult } from '../utils/PlaceColorHelper';
import { TransportIcon, getTransportColor, getTransportEmoji } from '../utils/transportIcons';
import { PlaceDateUtils } from '../utils/PlaceDateUtils';

interface ScheduleEvent {
  id: string;
  type: 'place' | 'travel' | 'meal';
  name: string;
  time?: string;
  duration?: string;
  category?: string;
  rating?: number;
  assignedTo?: string[];
  image?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  mode?: string;
  distance?: string;
  from?: string;
  to?: string;
  restaurant?: string;
  cuisine?: string;
}

interface DaySchedule {
  date: string;
  day: string;
  dayName: string;
  events: ScheduleEvent[];
}

// Use centralized transport utilities from utils/transportIcons.tsx
// Legacy function for backward compatibility
const getTransportIcon = (mode?: string): string => {
  return getTransportEmoji(mode || 'car');
};

export function ListView() {
  const navigate = useNavigate();
  const { places, currentTrip, isLoading, optimizationResult, memberColors, tripMembers, hasUserOptimized } = useStore();
  const [selectedDay, setSelectedDay] = useState(() => {
    // Initialize with trip start date if available
    const initialDay = PlaceDateUtils.getInitialSelectedDay(currentTrip);
    return initialDay || new Date().toISOString().split('T')[0];
  });
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 場所カードのスタイルとクラス名を取得する関数
  const getPlaceCardStyle = (event: ScheduleEvent): { style: React.CSSProperties; className: string } => {
    if (event.type !== 'place') return { style: {}, className: '' };
    
    // 対応する実際の場所オブジェクトを検索
    const place = tripPlaces.find(p => p.id === event.id);
    if (!place) return { style: {}, className: '' };

    // 色表示ロジックを適用
    const colorResult = calculatePlaceColor(place, tripMembers, memberColors);
    return {
      style: getCSSProperties(colorResult),
      className: colorResult.className || ''
    };
  };

  // Filter places for current trip - ensure we have valid trip ID
  const tripPlaces = useMemo(() => {
    if (!currentTrip?.id) return [];
    return places.filter(place => 
      place.trip_id === currentTrip.id || place.tripId === currentTrip.id
    );
  }, [places, currentTrip?.id]);
  
  // Colors and trip members are now loaded centrally via store


  // Get member display info for a place
  const getMemberDisplay = (place: Place) => {
    // Use new PlaceColorHelper with member colors from centralized store
    const members = tripMembers.map(member => ({
      id: member.user_id,
      name: member.name || 'Unknown',
      color: memberColors[member.user_id] || '#6B7280'
    }));

    const colorResult = calculatePlaceColor(place, members, memberColors);
    
    return {
      contributors: colorResult.contributors,
      displayType: colorResult.type,
      styles: getCSSProperties(colorResult)
    };
  };
  
  // Separate departure/destination places (always included) from user places
  const systemPlaces = useMemo(() => 
    tripPlaces.filter(place => 
      place.place_type === 'departure' || place.place_type === 'destination'
    ), [tripPlaces]
  );
  
  const userPlaces = useMemo(() =>
    tripPlaces.filter(place => 
      place.place_type !== 'departure' && place.place_type !== 'destination'
    ), [tripPlaces]
  );
  


  // Display schedule from optimization results ONLY
  const schedule = useMemo(() => {
    if (!currentTrip) return [];
    
    // ONLY display results if user has optimized and we have optimization results with daily schedules
    if (hasUserOptimized && optimizationResult?.optimization?.daily_schedules?.length > 0) {
      
      const scheduleDays: DaySchedule[] = [];
      
      optimizationResult.optimization.daily_schedules.forEach((daySchedule, dayIndex) => {
        const events: ScheduleEvent[] = [];
        
        // Get departure and destination with fallback for different field naming
        const departureLocation = currentTrip.departureLocation || (currentTrip as any).departure_location;
        const destination = currentTrip.destination || (currentTrip as any).destination;
        
        // Start with departure on Day 1
        if (dayIndex === 0 && departureLocation) {
          events.push({
            id: `departure-${dayIndex}`,
            type: 'place',
            name: `Departure: ${departureLocation}`,
            assignedTo: [],
            category: 'departure',
            description: 'Starting point of the trip'
          });
        }
        
        // Add scheduled places for this day
        daySchedule.scheduled_places.forEach((scheduledPlace, placeIndex) => {
          // Handle both scheduledPlace.place.name and scheduledPlace.name structures
          const place = scheduledPlace.place || scheduledPlace;
          const placeName = place.name || scheduledPlace.name || 'Unknown Place';
          const placeId = place.id || scheduledPlace.id || `place-${dayIndex}-${placeIndex}`;
          
          // Add travel time before each place (except first after departure)
          if (placeIndex > 0 || (dayIndex === 0 && placeIndex === 0 && departureLocation)) {
            const previousScheduledPlace = placeIndex > 0 
              ? daySchedule.scheduled_places[placeIndex - 1]
              : dayIndex > 0 
                ? optimizationResult.optimization.daily_schedules[dayIndex - 1]?.scheduled_places.slice(-1)[0]
                : null;
            
            const previousPlace = previousScheduledPlace?.place || previousScheduledPlace;
            const previousName = previousPlace?.name || previousScheduledPlace?.name || 
                               (dayIndex === 0 && placeIndex === 0 ? departureLocation : 'Previous location');
            
            events.push({
              id: `travel-${dayIndex}-${placeIndex}`,
              type: 'travel',
              name: getTransportIcon(scheduledPlace.transport_mode || 'car'),
              mode: scheduledPlace.transport_mode || 'car',
              duration: `${scheduledPlace.travel_time_from_previous || 30}分`,
              from: previousName,
              to: placeName
            });
          }
          
          events.push({
            id: placeId,
            type: 'place',
            name: placeName,
            time: scheduledPlace.arrival_time,
            duration: `${place.stay_duration_minutes || scheduledPlace.stay_duration_minutes || 60}分滞在`,
            category: place.place_type === 'airport' ? 'airport' : place.category || 'Other',
            rating: place.rating,
            assignedTo: place.user_id ? [place.user_id] : [],
            description: place.notes || place.description || scheduledPlace.notes,
            priority: (place.wish_level || scheduledPlace.wish_level) >= 8 ? 'high' : 
                     (place.wish_level || scheduledPlace.wish_level) >= 5 ? 'medium' : 'low'
          });
        });
        
        // Add destination on last day
        const isLastDay = dayIndex === optimizationResult.optimization.daily_schedules.length - 1;
        if (isLastDay && destination) {
          const lastPlace = daySchedule.scheduled_places.slice(-1)[0];
          if (lastPlace) {
            events.push({
              id: `travel-to-destination-${dayIndex}`,
              type: 'travel',
              name: getTransportIcon('car'),
              mode: 'car',
              duration: '31分',
              from: lastPlace.name,
              to: destination === 'same as departure location' ? departureLocation : destination
            });
          }
          
          events.push({
            id: `destination-${dayIndex}`,
            type: 'place',
            name: destination === 'same as departure location' 
              ? `Return to Departure: ${departureLocation}` 
              : `Arrival at ${destination}`,
            time: '18:00',
            duration: '1時間',
            assignedTo: [],
            category: 'destination',
            description: 'End point of the trip'
          });
        }
        
        // Use both startDate and start_date for compatibility
        const tripStartDate = currentTrip.startDate || currentTrip.start_date || new Date().toISOString();
        const date = new Date(tripStartDate);
        date.setDate(date.getDate() + dayIndex);
        
        scheduleDays.push({
          date: date.toISOString().split('T')[0],
          day: `Day ${dayIndex + 1}`,
          dayName: DateUtils.formatCalendarDate(date),
          events
        });
      });
      
      return scheduleDays;
    }
    
    // NO optimization results - show message to optimize first
    return [];
  }, [currentTrip, optimizationResult, hasUserOptimized]);

  const toggleEventCollapse = (eventId: string) => {
    setCollapsedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const getEventIcon = (event: ScheduleEvent) => {
    if (event.type === 'travel') {
      return getTransportIcon(event.mode);
    }
    
    const categoryIcons = {
      restaurant: '🍽️',
      tourist_attraction: '🏛️',
      park: '🌳',
      shopping_mall: '🛍️',
      museum: '🖼️',
      departure: '🏠',
      destination: '🎯',
      airport: '✈️',
      transportation: '🚗',
      meal: '🍽️',
      default: '📍'
    };
    
    return categoryIcons[event.category?.toLowerCase()] || categoryIcons.default;
  };

  const getTimeIcon = (timeOfDay: string | null) => {
    if (!timeOfDay) return null;
    const iconMap = {
      'morning': '/icons8-morning-48.png',
      'noon': '/icons8-midday-48.png', 
      'afternoon': '/icons8-afternoon-32.png',
      'night': '/icons8-night-66.png'
    };
    return iconMap[timeOfDay] || null;
  };

  const getTimeLabel = (timeOfDay: string | null) => {
    if (!timeOfDay) return null;
    const labelMap = {
      'morning': 'Morning',
      'noon': 'Noon',
      'afternoon': 'Afternoon', 
      'night': 'Night'
    };
    return labelMap[timeOfDay] || null;
  };

  const isSystemPlace = (event: ScheduleEvent) => {
    return event.category === 'departure' || 
           event.category === 'destination' || 
           event.category === 'airport';
  };

  const selectedSchedule = schedule.find(s => s.date === selectedDay) || schedule[0];

  const handleAddPlace = (place: GooglePlace) => {
    useStore.getState().handleAddPlace({
      id: crypto.randomUUID(),
      name: place.name,
      address: place.address,
      latitude: place.location.lat,
      longitude: place.location.lng,
      notes: '',
      category: place.types?.[0] || 'other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trip_id: currentTrip?.id || '',
      tripId: currentTrip?.id || '',
      user_id: useStore.getState().user?.id || '',
      place_type: 'visit',
      wish_level: 5,
      stay_duration_minutes: 60,
      is_user_location: true,
      is_selected_for_optimization: true,
      normalized_wish_level: 0.5,
      rating: place.rating,
      photos: place.photos
    });
  };

  if (!currentTrip) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white dark:bg-dark-secondary rounded-lg shadow-soft p-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            トリップが選択されていません
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            トリップを作成または選択して、プランニングを始めましょう
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Search and Add Place */}
      <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Navigation className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800 dark:text-white">場所を追加</h3>
        </div>
        <PlaceSearchInput onSelectPlace={handleAddPlace} />
      </div>

      {/* Date Selector */}
      <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800 dark:text-white">Itinerary</h3>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {optimizationResult ? 'Optimized' : 'Not optimized'}
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {schedule.map((day) => (
            <button
              key={day.date}
              onClick={() => setSelectedDay(day.date)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedDay === day.date
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <div>{day.day}</div>
              <div className="text-xs opacity-75">{day.dayName}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Timeline */}
      {selectedSchedule && selectedSchedule.events.length > 0 ? (
        <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-6">
          <div className="space-y-3">
              {selectedSchedule.events.map((event, index) => {
                const isCollapsed = collapsedEvents.has(event.id);
                const memberDisplay = event.type === 'place' && event.assignedTo?.length ? 
                  getMemberDisplay(tripPlaces.find(p => p.id === event.id) || {} as Place) : null;
                
                return (
                  <div
                    key={event.id}
                    className="relative"
                  >
                    {/* Timeline Line */}
                    {index < selectedSchedule.events.length - 1 && (
                      <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
                    )}
                    
                    {/* Event Card */}
                    <div
                      className={`flex items-start space-x-3 p-3 rounded-lg transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        event.type === 'travel' ? 'pl-8' : ''
                      } ${event.type === 'place' ? `place-card ${getPlaceCardStyle(event).className}` : ''}`}
                      style={event.type === 'place' ? getPlaceCardStyle(event).style : undefined}
                      onClick={() => event.type === 'place' && toggleEventCollapse(event.id)}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        event.type === 'travel' 
                          ? 'bg-gray-100 dark:bg-gray-700' 
                          : event.category === 'departure' || event.category === 'destination'
                          ? 'bg-gray-200 dark:bg-gray-700'
                          : 'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        {getEventIcon(event)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-medium text-gray-800 dark:text-white ${
                            event.type === 'travel' ? 'text-sm' : ''
                          }`}>
                            {event.name}
                            {event.type === 'travel' && event.from && event.to && (
                              <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                                {event.from} → {event.to}
                              </span>
                            )}
                          </h4>
                          {event.time && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {event.time}
                            </span>
                          )}
                        </div>
                        
                        {/* Event Details */}
                        <div className="mt-1 space-y-1">
                          {event.duration && (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {event.duration}
                            </span>
                          )}
                          
                          {event.rating && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">{event.rating}</span>
                            </div>
                          )}
                          
                          {/* Member Assignment Display */}
                          {memberDisplay && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {memberDisplay.displayType === 'gold' ? (
                                <div
                                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-md"
                                  style={{
                                    background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
                                    boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
                                  }}
                                >
                                  <Users className="w-3 h-3" />
                                  <span>みんなの候補</span>
                                  <span className="opacity-75">({memberDisplay.contributors.length}人)</span>
                                </div>
                              ) : memberDisplay.displayType === 'gradient' && memberDisplay.contributors.length > 1 ? (
                                <div
                                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-md"
                                  style={memberDisplay.styles}
                                >
                                  <Users className="w-3 h-3" />
                                  <span>{memberDisplay.contributors.map(c => c.name).join(' & ')}</span>
                                </div>
                              ) : memberDisplay.contributors.length === 1 ? (
                                <div
                                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-md"
                                  style={{ backgroundColor: memberDisplay.contributors[0].color }}
                                >
                                  <span>{memberDisplay.contributors[0].name}</span>
                                </div>
                              ) : null}
                            </div>
                          )}

                          {/* Preferred Time Display (non-system places only) */}
                          {event.type === 'place' && !isSystemPlace(event) && (() => {
                            const place = tripPlaces.find(p => p.id === event.id);
                            const timeOfDay = place?.preferred_time_of_day;
                            const timeIcon = getTimeIcon(timeOfDay);
                            const timeLabel = getTimeLabel(timeOfDay);
                            
                            if (timeIcon && timeLabel) {
                              return (
                                <div className="mt-1 flex items-center space-x-1">
                                  <img src={timeIcon} alt={timeLabel} className="w-3 h-3" />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {timeLabel}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Expandable Details */}
                          {event.type === 'place' && !isCollapsed && event.description && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Chevron for places */}
                      {event.type === 'place' && (
                        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                          !isCollapsed ? 'rotate-90' : ''
                        }`} />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              最適化が必要です
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              ルートを最適化してスケジュールを表示します
            </p>
            <button
              onClick={() => window.location.href = '#optimize'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ルートを最適化
            </button>
          </div>
        </div>
      )}
    </div>
  );
}