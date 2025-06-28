import { DateUtils } from './DateUtils';

export interface Trip {
  id: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
}

export interface Place {
  id: string;
  scheduled_date?: string;
  scheduledDate?: string;
  day?: number;
  created_at?: string;
  visit_date?: string;
  visitDate?: string;
}

/**
 * Centralized place date handling utilities
 * Ensures consistent date logic across all places-related components
 */
export class PlaceDateUtils {
  /**
   * Get the display date for a place with proper fallback hierarchy
   * Priority: scheduled_date > day calculation > visit_date > created_at > null
   */
  static getPlaceDisplayDate(place: Place, currentTrip?: Trip): Date | null {
    console.log('🔍 getPlaceDisplayDate called for place:', place.id, {
      scheduled_date: place.scheduled_date,
      scheduledDate: place.scheduledDate,
      day: place.day,
      visit_date: place.visit_date,
      visitDate: place.visitDate,
      created_at: place.created_at
    });
    
    // 1. Use scheduled date if available (from optimization results)
    if (place.scheduled_date || place.scheduledDate) {
      try {
        const result = new Date(place.scheduled_date || place.scheduledDate!);
        console.log('🔍 Using scheduled_date/scheduledDate:', result);
        return result;
      } catch (error) {
        console.warn('Invalid scheduled_date for place:', place.id, error);
      }
    }
    
    // 2. Calculate from day number if trip has start date
    if (place.day && currentTrip) {
      try {
        const result = DateUtils.calculateTripDate(currentTrip, place.day);
        console.log('🔍 Using day calculation:', result);
        return result;
      } catch (error) {
        console.warn('Failed to calculate trip date for place:', place.id, error);
      }
    }
    
    // 3. Use visit_date if explicitly set
    if (place.visit_date || place.visitDate) {
      try {
        const result = new Date(place.visit_date || place.visitDate!);
        console.log('🔍 Using visit_date/visitDate:', result);
        return result;
      } catch (error) {
        console.warn('Invalid visit_date for place:', place.id, error);
      }
    }
    
    // 4. Use place creation date if available
    if (place.created_at) {
      try {
        const result = new Date(place.created_at);
        console.log('🔍 Using created_at:', result);
        return result;
      } catch (error) {
        console.warn('Invalid created_at for place:', place.id, error);
      }
    }
    
    // 5. Return null instead of trip start date or current date - let UI handle gracefully
    console.log('🔍 Returning null for place:', place.id);
    return null;
  }

  /**
   * Get initial date for place creation forms
   * Priority: trip start date > empty string
   */
  static getInitialPlaceDate(currentTrip?: Trip): string {
    if (!currentTrip) return '';
    
    const tripStartDate = DateUtils.getTripStartDate(currentTrip);
    if (tripStartDate) {
      return tripStartDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    
    return '';
  }

  /**
   * Get initial calendar date for places-related calendar components
   * Priority: trip start date > null (let calendar use default)
   */
  static getCalendarInitialDate(currentTrip?: Trip): Date | null {
    if (!currentTrip) return null;
    
    return DateUtils.getTripStartDate(currentTrip);
  }

  /**
   * Get the selected day for timeline/list views
   * Priority: trip start date as YYYY-MM-DD > null
   */
  static getInitialSelectedDay(currentTrip?: Trip): string | null {
    if (!currentTrip) return null;
    
    const tripStartDate = DateUtils.getTripStartDate(currentTrip);
    if (tripStartDate) {
      return tripStartDate.toISOString().split('T')[0];
    }
    
    return null;
  }

  /**
   * Validate if a date falls within trip date range
   */
  static isDateWithinTripRange(date: Date, currentTrip?: Trip): boolean {
    if (!currentTrip) return true; // Allow any date if no trip context
    
    const tripStartDate = DateUtils.getTripStartDate(currentTrip);
    const tripEndDate = DateUtils.getTripEndDate(currentTrip);
    
    if (tripStartDate && date < tripStartDate) return false;
    if (tripEndDate && date > tripEndDate) return false;
    
    return true;
  }

  /**
   * Format place date for display with fallback text
   */
  static formatPlaceDate(place: Place, currentTrip?: Trip, fallbackText: string = 'No date set'): string {
    const displayDate = this.getPlaceDisplayDate(place, currentTrip);
    
    if (!displayDate) return fallbackText;
    
    return DateUtils.formatCalendarDate(displayDate);
  }

  /**
   * Get date constraints for date pickers based on trip
   */
  static getDatePickerConstraints(currentTrip?: Trip): { 
    fromDate?: Date; 
    toDate?: Date; 
    defaultMonth?: Date;
    disabled?: (date: Date) => boolean;
  } {
    if (!currentTrip) return {};
    
    const tripStartDate = DateUtils.getTripStartDate(currentTrip);
    const tripEndDate = DateUtils.getTripEndDate(currentTrip);
    
    return {
      fromDate: tripStartDate || undefined,
      toDate: tripEndDate || undefined,
      defaultMonth: tripStartDate || undefined,
      disabled: (date: Date) => !this.isDateWithinTripRange(date, currentTrip)
    };
  }

  /**
   * Sort places by their display dates
   */
  static sortPlacesByDate(places: Place[], currentTrip?: Trip): Place[] {
    return [...places].sort((a, b) => {
      const dateA = this.getPlaceDisplayDate(a, currentTrip);
      const dateB = this.getPlaceDisplayDate(b, currentTrip);
      
      // Places without dates go to the end
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Group places by their display dates
   */
  static groupPlacesByDate(places: Place[], currentTrip?: Trip): Record<string, Place[]> {
    const grouped: Record<string, Place[]> = {};
    
    places.forEach(place => {
      const displayDate = this.getPlaceDisplayDate(place, currentTrip);
      const dateKey = displayDate ? displayDate.toDateString() : 'no-date';
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(place);
    });
    
    return grouped;
  }
}