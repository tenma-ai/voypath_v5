import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Navigation, Layers, AlertCircle, Loader, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { useStore } from '../store/useStore';
import { Place } from '../types/optimization';
import { PlaceSearchInput } from './common/PlaceSearchInput';
import { GooglePlace } from '../services/PlaceSearchService';
import { MemberColorService } from '../services/MemberColorService';

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
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  const [showMemberColors, setShowMemberColors] = useState(true);
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

  // Add departure and destination as special places
  const [departureCoords, setDepartureCoords] = useState<{lat: number, lng: number} | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{lat: number, lng: number} | null>(null);

  // Transportation mode colors (車・飛行機・徒歩のみ)
  const transportColors = {
    walking: '#10B981',        // Green
    car: '#6B7280',            // Gray
    flight: '#EC4899',         // Pink
    default: '#3B82F6'         // Blue default
  };

  // Route segments with transport mode information
  const [routeSegments, setRouteSegments] = useState<Array<{
    path: {lat: number, lng: number}[];
    mode: string;
    color: string;
    duration?: number;
    distance?: number;
  }>>([]);

  // Generate route segments with transport mode information
  const generateRouteSegments = () => {
    if (!optimizationResult || !showRoute) return [];

    const segments: Array<{
      path: {lat: number, lng: number}[];
      mode: string;
      color: string;
      duration?: number;
      distance?: number;
    }> = [];

    // Check if we have detailed schedule with travel segments
    if (optimizationResult.detailedSchedule) {
      optimizationResult.detailedSchedule.forEach(daySchedule => {
        const places = daySchedule.places;
        const travelSegments = daySchedule.travel_segments || [];

        for (let i = 0; i < places.length - 1; i++) {
          const fromPlace = places[i];
          const toPlace = places[i + 1];
          const travelSegment = travelSegments[i];

          if (fromPlace.latitude && fromPlace.longitude && 
              toPlace.latitude && toPlace.longitude) {
            
            const mode = travelSegment?.mode || 'walking';
            const color = transportColors[mode as keyof typeof transportColors] || transportColors.default;

            segments.push({
              path: [
                { lat: fromPlace.latitude, lng: fromPlace.longitude },
                { lat: toPlace.latitude, lng: toPlace.longitude }
              ],
              mode,
              color,
              duration: travelSegment?.duration,
              distance: travelSegment?.distance
            });
          }
        }
      });
    } else {
      // Fallback: simple route between scheduled places
      const scheduledPlaces = optimizationResult.selectedPlaces || tripPlaces.filter(place => place.scheduled);
      const validPlaces = scheduledPlaces.filter(place => 
        place.latitude && place.longitude &&
        place.latitude >= -90 && place.latitude <= 90 &&
        place.longitude >= -180 && place.longitude <= 180
      );

      for (let i = 0; i < validPlaces.length - 1; i++) {
        const fromPlace = validPlaces[i];
        const toPlace = validPlaces[i + 1];

        segments.push({
          path: [
            { lat: fromPlace.latitude, lng: fromPlace.longitude },
            { lat: toPlace.latitude, lng: toPlace.longitude }
          ],
          mode: 'public_transport', // Default mode
          color: transportColors.public_transport
        });
      }
    }

    return segments;
  };

  // Generate route path for optimization results (legacy function)
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

  // Geocode departure and destination locations
  useEffect(() => {
    const geocodeAddress = async (address: string) => {
      return new Promise<{lat: number, lng: number}>((resolve, reject) => {
        if (!window.google?.maps) {
          reject(new Error('Google Maps not loaded'));
          return;
        }
        
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const location = results[0].geometry.location;
            resolve({ lat: location.lat(), lng: location.lng() });
          } else {
            reject(new Error(`Geocoding failed for ${address}`));
          }
        });
      });
    };

    if (isLoaded && currentTrip) {
      // Get departure and destination with fallback for different field naming
      const departureLocation = currentTrip.departureLocation || (currentTrip as any).departure_location;
      const destination = currentTrip.destination || (currentTrip as any).destination;
      
      // Geocode departure location
      if (departureLocation) {
        geocodeAddress(departureLocation)
          .then(coords => setDepartureCoords(coords))
          .catch(error => console.error('Failed to geocode departure location:', error));
      }
      
      // Geocode destination location
      if (destination) {
        geocodeAddress(destination)
          .then(coords => setDestinationCoords(coords))
          .catch(error => console.error('Failed to geocode destination location:', error));
      }
    }
  }, [isLoaded, currentTrip]);

  // Update route segments when optimization result changes
  useEffect(() => {
    const segments = generateRouteSegments();
    setRouteSegments(segments);
  }, [optimizationResult, showRoute, tripPlaces.length]);

  // Load member colors for current trip
  useEffect(() => {
    const loadMemberColors = async () => {
      if (!currentTrip?.id) return;
      
      try {
        const colors = await MemberColorService.getTripMemberColors(currentTrip.id);
        setMemberColors(colors);
      } catch (error) {
        console.error('Failed to load member colors:', error);
      }
    };

    loadMemberColors();
  }, [currentTrip?.id]);

  // Debug logging (only log when trip changes)
  useEffect(() => {
    if (currentTrip) {
      console.log('MapView Debug Info:');
      console.log('Current Trip:', currentTrip);
      console.log('All Places:', places.length);
      console.log('Filtered Trip Places:', tripPlaces.length);
      console.log('Places with coordinates:', tripPlaces.filter(p => p.latitude && p.longitude).length);
      console.log('Has Optimization Result:', !!optimizationResult);
    }
  }, [currentTrip?.id]);

  // const handleAddPlace = () => {
  //   navigate('/add-place');
  // };

  const handlePlaceSelect = (place: GooglePlace) => {
    // Navigate to configure place page with the selected place
    navigate('/add-place', { state: { selectedPlace: place } });
  };

  // Calculate map center based on places and departure/destination
  const getMapCenter = useCallback(() => {
    const allCoords = [];
    
    // Add trip places
    const validPlaces = tripPlaces.filter(place => 
      place.latitude && place.longitude && 
      place.latitude >= -90 && place.latitude <= 90 &&
      place.longitude >= -180 && place.longitude <= 180
    );
    allCoords.push(...validPlaces.map(place => ({ lat: place.latitude, lng: place.longitude })));
    
    // Add departure coords
    if (departureCoords) {
      allCoords.push(departureCoords);
    }
    
    // Add destination coords
    if (destinationCoords) {
      allCoords.push(destinationCoords);
    }
    
    if (allCoords.length === 0) return defaultCenter;
    
    const avgLat = allCoords.reduce((sum, coord) => sum + coord.lat, 0) / allCoords.length;
    const avgLng = allCoords.reduce((sum, coord) => sum + coord.lng, 0) / allCoords.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [tripPlaces, departureCoords, destinationCoords]);

  // Auto-fit map to show entire route centered
  const fitMapToRoute = useCallback((mapInstance: google.maps.Map) => {
    if (!mapInstance) return;
    
    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;
    
    // Add trip places to bounds
    tripPlaces.forEach(place => {
      if (place.latitude && place.longitude && 
          place.latitude >= -90 && place.latitude <= 90 &&
          place.longitude >= -180 && place.longitude <= 180) {
        bounds.extend({ lat: place.latitude, lng: place.longitude });
        hasBounds = true;
      }
    });
    
    // Add departure to bounds
    if (departureCoords) {
      bounds.extend(departureCoords);
      hasBounds = true;
    }
    
    // Add destination to bounds
    if (destinationCoords) {
      bounds.extend(destinationCoords);
      hasBounds = true;
    }
    
    if (hasBounds && !bounds.isEmpty()) {
      try {
        // Add padding to ensure all points are well visible
        mapInstance.fitBounds(bounds, {
          top: 120,    // Space for search bar
          right: 100,  // Space for controls
          bottom: 120, // Space for legend
          left: 100    // General padding
        });
      } catch (error) {
        console.error('Error fitting bounds:', error);
        // Fallback to simple center and zoom
        mapInstance.setCenter(getMapCenter());
        mapInstance.setZoom(12);
      }
    }
  }, [tripPlaces, departureCoords, destinationCoords, getMapCenter]);

  // Create custom marker icon with member color
  const createColoredMarkerIcon = useCallback((color: string, isSelected: boolean = false) => {
    if (!window.google?.maps) return undefined;

    const size = isSelected ? 48 : 36;
    const scale = isSelected ? 1.2 : 1.0;
    
    // Create SVG path for custom colored marker
    const svgMarker = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
              fill="${color}" 
              stroke="#fff" 
              stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#fff"/>
      </svg>
    `;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarker)}`,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
      origin: new window.google.maps.Point(0, 0)
    };
  }, []);

  // Get place marker color based on member color or optimization status
  const getPlaceMarkerColor = useCallback((place: Place) => {
    if (showMemberColors && place.user_id && memberColors[place.user_id]) {
      return memberColors[place.user_id];
    }
    
    // Fallback to optimization-based colors
    if (place.is_selected_for_optimization) {
      return '#10B981'; // Green for selected
    }
    
    if (place.display_color_hex) {
      return place.display_color_hex;
    }
    
    return '#6B7280'; // Gray default
  }, [memberColors, showMemberColors]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    mapRef.current = map;
    
    // Small delay to ensure map is fully loaded before fitting bounds
    setTimeout(() => {
      fitMapToRoute(map);
    }, 100);
  }, [fitMapToRoute]);

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

  // Auto-fit map when trip places, departure, or destination change
  useEffect(() => {
    if (map && (tripPlaces.length > 0 || departureCoords || destinationCoords)) {
      // Small delay to ensure coordinates are properly loaded
      const timeoutId = setTimeout(() => {
        fitMapToRoute(map);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [map, tripPlaces, departureCoords, destinationCoords, fitMapToRoute]);

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
                gestureHandling: 'auto',
                disableDefaultUI: false,
                clickableIcons: true,
                draggable: true,
                scrollwheel: true,
                disableDoubleClickZoom: false,
                keyboardShortcuts: true,
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
              gestureHandling: 'auto',
              disableDefaultUI: false,
              clickableIcons: true,
              draggable: true,
              scrollwheel: true,
              disableDoubleClickZoom: false,
              keyboardShortcuts: true,
            }}
          >
            {/* Departure marker */}
            {departureCoords && (
              <Marker
                position={departureCoords}
                onClick={() => {/* Could show departure info */}}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: '#22C55E', // Green for departure
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                  scale: 12,
                }}
                label={{
                  text: 'D',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
                title={`Departure: ${currentTrip?.departureLocation || (currentTrip as any)?.departure_location}`}
              />
            )}
            
            {/* Destination marker */}
            {destinationCoords && (
              <Marker
                position={destinationCoords}
                onClick={() => {/* Could show destination info */}}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: '#EF4444', // Red for destination
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                  scale: 12,
                }}
                label={{
                  text: 'A',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
                title={`Destination: ${currentTrip?.destination || (currentTrip as any)?.destination}`}
              />
            )}

            {/* Render markers for each place */}
            {tripPlaces.map((place, index) => (
              place.latitude && place.longitude ? (
                <Marker
                  key={place.id}
                  position={{ lat: place.latitude, lng: place.longitude }}
                  onClick={() => setSelectedPlace(place)}
                  icon={createColoredMarkerIcon(
                    getPlaceMarkerColor(place), 
                    selectedPlace?.id === place.id
                  )}
                  label={{
                    text: (index + 1).toString(),
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                />
              ) : null
            ))}

            {/* Route Polylines with Transport Mode Colors */}
            {showRoute && routeSegments.map((segment, index) => (
              <Polyline
                key={`route-segment-${index}`}
                path={segment.path}
                options={{
                  strokeColor: segment.color,
                  strokeOpacity: 0.8,
                  strokeWeight: 5,
                  geodesic: true,
                  icons: [{
                    icon: {
                      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      scale: 3,
                      fillColor: segment.color,
                      fillOpacity: 1,
                      strokeWeight: 1,
                      strokeColor: '#FFFFFF'
                    },
                    repeat: '100px'
                  }]
                }}
              />
            ))}

            {/* Fallback: Simple route for non-optimized trips */}
            {showRoute && routeSegments.length === 0 && getRoutePath().length > 1 && (
              <Polyline
                path={getRoutePath()}
                options={{
                  strokeColor: transportColors.default,
                  strokeOpacity: 0.6,
                  strokeWeight: 3,
                  geodesic: true,
                  strokePattern: [10, 5], // Dashed line for fallback
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
            if (map) {
              fitMapToRoute(map);
            }
          }}
          title="Fit route to view"
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
        {(routeSegments.length > 0 || getRoutePath().length > 1) && (
          <motion.button 
            className={`w-10 h-10 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-all ${
              showRoute 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowRoute(!showRoute)}
            title={`${showRoute ? 'Hide' : 'Show'} route with transport modes`}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              {routeSegments.length > 0 ? (
                // Multi-colored lines to indicate transport modes
                <div className="flex flex-col gap-0.5">
                  <div className={`w-3 h-0.5 rounded ${showRoute ? 'bg-white' : 'bg-green-500'}`} />
                  <div className={`w-3 h-0.5 rounded ${showRoute ? 'bg-white' : 'bg-blue-500'}`} />
                  <div className={`w-3 h-0.5 rounded ${showRoute ? 'bg-white' : 'bg-orange-500'}`} />
                </div>
              ) : (
                <div className={`w-3 h-1 rounded ${showRoute ? 'bg-white' : 'bg-blue-500'}`} />
              )}
            </div>
          </motion.button>
        )}
        {/* Member Color Toggle */}
        {Object.keys(memberColors).length > 0 && (
          <motion.button 
            className={`w-10 h-10 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-all ${
              showMemberColors 
                ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMemberColors(!showMemberColors)}
            title={`${showMemberColors ? 'Hide' : 'Show'} member colors`}
          >
            <Users className="w-5 h-5" />
          </motion.button>
        )}
      </div>


      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-md p-3 z-20 max-h-80 overflow-y-auto">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          {/* Places */}
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 text-white text-center font-bold text-xs leading-3">D</div>
            <span className="text-slate-600 dark:text-slate-400">Departure</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2 text-white text-center font-bold text-xs leading-3">A</div>
            <span className="text-slate-600 dark:text-slate-400">Destination</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Scheduled</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Unscheduled</span>
          </div>
          
          {/* Transportation Modes */}
          {routeSegments.length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-600 my-2"></div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Transportation</div>
              {Object.entries(transportColors).map(([mode, color]) => {
                const hasSegment = routeSegments.some(segment => segment.mode === mode);
                if (!hasSegment && mode !== 'default') return null;
                
                const modeNames: Record<string, string> = {
                  walking: '🚶 Walking',
                  public_transport: '🚌 Public Transport',
                  subway: '🚇 Subway',
                  train: '🚆 Train',
                  bus: '🚌 Bus',
                  car: '🚗 Car',
                  taxi: '🚕 Taxi',
                  bicycle: '🚴 Bicycle',
                  flight: '✈️ Flight',
                  ferry: '⛴️ Ferry',
                  default: '➡️ Default Route'
                };
                
                return (
                  <div key={mode} className="flex items-center">
                    <div 
                      className="w-4 h-1 mr-2 rounded"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-slate-600 dark:text-slate-400">
                      {modeNames[mode] || mode}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {/* Member Colors */}
          {showMemberColors && Object.keys(memberColors).length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-600 my-2"></div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Member Colors</div>
              {Object.entries(memberColors).map(([userId, color]) => {
                const memberPlaces = tripPlaces.filter(place => place.user_id === userId);
                if (memberPlaces.length === 0) return null;
                
                return (
                  <div key={userId} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-slate-600 dark:text-slate-400">
                      Member {userId.slice(0, 8)} ({memberPlaces.length} places)
                    </span>
                  </div>
                );
              })}
            </>
          )}
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