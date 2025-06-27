/**
 * Premium Success Page - Confirmation page after successful premium upgrade
 */

import React, { useEffect } from 'react';
import { CheckCircle, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface PremiumSuccessPageProps {
  onContinue?: () => void;
}

export const PremiumSuccessPage: React.FC<PremiumSuccessPageProps> = ({ onContinue }) => {
  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      if (onContinue) {
        onContinue();
      } else {
        window.location.href = 'https://voypath.app';
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [onContinue]);

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      window.location.href = 'https://voypath.app';
    }
  };

  const features = [
    'Password protection for shared trips',
    'Expiry control for shared links',
    'Usage limits and analytics',
    'Advanced route optimization',
    'Priority customer support',
    'Unlimited trip creation'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-pink-500 p-8 text-center text-white">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h1 className="text-2xl font-bold mb-2">Welcome to Premium!</h1>
            <p className="text-white/90">Your upgrade was successful</p>
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center mb-6"
          >
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Crown className="w-6 h-6 text-amber-500" />
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Voypath Premium
              </span>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              You now have access to all premium features!
            </p>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="space-y-3 mb-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + (index * 0.1) }}
                className="flex items-center space-x-3"
              >
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">{feature}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Button */}
          <motion.button
            onClick={handleContinue}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>Start Using Premium Features</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>

          {/* Auto-redirect notice */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4"
          >
            You'll be redirected automatically in 10 seconds
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default PremiumSuccessPage;