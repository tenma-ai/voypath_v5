import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (request) => {
  const signature = request.headers.get('Stripe-Signature')
  const body = await request.text()
  
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
      undefined,
      cryptoProvider
    )

    // Log: `🔔 Webhook received: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id

        if (userId && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          
          // Update user to premium
          await supabaseClient
            .from('users')
            .update({
              is_premium: true,
              premium_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
            })
            .eq('id', userId)

          // Log: `✅ User ${userId} upgraded to premium`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const { data: user } = await supabaseClient
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (user) {
          const isActive = subscription.status === 'active'
          const premiumExpiresAt = new Date(subscription.current_period_end * 1000).toISOString()

          await supabaseClient
            .from('users')
            .update({
              is_premium: isActive,
              premium_expires_at: isActive ? premiumExpiresAt : null,
              stripe_subscription_id: subscription.id,
            })
            .eq('id', user.id)

          // Log: `✅ User ${user.id} subscription updated: ${subscription.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const { data: user } = await supabaseClient
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (user) {
          await supabaseClient
            .from('users')
            .update({
              is_premium: false,
              premium_expires_at: null,
              stripe_subscription_id: null,
            })
            .eq('id', user.id)

          // Log: `✅ User ${user.id} subscription cancelled`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find user by customer ID
        const { data: user } = await supabaseClient
          .from('users')
          .select('id, email, name')
          .eq('stripe_customer_id', customerId)
          .single()

        if (user) {
          // Log: `❌ Payment failed for user ${user.id}`)
          // Here you could send an email notification or take other actions
        }
        break
      }

      default:
        // Log: `🤷‍♀️ Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    // Error: `❌ Error processing webhook: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})