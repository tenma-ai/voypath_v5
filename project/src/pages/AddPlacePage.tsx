import React, { useState } from 'react';
import { Search, Plus, MapPin, Star, Clock, ArrowLeft, Calendar, AlertCircle, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DurationSlider } from '../components/DurationSlider';
import { PremiumModal } from '../components/PremiumModal';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

const mockSearchResults = [
  {
    id: '1',
    name: 'Tokyo National Museum',
    category: 'Museum',
    address: '13-9 Uenokoen, Taito City, Tokyo',
    rating: 4.3,
    reviews: 2847,
    distance: '2.1 km',
    image: 'https://images.unsplash.com/photo-1554072675-66db59dba46f?w=300&h=200&fit=crop'
  },
  {
    id: '2',
    name: 'Ueno Park',
    category: 'Park',
    address: 'Uenokoen, Taito City, Tokyo',
    rating: 4.2,
    reviews: 5234,
    distance: '1.8 km',
    image: 'https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?w=300&h=200&fit=crop'
  },
  {
    id: '3',
    name: 'Ameya-Yokocho Market',
    category: 'Market',
    address: '4-9-14 Ueno, Taito City, Tokyo',
    rating: 4.0,
    reviews: 1523,
    distance: '1.5 km',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop'
  }
];

export function AddPlacePage() {
  const navigate = useNavigate();
  const { currentTrip, user, canAddPlace, getUserPlaceCount } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [formData, setFormData] = useState({
    visitPriority: 3,
    duration: 120, // 2 hours in minutes
    budget: 2,
    timeSlot: 'any',
    visitDate: '',
    notes: ''
  });

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

  const handleSearch = () => {
    setIsSearching(true);
    // Simulate search
    setTimeout(() => {
      setIsSearching(false);
    }, 1000);
  };

  const handlePlaceSelect = (place: any) => {
    if (!user) return;
    
    if (!canAddPlace(user.id, currentTrip?.id)) {
      setShowPremiumModal(true);
      return;
    }
    
    setSelectedPlace(place);
  };

  const handleSubmit = () => {
    // Handle form submission
    console.log('Submitting place:', selectedPlace, formData);
    navigate('/my-trip/my-places');
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

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const userPlaceCount = user ? getUserPlaceCount(user.id, currentTrip?.id) : 0;
  const canAdd = user ? canAddPlace(user.id, currentTrip?.id) : false;
  const isPremium = user?.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

  // If deadline has passed, show deadline message
  if (isDeadlinePassed()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 border border-red-200/50 dark:border-red-800/50 text-center"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Add Place Deadline Passed
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            The deadline for adding new places has passed.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">
            Deadline was: {formatDeadline(currentTrip?.addPlaceDeadline || '')}
          </p>
          <motion.button
            onClick={() => navigate('/my-trip')}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-2xl hover:from-primary-600 hover:to-secondary-700 transition-all duration-300 font-semibold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Back to Trip
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 p-4">
        <div className="flex items-center space-x-4">
          <motion.button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </motion.button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            Add Place
          </h1>
        </div>

        {/* Place Limit Warning */}
        {!isPremium && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-3 rounded-xl border ${
              canAdd
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {canAdd ? (
                <MapPin className="w-4 h-4 text-blue-500" />
              ) : (
                <Crown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                canAdd 
                  ? 'text-blue-700 dark:text-blue-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {canAdd 
                  ? `${userPlaceCount}/10 places used`
                  : `Limit reached: ${userPlaceCount}/10 places. Upgrade to Premium for unlimited places.`
                }
              </span>
            </div>
          </motion.div>
        )}

        {/* Deadline Warning */}
        {currentTrip?.addPlaceDeadline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Add place deadline: {formatDeadline(currentTrip.addPlaceDeadline)}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 lg:p-6 space-y-8 max-w-4xl mx-auto">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-3xl blur-xl opacity-0 focus-within:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for places, attractions, restaurants..."
                className="w-full pl-14 pr-20 py-5 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-3xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-6 h-6 text-slate-400" />
              {searchQuery && (
                <motion.button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white text-sm rounded-2xl hover:from-primary-600 hover:to-secondary-700 transition-all duration-300 disabled:opacity-50 font-semibold shadow-glow"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </motion.button>
              )}
            </div>
          </div>

          {/* Search Results */}
          {!selectedPlace && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mockSearchResults.map((place, index) => (
                  <motion.div
                    key={place.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handlePlaceSelect(place)}
                    className={`group bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/50 p-4 hover:shadow-glow hover:border-primary-300/50 dark:hover:border-primary-600/50 transition-all duration-300 cursor-pointer overflow-hidden ${
                      !canAdd ? 'opacity-60' : ''
                    }`}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    <div className="relative mb-4">
                      <img
                        src={place.image}
                        alt={place.name}
                        className="w-full h-32 rounded-2xl object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                      <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-2 py-1">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {place.distance}
                        </span>
                      </div>
                      {!canAdd && (
                        <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                          <Crown className="w-8 h-8 text-yellow-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {place.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {place.category}
                        </p>
                      </div>
                      
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {place.address}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          {renderStars(place.rating)}
                          <span className="text-sm text-slate-600 dark:text-slate-400 ml-1">
                            {place.rating}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {place.reviews} reviews
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Place Details Form */}
        <AnimatePresence>
          {selectedPlace && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Selected Place Summary */}
              <div className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-900/20 dark:via-slate-800/80 dark:to-secondary-900/20 backdrop-blur-xl rounded-3xl p-6 border border-primary-200/50 dark:border-primary-800/50 shadow-glass">
                <div className="flex items-start space-x-4">
                  <img
                    src={selectedPlace.image}
                    alt={selectedPlace.name}
                    className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-medium"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                      {selectedPlace.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
                      {selectedPlace.address}
                    </p>
                    <div className="flex items-center space-x-1">
                      {renderStars(selectedPlace.rating)}
                      <span className="text-sm text-slate-600 dark:text-slate-400 ml-1">
                        {selectedPlace.rating} ({selectedPlace.reviews} reviews)
                      </span>
                    </div>
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

              {/* Form */}
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
                    onClick={() => setSelectedPlace(null)}
                    className="flex-1 px-6 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-300 font-semibold"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleSubmit}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg relative overflow-hidden group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" />
                      <span>Add to My Places</span>
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="places"
      />
    </div>
  );
}