/**
 * Detailed Schedule Service - Enhanced Phase 7 Implementation
 * Generates comprehensive timeline schedules from optimization results
 * TODO 119: ✅ Comprehensive schedule timeline generation
 * TODO 120: 🔄 Precise arrival/departure time calculations
 * TODO 121: ⏳ Schedule conflict detection and resolution
 * TODO 122: ⏳ Buffer time calculations between activities
 */

import { supabase } from '../lib/supabase';

export interface SchedulePlace {
  id: string;
  name: string;
  category: string;
  address?: string;
  latitude: number;
  longitude: number;
  arrivalTime: string;
  departureTime: string;
  stayDurationMinutes: number;
  wishLevel: number;
  normalizedWishLevel?: number;
  userId: string;
  userColor: string;
  userName: string;
}

export interface ScheduleTransportSegment {
  from: SchedulePlace;
  to: SchedulePlace;
  mode: 'walking' | 'public_transport' | 'car' | 'flight';
  duration: number; // minutes
  distance: number; // km
  departureTime: string;
  arrivalTime: string;
  cost?: number;
  details?: {
    route?: string;
    transfers?: number;
    airportProcedureTime?: number;
  };
}

export interface ScheduleMealBreak {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  startTime: string;
  endTime: string;
  duration: number; // minutes
  suggestedLocation: string;
  coordinates?: { latitude: number; longitude: number };
  note?: string;
}

export interface ScheduleBufferTime {
  bufferId: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  reason: 'travel_buffer' | 'rest_break' | 'unexpected_delay' | 'transition' | 'meal_buffer' | 'activity_buffer';
  description: string;
  adaptiveBuffer: boolean;
  confidenceScore: number;
  bufferFactors: {
    transport_mode?: number;
    time_of_day?: number;
    place_category?: number;
    weather?: number;
  };
}

export interface DailySchedule {
  date: string;
  dayNumber: number;
  places: SchedulePlace[];
  transports: ScheduleTransportSegment[];
  mealBreaks: ScheduleMealBreak[];
  bufferTimes: ScheduleBufferTime[];
  dailyStats: {
    totalPlaces: number;
    totalTravelTime: number; // minutes
    totalStayTime: number; // minutes
    totalDistance: number; // km
    earliestStart: string;
    latestEnd: string;
    estimatedCost: number;
  };
}

export interface ComprehensiveSchedule {
  tripId: string;
  tripName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailySchedules: DailySchedule[];
  overallStats: {
    totalPlaces: number;
    totalTravelTime: number; // minutes
    totalStayTime: number; // minutes
    totalDistance: number; // km
    totalEstimatedCost: number;
    averageEfficiencyScore: number;
    userFairnessScores: Record<string, number>;
  };
  metadata: {
    generatedAt: string;
    algorithmVersion: string;
    optimizationSettings: any;
    lastUpdated: string;
  };
}

export interface ScheduleConflict {
  conflictId: string;
  type: 'time_overlap' | 'travel_impossible' | 'venue_closed' | 'insufficient_time' | 'meal_timing' | 'buffer_insufficient';
  severity: 'critical' | 'warning' | 'minor';
  description: string;
  affectedItems: string[];
  suggestedResolution: string;
  autoResolvable: boolean;
  resolved: boolean;
  resolutionApplied?: string;
  detectedAt: string;
  priority: number;
}

export class DetailedScheduleService {
  private static instance: DetailedScheduleService;
  
  // Phase 7 Enhancement: Buffer configuration
  private static readonly DEFAULT_BUFFER_CONFIG = {
    minBufferMinutes: 5,
    maxBufferMinutes: 30,
    bufferFactors: {
      transport_mode: {
        'walking': 1.0,
        'public_transport': 1.2,
        'car': 1.1,
        'flight': 2.0
      },
      place_category: {
        'tourist_attraction': 1.2,
        'restaurant': 1.0,
        'museum': 1.1,
        'shopping': 1.3,
        'entertainment': 1.4,
        'other': 1.0
      },
      time_of_day: {
        'morning': 1.0,
        'lunch': 1.3,
        'afternoon': 1.1,
        'evening': 1.2,
        'night': 1.5
      },
      weather_consideration: 1.1
    },
    adaptive: true
  };
  
  static getInstance(): DetailedScheduleService {
    if (!this.instance) {
      this.instance = new DetailedScheduleService();
    }
    return this.instance;
  }

  /**
   * Generate comprehensive schedule from optimization results
   */
  async generateComprehensiveSchedule(
    tripId: string,
    optimizationResult?: any
  ): Promise<ComprehensiveSchedule> {
    try {
      // Fetch trip details
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('name, start_date, end_date')
        .eq('id', tripId)
        .single();

      if (tripError) {
        throw new Error(`Failed to fetch trip: ${tripError.message}`);
      }

      // Fetch selected places with user information
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select(`
          *,
          users(id, name, display_name),
          trip_members!inner(assigned_color_index, user_id)
        `)
        .eq('trip_id', tripId)
        .eq('is_selected_for_optimization', true)
        .order('selection_round');

      if (placesError) {
        throw new Error(`Failed to fetch places: ${placesError.message}`);
      }

      if (!placesData || placesData.length === 0) {
        throw new Error('No selected places found for schedule generation');
      }

      // Get member colors
      const memberColors = await this.getMemberColors(tripId);

      // If no optimization result provided, generate from constrained route
      let routeResult = optimizationResult;
      if (!routeResult) {
        routeResult = await this.callConstrainedRouteGeneration(tripId, placesData);
      }

      // Build comprehensive schedule
      const comprehensiveSchedule = await this.buildScheduleFromRoute(
        tripId,
        tripData,
        placesData,
        memberColors,
        routeResult
      );

      // Save schedule to database
      await this.saveScheduleToDatabase(comprehensiveSchedule);

      return comprehensiveSchedule;

    } catch (error) {
      console.error('Schedule generation error:', error);
      throw new Error(`Failed to generate schedule: ${error.message}`);
    }
  }

