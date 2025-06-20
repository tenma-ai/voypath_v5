import React, { useState, useEffect } from 'react';
import { Grid3X3, List, Star, Clock, AlertCircle, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PlaceImage } from '../components/PlaceImage';

export function MyPlacesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('all');
  const { places, currentTrip, trips, initializeFromDatabase } = useStore();

  // Check if deadline has passed
  const isDeadlinePassed = () => {
    if (!currentTrip?.addPlaceDeadline) return false;
    return new Date() > new Date(currentTrip.addPlaceDeadline);
  };

  const formatDeadline = (deadline: string) => {
    try {
      const date = new Date(deadline);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Load data from database on component mount and when currentTrip changes
  useEffect(() => {
    const loadPlacesForCurrentTrip = async () => {
      if (currentTrip) {
        try {
          const { loadPlacesFromDatabase } = useStore.getState();
          await loadPlacesFromDatabase(currentTrip.id);
          console.log(`📍 Loaded places for trip: ${currentTrip.name}`);
        } catch (error) {
          console.error('Failed to load places from database:', error);
        }
      }
    };

    // Always load places when currentTrip changes or when component mounts
    loadPlacesForCurrentTrip();
  }, [currentTrip?.id]); // Re-run when currentTrip changes

  // Filter places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );

  // Exclude departure and destination places from MyPlaces view
  const displayPlaces = tripPlaces.filter(place => {
    // Filter out system transportation places
    const isSystemTransport = 
      place.place_type === 'departure' || 
      place.place_type === 'destination' ||
      place.category === 'departure_point' ||
      place.category === 'destination_point' ||
      place.category === 'transportation' ||
      place.source === 'system';
    
    return !isSystemTransport;
  });

  const filteredPlaces = displayPlaces.filter(place => {
    // Use database field is_selected_for_optimization for scheduled status
    const isScheduled = place.is_selected_for_optimization || false;
    
    if (filter === 'scheduled') return isScheduled;
    if (filter === 'unscheduled') return !isScheduled;
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

  // Show message if no trip is selected
  if (!currentTrip) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No Trip Selected
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Please select a trip from the home page to view and manage places
          </p>
          <Link 
            to="/"
            className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

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
            {currentTrip.name || `${currentTrip.departureLocation} Trip`} - Places
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filteredPlaces.length} places • {filteredPlaces.filter(p => 
              p.is_selected_for_optimization !== undefined 
                ? p.is_selected_for_optimization 
                : p.scheduled
            ).length} scheduled
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
          { key: 'all', label: 'All', count: displayPlaces.length },
          { 
            key: 'scheduled', 
            label: 'Scheduled', 
            count: displayPlaces.filter(p => p.is_selected_for_optimization !== undefined 
              ? p.is_selected_for_optimization 
              : p.scheduled).length 
          },
          { 
            key: 'unscheduled', 
            label: 'Unscheduled', 
            count: displayPlaces.filter(p => p.is_selected_for_optimization !== undefined 
              ? !p.is_selected_for_optimization 
              : !p.scheduled).length 
          },
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
                <PlaceImage
                  placeName={place.name}
                  fallbackUrl={place.image_url || place.image || '/api/placeholder/400/300'}
                  alt={place.name}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute top-2 right-2">
                  {(() => {
                    const isScheduled = place.is_selected_for_optimization || place.scheduled;
                    return (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isScheduled
                          ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {isScheduled ? (place.scheduledDate || 'Scheduled') : 'Not scheduled'}
                      </span>
                    );
                  })()}
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
                <PlaceImage
                  placeName={place.name}
                  fallbackUrl={place.image_url || place.image || '/api/placeholder/400/300'}
                  alt={place.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  size="small"
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

    </div>
  );
}