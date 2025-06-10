import React, { useState } from 'react';
import { Grid3X3, List, Star, Clock, AlertCircle, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function MyPlacesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('all');
  const { places, currentTrip } = useStore();

  // Check if deadline has passed
  const isDeadlinePassed = () => {
    if (!currentTrip?.addPlaceDeadline) return false;
    return new Date() > new Date(currentTrip.addPlaceDeadline);
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Mock places data
  const mockPlaces = places.length === 0 ? [
    {
      id: '1',
      name: 'Senso-ji Temple',
      category: 'Temple',
      address: '2-3-1 Asakusa, Taito City, Tokyo',
      rating: 4.5,
      wishLevel: 5,
      stayDuration: 2,
      priceLevel: 1,
      image: 'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=300&h=200&fit=crop',
      scheduled: true,
      scheduledDate: '5/15',
      notes: 'Beautiful historic temple in Asakusa'
    },
    {
      id: '2',
      name: 'Tokyo Skytree',
      category: 'Attraction',
      address: '1-1-2 Oshiage, Sumida City, Tokyo',
      rating: 4.8,
      wishLevel: 4,
      stayDuration: 3,
      priceLevel: 3,
      image: 'https://images.unsplash.com/photo-1533619239233-6280475a633a?w=300&h=200&fit=crop',
      scheduled: true,
      scheduledDate: '5/15',
    },
    {
      id: '3',
      name: 'Meiji Shrine',
      category: 'Shrine',
      address: '1-1 Kamizono-cho, Shibuya City, Tokyo',
      rating: 4.6,
      wishLevel: 4,
      stayDuration: 1.5,
      priceLevel: 1,
      image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=300&h=200&fit=crop',
      scheduled: false,
    },
    {
      id: '4',
      name: 'Tsukiji Outer Market',
      category: 'Food',
      address: '4-16-2 Tsukiji, Chuo City, Tokyo',
      rating: 4.4,
      wishLevel: 5,
      stayDuration: 2,
      priceLevel: 2,
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&h=200&fit=crop',
      scheduled: false,
    }
  ] : places;

  const filteredPlaces = mockPlaces.filter(place => {
    if (filter === 'scheduled') return place.scheduled;
    if (filter === 'unscheduled') return !place.scheduled;
    return true;
  });

  const categoryColors = {
    'Temple': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    'Shrine': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    'Attraction': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    'Food': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating
            ? 'text-yellow-400 fill-current'
            : 'text-slate-300 dark:text-slate-600'
        }`}
      />
    ));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Deadline Warning */}
      {currentTrip?.addPlaceDeadline && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-xl border ${
            isDeadlinePassed()
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className={`w-4 h-4 ${
              isDeadlinePassed() ? 'text-red-500' : 'text-amber-500'
            }`} />
            <Clock className={`w-4 h-4 ${
              isDeadlinePassed() ? 'text-red-500' : 'text-amber-500'
            }`} />
            <span className={`text-sm font-medium ${
              isDeadlinePassed() 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-amber-700 dark:text-amber-300'
            }`}>
              {isDeadlinePassed() 
                ? `Add place deadline expired: ${formatDeadline(currentTrip.addPlaceDeadline)}`
                : `Add place deadline: ${formatDeadline(currentTrip.addPlaceDeadline)}`
              }
            </span>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            My Places
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filteredPlaces.length} places • {filteredPlaces.filter(p => p.scheduled).length} scheduled
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { key: 'all', label: 'All', count: mockPlaces.length },
          { key: 'scheduled', label: 'Scheduled', count: mockPlaces.filter(p => p.scheduled).length },
          { key: 'unscheduled', label: 'Unscheduled', count: mockPlaces.filter(p => !p.scheduled).length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === key
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Places Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-4">
          {filteredPlaces.map((place, index) => (
            <motion.div
              key={place.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative">
                <img
                  src={place.image}
                  alt={place.name}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    place.scheduled
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {place.scheduled ? place.scheduledDate : 'Not scheduled'}
                  </span>
                </div>
              </div>
              
              <div className="p-3 space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2">
                  {place.name}
                </h3>
                
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    categoryColors[place.category as keyof typeof categoryColors] || 'bg-slate-100 text-slate-600'
                  }`}>
                    {place.category}
                  </span>
                  <div className="flex items-center space-x-1">
                    {renderStars(place.wishLevel)}
                  </div>
                </div>
                
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{place.stayDuration}h</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlaces.map((place, index) => (
            <motion.div
              key={place.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start space-x-3">
                <img
                  src={place.image}
                  alt={place.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {place.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          categoryColors[place.category as keyof typeof categoryColors] || 'bg-slate-100 text-slate-600'
                        }`}>
                          {place.category}
                        </span>
                        <div className="flex items-center space-x-1">
                          {renderStars(place.wishLevel)}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {place.address}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      place.scheduled
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {place.scheduled ? place.scheduledDate : 'Not scheduled'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      <span>Stay: {place.stayDuration}h</span>
                    </div>
                    <div className="flex items-center">
                      <span>{'$'.repeat(place.priceLevel)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredPlaces.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No places found
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Add places to your trip to see them here
          </p>
          {!isDeadlinePassed() && (
            <Link
              to="/add-place"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300"
            >
              <Plus className="w-5 h-5" />
              <span>Add Your First Place</span>
            </Link>
          )}
        </div>
      )}

      {/* Floating Add Place Button - only show if deadline hasn't passed */}
      {!isDeadlinePassed() && (
        <Link
          to="/add-place"
          className="fixed bottom-32 right-4 z-40"
        >
          <motion.div
            className="w-14 h-14 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 rounded-full shadow-glow hover:shadow-glow-lg flex items-center justify-center group relative overflow-hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <Plus className="w-6 h-6 text-white relative z-10" />
            
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
              Add Place
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-slate-700"></div>
            </div>
          </motion.div>
        </Link>
      )}
    </div>
  );
}