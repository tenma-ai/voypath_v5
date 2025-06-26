'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MapPin, 
  Clock, 
  Users, 
  Star, 
  Calendar,
  CheckCircle,
  Circle,
  AlertCircle,
  Plus,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrip } from '@/lib/contexts/trip-context';
import { useGuestStore } from '@/lib/stores/guest-store';
import { getUnifiedPlaces, syncMemberColors } from '@/lib/actions/unified-place-actions';
import { transparentizeColor } from '@/lib/utils/member-colors';
import { formatDuration } from '@/lib/utils/time-utils';
import GooglePlacesSearch from '@/components/places/google-places-search';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface UnifiedPlace {
  id: string;
  name: string;
  address: string;
  google_place_id: string;
  latitude: number;
  longitude: number;
  wish_level: number;
  stay_duration_minutes: number;
  scheduled: boolean;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  visit_date?: string | null;
  member_contribution?: any;
  member_contributors?: string[];
  display_color_hex?: string;
  color_type?: string;
  isMyPlace?: boolean;
  contributorCount?: number;
  status?: 'scheduled' | 'pending' | 'unscheduled';
}

export function UnifiedPlacesManager() {
  const router = useRouter();
  const { activeTrip } = useTrip();
  const { sessionId } = useGuestStore();
  const { toast } = useToast();
  
  const [places, setPlaces] = useState<UnifiedPlace[]>([]);
  const [myPlaces, setMyPlaces] = useState<UnifiedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trip' | 'my'>('trip');
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'pending' | 'unscheduled'>('all');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  
  useEffect(() => {
    if (activeTrip?.id && sessionId) {
      fetchPlaces();
      // メンバーカラーを同期
      syncMemberColors(activeTrip.id).catch(console.error);
    }
  }, [activeTrip, sessionId]);
  
  const fetchPlaces = async () => {
    if (!activeTrip?.id || !sessionId) return;
    
    setIsLoading(true);
    try {
      const result = await getUnifiedPlaces(activeTrip.id, null, sessionId);
      if (result.success) {
        setPlaces(result.tripPlaces);
        setMyPlaces(result.myPlaces);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      toast({
        title: "Error",
        description: "Failed to fetch places",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePlaceSelect = (place: any) => {
    setSelectedPlace(place);
  };
  
  const handleAddPlace = () => {
    if (!selectedPlace || !activeTrip) return;
    
    const params = new URLSearchParams({
      placeId: selectedPlace.place_id,
      groupId: activeTrip.id,
      name: selectedPlace.name,
      address: selectedPlace.address,
      latitude: selectedPlace.latitude.toString(),
      longitude: selectedPlace.longitude.toString(),
      source: '/my-trip/my-places'
    });
    
    router.push(`/my-trip/my-places/add?${params.toString()}`);
  };
  
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'scheduled':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };
  
  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'pending':
        return 'Pending';
      default:
        return 'Unscheduled';
    }
  };
  
  const filteredPlaces = (placeList: UnifiedPlace[]) => {
    if (filterStatus === 'all') return placeList;
    return placeList.filter(place => place.status === filterStatus);
  };
  
  const renderPlaceCard = (place: UnifiedPlace) => {
    const contributors = place.member_contribution?.contributors || [];
    const isMultipleContributors = contributors.length > 1;
    
    return (
      <Card 
        key={place.id} 
        className={cn(
          "transition-all hover:shadow-md",
          place.scheduled && "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-lg">{place.name}</h3>
                <div className="flex items-center gap-1">
                  {getStatusIcon(place.status)}
                  <Badge 
                    variant={place.status === 'scheduled' ? 'default' : 'outline'}
                    className={cn(
                      place.status === 'scheduled' && "bg-green-600 hover:bg-green-700",
                      place.status === 'pending' && "bg-yellow-600 hover:bg-yellow-700 text-white"
                    )}
                  >
                    {getStatusLabel(place.status)}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="truncate">{place.address}</span>
              </div>
            </div>
            
            {/* メンバーカラー表示 */}
            {place.display_color_hex && (
              <div 
                className={cn(
                  "w-8 h-8 rounded-full",
                  isMultipleContributors && "ring-2 ring-offset-2 ring-gray-300"
                )}
                style={{
                  background: isMultipleContributors 
                    ? `linear-gradient(45deg, ${place.display_color_hex}, ${transparentizeColor(place.display_color_hex, 0.3)})`
                    : place.display_color_hex
                }}
                title={`Added by ${contributors.length} member(s)`}
              />
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(place.stay_duration_minutes)}
            </Badge>
            
            <Badge variant="outline" className="text-xs">
              <Star className="h-3 w-3 mr-1" />
              {place.wish_level}/5
            </Badge>
            
            {contributors.length > 1 && (
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {contributors.length} members
              </Badge>
            )}
            
            {place.scheduled_date && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date(place.scheduled_date).toLocaleDateString()}
              </Badge>
            )}
          </div>
          
          {/* 貢献者詳細（複数の場合） */}
          {isMultipleContributors && (
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs">
              <div className="font-medium mb-1">Contributors:</div>
              <div className="space-y-1">
                {contributors.map((contributor: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span>{contributor.display_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatDuration(contributor.stay_duration_minutes)}
                      </span>
                      <span className="text-muted-foreground">
                        ★{contributor.wish_level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  if (!activeTrip) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please select a trip first</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 検索セクション */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Place</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <GooglePlacesSearch 
            placeholder="Search for places to add..."
            onPlaceSelect={handlePlaceSelect}
            className="w-full"
          />
          
          <Button 
            onClick={handleAddPlace}
            disabled={!selectedPlace}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to My Places
          </Button>
        </CardContent>
      </Card>
      
      {/* タブ切り替え */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'trip' | 'my')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trip" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Trip Places ({places.length})
          </TabsTrigger>
          <TabsTrigger value="my" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            My Places ({myPlaces.length})
          </TabsTrigger>
        </TabsList>
        
        {/* フィルター */}
        <div className="flex items-center gap-2 mt-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'scheduled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('scheduled')}
              className={filterStatus === 'scheduled' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Scheduled
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
              className={filterStatus === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Pending
            </Button>
            <Button
              variant={filterStatus === 'unscheduled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('unscheduled')}
            >
              <Circle className="h-3 w-3 mr-1" />
              Unscheduled
            </Button>
          </div>
        </div>
        
        <TabsContent value="trip" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filteredPlaces(places).length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-muted-foreground">
                {filterStatus === 'all' 
                  ? 'No places added to the trip yet' 
                  : `No ${filterStatus} places`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlaces(places).map(renderPlaceCard)}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="my" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filteredPlaces(myPlaces).length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-muted-foreground">
                {filterStatus === 'all' 
                  ? 'You haven\'t added any places yet' 
                  : `No ${filterStatus} places in your list`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlaces(myPlaces).map(renderPlaceCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}