import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Crown, Check, Sparkles, Users, MapPin, Calendar, Zap, Star, Gift, Rocket, Shield } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PremiumCheckout } from './PremiumCheckout';
import { motion, AnimatePresence } from 'framer-motion';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: 'trips' | 'members' | 'places';
}

export function PremiumModal({ isOpen, onClose, feature }: PremiumModalProps) {
  const { user } = useStore();
  const [showCheckout, setShowCheckout] = useState(false);

  const features = [
    {
      icon: Calendar,
      title: 'Unlimited Trips',
      description: 'Create as many adventures as your heart desires',
      free: '3 trips',
      premium: '∞ Unlimited',
      highlight: feature === 'trips',
    },
    {
      icon: Users,
      title: 'Massive Groups',
      description: 'Bring everyone along - friends, family, colleagues',
      free: '5 members',
      premium: '∞ Everyone',
      highlight: feature === 'members',
    },
    {
      icon: MapPin,
      title: 'Endless Places',
      description: 'Discover every hidden gem and must-see destination',
      free: '10 places',
      premium: '∞ Everywhere',
      highlight: feature === 'places',
    },
    {
      icon: Rocket,
      title: 'VIP Experience',
      description: 'Priority support, early features, exclusive perks',
      free: 'Basic',
      premium: 'VIP Treatment',
      highlight: false,
    },
  ];

  const getFeatureTitle = () => {
    switch (feature) {
      case 'trips':
        return '🚀 Ready for More Adventures?';
      case 'members':
        return '👥 Bring Everyone Along!';
      case 'places':
        return '🗺️ Discover Everything!';
      default:
        return '✨ Unlock Your Travel Potential';
    }
  };

  const getFeatureDescription = () => {
    switch (feature) {
      case 'trips':
        return 'You\'ve hit the 3-trip limit! Upgrade now and plan unlimited adventures. Your next dream destination is waiting! 🌟';
      case 'members':
        return 'Want to invite more friends? Premium lets you bring unlimited people on your journey. The more, the merrier! 🎉';
      case 'places':
        return 'Reached your 10-place limit? Premium unlocks infinite possibilities. Every hidden gem awaits discovery! 💎';
      default:
        return 'Transform your travel planning with unlimited everything. Your perfect trip is just one click away! ✈️';
    }
  };

  const benefits = [
    '🎯 Smart AI route optimization',
    '⚡ Lightning-fast sync across devices',
    '🔒 Advanced privacy & security',
    '📱 Offline access everywhere',
    '🎨 Premium themes & customization',
    '💬 Priority customer support',
  ];

  if (showCheckout) {
    return (
      <AnimatePresence>
        {isOpen && (
          <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <motion.div 
              className="fixed inset-0 bg-black/60 backdrop-blur-md" 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden="true" 
            />
            
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Dialog.Panel
                as={motion.div}
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 relative"
              >
                {/* Close Button */}
                <div className="absolute top-6 right-6 z-10">
                  <motion.button
                    onClick={onClose}
                    className="p-3 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-6 h-6 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                  </motion.button>
                </div>

                <PremiumCheckout onClose={onClose} />
              </Dialog.Panel>
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
          <motion.div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md" 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true" 
          />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-4xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative"
            >
              {/* Header */}
              <div 
                className="relative p-8 pb-6 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}
              >
                {/* Subtle gold ambient lighting effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-600/5 opacity-60"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-yellow-600/15 rounded-full blur-3xl"></div>

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <motion.div 
                      className="relative"
                      animate={{
                        y: [0, -5, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <div 
                        className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-glow border border-yellow-400/30"
                        style={{
                          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Crown className="w-10 h-10 text-yellow-400 fill-current drop-shadow-lg" />
                      </div>
                      <motion.div
                        className="absolute -inset-2 bg-yellow-400/20 rounded-3xl blur-xl"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                      />
                    </motion.div>
                    <div>
                      <Dialog.Title className="text-3xl font-bold text-yellow-400 drop-shadow-lg mb-2">
                        {getFeatureTitle()}
                      </Dialog.Title>
                      <p className="text-slate-300 text-lg drop-shadow-sm max-w-md">
                        {getFeatureDescription()}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={onClose}
                    className="p-3 rounded-xl hover:bg-slate-800/50 transition-all duration-300"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-6 h-6 text-slate-400 hover:text-slate-200" />
                  </motion.button>
                </div>
              </div>

              {/* Content */}
              <div className="relative p-8 grid lg:grid-cols-2 gap-8">
                {/* Features */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <span>What You Get</span>
                  </h3>
                  
                  <div className="space-y-4">
                    {features.map((feat, index) => (
                      <motion.div
                        key={feat.title}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative p-4 rounded-2xl border transition-all duration-300 ${
                          feat.highlight
                            ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-600 shadow-glow'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                        whileHover={{ y: -2 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-medium ${
                              feat.highlight
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                : 'bg-gradient-to-br from-primary-500 to-secondary-600'
                            }`}>
                              <feat.icon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-slate-100">
                                {feat.title}
                              </h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {feat.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400 line-through">
                              Free: {feat.free}
                            </div>
                            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400 flex items-center">
                              <Crown className="w-3 h-3 mr-1 fill-current" />
                              {feat.premium}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Bonus Features */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-4 border border-purple-200 dark:border-purple-800">
                    <h4 className="font-bold text-purple-700 dark:text-purple-300 mb-3 flex items-center space-x-2">
                      <Gift className="w-4 h-4" />
                      <span>Bonus Features</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {benefits.map((benefit, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          className="flex items-center space-x-2 text-purple-600 dark:text-purple-400"
                        >
                          <Check className="w-3 h-3 flex-shrink-0" />
                          <span>{benefit}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pricing Card */}
                <div className="space-y-6">
                  <motion.div 
                    className="relative rounded-3xl p-8 border-2 border-yellow-400/30 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    }}
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Gold ambient lighting */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/15 via-transparent to-yellow-600/10 opacity-70"></div>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-yellow-600/15 rounded-full blur-2xl"></div>

                    <div className="relative text-center">
                      <motion.div 
                        className="flex items-center justify-center space-x-3 mb-6"
                        animate={{
                          y: [0, -3, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                      >
                        <Sparkles className="w-8 h-8 text-yellow-400 drop-shadow-lg" />
                        <h3 className="text-2xl font-bold text-yellow-400 drop-shadow-lg">
                          Voypath Premium
                        </h3>
                        <Sparkles className="w-8 h-8 text-yellow-400 drop-shadow-lg" />
                      </motion.div>
                      
                      <div className="mb-6">
                        <div className="flex items-baseline justify-center space-x-2 mb-2">
                          <motion.span 
                            className="text-5xl font-bold text-yellow-400 drop-shadow-lg"
                            animate={{
                              scale: [1, 1.05, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                            }}
                          >
                            $9.99
                          </motion.span>
                          <span className="text-slate-300 drop-shadow-sm">/year</span>
                        </div>
                        <div className="text-slate-300 text-sm drop-shadow-sm">
                          ✨ That's just <span className="font-bold text-yellow-400">$0.83/month</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Footer */}
              <div className="relative p-8 pt-0">
                <div className="flex space-x-4">
                  <motion.button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-4 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 font-semibold"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Maybe Later
                  </motion.button>
                  <motion.button
                    onClick={() => setShowCheckout(true)}
                    className="flex-2 px-8 py-4 text-black rounded-2xl font-bold text-lg shadow-glow hover:shadow-glow-lg relative overflow-hidden group border-2 border-yellow-400"
                    style={{
                      background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
                    }}
                    whileHover={{ 
                      scale: 1.05,
                      y: -2,
                      boxShadow: '0 20px 40px rgba(251, 191, 36, 0.4)',
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 flex items-center justify-center space-x-3">
                      <Crown className="w-6 h-6 fill-current" />
                      <span>UPGRADE NOW</span>
                      <Rocket className="w-6 h-6" />
                    </span>
                  </motion.button>
                </div>
                
                <div className="text-center mt-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    💳 Secure payment • 🔒 30-day money-back guarantee • ⚡ Instant activation
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}