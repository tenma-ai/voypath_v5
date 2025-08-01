import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, Clock, Star, Users, ChevronRight, Eye, EyeOff, Sparkles, AlertCircle, Navigation, Wand2, ExternalLink } from 'lucide-react';
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
// Legacy function for backward compatibility - ensure we use emoji for display
const getTransportIcon = (mode?: string): string => {
  return getTransportEmoji(mode || 'car');
};

export function ListView() {
  const navigate = useNavigate();
  const { places, currentTrip, isLoading, optimizationResult, memberColors, tripMembers, hasUserOptimized, setSelectedDay: setStoreSelectedDay } = useStore();
  const [selectedDay, setSelectedDay] = useState(() => {
    // Initialize with trip start date if available
    const initialDay = PlaceDateUtils.getInitialSelectedDay(currentTrip);
    const day = initialDay || new Date().toISOString().split('T')[0];
    // Set store state as well
    setStoreSelectedDay(day);
    return day;
  });
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 場所カードのスタイルとクラス名を取得する関数
  // Filter places for current trip - ensure we have valid trip ID
  const tripPlaces = useMemo(() => {
    if (!currentTrip?.id) return [];
    return places.filter(place => 
      place.trip_id === currentTrip.id || place.tripId === currentTrip.id
    );
  }, [places, currentTrip?.id]);

  const getPlaceCardStyle = useCallback((event: ScheduleEvent): { style: React.CSSProperties; className: string } => {
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
  }, [tripPlaces, tripMembers, memberColors]);

  // MapView Trip.com booking functions (direct reuse)
  const generateTripComFlightUrl = useCallback((origin: string, destination: string, dateStr: string) => {
    const tripComUrl = `https://trip.com/flights/booking?flightType=ow&dcity=${origin}&acity=${destination}&ddate=${dateStr}&adult=1&child=0&infant=0`;
    const encodedUrl = encodeURIComponent(tripComUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=8626&u=${encodedUrl}&campaign_id=121`;
  }, []);

  const generateTripComHotelUrl = useCallback((city: string, checkIn: string, checkOut: string) => {
    const baseUrl = 'https://tp.media/r?marker=649297&trs=434567&p=8626&u=https%3A%2F%2Ftrip.com%2Fhotels%2Flist';
    const params = new URLSearchParams({
      city: city,
      cityName: city,
      checkin: checkIn.replace(/-/g, '%2F'),
      checkout: checkOut.replace(/-/g, '%2F'),
      adult: '1',
      children: '0',
      crn: '1',
      searchType: 'CT',
      searchWord: city,
      'locale': 'en-XX',
      'curr': 'JPY'
    });
    return `${baseUrl}?${params.toString()}&campaign_id=121`;
  }, []);

  const handleTripComFlightBooking = useCallback((event: ScheduleEvent) => {
    if (event.type !== 'travel') return;
    
    const selectedSchedule = schedule.find(s => s.date === selectedDay);
    if (!selectedSchedule) return;
    
    const dateStr = selectedSchedule.date.replace(/-/g, '');
    const fromCity = event.from || 'Tokyo';
    const toCity = event.to || 'Osaka';
    
    const url = generateTripComFlightUrl(fromCity, toCity, dateStr);
    window.open(url, '_blank');
  }, [selectedDay, schedule, generateTripComFlightUrl]);

  const handleTripComHotelBooking = useCallback((event: ScheduleEvent) => {
    if (event.type !== 'place') return;
    
    const selectedSchedule = schedule.find(s => s.date === selectedDay);
    if (!selectedSchedule) return;
    
    const checkIn = selectedSchedule.date;
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 1);
    
    const city = event.name || 'Tokyo';
    const url = generateTripComHotelUrl(city, checkIn, checkOut.toISOString().split('T')[0]);
    window.open(url, '_blank');
  }, [selectedDay, schedule, generateTripComHotelUrl]);
  
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
    console.log('=== ListView Schedule Generation ===');
    console.log('currentTrip:', currentTrip);
    console.log('hasUserOptimized:', hasUserOptimized);
    console.log('optimizationResult:', optimizationResult);
    console.log('optimizationResult exists:', !!optimizationResult);
    console.log('optimization exists:', !!optimizationResult?.optimization);
    console.log('daily_schedules exists:', !!optimizationResult?.optimization?.daily_schedules);
    console.log('daily_schedules length:', optimizationResult?.optimization?.daily_schedules?.length);
    
    if (!currentTrip) {
      console.log('No current trip, returning empty schedule');
      return [];
    }
    
    // ONLY display results if user has optimized and we have optimization results with daily schedules
    if (hasUserOptimized && optimizationResult?.optimization?.daily_schedules?.length > 0) {
      console.log('Processing optimization results...');
      console.log('Daily schedules:', optimizationResult.optimization.daily_schedules);
      console.log('Daily schedules length:', optimizationResult.optimization.daily_schedules.length);
      
      // Debug first day's scheduled places
      if (optimizationResult.optimization.daily_schedules[0]?.scheduled_places) {
        console.log('First day scheduled places:', optimizationResult.optimization.daily_schedules[0].scheduled_places);
        optimizationResult.optimization.daily_schedules[0].scheduled_places.forEach((place, index) => {
          console.log(`Place ${index}:`, {
            name: place.name || place.place?.name,
            transport_mode: place.transport_mode,
            travel_time_from_previous: place.travel_time_from_previous
          });
        });
      }
      
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
          
          console.log(`=== Processing place ${placeIndex} on day ${dayIndex} ===`);
          console.log('scheduledPlace:', scheduledPlace);
          console.log('place:', place);
          console.log('placeName:', placeName);
          console.log('transport_mode:', scheduledPlace.transport_mode);
          console.log('travel_time_from_previous:', scheduledPlace.travel_time_from_previous);
          
          // Add travel time before each place (except first place on first day)
          if (placeIndex > 0) {
            const previousScheduledPlace = daySchedule.scheduled_places[placeIndex - 1];
            const previousPlace = previousScheduledPlace?.place || previousScheduledPlace;
            const previousName = previousPlace?.name || previousScheduledPlace?.name || 'Previous location';
            
            // Use transport mode directly from backend
            const transportMode = scheduledPlace.transport_mode || 'car';
            const travelTime = scheduledPlace.travel_time_from_previous || 30;

            const travelEvent = {
              id: `travel-${dayIndex}-${placeIndex}`,
              type: 'travel',
              name: getTransportIcon(transportMode),
              mode: transportMode,
              duration: `${travelTime}分`,
              from: previousName,
              to: placeName
            };
            
            console.log('✅ Adding travel event:', travelEvent);
            console.log('Transport mode:', transportMode, 'Icon:', getTransportIcon(transportMode));
            events.push(travelEvent);
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
        
        console.log(`Day ${dayIndex + 1} final events:`, events);
        console.log(`Day ${dayIndex + 1} travel events:`, events.filter(e => e.type === 'travel'));
        events.filter(e => e.type === 'travel').forEach((travelEvent, idx) => {
          console.log(`Travel event ${idx}:`, {
            mode: travelEvent.mode,
            from: travelEvent.from,
            to: travelEvent.to,
            duration: travelEvent.duration,
            name: travelEvent.name
          });
        });
        
        scheduleDays.push({
          date: date.toISOString().split('T')[0],
          day: `Day ${dayIndex + 1}`,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          events
        });
      });
      
      return scheduleDays;
    }
    
    // NO optimization results - show message to optimize first
    console.log('No optimization results available');
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

  const [placeSearchValue, setPlaceSearchValue] = useState('');

  const handleAddPlace = (place: GooglePlace) => {
    useStore.getState().addPlace({
      id: crypto.randomUUID(),
      name: place.name,
      address: place.formatted_address,
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
    setPlaceSearchValue(''); // Clear search after adding
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
      <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-3 sm:p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white">場所を追加</h3>
        </div>
        <div className="w-full">
          <PlaceSearchInput 
            value={placeSearchValue}
            onChange={setPlaceSearchValue}
            onPlaceSelect={handleAddPlace}
            placeholder="Search for places to add to your trip..."
            className="w-full"
          />
        </div>
      </div>

      {/* Date Selector */}
      <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white">Itinerary</h3>
          </div>
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {optimizationResult ? 'Optimized' : 'Not optimized'}
          </div>
        </div>
        
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2">
          {schedule.map((day) => (
            <button
              key={day.date}
              onClick={() => {
                setSelectedDay(day.date);
                setStoreSelectedDay(day.date);
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                selectedDay === day.date
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <div className="text-xs sm:text-sm">{day.day}</div>
              <div className="text-xs opacity-75 hidden sm:block">{day.dayName}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Timeline */}
      {selectedSchedule && selectedSchedule.events.length > 0 ? (
        <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-soft p-3 sm:p-6">
          <div className="space-y-1 sm:space-y-2">
              {selectedSchedule.events.map((event, index) => {
                console.log(`Rendering event ${index}:`, { 
                  type: event.type, 
                  name: event.name, 
                  mode: event.mode,
                  id: event.id,
                  from: event.from,
                  to: event.to,
                  duration: event.duration
                });
                
                // Debug transport mode matching for each event
                if (event.type === 'travel') {
                  console.log(`Travel event ${index} mode checks:`, {
                    mode: event.mode,
                    isCar: event.mode === 'car' || event.mode === 'driving',
                    isWalking: event.mode === 'walking' || event.mode === 'walk',
                    isFlight: event.mode === 'flight' || event.mode === 'plane' || event.mode?.toLowerCase().includes('flight')
                  });
                }
                
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
                      <div className="absolute left-4 sm:left-5 top-4 sm:top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
                    )}
                    
                    {/* Event Card */}
                    <div
                      className={`flex items-start space-x-2 sm:space-x-3 p-1 sm:p-3 rounded-lg transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        event.type === 'travel' ? 'pl-4 sm:pl-8' : ''
                      } ${event.type === 'place' ? `place-card ${getPlaceCardStyle(event).className}` : ''}`}
                      style={event.type === 'place' ? getPlaceCardStyle(event).style : undefined}
                      onClick={() => event.type === 'place' && toggleEventCollapse(event.id)}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-lg ${
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
                          <h4 className={`font-medium text-gray-800 dark:text-white text-sm sm:text-base ${
                            event.type === 'travel' ? 'text-xs sm:text-sm' : ''
                          }`}>
                            {event.name}
                            {event.type === 'travel' && event.from && event.to && (
                              <span className="text-gray-500 dark:text-gray-400 text-xs ml-1 sm:ml-2 block sm:inline">
                                {event.from} → {event.to}
                              </span>
                            )}
                          </h4>
                          {event.time && (
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {event.time}
                            </span>
                          )}
                        </div>
                        
                        {/* Event Details */}
                        <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                          {event.duration && (
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {event.duration}
                            </span>
                          )}
                          
                          {event.rating && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-current" />
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{event.rating}</span>
                            </div>
                          )}
                          
                          {/* Member Assignment Display */}
                          {memberDisplay && (
                            <div className="mt-1 sm:mt-2 flex flex-wrap gap-1 sm:gap-2">
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
                                <div className="mt-0.5 sm:mt-1 flex items-center space-x-1">
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
                            <div className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 sm:p-3 rounded-lg">
                              {event.description}
                            </div>
                          )}
                          
                          {/* Trip.com Booking Buttons */}
                          {!isCollapsed && (
                            <div className="mt-1 sm:mt-2 flex flex-wrap gap-1 sm:gap-2">
                              
                              {/* Car transport display - using exact flight logic */}
                              {event.type === 'travel' && (event.mode === 'car' || event.mode === 'driving') && (
                                <div className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-amber-700 text-white rounded-md text-xs sm:text-sm">
                                  <TransportIcon 
                                    mode="car" 
                                    className="w-3 h-3" 
                                    size={12}
                                  />
                                  <span className="hidden sm:inline">Car - {event.duration}</span>
                                  <span className="sm:hidden">Car</span>
                                </div>
                              )}
                              
                              {/* Walking transport display - using exact flight logic */}
                              {event.type === 'travel' && (event.mode === 'walking' || event.mode === 'walk') && (
                                <div className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-gray-600 text-white rounded-md text-xs sm:text-sm">
                                  <TransportIcon 
                                    mode="walking" 
                                    className="w-3 h-3" 
                                    size={12}
                                  />
                                  <span className="hidden sm:inline">Walking - {event.duration}</span>
                                  <span className="sm:hidden">Walk</span>
                                </div>
                              )}
                              
                              {/* Flight booking for travel events - only show for flights */}
                              {event.type === 'travel' && (event.mode === 'flight' || event.mode === 'plane' || event.mode?.toLowerCase().includes('flight')) && (
                                <button
                                  onClick={() => handleTripComFlightBooking(event)}
                                  className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="hidden sm:inline">Book Flight on Trip.com</span>
                                  <span className="sm:hidden">Flight</span>
                                </button>
                              )}
                              
                              {/* Hotel booking for place events */}
                              {event.type === 'place' && event.category !== 'departure' && event.category !== 'destination' && event.category !== 'airport' && (
                                <button
                                  onClick={() => handleTripComHotelBooking(event)}
                                  className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs sm:text-sm"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="hidden sm:inline">Book Hotel on Trip.com</span>
                                  <span className="sm:hidden">Hotel</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Chevron for places */}
                      {event.type === 'place' && (
                        <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform ${
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