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
  collectTaxId: false, // 個人向けサービスのため
  automaticTax: true
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
    const headers = await getAuthHeaders();
    
    const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/stripe-subscription-management', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create_checkout_session',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId, url } = await response.json();
    return { sessionId, url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// カスタマーポータルセッション作成
export const createCustomerPortalSession = async () => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/stripe-subscription-management', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create_portal_session',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create portal session');
    }

    const { url } = await response.json();
    return url;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
};

// サブスクリプション状態確認
export const checkSubscriptionStatus = async () => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/stripe-subscription-management', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'check_subscription',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to check subscription status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw error;
  }
};