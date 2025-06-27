/**
 * Premium Cancel Page - Page shown when premium upgrade is cancelled
 */

import React from 'react';
import { XCircle, ArrowLeft, Crown, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

interface PremiumCancelPageProps {
  onRetry?: () => void;
  onContinue?: () => void;
}

export const PremiumCancelPage: React.FC<PremiumCancelPageProps> = ({ onRetry, onContinue }) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.href = 'https://voypath.app/premium';
    }
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      window.location.href = 'https://voypath.app';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 p-8 text-center text-white">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <XCircle className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h1 className="text-2xl font-bold mb-2">Upgrade Cancelled</h1>
            <p className="text-white/90">No worries, you can still use Voypath</p>
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
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Your payment was cancelled. You can continue using Voypath with basic features or upgrade later.
            </p>
          </motion.div>

          {/* What you're missing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center space-x-2 mb-3">
              <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-amber-800 dark:text-amber-200">
                Premium Features You're Missing:
              </span>
            </div>
            <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
              <li>• Password protection for shared trips</li>
              <li>• Expiry control for shared links</li>
              <li>• Usage limits and analytics</li>
              <li>• Advanced route optimization</li>
              <li>• Priority customer support</li>
            </ul>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="space-y-3"
          >
            <button
              onClick={handleRetry}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              style={{ marginBottom: '12px' }}
            >
              <Crown className="w-4 h-4" />
              <span>Try Premium Again</span>
            </button>

            <button
              onClick={handleContinue}
              className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue with Basic</span>
            </button>
          </motion.div>

          {/* Support Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30"
          >
            <div className="flex items-start space-x-3">
              <Heart className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                  Need help?
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  If you had any issues with the payment process, feel free to contact our support team at{' '}
                  <a href="mailto:support@voypath.app" className="underline">
                    support@voypath.app
                  </a>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default PremiumCancelPage;