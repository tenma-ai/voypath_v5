import React, { useState, useCallback } from 'react';
import { MapPin, X, List, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useStore } from '../store/useStore';

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
  const { hasUserOptimized } = useStore();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  if (!isOpen || !hasUserOptimized || !optimizationResult) return null;

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  // Extract places from optimization result
  const getAllPlaces = useCallback(() => {
    if (!hasUserOptimized || !optimizationResult?.optimization?.daily_schedules) return [];
    
    const places: any[] = [];
    optimizationResult.optimization.daily_schedules.forEach((schedule: any) => {
      if (schedule.scheduled_places) {
        places.push(...schedule.scheduled_places);
      }
    });
    
    // Log message
    return places;
  }, [optimizationResult, hasUserOptimized]);

  const places = getAllPlaces();

  const onLoad = useCallback((map: google.maps.Map) => {
    // Log message
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    // Log message
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
        <div className="flex items-center justify-between p-2 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">マップビュー</h2>
          </div>
          
          {/* View Toggle Buttons */}
          <div className="flex items-center space-x-2">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                className="px-2 py-1 rounded text-xs font-medium bg-blue-500 text-white"
                disabled
              >
                Map
              </button>
              {onSwitchToList && (
                <button
                  onClick={onSwitchToList}
                  className="px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Timeline
                </button>
              )}
              {onSwitchToCalendar && (
                <button
                  onClick={onSwitchToCalendar}
                  className="px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Calendar
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Map Content */}
        <div className="flex-1 relative" style={{
          background: 'linear-gradient(180deg, #6BB6FF 0%, #FFFFFF 100%)'
        }}>
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
                zoomControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                gestureHandling: 'greedy',
                disableDefaultUI: true,
              }}
            >
              
              {/* Test marker */}
              <Marker 
                position={{ lat: 35.6812, lng: 139.7671 }} 
                title="Tokyo Test Marker"
                onClick={() => {}}
              />
              
              {/* Place markers */}
              {places.map((place, index) => {
                // Processing place data
                });
                
                if (!place.latitude || !place.longitude) {
                  // Log message
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
                    onClick={() => {}}
                  />
                );
              })}
            </GoogleMap>
          )}
        </div>

        {/* Footer with stats */}
        <div className="p-2 bg-gray-50 border-t border-gray-200">
          <div className="text-center text-xs text-gray-600">
            {places.length} スポット • 最適化されたルート
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MapViewModal;