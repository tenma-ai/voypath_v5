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
    // Log message
    return <>{children}</>;
  }
  
  if (!stripeKey) {
    // Warning occurred
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}