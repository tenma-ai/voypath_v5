import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { Crown, Check, Star, Zap, Shield, Users, Globe, Home, User, Sparkles } from 'lucide-react';

export const PremiumSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const { user, refreshUser } = useStore();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // ユーザー情報を更新してPremiumステータスを反映
    const updateUserStatus = async () => {
      try {
        await refreshUser();
        
        // 少し待ってからWebhookが処理されることを考慮
        setTimeout(async () => {
          await refreshUser();
          setLoading(false);
        }, 2000);
      } catch (error) {
        console.error('Failed to refresh user status:', error);
        setLoading(false);
      }
    };

    updateUserStatus();
  }, [refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div 
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-3xl mb-6 shadow-glow"
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <Crown className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Processing Payment...
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Updating your account
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="relative max-w-2xl w-full">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 rounded-3xl blur-3xl"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/30 to-pink-500/30 rounded-full blur-2xl"></div>
        
        <motion.div 
          className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 sm:p-12 border border-slate-200 dark:border-slate-700"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="text-center">
            {/* Success Animation */}
            <motion.div 
              className="relative mx-auto mb-8"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8, type: "spring", bounce: 0.4 }}
            >
              <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl shadow-glow">
                <Check className="w-12 h-12 text-white" strokeWidth={3} />
                
                {/* Celebration sparkles */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                    style={{
                      left: `${Math.cos((i * 60) * Math.PI / 180) * 60 + 50}%`,
                      top: `${Math.sin((i * 60) * Math.PI / 180) * 60 + 50}%`,
                    }}
                    animate={{
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                      rotate: [0, 180, 360],
                    }}
                    transition={{
                      duration: 2,
                      delay: 0.5 + i * 0.1,
                      repeat: Infinity,
                      repeatDelay: 3,
                    }}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent mb-4">
                Welcome to Premium!
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
                Thank you for upgrading! Enjoy all premium features.
              </p>
            </motion.div>

            {/* Premium Features Showcase */}
            <motion.div 
              className="mb-8 p-6 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-2xl border border-primary-100 dark:border-primary-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <div className="flex items-center justify-center space-x-2 mb-6">
                <Crown className="w-6 h-6 text-yellow-500" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Premium Features Unlocked
                </h3>
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Zap, text: "Unlimited trip creation", color: "from-blue-500 to-cyan-500" },
                  { icon: Users, text: "Advanced sharing features", color: "from-purple-500 to-pink-500" },
                  { icon: Shield, text: "Password protected sharing", color: "from-green-500 to-emerald-500" },
                  { icon: Globe, text: "Access analytics", color: "from-orange-500 to-red-500" },
                  { icon: Star, text: "Priority support", color: "from-yellow-500 to-orange-500" }
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center space-x-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                  >
                    <div className={`w-10 h-10 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center`}>
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {feature.text}
                    </span>
                    <Check className="w-5 h-5 text-green-500 ml-auto" />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Session ID */}
            {sessionId && (
              <motion.div 
                className="mb-8 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Session ID: {sessionId}
                </p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              <Link
                to="/"
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl hover:from-primary-700 hover:to-secondary-700 transition-all duration-300 font-bold shadow-glow hover:shadow-glow-lg group"
              >
                <Home className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span>Go to Home</span>
              </Link>
              <Link
                to="/profile"
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 font-medium group"
              >
                <User className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span>Profile Settings</span>
              </Link>
            </motion.div>

            {/* Confetti Effect */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -50, 0],
                    x: [0, Math.random() * 40 - 20, 0],
                    rotate: [0, 360],
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    delay: Math.random() * 2,
                    repeat: Infinity,
                    repeatDelay: 5,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};