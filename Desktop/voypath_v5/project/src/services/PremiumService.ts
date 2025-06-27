/**
 * Premium Service - Handles premium subscription management
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SubscriptionStatus {
  isPremium: boolean;
  subscriptionId?: string;
  customerId?: string;
  status?: string;
  currentPeriodEnd?: string;
  planId?: string;
}

export class PremiumService {
  /**
   * Check if user has active premium subscription
   */
  static async checkSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { isPremium: false };
      }

      const { data, error } = await supabase.functions.invoke(
        'stripe-subscription-management',
        {
          body: { action: 'check_subscription' }
        }
      );

      if (error) {
        console.error('Error checking subscription:', error);
        return { isPremium: false };
      }

      return {
        isPremium: data?.isPremium || false,
        subscriptionId: data?.subscriptionId,
        customerId: data?.customerId,
        status: data?.status,
        currentPeriodEnd: data?.currentPeriodEnd,
        planId: data?.planId
      };
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return { isPremium: false };
    }
  }

  /**
   * Create Stripe checkout session for premium upgrade
   */
  static async createCheckoutSession(): Promise<{ url?: string; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke(
        'stripe-subscription-management',
        {
          body: { action: 'create_checkout_session' }
        }
      );

      if (error) {
        throw error;
      }

      return { url: data?.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { error: error instanceof Error ? error.message : 'Failed to create checkout session' };
    }
  }

  /**
   * Create Stripe billing portal session for subscription management
   */
  static async createPortalSession(): Promise<{ url?: string; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke(
        'stripe-subscription-management',
        {
          body: { action: 'create_portal_session' }
        }
      );

      if (error) {
        throw error;
      }

      return { url: data?.url };
    } catch (error) {
      console.error('Error creating portal session:', error);
      return { error: error instanceof Error ? error.message : 'Failed to create portal session' };
    }
  }

  /**
   * Handle premium upgrade flow
   */
  static async upgradeToPremium(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const result = await this.createCheckoutSession();
      
      if (result.error) {
        return { success: false, error: result.error };
      }

      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
        return { success: true, url: result.url };
      }

      return { success: false, error: 'No checkout URL received' };
    } catch (error) {
      console.error('Error upgrading to premium:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upgrade to premium' 
      };
    }
  }

  /**
   * Handle subscription management flow
   */
  static async manageSubscription(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const result = await this.createPortalSession();
      
      if (result.error) {
        return { success: false, error: result.error };
      }

      if (result.url) {
        // Redirect to Stripe billing portal
        window.location.href = result.url;
        return { success: true, url: result.url };
      }

      return { success: false, error: 'No portal URL received' };
    } catch (error) {
      console.error('Error managing subscription:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to open subscription management' 
      };
    }
  }

  /**
   * Get premium features available to user
   */
  static async getPremiumFeatures(): Promise<string[]> {
    const status = await this.checkSubscriptionStatus();
    
    if (!status.isPremium) {
      return [];
    }

    return [
      'password_protection',
      'expiry_control',
      'usage_limits',
      'advanced_optimization',
      'priority_support',
      'unlimited_trips'
    ];
  }

  /**
   * Check if specific feature is available
   */
  static async hasFeature(feature: string): Promise<boolean> {
    const features = await this.getPremiumFeatures();
    return features.includes(feature);
  }

  /**
   * Get user's subscription info for display
   */
  static async getSubscriptionInfo(): Promise<{
    isPremium: boolean;
    status?: string;
    nextBilling?: string;
    planName?: string;
  }> {
    const status = await this.checkSubscriptionStatus();
    
    return {
      isPremium: status.isPremium,
      status: status.status,
      nextBilling: status.currentPeriodEnd,
      planName: status.isPremium ? 'Voypath Premium' : 'Basic'
    };
  }
}

export default PremiumService;