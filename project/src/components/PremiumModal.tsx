import React, { useState } from 'react';
import { stripePromise, STRIPE_PRICES, TAX_CONFIG } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useStore();

  const handleUpgrade = async () => {
    if (!user) {
      setError('ログインが必要です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Stripe Checkoutセッション作成
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: STRIPE_PRICES.PREMIUM_YEARLY.priceId,
          userId: user.id,
          customerEmail: user.email,
          automaticTax: TAX_CONFIG.automaticTax,
          successUrl: `${window.location.origin}/premium/success`,
          cancelUrl: `${window.location.origin}/premium/cancel`,
        }),
      });

      if (!response.ok) {
        throw new Error('決済セッションの作成に失敗しました');
      }

      const { sessionId } = await response.json();
      
      // Stripeチェックアウトにリダイレクト
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripeの初期化に失敗しました');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (err) {
      console.error('Premium upgrade error:', err);
      setError(err instanceof Error ? err.message : '決済処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Voypath Premium
          </h2>
          
          <div className="mb-6">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {STRIPE_PRICES.PREMIUM_YEARLY.displayPrice}
              <span className="text-lg text-gray-500">/{STRIPE_PRICES.PREMIUM_YEARLY.displayInterval}</span>
            </div>
            <p className="text-sm text-gray-500">
              {TAX_CONFIG.automaticTax && '※税金は地域に応じて自動計算されます'}
            </p>
          </div>

          <div className="text-left mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Premium機能:</h3>
            <ul className="space-y-2">
              {STRIPE_PRICES.PREMIUM_YEARLY.features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              キャンセル
            </button>
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '処理中...' : 'Premiumにアップグレード'}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            安全な決済はStripeによって処理されます
          </p>
        </div>
      </div>
    </div>
  );
};