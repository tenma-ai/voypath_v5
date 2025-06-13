import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { OptimizationKeepAliveService } from './services/OptimizationKeepAliveService';

// Start optimization keep-alive service for better performance
OptimizationKeepAliveService.startKeepAlive();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  OptimizationKeepAliveService.stopKeepAlive();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);