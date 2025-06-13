import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Navigation, Layers, AlertCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { useStore } from '../store/useStore';
import { Place } from '../types/optimization';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { GooglePlace } from '../services/PlaceSearchService';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Default center (Tokyo)
const defaultCenter = {
  lat: 35.6762,
  lng: 139.6503
};

export function MapView() {
  const navigate = useNavigate();
  const { places, currentTrip, optimizationResult } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // Filter places for current trip
  const tripPlaces = places.filter(place => 
    currentTrip ? (place.trip_id === currentTrip.id || place.tripId === currentTrip.id) : false
  );

  // Generate route path for optimization results
  const getRoutePath = useCallback(() => {
    if (!optimizationResult || !showRoute) return [];
    
    const scheduledPlaces = optimizationResult.selectedPlaces || tripPlaces.filter(place => place.scheduled);
    const validPlaces = scheduledPlaces.filter(place => 
      place.latitude && place.longitude &&
      place.latitude >= -90 && place.latitude <= 90 &&
      place.longitude >= -180 && place.longitude <= 180
    );
    
    if (validPlaces.length < 2) return [];
    
    return validPlaces.map(place => ({
      lat: place.latitude,
      lng: place.longitude
    }));
  }, [optimizationResult, tripPlaces, showRoute]);

  // Debug logging
  useEffect(() => {
    console.log('MapView Debug Info:');
    console.log('Current Trip:', currentTrip);
    console.log('All Places:', places);
    console.log('Filtered Trip Places:', tripPlaces);
    console.log('Places with coordinates:', tripPlaces.filter(p => p.latitude && p.longitude));
    console.log('Optimization Result:', optimizationResult);
    console.log('Route Path:', getRoutePath());
  }, [currentTrip, places, tripPlaces, optimizationResult, getRoutePath]);

  // const handleAddPlace = () => {
  //   navigate('/add-place');
  // };

  const handlePlaceSelect = (place: GooglePlace) => {
    // Navigate to configure place page with the selected place
    navigate('/add-place', { state: { selectedPlace: place } });
  };

  // Calculate map center based on places
  const getMapCenter = useCallback(() => {
    if (tripPlaces.length === 0) return defaultCenter;
    
    const validPlaces = tripPlaces.filter(place => 
      place.latitude && place.longitude && 
      place.latitude >= -90 && place.latitude <= 90 &&
      place.longitude >= -180 && place.longitude <= 180
    );
    
    if (validPlaces.length === 0) return defaultCenter;
    
    const avgLat = validPlaces.reduce((sum, place) => sum + place.latitude, 0) / validPlaces.length;
    const avgLng = validPlaces.reduce((sum, place) => sum + place.longitude, 0) / validPlaces.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [tripPlaces]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    mapRef.current = map;
    
    // Fit bounds to show all places if any exist
    if (tripPlaces.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      tripPlaces.forEach(place => {
        if (place.latitude && place.longitude) {
          bounds.extend({ lat: place.latitude, lng: place.longitude });
        }
      });
      
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
        // Set a maximum zoom level
        const listener = window.google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 15) map.setZoom(15);
          window.google.maps.event.removeListener(listener);
        });
      }
    }
  }, [tripPlaces]);

  const onUnmount = useCallback(() => {
    setMap(null);
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (!currentTrip) {
      setMapError('No active trip selected');
    } else {
      setMapError(null);
    }
  }, [currentTrip]);

  // Handle map load error
  if (loadError) {
    setMapError('Failed to load Google Maps');
  }

  return (
    <div className="relative h-full bg-slate-100 dark:bg-slate-800">
      {/* Place Search Box - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 w-80">
        <PlaceSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          onPlaceSelect={handlePlaceSelect}
          placeholder="Search places to add..."
          className="w-full py-3 px-6 rounded-2xl text-sm bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white placeholder-white/80 border-0 shadow-glow hover:shadow-glow-lg transition-all duration-300 font-semibold"
          searchContext={{
            radius: 50,
          }}
        />
      </div>

      {/* Map Container */}
      <div className="h-full relative">
        {mapError ? (
          /* Error State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Map Unavailable
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                {mapError}
              </p>
            </div>
          </div>
        ) : !isLoaded ? (
          /* Loading State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Loader className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Loading Google Maps...
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                Preparing the map interface
              </p>
            </div>
          </div>
        ) : tripPlaces.length === 0 ? (
          /* Empty State with Map Background */
          <>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={defaultCenter}
              zoom={10}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No Places Added Yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                  Add your first place to see it on the map
                </p>
                <div className="pointer-events-auto w-full max-w-md">
                  <PlaceSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Search places to add..."
                    className="w-full py-3 px-4 rounded-xl"
                    searchContext={{
                      radius: 50,
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Google Maps with Places */
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
            }}
          >
            {/* Render markers for each place */}
            {tripPlaces.map((place, index) => (
              place.latitude && place.longitude ? (
                <Marker
                  key={place.id}
                  position={{ lat: place.latitude, lng: place.longitude }}
                  onClick={() => setSelectedPlace(place)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: place.scheduled ? '#3B82F6' : '#10B981', // Blue for scheduled, Green for unscheduled
                    fillOpacity: 0.9,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                    scale: 8,
                  }}
                  label={{
                    text: (index + 1).toString(),
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                />
              ) : null
            ))}

            {/* Route Polyline */}
            {showRoute && getRoutePath().length > 1 && (
              <Polyline
                path={getRoutePath()}
                options={{
                  strokeColor: '#3B82F6',
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                  geodesic: true,
                }}
              />
            )}

            {/* Info Window for selected place */}
            {selectedPlace && selectedPlace.latitude && selectedPlace.longitude && (
              <InfoWindow
                position={{ lat: selectedPlace.latitude, lng: selectedPlace.longitude }}
                onCloseClick={() => setSelectedPlace(null)}
              >
                <div className="p-2 max-w-xs">
                  <h4 className="font-semibold text-slate-900 mb-1">
                    {selectedPlace.name}
                  </h4>
                  <p className="text-sm text-slate-600 mb-2">
                    {selectedPlace.address}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Priority: {selectedPlace.wishLevel || selectedPlace.wish_level}/5
                    </span>
                    <span>
                      {selectedPlace.stayDuration || selectedPlace.stay_duration_minutes} min
                    </span>
                  </div>
                  {selectedPlace.rating && (
                    <div className="mt-1 text-xs text-yellow-600">
                      ⭐ {selectedPlace.rating}/5
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>

      {/* Map Controls */}
      <div className="absolute top-20 right-4 space-y-2 z-20">
        <motion.button 
          className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (map && tripPlaces.length > 0) {
              const bounds = new window.google.maps.LatLngBounds();
              tripPlaces.forEach(place => {
                if (place.latitude && place.longitude) {
                  bounds.extend({ lat: place.latitude, lng: place.longitude });
                }
              });
              if (!bounds.isEmpty()) {
                map.fitBounds(bounds);
              }
            }
          }}
          title="Fit to places"
        >
          <Navigation className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </motion.button>
        <motion.button 
          className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (map) {
              const currentType = map.getMapTypeId();
              map.setMapTypeId(currentType === 'roadmap' ? 'satellite' : 'roadmap');
            }
          }}
          title="Toggle map type"
        >
          <Layers className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </motion.button>
        {optimizationResult && getRoutePath().length > 1 && (
          <motion.button 
            className={`w-10 h-10 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-all ${
              showRoute 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowRoute(!showRoute)}
            title={showRoute ? 'Hide route' : 'Show route'}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <div className={`w-3 h-1 rounded ${showRoute ? 'bg-white' : 'bg-blue-500'}`} />
            </div>
          </motion.button>
        )}
      </div>


      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-md p-3 z-20">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Scheduled</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Unscheduled</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-1 bg-primary-500 mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Route</span>
          </div>
        </div>
        {tripPlaces.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tripPlaces.length} place{tripPlaces.length !== 1 ? 's' : ''} in {currentTrip?.name || 'your trip'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}