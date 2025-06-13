import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, AlertCircle, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Place, DetailedSchedule } from '../types/optimization';

interface OptimizedMapViewProps {
  optimizationResult?: DetailedSchedule;
  className?: string;
}

interface MapMarker {
  place: Place;
  position: { lat: number; lng: number };
  type: 'departure' | 'destination' | 'selected' | 'unselected';
  order?: number;
}

export function OptimizedMapView({ optimizationResult, className = '' }: OptimizedMapViewProps) {
  const { places, currentTrip } = useStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get trip places
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );

  // Process optimization results to get selected places
  const selectedPlaces = optimizationResult?.selectedPlaces || tripPlaces.filter(place => place.is_selected_for_optimization);
  const unselectedPlaces = tripPlaces.filter(place => !place.is_selected_for_optimization);

  useEffect(() => {
    initializeMap();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (map && tripPlaces.length > 0) {
      updateMapMarkers();
      if (selectedPlaces.length > 1) {
        drawOptimizedRoute();
      }
    }
  }, [map, tripPlaces, optimizationResult]);

  const initializeMap = async () => {
    if (!mapRef.current) return;

    try {
      setIsLoading(true);
      
      // Wait for Google Maps to load
      if (typeof google === 'undefined') {
        throw new Error('Google Maps not loaded');
      }

      // Default center (can be updated based on trip destination)
      const defaultCenter = currentTrip?.destination 
        ? await geocodeAddress(currentTrip.destination)
        : { lat: 35.6762, lng: 139.6503 }; // Tokyo

      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: defaultCenter,
        styles: getMapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        }
      });

      renderer.setMap(mapInstance);
      
      setMap(mapInstance);
      setDirectionsRenderer(renderer);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setError('Failed to load map. Please try again.');
      setIsLoading(false);
    }
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          reject(new Error('Geocoding failed'));
        }
      });
    });
  };

  const updateMapMarkers = () => {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    // Add departure point if available
    if (currentTrip?.departure_location) {
      geocodeAddress(currentTrip.departure_location).then(position => {
        const marker = createMarker(
          { ...position, place: null, type: 'departure' as const }
        );
        newMarkers.push(marker);
        bounds.extend(new google.maps.LatLng(position.lat, position.lng));
      }).catch(console.error);
    }

    // Add selected places
    selectedPlaces.forEach((place: Place, index: number) => {
      if (place.latitude && place.longitude) {
        const position = { lat: place.latitude, lng: place.longitude };
        const marker = createMarker({
          position,
          place,
          type: 'selected',
          order: index + 1
        });
        newMarkers.push(marker);
        bounds.extend(new google.maps.LatLng(position.lat, position.lng));
      }
    });

    // Add unselected places
    unselectedPlaces.forEach((place: Place) => {
      if (place.latitude && place.longitude) {
        const position = { lat: place.latitude, lng: place.longitude };
        const marker = createMarker({
          position,
          place,
          type: 'unselected'
        });
        newMarkers.push(marker);
        bounds.extend(new google.maps.LatLng(position.lat, position.lng));
      }
    });

    setMarkers(newMarkers);

    // Fit map to show all markers
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 50 });
    }
  };

  const createMarker = ({ position, place, type, order }: {
    position: { lat: number; lng: number };
    place: Place | null;
    type: 'departure' | 'destination' | 'selected' | 'unselected';
    order?: number;
  }): google.maps.Marker => {
    if (!map) throw new Error('Map not initialized');

    const markerOptions: google.maps.MarkerOptions = {
      position,
      map,
      title: place?.name || 'Departure Point',
      icon: getMarkerIcon(type, order)
    };

    const marker = new google.maps.Marker(markerOptions);

    // Add info window
    if (place) {
      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(place, type)
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    }

    return marker;
  };

  const getMarkerIcon = (type: string, order?: number): google.maps.Icon => {
    const baseUrl = 'https://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|';
    
    switch (type) {
      case 'departure':
        return {
          url: `${baseUrl}00ff00|40|_|Departure`,
          scaledSize: new google.maps.Size(30, 30)
        };
      case 'selected':
        return {
          url: `${baseUrl}3b82f6|40|_|${order || ''}`,
          scaledSize: new google.maps.Size(35, 35)
        };
      case 'unselected':
        return {
          url: `${baseUrl}gray|25|_|_`,
          scaledSize: new google.maps.Size(25, 25)
        };
      default:
        return {
          url: `${baseUrl}ff0000|40|_|_`,
          scaledSize: new google.maps.Size(30, 30)
        };
    }
  };

  const createInfoWindowContent = (place: Place, type: string): string => {
    const statusBadge = type === 'selected' 
      ? '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Selected</span>'
      : '<span style="background: #6b7280; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Not Selected</span>';
    
    return `
      <div style="max-width: 250px;">
        <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">${place.name}</h3>
        ${statusBadge}
        <p style="margin: 8px 0 4px 0; color: #6b7280; font-size: 14px;">
          <strong>Category:</strong> ${place.category}
        </p>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
          <strong>Wish Level:</strong> ${place.wish_level}/5
        </p>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
          <strong>Duration:</strong> ${Math.floor(place.stay_duration_minutes / 60)}h ${place.stay_duration_minutes % 60}m
        </p>
        ${place.scheduled_date ? `
          <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
            <strong>Scheduled:</strong> ${place.scheduled_date}
          </p>
        ` : ''}
      </div>
    `;
  };

  const drawOptimizedRoute = async () => {
    if (!map || !directionsRenderer || selectedPlaces.length < 2) return;

    try {
      const directionsService = new google.maps.DirectionsService();
      
      // Sort places by selection order or scheduled date
      const sortedPlaces = [...selectedPlaces].sort((a, b) => {
        if (a.selection_round && b.selection_round) {
          return a.selection_round - b.selection_round;
        }
        if (a.scheduled_date && b.scheduled_date) {
          return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
        }
        return 0;
      });

      const waypoints = sortedPlaces.slice(1, -1).map(place => ({
        location: new google.maps.LatLng(place.latitude!, place.longitude!),
        stopover: true
      }));

      const origin = sortedPlaces[0];
      const destination = sortedPlaces[sortedPlaces.length - 1];

      const request: google.maps.DirectionsRequest = {
        origin: new google.maps.LatLng(origin.latitude!, origin.longitude!),
        destination: new google.maps.LatLng(destination.latitude!, destination.longitude!),
        waypoints,
        travelMode: google.maps.TravelMode.TRANSIT,
        unitSystem: google.maps.UnitSystem.METRIC
      };

      directionsService.route(request, (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
        } else {
          console.error('Directions request failed:', status);
        }
      });
    } catch (error) {
      console.error('Error drawing route:', error);
    }
  };

  const getMapStyles = () => [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'transit',
      elementType: 'labels',
      stylers: [{ visibility: 'simplified' }]
    }
  ];

  const cleanup = () => {
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);
    setMap(null);
    setDirectionsRenderer(null);
  };

  if (error) {
    return (
      <div className={`h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}>
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Map Error
          </h3>
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full ${className}`}>
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading optimized map...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Container */}
      <div ref={mapRef} className="h-full w-full" />

      {/* Map Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Map Legend</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-300">Departure Point</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <span className="text-slate-600 dark:text-slate-300">Selected Places</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-300">Unselected Places</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Route className="w-4 h-4 text-blue-500" />
            <span className="text-slate-600 dark:text-slate-300">Optimized Route</span>
          </div>
        </div>
      </div>

      {/* Route Stats */}
      {optimizationResult && (
        <div className="absolute bottom-4 right-4 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-4">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Route Statistics</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Selected Places:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedPlaces.length}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Total Duration:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.floor(selectedPlaces.reduce((sum, place) => sum + place.stay_duration_minutes, 0) / 60)}h
              </span>
            </div>
            
            {optimizationResult.score && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Optimization Score:</span>
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {Math.round(optimizationResult.score * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}