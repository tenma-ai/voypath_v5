import React from 'react';

interface GooglePlayIconProps {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
}

const GooglePlayIcon: React.FC<GooglePlayIconProps> = ({ 
  className = '', 
  width, 
  height, 
  size = 28 
}) => {
  const finalWidth = width || size;
  const finalHeight = height || size;

  return (
    <svg 
      width={finalWidth} 
      height={finalHeight} 
      viewBox="0 0 28 28" 
      fill="currentColor"
      className={className}
    >
      <path d="M3.06 1.89c-.37.4-.58.97-.58 1.65v20.92c0 .68.21 1.25.58 1.65l.09.08L15.43 14l-.09-.09L3.06 1.89zm18.12 10.18l-4.08-2.32L14.97 14l2.13 2.13 4.08-2.32c.58-.33.93-.84.93-1.4s-.35-1.07-.93-1.4zM3.75 26.46c.23.17.51.25.81.25.21 0 .43-.04.65-.13l14.45-8.2L17.53 16.13 3.75 26.46zm15.91-10.33L5.21 1.67c-.22-.09-.44-.13-.65-.13-.3 0-.58.08-.81.25l13.78 10.34z"/>
    </svg>
  );
};

export default GooglePlayIcon;