/**
 * Premium Page Component - Landing page for premium features
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, 
  Check, 
  Star, 
  Shield, 
  Clock, 
  Users, 
  Map, 
  Heart,
  Zap,
  ArrowRight,
  Globe,
  Lock
} from 'lucide-react';
import Navigation from './Navigation';
import Footer from './Footer';

const PremiumPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Redirect to main app for premium upgrade
      window.location.href = 'https://voypath.app/premium';
    } catch (error) {
      console.error('Error starting upgrade:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: 'Password Protected Trips',
      description: 'Secure your shared trips with custom passwords to control access',
      highlight: true
    },
    {
      icon: Clock,
      title: 'Expiry Control',
      description: 'Set expiration dates for shared links to maintain security',
      highlight: true
    },
    {
      icon: Users,
      title: 'Usage Analytics',
      description: 'Track how many times your trips are accessed and by whom',
      highlight: true
    },
    {
      icon: Zap,
      title: 'Advanced AI Optimization',
      description: 'Multiple optimization modes for perfect route planning',
      highlight: false
    },
    {
      icon: Star,
      title: 'Priority Support',
      description: '24/7 dedicated customer support with priority response',
      highlight: false
    },
    {
      icon: Globe,
      title: 'Unlimited Trips',
      description: 'Create as many trips as you want without limitations',
      highlight: false
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Travel Blogger',
      content: 'Premium features made our group trip planning so much easier and secure!',
      rating: 5
    },
    {
      name: 'Mike Rodriguez',
      role: 'Event Organizer',
      content: 'The password protection is perfect for organizing private corporate trips.',
      rating: 5
    },
    {
      name: 'Emma Thompson',
      role: 'Family Coordinator',
      content: 'Advanced optimization saved us hours of planning our European vacation.',
      rating: 5
    }
  ];

  const plans = [
    {
      name: 'Basic',
      price: 'Free',
      description: 'Perfect for simple trip planning',
      features: [
        'Up to 3 trips',
        'Basic route optimization',
        'Standard sharing',
        'Community support'
      ],
      current: true
    },
    {
      name: 'Premium',
      price: '$9.99/month',
      description: 'For serious travelers and organizers',
      features: [
        'Unlimited trips',
        'Password protection',
        'Expiry control',
        'Usage analytics',
        'Advanced AI optimization',
        'Priority support'
      ],
      popular: true
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-pink-600 bg-clip-text text-transparent">
                Voypath Premium
              </h1>
            </div>
            
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              Unlock powerful features for secure, advanced trip planning with your team
            </p>

            <motion.button
              onClick={handleUpgrade}
              disabled={loading}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 inline-flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <>
                  <Crown className="w-6 h-6" />
                  <span>Upgrade to Premium</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
              30-day money-back guarantee • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Premium Features
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Everything you need for professional trip planning
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-2xl ${
                    feature.highlight
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/30'
                      : 'bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    feature.highlight
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                  {feature.highlight && (
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full dark:bg-amber-900/50 dark:text-amber-200">
                        <Lock className="w-3 h-3 mr-1" />
                        Premium Only
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Choose the plan that works for you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                className={`relative p-8 rounded-2xl border-2 ${
                  plan.popular
                    ? 'border-amber-500 bg-white dark:bg-slate-900 shadow-2xl scale-105'
                    : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {plan.price}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={plan.current ? undefined : handleUpgrade}
                  disabled={plan.current || loading}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl'
                      : plan.current
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900'
                  }`}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade Now'}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              What Our Premium Users Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl"
              >
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {testimonial.role}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-amber-500 via-orange-500 to-pink-500">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Upgrade Your Travel Planning?
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Join thousands of travelers who plan smarter with Voypath Premium
            </p>
            
            <motion.button
              onClick={handleUpgrade}
              disabled={loading}
              className="bg-white hover:bg-slate-100 text-amber-600 font-bold py-4 px-8 rounded-2xl text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 inline-flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <>
                  <Crown className="w-6 h-6" />
                  <span>Start Your Premium Journey</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
            
            <p className="text-sm text-white/80 mt-4">
              30-day money-back guarantee • No setup fees • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PremiumPage;