'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useGuestStore } from '@/lib/stores/guest-store';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  departure_location: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface TripContextType {
  activeTrip: Trip | null;
  setActiveTrip: (trip: Trip | null) => void;
  activeTripId: string | null;
  navigateWithTrip: (path: string) => void;
  restoreLastTrip: () => Promise<string | null>;
}

const TripContext = createContext<TripContextType | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [initialized, setInitialized] = useState(false);
  const searchParams = useSearchParams();
  const tripId = searchParams.get("id");
  const { sessionId } = useGuestStore();
  const router = useRouter();
  const pathname = usePathname();
  const previousTripId = useRef<string | null>(null);
  
  // Function to save active trip ID
  const saveActiveTripId = async (id: string) => {
    if (!sessionId) return;
    
    const supabase = createClient();
    await supabase
      .from('session_settings')
      .upsert({
        session_id: sessionId,
        setting_key: 'last_active_trip',
        setting_value: id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id,setting_key' });
  };
  
  // Navigate with trip ID appended
  const navigateWithTrip = (path: string) => {
    if (activeTrip) {
      router.push(`${path}?id=${activeTrip.id}`);
    } else {
      router.push(path);
    }
  };
  
  // Restore last selected trip
  const restoreLastTrip = async (): Promise<string | null> => {
    if (!sessionId) return null;
    
    const supabase = createClient();
    const { data } = await supabase
      .from('session_settings')
      .select('setting_value')
      .eq('session_id', sessionId)
      .eq('setting_key', 'last_active_trip')
      .single();
    
    if (data?.setting_value) {
      return data.setting_value;
    }
    
    return null;
  };

  // Initialize trip on app startup
  useEffect(() => {
    const initializeTrip = async () => {
      if (!sessionId || initialized) return;
      
      // If no trip ID in URL, restore last trip
      if (!tripId) {
        const lastTripId = await restoreLastTrip();
        if (lastTripId) {
          // Load trip data
          const supabase = createClient();
          const { data } = await supabase
            .from('trip_groups')
            .select('*')
            .eq('id', lastTripId)
            .single();
          
          if (data) {
            setActiveTrip(data);
            // Add trip ID to current page if needed
            if (pathname.startsWith('/my-trip')) {
              router.replace(`${pathname}?id=${lastTripId}`);
            }
          }
        }
      }
      setInitialized(true);
    };
    
    initializeTrip();
  }, [sessionId, tripId, pathname, router, initialized]);
  
  // Handle trip ID changes from URL
  useEffect(() => {
    if (!tripId || !sessionId || !initialized) {
      // Don't clear activeTrip just because tripId is not in URL
      // This allows trip selection to persist across navigation
      return;
    }
    
    // Skip if the trip ID hasn't changed
    if (tripId === previousTripId.current) {
      return;
    }
    
    // If URL has trip ID and it's different from current active trip
    if (tripId !== activeTrip?.id) {
      const fetchTrip = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from('trip_groups')
          .select('*')
          .eq('id', tripId)
          .single();
        
        if (data) {
          previousTripId.current = tripId;
          setActiveTrip(data);
          saveActiveTripId(data.id);
        }
      };
      
      fetchTrip();
    }
  }, [tripId, sessionId, activeTrip, initialized]);
  
  // Custom setActiveTrip function that also updates previousTripId
  const handleSetActiveTrip = (trip: Trip | null) => {
    if (trip) {
      previousTripId.current = trip.id;
      if (trip.id) {
        saveActiveTripId(trip.id);
      }
    } else {
      previousTripId.current = null;
    }
    setActiveTrip(trip);
  };
  
  return (
    <TripContext.Provider value={{
      activeTrip,
      setActiveTrip: handleSetActiveTrip,
      activeTripId: activeTrip?.id || null,
      navigateWithTrip,
      restoreLastTrip
    }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrip = () => {
  const context = useContext(TripContext);
  if (context === null) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}; 