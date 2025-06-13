import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Star, Users, ChevronRight, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { Place } from '../types/optimization';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { GooglePlace } from '../services/PlaceSearchService';

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

// Member color mapping with gradients
const getMemberColor = (memberName: string): string => {
  const memberColors: Record<string, string> = {
    'Alice': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'Bob': 'linear-gradient(135deg, #ef4444, #dc2626)',
    'Charlie': 'linear-gradient(135deg, #10b981, #059669)',
    'Diana': 'linear-gradient(135deg, #f59e0b, #d97706)',
  };
  
  return memberColors[memberName] || 'linear-gradient(135deg, #6b7280, #4b5563)';
};


export function ListView() {
  const navigate = useNavigate();
  const { places, currentTrip, isLoading } = useStore();
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );

  // Generate schedule from real data
  const schedule = useMemo(() => {
    if (!currentTrip || tripPlaces.length === 0) return [];
    
    // Group places by scheduled status and date availability
    const scheduledPlaces = tripPlaces.filter(place => place.scheduled);
    const placesWithDates = scheduledPlaces.filter(place => 
      place.visit_date || place.scheduled_date
    );
    
    const scheduleDays: DaySchedule[] = [];
    
    // Add places with specific dates
    const dateGroups = placesWithDates.reduce((groups, place) => {
      const date = place.visit_date || place.scheduled_date;
      if (date) {
        if (!groups[date]) groups[date] = [];
        groups[date].push(place);
      }
      return groups;
    }, {} as Record<string, Place[]>);
    
    Object.entries(dateGroups).forEach(([date, places], index) => {
      const daySchedule: DaySchedule = {
        date,
        day: `Day ${index + 1}`,
        dayName: new Date(date).toLocaleDateString('en', { weekday: 'long' }),
        events: places.map(place => ({
          id: place.id,
          type: 'place' as const,
          name: place.name,
          time: place.scheduled_time_start && place.scheduled_time_end 
            ? `${place.scheduled_time_start} - ${place.scheduled_time_end}`
            : place.scheduled ? 'Scheduled' : 'Unscheduled',
          duration: place.stay_duration_minutes 
            ? `${Math.floor(place.stay_duration_minutes / 60)}h ${place.stay_duration_minutes % 60}m`
            : undefined,
          category: place.category,
          rating: place.rating || place.google_rating,
          assignedTo: [place.user_id], // Simplified for now
          image: place.image_url,
          description: place.notes,
          priority: place.wish_level >= 4 ? 'high' : place.wish_level >= 3 ? 'medium' : 'low'
        }))
      };
      scheduleDays.push(daySchedule);
    });
    
    // Add scheduled places without specific dates to the first available day
    const scheduledWithoutDates = scheduledPlaces.filter(place => 
      !place.visit_date && !place.scheduled_date
    );
    
    if (scheduledWithoutDates.length > 0) {
      const defaultDate = currentTrip?.start_date || currentTrip?.startDate || new Date().toISOString().split('T')[0];
      
      // Find or create first day schedule
      let firstDay = scheduleDays.find(day => day.date === defaultDate);
      if (!firstDay) {
        firstDay = {
          date: defaultDate,
          day: 'Day 1',
          dayName: new Date(defaultDate).toLocaleDateString('en', { weekday: 'long' }),
          events: []
        };
        scheduleDays.push(firstDay);
      }
      
      // Add scheduled places without dates to first day
      const additionalEvents = scheduledWithoutDates.map(place => ({
        id: place.id,
        type: 'place' as const,
        name: place.name,
        time: 'Scheduled',
        duration: place.stay_duration_minutes 
          ? `${Math.floor(place.stay_duration_minutes / 60)}h ${place.stay_duration_minutes % 60}m`
          : undefined,
        category: place.category,
        rating: place.rating || place.google_rating,
        assignedTo: [place.user_id],
        image: place.image_url,
        description: place.notes,
        priority: place.wish_level >= 4 ? 'high' : place.wish_level >= 3 ? 'medium' : 'low'
      }));
      
      firstDay.events.push(...additionalEvents);
    }

    // If no scheduled places exist, create a default day with all places
    if (scheduleDays.length === 0 && tripPlaces.length > 0) {
      const defaultDay: DaySchedule = {
        date: new Date().toISOString().split('T')[0],
        day: 'Day 1',
        dayName: 'Trip Day',
        events: tripPlaces.map(place => ({
          id: place.id,
          type: 'place' as const,
          name: place.name,
          duration: place.stay_duration_minutes 
            ? `${Math.floor(place.stay_duration_minutes / 60)}h ${place.stay_duration_minutes % 60}m`
            : undefined,
          category: place.category,
          rating: place.rating || place.google_rating,
          assignedTo: [place.user_id],
          image: place.image_url,
          description: place.notes,
          priority: place.wish_level >= 4 ? 'high' : place.wish_level >= 3 ? 'medium' : 'low'
        }))
      };
      scheduleDays.push(defaultDay);
    }
    
    return scheduleDays;
  }, [tripPlaces, currentTrip]);

  const selectedSchedule = schedule.find(s => s.date === selectedDay) || schedule[0];

  const handleAddPlace = () => {
    navigate('/add-place');
  };

  const handlePlaceSelect = (place: GooglePlace) => {
    // Navigate to configure place page with the selected place
    navigate('/add-place', { state: { selectedPlace: place } });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'temple':
      case 'shrine':
        return '⛩️';
      case 'attraction':
        return '🏛️';
      case 'district':
        return '🏙️';
      case 'restaurant':
        return '🍴';
      default:
        return '📍';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'subway':
        return '🚇';
      case 'walk':
        return '🚶';
      case 'taxi':
        return '🚕';
      case 'bus':
        return '🚌';
      default:
        return '🚶';
    }
  };

  const toggleEventCollapse = (eventId: string) => {
    const newCollapsed = new Set(collapsedEvents);
    if (newCollapsed.has(eventId)) {
      newCollapsed.delete(eventId);
    } else {
      newCollapsed.add(eventId);
    }
    setCollapsedEvents(newCollapsed);
  };


  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : 'text-slate-300 dark:text-slate-600'
        }`}
      />
    ));
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-400/10 via-secondary-500/10 to-primary-600/10 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Day Selector */}
      {schedule.length > 0 && (
        <div className="relative p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
            {schedule.map((scheduleDay, index) => (
            <motion.button
              key={scheduleDay.date}
              onClick={() => setSelectedDay(scheduleDay.date)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                selectedDay === scheduleDay.date
                  ? 'border-primary-300 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/30 shadow-glow'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white/60 dark:bg-slate-800/60 hover:shadow-medium'
              }`}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {selectedDay === scheduleDay.date && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-3xl"></div>
              )}
              <div className="text-center relative z-10">
                <div className={`text-sm font-bold ${
                  selectedDay === scheduleDay.date 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {scheduleDay.day}
                </div>
                <div className={`text-xs ${
                  selectedDay === scheduleDay.date 
                    ? 'text-primary-500 dark:text-primary-400' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {new Date(scheduleDay.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Compact Timeline */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          /* Loading State */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Calendar className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Loading Schedule...
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Preparing your itinerary
            </p>
          </div>
        ) : !currentTrip ? (
          /* No Trip State */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No Trip Selected
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Please select or create a trip to view the schedule
            </p>
          </div>
        ) : schedule.length === 0 ? (
          /* Empty Schedule State */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No Places Scheduled
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Add places to your trip to see them in the schedule
            </p>
            <motion.button
              onClick={handleAddPlace}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Add Your First Place
            </motion.button>
          </div>
        ) : selectedSchedule ? (
          <div className="relative max-w-4xl mx-auto">
            {/* Compact Vertical Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-400 via-secondary-500 to-primary-600 rounded-full shadow-glow"></div>

            <div className="space-y-3">
              {selectedSchedule.events.map((event, index) => (
                <React.Fragment key={event.id}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative flex items-start space-x-4"
                  >
                    {event.type === 'place' ? (
                      <>
                        {/* Compact Timeline Node */}
                        <motion.div 
                          className="relative z-10 w-3 h-3 bg-gradient-to-br from-primary-400 to-secondary-600 rounded-full shadow-glow border-2 border-white dark:border-slate-900 mt-3"
                          whileHover={{ scale: 1.2 }}
                          transition={{ duration: 0.2 }}
                        />
                        
                        {/* Compact Horizontal Place Card */}
                        <motion.div 
                          className="flex-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden shadow-soft hover:shadow-glow transition-all duration-300 group relative"
                          whileHover={{ y: -2, scale: 1.005 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Background gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-transparent to-secondary-50/30 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <div className="flex relative z-10">
                            {/* Compact Image */}
                            <div className="relative w-20 h-20 flex-shrink-0">
                              <img
                                src={event.image}
                                alt={event.name}
                                className="w-full h-full object-cover rounded-l-xl"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent rounded-l-xl"></div>
                              
                              {/* Priority indicator */}
                              {event.priority === 'high' && (
                                <div className="absolute top-1 left-1 w-4 h-4 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-glow">
                                  <Star className="w-2 h-2 text-white fill-current" />
                                </div>
                              )}
                            </div>
                            
                            {/* Compact Content */}
                            <div className="flex-1 p-3">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="text-lg">{getCategoryIcon(event.category)}</span>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                                      {event.name}
                                    </h3>
                                  </div>
                                  
                                  <p className="text-slate-600 dark:text-slate-400 text-xs mb-2 leading-relaxed line-clamp-1">
                                    {event.description}
                                  </p>
                                  
                                  <div className="flex items-center space-x-3 text-xs">
                                    <div className="flex items-center space-x-1 text-primary-600 dark:text-primary-400">
                                      <Clock className="w-3 h-3" />
                                      <span className="font-semibold">{event.time}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      {renderStars(event.rating)}
                                      <span className="font-semibold text-slate-700 dark:text-slate-300 ml-1">{event.rating}</span>
                                    </div>
                                    <div className="text-slate-500 dark:text-slate-400">
                                      {event.duration}
                                    </div>
                                  </div>
                                </div>
                                
                                <motion.button
                                  onClick={() => toggleEventCollapse(event.id)}
                                  className="p-1 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  {collapsedEvents.has(event.id) ? (
                                    <Eye className="w-3 h-3 text-slate-500" />
                                  ) : (
                                    <EyeOff className="w-3 h-3 text-slate-500" />
                                  )}
                                </motion.button>
                              </div>

                              {/* Compact Assigned Members */}
                              {event.assignedTo && event.assignedTo.length > 0 && (
                                <div className="flex items-center space-x-2 mb-2">
                                  <Users className="w-3 h-3 text-slate-500" />
                                  <div className="flex space-x-1">
                                    {event.assignedTo.map((member) => (
                                      <motion.div
                                        key={member}
                                        className="flex items-center space-x-1 px-2 py-1 rounded-lg text-white text-xs font-semibold shadow-soft"
                                        style={{ background: getMemberColor(member) }}
                                        whileHover={{ scale: 1.05 }}
                                      >
                                        <span>{member}</span>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Enhanced Expanded Details */}
                              <AnimatePresence>
                                {!collapsedEvents.has(event.id) && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="border-t border-slate-200/50 dark:border-slate-700/50 pt-4"
                                  >
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                      <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-lg p-2">
                                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Category:</span>
                                        <div className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{event.category}</div>
                                      </div>
                                      <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-lg p-2">
                                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Duration:</span>
                                        <div className="font-semibold text-slate-700 dark:text-slate-300">{event.duration}</div>
                                      </div>
                                    </div>
                                    
                                    <motion.button
                                      className="w-full px-3 py-2 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg group relative overflow-hidden text-xs"
                                      whileHover={{ scale: 1.02, y: -1 }}
                                      whileTap={{ scale: 0.98 }}
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                      <span className="relative z-10 flex items-center justify-center space-x-1">
                                        <Sparkles className="w-3 h-3" />
                                        <span>View Details</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </span>
                                    </motion.button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      </>
                    ) : event.type === 'travel' ? (
                      <>
                        {/* Enhanced Travel Node */}
                        <motion.div 
                          className="relative z-10 w-4 h-4 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full border-4 border-white dark:border-slate-900 mt-4 shadow-soft"
                          whileHover={{ scale: 1.2 }}
                        />
                        
                        {/* Enhanced Travel Info */}
                        <div className="flex-1 py-2">
                          <motion.div 
                            className="flex items-center space-x-4 text-sm bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-800/80 dark:to-slate-700/80 backdrop-blur-sm rounded-3xl px-6 py-4 border border-slate-200/50 dark:border-slate-700/50 shadow-soft hover:shadow-medium transition-all duration-300"
                            whileHover={{ scale: 1.01, y: -1 }}
                          >
                            <span className="text-3xl">{getModeIcon(event.mode)}</span>
                            <div className="flex-1">
                              <div className="font-semibold text-slate-700 dark:text-slate-300">
                                {event.from} → {event.to}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 flex items-center space-x-3 mt-1">
                                <span>{event.duration}</span>
                                <span>•</span>
                                <span>{event.distance}</span>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Enhanced Meal Node */}
                        <motion.div 
                          className="relative z-10 w-4 h-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-full border-4 border-white dark:border-slate-900 mt-6 shadow-glow"
                          whileHover={{ scale: 1.2 }}
                        />
                        
                        {/* Enhanced Meal Card */}
                        <motion.div 
                          className="flex-1 bg-gradient-to-br from-orange-50/90 via-white/90 to-red-50/90 dark:from-orange-900/30 dark:via-slate-800/90 dark:to-red-900/30 backdrop-blur-xl rounded-3xl border border-orange-200/50 dark:border-orange-800/50 p-6 shadow-soft hover:shadow-glow transition-all duration-300 relative overflow-hidden group"
                          whileHover={{ y: -2, scale: 1.01 }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-orange-100/50 to-red-100/50 dark:from-orange-900/20 dark:to-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center space-x-4">
                              <span className="text-4xl">🍽️</span>
                              <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                  {event.name}
                                </h3>
                                {event.restaurant && (
                                  <p className="text-orange-600 dark:text-orange-400 font-semibold">
                                    {event.restaurant}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                  <div className="flex items-center space-x-1">
                                    <Clock className="w-4 h-4" />
                                    <span className="font-medium">{event.time}</span>
                                  </div>
                                  {event.cuisine && (
                                    <div className="px-3 py-1 bg-orange-100/80 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-semibold">
                                      {event.cuisine}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Enhanced Assigned Members for Meals */}
                            {event.assignedTo && event.assignedTo.length > 0 && (
                              <div className="flex space-x-2">
                                {event.assignedTo.map((member) => (
                                  <motion.div
                                    key={member}
                                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-bold shadow-soft"
                                    style={{ background: getMemberColor(member) }}
                                    whileHover={{ scale: 1.1 }}
                                  >
                                    {member.charAt(0)}
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </motion.div>

                  {/* Add Place Between Events - Search Box */}
                  {index < selectedSchedule.events.length - 1 && (
                    <div className="relative flex items-center space-x-4">
                      <div className="w-3 h-3"></div> {/* Spacer for timeline alignment */}
                      <div className="flex-1 max-w-md">
                        <PlaceSearchInput
                          value={searchQuery}
                          onChange={setSearchQuery}
                          onPlaceSelect={handlePlaceSelect}
                          placeholder="Add place here..."
                          className="w-full py-2 px-3 text-sm rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-600 bg-gradient-to-r from-primary-50/80 to-secondary-50/80 dark:from-primary-900/30 dark:to-secondary-900/30"
                          searchContext={{
                            radius: 50,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          /* No Schedule for Selected Day */
          <div className="text-center py-16">
            <motion.div 
              className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-soft"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <Calendar className="w-12 h-12 text-slate-400" />
            </motion.div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              No schedule for this day
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
              Add places to your trip to see them in your timeline
            </p>
            <div className="w-full max-w-md mx-auto">
              <PlaceSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search places to add..."
                className="w-full py-3 px-4 rounded-xl"
                searchContext={{
                  radius: 50,
                }}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}