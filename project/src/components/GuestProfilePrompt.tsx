import React, { useState } from 'react';
import { User, X, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

export function GuestProfilePrompt() {
  const [name, setName] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const setUser = useStore(state => state.setUser);

  const handleSave = () => {
    if (name.trim()) {
      setUser({
        id: `guest-${Date.now()}`,
        name: name.trim(),
        isGuest: true,
      });
      setIsVisible(false);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-900/20 dark:via-slate-800/80 dark:to-secondary-900/20 backdrop-blur-xl border border-primary-200/50 dark:border-primary-800/50 rounded-3xl p-8 shadow-glass overflow-hidden"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-primary-400/20 to-secondary-500/20 rounded-full blur-2xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute -bottom-10 -left-10 w-24 h-24 bg-gradient-to-tr from-secondary-400/20 to-primary-500/20 rounded-full blur-2xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <motion.div 
                className="relative"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2, type: "spring", bounce: 0.5 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-3xl flex items-center justify-center shadow-glow">
                  <User className="w-8 h-8 text-white" />
                </div>
                <motion.div
                  className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-3 h-3 text-white" />
                </motion.div>
              </motion.div>
              <div>
                <motion.h3 
                  className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  Welcome to Voypath!
                </motion.h3>
                <motion.p 
                  className="text-slate-600 dark:text-slate-400 mt-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  Let's personalize your travel experience
                </motion.p>
              </div>
            </div>
            <motion.button
              onClick={handleSkip}
              className="p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all duration-300 group"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <X className="w-5 h-5 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
            </motion.button>
          </div>

          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                What should we call you?
              </label>
              <div className="relative">
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex-1 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 disabled:from-slate-300 disabled:via-slate-400 disabled:to-slate-300 dark:disabled:from-slate-600 dark:disabled:via-slate-700 dark:disabled:to-slate-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:cursor-not-allowed shadow-glow hover:shadow-glow-lg disabled:shadow-none relative overflow-hidden group"
                whileHover={{ scale: name.trim() ? 1.02 : 1 }}
                whileTap={{ scale: name.trim() ? 0.98 : 1 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10">Get Started</span>
              </motion.button>
              <motion.button
                onClick={handleSkip}
                className="px-6 py-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-medium rounded-2xl hover:bg-slate-100/60 dark:hover:bg-slate-700/60"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Skip for now
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}