import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams } from 'react-router-dom';
import { MapPin, Calendar, Users, Settings, Wand2, Clock, AlertCircle, Sparkles, Camera, BarChart3, X, Shield, UserCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import MapView from '../components/MapView';
import CalendarView from '../components/CalendarView';
import { OptimizationModal } from '../components/OptimizationModal';
import { OptimizationResult } from '../components/OptimizationResult';
import { TripSettingsModal } from '../components/TripSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { MemberColorService } from '../services/MemberColorService';

interface TripMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  joinedAt: string;
  isOnline?: boolean;
  avatar?: string;
  color?: string;
}

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [activeView, setActiveView] = useState<'map' | 'calendar'>('map');
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [showMemberPopup, setShowMemberPopup] = useState(false);
  const [tripIcon, setTripIcon] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  
  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (optimizationError) {
      const timer = setTimeout(() => {
        setOptimizationError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [optimizationError]);

  // Close score popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showScorePopup) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-score-popup]')) {
          setShowScorePopup(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showScorePopup]);

  // Close member popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMemberPopup) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-member-popup]')) {
          setShowMemberPopup(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMemberPopup]);
  
  const { currentTrip, places, trips, isOptimizing, optimizationResult, setIsOptimizing, setOptimizationResult, updateTrip, user, loadPlacesFromAPI, loadOptimizationResult, createSystemPlaces, loadPlacesFromDatabase, setCurrentTrip, hasUserOptimized, setHasUserOptimized, loadTripsFromDatabase } = useStore();

  // Set the correct trip when tripId param is provided
  useEffect(() => {
    const checkAndSetTrip = async () => {
      if (tripId) {
        // If trips are not loaded yet, try loading them
        if (trips.length === 0) {
          await loadTripsFromDatabase();
          return; // Will re-run when trips update
        }
        
        const targetTrip = trips.find(t => t.id === tripId);
        if (targetTrip && (!currentTrip || currentTrip.id !== tripId)) {
          await setCurrentTrip(targetTrip);
        } else if (!targetTrip) {
          // Try loading trips again in case it was just added
          await loadTripsFromDatabase();
        }
      }
    };
    
    checkAndSetTrip();
  }, [tripId, trips, currentTrip, setCurrentTrip, loadTripsFromDatabase]);

  // Load trip members when current trip changes
  useEffect(() => {
    if (currentTrip?.id) {
      loadTripMembers();
    } else {
      setMembers([]);
    }
  }, [currentTrip?.id]);

  const loadTripMembers = async () => {
    if (!currentTrip?.id) return;
    
    setIsLoadingMembers(true);
    
    try {
      // First get trip members with color assignment
      const { data: memberIds, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id, role, joined_at, assigned_color_index')
        .eq('trip_id', currentTrip.id);

      if (membersError) {
        // Error loading trip members
        return;
      }

      if (!memberIds || memberIds.length === 0) {
        setMembers([]);
        return;
      }

      // Then get user details
      const userIds = memberIds.map(m => m.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        // Error loading users
        return;
      }

      // Load member colors
      const colorMapping = await MemberColorService.getSimpleColorMapping(currentTrip.id);
      setMemberColors(colorMapping);

      // Combine the data
      const membersData = memberIds.map(member => {
        const user = usersData?.find(u => u.id === member.user_id);
        return {
          ...member,
          users: user
        };
      });


      if (membersData && membersData.length > 0) {
        const formattedMembers: TripMember[] = membersData.map((member: any) => {
          const memberColor = colorMapping[member.user_id] || '#0077BE'; // Fallback color
          return {
            id: member.user_id,
            name: member.users.name || member.users.email,
            email: member.users.email,
            role: member.role,
            joinedAt: `Joined ${new Date(member.joined_at).toLocaleDateString()}`,
            avatar: member.users.name?.charAt(0).toUpperCase() || member.users.email?.charAt(0).toUpperCase() || 'U',
            color: memberColor,
            isOnline: Math.random() > 0.5 // Temporary random online status
          };
        });
        
        setMembers(formattedMembers);
      }
    } catch (error) {
      // Error loading trip members
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Handle route parameter - set current trip if tripId is provided
  useEffect(() => {
    if (tripId && trips.length > 0) {
      const trip = trips.find(t => t.id === tripId);
      if (trip && (!currentTrip || currentTrip.id !== tripId)) {
        setCurrentTrip(trip);
      }
    }
  }, [tripId, trips.length, currentTrip?.id, setCurrentTrip]); // Only depend on currentTrip.id, not the full object

  // Load fresh data from database when page loads or trip changes
  useEffect(() => {
    const loadData = async () => {
      try {
        if (currentTrip) {
          await loadPlacesFromDatabase(currentTrip.id);
        }
      } catch (error) {
        // Failed to load trip data
      }
    };

    loadData();
  }, [currentTrip?.id, loadPlacesFromDatabase]);

  const trip = currentTrip;

  // Load places and optimization result on component mount
  useEffect(() => {
    if (currentTrip?.id) { // Load for all real trips
      createSystemPlaces?.(currentTrip.id); // Creates system places if they don't exist
      loadPlacesFromAPI?.(currentTrip.id);
      loadOptimizationResult?.(currentTrip.id);
    }
  }, [currentTrip?.id, loadPlacesFromAPI, loadOptimizationResult, createSystemPlaces]);

  // Get places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );
  const hasPlaces = tripPlaces.length > 0;
  

  // Use current trip - redirect to home if none selected
  if (!currentTrip) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No Trip Selected
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            Please select or create a trip to view details
          </p>
        </div>
      </div>
    );
  }

  // Handle optimization
  const handleOptimization = async () => {
    if (!trip.id || !user) {
      setOptimizationError('Trip ID and user authentication are required');
      return;
    }

    if (!hasPlaces) {
      setOptimizationError('Please add places to your trip before optimizing');
      return;
    }

    // Close modal and start optimization
    setShowOptimizationModal(false);
    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      setHasUserOptimized(true);
      
      // Import TripOptimizationService dynamically
      const { TripOptimizationService } = await import('../services/TripOptimizationService');
      
      // Execute real optimization
      const result = await TripOptimizationService.optimizeTrip(
        trip.id,
        {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'car' // Use car/flight/walking only
        },
        (progress) => {
          setOptimizationProgress(progress.progress);
        }
      );

      if (result) {
        setOptimizationResult(result);
        
        // Refresh places data to show updated schedule
        if (loadPlacesFromAPI) {
          await loadPlacesFromAPI(trip.id);
        }
      } else {
        throw new Error('Optimization failed to return valid results');
      }
    } catch (error) {
      // Optimization failed
      setOptimizationError(error instanceof Error ? error.message : 'Optimization failed');
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress(0);
    }
  };

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setTripIcon(result);
        if (currentTrip) {
          updateTrip(currentTrip.id, { icon: result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const end = new Date(endDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${start} - ${end}`;
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;
    
    return {
      text: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      isExpired
    };
  };

  const formatDeadlineCompact = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;
    
    return {
      text: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      isExpired
    };
  };

  const viewOptions = [
    { 
      key: 'map', 
      label: 'Map', 
      icon: MapPin, 
      gradient: 'from-emerald-500 to-teal-600',
      bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20'
    },
    { 
      key: 'calendar', 
      label: 'Calendar', 
      icon: Calendar, 
      gradient: 'from-orange-500 to-amber-600',
      bgColor: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
    },
  ];

  const deadline = trip.addPlaceDeadline ? formatDeadline(trip.addPlaceDeadline) : null;
  const deadlineCompact = trip.addPlaceDeadline ? formatDeadlineCompact(trip.addPlaceDeadline) : null;

  // Score indicator component
  const ScoreIndicator = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{Math.round(value)}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Combined Fixed Header - Trip Info + View Toggle */}
      <div className="fixed top-12 left-0 right-0 z-[9996] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-primary-400/8 to-secondary-500/8 rounded-full blur-lg"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Trip Info Section */}
        <div className="p-2 border-b border-slate-200/30 dark:border-slate-700/30">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h1 className="text-base font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                  {trip.name}
                </h1>
                        
                {/* Compact Score Display */}
                {optimizationResult && (
                  <div className="relative flex items-center space-x-1" data-score-popup>
                    <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 rounded-full">
                      <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                        {Math.round((optimizationResult.optimization?.optimization_score?.total_score || 0))}%
                      </span>
                    </div>
                    <motion.button
                      onClick={() => setShowScorePopup(!showScorePopup)}
                      className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <BarChart3 className="w-3 h-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                    </motion.button>
                  </div>
                )}
                      
                {/* Trip dates and members info */}
                {trip.startDate && trip.endDate && (
                  <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                  </div>
                )}
                {/* Member Icons - Clickable */}
                <div className="relative flex items-center space-x-1" data-member-popup>
                  <motion.button
                    onClick={() => setShowMemberPopup(!showMemberPopup)}
                    className="flex items-center space-x-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg px-2 py-1 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isLoadingMembers ? (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">Loading...</span>
                      </div>
                    ) : members.length > 0 ? (
                      <div className="flex items-center space-x-1">
                        {/* Show up to 3 member avatars */}
                        <div className="flex -space-x-1">
                          {members.slice(0, 3).map((member, index) => (
                            <div
                              key={member.id}
                              className="relative w-5 h-5 rounded-full flex items-center justify-center border border-white dark:border-slate-800 shadow-sm"
                              style={{ 
                                zIndex: 3 - index,
                                backgroundColor: member.color || '#0077BE'
                              }}
                            >
                              <span className="text-[8px] font-bold text-white">{member.avatar}</span>
                              {member.isOnline && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 border border-white dark:border-slate-800 rounded-full"></div>
                              )}
                            </div>
                          ))}
                          {members.length > 3 && (
                            <div className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center border border-white dark:border-slate-800 shadow-sm">
                              <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300">+{members.length - 3}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">{members.length}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400">
                        <Users className="w-3 h-3" />
                        <span>{trip.memberCount}</span>
                      </div>
                    )}
                  </motion.button>
                </div>
              </div>
              
              {/* Settings Button */}
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300 group"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
              </motion.button>
            </div>

            {/* Deadline warning - compact */}
            {deadline && (deadline.isExpired || new Date(trip.addPlaceDeadline!).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-2 p-2 rounded-lg border backdrop-blur-sm text-xs ${
                  deadline.isExpired
                    ? 'bg-red-50/80 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/50 text-red-700 dark:text-red-300'
                    : 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/50 text-amber-700 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <AlertCircle className={`w-3 h-3 ${
                    deadline.isExpired ? 'text-red-500' : 'text-amber-500'
                  }`} />
                  <span>
                    {deadline.isExpired 
                      ? `Deadline expired: ${deadline.text}`
                      : `Deadline: ${deadline.text}`
                    }
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* View Toggle Section */}
        <div className="py-1 px-2">
          <div className="flex justify-center">
            <div className="bg-slate-100/80 dark:bg-slate-700/80 rounded-lg p-0.5 flex backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50">
              {viewOptions.map(({ key, label, icon: Icon, gradient }) => (
                <motion.button
                  key={key}
                  onClick={() => {
                    setActiveView(key as any);
                  }}
                  className={`relative px-2 py-1 rounded-md text-xs font-medium transition-all duration-300 flex items-center space-x-1 ${
                    activeView === key
                      ? 'text-white shadow-soft'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Active Background */}
                  {activeView === key && (
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-md`}
                      layoutId="activeViewBg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <Icon className="w-3 h-3 relative z-10" />
                  <span className="relative z-10">{label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Enhanced Transitions */}
      <div className="flex-1 overflow-hidden relative mt-20">
        {/* MapView - Always rendered but conditionally visible */}
        <div 
          className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
            activeView === 'map' ? 'opacity-100 z-20 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <MapView optimizationResult={optimizationResult} />
        </div>
        
        {/* Other views - Rendered only when active */}
        
        {activeView === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute inset-0 h-full w-full z-10"
          >
            <CalendarView optimizationResult={optimizationResult} />
          </motion.div>
        )}
      </div>


      {/* Modals */}
      <OptimizationModal
        isOpen={showOptimizationModal}
        onClose={() => setShowOptimizationModal(false)}
        tripId={currentTrip?.id || ''}
      />
      <TripSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      
      {/* Error Toast */}
      <AnimatePresence>
        {optimizationError && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{optimizationError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Member Popup Portal - Rendered at document root for maximum z-index */}
      {showMemberPopup && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] flex items-start justify-center pt-20"
            style={{ zIndex: 99998 }}
            onClick={() => setShowMemberPopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-96 max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trip Members</h3>
                <button
                  onClick={() => setShowMemberPopup(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              {/* Members list */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {isLoadingMembers ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <span className="ml-3 text-slate-600 dark:text-slate-400">Loading members...</span>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No members found</p>
                  </div>
                ) : (
                  members.map((member) => (
                    <motion.div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 hover:shadow-sm transition-all duration-300"
                      whileHover={{ y: -1 }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center shadow-medium"
                            style={{ backgroundColor: member.color || '#0077BE' }}
                          >
                            <span className="text-white font-bold text-sm">{member.avatar}</span>
                          </div>
                          {member.isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white dark:border-slate-800 rounded-full"></div>
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                              {member.name}
                            </span>
                            {member.role === 'admin' && (
                              <Shield className="w-3 h-3 text-blue-500" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {member.joinedAt}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {member.isOnline && (
                          <div className="px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded-full">
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">Online</span>
                          </div>
                        )}
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.role === 'admin' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
                        }`}>
                          {member.role === 'admin' ? 'Admin' : 'Member'}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer info */}
              {members.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{members.length} member{members.length !== 1 ? 's' : ''} total</span>
                    <span>{members.filter(m => m.role === 'admin').length} admin{members.filter(m => m.role === 'admin').length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Score Popup Portal - Rendered at document root for maximum z-index */}
      {showScorePopup && optimizationResult && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99999] flex items-start justify-center pt-20"
            style={{ zIndex: 99999 }}
            onClick={() => setShowScorePopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-96 max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Optimization Scores</h3>
                <button
                  onClick={() => setShowScorePopup(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              {/* Score indicators */}
              <div className="space-y-4">
                <ScoreIndicator 
                  label="Overall Score" 
                  value={optimizationResult.optimization?.optimization_score?.total_score || 0}
                  color="bg-green-500"
                />
                <ScoreIndicator 
                  label="Fairness" 
                  value={optimizationResult.optimization?.optimization_score?.fairness_score || 0}
                  color="bg-blue-500"
                />
                <ScoreIndicator 
                  label="Efficiency" 
                  value={optimizationResult.optimization?.optimization_score?.efficiency_score || 0}
                  color="bg-purple-500"
                />
                
                {/* User satisfaction details */}
                {optimizationResult.optimization?.optimization_score?.details?.user_adoption_balance && (
                  <ScoreIndicator 
                    label="User Adoption" 
                    value={(optimizationResult.optimization.optimization_score.details.user_adoption_balance || 0) * 100}
                    color="bg-orange-500"
                  />
                )}
                
                {optimizationResult.optimization?.optimization_score?.details?.wish_satisfaction_balance && (
                  <ScoreIndicator 
                    label="Wish Satisfaction" 
                    value={(optimizationResult.optimization.optimization_score.details.wish_satisfaction_balance || 0) * 100}
                    color="bg-pink-500"
                  />
                )}
                
                {/* Individual user satisfactions */}
                {optimizationResult.optimization?.user_satisfactions && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Individual User Satisfaction</h4>
                    <div className="space-y-3">
                      {Object.entries(optimizationResult.optimization.user_satisfactions).map(([userId, satisfaction]: [string, any], index) => (
                        <div key={userId} className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-teal-700 dark:text-teal-300">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <ScoreIndicator 
                              label={`User ${index + 1}`}
                              value={(satisfaction || 0) * 100}
                              color="bg-teal-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}