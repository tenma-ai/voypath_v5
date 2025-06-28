import React, { useState, useEffect } from 'react';
import { pixabayService } from '../services/PixabayService';
import { MapPin } from 'lucide-react';

interface PlaceImageProps {
  placeName: string;
  fallbackUrl?: string;
  alt?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const PlaceImage: React.FC<PlaceImageProps> = ({
  placeName,
  fallbackUrl,
  alt,
  className = '',
  size = 'medium'
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setShowFallback(false);
        
        const url = await pixabayService.getPlacePhoto(placeName);
        
        if (isMounted && url && url.trim() !== '' && !url.includes('/api/placeholder')) {
          setImageUrl(url);
          setIsLoading(false);
        } else {
          // No valid URL from Pixabay, try fallback
          if (isMounted) {
            if (fallbackUrl && fallbackUrl.trim() !== '' && !fallbackUrl.includes('/api/placeholder')) {
              setImageUrl(fallbackUrl);
              setIsLoading(false);
            } else {
              // Show placeholder for places without images
              setShowFallback(true);
              setImageUrl(null);
              setIsLoading(false);
            }
          }
        }
      } catch (error) {
        console.error('Error loading place image:', error);
        if (isMounted) {
          setHasError(true);
          if (fallbackUrl && fallbackUrl.trim() !== '' && !fallbackUrl.includes('/api/placeholder')) {
            setImageUrl(fallbackUrl);
          } else {
            setShowFallback(true);
            setImageUrl(null);
          }
          setIsLoading(false);
        }
      }
    };

    // Only load from Pixabay if we have a valid place name
    if (placeName && placeName.trim() && !placeName.includes('/api/placeholder')) {
      loadImage();
    } else {
      // No valid place name, use fallback immediately
      setIsLoading(false);
      if (fallbackUrl && fallbackUrl.trim() !== '' && !fallbackUrl.includes('/api/placeholder')) {
        setImageUrl(fallbackUrl);
      } else {
        setShowFallback(true);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [placeName, fallbackUrl]);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      // If current image failed, try fallback or show placeholder
      if (fallbackUrl && fallbackUrl.trim() !== '' && !fallbackUrl.includes('/api/placeholder') && imageUrl !== fallbackUrl) {
        setImageUrl(fallbackUrl);
      } else {
        setShowFallback(true);
        setImageUrl(null);
      }
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Show fallback placeholder if no image is available
  if (showFallback || ((!imageUrl || imageUrl.trim() === '') && !isLoading)) {
    const displayName = placeName && placeName.trim() ? placeName : 'Place';
    const truncatedName = displayName.length > 20 ? displayName.slice(0, 20) + '...' : displayName;
    
    return (
      <div className={`relative ${className} bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center overflow-hidden`}>
        <div className="text-center p-2">
          <MapPin className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-500 mb-1" />
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight">
            {truncatedName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className={`absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-inherit`} />
      )}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={alt || placeName}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
        />
      )}
    </div>
  );
};