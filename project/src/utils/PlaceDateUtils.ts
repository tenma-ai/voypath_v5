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
    // 1. Use scheduled date if available (from optimization results)
    if (place.scheduled_date) {
      try {
        return new Date(place.scheduled_date);
      } catch (error) {
        console.warn('Invalid scheduled_date for place:', place.id, error);
      }
    }
    
    if (place.scheduledDate) {
      try {
        return new Date(place.scheduledDate);
      } catch (error) {
        console.warn('Invalid scheduledDate for place:', place.id, error);
      }
    }
    
    // 2. Calculate from day number if trip has start date
    if (place.day && currentTrip) {
      try {
        return DateUtils.calculateTripDate(currentTrip, place.day);
      } catch (error) {
        console.warn('Failed to calculate trip date for place:', place.id, error);
      }
    }
    
    // 3. Use visit_date if explicitly set
    if (place.visit_date) {
      try {
        return new Date(place.visit_date);
      } catch (error) {
        console.warn('Invalid visit_date for place:', place.id, error);
      }
    }
    
    if (place.visitDate) {
      try {
        return new Date(place.visitDate);
      } catch (error) {
        console.warn('Invalid visitDate for place:', place.id, error);
      }
    }
    
    // 4. Use place creation date if available
    if (place.created_at) {
      try {
        return new Date(place.created_at);
      } catch (error) {
        console.warn('Invalid created_at for place:', place.id, error);
      }
    }
    
    // 5. Return null - UI will show "No date set"
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