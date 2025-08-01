import { loadStripe } from '@stripe/stripe-js';

// Stripeの公開可能キーを環境変数から取得（開発環境では無効化）
const isDevelopment = import.meta.env.DEV;
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// 開発環境でStripeキーが設定されていない場合は無効化
const stripePromise = isDevelopment && !stripeKey ? 
  Promise.resolve(null) : 
  stripeKey ? loadStripe(stripeKey) : Promise.resolve(null);

export { stripePromise };

// 価格設定（税込み対応）
export const STRIPE_PRICES = {
  PREMIUM_YEARLY: {
    priceId: process.env.NODE_ENV === 'production' ? 'price_live_...' : 'price_test_...', // 環境に応じた実際のPriceID
    amount: 900, // $9.00 in cents (税別)
    currency: 'usd',
    interval: 'year',
    displayPrice: '$9.00',
    displayInterval: 'year',
    taxInclusive: false, // 自動税計算対応
    features: [
      'Unlimited trip creation',
      'Advanced sharing features',
      'Password protection',
      'Access analytics',
      'Priority support'
    ]
  }
} as const;

// 税金設定
export const TAX_CONFIG = {
  enabled: true,
  defaultTaxCode: 'txcd_10000000', // SaaS/デジタルサービス
  collectTaxId: false, // 個人事業主・個人向けサービスのため
  automaticTax: true,
  businessType: 'individual' // 個人事業主として設定
} as const;

// Get auth headers for Supabase requests
const getAuthHeaders = async () => {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
};

// Stripe Checkout セッション作成
export const createCheckoutSession = async () => {
  try {
    const { supabase } = await import('./supabase');
    
    const { data, error } = await supabase.functions.invoke('stripe-subscription-management', {
      body: {
        action: 'create_checkout_session',
      }
    });

    if (error) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId, url } = data;
    return { sessionId, url };
  } catch (error) {
    // Error occurred
    throw error;
  }
};

// カスタマーポータルセッション作成
export const createCustomerPortalSession = async () => {
  try {
    const { supabase } = await import('./supabase');
    
    const { data, error } = await supabase.functions.invoke('stripe-subscription-management', {
      body: {
        action: 'create_portal_session',
      }
    });

    if (error) {
      throw new Error('Failed to create portal session');
    }

    const { url } = data;
    return url;
  } catch (error) {
    // Error occurred
    throw error;
  }
};

// サブスクリプション状態確認
export const checkSubscriptionStatus = async () => {
  try {
    const { supabase } = await import('./supabase');
    
    const { data, error } = await supabase.functions.invoke('stripe-subscription-management', {
      body: {
        action: 'check_subscription',
      }
    });

    if (error) {
      throw new Error('Failed to check subscription status');
    }

    return data;
  } catch (error) {
    // Error occurred
    throw error;
  }
};