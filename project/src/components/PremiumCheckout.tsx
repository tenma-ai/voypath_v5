import React, { useState } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { Crown, Check, Zap, Star, Shield, Sparkles, CreditCard, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { STRIPE_PRICES, createCheckoutSession } from '../lib/stripe';
import { useStore } from '../store/useStore';

interface PremiumCheckoutProps {
  onClose: () => void;
}

export function PremiumCheckout({ onClose }: PremiumCheckoutProps) {
  const stripe = useStripe();
  const { user } = useStore();
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans = [
    {
      id: 'yearly' as const,
      name: 'Yearly Plan',
      price: STRIPE_PRICES.PREMIUM_YEARLY,
      popular: true,
      description: 'Best value for serious travelers',
      features: [
        'Unlimited trips and places',
        'Unlimited group members',
        'Advanced route optimization',
        'Priority customer support',
        'Offline access',
        'Premium themes',
        'Export trip data',
        'Early access to new features'
      ]
    },
    {
      id: 'monthly' as const,
      name: 'Monthly Plan',
      price: STRIPE_PRICES.PREMIUM_MONTHLY,
      popular: false,
      description: 'Perfect for occasional travelers',
      features: [
        'Unlimited trips and places',
        'Unlimited group members',
        'Advanced route optimization',
        'Standard customer support',
        'Basic themes'
      ]
    }
  ];

  const handleCheckout = async () => {
    if (!stripe || !user) {
      setError('Stripe is not loaded or user not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const priceId = selectedPlan === 'yearly' 
        ? STRIPE_PRICES.PREMIUM_YEARLY.priceId 
        : STRIPE_PRICES.PREMIUM_MONTHLY.priceId;

      const sessionId = await createCheckoutSession(priceId, user.id);

      const { error } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (error) {
        setError(error.message || 'An error occurred during checkout');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPlanData = plans.find(plan => plan.id === selectedPlan)!;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center space-x-3 mb-4"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-glow">
            <Crown className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
            Upgrade to Premium
          </h1>
        </motion.div>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Unlock unlimited travel planning power and take your adventures to the next level
        </p>
      </div>

      {/* Plan Selection */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => setSelectedPlan(plan.id)}
            className={`relative cursor-pointer rounded-3xl p-6 border-2 transition-all duration-300 ${
              selectedPlan === plan.id
                ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 shadow-glow'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
            }`}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-glow">
                  <Star className="w-4 h-4 inline mr-1" />
                  Most Popular
                </div>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {plan.name}
              </h3>
              <div className="flex items-baseline justify-center space-x-2 mb-2">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                  {plan.price.displayPrice}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  /{plan.price.displayInterval}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                {plan.description}
              </p>
            </div>

            <div className="space-y-3">
              {plan.features.map((feature, featureIndex) => (
                <motion.div
                  key={featureIndex}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + featureIndex * 0.05 }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 text-sm">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>

            {selectedPlan === plan.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 right-4"
              >
                <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Security & Trust */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8"
      >
        <div className="flex items-center justify-center space-x-8 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-green-500" />
            <span>SSL Encrypted</span>
          </div>
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-blue-500" />
            <span>Secure Payment</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span>Instant Activation</span>
          </div>
        </div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6"
        >
          <p className="text-red-700 dark:text-red-300 text-center">{error}</p>
        </motion.div>
      )}

      {/* Checkout Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center"
      >
        <motion.button
          onClick={handleCheckout}
          disabled={isLoading || !stripe}
          className="w-full max-w-md mx-auto px-8 py-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 text-black rounded-2xl font-bold text-lg shadow-glow hover:shadow-glow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <span className="relative z-10 flex items-center justify-center space-x-3">
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                <span>Subscribe to {selectedPlanData.name}</span>
                <Sparkles className="w-5 h-5" />
              </>
            )}
          </span>
        </motion.button>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 max-w-md mx-auto">
          By subscribing, you agree to our Terms of Service and Privacy Policy. 
          You can cancel anytime from your account settings.
        </p>
      </motion.div>

      {/* Money Back Guarantee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-6"
      >
        <div className="inline-flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-2 rounded-full text-sm font-semibold">
          <Shield className="w-4 h-4" />
          <span>30-day money-back guarantee</span>
        </div>
      </motion.div>
    </div>
  );
}