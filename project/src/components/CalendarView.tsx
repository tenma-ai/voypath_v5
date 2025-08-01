import React, { useState, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, List, Grid3X3, Edit3, Check, X, Move, ArrowUpDown, Plane, Car, Navigation, Utensils } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getPlaceColor } from '../utils/ColorUtils';
import { DateUtils } from '../utils/DateUtils';
import { TransportIcon } from '../utils/transportIcons';
import CalendarGridView from './CalendarGridView';
import MealInsertionModal from './MealInsertionModal';
import PlaceInsertionModal from './PlaceInsertionModal';
import HotelBookingModal from './HotelBookingModal';
import FlightBookingModal from './FlightBookingModal';
import TransportBookingModal from './TransportBookingModal';
import { supabase } from '../lib/supabase';

// 🔥 edit-schedule仮想分割place統合ユーティリティ
function mergeVirtualSplitsForUI(places: any[]): any[] {
  const mergedPlaces: any[] = [];
  const splitGroups = new Map<string, any[]>();
  
  // 分割placeをoriginal_place_idでグループ化
  places.forEach(place => {
    if (place.is_virtual_split && place.original_place_id) {
      if (!splitGroups.has(place.original_place_id)) {
        splitGroups.set(place.original_place_id, []);
      }
      splitGroups.get(place.original_place_id)!.push(place);
    } else {
      mergedPlaces.push(place);
    }
  });
  
  // 分割されたplaceを統合
  splitGroups.forEach((splits, originalId) => {
    if (splits.length > 1) {
      // 複数の分割を統合して単一placeとして表示
      const firstSplit = splits[0];
      const lastSplit = splits[splits.length - 1];
      
      const mergedPlace = {
        ...firstSplit,
        id: originalId, // 元IDに戻す
        is_virtual_split: false, // 統合済みフラグ
        arrival_time: firstSplit.arrival_time,
        departure_time: lastSplit.departure_time,
        stay_duration_minutes: splits.reduce((sum, split) => sum + (split.stay_duration_minutes || 0), 0),
        notes: firstSplit.notes?.replace(/\| Context:.*$/, '') || firstSplit.name, // コンテキスト情報をクリーン
        merged_from_splits: splits, // UI用分割情報
        constraint_arrival_time: firstSplit.constraint_arrival_time,
        constraint_departure_time: lastSplit.constraint_departure_time,
        // 日跨ぎ期間表示用
        display_segments: splits.map((split, index) => ({
          day_index: split.split_day_index || index + 1,
          arrival_time: split.arrival_time,
          departure_time: split.departure_time,
          duration_minutes: split.stay_duration_minutes
        }))
      };
      
      mergedPlaces.push(mergedPlace);
    } else {
      // 単一の分割はそのまま追加（original_place_idに戻す）
      const singleSplit = splits[0];
      mergedPlaces.push({
        ...singleSplit,
        id: originalId,
        is_virtual_split: false
      });
    }
  });
  
  return mergedPlaces;
}

interface CalendarViewProps {
  optimizationResult?: any;
}

