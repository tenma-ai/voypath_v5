import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { MapPin, Car, UserRound } from 'lucide-react';
import { PlaceColorCalculator } from '../utils/PlaceColorCalculator';
import { MemberColorService } from '../services/MemberColorService';
import { useStore } from '../store/useStore';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

interface MapViewProps {
  optimizationResult?: any;
}

const MapView: React.FC<MapViewProps> = ({ optimizationResult }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  const { currentTrip } = useStore();

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });


  // Extract places from optimization result
  const getAllPlaces = useCallback(() => {
    console.log(`🗺️ [MapView] Trip: ${currentTrip?.name}, Has optimization: ${!!optimizationResult}`);
    
    if (!optimizationResult?.optimization?.daily_schedules) {
      console.log('🗺️ [MapView] No optimization data available');
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
  }, [optimizationResult, currentTrip?.name]);

  const places = getAllPlaces();

  // Load member colors for the current trip
  useEffect(() => {
    const loadMemberColors = async () => {
      if (!currentTrip?.id) return;

      try {
        const colorMapping = await MemberColorService.getSimpleColorMapping(currentTrip.id);
        setMemberColors(colorMapping);
      } catch (error) {
        console.error('🗺️ [MapView] Failed to load member colors:', error);
        setMemberColors({});
      }
    };

    loadMemberColors();
  }, [currentTrip?.id]);

  // Create custom marker icon based on place color
  const createCustomMarkerIcon = (place: any, index: number, allPlaces: any[]) => {

    // Departure and arrival points are black
    const placeName = place.place_name || place.name || '';
    const placeNameLower = placeName.toLowerCase();
    
    // Check various patterns for departure/arrival
    const isDeparture = placeName.includes('Departure:') || 
                       placeNameLower.includes('departure') ||
                       index === 0;
                       
    const isArrival = placeName.includes('Return to Departure:') || 
                     placeNameLower.includes('return') ||
                     placeNameLower.includes('arrival') ||
                     index === allPlaces.length - 1;
                     
    const isAirport = placeNameLower.includes('airport') || 
                     placeName.includes('(HND)') ||
                     placeName.includes('(NRT)') ||
                     placeName.includes('(LGA)') ||
                     placeName.includes('(JFK)') ||
                     placeName.includes('(SVO)');
    
    if (isDeparture || isArrival) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#000000',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        scale: 12,
      };
    }

    // Get actual contributors for this place
    let contributors: any[] = [];

    // First, try to get contributors from member_contribution field
    if (place.member_contribution) {
      if (Array.isArray(place.member_contribution)) {
        // Direct array format
        contributors = place.member_contribution;
      } else if (place.member_contribution.contributors) {
        // Object with contributors property
        contributors = place.member_contribution.contributors;
      } else if (typeof place.member_contribution === 'object') {
        // Check if it's a single contributor object
        if (place.member_contribution.user_id || place.member_contribution.userId) {
          contributors = [place.member_contribution];
        }
      }
    }

    // If no contributors found, try to get from added_by/user_id fields
    if (contributors.length === 0) {
      const addedByUserId = place.added_by || place.addedBy || place.created_by || place.user_id;
      if (addedByUserId) {
        contributors = [{
          user_id: addedByUserId,
          userId: addedByUserId,
          weight: 1.0
        }];
      }
    }

    // Ensure all contributors have actual colors
    contributors = contributors.map(contributor => {
      const userId = contributor.user_id || contributor.userId;
      const userColor = memberColors[userId] || MemberColorService.getColorForOptimization(userId, memberColors);
      return {
        ...contributor,
        user_id: userId,
        color_hex: userColor
      };
    });


    const contributorCount = contributors.length;
    let fillColor = '#9CA3AF'; // Default gray
    
    if (contributorCount === 0) {
      fillColor = '#9CA3AF'; // Gray for no contributors
    } else if (contributorCount === 1) {
      // 1人の追加者: その人のメンバーカラー
      fillColor = contributors[0].color_hex;
    } else if (contributorCount >= 5) {
      // 5人以上の追加者: 金色
      fillColor = '#FFD700';
    } else {
      // 2-4人の追加者: グラデーション（今回は最初の貢献者の色を使用、将来的にグラデーション実装）
      fillColor = contributors[0].color_hex;
      // TODO: Implement actual gradient for Google Maps markers
    }


    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: fillColor,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 10,
    };
  };

  // Generate route lines between places using useMemo
  const routeLines = useMemo(() => {
    const lines: any[] = [];
    
    places.forEach((place, index) => {
      
      if (index < places.length - 1) {
        const nextPlace = places[index + 1];
        
        if (place.latitude && place.longitude && nextPlace?.latitude && nextPlace?.longitude) {
          // Determine line color based on transport mode
          let strokeColor = '#6B7280'; // Default gray
          let transportMode = 'walking'; // Default
          
          // Check for travel_to_next data
          if (place.travel_to_next && place.travel_to_next.transport_mode) {
            transportMode = place.travel_to_next.transport_mode.toLowerCase();
          } else {
            // Fallback: try to determine based on distance (rough estimate)
            const lat1 = Number(place.latitude);
            const lng1 = Number(place.longitude);
            const lat2 = Number(nextPlace.latitude);
            const lng2 = Number(nextPlace.longitude);
            
            // Calculate rough distance (in degrees)
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


          const routeLine = {
            path: [
              { lat: Number(place.latitude), lng: Number(place.longitude) },
              { lat: Number(nextPlace.latitude), lng: Number(nextPlace.longitude) }
            ],
            strokeColor: strokeColor,
            strokeOpacity: 0.8,
            strokeWeight: 3,
            key: `route-${index}`,
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
        basicLines.push({
          path: [
            { lat: Number(currentPlace.latitude), lng: Number(currentPlace.longitude) },
            { lat: Number(nextPlace.latitude), lng: Number(nextPlace.longitude) }
          ],
          strokeColor: '#6B7280', // Default gray
          strokeOpacity: 0.6,
          strokeWeight: 2,
          key: `basic-route-${i}`,
        });
      }
    }
    
    return basicLines;
  }, [routeLines, places]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    
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
  }, []);

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
                label={{
                  text: `${index + 1}`,
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
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
    </div>
  );
};

export default MapView;