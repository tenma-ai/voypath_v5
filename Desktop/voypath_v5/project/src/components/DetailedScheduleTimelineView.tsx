/**
 * Detailed Schedule Timeline View - Phase 8 Implementation
 * TODO 135: Create detailed schedule timeline view
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Car, 
  Users, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Timer,
  Route
} from 'lucide-react';
import type { OptimizedTrip, OptimizedPlace, TravelSegment } from '../types/optimization';

interface DetailedScheduleTimelineViewProps {
  optimizedTrip: OptimizedTrip;
  memberColors: Record<string, string>;
  onPlaceSelect?: (place: OptimizedPlace) => void;
  onTimelineInteraction?: (placeId: string, action: string) => void;
}

interface TimelineEvent {
  id: string;
  type: 'place' | 'travel' | 'break';
  startTime: Date;
  endTime: Date;
  place?: OptimizedPlace;
  travelSegment?: TravelSegment;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  details: Record<string, unknown>;
}

export default function DetailedScheduleTimelineView({
  optimizedTrip,
  memberColors,
  onPlaceSelect,
  onTimelineInteraction
}: DetailedScheduleTimelineViewProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');

  useEffect(() => {
    generateTimelineEvents();
  }, [optimizedTrip, selectedDay, generateTimelineEvents]);

  const generateTimelineEvents = () => {
    if (!optimizedTrip.detailedSchedule || !optimizedTrip.detailedSchedule[selectedDay]) {
      return;
    }

    const daySchedule = optimizedTrip.detailedSchedule[selectedDay];
    const events: TimelineEvent[] = [];

    daySchedule.places.forEach((place, index) => {
      // Add place visit event
      events.push({
        id: `place-${place.id}-${index}`,
        type: 'place',
        startTime: new Date(place.arrival_time),
        endTime: new Date(place.departure_time),
        place,
        title: place.name,
        subtitle: `${formatDuration(place.visit_duration)} visit`,
        icon: <MapPin className="w-4 h-4" />,
        color: getPlaceColor(place),
        details: {
          address: place.address,
          visitDuration: place.visit_duration,
          arrivalTime: place.arrival_time,
          departureTime: place.departure_time,
          preferences: place.member_preferences,
          photos: place.photos
        }
      });

      // Add travel segment if not the last place
      if (index < daySchedule.places.length - 1) {
        const travelSegment = daySchedule.travel_segments[index];
        if (travelSegment) {
          events.push({
            id: `travel-${index}`,
            type: 'travel',
            startTime: new Date(place.departure_time),
            endTime: new Date(daySchedule.places[index + 1].arrival_time),
            travelSegment,
            title: `Travel to ${daySchedule.places[index + 1].name}`,
            subtitle: `${formatDuration(travelSegment.duration)} by ${travelSegment.mode}`,
            icon: <Car className="w-4 h-4" />,
            color: '#6b7280',
            details: {
              distance: travelSegment.distance,
              duration: travelSegment.duration,
              mode: travelSegment.mode,
              route: travelSegment.route
            }
          });
        }
      }
    });

    setTimelineEvents(events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
  };

  const getPlaceColor = (place: OptimizedPlace): string => {
    if (place.member_preferences && place.member_preferences.length > 0) {
      return memberColors[place.member_preferences[0].member_id] || '#3b82f6';
    }
    return '#3b82f6';
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
    onTimelineInteraction?.(eventId, newExpanded.has(eventId) ? 'expand' : 'collapse');
  };

  const handlePlaceClick = (place: OptimizedPlace) => {
    onPlaceSelect?.(place);
    onTimelineInteraction?.(place.id, 'select');
  };

  const getDayOptions = () => {
    if (!optimizedTrip.detailedSchedule) return [];
    return optimizedTrip.detailedSchedule.map((_, index) => ({
      value: index,
      label: `Day ${index + 1}`,
      date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toLocaleDateString()
    }));
  };

  const getTotalDayStats = () => {
    const daySchedule = optimizedTrip.detailedSchedule?.[selectedDay];
    if (!daySchedule) return null;

    const totalVisitTime = daySchedule.places.reduce((sum, place) => sum + place.visit_duration, 0);
    const totalTravelTime = daySchedule.travel_segments.reduce((sum, segment) => sum + segment.duration, 0);
    const totalDistance = daySchedule.travel_segments.reduce((sum, segment) => sum + segment.distance, 0);

    return {
      totalVisitTime,
      totalTravelTime,
      totalDistance: Math.round(totalDistance * 100) / 100,
      placesCount: daySchedule.places.length
    };
  };

  const dayStats = getTotalDayStats();

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Detailed Schedule Timeline
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'detailed' ? 'compact' : 'detailed')}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {viewMode === 'detailed' ? 'Compact' : 'Detailed'} View
            </button>
          </div>
        </div>

        {/* Day Selector */}
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium text-gray-700">Select Day:</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {getDayOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.date}
              </option>
            ))}
          </select>
        </div>

        {/* Day Statistics */}
        {dayStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{dayStats.placesCount}</div>
              <div className="text-xs text-gray-600">Places</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{formatDuration(dayStats.totalVisitTime)}</div>
              <div className="text-xs text-gray-600">Visit Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">{formatDuration(dayStats.totalTravelTime)}</div>
              <div className="text-xs text-gray-600">Travel Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">{dayStats.totalDistance} km</div>
              <div className="text-xs text-gray-600">Distance</div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-6">
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No schedule available for this day</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Timeline Events */}
            <div className="space-y-4">
              <AnimatePresence>
                {timelineEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative flex items-start gap-4"
                  >
                    {/* Timeline Dot */}
                    <div 
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white z-10"
                      style={{ backgroundColor: event.color }}
                    >
                      {event.icon}
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0">
                      <div 
                        className={`bg-white border rounded-lg shadow-sm transition-all duration-200 ${
                          event.type === 'place' ? 'hover:shadow-md cursor-pointer' : ''
                        } ${expandedEvents.has(event.id) ? 'shadow-md' : ''}`}
                        onClick={() => event.type === 'place' && event.place && handlePlaceClick(event.place)}
                      >
                        {/* Event Header */}
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-600">
                                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                                </span>
                                <Timer className="w-3 h-3 text-gray-400" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 truncate">
                                {event.title}
                              </h3>
                              {event.subtitle && (
                                <p className="text-sm text-gray-600">{event.subtitle}</p>
                              )}
                            </div>
                            
                            {(viewMode === 'detailed' || event.type === 'place') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEventExpansion(event.id);
                                }}
                                className="ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                              >
                                {expandedEvents.has(event.id) ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Member Preferences for Places */}
                          {event.type === 'place' && event.place?.member_preferences && (
                            <div className="flex items-center gap-2 mt-2">
                              <Users className="w-3 h-3 text-gray-400" />
                              <div className="flex gap-1">
                                {event.place.member_preferences.map((pref) => (
                                  <div
                                    key={pref.member_id}
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: memberColors[pref.member_id] || '#gray' }}
                                    title={`Member ${pref.member_id} preference: ${pref.preference_score}/5`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {expandedEvents.has(event.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-gray-100 overflow-hidden"
                            >
                              <div className="p-4 space-y-3">
                                {event.type === 'place' && event.details && (
                                  <>
                                    {event.details.address && (
                                      <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <span className="text-sm text-gray-600">{event.details.address}</span>
                                      </div>
                                    )}
                                    
                                    {event.details.preferences && event.details.preferences.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Member Preferences:</h4>
                                        <div className="space-y-1">
                                          {event.details.preferences.map((pref: { member_id: string; preference_score: number }) => (
                                            <div key={pref.member_id} className="flex items-center justify-between text-sm">
                                              <span className="flex items-center gap-2">
                                                <div
                                                  className="w-3 h-3 rounded-full"
                                                  style={{ backgroundColor: memberColors[pref.member_id] }}
                                                />
                                                Member {pref.member_id}
                                              </span>
                                              <span className="text-gray-600">
                                                {pref.preference_score}/5 stars
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                {event.type === 'travel' && event.details && (
                                  <>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-500">Distance:</span>
                                        <span className="ml-2 text-gray-700">{event.details.distance} km</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Mode:</span>
                                        <span className="ml-2 text-gray-700 capitalize">{event.details.mode}</span>
                                      </div>
                                    </div>
                                    
                                    {event.details.route && (
                                      <div className="flex items-start gap-2">
                                        <Route className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <span className="text-sm text-gray-600">
                                          Route via {event.details.route.via || 'best route'}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}