'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, Search } from 'lucide-react';
import { TripSelectorModal } from './trip-selector-modal';
import { useTrip } from '@/lib/contexts/trip-context';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  departure_location: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface NoTripSelectedProps {
  title?: string;
  message?: string;
}

export function NoTripSelected({ 
  title = "No trip selected", 
  message = "Please select or create a trip to continue" 
}: NoTripSelectedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { setActiveTrip } = useTrip();

  const handleTripSelected = (trip: Trip) => {
    // 選択したトリップをアクティブに設定
    setActiveTrip(trip);
    
    // 現在のパスにトリップIDを追加して遷移
    router.push(`${pathname}?id=${trip.id}`);
  };

  return (
    <>
      <Card>
        <CardContent className="p-8 text-center">
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <p className="text-muted-foreground mb-6">{message}</p>
          
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button 
              onClick={() => router.push('/trips/new')} 
              className="bg-sky-500 hover:bg-sky-600 flex gap-2 items-center justify-center"
            >
              <Plus className="h-4 w-4" />
              <span>Create Trip</span>
            </Button>
            
            <Button 
              onClick={() => setSelectorOpen(true)} 
              variant="outline"
              className="flex gap-2 items-center justify-center"
            >
              <Search className="h-4 w-4" />
              <span>Select Trip</span>
            </Button>
            
            <Button 
              onClick={() => router.push('/join')} 
              variant="outline"
              className="flex gap-2 items-center justify-center"
            >
              <UserPlus className="h-4 w-4" />
              <span>Join Trip</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <TripSelectorModal 
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelectTrip={handleTripSelected}
      />
    </>
  );
} 