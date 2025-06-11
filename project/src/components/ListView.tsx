import React, { useState } from 'react';
import { Calendar, Clock, Star, Users, ChevronRight, Eye, EyeOff, Sparkles, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const mockSchedule = [
  {
    date: '2024-05-15',
    day: 'Day 1',
    dayName: 'Wednesday',
    events: [
      {
        id: '1',
        type: 'place',
        name: 'Senso-ji Temple',
        time: '09:00 - 11:00',
        duration: '2 hours',
        category: 'temple',
        rating: 4.8,
        assignedTo: ['Alice', 'Bob'],
        image: 'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=400&h=200&fit=crop',
        description: 'Ancient Buddhist temple in Asakusa district',
        priority: 'high'
      },
      {
        id: '2',
        type: 'travel',
        mode: 'subway',
        duration: '25 min',
        distance: '3.2 km',
        from: 'Senso-ji Temple',
        to: 'Tokyo Skytree'
      },
      {
        id: '3',
        type: 'place',
        name: 'Tokyo Skytree',
        time: '11:30 - 14:00',
        duration: '2.5 hours',
        category: 'attraction',
        rating: 4.6,
        assignedTo: ['Charlie'],
        image: 'https://images.unsplash.com/photo-1533619239233-6280475a633a?w=400&h=200&fit=crop',
        description: 'Iconic broadcasting tower with observation decks',
        priority: 'medium'
      },
      {
        id: '4',
        type: 'meal',
        name: 'Lunch Break',
        time: '14:00 - 15:00',
        duration: '1 hour',
        assignedTo: ['Alice', 'Bob', 'Charlie'],
        restaurant: 'Sushi Zanmai',
        cuisine: 'Japanese'
      }
    ]
  },
  {
    date: '2024-05-16',
    day: 'Day 2',
    dayName: 'Thursday',
    events: [
      {
        id: '5',
        type: 'place',
        name: 'Meiji Shrine',
        time: '09:30 - 11:30',
        duration: '2 hours',
        category: 'shrine',
        rating: 4.7,
        assignedTo: ['Alice', 'Diana'],
        image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=200&fit=crop',
        description: 'Shinto shrine dedicated to Emperor Meiji',
        priority: 'high'
      },
      {
        id: '6',
        type: 'place',
        name: 'Harajuku District',
        time: '12:00 - 16:00',
        duration: '4 hours',
        category: 'district',
        rating: 4.4,
        assignedTo: ['Bob', 'Charlie', 'Diana'],
        image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&h=200&fit=crop',
        description: 'Youth culture and fashion district',
        priority: 'medium'
      }
    ]
  }
];

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
  const [selectedDay, setSelectedDay] = useState('2024-05-15');
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(new Set());

  const selectedSchedule = mockSchedule.find(s => s.date === selectedDay);

  const handleAddPlace = () => {
    navigate('/add-place');
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

      {/* Enhanced Header */}
      <div className="relative p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-secondary-50/50 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20"></div>
        
        <div className="relative z-10">
          {/* Title */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-2">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-3xl flex items-center justify-center shadow-glow"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <Calendar className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                  Trip Schedule
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Detailed itinerary with timeline
                </p>
              </div>
            </div>
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
              <span>Add Place to Schedule</span>
            </motion.button>
          </div>

          {/* Enhanced Day Selector */}
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
            {mockSchedule.map((schedule, index) => (
              <motion.button
                key={schedule.date}
                onClick={() => setSelectedDay(schedule.date)}
                className={`flex-shrink-0 px-6 py-4 rounded-3xl border-2 transition-all duration-300 relative overflow-hidden ${
                  selectedDay === schedule.date
                    ? 'border-primary-300 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/30 shadow-glow'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white/60 dark:bg-slate-800/60 hover:shadow-medium'
                }`}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {selectedDay === schedule.date && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-3xl"></div>
                )}
                <div className="text-center relative z-10">
                  <div className={`text-lg font-bold ${
                    selectedDay === schedule.date 
                      ? 'text-primary-600 dark:text-primary-400' 
                      : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {schedule.day}
                  </div>
                  <div className={`text-sm ${
                    selectedDay === schedule.date 
                      ? 'text-primary-500 dark:text-primary-400' 
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {schedule.dayName}
                  </div>
                  <div className={`text-xs mt-1 ${
                    selectedDay === schedule.date 
                      ? 'text-primary-500 dark:text-primary-400' 
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {new Date(schedule.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedSchedule ? (
          <div className="relative max-w-4xl mx-auto">
            {/* Enhanced Vertical Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-secondary-500 to-primary-600 rounded-full shadow-glow"></div>

            <div className="space-y-8">
              {selectedSchedule.events.map((event, index) => (
                <React.Fragment key={event.id}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative flex items-start space-x-6"
                  >
                    {event.type === 'place' ? (
                      <>
                        {/* Enhanced Timeline Node */}
                        <motion.div 
                          className="relative z-10 w-4 h-4 bg-gradient-to-br from-primary-400 to-secondary-600 rounded-full shadow-glow border-4 border-white dark:border-slate-900 mt-8"
                          whileHover={{ scale: 1.2 }}
                          transition={{ duration: 0.2 }}
                        />
                        
                        {/* Enhanced Place Card */}
                        <motion.div 
                          className="flex-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden shadow-soft hover:shadow-glow transition-all duration-300 group relative"
                          whileHover={{ y: -4, scale: 1.01 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Background gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-transparent to-secondary-50/30 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <div className="flex relative z-10">
                            {/* Enhanced Image */}
                            <div className="relative w-32 h-32 flex-shrink-0">
                              <img
                                src={event.image}
                                alt={event.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
                              
                              {/* Priority indicator */}
                              {event.priority === 'high' && (
                                <div className="absolute top-2 left-2 w-6 h-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-glow">
                                  <Star className="w-3 h-3 text-white fill-current" />
                                </div>
                              )}
                            </div>
                            
                            {/* Enhanced Content */}
                            <div className="flex-1 p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-3">
                                    <span className="text-2xl">{getCategoryIcon(event.category)}</span>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                      {event.name}
                                    </h3>
                                  </div>
                                  
                                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">
                                    {event.description}
                                  </p>
                                  
                                  <div className="flex items-center space-x-6 text-sm">
                                    <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400">
                                      <Clock className="w-4 h-4" />
                                      <span className="font-semibold">{event.time}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      {renderStars(event.rating)}
                                      <span className="font-semibold text-slate-700 dark:text-slate-300 ml-1">{event.rating}</span>
                                    </div>
                                    <div className="text-slate-500 dark:text-slate-400">
                                      Duration: {event.duration}
                                    </div>
                                  </div>
                                </div>
                                
                                <motion.button
                                  onClick={() => toggleEventCollapse(event.id)}
                                  className="p-3 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  {collapsedEvents.has(event.id) ? (
                                    <Eye className="w-5 h-5 text-slate-500" />
                                  ) : (
                                    <EyeOff className="w-5 h-5 text-slate-500" />
                                  )}
                                </motion.button>
                              </div>

                              {/* Enhanced Assigned Members */}
                              {event.assignedTo && event.assignedTo.length > 0 && (
                                <div className="flex items-center space-x-3 mb-4">
                                  <Users className="w-4 h-4 text-slate-500" />
                                  <div className="flex space-x-2">
                                    {event.assignedTo.map((member) => (
                                      <motion.div
                                        key={member}
                                        className="flex items-center space-x-2 px-3 py-2 rounded-2xl text-white text-sm font-semibold shadow-soft"
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
                                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                      <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-2xl p-3">
                                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Category:</span>
                                        <div className="font-semibold text-slate-700 dark:text-slate-300 capitalize mt-1">{event.category}</div>
                                      </div>
                                      <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-2xl p-3">
                                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Duration:</span>
                                        <div className="font-semibold text-slate-700 dark:text-slate-300 mt-1">{event.duration}</div>
                                      </div>
                                    </div>
                                    
                                    <motion.button
                                      className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg group relative overflow-hidden"
                                      whileHover={{ scale: 1.02, y: -1 }}
                                      whileTap={{ scale: 0.98 }}
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                      <span className="relative z-10 flex items-center justify-center space-x-2">
                                        <Sparkles className="w-4 h-4" />
                                        <span>View Details</span>
                                        <ChevronRight className="w-4 h-4" />
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

                  {/* Add Place Between Events - Primary/Secondary gradient */}
                  {index < selectedSchedule.events.length - 1 && (
                    <div className="relative flex items-center space-x-6">
                      <div className="w-4 h-4"></div> {/* Spacer for timeline alignment */}
                      <motion.button
                        onClick={handleAddPlace}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary-100/80 to-secondary-100/80 dark:from-primary-900/30 dark:to-secondary-900/30 border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-2xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gradient-to-r hover:from-primary-200/80 hover:to-secondary-200/80 dark:hover:from-primary-900/50 dark:hover:to-secondary-900/50 transition-all duration-300 text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200 group shadow-soft hover:shadow-medium"
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-semibold">Add place here</span>
                      </motion.button>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
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
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Add places to your trip to see them in your timeline
            </p>
          </div>
        )}
      </div>

    </div>
  );
}