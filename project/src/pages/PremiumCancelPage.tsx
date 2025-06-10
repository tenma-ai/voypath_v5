import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Crown, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export function PremiumCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-glass text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring", bounce: 0.6 }}
          className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <AlertCircle className="w-8 h-8 text-orange-500" />
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Payment Cancelled
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Your payment was cancelled. No charges were made to your account.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            You can try again anytime or continue using Voypath with the free plan.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="space-y-4"
        >
          <motion.button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-2xl hover:from-primary-600 hover:to-secondary-700 transition-all duration-300 font-semibold shadow-glow"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex items-center justify-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </span>
          </motion.button>

          <motion.button
            onClick={() => window.history.back()}
            className="w-full px-6 py-3 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 font-semibold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </span>
          </motion.button>
        </motion.div>

        {/* Support Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-6 text-xs text-slate-500 dark:text-slate-400"
        >
          Need help? <a href="mailto:support@voypath.com" className="text-primary-600 dark:text-primary-400 hover:underline">Contact Support</a>
        </motion.div>
      </motion.div>
    </div>
  );
}