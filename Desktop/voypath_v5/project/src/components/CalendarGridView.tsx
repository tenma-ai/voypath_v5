import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUnifiedMemberColors, usePlaceColor } from '../hooks/useUnifiedMemberColors';
import { UnifiedMemberAvatar, UnifiedPlaceColorIndicator } from '../components/UnifiedMemberAvatar';
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
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const { currentTrip } = useStore();
  const { memberColors, memberData, isLoading } = useUnifiedMemberColors();

  // Use unified member colors
  console.log('🎨 [CalendarGridView] Using unified colors:', { memberColors, memberData });

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

  // Place color helper component
  const PlaceColorBar: React.FC<{ place: any }> = ({ place }) => {
    const colorData = usePlaceColor(place);
    
    return (
      <div 
        className="w-1 rounded-full"
        style={{ 
          background: colorData.background,
          boxShadow: colorData.type === 'gold' ? '0 0 8px rgba(255, 215, 0, 0.3)' : undefined
        }}
      />
    );
  };

  // Place contributor names helper
  const PlaceContributorNames: React.FC<{ place: any }> = ({ place }) => {
    const colorData = usePlaceColor(place);
    
    if (colorData.contributors.length === 0) {
      return <span className="text-sm text-gray-500">No contributors</span>;
    }
    
    if (colorData.type === 'gold') {
      return <span className="text-sm font-medium text-yellow-600">All members ({colorData.contributors.length})</span>;
    }
    
    const names = colorData.contributors.map(c => c.name).join(', ');
    return <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{names}</span>;
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
                      className="text-xs p-0.5 rounded border-l-2 bg-slate-50 dark:bg-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      style={{ borderLeftColor: getPlaceColor(place) }}
                      title={`${place.name}${place.time ? ` at ${place.time}` : ''}`}
                      onClick={() => setSelectedPlace(place)}
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
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Contributors</h4>
                    <div className="flex items-center space-x-2">
                      <UnifiedPlaceColorIndicator 
                        place={selectedPlace} 
                        size="md" 
                        showContributors={true}
                        className="flex-shrink-0"
                      />
                      <PlaceContributorNames place={selectedPlace} />
                    </div>
                  </div>
              
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