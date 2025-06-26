'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import GooglePlacesSearch from '@/components/places/google-places-search';
import { Button } from '@/components/ui/button';
import { SearchResult } from '@/lib/types/places';

interface PlacesSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceSelect: (place: SearchResult) => void;
}

export default function PlacesSearchModal({
  isOpen,
  onClose,
  onPlaceSelect
}: PlacesSearchModalProps) {
  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 touch-none"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-4 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Search for a place</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <GooglePlacesSearch
          placeholder="Search for places..."
          onPlaceSelect={onPlaceSelect}
          size="medium"
          className="mb-4"
          autoFocus={true}
          noResultsText="No places found"
        />
        
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Search for a place to add to your personal wishlist
        </div>
      </div>
    </div>
  );
} 