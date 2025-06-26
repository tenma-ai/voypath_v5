'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AddPlaceForm } from '@/components/places/add-place-form';
import GooglePlacesSearch from '@/components/places/google-places-search';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useTrip } from '@/lib/contexts/trip-context';
import { SearchResult } from '@/lib/types/places';

export default function AddPlacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTrip } = useTrip();
  
  // Get query params
  const placeId = searchParams.get('placeId');
  const date = searchParams.get('date');
  const source = searchParams.get('source');
  const groupId = searchParams.get('groupId');
  
  // Get place data directly from URL params if available
  const name = searchParams.get('name');
  const address = searchParams.get('address');
  const latitude = searchParams.get('latitude');
  const longitude = searchParams.get('longitude');
  
  const [selectedPlace, setSelectedPlace] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSearchFirst, setShowSearchFirst] = useState(!placeId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  console.log('Add Place page loaded with params:', {
    placeId, groupId, date, source, name, address, latitude, longitude
  });
  
  // Directly use URL params if all necessary data is available
  useEffect(() => {
    if (placeId && name && address && latitude && longitude) {
      console.log('Creating place from URL params');
      const place: SearchResult = {
        place_id: placeId,
        name: name,
        address: address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
      setSelectedPlace(place);
      setIsLoading(false);
      setShowSearchFirst(false);
      setError(null);
    } else if (placeId) {
      // Fallback to Google Places API lookup if we only have placeId
      loadPlaceDetails();
    }
  }, [placeId, name, address, latitude, longitude]);
  
  // For pre-populated place, load place details if placeId is provided but other details missing
  const loadPlaceDetails = async () => {
    if (!placeId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Loading place details from Google Places API for ID:', placeId);
      // This would typically be server-side, but for now we'll do it client-side
      const map = new google.maps.Map(document.createElement('div'));
      const service = new google.maps.places.PlacesService(map);
      
      service.getDetails(
        {
          placeId,
          fields: ['name', 'formatted_address', 'geometry', 'photos', 'types']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            console.log('Google Places API returned place details:', place);
            
            // Extract photo URLs if available
            const photoUrls: string[] = [];
            if (place.photos && place.photos.length > 0) {
              place.photos.slice(0, 3).forEach(photo => {
                photoUrls.push(photo.getUrl({ maxWidth: 400, maxHeight: 300 }));
              });
            }
            
            // Format place data
            const placeData: SearchResult = {
              place_id: placeId,
              name: place.name || '',
              address: place.formatted_address || '',
              latitude: place.geometry?.location?.lat() || 0,
              longitude: place.geometry?.location?.lng() || 0,
              photos: photoUrls,
              types: place.types || []
            };
            
            console.log('Converted to SearchResult:', placeData);
            setSelectedPlace(placeData);
            setShowSearchFirst(false);
          } else {
            console.error('Error fetching place details:', status);
            setError(`Could not fetch place details: ${status}`);
            setShowSearchFirst(true);
          }
          
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Error loading place details:', error);
      setError('An error occurred while loading place details. Please try again.');
      setShowSearchFirst(true);
      setIsLoading(false);
    }
  };
  
  // Handle place selection from search
  const handlePlaceSelect = (place: SearchResult) => {
    console.log('Place selected from search:', place);
    setSelectedPlace(place);
    setShowSearchFirst(false);
    setError(null);
  };
  
  // Handle form success
  const handleSuccess = (placeId: string) => {
    console.log('Place added successfully, redirecting with ID:', placeId);
    setSuccess(true);
    
    // Redirect after a short delay to show success state
    setTimeout(() => {
      // Redirect back to the source page or to My Places by default
      if (source) {
        router.push(`${decodeURIComponent(source)}?added=${placeId}`);
      } else {
        // Updated redirect path to the new location
        router.push(`/my-trip/my-places?added=${placeId}`);
      }
    }, 1000);
  };
  
  // Handle form error
  const handleError = (errorMessage: string) => {
    console.error('Form error:', errorMessage);
    setError(errorMessage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Parse date string into Date object if provided
  const parsedDate = date ? new Date(date) : undefined;
  
  // Get the effective groupId from either URL param or active trip
  const effectiveGroupId = groupId || activeTrip?.id;
  
  console.log('Selected place:', selectedPlace);
  console.log('Effective group ID:', effectiveGroupId);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }
  
  // Search first view (when no place is selected)
  if (showSearchFirst) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Add Place to Wishlist</h1>
        
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
          <p className="mb-4 text-muted-foreground">
            Search for a place you'd like to add to your wishlist
          </p>
          
          <GooglePlacesSearch
            placeholder="Search for a place to add to your wishlist..."
            onPlaceSelect={handlePlaceSelect}
            size="medium"
            className="w-full"
            autoFocus={true}
            noResultsText="No places found"
          />
          
          <p className="mt-4 text-xs text-gray-500">
            Note: Adding to your wishlist does not guarantee inclusion in the final group itinerary.
            The optimization algorithm will consider all members' preferences when creating the group plan.
          </p>
        </div>
      </div>
    );
  }
  
  // Success state
  if (success) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="p-8 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-xl font-semibold text-green-800 mb-2">Place Added Successfully!</h2>
          <p className="text-center text-green-700 mb-6">
            Your place has been added to your wishlist. Redirecting...
          </p>
          <div className="animate-pulse">
            <Loader2 className="h-6 w-6 text-green-500" />
          </div>
        </div>
      </div>
    );
  }
  
  // Form view (when place is selected)
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <AddPlaceForm
        placeData={selectedPlace!}
        onSuccess={handleSuccess}
        onError={handleError}
        defaultDate={parsedDate}
        returnPath="/my-trip/my-places"
        groupId={effectiveGroupId}
      />
    </div>
  );
} 