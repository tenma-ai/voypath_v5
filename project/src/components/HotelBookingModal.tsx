import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, Search, MapPin, Clock, Star, ExternalLink, Bed, Wifi, Car, Calendar } from 'lucide-react';
import { useStore } from '../store/useStore';

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

interface Hotel {
  id: string;
  name: string;
  address: string;
  rating: number;
  pricePerNight: number;
  distance: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  photos?: string[];
}

const HotelBookingModal: React.FC<HotelBookingModalProps> = ({
  isOpen,
  onClose,
  dayData,
  timeSlot,
  nearbyLocation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'search' | 'book' | 'already'>('search');
  const [bookingDetails, setBookingDetails] = useState({
    hotelName: '',
    checkIn: '',
    checkOut: '',
    guests: 1
  });
  const { currentTrip, addPlace } = useStore();

  // Mock hotel data
  const mockHotels: Hotel[] = [
    {
      id: '1',
      name: 'Grand Tokyo Hotel',
      address: '123 Business District, Tokyo',
      rating: 4.5,
      pricePerNight: 15000,
      distance: '0.3 miles',
      latitude: 35.6812,
      longitude: 139.7671,
      amenities: ['WiFi', 'Parking', 'Breakfast', 'Gym'],
      photos: ['https://example.com/hotel1.jpg']
    },
    {
      id: '2',
      name: 'Sakura Inn',
      address: '456 Traditional Ave, Tokyo',
      rating: 4.2,
      pricePerNight: 8000,
      distance: '0.5 miles',
      latitude: 35.6815,
      longitude: 139.7675,
      amenities: ['WiFi', 'Traditional Bath', 'Restaurant'],
      photos: ['https://example.com/hotel2.jpg']
    },
    {
      id: '3',
      name: 'Modern City Lodge',
      address: '789 Urban St, Tokyo',
      rating: 4.8,
      pricePerNight: 12000,
      distance: '0.7 miles',
      latitude: 35.6820,
      longitude: 139.7680,
      amenities: ['WiFi', 'Fitness Center', 'Business Center', 'Parking'],
      photos: ['https://example.com/hotel3.jpg']
    }
  ];

  useEffect(() => {
    if (isOpen) {
      setHotels(mockHotels);
    }
  }, [isOpen]);

  const handleSearchHotels = async () => {
    setIsLoading(true);
    setTimeout(() => {
      const filtered = mockHotels.filter(hotel =>
        hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hotel.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setHotels(filtered);
      setIsLoading(false);
    }, 1000);
  };

  const handleTripComBooking = (hotel?: Hotel) => {
    // Get trip details for booking
    const checkInDate = dayData?.date || new Date().toISOString().split('T')[0];
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    
    const city = nearbyLocation?.name || 'Tokyo';
    const guests = bookingDetails.guests || 1;
    
    // Build trip.com URL with pre-filled data
    const baseUrl = 'https://tp.media/r?marker=649297&trs=434567&p=8626&u=https%3A%2F%2Ftrip.com%2Fhotels%2Flist';
    const params = new URLSearchParams({
      city: city,
      cityName: city,
      checkin: checkInDate.replace(/-/g, '%2F'),
      checkout: checkOutDate.toISOString().split('T')[0].replace(/-/g, '%2F'),
      adult: guests.toString(),
      children: '0',
      crn: '1',
      searchType: 'CT',
      searchWord: hotel?.name || city,
      'locale': 'en-XX',
      'curr': 'JPY'
    });
    
    const tripComUrl = `${baseUrl}?${params.toString()}&campaign_id=121`;
    window.open(tripComUrl, '_blank');
  };

  const handleAddHotel = async (hotel: Hotel) => {
    if (!currentTrip) return;

    try {
      await addPlace({
        id: crypto.randomUUID(),
        name: hotel.name,
        address: hotel.address,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        notes: `Hotel accommodation - ¥${hotel.pricePerNight.toLocaleString()}/night`,
        category: 'lodging',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trip_id: currentTrip.id,
        tripId: currentTrip.id,
        user_id: useStore.getState().user?.id || '',
        place_type: 'hotel',
        wish_level: 5,
        stay_duration_minutes: 8 * 60, // 8 hours
        is_user_location: true,
        is_selected_for_optimization: true,
        normalized_wish_level: 0.5,
        rating: hotel.rating,
        photos: hotel.photos
      });

      onClose();
    } catch (error) {
      console.error('Failed to add hotel:', error);
    }
  };

  const handleAlreadyBooked = () => {
    if (!currentTrip || !bookingDetails.hotelName) return;

    // Add the already booked hotel to the trip
    handleAddHotel({
      id: crypto.randomUUID(),
      name: bookingDetails.hotelName,
      address: nearbyLocation?.name || 'Location',
      rating: 4.0,
      pricePerNight: 10000,
      distance: '0.0 miles',
      latitude: nearbyLocation?.lat || 35.6812,
      longitude: nearbyLocation?.lng || 139.7671,
      amenities: ['WiFi'],
      photos: []
    });
  };

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'wifi':
        return <Wifi className="w-3 h-3" />;
      case 'parking':
        return <Car className="w-3 h-3" />;
      case 'breakfast':
      case 'restaurant':
        return <span className="text-xs">🍽️</span>;
      case 'gym':
      case 'fitness center':
        return <span className="text-xs">💪</span>;
      case 'traditional bath':
        return <span className="text-xs">🛁</span>;
      case 'business center':
        return <span className="text-xs">💼</span>;
      default:
        return <Bed className="w-3 h-3" />;
    }
  };

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
          className="w-full max-w-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[90vh]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Bed className="w-5 h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  Hotel Booking
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {timeSlot} • {dayData?.date} • Near {nearbyLocation?.name || 'current location'}
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

        {/* Option Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSelectedOption('search')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              selectedOption === 'search'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Search Hotels
          </button>
          <button
            onClick={() => setSelectedOption('book')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              selectedOption === 'book'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Book on Trip.com
          </button>
          <button
            onClick={() => setSelectedOption('already')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              selectedOption === 'already'
                ? 'border-b-2 border-purple-500 text-purple-600'
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
              {/* Search */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search hotels..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchHotels()}
                    />
                  </div>
                  <button
                    onClick={handleSearchHotels}
                    disabled={isLoading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {/* Hotel List */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {hotels.map((hotel) => (
                  <div key={hotel.id} className="p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {hotel.name}
                        </h3>
                        <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span>{hotel.address}</span>
                          <span className="mx-2">•</span>
                          <span>{hotel.distance}</span>
                        </div>
                        <div className="flex items-center mt-2 space-x-4">
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                              {hotel.rating}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            ¥{hotel.pricePerNight.toLocaleString()}/night
                          </div>
                        </div>
                        <div className="flex items-center mt-2 space-x-2">
                          {hotel.amenities.slice(0, 4).map((amenity) => (
                            <div key={amenity} className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                              {getAmenityIcon(amenity)}
                              <span className="ml-1">{amenity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => handleAddHotel(hotel)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          Add to Trip
                        </button>
                        <button
                          onClick={() => handleTripComBooking(hotel)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Book
                        </button>
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
                <Bed className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Book on Trip.com
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Search and book hotels directly on Trip.com with pre-filled location and dates.
                </p>
              </div>
              <button
                onClick={() => handleTripComBooking()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Trip.com
              </button>
            </div>
          )}

          {selectedOption === 'already' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Already Booked a Hotel?
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hotel Name
                  </label>
                  <input
                    type="text"
                    value={bookingDetails.hotelName}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, hotelName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    placeholder="Enter hotel name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Check-in Date
                    </label>
                    <input
                      type="date"
                      value={bookingDetails.checkIn}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, checkIn: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Check-out Date
                    </label>
                    <input
                      type="date"
                      value={bookingDetails.checkOut}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, checkOut: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Guests
                  </label>
                  <select
                    value={bookingDetails.guests}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, guests: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} guest{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAlreadyBooked}
                  disabled={!bookingDetails.hotelName}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add to Trip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Find hotels near {nearbyLocation?.name || 'your location'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default HotelBookingModal;