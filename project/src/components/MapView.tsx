import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getPlaceColor } from '../utils/ColorUtils';
import { OptimizationLoadingOverlay } from './OptimizationLoadingOverlay';
import { OptimizationSuccessOverlay } from './OptimizationSuccessOverlay';
import { AnimatePresence } from 'framer-motion';
import { getColorOrFallback } from '../utils/ColorFallbackUtils';
import { pixabayService } from '../services/PixabayService';
// Map component for displaying travel routes and places
import { DateUtils } from '../utils/DateUtils';
import { PlaceDateUtils } from '../utils/PlaceDateUtils';
import { TravelPayoutsService, FlightOption } from '../services/TravelPayoutsService';
import MapPlaceModal from './MapPlaceModal';
import MapRouteModal from './MapRouteModal';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

interface MapViewProps {
  optimizationResultProp?: any;
}

const MapView: React.FC<MapViewProps> = ({ optimizationResultProp }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [placeImages, setPlaceImages] = useState<Map<string, string>>(new Map());
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedPlaceForModal, setSelectedPlaceForModal] = useState<any>(null);
  const [selectedRouteForModal, setSelectedRouteForModal] = useState<{ fromPlace: any; toPlace: any } | null>(null);
  const { currentTrip, memberColors, tripMembers, hasUserOptimized, isOptimizing, showOptimizationSuccess, setShowOptimizationSuccess, optimizationResult, selectedDay, setupRealTimeSync } = useStore();

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // DISABLED: Setup real-time sync for schedule updates (was causing auth issues)
  useEffect(() => {
    console.log('Schedule update listeners disabled - functionality removed');
    // DISABLED: const handleScheduleUpdate = (event: CustomEvent) => {
    // DISABLED:   console.log('MapView: Received schedule update:', event.detail);
    // DISABLED:   setShowSuccessOverlay(false);
    // DISABLED: };
    // DISABLED: window.addEventListener('voypath-schedule-update', handleScheduleUpdate as EventListener);
    // DISABLED: return () => {
    // DISABLED:   window.removeEventListener('voypath-schedule-update', handleScheduleUpdate as EventListener);
    // DISABLED: };
  }, []);

  // Setup real-time sync cleanup
  useEffect(() => {
    console.log('Realtime setup skipped - functionality disabled');
    // const cleanup = setupRealTimeSync();
    // return cleanup;
  }, [setupRealTimeSync]);

  // Handle optimization success animation - only show when explicitly triggered
  useEffect(() => {
    const currentOptimizationResult = optimizationResult || optimizationResultProp;
    if (showOptimizationSuccess && currentOptimizationResult) {
      setShowSuccessOverlay(true);
    }
  }, [showOptimizationSuccess, optimizationResult, optimizationResultProp]);

  // DISABLED: Setup global flight booking function (was causing auth issues)
  useEffect(() => {
    console.log('Global flight booking function disabled - functionality removed');
    // DISABLED: (window as any).bookFlight = (bookingUrl: string) => {
    // DISABLED:   window.open(bookingUrl, '_blank');
    // DISABLED:   console.log(`Flight booking: ${bookingUrl}`);
    // DISABLED:   if (typeof gtag !== 'undefined') {
    // DISABLED:     gtag('event', 'flight_booking_click', {
    // DISABLED:       'event_category': 'TravelPayouts',
    // DISABLED:       'event_label': 'Flight_Booking',
    // DISABLED:       'value': 1
    // DISABLED:     });
    // DISABLED:   }
    // DISABLED: };
    // DISABLED: return () => {
    // DISABLED:   delete (window as any).bookFlight;
    // DISABLED: };
  }, []);


  // Extract places from optimization result
  const getAllPlaces = useCallback(() => {
    // Log message
    const currentOptimizationResult = optimizationResult || optimizationResultProp;
    
    if (!hasUserOptimized || !currentOptimizationResult?.optimization?.daily_schedules) {
      // Log message
      return [];
    }
    
    const places: any[] = [];
    currentOptimizationResult.optimization.daily_schedules.forEach((schedule: any) => {
      if (schedule.scheduled_places && Array.isArray(schedule.scheduled_places)) {
        places.push(...schedule.scheduled_places);
      }
    });
    
    // Log message
    return places;
  }, [optimizationResult, optimizationResultProp, hasUserOptimized]);

  const places = getAllPlaces();

  // Colors are now loaded centrally via store

  // Create custom marker icon based on place color using centralized color logic
  const createCustomMarkerIcon = (place: any, index: number, allPlaces: any[]) => {
    // Log message
    
    // Check if Google Maps is loaded
    if (!isLoaded || typeof google === 'undefined') {
      return null;
    }
    
    // Use centralized color utility
    const colorResult = getPlaceColor(place);
    // Log message
    
    // Check for system place first (same logic as MyPlacesPage)
    const isSystemPlace = (
      place.source === 'system' ||
      place.category === 'departure_point' ||
      place.category === 'destination_point' ||
      place.category === 'return_point' ||
      place.place_type === 'departure' ||
      place.place_type === 'destination'
    );
    
    if (isSystemPlace) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#000000', // Black for system places (matching list view)
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        scale: 8,
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

    // Log message

    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: fillColor,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 7,
    };
  };

  // Function to create curved path for bidirectional routes
  const createCurvedPath = (lat1: number, lng1: number, lat2: number, lng2: number, curve: number = 0.15) => {
    // Calculate midpoint
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    
    // Calculate perpendicular direction
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return [{ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }];
    
    // Perpendicular vector (rotate 90 degrees)
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Create control point offset by curve amount
    const controlLat = midLat + perpY * length * curve;
    const controlLng = midLng + perpX * length * curve;
    
    // Create curved path with multiple points for smooth curve
    const points = [];
    const numPoints = 20;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const t2 = t * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      
      // Quadratic Bezier curve formula
      const lat = mt2 * lat1 + 2 * mt * t * controlLat + t2 * lat2;
      const lng = mt2 * lng1 + 2 * mt * t * controlLng + t2 * lng2;
      
      points.push({ lat, lng });
    }
    
    return points;
  };

  // Generate route lines between places using useMemo
  const routeLines = useMemo(() => {
    // Check if Google Maps is loaded
    if (!isLoaded || typeof google === 'undefined') {
      return [];
    }
    
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
          
          // Check for transport mode data from optimization result
          // The edge function sets transport_mode on the NEXT place, not the current one
          if (nextPlace.transport_mode) {
            transportMode = nextPlace.transport_mode.toLowerCase();
          } else if (place.transport_mode) {
            // Fallback: check if transport mode is directly on the current place
            transportMode = place.transport_mode.toLowerCase();
          } else {
            // Fallback: try to determine based on distance and place types
            const distance = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
            
            // Check if both places are airports or if one is destination/departure
            const fromIsAirport = place.place_type === 'airport' || 
              place.name?.toLowerCase().includes('airport') || 
              place.place_name?.toLowerCase().includes('airport');
            const toIsAirport = nextPlace.place_type === 'airport' || 
              nextPlace.name?.toLowerCase().includes('airport') || 
              nextPlace.place_name?.toLowerCase().includes('airport');
            const fromIsSystem = place.place_type === 'departure' || place.place_type === 'destination';
            const toIsSystem = nextPlace.place_type === 'departure' || nextPlace.place_type === 'destination';
            
            // If connecting two airports or airport to/from departure/destination, it's a flight
            if ((fromIsAirport && toIsAirport) || 
                (fromIsAirport && toIsSystem) || 
                (fromIsSystem && toIsAirport)) {
              transportMode = 'flight';
            } else if (distance > 5) {
              // Long distance between non-airports is also flight
              transportMode = 'flight';
            } else if (distance > 0.1 || fromIsAirport || toIsAirport) {
              // Short/medium distance or single airport connection is car
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

          // Calculate path - use curved path for bidirectional routes
          let path;
          
          // If this is the second occurrence of this route, create curved path
          if (routeCount > 0) {
            // Curve in opposite direction for return route
            path = createCurvedPath(lat1, lng1, lat2, lng2, -0.1);
          } else {
            // First occurrence - slight curve for better visibility
            path = createCurvedPath(lat1, lng1, lat2, lng2, 0.1);
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
  }, [places, isLoaded]);

  // Force generate basic lines if no route lines were created
  const finalRouteLines = useMemo(() => {
    if (routeLines.length > 0) return routeLines;
    
    // Check if Google Maps is loaded
    if (!isLoaded || typeof google === 'undefined') {
      return [];
    }
    
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
  }, [routeLines, places, isLoaded]);

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
    // Always use the new modal for better UX
    setSelectedPlaceForModal(place);
    setShowPlaceModal(true);
  }, []);

  // Handle route click
  const handleRouteClick = useCallback((fromPlace: any, toPlace: any, event: google.maps.PolyMouseEvent) => {
    // Always use the new modal for better UX
    setSelectedRouteForModal({ fromPlace, toPlace });
    setShowRouteModal(true);
  }, []);

  // Update map bounds when places change - only on initial load
  useEffect(() => {
    if (map && places.length > 0) {
      // Check if this is the initial load (map hasn't been fitted yet)
      const hasBeenFitted = (map as any).__boundsSet;
      
      if (!hasBeenFitted) {
        const bounds = new google.maps.LatLngBounds();
        places.forEach((place, index) => {
          if (place.latitude && place.longitude) {
            const position = new google.maps.LatLng(Number(place.latitude), Number(place.longitude));
            bounds.extend(position);
          }
        });
        
        map.fitBounds(bounds);
        // Mark that bounds have been set to prevent future resets
        (map as any).__boundsSet = true;
      }
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
          gestureHandling: 'greedy',
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
            // Error occurred
            return null;
          }
        })}
      </GoogleMap>
      
      {/* Legend - Transport icons only */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <img src="/icons8-plane-24.png" className="w-4 h-4" alt="Flight" />
            <div className="w-4 h-0.5" style={{ backgroundColor: '#2563EB' }}></div>
          </div>
          <div className="flex items-center space-x-1">
            <img src="/icons8-car-24.png" className="w-4 h-4" alt="Car" />
            <div className="w-4 h-0.5" style={{ backgroundColor: '#92400E' }}></div>
          </div>
          <div className="flex items-center space-x-1">
            <img src="/icons8-walking-50.png" className="w-4 h-4" alt="Walking" />
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

      {/* Mobile Modals */}
      <MapPlaceModal
        isOpen={showPlaceModal}
        onClose={() => setShowPlaceModal(false)}
        place={selectedPlaceForModal}
        index={places.findIndex(p => p === selectedPlaceForModal)}
      />

      <MapRouteModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        fromPlace={selectedRouteForModal?.fromPlace}
        toPlace={selectedRouteForModal?.toPlace}
      />
    </div>
  );
};

export default MapView;