const CalendarView: React.FC<CalendarViewProps> = ({ optimizationResult }) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  // TEMPORARILY DISABLED - Edit mode disabled to debug 5-minute timeout issues
  const [isEditMode, setIsEditMode] = useState(false);
  const isEditingDisabled = true;
  const [mealModal, setMealModal] = useState<{
    isOpen: boolean;
    mealType: 'breakfast' | 'lunch' | 'dinner';
    dayData: any;
    timeSlot: string;
    nearbyLocation?: { lat: number; lng: number; name: string };
  }>({
    isOpen: false,
    mealType: 'breakfast',
    dayData: null,
    timeSlot: '',
    nearbyLocation: undefined
  });
  
  const [hotelModal, setHotelModal] = useState<{
    isOpen: boolean;
    dayData: any;
    timeSlot: string;
    nearbyLocation?: { lat: number; lng: number; name: string };
  }>({
    isOpen: false,
    dayData: null,
    timeSlot: '',
    nearbyLocation: undefined
  });

  const [flightModal, setFlightModal] = useState<{
    isOpen: boolean;
    routeData: {
      from: string;
      to: string;
      fromLat?: number;
      fromLng?: number;
      toLat?: number;
      toLng?: number;
    };
    dayData: any;
    timeSlot: string;
  }>({
    isOpen: false,
    routeData: {
      from: '',
      to: '',
      fromLat: undefined,
      fromLng: undefined,
      toLat: undefined,
      toLng: undefined
    },
    dayData: null,
    timeSlot: ''
  });

  const [placeInsertionModal, setPlaceInsertionModal] = useState<{
    isOpen: boolean;
    insertionContext: {
      dayData: any;
      afterPlaceIndex: number;
      beforePlaceIndex: number;
      timeSlot: string;
      nearbyLocation?: {
        lat: number;
        lng: number;
        name: string;
      };
    };
  }>({
    isOpen: false,
    insertionContext: {
      dayData: null,
      afterPlaceIndex: -1,
      beforePlaceIndex: -1,
      timeSlot: '',
      nearbyLocation: undefined
    }
  });

  const [transportModal, setTransportModal] = useState<{
    isOpen: boolean;
    routeData: {
      from: string;
      to: string;
      fromLat?: number;
      fromLng?: number;
      toLat?: number;
      toLng?: number;
    };
    dayData: any;
    timeSlot: string;
    transportMode: 'walking' | 'car';
    preCalculatedInfo?: {
      travelTime: number;
      transportMode: string;
    };
  }>({
    isOpen: false,
    routeData: {
      from: '',
      to: '',
      fromLat: undefined,
      fromLng: undefined,
      toLat: undefined,
      toLng: undefined
    },
    dayData: null,
    timeSlot: '',
    transportMode: 'walking',
    preCalculatedInfo: undefined
  });
  
  // Drag and drop state
  const [draggedPlace, setDraggedPlace] = useState<any>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStartY, setResizeStartY] = useState<number>(0);
  const [resizeStartDuration, setResizeStartDuration] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    currentTrip, 
    user: currentUser,
    memberColors, 
    tripMembers, 
    hasUserOptimized, 
    setHasUserOptimized, 
    movePlace, 
    resizePlaceDuration, 
    deleteScheduledPlace, 
    setupRealTimeSync,
    updateScheduleFromBackend,
    updateDayPlaces
  } = useStore();

  // Get transport mode icon using standardized component
  const getTransportIcon = useCallback((transportMode: string) => {
    return <TransportIcon mode={transportMode} size={12} className="transport-icon" />;
  }, []);

  // MapView Trip.com booking functions (direct reuse)
  const generateTripComFlightUrl = useCallback((origin: string, destination: string, dateStr: string) => {
    const tripComUrl = `https://trip.com/flights/booking?flightType=ow&dcity=${origin}&acity=${destination}&ddate=${dateStr}&adult=1&child=0&infant=0`;
    const encodedUrl = encodeURIComponent(tripComUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=8626&u=${encodedUrl}&campaign_id=121`;
  }, []);

  const generateTripComHotelUrl = useCallback((city: string, checkIn: string, checkOut: string) => {
    const baseUrl = 'https://tp.media/r?marker=649297&trs=434567&p=8626&u=https%3A%2F%2Ftrip.com%2Fhotels%2Flist';
    const params = new URLSearchParams({
      city: city,
      cityName: city,
      checkin: checkIn.replace(/-/g, '%2F'),
      checkout: checkOut.replace(/-/g, '%2F'),
      adult: '1',
      children: '0',
      crn: '1',
      searchType: 'CT',
      searchWord: city,
      'locale': 'en-XX',
      'curr': 'JPY'
    });
    return `${baseUrl}?${params.toString()}&campaign_id=121`;
  }, []);

  const handleDirectFlightBooking = useCallback((fromPlace: any, toPlace: any, dayData: any) => {
    // Open FlightBookingModal instead of direct trip.com redirect
    setFlightModal({
      isOpen: true,
      routeData: {
        from: fromPlace?.place_name || fromPlace?.name || 'Tokyo',
        to: toPlace?.place_name || toPlace?.name || 'Osaka',
        fromLat: fromPlace?.latitude,
        fromLng: fromPlace?.longitude,
        toLat: toPlace?.latitude,
        toLng: toPlace?.longitude
      },
      dayData: dayData,
      timeSlot: `Flight from ${fromPlace?.place_name || fromPlace?.name} to ${toPlace?.place_name || toPlace?.name}`
    });
  }, []);

  const handleDirectHotelBooking = useCallback((place: any, dayData: any) => {
    // Open HotelBookingModal instead of direct trip.com redirect
    setHotelModal({
      isOpen: true,
      dayData: dayData,
      timeSlot: `Hotel near ${place?.place_name || place?.name}`,
      nearbyLocation: {
        lat: place?.latitude || 35.6812,
        lng: place?.longitude || 139.7671,
        name: place?.place_name || place?.name || 'Current Location'
      }
    });
  }, []);

  const handleTransportBooking = useCallback((fromPlace: any, toPlace: any, dayData: any, transportMode: 'walking' | 'car', travelTime?: number, actualTransportMode?: string) => {
    setTransportModal({
      isOpen: true,
      routeData: {
        from: fromPlace?.place_name || fromPlace?.name || 'Start Location',
        to: toPlace?.place_name || toPlace?.name || 'End Location',
        fromLat: fromPlace?.latitude,
        fromLng: fromPlace?.longitude,
        toLat: toPlace?.latitude,
        toLng: toPlace?.longitude
      },
      dayData: dayData,
      timeSlot: `${transportMode === 'walking' ? 'Walking' : 'Transportation'} from ${fromPlace?.place_name || fromPlace?.name} to ${toPlace?.place_name || toPlace?.name}`,
      transportMode: transportMode,
      preCalculatedInfo: {
        travelTime: travelTime || 0,
        transportMode: actualTransportMode || transportMode
      }
    });
  }, []);

  // Format travel time
  const formatTravelTime = useCallback((minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
  }, []);

  // Generate gradient style for multiple contributors using centralized color logic
  const getPlaceStyle = useCallback((place: any) => {
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
  }, []);

  // Extract places from optimization result with consistent date formatting
  // 日跨ぎイベント分割ロジック
  const splitCrossDayEvent = useCallback((event: any, dayIndex: number) => {
    const startTime = event.arrival_time || event.departure_time || '00:00:00';
    const endTime = event.departure_time || event.arrival_time || '00:00:00';
    
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    // 日跨ぎ判定: 終了時刻が開始時刻より小さい（例：21:00-01:00）
    const isCrossDay = endHour < startHour;
    
    if (!isCrossDay) {
      return [{ ...event, is_split: false }];
    }
    
    // 分割イベント作成
    const part1 = {
      ...event,
      departure_time: '23:59:59', // 当日の終了
      is_split: true,
      split_part: 'first',
      original_event_id: event.id || event.place_name,
      split_note: `continues to next day`
    };
    
    const part2 = {
      ...event,
      arrival_time: '00:00:00', // 翌日の開始
      departure_time: endTime, // 元の終了時刻
      is_split: true,
      split_part: 'second',
      original_event_id: event.id || event.place_name,
      split_note: `continued from previous day`
    };
    
    return [part1, part2];
  }, []);

  const formatOptimizationResult = useCallback((result: any) => {
    if (!hasUserOptimized || !result?.optimization?.daily_schedules || !currentTrip) {
      return { schedulesByDay: {} };
    }

    const schedulesByDay: Record<string, any> = {};
    const crossDayEvents: any[] = []; // 翌日に継続するイベント
    
    result.optimization.daily_schedules.forEach((schedule: any, index: number) => {
      const dayKey = `day-${schedule.day}`;
      const actualDate = DateUtils.calculateTripDate(currentTrip, schedule.day);
      
      let dayPlaces = [...(schedule.scheduled_places || [])];
      
      // 🔥 edit-schedule仮想分割place統合処理
      dayPlaces = mergeVirtualSplitsForUI(dayPlaces);
      
      // 前日からの継続イベントを追加
      const continuedEvents = crossDayEvents.filter(event => event.target_day === schedule.day);
      dayPlaces.unshift(...continuedEvents);
      
      // 日跨ぎイベントの分割処理
      const processedPlaces: any[] = [];
      dayPlaces.forEach((place: any) => {
        const splitEvents = splitCrossDayEvent(place, index);
        
        if (splitEvents.length === 2) {
          // 日跨ぎイベント
          processedPlaces.push(splitEvents[0]); // 当日部分
          
          // 翌日部分を記録
          const nextDay = schedule.day + 1;
          crossDayEvents.push({
            ...splitEvents[1],
            target_day: nextDay
          });
          
          console.log(`🌙 Split cross-day event: ${place.name || place.place_name} (${place.arrival_time}-${place.departure_time})`);
        } else {
          processedPlaces.push(splitEvents[0]); // 通常イベント
        }
      });
      
      schedulesByDay[dayKey] = {
        day: schedule.day,
        date: DateUtils.formatForStorage(actualDate).split('T')[0],
        actualDate: actualDate,
        places: processedPlaces
      };
    });

    return { schedulesByDay };
  }, [hasUserOptimized, currentTrip, splitCrossDayEvent]);

  const formattedResult = useMemo(() => formatOptimizationResult(optimizationResult), [formatOptimizationResult, optimizationResult]);

  // Calculate actual date based on trip start date and day number using DateUtils
  const calculateActualDate = useCallback((dayNumber: number): Date => {
    return DateUtils.calculateTripDate(currentTrip, dayNumber);
  }, [currentTrip]);

  const formatTime = useCallback((timeString: string) => {
    if (!timeString) return '';
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }, []);

  // Use consistent date formatting across calendar views
  const formatDate = useCallback((date: Date) => {
    return DateUtils.formatCalendarDate(date);
  }, []);

  const formatDuration = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  }, []);

  const generateTimeSlots = useCallback(() => {
    const slots = [];
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  }, []);

  const timeSlots = useMemo(() => generateTimeSlots(), [generateTimeSlots]);

  const getPlaceForTimeSlot = useCallback((time: string, targetDate: string) => {
    // Find the schedule for the target date
    const daySchedule = Object.values(formattedResult.schedulesByDay).find((schedule: any) => 
      schedule.date === targetDate
    );
    
    if (!daySchedule) return null;
    
    return daySchedule.places.find((place: any) => {
      if (!place.arrival_time || !place.departure_time) return false;
      return time >= place.arrival_time && time < place.departure_time;
    });
  }, [formattedResult.schedulesByDay]);

  // New function to group consecutive places into blocks
  const getGroupedPlacesForDay = useCallback((dayData: any) => {
    if (!dayData.places || dayData.places.length === 0) return [];

    const groupedBlocks: Array<{
      place: any;
      startTime: string;
      endTime: string;
      duration: number;
      blockIndex?: number;
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

    // Add blockIndex to each grouped block
    return groupedBlocks.map((block, index) => ({
      ...block,
      blockIndex: index
    }));
  }, []);


  // Check if place is a system place (not draggable)
  const isSystemPlace = useCallback((place: any) => {
    return place.source === 'system' || 
           place.category === 'departure_point' || 
           place.category === 'final_destination' ||
           place.place_type === 'system_airport' ||
           (place.id && place.id.toString().startsWith('airport_')) ||
           (place.id && place.id.toString().startsWith('return_'));
  }, []);

  // Check if place is an airport (for insert button filtering)
  const isAirport = useCallback((place: any) => {
    return place.place_type === 'system_airport' ||
           (place.id && place.id.toString().startsWith('airport_')) ||
           (place.name && place.name.toLowerCase().includes('airport')) ||
           (place.place_name && place.place_name.toLowerCase().includes('airport')) ||
           place.category === 'airport';
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, place: any, blockIndex: number) => {
    // Prevent dragging system places
    if (isSystemPlace(place)) {
      e.preventDefault();
      return;
    }
    
    setDraggedPlace({ place, blockIndex });
    e.dataTransfer.effectAllowed = 'move';
  }, [isSystemPlace]);

  const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(-1);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetIndex: number, dayData: any) => {
    e.preventDefault();
    setDragOverIndex(-1);
    
    if (!draggedPlace || targetIndex === draggedPlace.blockIndex) return;
    
    // Prevent dropping on system places
    const groupedPlaces = getGroupedPlacesForDay(dayData);
    const targetPlace = groupedPlaces[targetIndex];
    if (isSystemPlace(targetPlace.place)) {
      alert('Cannot reorder onto system places.');
      return;
    }
    
    // Frontend reordering (for immediate UI feedback)
    const places = [...groupedPlaces];
    const [movedBlock] = places.splice(draggedPlace.blockIndex, 1);
    places.splice(targetIndex, 0, movedBlock);
    
    // Update local state
    updateDayPlaces(dayData.day, places.map(p => p.place));
    
    // Async backend call
    try {
      // Prepare proper day data structure for edge function using reordered places
      const dayDataForBackend = {
        day: dayData.day,
        date: dayData.actualDate || dayData.date,
        scheduled_places: places.map((block, index) => ({
          ...block.place,
          order_in_day: index + 1,
          arrival_time: block.startTime,
          departure_time: block.endTime,
          stay_duration_minutes: block.duration
        }))
      };
      
      // DISABLED: edit-schedule drag/drop reordering functionality
      console.warn('⚠️ Drag/drop reordering is temporarily disabled - edit-schedule function removed');
      
      // TODO: Implement drag/drop reordering with adopt-booking approach
      // For now, show success to user but don't actually reorder
      const response = { success: true, message: 'Reordering temporarily disabled' };
      const error = null;
      
      /*
      const { data: response, error } = await supabase.functions.invoke('edit-schedule', {
        body: {
          trip_id: currentTrip?.id,
          action: 'reorder',
          data: {
            dayData: dayDataForBackend,
            sourceIndex: draggedPlace.blockIndex,
            targetIndex
          },
          user_id: currentUser?.id
        }
      });
      */
      
      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }
      
      // Update local state with backend response
      if (response && response.updated_schedule) {
        updateScheduleFromBackend(response.updated_schedule);
      } else {
        console.warn('Backend reorder succeeded but no updated schedule returned');
      }
    } catch (error) {
      console.error('Backend reorder failed:', error);
      alert('Failed to sync reordering with backend. Changes may not persist.');
      // Optionally revert frontend changes
    }
    
    setDraggedPlace(null);
  }, [draggedPlace, getGroupedPlacesForDay, isSystemPlace, updateDayPlaces, updateScheduleFromBackend]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, placeId: string, currentDuration: number, place: any) => {
    // Prevent resizing system places
    if (isSystemPlace(place)) {
      e.preventDefault();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Strip -top or -bottom suffix to get the base place ID
    const basePlaceId = placeId.replace(/-(?:top|bottom)$/, '');
    setIsResizing(basePlaceId);
    setResizeStartY(e.clientY);
    setResizeStartDuration(currentDuration);
  }, [isSystemPlace]);

  const handleResizeMove = useCallback(async (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = e.clientY - resizeStartY;
    const pixelsPerMinute = 1; // 1px = 1 minute
    const durationChange = Math.round(deltaY / pixelsPerMinute);
    const newDuration = Math.max(15, resizeStartDuration + durationChange); // Minimum 15 minutes

    // Frontend-first approach: Update UI immediately
    try {
      await resizePlaceDuration(isResizing, newDuration, resizeStartDuration);
    } catch (error) {
      console.warn('Frontend resize update failed:', error);
    }

    // Background edge function call (non-blocking)
    if (currentTrip) {
      // Don't await - run in background
      (async () => {
        try {
          // Find the day data for the resizing place
          const dayData = Object.values(formattedResult.schedulesByDay).find((schedule: any) => 
            schedule.places.some((place: any) => (place.id || place.place_name) === isResizing)
          );
          
          if (dayData) {
            const { supabase } = await import('../lib/supabase');
            
            // Call optimized duration-change edge function
            const { data, error } = await supabase.functions.invoke('duration-change', {
              body: {
                trip_id: currentTrip.id,
                place_id: isResizing,
                new_duration: newDuration,
                old_duration: resizeStartDuration,
                day_data: dayData,
                user_id: useStore.getState().user?.id
              }
            });
            
            if (error) {
              console.warn('Duration change edge function failed (UI already updated):', error);
              return;
            }
            
            // Update with more detailed backend response if available
            if (data?.updated_day_schedule) {
              const { broadcastScheduleUpdate } = useStore.getState();
              broadcastScheduleUpdate({
                action: 'duration_change_backend',
                data: {
                  placeId: isResizing,
                  newDuration,
                  daySchedule: data.updated_day_schedule,
                  requiresManualAdjustment: data.requires_manual_adjustment,
                  adjustmentMessage: data.adjustment_message
                }
              });
            }
            
            // Show user notification if manual adjustment is required
            if (data?.requires_manual_adjustment) {
              console.warn('Manual adjustment required:', data.adjustment_message);
              // You could show a toast notification here
            }
          }
        } catch (error) {
          console.warn('Background duration-change function failed (UI already updated):', error);
        }
      })();
    }
  }, [isResizing, resizeStartY, resizeStartDuration, resizePlaceDuration, currentTrip, formattedResult]);

  // Updated resize end handler with backend integration
  const handleResizeEnd = useCallback(async () => {
    // Simply end the resize operation
    setIsResizing(null);
    setDragOverIndex(-1);
    
    // The backend processing already happens in handleResizeMove
  }, []);

  // Legacy edge function caller (kept for compatibility)
  const callEditScheduleEdgeFunction = useCallback(async (action: string, data: any) => {
    if (!currentTrip) return;

    try {
      // Use the new real-time sync system instead
      const { updateScheduleInRealTime } = useStore.getState();
      await updateScheduleInRealTime({ action, data });
    } catch (error) {
      console.error('Failed to call edit-schedule function:', error);
    }
  }, [currentTrip]);

  // DISABLED: Mouse event listeners for resize (was causing auth issues)
  React.useEffect(() => {
    console.log('Mouse event listeners disabled - functionality removed');
    // DISABLED: if (isResizing) {
    // DISABLED:   document.addEventListener('mousemove', handleResizeMove);
    // DISABLED:   document.addEventListener('mouseup', handleResizeEnd);
    // DISABLED:   return () => {
    // DISABLED:     document.removeEventListener('mousemove', handleResizeMove);
    // DISABLED:     document.removeEventListener('mouseup', handleResizeEnd);
    // DISABLED:   };
    // DISABLED: }
  }, [isResizing, handleResizeMove, handleResizeEnd]);
  
  // Setup real-time sync system
  // DISABLED: Realtime and data change listeners (was causing auth issues)
  React.useEffect(() => {
    console.log('Realtime setup and data change listeners disabled - functionality removed');
    // DISABLED: const cleanup = setupRealTimeSync();
    // DISABLED: const handleDataChange = (event: CustomEvent) => {
    // DISABLED:   const { type, data } = event.detail;
    // DISABLED:   if (type === 'schedule') {
    // DISABLED:     console.log('Calendar view received schedule update:', data);
    // DISABLED:   }
    // DISABLED: };
    // DISABLED: window.addEventListener('voypath-data-changed', handleDataChange as EventListener);
    // DISABLED: return () => {
    // DISABLED:   window.removeEventListener('voypath-data-changed', handleDataChange as EventListener);
    // DISABLED: };
  }, [setupRealTimeSync]);

  // Render toggle buttons using Portal to ensure they appear above all other elements
  const renderToggleButtons = () => {
    // Grid view toggle disabled - only show timeline view
    return null;
  };


  // Grid view disabled - always use timeline view

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
      {/* Grid view toggle disabled */}
      
      <div className="p-6 pt-16">
        {/* Unified Calendar View */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {/* Combined Header */}
          <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-blue-900">
              Trip Schedule - {currentTrip?.name || 'Unnamed Trip'}
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              {Object.keys(formattedResult.schedulesByDay).length} day{Object.keys(formattedResult.schedulesByDay).length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Unified Time Grid */}
          <div className="relative">
            
            {/* Days content area */}
            <div className="flex md:flex-row flex-col">
              {Object.entries(formattedResult.schedulesByDay).map(([dayKey, dayData], dayIndex) => (
                <div key={dayKey} className="md:flex-1 min-w-0 border-r md:border-r border-gray-200 md:last:border-r-0 border-b md:border-b-0 last:border-b-0">
                  {/* Day header */}
                  <div className="bg-blue-100 px-3 py-2 border-b border-gray-200 text-center">
                    <h4 className="text-sm font-semibold text-blue-900">
                      Day {dayData.day}
                    </h4>
                    <p className="text-xs text-blue-700">
                      {formatDate(dayData.actualDate || calculateActualDate(dayData.day))}
                    </p>
                  </div>
                  
                  {/* Time slots content */}
                  <div className="relative">
                    {/* Background time grid */}
                    <div className="absolute inset-0">
                      {(() => {
                        const timeSlots = [];
                        let currentHeight = 0;
                        // Day hours (6 AM to 11 PM) - 1 hour intervals
                        for (let hour = 6; hour <= 23; hour++) {
                          timeSlots.push({
                            time: `${hour.toString().padStart(2, '0')}:00`,
                            isNight: false,
                            height: 60,
                            top: currentHeight
                          });
                          currentHeight += 60;
                        }
                        // Night hours (12 AM to 6 AM) - 3 hour intervals, same height as day hours
                        for (let hour = 0; hour <= 6; hour += 3) {
                          timeSlots.push({
                            time: `${hour.toString().padStart(2, '0')}:00`,
                            isNight: true,
                            height: 60, // Same height as day hours (3-hour block = 1-hour day block)
                            top: currentHeight
                          });
                          currentHeight += 60;
                        }
                        
                        return timeSlots.map((slot, index) => (
                          <div
                            key={slot.time}
                            className="absolute w-full border-b border-gray-100"
                            style={{ 
                              height: `${slot.height}px`,
                              top: `${slot.top}px`,
                              backgroundColor: slot.isNight ? '#f8fafc' : '#ffffff'
                            }}
                          />
                        ));
                      })()}
                    </div>
                    
                    {/* Place blocks positioned on time grid */}
                    <div className="relative z-10">
                      {/* Day start add button */}
                      {isEditMode && (
                        <button
                          className="absolute left-1/2 transform -translate-x-1/2 bg-green-500 hover:bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-200 z-30"
                          style={{ top: '10px' }}
                          onClick={() => {
                            setPlaceInsertionModal({
                              isOpen: true,
                              insertionContext: {
                                dayData: dayData,
                                afterPlaceIndex: -1,
                                beforePlaceIndex: 0,
                                timeSlot: 'Day Start',
                                nearbyLocation: undefined
                              }
                            });
                          }}
                          title="Add place at start of day"
                        >
                          +
                        </button>
                      )}
                      
                      {getGroupedPlacesForDay(dayData).map((block, blockIndex) => {
                        const startHour = parseInt(block.startTime.split(':')[0]);
                        const startMinute = parseInt(block.startTime.split(':')[1]);
                        const endHour = parseInt(block.endTime.split(':')[0]);
                        const endMinute = parseInt(block.endTime.split(':')[1]);
                        
                        // UNIFIED position calculation - must match the timeline axis exactly
                        const calculatePosition = (hour: number, minute: number) => {
                          if (hour >= 6 && hour <= 23) {
                            // Day hours: 6 AM to 11 PM (each hour = 60px)
                            return (hour - 6) * 60 + (minute / 60) * 60;
                          } else {
                            // Night hours: 12 AM to 6 AM (3-hour blocks = 60px each, same as day hours)
                            const dayHours = 18 * 60; // 6 AM to 11 PM = 18 hours * 60px = 1080px
                            if (hour >= 0 && hour <= 6) {
                              const nightBlockIndex = Math.floor(hour / 3); // 0-2, 3-5, 6
                              const minuteOffset = (hour % 3) * 60 + minute; // Minutes within the 3-hour block
                              return dayHours + nightBlockIndex * 60 + (minuteOffset / 180) * 60;
                            }
                            return 0;
                          }
                        };
                        
                        const topPosition = calculatePosition(startHour, startMinute);
                        const endPosition = calculatePosition(endHour, endMinute);
                        const height = Math.max(endPosition - topPosition, 40); // Minimum 40px height
                        
                        return (
                          <div key={blockIndex} className="relative">
                            {/* Add Place button (only in edit mode) - positioned between places */}
                            {isEditMode && blockIndex > 0 && (() => {
                              const groupedPlaces = getGroupedPlacesForDay(dayData);
                              const prevBlock = groupedPlaces[blockIndex - 1];
                              const currentBlock = block;
                              
                              // Don't show insert button if either place is an airport
                              if (isAirport(prevBlock.place) || isAirport(currentBlock.place)) {
                                return null;
                              }
                              
                              // Calculate position between previous place end and current place start
                              const prevEndHour = parseInt(prevBlock.endTime.split(':')[0]);
                              const prevEndMinute = parseInt(prevBlock.endTime.split(':')[1]);
                              const currentStartHour = parseInt(currentBlock.startTime.split(':')[0]);
                              const currentStartMinute = parseInt(currentBlock.startTime.split(':')[1]);
                              
                              const calculatePosition = (hour: number, minute: number) => {
                                if (hour >= 6 && hour <= 23) {
                                  return (hour - 6) * 60 + (minute / 60) * 60;
                                } else {
                                  const nightHours = 18 * 60;
                                  if (hour >= 0 && hour <= 6) {
                                    return nightHours + Math.floor(hour / 3) * 60 + (minute / 180) * 60;
                                  }
                                  return 0;
                                }
                              };
                              
                              const prevEndPos = calculatePosition(prevEndHour, prevEndMinute);
                              const currentStartPos = calculatePosition(currentStartHour, currentStartMinute);
                              const middlePosition = prevEndPos + (currentStartPos - prevEndPos) / 2;
                              
                              return (
                                <button
                                  className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg transition-all duration-200 z-20"
                                  style={{ top: `${middlePosition}px` }}
                                  onClick={() => {
                                    // Calculate suggested time between places
                                    const prevEndTime = prevBlock ? prevBlock.endTime : '09:00';
                                    const currentStartTime = currentBlock.startTime;
                                    const suggestedTime = `${prevEndTime} - ${currentStartTime}`;
                                    
                                    setPlaceInsertionModal({
                                      isOpen: true,
                                      insertionContext: {
                                        dayData: dayData,
                                        afterPlaceIndex: blockIndex - 1,
                                        beforePlaceIndex: blockIndex,
                                        timeSlot: suggestedTime,
                                        nearbyLocation: prevBlock ? {
                                          lat: prevBlock.place.latitude || 35.6812,
                                          lng: prevBlock.place.longitude || 139.7671,
                                          name: prevBlock.place.place_name || prevBlock.place.name
                                        } : undefined
                                      }
                                    });
                                  }}
                                  title="Add place here"
                                >
                                  +
                                </button>
                              );
                            })()}


                            {/* Route line and transport info - positioned between places (both edit and non-edit modes) */}
                            {blockIndex > 0 && (() => {
                              const prevBlock = getGroupedPlacesForDay(dayData)[blockIndex - 1];
                              const currentBlock = block;
                              const transportMode = currentBlock.place.transport_mode || 'walking';
                              const travelTime = currentBlock.place.travel_time_from_previous || 0;
                              
                              // Show lines for all transport modes
                              const isFlight = transportMode.toLowerCase().includes('flight') || transportMode.toLowerCase().includes('plane') || transportMode.toLowerCase().includes('air');
                              
                              if (travelTime > 0) {
                                // Calculate position between previous place end and current place start
                                const prevEndHour = parseInt(prevBlock.endTime.split(':')[0]);
                                const prevEndMinute = parseInt(prevBlock.endTime.split(':')[1]);
                                const currentStartHour = parseInt(currentBlock.startTime.split(':')[0]);
                                const currentStartMinute = parseInt(currentBlock.startTime.split(':')[1]);
                                
                                const calculatePosition = (hour: number, minute: number) => {
                                  if (hour >= 6 && hour <= 23) {
                                    return (hour - 6) * 60 + (minute / 60) * 60;
                                  } else {
                                    const nightHours = 18 * 60;
                                    if (hour >= 0 && hour <= 6) {
                                      return nightHours + Math.floor(hour / 3) * 60 + (minute / 180) * 60;
                                    }
                                    return 0;
                                  }
                                };
                                
                                const prevEndPos = calculatePosition(prevEndHour, prevEndMinute);
                                const currentStartPos = calculatePosition(currentStartHour, currentStartMinute);
                                const totalGapLength = currentStartPos - prevEndPos;
                                const middlePosition = prevEndPos + totalGapLength / 2;
                                
                                // Calculate actual time gap in minutes
                                const timeGapMinutes = (currentStartHour - prevEndHour) * 60 + (currentStartMinute - prevEndMinute);
                                
                                // Calculate line length based on time gap and transport mode
                                const getLineLength = (transportMode: string, timeGap: number, totalSpace: number) => {
                                  // Base line length proportional to time gap (1 minute = 1 pixel)
                                  const baseLength = Math.max(timeGap * 1, 10); // Minimum 10px
                                  
                                  // All transport modes: 60% of previous length
                                  return Math.min(baseLength * 0.72, totalSpace * 0.36);
                                };
                                
                                const lineLength = getLineLength(transportMode, timeGapMinutes, totalGapLength);
                                
                                return (
                                  <div 
                                    className={`absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0 ${
                                      isFlight ? 'cursor-pointer' : 'cursor-default'
                                    }`}
                                    style={{ top: `${middlePosition}px` }}
                                    onClick={isFlight ? () => {
                                      handleDirectFlightBooking(
                                        prevBlock?.place,
                                        currentBlock.place,
                                        dayData
                                      );
                                    } : undefined}
                                    title={isFlight ? "Click to book flight" : undefined}
                                  >
                                    {/* Dynamic route line */}
                                    <div className="flex flex-col items-center hover:opacity-80 transition-opacity">
                                      <div 
                                        className={`w-px ${
                                          transportMode.toLowerCase().includes('flight') || transportMode.toLowerCase().includes('plane') || transportMode.toLowerCase().includes('air') ? 'bg-blue-400 dark:bg-blue-500' :
                                          transportMode.toLowerCase().includes('car') || transportMode.toLowerCase().includes('drive') || transportMode.toLowerCase().includes('taxi') ? 'bg-amber-400 dark:bg-amber-500' :
                                          'bg-gray-400 dark:bg-gray-500'
                                        }`}
                                        style={{ height: `${lineLength}px` }}
                                      ></div>
                                      
                                      {/* Flight transport info */}
                                      {(transportMode.toLowerCase().includes('flight') || transportMode.toLowerCase().includes('plane') || transportMode.toLowerCase().includes('air')) && (
                                        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1 flex items-center space-x-1 shadow-sm">
                                          {getTransportIcon(transportMode)}
                                          <span className="text-xs text-blue-600 dark:text-blue-400">
                                            {formatTravelTime(travelTime)}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* Car transport info */}
                                      {(transportMode.toLowerCase().includes('car') || transportMode.toLowerCase().includes('drive') || transportMode.toLowerCase().includes('taxi')) && (
                                        <div 
                                          className="bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1 flex items-center space-x-1 shadow-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors"
                                          onClick={() => handleTransportBooking(prevBlock.place, currentBlock.place, dayData, 'car', travelTime, transportMode)}
                                          title="Click to book transportation"
                                        >
                                          {getTransportIcon(transportMode)}
                                          <span className="text-xs text-amber-600 dark:text-amber-400">
                                            {formatTravelTime(travelTime)}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* Walking transport info */}
                                      {(transportMode.toLowerCase().includes('walk') || transportMode.toLowerCase().includes('foot') || transportMode === 'walking') && (
                                        <div 
                                          className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 flex items-center space-x-1 shadow-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                          onClick={() => handleTransportBooking(prevBlock.place, currentBlock.place, dayData, 'walking', travelTime, transportMode)}
                                          title="Click for walking options and taxi booking"
                                        >
                                          {getTransportIcon(transportMode)}
                                          <span className="text-xs text-gray-600 dark:text-gray-400">
                                            {formatTravelTime(travelTime)}
                                          </span>
                                        </div>
                                      )}
                                      
                                      <div 
                                        className={`w-px ${
                                          transportMode.toLowerCase().includes('flight') || transportMode.toLowerCase().includes('plane') || transportMode.toLowerCase().includes('air') ? 'bg-blue-400 dark:bg-blue-500' :
                                          transportMode.toLowerCase().includes('car') || transportMode.toLowerCase().includes('drive') || transportMode.toLowerCase().includes('taxi') ? 'bg-amber-400 dark:bg-amber-500' :
                                          'bg-gray-400 dark:bg-gray-500'
                                        }`}
                                        style={{ height: `${lineLength}px` }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            <div
                              className={`absolute left-1 right-1 hover:shadow-md transition-shadow duration-200 rounded-lg border border-gray-200 p-2 z-10 ${
                                isEditMode ? 'ring-2 ring-blue-300 ring-opacity-50 cursor-move' : 'cursor-pointer'
                              } ${
                                dragOverIndex === blockIndex ? 'ring-4 ring-blue-500 ring-opacity-50' : ''
                              } ${
                                block.place.is_split ? 'border-l-4 border-l-orange-400' : ''
                              }`}
                              style={{
                                top: `${topPosition}px`,
                                height: `${height}px`,
                                ...getPlaceStyle(block.place)
                              }}
                              onClick={() => setSelectedPlace(block.place)}
                              draggable={isEditMode && !isSystemPlace(block.place)}
                              onDragStart={(e) => handleDragStart(e, block.place, blockIndex)}
                              onDragOver={(e) => handleDragOver(e, blockIndex)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, blockIndex, dayData)}
                            >
                              <div className="text-xs font-semibold text-gray-900 leading-tight mb-1 truncate">
                                {block.place.place_name || block.place.name}
                                {block.place.is_split && (
                                  <span className="ml-1 text-orange-600 text-xs">
                                    {block.place.split_part === 'first' ? '(pt.1)' : '(pt.2)'}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                <span>{formatTime(block.startTime)} - {formatTime(block.endTime)}</span>
                              </div>
                              {block.place.is_split && block.place.split_note && (
                                <div className="text-xs text-orange-600 mt-1 italic">
                                  {block.place.split_note}
                                </div>
                              )}
                              
                              {/* Resize handles */}
                              {isEditMode && !isSystemPlace(block.place) && (
                                <>
                                  {/* Top resize handle */}
                                  <div
                                    className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-blue-500 rounded-full cursor-ns-resize hover:bg-blue-600 transition-colors opacity-0 hover:opacity-100 flex items-center justify-center"
                                    onMouseDown={(e) => handleResizeStart(e, `${block.place.id || block.place.place_name}-top`, block.duration, block.place)}
                                    title="Drag to extend/shorten duration"
                                  >
                                    <ArrowUpDown className="w-3 h-3 text-white" />
                                  </div>
                                  
                                  {/* Bottom resize handle */}
                                  <div
                                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-blue-500 rounded-full cursor-ns-resize hover:bg-blue-600 transition-colors opacity-0 hover:opacity-100 flex items-center justify-center"
                                    onMouseDown={(e) => handleResizeStart(e, `${block.place.id || block.place.place_name}-bottom`, block.duration, block.place)}
                                    title="Drag to extend/shorten duration"
                                  >
                                    <ArrowUpDown className="w-3 h-3 text-white" />
                                  </div>
                                  
                                  {/* Drag handle for reordering */}
                                  <div
                                    className="absolute top-1 right-1 w-6 h-6 bg-blue-500 rounded-full cursor-move hover:bg-blue-600 transition-colors opacity-0 hover:opacity-100 flex items-center justify-center"
                                    title="Drag to reorder places"
                                  >
                                    <Move className="w-3 h-3 text-white" />
                                  </div>
                                </>
                              )}
                              
                              {/* Edit mode controls */}
                              {isEditMode && (
                                <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                                  <div className="flex space-x-1">
                                    {/* Insert place button - only show if current place is not an airport */}
                                    {!isAirport(block.place) && (
                                      <button
                                        className="bg-white rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Open place insertion modal for inserting after this place
                                          const nextBlockIndex = blockIndex + 1;
                                          const nextBlock = getGroupedPlacesForDay(dayData)[nextBlockIndex];
                                        
                                        setPlaceInsertionModal({
                                          isOpen: true,
                                          insertionContext: {
                                            dayData: dayData,
                                            afterPlaceIndex: blockIndex,
                                            beforePlaceIndex: nextBlockIndex,
                                            timeSlot: `${formatTime(block.endTime)} - ${nextBlock ? formatTime(nextBlock.startTime) : '23:59'}`,
                                            nearbyLocation: {
                                              lat: block.place.latitude || 35.6812,
                                              lng: block.place.longitude || 139.7671,
                                              name: block.place.place_name || block.place.name
                                            }
                                          }
                                        });
                                      }}
                                      title="Add place after this"
                                    >
                                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                      </button>
                                    )}
                                    <button
                                      className="bg-white rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        // Show duration extension options
                                        const newDuration = prompt(`Current duration: ${formatDuration(block.duration)}\nEnter new duration in minutes:`, block.duration.toString());
                                        if (newDuration && !isNaN(parseInt(newDuration))) {
                                          // Use optimized duration change for manual input
                                          const newDur = parseInt(newDuration);
                                          try {
                                            const { supabase } = await import('../lib/supabase');
                                            
                                            const { data, error } = await supabase.functions.invoke('duration-change', {
                                              body: {
                                                trip_id: currentTrip?.id,
                                                place_id: block.place.id || block.place.place_name,
                                                new_duration: newDur,
                                                old_duration: block.duration,
                                                day_data: dayData,
                                                user_id: useStore.getState().user?.id
                                              }
                                            });
                                            
                                            if (error) {
                                              console.error('Duration change failed:', error);
                                              return;
                                            }
                                            
                                            // Update UI with response
                                            if (data?.updated_day_schedule) {
                                              const { broadcastScheduleUpdate } = useStore.getState();
                                              broadcastScheduleUpdate({
                                                action: 'duration_change_manual',
                                                data: {
                                                  placeId: block.place.id || block.place.place_name,
                                                  newDuration: newDur,
                                                  daySchedule: data.updated_day_schedule
                                                }
                                              });
                                            }
                                            
                                            if (data?.requires_manual_adjustment) {
                                              alert(data.adjustment_message);
                                            }
                                          } catch (error) {
                                            console.error('Failed to call duration-change function:', error);
                                            // Fallback
                                            await resizePlaceDuration(
                                              block.place.id || block.place.place_name,
                                              newDur,
                                              block.duration
                                            );
                                          }
                                        }
                                      }}
                                      title="Change duration"
                                    >
                                      <Clock className="w-3 h-3 text-gray-600" />
                                    </button>
                                    {/* Add flight booking button for any place */}
                                    {blockIndex > 0 && (
                                      <button
                                        className="bg-cyan-500 text-white rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const prevBlock = getGroupedPlacesForDay(dayData)[blockIndex - 1];
                                          setFlightModal({
                                            isOpen: true,
                                            routeData: {
                                              from: prevBlock?.place?.place_name || prevBlock?.place?.name || 'Previous Location',
                                              to: block.place.place_name || block.place.name || 'Current Location',
                                              fromLat: prevBlock?.place?.latitude,
                                              fromLng: prevBlock?.place?.longitude,
                                              toLat: block.place.latitude,
                                              toLng: block.place.longitude
                                            },
                                            dayData: dayData,
                                            timeSlot: `${formatTime(block.startTime)} departure`
                                          });
                                        }}
                                        title="Book flight to here"
                                      >
                                        <span className="text-xs">✈️</span>
                                      </button>
                                    )}
                                    
                                    {/* Delete place button */}
                                    <button
                                      className="bg-red-500 text-white rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`Are you sure you want to remove ${block.place.place_name || block.place.name} from your schedule?`)) {
                                          await deleteScheduledPlace(
                                            block.place.id || block.place.place_name,
                                            dayData,
                                            blockIndex
                                          );
                                        }
                                      }}
                                      title="Remove from schedule"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Meal events - Always visible, icon with duration lines */}
                      <>
                        {(() => {
                          // Shared position calculation function
                          const getMealPosition = (hour: number, minute: number = 0) => {
                            if (hour >= 6 && hour <= 23) {
                              return (hour - 6) * 60 + (minute / 60) * 60;
                            } else {
                              const dayHours = 18 * 60;
                              if (hour >= 0 && hour <= 6) {
                                const nightBlockIndex = Math.floor(hour / 3);
                                const minuteOffset = (hour % 3) * 60 + minute;
                                return dayHours + nightBlockIndex * 60 + (minuteOffset / 180) * 60;
                              }
                              return 0;
                            }
                          };

                          return (
                            <>
                              {/* Breakfast time (8:00 AM) - 1 hour duration */}
                              <div className="absolute right-2 z-50" style={{ top: `${getMealPosition(8)}px` }}>
                                {/* Duration line */}
                                <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-amber-400 h-16" 
                                     style={{ top: '-20px' }}>
                                </div>
                                {/* Meal icon */}
                                <div
                                  className="w-8 h-8 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full shadow-sm border border-amber-300 cursor-pointer flex items-center justify-center relative z-10"
                                  onClick={() => {
                                    setMealModal({
                                      isOpen: true,
                                      mealType: 'breakfast',
                                      dayData: dayData,
                                      timeSlot: '08:00',
                                      nearbyLocation: dayData.places.length > 0 ? {
                                        lat: dayData.places[0].latitude || 35.6812,
                                        lng: dayData.places[0].longitude || 139.7671,
                                        name: dayData.places[0].place_name || dayData.places[0].name
                                      } : undefined
                                    });
                                  }}
                                >
                                  <Utensils className="w-4 h-4" />
                                </div>
                              </div>
                              
                              {/* Lunch time (12:00 PM) - 1 hour duration */}
                              <div className="absolute right-2 z-50" style={{ top: `${getMealPosition(12)}px` }}>
                                {/* Duration line */}
                                <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-amber-400 h-16" 
                                     style={{ top: '-20px' }}>
                                </div>
                                {/* Meal icon */}
                                <div
                                  className="w-8 h-8 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full shadow-sm border border-amber-300 cursor-pointer flex items-center justify-center relative z-10"
                                  onClick={() => {
                                    setMealModal({
                                      isOpen: true,
                                      mealType: 'lunch',
                                      dayData: dayData,
                                      timeSlot: '12:00',
                                      nearbyLocation: dayData.places.length > 0 ? {
                                        lat: dayData.places[0].latitude || 35.6812,
                                        lng: dayData.places[0].longitude || 139.7671,
                                        name: dayData.places[0].place_name || dayData.places[0].name
                                      } : undefined
                                    });
                                  }}
                                >
                                  <Utensils className="w-4 h-4" />
                                </div>
                              </div>
                              
                              {/* Dinner time (6:00 PM) - 1.5 hour duration */}
                              <div className="absolute right-2 z-50" style={{ top: `${getMealPosition(18)}px` }}>
                                {/* Duration line */}
                                <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-amber-400 h-20" 
                                     style={{ top: '-20px' }}>
                                </div>
                                {/* Meal icon */}
                                <div
                                  className="w-8 h-8 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full shadow-sm border border-amber-300 cursor-pointer flex items-center justify-center relative z-10"
                                  onClick={() => {
                                    setMealModal({
                                      isOpen: true,
                                      mealType: 'dinner',
                                      dayData: dayData,
                                      timeSlot: '18:00',
                                      nearbyLocation: dayData.places.length > 0 ? {
                                        lat: dayData.places[0].latitude || 35.6812,
                                        lng: dayData.places[0].longitude || 139.7671,
                                        name: dayData.places[0].place_name || dayData.places[0].name
                                      } : undefined
                                    });
                                  }}
                                >
                                  <Utensils className="w-4 h-4" />
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </>
                      
                      {/* Hotel event - Same UI as place cards (22:00 - 08:00) */}
                      <>
                        {(() => {
                          // Shared position calculation function for hotels
                          const getHotelPosition = (hour: number, minute: number = 0) => {
                            if (hour >= 6 && hour <= 23) {
                              return (hour - 6) * 60 + (minute / 60) * 60;
                            } else {
                              const dayHours = 18 * 60;
                              if (hour >= 0 && hour <= 6) {
                                const nightBlockIndex = Math.floor(hour / 3);
                                const minuteOffset = (hour % 3) * 60 + minute;
                                return dayHours + nightBlockIndex * 60 + (minuteOffset / 180) * 60;
                              }
                              return 0;
                            }
                          };

                          return (
                            <>
                              {/* Hotel part 1: 22:00 - end of day - Skip on last day */}
                              {dayIndex < Object.keys(formattedResult.schedulesByDay).length - 1 && (
                                <div
                                  className="absolute left-1 right-1 hover:shadow-md transition-shadow duration-200 rounded-lg border border-gray-200 p-2 z-10 cursor-pointer"
                                  style={{ 
                                    top: `${getHotelPosition(22)}px`, // 22:00 position
                                    height: `${(18 * 60) + (3 * 60) - getHotelPosition(22)}px`, // From 22:00 to end of timeline (day hours + night hours)
                                    backgroundColor: '#faf5ff',
                                    borderLeftColor: '#a855f7',
                                    borderLeftWidth: '4px'
                                  }}
                                  onClick={() => {
                                    // Use consistent hotel identifier for both parts
                                    const hotelId = `hotel-${dayData.day}`;
                                    setHotelModal({
                                      isOpen: true,
                                      dayData: { ...dayData, hotelId }, // Add hotel identifier
                                      timeSlot: '22:00 - 08:00',
                                      nearbyLocation: dayData.places.length > 0 ? {
                                        lat: dayData.places[0].latitude || 35.6812,
                                        lng: dayData.places[0].longitude || 139.7671,
                                        name: dayData.places[0].place_name || dayData.places[0].name
                                      } : undefined
                                    });
                                  }}
                                >
                                  <div className="text-xs font-semibold text-gray-900 leading-tight mb-1 truncate">
                                    Hotel Stay
                                  </div>
                                  <div className="text-xs text-gray-600 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span>22:00 - 08:00</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Hotel part 2: 06:00 - 08:00 (early morning) - Skip on first day */}
                              {dayIndex > 0 && (() => {
                                // Get previous day's data for consistency
                                const dayKeys = Object.keys(formattedResult.schedulesByDay);
                                const prevDayKey = dayKeys[dayIndex - 1];
                                const prevDayData = formattedResult.schedulesByDay[prevDayKey];
                                
                                return (
                                  <div
                                    className="absolute left-1 right-1 hover:shadow-md transition-shadow duration-200 rounded-lg border border-gray-200 p-2 z-10 cursor-pointer"
                                    style={{ 
                                      top: `${getHotelPosition(6)}px`, // 06:00 position using unified calculation
                                      height: `${getHotelPosition(8) - getHotelPosition(6)}px`, // 06:00-08:00 (2 hours)
                                      backgroundColor: '#faf5ff',
                                      borderLeftColor: '#a855f7',
                                      borderLeftWidth: '4px'
                                    }}
                                    onClick={() => {
                                      // Use same hotel identifier as previous day's hotel part 1
                                      const hotelId = `hotel-${prevDayData.day}`;
                                      setHotelModal({
                                        isOpen: true,
                                        dayData: { ...prevDayData, hotelId }, // Use previous day's data for consistency
                                        timeSlot: '22:00 - 08:00',
                                        nearbyLocation: prevDayData.places.length > 0 ? {
                                          lat: prevDayData.places[0].latitude || 35.6812,
                                          lng: prevDayData.places[0].longitude || 139.7671,
                                          name: prevDayData.places[0].place_name || prevDayData.places[0].name
                                        } : undefined
                                      });
                                    }}
                                  >
                                    <div className="text-xs font-semibold text-gray-900 leading-tight mb-1 truncate">
                                      Hotel Stay
                                    </div>
                                    <div className="text-xs text-gray-600 flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      <span>22:00 - 08:00</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </>
                    </div>
                    
                    {/* Ensure minimum height for the day column */}
                    <div style={{ height: '1260px' }} /> {/* 18 hours * 60px + 3 night blocks * 60px */}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                  <p className="text-base text-gray-900 dark:text-gray-100 font-medium">{selectedPlace.wish_level}/5</p>
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
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Meal Insertion Modal - Portal to ensure it's on top */}
      {ReactDOM.createPortal(
        <MealInsertionModal
          isOpen={mealModal.isOpen}
          onClose={() => setMealModal({ ...mealModal, isOpen: false })}
          mealType={mealModal.mealType}
          dayData={mealModal.dayData}
          timeSlot={mealModal.timeSlot}
          nearbyLocation={mealModal.nearbyLocation}
        />,
        document.body
      )}
      
      {/* Hotel Booking Modal - Portal to ensure it's on top */}
      {ReactDOM.createPortal(
        <HotelBookingModal
          isOpen={hotelModal.isOpen}
          onClose={() => setHotelModal({ ...hotelModal, isOpen: false })}
          dayData={hotelModal.dayData}
          timeSlot={hotelModal.timeSlot}
          nearbyLocation={hotelModal.nearbyLocation}
        />,
        document.body
      )}
      
      {/* Flight Booking Modal - Portal to ensure it's on top */}
      {ReactDOM.createPortal(
        <FlightBookingModal
          isOpen={flightModal.isOpen}
          onClose={() => setFlightModal({ ...flightModal, isOpen: false })}
          routeData={flightModal.routeData}
          dayData={flightModal.dayData}
          timeSlot={flightModal.timeSlot}
        />,
        document.body
      )}
      
      {/* Transport Booking Modal - Portal to ensure it's on top */}
      {ReactDOM.createPortal(
        <TransportBookingModal
          isOpen={transportModal.isOpen}
          onClose={() => setTransportModal({ ...transportModal, isOpen: false })}
          routeData={transportModal.routeData}
          dayData={transportModal.dayData}
          timeSlot={transportModal.timeSlot}
          transportMode={transportModal.transportMode}
          preCalculatedInfo={transportModal.preCalculatedInfo}
        />,
        document.body
      )}
      
      {/* Place Insertion Modal - Portal to ensure it's on top */}
      {ReactDOM.createPortal(
        <PlaceInsertionModal
          isOpen={placeInsertionModal.isOpen}
          onClose={() => setPlaceInsertionModal({ ...placeInsertionModal, isOpen: false })}
          insertionContext={placeInsertionModal.insertionContext}
        />,
        document.body
      )}

      {/* Edit Mode Toggle Button - Rendered using Portal to escape stacking context */}
      {ReactDOM.createPortal(
        <div className="fixed bottom-20 right-4 z-[99999] flex flex-col items-center">
          <button
            onClick={() => {
              if (!isEditingDisabled) {
                setIsEditMode(!isEditMode);
              }
            }}
            disabled={isEditingDisabled}
            className={`w-14 h-14 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden group ${
              isEditingDisabled 
                ? 'bg-gray-400 cursor-not-allowed opacity-50'
                : isEditMode
                ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-green-600'
                : 'bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* Sparkle effects */}
            <div className="absolute inset-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse"
                  style={{
                    left: `${25 + i * 25}%`,
                    top: `${25 + i * 20}%`,
                    animationDelay: `${i * 0.7}s`
                  }}
                />
              ))}
            </div>

            {isEditMode ? (
              <Check className="w-6 h-6 text-white relative z-10" />
            ) : (
              <Edit3 className="w-6 h-6 text-white relative z-10" />
            )}
            
            {/* Circular Text */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56">
              <defs>
                <path
                  id="edit-circle-path"
                  d="M 28 28 m -20 0 a 20 20 0 1 1 40 0 a 20 20 0 1 1 -40 0"
                />
              </defs>
              <text className="text-[6px] fill-white font-medium" style={{ letterSpacing: '0.5px' }}>
                <textPath href="#edit-circle-path" startOffset="25%">
                  {isEditMode ? 'DONE' : 'EDIT'}
                </textPath>
              </text>
            </svg>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CalendarView;