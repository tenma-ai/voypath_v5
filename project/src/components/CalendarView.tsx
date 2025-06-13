import React, { useState, useMemo, useCallback } from 'react';
import { Clock, Users, Calendar as CalendarIcon, Sparkles, AlertCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';

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
}

type EventsByDate = Record<string, CalendarEvent[]>;

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

// Create gradient for multiple members
const createMultiMemberGradient = (members: string[]): string => {
  if (members.length === 1) {
    return getMemberColor(members[0]);
  }
  
  const colors = members.map(member => {
    const gradient = getMemberColor(member);
    // Extract the first color from the gradient
    const match = gradient.match(/#[a-fA-F0-9]{6}/);
    return match ? match[0] : '#6b7280';
  });
  return `linear-gradient(135deg, ${colors.join(', ')})`;
};

// Get background style for events based on assigned members
const getEventBackgroundStyle = (assignedTo: string[]) => {
  return {
    background: createMultiMemberGradient(assignedTo),
    color: 'white'
  };
};


export function CalendarView() {
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  const { places, currentTrip, isLoading } = useStore();
  
  // Trip period - use real trip dates or default
  const tripStart = currentTrip?.start_date ? new Date(currentTrip.start_date) : new Date('2024-05-15');
  const tripEnd = currentTrip?.end_date ? new Date(currentTrip.end_date) : new Date('2024-05-22');
  
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Filter places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );

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

  // Generate events from real data
  const eventsByDate = useMemo(() => {
    if (!currentTrip || tripPlaces.length === 0) return {};

    const events: EventsByDate = {};
    
    // Get trip days for unscheduled places distribution
    const tripDays = getTripDays();
    let unscheduledIndex = 0;
    
    tripPlaces.forEach(place => {
      let date = place.visit_date || place.scheduled_date;
      
      // If no date assigned, distribute unscheduled places across trip days
      if (!date && tripDays.length > 0) {
        const dayIndex = unscheduledIndex % tripDays.length;
        date = formatDate(tripDays[dayIndex]);
        unscheduledIndex++;
      }
      
      if (date) {
        if (!events[date]) events[date] = [];
        events[date].push({
          id: place.id,
          name: place.name,
          time: place.scheduled_time_start && place.scheduled_time_end 
            ? `${place.scheduled_time_start} - ${place.scheduled_time_end}`
            : place.scheduled ? 'Scheduled' : 'Unscheduled',
          duration: place.stay_duration_minutes,
          type: 'place' as const,
          priority: place.wish_level >= 4 ? 4 : place.wish_level >= 3 ? 3 : place.wish_level,
          assignedTo: place.user_id ? [place.user_id] : [],
          category: place.category || 'attraction'
        });
      }
    });
    
    return events;
  }, [tripPlaces, currentTrip, getTripDays]);

  const getDayEvents = (date: Date) => {
    const dateStr = formatDate(date);
    return eventsByDate[dateStr] || [];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
      case 'trip':
        return '🚌';
      default:
        return '📍';
    }
  };

  const handleAddPlace = () => {
    navigate('/add-place');
  };

  const tripDays = getTripDays();

  // Get spanning events (multi-day places)
  const spanningEvents = useMemo(() => {
    const spanningEvts: (CalendarEvent & { startDate: Date; endDate: Date })[] = [];
    
    Object.entries(eventsByDate).forEach(([dateStr, events]) => {
      events.forEach(event => {
        if (event.isSpanning && event.spanDays) {
          const startDate = new Date(dateStr);
          spanningEvts.push({
            ...event,
            startDate,
            endDate: new Date(startDate.getTime() + (event.spanDays - 1) * 24 * 60 * 60 * 1000)
          });
        }
      });
    });
    
    return spanningEvts;
  }, [eventsByDate]);


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
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-secondary-400/8 via-primary-500/8 to-accent-500/8 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 5
          }}
        />
      </div>


      {/* Enhanced Trip Period Calendar */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          /* Loading State */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CalendarIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Loading Calendar...
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Preparing your trip calendar
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
              Please select or create a trip to view the calendar
            </p>
          </div>
        ) : tripPlaces.length === 0 ? (
          /* Empty Calendar State */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No Places Scheduled
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Add places to your trip to see them in the calendar
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
        ) : (
          <>
        {/* Days of week header with enhanced styling */}
        <div className="grid grid-cols-7 gap-3 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <motion.div 
              key={day} 
              className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl shadow-soft border border-slate-200/50 dark:border-slate-700/50"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {day}
            </motion.div>
          ))}
        </div>

        {/* Enhanced Calendar Grid */}
        <div className="relative">
          {/* Background grid */}
          <div className="grid grid-cols-7 gap-3">
            {tripDays.map((date, index) => {
              const dayEvents = getDayEvents(date).filter(event => !event.isSpanning);
              const todayDate = isToday(date);

              return (
                <motion.div
                  key={index}
                  className={`h-36 lg:h-44 border-2 rounded-3xl p-4 relative overflow-hidden transition-all duration-300 group ${
                    todayDate 
                      ? 'border-primary-400 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-900/30 dark:via-slate-800/80 dark:to-secondary-900/30 shadow-glow' 
                      : 'border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-br from-white/80 via-slate-50/50 to-white/80 dark:from-slate-800/80 dark:via-slate-700/50 dark:to-slate-800/80 hover:border-primary-300/50 dark:hover:border-primary-600/50 hover:shadow-medium'
                  }`}
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  {/* Enhanced background effects */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Day number with enhanced styling */}
                  <div className={`text-xl font-bold mb-2 relative z-10 ${
                    todayDate
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {date.getDate()}
                  </div>

                  {/* Day name with enhanced styling */}
                  <div className={`text-xs font-semibold mb-3 relative z-10 ${
                    todayDate 
                      ? 'text-primary-500 dark:text-primary-400' 
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>

                  {/* Add Place Button - Primary/Secondary gradient */}
                  <motion.button
                    onClick={handleAddPlace}
                    className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 rounded-full flex items-center justify-center shadow-soft hover:shadow-medium transition-all duration-300 group/btn z-20"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Plus className="w-3 h-3 text-white group-hover/btn:scale-110 transition-transform" />
                  </motion.button>

                  {/* Today indicator with enhanced animation */}
                  {todayDate && (
                    <motion.div 
                      className="absolute top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-primary-500 rounded-full shadow-glow"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                    />
                  )}

                  {/* Enhanced Regular Events */}
                  <div className="space-y-2 relative z-10">
                    {dayEvents.slice(0, 2).map((event, eventIndex) => (
                      <motion.div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="group/event cursor-pointer"
                        whileHover={{ scale: 1.05, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: eventIndex * 0.1 }}
                      >
                        <div 
                          className="text-xs px-3 py-2 rounded-xl border border-white/30 transition-all duration-300 hover:shadow-medium font-medium backdrop-blur-sm relative overflow-hidden"
                          style={getEventBackgroundStyle(event.assignedTo)}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/event:opacity-100 transition-opacity duration-300"></div>
                          <div className="flex items-center space-x-2 relative z-10">
                            <span className="text-sm">{getCategoryIcon(event.category)}</span>
                            <span className="font-semibold text-xs">{event.time}</span>
                          </div>
                          <div className="truncate font-semibold text-xs mt-1 relative z-10">{event.name}</div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Show more indicator with enhanced styling */}
                    {dayEvents.length > 2 && (
                      <motion.div 
                        className="text-xs text-primary-600 dark:text-primary-400 px-3 py-1 font-semibold bg-primary-100/60 dark:bg-primary-900/30 rounded-xl backdrop-blur-sm"
                        whileHover={{ scale: 1.05 }}
                      >
                        +{dayEvents.length - 2} more
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Enhanced Spanning Events Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {spanningEvents.map((event, eventIndex) => {
              const startIndex = tripDays.findIndex(day => 
                day.toDateString() === event.startDate.toDateString()
              );
              const endIndex = tripDays.findIndex(day => 
                day.toDateString() === event.endDate.toDateString()
              );
              
              if (startIndex === -1 || endIndex === -1) return null;

              const startRow = Math.floor(startIndex / 7);
              const endRow = Math.floor(endIndex / 7);
              const startCol = startIndex % 7;
              const endCol = endIndex % 7;

              // Handle single row spanning
              if (startRow === endRow) {
                const width = ((endCol - startCol + 1) * 100) / 7;
                const left = (startCol * 100) / 7;
                const top = startRow * (144 + 12) + 100; // Adjusted for new height

                return (
                  <motion.div
                    key={`spanning-${event.id}`}
                    className="absolute pointer-events-auto cursor-pointer z-10"
                    style={{
                      left: `${left}%`,
                      top: `${top}px`,
                      width: `${width}%`,
                      height: '28px'
                    }}
                    onClick={() => setSelectedEvent(event)}
                    whileHover={{ scale: 1.02, zIndex: 20, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: eventIndex * 0.1 }}
                  >
                    <div 
                      className="h-full rounded-2xl border-2 border-white/40 shadow-glow flex items-center px-4 text-white font-bold text-sm backdrop-blur-sm relative overflow-hidden"
                      style={{ background: createMultiMemberGradient(event.assignedTo) }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                      <span className="mr-2 text-lg relative z-10">{getCategoryIcon(event.category)}</span>
                      <span className="truncate relative z-10">{event.name}</span>
                      <span className="ml-auto text-xs opacity-90 relative z-10">
                        {event.spanDays}d
                      </span>
                    </div>
                  </motion.div>
                );
              }

              // Handle multi-row spanning with enhanced styling
              const segments = [];
              for (let row = startRow; row <= endRow; row++) {
                const isFirstRow = row === startRow;
                const isLastRow = row === endRow;
                
                const segmentStartCol = isFirstRow ? startCol : 0;
                const segmentEndCol = isLastRow ? endCol : 6;
                
                const segmentWidth = ((segmentEndCol - segmentStartCol + 1) * 100) / 7;
                const segmentLeft = (segmentStartCol * 100) / 7;
                const segmentTop = row * (144 + 12) + 100;

                segments.push(
                  <motion.div
                    key={`spanning-${event.id}-row-${row}`}
                    className="absolute pointer-events-auto cursor-pointer z-10"
                    style={{
                      left: `${segmentLeft}%`,
                      top: `${segmentTop}px`,
                      width: `${segmentWidth}%`,
                      height: '28px'
                    }}
                    onClick={() => setSelectedEvent(event)}
                    whileHover={{ scale: 1.02, zIndex: 20, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: eventIndex * 0.1 + row * 0.05 }}
                  >
                    <div 
                      className={`h-full border-2 border-white/40 shadow-glow flex items-center px-4 text-white font-bold text-sm backdrop-blur-sm relative overflow-hidden ${
                        isFirstRow ? 'rounded-l-2xl' : ''
                      } ${
                        isLastRow ? 'rounded-r-2xl' : ''
                      } ${
                        !isFirstRow && !isLastRow ? 'rounded-none' : ''
                      }`}
                      style={{ background: createMultiMemberGradient(event.assignedTo) }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                      {isFirstRow && (
                        <>
                          <span className="mr-2 text-lg relative z-10">{getCategoryIcon(event.category)}</span>
                          <span className="truncate relative z-10">{event.name}</span>
                        </>
                      )}
                      {isLastRow && !isFirstRow && (
                        <span className="ml-auto text-xs opacity-90 relative z-10">
                          {event.spanDays}d
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              }

              return segments;
            })}
          </div>
        </div>
          </>
        )}
      </div>


      {/* Enhanced Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-glass border border-slate-200/50 dark:border-slate-700/50 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-transparent to-secondary-50/30 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20"></div>
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl">{getCategoryIcon(selectedEvent.category)}</div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {selectedEvent.name}
                      </h3>
                      <div className="flex items-center space-x-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{selectedEvent.time}</span>
                        </div>
                        <span>•</span>
                        <span className="font-medium">
                          {selectedEvent.spanDays 
                            ? `${selectedEvent.spanDays} days`
                            : `${Math.floor(selectedEvent.duration / 60)}h ${selectedEvent.duration % 60}m`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setSelectedEvent(null)}
                    className="p-3 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <span className="text-slate-500 text-xl">✕</span>
                  </motion.button>
                </div>

                <div className="space-y-6">
                  {selectedEvent.assignedTo && selectedEvent.assignedTo.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center space-x-2">
                        <Users className="w-4 h-4" />
                        <span>Assigned to:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.assignedTo.map((member: string) => (
                          <motion.div
                            key={member}
                            className="flex items-center space-x-2 px-4 py-2 rounded-2xl text-white text-sm font-semibold shadow-soft"
                            style={{ background: getMemberColor(member) }}
                            whileHover={{ scale: 1.05 }}
                          >
                            <span>{member}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                    <motion.button
                      className="w-full px-6 py-4 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg relative overflow-hidden group"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        <Sparkles className="w-5 h-5" />
                        <span>View Details</span>
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}