  /**
   * Get member color assignments
   */
  private async getMemberColors(tripId: string): Promise<Record<string, { hex: string; name: string }>> {
    try {
      const { data, error } = await supabase.functions.invoke('color-management', {
        body: { tripId }
      });

      if (error) {
        console.warn('Failed to fetch member colors:', error);
        return {};
      }

      const colorMap: Record<string, { hex: string; name: string }> = {};
      if (data?.success && data?.memberColors) {
        data.memberColors.forEach((assignment: any) => {
          colorMap[assignment.userId] = {
            hex: assignment.color.hex,
            name: assignment.color.name
          };
        });
      }

      return colorMap;
    } catch (error) {
      console.warn('Error fetching member colors:', error);
      return {};
    }
  }

  /**
   * Call constrained route generation if needed
   */
  private async callConstrainedRouteGeneration(tripId: string, places: any[]): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('constrained-route-generation', {
        body: {
          tripId,
          userId: 'system',
          places: places.map(p => ({
            id: p.id,
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            wish_level: p.wish_level,
            stay_duration_minutes: p.stay_duration_minutes,
            user_id: p.user_id,
            category: p.category
          })),
          departure: { name: 'Trip Start', lat: places[0]?.latitude, lng: places[0]?.longitude },
          destination: null,
          constraints: {
            maxDailyHours: 12,
            mealBreaks: {
              breakfast: { start: 8, duration: 60 },
              lunch: { start: 12, duration: 90 },
              dinner: { start: 18, duration: 120 }
            },
            transportModes: {
              walkingMaxKm: 2,
              carMinKm: 5,
              flightMinKm: 300
            }
          }
        }
      });

      if (error) {
        throw new Error(`Route generation failed: ${error.message}`);
      }

