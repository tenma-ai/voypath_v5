import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Sun, Moon, User, LogOut, Edit, Crown, Sparkles, MapPin, Calendar, Users, MessageCircle, Share2, Bell, Shield, Download, HelpCircle, Star, Info, Phone, FileText, Heart, Award, Zap, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PremiumBadge } from './PremiumBadge';
import { PremiumModal } from './PremiumModal';
import { InfoModal } from './InfoModal';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { MemberColorService } from '../services/MemberColorService';

const routeTitles: Record<string, { title: string; subtitle?: string; icon?: any; gradient?: string }> = {
  '/': { 
    title: 'My Trips', 
    subtitle: 'Plan your next adventure',
    icon: MapPin,
    gradient: 'from-primary-500 to-secondary-600'
  },
  '/my-trip': { 
    title: 'Trip Details', 
    subtitle: 'Manage your journey',
    icon: Calendar,
    gradient: 'from-secondary-500 to-accent-600'
  },
  '/my-trip/my-places': { 
    title: 'My Places', 
    subtitle: 'Discover amazing destinations',
    icon: MapPin,
    gradient: 'from-accent-500 to-primary-600'
  },
  '/my-trip/chat': { 
    title: 'Group Chat', 
    subtitle: 'Connect with your travel buddies',
    icon: MessageCircle,
    gradient: 'from-green-500 to-blue-600'
  },
  '/my-trip/share': { 
    title: 'Share Trip', 
    subtitle: 'Invite friends to join',
    icon: Share2,
    gradient: 'from-purple-500 to-pink-600'
  },
  '/add-place': { 
    title: 'Add Place', 
    subtitle: 'Find your next destination',
    icon: Sparkles,
    gradient: 'from-orange-500 to-red-600'
  },
  '/profile': { 
    title: 'Profile', 
    subtitle: 'Manage your account',
    icon: User,
    gradient: 'from-indigo-500 to-purple-600'
  },
};

function TopAppBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, user, currentTrip, trips, canCreateTrip } = useStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showVoypathMenu, setShowVoypathMenu] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userColor, setUserColor] = useState<string | null>(null);
  
  const routeInfo = routeTitles[location.pathname] || { title: 'Voypath', gradient: 'from-primary-500 to-secondary-600' };
  const showBackButton = location.pathname !== '/';

  const isPremium = user?.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load user's member color
  useEffect(() => {
    const loadUserColor = async () => {
      if (!user?.id || !currentTrip?.id) {
        setUserColor(null);
        return;
      }

      try {
        const color = await MemberColorService.getMemberColor(currentTrip.id, user.id);
        if (color) {
          setUserColor(color.hex);
        } else {
          // Try to assign a color if not already assigned
          const assignedColor = await MemberColorService.assignColorToMember(currentTrip.id, user.id);
          setUserColor(assignedColor.hex);
        }
      } catch (error) {
        console.error('Failed to load user color:', error);
        // Fallback to deterministic color
        const fallbackColor = MemberColorService.getColorForOptimization(user.id, {});
        setUserColor(fallbackColor);
      }
    };

    loadUserColor();
  }, [user?.id, currentTrip?.id]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      
      if (showProfileMenu && !target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
      
      if (showVoypathMenu && !target.closest('.voypath-menu-container')) {
        setShowVoypathMenu(false);
      }
    };

    // Handle both mouse and touch events for better mobile support
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileMenu, showVoypathMenu]);

  const handleProfileMenuToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double triggering on mobile devices
    if (e.type === 'touchstart') {
      e.preventDefault();
    }
    
    setShowProfileMenu(!showProfileMenu);
    setShowVoypathMenu(false);
  };

  const handleVoypathMenuToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowVoypathMenu(!showVoypathMenu);
    setShowProfileMenu(false);
  };

  const handleMenuAction = (action: string) => {
    setShowProfileMenu(false);
    
    switch (action) {
      case 'profile':
        navigate('/profile');
        break;
      case 'settings':
        navigate('/profile');
        break;
      case 'edit-profile':
        navigate('/profile');
        break;
      case 'my-trips':
        navigate('/');
        break;
      case 'current-trip':
        navigate('/my-trip');
        break;
      case 'notifications':
        console.log('Opening notifications...');
        break;
      case 'help':
        console.log('Opening help center...');
        break;
      case 'feedback':
        console.log('Opening feedback form...');
        break;
      case 'upgrade':
        setShowPremiumModal(true);
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🔄 Logging out...');
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Logout error:', error);
      } else {
        console.log('✅ Successfully logged out');
      }
      
      // Clear local storage
      localStorage.clear();
      
      // Refresh the page to reset all state
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Fallback: clear storage and reload anyway
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleVoypathAction = (action: string) => {
    setShowVoypathMenu(false);
    
    switch (action) {
      case 'features':
        // Open features page in new tab (external)
        window.open('https://voypath-app.com', '_blank', 'noopener,noreferrer');
        break;
      case 'privacy':
        // Open privacy policy in new tab (external)
        window.open('https://voypath-app.com', '_blank', 'noopener,noreferrer');
        break;
      case 'pricing':
        // Show premium modal (existing functionality)
        setShowPremiumModal(true);
        break;
      case 'about':
      case 'help':
      case 'feedback':
      case 'terms':
      case 'contact':
        // Show in-app popup
        setShowInfoModal(action);
        break;
      default:
        break;
    }
  };

  const menuVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      y: -20,
      transition: {
        duration: 0.15,
        ease: "easeOut"
      }
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.2,
        ease: "easeOut"
      }
    })
  };

  return (
    <>
      <motion.header 
        className={`fixed top-0 left-0 right-0 z-[9997] transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-soft' 
            : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Main Header Content */}
        <div className="relative overflow-hidden">
          {/* Subtle Animated Background Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-r ${routeInfo.gradient} opacity-3 dark:opacity-5`}></div>
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${routeInfo.gradient} opacity-5 dark:opacity-10 blur-lg`}
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.05, 0.1, 0.05],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          <div className="relative flex items-center h-12 px-3 lg:px-4">
            {/* Left Section */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {showBackButton ? (
                <motion.button
                  onClick={() => window.history.back()}
                  className="group relative p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 hover:border-primary-300/50 dark:hover:border-primary-600/50 transition-all duration-300 shadow-soft hover:shadow-medium"
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors relative z-10" />
                </motion.button>
              ) : (
                <div className="relative voypath-menu-container" style={{ zIndex: 10000 }}>
                  <motion.button
                    onClick={handleVoypathMenuToggle}
                    className="flex items-center space-x-2 group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="relative group">
                      <motion.div
                        className="w-8 h-8 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-glow relative overflow-hidden"
                        whileHover={{ scale: 1.05, rotate: 2 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <img 
                          src="/voypathlogo_nameunder.png" 
                          alt="Voypath" 
                          className="w-5 h-5 object-contain filter drop-shadow-sm relative z-10"
                          onError={(e) => {
                            console.error('Logo failed to load, trying fallback');
                            // Fallback: show a text logo
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector('.fallback-logo')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'fallback-logo text-white font-bold text-xs';
                              fallback.textContent = 'VP';
                              parent.appendChild(fallback);
                            }
                          }}
                          onLoad={() => console.log('Logo loaded successfully')}
                        />
                      </motion.div>
                      <motion.div
                        className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 to-secondary-500 rounded-xl opacity-15 blur group-hover:opacity-30 transition-opacity duration-300"
                        animate={{
                          scale: [1, 1.05, 1],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                        }}
                      />
                    </div>
                    {isPremium && <PremiumBadge size="sm" />}
                  </motion.button>

                  {/* Voypath Info Menu */}
                  <AnimatePresence>
                    {showVoypathMenu && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black/10" onClick={() => setShowVoypathMenu(false)} style={{ zIndex: 10000 }} />
                        
                        <motion.div 
                          className="fixed left-4 top-16 w-72 sm:w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] bg-white dark:bg-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 overflow-y-auto overflow-x-hidden opacity-100"
                          style={{ zIndex: 10001 }}
                          variants={menuVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                        >
                          {/* Header */}
                          <motion.div 
                            className="relative px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50"
                            variants={itemVariants}
                            custom={0}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-glow">
                                <img 
                                  src="/voypathlogo_nameunder.png" 
                                  alt="Voypath" 
                                  className="w-7 h-7 object-contain filter drop-shadow-sm"
                                  onError={(e) => {
                                    console.error('Menu logo failed to load:', e);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                  onLoad={() => console.log('Menu logo loaded successfully')}
                                />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                  Voypath
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Smart Travel Planning Platform
                                </p>
                              </div>
                            </div>
                          </motion.div>

                          {/* Company Info Section */}
                          <div className="px-2 py-2">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 mb-2">Company</div>
                            {[
                              { key: 'about', icon: Info, label: 'About Us', description: 'Our story and mission' },
                              { key: 'features', icon: Zap, label: 'Features', description: 'What makes us special' },
                              { key: 'pricing', icon: Crown, label: 'Pricing', description: 'Plans and pricing' },
                            ].map((item, index) => (
                              <motion.button
                                key={item.key}
                                onClick={() => handleVoypathAction(item.key)}
                                className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300 group relative overflow-hidden rounded-xl"
                                variants={itemVariants}
                                custom={index + 1}
                                whileHover={{ x: 4 }}
                              >
                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors duration-300 relative z-10">
                                  <item.icon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300" />
                                </div>
                                <div className="flex-1 relative z-10">
                                  <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium transition-colors duration-300 text-sm">
                                    {item.label}
                                  </span>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {item.description}
                                  </div>
                                </div>
                              </motion.button>
                            ))}
                          </div>

                          {/* Support Section */}
                          <div className="px-2 py-2 border-t border-slate-200/50 dark:border-slate-700/50">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 mb-2">Support</div>
                            <motion.button
                              onClick={() => handleVoypathAction('help')}
                              className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300 group relative overflow-hidden rounded-xl"
                              variants={itemVariants}
                              custom={4}
                              whileHover={{ x: 4 }}
                            >
                              <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors duration-300 relative z-10">
                                <HelpCircle className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300" />
                              </div>
                              <div className="flex-1 relative z-10">
                                <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium transition-colors duration-300 text-sm">
                                  Help Center
                                </span>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  FAQs, contact us (email/phone)
                                </div>
                              </div>
                            </motion.button>
                            <motion.button
                              onClick={() => handleVoypathAction('feedback')}
                              className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300 group relative overflow-hidden rounded-xl"
                              variants={itemVariants}
                              custom={5}
                              whileHover={{ x: 4 }}
                            >
                              <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors duration-300 relative z-10">
                                <MessageCircle className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300" />
                              </div>
                              <div className="flex-1 relative z-10">
                                <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium transition-colors duration-300 text-sm">
                                  Send Feedback
                                </span>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Help us improve
                                </div>
                              </div>
                            </motion.button>
                            <motion.button
                              onClick={() => handleVoypathAction('contact')}
                              className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300 group relative overflow-hidden rounded-xl"
                              variants={itemVariants}
                              custom={7}
                              whileHover={{ x: 4 }}
                            >
                              <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors duration-300 relative z-10">
                                <Phone className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-300" />
                              </div>
                              <div className="flex-1 relative z-10">
                                <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium transition-colors duration-300 text-sm">
                                  Contact Us
                                </span>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Get in touch directly
                                </div>
                              </div>
                            </motion.button>
                          </div>

                          {/* Legal Section */}
                          <div className="px-2 py-2 border-t border-slate-200/50 dark:border-slate-700/50">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 mb-2">Legal</div>
                            {[
                              { key: 'privacy', icon: Shield, label: 'Privacy Policy', description: 'How we protect your data' },
                              { key: 'terms', icon: FileText, label: 'Terms of Service', description: 'Our terms and conditions' },
                            ].map((item, index) => (
                              <motion.button
                                key={item.key}
                                onClick={() => handleVoypathAction(item.key)}
                                className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300 group relative overflow-hidden rounded-xl"
                                variants={itemVariants}
                                custom={index + 8}
                                whileHover={{ x: 4 }}
                              >
                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors duration-300 relative z-10">
                                  <item.icon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300" />
                                </div>
                                <div className="flex-1 relative z-10">
                                  <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium transition-colors duration-300 text-sm">
                                    {item.label}
                                  </span>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {item.description}
                                  </div>
                                </div>
                              </motion.button>
                            ))}
                          </div>

                          {/* Footer */}
                          <div className="px-4 py-3 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                © 2024 Voypath
                              </div>
                              <div className="flex items-center space-x-2">
                                <Heart className="w-3 h-3 text-red-500 fill-current" />
                                <span className="text-xs text-slate-500 dark:text-slate-400">Made with love</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Center Title Section */}
            <div className="flex-1 flex justify-center mx-3 min-w-0">
              <motion.div 
                className="text-center max-w-xs"
                key={location.pathname}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  {routeInfo.icon && (
                    <div className={`w-5 h-5 bg-gradient-to-r ${routeInfo.gradient} rounded-lg flex items-center justify-center shadow-soft flex-shrink-0`}>
                      <routeInfo.icon className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                      {routeInfo.title}
                    </h1>
                    {routeInfo.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5 truncate hidden sm:block">
                        {routeInfo.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
              {/* Theme Toggle */}
              <motion.button
                onClick={toggleTheme}
                className="relative p-1.5 sm:p-2 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 rounded-xl transition-all duration-300 group"
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
              >

                <AnimatePresence mode="wait">
                  {theme === 'light' ? (
                    <motion.div
                      key="sun"
                      initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="relative z-10"
                    >
                      <Sun className="w-4 h-4 text-yellow-600 group-hover:text-yellow-500 transition-colors" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="moon"
                      initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="relative z-10"
                    >
                      <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Premium Icon */}
              {!isPremium && (
                <motion.button
                  onClick={() => setShowPremiumModal(true)}
                  className="relative p-1.5 sm:p-2 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 rounded-xl transition-all duration-300 group"
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Crown className="w-4 h-4 text-yellow-600 dark:text-yellow-400 fill-current" />
                </motion.button>
              )}

              {/* Profile Menu */}
              {user && (
                <div className="relative profile-menu-container" style={{ zIndex: 10000 }}>
                  <motion.button
                    onClick={handleProfileMenuToggle}
                    className="relative group"
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shadow-medium hover:shadow-glow transition-all duration-300 relative overflow-hidden"
                      style={isPremium ? {
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      } : userColor ? {
                        backgroundColor: userColor,
                      } : {
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)',
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <span className={`${isPremium ? 'text-yellow-400' : 'text-white'} font-semibold text-xs relative z-10 drop-shadow-sm`}>
                        {user.name?.charAt(0) || 'U'}
                      </span>
                      {isPremium && (
                        <Crown className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-yellow-400 fill-current drop-shadow-sm" />
                      )}
                    </div>
                  </motion.button>

                  {/* Profile Menu Dropdown */}
                  <AnimatePresence>
                    {showProfileMenu && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black/10" onClick={() => setShowProfileMenu(false)} style={{ zIndex: 10001 }} />
                        
                        <motion.div 
                          className="fixed right-2 sm:right-4 top-14 sm:top-16 w-[calc(100vw-1rem)] sm:w-72 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] bg-white dark:bg-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 overflow-y-auto overflow-x-hidden"
                          style={{ zIndex: 10002 }}
                          variants={menuVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                        >
                          {/* User Info */}
                          <motion.div 
                            className="relative px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50"
                            variants={itemVariants}
                            custom={0}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div 
                                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-medium"
                                  style={isPremium ? {
                                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                  } : userColor ? {
                                    backgroundColor: userColor,
                                  } : {
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)',
                                  }}
                                >
                                  <span className={`${isPremium ? 'text-yellow-400' : 'text-white'} font-bold text-lg drop-shadow-sm`}>
                                    {user.name?.charAt(0) || 'U'}
                                  </span>
                                  {isPremium && (
                                    <Crown className="absolute -top-0.5 -right-0.5 w-4 h-4 text-yellow-400 fill-current drop-shadow-sm" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm">
                                    {user.name || 'Guest User'}
                                  </p>
                                  {isPremium && <PremiumBadge size="sm" />}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {user.email || (user.isGuest ? 'Guest Account' : 'No email')}
                                </p>
                                <div className="flex items-center mt-1">
                                  <div className="w-1.5 h-1.5 bg-success-500 rounded-full mr-1.5 animate-pulse-soft"></div>
                                  <span className="text-xs text-success-600 dark:text-success-400 font-medium">Online</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>


                          {/* Menu Items Section */}
                          <div className="relative py-1">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2">Account</div>
                            {[
                              { key: 'profile', icon: User, label: 'Profile Settings' },
                            ].map((item, index) => (
                              <motion.button
                                key={item.key}
                                onClick={() => handleMenuAction(item.key)}
                                className="w-full flex items-center space-x-3 px-4 py-2.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-all duration-300 group relative overflow-hidden"
                                variants={itemVariants}
                                custom={index + 5}
                                whileHover={{ x: 4 }}
                              >
                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors duration-300 relative z-10">
                                  <item.icon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300" />
                                </div>
                                <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium transition-colors duration-300 relative z-10 text-sm">
                                  {item.label}
                                </span>
                              </motion.button>
                            ))}

                            {/* Premium Upgrade Section */}
                            {!isPremium && (
                              <>
                                <div className="border-t border-slate-200/50 dark:border-slate-700/50 my-1" />
                                <motion.button
                                  onClick={() => handleMenuAction('upgrade')}
                                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 dark:hover:from-yellow-900/20 dark:hover:to-orange-900/20 transition-all duration-300 group relative overflow-hidden"
                                  variants={itemVariants}
                                  custom={8}
                                  whileHover={{ x: 4 }}
                                >
                                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-soft relative z-10">
                                    <Crown className="w-4 h-4 text-white fill-current" />
                                  </div>
                                  <div className="flex-1 relative z-10">
                                    <span className="text-yellow-600 dark:text-yellow-400 font-bold text-sm">
                                      Upgrade to Premium
                                    </span>
                                    <div className="text-xs text-yellow-500 dark:text-yellow-500">
                                      Unlock unlimited features
                                    </div>
                                  </div>
                                  <Star className="w-4 h-4 text-yellow-500 fill-current relative z-10" />
                                </motion.button>
                              </>
                            )}


                            {!user.isGuest && (
                              <>
                                <div className="border-t border-slate-200/50 dark:border-slate-700/50 my-1" />
                                <motion.button
                                  onClick={() => handleMenuAction('logout')}
                                  className="w-full flex items-center space-x-3 px-4 py-2.5 text-left hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-all duration-300 group relative overflow-hidden"
                                  variants={itemVariants}
                                  custom={10}
                                  whileHover={{ x: 4 }}
                                >
                                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors duration-300 relative z-10">
                                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400 transition-colors duration-300" />
                                  </div>
                                  <span className="text-red-600 dark:text-red-400 font-medium transition-colors duration-300 relative z-10 text-sm">
                                    Sign Out
                                  </span>
                                </motion.button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

      </motion.header>

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />

      {/* Info Modal */}
      {showInfoModal && (
        <InfoModal 
          isOpen={!!showInfoModal} 
          onClose={() => setShowInfoModal(null)}
          type={showInfoModal}
        />
      )}
    </>
  );
}

export default TopAppBar;

export { TopAppBar }