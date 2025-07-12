import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, Plane, ExternalLink, Trash2, Edit } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DateUtils } from '../utils/DateUtils';
import { BookingService } from '../services/BookingService';
import type { FlightBooking } from '../types/booking';

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
  const { currentTrip, tripMembers, user } = useStore();
  const [selectedTab, setSelectedTab] = useState<'search' | 'already' | 'saved'>('search');
  const [alreadyBookedData, setAlreadyBookedData] = useState({
    bookingLink: '',
    flightNumber: '',
    departureTime: '09:00',
    arrivalTime: '11:00',
    price: '',
    passengers: tripMembers?.length || 1
  });
  const [savedBookings, setSavedBookings] = useState<FlightBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState<FlightBooking | null>(null);
  

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

  // Modal context for filtering bookings
  const modalContext = {
    route: `${routeData.from} → ${routeData.to}`,
    date: dayData?.date || dateStr,
    type: 'flight' as const
  };

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

  // OPTIMIZED: Load saved bookings with caching to prevent repeated DB calls
  const lastLoadedContext = useRef<string | null>(null);
  
  useEffect(() => {
    if (isOpen && currentTrip?.id) {
      // Create cache key from context to avoid unnecessary reloads
      const contextKey = `${currentTrip.id}-${modalContext.route}-${modalContext.date}`;
      
      // Only reload if context has actually changed
      if (lastLoadedContext.current !== contextKey) {
        loadSavedBookings();
        lastLoadedContext.current = contextKey;
      }
    }
  }, [isOpen, currentTrip?.id, modalContext.route, modalContext.date]);

  const loadSavedBookings = async () => {
    if (!currentTrip?.id) return;
    
    setLoading(true);
    try {
      // OPTIMIZED: Add timeout and reduced retry to prevent connection issues
      const startTime = Date.now();
      const allBookings = await BookingService.getBookingsByType(currentTrip.id, 'flight');
      const loadTime = Date.now() - startTime;
      
      // Log slow operations that might be causing timeouts
      if (loadTime > 2000) {
        console.warn(`⚠️ Slow booking load: ${loadTime}ms`);
      }
      
      // Filter bookings by route and date context
      const contextBookings = allBookings.filter(booking => 
        booking.route === modalContext.route && 
        booking.departure_date === modalContext.date
      );
      
      setSavedBookings(contextBookings as FlightBooking[]);
      console.log(`✅ Loaded ${contextBookings.length} contextual bookings in ${loadTime}ms`);
    } catch (error) {
      console.error('Failed to load saved bookings:', error);
      setSavedBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBooking = async () => {
    console.log('🔍 Save booking debug:', { 
      currentTripId: currentTrip?.id, 
      userId: user?.id, 
      currentTrip: !!currentTrip, 
      user: !!user 
    });
    
    if (!currentTrip?.id || !user?.id) {
      console.error('❌ Missing required data:', { currentTrip: currentTrip?.id, user: user?.id });
      alert('Please login to save booking information');
      return;
    }

    if (!alreadyBookedData.departureTime) {
      alert('Please specify departure time');
      return;
    }

    setLoading(true);
    try {
      const flightData = {
        booking_link: alreadyBookedData.bookingLink || undefined,
        flight_number: alreadyBookedData.flightNumber || undefined,
        departure_time: alreadyBookedData.departureTime,
        arrival_time: alreadyBookedData.arrivalTime || undefined,
        price: alreadyBookedData.price || undefined,
        passengers: alreadyBookedData.passengers,
        route: modalContext.route,
        departure_date: modalContext.date,
        notes: `Flight booking for ${routeData.from} to ${routeData.to}`
      };

      if (editingBooking) {
        await BookingService.updateBooking(editingBooking.id!, {
          ...editingBooking,
          ...flightData
        });
        setEditingBooking(null);
      } else {
        await BookingService.saveFlightBooking(currentTrip.id, user.id, flightData);
      }

      // Reload bookings
      await loadSavedBookings();
      
      // Reset form
      setAlreadyBookedData({
        bookingLink: '',
        flightNumber: '',
        departureTime: '09:00',
        arrivalTime: '11:00',
        price: '',
        passengers: tripMembers?.length || 1
      });

      // Switch to saved tab to show the saved booking
      setSelectedTab('saved');
    } catch (error) {
      console.error('Failed to save booking:', error);
      alert('Failed to save booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBooking = (booking: FlightBooking) => {
    setEditingBooking(booking);
    setAlreadyBookedData({
      bookingLink: booking.booking_link || '',
      flightNumber: booking.flight_number || '',
      departureTime: booking.departure_time || '09:00',
      arrivalTime: booking.arrival_time || '11:00',
      price: booking.price || '',
      passengers: booking.passengers || tripMembers?.length || 1
    });
    setSelectedTab('already');
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    setLoading(true);
    try {
      await BookingService.deleteBooking(bookingId);
      await loadSavedBookings();
    } catch (error) {
      console.error('Failed to delete booking:', error);
      alert('Failed to delete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Removed handleAddToTrip function - bookings should remain separate from places

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
              {editingBooking ? 'Edit Booking' : 'Add Booking'}
            </button>
            <button
              onClick={() => setSelectedTab('saved')}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium transition-colors ${
                selectedTab === 'saved'
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Saved ({savedBookings.length})
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
            ) : selectedTab === 'already' ? (
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
                  {editingBooking ? 'Edit Flight Booking' : 'Add Flight Booking'}
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {/* Booking Link Field */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Booking Link
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        value={alreadyBookedData.bookingLink}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, bookingLink: e.target.value })}
                        className="flex-1 px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., https://trip.com/booking/flight/12345"
                      />
                      <button
                        onClick={() => alreadyBookedData.bookingLink && window.open(alreadyBookedData.bookingLink, '_blank')}
                        disabled={!alreadyBookedData.bookingLink}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Booking
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Flight Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={alreadyBookedData.flightNumber}
                      onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, flightNumber: e.target.value })}
                      className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <option key={num} value={num}>{num} passenger{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleSaveBooking}
                      disabled={!alreadyBookedData.departureTime || loading}
                      className="flex-1 px-4 py-4 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {loading ? 'Saving...' : editingBooking ? 'Update Booking' : 'Save Booking'}
                    </button>
                    {editingBooking && (
                      <button
                        onClick={() => {
                          setEditingBooking(null);
                          setAlreadyBookedData({
                            bookingLink: '',
                            flightNumber: '',
                            departureTime: '09:00',
                            arrivalTime: '11:00',
                            price: '',
                            passengers: tripMembers?.length || 1
                          });
                        }}
                        className="w-full sm:w-auto px-4 py-4 sm:py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                <div className="pb-8 sm:pb-12"></div>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
                  Saved Flight Bookings
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : savedBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">No saved flight bookings yet.</p>
                    <button
                      onClick={() => setSelectedTab('already')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Add Your First Booking
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {savedBookings.map((booking) => (
                      <div key={booking.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="mb-2">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                {booking.flight_number ? `Flight ${booking.flight_number}` : 'Flight Booking'}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                {booking.route} • {booking.departure_date}
                              </p>
                            </div>
                            <div className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                              {booking.departure_time && (
                                <div>Departure: {booking.departure_time}</div>
                              )}
                              {booking.arrival_time && (
                                <div>Arrival: {booking.arrival_time}</div>
                              )}
                              {booking.passengers && (
                                <div>Passengers: {booking.passengers}</div>
                              )}
                              {booking.price && (
                                <div>Price: ${booking.price}</div>
                              )}
                              {booking.booking_link && (
                                <div className="flex items-center gap-1">
                                  <span>Booking:</span>
                                  <a 
                                    href={booking.booking_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                  >
                                    Link <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            {/* Removed "Add to Trip" button - bookings should stay as bookings, not places */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditBooking(booking)}
                                className="flex-1 sm:flex-none px-4 py-3 sm:px-3 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Edit className="w-4 h-4 sm:w-3 sm:h-3" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(booking.id!)}
                                className="flex-1 sm:flex-none px-4 py-3 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Trash2 className="w-4 h-4 sm:w-3 sm:h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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