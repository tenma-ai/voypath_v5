'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Settings,
  Users,
  Clock,
  MapPin,
  TrendingUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useTrip } from '@/lib/contexts/trip-context';
import { useToast } from "@/hooks/use-toast";
import { optimizeTripRoute } from '@/lib/actions/optimization-actions';
import { InteractiveListView } from './interactive-list-view';
import { CollaborationTracker } from './collaboration-tracker';
import { OptimizationSuggestions } from './optimization-suggestions';
import MapView from './map-view';
import CalendarView from './calendar-view';
import type { 
  InteractiveListItem,
  EditingPermissions,
  UserContext,
  CollaborativeChange,
  OptimizationSuggestion,
  GroupSettings
} from '@/lib/types/interactive-list';
import { 
  calculateUserPermissions,
  generateOptimizationSuggestions
} from '@/lib/utils/interactive-list-utils';

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
  visitOrder?: number;
  isExcluded?: boolean;
  interestedUsers?: Array<{
    userId: string;
    userName: string;
    userColor: string;
    rating: number;
    requestedTime: number;
  }>;
}

const MOCK_USER_CONTEXT: UserContext = {
  id: 'current-user',
  sessionId: 'session-123',
  displayName: 'You',
  assignedColor: '#3B82F6',
  role: 'admin',
  isCreator: true
};

const MOCK_GROUP_SETTINGS: GroupSettings = {
  allowOrderChange: 'all',
  allowDestinationAdd: 'all',
  allowTimeAdjust: 'all',
  collaborativeEditing: true,
  requireApproval: false
};

