import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, List, Grid3X3 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getPlaceColor } from '../utils/ColorUtils';
import { DateUtils } from '../utils/DateUtils';
import CalendarGridView from './CalendarGridView';

interface CalendarViewProps {
  optimizationResult?: any;
}

const CalendarView: React.FC<CalendarViewProps> = ({ optimizationResult }) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const { currentTrip, memberColors, tripMembers, hasUserOptimized } = useStore();

  // Generate gradient style for multiple contributors using centralized color logic
  const getPlaceStyle = (place: any) => {
    // Log message
    
    // Use centralized color utility
    const colorResult = getPlaceColor(place);
    // Log message
    
    // Handle system places based on place type
    if (place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport') {
      return { borderLeftColor: '#374151', backgroundColor: '#37415110' };
    }
    
    // Convert to calendar view styling format
    if (colorResult.type === 'single') {
      const color = colorResult.background;
      // Log message
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
      // Log message
      return { borderLeftColor: color, backgroundColor: `${color}10` };
    }
  };

  // Extract places from optimization result with consistent date formatting
  const formatOptimizationResult = (result: any) => {
    if (!hasUserOptimized || !result?.optimization?.daily_schedules || !currentTrip) {
      return { schedulesByDay: {} };
    }

    const schedulesByDay: Record<string, any> = {};
    
    result.optimization.daily_schedules.forEach((schedule: any) => {
      const dayKey = `day-${schedule.day}`;
      // Use consistent date calculation
      const actualDate = DateUtils.calculateTripDate(currentTrip, schedule.day);
      
      schedulesByDay[dayKey] = {
        day: schedule.day,
        date: DateUtils.formatForStorage(actualDate).split('T')[0], // YYYY-MM-DD format
        actualDate: actualDate,
        places: schedule.scheduled_places || [] // List view shows all places including airports and transport
      };
    });

    return { schedulesByDay };
  };

  const formattedResult = formatOptimizationResult(optimizationResult);

  // Calculate actual date based on trip start date and day number using DateUtils
  const calculateActualDate = (dayNumber: number): Date => {
    return DateUtils.calculateTripDate(currentTrip, dayNumber);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Use consistent date formatting across calendar views
  const formatDate = (date: Date) => {
    return DateUtils.formatCalendarDate(date);
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
        icon: <img src="/icons8-plane-24.png" className="w-3 h-3" alt="Flight" />
      };
    } else if (modeLower.includes('car') || modeLower.includes('drive') || modeLower.includes('taxi')) {
      return { 
        color: '#92400E', 
        icon: <img src="/icons8-car-24.png" className="w-3 h-3" alt="Car" />
      };
    } else {
      return { 
        color: '#6B7280', 
        icon: <img src="/icons8-walking-50.png" className="w-3 h-3" alt="Walking" />
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
        <div className="space-y-0">
          {Object.entries(formattedResult.schedulesByDay).map(([dayKey, dayData], dayIndex, daysArray) => (
            <div key={dayKey} className="relative">
              {/* Connection from previous day */}
              {dayIndex > 0 && (() => {
                const prevDayData = daysArray[dayIndex - 1][1];
                const prevDayPlaces = getGroupedPlacesForDay(prevDayData);
                const currentDayPlaces = getGroupedPlacesForDay(dayData);
                
                if (prevDayPlaces.length > 0 && currentDayPlaces.length > 0) {
                  const lastPlaceOfPrevDay = prevDayPlaces[prevDayPlaces.length - 1].place;
                  const firstPlaceOfCurrentDay = currentDayPlaces[0].place;
                  const transport = firstPlaceOfCurrentDay.transport_mode || 'walking';
                  const duration = firstPlaceOfCurrentDay.travel_time_from_previous || 0;
                  const transportInfo = getTransportIcon(transport);
                  
                  return duration > 0 ? (
                    <div className="relative h-12 mb-2">
                      {/* Vertical connection line */}
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full" style={{ backgroundColor: transportInfo.color }}></div>
                      
                      {/* Transport info */}
                      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center space-x-2 text-xs shadow-sm">
                        <div style={{ color: transportInfo.color }}>
                          {transportInfo.icon}
                        </div>
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatDuration(duration)}
                        </span>
                      </div>
                    </div>
                  ) : null;
                }
                return null;
              })()}
              
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-8">
              {/* Day Header */}
              <div className="bg-blue-50 px-3 py-1.5 sm:py-2 border-b border-gray-200">
                <h3 className="text-xs sm:text-sm font-semibold text-blue-900">
                  Day {dayData.day} - {formatDate(dayData.actualDate || calculateActualDate(dayData.day))}
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
                              setSelectedPlace(block.place);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight mb-2">
                                  {block.place.place_name || block.place.name}
                                </h4>
                                
                                <div className="flex items-center text-gray-600 text-xs sm:text-sm">
                                  <Clock className="w-3 h-3 mr-2 flex-shrink-0" />
                                  <span>
                                    {formatDuration(block.duration)}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="ml-3 text-xs text-gray-500">
                                Click for details
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Travel connection to next place */}
                      {blockIndex < getGroupedPlacesForDay(dayData).length - 1 && (() => {
                        const nextBlock = getGroupedPlacesForDay(dayData)[blockIndex + 1];
                        const transport = nextBlock.place.transport_mode || 'walking';
                        const duration = nextBlock.place.travel_time_from_previous || 0;
                        const transportInfo = getTransportIcon(transport);
                        
                        return duration > 0 ? (
                          <div className="relative h-8 -mb-1">
                            {/* Vertical connection line */}
                            <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full" style={{ backgroundColor: transportInfo.color }}></div>
                            
                            {/* Transport info */}
                            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center space-x-1 text-xs">
                              <div style={{ color: transportInfo.color }}>
                                {transportInfo.icon}
                              </div>
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatDuration(duration)}
                              </span>
                            </div>
                          </div>
                        ) : null;
                      })()}
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
            </div>
          ))}
        </div>
      </div>
      
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
              {/* Check place type and display accordingly */}
              {(() => {
                const isDeparture = selectedPlace.category === 'departure_point' || selectedPlace.place_type === 'departure';
                const isDestination = selectedPlace.category === 'final_destination' || selectedPlace.place_type === 'destination';
                const isAirport = selectedPlace.place_type === 'airport' || selectedPlace.place_type === 'system_airport' || 
                                selectedPlace.category === 'airport' || selectedPlace.name?.toLowerCase().includes('airport');
                
                // Calculate actual date for this place
                let actualDate = null;
                try {
                  if (currentTrip && selectedPlace.day_number) {
                    actualDate = DateUtils.calculateTripDate(currentTrip, selectedPlace.day_number);
                  }
                } catch (error) {
                  console.warn('Could not calculate trip date:', error);
                }
                
                // Format times with date context
                let arrivalDisplay = '';
                let departureDisplay = '';
                if (selectedPlace.arrival_time) {
                  arrivalDisplay = formatTime(selectedPlace.arrival_time);
                  if (actualDate) {
                    const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
                    arrivalDisplay = `${dateStr} ${arrivalDisplay}`;
                  }
                }
                if (selectedPlace.departure_time) {
                  departureDisplay = formatTime(selectedPlace.departure_time);
                  if (actualDate) {
                    const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
                    departureDisplay = `${dateStr} ${departureDisplay}`;
                  }
                }
                
                if (isDeparture) {
                  // Departure: show departure time only
                  return (
                    <>
                      {departureDisplay && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Departure</h4>
                          <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{departureDisplay}</p>
                        </div>
                      )}
                    </>
                  );
                } else if (isDestination) {
                  // Destination: show arrival time only
                  return (
                    <>
                      {arrivalDisplay && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Arrival</h4>
                          <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{arrivalDisplay}</p>
                        </div>
                      )}
                    </>
                  );
                } else if (isAirport || isDeparture || isDestination) {
                  // Airport: show schedule in "M/D HH:MM-HH:MM" format
                  let scheduleDisplay = '';
                  if (selectedPlace.stay_duration_minutes && arrivalDisplay && departureDisplay) {
                    const arrivalTime = arrivalDisplay.includes(' ') ? arrivalDisplay.split(' ')[1] : arrivalDisplay;
                    const departureTime = departureDisplay.includes(' ') ? departureDisplay.split(' ')[1] : departureDisplay;
                    
                    if (actualDate) {
                      const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
                      scheduleDisplay = `${dateStr} ${arrivalTime}-${departureTime}`;
                    } else {
                      scheduleDisplay = `${arrivalTime}-${departureTime}`;
                    }
                  }
                  
                  return (
                    <>
                      {scheduleDisplay && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Schedule</h4>
                          <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{scheduleDisplay}</p>
                        </div>
                      )}
                    </>
                  );
                }
                
                return null; // Fall through to regular place handling below
              })()}
              
              {/* Regular places - check if this is not a system place */}
              {!(selectedPlace.category === 'departure_point' || selectedPlace.place_type === 'departure' ||
                 selectedPlace.category === 'final_destination' || selectedPlace.place_type === 'destination' ||
                 selectedPlace.place_type === 'airport' || selectedPlace.place_type === 'system_airport' || 
                 selectedPlace.category === 'airport' || selectedPlace.name?.toLowerCase().includes('airport')) ? (
                // Regular place - show full information
                <>
                  {/* User Information - Always show who added */}
                  {(() => {
                    const colorResult = getPlaceColor(selectedPlace);
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
              
              {/* Schedule and Duration Info for Regular Places */}
              {(() => {
                // Calculate actual date and format schedule consistently
                let actualDate = null;
                try {
                  if (currentTrip && selectedPlace.day_number) {
                    actualDate = DateUtils.calculateTripDate(currentTrip, selectedPlace.day_number);
                  }
                } catch (error) {
                  console.warn('Could not calculate trip date:', error);
                }
                
                let scheduleDisplay = '';
                if (selectedPlace.stay_duration_minutes && selectedPlace.arrival_time && selectedPlace.departure_time) {
                  const arrivalTime = formatTime(selectedPlace.arrival_time);
                  const departureTime = formatTime(selectedPlace.departure_time);
                  
                  if (actualDate) {
                    const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
                    scheduleDisplay = `${dateStr} ${arrivalTime}-${departureTime}`;
                  } else {
                    scheduleDisplay = `${arrivalTime}-${departureTime}`;
                  }
                }
                
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {scheduleDisplay && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Schedule</h4>
                        <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{scheduleDisplay}</p>
                      </div>
                    )}
                    
                    {(selectedPlace.duration_minutes || selectedPlace.stay_duration_minutes) && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Duration</h4>
                        <p className="text-base text-gray-900 dark:text-gray-100 font-medium">
                          {DateUtils.formatDuration(selectedPlace.duration_minutes || selectedPlace.stay_duration_minutes)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Priority Level */}
              {selectedPlace.wish_level && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-1">Priority</h4>
                  <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{selectedPlace.wish_level}/10</p>
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
};

export default CalendarView;