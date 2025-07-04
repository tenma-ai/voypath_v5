import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json();

    switch (action) {
      case 'create_checkout_session': {
        const priceId = Deno.env.get('STRIPE_PREMIUM_PRICE_ID') || 'price_1QcPqaRvTPXlT0X5TFWa0OGY';
        
        // Get or create Stripe customer
        let stripeCustomerId = null;
        
        // Check if user already has a Stripe customer ID
        const { data: userData } = await supabaseClient
          .from('users')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single();

        if (userData?.stripe_customer_id) {
          stripeCustomerId = userData.stripe_customer_id;
        } else {
          // Create new Stripe customer
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
              supabase_user_id: user.id,
              business_type: 'individual', // 個人事業主として設定
            },
          });
          
          stripeCustomerId = customer.id;
          
          // Save customer ID to database
          await supabaseClient
            .from('users')
            .update({ stripe_customer_id: customer.id })
            .eq('id', user.id);
        }

        // Create checkout session with automatic tax calculation
        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          payment_method_types: ['card'],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: 'subscription',
          success_url: `${req.headers.get('origin')}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.get('origin')}/premium/cancel`,
          automatic_tax: {
            enabled: true,
          },
          customer_update: {
            address: 'auto',
          },
          tax_id_collection: {
            enabled: false, // 個人事業主・個人向けサービスのため
          },
          metadata: {
            user_id: user.id,
          },
        });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_portal_session': {
        const { data: userData } = await supabaseClient
          .from('users')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single();

        if (!userData?.stripe_customer_id) {
          return new Response(
            JSON.stringify({ error: 'No Stripe customer found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: userData.stripe_customer_id,
          return_url: `${req.headers.get('origin')}/profile`,
        });

        return new Response(
          JSON.stringify({ url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check_subscription': {
        const { data: userData } = await supabaseClient
          .from('users')
          .select('stripe_customer_id, stripe_subscription_id, is_premium, premium_expires_at')
          .eq('id', user.id)
          .single();

        if (!userData?.stripe_subscription_id) {
          return new Response(
            JSON.stringify({ 
              is_premium: false,
              status: 'no_subscription'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id);
          
          const isPremium = subscription.status === 'active' || subscription.status === 'trialing';
          const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

          // Update database if status changed
          if (isPremium !== userData.is_premium) {
            await supabaseClient
              .from('users')
              .update({ 
                is_premium: isPremium,
                premium_expires_at: isPremium ? expiresAt : null
              })
              .eq('id', user.id);
          }

          return new Response(
            JSON.stringify({ 
              is_premium: isPremium,
              status: subscription.status,
              expires_at: expiresAt,
              cancel_at_period_end: subscription.cancel_at_period_end
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          // Subscription not found or invalid
          await supabaseClient
            .from('users')
            .update({ 
              is_premium: false,
              premium_expires_at: null,
              stripe_subscription_id: null
            })
            .eq('id', user.id);

          return new Response(
            JSON.stringify({ 
              is_premium: false,
              status: 'invalid_subscription'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    // Error occurred
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});