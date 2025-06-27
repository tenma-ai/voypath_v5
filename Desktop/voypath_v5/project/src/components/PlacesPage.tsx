/**
 * Places Page - Main page for viewing and managing trip places
 * Integrates PlacesListView with routing and navigation
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PlacesListView } from './PlacesListView';
import { PlaceSearchToDetail } from './PlaceSearchToDetail';

interface PlacesPageProps {
  onBack?: () => void;
  className?: string;
}

type ViewMode = 'list' | 'add';

export const PlacesPage: React.FC<PlacesPageProps> = ({ 
  onBack, 
  className = '' 
}) => {
  const { currentTrip } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const handleAddPlace = useCallback(() => {
    setViewMode('add');
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
  }, []);

  const handlePlaceAdded = useCallback(() => {
    // After successfully adding a place, return to list view
    setViewMode('list');
  }, []);

  if (!currentTrip) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 ${className}`}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
          No Trip Selected
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
          Please select or create a trip to view and manage places.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Trip Selection</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-50 dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Places
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {currentTrip.name}
              </p>
            </div>
          </div>

          {viewMode === 'add' && (
            <button
              onClick={handleBackToList}
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to List</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: viewMode === 'add' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: viewMode === 'add' ? -20 : 20 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {viewMode === 'list' ? (
            <PlacesListView
              onAddPlace={handleAddPlace}
              className="h-full"
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="max-w-2xl mx-auto p-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Add New Place
                  </h2>
                  <PlaceSearchToDetail
                    tripId={currentTrip.id}
                    onPlaceAdded={handlePlaceAdded}
                    onCancel={handleBackToList}
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PlacesPage;