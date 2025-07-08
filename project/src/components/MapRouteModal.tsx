import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, Route, Clock, Calendar, Plane, Car, MapPin as WalkingIcon, ExternalLink } from 'lucide-react';
import { DateUtils } from '../utils/DateUtils';
import { useStore } from '../store/useStore';
import { TravelPayoutsService, FlightOption } from '../services/TravelPayoutsService';

interface MapRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromPlace: any;
  toPlace: any;
}

const MapRouteModal: React.FC<MapRouteModalProps> = ({ isOpen, onClose, fromPlace, toPlace }) => {
  const { currentTrip, optimizationResult } = useStore();
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);

  if (!fromPlace || !toPlace) return null;

  // Determine transport mode
  let transport = toPlace.transport_mode || fromPlace.transport_mode || '';
  let duration = toPlace.travel_time_from_previous || 0;
  
  if (!transport) {
    const lat1 = Number(fromPlace.latitude);
    const lng1 = Number(fromPlace.longitude);
    const lat2 = Number(toPlace.latitude);
    const lng2 = Number(toPlace.longitude);
    const distance = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
    
    const fromIsAirport = fromPlace.place_type === 'airport' || 
      fromPlace.name?.toLowerCase().includes('airport') || 
      fromPlace.place_name?.toLowerCase().includes('airport');
    const toIsAirport = toPlace.place_type === 'airport' || 
      toPlace.name?.toLowerCase().includes('airport') || 
      toPlace.place_name?.toLowerCase().includes('airport');
    const fromIsSystem = fromPlace.place_type === 'departure' || fromPlace.place_type === 'destination';
    const toIsSystem = toPlace.place_type === 'departure' || toPlace.place_type === 'destination';
    
    if ((fromIsAirport && toIsAirport) || 
        (fromIsAirport && toIsSystem) || 
        (fromIsSystem && toIsAirport)) {
      transport = 'Flight';
    } else if (distance > 5) {
      transport = 'Flight';
    } else if (distance > 0.1 || fromIsAirport || toIsAirport) {
      transport = 'Car';
    } else {
      transport = 'Walking';
    }
  }
  
  transport = transport.charAt(0).toUpperCase() + transport.slice(1).toLowerCase();

  // Get transport icon and color
  const getTransportInfo = (mode: string) => {
    const modeLower = mode.toLowerCase();
    if (modeLower.includes('flight') || modeLower.includes('plane') || modeLower.includes('air')) {
      return {
        color: '#2563EB',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        textColor: 'text-blue-600 dark:text-blue-400',
        icon: Plane
      };
    } else if (modeLower.includes('car') || modeLower.includes('drive') || modeLower.includes('taxi')) {
      return {
        color: '#92400E',
        bgColor: 'bg-amber-100 dark:bg-amber-900/20',
        textColor: 'text-amber-600 dark:text-amber-400',
        icon: Car
      };
    } else {
      return {
        color: '#6B7280',
        bgColor: 'bg-slate-100 dark:bg-slate-700',
        textColor: 'text-slate-600 dark:text-slate-400',
        icon: WalkingIcon
      };
    }
  };

  const transportInfo = getTransportInfo(transport);
  const TransportIcon = transportInfo.icon;

  // Helper function to format time
  const formatTime = (time: string) => {
    const date = new Date(`1970-01-01T${time}`);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Calculate actual dates
  let fromActualDate = null;
  let toActualDate = null;
  try {
    if (currentTrip && fromPlace.day_number) {
      fromActualDate = DateUtils.calculateTripDate(currentTrip, fromPlace.day_number);
    }
    if (currentTrip && toPlace.day_number) {
      toActualDate = DateUtils.calculateTripDate(currentTrip, toPlace.day_number);
    }
  } catch (error) {
    console.warn('Could not calculate trip date:', error);
  }

  // Format departure/arrival times with date context
  let departureDisplay = '';
  let arrivalDisplay = '';
  let departureDateDisplay = '';
  let arrivalDateDisplay = '';
  
  if (fromPlace.departure_time) {
    const timeStr = formatTime(fromPlace.departure_time);
    if (fromActualDate) {
      const dateStr = `${fromActualDate.getMonth() + 1}/${fromActualDate.getDate()}`;
      const fullDateStr = fromActualDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      departureDisplay = `${dateStr} ${timeStr}`;
      departureDateDisplay = fullDateStr;
    } else {
      departureDisplay = timeStr;
    }
  }
  
  if (toPlace.arrival_time) {
    const timeStr = formatTime(toPlace.arrival_time);
    if (toActualDate) {
      const dateStr = `${toActualDate.getMonth() + 1}/${toActualDate.getDate()}`;
      const fullDateStr = toActualDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      arrivalDisplay = `${dateStr} ${timeStr}`;
      arrivalDateDisplay = fullDateStr;
    } else {
      arrivalDisplay = timeStr;
    }
  }

  // Extract IATA codes for flight search
  const extractIATACode = (placeName: string): string | null => {
    const match = placeName.match(/\(([A-Z]{3,4})\)/);
    return match ? match[1] : null;
  };

  const fromIATA = extractIATACode(fromPlace.place_name || fromPlace.name || '');
  const toIATA = extractIATACode(toPlace.place_name || toPlace.name || '');

  // Search for flights if transport mode is flight
  useEffect(() => {
    let isCancelled = false;

    if (isOpen && transport.toLowerCase() === 'flight' && fromIATA && toIATA) {
      setLoadingFlights(true);
      setFlightError(null);
      
      // Calculate departure date
      let departureDate = new Date();
      let dayIndex = null;
      
      const routeDayNumber = toPlace.day_number || fromPlace.day_number;
      
      if (routeDayNumber && optimizationResult?.optimization?.daily_schedules) {
        const daySchedule = optimizationResult.optimization.daily_schedules.find(
          schedule => schedule.day === routeDayNumber
        );
        
        if (daySchedule) {
          dayIndex = routeDayNumber - 1;
        }
      }
      
      if (dayIndex !== null && currentTrip) {
        const scheduleDate = optimizationResult?.optimization?.daily_schedules?.[dayIndex]?.date;
        
        if (scheduleDate) {
          departureDate = new Date(scheduleDate);
        } else {
          const tripStartDate = currentTrip.startDate || currentTrip.start_date || new Date().toISOString();
          departureDate = new Date(tripStartDate);
          departureDate.setDate(departureDate.getDate() + dayIndex);
        }
      } else {
        const tripStartDate = currentTrip?.startDate || currentTrip?.start_date || new Date().toISOString();
        departureDate = new Date(tripStartDate);
      }
      
      const dateStr = departureDate.toISOString().split('T')[0];
      
      // Extract time preferences
      let departureTime: string | undefined;
      let arrivalTime: string | undefined;
      let routeDuration: string | undefined;

      if (fromPlace.departure_time) {
        departureTime = formatTime(fromPlace.departure_time);
      }
      if (toPlace.arrival_time) {
        arrivalTime = formatTime(toPlace.arrival_time);
      }
      if (duration > 0) {
        routeDuration = DateUtils.formatDuration(duration);
      }

      TravelPayoutsService.searchFlights(fromIATA, toIATA, dateStr, {
        departureTime,
        arrivalTime,
        duration: routeDuration
      })
        .then((flights: FlightOption[]) => {
          if (!isCancelled) {
            setFlightOptions(flights);
            setLoadingFlights(false);
          }
        })
        .catch((error) => {
          if (!isCancelled) {
            console.error('Flight search failed:', error);
            setFlightError('Unable to load flight data');
            setLoadingFlights(false);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, transport, fromIATA, toIATA, currentTrip, optimizationResult, fromPlace, toPlace, duration]);

  const handleBookFlight = (bookingUrl: string) => {
    window.open(bookingUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      <motion.div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          className="w-full max-w-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[90vh]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl ${transportInfo.bgColor} flex items-center justify-center`}>
                <TransportIcon className={`w-5 h-5 ${transportInfo.textColor}`} />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  Route Information
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {transport} route details
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-96">
            <div className="space-y-6">
              
              {/* Route Details */}
              <div className="space-y-4">
                {/* From */}
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 dark:text-green-400 text-sm font-bold">F</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">From</p>
                    <p className="text-slate-600 dark:text-slate-400">{fromPlace.place_name || fromPlace.name}</p>
                  </div>
                </div>

                {/* To */}
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 dark:text-red-400 text-sm font-bold">T</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">To</p>
                    <p className="text-slate-600 dark:text-slate-400">{toPlace.place_name || toPlace.name}</p>
                  </div>
                </div>

                {/* Transport Mode */}
                <div className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-lg ${transportInfo.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <TransportIcon className={`w-4 h-4 ${transportInfo.textColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Transport Mode</p>
                    <p className="text-slate-600 dark:text-slate-400">{transport}</p>
                  </div>
                </div>

                {/* Duration */}
                {duration > 0 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Duration</p>
                      <p className="text-slate-600 dark:text-slate-400">{DateUtils.formatDuration(duration)}</p>
                    </div>
                  </div>
                )}

                {/* Travel Times */}
                {(departureDisplay || arrivalDisplay) && (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Travel Times</p>
                      <div className="space-y-2 mt-2">
                        {departureDisplay && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">Departure</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{departureDisplay}</p>
                                {departureDateDisplay && (
                                  <p className="text-xs text-green-600 dark:text-green-400">{departureDateDisplay}</p>
                                )}
                              </div>
                              <div className="text-green-600 dark:text-green-400">
                                <span className="text-lg">🛫</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {arrivalDisplay && (
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-700">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">Arrival</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{arrivalDisplay}</p>
                                {arrivalDateDisplay && (
                                  <p className="text-xs text-red-600 dark:text-red-400">{arrivalDateDisplay}</p>
                                )}
                              </div>
                              <div className="text-red-600 dark:text-red-400">
                                <span className="text-lg">🛬</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Flight Options */}
              {transport.toLowerCase() === 'flight' && fromIATA && toIATA && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Flight Options: {fromIATA} → {toIATA}
                    </h3>
                  </div>

                  {loadingFlights && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-400">Searching for flights...</p>
                    </div>
                  )}

                  {flightError && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                      <p className="text-red-600 dark:text-red-400 text-center">{flightError}</p>
                      <div className="mt-3 text-center">
                        <button
                          onClick={() => handleBookFlight(`https://www.aviasales.com/search/${fromIATA}${toIATA}`)}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Search on Aviasales</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!loadingFlights && !flightError && flightOptions.length > 0 && (
                    <div className="space-y-3">
                      {flightOptions.slice(0, 3).map((flight, index) => {
                        // Format flight date for display
                        const flightDate = fromActualDate || new Date();
                        const flightDateStr = flightDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        });
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-2 ${
                              flight.matchesSchedule 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-bold text-slate-900 dark:text-white text-lg">
                                    {flight.airline} {flight.flightNumber}
                                  </div>
                                  {flight.matchesSchedule && (
                                    <div className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                      MATCHES SCHEDULE
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                  📅 {flightDateStr}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                  {flight.departure} → {flight.arrival} ({flight.duration})
                                </div>
                                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                                  ¥{flight.price.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleBookFlight(flight.bookingUrl)}
                              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                            >
                              Book Flight
                            </button>
                          </div>
                        );
                      })}
                      <div className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
                        <div className="text-green-600 dark:text-green-400 font-medium">
                          {flightOptions.some(f => f.source === 'WayAway') ? 'Real flight data from WayAway' : 'Mock data with WayAway booking links'}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500">
                          Powered by WayAway
                        </div>
                      </div>
                    </div>
                  )}

                  {!loadingFlights && !flightError && flightOptions.length === 0 && (
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg text-center">
                      <p className="text-slate-600 dark:text-slate-400 mb-3">No flights found for this route</p>
                      <button
                        onClick={() => handleBookFlight(TravelPayoutsService.generateBookingUrl(fromIATA, toIATA, new Date().toISOString().split('T')[0]))}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Search on Trip.com</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-secondary-700 transition-all duration-200"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default MapRouteModal;