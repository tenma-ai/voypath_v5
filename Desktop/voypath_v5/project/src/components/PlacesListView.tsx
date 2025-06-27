/**
 * Places List View - Main places interface with Trip Places and My Places tabs
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  User, 
  MapPin, 
  Filter, 
  Search,
  Calendar,
  Clock,
  HelpCircle,
  CheckCircle,
  Plus,
  Star,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Place } from '../types/optimization';
import { PlaceDetailCard } from './PlaceDetailCard';
import { PlaceStatusIndicator } from './PlaceStatusIndicator';
import { UnifiedMemberAvatar } from './UnifiedMemberAvatar';
import { useUnifiedMemberColors } from '../hooks/useUnifiedMemberColors';

type PlaceTab = 'trip' | 'my';
type SortOption = 'name' | 'date_added' | 'wish_level' | 'category';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'scheduled' | 'unscheduled' | 'pending';

interface PlacesListViewProps {
  className?: string;
  onAddPlace?: () => void;
}

export const PlacesListView: React.FC<PlacesListViewProps> = ({ 
  className = '', 
  onAddPlace 
}) => {
  const { currentTrip, user, places, tripMembers } = useStore();
  const { memberColors } = useUnifiedMemberColors(currentTrip?.id);
  const [activeTab, setActiveTab] = useState<PlaceTab>('trip');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_added');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null);

  // Filter places based on current trip
  const tripPlaces = useMemo(() => {
    if (!currentTrip) return [];
    return places.filter(place => 
      place.trip_id === currentTrip.id || place.tripId === currentTrip.id
    );
  }, [places, currentTrip]);

  // Separate Trip Places (all places) vs My Places (user's places only)
  const { tripPlacesFiltered, myPlacesFiltered } = useMemo(() => {
    const userId = user?.id;
    if (!userId) return { tripPlacesFiltered: [], myPlacesFiltered: [] };

    // Trip Places: All places in the trip
    let allPlaces = [...tripPlaces];

    // My Places: Only places created by current user
    let userPlaces = tripPlaces.filter(place => 
      place.user_id === userId || place.created_by === userId
    );

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchFilter = (place: Place) => 
        place.name?.toLowerCase().includes(query) ||
        place.category?.toLowerCase().includes(query) ||
        place.address?.toLowerCase().includes(query);
      
      allPlaces = allPlaces.filter(searchFilter);
      userPlaces = userPlaces.filter(searchFilter);
    }

    // Apply status filter (only for My Places)
    if (activeTab === 'my' && statusFilter !== 'all') {
      userPlaces = userPlaces.filter(place => {
        if (statusFilter === 'scheduled') return place.scheduled || place.status === 'scheduled';
        if (statusFilter === 'unscheduled') return !place.scheduled && place.status !== 'pending';
        if (statusFilter === 'pending') return place.status === 'pending';
        return true;
      });
    }

    // Apply sorting
    const sortFunction = (a: Place, b: Place) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'date_added':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case 'wish_level':
          aValue = a.wish_level || 0;
          bValue = b.wish_level || 0;
          break;
        case 'category':
          aValue = a.category?.toLowerCase() || '';
          bValue = b.category?.toLowerCase() || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    };

    allPlaces.sort(sortFunction);
    userPlaces.sort(sortFunction);

    return { 
      tripPlacesFiltered: allPlaces, 
      myPlacesFiltered: userPlaces 
    };
  }, [tripPlaces, user?.id, searchQuery, sortBy, sortDirection, statusFilter, activeTab]);

  const currentPlaces = activeTab === 'trip' ? tripPlacesFiltered : myPlacesFiltered;

  // Get status counts for My Places
  const statusCounts = useMemo(() => {
    if (activeTab !== 'my') return { scheduled: 0, unscheduled: 0, pending: 0, total: 0 };

    const counts = myPlacesFiltered.reduce((acc, place) => {
      if (place.scheduled || place.status === 'scheduled') {
        acc.scheduled++;
      } else if (place.status === 'pending') {
        acc.pending++;
      } else {
        acc.unscheduled++;
      }
      acc.total++;
      return acc;
    }, { scheduled: 0, unscheduled: 0, pending: 0, total: 0 });

    return counts;
  }, [myPlacesFiltered, activeTab]);

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between p-4">
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('trip')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'trip'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Trip Places</span>
              <span className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-full">
                {tripPlacesFiltered.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'my'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Places</span>
              <span className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-full">
                {myPlacesFiltered.length}
              </span>
            </button>
          </div>

          <button
            onClick={onAddPlace}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add Place</span>
          </button>
        </div>

        {/* Status Filter for My Places */}
        <AnimatePresence>
          {activeTab === 'my' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4"
            >
              <div className="flex items-center space-x-2 overflow-x-auto">
                <span className="text-sm text-slate-600 dark:text-slate-400 flex-shrink-0">Status:</span>
                {[
                  { key: 'all', label: 'All', count: statusCounts.total, icon: MapPin },
                  { key: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled, icon: CheckCircle },
                  { key: 'unscheduled', label: 'Unscheduled', count: statusCounts.unscheduled, icon: Clock },
                  { key: 'pending', label: 'Pending', count: statusCounts.pending, icon: HelpCircle }
                ].map(({ key, label, count, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key as StatusFilter)}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                      statusFilter === key
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                    <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1 rounded">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Sort */}
        <div className="px-4 pb-4 flex items-center space-x-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
            >
              <option value="date_added">Date Added</option>
              <option value="name">Name</option>
              <option value="wish_level">Priority</option>
              <option value="category">Category</option>
            </select>
            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors duration-200"
            >
              {sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Places List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentPlaces.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center p-8"
            >
              <MapPin className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {activeTab === 'trip' ? 'No Places in Trip' : 'No Places Added Yet'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {activeTab === 'trip' 
                  ? 'This trip doesn\'t have any places yet. Start by adding some places to visit!'
                  : 'You haven\'t added any places yet. Start planning your trip by adding places you want to visit!'
                }
              </p>
              <button
                onClick={onAddPlace}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
              >
                Add Your First Place
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`places-${activeTab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-3"
            >
              {currentPlaces.map((place, index) => (
                <motion.div
                  key={place.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <PlaceDetailCard
                    place={place}
                    memberColors={memberColors}
                    isExpanded={expandedPlace === place.id}
                    onToggleExpand={() => setExpandedPlace(
                      expandedPlace === place.id ? null : place.id
                    )}
                    showMemberInfo={activeTab === 'trip'}
                    showStatusActions={activeTab === 'my'}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PlacesListView;