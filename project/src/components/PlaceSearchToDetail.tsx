/**
 * Place Search to Detail Component
 * Provides direct search -> select -> detail configuration flow
 */

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Calendar, Plus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { DurationSlider } from './DurationSlider';
import { GooglePlace } from '../services/PlaceSearchService';
import { useStore } from '../store/useStore';
import { useNavigate, useLocation } from 'react-router-dom';

interface PlaceSearchToDetailProps {
  onCancel?: () => void;
  onComplete?: () => void;
  className?: string;
}

export function PlaceSearchToDetail({ onCancel, onComplete, className = "" }: PlaceSearchToDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTrip, user, canAddPlace, getUserPlaceCount } = useStore();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<GooglePlace | null>(null);

  // Check if a place was passed from another view
  useEffect(() => {
    if (location.state?.selectedPlace) {
      setSelectedPlace(location.state.selectedPlace);
      // Clear the location state to prevent issues on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  // Form state
  const [formData, setFormData] = useState({
    visitPriority: 3,
    duration: 120, // 2 hours in minutes
    budget: 2,
    timeSlot: 'any',
    visitDate: '',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceSelect = (place: GooglePlace) => {
    if (!user) return;
    
    if (!canAddPlace(user.id, currentTrip?.id)) {
      // Show premium modal or handle limit
      return;
    }
    
    setSelectedPlace(place);
  };

  const handleSubmit = async () => {
    if (!selectedPlace) return;
    
    setIsSubmitting(true);
    try {
      // Handle form submission
      console.log('Submitting place:', selectedPlace, formData);
      
      // Here you would add the place to the trip
      // await addPlaceToTrip(selectedPlace, formData);
      
      if (onComplete) {
        onComplete();
      } else {
        navigate('/my-trip/my-places');
      }
    } catch (error) {
      console.error('Failed to add place:', error);
      alert('Failed to add place. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (selectedPlace) {
      setSelectedPlace(null);
      setSearchQuery('');
    } else if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : 'text-slate-300 dark:text-slate-600'
        }`}
      />
    ));
  };

  const renderPriorityStars = (priority: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <motion.button
        key={i}
        type="button"
        onClick={() => setFormData({ ...formData, visitPriority: i + 1 })}
        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Star
          className={`w-6 h-6 transition-colors ${
            i < priority
              ? 'text-yellow-400 fill-current'
              : 'text-slate-300 dark:text-slate-600 hover:text-yellow-300'
          }`}
        />
      </motion.button>
    ));
  };

  const userPlaceCount = user ? getUserPlaceCount(user.id, currentTrip?.id) : 0;
  const canAdd = user ? canAddPlace(user.id, currentTrip?.id) : false;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 ${className}`}>
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 p-4">
        <div className="flex items-center space-x-4">
          <motion.button
            onClick={handleCancel}
            className="p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </motion.button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            {selectedPlace ? 'Configure Place' : 'Search Places'}
          </h1>
        </div>

        {/* Place Limit Info */}
        {!selectedPlace && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            {userPlaceCount}/10 places used
          </div>
        )}
      </div>

      <div className="p-4 lg:p-6 space-y-8 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {!selectedPlace ? (
            // Search Phase
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-3xl blur-xl opacity-0 focus-within:opacity-100 transition-opacity duration-500"></div>
                <PlaceSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Search for places, attractions, restaurants..."
                  className="text-lg py-5 pl-14 pr-4 rounded-3xl"
                  searchContext={{
                    radius: 50,
                  }}
                />
              </div>
            </motion.div>
          ) : (
            // Detail Configuration Phase
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Selected Place Summary */}
              <div className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-900/20 dark:via-slate-800/80 dark:to-secondary-900/20 backdrop-blur-xl rounded-3xl p-6 border border-primary-200/50 dark:border-primary-800/50 shadow-glass">
                <div className="flex items-start space-x-4">
                  {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
                    <img
                      src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${selectedPlace.photos[0].photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                      alt={selectedPlace.name}
                      className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-medium"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center flex-shrink-0 shadow-medium">
                      <MapPin className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                      {selectedPlace.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
                      {selectedPlace.formatted_address}
                    </p>
                    {selectedPlace.rating && (
                      <div className="flex items-center space-x-1">
                        {renderStars(selectedPlace.rating)}
                        <span className="text-sm text-slate-600 dark:text-slate-400 ml-1">
                          {selectedPlace.rating} {selectedPlace.user_ratings_total && `(${selectedPlace.user_ratings_total} reviews)`}
                        </span>
                      </div>
                    )}
                  </div>
                  <motion.button
                    onClick={() => setSelectedPlace(null)}
                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    Change
                  </motion.button>
                </div>
              </div>

              {/* Configuration Form */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-glass space-y-8">
                {/* Visit Priority */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Visit Priority
                  </label>
                  <div className="flex items-center space-x-2">
                    {renderPriorityStars(formData.visitPriority)}
                    <span className="ml-4 text-sm text-slate-600 dark:text-slate-400">
                      {formData.visitPriority === 1 && 'Low priority'}
                      {formData.visitPriority === 2 && 'Below average'}
                      {formData.visitPriority === 3 && 'Average priority'}
                      {formData.visitPriority === 4 && 'High priority'}
                      {formData.visitPriority === 5 && 'Must visit!'}
                    </span>
                  </div>
                </div>

                {/* Duration Slider */}
                <DurationSlider
                  value={formData.duration}
                  onChange={(duration) => setFormData({ ...formData, duration })}
                />

                {/* Visit Date */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <Calendar className="w-4 h-4 inline mr-2 text-primary-500" />
                    When to Visit
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.visitDate}
                      onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                      min="2024-05-15"
                      max="2024-05-22"
                      className="w-full px-4 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 cursor-pointer hover:border-primary-300/50 dark:hover:border-primary-600/50"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select a date within your trip period (May 15-22, 2024)
                  </p>
                </div>

                {/* Budget Level */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Budget Level
                  </label>
                  <div className="flex space-x-3">
                    {[1, 2, 3, 4].map((level) => (
                      <motion.button
                        key={level}
                        type="button"
                        onClick={() => setFormData({ ...formData, budget: level })}
                        className={`px-4 py-3 rounded-2xl border-2 transition-all duration-300 font-semibold ${
                          formData.budget === level
                            ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-glow'
                            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {'$'.repeat(level)}
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    $ = Budget-friendly, $$ = Moderate, $$$ = Expensive, $$$$ = Luxury
                  </p>
                </div>

                {/* Preferred Time */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Preferred Time
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'morning', label: 'Morning', icon: '🌅' },
                      { key: 'afternoon', label: 'Afternoon', icon: '☀️' },
                      { key: 'evening', label: 'Evening', icon: '🌆' },
                      { key: 'any', label: 'Any time', icon: '🕐' }
                    ].map((time) => (
                      <motion.button
                        key={time.key}
                        type="button"
                        onClick={() => setFormData({ ...formData, timeSlot: time.key })}
                        className={`p-4 rounded-2xl border-2 text-sm font-semibold transition-all duration-300 ${
                          formData.timeSlot === time.key
                            ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-glow'
                            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="text-2xl mb-2">{time.icon}</div>
                        {time.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Notes
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add notes about this place..."
                      rows={4}
                      className="w-full px-4 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 resize-none"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-4">
                  <motion.button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-6 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-300 font-semibold"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" />
                      <span>{isSubmitting ? 'Adding...' : 'Add to My Places'}</span>
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}