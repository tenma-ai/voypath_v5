import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, MapPin, Calendar, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { GooglePlace } from '../services/PlaceSearchService';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  editMode?: boolean;
  tripData?: any;
}

export function CreateTripModal({ isOpen, onClose, editMode = false, tripData }: CreateTripModalProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    departureLocation: '',
    name: '',
    description: '',
    destination: '',
    startDate: '',
    endDate: '',
  });

  const [selectedDeparture, setSelectedDeparture] = useState<GooglePlace | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<GooglePlace | null>(null);
  const [useSameDeparture, setUseSameDeparture] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  const { createTripWithAPI, updateTrip, canCreateTrip } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when editing
  React.useEffect(() => {
    if (editMode && tripData) {
      setFormData({
        departureLocation: tripData.departureLocation || '',
        name: tripData.name || '',
        description: tripData.description || '',
        destination: tripData.destination || '',
        startDate: tripData.startDate || tripData.start_date || '',
        endDate: tripData.endDate || tripData.end_date || ''
      });

      // Set same departure if destination matches departure
      if (tripData.destination === 'same as departure location' || tripData.destination === tripData.departureLocation) {
        setUseSameDeparture(true);
      }

      // Set selected dates for calendar
      if (tripData.startDate || tripData.start_date) {
        const startDate = new Date(tripData.startDate || tripData.start_date);
        const endDate = new Date(tripData.endDate || tripData.end_date || tripData.startDate || tripData.start_date);
        setSelectedRange({ start: startDate, end: endDate });
      }
    } else {
      // Reset form when not editing
      setFormData({
        departureLocation: '',
        name: '',
        description: '',
        destination: '',
        startDate: '',
        endDate: ''
      });
      setSelectedDeparture(null);
      setSelectedDestination(null);
      setUseSameDeparture(false);
      setSelectedRange({ start: null, end: null });
    }
  }, [editMode, tripData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const departureLocation = selectedDeparture?.formatted_address || formData.departureLocation;
    if (!departureLocation.trim()) {
      alert('Departure location is required');
      return;
    }
    
    // Check if travel dates are selected
    if (!selectedRange.start) {
      alert('Travel dates are required');
      return;
    }
    
    // Check trip creation limits for new trips
    if (!editMode && !canCreateTrip()) {
      alert('You have reached the trip limit for your current plan. Please upgrade to Premium to create more trips.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const finalDestination = useSameDeparture 
        ? 'same as departure location' 
        : (selectedDestination?.formatted_address || formData.destination);
      
      const tripUpdateData: any = {
        ...(editMode && tripData?.id ? { trip_id: tripData.id } : {}),
        departure_location: departureLocation,
        departure_latitude: selectedDeparture?.geometry?.location?.lat || null,
        departure_longitude: selectedDeparture?.geometry?.location?.lng || null,
        destination_latitude: useSameDeparture ? null : (selectedDestination?.geometry?.location?.lat || null),
        destination_longitude: useSameDeparture ? null : (selectedDestination?.geometry?.location?.lng || null),
      };

      // Only include optional fields if they have values
      if (formData.name && formData.name.trim()) {
        tripUpdateData.name = formData.name;
      }
      if (formData.description && formData.description.trim()) {
        tripUpdateData.description = formData.description;
      }
      if (finalDestination && finalDestination.trim()) {
        tripUpdateData.destination = finalDestination;
      }
      if (selectedRange.start) {
        tripUpdateData.start_date = selectedRange.start.toISOString().split('T')[0];
      }
      if (selectedRange.end) {
        tripUpdateData.end_date = selectedRange.end.toISOString().split('T')[0];
      }

      console.log('Trip form data being sent:', tripUpdateData);
      console.log('Edit mode:', editMode, 'Trip ID:', tripData?.id);

      let createdTrip = null;
      
      if (editMode && tripData) {
        // Update existing trip
        await updateTrip(tripData.id, tripUpdateData);
      } else {
        // Create new trip
        console.log('🚀 About to call createTripWithAPI...');
        createdTrip = await createTripWithAPI(tripUpdateData);
        console.log('✅ Created trip result:', createdTrip);
        console.log('✅ Trip ID from result:', createdTrip?.id);
      }
      
      onClose();
      
      // Reset form
      setFormData({
        departureLocation: '',
        name: '',
        description: '',
        destination: '',
        startDate: '',
        endDate: '',
      });
      setSelectedDeparture(null);
      setSelectedDestination(null);
      setSelectedRange({ start: null, end: null });
      setUseSameDeparture(false);
      
      // Navigate to the created trip page
      if (!editMode && createdTrip) {
        console.log('Navigating to trip ID:', createdTrip.id);
        navigate(`/trip/${createdTrip.id}`);
      } else if (!editMode) {
        console.log('Navigation failed - createdTrip:', createdTrip);
      }
    } catch (error) {
      console.error('💥 Trip save error in CreateTripModal:', error);
      console.error('💥 Error details:', {
        type: typeof error,
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      const errorMessage = editMode 
        ? 'Failed to update trip. Please try again.' 
        : 'Failed to create trip. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateInRange = (date: Date) => {
    if (!selectedRange.start || !selectedRange.end) return false;
    return date >= selectedRange.start && date <= selectedRange.end;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedRange.start) return false;
    if (!selectedRange.end) return date.toDateString() === selectedRange.start.toDateString();
    return date.toDateString() === selectedRange.start.toDateString() || 
           date.toDateString() === selectedRange.end.toDateString();
  };

  const handleDateClick = (date: Date) => {
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: date, end: null });
    } else {
      if (date < selectedRange.start) {
        setSelectedRange({ start: date, end: selectedRange.start });
        setShowDatePicker(false);
      } else {
        setSelectedRange({ start: selectedRange.start, end: date });
        setShowDatePicker(false);
      }
    }
  };

  const formatDateRange = () => {
    if (!selectedRange.start) return 'Select dates';
    if (!selectedRange.end) return selectedRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const start = selectedRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = selectedRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  const getDuration = () => {
    if (!selectedRange.start || !selectedRange.end) return null;
    const diffTime = Math.abs(selectedRange.end.getTime() - selectedRange.start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const today = new Date();
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isToday = date.toDateString() === today.toDateString();
      const isPast = date < today;
      const isSelected = isDateSelected(date);
      const isInRange = isDateInRange(date);

      days.push(
        <motion.button
          key={day}
          type="button"
          onClick={() => !isPast && handleDateClick(date)}
          disabled={isPast}
          className={`h-10 w-10 rounded-xl text-sm font-medium transition-all duration-200 relative ${
            isPast
              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : isSelected
              ? 'bg-gradient-to-r from-primary-500 to-secondary-600 text-white shadow-glow'
              : isInRange
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : isToday
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-2 border-primary-300'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          whileHover={!isPast ? { scale: 1.05 } : {}}
          whileTap={!isPast ? { scale: 0.95 } : {}}
        >
          {day}
          {isToday && (
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full" />
          )}
        </motion.button>
      );
    }

    return days;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true" 
          />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full max-w-md max-h-[75vh] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-y-auto"
            >
              {/* Header */}
              <div className="relative p-6 pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-transparent to-secondary-50/50 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-2xl flex items-center justify-center shadow-glow">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <Dialog.Title className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                      {editMode ? 'Edit Trip' : 'Create New Trip'}
                    </Dialog.Title>
                  </div>
                  <motion.button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                  </motion.button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Trip Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Trip Name <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Auto-generated from departure location if empty"
                      className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>

                {/* Departure Location */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <MapPin className="w-4 h-4 inline mr-2 text-primary-500" />
                    Departure Location *
                  </label>
                  <PlaceSearchInput
                    value={formData.departureLocation}
                    onChange={(value) => setFormData({ ...formData, departureLocation: value })}
                    onPlaceSelect={(place) => {
                      setSelectedDeparture(place);
                      setFormData({ ...formData, departureLocation: place.name });
                    }}
                    placeholder="e.g., Tokyo Station, New York JFK"
                    searchContext={{
                      // Remove type filtering to get broader results
                    }}
                  />
                </div>

                {/* Destination */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <MapPin className="w-4 h-4 inline mr-2 text-secondary-500" />
                    Destination <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  
                  {/* Same as departure location option */}
                  <motion.button
                    type="button"
                    onClick={() => {
                      setUseSameDeparture(!useSameDeparture);
                      if (!useSameDeparture) {
                        setFormData({ ...formData, destination: '' });
                        setSelectedDestination(null);
                      }
                    }}
                    className={`w-full p-3 rounded-xl text-left transition-all duration-300 border-2 ${
                      useSameDeparture
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-600/50 text-primary-700 dark:text-primary-300'
                        : 'bg-slate-50/50 dark:bg-slate-700/50 border-slate-200/50 dark:border-slate-600/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/80'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        useSameDeparture
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {useSameDeparture && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 bg-white rounded-full"
                          />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">Same as departure location</div>
                        <div className="text-xs opacity-75">
                          {useSameDeparture && formData.departureLocation 
                            ? `Return to ${formData.departureLocation}`
                            : 'Round trip returning to departure point'
                          }
                        </div>
                      </div>
                    </div>
                  </motion.button>

                  {/* Custom destination input */}
                  {!useSameDeparture && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative"
                    >
                      <PlaceSearchInput
                        value={formData.destination}
                        onChange={(value) => setFormData({ ...formData, destination: value })}
                        onPlaceSelect={(place) => {
                          setSelectedDestination(place);
                          setFormData({ ...formData, destination: place.name });
                        }}
                        placeholder="Enter destination or leave empty"
                        searchContext={{
                          location: selectedDeparture?.geometry.location,
                          // Remove type filtering to get broader results
                        }}
                      />
                    </motion.div>
                  )}
                </div>

                {/* Travel Dates */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <Calendar className="w-4 h-4 inline mr-2 text-secondary-500" />
                    Travel Dates <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-left text-slate-900 dark:text-slate-100 hover:border-primary-300/50 dark:hover:border-primary-600/50 transition-all duration-300"
                    >
                      <span className={selectedRange.start ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
                        {formatDateRange()}
                      </span>
                      {getDuration() && (
                        <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-1 rounded-lg">
                          {getDuration()} day{getDuration() !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    <AnimatePresence>
                      {showDatePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute top-full mt-2 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-glass p-4 z-50"
                        >
                          {/* Calendar Header */}
                          <div className="flex items-center justify-between mb-4">
                            <motion.button
                              type="button"
                              onClick={() => navigateMonth('prev')}
                              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </motion.button>
                            
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            
                            <motion.button
                              type="button"
                              onClick={() => navigateMonth('next')}
                              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </motion.button>
                          </div>

                          {/* Calendar Grid */}
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                              <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-slate-500 dark:text-slate-400">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-7 gap-1">
                            {renderCalendar()}
                          </div>

                          {/* Calendar Footer */}
                          <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRange({ start: null, end: null });
                              }}
                              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDatePicker(false)}
                              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white text-sm rounded-xl hover:from-primary-600 hover:to-secondary-700 transition-all"
                            >
                              Done
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe your trip..."
                      rows={2}
                      className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 resize-none"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <motion.button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-300 font-semibold"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={isSubmitting || !formData.departureLocation.trim() || !selectedRange.start}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 flex items-center justify-center">
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          {editMode ? 'Saving...' : 'Creating...'}
                        </>
                      ) : (
                        editMode ? 'Save Changes' : 'Create Trip'
                      )}
                    </span>
                  </motion.button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}