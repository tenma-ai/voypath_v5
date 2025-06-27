/**
 * Places Tab Navigation Component
 * Provides navigation between Trip Places and My Places with status counts
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Users, User, MapPin, CheckCircle, Clock, HelpCircle } from 'lucide-react';

type PlaceTab = 'trip' | 'my';

interface PlacesTabNavigationProps {
  activeTab: PlaceTab;
  onTabChange: (tab: PlaceTab) => void;
  tripPlacesCount: number;
  myPlacesCount: number;
  myPlacesStatusCounts?: {
    scheduled: number;
    unscheduled: number;
    pending: number;
  };
  className?: string;
}

export const PlacesTabNavigation: React.FC<PlacesTabNavigationProps> = ({
  activeTab,
  onTabChange,
  tripPlacesCount,
  myPlacesCount,
  myPlacesStatusCounts,
  className = ''
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between p-4">
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => onTabChange('trip')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'trip'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Trip Places</span>
            <span className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-full">
              {tripPlacesCount}
            </span>
          </button>
          
          <button
            onClick={() => onTabChange('my')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'my'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Places</span>
            <span className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-full">
              {myPlacesCount}
            </span>
          </button>
        </div>
      </div>

      {/* Status Overview for My Places */}
      {activeTab === 'my' && myPlacesStatusCounts && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4"
        >
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Status Overview:</span>
            
            {/* Scheduled */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                <span>Scheduled</span>
                <span className="bg-white dark:bg-green-800 text-green-600 dark:text-green-200 px-1 rounded">
                  {myPlacesStatusCounts.scheduled}
                </span>
              </div>
            </div>

            {/* Unscheduled */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                <Clock className="w-3 h-3" />
                <span>Unscheduled</span>
                <span className="bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1 rounded">
                  {myPlacesStatusCounts.unscheduled}
                </span>
              </div>
            </div>

            {/* Pending */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium">
                <HelpCircle className="w-3 h-3" />
                <span>Pending</span>
                <span className="bg-white dark:bg-yellow-800 text-yellow-600 dark:text-yellow-200 px-1 rounded">
                  {myPlacesStatusCounts.pending}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Trip Places Description */}
      {activeTab === 'trip' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4"
        >
          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
            <MapPin className="w-4 h-4" />
            <span>All places added by team members for this trip</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PlacesTabNavigation;