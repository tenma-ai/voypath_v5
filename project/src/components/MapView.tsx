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
    
    // Check if Google Maps is loaded
    if (!isLoaded || typeof google === 'undefined') {
      return null;
    }
    
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

    console.log('🗺️ [MapView] Final marker color with fallback:', fillColor);

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

    // Format travel info - removed since travel_to_next doesn't exist
    let travelInfo = '';

    // Format duration
    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    };

    // Format wish level with stars
    const wishStars = place.wish_level ? '⭐'.repeat(place.wish_level) : '';

    // Format dates if available
    let dateInfo = '';
    if (place.arrival_time && place.departure_time) {
      dateInfo = `${place.arrival_time} - ${place.departure_time}`;
    } else if (scheduleInfo) {
      dateInfo = scheduleInfo;
    }

    // Check if system place
    const isSystemPlace = place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport';

    const content = isSystemPlace ? `
      <div style="padding: 12px; min-width: 280px; max-width: 350px;">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
            ${place.place_name || place.name}
          </h3>
        </div>
        
        <div style="space-y: 8px;">
          ${place.duration_minutes || place.stay_duration_minutes ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Stay Duration</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${formatDuration(place.duration_minutes || place.stay_duration_minutes)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    ` : `
      <div style="padding: 12px; min-width: 280px; max-width: 350px;">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
            ${place.place_name || place.name}
          </h3>
          ${place.category ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${place.category}</p>` : ''}
        </div>
        
        <div style="space-y: 8px;">
          <div style="margin-bottom: 8px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Added by</p>
            <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${userInfo || 'Unknown'}</p>
          </div>
          
          ${place.wish_level ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Priority</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${wishStars} (${place.wish_level}/5)</p>
            </div>
          ` : ''}
          
          ${dateInfo ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Schedule</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${dateInfo}</p>
            </div>
          ` : ''}
          
          ${place.duration_minutes || place.stay_duration_minutes ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Stay Duration</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${formatDuration(place.duration_minutes || place.stay_duration_minutes)}</p>
            </div>
          ` : ''}
          
          ${travelInfo ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Next Travel</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${travelInfo}</p>
            </div>
          ` : ''}
          
          ${place.notes ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Notes</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${place.notes}</p>
            </div>
          ` : ''}
        </div>
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

    // The edge function sets transport_mode on the destination place
    let transport = toPlace.transport_mode || fromPlace.transport_mode || '';
    let duration = toPlace.travel_time_from_previous || 0;
    
    // If still no transport mode, determine based on place types
    if (!transport) {
      const lat1 = Number(fromPlace.latitude);
      const lng1 = Number(fromPlace.longitude);
      const lat2 = Number(toPlace.latitude);
      const lng2 = Number(toPlace.longitude);
      const distance = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
      
      // Check if both places are airports or if one is destination/departure
      const fromIsAirport = fromPlace.place_type === 'airport' || 
        fromPlace.name?.toLowerCase().includes('airport') || 
        fromPlace.place_name?.toLowerCase().includes('airport');
      const toIsAirport = toPlace.place_type === 'airport' || 
        toPlace.name?.toLowerCase().includes('airport') || 
        toPlace.place_name?.toLowerCase().includes('airport');
      const fromIsSystem = fromPlace.place_type === 'departure' || fromPlace.place_type === 'destination';
      const toIsSystem = toPlace.place_type === 'departure' || toPlace.place_type === 'destination';
      
      // If connecting two airports or airport to/from departure/destination, it's a flight
      if ((fromIsAirport && toIsAirport) || 
          (fromIsAirport && toIsSystem) || 
          (fromIsSystem && toIsAirport)) {
        transport = 'Flight';
      } else if (distance > 5) {
        // Long distance between non-airports is also flight
        transport = 'Flight';
      } else if (distance > 0.1 || fromIsAirport || toIsAirport) {
        // Short/medium distance or single airport connection is car
        transport = 'Car';
      } else {
        transport = 'Walking';
      }
    }
    
    // Capitalize transport mode
    transport = transport.charAt(0).toUpperCase() + transport.slice(1).toLowerCase();
    
    // Duration is already set above
    const distance = 0; // Distance is not provided by the edge function

    // Format duration
    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    };

    // Get transport icon SVG and color
    const getTransportIconInfo = (mode: string) => {
      const modeLower = mode.toLowerCase();
      if (modeLower.includes('flight') || modeLower.includes('plane')) {
        return {
          color: '#2563EB',
          svg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2v0A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>'
        };
      } else if (modeLower.includes('car') || modeLower.includes('drive')) {
        return {
          color: '#92400E',
          svg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 0h12a2 2 0 0 1 0 4h-5m-7 0h12M5 9V7a1 1 0 0 1 1-1h9l3 4m-3 0h3a1 1 0 0 1 1 1v6h-2"/></svg>'
        };
      } else {
        return {
          color: '#6B7280',
          svg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/><path d="M12 14c-4.418 0-8 3.582-8 8h16c0-4.418-3.582-8-8-8z"/></svg>'
        };
      }
    };

    const transportIconInfo = getTransportIconInfo(transport);

    const content = `
      <div style="padding: 12px; min-width: 280px; max-width: 350px;">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937; display: flex; align-items: center; gap: 8px;">
            <span style="color: ${transportIconInfo.color};">${transportIconInfo.svg}</span>
            Route Information
          </h3>
        </div>
        
        <div style="space-y: 8px;">
          <div style="margin-bottom: 8px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">From</p>
            <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${fromPlace.place_name || fromPlace.name}</p>
          </div>
          
          <div style="margin-bottom: 8px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">To</p>
            <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${toPlace.place_name || toPlace.name}</p>
          </div>
          
          <div style="margin-bottom: 8px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Transport Mode</p>
            <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937; display: flex; align-items: center; gap: 6px;">
              <span style="color: ${transportIconInfo.color};">${transportIconInfo.svg}</span>
              ${transport}
            </p>
          </div>
          
          ${duration > 0 ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Duration</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${formatDuration(duration)}</p>
            </div>
          ` : ''}
          
          ${distance > 0 ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Distance</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${distance.toFixed(1)} km</p>
            </div>
          ` : ''}
        </div>
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