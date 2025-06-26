'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  MapPin, 
  Clock, 
  Star, 
  Heart, 
  ArrowLeft, 
  Loader2, 
  ThumbsUp, 
  ThumbsDown, 
  Edit, 
  Trash2,
  CalendarIcon,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrip } from '@/lib/contexts/trip-context';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useToast } from '@/hooks/use-toast';
import { getMyPlacesForTrip, updateMyPlace, deleteMyPlace } from '@/lib/actions/my-places-actions';
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
import { NoTripSelected } from '@/components/ui/no-trip-selected';
import GooglePlacesSearch from '@/components/places/google-places-search';
import { SearchResult, MyPlaceData } from '@/lib/types/places';
import { Slider } from '@/components/ui/slider';

// Place type definition
interface Place {
  id: string;
  name: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
  preferenceScore: number;
  preferredDuration: number;
  notes: string;
  isPersonalFavorite: boolean;
  preferredDate?: string;
  destinationId?: string; // Made optional since it's not used in the new flow
  // 🎯 Adoption status
  isAdopted?: boolean;
  adoptedDetails?: {
    visitOrder: number;
    scheduledDate: string | null;
    allocatedDuration: number;
  } | null;
}

export default function MyPlacesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addedPlaceId = searchParams.get('added'); // For highlighting newly added places
  const { activeTrip, navigateWithTrip } = useTrip();
  const { sessionId } = useGuestStore();
  const { toast } = useToast();

  // State
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [placeToDelete, setPlaceToDelete] = useState<string | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [adoptionFilter, setAdoptionFilter] = useState<'all' | 'adopted' | 'not-adopted'>('all');

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

  // Fetch user's places
  useEffect(() => {
    const fetchPlaces = async () => {
      if (!activeTrip || !sessionId) return;
      
      setIsLoading(true);
      
      try {
        console.log('🔍 Fetching places for:', { 
          tripId: activeTrip.id, 
          sessionId,
          hasActiveTrip: !!activeTrip,
          hasSessionId: !!sessionId
        });
        
        if (!activeTrip.id) {
          throw new Error('No active trip ID');
        }
        
        if (!sessionId) {
          throw new Error('No session ID available');
        }
        
        const result = await getMyPlacesForTrip(activeTrip.id, sessionId);
        console.log('🔍 Fetch result:', result);
        
        if (result.success) {
          setPlaces(result.places);
        } else {
          throw new Error('Failed to fetch places from server');
        }
      } catch (error) {
        console.error('Error fetching places:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message, error.stack);
        }
        
        // より具体的なエラーメッセージ
        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Error",
          description: `Failed to fetch your places: ${errorMessage}`,
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
    console.log('Selected place from search:', place);
    setSelectedPlace(place);
  };
  
  // Handle Add button click
  const handleAddButtonClick = () => {
    if (!selectedPlace || !activeTrip) {
      console.log('Missing required data:', { selectedPlace, activeTrip });
      return;
    }
    
    console.log('Adding place from my-places:', selectedPlace);
    
    // Build URL parameters
    const params = new URLSearchParams();
    params.append('placeId', selectedPlace.place_id);
    params.append('groupId', activeTrip.id);
    params.append('name', selectedPlace.name);
    params.append('address', selectedPlace.address);
    params.append('latitude', selectedPlace.latitude.toString());
    params.append('longitude', selectedPlace.longitude.toString());
    params.append('source', '/my-trip/my-places');
    
    console.log('Navigation params:', params.toString());
    router.push(`/my-trip/my-places/add?${params.toString()}`);
  };
  
  // Update place preferences
  const handleUpdatePlace = async () => {
    if (!editingPlace) return;
    
    try {
      await updateMyPlace({
        id: editingPlace.id,
        preferredDuration: editingPlace.preferredDuration,
        preferenceScore: editingPlace.preferenceScore,
        isPersonalFavorite: editingPlace.isPersonalFavorite,
        notes: editingPlace.notes,
        preferredDate: editingPlace.preferredDate
      });
      
      // Update local state
      setPlaces(places.map(p => 
        p.id === editingPlace.id ? editingPlace : p
      ));
      
      toast({
        title: "Updated",
        description: "Place preferences updated successfully",
      });
      
      // Close dialog
      setIsEditDialogOpen(false);
      setEditingPlace(null);
    } catch (error) {
      console.error('Error updating place:', error);
      toast({
        title: "Error",
        description: "Failed to update place preferences",
        variant: "destructive",
      });
    }
  };
  
  // Delete a place
  const handleDeletePlace = async () => {
    if (!placeToDelete) return;
    
    try {
      await deleteMyPlace(placeToDelete);
      
      // Remove from local state
      setPlaces(places.filter(p => p.id !== placeToDelete));
      
      toast({
        title: "Deleted",
        description: "Place removed from your wishlist",
      });
    } catch (error) {
      console.error('Error deleting place:', error);
      toast({
        title: "Error",
        description: "Failed to delete place",
        variant: "destructive",
      });
    } finally {
      setPlaceToDelete(null);
    }
  };
  
  
  // Format duration for display
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
    setEditingPlace({...editingPlace!, preferredDuration: selectedDuration});
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
    return score >= 4 
      ? <ThumbsUp className="h-4 w-4 text-green-500" /> 
      : score <= 2 
        ? <ThumbsDown className="h-4 w-4 text-red-500" /> 
        : <Star className="h-4 w-4 text-amber-500" />;
  };
  
  // Handle back to trip page
  const handleBackToTrip = () => {
    navigateWithTrip('/my-trip');
  };
  
  // Handle add new place click
  const handleAddNewPlace = () => {
    router.push('/my-trip/my-places/add');
  };
  
  return (
    <div className="container pb-20 pt-4">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={handleBackToTrip}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">My Wishlist</h1>
          {activeTrip && (
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-muted-foreground">Trip: {activeTrip.name}</p>
              {/* 🎯 Adoption Summary */}
              {places.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300">
                    ✓ {places.filter(p => p.isAdopted).length} Adopted
                  </Badge>
                  <Badge variant="outline" className="bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
                    ○ {places.filter(p => !p.isAdopted).length} Not adopted
                  </Badge>
                  <span className="text-muted-foreground">
                    (Total {places.length} places)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {!activeTrip ? (
        <NoTripSelected 
          title="No trip selected" 
          message="Please select, create, or join a trip to manage your places wishlist"
        />
      ) : (
        <div>
          {/* Search and Add Section */}
          <Card className="mb-6 bg-gray-50 dark:bg-gray-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add Place to Wishlist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <GooglePlacesSearch 
                  placeholder="Search for places to add to your wishlist..."
                  onPlaceSelect={handlePlaceSelect}
                  size="medium"
                  className="w-full"
                  noResultsText="No places found"
                />
                
                <Button 
                  onClick={handleAddButtonClick} 
                  disabled={!selectedPlace}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Wishlist
                </Button>
                
                {!selectedPlace && (
                  <p className="text-sm text-center text-muted-foreground">
                    Search for places you'd like to visit during your trip
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Places List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Places</h2>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAddNewPlace}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>
            
            {/* 🎯 Filter Controls */}
            {places.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">Filter:</span>
                <Button
                  variant={adoptionFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdoptionFilter('all')}
                >
                  All ({places.length})
                </Button>
                <Button
                  variant={adoptionFilter === 'adopted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdoptionFilter('adopted')}
                  className={cn(
                    adoptionFilter === 'adopted' 
                      ? "bg-green-600 hover:bg-green-700 text-white border-green-700" 
                      : "bg-green-100 hover:bg-green-200 border-green-300 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:border-green-600 dark:text-green-300"
                  )}
                >
                  ✓ Adopted ({places.filter(p => p.isAdopted).length})
                </Button>
                <Button
                  variant={adoptionFilter === 'not-adopted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdoptionFilter('not-adopted')}
                  className={cn(
                    adoptionFilter === 'not-adopted' 
                      ? "bg-gray-600 hover:bg-gray-700 text-white border-gray-700" 
                      : "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  )}
                >
                  ○ Not adopted ({places.filter(p => !p.isAdopted).length})
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
              </div>
            ) : places.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  You haven't added any places to your wishlist yet
                </p>
                <Button onClick={handleAddNewPlace}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Place
                </Button>
              </div>
            ) : (
              (() => {
                // Filter places based on adoption status
                const filteredPlaces = places.filter(place => {
                  if (adoptionFilter === 'adopted') return place.isAdopted;
                  if (adoptionFilter === 'not-adopted') return !place.isAdopted;
                  return true; // 'all'
                });

                if (filteredPlaces.length === 0) {
                  const filterLabel = adoptionFilter === 'adopted' ? 'Adopted' : 
                                    adoptionFilter === 'not-adopted' ? 'Not adopted' : '';
                  return (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 text-center">
                      <p className="text-muted-foreground">
                        No {filterLabel.toLowerCase()} places found
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredPlaces.map((place) => (
                  <Card 
                    key={place.id} 
                    className={`border overflow-hidden transition-colors ${
                      addedPlaceId === place.id 
                        ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50" 
                        : place.isAdopted
                        ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50"
                        : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-lg">{place.name}</h3>
                              {/* 🎯 Adoption Status Badge */}
                              {place.isAdopted ? (
                                <Badge className="bg-green-600 hover:bg-green-700 text-white border-green-700 shadow-sm">
                                  ✓ Adopted
                                  {place.adoptedDetails?.visitOrder && ` (#${place.adoptedDetails.visitOrder})`}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-600 border-gray-400 bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-500">
                                  ○ Not adopted
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground mb-1">
                              <MapPin className="h-3 w-3 mr-1 shrink-0" />
                              <span className="truncate">{place.address}</span>
                            </div>
                            
                            {/* 🎯 Adopted Details */}
                            {place.isAdopted && place.adoptedDetails && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md mt-2 text-xs">
                                <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                                  Adopted in plan:
                                </div>
                                <div className="space-y-1 text-blue-700 dark:text-blue-300">
                                  <div>Visit order: #{place.adoptedDetails.visitOrder}</div>
                                  {place.adoptedDetails.scheduledDate && (
                                    <div>Scheduled date: {new Date(place.adoptedDetails.scheduledDate).toLocaleDateString()}</div>
                                  )}
                                  <div>Allocated time: {formatDuration(place.adoptedDetails.allocatedDuration)}</div>
                                  {place.adoptedDetails.allocatedDuration !== place.preferredDuration && (
                                    <div className="text-amber-600 dark:text-amber-400">
                                      (Requested: {formatDuration(place.preferredDuration)} → Adjusted)
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {place.isPersonalFavorite && (
                            <Heart className="h-5 w-5 text-pink-500 fill-pink-500 ml-2" />
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getPreferenceIcon(place.preferenceScore)}
                            {getPreferenceLabel(place.preferenceScore)}
                          </Badge>
                          
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(place.preferredDuration)}
                          </Badge>
                          
                          {place.preferredDate && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {new Date(place.preferredDate).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        
                        {place.notes && (
                          <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                            {place.notes}
                          </p>
                        )}
                        
                        <div className="flex justify-end gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setEditingPlace(place);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => setPlaceToDelete(place.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
      
      {/* Edit Place Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Place Preferences</DialogTitle>
          </DialogHeader>
          
          {editingPlace && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-medium">{editingPlace.name}</h3>
                <p className="text-sm text-muted-foreground">{editingPlace.address}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Interest Level</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    value={editingPlace.preferenceScore} 
                    onChange={(e) => setEditingPlace({
                      ...editingPlace, 
                      preferenceScore: parseInt(e.target.value)
                    })}
                    className="flex-1"
                  />
                  <span className="w-28 text-sm">
                    {getPreferenceLabel(editingPlace.preferenceScore)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Visit Duration (minutes)</label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{formatDuration(editingPlace.preferredDuration)}</span>
                </div>
                
                <Slider
                  min={0}
                  max={durationOptions.length - 1}
                  step={1}
                  value={[getCurrentSliderValue(editingPlace.preferredDuration)]}
                  onValueChange={handleDurationChange}
                />
                
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>15 minutes</span>
                  <span>7 days</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea 
                  value={editingPlace.notes || ''}
                  onChange={(e) => setEditingPlace({
                    ...editingPlace, 
                    notes: e.target.value
                  })}
                  placeholder="Optional notes about this place..."
                  className="resize-none"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Heart className={`h-5 w-5 ${editingPlace.isPersonalFavorite ? 'text-pink-500 fill-pink-500' : 'text-muted-foreground'}`} />
                  Mark as Favorite
                </label>
                <Switch 
                  checked={editingPlace.isPersonalFavorite}
                  onCheckedChange={(checked) => setEditingPlace({
                    ...editingPlace, 
                    isPersonalFavorite: checked
                  })}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdatePlace}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!placeToDelete} onOpenChange={(open) => !open && setPlaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this place from your wishlist?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlace}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 