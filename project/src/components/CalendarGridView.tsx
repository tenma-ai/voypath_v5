import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { MemberColorService } from '../services/MemberColorService';
import { useStore } from '../store/useStore';

interface CalendarGridViewProps {
  optimizationResult?: any;
}

interface CalendarPlace {
  id: string;
  name: string;
  time?: string;
  duration?: number;
  category: string;
  contributors: any[];
}

const CalendarGridView: React.FC<CalendarGridViewProps> = ({ optimizationResult }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthSchedule, setMonthSchedule] = useState<Record<string, CalendarPlace[]>>({});
  const { currentTrip, memberColors, tripMembers } = useStore();

  // Use centralized member colors from store
  console.log('🎨 [CalendarGridView] Using centralized colors:', memberColors);

  // Process optimization result to create month schedule
  useEffect(() => {
    console.log('🔍 [CalendarGridView] Processing optimization result:', optimizationResult);
    
    if (!optimizationResult?.optimization?.daily_schedules) {
      console.log('🔍 [CalendarGridView] No daily schedules found');
      setMonthSchedule({});
      return;
    }

    const schedule: Record<string, CalendarPlace[]> = {};
    
    optimizationResult.optimization.daily_schedules.forEach((daySchedule: any, dayIndex: number) => {
      console.log(`🔍 [CalendarGridView] Processing day ${dayIndex}:`, daySchedule);
      
      if (daySchedule.scheduled_places && Array.isArray(daySchedule.scheduled_places)) {
        // Use day index to create dates if no date is provided
        const scheduleDate = daySchedule.date 
          ? new Date(daySchedule.date)
          : new Date(Date.now() + dayIndex * 24 * 60 * 60 * 1000); // Add days from today
        
        const dateKey = scheduleDate.toDateString();
        console.log(`🔍 [CalendarGridView] Date key for day ${dayIndex}: ${dateKey}`);
        
        schedule[dateKey] = daySchedule.scheduled_places.map((place: any, placeIndex: number) => {
          console.log(`🔍 [CalendarGridView] Processing place ${placeIndex}:`, {
            name: place.place_name || place.name,
            time: place.scheduled_time_start || place.arrival_time,
            member_contribution: place.member_contribution
          });
          
          return {
            id: place.id || `place-${dayIndex}-${placeIndex}`,
            name: place.place_name || place.name || 'Unknown Place',
            time: place.scheduled_time_start || place.arrival_time || `${8 + placeIndex}:00`,
            duration: place.stay_duration_minutes || 120,
            category: place.category || 'attraction',
            contributors: place.member_contribution || []
          };
        });
        
        console.log(`🔍 [CalendarGridView] Created ${schedule[dateKey].length} places for ${dateKey}`);
      }
    });

    console.log('🔍 [CalendarGridView] Final schedule:', schedule);
    setMonthSchedule(schedule);
  }, [optimizationResult]);

  // Generate calendar grid
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getPlaceColor = (place: CalendarPlace) => {
    console.log(`🔍 [CalendarGridView] Getting color for place: ${place.name}`, {
      contributors: place.contributors,
      memberColors: memberColors
    });
    
    // Check if departure/arrival place
    const placeName = place.name.toLowerCase();
    if (placeName.includes('departure') || placeName.includes('return')) {
      console.log(`🔍 [CalendarGridView] ${place.name} is departure/arrival - using black`);
      return '#000000';
    }

    // Process contributors array
    let contributors = place.contributors;
    
    // Handle different contributor formats
    if (contributors && Array.isArray(contributors)) {
      console.log(`🔍 [CalendarGridView] Contributors array:`, contributors);
    } else if (contributors && typeof contributors === 'object') {
      // Single contributor object
      contributors = [contributors];
      console.log(`🔍 [CalendarGridView] Single contributor converted to array:`, contributors);
    } else {
      contributors = [];
      console.log(`🔍 [CalendarGridView] No valid contributors found`);
    }

    if (!contributors || contributors.length === 0) {
      console.log(`🔍 [CalendarGridView] No contributors - using gray`);
      return '#9CA3AF'; // Gray for no contributors
    } else if (contributors.length === 1) {
      const userId = contributors[0].user_id || contributors[0].userId;
      const color = memberColors[userId] || '#3B82F6';
      console.log(`🔍 [CalendarGridView] Single contributor (${userId}) - using color ${color}`);
      return color;
    } else if (contributors.length >= 5) {
      console.log(`🔍 [CalendarGridView] 5+ contributors - using gold`);
      return '#FFD700'; // Gold for 5+ contributors
    } else {
      // Multiple contributors - use first contributor's color for now
      const userId = contributors[0].user_id || contributors[0].userId;
      const color = memberColors[userId] || '#3B82F6';
      console.log(`🔍 [CalendarGridView] Multiple contributors (${contributors.length}) - using first contributor's color ${color}`);
      return color;
    }
  };

  // Debug current state
  console.log('🔍 [CalendarGridView] Render state:', {
    monthScheduleKeys: Object.keys(monthSchedule),
    monthScheduleSize: Object.keys(monthSchedule).length,
    memberColorsSize: Object.keys(memberColors).length,
    optimizationResultExists: !!optimizationResult
  });

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 overflow-y-auto">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {Object.keys(monthSchedule).length} scheduled days
            </p>
          </div>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {dayNames.map((dayName) => (
            <div
              key={dayName}
              className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            if (!day) {
              return (
                <div
                  key={`empty-${index}`}
                  className="h-20 border-r border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
                />
              );
            }

            const dateKey = day.toDateString();
            const dayPlaces = monthSchedule[dateKey] || [];
            const isToday = day.toDateString() === new Date().toDateString();
            
            // Debug log for days with places
            if (dayPlaces.length > 0) {
              console.log(`🔍 [CalendarGridView] Day ${day.getDate()} (${dateKey}) has ${dayPlaces.length} places:`, dayPlaces);
            }

            return (
              <div
                key={day.toISOString()}
                className={`h-20 border-r border-b border-slate-200 dark:border-slate-700 p-1 overflow-y-auto ${
                  isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-800'
                }`}
              >
                {/* Date Number */}
                <div className={`text-xs font-medium mb-0.5 ${
                  isToday 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {day.getDate()}
                </div>

                {/* Places for this day */}
                <div className="space-y-0.5">
                  {dayPlaces.slice(0, 2).map((place, placeIndex) => (
                    <div
                      key={place.id}
                      className="text-xs p-0.5 rounded border-l-2 bg-slate-50 dark:bg-slate-700"
                      style={{ borderLeftColor: getPlaceColor(place) }}
                      title={`${place.name}${place.time ? ` at ${place.time}` : ''}`}
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate" style={{ fontSize: '10px' }}>
                        {place.name}
                      </div>
                    </div>
                  ))}
                  
                  {/* Show "more" indicator if there are more than 2 places */}
                  {dayPlaces.length > 2 && (
                    <div className="text-slate-500 dark:text-slate-400 px-0.5" style={{ fontSize: '10px' }}>
                      +{dayPlaces.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend - Removed to save space */}
    </div>
  );
};

export default CalendarGridView;