import React, { useState, useEffect } from 'react';
import { X, Search, MapPin, Clock, Star } from 'lucide-react';
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

  // Extract city name from location string
  const extractCityName = (locationName: string): string => {
    if (!locationName) return 'current location';
    
    // Remove common suffixes like "(Departure)", "(Destination)", etc.
    let cityName = locationName.replace(/\s*\([^)]*\)\s*/g, '');
    
    // Split by comma and take the first part (usually the city)
    const parts = cityName.split(',').map(part => part.trim());
    return parts[0] || locationName;
  };

  // Set default search query when modal opens
  useEffect(() => {
    if (isOpen && nearbyLocation) {
      const defaultQuery = extractCityName(nearbyLocation?.name || '');
      setSearchQuery(defaultQuery);
    }
  }, [isOpen, nearbyLocation]);

  // Handle search function
  const handleSearchRestaurants = async () => {
    if (!nearbyLocation || !searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const mealTypeKeyword = getMealTypeSearchQuery(mealType);
      const fullSearchQuery = `${searchQuery} ${mealTypeKeyword}`;
      
      // Try Google Places API text search with location bias
      const places = await GooglePlacesService.searchPlaces({
        query: fullSearchQuery,
        location: { lat: nearbyLocation.lat, lng: nearbyLocation.lng },
        radius: 3000, // 3km radius for broader search
        type: 'restaurant'
      });

      // Filter and convert to restaurant format with enhanced filtering
      const restaurantData = places
        .filter(place => {
          const isRestaurant = place.types.includes('restaurant') || 
                              place.types.includes('meal_takeaway') ||
                              place.types.includes('food');
          const hasGoodRating = !place.rating || place.rating >= 3.0;
          return isRestaurant && hasGoodRating;
        })
        .map(place => convertToRestaurant(place))
        .sort((a, b) => {
          // Prioritize relevance to search query, then rating, then distance
          const aRelevance = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0;
          const bRelevance = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0;
          if (bRelevance !== aRelevance) return bRelevance - aRelevance;
          if (b.rating !== a.rating) return b.rating - a.rating;
          return parseFloat(a.distance) - parseFloat(b.distance);
        })
        .slice(0, 15); // Show top 15 search results

      setRestaurants(restaurantData);
    } catch (error) {
      console.error('Failed to search restaurants with Google Places API:', error);
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


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100000] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-0 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-orange-500 to-red-500 p-4 sm:p-6 pb-3 sm:pb-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-lg sm:text-2xl font-bold text-white capitalize pr-8 sm:pr-10">
            Add {mealType} Restaurant
          </h2>
          <p className="text-white/80 text-xs sm:text-sm mt-1">
            {timeSlot} • {dayData.date} • Near {extractCityName(nearbyLocation?.name || 'current location')}
          </p>
          <p className="text-white/60 text-xs mt-1">
            Real-time restaurant data with fallback options
          </p>
        </div>

        {/* Search */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${mealType} restaurants...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                onKeyPress={(e) => e.key === 'Enter' && handleSearchRestaurants()}
              />
            </div>
            <button
              onClick={handleSearchRestaurants}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Restaurant List */}
        <div className="flex-1 overflow-y-auto max-h-[350px] sm:max-h-[400px]">
          {restaurants.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Search className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
              </div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">No restaurants found</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {restaurants.map((restaurant) => (
                <div key={restaurant.place_id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                        <span className="truncate">{restaurant.address}</span>
                        <span className="mx-2">•</span>
                        <span className="whitespace-nowrap">{restaurant.distance}</span>
                      </div>
                      <div className="flex items-center mt-2 space-x-3 sm:space-x-4">
                        {restaurant.rating > 0 && (
                          <div className="flex items-center">
                            <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-current" />
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 ml-1">
                              {restaurant.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {restaurant.price_level > 0 && `${'$'.repeat(restaurant.price_level)} • `}{restaurant.cuisine}
                        </div>
                      </div>
                    </div>
                    <div className="ml-0 sm:ml-4">
                      <button
                        onClick={() => handleAddRestaurant(restaurant)}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
                      >
                        Add to Trip
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Showing restaurants near {extractCityName(nearbyLocation?.name || 'your location')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Restaurants with quality ratings • Live data when available
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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