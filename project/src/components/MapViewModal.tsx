import React, { useState, useCallback } from 'react';
import { MapPin, X, List, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

interface MapViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  optimizationResult: any;
  onSwitchToList?: () => void;
  onSwitchToCalendar?: () => void;
}

const MapViewModal: React.FC<MapViewModalProps> = ({ 
  isOpen, 
  onClose, 
  optimizationResult,
  onSwitchToList,
  onSwitchToCalendar 
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // Extract places from optimization result
  const getAllPlaces = useCallback(() => {
    if (!optimizationResult?.optimization?.daily_schedules) return [];
    
    const places: any[] = [];
    optimizationResult.optimization.daily_schedules.forEach((schedule: any) => {
      if (schedule.scheduled_places) {
        places.push(...schedule.scheduled_places);
      }
    });
    
    console.log('🔍 [MapViewModal] Extracted places:', places);
    return places;
  }, [optimizationResult]);

  const places = getAllPlaces();

  const onLoad = useCallback((map: google.maps.Map) => {
    console.log('🔍 [MapViewModal] Map loaded successfully');
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    console.log('🔍 [MapViewModal] Map unmounted');
    setMap(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <MapPin className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">マップビュー</h2>
          </div>
          
          {/* View Toggle Buttons */}
          <div className="flex items-center space-x-2">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                className="px-3 py-1.5 rounded text-sm font-medium bg-blue-500 text-white"
                disabled
              >
                Map
              </button>
              {onSwitchToList && (
                <button
                  onClick={onSwitchToList}
                  className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Timeline
                </button>
              )}
              {onSwitchToCalendar && (
                <button
                  onClick={onSwitchToCalendar}
                  className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Calendar
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Map Content */}
        <div className="flex-1 relative bg-gray-100">
          {loadError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-gray-600">マップの読み込みに失敗しました</p>
                <p className="text-sm text-gray-500 mt-2">{loadError.message}</p>
              </div>
            </div>
          ) : !isLoaded ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <MapPin className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-600">マップを読み込んでいます...</p>
              </div>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: 35.6812, lng: 139.7671 }}
              zoom={6}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: true,
                fullscreenControl: true,
                gestureHandling: 'auto',
              }}
            >
              {console.log('🔍 [MapViewModal] Rendering map with', places.length, 'places')}
              
              {/* Test marker */}
              <Marker 
                position={{ lat: 35.6812, lng: 139.7671 }} 
                title="東京テストマーカー"
                onClick={() => console.log('Test marker clicked')}
              />
              
              {/* Place markers */}
              {places.map((place, index) => {
                console.log(`🔍 [MapViewModal] Place ${index}:`, {
                  name: place.place_name || place.name,
                  lat: place.latitude,
                  lng: place.longitude,
                  hasCoords: !!(place.latitude && place.longitude)
                });
                
                if (!place.latitude || !place.longitude) {
                  console.log(`Skipping place ${index}: no coordinates`);
                  return null;
                }
                
                return (
                  <Marker
                    key={`place-${index}`}
                    position={{ 
                      lat: Number(place.latitude), 
                      lng: Number(place.longitude) 
                    }}
                    title={`${index + 1}. ${place.place_name || place.name}`}
                    label={`${index + 1}`}
                    onClick={() => console.log('Place clicked:', place.place_name || place.name)}
                  />
                );
              })}
            </GoogleMap>
          )}
        </div>

        {/* Footer with stats */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="text-center text-sm text-gray-600">
            {places.length} スポット • 最適化されたルート
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MapViewModal;