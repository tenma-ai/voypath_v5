import React from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, Clock, User, Star, MapPin, Calendar } from 'lucide-react';
import { getPlaceColor } from '../utils/ColorUtils';
import { DateUtils } from '../utils/DateUtils';
import { useStore } from '../store/useStore';

interface MapPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: any;
  index: number;
}

const MapPlaceModal: React.FC<MapPlaceModalProps> = ({ isOpen, onClose, place, index }) => {
  const { currentTrip } = useStore();

  if (!place) return null;

  // Get user information for the place
  const colorResult = getPlaceColor(place);
  let userInfo = '';
  
  if (colorResult.type === 'single' && colorResult.contributors.length > 0) {
    userInfo = colorResult.contributors[0].memberName || 'Unknown user';
  } else if (colorResult.type === 'gradient' && colorResult.contributors) {
    userInfo = colorResult.contributors.map(c => c.memberName).join(', ');
  } else if (colorResult.type === 'gold') {
    userInfo = 'All members';
  }

  // Helper function to format time without seconds
  const formatTimeWithoutSeconds = (timeString: string) => {
    if (!timeString) return timeString;
    
    if (timeString.includes('T')) {
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
    } else if (timeString.includes(':')) {
      const timeParts = timeString.split(':');
      if (timeParts.length >= 2) {
        return `${timeParts[0]}:${timeParts[1]}`;
      }
    }
    
    return timeString;
  };

  // Check place type
  const isDeparture = place.place_type === 'departure' || 
    place.category === 'departure_point' ||
    (place.source === 'system' && place.category === 'departure_point');
    
  const isDestination = place.place_type === 'destination' || 
    place.category === 'destination_point' ||
    (place.source === 'system' && place.category === 'destination_point');
    
  const isAirport = place.place_type === 'system_airport' || 
    place.category === 'airport' ||
    (place.name?.toLowerCase().includes('airport') || place.place_name?.toLowerCase().includes('airport'));
    
  const isTripPlace = !isDeparture && !isDestination && !isAirport;

  // Calculate actual date for this place
  let actualDate = null;
  try {
    if (currentTrip && place.day_number) {
      actualDate = DateUtils.calculateTripDate(currentTrip, place.day_number);
    }
  } catch (error) {
    console.warn('Could not calculate trip date:', error);
  }

  // Format departure/arrival times with date context
  let departureDisplay = '';
  let arrivalDisplay = '';
  
  if (place.departure_time) {
    departureDisplay = formatTimeWithoutSeconds(place.departure_time);
    if (actualDate) {
      const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
      departureDisplay = `${dateStr} ${departureDisplay}`;
    }
  }
  if (place.arrival_time) {
    arrivalDisplay = formatTimeWithoutSeconds(place.arrival_time);
    if (actualDate) {
      const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
      arrivalDisplay = `${dateStr} ${arrivalDisplay}`;
    }
  }

  // Format schedule display for different place types
  let scheduleDisplay = '';
  if (place.stay_duration_minutes && place.arrival_time && place.departure_time) {
    const arrivalTime = formatTimeWithoutSeconds(place.arrival_time);
    const departureTime = formatTimeWithoutSeconds(place.departure_time);
    
    if (actualDate) {
      const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
      scheduleDisplay = `${dateStr} ${arrivalTime}-${departureTime}`;
    } else {
      scheduleDisplay = `${arrivalTime}-${departureTime}`;
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      <motion.div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      <div className="fixed inset-0 flex items-center justify-center p-2 pt-16 pb-16 sm:p-4 sm:pt-6 sm:pb-6">
        <Dialog.Panel
          as={motion.div}
          className="w-full max-w-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[85vh] sm:max-h-[90vh]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  {place.place_name || place.name}
                </Dialog.Title>
                {place.category && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                    {place.category}
                  </p>
                )}
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
              
              {/* Departure Place */}
              {isDeparture && (
                <div className="space-y-4">
                  {departureDisplay && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">🛫</span>
                            <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">Departure Time</p>
                          </div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{departureDisplay}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Destination Place */}
              {isDestination && (
                <div className="space-y-4">
                  {arrivalDisplay && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">🛬</span>
                            <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wide">Arrival Time</p>
                          </div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{arrivalDisplay}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Airport */}
              {isAirport && (
                <div className="space-y-4">
                  {scheduleDisplay && (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Schedule</p>
                        <p className="text-slate-600 dark:text-slate-400">{scheduleDisplay}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trip Place */}
              {isTripPlace && (
                <div className="space-y-4">
                  {/* Added by */}
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Added by</p>
                      <p className="text-slate-600 dark:text-slate-400">{userInfo || 'Unknown'}</p>
                    </div>
                  </div>

                  {/* Priority */}
                  {place.wish_level && (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
                        <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Priority</p>
                        <div className="flex items-center space-x-1">
                          <p className="text-slate-600 dark:text-slate-400">{place.wish_level}/5</p>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i}
                                className={`w-3 h-3 ${i < place.wish_level ? 'text-yellow-400 fill-current' : 'text-slate-300 dark:text-slate-600'}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Schedule */}
                  {scheduleDisplay && (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Schedule</p>
                        <p className="text-slate-600 dark:text-slate-400">{scheduleDisplay}</p>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {place.notes && (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-600 dark:text-slate-400 text-sm">💭</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Notes</p>
                        <p className="text-slate-600 dark:text-slate-400">{place.notes}</p>
                      </div>
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

export default MapPlaceModal;