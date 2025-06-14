/**
 * Comprehensive Optimization Results Visualization - Phase 8 Integration
 * TODO 138: Add member color coding throughout optimization results
 * Integrates all Phase 8 visualization components
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Map,
  List,
  BarChart3,
  Users,
  Eye,
  EyeOff,
  Download,
  Share2,
  Maximize,
  Minimize
} from 'lucide-react';
import type { OptimizedTrip, OptimizedPlace } from '../types/optimization';
import { MemberColorService } from '../services/MemberColorService';
import OptimizationProgressVisualization from './OptimizationProgressVisualization';
import DetailedScheduleTimelineView from './DetailedScheduleTimelineView';
import { OptimizedMapView } from './OptimizedMapView';
import PlaceDetailCard from './PlaceDetailCard';

interface OptimizationResultsVisualizationProps {
  optimizedTrip: OptimizedTrip;
  isLoading?: boolean;
  onExport?: (format: 'pdf' | 'json' | 'ical') => void;
  onShare?: () => void;
  className?: string;
}

type ViewMode = 'overview' | 'timeline' | 'map' | 'details';
type LayoutMode = 'split' | 'fullscreen' | 'compact';

export default function OptimizationResultsVisualization({
  optimizedTrip,
  isLoading = false,
  onExport,
  onShare,
  className = ''
}: OptimizationResultsVisualizationProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [selectedDay, setSelectedDay] = useState(0);
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showProgressVisualization, setShowProgressVisualization] = useState(true);

  useEffect(() => {
    initializeMemberColors();
  }, [optimizedTrip, initializeMemberColors]);

  const initializeMemberColors = async () => {
    if (!optimizedTrip.tripId) return;

    try {
      // Get existing color mapping or create fallback
      const colorMapping = await MemberColorService.getSimpleColorMapping(optimizedTrip.tripId);
      
      // If no colors assigned, create fallback mapping
      if (Object.keys(colorMapping).length === 0) {
        const fallbackColors: Record<string, string> = {};
        
        // Extract unique member IDs from preferences
        const memberIds = new Set<string>();
        optimizedTrip.detailedSchedule?.forEach(day => {
          day.places.forEach(place => {
            place.member_preferences?.forEach(pref => {
              memberIds.add(pref.member_id);
            });
          });
        });

        // Assign colors to members
        Array.from(memberIds).forEach((memberId, index) => {
          fallbackColors[memberId] = MemberColorService.getColorForOptimization(memberId, {});
        });

        setMemberColors(fallbackColors);
      } else {
        setMemberColors(colorMapping);
      }
    } catch (error) {
      console.error('Error initializing member colors:', error);
      setMemberColors({});
    }
  };

  const handlePlaceSelect = (place: OptimizedPlace) => {
    setViewMode('details');
    console.log('Selected place:', place);
  };

  const handleCardExpansion = (placeId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(placeId)) {
      newExpanded.delete(placeId);
    } else {
      newExpanded.add(placeId);
    }
    setExpandedCards(newExpanded);
  };

  const getDayPlaces = (dayIndex: number): OptimizedPlace[] => {
    return optimizedTrip.detailedSchedule?.[dayIndex]?.places || [];
  };

  const renderViewModeSelector = () => (
    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
      {[
        { mode: 'overview' as ViewMode, icon: BarChart3, label: 'Overview' },
        { mode: 'timeline' as ViewMode, icon: Calendar, label: 'Timeline' },
        { mode: 'map' as ViewMode, icon: Map, label: 'Map' },
        { mode: 'details' as ViewMode, icon: List, label: 'Details' }
      ].map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            viewMode === mode
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );

  const renderLayoutControls = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLayoutMode(layoutMode === 'fullscreen' ? 'split' : 'fullscreen')}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title={layoutMode === 'fullscreen' ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {layoutMode === 'fullscreen' ? (
          <Minimize className="w-4 h-4" />
        ) : (
          <Maximize className="w-4 h-4" />
        )}
      </button>
      
      <button
        onClick={() => setShowProgressVisualization(!showProgressVisualization)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title={showProgressVisualization ? 'Hide progress' : 'Show progress'}
      >
        {showProgressVisualization ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>

      {onShare && (
        <button
          onClick={onShare}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Share results"
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}

      {onExport && (
        <div className="relative group">
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="p-2 space-y-1 min-w-[120px]">
              <button
                onClick={() => onExport('pdf')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Export PDF
              </button>
              <button
                onClick={() => onExport('json')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Export JSON
              </button>
              <button
                onClick={() => onExport('ical')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Export Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderOverviewMode = () => (
    <div className="space-y-6">
      {/* Progress Visualization */}
      <AnimatePresence>
        {showProgressVisualization && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <OptimizationProgressVisualization
              optimizedTrip={optimizedTrip}
              memberColors={memberColors}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Trip Duration</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {optimizedTrip.detailedSchedule?.length || 0} Days
          </p>
          <p className="text-sm text-gray-600">
            {optimizedTrip.detailedSchedule?.reduce((total, day) => total + day.places.length, 0)} Places Total
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Members</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {Object.keys(memberColors).length}
          </p>
          <div className="flex gap-1 mt-2">
            {Object.values(memberColors).slice(0, 5).map((color) => (
              <div
                key={color}
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: color }}
              />
            ))}
            {Object.keys(memberColors).length > 5 && (
              <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                +{Object.keys(memberColors).length - 5}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Optimization Score</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {optimizedTrip.optimizationScore ? Math.round(optimizedTrip.optimizationScore * 100) : 'N/A'}%
          </p>
          <p className="text-sm text-gray-600">
            Efficiency Rating
          </p>
        </div>
      </div>

      {/* Split View: Timeline + Map */}
      <div className={`grid ${layoutMode === 'fullscreen' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Day Schedule</h3>
          <DetailedScheduleTimelineView
            optimizedTrip={optimizedTrip}
            memberColors={memberColors}
            onPlaceSelect={handlePlaceSelect}
          />
        </div>
        
        {layoutMode !== 'fullscreen' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
            <div className="h-96 rounded-lg overflow-hidden">
              <OptimizedMapView
                optimizedTrip={optimizedTrip}
                memberColors={memberColors}
                selectedDay={selectedDay}
                onPlaceSelect={handlePlaceSelect}
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTimelineMode = () => (
    <DetailedScheduleTimelineView
      optimizedTrip={optimizedTrip}
      memberColors={memberColors}
      onPlaceSelect={handlePlaceSelect}
    />
  );

  const renderMapMode = () => (
    <div className="h-[600px] rounded-lg overflow-hidden">
      <OptimizedMapView
        optimizedTrip={optimizedTrip}
        memberColors={memberColors}
        selectedDay={selectedDay}
        onPlaceSelect={handlePlaceSelect}
        className="h-full"
      />
    </div>
  );

  const renderDetailsMode = () => {
    const dayPlaces = getDayPlaces(selectedDay);
    
    return (
      <div className="space-y-6">
        {/* Day Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Day:</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {optimizedTrip.detailedSchedule?.map((_, index) => (
              <option key={index} value={index}>
                Day {index + 1}
              </option>
            ))}
          </select>
        </div>

        {/* Place Cards */}
        <div className="space-y-4">
          {dayPlaces.map((place, index) => (
            <PlaceDetailCard
              key={place.id}
              place={place}
              memberColors={memberColors}
              arrivalTime={place.arrival_time}
              departureTime={place.departure_time}
              visitDuration={place.visit_duration}
              orderNumber={index + 1}
              isExpanded={expandedCards.has(place.id)}
              onToggleExpanded={() => handleCardExpansion(place.id)}
              onPlaceSelect={handlePlaceSelect}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'overview':
        return renderOverviewMode();
      case 'timeline':
        return renderTimelineMode();
      case 'map':
        return renderMapMode();
      case 'details':
        return renderDetailsMode();
      default:
        return renderOverviewMode();
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Optimization Results</h1>
            <p className="text-gray-600">
              Optimized trip with {optimizedTrip.detailedSchedule?.reduce((total, day) => total + day.places.length, 0)} places across {optimizedTrip.detailedSchedule?.length} days
            </p>
          </div>
          
          {renderLayoutControls()}
        </div>

        {renderViewModeSelector()}
      </div>

      {/* Content */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-700">Updating visualization...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}