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
import { DateUtils } from '../utils/DateUtils';

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
  const [placeImages, setPlaceImages] = useState<Map<string, string>>(new Map());
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
    // Log message
    
    if (!hasUserOptimized || !optimizationResult?.optimization?.daily_schedules) {
      // Log message
      return [];
    }
    
    const places: any[] = [];
    optimizationResult.optimization.daily_schedules.forEach((schedule: any) => {
      if (schedule.scheduled_places && Array.isArray(schedule.scheduled_places)) {
        places.push(...schedule.scheduled_places);
      }
    });
    
    // Log message
    return places;
  }, [optimizationResult, currentTrip?.name, hasUserOptimized]);

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
    if (!map || !infoWindow) return;

    // Get user information for the place
    const colorResult = getPlaceColor(place);
    let userInfo = '';
    
    if (colorResult.type === 'single' && colorResult.contributors.length > 0) {
      userInfo = colorResult.contributors[0].memberName || 'Unknown user';
    } else if (colorResult.type === 'gradient' && colorResult.contributors) {
      userInfo = colorResult.contributors.map(c => c.memberName).join(', ');
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

    // Format duration using centralized utility
    const formatDuration = DateUtils.formatDuration;

    // Format wish level with stars (removed from display per requirements)
    const wishStars = place.wish_level ? '⭐'.repeat(place.wish_level) : '';

    // Helper function to format time without seconds
    const formatTimeWithoutSeconds = (timeString: string) => {
      if (!timeString) return timeString;
      
      // Handle different time formats
      if (timeString.includes('T')) {
        // ISO format: 2024-01-01T14:30:00
        const date = new Date(timeString);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      } else if (timeString.includes(':')) {
        // Time format: 14:30:00 or 14:30
        const timeParts = timeString.split(':');
        if (timeParts.length >= 2) {
          return `${timeParts[0]}:${timeParts[1]}`;
        }
      }
      
      return timeString;
    };

    // Check place type based on Edge Function logic
    const isDeparture = place.place_type === 'departure' || 
      place.category === 'departure_point' ||
      (place.source === 'system' && place.category === 'departure_point');
      
    const isDestination = place.place_type === 'destination' || 
      place.category === 'destination_point' ||
      (place.source === 'system' && place.category === 'destination_point');
      
    const isAirport = place.place_type === 'system_airport' || 
      place.category === 'airport' ||
      (place.name?.toLowerCase().includes('airport') || place.place_name?.toLowerCase().includes('airport'));
      
    const isMovement = place.transport_mode && !isAirport && !isDeparture && !isDestination;
    const isTripPlace = !isDeparture && !isDestination && !isAirport && !isMovement;

    // Debug logging
    console.log('🏷️ Place debug:', {
      name: place.place_name || place.name,
      place_type: place.place_type,
      category: place.category,
      source: place.source,
      transport_mode: place.transport_mode,
      isDeparture,
      isDestination, 
      isAirport,
      isMovement,
      isTripPlace
    });

    // Format schedule for different place types
    let scheduleDisplay = '';
    if (place.day_number && place.hour !== undefined) {
      // For airports and trip places - show schedule as month/day/hour/minute
      const scheduleDate = new Date();
      scheduleDate.setDate(scheduleDate.getDate() + (place.day_number - 1));
      scheduleDate.setHours(place.hour, place.minute || 0, 0, 0);
      
      scheduleDisplay = scheduleDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    // Debug schedule data
    console.log('📅 Schedule debug:', {
      name: place.place_name || place.name,
      day_number: place.day_number,
      hour: place.hour,
      minute: place.minute,
      scheduleDisplay,
      arrival_time: place.arrival_time,
      departure_time: place.departure_time
    });

    // Format departure/arrival times with date context
    let departureDisplay = '';
    let arrivalDisplay = '';
    
    // Calculate actual date for this place using DateUtils
    let actualDate = null;
    try {
      if (currentTrip && place.day_number) {
        actualDate = DateUtils.calculateTripDate(currentTrip, place.day_number);
      }
    } catch (error) {
      console.warn('Could not calculate trip date:', error);
    }
    
    if (place.departure_time) {
      departureDisplay = formatTimeWithoutSeconds(place.departure_time);
      if (actualDate) {
        const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
        departureDisplay = `${dateStr} ${departureDisplay}`;
      }
    }
    if (place.arrival_time) {
      arrivalDisplay = formatTimeWithoutSeconds(place.arrival_time);
      if (actualDate) {
        const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
        arrivalDisplay = `${dateStr} ${arrivalDisplay}`;
      }
    }

    let content = '';

    if (isDeparture) {
      // Departure place: show departure time only
      content = `
        <div style="padding: 12px; min-width: 280px; max-width: 350px;">
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
              ${place.place_name || place.name}
            </h3>
          </div>
          
          <div style="space-y: 8px;">
            ${departureDisplay ? `
              <div style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Departure</p>
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${departureDisplay}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (isDestination) {
      // Destination place: show arrival time only
      content = `
        <div style="padding: 12px; min-width: 280px; max-width: 350px;">
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
              ${place.place_name || place.name}
            </h3>
          </div>
          
          <div style="space-y: 8px;">
            ${arrivalDisplay ? `
              <div style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Arrival</p>
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${arrivalDisplay}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (isAirport) {
      // Airport: show stay duration in format "6/5 18:00-19:30" with proper date
      let scheduleDisplay = '';
      if (place.stay_duration_minutes && place.arrival_time && place.departure_time) {
        const arrivalTime = formatTimeWithoutSeconds(place.arrival_time);
        const departureTime = formatTimeWithoutSeconds(place.departure_time);
        
        if (actualDate) {
          const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
          scheduleDisplay = `${dateStr} ${arrivalTime}-${departureTime}`;
        } else {
          scheduleDisplay = `${arrivalTime}-${departureTime}`;
        }
      }
      
      content = `
        <div style="padding: 12px; min-width: 280px; max-width: 350px;">
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
              ${place.place_name || place.name}
            </h3>
          </div>
          
          <div style="space-y: 8px;">
            ${scheduleDisplay ? `
              <div style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Schedule</p>
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${scheduleDisplay}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (isMovement) {
      // Movement/Transport: show route information with proper travel times
      content = `
        <div style="padding: 12px; min-width: 280px; max-width: 350px;">
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
              Route Information
            </h3>
          </div>
          
          <div style="space-y: 8px;">
            ${place.duration_minutes || place.stay_duration_minutes ? `
              <div style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Duration</p>
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${DateUtils.formatDuration(place.duration_minutes || place.stay_duration_minutes)}</p>
              </div>
            ` : ''}
            
            ${place.arrival_time && place.departure_time ? `
              <div style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Travel Times</p>
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">
                  Departure: ${departureDisplay}<br>
                  Arrival: ${arrivalDisplay}
                </p>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      // Trip places: show schedule with time range, added by, priority (no duration display)
      let scheduleDisplay = '';
      if (place.stay_duration_minutes && place.arrival_time && place.departure_time) {
        const arrivalTime = formatTimeWithoutSeconds(place.arrival_time);
        const departureTime = formatTimeWithoutSeconds(place.departure_time);
        
        if (actualDate) {
          const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
          scheduleDisplay = `${dateStr} ${arrivalTime}-${departureTime}`;
        } else {
          scheduleDisplay = `${arrivalTime}-${departureTime}`;
        }
      }
      
      content = `
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
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${place.wish_level}/5</p>
              </div>
            ` : ''}
            
            ${scheduleDisplay ? `
              <div style="margin-bottom: 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Schedule</p>
                <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${scheduleDisplay}</p>
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
    }

    // Debug final content
    console.log('🎯 Final popup content debug:', {
      name: place.place_name || place.name,
      isDeparture,
      isDestination,
      isAirport,
      isMovement,
      isTripPlace,
      hasScheduleDisplay: !!scheduleDisplay,
      hasUserInfo: !!userInfo,
      hasWishLevel: !!place.wish_level,
      hasDuration: !!(place.duration_minutes || place.stay_duration_minutes),
      contentLength: content.length
    });

    infoWindow.setContent(content);
    infoWindow.setPosition({ 
      lat: Number(place.latitude), 
      lng: Number(place.longitude) 
    });
    infoWindow.open(map);
  }, [map, infoWindow]);

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

    // Format duration using centralized utility
    const formatDuration = DateUtils.formatDuration;

    // Get transport icon image and color
    const getTransportIconInfo = (mode: string) => {
      const modeLower = mode.toLowerCase();
      if (modeLower.includes('flight') || modeLower.includes('plane') || modeLower.includes('air')) {
        return {
          color: '#2563EB',
          img: '<img src="/icons8-plane-24.png" width="16" height="16" style="display: inline-block; vertical-align: middle;" alt="Plane" />'
        };
      } else if (modeLower.includes('car') || modeLower.includes('drive') || modeLower.includes('taxi')) {
        return {
          color: '#92400E',
          img: '<img src="/icons8-car-24.png" width="16" height="16" style="display: inline-block; vertical-align: middle;" alt="Car" />'
        };
      } else {
        return {
          color: '#6B7280',
          img: '<img src="/icons8-walking-50.png" width="16" height="16" style="display: inline-block; vertical-align: middle;" alt="Walking" />'
        };
      }
    };

    const transportIconInfo = getTransportIconInfo(transport);

    const content = `
      <div style="padding: 12px; min-width: 280px; max-width: 350px;">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937; display: flex; align-items: center; gap: 8px;">
            <span style="color: ${transportIconInfo.color};">${transportIconInfo.img}</span>
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
              <span style="color: ${transportIconInfo.color};">${transportIconInfo.img}</span>
              ${transport}
            </p>
          </div>
          
          ${duration > 0 ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Duration</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">${formatDuration(duration)}</p>
            </div>
          ` : ''}
          
          ${fromPlace.departure_time || toPlace.arrival_time ? `
            <div style="margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Travel Times</p>
              <div style="margin: 2px 0 0 0; font-size: 14px; color: #1f2937;">
                ${fromPlace.departure_time ? `<div>Departure: ${DateUtils.formatDateTime(new Date(fromPlace.departure_time), { includeWeekday: false, includeDate: true, includeTime: true })}</div>` : ''}
                ${toPlace.arrival_time ? `<div>Arrival: ${DateUtils.formatDateTime(new Date(toPlace.arrival_time), { includeWeekday: false, includeDate: true, includeTime: true })}</div>` : ''}
              </div>
            </div>
          ` : ''}
          
          ${distance > 0 ? `
            <div style="background: #fce7f3; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
              <p style="margin: 0; font-size: 12px; color: #be185d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Distance</p>
              <p style="margin: 4px 0 0 0; font-size: 16px; color: #9f1239; font-weight: 500;">${distance.toFixed(1)} km</p>
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
    </div>
  );
};

export default MapView;