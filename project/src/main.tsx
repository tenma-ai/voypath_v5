import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { OptimizationKeepAliveService } from './services/OptimizationKeepAliveService';

// Debug environment variables
console.log('🔧 Environment Debug:');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set');
console.log('DEV mode:', import.meta.env.DEV);

// Set default dark mode
document.documentElement.classList.add('dark');

// Start optimization keep-alive service for better performance
OptimizationKeepAliveService.startKeepAlive();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  OptimizationKeepAliveService.stopKeepAlive();
});

createRoot(document.getElementById('root')!).render(
  <BrowserRouter future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }}>
    <App />
  </BrowserRouter>
);