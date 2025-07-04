/**
 * Place Detail Card Component - Phase 8 Implementation
 * TODO 137: Implement place detail cards with timing information
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Clock,
  Star,
  Users,
  Navigation,
  ChevronDown,
  ChevronUp,
  Calendar,
  Timer,
  Route,
  Heart,
  Camera,
  Info,
  Wallet,
  Phone,
  Globe
} from 'lucide-react';
import type { OptimizedPlace, MemberPreference } from '../types/optimization';
import { PlaceImage } from './PlaceImage';

interface PlaceDetailCardProps {
  place: OptimizedPlace;
  memberColors: Record<string, string>;
  arrivalTime?: string;
  departureTime?: string;
  visitDuration?: number;
  travelFromPrevious?: {
    duration: number;
    distance: number;
    mode: string;
  };
  orderNumber?: number;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onPlaceSelect?: (place: OptimizedPlace) => void;
  onMemberInteraction?: (memberId: string, action: string) => void;
  className?: string;
}

export default function PlaceDetailCard({
  place,
  memberColors,
  arrivalTime,
  departureTime,
  visitDuration,
  travelFromPrevious,
  orderNumber,
  isExpanded = false,
  onToggleExpanded,
  onPlaceSelect,
  onMemberInteraction,
  className = ''
}: PlaceDetailCardProps) {
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const formatTime = (timeString?: string): string => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };


  const getPlaceRating = (): number => {
    if (place.rating) return place.rating;
    if (place.member_preferences && place.member_preferences.length > 0) {
      const avgRating = place.member_preferences.reduce((sum, pref) => sum + pref.preference_score, 0) / place.member_preferences.length;
      return Math.round(avgRating * 10) / 10;
    }
    return 0;
  };

  const getDominantMemberColor = (): string => {
    if (!place.member_preferences || place.member_preferences.length === 0) {
      return '#3b82f6';
    }

    const highestPref = place.member_preferences.reduce((prev, current) => 
      current.preference_score > prev.preference_score ? current : prev
    );

    return memberColors[highestPref.member_id] || '#3b82f6';
  };

  const handleMemberClick = (memberId: string) => {
    setSelectedMember(selectedMember === memberId ? null : memberId);
    onMemberInteraction?.(memberId, selectedMember === memberId ? 'deselect' : 'select');
  };

  const renderMemberPreferences = () => {
    if (!place.member_preferences || place.member_preferences.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Member Preferences
        </h4>
        <div className="grid gap-2">
          {place.member_preferences.map((pref: MemberPreference) => (
            <motion.div
              key={pref.member_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedMember === pref.member_id
                  ? 'border-blue-300 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleMemberClick(pref.member_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: memberColors[pref.member_id] || '#gray' }}
                  />
                  <span className="font-medium text-sm">Member {pref.member_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < pref.preference_score
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600">{pref.preference_score}/5</span>
                </div>
              </div>
              
              <AnimatePresence>
                {selectedMember === pref.member_id && pref.reasons && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 pt-2 border-t border-gray-200 overflow-hidden"
                  >
                    <p className="text-xs text-gray-600">
                      <strong>Why:</strong> {pref.reasons}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderPhotos = () => {
    if (!place.photos || place.photos.length === 0) return null;

    const displayPhotos = showAllPhotos ? place.photos : place.photos.slice(0, 3);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Photos ({place.photos.length})
          </h4>
          {place.photos.length > 3 && (
            <button
              onClick={() => setShowAllPhotos(!showAllPhotos)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showAllPhotos ? 'Show less' : `+${place.photos.length - 3} more`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {displayPhotos.map((photo, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="aspect-square rounded-lg overflow-hidden bg-gray-100"
            >
              <img
                src={photo.url}
                alt={photo.alt || `${place.name} photo ${index + 1}`}
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
              />
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderPlaceDetails = () => (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Category:</span>
          <span className="ml-2 text-gray-700 font-medium">{place.category}</span>
        </div>
        <div>
          <span className="text-gray-500">Price Level:</span>
          <span className="ml-2 text-gray-700">
            {'$'.repeat(place.price_level || 1)}
          </span>
        </div>
        {place.phone && (
          <div className="col-span-2">
            <span className="text-gray-500">Phone:</span>
            <span className="ml-2 text-gray-700">{place.phone}</span>
          </div>
        )}
        {place.website && (
          <div className="col-span-2">
            <span className="text-gray-500">Website:</span>
            <a 
              href={place.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <Globe className="w-3 h-3 inline mr-1" />
              Visit Website
            </a>
          </div>
        )}
      </div>

      {/* Address */}
      {place.address && (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-gray-600">{place.address}</span>
        </div>
      )}

      {/* Opening Hours */}
      {place.opening_hours && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Opening Hours</h4>
          <div className="text-sm text-gray-600 space-y-1">
            {place.opening_hours.map((hours, index) => (
              <div key={index}>{hours}</div>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {renderPhotos()}

      {/* Member Preferences */}
      {renderMemberPreferences()}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div 
        className="p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => onPlaceSelect?.(place)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {orderNumber && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: getDominantMemberColor() }}
                >
                  {orderNumber}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {place.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {getPlaceRating() > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">{getPlaceRating()}</span>
                    </div>
                  )}
                  {place.total_ratings && (
                    <span className="text-xs text-gray-500">({place.total_ratings} reviews)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Timing Information */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {arrivalTime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(arrivalTime)}</span>
                </div>
              )}
              {visitDuration && (
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  <span>{formatDuration(visitDuration)}</span>
                </div>
              )}
              {departureTime && (
                <div className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  <span>Leave {formatTime(departureTime)}</span>
                </div>
              )}
            </div>

            {/* Travel Info */}
            {travelFromPrevious && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Route className="w-3 h-3" />
                  <span>
                    {formatDuration(travelFromPrevious.duration)} travel by {travelFromPrevious.mode}
                  </span>
                  <span className="text-blue-500">
                    ({Math.round(travelFromPrevious.distance * 100) / 100} km)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Expand Button */}
          {onToggleExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
              className="ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {renderPlaceDetails()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}