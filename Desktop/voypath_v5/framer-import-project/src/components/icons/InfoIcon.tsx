import React from 'react';

interface InfoIconProps {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
}

const InfoIcon: React.FC<InfoIconProps> = ({ 
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
      <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
  );
};

export default InfoIcon;