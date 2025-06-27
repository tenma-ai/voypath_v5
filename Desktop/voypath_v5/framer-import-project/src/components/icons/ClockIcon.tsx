import React from 'react';

interface ClockIconProps {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
}

const ClockIcon: React.FC<ClockIconProps> = ({ 
  className = '', 
  width, 
  height, 
  size = 20 
}) => {
  const finalWidth = width || size;
  const finalHeight = height || size;

  return (
    <svg 
      width={finalWidth} 
      height={finalHeight} 
      viewBox="0 0 20 20" 
      fill="currentColor"
      className={className}
    >
      <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm.5-9H9v5l4.25 2.52.77-1.28-3.52-2.09V7z"/>
    </svg>
  );
};

export default ClockIcon;