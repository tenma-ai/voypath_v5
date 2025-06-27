/**
 * Place Status Indicator Component
 * Shows status badges with icons and colors for scheduled/unscheduled/pending places
 */

import React from 'react';
import { Calendar, Clock, HelpCircle, CheckCircle } from 'lucide-react';

export type PlaceStatus = 'scheduled' | 'unscheduled' | 'pending';

export interface PlaceStatusConfig {
  status: PlaceStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: {
    bg: string;
    text: string;
    border: string;
  };
  description: string;
}

export const PLACE_STATUS_CONFIG: Record<PlaceStatus, PlaceStatusConfig> = {
  scheduled: {
    status: 'scheduled',
    label: 'Scheduled',
    icon: CheckCircle,
    color: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200'
    },
    description: 'Confirmed in itinerary'
  },
  unscheduled: {
    status: 'unscheduled',
    label: 'Unscheduled',
    icon: Clock,
    color: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200'
    },
    description: 'Added but not scheduled'
  },
  pending: {
    status: 'pending',
    label: 'Pending',
    icon: HelpCircle,
    color: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200'
    },
    description: 'Awaiting optimization'
  }
};

interface PlaceStatusIndicatorProps {
  status: PlaceStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlaceStatusIndicator({ 
  status, 
  showLabel = true, 
  size = 'md', 
  className = '' 
}: PlaceStatusIndicatorProps) {
  const config = PLACE_STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${config.color.bg} ${config.color.text} ${config.color.border}
        ${sizeClasses[size]}
        ${className}
      `}
      title={config.description}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && config.label}
    </span>
  );
}

interface PlaceStatusActionsProps {
  currentStatus: PlaceStatus;
  onStatusChange: (newStatus: PlaceStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function PlaceStatusActions({
  currentStatus,
  onStatusChange,
  disabled = false,
  className = ''
}: PlaceStatusActionsProps) {
  const availableStatuses: PlaceStatus[] = ['pending', 'unscheduled', 'scheduled'];

  return (
    <div className={`flex gap-2 ${className}`}>
      {availableStatuses.map((status) => {
        const config = PLACE_STATUS_CONFIG[status];
        const Icon = config.icon;
        const isActive = currentStatus === status;

        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            disabled={disabled || isActive}
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
              ${isActive 
                ? `${config.color.bg} ${config.color.text} ${config.color.border}` 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={`Mark as ${config.label.toLowerCase()}`}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

export default PlaceStatusIndicator;