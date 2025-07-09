import React, { useState } from 'react';
import { X, MapPin, Clock, Plus, Star } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { GooglePlace } from '../services/PlaceSearchService';

interface PlaceInsertionModalProps {
  isOpen: boolean;
  onClose: () => void;
  insertionContext: {
    dayData: any;
    afterPlaceIndex: number;
    beforePlaceIndex: number;
    timeSlot: string;
    nearbyLocation?: {
      lat: number;
      lng: number;
      name: string;
    };
  };
}

const PlaceInsertionModal: React.FC<PlaceInsertionModalProps> = ({
  isOpen,
  onClose,
  insertionContext
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(60); // Default 1 hour
  const [selectedPriority, setSelectedPriority] = useState(5); // Default medium priority
  const [notes, setNotes] = useState('');
  const { currentTrip, addPlace } = useStore();

  const handlePlaceSelect = async (place: GooglePlace) => {
    if (!currentTrip) return;

    try {
      // Calculate suggested time slot based on insertion position
      const afterPlace = insertionContext.dayData.places[insertionContext.afterPlaceIndex];
      const beforePlace = insertionContext.dayData.places[insertionContext.beforePlaceIndex];
      
      // Add the selected place to the trip
      await addPlace({
        id: crypto.randomUUID(),
        name: place.name,
        address: place.formatted_address || place.address || '',
        latitude: place.location.lat,
        longitude: place.location.lng,
        notes: notes || `Added between ${afterPlace?.place_name || afterPlace?.name} and ${beforePlace?.place_name || beforePlace?.name}`,
        category: place.types?.[0] || 'attraction',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trip_id: currentTrip.id,
        tripId: currentTrip.id,
        user_id: useStore.getState().user?.id || '',
        place_type: 'visit',
        wish_level: selectedPriority,
        stay_duration_minutes: selectedDuration,
        is_user_location: true,
        is_selected_for_optimization: true,
        normalized_wish_level: selectedPriority / 10,
        rating: place.rating || 4.0,
        photos: place.photos,
        google_place_id: place.place_id,
        google_rating: place.rating,
        google_price_level: place.price_level,
        estimated_cost: place.price_level ? place.price_level * 1000 : 2000
      });

      // Mark that user has edited the schedule
      useStore.getState().setHasUserEditedSchedule(true);
      
      onClose();
      
      // Reset form
      setSearchValue('');
      setNotes('');
      setSelectedDuration(60);
      setSelectedPriority(5);
    } catch (error) {
      console.error('Failed to add place:', error);
    }
  };

  const getDurationOptions = () => [
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
    { value: 360, label: '6 hours' }
  ];

  const getPriorityOptions = () => [
    { value: 8, label: 'Must Visit', color: 'text-red-600' },
    { value: 6, label: 'High Priority', color: 'text-orange-600' },
    { value: 5, label: 'Medium Priority', color: 'text-yellow-600' },
    { value: 3, label: 'Low Priority', color: 'text-green-600' },
    { value: 1, label: 'Optional', color: 'text-gray-600' }
  ];

  if (!isOpen) return null;

  const afterPlace = insertionContext.dayData?.places[insertionContext.afterPlaceIndex];
  const beforePlace = insertionContext.dayData?.places[insertionContext.beforePlaceIndex];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-0 max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-green-500 to-teal-500 p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-2xl font-bold text-white pr-8">
            Add New Place
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Insert between existing places • {insertionContext.dayData?.date}
          </p>
        </div>

        {/* Context Info */}
        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2 mb-2">
              <span className="font-medium">Inserting between:</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>{afterPlace?.place_name || afterPlace?.name || 'Previous place'}</span>
              </div>
              <div className="flex-1 border-t border-dashed border-gray-300"></div>
              <Plus className="w-4 h-4 text-green-500" />
              <div className="flex-1 border-t border-dashed border-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>{beforePlace?.place_name || beforePlace?.name || 'Next place'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[500px]">
          <div className="space-y-6">
            {/* Place Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search for a place
              </label>
              <PlaceSearchInput
                value={searchValue}
                onChange={setSearchValue}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search attractions, restaurants, museums..."
                searchContext={{
                  location: insertionContext.nearbyLocation ? {
                    lat: insertionContext.nearbyLocation.lat,
                    lng: insertionContext.nearbyLocation.lng
                  } : undefined,
                  radius: 20,
                  types: ['tourist_attraction', 'restaurant', 'museum', 'park', 'shopping_mall']
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Searching near {insertionContext.nearbyLocation?.name || 'current location'}
              </p>
            </div>

            {/* Duration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How long do you want to spend here?
              </label>
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
              >
                {getDurationOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How important is this place to you?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {getPriorityOptions().map(option => (
                  <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value={option.value}
                      checked={selectedPriority === option.value}
                      onChange={(e) => setSelectedPriority(parseInt(e.target.value))}
                      className="text-green-500 focus:ring-green-500"
                    />
                    <div className="flex items-center space-x-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= option.value / 2
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-sm font-medium ${option.color}`}>
                        {option.label}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special notes about this place..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-slate-700 dark:text-white resize-none"
              />
            </div>

            {/* Suggestion */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Pro tip
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Search for places near your existing stops to minimize travel time. 
                    The system will automatically optimize the route when you're done editing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Suggested time: {insertionContext.timeSlot}
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

export default PlaceInsertionModal;