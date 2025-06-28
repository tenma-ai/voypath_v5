'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  MapPin, 
  Clock, 
  Star, 
  Heart,
  CalendarIcon,
  Loader2,
  ArrowLeft,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { addPlaceToMyPlaces } from '@/lib/actions/my-places-actions';
import { useToast } from '@/hooks/use-toast';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useTrip } from '@/lib/contexts/trip-context';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SearchResult, MyPlaceData } from '@/lib/types/places';

interface AddPlaceFormProps {
  placeData?: SearchResult;
  onSuccess?: (placeId: string) => void;
  onError?: (message: string) => void;
  onCancel?: () => void;
  defaultDate?: Date;
  returnPath?: string;
  groupId?: string;
  tripId?: string;
}

export function AddPlaceForm({
  placeData,
  onSuccess,
  onError,
  onCancel,
  defaultDate,
  returnPath = '/my-places',
  groupId,
  tripId
}: AddPlaceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { sessionId } = useGuestStore();
  const { activeTrip } = useTrip();
  
  // Get query params
  const paramPlaceId = searchParams.get('placeId');
  const paramGroupId = searchParams.get('groupId');
  const paramDate = searchParams.get('date');
  const paramSource = searchParams.get('source');
  
  // Form state
  const [preferenceScore, setPreferenceScore] = useState(3);
  const [preferredDuration, setPreferredDuration] = useState(60); // minutes
  const [notes, setNotes] = useState('');
  const [isPersonalFavorite, setIsPersonalFavorite] = useState(false);
  
  // Initialize preferred date based on trip dates or provided date
  const getInitialDate = () => {
    if (defaultDate) return defaultDate;
    if (paramDate) return new Date(paramDate);
    // If trip has a start date, default to the first day of the trip
    if (activeTrip?.start_date) {
      return new Date(activeTrip.start_date);
    }
    return undefined;
  };
  
  const [preferredDate, setPreferredDate] = useState<Date | undefined>(getInitialDate());
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // When form is submitted
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!placeData || (!groupId && !activeTrip) || !sessionId) {
      const errorMsg = "Missing required data. Please try again.";
      console.error('Missing required data for form submission:', {
        placeData,
        groupId,
        activeTrip,
        sessionId
      });
      
      if (onError) {
        onError(errorMsg);
      } else {
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
      return;
    }
    
    setIsSubmitting(true);
    console.log('Submitting form with data:', {
      placeData,
      preferenceScore,
      preferredDuration,
      preferredDate,
      notes,
      isPersonalFavorite
    });
    
    try {
      // Prepare data for API call
      const myPlaceData: Partial<MyPlaceData> = {
        user_id: null, // Will be filled on server if authenticated
        session_id: sessionId,
        group_id: groupId || activeTrip!.id,
        place_id: placeData.place_id,
        name: placeData.name,
        address: placeData.address,
        latitude: placeData.latitude,
        longitude: placeData.longitude,
        preference_score: preferenceScore,
        preferred_duration: preferredDuration,
        preferred_date: preferredDate ? format(preferredDate, 'yyyy-MM-dd') : null,
        notes: notes || null,
        is_personal_favorite: isPersonalFavorite,
      };
      
      console.log('Sending to database:', myPlaceData);
      
      // Add place to my_places
      const result = await addPlaceToMyPlaces(myPlaceData);
      
      console.log('Database result:', result);
      
      // Show success toast with auto-integration message
      toast({
        title: "Place added",
        description: result.autoAddedToTrip 
          ? "✅ Added to your wishlist and automatically included in trip optimization"
          : "Added to your wishlist",
        variant: "default",
      });
      
      // Call success callback or navigate
      if (onSuccess && result.id) {
        onSuccess(result.id);
      } else {
        // Navigate back or to specified path
        if (paramSource) {
          router.back();
        } else {
          router.push(returnPath);
        }
      }
    } catch (error) {
      console.error('Error adding place:', error);
      const errorMsg = "Failed to add place. Please try again.";
      
      if (onError) {
        onError(errorMsg);
      } else {
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get label for preference score
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
  
  // Handle back button
  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };
  
  if (!placeData) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">No place data provided</p>
        <Button className="mt-4" onClick={handleBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container max-w-2xl mx-auto py-4 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Add to Wishlist</h1>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="bg-sky-500 hover:bg-sky-600"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Place Preview Card */}
        <Card className="p-4 border shadow-sm">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{placeData.name}</h2>
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="text-sm">{placeData.address}</span>
            </div>
            
            {/* Photos if available */}
            {placeData.photos && placeData.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {placeData.photos.map((photo, index) => (
                  <div key={index} className="aspect-square rounded-md overflow-hidden">
                    <img 
                      src={photo} 
                      alt={`${placeData.name} photo ${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Place types if available */}
            {placeData.types && placeData.types.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {placeData.types.slice(0, 3).map((type, index) => (
                  <span 
                    key={index} 
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-full"
                  >
                    {type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
        
        {/* Preference Score Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-base font-medium flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Interest Level
            </label>
            <span className="font-medium text-sm">
              {getPreferenceLabel(preferenceScore)}
            </span>
          </div>
          
          <div className="pt-2">
            <Slider
              min={1}
              max={5}
              step={1}
              value={[preferenceScore]}
              onValueChange={(values) => setPreferenceScore(values[0])}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Not interested</span>
              <span>Must visit</span>
            </div>
          </div>
        </div>
        
        {/* Stay Duration Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-base font-medium flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-500" />
              Visit Duration
            </label>
            <span className="font-medium text-sm">
              {formatDuration(preferredDuration)}
            </span>
          </div>
          
          <div className="pt-2">
            <Slider
              min={15}
              max={4320}
              step={15}
              value={[preferredDuration]}
              onValueChange={(values) => setPreferredDuration(values[0])}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>15 minutes</span>
              <span>3 days</span>
            </div>
          </div>
        </div>
        
        {/* Preferred Date (optional) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-base font-medium flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-violet-500" />
              Preferred Date (Optional)
            </label>
          </div>
          
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !preferredDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {preferredDate ? format(preferredDate, "PPP") : "Select preferred date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={preferredDate}
                onSelect={(date) => {
                  setPreferredDate(date);
                  setCalendarOpen(false);
                }}
                defaultMonth={activeTrip?.start_date ? new Date(activeTrip.start_date) : undefined}
                fromDate={activeTrip?.start_date ? new Date(activeTrip.start_date) : undefined}
                toDate={activeTrip?.end_date ? new Date(activeTrip.end_date) : undefined}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          {preferredDate && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setPreferredDate(undefined)} 
              className="text-xs"
            >
              Clear date
            </Button>
          )}
        </div>
        
        {/* Personal Favorite Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Heart className={cn(
              "h-5 w-5",
              isPersonalFavorite ? "text-pink-500 fill-pink-500" : "text-muted-foreground"
            )} />
            <div>
              <p className="font-medium">Mark as Favorite</p>
              <p className="text-sm text-muted-foreground">
                Favorite places are prioritized in planning
              </p>
            </div>
          </div>
          <Switch
            checked={isPersonalFavorite}
            onCheckedChange={setIsPersonalFavorite}
          />
        </div>
        
        {/* Notes */}
        <div className="space-y-2">
          <label className="text-base font-medium">Notes (Optional)</label>
          <Textarea
            placeholder="Add any notes about this place..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            These notes will be visible only to you and won't be shared with the group
          </p>
        </div>
        
        {/* Submit Button (Bottom) */}
        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full bg-sky-500 hover:bg-sky-600"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save to Wishlist
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            Adding to your wishlist does not guarantee inclusion in the final group itinerary.
            The optimization algorithm will consider all members' preferences.
          </p>
        </div>
      </form>
    </div>
  );
} 