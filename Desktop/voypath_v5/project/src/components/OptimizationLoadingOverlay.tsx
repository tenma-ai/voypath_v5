import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, MapPin, Route, Sparkles } from 'lucide-react';

export function OptimizationLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-gradient-to-br from-primary-900/95 via-primary-800/90 to-secondary-900/95 backdrop-blur-xl flex items-center justify-center"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating geometric shapes */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-primary-400/40 to-secondary-400/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 200 - 100],
              y: [0, Math.random() * 200 - 100],
              scale: [0.5, 1.5, 0.5],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}

        {/* Moving gradient lines */}
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background: `
              linear-gradient(45deg, transparent 48%, rgba(14, 165, 233, 0.5) 49%, rgba(14, 165, 233, 0.5) 51%, transparent 52%),
              linear-gradient(-45deg, transparent 48%, rgba(59, 130, 246, 0.5) 49%, rgba(59, 130, 246, 0.5) 51%, transparent 52%)
            `,
            backgroundSize: '60px 60px',
          }}
          animate={{
            backgroundPosition: ['0px 0px', '60px 60px'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* Central Animation */}
        <div className="relative mb-8">
          {/* Spinning outer ring */}
          <motion.div
            className="w-32 h-32 mx-auto border-4 border-primary-400/40 rounded-full relative"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            {/* Inner rotating elements */}
            <motion.div
              className="absolute inset-2 border-2 border-secondary-400/60 rounded-full"
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Central icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center shadow-2xl"
                animate={{
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(14, 165, 233, 0.7)",
                    "0 0 0 10px rgba(14, 165, 233, 0)",
                    "0 0 0 0 rgba(14, 165, 233, 0)"
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Wand2 className="w-8 h-8 text-white" />
                </motion.div>
              </motion.div>
            </div>

            {/* Floating icons around the circle */}
            {[MapPin, Route, Sparkles].map((Icon, index) => (
              <motion.div
                key={index}
                className="absolute w-8 h-8 bg-primary-400/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-primary-300/30"
                style={{
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0 0',
                }}
                animate={{
                  rotate: [0, 360],
                  x: [0, 60 * Math.cos((index * 120) * Math.PI / 180)],
                  y: [0, 60 * Math.sin((index * 120) * Math.PI / 180)],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "linear",
                  delay: index * 0.5,
                }}
              >
                <Icon className="w-4 h-4 text-primary-100" />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-50 via-white to-secondary-50 bg-clip-text text-transparent">
            Optimizing Your Journey
          </h2>
          
          <motion.p
            className="text-primary-100 text-lg leading-relaxed"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Creating the perfect route with AI-powered algorithms...
          </motion.p>

          {/* Progress indicators */}
          <div className="flex justify-center space-x-4 mt-6">
            {['Analyzing', 'Calculating', 'Optimizing'].map((stage, index) => (
              <motion.div
                key={stage}
                className="flex flex-col items-center space-y-2"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.5,
                  ease: "easeInOut",
                }}
              >
                <div className="w-2 h-2 bg-primary-300 rounded-full" />
                <span className="text-xs text-primary-200 font-medium">{stage}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom decorative elements */}
        <motion.div
          className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 flex space-x-1"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 h-1 bg-primary-200/40 rounded-full"
              animate={{ scale: [0.5, 1, 0.5] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}