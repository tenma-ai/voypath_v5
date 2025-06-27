import React, { useState, useEffect } from 'react';
import { Grid3X3, List, Star, Clock, AlertCircle, Plus, Edit, Trash2, MoreVertical, CheckCircle, HelpCircle, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { PlaceImage } from '../components/PlaceImage';

export function MyPlacesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'trip' | 'my'>('my');
  const [filter, setFilter] = useState('all');
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    wishLevel: 5,
    stayDuration: 2,
    notes: ''
  });
  const { places, currentTrip, trips, initializeFromDatabase, updatePlace, deletePlace, hasUserOptimized, tripMembers, user } = useStore();

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

  // Get all trip places and my places separately
  const { user } = useStore();
  
  // All places for the current trip (from all users)
  const allTripPlaces = places.filter(place => {
    const isCurrentTrip = currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false;
    return isCurrentTrip;
  });
  
  // Only my places for the current trip
  const myTripPlaces = allTripPlaces.filter(place => {
    const isMyPlace = place.user_id === user?.id || place.userId === user?.id;
    return isMyPlace;
  });
  
  // Choose which places to display based on active tab
  let displayPlaces;
  if (activeTab === 'trip') {
    // Trip places: All members' Scheduled places aggregated
    displayPlaces = allTripPlaces.filter(place => {
      // Filter out system transportation places
      const isSystemTransport = 
        place.place_type === 'departure' || 
        place.place_type === 'destination' ||
        place.category === 'departure_point' ||
        place.category === 'destination_point' ||
        place.category === 'transportation' ||
        place.source === 'system';
      
      if (isSystemTransport) return false;
      
      // Only show scheduled places in trip view
      return place.scheduled || place.is_selected_for_optimization;
    });
  } else {
    // My places: All my places regardless of status
    displayPlaces = myTripPlaces.filter(place => {
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
  }

  const getPlaceStatus = (place: any) => {
    // Correct Places definitions according to requirements:
    // Pending: Self-added but Optimize button not executed
    // Scheduled: Optimize button executed and adopted as group place  
    // Unscheduled: Optimize button executed but not adopted as group place
    
    if (!hasUserOptimized) {
      // If user hasn't run optimization yet, all user places are pending
      return 'pending';
    }
    
    // After optimization has been run:
    if (place.scheduled || place.is_selected_for_optimization) {
      // Place was adopted by the optimization algorithm
      return 'scheduled';
    } else {
      // Place was not adopted by the optimization algorithm
      return 'unscheduled';
    }
  };
  
  const filteredPlaces = displayPlaces.filter(place => {
    const status = getPlaceStatus(place);
    
    if (filter === 'scheduled') return status === 'scheduled';
    if (filter === 'unscheduled') return status === 'unscheduled';
    if (filter === 'pending') return status === 'pending';
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

  const handleEditPlace = (place: any) => {
    // Convert place to GooglePlace format for PlaceSearchToDetail
    const googlePlaceFormat = {
      place_id: place.place_id || place.id,
      name: place.name,
      address: place.address,
      location: {
        lat: place.latitude,
        lng: place.longitude
      },
      rating: place.rating,
      photos: place.photos || [],
      types: place.category ? [place.category] : []
    };

    // Navigate to add-place page with the selected place pre-populated
    navigate('/add-place', { 
      state: { 
        selectedPlace: googlePlaceFormat,
        editMode: true,
        originalPlaceId: place.id
      } 
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPlace) return;
    
    try {
      await updatePlace(editingPlace, {
        name: editForm.name,
        category: editForm.category,
        wishLevel: editForm.wishLevel,
        stayDuration: editForm.stayDuration,
        notes: editForm.notes
      });
      setEditingPlace(null);
    } catch (error) {
      alert('Failed to update place. Please try again.');
    }
  };

  const handleDeletePlace = async (placeId: string, placeName: string) => {
    if (confirm(`Are you sure you want to delete "${placeName}"?`)) {
      try {
        await deletePlace(placeId);
      } catch (error) {
        alert('Failed to delete place. Please try again.');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingPlace(null);
    setEditForm({
      name: '',
      category: '',
      wishLevel: 5,
      stayDuration: 2,
      notes: ''
    });
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
            {activeTab === 'trip' ? 'All team places' : 'My places'} • {filteredPlaces.length} total
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

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('trip')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'trip'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Trip Places ({allTripPlaces.filter(p => {
            const isSystemTransport = p.place_type === 'departure' || p.place_type === 'destination' || p.category === 'transportation' || p.source === 'system';
            return !isSystemTransport && (p.scheduled || p.is_selected_for_optimization);
          }).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'my'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>My Places ({myTripPlaces.filter(p => {
            const isSystemTransport = p.place_type === 'departure' || p.place_type === 'destination' || p.category === 'transportation' || p.source === 'system';
            return !isSystemTransport;
          }).length})</span>
        </button>
      </div>

      {/* Status Filters - Only show for My Places tab */}
      {activeTab === 'my' && (
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { key: 'all', label: 'All', count: displayPlaces.length, icon: null },
            { 
              key: 'scheduled', 
              label: 'Scheduled', 
              count: displayPlaces.filter(p => getPlaceStatus(p) === 'scheduled').length,
              icon: CheckCircle,
              color: 'text-green-600'
            },
            { 
              key: 'pending', 
              label: 'Pending', 
              count: displayPlaces.filter(p => getPlaceStatus(p) === 'pending').length,
              icon: HelpCircle,
              color: 'text-yellow-600'
            },
            { 
              key: 'unscheduled', 
              label: 'Unscheduled', 
              count: displayPlaces.filter(p => getPlaceStatus(p) === 'unscheduled').length,
              icon: Clock,
              color: 'text-slate-600'
            },
          ].map(({ key, label, count, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {Icon && <Icon className={`w-4 h-4 ${filter === key ? '' : color || ''}`} />}
              <span>{label} ({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Places Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
                  className="w-full h-24 sm:h-32 object-cover"
                />
                <div className="absolute top-1 sm:top-2 right-1 sm:right-2">
                  {(() => {
                    const status = getPlaceStatus(place);
                    const statusConfig = {
                      scheduled: { 
                        bg: 'bg-green-100 dark:bg-green-900/20', 
                        text: 'text-green-800 dark:text-green-300',
                        icon: CheckCircle,
                        label: place.scheduledDate || 'Scheduled'
                      },
                      pending: { 
                        bg: 'bg-yellow-100 dark:bg-yellow-900/20', 
                        text: 'text-yellow-800 dark:text-yellow-300',
                        icon: HelpCircle,
                        label: 'Pending'
                      },
                      unscheduled: { 
                        bg: 'bg-slate-100 dark:bg-slate-700', 
                        text: 'text-slate-600 dark:text-slate-400',
                        icon: Clock,
                        label: 'Unscheduled'
                      }
                    };
                    const config = statusConfig[status as keyof typeof statusConfig];
                    const IconComponent = config.icon;
                    
                    return (
                      <div className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                        <IconComponent className="w-3 h-3" />
                        <span className="hidden sm:inline">{config.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm line-clamp-2 flex-1 pr-1 sm:pr-2">
                    {place.name}
                  </h3>
                  <div className="flex space-x-0.5 sm:space-x-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPlace(place);
                      }}
                      className="p-0.5 sm:p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Edit className="w-3 h-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlace(place.id, place.name);
                      }}
                      className="p-0.5 sm:p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-red-500 hover:text-red-600" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-1">
                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium truncate flex-shrink ${
                    categoryColors[place.category as keyof typeof categoryColors] || 'bg-slate-100 text-slate-600'
                  }`}>
                    {place.category}
                  </span>
                  <div className="flex items-center space-x-0.5 flex-shrink-0">
                    {renderStars(place.wish_level || place.wishLevel || 0)}
                  </div>
                </div>
                
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{place.stay_duration_minutes ? (place.stay_duration_minutes / 60) : (place.stayDuration || 2)}h</span>
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
                          {renderStars(place.wish_level || place.wishLevel || 0)}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {place.address}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {(() => {
                        const status = getPlaceStatus(place);
                        const statusConfig = {
                          scheduled: { 
                            bg: 'bg-green-100 dark:bg-green-900/20', 
                            text: 'text-green-800 dark:text-green-300',
                            icon: CheckCircle,
                            label: place.scheduledDate || 'Scheduled'
                          },
                          pending: { 
                            bg: 'bg-yellow-100 dark:bg-yellow-900/20', 
                            text: 'text-yellow-800 dark:text-yellow-300',
                            icon: HelpCircle,
                            label: 'Pending'
                          },
                          unscheduled: { 
                            bg: 'bg-slate-100 dark:bg-slate-700', 
                            text: 'text-slate-600 dark:text-slate-400',
                            icon: Clock,
                            label: 'Unscheduled'
                          }
                        };
                        const config = statusConfig[status as keyof typeof statusConfig];
                        const IconComponent = config.icon;
                        
                        return (
                          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                            <IconComponent className="w-3 h-3" />
                            <span>{config.label}</span>
                          </div>
                        );
                      })()}
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlace(place);
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlace(place.id, place.name);
                          }}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
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
            {activeTab === 'trip' ? 'No trip places found' : 'No places found'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {activeTab === 'trip' 
              ? 'No places have been added to this trip yet'
              : 'Add places to your wishlist to see them here'
            }
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

      {/* Edit Place Modal */}
      {editingPlace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Edit Place
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="Temple">Temple</option>
                  <option value="Shrine">Shrine</option>
                  <option value="Attraction">Attraction</option>
                  <option value="Food">Food</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Wish Level (1-10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editForm.wishLevel}
                  onChange={(e) => setEditForm({ ...editForm, wishLevel: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>1</span>
                  <span className="font-medium">{editForm.wishLevel}</span>
                  <span>10</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Stay Duration (hours)
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={editForm.stayDuration}
                  onChange={(e) => setEditForm({ ...editForm, stayDuration: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="Add any notes about this place..."
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.name.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}