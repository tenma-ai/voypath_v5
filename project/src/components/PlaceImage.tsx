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
  const [imageUrl, setImageUrl] = useState<string | null>(fallbackUrl || null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const url = await pixabayService.getPlacePhoto(placeName);
        
        if (isMounted) {
          setImageUrl(url);
        }
      } catch (error) {
        console.error('Error loading place image:', error);
        if (isMounted) {
          setHasError(true);
          if (fallbackUrl) {
            setImageUrl(fallbackUrl);
          } else {
            setShowFallback(true);
            setImageUrl(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Only load from Pixabay if we have a valid place name
    if (placeName && placeName.trim() && !placeName.includes('/api/placeholder')) {
      loadImage();
    } else {
      setIsLoading(false);
      if (!fallbackUrl) {
        setShowFallback(true);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [placeName, fallbackUrl]);

  const handleImageError = () => {
    console.log('🖼️ Image error for place:', placeName, 'fallbackUrl:', fallbackUrl);
    if (!hasError) {
      setHasError(true);
      if (fallbackUrl) {
        console.log('🖼️ Using fallbackUrl:', fallbackUrl);
        setImageUrl(fallbackUrl);
      } else {
        console.log('🖼️ No fallbackUrl, showing placeholder for:', placeName);
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
    return (
      <div className={`relative ${className} bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center`}>
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {placeName ? placeName.slice(0, 20) + (placeName.length > 20 ? '...' : '') : 'Place'}
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