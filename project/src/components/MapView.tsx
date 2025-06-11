import React from 'react';
import { MapPin, Navigation, Layers, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const mockPlaces = [
  {
    id: '1',
    name: 'Senso-ji Temple',
    category: 'temple',
    lat: 35.7148,
    lng: 139.7967,
    scheduled: true
  },
  {
    id: '2',
    name: 'Tokyo Skytree',
    category: 'attraction',
    lat: 35.7101,
    lng: 139.8107,
    scheduled: true
  },
  {
    id: '3',
    name: 'Meiji Shrine',
    category: 'shrine',
    lat: 35.6762,
    lng: 139.6993,
    scheduled: false
  }
];

export function MapView() {
  const navigate = useNavigate();

  const handleAddPlace = () => {
    navigate('/add-place');
  };

  return (
    <div className="relative h-full bg-slate-100 dark:bg-slate-800">
      {/* Add Place Button - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
        <motion.button
          onClick={handleAddPlace}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg group"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span>Add Place</span>
        </motion.button>
      </div>

      {/* Map Placeholder */}
      <div className="h-full flex items-center justify-center relative pt-16">
        {/* Existing places on map with Add Place pins */}
        {mockPlaces.map((place, index) => (
          <motion.div
            key={place.id}
            className={`absolute w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer ${
              place.scheduled 
                ? 'bg-primary-500 hover:bg-primary-600' 
                : 'bg-slate-400 hover:bg-slate-500'
            }`}
            style={{
              left: `${30 + index * 15}%`,
              top: `${40 + index * 10}%`
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.2 }}
          >
            <MapPin className="w-5 h-5 text-white" />
          </motion.div>
        ))}

        {/* Add Place Pins - Primary/Secondary gradient pins scattered on map */}
        {[
          { left: '20%', top: '30%' },
          { left: '60%', top: '25%' },
          { left: '45%', top: '60%' },
          { left: '75%', top: '45%' },
        ].map((position, index) => (
          <motion.button
            key={`add-pin-${index}`}
            onClick={handleAddPlace}
            className="absolute w-8 h-8 bg-gradient-to-br from-primary-500 via-secondary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:shadow-glow transition-all duration-300 group"
            style={position}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 + index * 0.2 }}
          >
            <Plus className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
          </motion.button>
        ))}

        {/* Center content */}
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            Interactive Map View
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            Click the + buttons or pins to add places to your trip
          </p>
        </div>
      </div>


      {/* Map Controls */}
      <div className="absolute top-4 right-4 space-y-2 z-30">
        <button className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow">
          <Navigation className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <button className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow">
          <Layers className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-md p-3 z-30">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-primary-500 rounded-full mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Scheduled</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gradient-to-r from-primary-500 to-secondary-600 rounded-full mr-2 flex items-center justify-center">
              <Plus className="w-2 h-2 text-white" />
            </div>
            <span className="text-slate-600 dark:text-slate-400">Add Place</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-1 bg-primary-500 mr-2"></div>
            <span className="text-slate-600 dark:text-slate-400">Route</span>
          </div>
        </div>
      </div>

    </div>
  );
}