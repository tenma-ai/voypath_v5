import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Bed, Star, Trash2, Edit } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DateUtils } from '../utils/DateUtils';
import { BookingService } from '../services/BookingService';
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
  const { currentTrip, tripMembers, addPlace, user } = useStore();

  // Extract city name from location string
  const extractCityName = (locationName: string): string => {
    if (!locationName) return 'Tokyo';
    
    // Remove common suffixes like "(Departure)", "(Destination)", etc.
    let cityName = locationName.replace(/\s*\([^)]*\)\s*/g, '');
    
    // Split by comma and take the first part (usually the city)
    const parts = cityName.split(',').map(part => part.trim());
    return parts[0] || locationName;
  };
  const [selectedTab, setSelectedTab] = useState<'search' | 'already' | 'saved'>('search');
  const [alreadyBookedData, setAlreadyBookedData] = useState({
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
  const [savedBookings, setSavedBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState<HotelBooking | null>(null);

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

  // Load saved bookings when modal opens
  useEffect(() => {
    if (isOpen && currentTrip?.id) {
      loadSavedBookings();
    }
  }, [isOpen, currentTrip?.id, modalContext.location, modalContext.checkInDate]);

  const loadSavedBookings = async () => {
    if (!currentTrip?.id) return;
    
    setLoading(true);
    try {
      // Load all hotel bookings for this trip
      const allBookings = await BookingService.getBookingsByType(currentTrip.id, 'hotel');
      
      // Filter bookings by location and check-in date context
      const contextBookings = allBookings.filter(booking => 
        booking.location === modalContext.location && 
        booking.check_in_date === modalContext.checkInDate
      );
      
      setSavedBookings(contextBookings as HotelBooking[]);
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
        rating: alreadyBookedData.rating,
        location: modalContext.location,
        notes: `Hotel booking in ${extractCityName(nearbyLocation?.name || 'Unknown')}`
      };

      if (editingBooking) {
        await BookingService.updateBooking(editingBooking.id!, {
          ...editingBooking,
          ...hotelData
        });
        setEditingBooking(null);
      } else {
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
        checkInTime: '15:00',
        checkOutTime: '11:00',
        guests: tripMembers?.length || 1,
        pricePerNight: '',
        rating: 4
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
    if (!currentTrip) return;

    const notesArray = [];
    if (booking.check_in_date) notesArray.push(`Check-in: ${booking.check_in_date} at ${booking.check_in_time}`);
    if (booking.check_out_date) notesArray.push(`Check-out: ${booking.check_out_date} at ${booking.check_out_time}`);
    if (booking.guests) notesArray.push(`${booking.guests} guests`);
    if (booking.price_per_night) notesArray.push(`$${booking.price_per_night}/night`);
    if (booking.booking_link) notesArray.push(`Booking: ${booking.booking_link}`);

    try {
      await addPlace({
        id: crypto.randomUUID(),
        name: booking.hotel_name || 'Booked Hotel',
        address: booking.address || nearbyLocation?.name || 'Hotel Location',
        latitude: nearbyLocation?.lat || 35.6812,
        longitude: nearbyLocation?.lng || 139.7671,
        notes: notesArray.join(' • '),
        category: 'lodging',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trip_id: currentTrip.id,
        tripId: currentTrip.id,
        user_id: user?.id || '',
        place_type: 'group_selected',
        wish_level: 5,
        stay_duration_minutes: 8 * 60,
        is_user_location: true,
        is_selected_for_optimization: true,
        normalized_wish_level: 0.5,
        rating: booking.rating || 4,
        booking_url: booking.booking_link
      });

      onClose();
    } catch (error) {
      console.error('Failed to add hotel to trip:', error);
      alert('Failed to add hotel to trip. Please try again.');
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
          <div className="flex-1 overflow-y-auto max-h-[70vh]">
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
                  {/* Booking Link Field */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Booking Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={alreadyBookedData.bookingLink}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, bookingLink: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., https://trip.com/booking/12345"
                      />
                      <button
                        onClick={() => alreadyBookedData.bookingLink && window.open(alreadyBookedData.bookingLink, '_blank')}
                        disabled={!alreadyBookedData.bookingLink}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Book
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5].map(num => (
                          <option key={num} value={num}>{num} star{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveBooking}
                      disabled={!alreadyBookedData.checkInTime || !alreadyBookedData.checkOutTime || loading}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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
                        className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
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
                              {booking.booking_link && (
                                <div className="flex items-center gap-1">
                                  <span>Booking:</span>
                                  <a 
                                    href={booking.booking_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:text-purple-800 underline flex items-center gap-1"
                                  >
                                    Link <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-row sm:flex-col gap-2">
                            <button
                              onClick={() => handleAddToTrip(booking)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium"
                            >
                              Add to Trip
                            </button>
                            <button
                              onClick={() => handleEditBooking(booking)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(booking.id!)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
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