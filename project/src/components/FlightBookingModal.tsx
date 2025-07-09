import React, { useState, useEffect } from 'react';
import { X, Search, MapPin, Clock, Plane, ExternalLink, Calendar, Users } from 'lucide-react';
import { useStore } from '../store/useStore';

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

interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  aircraft: string;
  stops: number;
}

const FlightBookingModal: React.FC<FlightBookingModalProps> = ({
  isOpen,
  onClose,
  routeData,
  dayData,
  timeSlot
}) => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'search' | 'book' | 'already'>('search');
  const [bookingDetails, setBookingDetails] = useState({
    flightNumber: '',
    airline: '',
    departure: '',
    arrival: '',
    passengers: 1,
    date: dayData?.date || ''
  });
  const { currentTrip, addPlace } = useStore();

  // Mock flight data
  const mockFlights: Flight[] = [
    {
      id: '1',
      airline: 'Japan Airlines',
      flightNumber: 'JL123',
      from: routeData.from,
      to: routeData.to,
      departure: '08:30',
      arrival: '11:45',
      duration: '3h 15m',
      price: 25000,
      aircraft: 'Boeing 787',
      stops: 0
    },
    {
      id: '2',
      airline: 'ANA',
      flightNumber: 'NH456',
      from: routeData.from,
      to: routeData.to,
      departure: '14:20',
      arrival: '17:50',
      duration: '3h 30m',
      price: 23000,
      aircraft: 'Airbus A320',
      stops: 0
    },
    {
      id: '3',
      airline: 'Skymark Airlines',
      flightNumber: 'BC789',
      from: routeData.from,
      to: routeData.to,
      departure: '19:10',
      arrival: '22:35',
      duration: '3h 25m',
      price: 18000,
      aircraft: 'Boeing 737',
      stops: 0
    }
  ];

  useEffect(() => {
    if (isOpen) {
      setFlights(mockFlights);
    }
  }, [isOpen, routeData]);

  const handleSearchFlights = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setFlights(mockFlights);
      setIsLoading(false);
    }, 1500);
  };

  const handleWayAwayBooking = (flight?: Flight) => {
    // Use WayAway affiliate link for flight booking
    const departureDate = dayData?.date || new Date().toISOString().split('T')[0];
    const passengers = bookingDetails.passengers || 1;
    
    // Build WayAway URL with pre-filled data
    const wayAwayUrl = `https://tp.media/r?marker=649297&trs=434567&p=2819&u=https%3A%2F%2Fwayaway.io%2Fflights`;
    const params = new URLSearchParams({
      'from': routeData.from,
      'to': routeData.to,
      'departure': departureDate,
      'passengers': passengers.toString(),
      'class': 'economy'
    });
    
    const fullUrl = `${wayAwayUrl}?${params.toString()}&campaign_id=121`;
    window.open(fullUrl, '_blank');
  };

  const handleAddFlight = async (flight: Flight) => {
    if (!currentTrip) return;

    try {
      // Add flight as a transport/connection place
      await addPlace({
        id: crypto.randomUUID(),
        name: `Flight ${flight.flightNumber} (${flight.airline})`,
        address: `${flight.from} → ${flight.to}`,
        latitude: routeData.fromLat || 35.6812,
        longitude: routeData.fromLng || 139.7671,
        notes: `${flight.departure} - ${flight.arrival} • ${flight.duration} • ¥${flight.price.toLocaleString()}`,
        category: 'transportation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trip_id: currentTrip.id,
        tripId: currentTrip.id,
        user_id: useStore.getState().user?.id || '',
        place_type: 'flight',
        wish_level: 5,
        stay_duration_minutes: 180, // 3 hours typical flight time
        is_user_location: true,
        is_selected_for_optimization: true,
        normalized_wish_level: 0.5,
        rating: 4.0
      });

      onClose();
    } catch (error) {
      console.error('Failed to add flight:', error);
    }
  };

  const handleAlreadyBooked = () => {
    if (!currentTrip || !bookingDetails.flightNumber) return;

    // Add the already booked flight to the trip
    handleAddFlight({
      id: crypto.randomUUID(),
      airline: bookingDetails.airline,
      flightNumber: bookingDetails.flightNumber,
      from: routeData.from,
      to: routeData.to,
      departure: bookingDetails.departure,
      arrival: bookingDetails.arrival,
      duration: '3h 30m',
      price: 20000,
      aircraft: 'Unknown',
      stops: 0
    });
  };

  const getAirlineIcon = (airline: string) => {
    // In a real app, these would be actual airline logos
    const icons: Record<string, string> = {
      'Japan Airlines': '🇯🇵',
      'ANA': '✈️',
      'Skymark Airlines': '🔷',
      'Default': '✈️'
    };
    return icons[airline] || icons['Default'];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-0 max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-500 to-cyan-500 p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-2xl font-bold text-white pr-8">
            Flight Booking
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {routeData.from} → {routeData.to} • {dayData?.date}
          </p>
        </div>

        {/* Option Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSelectedOption('search')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              selectedOption === 'search'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Search Flights
          </button>
          <button
            onClick={() => setSelectedOption('book')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              selectedOption === 'book'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Book on WayAway
          </button>
          <button
            onClick={() => setSelectedOption('already')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              selectedOption === 'already'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Already Booked
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[500px]">
          {selectedOption === 'search' && (
            <>
              {/* Search Controls */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Route
                    </label>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{routeData.from}</span>
                      <Plane className="w-4 h-4" />
                      <span className="font-medium">{routeData.to}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={dayData?.date || ''}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white text-sm"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Passengers
                    </label>
                    <select
                      value={bookingDetails.passengers}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, passengers: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleSearchFlights}
                  disabled={isLoading}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Searching...' : 'Search Flights'}
                </button>
              </div>

              {/* Flight List */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {flights.map((flight) => (
                  <div key={flight.id} className="p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-3">
                          <div className="text-2xl">{getAirlineIcon(flight.airline)}</div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {flight.airline} {flight.flightNumber}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {flight.aircraft} • {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Departure</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{flight.departure}</p>
                            <p className="text-gray-600 dark:text-gray-400">{flight.from}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 dark:text-gray-400">Duration</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{flight.duration}</p>
                            <div className="flex items-center justify-center mt-1">
                              <div className="h-px bg-gray-300 flex-1"></div>
                              <Plane className="w-4 h-4 text-gray-400 mx-2" />
                              <div className="h-px bg-gray-300 flex-1"></div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500 dark:text-gray-400">Arrival</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{flight.arrival}</p>
                            <p className="text-gray-600 dark:text-gray-400">{flight.to}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-6 text-right">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          ¥{flight.price.toLocaleString()}
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => handleAddFlight(flight)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            Add to Trip
                          </button>
                          <button
                            onClick={() => handleWayAwayBooking(flight)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Book
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {selectedOption === 'book' && (
            <div className="p-6 text-center">
              <div className="mb-6">
                <Plane className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Book on WayAway
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Search and book flights directly on WayAway with pre-filled route and dates.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{routeData.from}</span>
                  <Plane className="w-4 h-4" />
                  <span className="font-medium">{routeData.to}</span>
                  <span>•</span>
                  <span>{dayData?.date}</span>
                  <span>•</span>
                  <span>{bookingDetails.passengers} passenger{bookingDetails.passengers > 1 ? 's' : ''}</span>
                </div>
              </div>
              <button
                onClick={() => handleWayAwayBooking()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open WayAway
              </button>
            </div>
          )}

          {selectedOption === 'already' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Already Booked a Flight?
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Airline
                    </label>
                    <input
                      type="text"
                      value={bookingDetails.airline}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, airline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      placeholder="e.g., Japan Airlines"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Flight Number
                    </label>
                    <input
                      type="text"
                      value={bookingDetails.flightNumber}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, flightNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      placeholder="e.g., JL123"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Departure Time
                    </label>
                    <input
                      type="time"
                      value={bookingDetails.departure}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, departure: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Arrival Time
                    </label>
                    <input
                      type="time"
                      value={bookingDetails.arrival}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, arrival: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Passengers
                  </label>
                  <select
                    value={bookingDetails.passengers}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, passengers: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} passenger{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAlreadyBooked}
                  disabled={!bookingDetails.flightNumber || !bookingDetails.airline}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Flight to Trip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {routeData.from} to {routeData.to} flights
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightBookingModal;