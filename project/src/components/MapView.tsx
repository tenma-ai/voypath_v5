import React, { useState } from 'react';
import { MapPin, Navigation, Layers, Search, Plus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AddPlaceModal({ isOpen, onClose }: AddPlaceModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults] = useState([
    { id: 'search1', name: 'Ueno Park', category: 'park', rating: 4.3, image: 'https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?w=300&h=200&fit=crop' },
    { id: 'search2', name: 'Tokyo National Museum', category: 'museum', rating: 4.5, image: 'https://images.unsplash.com/photo-1554072675-66db59dba46f?w=300&h=200&fit=crop' },
    { id: 'search3', name: 'Ameya-Yokocho Market', category: 'market', rating: 4.0, image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop' }
  ]);

  const handleAddPlace = (place: any) => {
    console.log('Adding place from map:', place);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            Add Place from Map
          </h3>
          
          <div className="mt-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for places..."
              className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300"
              autoFocus
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-64 overflow-y-auto">
          {searchResults.map((place) => (
            <motion.button
              key={place.id}
              onClick={() => handleAddPlace(place)}
              className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200/30 dark:border-slate-700/30 last:border-b-0"
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center space-x-3">
                <img
                  src={place.image}
                  alt={place.name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {place.name}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                      {place.category}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">{place.rating}</span>
                    </div>
                  </div>
                </div>
                <Plus className="w-5 h-5 text-primary-500" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50">
          <Link
            to="/add-place"
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-2xl hover:from-primary-600 hover:to-secondary-700 transition-all font-semibold"
            onClick={onClose}
          >
            <Plus className="w-5 h-5" />
            <span>Add Custom Place</span>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MapView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchResults, setSearchResults] = useState([
    { id: 'search1', name: 'Ueno Park', category: 'park', distance: '2.1 km' },
    { id: 'search2', name: 'Tokyo National Museum', category: 'museum', distance: '1.8 km' },
    { id: 'search3', name: 'Ameya-Yokocho Market', category: 'market', distance: '1.5 km' }
  ]);

  const handleSearch = () => {
    // Simulate search
    console.log('Searching for:', searchQuery);
  };

  const handleAddPlace = (place: any) => {
    console.log('Adding place:', place);
    setShowSearch(false);
    setSearchQuery('');
  };

  return (
    <div className="relative h-full bg-slate-100 dark:bg-slate-800">
      {/* Search Bar - Always Visible */}
      <div className="absolute top-4 left-4 right-4 z-30">
        <div className="relative max-w-md">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-3xl blur-xl opacity-0 focus-within:opacity-100 transition-opacity duration-500"></div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search places to add..."
              className="w-full pl-12 pr-20 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-3xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 shadow-soft hover:shadow-medium"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowSearch(true)}
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            {searchQuery && (
              <motion.button
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white text-sm rounded-2xl hover:from-primary-600 hover:to-secondary-700 transition-all duration-300 disabled:opacity-50 font-semibold shadow-glow"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="h-full flex items-center justify-center relative pt-20">
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
            onClick={() => setShowAddModal(true)}
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
            Click the + pins to add places or search above
          </p>
        </div>
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showSearch && searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-20 left-4 right-4 z-40 max-w-md"
          >
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
              {searchResults.map((place) => (
                <motion.button
                  key={place.id}
                  onClick={() => handleAddPlace(place)}
                  className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200/30 dark:border-slate-700/30 last:border-b-0"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                          {place.name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                          {place.category} • {place.distance}
                        </p>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-primary-500" />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close search results */}
      {showSearch && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => setShowSearch(false)}
        />
      )}

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

      {/* Add Place Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddPlaceModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}