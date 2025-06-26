'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useTrip } from '@/lib/contexts/trip-context';
import { AddPlaceForm } from '../../components/places/add-place-form';
import { createClient } from '@/lib/supabase/client';
import { NoTripSelected } from '@/components/ui/no-trip-selected';

export default function AddPlacePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tripData, setTripData] = useState<any>(null);
  const hasInitialized = useRef(false);
  const hasSetActiveTrip = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('trip_id');
  const { sessionId } = useGuestStore();
  const { activeTrip, setActiveTrip } = useTrip();
  
  // Memoized function to fetch trip data
  const fetchTripData = useCallback(async (id: string) => {
    if (!id) return null;
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('trip_groups')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error('Error fetching trip:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }, []);
  
  // Load trip data if tripId is provided
  useEffect(() => {
    // Prevent multiple data fetches
    if (hasInitialized.current) return;
    
    const initializePage = async () => {
      if (!tripId) {
        setIsLoading(false);
        hasInitialized.current = true;
        return;
      }
      
      setIsLoading(true);
      
      try {
        const data = await fetchTripData(tripId);
        
        if (data) {
          setTripData(data);
          
          // Set active trip only once
          if (!hasSetActiveTrip.current && (!activeTrip || activeTrip.id !== data.id)) {
            hasSetActiveTrip.current = true;
            setActiveTrip(data);
          }
        }
      } finally {
        setIsLoading(false);
        hasInitialized.current = true;
      }
    };
    
    initializePage();
  }, [tripId, fetchTripData, setActiveTrip]); // Remove activeTrip dependency
  
  const handleBack = () => {
    if (tripId) {
      router.push(`/my-trip/places?id=${tripId}`);
    } else {
      router.push('/my-trip/places');
    }
  };
  
  const handleSuccess = useCallback(() => {
    if (tripId) {
      router.push(`/my-trip/places?id=${tripId}`);
    } else {
      router.push('/my-trip/places');
    }
  }, [router, tripId]);
  
  if (isLoading) {
    return (
      <div className="container flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }
  
  const currentTrip = tripData || activeTrip;
  
  if (!currentTrip) {
    return (
      <div className="container py-8">
        <NoTripSelected 
          title="No trip selected"
          message="Please select a trip before adding places"
        />
      </div>
    );
  }
  
  return (
    <div className="container py-8 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Add Place</h1>
      </div>
      
      <div className="space-y-2 mb-6">
        <p className="text-muted-foreground">
          Trip: <span className="font-medium text-foreground">{currentTrip.name}</span>
        </p>
      </div>
      
      <AddPlaceForm tripId={currentTrip.id} onSuccess={handleSuccess} />
    </div>
  );
} 