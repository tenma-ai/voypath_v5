'use client';

import { Marker } from '@react-google-maps/api';

interface TemporaryPlacePinProps {
  position: {
    lat: number;
    lng: number;
  };
  onClick: () => void;
}

export default function TemporaryPlacePin({ position, onClick }: TemporaryPlacePinProps) {
  // SVG for pin with plus icon integrated
  // Base64 encoding the SVG to use as marker icon
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="36" height="48">
      <!-- Pin shape -->
      <path d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 24 12 24s12-16.8 12-24c0-6.6-5.4-12-12-12z" fill="#0EA5E9" />
      
      <!-- Plus icon -->
      <circle cx="12" cy="12" r="8" fill="white" />
      <path d="M12 7v10M7 12h10" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" />
    </svg>
  `;
  
  // Convert SVG to base64 for use in marker
  const svgBase64 = btoa(svgMarkup);
  const url = `data:image/svg+xml;base64,${svgBase64}`;
  
  return (
    <Marker
      position={position}
      icon={{
        url: url,
        scaledSize: new google.maps.Size(36, 48),
        anchor: new google.maps.Point(18, 48), // Bottom center of the icon
      }}
      animation={google.maps.Animation.DROP}
      onClick={onClick}
      title="Click to add this place"
      zIndex={1000}
    />
  );
} 