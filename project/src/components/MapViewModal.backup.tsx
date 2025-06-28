import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, X, Navigation, Layers, Plane, Car, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

const containerStyle = {
  width: '100%',
  height: '500px'
};

// Transportation mode colors
const transportColors = {
  walking: '#10B981',        // Green
  car: '#6B7280',            // Gray
  flight: '#EC4899',         // Pink
  default: '#3B82F6'         // Blue default
};

interface MapViewModalProps {
  result: any;
  onClose: () => void;
}

export function MapViewModal({ result, onClose }: MapViewModalProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // Extract places from optimization result
  const getAllPlaces = useCallback(() => {
    const places: any[] = [];
    
    if (result?.optimization?.daily_schedules) {
      result.optimization.daily_schedules.forEach((daySchedule: any) => {
        if (daySchedule.scheduled_places) {
          places.push(...daySchedule.scheduled_places);
        }
      });
    }
    
    return places;
  }, [result]);

  // Generate route segments with transport mode information
  const generateRouteSegments = useCallback(() => {
    const segments: Array<{
      path: {lat: number, lng: number}[];
      mode: string;
      color: string;
      duration?: number;
    }> = [];

    if (result?.optimization?.daily_schedules) {
      result.optimization.daily_schedules.forEach((daySchedule: any) => {
        const places = daySchedule.scheduled_places;

        for (let i = 0; i < places.length - 1; i++) {
          const fromPlace = places[i];
          const toPlace = places[i + 1];

          if (fromPlace.latitude && fromPlace.longitude && 
              toPlace.latitude && toPlace.longitude) {
            
            const mode = toPlace.transport_mode || 'car';
            const color = transportColors[mode as keyof typeof transportColors] || transportColors.default;

            segments.push({
              path: [
                { lat: fromPlace.latitude, lng: fromPlace.longitude },
                { lat: toPlace.latitude, lng: toPlace.longitude }
              ],
              mode,
              color,
              duration: toPlace.travel_time_from_previous
            });
          }
        }
      });
    }

    return segments;
  }, [result]);

  // Calculate map center based on all places
  const getMapCenter = useCallback(() => {
    const places = getAllPlaces();
    
    if (places.length === 0) {
      return { lat: 35.6762, lng: 139.6503 }; // Tokyo default
    }
    
    const validPlaces = places.filter(place => 
      place.latitude && place.longitude &&
      place.latitude >= -90 && place.latitude <= 90 &&
      place.longitude >= -180 && place.longitude <= 180
    );
    
    if (validPlaces.length === 0) {
      return { lat: 35.6762, lng: 139.6503 };
    }
    
    const avgLat = validPlaces.reduce((sum, place) => sum + place.latitude, 0) / validPlaces.length;
    const avgLng = validPlaces.reduce((sum, place) => sum + place.longitude, 0) / validPlaces.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [getAllPlaces]);

  // Auto-fit map to show entire route
  const fitMapToRoute = useCallback((mapInstance: google.maps.Map) => {
    if (!mapInstance) return;
    
    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;
    
    const places = getAllPlaces();
    
    places.forEach(place => {
      if (place.latitude && place.longitude && 
          place.latitude >= -90 && place.latitude <= 90 &&
          place.longitude >= -180 && place.longitude <= 180) {
        bounds.extend({ lat: place.latitude, lng: place.longitude });
        hasBounds = true;
      }
    });
    
    if (hasBounds && !bounds.isEmpty()) {
      try {
        mapInstance.fitBounds(bounds, {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50
        });
      } catch (error) {
        // Error occurred
        mapInstance.setCenter(getMapCenter());
        mapInstance.setZoom(12);
      }
    }
  }, [getAllPlaces, getMapCenter]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    mapRef.current = map;
    
    setTimeout(() => {
      fitMapToRoute(map);
    }, 100);
  }, [fitMapToRoute]);

  const onUnmount = useCallback(() => {
    setMap(null);
    mapRef.current = null;
  }, []);

  const places = getAllPlaces();
  const routeSegments = generateRouteSegments();

  const getTransportIcon = (mode: string): string => {
    switch (mode?.toLowerCase()) {
      case 'driving':
      case 'car':
        return '🚗';
      case 'walking':
      case 'walk':
        return '🚶';
      case 'flight':
        return '✈️';
      default:
        return '🚗';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Optimized Route Map
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Map Content */}
        <div className="relative h-[500px]">
          {loadError ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-slate-500">Failed to load Google Maps</p>
            </div>
          ) : !isLoaded ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-slate-500">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={getMapCenter()}
              zoom={12}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                gestureHandling: 'auto',
                disableDefaultUI: false,
              }}
            >
              {/* Place markers */}
              {places.map((place, index) => (
                place.latitude && place.longitude ? (
                  <Marker
                    key={place.id}
                    position={{ lat: place.latitude, lng: place.longitude }}
                    label={{
                      text: place.order_in_day?.toString() || (index + 1).toString(),
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '12px',
                    }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: place.place_type === 'departure' ? '#22C55E' : 
                                 place.place_type === 'destination' ? '#EF4444' : '#3B82F6',
                      fillOpacity: 1,
                      strokeColor: '#FFFFFF',
                      strokeWeight: 2,
                      scale: 10,
                    }}
                    title={place.name}
                  />
                ) : null
              ))}

              {/* Route segments with transport mode colors */}
              {routeSegments.map((segment, index) => (
                <Polyline
                  key={`route-segment-${index}`}
                  path={segment.path}
                  options={{
                    strokeColor: segment.color,
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    geodesic: true,
                    icons: [{
                      icon: {
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        scale: 2,
                        fillColor: segment.color,
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: '#FFFFFF'
                      },
                      repeat: '150px'
                    }]
                  }}
                />
              ))}
            </GoogleMap>
          )}

          {/* Map Controls */}
          <div className="absolute top-4 right-4 space-y-2">
            <button 
              className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow"
              onClick={() => {
                if (map) {
                  fitMapToRoute(map);
                }
              }}
              title="Fit route to view"
            >
              <Navigation className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <button 
              className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow"
              onClick={() => {
                if (map) {
                  const currentType = map.getMapTypeId();
                  map.setMapTypeId(currentType === 'roadmap' ? 'satellite' : 'roadmap');
                }
              }}
              title="Toggle map type"
            >
              <Layers className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">Departure</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">Destination</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">Places</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-0.5 rounded" style={{ backgroundColor: '#EC4899' }}></div>
                <span className="text-slate-600 dark:text-slate-400">✈️ Flight</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-0.5 rounded" style={{ backgroundColor: '#6B7280' }}></div>
                <span className="text-slate-600 dark:text-slate-400">🚗 Car</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-0.5 rounded" style={{ backgroundColor: '#10B981' }}></div>
                <span className="text-slate-600 dark:text-slate-400">🚶 Walking</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}