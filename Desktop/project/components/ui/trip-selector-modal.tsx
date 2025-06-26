'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useGuestStore } from '@/lib/stores/guest-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, MapPin, Calendar } from 'lucide-react';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  departure_location: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface TripSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTrip?: (trip: Trip) => void;
}

export function TripSelectorModal({ open, onOpenChange, onSelectTrip }: TripSelectorModalProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { sessionId } = useGuestStore();
  const router = useRouter();

  useEffect(() => {
    const fetchTrips = async () => {
      if (!open) return;
      
      setIsLoading(true);
      const supabase = createClient();
      
      try {
        // 直接trip_groupsテーブルからすべてのトリップを取得
        const { data: tripData, error: tripError } = await supabase
          .from('trip_groups')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (tripError) {
          console.error('Error fetching trips:', tripError);
          setTrips([]);
        } else {
          setTrips(tripData || []);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setTrips([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTrips();
  }, [open]);

  const handleSelectTrip = (trip: Trip) => {
    if (onSelectTrip) {
      onSelectTrip(trip);
    } else {
      // トリップページに遷移し、URLパラメータを保持
      router.push(`/my-trip?id=${trip.id}`);
    }
    onOpenChange(false);
  };

  // 日付フォーマット
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Trip</DialogTitle>
          <DialogDescription>
            Choose from your existing trips
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">You don't have any trips yet</p>
              <Button 
                onClick={() => {
                  onOpenChange(false);
                  router.push('/trips/new');
                }}
                className="bg-sky-500 hover:bg-sky-600"
              >
                Create Your First Trip
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {trips.map((trip) => (
                <Card 
                  key={trip.id}
                  className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => handleSelectTrip(trip)}
                >
                  <div>
                    <h3 className="font-medium">{trip.name}</h3>
                    {trip.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{trip.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <div className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                        <MapPin className="h-3 w-3 text-sky-500" />
                        <span className="truncate max-w-[150px]">{trip.departure_location}</span>
                      </div>
                      
                      {trip.start_date && (
                        <div className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                          <Calendar className="h-3 w-3 text-sky-500" />
                          <span>
                            {formatDate(trip.start_date)}
                            {trip.end_date ? ` - ${formatDate(trip.end_date)}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 