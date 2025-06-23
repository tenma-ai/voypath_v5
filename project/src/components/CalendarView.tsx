import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, List, Grid3X3 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getPlaceColor } from '../utils/ColorUtils';
import CalendarGridView from './CalendarGridView';

interface CalendarViewProps {
  optimizationResult?: any;
}

const CalendarView: React.FC<CalendarViewProps> = ({ optimizationResult }) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const { currentTrip, memberColors, tripMembers, hasUserOptimized } = useStore();

  // Generate gradient style for multiple contributors using centralized color logic
  const getPlaceStyle = (place: any) => {
    console.log('🎨 [CalendarView] Getting style for place:', place.place_name || place.name);
    
    // Use centralized color utility
    const colorResult = getPlaceColor(place);
    console.log('🎨 [CalendarView] Color result:', colorResult);
    
    // Handle system places based on place type
    if (place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport') {
      return { borderLeftColor: '#374151', backgroundColor: '#37415110' };
    }
    
    // Convert to calendar view styling format
    if (colorResult.type === 'single') {
      const color = colorResult.background;
      console.log('🎨 [CalendarView] Single color:', color);
      return { borderLeftColor: color, backgroundColor: `${color}10` };
    } else if (colorResult.type === 'gold') {
      return { borderLeftColor: '#FFD700', backgroundColor: '#FFD70010' };
    } else if (colorResult.type === 'gradient') {
      const colors = colorResult.contributors.slice(0, 4).map(c => c.color);
      const gradientStops = colors.map((color, index) => 
        `${color} ${(index * 100 / (colors.length - 1))}%`
      ).join(', ');
      return { 
        borderLeftColor: colors[0],
        background: `linear-gradient(45deg, ${gradientStops})`
      };
    } else {
      // Fallback to background color
      const color = colorResult.background || '#9CA3AF';
      console.log('🎨 [CalendarView] Fallback color:', color);
      return { borderLeftColor: color, backgroundColor: `${color}10` };
    }
  };

  // Extract places from optimization result
  const formatOptimizationResult = (result: any) => {
    if (!hasUserOptimized || !result?.optimization?.daily_schedules) {
      return { schedulesByDay: {} };
    }

    const schedulesByDay: Record<string, any> = {};
    
    result.optimization.daily_schedules.forEach((schedule: any) => {
      const dayKey = `day-${schedule.day}`;
      schedulesByDay[dayKey] = {
        day: schedule.day,
        date: schedule.date,
        places: schedule.scheduled_places || []
      };
    });

    return { schedulesByDay };
  };

  const formattedResult = formatOptimizationResult(optimizationResult);

  // Calculate actual date based on trip start date and day number
  const calculateActualDate = (dayNumber: number): Date => {
    if (currentTrip?.start_date) {
      const startDate = new Date(currentTrip.start_date);
      startDate.setDate(startDate.getDate() + (dayNumber - 1));
      return startDate;
    }
    
    // Fallback to today + day offset if no trip start date
    const today = new Date();
    today.setDate(today.getDate() + (dayNumber - 1));
    return today;
  };

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
    return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  };

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

  // New function to group consecutive places into blocks
  const getGroupedPlacesForDay = (dayData: any) => {
    if (!dayData.places || dayData.places.length === 0) return [];

    const groupedBlocks: Array<{
      place: any;
      startTime: string;
      endTime: string;
      duration: number;
    }> = [];

    // Sort places by arrival time
    const sortedPlaces = [...dayData.places].sort((a, b) => 
      (a.arrival_time || '').localeCompare(b.arrival_time || '')
    );

    let currentGroup: any = null;

    for (const place of sortedPlaces) {
      if (!place.arrival_time || !place.departure_time) continue;

      if (!currentGroup) {
        // Start new group
        currentGroup = {
          place: place,
          startTime: place.arrival_time,
          endTime: place.departure_time,
          duration: place.stay_duration_minutes || 60
        };
      } else if (
        // Check if this is the same place as the current group
        (place.place_name || place.name) === (currentGroup.place.place_name || currentGroup.place.name) &&
        place.arrival_time === currentGroup.endTime
      ) {
        // Extend current group
        currentGroup.endTime = place.departure_time;
        currentGroup.duration += place.stay_duration_minutes || 60;
      } else {
        // Different place or non-consecutive time, finalize current group and start new one
        groupedBlocks.push(currentGroup);
        currentGroup = {
          place: place,
          startTime: place.arrival_time,
          endTime: place.departure_time,
          duration: place.stay_duration_minutes || 60
        };
      }
    }

    // Add the last group
    if (currentGroup) {
      groupedBlocks.push(currentGroup);
    }

    return groupedBlocks;
  };

  // Get transport icon and color
  const getTransportIcon = (mode: string) => {
    const modeLower = mode.toLowerCase();
    if (modeLower.includes('flight') || modeLower.includes('plane') || modeLower.includes('air')) {
      return { 
        color: '#2563EB', 
        svg: (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2v0A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        )
      };
    } else if (modeLower.includes('car') || modeLower.includes('drive') || modeLower.includes('taxi')) {
      return { 
        color: '#92400E', 
        svg: (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 0h12a2 2 0 0 1 0 4h-5m-7 0h12M5 9V7a1 1 0 0 1 1-1h9l3 4m-3 0h3a1 1 0 0 1 1 1v6h-2"/>
          </svg>
        )
      };
    } else {
      return { 
        color: '#6B7280', 
        svg: (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        )
      };
    }
  };

  // Render toggle buttons using Portal to ensure they appear above all other elements
  const renderToggleButtons = () => {
    return ReactDOM.createPortal(
      <div className="fixed top-[5.5rem] right-4 z-[99999] bg-slate-100/95 dark:bg-slate-700/95 rounded-lg p-0.5 flex backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 shadow-lg">
        <button
          onClick={() => setViewMode('timeline')}
          className={`relative p-2 rounded-md text-xs font-medium transition-all duration-300 flex items-center justify-center ${
            viewMode === 'timeline' 
              ? 'text-white shadow-soft bg-orange-500' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Timeline View"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`relative p-2 rounded-md text-xs font-medium transition-all duration-300 flex items-center justify-center ${
            viewMode === 'grid' 
              ? 'text-white shadow-soft bg-orange-500' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Grid View"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
      </div>,
      document.body
    );
  };

  // If grid mode, use the grid calendar component
  if (viewMode === 'grid') {
    return (
      <div className="h-full relative">
        {/* View Toggle - Rendered via Portal */}
        {renderToggleButtons()}
        <div className="mt-12">
          <CalendarGridView optimizationResult={optimizationResult} />
        </div>
      </div>
    );
  }

  if (Object.keys(formattedResult.schedulesByDay).length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600">No calendar data available</p>
          <p className="text-sm text-gray-500 mt-2">Optimize your route to see the calendar view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 relative">
      {/* View Toggle - Rendered via Portal */}
      {renderToggleButtons()}
      
      <div className="p-6 pt-16">
        <div className="space-y-8">
          {Object.entries(formattedResult.schedulesByDay).map(([dayKey, dayData]) => (
            <div key={dayKey} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Day Header */}
              <div className="bg-blue-50 px-3 py-1.5 sm:py-2 border-b border-gray-200">
                <h3 className="text-xs sm:text-sm font-semibold text-blue-900">
                  Day {dayData.day} - {calculateActualDate(dayData.day).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </h3>
              </div>
              
              {/* Grouped place blocks for this day */}
              <div className="p-2 sm:p-4">
                <div className="space-y-2 sm:space-y-3">
                  {getGroupedPlacesForDay(dayData).map((block, blockIndex) => (
                    <div key={blockIndex} className="relative">
                      {/* Time indicator on the left */}
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <div className="w-16 sm:w-20 text-xs text-gray-600 pt-1 flex-shrink-0">
                          <div className="font-semibold">{formatTime(block.startTime)}</div>
                          <div className="text-gray-500">to</div>
                          <div className="font-semibold">{formatTime(block.endTime)}</div>
                        </div>
                        
                        {/* Place block */}
                        <div className="flex-1">
                          <div 
                            className="border-l-4 border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow duration-200"
                            style={getPlaceStyle(block.place)}
                            onClick={() => {
                              // Could add click handler for place details
                              console.log('Place clicked:', block.place);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight mb-2">
                                  {block.place.place_name || block.place.name}
                                </h4>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center text-gray-600 text-xs sm:text-sm">
                                    <Clock className="w-3 h-3 mr-2 flex-shrink-0" />
                                    <span>
                                      Total Duration: {formatDuration(block.duration)}
                                    </span>
                                  </div>
                                  
                                  {block.place.category && (
                                    <div className="flex items-center text-gray-600 text-xs sm:text-sm">
                                      <MapPin className="w-3 h-3 mr-2 flex-shrink-0" />
                                      <span>{block.place.category}</span>
                                    </div>
                                  )}
                                  
                                  {block.place.wish_level && (
                                    <div className="flex items-center text-gray-600 text-xs sm:text-sm">
                                      <span className="mr-2 flex-shrink-0">🌟</span>
                                      <span>Wish Level: {block.place.wish_level}/5</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="ml-3 flex flex-col items-end space-y-1">
                                {block.place.rating && (
                                  <div className="text-xs sm:text-sm text-yellow-600 flex-shrink-0">
                                    ★ {block.place.rating.toFixed(1)}
                                  </div>
                                )}
                                
                                {block.place.price_level && (
                                  <div className="text-xs text-green-600 flex-shrink-0">
                                    {'$'.repeat(block.place.price_level)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show message if no places */}
                  {getGroupedPlacesForDay(dayData).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No scheduled places for this day</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;