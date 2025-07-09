import React, { useState, useEffect } from 'react';
import { X, Search, MapPin, Clock, Star, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GooglePlacesService } from '../services/GooglePlacesService';

interface MealInsertionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  dayData: any;
  timeSlot: string;
  nearbyLocation?: {
    lat: number;
    lng: number;
    name: string;
  };
}

interface Restaurant {
  place_id: string;
  name: string;
  address: string;
  rating: number;
  price_level: number;
  cuisine: string;
  distance: string;
  latitude: number;
  longitude: number;
  photos?: string[];
  types: string[];
}

const MealInsertionModal: React.FC<MealInsertionModalProps> = ({
  isOpen,
  onClose,
  mealType,
  dayData,
  timeSlot,
  nearbyLocation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTrip, addPlace } = useStore();

  // Load restaurants from Google Places API
  useEffect(() => {
    if (isOpen && nearbyLocation) {
      loadRestaurants();
    }
  }, [isOpen, nearbyLocation, mealType]);

  const loadRestaurants = async () => {
    if (!nearbyLocation) return;
    
    setIsLoading(true);
    try {
      const searchQuery = getMealTypeSearchQuery(mealType);
      const places = await GooglePlacesService.searchNearby(
        { lat: nearbyLocation.lat, lng: nearbyLocation.lng },
        1000, // 1km radius
        'restaurant'
      );

      // Filter and convert to restaurant format
      const restaurantData = places
        .filter(place => place.types.includes('restaurant') || place.types.includes('meal_takeaway'))
        .map(place => convertToRestaurant(place))
        .slice(0, 10); // Limit to 10 results

      setRestaurants(restaurantData);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
      setRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getMealTypeSearchQuery = (mealType: 'breakfast' | 'lunch' | 'dinner'): string => {
    switch (mealType) {
      case 'breakfast':
        return 'breakfast restaurant cafe';
      case 'lunch':
        return 'lunch restaurant';
      case 'dinner':
        return 'dinner restaurant';
      default:
        return 'restaurant';
    }
  };

  const convertToRestaurant = (place: any): Restaurant => {
    const distance = nearbyLocation ? 
      calculateDistance(nearbyLocation.lat, nearbyLocation.lng, place.geometry.location.lat, place.geometry.location.lng) : 0;
    
    return {
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address || place.vicinity || '',
      rating: place.rating || 0,
      price_level: place.price_level || 0,
      cuisine: inferCuisineFromTypes(place.types),
      distance: formatDistance(distance),
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      photos: place.photos || [],
      types: place.types || []
    };
  };

  const inferCuisineFromTypes = (types: string[]): string => {
    const cuisineMapping: { [key: string]: string } = {
      'japanese_restaurant': 'Japanese',
      'italian_restaurant': 'Italian',
      'chinese_restaurant': 'Chinese',
      'american_restaurant': 'American',
      'french_restaurant': 'French',
      'indian_restaurant': 'Indian',
      'mexican_restaurant': 'Mexican',
      'thai_restaurant': 'Thai',
      'korean_restaurant': 'Korean',
      'cafe': 'Cafe',
      'bakery': 'Bakery',
      'fast_food': 'Fast Food'
    };

    for (const type of types) {
      if (cuisineMapping[type]) {
        return cuisineMapping[type];
      }
    }
    return 'Restaurant';
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const handleSearchRestaurants = async () => {
    if (!nearbyLocation || !searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const mealTypeKeyword = getMealTypeSearchQuery(mealType);
      const fullSearchQuery = `${searchQuery} ${mealTypeKeyword}`;
      
      const places = await GooglePlacesService.searchPlaces({
        query: fullSearchQuery,
        location: { lat: nearbyLocation.lat, lng: nearbyLocation.lng },
        radius: 2000, // 2km radius for search
        type: 'restaurant'
      });

      // Convert to restaurant format
      const restaurantData = places
        .filter(place => place.types.includes('restaurant') || place.types.includes('meal_takeaway'))
        .map(place => convertToRestaurant(place))
        .slice(0, 15); // Limit to 15 results

      setRestaurants(restaurantData);
    } catch (error) {
      console.error('Failed to search restaurants:', error);
      setRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRestaurant = async (restaurant: Restaurant) => {
    if (!currentTrip) return;

    try {
      // Add restaurant as a place
      await addPlace({
        id: crypto.randomUUID(),
        name: restaurant.name,
        address: restaurant.address,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        notes: `${mealType} at ${restaurant.cuisine} restaurant`,
        category: 'restaurant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trip_id: currentTrip.id,
        tripId: currentTrip.id,
        user_id: useStore.getState().user?.id || '',
        place_type: 'meal',
        wish_level: 5,
        stay_duration_minutes: mealType === 'breakfast' ? 45 : mealType === 'lunch' ? 60 : 90,
        is_user_location: true,
        is_selected_for_optimization: true,
        normalized_wish_level: 0.5,
        rating: restaurant.rating,
        photos: restaurant.photos,
        google_place_id: restaurant.place_id,
        google_rating: restaurant.rating,
        google_price_level: restaurant.price_level,
        google_place_types: restaurant.types,
        source: 'google_places'
      });

      onClose();
    } catch (error) {
      console.error('Failed to add restaurant:', error);
    }
  };

  const handleTripComRedirect = () => {
    // Use the provided trip.com referral link
    const tripComUrl = `https://tp.media/r?marker=649297&trs=434567&p=8626&u=https%3A%2F%2Ftrip.com&campaign_id=121`;
    window.open(tripComUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-0 max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-orange-500 to-red-500 p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-2xl font-bold text-white capitalize pr-8">
            Add {mealType} Restaurant
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {timeSlot} • {dayData.date} • Near {nearbyLocation?.name || 'current location'}
          </p>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${mealType} restaurants...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                onKeyPress={(e) => e.key === 'Enter' && handleSearchRestaurants()}
              />
            </div>
            <button
              onClick={handleSearchRestaurants}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Restaurant List */}
        <div className="flex-1 overflow-y-auto max-h-[400px]">
          {restaurants.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">No restaurants found</p>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {restaurants.map((restaurant) => (
                <div key={restaurant.place_id} className="p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span>{restaurant.address}</span>
                        <span className="mx-2">•</span>
                        <span>{restaurant.distance}</span>
                      </div>
                      <div className="flex items-center mt-2 space-x-4">
                        {restaurant.rating > 0 && (
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                              {restaurant.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {restaurant.price_level > 0 && `${'$'.repeat(restaurant.price_level)} • `}{restaurant.cuisine}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleAddRestaurant(restaurant)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        Add to Trip
                      </button>
                      <button
                        onClick={handleTripComRedirect}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing restaurants near {nearbyLocation?.name || 'your location'}
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

export default MealInsertionModal;