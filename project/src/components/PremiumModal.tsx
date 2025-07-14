import React, { useState } from 'react';
import { stripePromise, STRIPE_PRICES, TAX_CONFIG } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, Zap, Shield, Users, Globe, X, Check, Sparkles } from 'lucide-react';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useStore();

  const handleUpgrade = async () => {
    if (!user) {
      setError('Login required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Stripe Checkoutセッション作成
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: STRIPE_PRICES.PREMIUM_YEARLY.priceId,
          userId: user.id,
          customerEmail: user.email,
          automaticTax: TAX_CONFIG.automaticTax,
          successUrl: `${window.location.origin}/premium/success`,
          cancelUrl: `${window.location.origin}/premium/cancel`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment session');
      }

      const { sessionId } = await response.json();
      
      // Stripeチェックアウトにリダイレクト
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Failed to initialize Stripe');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (err) {
      // Error occurred
      setError(err instanceof Error ? err.message : 'An error occurred during payment processing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 pt-16 pb-16 sm:p-4 sm:pt-6 sm:pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          >
            {/* Modal Container */}
            <motion.div 
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Background Gradients */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-secondary-500/5 to-accent-500/5 rounded-3xl"></div>
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full blur-2xl"></div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                disabled={loading}
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>

              <div className="relative p-6 sm:p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div 
                    className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl mb-4 shadow-glow"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
                  >
                    <Crown className="w-8 h-8 text-white" />
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent mb-2">
                      Voypath Premium
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg">
                      Unlock the full potential of travel planning
                    </p>
                  </motion.div>
                </div>

                {/* Pricing */}
                <motion.div 
                  className="text-center mb-8 p-6 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-2xl border border-primary-100 dark:border-primary-800"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-5xl font-bold text-primary-600 dark:text-primary-400">
                      {STRIPE_PRICES.PREMIUM_YEARLY.displayPrice}
                    </span>
                    <div className="text-left">
                      <span className="text-lg text-slate-600 dark:text-slate-400">
                        /{STRIPE_PRICES.PREMIUM_YEARLY.displayInterval}
                      </span>
                    </div>
                  </div>
                  {TAX_CONFIG.automaticTax && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      * Taxes calculated automatically by region
                    </p>
                  )}
                </motion.div>

                {/* Features Grid */}
                <motion.div 
                  className="mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 text-center">
                    Premium Features
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {STRIPE_PRICES.PREMIUM_YEARLY.features.map((feature, index) => {
                      const icons = [Zap, Users, Shield, Globe, Star, Sparkles];
                      const Icon = icons[index % icons.length];
                      const gradients = [
                        'from-blue-500 to-cyan-500',
                        'from-purple-500 to-pink-500', 
                        'from-green-500 to-emerald-500',
                        'from-orange-500 to-red-500',
                        'from-yellow-500 to-orange-500',
                        'from-indigo-500 to-purple-500'
                      ];
                      
                      return (
                        <motion.div
                          key={index}
                          className="flex items-center space-x-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-300 group"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className={`w-10 h-10 bg-gradient-to-br ${gradients[index]} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors duration-300">
                            {feature}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Error Display */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <X className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-medium">{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <motion.div 
                  className="flex flex-col sm:flex-row gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 font-medium"
                    disabled={loading}
                  >
                    Maybe Later
                  </button>
                  <motion.button
                    onClick={handleUpgrade}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl hover:from-primary-700 hover:to-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold shadow-glow hover:shadow-glow-lg"
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <Crown className="w-5 h-5" />
                        <span>Upgrade to Premium</span>
                      </div>
                    )}
                  </motion.button>
                </motion.div>

                {/* Security Notice */}
                <motion.div 
                  className="mt-6 flex items-center justify-center space-x-2 text-sm text-slate-500 dark:text-slate-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <Shield className="w-4 h-4" />
                  <span>Secure payments powered by Stripe</span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};