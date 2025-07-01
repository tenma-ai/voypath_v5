// Temporary debug file - DELETE AFTER TESTING
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('VITE_GOOGLE_MAPS_API_KEY:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
console.log('All env vars:', import.meta.env);

// Export a function to show this in the browser console
window.debugEnv = () => {
  console.log('=== BROWSER DEBUG ===');
  console.log('API Key:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
};