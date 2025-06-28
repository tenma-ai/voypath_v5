import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { MemberColorService } from '../services/MemberColorService';
import { useStore } from '../store/useStore';
import { getPlaceColor as getPlaceColorUtil } from '../utils/ColorUtils';
import { DateUtils } from '../utils/DateUtils';
import { PlaceDateUtils } from '../utils/PlaceDateUtils';

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
  const { currentTrip, memberColors, tripMembers } = useStore();
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with trip start date if available, otherwise use first day of current month
    const tripStartDate = PlaceDateUtils.getCalendarInitialDate(currentTrip);
    if (tripStartDate) return tripStartDate;
    
    // Use first day of current month as fallback instead of today
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [monthSchedule, setMonthSchedule] = useState<Record<string, CalendarPlace[]>>({});
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  // Use centralized member colors from store
  console.log('🎨 [CalendarGridView] Using centralized colors:', memberColors);

  // Process optimization result to create month schedule with consistent date formatting
  useEffect(() => {
    console.log('🔍 [CalendarGridView] Processing optimization result:', optimizationResult);
    
    if (!optimizationResult?.optimization?.daily_schedules || !currentTrip) {
      console.log('🔍 [CalendarGridView] No daily schedules or trip found');
      setMonthSchedule({});
      return;
    }

    const schedule: Record<string, CalendarPlace[]> = {};
    
    optimizationResult.optimization.daily_schedules.forEach((daySchedule: any, dayIndex: number) => {
      console.log(`🔍 [CalendarGridView] Processing day ${dayIndex}:`, daySchedule);
      
      if (daySchedule.scheduled_places && Array.isArray(daySchedule.scheduled_places)) {
        // Use consistent date calculation based on trip start date and day number
        const scheduleDate = DateUtils.calculateTripDate(currentTrip, daySchedule.day || (dayIndex + 1));
        const dateKey = scheduleDate.toDateString();
        
        console.log(`🔍 [CalendarGridView] Day ${daySchedule.day || (dayIndex + 1)} -> ${dateKey}`);
        
        // Filter to show only trip places, excluding system places except departure/arrival
        const validPlaces = daySchedule.scheduled_places.filter((place: any) => {
          const isTransport = place.place_type === 'transport' || place.category === 'transport';
          const isDepartureOrArrival = place.place_type === 'departure' || place.place_type === 'destination';
          const isAirport = place.place_type === 'airport' || place.category === 'airport';
          
          // Keep departure/arrival as exceptions, filter out transport and other system places like airports
          if (isDepartureOrArrival) return true;
          if (isTransport) return false;
          if (isAirport) return false;
          
          return true; // Show all regular trip places
        });
        
        schedule[dateKey] = validPlaces.map((place: any, placeIndex: number) => {
          console.log(`🔍 [CalendarGridView] Processing place ${placeIndex}:`, {
            name: place.place_name || place.name,
            time: place.arrival_time || place.scheduled_time_start,
            member_contribution: place.member_contribution
          });
          
          return {
            id: place.id || `place-${daySchedule.day || (dayIndex + 1)}-${placeIndex}`,
            name: place.place_name || place.name || 'Unknown Place',
            time: place.arrival_time || place.scheduled_time_start || `${8 + placeIndex}:00`,
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
  }, [optimizationResult, currentTrip]);

  // Initialize calendar to start from trip start date instead of today
  useEffect(() => {
    if (currentTrip) {
      const tripStartDate = DateUtils.getTripStartDate(currentTrip);
      if (tripStartDate) {
        setCurrentDate(tripStartDate);
      }
    }
  }, [currentTrip]);

  // Generate calendar grid with complete weeks (fix week 29,30 cutoff issue)
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const endingDayOfWeek = lastDay.getDay(); // 0 = Sunday

    const days = [];
    
    // Add days from previous month to complete the first week
    const prevMonth = new Date(year, month - 1, 0);
    const daysFromPrevMonth = startingDayOfWeek;
    for (let i = daysFromPrevMonth; i > 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonth.getDate() - i + 1);
      days.push(prevDate);
    }
    
    // Add all days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    // Add days from next month to complete the last week
    const remainingCells = 42 - days.length; // 6 weeks * 7 days = 42 cells
    for (let day = 1; day <= remainingCells; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push(nextDate);
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
    
    // Use centralized color utility for consistency
    const colorResult = getPlaceColorUtil({
      ...place,
      place_name: place.name,
      member_contribution: place.contributors
    });
    
    console.log(`🔍 [CalendarGridView] Color result from utility:`, colorResult);
    
    // Return the background color for calendar grid
    if (colorResult.type === 'single') {
      return colorResult.background;
    } else if (colorResult.type === 'gold') {
      return '#FFD700';
    } else if (colorResult.type === 'gradient') {
      // For calendar grid, use the first contributor's color
      return colorResult.contributors[0]?.color || '#9CA3AF';
    } else {
      return colorResult.background || '#9CA3AF';
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
              {monthNames[currentDate.getMonth()]}
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
            onClick={() => {
              const tripStartDate = PlaceDateUtils.getCalendarInitialDate(currentTrip);
              if (tripStartDate) {
                setCurrentDate(tripStartDate);
              }
              // Do nothing if no trip date - keep current calendar position
            }}
            className="px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Trip Start
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[600px]">
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
            const dateKey = day.toDateString();
            const dayPlaces = monthSchedule[dateKey] || [];
            const isToday = day.toDateString() === new Date().toDateString();
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            
            // Debug log for days with places
            if (dayPlaces.length > 0) {
              console.log(`🔍 [CalendarGridView] Day ${day.getDate()} (${dateKey}) has ${dayPlaces.length} places:`, dayPlaces);
            }

            return (
              <div
                key={day.toISOString()}
                className={`aspect-square border-r border-b border-slate-200 dark:border-slate-700 p-1 overflow-y-auto ${
                  isToday 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : isCurrentMonth 
                      ? 'bg-white dark:bg-slate-800'
                      : 'bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                {/* Date Number */}
                <div className={`text-xs font-medium mb-0.5 ${
                  isToday 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : isCurrentMonth
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {day.getDate()}
                </div>

                {/* Places for this day */}
                <div className="space-y-0.5 flex-1">
                  {dayPlaces.slice(0, 4).map((place, placeIndex) => {
                    const placeColor = getPlaceColor(place);
                    const timeDisplay = place.time ? place.time.slice(0, 5) : '';
                    
                    return (
                      <div
                        key={place.id}
                        className="text-xs p-1 rounded border-l-2 cursor-pointer hover:shadow-sm transition-all duration-200 relative"
                        style={{ 
                          borderLeftColor: placeColor,
                          backgroundColor: `${placeColor}15`,
                          borderLeftWidth: '3px'
                        }}
                        title={`${place.name}${place.time ? ` at ${place.time}` : ''}${place.duration ? ` (${Math.round(place.duration/60)}h)` : ''}`}
                        onClick={() => setSelectedPlace(place)}
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate leading-tight" style={{ fontSize: '9px' }}>
                          {place.name}
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          {timeDisplay && (
                            <div className="text-slate-600 dark:text-slate-400 truncate" style={{ fontSize: '8px' }}>
                              {timeDisplay}
                            </div>
                          )}
                          {place.duration && (
                            <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: '7px' }}>
                              {Math.round(place.duration/60)}h
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show "more" indicator if there are more than 4 places */}
                  {dayPlaces.length > 4 && (
                    <div className="text-slate-500 dark:text-slate-400 px-1 py-0.5 text-center" style={{ fontSize: '8px' }}>
                      +{dayPlaces.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend - Removed to save space */}
      
      {/* Place Details Popup */}
      {selectedPlace && ReactDOM.createPortal(
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={() => setSelectedPlace(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-0 max-w-md w-full max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'linear-gradient(to bottom, #ffffff, #fafafa)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Header with gradient background */}
            <div className="relative bg-gradient-to-r from-primary-500 to-secondary-500 p-6 pb-4">
              <button
                onClick={() => setSelectedPlace(null)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-2xl font-bold text-white pr-8">
                {selectedPlace.place_name || selectedPlace.name}
              </h3>
              {selectedPlace.category && (
                <p className="text-white/80 text-sm mt-1">{selectedPlace.category}</p>
              )}
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              {/* Check if system place */}
              {selectedPlace.place_type === 'departure' || selectedPlace.place_type === 'destination' || selectedPlace.place_type === 'airport' ? (
                // System place - only show duration
                <>
                  {(selectedPlace.duration_minutes || selectedPlace.stay_duration_minutes) && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Duration</h4>
                      <p className="text-base text-gray-900 dark:text-gray-100 font-medium">
                        {formatDuration(selectedPlace.duration_minutes || selectedPlace.stay_duration_minutes)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                // Regular place - show full information
                <>
                  {/* User Information - Always show who added */}
                  {(() => {
                    const colorResult = getPlaceColorUtil(selectedPlace);
                    let userInfo = null;
                    
                    if (colorResult.type === 'single' && colorResult.contributors.length > 0) {
                      userInfo = colorResult.contributors[0].memberName || 'Unknown user';
                    } else if (colorResult.type === 'gradient' && colorResult.contributors) {
                      userInfo = colorResult.contributors.map(c => c.memberName).join(', ');
                    } else if (colorResult.type === 'gold') {
                      userInfo = 'All members';
                    }
                    
                    return (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Added by</h4>
                        <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{userInfo || 'Unknown'}</p>
                      </div>
                    );
                  })()}
              
                  {/* Schedule and Duration Info */}
                  <div className="grid grid-cols-2 gap-3">
                    {(selectedPlace.day_number || selectedPlace.hour || selectedPlace.arrival_time || selectedPlace.time) && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Schedule</h4>
                        <p className="text-base text-gray-900 dark:text-gray-100 font-medium">
                          {selectedPlace.day_number && `Day ${selectedPlace.day_number}`}
                          {selectedPlace.hour && `, ${selectedPlace.hour}:00`}
                          {selectedPlace.time && !selectedPlace.hour && selectedPlace.time}
                          {selectedPlace.arrival_time && !selectedPlace.hour && !selectedPlace.time && selectedPlace.arrival_time}
                        </p>
                      </div>
                    )}
                    
                    {(selectedPlace.duration_minutes || selectedPlace.stay_duration_minutes || selectedPlace.duration) && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Duration</h4>
                        <p className="text-base text-gray-900 dark:text-gray-100 font-medium">
                          {formatDuration(selectedPlace.duration_minutes || selectedPlace.stay_duration_minutes || selectedPlace.duration)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Wish Level */}
                  {selectedPlace.wish_level && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-1">Priority Level</h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{['⭐', '⭐', '⭐', '⭐', '⭐'].slice(0, selectedPlace.wish_level).join('')}</span>
                        <span className="text-base text-gray-900 dark:text-gray-100 font-medium">({selectedPlace.wish_level}/5)</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Travel info - removed since travel_to_next doesn't exist in the data */}
                  
                  {/* Notes */}
                  {selectedPlace.notes && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Notes</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{selectedPlace.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
  
  // Helper function to format duration
  function formatDuration(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  }
};

export default CalendarGridView;