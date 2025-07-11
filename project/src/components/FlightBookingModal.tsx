import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, Plane, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DateUtils } from '../utils/DateUtils';

interface FlightBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

const FlightBookingModal: React.FC<FlightBookingModalProps> = ({
  isOpen,
  onClose,
  routeData,
  dayData,
  timeSlot
}) => {
  const { currentTrip, tripMembers, addPlace } = useStore();
  const [selectedTab, setSelectedTab] = useState<'search' | 'already'>('search');
  const [alreadyBookedData, setAlreadyBookedData] = useState({
    bookingLink: '',
    flightNumber: '',
    departureTime: '09:00',
    arrivalTime: '11:00',
    price: '',
    passengers: tripMembers?.length || 1
  });

  // Calculate actual departure date
  const getDepartureDate = () => {
    if (dayData?.date) {
      return new Date(dayData.date);
    }
    if (currentTrip && dayData?.day) {
      try {
        return DateUtils.calculateTripDate(currentTrip, dayData.day);
      } catch (error) {
        console.warn('Could not calculate trip date:', error);
      }
    }
    return new Date();
  };

  const departureDate = getDepartureDate();
  const dateStr = departureDate.toISOString().split('T')[0];

  // Extract IATA codes for flight booking
  const extractIATACode = (placeName: string): string | null => {
    const match = placeName.match(/\(([A-Z]{3,4})\)/);
    return match ? match[1] : null;
  };

  const fromIATA = extractIATACode(routeData.from) || routeData.from;
  const toIATA = extractIATACode(routeData.to) || routeData.to;

  // Generate booking URLs (from MapRouteModal)
  const generateTripComUrl = (origin: string, destination: string) => {
    const tripComUrl = `https://trip.com/flights/booking?flightType=ow&dcity=${origin}&acity=${destination}&ddate=${dateStr.replace(/-/g, '')}&adult=${tripMembers?.length || 1}&child=0&infant=0`;
    const encodedUrl = encodeURIComponent(tripComUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=8626&u=${encodedUrl}&campaign_id=121`;
  };

  const generateWayAwayUrl = (origin: string, destination: string) => {
    const wayAwayUrl = `https://wayaway.io/search?origin_iata=${origin}&destination_iata=${destination}&depart_date=${dateStr}&adults=${tripMembers?.length || 1}&children=0&infants=0&currency=JPY&marker=649297`;
    const encodedUrl = encodeURIComponent(wayAwayUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=5976&u=${encodedUrl}&campaign_id=200`;
  };

  const generateAviasalesUrl = (origin: string, destination: string) => {
    const aviasalesUrl = `https://aviasales.com/search/${origin}${destination}?depart_date=${dateStr}`;
    const encodedUrl = encodeURIComponent(aviasalesUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=4114&u=${encodedUrl}&campaign_id=100`;
  };

  // Generate mock flight data (simplified without airline names)
  const generateMockFlights = (origin: string, destination: string) => {
    const basePrice = Math.floor(Math.random() * 80) + 180;
    
    return [
      {
        flightNumber: 'FL123',
        departure: '13:45',
        arrival: '16:20',
        duration: '2h 35m',
        price: basePrice,
        direct: true
      },
      {
        flightNumber: 'FL456',
        departure: '14:30',
        arrival: '17:05',
        duration: '2h 35m',
        price: basePrice + 20,
        direct: true
      },
      {
        flightNumber: 'FL789',
        departure: '18:50',
        arrival: '21:25',
        duration: '2h 35m',
        price: basePrice - 30,
        direct: true
      }
    ];
  };

  const handleBookFlight = (url: string) => {
    window.open(url, '_blank');
  };

  const handleAddAlreadyBooked = async () => {
    if (!currentTrip || !alreadyBookedData.departureTime) {
      alert('Please specify departure time');
      return;
    }

    const notesArray = [];
    if (alreadyBookedData.departureTime && alreadyBookedData.arrivalTime) {
      notesArray.push(`${alreadyBookedData.departureTime} - ${alreadyBookedData.arrivalTime}`);
    }
    if (alreadyBookedData.passengers) notesArray.push(`${alreadyBookedData.passengers} passengers`);
    if (alreadyBookedData.price) notesArray.push(`$${alreadyBookedData.price}`);
    if (alreadyBookedData.bookingLink) notesArray.push(`Booking: ${alreadyBookedData.bookingLink}`);

    try {
      await addPlace({
        id: crypto.randomUUID(),
        name: alreadyBookedData.flightNumber ? `Flight ${alreadyBookedData.flightNumber}` : 'Booked Flight',
        address: `${routeData.from} → ${routeData.to}`,
        latitude: routeData.fromLat || 35.6812,
        longitude: routeData.fromLng || 139.7671,
        notes: notesArray.join(' • '),
        category: 'transportation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trip_id: currentTrip.id,
        tripId: currentTrip.id,
        user_id: useStore.getState().user?.id || '',
        place_type: 'flight',
        wish_level: 5,
        stay_duration_minutes: 180,
        is_user_location: true,
        is_selected_for_optimization: true,
        normalized_wish_level: 0.5,
        rating: 4.0,
        booking_url: alreadyBookedData.bookingLink
      });

      onClose();
    } catch (error) {
      console.error('Failed to add flight:', error);
      alert('Failed to add flight to trip. Please try again.');
    }
  };

  const mockFlights = generateMockFlights(fromIATA, toIATA);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      {/* Backdrop */}
      <motion.div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          className="w-full max-w-4xl mx-2 sm:mx-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[95vh] sm:max-h-[90vh]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Flight Booking
                </Dialog.Title>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  {routeData.from} → {routeData.to}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>


          {/* Tabs */}
          <div className="flex border-b border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setSelectedTab('search')}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium transition-colors ${
                selectedTab === 'search'
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Search Flights
            </button>
            <button
              onClick={() => setSelectedTab('already')}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium transition-colors ${
                selectedTab === 'already'
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Already Booked
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-[70vh]">
            {selectedTab === 'search' ? (
              <div className="p-4 sm:p-6">
                {/* Mock Flights */}
                <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Available Flights</h3>
                  <div className="grid gap-3 sm:gap-4">
                    {mockFlights.map((flight, index) => (
                      <div key={index} className="bg-slate-50 dark:bg-slate-700/50 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                          <div className="flex-1">
                            <div className="mb-2">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                {flight.flightNumber}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                {flight.direct ? 'Direct' : '1 stop'} • {flight.duration}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm">
                              <span className="font-medium">{flight.departure}</span>
                              <span className="text-slate-500">→</span>
                              <span className="font-medium">{flight.arrival}</span>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                              ${flight.price}
                            </div>
                            <button
                              onClick={() => handleBookFlight(generateTripComUrl(fromIATA, toIATA))}
                              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
                            >
                              Book on Trip.com
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Platform Selection */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">Book on Other Platforms</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <button
                      onClick={() => handleBookFlight(generateWayAwayUrl(fromIATA, toIATA))}
                      className="flex items-center justify-center space-x-2 p-3 sm:p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <Plane className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium">WayAway</span>
                    </button>
                    <button
                      onClick={() => handleBookFlight(generateAviasalesUrl(fromIATA, toIATA))}
                      className="flex items-center justify-center space-x-2 p-3 sm:p-4 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium">Aviasales</span>
                    </button>
                    <button
                      onClick={() => handleBookFlight(generateTripComUrl(fromIATA, toIATA))}
                      className="flex items-center justify-center space-x-2 p-3 sm:p-4 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium">Trip.com</span>
                    </button>
                  </div>
                </div>
                <div className="pb-8 sm:pb-12"></div>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
                  Already Booked a Flight?
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {/* Booking Link Field */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Booking Link
                    </label>
                    <input
                      type="url"
                      value={alreadyBookedData.bookingLink}
                      onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, bookingLink: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      placeholder="e.g., https://trip.com/booking/flight/12345"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Flight Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={alreadyBookedData.flightNumber}
                      onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, flightNumber: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      placeholder="e.g., FL123"
                    />
                  </div>
                  {/* Flight Times - Required */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Departure Time *
                      </label>
                      <input
                        type="time"
                        value={alreadyBookedData.departureTime}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, departureTime: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Arrival Time (Optional)
                      </label>
                      <input
                        type="time"
                        value={alreadyBookedData.arrivalTime}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, arrivalTime: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                  
                  {/* Optional Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Price (USD) (Optional)
                      </label>
                      <input
                        type="number"
                        value={alreadyBookedData.price}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, price: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., 250"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Passengers (Optional)
                      </label>
                      <select
                        value={alreadyBookedData.passengers}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, passengers: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <option key={num} value={num}>{num} passenger{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAddAlreadyBooked}
                    disabled={!alreadyBookedData.departureTime}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    Add Flight to Trip
                  </button>
                </div>
                <div className="pb-8 sm:pb-12"></div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default FlightBookingModal;