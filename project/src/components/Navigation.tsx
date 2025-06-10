import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Map, MapPin, MessageCircle, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { to: '/', icon: Home, label: 'Home', gradient: 'from-blue-500 to-purple-600' },
  { to: '/my-trip', icon: Map, label: 'Plan', gradient: 'from-emerald-500 to-teal-600' },
  { to: '/my-trip/my-places', icon: MapPin, label: 'Places', gradient: 'from-orange-500 to-red-600' },
  { to: '/my-trip/chat', icon: MessageCircle, label: 'Chat', gradient: 'from-pink-500 to-rose-600' },
  { to: '/my-trip/share', icon: Share2, label: 'Share', gradient: 'from-indigo-500 to-blue-600' },
];

export function Navigation() {
  const location = useLocation();

  return (
    <motion.nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
    >
      {/* Enhanced Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/90 to-white/80 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-900/80"></div>
      
      {/* Compact floating orb effects */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-5 left-1/4 w-10 h-10 bg-gradient-to-r from-primary-400/15 to-secondary-500/15 rounded-full blur-xl"
          animate={{
            x: [0, 15, 0],
            y: [0, -5, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute -top-4 right-1/4 w-8 h-8 bg-gradient-to-r from-secondary-400/15 to-accent-500/15 rounded-full blur-xl"
          animate={{
            x: [0, -10, 0],
            y: [0, -8, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>
      
      <div className="relative flex items-center justify-around h-16 px-1 safe-area-pb">
        {navItems.map(({ to, icon: Icon, label, gradient }, index) => {
          const isActive = location.pathname === to;
          
          return (
            <NavLink
              key={to}
              to={to}
              className="group relative flex flex-col items-center justify-center px-3 py-1 rounded-2xl transition-all duration-300"
            >
              <motion.div
                className="relative flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                {/* Active Background with Matching Gradient */}
                {isActive && (
                  <motion.div
                    className={`absolute -inset-3 bg-gradient-to-br ${gradient} rounded-2xl shadow-glow`}
                    layoutId="activeTab"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                {/* Hover Background */}
                <motion.div 
                  className="absolute -inset-3 bg-slate-100/60 dark:bg-slate-800/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  whileHover={{ scale: 1.05 }}
                />
                
                {/* Icon Container - Compact */}
                <div className="relative z-10 mb-0.5">
                  <motion.div 
                    className={`p-2 rounded-xl transition-all duration-300 relative overflow-hidden ${
                      isActive 
                        ? 'bg-white/20 backdrop-blur-sm shadow-soft' 
                        : 'bg-transparent group-hover:bg-slate-200/60 dark:group-hover:bg-slate-700/60'
                    }`}
                    whileHover={{ scale: 1.1, rotate: isActive ? 0 : 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Sparkle effects for active state - Compact */}
                    {isActive && (
                      <div className="absolute inset-0">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-0.5 h-0.5 bg-white rounded-full"
                            style={{
                              left: `${25 + i * 25}%`,
                              top: `${25 + i * 20}%`,
                            }}
                            animate={{
                              scale: [0, 1, 0],
                              opacity: [0, 1, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.5,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    <Icon className={`w-4 h-4 transition-all duration-300 relative z-10 ${
                      isActive 
                        ? 'text-white drop-shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                    }`} />
                  </motion.div>
                </div>
                
                {/* Label - Compact */}
                <motion.span 
                  className={`text-xs font-semibold transition-all duration-300 relative z-10 ${
                    isActive 
                      ? 'text-white drop-shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                  }`}
                  animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {label}
                </motion.span>

                {/* Active indicator dot - Compact */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-0.5 w-0.5 h-0.5 bg-white rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                  />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </div>
      
      {/* Compact Bottom Safe Area */}
      <div className="h-safe-area-inset-bottom bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
    </motion.nav>
  );
}