      return data?.result;
    } catch (error) {
      console.error('Route generation error:', error);
      // Return fallback simple schedule
      return this.generateFallbackRoute(places);
    }
  }

  /**
   * Build comprehensive schedule from route result
   */
  private async buildScheduleFromRoute(
    tripId: string,
    tripData: any,
    placesData: any[],
    memberColors: Record<string, any>,
    routeResult: any
  ): Promise<ComprehensiveSchedule> {
    const startDate = new Date(tripData.start_date);
    const endDate = new Date(tripData.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const dailySchedules: DailySchedule[] = [];
    let overallStats = {
      totalPlaces: 0,
      totalTravelTime: 0,
      totalStayTime: 0,
      totalDistance: 0,
      totalEstimatedCost: 0,
      averageEfficiencyScore: 0,
      userFairnessScores: {}
    };

    // Process each day from route result
    if (routeResult?.dailyRoutes) {
      for (let dayIndex = 0; dayIndex < routeResult.dailyRoutes.length; dayIndex++) {
        const dayRoute = routeResult.dailyRoutes[dayIndex];
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + dayIndex);

        const dailySchedule = await this.buildDailySchedule(
          dayRoute,
          currentDate,
          dayIndex + 1,
          placesData,
          memberColors
        );

        dailySchedules.push(dailySchedule);

        // Update overall stats
        overallStats.totalPlaces += dailySchedule.dailyStats.totalPlaces;
        overallStats.totalTravelTime += dailySchedule.dailyStats.totalTravelTime;
        overallStats.totalStayTime += dailySchedule.dailyStats.totalStayTime;
        overallStats.totalDistance += dailySchedule.dailyStats.totalDistance;
        overallStats.totalEstimatedCost += dailySchedule.dailyStats.estimatedCost;
      }
    }

    // Calculate average efficiency score
    overallStats.averageEfficiencyScore = routeResult?.optimizationScore?.efficiency || 0.8;
    overallStats.userFairnessScores = routeResult?.userFairnessScores || {};

    return {
      tripId,
      tripName: tripData.name,
      startDate: tripData.start_date,
      endDate: tripData.end_date,
      totalDays,
      dailySchedules,
      overallStats,
      metadata: {
        generatedAt: new Date().toISOString(),
        algorithmVersion: '2.0',
        optimizationSettings: routeResult?.metadata || {},
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Build daily schedule from day route
   */
  private async buildDailySchedule(
    dayRoute: any,
    date: Date,
    dayNumber: number,
    placesData: any[],
    memberColors: Record<string, any>
  ): Promise<DailySchedule> {
    const places: SchedulePlace[] = [];
    const transports: ScheduleTransportSegment[] = [];
    const mealBreaks: ScheduleMealBreak[] = [];
    const bufferTimes: ScheduleBufferTime[] = [];

    // Process places
    if (dayRoute.places) {
      for (let i = 0; i < dayRoute.places.length; i++) {
        const routePlace = dayRoute.places[i];
        const placeData = placesData.find(p => p.id === routePlace.id || p.name === routePlace.name);
        
        if (placeData) {
          const userColor = memberColors[placeData.user_id] || { hex: '#666666', name: 'Default' };
          
          const schedulePlace: SchedulePlace = {
            id: placeData.id,
            name: placeData.name,
            category: placeData.category || 'other',
            address: placeData.address,
            latitude: placeData.latitude,
            longitude: placeData.longitude,
            arrivalTime: routePlace.arrivalTime || this.calculateTimeSlot(i, 9 * 60), // 9 AM start
            departureTime: routePlace.departureTime || this.calculateTimeSlot(i, 9 * 60 + placeData.stay_duration_minutes),
            stayDurationMinutes: placeData.stay_duration_minutes,
            wishLevel: placeData.wish_level,
            normalizedWishLevel: placeData.normalized_wish_level,
            userId: placeData.user_id,
            userColor: userColor.hex,
            userName: placeData.users?.display_name || placeData.users?.name || 'Unknown User'
          };

          places.push(schedulePlace);

          // Add transport segment to next place
          if (i < dayRoute.places.length - 1) {
            const nextPlace = dayRoute.places[i + 1];
            const transport: ScheduleTransportSegment = {
              from: schedulePlace,
              to: {
                ...schedulePlace,
                name: nextPlace.name,
                arrivalTime: nextPlace.arrivalTime
              } as SchedulePlace,
              mode: routePlace.transportToNext || 'car',
              duration: routePlace.travelTimeMinutes || 30,
              distance: this.calculateDistance(
                placeData.latitude, placeData.longitude,
                nextPlace.latitude || placeData.latitude, nextPlace.longitude || placeData.longitude
              ),
              departureTime: schedulePlace.departureTime,
              arrivalTime: nextPlace.arrivalTime
            };

            transports.push(transport);
          }
        }
      }
    }

    // Process meal breaks
    if (dayRoute.mealBreaks) {
      dayRoute.mealBreaks.forEach((meal: any) => {
        mealBreaks.push({
          type: meal.type,
          startTime: meal.startTime,
          endTime: meal.endTime,
          duration: meal.duration,
          suggestedLocation: meal.suggestedLocation || `${meal.type} restaurant`
        });
      });
    }

    // Calculate daily stats
    const dailyStats = {
      totalPlaces: places.length,
      totalTravelTime: transports.reduce((sum, t) => sum + t.duration, 0),
      totalStayTime: places.reduce((sum, p) => sum + p.stayDurationMinutes, 0),
      totalDistance: transports.reduce((sum, t) => sum + t.distance, 0),
      earliestStart: places.length > 0 ? places[0].arrivalTime : '09:00',
      latestEnd: places.length > 0 ? places[places.length - 1].departureTime : '18:00',
      estimatedCost: this.calculateDailyCost(transports, mealBreaks)
    };

    return {
      date: date.toISOString().split('T')[0],
      dayNumber,
      places,
      transports,
      mealBreaks,
      bufferTimes,
      dailyStats
    };
  }

  /**
   * Calculate time slot for places
   */
  private calculateTimeSlot(index: number, baseMinutes: number): string {
    const totalMinutes = baseMinutes + (index * 180); // 3 hours per place average
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calculate estimated daily cost
   */
  private calculateDailyCost(transports: ScheduleTransportSegment[], meals: ScheduleMealBreak[]): number {
    let cost = 0;
    
    // Transport costs
    transports.forEach(transport => {
      switch (transport.mode) {
        case 'flight': cost += 15000; break;
        case 'car': cost += transport.distance * 50; break; // 50 yen per km
        case 'public_transport': cost += 500; break;
        case 'walking': cost += 0; break;
      }
    });

    // Meal costs
    meals.forEach(meal => {
      switch (meal.type) {
        case 'breakfast': cost += 1000; break;
        case 'lunch': cost += 1500; break;
        case 'dinner': cost += 3000; break;
        case 'snack': cost += 500; break;
      }
    });

    return cost;
  }

  /**
   * Generate fallback route when optimization fails
   */
  private generateFallbackRoute(places: any[]): any {
    return {
      dailyRoutes: [{
        places: places.slice(0, 5).map((place, index) => ({
          ...place,
          arrivalTime: this.calculateTimeSlot(index, 9 * 60),
          departureTime: this.calculateTimeSlot(index, 9 * 60 + place.stay_duration_minutes),
          transportToNext: index < 4 ? 'car' : null,
          travelTimeMinutes: 30
        })),
        mealBreaks: [
          { type: 'lunch', startTime: '12:00', endTime: '13:30', duration: 90, suggestedLocation: 'Local restaurant' }
        ]
      }],
      optimizationScore: { efficiency: 0.6 }
    };
  }

  /**
   * Save schedule to database
   */
  private async saveScheduleToDatabase(schedule: ComprehensiveSchedule): Promise<void> {
    try {
      // Save to optimization_results table
      const { error } = await supabase
        .from('optimization_results')
        .upsert({
          trip_id: schedule.tripId,
          optimized_route: schedule.dailySchedules,
          algorithm_version: schedule.metadata.algorithmVersion,
          execution_time_ms: 0,
          total_distance: schedule.overallStats.totalDistance,
          total_time_minutes: schedule.overallStats.totalTravelTime + schedule.overallStats.totalStayTime,
          fairness_score: schedule.overallStats.averageEfficiencyScore,
          metadata: {
            type: 'detailed_schedule',
            generated_at: schedule.metadata.generatedAt,
            total_days: schedule.totalDays,
            total_places: schedule.overallStats.totalPlaces
          }
        });

      if (error) {
        console.error('Failed to save schedule to database:', error);
      }
    } catch (error) {
      console.error('Database save error:', error);
    }
  }

  /**
   * Detect schedule conflicts
   */
  async detectScheduleConflicts(schedule: ComprehensiveSchedule): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    for (const dailySchedule of schedule.dailySchedules) {
      // Check for time overlaps
      for (let i = 0; i < dailySchedule.places.length - 1; i++) {
        const currentPlace = dailySchedule.places[i];
        const nextPlace = dailySchedule.places[i + 1];
        
        if (currentPlace.departureTime >= nextPlace.arrivalTime) {
          conflicts.push({
            type: 'time_overlap',
            severity: 'critical',
            description: `Time overlap between ${currentPlace.name} and ${nextPlace.name}`,
            affectedItems: [currentPlace.id, nextPlace.id],
            suggestedResolution: 'Adjust departure or arrival times'
          });
        }
      }

      // Check for insufficient travel time
      for (const transport of dailySchedule.transports) {
        const minRequiredTime = this.getMinimumTravelTime(transport.mode, transport.distance);
        if (transport.duration < minRequiredTime) {
          conflicts.push({
            type: 'travel_impossible',
            severity: 'warning',
            description: `Insufficient travel time from ${transport.from.name} to ${transport.to.name}`,
            affectedItems: [transport.from.id, transport.to.id],
            suggestedResolution: `Increase travel time to at least ${minRequiredTime} minutes`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Get minimum travel time for transport mode
   */
  private getMinimumTravelTime(mode: string, distance: number): number {
    switch (mode) {
      case 'walking': return distance * 12; // 5 km/h
      case 'public_transport': return distance * 3 + 15; // 20 km/h + waiting
      case 'car': return distance * 1.5 + 10; // 40 km/h + parking
      case 'flight': return distance * 0.1 + 180; // 600 km/h + procedures
      default: return 30;
    }
  }

  // ===== PHASE 7 ENHANCEMENTS =====
  
  /**
   * TODO 120: Calculate precise arrival time with enhanced algorithms
   */
  private calculatePreciseArrivalTime(
    routePlace: any, 
    index: number, 
    allPlaces: any[], 
    processedPlaces: SchedulePlace[]
  ): string {
    // Use provided arrival time if available and realistic
    if (routePlace.arrivalTime && this.validateTimeFormat(routePlace.arrivalTime)) {
      return routePlace.arrivalTime;
    }
    
    // Calculate based on previous place if available
    if (index > 0 && processedPlaces.length > 0) {
      const prevPlace = processedPlaces[processedPlaces.length - 1];
      const prevDepartureMinutes = this.timeToMinutes(prevPlace.departureTime);
      const travelTime = routePlace.travelTimeMinutes || 30;
      const bufferTime = this.calculateMinimalBuffer(routePlace.transportToNext || 'car');
      
      const arrivalMinutes = prevDepartureMinutes + travelTime + bufferTime;
      return this.minutesToTime(arrivalMinutes);
    }
    
    // Default to time slot calculation with enhanced spacing
    const baseMinutes = 9 * 60; // 9 AM start
    const enhancedSpacing = this.calculateOptimalSpacing(index, allPlaces.length);
    const totalMinutes = baseMinutes + (index * enhancedSpacing);
    
    return this.minutesToTime(totalMinutes);
  }
  
  /**
   * TODO 120: Calculate precise departure time
   */
  private calculatePreciseDepartureTime(arrivalTime: string, stayDuration: number): string {
    const arrivalMinutes = this.timeToMinutes(arrivalTime);
    const departureMinutes = arrivalMinutes + stayDuration;
    return this.minutesToTime(departureMinutes);
  }
  
  /**
   * TODO 122: Calculate buffer time for a place
   */
  private calculateBufferTimeForPlace(
    place: SchedulePlace, 
    index: number, 
    totalPlaces: number
  ): ScheduleBufferTime | null {
    const bufferConfig = DetailedScheduleService.DEFAULT_BUFFER_CONFIG;
    
    // Calculate base buffer
    let baseBuffer = bufferConfig.minBufferMinutes;
    
    // Apply category factor
    const categoryFactor = bufferConfig.bufferFactors.place_category[place.category] || 1.0;
    baseBuffer *= categoryFactor;
    
    // Apply time of day factor
    const hour = parseInt(place.arrivalTime.split(':')[0]);
    let timeOfDayFactor = 1.0;
    if (hour >= 12 && hour <= 14) timeOfDayFactor = bufferConfig.bufferFactors.time_of_day.lunch;
    else if (hour >= 18) timeOfDayFactor = bufferConfig.bufferFactors.time_of_day.evening;
    
    baseBuffer *= timeOfDayFactor;
    
    // Ensure within limits
    const finalBuffer = Math.min(Math.round(baseBuffer), bufferConfig.maxBufferMinutes);
    
    if (finalBuffer > bufferConfig.minBufferMinutes) {
      const bufferStartTime = this.minutesToTime(
        this.timeToMinutes(place.departureTime)
      );
      const bufferEndTime = this.minutesToTime(
        this.timeToMinutes(place.departureTime) + finalBuffer
      );
      
      return {
        bufferId: crypto.randomUUID(),
        startTime: bufferStartTime,
        endTime: bufferEndTime,
        duration: finalBuffer,
        reason: 'activity_buffer',
        description: `Buffer time after visiting ${place.name}`,
        adaptiveBuffer: bufferConfig.adaptive,
        confidenceScore: 0.8,
        bufferFactors: {
          place_category: categoryFactor,
          time_of_day: timeOfDayFactor
        }
      };
    }
    
    return null;
  }

  // Utility methods for Phase 7 enhancements
  private validateTimeFormat(time: string): boolean {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }
  
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  
  private calculateOptimalSpacing(index: number, totalPlaces: number): number {
    // Dynamic spacing based on total places
    const baseSpacing = 180; // 3 hours
    const adjustment = Math.max(0, (8 - totalPlaces) * 15); // Reduce spacing for more places
    return baseSpacing - adjustment;
  }
  
  private calculateMinimalBuffer(transportMode: string): number {
    const bufferConfig = DetailedScheduleService.DEFAULT_BUFFER_CONFIG;
    const factor = bufferConfig.bufferFactors.transport_mode[transportMode] || 1.0;
    return Math.round(bufferConfig.minBufferMinutes * factor);
  }

  // ===== TODO 123: SCHEDULE EXPORT FUNCTIONALITY =====
  
  /**
   * Export schedule to JSON format
   */
  async exportToJSON(schedule: ComprehensiveSchedule): Promise<string> {
    try {
      const exportData = {
        export_metadata: {
          format: 'json',
          version: '1.0',
          exported_at: new Date().toISOString(),
          exported_by: 'Voypath Schedule Export'
        },
        trip_info: {
          id: schedule.tripId,
          name: schedule.tripName,
          start_date: schedule.startDate,
          end_date: schedule.endDate,
          total_days: schedule.totalDays
        },
        schedule_data: schedule.dailySchedules.map(day => ({
          date: day.date,
          day_number: day.dayNumber,
          places: day.places.map(place => ({
            id: place.id,
            name: place.name,
            category: place.category,
            address: place.address,
            coordinates: {
              latitude: place.latitude,
              longitude: place.longitude
            },
            timing: {
              arrival: place.arrivalTime,
              departure: place.departureTime,
              duration_minutes: place.stayDurationMinutes
            },
            user_info: {
              user_id: place.userId,
              user_name: place.userName,
              user_color: place.userColor,
              wish_level: place.wishLevel,
              normalized_wish_level: place.normalizedWishLevel
            }
          })),
          transport_segments: day.transports.map(transport => ({
            from: {
              name: transport.from.name,
              coordinates: {
                latitude: transport.from.latitude,
                longitude: transport.from.longitude
              }
            },
            to: {
              name: transport.to.name,
              coordinates: {
                latitude: transport.to.latitude,
                longitude: transport.to.longitude
              }
            },
            mode: transport.mode,
            duration_minutes: transport.duration,
            distance_km: transport.distance,
            departure_time: transport.departureTime,
            arrival_time: transport.arrivalTime,
            estimated_cost: transport.cost
          })),
          meal_breaks: day.mealBreaks.map(meal => ({
            type: meal.type,
            start_time: meal.startTime,
            end_time: meal.endTime,
            duration_minutes: meal.duration,
            suggested_location: meal.suggestedLocation,
            coordinates: meal.coordinates
          })),
          buffer_times: day.bufferTimes.map(buffer => ({
            id: buffer.bufferId,
            start_time: buffer.startTime,
            end_time: buffer.endTime,
            duration_minutes: buffer.duration,
            reason: buffer.reason,
            description: buffer.description,
            adaptive: buffer.adaptiveBuffer,
            confidence_score: buffer.confidenceScore
          })),
          daily_statistics: day.dailyStats
        })),
        overall_statistics: schedule.overallStats,
        metadata: schedule.metadata
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('JSON export error:', error);
      throw new Error(`Failed to export schedule to JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export schedule to iCal format
   */
  async exportToICal(schedule: ComprehensiveSchedule): Promise<string> {
    try {
      const now = new Date();
      const uid = crypto.randomUUID();
      
      let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Voypath//Schedule Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${schedule.tripName} - Travel Schedule`,
        `X-WR-CALDESC:Travel schedule for ${schedule.tripName}`,
        'X-WR-TIMEZONE:Asia/Tokyo'
      ];

      // Add timezone definition
      icalContent.push(
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Tokyo',
        'BEGIN:STANDARD',
        'DTSTART:20201101T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
        'TZNAME:JST',
        'TZOFFSETFROM:+0900',
        'TZOFFSETTO:+0900',
        'END:STANDARD',
        'END:VTIMEZONE'
      );

      // Process each daily schedule
      for (const dailySchedule of schedule.dailySchedules) {
        const date = dailySchedule.date;
        
        // Add place visit events
        for (const place of dailySchedule.places) {
          const eventUid = crypto.randomUUID();
          const startDateTime = this.formatICalDateTime(date, place.arrivalTime);
          const endDateTime = this.formatICalDateTime(date, place.departureTime);
          
          icalContent.push(
            'BEGIN:VEVENT',
            `UID:${eventUid}@voypath.com`,
            `DTSTART;TZID=Asia/Tokyo:${startDateTime}`,
            `DTEND;TZID=Asia/Tokyo:${endDateTime}`,
            `SUMMARY:Visit ${place.name}`,
            `DESCRIPTION:${this.formatPlaceDescription(place)}`,
            `LOCATION:${place.address || place.name}`,
            `CATEGORIES:Travel,${place.category}`,
            `X-VOYPATH-USER:${place.userName}`,
            `X-VOYPATH-USER-COLOR:${place.userColor}`,
            `X-VOYPATH-WISH-LEVEL:${place.wishLevel}`,
            `STATUS:CONFIRMED`,
            `DTSTAMP:${this.formatICalDateTime(now.toISOString().split('T')[0], now.toTimeString().split(' ')[0])}`,
            'END:VEVENT'
          );
        }

        // Add meal break events
        for (const meal of dailySchedule.mealBreaks) {
          const mealUid = crypto.randomUUID();
          const startDateTime = this.formatICalDateTime(date, meal.startTime);
          const endDateTime = this.formatICalDateTime(date, meal.endTime);
          
          icalContent.push(
            'BEGIN:VEVENT',
            `UID:${mealUid}@voypath.com`,
            `DTSTART;TZID=Asia/Tokyo:${startDateTime}`,
            `DTEND;TZID=Asia/Tokyo:${endDateTime}`,
            `SUMMARY:${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)} Break`,
            `DESCRIPTION:${meal.type} at ${meal.suggestedLocation}`,
            `LOCATION:${meal.suggestedLocation}`,
            `CATEGORIES:Travel,Meal,${meal.type}`,
            `STATUS:CONFIRMED`,
            `DTSTAMP:${this.formatICalDateTime(now.toISOString().split('T')[0], now.toTimeString().split(' ')[0])}`,
            'END:VEVENT'
          );
        }

        // Add transport events (for flights and long journeys)
        for (const transport of dailySchedule.transports) {
          if (transport.mode === 'flight' || transport.duration > 120) { // Only for flights or 2+ hour journeys
            const transportUid = crypto.randomUUID();
            const startDateTime = this.formatICalDateTime(date, transport.departureTime);
            const endDateTime = this.formatICalDateTime(date, transport.arrivalTime);
            
            icalContent.push(
              'BEGIN:VEVENT',
              `UID:${transportUid}@voypath.com`,
              `DTSTART;TZID=Asia/Tokyo:${startDateTime}`,
              `DTEND;TZID=Asia/Tokyo:${endDateTime}`,
              `SUMMARY:${this.getTransportTitle(transport.mode)} - ${transport.from.name} to ${transport.to.name}`,
              `DESCRIPTION:${this.formatTransportDescription(transport)}`,
              `LOCATION:${transport.from.name}`,
              `CATEGORIES:Travel,Transport,${transport.mode}`,
              `STATUS:CONFIRMED`,
              `DTSTAMP:${this.formatICalDateTime(now.toISOString().split('T')[0], now.toTimeString().split(' ')[0])}`,
              'END:VEVENT'
            );
          }
        }
      }

      icalContent.push('END:VCALENDAR');
      
      return icalContent.join('\r\n');
    } catch (error) {
      console.error('iCal export error:', error);
      throw new Error(`Failed to export schedule to iCal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export schedule in multiple formats
   */
  async exportSchedule(
    schedule: ComprehensiveSchedule, 
    format: 'json' | 'ical' | 'both'
  ): Promise<{ json?: string; ical?: string }> {
    const result: { json?: string; ical?: string } = {};
    
    try {
      if (format === 'json' || format === 'both') {
        result.json = await this.exportToJSON(schedule);
      }
      
      if (format === 'ical' || format === 'both') {
        result.ical = await this.exportToICal(schedule);
      }
      
      return result;
    } catch (error) {
      console.error('Schedule export error:', error);
      throw error;
    }
  }

  // Helper methods for export functionality
  private formatICalDateTime(date: string, time: string): string {
    // Convert date (YYYY-MM-DD) and time (HH:MM) to iCal format (YYYYMMDDTHHMMSS)
    const dateOnly = date.replace(/-/g, '');
    const timeOnly = time.replace(':', '') + '00'; // Add seconds
    return `${dateOnly}T${timeOnly}`;
  }

  private formatPlaceDescription(place: SchedulePlace): string {
    const lines = [
      `Category: ${place.category}`,
      `Stay Duration: ${place.stayDurationMinutes} minutes`,
      `Added by: ${place.userName}`,
      `Wish Level: ${place.wishLevel}/5`
    ];
    
    if (place.normalizedWishLevel) {
      lines.push(`Normalized Wish Level: ${place.normalizedWishLevel.toFixed(2)}`);
    }
    
    if (place.address) {
      lines.push(`Address: ${place.address}`);
    }
    
    return lines.join('\\n');
  }

  private formatTransportDescription(transport: ScheduleTransportSegment): string {
    const lines = [
      `Mode: ${transport.mode}`,
      `Distance: ${transport.distance.toFixed(1)} km`,
      `Duration: ${transport.duration} minutes`,
      `From: ${transport.from.name}`,
      `To: ${transport.to.name}`
    ];
    
    if (transport.cost) {
      lines.push(`Estimated Cost: ¥${transport.cost}`);
    }
    
    if (transport.details) {
      if (transport.details.route) {
        lines.push(`Route: ${transport.details.route}`);
      }
      if (transport.details.transfers) {
        lines.push(`Transfers: ${transport.details.transfers}`);
      }
    }
    
    return lines.join('\\n');
  }

  private getTransportTitle(mode: string): string {
    switch (mode) {
      case 'flight': return 'Flight';
      case 'car': return 'Drive';
      case 'public_transport': return 'Public Transport';
      case 'walking': return 'Walk';
      default: return 'Travel';
    }
  }

  // ===== TODO 124: SCHEDULE SHARING AND COLLABORATION =====
  
  /**
   * Generate shareable link for schedule
   */
  async generateShareableLink(
    schedule: ComprehensiveSchedule,
    permissions: 'view' | 'edit' = 'view',
    expiresIn: number = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  ): Promise<{ shareId: string; shareUrl: string; expiresAt: string }> {
    try {
      const shareId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + expiresIn).toISOString();
      
      // Store shareable schedule data in database
      const { error } = await supabase
        .from('shared_schedules')
        .insert({
          share_id: shareId,
          trip_id: schedule.tripId,
          schedule_data: schedule,
          permissions,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
          access_count: 0
        });
      
      if (error) {
        throw new Error(`Failed to create shareable link: ${error.message}`);
      }
      
      const shareUrl = `${window.location.origin}/shared-schedule/${shareId}`;
      
      return {
        shareId,
        shareUrl,
        expiresAt
      };
    } catch (error) {
      console.error('Share link generation error:', error);
      throw new Error(`Failed to generate shareable link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get shared schedule by share ID
   */
  async getSharedSchedule(shareId: string): Promise<{
    schedule: ComprehensiveSchedule;
    permissions: string;
    expiresAt: string;
    accessCount: number;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('shared_schedules')
        .select('*')
        .eq('share_id', shareId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      // Check if link has expired
      if (new Date(data.expires_at) < new Date()) {
        return null;
      }
      
      // Increment access count
      await supabase
        .from('shared_schedules')
        .update({ 
          access_count: data.access_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('share_id', shareId);
      
      return {
        schedule: data.schedule_data as ComprehensiveSchedule,
        permissions: data.permissions,
        expiresAt: data.expires_at,
        accessCount: data.access_count + 1
      };
    } catch (error) {
      console.error('Get shared schedule error:', error);
      return null;
    }
  }
  
  /**
   * Generate schedule summary for sharing
   */
  generateScheduleSummary(schedule: ComprehensiveSchedule): {
    textSummary: string;
    htmlSummary: string;
  } {
    const totalPlaces = schedule.overallStats.totalPlaces;
    const totalDays = schedule.totalDays;
    const totalHours = Math.round(schedule.overallStats.totalTravelTime / 60);
    
    const textLines = [
      `🗾 ${schedule.tripName}`,
      `📅 ${schedule.startDate} to ${schedule.endDate} (${totalDays} days)`,
      `📍 ${totalPlaces} places to visit`,
      `⏱️ ${totalHours} hours total travel time`,
      ``,
      `Daily Schedule:`
    ];
    
    const htmlLines = [
      `<h2>🗾 ${schedule.tripName}</h2>`,
      `<p><strong>📅 Date:</strong> ${schedule.startDate} to ${schedule.endDate} (${totalDays} days)</p>`,
      `<p><strong>📍 Places:</strong> ${totalPlaces} places to visit</p>`,
      `<p><strong>⏱️ Travel Time:</strong> ${totalHours} hours total</p>`,
      `<h3>Daily Schedule:</h3>`,
      `<ul>`
    ];
    
    schedule.dailySchedules.forEach(day => {
      textLines.push(`Day ${day.dayNumber} (${day.date}):`);
      htmlLines.push(`<li><strong>Day ${day.dayNumber} (${day.date}):</strong><ul>`);
      
      day.places.forEach(place => {
        textLines.push(`  • ${place.arrivalTime}-${place.departureTime}: ${place.name} (${place.userName})`);
        htmlLines.push(`<li>${place.arrivalTime}-${place.departureTime}: ${place.name} <em>(added by ${place.userName})</em></li>`);
      });
      
      htmlLines.push(`</ul></li>`);
      textLines.push('');
    });
    
    htmlLines.push(`</ul>`);
    textLines.push(`Generated by Voypath - ${new Date().toLocaleDateString()}`);
    htmlLines.push(`<p><em>Generated by Voypath - ${new Date().toLocaleDateString()}</em></p>`);
    
    return {
      textSummary: textLines.join('\n'),
      htmlSummary: htmlLines.join('\n')
    };
  }
  
  /**
   * Share schedule via different methods
   */
  async shareSchedule(
    schedule: ComprehensiveSchedule,
    method: 'link' | 'email' | 'social',
    options: {
      permissions?: 'view' | 'edit';
      recipients?: string[];
      message?: string;
      platform?: 'twitter' | 'facebook' | 'whatsapp';
    } = {}
  ): Promise<{ success: boolean; shareUrl?: string; message: string }> {
    try {
      switch (method) {
        case 'link':
          const linkResult = await this.generateShareableLink(
            schedule,
            options.permissions || 'view'
          );
          return {
            success: true,
            shareUrl: linkResult.shareUrl,
            message: `Shareable link created. Expires on ${new Date(linkResult.expiresAt).toLocaleDateString()}`
          };
          
        case 'email':
          // In a real implementation, this would integrate with an email service
          const emailLink = await this.generateShareableLink(schedule, 'view');
          const summary = this.generateScheduleSummary(schedule);
          
          return {
            success: true,
            shareUrl: emailLink.shareUrl,
            message: `Email sharing prepared. Send this link to recipients: ${emailLink.shareUrl}`
          };
          
        case 'social':
          const socialLink = await this.generateShareableLink(schedule, 'view');
          const socialText = `Check out my travel itinerary for ${schedule.tripName}! 🗾✈️`;
          
          let platformUrl = '';
          switch (options.platform) {
            case 'twitter':
              platformUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialText)}&url=${encodeURIComponent(socialLink.shareUrl)}`;
              break;
            case 'facebook':
              platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialLink.shareUrl)}`;
              break;
            case 'whatsapp':
              platformUrl = `https://wa.me/?text=${encodeURIComponent(socialText + ' ' + socialLink.shareUrl)}`;
              break;
            default:
              platformUrl = socialLink.shareUrl;
          }
          
          return {
            success: true,
            shareUrl: platformUrl,
            message: `Social sharing link prepared for ${options.platform || 'general sharing'}`
          };
          
        default:
          throw new Error('Unsupported sharing method');
      }
    } catch (error) {
      console.error('Schedule sharing error:', error);
      return {
        success: false,
        message: `Failed to share schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Collaboration: Add comment to schedule
   */
  async addScheduleComment(
    scheduleId: string,
    userId: string,
    comment: string,
    targetType: 'schedule' | 'place' | 'transport',
    targetId?: string
  ): Promise<{ success: boolean; commentId?: string; message: string }> {
    try {
      const commentId = crypto.randomUUID();
      
      const { error } = await supabase
        .from('schedule_comments')
        .insert({
          comment_id: commentId,
          schedule_id: scheduleId,
          user_id: userId,
          comment_text: comment,
          target_type: targetType,
          target_id: targetId,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        throw new Error(`Failed to add comment: ${error.message}`);
      }
      
      return {
        success: true,
        commentId,
        message: 'Comment added successfully'
      };
    } catch (error) {
      console.error('Add comment error:', error);
      return {
        success: false,
        message: `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Get comments for a schedule
   */
  async getScheduleComments(scheduleId: string): Promise<Array<{
    commentId: string;
    userId: string;
    userName?: string;
    commentText: string;
    targetType: string;
    targetId?: string;
    createdAt: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          comment_id,
          user_id,
          comment_text,
          target_type,
          target_id,
          created_at,
          users(display_name, name)
        `)
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Get comments error:', error);
        return [];
      }
      
      return (data || []).map(comment => ({
        commentId: comment.comment_id,
        userId: comment.user_id,
        userName: (comment.users as any)?.display_name || (comment.users as any)?.name || 'Unknown User',
        commentText: comment.comment_text,
        targetType: comment.target_type,
        targetId: comment.target_id,
        createdAt: comment.created_at
      }));
    } catch (error) {
      console.error('Get schedule comments error:', error);
      return [];
    }
  }
}

// Export singleton instance
export const detailedScheduleService = DetailedScheduleService.getInstance();

// Export convenience functions
export const generateComprehensiveSchedule = (tripId: string, optimizationResult?: any) =>
  detailedScheduleService.generateComprehensiveSchedule(tripId, optimizationResult);

export const detectScheduleConflicts = (schedule: ComprehensiveSchedule) =>
  detailedScheduleService.detectScheduleConflicts(schedule);

// Phase 7 export functions
export const exportScheduleToJSON = (schedule: ComprehensiveSchedule) =>
  detailedScheduleService.exportToJSON(schedule);

export const exportScheduleToICal = (schedule: ComprehensiveSchedule) =>
  detailedScheduleService.exportToICal(schedule);

export const exportSchedule = (schedule: ComprehensiveSchedule, format: 'json' | 'ical' | 'both') =>
  detailedScheduleService.exportSchedule(schedule, format);

// Phase 7 sharing functions
export const generateShareableLink = (schedule: ComprehensiveSchedule, permissions?: 'view' | 'edit', expiresIn?: number) =>
  detailedScheduleService.generateShareableLink(schedule, permissions, expiresIn);

export const getSharedSchedule = (shareId: string) =>
  detailedScheduleService.getSharedSchedule(shareId);

export const shareSchedule = (schedule: ComprehensiveSchedule, method: 'link' | 'email' | 'social', options?: any) =>
  detailedScheduleService.shareSchedule(schedule, method, options);

export const generateScheduleSummary = (schedule: ComprehensiveSchedule) =>
  detailedScheduleService.generateScheduleSummary(schedule);

export const addScheduleComment = (scheduleId: string, userId: string, comment: string, targetType: 'schedule' | 'place' | 'transport', targetId?: string) =>
  detailedScheduleService.addScheduleComment(scheduleId, userId, comment, targetType, targetId);

export const getScheduleComments = (scheduleId: string) =>
  detailedScheduleService.getScheduleComments(scheduleId);

export default detailedScheduleService;