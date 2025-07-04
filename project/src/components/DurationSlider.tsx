import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface DurationSliderProps {
  value: number; // Duration in minutes
  onChange: (value: number) => void;
  className?: string;
}

// Predefined duration options in minutes
const durationOptions = [
  15,    // 15 minutes
  30,    // 30 minutes
  60,    // 1 hour
  120,   // 2 hours
  360,   // 6 hours
  720,   // 12 hours
  1440,  // 1 day
  2880,  // 2 days
  4320,  // 3 days
  5760,  // 4 days
  7200,  // 5 days
  8640,  // 6 days
  10080  // 7 days
];

export function DurationSlider({ value, onChange, className = '' }: DurationSliderProps) {
  const [sliderValue, setSliderValue] = useState(0);

  // Convert duration to slider index
  const getCurrentSliderValue = (duration: number): number => {
    const closestIndex = durationOptions.reduce((closest, option, index) => {
      return Math.abs(option - duration) < Math.abs(durationOptions[closest] - duration) ? index : closest;
    }, 0);
    return closestIndex;
  };

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
      }
      return `${days}d ${remainingHours}h`;
    }
  };

  // Get duration category for styling
  const getDurationCategory = (minutes: number): string => {
    if (minutes < 60) return 'short';
    if (minutes < 1440) return 'medium';
    return 'long';
  };

  // Get category colors
  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'short':
        return {
          bg: 'from-green-500 to-emerald-600',
          text: 'text-green-600 dark:text-green-400',
          icon: 'text-green-500'
        };
      case 'medium':
        return {
          bg: 'from-blue-500 to-indigo-600',
          text: 'text-blue-600 dark:text-blue-400',
          icon: 'text-blue-500'
        };
      case 'long':
        return {
          bg: 'from-purple-500 to-violet-600',
          text: 'text-purple-600 dark:text-purple-400',
          icon: 'text-purple-500'
        };
      default:
        return {
          bg: 'from-primary-500 to-secondary-600',
          text: 'text-primary-600 dark:text-primary-400',
          icon: 'text-primary-500'
        };
    }
  };

  useEffect(() => {
    setSliderValue(getCurrentSliderValue(value));
  }, [value]);

  const handleSliderChange = (newSliderValue: number) => {
    setSliderValue(newSliderValue);
    onChange(durationOptions[newSliderValue]);
  };

  const currentDuration = durationOptions[sliderValue];
  const category = getDurationCategory(currentDuration);
  const colors = getCategoryColors(category);
  const progress = (sliderValue / (durationOptions.length - 1)) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Duration Display */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Visit Duration
        </label>
        <motion.div
          className={`flex items-center space-x-2 px-3 py-2 rounded-xl bg-gradient-to-r ${colors.bg} text-white shadow-soft`}
          key={currentDuration}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {currentDuration >= 1440 ? (
            <Calendar className="w-4 h-4" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
          <span className="font-semibold text-sm">
            {formatDuration(currentDuration)}
          </span>
        </motion.div>
      </div>

      {/* Custom Slider */}
      <div className="relative">
        {/* Track */}
        <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          {/* Progress */}
          <motion.div
            className={`absolute left-0 top-0 h-full bg-gradient-to-r ${colors.bg} rounded-full`}
            style={{ width: `${progress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
          
          {/* Tick marks */}
          <div className="absolute inset-0 flex items-center justify-between px-1">
            {durationOptions.map((_, index) => (
              <div
                key={index}
                className={`w-1 h-1 rounded-full transition-colors duration-200 ${
                  index <= sliderValue 
                    ? 'bg-white/80' 
                    : 'bg-slate-400/50 dark:bg-slate-500/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min={0}
          max={durationOptions.length - 1}
          step={1}
          value={sliderValue}
          onChange={(e) => handleSliderChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer duration-slider-input"
          style={{
            background: 'transparent',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        />
      </div>

      {/* Duration Categories */}
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>Quick</span>
        </span>
        <span className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>Half Day</span>
        </span>
        <span className="flex items-center space-x-1">
          <Calendar className="w-3 h-3" />
          <span>Multi-Day</span>
        </span>
      </div>

      {/* Duration Description */}
      <motion.div
        className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
        key={category}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {category === 'short' && 'Perfect for quick visits, photo stops, or brief experiences.'}
          {category === 'medium' && 'Ideal for thorough exploration, dining, or activities.'}
          {category === 'long' && 'Great for immersive experiences, overnight stays, or extended activities.'}
        </p>
      </motion.div>
    </div>
  );
}