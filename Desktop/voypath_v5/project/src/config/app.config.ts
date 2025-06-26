// Application configuration
export const APP_CONFIG = {
  // Realtime update settings
  REALTIME_TABLES: {
    // Subscription related tables - always realtime
    subscriptions: true,
    users: true,
    subscription_items: true,
    
    // Trip related tables - manual updates only
    trips: false,
    places: false,
    optimization_results: false,
    trip_members: false,
  },
  
  // Manual refresh settings
  MANUAL_REFRESH_ONLY: true,
  
  // Polling intervals (in milliseconds) - set to 0 to disable
  POLLING_INTERVALS: {
    PLACES: 0, // Disable automatic place updates
    TRIPS: 0,  // Disable automatic trip updates
    OPTIMIZATION_RESULTS: 0, // Disable automatic optimization result updates
  },
  
  // When to automatically refresh data
  AUTO_REFRESH_TRIGGERS: {
    AFTER_PLACE_ADD: true,
    AFTER_OPTIMIZATION: true,
    AFTER_SETTINGS_CHANGE: true,
    AFTER_SUBSCRIPTION_CHANGE: true,
  },
};