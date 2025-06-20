/**
 * Unified Place Search Input Component for Voypath
 * Phase 0: Common search interface for 6 input locations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Star, Plus, Loader2 } from 'lucide-react';
import { GooglePlace, PlaceSearchRequest, PlaceSearchService } from '../../services/PlaceSearchService';

export interface PlaceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: GooglePlace) => void;
  placeholder?: string;
  searchContext?: {
    location?: { lat: number; lng: number };
    radius?: number;
    types?: string[];
  };
  className?: string;
  disabled?: boolean;
}

export const PlaceSearchInput: React.FC<PlaceSearchInputProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search for places...",
  searchContext,
  className = "",
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<GooglePlace[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search function
  const debouncedSearch = useCallback(
    async (searchValue: string) => {
      if (searchValue.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const searchRequest: PlaceSearchRequest = {
          inputValue: searchValue,
          location: searchContext?.location,
          searchRadius: searchContext?.radius || 50,
          placeTypes: searchContext?.types,
          language: 'en',
          maxResults: 8
        };

        const places = await PlaceSearchService.searchPlaces(searchRequest);
        setSuggestions(places);
        setShowSuggestions(places.length > 0);
      } catch (err) {
        console.error('Place search error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (errorMessage.includes('API request denied') || errorMessage.includes('BillingNotEnabledMapError')) {
          setError('Google Maps API billing not enabled. Please enable billing or contact administrator.');
        } else {
          setError(`Search failed: ${errorMessage}`);
        }
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    },
    [searchContext]
  );

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      debouncedSearch(newValue);
    }, 300);
  };

  const handleSuggestionClick = (place: GooglePlace) => {
    onChange(place.name);
    setShowSuggestions(false);
    setSuggestions([]);
    setError(null);
    onPlaceSelect(place);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Add slight delay to allow click events to process
    setTimeout(() => setShowSuggestions(false), 200);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-12 pr-12 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
        
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-full mt-1 w-full">
          <p className="text-sm text-red-500 dark:text-red-400 px-2">
            {error}
          </p>
        </div>
      )}

      {/* Search results dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-2 left-0 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {suggestions.map((place) => (
            <button
              key={place.place_id}
              onClick={() => handleSuggestionClick(place)}
              className="w-full p-3 sm:p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200/30 dark:border-slate-700/30 last:border-b-0 focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700/50"
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {place.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                    {place.formatted_address}
                  </p>
                  
                  {place.rating && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {place.rating} ({place.user_ratings_total} reviews)
                      </span>
                    </div>
                  )}
                </div>
                
                <Plus className="w-5 h-5 text-primary-500 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results case */}
      {showSuggestions && suggestions.length === 0 && !isLoading && value.length >= 2 && (
        <div className="absolute top-full mt-2 left-0 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-3 sm:p-4 z-50">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            No places found for "{value}"
          </p>
        </div>
      )}
    </div>
  );
}; 