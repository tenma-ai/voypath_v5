import React, { useState, useEffect } from 'react';
import { Grid3X3, List, Star, Clock, AlertCircle, Plus, Edit, Trash2, MoreVertical, CheckCircle, HelpCircle, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { PlaceImage } from '../components/PlaceImage';
import { DateUtils } from '../utils/DateUtils';

export function MyPlacesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'trip' | 'my'>('my');
  const [filter, setFilter] = useState('all');
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    wishLevel: 5,
    stayDuration: 2,
    notes: ''
  });
  const { places, currentTrip, trips, initializeFromDatabase, updatePlace, deletePlace, hasUserOptimized, tripMembers, user, memberColors } = useStore();

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
  }).sort((a, b) => {
    // Sort by status first (Scheduled → Pending → Unscheduled), then by visit order
    const statusA = getPlaceStatus(a);
    const statusB = getPlaceStatus(b);
    
    const statusPriority = { 'scheduled': 0, 'pending': 1, 'unscheduled': 2 };
    const priorityDiff = statusPriority[statusA as keyof typeof statusPriority] - statusPriority[statusB as keyof typeof statusPriority];
    
    if (priorityDiff !== 0) return priorityDiff;
    
    // Within same status, sort by visit order (scheduled_date or created_at)
    const dateA = a.scheduled_date || a.scheduledDate || a.created_at;
    const dateB = b.scheduled_date || b.scheduledDate || b.created_at;
    
    if (dateA && dateB) {
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }
    
    return 0;
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

  const handleCardFlip = (placeId: string) => {
    const newFlippedCards = new Set(flippedCards);
    if (newFlippedCards.has(placeId)) {
      newFlippedCards.delete(placeId);
    } else {
      newFlippedCards.add(placeId);
    }
    setFlippedCards(newFlippedCards);
  };

  // Get member info for a place
  const getMemberInfo = (place: any) => {
    const userId = place.user_id || place.userId;
    if (!userId) return { name: 'Unknown', color: '#6B7280' };
    
    const member = tripMembers.find(m => m.user_id === userId);
    const memberColor = memberColors[userId] || '#6B7280';
    
    return {
      name: member?.name || 'Unknown Member',
      color: memberColor
    };
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

      {/* Enhanced Header with Status Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {currentTrip.name || `${currentTrip.departureLocation} Trip`}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
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
              title="Grid View"
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
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
        
      </div>

      {/* Enhanced Tab Navigation */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('trip')}
          className={`flex-1 flex items-center justify-center space-x-3 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'trip'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-lg transform scale-105'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Users className="w-5 h-5" />
          <div className="text-left">
            <div className="font-semibold">Trip Places</div>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex items-center justify-center space-x-3 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'my'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-lg transform scale-105'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Star className="w-5 h-5" />
          <div className="text-left">
            <div className="font-semibold">My Places</div>
          </div>
        </button>
      </div>


      {/* Add Place Quick Action */}
      {activeTab === 'my' && (
        <div className="flex justify-center">
          <Link
            to="/add-place"
            className="inline-flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-xl hover:from-primary-600 hover:to-secondary-700 transition-all transform hover:scale-105 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Add New Place</span>
          </Link>
        </div>
      )}

      {/* Places Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredPlaces.map((place, index) => {
            const isFlipped = flippedCards.has(place.id);
            const status = getPlaceStatus(place);
            const memberInfo = getMemberInfo(place);
            
            return (
              <motion.div
                key={place.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
                style={{ perspective: '1000px', height: '250px' }}
                onClick={() => handleCardFlip(place.id)}
              >
                <div 
                  className={`relative w-full h-full transition-transform duration-500 transform-gpu ${isFlipped ? 'rotate-y-180' : ''}`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Front Side */}
                  <div 
                    className="absolute inset-0 w-full h-full backface-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="relative h-3/5">
                      <PlaceImage
                        placeName={place.name}
                        fallbackUrl={place.image_url || place.image}
                        alt={place.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Status Badge - Only show for My Places */}
                      {activeTab === 'my' && (
                        <div className="absolute top-2 right-2">
                          {(() => {
                            const statusConfig = {
                              scheduled: { 
                                bg: 'bg-green-100 dark:bg-green-900/20', 
                                text: 'text-green-800 dark:text-green-300',
                                icon: CheckCircle
                              },
                              pending: { 
                                bg: 'bg-yellow-100 dark:bg-yellow-900/20', 
                                text: 'text-yellow-800 dark:text-yellow-300',
                                icon: HelpCircle
                              },
                              unscheduled: { 
                                bg: 'bg-slate-100 dark:bg-slate-700', 
                                text: 'text-slate-600 dark:text-slate-400',
                                icon: Clock
                              }
                            };
                            const config = statusConfig[status as keyof typeof statusConfig];
                            const IconComponent = config.icon;
                            
                            return (
                              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                                <IconComponent className="w-3 h-3" />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 h-2/5 flex flex-col justify-between">
                      <div>
                        {/* Date and Place Name */}
                        <div className="mb-2">
                          {(place.scheduled_date || place.scheduledDate) && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {DateUtils.formatCompactDate(new Date(place.scheduled_date || place.scheduledDate))}
                            </div>
                          )}
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2">
                            {place.name}
                          </h3>
                        </div>
                      </div>
                      
                      {/* Edit/Delete Actions */}
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlace(place);
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Edit className="w-3 h-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlace(place.id, place.name);
                          }}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-500 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Back Side */}
                  <div 
                    className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 p-4 flex flex-col justify-between"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div className="space-y-3">
                      {/* Visit Time */}
                      {(place.scheduled_date || place.scheduledDate) && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Visit Time</div>
                          <div className="text-sm text-slate-900 dark:text-slate-100">
                            {DateUtils.formatDateTime(new Date(place.scheduled_date || place.scheduledDate))}
                          </div>
                        </div>
                      )}
                      
                      {/* Added by (Trip Places only) */}
                      {activeTab === 'trip' && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Added by</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: memberInfo.color }}
                            ></div>
                            <span className="text-sm text-slate-900 dark:text-slate-100">{memberInfo.name}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Wish Level */}
                      <div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Wish Level</div>
                        <div className="flex items-center space-x-1 mt-1">
                          {renderStars(place.wish_level || place.wishLevel || 0)}
                        </div>
                      </div>
                      
                      {/* Place Type */}
                      <div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</div>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                          categoryColors[place.category as keyof typeof categoryColors] || 'bg-slate-100 text-slate-600'
                        }`}>
                          {place.category}
                        </span>
                      </div>
                      
                      {/* Duration */}
                      <div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Duration</div>
                        <div className="flex items-center space-x-1 mt-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="text-sm text-slate-900 dark:text-slate-100">
                            {place.stay_duration_minutes ? (place.stay_duration_minutes / 60) : (place.stayDuration || 2)}h
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-400 text-center">
                      Click to flip back
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
                      <span>Price Level: {place.priceLevel}</span>
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