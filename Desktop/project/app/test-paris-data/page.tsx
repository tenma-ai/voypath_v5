'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useTrip } from '@/lib/contexts/trip-context';
import { MapPin, Plus, Trash2 } from 'lucide-react';

const parisPlaces = [
  {
    name: 'Eiffel Tower',
    address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
    place_id: 'ChIJLU7jZClu5kcR4PcOOO6p3I0',
    latitude: 48.8584,
    longitude: 2.2945
  },
  {
    name: 'Louvre Museum',
    address: 'Rue de Rivoli, 75001 Paris, France',
    place_id: 'ChIJD3uTd9hx5kcR1IQvGfr8dbk',
    latitude: 48.8606,
    longitude: 2.3376
  },
  {
    name: 'Notre-Dame Cathedral',
    address: '6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris, France',
    place_id: 'ChIJATr1n-Fx5kcRjQb6q6cdQDY',
    latitude: 48.8530,
    longitude: 2.3499
  },
  {
    name: 'Arc de Triomphe',
    address: 'Pl. Charles de Gaulle, 75008 Paris, France',
    place_id: 'ChIJjx37cOxv5kcRPh1HI9Q2CdY',
    latitude: 48.8738,
    longitude: 2.2950
  },
  {
    name: 'Champs-Élysées',
    address: 'Av. des Champs-Élysées, 75008 Paris, France',
    place_id: 'ChIJjx37cOxv5kcRPh1HI9Q2CdY',
    latitude: 48.8698,
    longitude: 2.3076
  }
];

export default function TestParisDataPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const { sessionId } = useGuestStore();
  const { activeTrip } = useTrip();

  const addParisPlaces = async () => {
    if (!sessionId || !activeTrip) {
      setStatus('❌ No active trip or session found');
      return;
    }

    setIsLoading(true);
    setStatus('Adding Paris places...');
    const supabase = createClient();

    try {
      let successCount = 0;
      
      for (const place of parisPlaces) {
        try {
          // 1. Add to destinations table
          const { data: destinationData, error: destError } = await supabase
            .from('destinations')
            .insert({
              group_id: activeTrip.id,
              name: place.name,
              address: place.address,
              place_id: place.place_id,
              latitude: place.latitude,
              longitude: place.longitude,
              created_by: null
            })
            .select()
            .single();

          if (destError) {
            console.warn(`Could not add ${place.name} to destinations:`, destError);
            continue;
          }

          // 2. Add to user_preferences table
          const { error: prefError } = await supabase
            .from('user_preferences')
            .insert({
              group_id: activeTrip.id,
              user_id: null,
              session_id: sessionId,
              destination_id: destinationData.id,
              preference_score: 4 + Math.random(), // Random score 4-5
              preferred_duration: 60 + Math.floor(Math.random() * 120), // 60-180 minutes
              notes: `Beautiful ${place.name} in Paris`,
              is_personal_favorite: Math.random() > 0.5
            });

          if (!prefError) {
            successCount++;
            console.log(`✅ Added ${place.name}`);
          }

        } catch (error) {
          console.error(`Error adding ${place.name}:`, error);
        }
      }

      setStatus(`✅ Added ${successCount}/${parisPlaces.length} Paris places to destinations`);
      
    } catch (error) {
      console.error('Error adding Paris places:', error);
      setStatus('❌ Failed to add Paris places');
    } finally {
      setIsLoading(false);
    }
  };

  const clearDestinations = async () => {
    if (!activeTrip) {
      setStatus('❌ No active trip found');
      return;
    }

    setIsLoading(true);
    setStatus('Clearing destinations...');
    const supabase = createClient();

    try {
      // Delete user preferences first (foreign key constraint)
      await supabase
        .from('user_preferences')
        .delete()
        .eq('group_id', activeTrip.id);

      // Delete destinations
      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('group_id', activeTrip.id);

      if (error) {
        setStatus('❌ Failed to clear destinations');
      } else {
        setStatus('✅ Cleared all destinations for this trip');
      }
    } catch (error) {
      console.error('Error clearing destinations:', error);
      setStatus('❌ Error clearing destinations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Paris Test Data Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>Active Trip:</strong> {activeTrip?.name || 'None'}</p>
            <p><strong>Session ID:</strong> {sessionId || 'None'}</p>
            <p><strong>Status:</strong> {status}</p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={addParisPlaces}
              disabled={isLoading || !activeTrip}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Paris Places to Destinations
            </Button>

            <Button 
              variant="destructive"
              onClick={clearDestinations}
              disabled={isLoading || !activeTrip}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Destinations
            </Button>
          </div>

          <div>
            <h3 className="font-medium mb-2">Test Places to be Added:</h3>
            <ul className="text-sm space-y-1">
              {parisPlaces.map((place, index) => (
                <li key={index} className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span>{place.name}</span>
                  <span className="text-gray-500">- {place.address}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg text-sm">
            <h4 className="font-medium mb-1">How to Test My Places Adoption Status:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Make sure you have an active trip selected</li>
              <li>Click "Add Paris Places to Destinations" to add test data</li>
              <li>Navigate to My Trip → My Places</li>
              <li>Verify all places show "未採用" (Not Adopted) status</li>
              <li>Navigate to My Trip → Plan section</li>
              <li>Click "Generate Optimized Plan" button (when 2+ places present)</li>
              <li>Return to My Places and verify adopted places show "✓ 採用済み" with details</li>
              <li>Test the filter buttons: すべて/採用済み/未採用</li>
              <li>Check adoption summary in header</li>
            </ol>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <h4 className="font-medium mb-1">Expected Results:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Before Optimization:</strong> All places show "未採用" badge</li>
              <li><strong>After Optimization:</strong> Adopted places show "✓ 採用済み (#N)" with visit order</li>
              <li><strong>Adoption Details:</strong> Visit order, scheduled date, allocated duration</li>
              <li><strong>Time Adjustments:</strong> Shows if allocated time differs from preferred time</li>
              <li><strong>Header Summary:</strong> Shows count of adopted vs not-adopted places</li>
              <li><strong>Filtering:</strong> Can filter by adoption status</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}