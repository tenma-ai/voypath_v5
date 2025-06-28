/**
 * Place Search to Detail Component
 * Provides direct search -> select -> detail configuration flow
 */

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Calendar, Plus, ArrowLeft, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { DurationSlider } from './DurationSlider';
import { useStore } from '../store/useStore';
import { GooglePlace } from '../services/PlaceSearchService';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlaceDateUtils } from '../utils/PlaceDateUtils';

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

  // Check if a place was passed from another view (including edit mode)
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalPlaceId, setOriginalPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.selectedPlace) {
      setSelectedPlace(location.state.selectedPlace);
      
      // Check if this is edit mode
      if (location.state?.editMode) {
        setIsEditMode(true);
        setOriginalPlaceId(location.state?.originalPlaceId || null);
        
        // If edit mode, load existing place data into form
        // This would typically come from the place data in the database
        // For now, using reasonable defaults but this should be enhanced
        setFormData({
          visitPriority: 3, // Should be loaded from existing place
          duration: 120,    // Should be loaded from existing place  
          budget: 2,
          timeSlot: 'any',
          visitDate: '',
          notes: ''         // Should be loaded from existing place
        });
      }
      
      // Clear the location state to prevent issues on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  // Form state - Initialize visitDate based on trip dates
  const getInitialVisitDate = () => {
    return PlaceDateUtils.getInitialPlaceDate(currentTrip);
  };
  
  const [formData, setFormData] = useState({
    visitPriority: 3,
    duration: 120, // 2 hours in minutes
    budget: 2,
    timeSlot: 'any',
    visitDate: getInitialVisitDate(),
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
      console.log('Submitting place:', selectedPlace, formData, 'Edit mode:', isEditMode);
      
      // Generate proper UUID for place
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      // Get current user and trip from store
      const { user, currentTrip, addPlace, updatePlace } = useStore.getState();
      
      if (!user || !currentTrip) {
        throw new Error('User and trip required');
      }
      
      if (isEditMode && originalPlaceId) {
        // Edit existing place
        await updatePlace(originalPlaceId, {
          name: selectedPlace.name,
          category: 'attraction', // Should preserve existing or allow editing
          wishLevel: formData.visitPriority,
          stayDuration: formData.duration / 60, // Convert minutes to hours for UI
          notes: formData.notes || '',
          wish_level: formData.visitPriority,
          stay_duration_minutes: formData.duration,
          updated_at: new Date().toISOString()
        });
        console.log('Place updated successfully:', originalPlaceId);
      } else {
        // Create new place object with proper structure
        const newPlace = {
          id: generateUUID(),
          name: selectedPlace.name,
          category: 'attraction', // Default category
          address: selectedPlace.formatted_address || '',
          latitude: typeof selectedPlace.geometry?.location?.lat === 'function' 
            ? selectedPlace.geometry.location.lat()
            : selectedPlace.geometry?.location?.lat || 0,
          longitude: typeof selectedPlace.geometry?.location?.lng === 'function'
            ? selectedPlace.geometry.location.lng()
            : selectedPlace.geometry?.location?.lng || 0,
          rating: selectedPlace.rating || 0,
          wishLevel: formData.visitPriority,
          stayDuration: formData.duration / 60, // Convert minutes to hours for UI
          priceLevel: selectedPlace.price_level || formData.budget,
          scheduled: false,
          visitDate: formData.visitDate || undefined,
          notes: formData.notes || '',
          tripId: currentTrip.id,
          userId: user.id,
          // Additional properties to match database schema
          wish_level: formData.visitPriority,
          stay_duration_minutes: formData.duration,
          trip_id: currentTrip.id,
          user_id: user.id,
          google_place_id: selectedPlace.place_id,
          google_rating: selectedPlace.rating,
          google_price_level: selectedPlace.price_level,
          google_types: selectedPlace.types,
          estimated_cost: formData.budget * 10, // Rough estimate
          image_url: selectedPlace.photos && selectedPlace.photos.length > 0 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${selectedPlace.photos[0].photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
            : undefined,
          images: selectedPlace.photos ? selectedPlace.photos.map(photo => 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
          ) : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Add to store
        await addPlace(newPlace);
        console.log('Place added successfully:', newPlace);
      }
      
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
            {isEditMode ? 'Edit Place' : 'Configure Place'}
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
        {/* Unified Search and Configure Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Place Search */}
          <div className="space-y-6">
            {!isEditMode ? (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Search Places
                </h2>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-3xl blur-xl opacity-0 focus-within:opacity-100 transition-opacity duration-500"></div>
                  <PlaceSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Search for places, attractions, restaurants..."
                    className="text-lg py-4 pl-12 pr-4 rounded-2xl w-full"
                    searchContext={{
                      radius: 50,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Editing Place
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Update the details for this place below
                </p>
              </div>
            )}

            {/* Selected Place Preview */}
            {selectedPlace && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-900/20 dark:via-slate-800/80 dark:to-secondary-900/20 backdrop-blur-xl rounded-3xl p-4 border border-primary-200/50 dark:border-primary-800/50 shadow-glass"
              >
                <div className="flex items-start space-x-3">
                  {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
                    <img
                      src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${selectedPlace.photos[0].photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                      alt={selectedPlace.name}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-medium"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/40 dark:to-secondary-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {selectedPlace.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {selectedPlace.formatted_address}
                    </p>
                    {selectedPlace.rating && (
                      <div className="flex items-center mt-2 space-x-1">
                        <div className="flex space-x-0.5">
                          {renderStars(selectedPlace.rating)}
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">
                          ({selectedPlace.rating})
                        </span>
                      </div>
                    )}
                  </div>
                  <motion.button
                    onClick={() => {
                      setSelectedPlace(null);
                      setSearchQuery('');
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <span className="text-slate-400 text-sm">✕</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Configuration */}
          <div className="space-y-6">
            {selectedPlace ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Configure Place
                </h2>
                
                {/* Configuration Form */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-glass space-y-6">
                  {/* Visit Priority */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>Visit Priority</span>
                    </label>
                    <div className="flex space-x-1">
                      {renderPriorityStars(formData.visitPriority)}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Duration: {Math.floor(formData.duration / 60)}h {formData.duration % 60}m</span>
                    </label>
                    <DurationSlider
                      value={formData.duration}
                      onChange={(duration) => setFormData({ ...formData, duration })}
                      className="w-full"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Notes
                    </label>
                    <div className="relative">
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Add notes about this place..."
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 resize-none"
                      />
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 pt-4">
                    <motion.button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 px-6 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-300 font-semibold"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                      whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        <Plus className="w-5 h-5" />
                        <span>{isSubmitting ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add')}</span>
                      </span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <motion.div
                  className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-4"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                >
                  <Search className="w-8 h-8 text-slate-400" />
                </motion.div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Search for a place
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Use the search box to find places, then configure the details here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}