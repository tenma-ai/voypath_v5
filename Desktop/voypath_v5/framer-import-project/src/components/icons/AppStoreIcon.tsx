import React from 'react';

interface AppStoreIconProps {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
}

const AppStoreIcon: React.FC<AppStoreIconProps> = ({ 
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
      <path d="M14 0C6.268 0 0 6.268 0 14s6.268 14 14 14 14-6.268 14-14S21.732 0 14 0zm1.41 20.94a1.3 1.3 0 01-1.15.69c-.52 0-.95-.3-1.15-.69l-1.32-2.28h-3.5c-.72 0-1.3-.58-1.3-1.3 0-.36.15-.69.39-.93l5.5-9.53c.2-.35.58-.55.98-.55s.78.2.98.55l1.75 3.03 1.75-3.03c.2-.35.58-.55.98-.55s.78.2.98.55c.2.35.2.78 0 1.13l-2.28 3.95h3.5c.72 0 1.3.58 1.3 1.3s-.58 1.3-1.3 1.3h-3.5l-1.32 2.28z"/>
    </svg>
  );
};

export default AppStoreIcon;