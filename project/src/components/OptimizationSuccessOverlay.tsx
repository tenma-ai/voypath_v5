import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles, Star, Trophy, Zap } from 'lucide-react';

interface OptimizationSuccessOverlayProps {
  onComplete: () => void;
  optimizationResult?: any;
}

export function OptimizationSuccessOverlay({ onComplete, optimizationResult }: OptimizationSuccessOverlayProps) {
  const [currentPhase, setCurrentPhase] = useState<'celebration' | 'results' | 'closing'>('celebration');

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentPhase('results'), 2000);
    const timer2 = setTimeout(() => setCurrentPhase('closing'), 4000);
    const timer3 = setTimeout(() => onComplete(), 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  // Extract key metrics from optimization result
  const totalScore = optimizationResult?.optimization?.optimization_score?.total_score || 0;
  const fairnessScore = optimizationResult?.optimization?.optimization_score?.fairness_score || 0;
  const efficiencyScore = optimizationResult?.optimization?.optimization_score?.efficiency_score || 0;
  const executionTime = optimizationResult?.execution_time_ms || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-gradient-to-br from-green-900/95 via-emerald-800/90 to-green-900/95 backdrop-blur-xl flex items-center justify-center overflow-hidden"
    >
      {/* Celebration Effects */}
      <AnimatePresence mode="wait">
        {currentPhase === 'celebration' && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="relative z-10"
          >
            {/* Confetti/Sparkle Effects */}
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-400 rounded-full"
                style={{
                  left: `${50 + (Math.random() - 0.5) * 100}%`,
                  top: `${50 + (Math.random() - 0.5) * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: [(Math.random() - 0.5) * 200],
                  y: [(Math.random() - 0.5) * 200],
                }}
                transition={{
                  duration: 1.5,
                  delay: Math.random() * 0.5,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Main Success Icon */}
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 15,
                  delay: 0.2 
                }}
                className="relative mx-auto mb-6"
              >
                <motion.div
                  className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl"
                  animate={{
                    boxShadow: [
                      "0 0 0 0 rgba(34, 197, 94, 0.7)",
                      "0 0 0 20px rgba(34, 197, 94, 0)",
                      "0 0 0 0 rgba(34, 197, 94, 0)"
                    ],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: 2,
                    ease: "easeOut",
                  }}
                >
                  <CheckCircle className="w-16 h-16 text-white" strokeWidth={3} />
                </motion.div>

                {/* Floating success icons */}
                {[Trophy, Star, Zap, Sparkles].map((Icon, index) => (
                  <motion.div
                    key={index}
                    className="absolute w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                    style={{
                      top: '50%',
                      left: '50%',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      scale: [0, 1, 1, 0],
                      x: [0, 80 * Math.cos((index * 90) * Math.PI / 180)],
                      y: [0, 80 * Math.sin((index * 90) * Math.PI / 180)],
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 2,
                      delay: 0.5 + index * 0.1,
                      ease: "easeOut",
                    }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </motion.div>
                ))}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-4xl md:text-5xl font-bold text-white mb-4"
              >
                Optimization Success!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-xl text-green-100 font-medium"
              >
                Your perfect journey has been created
              </motion.p>
            </div>
          </motion.div>
        )}

        {currentPhase === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="relative z-10 text-center max-w-lg mx-auto px-6"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Optimization Results</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Overall Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-green-500/30 to-emerald-600/30 rounded-xl p-4 border border-green-400/30"
                >
                  <div className="text-3xl font-bold text-white">{Math.round(totalScore)}%</div>
                  <div className="text-green-100 text-sm font-medium">Overall Score</div>
                </motion.div>

                {/* Fairness Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-blue-500/30 to-blue-600/30 rounded-xl p-4 border border-blue-400/30"
                >
                  <div className="text-3xl font-bold text-white">{Math.round(fairnessScore)}%</div>
                  <div className="text-blue-100 text-sm font-medium">Fairness</div>
                </motion.div>

                {/* Efficiency Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-purple-500/30 to-purple-600/30 rounded-xl p-4 border border-purple-400/30"
                >
                  <div className="text-3xl font-bold text-white">{Math.round(efficiencyScore)}%</div>
                  <div className="text-purple-100 text-sm font-medium">Efficiency</div>
                </motion.div>
              </div>

              {/* Execution Time */}
              {executionTime > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-center"
                >
                  <div className="text-white/80 text-sm">
                    Optimized in {Math.round(executionTime / 1000)}s with AI algorithms
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}

        {currentPhase === 'closing' && (
          <motion.div
            key="closing"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative z-10 text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="text-white text-lg font-medium"
            >
              Loading your optimized journey...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background animated elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              "radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.3) 0%, transparent 50%), radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)",
            ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Moving particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}