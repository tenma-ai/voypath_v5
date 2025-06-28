import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, DollarSign, Car, Train, Calendar, Star, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Place, DetailedSchedule, PlaceWithTiming } from '../types/optimization';
import { TransportIcon, getTransportColor, getTransportEmoji } from '../utils/transportIcons';
import { DateUtils } from '../utils/DateUtils';

interface OptimizedTimelineViewProps {
  optimizationResult?: DetailedSchedule;
  className?: string;
}

interface TimelineDay {
  date: string;
  displayDate: string;
  places: PlaceWithTiming[];
  totalDuration: number;
  totalCost: number;
  mealBreaks: MealBreak[];
}

interface PlaceWithTiming {
  place: Place;
  arrivalTime: string;
  departureTime: string;
  stayDuration: number;
  travelTimeToNext?: number;
  transportMode?: 'walking' | 'car' | 'flight';
  order: number;
  isSelected: boolean;
}

interface MealBreak {
  time: string;
  type: 'breakfast' | 'lunch' | 'dinner';
  duration: number;
  location: string;
}

export function OptimizedTimelineView({ optimizationResult, className = '' }: OptimizedTimelineViewProps) {
  const { places, currentTrip } = useStore();

  // Get trip places
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );

  // Process optimization results
  const selectedPlaces = optimizationResult?.selectedPlaces || tripPlaces.filter(place => place.is_selected_for_optimization);
  const unselectedPlaces = tripPlaces.filter(place => !place.is_selected_for_optimization);

  // Generate timeline data
  const timelineData = useMemo(() => {
    if (!currentTrip || selectedPlaces.length === 0) return [];

    const startDate = DateUtils.getTripStartDate(currentTrip);
    const endDate = DateUtils.getTripEndDate(currentTrip);
    
    if (!startDate) {
      console.warn('OptimizedTimelineView: No trip start date available');
      return [];
    }
    const days: TimelineDay[] = [];

    // Generate days between start and end date
    const currentDate = new Date(startDate);
    const finalEndDate = endDate || new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // Default to 7 days if no end date
    while (currentDate <= finalEndDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Filter places for this day
      const dayPlaces = selectedPlaces
        .filter((place: Place) => place.scheduled_date === dateStr || place.visit_date === dateStr)
        .sort((a: Place, b: Place) => {
          if (a.selection_round && b.selection_round) {
            return a.selection_round - b.selection_round;
          }
          const timeA = a.scheduled_time_start || '09:00';
          const timeB = b.scheduled_time_start || '09:00';
          return timeA.localeCompare(timeB);
        });

      if (dayPlaces.length > 0) {
        const placesWithTiming = generateDayTimeline(dayPlaces, currentDate);
        const totalDuration = placesWithTiming.reduce((sum, p) => sum + p.stayDuration, 0);
        const totalCost = placesWithTiming.reduce((sum, p) => sum + (p.place.estimated_cost || 0), 0);
        const mealBreaks = generateMealBreaks(placesWithTiming);

        days.push({
          date: dateStr,
          displayDate: DateUtils.formatCalendarDate(currentDate),
          places: placesWithTiming,
          totalDuration,
          totalCost,
          mealBreaks
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [selectedPlaces, currentTrip]);

  const generateDayTimeline = (dayPlaces: Place[], date: Date): PlaceWithTiming[] => {
    const startTime = 9; // 9 AM start
    let currentTime = startTime;
    
    return dayPlaces.map((place, index) => {
      const arrivalHour = Math.floor(currentTime);
      const arrivalMinute = Math.round((currentTime - arrivalHour) * 60);
      const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMinute.toString().padStart(2, '0')}`;
      
      const stayDuration = place.stay_duration_minutes;
      const stayHours = stayDuration / 60;
      
      const departureTime = currentTime + stayHours;
      const depHour = Math.floor(departureTime);
      const depMinute = Math.round((departureTime - depHour) * 60);
      const departureTimeStr = `${depHour.toString().padStart(2, '0')}:${depMinute.toString().padStart(2, '0')}`;
      
      // Add travel time for next place (estimated)
      const travelTimeToNext = index < dayPlaces.length - 1 ? 30 : 0; // 30 min average
      currentTime = departureTime + (travelTimeToNext / 60);
      
      return {
        place,
        arrivalTime,
        departureTime: departureTimeStr,
        stayDuration,
        travelTimeToNext,
        transportMode: 'car' as const,
        order: index + 1,
        isSelected: true
      };
    });
  };

  const generateMealBreaks = (places: PlaceWithTiming[]): MealBreak[] => {
    const meals: MealBreak[] = [];
    
    // Check for lunch break around 12-13
    const needsLunch = places.some(p => {
      const hour = parseInt(p.arrivalTime.split(':')[0]);
      return hour >= 12 && hour <= 14;
    });
    
    if (needsLunch) {
      meals.push({
        time: '12:30',
        type: 'lunch',
        duration: 60,
        location: 'Near scheduled location'
      });
    }
    
    return meals;
  };

  // Use centralized transport utility
  const getTransportIconLocal = (mode: string) => {
    return getTransportEmoji(mode);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'temple':
      case 'shrine':
        return '⛩️';
      case 'attraction':
        return '🏛️';
      case 'food':
        return '🍽️';
      case 'district':
        return '🏙️';
      case 'nature':
        return '🏔️';
      default:
        return '📍';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  if (!currentTrip) {
    return (
      <div className={`h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 ${className}`}>
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No Trip Selected
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Please select a trip to view the optimized timeline.
          </p>
        </div>
      </div>
    );
  }

  if (timelineData.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 ${className}`}>
        <div className="text-center p-8">
          <Calendar className="w-16 h-16 text-primary-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No Optimized Timeline
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Run the optimization to generate a day-by-day timeline.
          </p>
          {selectedPlaces.length === 0 && (
            <p className="text-slate-500 dark:text-slate-500 text-sm">
              Add places to your trip and optimize to see the timeline.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Optimized Itinerary
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Your personalized day-by-day travel schedule
          </p>
        </div>

        {/* Timeline Days */}
        <div className="space-y-8">
          {timelineData.map((day, dayIndex) => (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dayIndex * 0.1 }}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
            >
              {/* Day Header */}
              <div className="bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Day {dayIndex + 1}</h3>
                    <p className="text-primary-100">{day.displayDate}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-90">Total Duration</div>
                    <div className="text-lg font-semibold">
                      {formatDuration(day.totalDuration)}
                    </div>
                  </div>
                </div>
                
                {/* Day Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/20">
                  <div className="text-center">
                    <div className="text-sm opacity-90">Places</div>
                    <div className="text-lg font-semibold">{day.places.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-90">Duration</div>
                    <div className="text-lg font-semibold">{formatDuration(day.totalDuration)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-90">Est. Cost</div>
                    <div className="text-lg font-semibold">
                      ${day.totalCost > 0 ? day.totalCost.toFixed(0) : '--'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Content */}
              <div className="p-6">
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500 to-secondary-500"></div>
                  
                  {/* Timeline Items */}
                  <div className="space-y-6">
                    {day.places.map((item, index) => (
                      <motion.div
                        key={item.place.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (dayIndex * 0.1) + (index * 0.05) }}
                        className="relative flex items-start space-x-4"
                      >
                        {/* Timeline Dot */}
                        <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">
                          <span className="text-lg">{item.order}</span>
                        </div>
                        
                        {/* Place Card */}
                        <div className="flex-1 bg-slate-50/80 dark:bg-slate-700/50 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-600/50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{getCategoryIcon(item.place.category)}</span>
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                                  {item.place.name}
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                                  {item.place.category}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {item.arrivalTime} - {item.departureTime}
                              </div>
                              <div className="flex items-center text-sm text-amber-600 dark:text-amber-400">
                                <Star className="w-3 h-3 mr-1" />
                                <span>{item.place.wish_level}/5</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Place Details */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-primary-500" />
                              <span className="text-slate-600 dark:text-slate-300">
                                {formatDuration(item.stayDuration)}
                              </span>
                            </div>
                            
                            {item.place.estimated_cost && (
                              <div className="flex items-center space-x-2">
                                <DollarSign className="w-4 h-4 text-green-500" />
                                <span className="text-slate-600 dark:text-slate-300">
                                  ${item.place.estimated_cost}
                                </span>
                              </div>
                            )}
                            
                            {item.place.address && (
                              <div className="flex items-center space-x-2 col-span-2">
                                <MapPin className="w-4 h-4 text-red-500" />
                                <span className="text-slate-600 dark:text-slate-300 truncate">
                                  {item.place.address}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {item.place.notes && (
                            <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                {item.place.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Travel Time Indicators */}
                    {day.places.map((item, index) => (
                      index < day.places.length - 1 && item.travelTimeToNext && (
                        <motion.div
                          key={`travel-${index}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: (dayIndex * 0.1) + (index * 0.05) + 0.2 }}
                          className="relative flex items-center space-x-4 ml-8"
                        >
                          <div className="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-lg flex items-center justify-center">
                            <TransportIcon 
                              mode={item.transportMode || 'car'} 
                              size={16}
                              className="filter brightness-0 dark:brightness-100 opacity-70"
                            />
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {formatDuration(item.travelTimeToNext!)} travel time
                          </div>
                        </motion.div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Unselected Places */}
        {unselectedPlaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: timelineData.length * 0.1 }}
            className="mt-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-6 text-white">
              <h3 className="text-xl font-bold mb-1">Places Not Included</h3>
              <p className="text-gray-100">
                These places didn't make it into the optimized itinerary
              </p>
            </div>
            
            <div className="p-6">
              <div className="grid gap-4">
                {unselectedPlaces.map((place, index) => (
                  <motion.div
                    key={place.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center space-x-4 p-4 bg-slate-50/80 dark:bg-slate-700/50 rounded-xl border border-slate-200/50 dark:border-slate-600/50"
                  >
                    <span className="text-2xl">{getCategoryIcon(place.category)}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        {place.name}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {place.category} • {formatDuration(place.stay_duration_minutes)}
                      </p>
                    </div>
                    <div className="flex items-center text-sm text-amber-600 dark:text-amber-400">
                      <Star className="w-3 h-3 mr-1" />
                      <span>{place.wish_level}/5</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}