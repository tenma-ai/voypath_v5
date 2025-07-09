import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Bed, Calendar, User, MapPin, Clock, Star } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DateUtils } from '../utils/DateUtils';

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
  const { currentTrip, tripMembers, addPlace } = useStore();

  // Extract city name from location string
  const extractCityName = (locationName: string): string => {
    if (!locationName) return 'Tokyo';
    
    // Remove common suffixes like "(Departure)", "(Destination)", etc.
    let cityName = locationName.replace(/\s*\([^)]*\)\s*/g, '');
    
    // Split by comma and take the first part (usually the city)
    const parts = cityName.split(',').map(part => part.trim());
    return parts[0] || locationName;
  };
  const [selectedTab, setSelectedTab] = useState<'search' | 'already'>('search');
  const [alreadyBookedData, setAlreadyBookedData] = useState({
    hotelName: '',
    address: '',
    checkIn: dayData?.date || '',
    checkOut: '',
    guests: tripMembers?.length || 1,
    pricePerNight: '',
    rating: 4
  });

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

  const handleAddAlreadyBooked = async () => {
    if (!currentTrip || !alreadyBookedData.hotelName) return;

    try {
      await addPlace({
        id: crypto.randomUUID(),
        name: alreadyBookedData.hotelName,
        address: alreadyBookedData.address || nearbyLocation?.name || 'Hotel Location',
        latitude: nearbyLocation?.lat || 35.6812,
        longitude: nearbyLocation?.lng || 139.7671,
        notes: `Check-in: ${alreadyBookedData.checkIn}, Check-out: ${alreadyBookedData.checkOut} • ${alreadyBookedData.guests} guests • $${alreadyBookedData.pricePerNight}/night`,
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
        rating: alreadyBookedData.rating
      });

      onClose();
    } catch (error) {
      console.error('Failed to add hotel:', error);
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
          className="w-full max-w-4xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[90vh]"
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
                  Near {city}
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

          {/* Hotel Info */}
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Check-in Date</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {checkInDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Guests</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{tripMembers?.length || 1} guest{(tripMembers?.length || 1) > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Location</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{city}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setSelectedTab('search')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                selectedTab === 'search'
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Search Hotels
            </button>
            <button
              onClick={() => setSelectedTab('already')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                selectedTab === 'already'
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Already Booked
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-[70vh]">
            {selectedTab === 'search' ? (
              <div className="p-6">
                {/* Mock Hotels */}
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Available Hotels</h3>
                  <div className="grid gap-4">
                    {mockHotels.map((hotel) => (
                      <div key={hotel.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="mb-2">
                              <h4 className="font-bold text-slate-900 dark:text-white">
                                {hotel.name}
                              </h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {hotel.address}
                              </p>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  {[...Array(Math.floor(hotel.rating))].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                                  ))}
                                </div>
                                <span className="text-sm text-slate-600 dark:text-slate-400">
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
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                              ${hotel.pricePerNight}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">per night</div>
                            <button
                              onClick={() => handleBookHotel(generateTripComHotelUrl(city, checkInDateStr, checkOutDateStr, tripMembers?.length || 1))}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
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
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Search All Hotels</h3>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl">
                    <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                      Browse all available hotels in {city} for your dates
                    </p>
                    <button
                      onClick={() => handleBookHotel(generateTripComHotelUrl(city, checkInDateStr, checkOutDateStr, tripMembers?.length || 1))}
                      className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span>Search Hotels on Trip.com</span>
                    </button>
                  </div>
                </div>
                <div className="pb-12"></div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Already Booked a Hotel?
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Hotel Name
                      </label>
                      <input
                        type="text"
                        value={alreadyBookedData.hotelName}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, hotelName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., Grand Tokyo Hotel"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Address
                      </label>
                      <input
                        type="text"
                        value={alreadyBookedData.address}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., 123 Business District, Tokyo"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-in Date
                      </label>
                      <input
                        type="date"
                        value={alreadyBookedData.checkIn}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, checkIn: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-out Date
                      </label>
                      <input
                        type="date"
                        value={alreadyBookedData.checkOut}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, checkOut: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Guests
                      </label>
                      <select
                        value={alreadyBookedData.guests}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, guests: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <option key={num} value={num}>{num} guest{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Price per Night (USD)
                      </label>
                      <input
                        type="number"
                        value={alreadyBookedData.pricePerNight}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, pricePerNight: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., 150"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Rating
                      </label>
                      <select
                        value={alreadyBookedData.rating}
                        onChange={(e) => setAlreadyBookedData({ ...alreadyBookedData, rating: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      >
                        {[1, 2, 3, 4, 5].map(num => (
                          <option key={num} value={num}>{num} star{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAddAlreadyBooked}
                    disabled={!alreadyBookedData.hotelName}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Add Hotel to Trip
                  </button>
                </div>
                <div className="pb-12"></div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default HotelBookingModal;