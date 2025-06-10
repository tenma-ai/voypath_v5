import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

export function PremiumSuccessPage() {
  const navigate = useNavigate();
  const { upgradeToPremium } = useStore();

  useEffect(() => {
    // プレミアムアップグレードを実行
    upgradeToPremium();
  }, [upgradeToPremium]);

  const features = [
    'Unlimited trips and places',
    'Unlimited group members',
    'Advanced route optimization',
    'Priority customer support',
    'Offline access',
    'Premium themes'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-2xl w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-glass text-center relative overflow-hidden"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/50 via-transparent to-orange-50/50 dark:from-yellow-900/10 dark:via-transparent dark:to-orange-900/10"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          {/* Success Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: "spring", bounce: 0.6 }}
            className="relative mb-8"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-glow">
              <Crown className="w-12 h-12 text-white fill-current" />
            </div>
            
            {/* Sparkle Effects */}
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                style={{
                  left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 60}%`,
                  top: `${50 + Math.sin(i * 60 * Math.PI / 180) * 60}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </motion.div>

          {/* Success Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-4">
              🎉 Welcome to Premium!
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-6">
              Your subscription is now active. Enjoy unlimited travel planning!
            </p>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center justify-center space-x-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <span>Now Available</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1, duration: 0.3 }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 text-sm">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="space-y-4"
          >
            <motion.button
              onClick={() => navigate('/')}
              className="w-full px-8 py-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 text-black rounded-2xl font-bold text-lg shadow-glow hover:shadow-glow-lg relative overflow-hidden group"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10 flex items-center justify-center space-x-3">
                <span>Start Planning Your Next Adventure</span>
                <ArrowRight className="w-5 h-5" />
              </span>
            </motion.button>

            <motion.button
              onClick={() => navigate('/profile')}
              className="w-full px-6 py-3 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Manage Subscription
            </motion.button>
          </motion.div>

          {/* Thank You Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            className="mt-8 text-sm text-slate-500 dark:text-slate-400"
          >
            Thank you for supporting Voypath! 🙏
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}