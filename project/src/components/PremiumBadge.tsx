import React from 'react';
import { Crown } from 'lucide-react';
import { motion } from 'framer-motion';

interface PremiumBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PremiumBadge({ className = '', size = 'md' }: PremiumBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <motion.div
      className={`inline-flex items-center space-x-1 bg-gradient-to-br from-slate-800 via-slate-900 to-black text-yellow-400 rounded-full font-semibold shadow-soft border border-yellow-400/20 backdrop-blur-sm ${sizeClasses[size]} ${className}`}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #000000 100%)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    >
      <Crown className={`${iconSizes[size]} fill-current drop-shadow-sm`} />
      <span className="drop-shadow-sm">Premium</span>
    </motion.div>
  );
}