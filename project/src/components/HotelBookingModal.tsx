import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Bed, Star, Trash2, Edit, Plus, MapPin, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DateUtils } from '../utils/DateUtils';
import { BookingService } from '../services/BookingService';
import { supabase } from '../lib/supabase';
import type { HotelBooking } from '../types/booking';

interface HotelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: any;
  timeSlot: string;
  nearbyLocation?: {
    lat: number;
    lng: number;
    name: string;
  };
}

const HotelBookingModal: React.FC<HotelBookingModalProps> = ({
  isOpen,
  onClose,
  dayData,
  timeSlot,
  nearbyLocation
}) => {
  const { currentTrip, tripMembers, user } = useStore();

  // Extract city name from location string
  const extractCityName = (locationName: string): string => {
    if (!locationName) return 'Tokyo';
    
    // Remove common suffixes like "(Departure)", "(Destination)", etc.
    let cityName = locationName.replace(/\s*\([^)]*\)\s*/g, '');
    
    // Split by comma and take the first part (usually the city)
    const parts = cityName.split(',').map(part => part.trim());
    return parts[0] || locationName;
  };
  // Extract default times from timeSlot or use default values
  const getDefaultTimes = () => {
    if (timeSlot && timeSlot.includes('-')) {
      const [startTime, endTime] = timeSlot.split('-');
      return { checkInTime: startTime.trim(), checkOutTime: endTime.trim() };
    }
    return { checkInTime: '15:00', checkOutTime: '11:00' };
  };
  
  const defaultTimes = getDefaultTimes();
  
  // Calculate actual check-in date
  const getCheckInDate = () => {
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

  const checkInDate = getCheckInDate();
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + 1);

  const checkInDateStr = checkInDate.toISOString().split('T')[0];
  const checkOutDateStr = checkOutDate.toISOString().split('T')[0];
  
  const [selectedTab, setSelectedTab] = useState<'search' | 'already' | 'saved'>('search');
  const [alreadyBookedData, setAlreadyBookedData] = useState({
    bookingLink: '',
    hotelName: '',
    address: '',
    checkIn: dayData?.date || checkInDateStr,
    checkOut: checkOutDateStr,
    checkInTime: defaultTimes.checkInTime,
    checkOutTime: defaultTimes.checkOutTime,
    guests: tripMembers?.length || 1,
    pricePerNight: '',
    rating: 4,
    // Google Maps location data (optional)
    latitude: null as number | null,
    longitude: null as number | null,
    google_place_id: null as string | null
  });
  
  // Google Places search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);

  // Google Places search function
  const searchHotels = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // Check if Google Maps API is loaded
      if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.warn('Google Maps API not loaded, search functionality disabled');
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      // Use Google Places API for hotel search
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const request = {
        query: `${query} hotel`,
        location: nearbyLocation ? new google.maps.LatLng(nearbyLocation.lat, nearbyLocation.lng) : undefined,
        radius: 10000, // 10km radius
        type: 'lodging' as google.maps.places.PlaceType
      };

      service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const hotelResults = results.slice(0, 5).map(place => ({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            geometry: place.geometry,
            rating: place.rating,
            price_level: place.price_level,
            photos: place.photos
          }));
          setSearchResults(hotelResults);
        } else {
          console.log('No hotel results found:', status);
          setSearchResults([]);
        }
        setSearchLoading(false);
      });
    } catch (error) {
      console.error('Google Places search error:', error);
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  // Handle place selection
  const handlePlaceSelect = (place: any) => {
    setSelectedPlace(place);
    setAlreadyBookedData(prev => ({
      ...prev,
      hotelName: place.name || '',
      address: place.formatted_address || '',
      latitude: place.geometry?.location?.lat() || null,
      longitude: place.geometry?.location?.lng() || null,
      google_place_id: place.place_id || null,
      rating: Math.round(Number(place.rating) || 4) // Ensure integer rating
    }));
    setSearchQuery('');
    setSearchResults([]);
  };

  // Clear place selection
  const clearPlaceSelection = () => {
    setSelectedPlace(null);
    setAlreadyBookedData(prev => ({
      ...prev,
      hotelName: '',
      address: '',
      latitude: null,
      longitude: null,
      google_place_id: null,
      rating: 4
    }));
  };
  const [savedBookings, setSavedBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState<HotelBooking | null>(null);

  // Modal context for filtering bookings
  const modalContext = {
    location: extractCityName(nearbyLocation?.name || 'Unknown'),
    checkInDate: dayData?.date || checkInDateStr,
    type: 'hotel' as const
  };

  // Generate correct Trip.com hotel URL based on provided format
  const generateTripComHotelUrl = (city: string, checkIn: string, checkOut: string, guests: number) => {
    // Format dates for Trip.com (YYYY/MM/DD)
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, '%2F');
    
    const tripComUrl = `https://www.trip.com/hotels/list?city=${encodeURIComponent(city)}&cityName=${encodeURIComponent(city)}&checkin=${formatDate(checkIn)}&checkout=${formatDate(checkOut)}&searchType=CT&searchWord=${encodeURIComponent(city)}&crn=1&adult=${guests}&children=0&searchBoxArg=t&travelPurpose=0&ctm_ref=ix_sb_dl&domestic=true&locale=en-US&curr=JPY`;
    
    const encodedUrl = encodeURIComponent(tripComUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=8626&u=${encodedUrl}&campaign_id=121`;
  };

  // Generate mock hotel data
  const generateMockHotels = () => {
    const basePrice = Math.floor(Math.random() * 100) + 80;
    const location = extractCityName(nearbyLocation?.name || 'Tokyo');
    
    return [
      {
        id: '1',
        name: `Grand ${location} Hotel`,
        address: `123 Business District, ${location}`,
        rating: 4.5,
        pricePerNight: basePrice,
        amenities: ['WiFi', 'Parking', 'Breakfast', 'Gym'],
        image: '🏨'
      },
      {
        id: '2',
        name: `${location} Inn`,
        address: `456 Traditional Ave, ${location}`,
        rating: 4.2,
        pricePerNight: basePrice - 20,
        amenities: ['WiFi', 'Traditional Bath', 'Restaurant'],
        image: '🏨'
      },
      {
        id: '3',
        name: `Modern ${location} Lodge`,
        address: `789 Urban St, ${location}`,
        rating: 4.8,
        pricePerNight: basePrice + 30,
        amenities: ['WiFi', 'Fitness Center', 'Business Center', 'Pool'],
        image: '🏨'
      }
    ];
  };

  const handleBookHotel = (url: string) => {
    window.open(url, '_blank');
  };

  // OPTIMIZED: Load saved bookings with caching to prevent repeated DB calls
  const lastLoadedContext = useRef<string | null>(null);
  
  useEffect(() => {
    if (isOpen && currentTrip?.id) {
      // Create cache key from context to avoid unnecessary reloads
      const contextKey = `${currentTrip.id}-${modalContext.location}-${modalContext.checkInDate}`;
      
      // Only reload if context has actually changed
      if (lastLoadedContext.current !== contextKey) {
        loadSavedBookings();
        lastLoadedContext.current = contextKey;
      }
    }
  }, [isOpen, currentTrip?.id, modalContext.location, modalContext.checkInDate]);

  const loadSavedBookings = async () => {
    if (!currentTrip?.id) return;
    
    setLoading(true);
    try {
      // OPTIMIZED: Add timeout monitoring to prevent connection issues
      const startTime = Date.now();
      
      console.log('🔍 Loading hotel bookings with modal context:', {
        modalContext,
        nearbyLocation: nearbyLocation?.name,
        dayData: dayData?.date,
        checkInDateStr
      });
      
      const allBookings = await BookingService.getBookingsByType(currentTrip.id, 'hotel');
      const loadTime = Date.now() - startTime;
      
      console.log('📋 All hotel bookings loaded:', allBookings.map(b => ({
        id: b.id,
        hotel_name: b.hotel_name,
        location: b.location,
        check_in_date: b.check_in_date,
        created_at: b.created_at
      })));
      
      // Log slow operations that might be causing timeouts
      if (loadTime > 2000) {
        console.warn(`⚠️ Slow hotel booking load: ${loadTime}ms`);
      }
      
      // Filter bookings by location and check-in date context with flexible matching
      const contextBookings = allBookings.filter(booking => {
        // Check if booking location matches modal context location (flexible matching)
        const locationMatch = booking.location === modalContext.location ||
                             (booking.location && booking.location.includes(modalContext.location)) ||
                             (modalContext.location && modalContext.location.includes(booking.location || ''));
        
        // Check if check-in date matches
        const dateMatch = booking.check_in_date === modalContext.checkInDate;
        
        console.log(`🔍 Hotel booking filter check:`, {
          bookingId: booking.id,
          bookingLocation: booking.location,
          modalLocation: modalContext.location,
          bookingCheckIn: booking.check_in_date,
          modalCheckIn: modalContext.checkInDate,
          locationMatch,
          dateMatch,
          include: locationMatch && dateMatch
        });
        
        return locationMatch && dateMatch;
      });
      
      setSavedBookings(contextBookings as HotelBooking[]);
      console.log(`✅ Loaded ${contextBookings.length} hotel bookings in ${loadTime}ms`);
    } catch (error) {
      console.error('Failed to load saved bookings:', error);
      setSavedBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBooking = async () => {
    console.log('🔍 Save hotel booking debug:', { 
      currentTripId: currentTrip?.id, 
      userId: user?.id, 
      currentTrip: !!currentTrip, 
      user: !!user 
    });
    
    if (!currentTrip?.id || !user?.id) {
      console.error('❌ Missing required data for hotel:', { currentTrip: currentTrip?.id, user: user?.id });
      alert('Please login to save booking information');
      return;
    }

    if (!alreadyBookedData.checkInTime || !alreadyBookedData.checkOutTime) {
      alert('Please specify check-in and check-out times');
      return;
    }

    setLoading(true);
    try {
      // Prepare data for bookings table (compatible info only)
      const hotelData = {
        booking_link: alreadyBookedData.bookingLink || undefined,
        hotel_name: alreadyBookedData.hotelName || undefined,
        address: alreadyBookedData.address || undefined,
        check_in_time: alreadyBookedData.checkInTime,
        check_out_time: alreadyBookedData.checkOutTime,
        check_in_date: alreadyBookedData.checkIn || checkInDateStr,
        check_out_date: alreadyBookedData.checkOut || checkOutDateStr,
        guests: alreadyBookedData.guests,
        price_per_night: alreadyBookedData.pricePerNight || undefined,
        rating: Math.round(Number(alreadyBookedData.rating) || 4),
        location: modalContext.location,
        notes: alreadyBookedData.google_place_id 
          ? `Hotel booking from Google Maps: ${alreadyBookedData.hotelName || 'Hotel'}`
          : `Hotel booking in ${extractCityName(nearbyLocation?.name || 'Unknown')}`,
        // Include Google Maps data only if database schema supports it
        latitude: alreadyBookedData.latitude,
        longitude: alreadyBookedData.longitude,
        google_place_id: alreadyBookedData.google_place_id
      };

      if (editingBooking) {
        await BookingService.updateBooking(editingBooking.id!, {
          ...editingBooking,
          ...hotelData
        });
        setEditingBooking(null);
      } else {
        // Save to bookings table only (Google Maps data will be stored here for Add to Trip)
        console.log('💾 Saving hotel booking with Google Maps data for future Add to Trip');
        await BookingService.saveHotelBooking(currentTrip.id, user.id, hotelData);
      }

      // Reload bookings
      await loadSavedBookings();
      
      // Reset form
      setAlreadyBookedData({
        bookingLink: '',
        hotelName: '',
        address: '',
        checkIn: dayData?.date || '',
        checkOut: '',
        checkInTime: defaultTimes.checkInTime,
        checkOutTime: defaultTimes.checkOutTime,
        guests: tripMembers?.length || 1,
        pricePerNight: '',
        rating: 4,
        // Reset Google Maps location data
        latitude: null,
        longitude: null,
        google_place_id: null
      });
      
      // Reset search state
      setSelectedPlace(null);
      setSearchQuery('');
      setSearchResults([]);

      // Switch to saved tab to show the saved booking
      setSelectedTab('saved');
    } catch (error) {
      console.error('Failed to save booking:', error);
      alert('Failed to save booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBooking = (booking: HotelBooking) => {
    setEditingBooking(booking);
    setAlreadyBookedData({
      bookingLink: booking.booking_link || '',
      hotelName: booking.hotel_name || '',
      address: booking.address || '',
      checkIn: booking.check_in_date || checkInDateStr,
      checkOut: booking.check_out_date || checkOutDateStr,
      checkInTime: booking.check_in_time || '15:00',
      checkOutTime: booking.check_out_time || '11:00',
      guests: booking.guests || tripMembers?.length || 1,
      pricePerNight: booking.price_per_night || '',
      rating: booking.rating || 4
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

  const handleAddToTrip = async (booking: HotelBooking) => {
    if (!currentTrip?.id || !user?.id) {
      alert('Please login to add booking to trip');
      return;
    }

    setLoading(true);
    try {
      await BookingService.addToTrip(currentTrip.id, user.id, booking);
      alert('Hotel booking added to trip! The schedule will be updated to accommodate the hotel times.');
      onClose();
    } catch (error) {
      console.error('Failed to add booking to trip:', error);
      alert('Failed to add booking to trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const mockHotels = generateMockHotels();
  const city = extractCityName(nearbyLocation?.name || 'Tokyo');

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
      <div className="fixed inset-0 flex items-center justify-center p-2 pt-16 pb-16 sm:p-4 sm:pt-6 sm:pb-6">
        <Dialog.Panel
          as={motion.div}
          className="w-full max-w-4xl mx-2 sm:mx-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[85vh] sm:max-h-[90vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Bed className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Hotel Booking
                </Dialog.Title>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Near {city}
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
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Search Hotels
            </button>
            <button
              onClick={() => setSelectedTab('already')}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium transition-colors ${
                selectedTab === 'already'
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {editingBooking ? 'Edit Booking' : 'Add Booking'}
            </button>
            <button
              onClick={() => setSelectedTab('saved')}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium transition-colors ${
                selectedTab === 'saved'
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Saved ({savedBookings.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedTab === 'search' ? (
              <div className="p-4 sm:p-6">
                {/* Mock Hotels */}
                <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Available Hotels</h3>
                  <div className="grid gap-3 sm:gap-4">
                    {mockHotels.map((hotel) => (
                      <div key={hotel.id} className="bg-slate-50 dark:bg-slate-700/50 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                          <div className="flex-1">
                            <div className="mb-2">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                {hotel.name}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {hotel.address}
                              </p>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  {[...Array(Math.floor(hotel.rating))].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                                  ))}
                                </div>
                                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                  {hotel.rating}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {hotel.amenities.map((amenity, index) => (
                                <span key={index} className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                              ${hotel.pricePerNight}
                            </div>
                            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2">per night</div>
                            <button
                              onClick={() => handleBookHotel(generateTripComHotelUrl(city, checkInDateStr, checkOutDateStr, tripMembers?.length || 1))}
                              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm font-medium"
                            >
                              Book on Trip.com
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct Trip.com Link */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">Search All Hotels</h3>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 sm:p-4 rounded-xl">
                    <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 mb-3 sm:mb-4">
                      Browse all available hotels in {city} for your dates
                    </p>
                    <button
                      onClick={() => handleBookHotel(generateTripComHotelUrl(city, checkInDateStr, checkOutDateStr, tripMembers?.length || 1))}
                      className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Search Hotels on Trip.com</span>
                    </button>
                  </div>
                </div>
                <div className="pb-8 sm:pb-12"></div>
              </div>
            ) : selectedTab === 'already' ? (
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
                  {editingBooking ? 'Edit Hotel Booking' : 'Add Hotel Booking'}
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {/* Google Places Hotel Search (Optional) */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Search Hotels (Optional)
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                      {typeof google !== 'undefined' && google.maps && google.maps.places 
                        ? 'Search for a specific hotel to automatically fill location details, or skip to enter information manually.'
                        : 'Google Maps is not available. Please enter hotel information manually.'
                      }
                    </p>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              if (e.target.value.length >= 3) {
                                searchHotels(e.target.value);
                              } else {
                                setSearchResults([]);
                              }
                            }}
                            disabled={typeof google === 'undefined' || !google.maps || !google.maps.places}
                            className={`w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white ${
                              typeof google === 'undefined' || !google.maps || !google.maps.places 
                                ? 'opacity-50 cursor-not-allowed' 
                                : ''
                            }`}
                            placeholder={typeof google !== 'undefined' && google.maps && google.maps.places 
                              ? `Search hotels in ${city}...` 
                              : 'Google Maps not available'
                            }
                          />
                          {searchLoading && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            </div>
                          )}
                        </div>
                        {selectedPlace && (
                          <button
                            onClick={clearPlaceSelection}
                            className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      
                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {searchResults.map((place) => (
                            <button
                              key={place.place_id}
                              onClick={() => handlePlaceSelect(place)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-600 last:border-b-0"
                            >
                              <div className="font-medium text-sm text-slate-900 dark:text-white">
                                {place.name}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                {place.formatted_address}
                              </div>
                              {place.rating && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                  <span className="text-xs text-slate-600 dark:text-slate-400">
                                    {place.rating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Selected Place Display */}
                      {selectedPlace && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm text-green-900 dark:text-green-100">
                                ✓ {selectedPlace.name}
                              </div>
                              <div className="text-xs text-green-700 dark:text-green-300">
                                {selectedPlace.formatted_address}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                        className="flex-1 px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., https://trip.com/booking/12345"
                      />
                      <button
                        onClick={() => alreadyBookedData.bookingLink && window.open(alreadyBookedData.bookingLink, '_blank')}
                        disabled={!alreadyBookedData.bookingLink}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Booking
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Hotel Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={alreadyBookedData.hotelName}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, hotelName: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., Grand Tokyo Hotel"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Address (Optional)
                      </label>
                      <input
                        type="text"
                        value={alreadyBookedData.address}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, address: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., 123 Business District, Tokyo"
                      />
                    </div>
                  </div>
                  {/* Check-in and Check-out Times - Required */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-in Time *
                      </label>
                      <input
                        type="time"
                        value={alreadyBookedData.checkInTime}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, checkInTime: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-out Time *
                      </label>
                      <input
                        type="time"
                        value={alreadyBookedData.checkOutTime}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, checkOutTime: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Check-in and Check-out Dates - Optional */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-in Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={alreadyBookedData.checkIn}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, checkIn: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-out Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={alreadyBookedData.checkOut}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, checkOut: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Guests
                      </label>
                      <select
                        value={alreadyBookedData.guests}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, guests: parseInt(e.target.value) })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <option key={num} value={num}>{num} guest{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Price per Night (USD) (Optional)
                      </label>
                      <input
                        type="number"
                        value={alreadyBookedData.pricePerNight}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, pricePerNight: e.target.value })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., 150"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Rating (Optional)
                      </label>
                      <select
                        value={alreadyBookedData.rating}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, rating: parseInt(e.target.value) })}
                        className="w-full px-3 py-3 sm:py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5].map(num => (
                          <option key={num} value={num}>{num} star{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleSaveBooking}
                      disabled={!alreadyBookedData.checkInTime || !alreadyBookedData.checkOutTime || loading}
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
                            hotelName: '',
                            address: '',
                            checkIn: dayData?.date || '',
                            checkOut: '',
                            checkInTime: '15:00',
                            checkOutTime: '11:00',
                            guests: tripMembers?.length || 1,
                            pricePerNight: '',
                            rating: 4
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
                  Saved Hotel Bookings
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : savedBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">No saved hotel bookings yet.</p>
                    <button
                      onClick={() => setSelectedTab('already')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
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
                                {booking.hotel_name || 'Hotel Booking'}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                {booking.address} • {booking.location}
                              </p>
                            </div>
                            <div className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                              {booking.check_in_date && (
                                <div>Check-in: {booking.check_in_date} at {booking.check_in_time}</div>
                              )}
                              {booking.check_out_date && (
                                <div>Check-out: {booking.check_out_date} at {booking.check_out_time}</div>
                              )}
                              {booking.guests && (
                                <div>Guests: {booking.guests}</div>
                              )}
                              {booking.price_per_night && (
                                <div>Price: ${booking.price_per_night}/night</div>
                              )}
                              {booking.rating && (
                                <div className="flex items-center gap-1">
                                  <span>Rating:</span>
                                  <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-3 h-3 ${
                                          star <= (booking.rating || 0)
                                            ? 'text-yellow-400 fill-current'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex gap-2">
                              {booking.booking_link && (
                                <button
                                  onClick={() => window.open(booking.booking_link!, '_blank')}
                                  className="px-2 py-2 sm:px-3 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" /> Book
                                </button>
                              )}
                              <button
                                onClick={() => handleAddToTrip(booking)}
                                disabled={loading}
                                className="px-2 py-2 sm:px-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add to Trip
                              </button>
                              <button
                                onClick={() => handleEditBooking(booking)}
                                className="px-2 py-2 sm:px-3 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Edit className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(booking.id!)}
                                className="px-2 py-2 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
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

export default HotelBookingModal;