import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, List, Grid3X3 } from 'lucide-react';
import { MemberColorService } from '../services/MemberColorService';
import { useStore } from '../store/useStore';
import CalendarGridView from './CalendarGridView';

interface CalendarViewProps {
  optimizationResult?: any;
}

const CalendarView: React.FC<CalendarViewProps> = ({ optimizationResult }) => {
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const { currentTrip } = useStore();

  // Load member colors for the current trip
  useEffect(() => {
    const loadMemberColors = async () => {
      if (!currentTrip?.id) {
        console.log('🔍 [CalendarView] No current trip, skipping color load');
        return;
      }

      try {
        console.log('🔍 [CalendarView] Loading member colors for trip:', currentTrip.id);
        const colorMapping = await MemberColorService.getSimpleColorMapping(currentTrip.id);
        console.log('🔍 [CalendarView] Loaded member colors:', colorMapping);
        setMemberColors(colorMapping);
      } catch (error) {
        console.error('🔍 [CalendarView] Failed to load member colors:', error);
        setMemberColors({});
      }
    };

    loadMemberColors();
  }, [currentTrip?.id]);

  // Generate gradient style for multiple contributors
  const getPlaceStyle = (place: any) => {
    // 出発・到着地点: 黒色固定
    const placeName = place.place_name || place.name || '';
    const placeNameLower = placeName.toLowerCase();
    
    // Check various patterns for departure/arrival
    const isDeparture = placeName.includes('Departure:') || 
                       placeName.includes('出発') ||
                       placeNameLower.includes('departure');
                       
    const isArrival = placeName.includes('Return to Departure:') || 
                     placeName.includes('到着') ||
                     placeNameLower.includes('return') ||
                     placeNameLower.includes('arrival');
    
    if (isDeparture || isArrival) {
      console.log(`🔍 [CalendarView] Place is departure/arrival: ${placeName}`);
      return { borderLeftColor: '#000000', backgroundColor: '#00000010' };
    }

    // Get actual contributors for this place
    let contributors: any[] = [];
    
    // First, try to get contributors from member_contribution field
    if (place.member_contribution) {
      if (Array.isArray(place.member_contribution)) {
        contributors = place.member_contribution;
      } else if (place.member_contribution.contributors) {
        contributors = place.member_contribution.contributors;
      } else if (typeof place.member_contribution === 'object') {
        if (place.member_contribution.user_id || place.member_contribution.userId) {
          contributors = [place.member_contribution];
        }
      }
    }

    // If no contributors found, try to get from added_by/user_id fields
    if (contributors.length === 0) {
      const addedByUserId = place.added_by || place.addedBy || place.created_by || place.user_id;
      if (addedByUserId) {
        contributors = [{
          user_id: addedByUserId,
          userId: addedByUserId,
          weight: 1.0
        }];
      }
    }

    // Ensure all contributors have actual colors
    contributors = contributors.map(contributor => {
      const userId = contributor.user_id || contributor.userId;
      const userColor = memberColors[userId] || MemberColorService.getColorForOptimization(userId, memberColors);
      return {
        ...contributor,
        user_id: userId,
        color_hex: userColor
      };
    });

    const contributorCount = contributors.length;
    
    if (contributorCount === 0) {
      return { borderLeftColor: '#9CA3AF', backgroundColor: '#9CA3AF10' };
    } else if (contributorCount === 1) {
      const color = contributors[0].color_hex;
      return { borderLeftColor: color, backgroundColor: `${color}10` };
    } else if (contributorCount >= 5) {
      return { borderLeftColor: '#FFD700', backgroundColor: '#FFD70010' };
    } else {
      // 2-4人の追加者: グラデーション
      const colors = contributors.slice(0, 4).map(c => c.color_hex);
      const gradientStops = colors.map((color, index) => 
        `${color} ${(index * 100 / (colors.length - 1))}%`
      ).join(', ');
      return { 
        borderLeftColor: colors[0],
        background: `linear-gradient(45deg, ${gradientStops.replace(/[\d.]+%/g, '10%')})`
      };
    }
  };

  // Get place color based on member contributions
  const getPlaceColor = (place: any) => {
    // 出発・到着地点: 黒色固定
    if (place.place_name?.includes('Departure:') || place.place_name?.includes('Return to Departure:')) {
      return '#000000';
    }

    // Get actual contributors for this place
    let contributors: any[] = [];
    
    console.log(`🔍 [CalendarView] Place raw data:`, {
      name: place.place_name || place.name,
      memberContribution: place.member_contribution,
      addedBy: place.added_by,
      userId: place.user_id,
      createdBy: place.created_by
    });

    // First, try to get contributors from member_contribution field
    if (place.member_contribution) {
      if (Array.isArray(place.member_contribution)) {
        // Direct array format
        contributors = place.member_contribution;
      } else if (place.member_contribution.contributors) {
        // Object with contributors property
        contributors = place.member_contribution.contributors;
      } else if (typeof place.member_contribution === 'object') {
        // Check if it's a single contributor object
        if (place.member_contribution.user_id || place.member_contribution.userId) {
          contributors = [place.member_contribution];
        }
      }
    }

    // If no contributors found, try to get from added_by/user_id fields
    if (contributors.length === 0) {
      const addedByUserId = place.added_by || place.addedBy || place.created_by || place.user_id;
      if (addedByUserId) {
        contributors = [{
          user_id: addedByUserId,
          userId: addedByUserId,
          weight: 1.0
        }];
      }
    }

    // Ensure all contributors have actual colors
    contributors = contributors.map(contributor => {
      const userId = contributor.user_id || contributor.userId;
      const userColor = memberColors[userId] || MemberColorService.getColorForOptimization(userId, memberColors);
      return {
        ...contributor,
        user_id: userId,
        color_hex: userColor
      };
    });

    console.log(`🔍 [CalendarView] Final contributors:`, contributors);

    const contributorCount = contributors.length;
    
    if (contributorCount === 0) {
      return '#9CA3AF'; // Gray for no contributors
    } else if (contributorCount === 1) {
      // 1人の追加者: その人のメンバーカラー
      return contributors[0].color_hex;
    } else if (contributorCount >= 5) {
      // 5人以上の追加者: 金色
      return '#FFD700';
    } else {
      // 2-4人の追加者: 主要貢献者の色（グラデーション将来実装）
      return contributors[0].color_hex;
    }
  };

  // Extract places from optimization result
  const formatOptimizationResult = (result: any) => {
    if (!result?.optimization?.daily_schedules) {
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

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}時間${mins > 0 ? `${mins}分` : ''}` : `${mins}分`;
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
    const daySchedule = Object.values(formattedResult.schedulesByDay).find((schedule: any) => 
      schedule.date === targetDate
    );
    
    if (!daySchedule) return null;
    
    return daySchedule.places.find((place: any) => {
      if (!place.arrival_time || !place.departure_time) return false;
      return time >= place.arrival_time && time < place.departure_time;
    });
  };

  // If grid mode, use the grid calendar component
  if (viewMode === 'grid') {
    return (
      <div className="h-full relative">
        {/* View Toggle */}
        <div className="absolute top-4 right-4 z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1 flex">
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'timeline' 
                ? 'bg-orange-500 text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            title="Timeline View"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' 
                ? 'bg-orange-500 text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            title="Grid View"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
        <CalendarGridView optimizationResult={optimizationResult} />
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
      {/* View Toggle */}
      <div className="absolute top-4 right-4 z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1 flex">
        <button
          onClick={() => setViewMode('timeline')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'timeline' 
              ? 'bg-orange-500 text-white' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
          title="Timeline View"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'grid' 
              ? 'bg-orange-500 text-white' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
          title="Grid View"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-6">
        <div className="space-y-8">
          {Object.entries(formattedResult.schedulesByDay).map(([dayKey, dayData]) => (
            <div key={dayKey} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Day Header */}
              <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-blue-900">
                  Day {dayData.day} - {new Date(dayData.date).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </h3>
              </div>
              
              {/* Time slots for this day */}
              <div className="p-4">
                <div className="space-y-1">
                  {timeSlots.map((time, index) => {
                    const place = getPlaceForTimeSlot(time, dayData.date);
                    const isHourMark = time.endsWith(':00');
                    
                    return (
                      <div
                        key={time}
                        className={`flex items-center space-x-4 py-1 ${
                          isHourMark ? 'border-t border-gray-200 pt-2' : ''
                        }`}
                      >
                        <div className={`w-16 text-sm ${isHourMark ? 'font-semibold' : 'text-gray-500'}`}>
                          {time}
                        </div>
                        
                        <div className="flex-1">
                          {place ? (
                            <div 
                              className="border-l-4 border border-gray-200 rounded-lg p-3"
                              style={getPlaceStyle(place)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-gray-900">{place.place_name || place.name}</h4>
                                  <div className="flex items-center text-gray-600 text-xs mt-1">
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span>
                                      {formatTime(place.arrival_time)} - {formatTime(place.departure_time)}
                                      ({formatDuration(place.stay_duration_minutes || 60)})
                                    </span>
                                  </div>
                                </div>
                                {place.rating && (
                                  <div className="text-xs text-yellow-600">
                                    ★ {place.rating.toFixed(1)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="h-2 border-l-2 border-gray-100 ml-2"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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