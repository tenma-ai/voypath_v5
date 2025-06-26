'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Slider 
} from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Search, 
  Star, 
  Clock, 
  Edit, 
  Trash2, 
  Plus, 
  Loader2, 
  Heart, 
  ThumbsUp, 
  ThumbsDown,
  CalendarDays,
  CalendarIcon
} from 'lucide-react';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useTrip } from '@/lib/contexts/trip-context';
import GooglePlacesSearch from './google-places-search';
import MapView from './map-view';
import { 
  updatePlacePreference, 
  deletePlaceFromTrip, 
  getPlacesForTrip 
} from '@/lib/actions/place-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { format, addDays, eachDayOfInterval, startOfWeek, endOfWeek, isToday, isSameMonth, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface Place {
  id: string;
  destinationId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
  preferenceScore: number;
  preferredDuration: number;
  notes: string;
  isPersonalFavorite: boolean;
}

interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Interface for map component's place parameter
interface MapPlace {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
}

export function TripPlacesManager() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'calendar'>('list');
  const [placeToDelete, setPlaceToDelete] = useState<string | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddButton, setShowAddButton] = useState(false);
  
  // Predefined duration values in minutes
  const durationOptions = [
    15,    // 15 minutes
    30,    // 30 minutes
    60,    // 1 hour
    120,   // 2 hours
    360,   // 6 hours
    720,   // 12 hours
    1440,  // 1 day
    2880,  // 2 days
    4320,  // 3 days
    5760,  // 4 days
    7200,  // 5 days
    8640,  // 6 days
    10080  // 7 days
  ];
  
  const { sessionId } = useGuestStore();
  const { activeTrip } = useTrip();
  const { toast } = useToast();
  const router = useRouter();
  
  // Fetch places
  useEffect(() => {
    const fetchPlaces = async () => {
      if (!activeTrip || !sessionId) return;
      
      setIsLoading(true);
      
      try {
        const result = await getPlacesForTrip(activeTrip.id, sessionId);
        setPlaces(result.places);
      } catch (error) {
        console.error('Error fetching places:', error);
        toast({
          title: "Error",
          description: "Failed to fetch destinations",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPlaces();
  }, [activeTrip, sessionId, toast]);
  
  // Handle place selection from search
  const handlePlaceSelect = (place: SearchResult) => {
    console.log('Place selected:', place);
    setSelectedPlace({
      id: place.place_id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.place_id,
      preferenceScore: 3,
      preferredDuration: 60,
      notes: '',
      isPersonalFavorite: false,
      destinationId: ''
    });
    setShowAddButton(true);
  };
  
  // Handle place selection from map
  const handleMapPlaceSelect = (place: MapPlace) => {
    const searchPlace: SearchResult = {
      place_id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.location.lat,
      longitude: place.location.lng
    };
    handlePlaceSelect(searchPlace);
  };
  
  // Handle Add button click
  const handleAddButtonClick = () => {
    if (!selectedPlace || !activeTrip) return;
    
    // Navigate to add place form with context - adding to personal wishlist
    const returnPath = encodeURIComponent('/my-trip');
    
    // Build URL parameters
    const params = new URLSearchParams();
    params.append('placeId', selectedPlace.placeId);
    params.append('groupId', activeTrip.id);
    params.append('name', selectedPlace.name);
    params.append('address', selectedPlace.address);
    params.append('latitude', selectedPlace.latitude.toString());
    params.append('longitude', selectedPlace.longitude.toString());
    params.append('returnPath', returnPath);
    
    let url = `/my-trip/my-places/add?${params.toString()}`;
    
    // If in calendar view, add the selected date as preferred date
    if (viewMode === 'calendar' && selectedDate) {
      url += `&date=${format(selectedDate, 'yyyy-MM-dd')}`;
    }
    
    router.push(url);
  };
  
  // Update place
  const handleUpdatePlace = async () => {
    if (!editingPlace) return;
    
    try {
      await updatePlacePreference({
        id: editingPlace.id,
        preferredDuration: editingPlace.preferredDuration,
        notes: editingPlace.notes,
        preferenceScore: editingPlace.preferenceScore,
        isPersonalFavorite: editingPlace.isPersonalFavorite,
      });
      
      // Update local places list
      setPlaces(places.map(p => 
        p.id === editingPlace.id ? editingPlace : p
      ));
      
      toast({
        title: "Updated",
        description: "Place preferences updated successfully",
      });
      
      // Close edit dialog
      setIsEditDialogOpen(false);
      setEditingPlace(null);
    } catch (error) {
      console.error('Error updating place:', error);
      toast({
        title: "Error",
        description: "Failed to update place",
        variant: "destructive",
      });
    }
  };
  
  // Delete place
  const handleDeletePlace = async () => {
    if (!placeToDelete) return;
    
    try {
      await deletePlaceFromTrip(placeToDelete);
      
      // Remove from local state
      setPlaces(places.filter(p => p.id !== placeToDelete));
      
      toast({
        title: "Deleted",
        description: "Place removed from trip",
      });
    } catch (error) {
      console.error('Error deleting place:', error);
      toast({
        title: "Error",
        description: "Failed to remove place",
        variant: "destructive",
      });
    } finally {
      setPlaceToDelete(null);
    }
  };
  
  // Get preference label
  const getPreferenceLabel = (score: number): string => {
    switch (score) {
      case 1: return 'Not interested';
      case 2: return 'Slightly interested';
      case 3: return 'Interested';
      case 4: return 'Very interested';
      case 5: return 'Must visit';
      default: return 'Interested';
    }
  };
  
  // Get preference icon
  const getPreferenceIcon = (score: number) => {
    if (score <= 2) return <ThumbsDown className="h-4 w-4 text-red-500" />;
    if (score >= 4) return <ThumbsUp className="h-4 w-4 text-green-500" />;
    return <Star className="h-4 w-4 text-amber-500" />;
  };
  
  // Format duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours > 0) {
        return `${days} ${days === 1 ? 'day' : 'days'} ${remainingHours}h`;
      } else {
        return `${days} ${days === 1 ? 'day' : 'days'}`;
      }
    }
  };
  
  // Map slider value to duration
  const handleDurationChange = (values: number[]) => {
    const sliderValue = values[0];
    const selectedDuration = durationOptions[sliderValue];
    if (editingPlace) {
      setEditingPlace({...editingPlace, preferredDuration: selectedDuration});
    }
  };

  // Find closest duration option index for the current value
  const getCurrentSliderValue = (duration: number) => {
    // Find the index of the current duration or the closest one
    const index = durationOptions.findIndex(d => d >= duration);
    if (index === -1) return durationOptions.length - 1; // If larger than max, return the last option
    if (durationOptions[index] === duration) return index;
    
    // If between two values, choose the closest one
    if (index > 0) {
      const prevDiff = duration - durationOptions[index - 1];
      const nextDiff = durationOptions[index] - duration;
      return prevDiff < nextDiff ? index - 1 : index;
    }
    
    return index;
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }
  
  // Generate calendar days
  const days = eachDayOfInterval({
    start: startOfWeek(currentMonth),
    end: endOfWeek(addDays(endOfWeek(currentMonth), 28))
  });
  
  return (
    <div className="space-y-4">
      <Tabs defaultValue="list" onValueChange={(value) => {
        setViewMode(value as 'list' | 'map' | 'calendar');
        setSelectedDate(null);
      }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="map">Map View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>
        
        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          {/* List view search box */}
          <Card className="bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
            <CardContent className="p-3">
              <GooglePlacesSearch
                placeholder="Search for places to add to your wishlist..."
                onPlaceSelect={handlePlaceSelect}
                size="medium"
              />
            </CardContent>
          </Card>
          
          {places.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-muted-foreground">No places added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Search and add places above</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {places.map((place) => (
                <Card key={place.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{place.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingPlace(place);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPlaceToDelete(place.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 items-center text-muted-foreground text-sm mb-2">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{place.address}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3">
                      <Badge variant="outline" className="flex gap-1 items-center">
                        {getPreferenceIcon(place.preferenceScore)}
                        {getPreferenceLabel(place.preferenceScore)}
                      </Badge>
                      <Badge variant="outline" className="flex gap-1 items-center">
                        <Clock className="h-4 w-4" />
                        {formatDuration(place.preferredDuration)}
                      </Badge>
                      {place.isPersonalFavorite && (
                        <Badge variant="outline" className="flex gap-1 items-center bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300">
                          <Heart className="h-4 w-4 text-pink-500" />
                          Favorite
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Map View */}
        <TabsContent value="map">
          {/* Map view search box */}
          <div className="absolute top-4 right-4 left-4 z-10 bg-white dark:bg-gray-800 p-3 rounded-lg shadow">
            <GooglePlacesSearch
              placeholder="Search for places to add to your wishlist..."
              onPlaceSelect={handlePlaceSelect}
              size="medium"
            />
          </div>
          
          <div className="h-[calc(100vh-16rem)]">
            <MapView 
              places={places} 
              center={
                places.length > 0
                  ? { lat: places[0].latitude, lng: places[0].longitude }
                  : undefined
              }
              onPlaceSelect={handleMapPlaceSelect}
            />
          </div>
        </TabsContent>
        
        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-lg flex items-center gap-1">
              <CalendarDays className="h-5 w-5 text-sky-500" /> 
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(prev => addDays(prev, -30))}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(prev => addDays(prev, 30))}
              >
                Next
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="h-8 flex items-center justify-center font-medium text-sm">
                {day}
              </div>
            ))}
            
            {days.slice(0, 42).map((day, i) => {
              // Get places for this day
              const dayPlaces = places.filter(place => {
                // Implement logic for displaying places on specific dates if needed
                return false;
              });
              
              return (
                <div
                  key={day.toString()}
                  className={cn(
                    "min-h-[100px] p-1 border rounded-md relative",
                    isToday(day) ? "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800" : "",
                    !isSameMonth(day, currentMonth) ? "opacity-50" : "",
                    selectedDate && isSameDay(day, selectedDate) ? "ring-2 ring-sky-500" : ""
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="text-right text-sm p-1">
                    {format(day, 'd')}
                  </div>
                  
                  {/* Add button in top-right corner */}
                  <button 
                    className="absolute top-1 right-1 w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center hover:bg-sky-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(day);
                      
                      // Navigate to add form with date pre-selected
                      const returnPath = encodeURIComponent('/my-trip');
                      const dateStr = format(day, 'yyyy-MM-dd');
                      router.push(`/my-places/add?date=${dateStr}&source=${returnPath}`);
                    }}
                    title="Add to Wishlist on this date"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  
                  {/* Day content - places that fall on this day */}
                  <div className="space-y-1">
                    {dayPlaces.map(place => (
                      <div 
                        key={place.id} 
                        className="text-xs bg-white dark:bg-gray-800 p-1 rounded truncate"
                      >
                        {place.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Place</DialogTitle>
          </DialogHeader>
          
          {editingPlace && (
            <div className="space-y-4 py-2">
              <div>
                <h3 className="font-medium mb-2">{editingPlace.name}</h3>
                <p className="text-sm text-muted-foreground">{editingPlace.address}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Interest Level
                  </label>
                  <span className="text-sm font-medium">
                    {getPreferenceLabel(editingPlace.preferenceScore)}
                  </span>
                </div>
                
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[editingPlace.preferenceScore]}
                  onValueChange={(values) => 
                    setEditingPlace({...editingPlace, preferenceScore: values[0]})
                  }
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Not interested</span>
                  <span>Must visit</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-sky-500" />
                    Visit Duration
                  </label>
                  <span className="text-sm font-medium">
                    {formatDuration(editingPlace.preferredDuration)}
                  </span>
                </div>
                
                <Slider
                  min={0}
                  max={durationOptions.length - 1}
                  step={1}
                  value={[getCurrentSliderValue(editingPlace.preferredDuration)]}
                  onValueChange={handleDurationChange}
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>15 minutes</span>
                  <span>7 days</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this place..."
                  value={editingPlace.notes}
                  onChange={(e) => 
                    setEditingPlace({...editingPlace, notes: e.target.value})
                  }
                  rows={3}
                />
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Heart className={`h-5 w-5 ${editingPlace.isPersonalFavorite ? 'text-pink-500 fill-pink-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium">Mark as Favorite</p>
                    <p className="text-sm text-muted-foreground">
                      Favorite places are prioritized in planning
                    </p>
                  </div>
                </div>
                <Button
                  variant={editingPlace.isPersonalFavorite ? "default" : "outline"}
                  size="sm"
                  onClick={() => 
                    setEditingPlace({
                      ...editingPlace, 
                      isPersonalFavorite: !editingPlace.isPersonalFavorite
                    })
                  }
                >
                  {editingPlace.isPersonalFavorite ? "Favorite" : "Add to Favorites"}
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePlace} className="bg-sky-500 hover:bg-sky-600">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!placeToDelete} onOpenChange={() => setPlaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Place</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this place from your trip? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlace} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 