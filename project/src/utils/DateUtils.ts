/**
 * Unified date utility functions for VoyPath
 * Handles date calculations, formatting, and consistency across components
 */

export interface TripDate {
  startDate?: string;
  start_date?: string; 
  endDate?: string;
  end_date?: string;
}

export interface DateFormatOptions {
  locale?: string;
  includeYear?: boolean;
  includeWeekday?: boolean;
  timeZone?: string;
}

export class DateUtils {
  private static DEFAULT_LOCALE = 'en-US';
  private static DEFAULT_TIMEZONE = 'UTC';

  /**
   * Get the start date of a trip, handling both camelCase and snake_case properties
   */
  static getTripStartDate(trip: TripDate): Date | null {
    const startDateStr = trip.startDate || trip.start_date;
    if (!startDateStr) return null;
    
    try {
      const date = new Date(startDateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Get the end date of a trip, handling both camelCase and snake_case properties
   */
  static getTripEndDate(trip: TripDate): Date | null {
    const endDateStr = trip.endDate || trip.end_date;
    if (!endDateStr) return null;
    
    try {
      const date = new Date(endDateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Calculate the actual date for a given day number of the trip
   */
  static calculateTripDate(trip: TripDate, dayNumber: number): Date {
    const startDate = this.getTripStartDate(trip);
    
    if (startDate) {
      const resultDate = new Date(startDate);
      resultDate.setDate(startDate.getDate() + (dayNumber - 1));
      return resultDate;
    }
    
    // Fallback to today + day offset if no trip start date
    const today = new Date();
    const resultDate = new Date(today);
    resultDate.setDate(today.getDate() + (dayNumber - 1));
    return resultDate;
  }

  /**
   * Get the trip duration in days
   */
  static getTripDuration(trip: TripDate): number {
    const startDate = this.getTripStartDate(trip);
    const endDate = this.getTripEndDate(trip);
    
    if (!startDate || !endDate) return 0;
    
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
  }

  /**
   * Get array of dates for the entire trip
   */
  static getTripDateRange(trip: TripDate): Date[] {
    const duration = this.getTripDuration(trip);
    const dates: Date[] = [];
    
    for (let day = 1; day <= duration; day++) {
      dates.push(this.calculateTripDate(trip, day));
    }
    
    return dates;
  }

  /**
   * Format date with consistent styling across the app
   */
  static formatDate(date: Date, options: DateFormatOptions = {}): string {
    const {
      locale = this.DEFAULT_LOCALE,
      includeYear = false,
      includeWeekday = false,
      timeZone = this.DEFAULT_TIMEZONE
    } = options;

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      timeZone
    };

    if (includeYear) {
      formatOptions.year = 'numeric';
    }

    if (includeWeekday) {
      formatOptions.weekday = 'short';
    }

    try {
      return date.toLocaleDateString(locale, formatOptions);
    } catch {
      // Fallback to basic format if locale is not supported
      return date.toLocaleDateString(this.DEFAULT_LOCALE, formatOptions);
    }
  }

  /**
   * Format date for display in calendar views
   */
  static formatCalendarDate(date: Date, options: DateFormatOptions = {}): string {
    return this.formatDate(date, {
      ...options,
      includeWeekday: true,
      includeYear: false
    });
  }

  /**
   * Format date for mobile display (shorter format)
   */
  static formatMobileDate(date: Date, options: DateFormatOptions = {}): string {
    return this.formatDate(date, {
      ...options,
      includeWeekday: false,
      includeYear: false
    });
  }

  /**
   * Format date with time for detailed displays
   */
  static formatDateTime(date: Date, options: DateFormatOptions = {}): string {
    const {
      locale = this.DEFAULT_LOCALE,
      includeYear = false,
      includeWeekday = true,
      timeZone = this.DEFAULT_TIMEZONE
    } = options;

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone
    };

    if (includeYear) {
      formatOptions.year = 'numeric';
    }

    if (includeWeekday) {
      formatOptions.weekday = 'short';
    }

    try {
      return date.toLocaleDateString(locale, formatOptions);
    } catch {
      return date.toLocaleDateString(this.DEFAULT_LOCALE, formatOptions);
    }
  }

  /**
   * Format standard date with weekday (unified format across app)
   */
  static formatStandardDate(date: Date): string {
    return this.formatCalendarDate(date);
  }

  /**
   * Format compact date without weekday for space-constrained areas
   */
  static formatCompactDate(date: Date): string {
    return this.formatMobileDate(date);
  }


  /**
   * Get the day number for a given date within a trip
   */
  static getTripDayNumber(trip: TripDate, date: Date): number {
    const startDate = this.getTripStartDate(trip);
    if (!startDate) return 1;
    
    const diffTime = date.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays + 1);
  }

  /**
   * Check if a date falls within the trip duration
   */
  static isDateInTrip(trip: TripDate, date: Date): boolean {
    const startDate = this.getTripStartDate(trip);
    const endDate = this.getTripEndDate(trip);
    
    if (!startDate || !endDate) return false;
    
    return date >= startDate && date <= endDate;
  }

  /**
   * Get today's date with time set to 00:00:00
   */
  static getToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Check if two dates are the same day
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Parse date string safely
   */
  static parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Format date for API/database storage (ISO string)
   */
  static formatForStorage(date: Date): string {
    return date.toISOString();
  }

  /**
   * Get localized month name
   */
  static getMonthName(date: Date, locale: string = this.DEFAULT_LOCALE): string {
    try {
      return date.toLocaleDateString(locale, { month: 'long' });
    } catch {
      return date.toLocaleDateString(this.DEFAULT_LOCALE, { month: 'long' });
    }
  }

  /**
   * Get localized day name
   */
  static getDayName(date: Date, locale: string = this.DEFAULT_LOCALE): string {
    try {
      return date.toLocaleDateString(locale, { weekday: 'long' });
    } catch {
      return date.toLocaleDateString(this.DEFAULT_LOCALE, { weekday: 'long' });
    }
  }

  /**
   * Generate date range between two dates
   */
  static getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Add days to a date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Subtract days from a date
   */
  static subtractDays(date: Date, days: number): Date {
    return this.addDays(date, -days);
  }

  /**
   * Format duration in minutes to a human-readable string
   * Shows months/days/hours/minutes but excludes seconds for better UX
   */
  static formatDuration(minutes: number): string {
    if (minutes < 1) return '0m';
    
    const totalMinutes = Math.floor(minutes);
    const months = Math.floor(totalMinutes / (30 * 24 * 60));
    const days = Math.floor((totalMinutes % (30 * 24 * 60)) / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;
    
    const parts = [];
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    
    return parts.join(' ');
  }

  /**
   * Format duration in a compact form for space-constrained UI
   */
  static formatDurationCompact(minutes: number): string {
    if (minutes < 1) return '0m';
    
    const totalMinutes = Math.floor(minutes);
    const months = Math.floor(totalMinutes / (30 * 24 * 60));
    const days = Math.floor((totalMinutes % (30 * 24 * 60)) / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;
    
    // Show only the most significant unit for compact display
    if (months > 0) return `${months}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }
}