export function EnhancedTripPlacesManager() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'interactive' | 'map' | 'calendar' | 'collaboration'>('interactive');
  const [collaborativeChanges, setCollaborativeChanges] = useState<CollaborativeChange[]>([]);
  const [activeEditors, setActiveEditors] = useState<any[]>([]);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const [enableCollaboration, setEnableCollaboration] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedResults, setOptimizedResults] = useState<any>(null);
  
  const { sessionId } = useGuestStore();
  const { activeTrip } = useTrip();
  const { toast } = useToast();
  
  // Convert places to interactive list items
  const convertToInteractiveItems = useCallback((places: Place[]): InteractiveListItem[] => {
    return places.map((place, index) => ({
      id: place.id,
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      coordinates: { lat: place.latitude, lng: place.longitude },
      allocatedTime: place.preferredDuration,
      visitOrder: place.visitOrder || index + 1,
      isExcluded: place.isExcluded || false,
      interestedUsers: place.interestedUsers?.map(user => ({
        ...user,
        priority: (user as any).priority || (user.rating >= 4 ? 'high' : user.rating >= 3 ? 'medium' : 'low')
      })) || [{
        userId: MOCK_USER_CONTEXT.id,
        userName: MOCK_USER_CONTEXT.displayName,
        userColor: MOCK_USER_CONTEXT.assignedColor,
        rating: place.preferenceScore,
        requestedTime: place.preferredDuration,
        priority: place.preferenceScore >= 4 ? 'high' : place.preferenceScore >= 3 ? 'medium' : 'low'
      }],
      originalPreferences: {
        users: [{
          userId: MOCK_USER_CONTEXT.id,
          userName: MOCK_USER_CONTEXT.displayName,
          userColor: MOCK_USER_CONTEXT.assignedColor,
          rating: place.preferenceScore,
          requestedTime: place.preferredDuration,
          priority: place.preferenceScore >= 4 ? 'high' : place.preferenceScore >= 3 ? 'medium' : 'low'
        }],
        calculation: {
          method: 'average',
          reasoning: 'Single user preference',
          originalTotal: place.preferredDuration,
          compromiseRatio: 1
        },
        alternativeAllocations: [
          Math.round(place.preferredDuration * 0.75),
          place.preferredDuration,
          Math.round(place.preferredDuration * 1.25)
        ]
      },
      satisfactionScore: place.preferenceScore / 5,
      transportToNext: place.visitOrder ? {
        mode: 'driving',
        duration: 30,
        distance: 15000,
        cost: 0
      } : undefined,
      notes: place.notes ? [place.notes] : [],
      tags: place.isPersonalFavorite ? ['favorite'] : [],
      isBeingEdited: false
    }));
  }, []);

  // Mock data for demonstration
  useEffect(() => {
    const fetchPlaces = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock places data
      const mockPlaces: Place[] = [
        {
          id: '1',
          destinationId: 'dest-1',
          name: 'Tokyo Skytree',
          address: '1-1-2 Oshiage, Sumida City, Tokyo, Japan',
          latitude: 35.7101,
          longitude: 139.8107,
          placeId: 'place-1',
          preferenceScore: 5,
          preferredDuration: 180,
          notes: 'Amazing views, go at sunset!',
          isPersonalFavorite: true,
          visitOrder: 1,
          interestedUsers: [{
            userId: 'user-1',
            userName: 'Alice',
            userColor: '#EF4444',
            rating: 5,
            requestedTime: 180
          }, {
            userId: 'user-2',
            userName: 'Bob',
            userColor: '#10B981',
            rating: 4,
            requestedTime: 120
          }]
        },
        {
          id: '2',
          destinationId: 'dest-2',
          name: 'Senso-ji Temple',
          address: '2-3-1 Asakusa, Taito City, Tokyo, Japan',
          latitude: 35.7148,
          longitude: 139.7967,
          placeId: 'place-2',
          preferenceScore: 4,
          preferredDuration: 120,
          notes: 'Historic temple, early morning visit recommended',
          isPersonalFavorite: false,
          visitOrder: 2,
          interestedUsers: [{
            userId: 'user-1',
            userName: 'Alice',
            userColor: '#EF4444',
            rating: 4,
            requestedTime: 90
          }, {
            userId: 'user-3',
            userName: 'Charlie',
            userColor: '#8B5CF6',
            rating: 5,
            requestedTime: 150
          }]
        },
        {
          id: '3',
          destinationId: 'dest-3',
          name: 'Shibuya Crossing',
          address: 'Shibuya City, Tokyo, Japan',
          latitude: 35.6598,
          longitude: 139.7006,
          placeId: 'place-3',
          preferenceScore: 3,
          preferredDuration: 60,
          notes: 'Famous intersection, good for photos',
          isPersonalFavorite: false,
          visitOrder: 3,
          isExcluded: false,
          interestedUsers: [{
            userId: 'user-2',
            userName: 'Bob',
            userColor: '#10B981',
            rating: 3,
            requestedTime: 60
          }]
        }
      ];
      
      setPlaces(mockPlaces);
      
      // Generate optimization suggestions
      const items = convertToInteractiveItems(mockPlaces);
      const suggestions = generateOptimizationSuggestions(items);
      setOptimizationSuggestions(suggestions);
      
      setIsLoading(false);
    };
    
    fetchPlaces();
  }, [convertToInteractiveItems]);

  // Calculate permissions for current user
  const permissions = calculateUserPermissions(MOCK_USER_CONTEXT, MOCK_GROUP_SETTINGS);

  // Handle reordering
  const handleReorder = (oldIndex: number, newIndex: number) => {
    const newPlaces = [...places];
    const [movedPlace] = newPlaces.splice(oldIndex, 1);
    newPlaces.splice(newIndex, 0, movedPlace);
    
    // Update visit orders
    const updatedPlaces = newPlaces.map((place, index) => ({
      ...place,
      visitOrder: index + 1
    }));
    
    setPlaces(updatedPlaces);
    
    // Create a collaborative change record
    const change: CollaborativeChange = {
      id: `change-${Date.now()}`,
      userId: MOCK_USER_CONTEXT.id,
      userName: MOCK_USER_CONTEXT.displayName,
      changeType: 'reorder',
      destinationId: movedPlace.id,
      oldValue: oldIndex,
      newValue: newIndex,
      timestamp: new Date(),
      impact: {
        usersAffected: [MOCK_USER_CONTEXT.id],
        satisfactionChange: 0,
        scheduleChange: 0
      },
      status: 'applied'
    };
    
    setCollaborativeChanges(prev => [change, ...prev]);
    
    toast({
      title: "Reordered",
      description: `Moved ${movedPlace.name} to position ${newIndex + 1}`,
    });
  };

  // Handle time adjustment
  const handleTimeAdjust = (itemId: string, newTime: number) => {
    const place = places.find(p => p.id === itemId);
    if (!place) return;

    const oldTime = place.preferredDuration;
    
    setPlaces(prev => prev.map(p => 
      p.id === itemId ? { ...p, preferredDuration: newTime } : p
    ));

    // Create a collaborative change record
    const change: CollaborativeChange = {
      id: `change-${Date.now()}`,
      userId: MOCK_USER_CONTEXT.id,
      userName: MOCK_USER_CONTEXT.displayName,
      changeType: 'time_adjust',
      destinationId: itemId,
      oldValue: oldTime,
      newValue: newTime,
      timestamp: new Date(),
      impact: {
        usersAffected: [MOCK_USER_CONTEXT.id],
        satisfactionChange: 0.1,
        scheduleChange: newTime - oldTime
      },
      status: 'applied'
    };
    
    setCollaborativeChanges(prev => [change, ...prev]);
    
    toast({
      title: "Time Updated",
      description: `Changed ${place.name} duration to ${Math.round(newTime / 60)}h`,
    });
  };

  // Handle exclude/include
  const handleExclude = (itemId: string, reason?: string) => {
    const place = places.find(p => p.id === itemId);
    if (!place) return;

    setPlaces(prev => prev.map(p => 
      p.id === itemId ? { ...p, isExcluded: true } : p
    ));

    // Create a collaborative change record
    const change: CollaborativeChange = {
      id: `change-${Date.now()}`,
      userId: MOCK_USER_CONTEXT.id,
      userName: MOCK_USER_CONTEXT.displayName,
      changeType: 'exclude',
      destinationId: itemId,
      oldValue: false,
      newValue: true,
      timestamp: new Date(),
      reasoning: reason,
      impact: {
        usersAffected: place.interestedUsers?.map(u => u.userId) || [],
        satisfactionChange: -0.2,
        scheduleChange: -place.preferredDuration
      },
      status: 'applied'
    };
    
    setCollaborativeChanges(prev => [change, ...prev]);
    
    toast({
      title: "Excluded",
      description: `${place.name} excluded from itinerary`,
    });
  };

  const handleInclude = (itemId: string) => {
    const place = places.find(p => p.id === itemId);
    if (!place) return;

    setPlaces(prev => prev.map(p => 
      p.id === itemId ? { ...p, isExcluded: false } : p
    ));

    // Create a collaborative change record
    const change: CollaborativeChange = {
      id: `change-${Date.now()}`,
      userId: MOCK_USER_CONTEXT.id,
      userName: MOCK_USER_CONTEXT.displayName,
      changeType: 'include',
      destinationId: itemId,
      oldValue: true,
      newValue: false,
      timestamp: new Date(),
      impact: {
        usersAffected: place.interestedUsers?.map(u => u.userId) || [],
        satisfactionChange: 0.2,
        scheduleChange: place.preferredDuration
      },
      status: 'applied'
    };
    
    setCollaborativeChanges(prev => [change, ...prev]);
    
    toast({
      title: "Included",
      description: `${place.name} included in itinerary`,
    });
  };

  // Handle optimization execution
  const handleGenerateOptimization = async () => {
    if (!activeTrip || !sessionId) {
      toast({
        title: "Error",
        description: "No active trip found",
        variant: "destructive",
      });
      return;
    }

    const eligiblePlaces = places.filter(p => !p.isExcluded);
    if (eligiblePlaces.length < 2) {
      toast({
        title: "Not enough places",
        description: "Add at least 2 places to generate an optimized plan",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);

    try {
      const userContext = {
        id: null, // Guest user
        sessionId: sessionId,
        isGuest: true
      };

      const result = await optimizeTripRoute(activeTrip.id, userContext);

      if (result.status === 'success' && result.data) {
        setOptimizedResults(result.data);
        
        // Update places with optimization results if available
        if (result.data.multiDaySchedule?.days) {
          const allDestinations = result.data.multiDaySchedule.days.flatMap(day => day.destinations);
          setPlaces(prev => prev.map(place => {
            const optimizedPlace = allDestinations.find(od => od.destinationId === place.destinationId);
            if (optimizedPlace) {
              return {
                ...place,
                visitOrder: optimizedPlace.visitOrder,
                preferredDuration: optimizedPlace.allocatedDuration,
                isExcluded: false
              };
            }
            return { ...place, isExcluded: true }; // Exclude places not in optimization
          }));
        }

        toast({
          title: "Optimization Complete",
          description: `Generated optimized plan with ${result.data.multiDaySchedule?.days?.reduce((total, day) => total + day.destinations.length, 0) || eligiblePlaces.length} destinations`,
        });

        // Generate new optimization suggestions based on results
        const newSuggestions = generateOptimizationSuggestions(convertToInteractiveItems(places));
        setOptimizationSuggestions(newSuggestions);

      } else {
        throw new Error(result.error?.userMessage || result.error?.message || 'Optimization failed');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      toast({
        title: "Optimization Failed",
        description: "Unable to generate optimized plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Handle suggestion application
  const handleApplySuggestion = (suggestionId: string) => {
    const suggestion = optimizationSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    // Apply suggestion logic would go here
    toast({
      title: "Suggestion Applied",
      description: suggestion.title,
    });

    // Remove applied suggestion
    setOptimizationSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  // Handle bulk operations
  const handleBulkOperation = (operation: string, itemIds: string[]) => {
    switch (operation) {
      case 'exclude_multiple':
        setPlaces(prev => prev.map(p => 
          itemIds.includes(p.id) ? { ...p, isExcluded: true } : p
        ));
        toast({
          title: "Bulk Exclude",
          description: `Excluded ${itemIds.length} destinations`,
        });
        break;
      case 'include_multiple':
        setPlaces(prev => prev.map(p => 
          itemIds.includes(p.id) ? { ...p, isExcluded: false } : p
        ));
        toast({
          title: "Bulk Include",
          description: `Included ${itemIds.length} destinations`,
        });
        break;
    }
  };

  // Convert optimized results to calendar segments
  const createCalendarSegments = (multiDaySchedule: any) => {
    const segments: any[] = [];
    
    if (!multiDaySchedule?.days) return segments;
    
    multiDaySchedule.days.forEach((day: any, dayIndex: number) => {
      const dayDate = activeTrip?.start_date ? 
        new Date(new Date(activeTrip.start_date).getTime() + dayIndex * 24 * 60 * 60 * 1000) : 
        new Date();
      
      day.destinations.forEach((dest: any, destIndex: number) => {
        const place = places.find(p => p.destinationId === dest.destinationId);
        if (place) {
          // Calculate time based on visit order and allocated duration
          const startHour = 9 + destIndex * 3; // Simple calculation: 3 hours per destination
          const endHour = startHour + Math.round(dest.allocatedDuration / 60);
          
          segments.push({
            id: `seg-${dayIndex}-${destIndex}`,
            date: dayDate.toISOString().split('T')[0],
            startTime: `${startHour.toString().padStart(2, '0')}:00`,
            endTime: `${endHour.toString().padStart(2, '0')}:00`,
            type: 'destination',
            destination: {
              destinationId: dest.destinationId,
              destinationName: place.name,
              location: {
                latitude: place.latitude,
                longitude: place.longitude,
                address: place.address
              },
              visitOrder: dest.visitOrder,
              wishfulUsers: place.interestedUsers?.map(user => ({
                member: {
                  user_id: user.userId,
                  display_name: user.userName
                },
                originalRating: user.rating,
                assignedColor: user.userColor
              })) || []
            }
          });
        }
      });
    });
    
    return segments;
  };

  const interactiveItems = convertToInteractiveItems(places);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-2 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-gray-500">Loading interactive list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Trip Planning</h2>
          <p className="text-muted-foreground">
            Drag and drop to reorder, adjust times, and collaborate in real-time
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" />
              {places.filter(p => !p.isExcluded).length} destinations
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {Math.round(places.filter(p => !p.isExcluded).reduce((sum, p) => sum + p.preferredDuration, 0) / 60)}h total
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {new Set(places.flatMap(p => p.interestedUsers?.map(u => u.userId) || [])).size} users
            </Badge>
          </div>
          
          {/* Settings */}
          <div className="flex items-center gap-2">
            {/* Generate Optimization Button */}
            {places.filter(p => !p.isExcluded).length >= 2 && (
              <Button 
                onClick={handleGenerateOptimization}
                disabled={isOptimizing}
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Generate Plan
                  </>
                )}
              </Button>
            )}
            
            <div className="flex items-center space-x-2">
              <Switch
                id="collaboration"
                checked={enableCollaboration}
                onCheckedChange={setEnableCollaboration}
              />
              <Label htmlFor="collaboration" className="text-sm">
                Collaboration
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {optimizationSuggestions.filter(s => s.priority === 'high').length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <h3 className="font-medium text-amber-900 dark:text-amber-100">
              Optimization Suggestions Available
            </h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
            We found {optimizationSuggestions.filter(s => s.priority === 'high').length} high-priority suggestions to improve your itinerary.
          </p>
        </div>
      )}

      {collaborativeChanges.filter(c => c.status === 'conflicted').length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-medium text-red-900 dark:text-red-100">
              Conflicts Need Resolution
            </h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-200 mt-1">
            There are {collaborativeChanges.filter(c => c.status === 'conflicted').length} conflicting changes that need your attention.
          </p>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="interactive" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Interactive List
          </TabsTrigger>
          <TabsTrigger value="map">
            <MapPin className="h-4 w-4 mr-2" />
            Map View
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Clock className="h-4 w-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="collaboration" className="gap-2">
            <Users className="h-4 w-4" />
            Collaboration
            {collaborativeChanges.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 text-xs">
                {collaborativeChanges.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interactive" className="mt-6">
          <InteractiveListView
            items={interactiveItems}
            userContext={MOCK_USER_CONTEXT}
            groupSettings={MOCK_GROUP_SETTINGS}
            onReorder={handleReorder}
            onTimeAdjust={handleTimeAdjust}
            onExclude={handleExclude}
            onInclude={handleInclude}
            onApplySuggestion={handleApplySuggestion}
            onBulkOperation={handleBulkOperation}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <div className="h-[600px] rounded-lg overflow-hidden">
            <MapView 
              places={places}
              optimizedResults={optimizedResults}
              center={places.length > 0 ? 
                { lat: places[0].latitude, lng: places[0].longitude } : 
                undefined
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView 
            routeSegments={optimizedResults?.multiDaySchedule ? 
              createCalendarSegments(optimizedResults.multiDaySchedule) : 
              []
            }
            tripStartDate={activeTrip?.start_date ? new Date(activeTrip.start_date) : undefined}
            tripEndDate={activeTrip?.end_date ? new Date(activeTrip.end_date) : undefined}
          />
        </TabsContent>

        <TabsContent value="collaboration" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollaborationTracker
              changes={collaborativeChanges}
              currentUser={MOCK_USER_CONTEXT}
              activeEditors={activeEditors}
            />
            
            <OptimizationSuggestions
              items={convertToInteractiveItems(places)}
              suggestions={optimizationSuggestions}
              canApply={true}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}