import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, Users, Edit, Trash2, Globe, Sparkles, TrendingUp, Clock, AlertCircle, Crown, Star, Zap, Gift, Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GuestProfilePrompt } from '../components/GuestProfilePrompt';
import { CreateTripModal } from '../components/CreateTripModal';
import { JoinTripModal } from '../components/JoinTripModal';
import { PremiumModal } from '../components/PremiumModal';
import { TripSettingsModal } from '../components/TripSettingsModal';
import { PremiumBadge } from '../components/PremiumBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { DateUtils } from '../utils/DateUtils';

// Extract place name from address (remove country, state details)
const extractPlaceName = (address: string): string => {
  if (!address) return '';
  
  // Split by comma and take the first 1-2 parts (city, possibly region)
  const parts = address.split(',').map(part => part.trim());
  
  // For most addresses, the first part is the main location name
  // If there are multiple parts, take first 2 to include city + region if needed
  if (parts.length >= 2) {
    return parts.slice(0, 2).join(', ');
  }
  
  return parts[0] || address;
};

export function HomePage() {
  const navigate = useNavigate();
  const { user, trips, currentTrip, deleteTrip, canCreateTrip, canJoinTrip, setCurrentTrip, loadPlacesFromAPI } = useStore();
  
  // Calculate user's owned trips count for limit display  
  const userOwnedTrips = user ? trips.filter(trip => trip.ownerId === user.id) : [];
  
  // Calculate total trips count (owned + member) for display
  const totalUserTrips = trips.length;
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showTripSettingsModal, setShowTripSettingsModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editTripData, setEditTripData] = useState<any>(null);
  const [premiumFeature, setPremiumFeature] = useState<'trips' | 'members' | 'places' | undefined>();
  const [selectingTripId, setSelectingTripId] = useState<string | null>(null);
  
  // User statistics state
  const [userStats, setUserStats] = useState({
    placesVisited: 0,
    routesOptimized: 0,
    tripsPlanned: totalUserTrips
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [shouldBlinkCreateTripButton, setShouldBlinkCreateTripButton] = useState(false);

  const formatDate = (dateStr: string) => {
    return DateUtils.formatCompactDate(new Date(dateStr));
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;
    
    return {
      text: DateUtils.formatDateTime(date),
      isExpired
    };
  };

  const handleCreateTrip = () => {
    // Stop blinking if it was showing
    if (shouldBlinkCreateTripButton && user) {
      const createTripGuidanceKey = `createTripGuidance_${user.id}`;
      localStorage.setItem(createTripGuidanceKey, 'true');
      setShouldBlinkCreateTripButton(false);
    }
    
    if (canCreateTrip()) {
      setShowCreateModal(true);
    } else {
      setPremiumFeature('trips');
      setShowPremiumModal(true);
    }
  };

  const handleStripePayment = () => {
    // Implement Stripe payment processing here
    // In actual implementation, create Stripe checkout session and redirect
    // window.location.href = 'https://checkout.stripe.com/...';
    
    // Temporarily open premium modal for demo
    setShowPremiumModal(true);
  };

  const isPremium = user?.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
  
  // Load user statistics
  useEffect(() => {
    const loadUserStats = async () => {
      if (!user) {
        setIsLoadingStats(false);
        return;
      }
      
      try {
        // Get places visited (unique places across all trips)
        const { count: placesCount } = await supabase
          .from('places')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        // Get routes optimized (count of optimization results created by user)
        const { count: optimizationCount } = await supabase
          .from('optimization_results')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id);
        
        setUserStats({
          placesVisited: placesCount || 0,
          routesOptimized: optimizationCount || 0,
          tripsPlanned: totalUserTrips
        });
      } catch (error) {
        // Failed to load user stats
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    loadUserStats();
  }, [user, totalUserTrips]);

  // Check if create trip button should blink
  useEffect(() => {
    if (!user) return;

    // Check if this is the first time for create trip guidance
    const createTripGuidanceKey = `createTripGuidance_${user.id}`;
    const hasSeenCreateTripGuidance = localStorage.getItem(createTripGuidanceKey);
    
    // Blink if user has no trips and hasn't seen guidance
    setShouldBlinkCreateTripButton(
      !hasSeenCreateTripGuidance && 
      totalUserTrips === 0
    );
  }, [user?.id, totalUserTrips]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div 
      className="p-4 lg:p-6 space-y-8 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Guest Profile Prompt */}
      <AnimatePresence>
        {!user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
          >
            <GuestProfilePrompt />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="flex items-center justify-center space-x-4">
            <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600 bg-clip-text text-transparent">
              Welcome to Voypath
            </h1>
            {isPremium && <PremiumBadge size="lg" />}
          </div>
          <motion.div
            className="absolute -inset-4 bg-gradient-to-r from-primary-400/20 via-secondary-500/20 to-primary-400/20 blur-2xl rounded-full"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
        <p className="text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Plan your perfect journey
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 lg:gap-6">
        {[
          { icon: MapPin, label: 'Places Added', value: isLoadingStats ? '...' : userStats.placesVisited.toString(), color: 'from-primary-500 to-primary-600' },
          { icon: TrendingUp, label: 'Routes Optimized', value: isLoadingStats ? '...' : userStats.routesOptimized.toString(), color: 'from-secondary-500 to-secondary-600' },
          { icon: Sparkles, label: 'Trips Planned', value: userStats.tripsPlanned.toString(), color: 'from-accent-500 to-accent-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            className="relative group"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-3 sm:p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-soft hover:shadow-medium transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-slate-700/50 dark:to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 text-center space-y-2 sm:space-y-3">
                <div className={`w-8 h-8 sm:w-12 sm:h-12 mx-auto bg-gradient-to-r ${stat.color} rounded-2xl flex items-center justify-center shadow-glow`}>
                  <stat.icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{stat.label}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Action Buttons */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
        <motion.button
          onClick={() => {
            if (!canJoinTrip()) {
              setPremiumFeature('trips');
              setShowPremiumModal(true);
            } else {
              setShowJoinModal(true);
            }
          }}
          className={`group relative flex-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-2 border-slate-200/50 dark:border-slate-700/50 rounded-3xl p-3 sm:p-6 transition-all duration-300 overflow-hidden ${
            canJoinTrip() 
              ? 'hover:border-primary-300/50 dark:hover:border-primary-600/50' 
              : 'opacity-60 cursor-not-allowed'
          }`}
          whileHover={canJoinTrip() ? { scale: 1.02, y: -2 } : {}}
          whileTap={canJoinTrip() ? { scale: 0.98 } : {}}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 to-secondary-50/50 dark:from-primary-900/20 dark:to-secondary-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative z-10 flex items-center justify-center space-x-3 text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-2xl flex items-center justify-center group-hover:from-primary-100 group-hover:to-primary-200 dark:group-hover:from-primary-900/50 dark:group-hover:to-primary-800/50 transition-all duration-300">
              <Globe className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Join Trip</span>
            {!canJoinTrip() && <Crown className="w-5 h-5 text-yellow-300 fill-current" />}
          </div>
        </motion.button>

        <motion.button
          onClick={handleCreateTrip}
          className="group relative flex-1 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-3xl p-3 sm:p-6 shadow-glow hover:shadow-glow-lg transition-all duration-300 overflow-hidden"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          animate={shouldBlinkCreateTripButton ? {
            opacity: [1, 0.7, 1],
            scale: [1, 1.05, 1],
            boxShadow: [
              '0 0 20px rgba(99, 102, 241, 0.5)',
              '0 0 30px rgba(99, 102, 241, 0.8)',
              '0 0 20px rgba(99, 102, 241, 0.5)'
            ]
          } : {}}
          transition={shouldBlinkCreateTripButton ? {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative z-10 flex items-center justify-center space-x-3 text-white">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-all duration-300">
              <Plus className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Create Trip</span>
            {!canCreateTrip() && <Crown className="w-5 h-5 text-yellow-300 fill-current" />}
          </div>
        </motion.button>
      </motion.div>

      {/* Trips Section */}
      <motion.div variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your Trips</h2>
          <div className="flex items-center space-x-3">
            {!isPremium && (
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                {totalUserTrips}/3 trips
              </span>
            )}
            {isPremium && trips.length > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                {trips.length} trip{trips.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {trips.length === 0 ? (
          <motion.div 
            className="text-center py-16"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto shadow-soft">
                <MapPin className="w-12 h-12 text-slate-400" />
              </div>
              <motion.div
                className="absolute -inset-2 bg-gradient-to-r from-primary-400/20 to-secondary-500/20 rounded-3xl blur-xl"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              No trips yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
              Create your first trip or join an existing one to start planning your perfect journey
            </p>
            <motion.button
              onClick={handleCreateTrip}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-5 h-5" />
              <span>Create Your First Trip</span>
              {!canCreateTrip() && <Crown className="w-4 h-4 text-yellow-300 fill-current" />}
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {trips.map((trip, index) => {
                const deadline = trip.addPlaceDeadline ? formatDeadline(trip.addPlaceDeadline) : null;
                
                return (
                  <motion.div
                    key={trip.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ y: -4 }}
                    className="group"
                  >
                    <Link 
                      to="/my-trip" 
                      className="block"
                      onClick={async (e) => {
                        // Prevent navigation until trip data is loaded
                        e.preventDefault();
                        setSelectingTripId(trip.id);
                        try {
                          
                          // Use setCurrentTrip which now handles complete data clearing and reloading
                          await setCurrentTrip(trip);
                          
                          // Navigate after successful trip selection using React Router
                          navigate('/my-trip');
                        } catch (error) {
                          alert('Failed to load trip data. Please try again.');
                        } finally {
                          setSelectingTripId(null);
                        }
                      }}
                    >
                      <div className={`relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-3 sm:p-4 border border-slate-200/50 dark:border-slate-700/50 hover:border-primary-300/50 dark:hover:border-primary-600/50 transition-all duration-300 shadow-soft hover:shadow-medium overflow-hidden ${
                        selectingTripId === trip.id ? 'opacity-70 pointer-events-none' : ''
                      }`}>
                        {/* Background Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-transparent to-secondary-50/30 dark:from-primary-900/10 dark:via-transparent dark:to-secondary-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-full max-w-full"></div>
                        
                        {/* Loading Overlay */}
                        {selectingTripId === trip.id && (
                          <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm flex items-center justify-center z-20">
                            <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400">
                              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              <span className="font-medium">Loading...</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Deadline Badge */}
                        {deadline && (
                          <div className={`absolute top-4 right-4 px-2 py-1 rounded-lg text-xs font-medium ${
                            deadline.isExpired
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          }`}>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{deadline.isExpired ? 'Expired' : 'Deadline'}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Content */}
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-2 sm:mb-3">
                            <div className="flex-1 min-w-0 pr-2 sm:pr-3">
                              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 sm:mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight">
                                {trip.name || `${extractPlaceName(trip.departureLocation)} Trip`}
                              </h3>
                              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                                {trip.description || `Trip starting from ${extractPlaceName(trip.departureLocation)}`}
                              </p>
                            </div>
                            <div className="flex space-x-0.5 sm:space-x-1 flex-shrink-0">
                              {/* Edit Trip Button - Opens CreateTripModal in edit mode */}
                              <motion.button
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditTripData(trip);
                                  setShowCreateModal(true);
                                }}
                                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                title="Edit Trip"
                              >
                                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                              </motion.button>
                              
                              {/* Settings Button - Opens TripSettingsModal */}
                              <motion.button
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Set the trip as current trip and open settings modal
                                  setEditingTripId(trip.id);
                                  await setCurrentTrip(trip);
                                  setShowTripSettingsModal(true);
                                }}
                                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                title="Trip Settings"
                              >
                                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                              </motion.button>
                              <motion.button
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this trip?')) {
                                    try {
                                      await deleteTrip(trip.id);
                                    } catch (error) {
                                      alert('Failed to delete trip. Please try again.');
                                    }
                                  }
                                }}
                                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 hover:text-red-600" />
                              </motion.button>
                            </div>
                          </div>

                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-primary-600 dark:text-primary-400" />
                              </div>
                              <span className="font-medium truncate">From: {extractPlaceName(trip.departureLocation)}</span>
                            </div>
                            {trip.destination && (
                              <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-secondary-600 dark:text-secondary-400" />
                                </div>
                                <span className="font-medium truncate">To: {extractPlaceName(trip.destination)}</span>
                              </div>
                            )}
                            {trip.startDate && trip.endDate && (
                              <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-accent-100 dark:bg-accent-900/30 rounded-xl flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-accent-600 dark:text-accent-400" />
                                </div>
                                <span className="truncate">{formatDateRange(trip.startDate, trip.endDate)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <span>{trip.memberCount} member{trip.memberCount !== 1 ? 's' : ''}</span>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                                {getTimeAgo(trip.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Deadline Info */}
                          {deadline && (
                            <div className={`mt-3 p-2 rounded-lg text-xs ${
                              deadline.isExpired
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                            }`}>
                              <div className="flex items-center space-x-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>
                                  {deadline.isExpired 
                                    ? `Deadline expired: ${deadline.text}`
                                    : `Add places by: ${deadline.text}`
                                  }
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Premium Upgrade Section - Elegant Design */}
        {!isPremium && (
          <motion.div 
            variants={itemVariants}
            className="relative rounded-3xl p-4 sm:p-6 border-2 border-yellow-400/30 overflow-hidden cursor-pointer group"
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
            onClick={handleStripePayment}
            whileHover={{ 
              scale: 1.02,
              y: -5,
              boxShadow: '0 25px 50px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
            transition={{ duration: 0.3 }}
          >
            {/* Gold ambient lighting */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/15 via-transparent to-yellow-600/10 opacity-70"></div>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-yellow-600/15 rounded-full blur-2xl"></div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-6">
                <motion.div 
                  className="relative"
                  animate={{
                    y: [0, -5, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div 
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-3xl flex items-center justify-center shadow-glow border border-yellow-400/30"
                    style={{
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 fill-current drop-shadow-lg" />
                  </div>
                  <motion.div
                    className="absolute -inset-2 bg-yellow-400/20 rounded-3xl blur-xl"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  />
                </motion.div>
                <div>
                  <motion.h3 
                    className="text-base sm:text-lg font-bold text-yellow-400 drop-shadow-lg mb-1 sm:mb-2"
                    animate={{
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  >
                    🚀 Unlock Premium Power!
                  </motion.h3>
                  <p className="text-slate-300 text-xs sm:text-sm drop-shadow-sm mb-1 sm:mb-2">
                    Unlimited trips, members, and places
                  </p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <motion.span 
                        className="text-yellow-400 font-bold text-base"
                        animate={{
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                      >
                        $9.00/year
                      </motion.span>
                    </div>
                  </div>
                </div>
              </div>
              <motion.div
                className="px-4 py-2 sm:px-6 sm:py-3 text-black rounded-2xl font-bold text-xs sm:text-sm shadow-glow hover:shadow-glow-lg relative overflow-hidden group border-2 border-yellow-400"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
                }}
                whileHover={{ 
                  scale: 1.05,
                  y: -2,
                }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10 flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>UPGRADE NOW!</span>
                  <Gift className="w-4 h-4" />
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Modals */}
      <CreateTripModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditTripData(null);
        }}
        editMode={!!editTripData}
        tripData={editTripData}
      />
      <JoinTripModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature={premiumFeature}
      />
      <TripSettingsModal
        isOpen={showTripSettingsModal}
        onClose={() => setShowTripSettingsModal(false)}
      />
    </motion.div>
  );
}