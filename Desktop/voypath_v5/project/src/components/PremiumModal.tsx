/**
 * Premium Modal Component - Upgrade to Premium interface
 */

import React, { useState } from 'react';
import { X, Crown, Check, Star, Shield, Clock, Users, Map, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      if (onUpgrade) {
        onUpgrade();
      } else {
        // Default behavior: redirect to Stripe checkout
        window.location.href = 'https://voypath.app/premium';
      }
    } catch (error) {
      console.error('Error starting upgrade:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: 'Password Protected Trips',
      description: 'Secure your shared trips with custom passwords',
      highlight: true
    },
    {
      icon: Clock,
      title: 'Expiry Control',
      description: 'Set expiration dates for shared links',
      highlight: true
    },
    {
      icon: Users,
      title: 'Usage Limits',
      description: 'Control how many times your trip can be accessed',
      highlight: true
    },
    {
      icon: Map,
      title: 'Advanced Route Optimization',
      description: 'AI-powered smart routing with multiple optimization modes',
      highlight: false
    },
    {
      icon: Star,
      title: 'Priority Support',
      description: '24/7 dedicated customer support',
      highlight: false
    },
    {
      icon: Heart,
      title: 'Unlimited Trips',
      description: 'Create as many trips as you want',
      highlight: false
    }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
        style={{
          padding: '1rem',
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
          style={{
            maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)',
            willChange: 'transform',
            transform: 'translateZ(0)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-pink-500 p-6 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-yellow-200" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voypath Premium</h2>
                <p className="text-white/80">Unlock powerful features</p>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-center">
                <div className="flex items-baseline justify-center space-x-1">
                  <span className="text-3xl font-bold">$9.99</span>
                  <span className="text-white/70">/ month</span>
                </div>
                <p className="text-sm text-white/80 mt-1">Cancel anytime</p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {features.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-start space-x-3 p-3 rounded-lg ${
                      feature.highlight 
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/30' 
                        : 'bg-slate-50 dark:bg-slate-700/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      feature.highlight
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {feature.title}
                        </h3>
                        {feature.highlight && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full dark:bg-amber-900/50 dark:text-amber-200">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {feature.description}
                      </p>
                    </div>
                    <div className="text-green-500 flex-shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Social Proof */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">4.9/5</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                "Premium features made our group trip planning so much easier and secure!"
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                - Sarah M., Premium User
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="space-y-3">
              <motion.button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Upgrade to Premium'
                )}
              </motion.button>
              
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                Secure payment by Stripe • 30-day money-back guarantee
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PremiumModal;