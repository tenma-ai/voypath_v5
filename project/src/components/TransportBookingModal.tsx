import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, MapPin, ExternalLink, Trash2, Edit, Car, Clock, Route, Search, Plane } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DateUtils } from '../utils/DateUtils';
import { BookingService } from '../services/BookingService';
import { UberService } from '../services/UberService';
import { CountryUtils } from '../utils/CountryUtils';
import FlightBookingModal from './FlightBookingModal';
import type { TransportBooking } from '../types/booking';

interface TransportBookingModalProps {
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
  transportMode: 'walking' | 'car' | 'flight';
  preCalculatedInfo?: {
    travelTime: number;
    transportMode: string;
  };
}

const TransportBookingModal: React.FC<TransportBookingModalProps> = ({
  isOpen,
  onClose,
  routeData,
  dayData,
  timeSlot,
  transportMode,
  preCalculatedInfo
}) => {
  const { currentTrip, tripMembers, user } = useStore();
  
  // For flight mode, use the dedicated FlightBookingModal
  if (transportMode === 'flight') {
    return (
      <FlightBookingModal
        isOpen={isOpen}
        onClose={onClose}
        routeData={routeData}
        dayData={dayData}
        timeSlot={timeSlot}
      />
    );
  }
  const [selectedTab, setSelectedTab] = useState<'search' | 'add' | 'saved'>('search');
  const [walkingInfo, setWalkingInfo] = useState<{
    distance: string;
    duration: string;
    loaded: boolean;
  }>({ distance: '', duration: '', loaded: false });
  const [uberRides, setUberRides] = useState<any[]>([]);
  const [uberLoading, setUberLoading] = useState(false);
  const [bookingData, setBookingData] = useState({
    bookingLink: '',
    routeInfo: '',
    departureTime: '09:00',
    arrivalTime: '11:00',
    price: '',
    notes: '',
    passengers: tripMembers?.length || 1,
    // Additional transit fields
    lineName: '',
    departureStation: '',
    arrivalStation: '',
    platform: '',
    direction: '',
    lineNumber: ''
  });
  const [savedBookings, setSavedBookings] = useState<TransportBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TransportBooking | null>(null);

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
    type: transportMode as const
  };

  // Load walking distance and time
  useEffect(() => {
    if (isOpen && transportMode === 'walking') {
      loadWalkingInfo();
    }
  }, [isOpen, transportMode, preCalculatedInfo]);

  const loadWalkingInfo = async () => {
    // Use pre-calculated info if available
    if (preCalculatedInfo && preCalculatedInfo.travelTime > 0) {
      const travelTimeMinutes = preCalculatedInfo.travelTime;
      
      // Format time similar to Google Maps format
      let formattedDuration = '';
      if (travelTimeMinutes < 60) {
        formattedDuration = `${travelTimeMinutes} min`;
      } else {
        const hours = Math.floor(travelTimeMinutes / 60);
        const mins = travelTimeMinutes % 60;
        formattedDuration = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
      }
      
      // Estimate distance based on average walking speed (5 km/h)
      const estimatedDistanceKm = (travelTimeMinutes / 60) * 5;
      const formattedDistance = estimatedDistanceKm < 1 
        ? `${Math.round(estimatedDistanceKm * 1000)} m`
        : `${estimatedDistanceKm.toFixed(1)} km`;
      
      setWalkingInfo({
        distance: formattedDistance,
        duration: formattedDuration,
        loaded: true
      });
      return;
    }
    
    // Fallback to Google Maps API if no pre-calculated info and coordinates are available
    if (routeData.fromLat && routeData.fromLng && routeData.toLat && routeData.toLng) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/directions/json?` +
          `origin=${routeData.fromLat},${routeData.fromLng}&` +
          `destination=${routeData.toLat},${routeData.toLng}&` +
          `mode=walking&` +
          `key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
        );
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          
          setWalkingInfo({
            distance: leg.distance.text,
            duration: leg.duration.text,
            loaded: true
          });
        }
      } catch (error) {
        console.error('Failed to load walking info:', error);
        setWalkingInfo({
          distance: 'Unknown',
          duration: 'Unknown',
          loaded: true
        });
      }
    } else {
      // No coordinates and no pre-calculated info
      setWalkingInfo({
        distance: 'Unknown',
        duration: 'Unknown',
        loaded: true
      });
    }
  };

  // Load Uber rides for walking mode
  const loadUberRides = async () => {
    if (!routeData.fromLat || !routeData.fromLng || !routeData.toLat || !routeData.toLng) {
      console.error('Missing coordinates for Uber search');
      return;
    }

    setUberLoading(true);
    try {
      const rides = await UberService.searchRides({
        pickup_latitude: routeData.fromLat,
        pickup_longitude: routeData.fromLng,
        destination_latitude: routeData.toLat,
        destination_longitude: routeData.toLng
      });
      setUberRides(rides);
    } catch (error) {
      console.error('Failed to load Uber rides:', error);
      setUberRides([]);
    } finally {
      setUberLoading(false);
    }
  };

  // Generate external URLs for car mode
  const generateTransitUrl = async () => {
    const naviTimeUrl = await CountryUtils.generateNavitimeUrl(routeData.fromLat, routeData.fromLng);
    return naviTimeUrl;
  };

  const generateGoogleMapsUrl = () => {
    const origin = encodeURIComponent(routeData.from);
    const destination = encodeURIComponent(routeData.to);
    return `https://www.google.com/maps/dir/${origin}/${destination}`;
  };

  // Load saved bookings
  const lastLoadedContext = useRef<string | null>(null);
  
  useEffect(() => {
    if (isOpen && currentTrip?.id) {
      const contextKey = `${currentTrip.id}-${modalContext.route}-${modalContext.date}-${transportMode}`;
      
      if (lastLoadedContext.current !== contextKey) {
        loadSavedBookings();
        lastLoadedContext.current = contextKey;
      }
    }
  }, [isOpen, currentTrip?.id, modalContext.route, modalContext.date, transportMode]);

  const loadSavedBookings = async () => {
    if (!currentTrip?.id) return;
    
    setLoading(true);
    try {
      const allBookings = await BookingService.getBookingsByType(currentTrip.id, transportMode);
      
      const contextBookings = allBookings.filter(booking => 
        booking.route === modalContext.route && 
        booking.departure_date === modalContext.date
      );
      
      setSavedBookings(contextBookings as TransportBooking[]);
    } catch (error) {
      console.error('Failed to load saved bookings:', error);
      setSavedBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Uber booking
  const handleBookUber = async (ride: any) => {
    try {
      const bookingUrl = await UberService.createBooking({
        product_id: ride.product_id,
        pickup_latitude: routeData.fromLat!,
        pickup_longitude: routeData.fromLng!,
        destination_latitude: routeData.toLat!,
        destination_longitude: routeData.toLng!
      });
      
      if (bookingUrl) {
        window.open(bookingUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to book Uber:', error);
      alert('Failed to book Uber ride. Please try again.');
    }
  };

  // Handle saving booking
  const handleSaveBooking = async () => {
    if (!currentTrip?.id || !user?.id) {
      alert('Please login to save booking information');
      return;
    }

    if (!bookingData.departureTime) {
      alert('Please specify departure time');
      return;
    }

    setLoading(true);
    try {
      const bookingToSave: Omit<TransportBooking, 'id' | 'created_at' | 'updated_at'> = {
        trip_id: currentTrip.id,
        user_id: user.id,
        booking_type: transportMode,
        route: modalContext.route,
        departure_date: modalContext.date,
        departure_time: bookingData.departureTime,
        arrival_time: bookingData.arrivalTime,
        price: bookingData.price ? parseFloat(bookingData.price) : null,
        booking_link: bookingData.bookingLink || null,
        notes: bookingData.notes || null,
        passengers: bookingData.passengers,
        transport_info: {
          route_details: bookingData.routeInfo,
          walking_distance: walkingInfo.distance,
          walking_duration: walkingInfo.duration,
          line_number: bookingData.lineNumber || bookingData.lineName,
          platform: bookingData.platform,
          direction: bookingData.direction,
          departure_station: bookingData.departureStation,
          arrival_station: bookingData.arrivalStation
        }
      };

      if (editingBooking) {
        await BookingService.updateBooking(editingBooking.id, bookingToSave);
        setEditingBooking(null);
      } else {
        await BookingService.saveTransportBooking(bookingToSave);
      }

      await loadSavedBookings();
      setSelectedTab('saved');
      
      // Reset form
      setBookingData({
        bookingLink: '',
        routeInfo: '',
        departureTime: '09:00',
        arrivalTime: '11:00',
        price: '',
        notes: '',
        passengers: tripMembers?.length || 1,
        lineName: '',
        departureStation: '',
        arrivalStation: '',
        platform: '',
        direction: '',
        lineNumber: ''
      });
      
      alert(editingBooking ? 'Booking updated successfully!' : 'Booking saved successfully!');
    } catch (error) {
      console.error('Failed to save booking:', error);
      alert('Failed to save booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting booking
  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    setLoading(true);
    try {
      await BookingService.deleteBooking(bookingId);
      await loadSavedBookings();
      alert('Booking deleted successfully!');
    } catch (error) {
      console.error('Failed to delete booking:', error);
      alert('Failed to delete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle editing booking
  const handleEditBooking = (booking: TransportBooking) => {
    setEditingBooking(booking);
    setBookingData({
      bookingLink: booking.booking_link || '',
      routeInfo: booking.transport_info?.route_details || '',
      departureTime: booking.departure_time,
      arrivalTime: booking.arrival_time,
      price: booking.price?.toString() || '',
      notes: booking.notes || '',
      passengers: booking.passengers,
      lineName: booking.transport_info?.line_number || '',
      departureStation: booking.transport_info?.departure_station || '',
      arrivalStation: booking.transport_info?.arrival_station || '',
      platform: booking.transport_info?.platform || '',
      direction: booking.transport_info?.direction || '',
      lineNumber: booking.transport_info?.line_number || ''
    });
    setSelectedTab('add');
  };

  // Modal configuration based on transport mode
  const modalTitle = transportMode === 'walking' ? 'Walking & Taxi Options' : 'Transportation Options';
  const IconComponent = transportMode === 'walking' ? MapPin : Car;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <IconComponent className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{modalTitle}</h2>
                <p className="text-gray-600">{modalContext.route}</p>
                <p className="text-sm text-gray-500">{departureDate.toLocaleDateString()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setSelectedTab('search')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                selectedTab === 'search'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {transportMode === 'walking' ? 'Walking & Taxi' : 'Search Routes'}
            </button>
            <button
              onClick={() => setSelectedTab('add')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                selectedTab === 'add'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Add Booking
            </button>
            <button
              onClick={() => setSelectedTab('saved')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                selectedTab === 'saved'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Saved Bookings ({savedBookings.length})
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {/* Search Tab */}
            {selectedTab === 'search' && (
              <div className="space-y-6">
                {transportMode === 'walking' ? (
                  <>
                    {/* Walking Information */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-800 mb-2 flex items-center">
                        <MapPin className="w-5 h-5 mr-2" />
                        Walking Route
                      </h3>
                      {walkingInfo.loaded ? (
                        <div className="space-y-2">
                          <p className="text-green-700">
                            <span className="font-medium">Distance:</span> {walkingInfo.distance}
                          </p>
                          <p className="text-green-700">
                            <span className="font-medium">Duration:</span> {walkingInfo.duration}
                          </p>
                          <div className="flex space-x-3 mt-4">
                            <button
                              onClick={() => window.open(generateGoogleMapsUrl(), '_blank')}
                              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Search className="w-4 h-4 mr-2" />
                              Search Routes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-green-600">Loading walking information...</p>
                      )}
                    </div>

                    {/* Taxi Options */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-800 mb-4 flex items-center">
                        <Car className="w-5 h-5 mr-2" />
                        Use Taxi Instead?
                      </h3>
                      
                      <button
                        onClick={loadUberRides}
                        disabled={uberLoading}
                        className="w-full mb-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {uberLoading ? 'Searching...' : 'Search Uber Rides'}
                      </button>

                      {uberRides.length > 0 && (
                        <div className="space-y-3">
                          {uberRides.map((ride, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-medium">{ride.display_name}</h4>
                                  <p className="text-sm text-gray-600">{ride.duration} • {ride.distance}</p>
                                  <p className="text-lg font-bold text-green-600">{ride.price_estimate}</p>
                                </div>
                                <button
                                  onClick={() => handleBookUber(ride)}
                                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                  Book Now
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Car Transportation Options */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-gray-200 rounded-lg p-4 bg-white">
                        <h3 className="font-semibold mb-2 flex items-center">
                          <Car className="w-5 h-5 mr-2" />
                          Taxi Services
                        </h3>
                        <p className="text-gray-600 mb-4">Search for taxi and ride-sharing options</p>
                        <button
                          onClick={loadUberRides}
                          disabled={uberLoading}
                          className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                          {uberLoading ? 'Searching...' : 'Search Taxis'}
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-lg p-4 bg-white">
                        <h3 className="font-semibold mb-2 flex items-center">
                          <img src="/icons8-train-50 (1).png" alt="Train" className="w-5 h-5 mr-2" />
                          Public Transportation
                        </h3>
                        <p className="text-gray-600 mb-4">Find trains, buses, and other public transport</p>
                        <button
                          onClick={async () => {
                            const url = await generateTransitUrl();
                            window.open(url, '_blank');
                          }}
                          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Search Routes
                        </button>
                      </div>
                    </div>

                    {/* Taxi Results */}
                    {uberRides.length > 0 && (
                      <div className="mt-6">
                        <h3 className="font-semibold mb-4">Available Rides</h3>
                        <div className="space-y-3">
                          {uberRides.map((ride, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-medium">{ride.display_name}</h4>
                                  <p className="text-sm text-gray-600">{ride.duration} • {ride.distance}</p>
                                  <p className="text-lg font-bold text-green-600">{ride.price_estimate}</p>
                                </div>
                                <button
                                  onClick={() => handleBookUber(ride)}
                                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                  Book Now
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Add Booking Tab */}
            {selectedTab === 'add' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  {editingBooking ? 'Edit Booking' : 'Add Manual Booking'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Booking Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={bookingData.bookingLink}
                      onChange={(e) => setBookingData({ ...bookingData, bookingLink: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Information
                    </label>
                    <input
                      type="text"
                      value={bookingData.routeInfo}
                      onChange={(e) => setBookingData({ ...bookingData, routeInfo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={transportMode === 'walking' ? 'Walking path details' : 'Route name, line number, etc.'}
                    />
                  </div>

                  {/* Additional fields for public transportation */}
                  {transportMode === 'car' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Line Name / Route Number
                        </label>
                        <input
                          type="text"
                          value={bookingData.lineName}
                          onChange={(e) => setBookingData({ ...bookingData, lineName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="JR Yamanote Line, Bus Route 123, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Departure Station
                        </label>
                        <input
                          type="text"
                          value={bookingData.departureStation}
                          onChange={(e) => setBookingData({ ...bookingData, departureStation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Shibuya Station, Bus Stop A, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Arrival Station
                        </label>
                        <input
                          type="text"
                          value={bookingData.arrivalStation}
                          onChange={(e) => setBookingData({ ...bookingData, arrivalStation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Shinjuku Station, Bus Stop B, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Platform / Gate
                        </label>
                        <input
                          type="text"
                          value={bookingData.platform}
                          onChange={(e) => setBookingData({ ...bookingData, platform: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Platform 3, Gate A, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Direction / Bound For
                        </label>
                        <input
                          type="text"
                          value={bookingData.direction}
                          onChange={(e) => setBookingData({ ...bookingData, direction: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Bound for Shinjuku, Clockwise, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Line Number (Alternative)
                        </label>
                        <input
                          type="text"
                          value={bookingData.lineNumber}
                          onChange={(e) => setBookingData({ ...bookingData, lineNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Train/Bus number, etc."
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departure Time *
                    </label>
                    <input
                      type="time"
                      value={bookingData.departureTime}
                      onChange={(e) => setBookingData({ ...bookingData, departureTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Arrival Time
                    </label>
                    <input
                      type="time"
                      value={bookingData.arrivalTime}
                      onChange={(e) => setBookingData({ ...bookingData, arrivalTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={bookingData.price}
                      onChange={(e) => setBookingData({ ...bookingData, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passengers
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={bookingData.passengers}
                      onChange={(e) => setBookingData({ ...bookingData, passengers: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional information about the booking..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleSaveBooking}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingBooking ? 'Update Booking' : 'Save Booking'}
                  </button>
                  
                  {editingBooking && (
                    <button
                      onClick={() => {
                        setEditingBooking(null);
                        setBookingData({
                          bookingLink: '',
                          routeInfo: '',
                          departureTime: '09:00',
                          arrivalTime: '11:00',
                          price: '',
                          notes: '',
                          passengers: tripMembers?.length || 1,
                          lineName: '',
                          departureStation: '',
                          arrivalStation: '',
                          platform: '',
                          direction: '',
                          lineNumber: ''
                        });
                      }}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Saved Bookings Tab */}
            {selectedTab === 'saved' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Saved Bookings</h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading saved bookings...</p>
                  </div>
                ) : savedBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <IconComponent className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No saved bookings for this route and date.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedBookings.map((booking) => (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <IconComponent className="w-4 h-4 text-gray-600" />
                              <span className="font-medium">{booking.transport_info?.route_details || 'Transport Booking'}</span>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>
                                <Clock className="w-4 h-4 inline mr-1" />
                                {booking.departure_time} - {booking.arrival_time}
                              </p>
                              {booking.price && (
                                <p className="text-green-600 font-medium">
                                  Price: ¥{booking.price}
                                </p>
                              )}
                              {booking.passengers > 1 && (
                                <p>Passengers: {booking.passengers}</p>
                              )}
                              {booking.notes && (
                                <p className="text-gray-500 italic">{booking.notes}</p>
                              )}
                              {transportMode === 'walking' && booking.transport_info?.walking_distance && (
                                <p>Walking: {booking.transport_info.walking_distance} ({booking.transport_info.walking_duration})</p>
                              )}
                              {transportMode === 'car' && (
                                <div className="text-sm text-gray-600 space-y-1">
                                  {booking.transport_info?.line_number && (
                                    <p><span className="font-medium">Line:</span> {booking.transport_info.line_number}</p>
                                  )}
                                  {booking.transport_info?.departure_station && (
                                    <p><span className="font-medium">From:</span> {booking.transport_info.departure_station}</p>
                                  )}
                                  {booking.transport_info?.arrival_station && (
                                    <p><span className="font-medium">To:</span> {booking.transport_info.arrival_station}</p>
                                  )}
                                  {booking.transport_info?.platform && (
                                    <p><span className="font-medium">Platform:</span> {booking.transport_info.platform}</p>
                                  )}
                                  {booking.transport_info?.direction && (
                                    <p><span className="font-medium">Direction:</span> {booking.transport_info.direction}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 ml-4">
                            {booking.booking_link && (
                              <button
                                onClick={() => window.open(booking.booking_link!, '_blank')}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Open booking link"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditBooking(booking)}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Edit booking"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default TransportBookingModal;