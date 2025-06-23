import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { MapPin, Car, UserRound } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getPlaceColor } from '../utils/ColorUtils';
import { OptimizationLoadingOverlay } from './OptimizationLoadingOverlay';
import { OptimizationSuccessOverlay } from './OptimizationSuccessOverlay';
import { AnimatePresence } from 'framer-motion';
import { getColorOrFallback } from '../utils/ColorFallbackUtils';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

interface MapViewProps {
  optimizationResult?: any;
}

const MapView: React.FC<MapViewProps> = ({ optimizationResult }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const { currentTrip, memberColors, tripMembers, hasUserOptimized, isOptimizing, showOptimizationSuccess, setShowOptimizationSuccess } = useStore();

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // Handle optimization success animation - only show when explicitly triggered
  useEffect(() => {
    if (showOptimizationSuccess && optimizationResult) {
      setShowSuccessOverlay(true);
    }
  }, [showOptimizationSuccess, optimizationResult]);


  // Extract places from optimization result
  const getAllPlaces = useCallback(() => {
    console.log(`🗺️ [MapView] Trip: ${currentTrip?.name}, Has optimization: ${!!optimizationResult}, User optimized: ${hasUserOptimized}`);
    
    if (!hasUserOptimized || !optimizationResult?.optimization?.daily_schedules) {
      console.log('🗺️ [MapView] No user-initiated optimization data available');
      return [];
    }
    
    const places: any[] = [];
    optimizationResult.optimization.daily_schedules.forEach((schedule: any) => {
      if (schedule.scheduled_places && Array.isArray(schedule.scheduled_places)) {
        places.push(...schedule.scheduled_places);
      }
    });
    
    console.log(`🗺️ [MapView] Extracted ${places.length} places for display`);
    return places;
  }, [optimizationResult, currentTrip?.name, hasUserOptimized]);

  const places = getAllPlaces();

  // Colors are now loaded centrally via store

  // Create custom marker icon based on place color using centralized color logic
  const createCustomMarkerIcon = (place: any, index: number, allPlaces: any[]) => {
    console.log('🗺️ [MapView] Creating marker for place:', place.place_name || place.name);
    
    // Use centralized color utility
    const colorResult = getPlaceColor(place);
    console.log('🗺️ [MapView] Color result:', colorResult);
    
    // Handle system places (departure/destination) based on place type
    if (place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport') {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#374151', // Gray for system places
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        scale: 12,
      };
    }

    // Determine fill color based on centralized color result
    let fillColor = '#9CA3AF'; // Default gray
    
    if (colorResult.type === 'single') {
      fillColor = getColorOrFallback(colorResult.background, index);
    } else if (colorResult.type === 'gold') {
      fillColor = '#FFD700';
    } else if (colorResult.type === 'gradient') {
      // For Google Maps markers, use the primary contributor's color
      const primaryColor = colorResult.contributors[0]?.color;
      fillColor = getColorOrFallback(primaryColor, index);
    } else {
      // Use background color for any other case
      fillColor = getColorOrFallback(colorResult.background, index);
    }

    console.log('🗺️ [MapView] Final marker color with fallback:', fillColor);

    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: fillColor,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 10,
    };
  };

  // Function to calculate route offset for bidirectional routes
  const calculateRouteOffset = (lat1: number, lng1: number, lat2: number, lng2: number, offsetAmount: number = 0.001) => {
    // Calculate perpendicular vector
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return { lat: 0, lng: 0 };
    
    // Perpendicular vector (rotate 90 degrees)
    const perpX = -dy / length;
    const perpY = dx / length;
    
    return {
      lat: perpY * offsetAmount,
      lng: perpX * offsetAmount
    };
  };

  // Generate route lines between places using useMemo
  const routeLines = useMemo(() => {
    const lines: any[] = [];
    const routeMap = new Map<string, number>(); // Track routes for bidirectional detection
    
    places.forEach((place, index) => {
      
      if (index < places.length - 1) {
        const nextPlace = places[index + 1];
        
        if (place.latitude && place.longitude && nextPlace?.latitude && nextPlace?.longitude) {
          const lat1 = Number(place.latitude);
          const lng1 = Number(place.longitude);
          const lat2 = Number(nextPlace.latitude);
          const lng2 = Number(nextPlace.longitude);
          
          // Create route key for bidirectional detection
          const routeKey = `${Math.min(lat1, lat2)},${Math.min(lng1, lng2)}-${Math.max(lat1, lat2)},${Math.max(lng1, lng2)}`;
          const routeCount = routeMap.get(routeKey) || 0;
          routeMap.set(routeKey, routeCount + 1);
          
          // Determine line color based on transport mode
          let strokeColor = '#6B7280'; // Default gray
          let transportMode = 'walking'; // Default
          
          // Check for travel_to_next data
          if (place.travel_to_next && place.travel_to_next.transport_mode) {
            transportMode = place.travel_to_next.transport_mode.toLowerCase();
          } else {
            // Fallback: try to determine based on distance (rough estimate)
            const distance = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
            
            // More intelligent transport mode detection
            if (distance > 5) { // International travel
              transportMode = 'flight';
            } else if (distance > 0.1) { // Regional travel
              transportMode = 'car';
            } else {
              transportMode = 'walking';
            }
          }
          
          // 経路線の色分け
          switch (transportMode) {
            case 'flight':
            case 'plane':
            case 'airplane':
            case 'air':
            case 'flying':
              strokeColor = '#2563EB'; // 飛行機: 青色
              break;
            case 'car':
            case 'driving':
            case 'drive':
            case 'automobile':
            case 'vehicle':
            case 'taxi':
              strokeColor = '#92400E'; // 車: 茶色
              break;
            case 'walking':
            case 'walk':
            case 'pedestrian':
            case 'foot':
            case 'transit':
            case 'train':
            case 'bus':
            default:
              strokeColor = '#6B7280'; // 徒歩・その他: グレー
              break;
          }

          // Calculate offset for bidirectional routes
          let path = [
            { lat: lat1, lng: lng1 },
            { lat: lat2, lng: lng2 }
          ];
          
          // If this is the second occurrence of this route, apply offset
          if (routeCount > 0) {
            const offset = calculateRouteOffset(lat1, lng1, lat2, lng2, 0.002);
            path = [
              { lat: lat1 + offset.lat, lng: lng1 + offset.lng },
              { lat: lat2 + offset.lat, lng: lng2 + offset.lng }
            ];
          }

          // Create arrow icon for the middle of the route
          const arrowIcon = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: strokeColor,
            fillColor: strokeColor,
            fillOpacity: 1
          };

          const routeLine = {
            path: path,
            strokeColor: strokeColor,
            strokeOpacity: 0.8,
            strokeWeight: 3,
            key: `route-${index}`,
            icons: [{
              icon: arrowIcon,
              offset: '50%' // Place arrow at the middle of the line
            }],
            fromPlace: place,
            toPlace: nextPlace
          };

          lines.push(routeLine);
        }
      }
    });

    return lines;
  }, [places]);

  // Force generate basic lines if no route lines were created
  const finalRouteLines = useMemo(() => {
    if (routeLines.length > 0) return routeLines;
    
    const basicLines: any[] = [];
    for (let i = 0; i < places.length - 1; i++) {
      const currentPlace = places[i];
      const nextPlace = places[i + 1];
      
      if (currentPlace.latitude && currentPlace.longitude && nextPlace.latitude && nextPlace.longitude) {
        const arrowIcon = {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 3,
          strokeColor: '#6B7280',
          fillColor: '#6B7280',
          fillOpacity: 1
        };

        basicLines.push({
          path: [
            { lat: Number(currentPlace.latitude), lng: Number(currentPlace.longitude) },
            { lat: Number(nextPlace.latitude), lng: Number(nextPlace.longitude) }
          ],
          strokeColor: '#6B7280', // Default gray
          strokeOpacity: 0.6,
          strokeWeight: 2,
          key: `basic-route-${i}`,
          icons: [{
            icon: arrowIcon,
            offset: '50%'
          }]
        });
      }
    }
    
    return basicLines;
  }, [routeLines, places]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    
    // Create info window
    const newInfoWindow = new google.maps.InfoWindow();
    setInfoWindow(newInfoWindow);
    
    // Force a small delay to ensure map is fully rendered
    setTimeout(() => {
      // Adjust map bounds to show all markers
      if (places.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        places.forEach((place, index) => {
          if (place.latitude && place.longitude) {
            const position = new google.maps.LatLng(Number(place.latitude), Number(place.longitude));
            bounds.extend(position);
          }
        });
        
        map.fitBounds(bounds);
        
        // Add extra padding and zoom out slightly to ensure markers are visible
        setTimeout(() => {
          const currentZoom = map.getZoom();
          if (currentZoom && currentZoom > 1) {
            map.setZoom(Math.max(1, currentZoom - 1));
          }
        }, 100);
      }
    }, 100);
  }, [places]);

  const onUnmount = useCallback(() => {
    setMap(null);
    if (infoWindow) {
      infoWindow.close();
    }
  }, [infoWindow]);

  // Handle marker click
  const handleMarkerClick = useCallback((place: any, index: number) => {
    if (!map || !infoWindow) return;

    // Get user information for the place
    const colorResult = getPlaceColor(place);
    let userInfo = '';
    
    if (colorResult.type === 'single' && colorResult.userId) {
      const member = tripMembers.find(m => m.user_id === colorResult.userId);
      userInfo = member?.name || 'Unknown user';
    } else if (colorResult.type === 'gradient' && colorResult.contributors) {
      userInfo = colorResult.contributors.map(c => c.name).join(', ');
    } else if (colorResult.type === 'gold') {
      userInfo = 'All members';
    }

    // Format schedule info
    let scheduleInfo = '';
    if (place.day_number && place.hour) {
      scheduleInfo = `Day ${place.day_number}, ${place.hour}:00`;
    }

    // Format travel info
    let travelInfo = '';
    if (place.travel_to_next) {
      const transport = place.travel_to_next.transport_mode || 'Unknown';
      const duration = place.travel_to_next.duration_minutes || 0;
      travelInfo = `Next: ${transport} (${duration} min)`;
    }

    const content = `
      <div style="padding: 8px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">
          ${place.place_name || place.name}
        </h3>
        ${userInfo ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Requested by:</strong> ${userInfo}</p>` : ''}
        ${scheduleInfo ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Schedule:</strong> ${scheduleInfo}</p>` : ''}
        ${place.duration_minutes ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Duration:</strong> ${place.duration_minutes} min</p>` : ''}
        ${travelInfo ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Travel:</strong> ${travelInfo}</p>` : ''}
        ${place.place_type ? `<p style="margin: 4px 0; font-size: 12px; color: #666;"><em>Type: ${place.place_type}</em></p>` : ''}
      </div>
    `;

    infoWindow.setContent(content);
    infoWindow.setPosition({ 
      lat: Number(place.latitude), 
      lng: Number(place.longitude) 
    });
    infoWindow.open(map);
  }, [map, infoWindow, tripMembers]);

  // Handle route click
  const handleRouteClick = useCallback((fromPlace: any, toPlace: any, event: google.maps.PolyMouseEvent) => {
    if (!map || !infoWindow) return;

    const transport = fromPlace.travel_to_next?.transport_mode || 'Unknown';
    const duration = fromPlace.travel_to_next?.duration_minutes || 0;
    const distance = fromPlace.travel_to_next?.distance_km || 0;

    const content = `
      <div style="padding: 8px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">
          Route Information
        </h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>From:</strong> ${fromPlace.place_name || fromPlace.name}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>To:</strong> ${toPlace.place_name || toPlace.name}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Transport:</strong> ${transport}</p>
        ${duration > 0 ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Duration:</strong> ${duration} minutes</p>` : ''}
        ${distance > 0 ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Distance:</strong> ${distance.toFixed(1)} km</p>` : ''}
      </div>
    `;

    infoWindow.setContent(content);
    infoWindow.setPosition(event.latLng);
    infoWindow.open(map);
  }, [map, infoWindow]);

  // Update map bounds when places change
  useEffect(() => {
    if (map && places.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      places.forEach((place, index) => {
        if (place.latitude && place.longitude) {
          const position = new google.maps.LatLng(Number(place.latitude), Number(place.longitude));
          bounds.extend(position);
        }
      });
      
      map.fitBounds(bounds);
    }
  }, [map, places]);

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-gray-600">Failed to load map</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{
      background: 'linear-gradient(180deg, #6BB6FF 0%, #FFFFFF 100%)'
    }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: 35.6812, lng: 139.7671 }}
        zoom={6}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: 'auto',
          disableDefaultUI: true,
        }}
      >
        {/* Route lines */}
        {finalRouteLines.map((line) => (
          <Polyline
            key={line.key}
            path={line.path}
            options={{
              strokeColor: line.strokeColor,
              strokeOpacity: line.strokeOpacity,
              strokeWeight: line.strokeWeight,
              geodesic: true,
              icons: line.icons || [],
              clickable: true
            }}
            onClick={(e) => {
              if (line.fromPlace && line.toPlace) {
                handleRouteClick(line.fromPlace, line.toPlace, e);
              }
            }}
          />
        ))}
        
        {/* Place markers */}
        {places.map((place, index) => {
          if (!place.latitude || !place.longitude) return null;
          
          try {
            const customIcon = createCustomMarkerIcon(place, index, places);
            
            return (
              <Marker
                key={`place-${index}`}
                position={{ 
                  lat: Number(place.latitude), 
                  lng: Number(place.longitude) 
                }}
                title={`${index + 1}. ${place.place_name || place.name}`}
                icon={customIcon}
                onClick={() => handleMarkerClick(place, index)}
              />
            );
          } catch (error) {
            console.error(`🗺️ [MapView] Error creating marker for place ${index}:`, error);
            return null;
          }
        })}
      </GoogleMap>
      
      {/* Legend - Transport icons only */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2v0A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
            <div className="w-4 h-0.5" style={{ backgroundColor: '#2563EB' }}></div>
          </div>
          <div className="flex items-center space-x-1">
            <Car className="w-4 h-4 text-amber-700" />
            <div className="w-4 h-0.5" style={{ backgroundColor: '#92400E' }}></div>
          </div>
          <div className="flex items-center space-x-1">
            <UserRound className="w-4 h-4 text-gray-600" />
            <div className="w-4 h-0.5" style={{ backgroundColor: '#6B7280' }}></div>
          </div>
        </div>
      </div>

      {/* Optimization Overlays */}
      <AnimatePresence mode="wait">
        {isOptimizing && (
          <OptimizationLoadingOverlay key="loading" />
        )}
        {showSuccessOverlay && (
          <OptimizationSuccessOverlay 
            key="success"
            optimizationResult={optimizationResult}
            onComplete={() => {
              setShowSuccessOverlay(false);
              setShowOptimizationSuccess(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;