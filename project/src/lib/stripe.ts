import { loadStripe } from '@stripe/stripe-js';

// Stripeの公開可能キーを環境変数から取得（開発環境では無効化）
const isDevelopment = import.meta.env.DEV;
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// 開発環境でStripeキーが設定されていない場合は無効化
const stripePromise = isDevelopment && !stripeKey ? 
  Promise.resolve(null) : 
  loadStripe(stripeKey || 'pk_test_demo_key');

export { stripePromise };

// 価格設定（税込み対応）
export const STRIPE_PRICES = {
  PREMIUM_YEARLY: {
    priceId: 'price_1234567890', // 実際のStripe価格IDに置き換える
    amount: 900, // $9.00 in cents (税別)
    currency: 'usd',
    interval: 'year',
    displayPrice: '$9.00',
    displayInterval: 'year',
    taxInclusive: false, // 自動税計算対応
    features: [
      '無制限旅行作成',
      '高度な共有機能',
      'パスワード保護',
      'アクセス解析',
      '優先サポート'
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

// Stripe Checkout セッション作成
export const createCheckoutSession = async (priceId: string, userId: string) => {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        successUrl: `${window.location.origin}/premium/success`,
        cancelUrl: `${window.location.origin}/premium/cancel`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId } = await response.json();
    return sessionId;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// カスタマーポータルセッション作成
export const createCustomerPortalSession = async (customerId: string) => {
  try {
    const response = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/profile`,
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