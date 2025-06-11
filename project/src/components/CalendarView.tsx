import React, { useState } from 'react';
import { Clock, Users, Calendar as CalendarIcon, Sparkles, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const mockEvents = {
  "2024-05-15": [
    {
      id: '1',
      name: 'Senso-ji Temple',
      time: '09:00',
      duration: 120,
      type: 'place',
      priority: 5,
      assignedTo: ['Alice', 'Bob'],
      category: 'temple'
    },
    {
      id: '2',
      name: 'Tokyo Skytree',
      time: '14:00',
      duration: 180,
      type: 'place',
      priority: 4,
      assignedTo: ['Charlie'],
      category: 'attraction'
    }
  ],
  "2024-05-16": [
    {
      id: '3',
      name: 'Meiji Shrine',
      time: '10:00',
      duration: 90,
      type: 'place',
      priority: 4,
      assignedTo: ['Alice', 'Diana'],
      category: 'shrine'
    },
    {
      id: '4',
      name: 'Lunch at Tsukiji',
      time: '12:30',
      duration: 60,
      type: 'meal',
      priority: 3,
      assignedTo: ['Alice', 'Bob', 'Charlie', 'Diana'],
      category: 'food'
    }
  ],
  "2024-05-17": [
    {
      id: '5',
      name: 'Shibuya Crossing',
      time: '16:00',
      duration: 45,
      type: 'place',
      priority: 3,
      assignedTo: ['Bob', 'Charlie'],
      category: 'attraction'
    }
  ],
  "2024-05-18": [
    {
      id: '6',
      name: 'Tokyo Disney Resort',
      time: '09:00',
      duration: 600,
      type: 'place',
      priority: 5,
      assignedTo: ['Alice', 'Bob', 'Charlie', 'Diana'],
      category: 'attraction',
      spanDays: 2,
      isSpanning: true
    }
  ],
  "2024-05-20": [
    {
      id: '7',
      name: 'Harajuku',
      time: '11:00',
      duration: 120,
      type: 'place',
      priority: 4,
      assignedTo: ['Alice'],
      category: 'district'
    },
    {
      id: '8',
      name: 'Mount Fuji Trip',
      time: '06:00',
      duration: 1440,
      type: 'trip',
      priority: 5,
      assignedTo: ['Alice', 'Bob', 'Charlie', 'Diana'],
      category: 'nature',
      spanDays: 3,
      isSpanning: true
    }
  ]
};

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
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  // Trip period: May 15-22, 2024
  const tripStart = new Date('2024-05-15');
  const tripEnd = new Date('2024-05-22');
  
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDayEvents = (date: Date) => {
    const dateStr = formatDate(date);
    return mockEvents[dateStr as keyof typeof mockEvents] || [];
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

  // Generate trip period days
  const getTripDays = () => {
    const days = [];
    const currentDate = new Date(tripStart);
    
    while (currentDate <= tripEnd) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const tripDays = getTripDays();

  // Get spanning events that start on or before a given day and extend beyond it
  const getSpanningEvents = () => {
    const spanningEvents: any[] = [];
    
    Object.entries(mockEvents).forEach(([dateStr, events]) => {
      events.forEach(event => {
        if (event.isSpanning && event.spanDays) {
          const startDate = new Date(dateStr);
          spanningEvents.push({
            ...event,
            startDate,
            endDate: new Date(startDate.getTime() + (event.spanDays - 1) * 24 * 60 * 60 * 1000)
          });
        }
      });
    });
    
    return spanningEvents;
  };

  const spanningEvents = getSpanningEvents();

  // Check if a date is within a spanning event
  const getSpanningEventForDate = (date: Date) => {
    return spanningEvents.find(event => 
      date >= event.startDate && date <= event.endDate
    );
  };

  // Get the position of a spanning event (start, middle, end)
  const getSpanningEventPosition = (date: Date, event: any) => {
    if (date.toDateString() === event.startDate.toDateString()) return 'start';
    if (date.toDateString() === event.endDate.toDateString()) return 'end';
    return 'middle';
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

      {/* Enhanced Calendar Header */}
      <div className="relative p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-secondary-50/50 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-3xl flex items-center justify-center shadow-glow"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <CalendarIcon className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                  Trip Calendar
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Plan your perfect journey
                </p>
              </div>
            </div>
            
            <motion.div 
              className="text-sm text-slate-600 dark:text-slate-400 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 px-4 py-2 rounded-2xl border border-primary-200/50 dark:border-primary-800/50 shadow-soft"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4 text-primary-500" />
                <span className="font-medium">
                  {tripStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {tripEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Add Place Button */}
          <div className="mb-6 text-center">
            <motion.button
              onClick={handleAddPlace}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg group"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span>Add Place to Calendar</span>
            </motion.button>
          </div>

          {/* Enhanced Member Legend */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {['Alice', 'Bob', 'Charlie', 'Diana'].map((member, index) => (
              <motion.div 
                key={member} 
                className="flex items-center space-x-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-3 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-soft hover:shadow-medium transition-all duration-300"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -2 }}
              >
                <div 
                  className="w-5 h-5 rounded-full shadow-soft"
                  style={{ background: getMemberColor(member) }}
                ></div>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{member}</span>
              </motion.div>
            ))}
            <motion.div 
              className="flex items-center space-x-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-3 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-soft"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="w-5 h-2 bg-gradient-to-r from-blue-500 via-red-500 to-green-500 rounded-full shadow-soft"></div>
              <span className="text-slate-700 dark:text-slate-300 font-medium">Multi-member</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Enhanced Trip Period Calendar */}
      <div className="flex-1 overflow-auto p-6">
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