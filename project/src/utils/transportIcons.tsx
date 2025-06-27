import React from 'react';

export type TransportMode = 'walking' | 'car' | 'flight' | 'public_transport' | 'bicycle' | 'taxi' | 'bus' | 'train' | 'travel' | 'driving' | 'walk';

interface TransportIconProps {
  mode: string;
  className?: string;
  size?: number;
}

const getTransportIconPath = (mode: string): string => {
  const normalizedMode = mode?.toLowerCase();
  
  switch (normalizedMode) {
    case 'walking':
    case 'walk':
      return '/icons8-walking-50.png';
    case 'car':
    case 'driving':
    case 'travel':
      return '/icons8-car-24.png';
    case 'flight':
      return '/icons8-plane-24.png';
    case 'public_transport':
    case 'bus':
    case 'train':
    case 'bicycle':
    case 'taxi':
    default:
      return '/icons8-car-24.png'; // Default fallback
  }
};

const getTransportName = (mode: string): string => {
  const normalizedMode = mode?.toLowerCase();
  
  switch (normalizedMode) {
    case 'walking':
    case 'walk':
      return 'Walking';
    case 'car':
    case 'driving':
    case 'travel':
      return 'Car';
    case 'flight':
      return 'Flight';
    case 'public_transport':
    case 'bus':
      return 'Bus';
    case 'train':
      return 'Train';
    case 'bicycle':
      return 'Bicycle';
    case 'taxi':
      return 'Taxi';
    default:
      return 'Car';
  }
};

const getTransportColor = (mode: string): string => {
  const normalizedMode = mode?.toLowerCase();
  
  switch (normalizedMode) {
    case 'walking':
    case 'walk':
      return '#10B981'; // Green
    case 'car':
    case 'driving':
    case 'travel':
      return '#6B7280'; // Gray
    case 'flight':
      return '#EC4899'; // Pink
    case 'public_transport':
    case 'bus':
      return '#3B82F6'; // Blue
    case 'train':
      return '#8B5CF6'; // Purple
    case 'bicycle':
      return '#F59E0B'; // Yellow
    case 'taxi':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray default
  }
};

// React component for transport icons
export const TransportIcon: React.FC<TransportIconProps> = ({ mode, className = '', size = 24 }) => {
  const iconPath = getTransportIconPath(mode);
  const iconName = getTransportName(mode);
  
  return (
    <img
      src={iconPath}
      alt={iconName}
      className={`transport-icon object-contain ${className}`}
      style={{ 
        width: size, 
        height: size,
        maxWidth: size,
        maxHeight: size
      }}
      onError={(e) => {
        // Fallback to emoji if image fails to load
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent && !parent.querySelector('.emoji-fallback')) {
          const emojiSpan = document.createElement('span');
          emojiSpan.className = 'emoji-fallback';
          emojiSpan.style.fontSize = `${Math.max(size * 0.8, 12)}px`;
          emojiSpan.style.lineHeight = '1';
          emojiSpan.style.display = 'flex';
          emojiSpan.style.alignItems = 'center';
          emojiSpan.style.justifyContent = 'center';
          emojiSpan.style.width = `${size}px`;
          emojiSpan.style.height = `${size}px`;
          emojiSpan.textContent = getTransportEmoji(mode);
          parent.appendChild(emojiSpan);
        }
      }}
    />
  );
};

// Utility functions for backward compatibility
export const getTransportIcon = (mode: string): string => {
  return getTransportIconPath(mode);
};

export const getTransportEmoji = (mode: string): string => {
  const normalizedMode = mode?.toLowerCase();
  
  switch (normalizedMode) {
    case 'walking':
    case 'walk':
      return '🚶';
    case 'car':
    case 'driving':
    case 'travel':
      return '🚗';
    case 'flight':
      return '✈️';
    case 'public_transport':
    case 'bus':
      return '🚌';
    case 'train':
      return '🚆';
    case 'bicycle':
      return '🚲';
    case 'taxi':
      return '🚕';
    default:
      return '🚗';
  }
};

export { getTransportName, getTransportColor };