import React, { useState, useEffect } from 'react';
import { pixabayService } from '../services/PixabayService';

interface PlaceImageProps {
  placeName: string;
  fallbackUrl?: string;
  alt?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const PlaceImage: React.FC<PlaceImageProps> = ({
  placeName,
  fallbackUrl = '/api/placeholder/400/300',
  alt,
  className = '',
  size = 'medium'
}) => {
  const [imageUrl, setImageUrl] = useState<string>(fallbackUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
          setImageUrl(fallbackUrl);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Only load from Pexels if we have a valid place name
    if (placeName && placeName.trim() && !placeName.includes('/api/placeholder')) {
      loadImage();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [placeName, fallbackUrl]);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImageUrl(fallbackUrl);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className={`absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-inherit ${className}`} />
      )}
      <img
        src={imageUrl}
        alt={alt || placeName}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
    </div>
  );
};