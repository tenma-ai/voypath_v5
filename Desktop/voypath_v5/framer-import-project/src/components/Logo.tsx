import React from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  clickable?: boolean;
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  width = 40, 
  height = 40, 
  clickable = false, 
  onClick 
}) => {
  const aspectRatio = 1024 / 1024; // Assuming square logo
  const actualHeight = width / aspectRatio;
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (clickable) {
      // Default behavior: navigate to main app
      window.location.href = 'https://voypath.app';
    }
  };
  
  return (
    <svg 
      width={width} 
      height={actualHeight} 
      viewBox="0 0 1024 1024" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${clickable ? 'cursor-pointer transition-opacity duration-200 hover:opacity-80' : ''}`}
      onClick={clickable ? handleClick : undefined}
      style={{
        cursor: clickable ? 'pointer' : 'default'
      }}
    >
      {/* Road/Path */}
      <path
        d="M240 200 C240 200, 300 250, 350 350 L450 550 C480 620, 500 680, 520 720"
        stroke="#546E7A"
        strokeWidth="80"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Dashed lines on road */}
      <path
        d="M320 300 L340 340 M360 380 L380 420 M400 460 L420 500"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        strokeDasharray="40 40"
      />
      
      {/* Airplane path */}
      <path
        d="M200 600 C300 500, 500 400, 700 350 C750 340, 800 340, 850 360"
        stroke="#29B6F6"
        strokeWidth="60"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Airplane */}
      <g transform="translate(850, 360) rotate(-30)">
        {/* Airplane body */}
        <path
          d="M0 0 L60 -20 L80 -20 L80 -10 L100 -10 L100 10 L80 10 L80 20 L60 20 L0 0"
          fill="#29B6F6"
        />
        {/* Wings */}
        <path
          d="M40 -10 L20 -50 L30 -50 L50 -10 M40 10 L20 50 L30 50 L50 10"
          fill="#29B6F6"
        />
      </g>
    </svg>
  );
};

export default Logo;