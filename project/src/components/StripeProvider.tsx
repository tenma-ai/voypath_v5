import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../lib/stripe';

interface StripeProviderProps {
  children: React.ReactNode;
}

export function StripeProvider({ children }: StripeProviderProps) {
  // Disable Stripe in development to avoid iframe errors
  const isDevelopment = import.meta.env.DEV;
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  // Always disable Stripe in development to avoid message port errors
  if (isDevelopment) {
    console.log('🚫 Stripe disabled in development mode');
    return <>{children}</>;
  }
  
  if (!stripeKey) {
    console.warn('⚠️ Stripe publishable key not found in production');
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}