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

  // Early return if no data
  if (!fromPlace || !toPlace) return null;

  // Determine transport mode
  const getTransportMode = () => {
    let transport = toPlace.transport_mode || fromPlace.transport_mode || '';
    
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
    
    return transport.charAt(0).toUpperCase() + transport.slice(1).toLowerCase();
  };

  const transport = getTransportMode();
  const duration = toPlace.travel_time_from_previous || 0;

  // Get transport icon and styling
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

  // Format time helper
  const formatTime = (time: string) => {
    try {
      const date = new Date(`1970-01-01T${time}`);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return time;
    }
  };

  // Calculate dates for places
  const calculatePlaceDate = (place: any) => {
    try {
      if (currentTrip && place.day_number) {
        return DateUtils.calculateTripDate(currentTrip, place.day_number);
      }
    } catch (error) {
      console.warn('Could not calculate trip date:', error);
    }
    return null;
  };

  const fromActualDate = calculatePlaceDate(fromPlace);
  const toActualDate = calculatePlaceDate(toPlace);

  // Format display times with dates
  const formatDisplayTime = (time: string, date: Date | null) => {
    if (!time) return '';
    
    const timeStr = formatTime(time);
    if (date) {
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const fullDateStr = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      return {
        display: `${dateStr} ${timeStr}`,
        fullDate: fullDateStr
      };
    }
    return { display: timeStr, fullDate: '' };
  };

  const departureInfo = formatDisplayTime(fromPlace.departure_time, fromActualDate);
  const arrivalInfo = formatDisplayTime(toPlace.arrival_time, toActualDate);

  // Extract IATA codes
  const extractIATACode = (placeName: string): string | null => {
    const match = placeName.match(/\(([A-Z]{3,4})\)/);
    return match ? match[1] : null;
  };

  const fromIATA = extractIATACode(fromPlace.place_name || fromPlace.name || '');
  const toIATA = extractIATACode(toPlace.place_name || toPlace.name || '');

  // Flight search effect - properly isolated
  useEffect(() => {
    let cancelled = false;

    const searchFlights = async () => {
      if (!isOpen || transport.toLowerCase() !== 'flight' || !fromIATA || !toIATA) {
        return;
      }

      setLoadingFlights(true);
      setFlightError(null);
      
      try {
        // Calculate departure date
        let departureDate = new Date();
        const routeDayNumber = toPlace.day_number || fromPlace.day_number;
        
        if (routeDayNumber && optimizationResult?.optimization?.daily_schedules) {
          const daySchedule = optimizationResult.optimization.daily_schedules.find(
            schedule => schedule.day === routeDayNumber
          );
          
          if (daySchedule) {
            const dayIndex = routeDayNumber - 1;
            const scheduleDate = optimizationResult?.optimization?.daily_schedules?.[dayIndex]?.date;
            
            if (scheduleDate) {
              departureDate = new Date(scheduleDate);
            } else if (currentTrip) {
              const tripStartDate = currentTrip.startDate || currentTrip.start_date || new Date().toISOString();
              departureDate = new Date(tripStartDate);
              departureDate.setDate(departureDate.getDate() + dayIndex);
            }
          }
        } else if (currentTrip) {
          const tripStartDate = currentTrip.startDate || currentTrip.start_date || new Date().toISOString();
          departureDate = new Date(tripStartDate);
        }
        
        const dateStr = departureDate.toISOString().split('T')[0];
        
        // Extract time preferences
        const timePreferences = {
          departureTime: fromPlace.departure_time ? formatTime(fromPlace.departure_time) : undefined,
          arrivalTime: toPlace.arrival_time ? formatTime(toPlace.arrival_time) : undefined,
          duration: duration > 0 ? DateUtils.formatDuration(duration) : undefined
        };

        const flights = await TravelPayoutsService.searchFlights(fromIATA, toIATA, dateStr, timePreferences);
        
        if (!cancelled) {
          setFlightOptions(flights);
          setLoadingFlights(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Flight search failed:', error);
          setFlightError('Unable to load flight data');
          setLoadingFlights(false);
        }
      }
    };

    // Call async function without returning it
    searchFlights();

    // Return only cleanup function
    return () => {
      cancelled = true;
    };
  }, [isOpen, transport, fromIATA, toIATA, fromPlace, toPlace, currentTrip, optimizationResult, duration]);

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
                  {transport} Route Information
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Route details and travel information
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
              
              {/* Route Overview */}
              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
                <div className="flex items-center space-x-2 mb-3">
                  <Route className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">Route Overview</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">From</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{fromPlace.place_name || fromPlace.name}</p>
                    </div>
                    <div className="px-3">
                      <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-600"></div>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">To</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{toPlace.place_name || toPlace.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <TransportIcon className={`w-4 h-4 ${transportInfo.textColor}`} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{transport}</span>
                    </div>
                    {duration > 0 && (
                      <>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {DateUtils.formatDuration(duration)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Travel Times */}
              {(departureInfo.display || arrivalInfo.display) && (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">Travel Times</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {departureInfo.display && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-lg">🛫</span>
                              <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">Departure</p>
                            </div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{departureInfo.display}</p>
                            {departureInfo.fullDate && (
                              <p className="text-sm text-green-600 dark:text-green-400">{departureInfo.fullDate}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {arrivalInfo.display && (
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-lg">🛬</span>
                              <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wide">Arrival</p>
                            </div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{arrivalInfo.display}</p>
                            {arrivalInfo.fullDate && (
                              <p className="text-sm text-red-600 dark:text-red-400">{arrivalInfo.fullDate}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Flight Options */}
              {transport.toLowerCase() === 'flight' && fromIATA && toIATA && (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">
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
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-700">
                      <p className="text-red-600 dark:text-red-400 text-center mb-3">{flightError}</p>
                      <div className="text-center">
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
                    <div className="space-y-4">
                      {flightOptions.slice(0, 3).map((flight, index) => {
                        const flightDate = fromActualDate || new Date();
                        const flightDateStr = flightDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        });
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
                              flight.matchesSchedule 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                                    {flight.airline} {flight.flightNumber}
                                  </h4>
                                  {flight.matchesSchedule && (
                                    <div className="bg-green-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                                      ✓ MATCHES SCHEDULE
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400 mb-3">
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>📅 {flightDateStr}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{flight.duration}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {flight.departure} → {flight.arrival}
                                  </span>
                                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    ¥{flight.price.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleBookFlight(flight.bookingUrl)}
                              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg"
                            >
                              Book Flight →
                            </button>
                          </div>
                        );
                      })}
                      
                      <div className="text-center py-4 border-t border-slate-200 dark:border-slate-600">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                          {flightOptions.some(f => f.source === 'WayAway') ? '✓ Real flight data from WayAway' : '⚡ Mock data with WayAway booking links'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Powered by WayAway Travel Platform
                        </div>
                      </div>
                    </div>
                  )}

                  {!loadingFlights && !flightError && flightOptions.length === 0 && (
                    <div className="bg-slate-50 dark:bg-slate-700 p-6 rounded-xl text-center">
                      <p className="text-slate-600 dark:text-slate-400 mb-4">No flights found for this route</p>
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
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-secondary-700 transition-all duration-200 shadow-md hover:shadow-lg"
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