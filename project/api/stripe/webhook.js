const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Webhookの署名検証
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // イベント処理
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Checkoutセッション完了時の処理
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!userId) {
    console.error('Missing userId in checkout session metadata');
    return;
  }

  // ユーザーのPremiumステータス更新
  const { error } = await supabase
    .from('users')
    .update({
      is_premium: true,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      premium_expires_at: null, // サブスクリプションなので無期限
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update user premium status:', error);
    throw error;
  }

  console.log(`User ${userId} upgraded to Premium`);
}

// サブスクリプション作成時の処理
async function handleSubscriptionCreated(subscription) {
  const userId = subscription.metadata?.userId;
  const customerId = subscription.customer;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  // サブスクリプション情報の記録
  const { error } = await supabase
    .from('users')
    .update({
      is_premium: true,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      premium_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to record subscription:', error);
    throw error;
  }

  console.log(`Subscription created for user ${userId}`);
}

// サブスクリプション更新時の処理
async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  const isActive = subscription.status === 'active';

  // サブスクリプションステータスの更新
  const { error } = await supabase
    .from('users')
    .update({
      is_premium: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to update subscription status:', error);
    throw error;
  }

  console.log(`Subscription ${subscription.id} updated: ${subscription.status}`);
}

// サブスクリプション削除時の処理
async function handleSubscriptionDeleted(subscription) {
  // Premiumステータスの無効化
  const { error } = await supabase
    .from('users')
    .update({
      is_premium: false,
      premium_expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to deactivate premium status:', error);
    throw error;
  }

  console.log(`Subscription ${subscription.id} cancelled`);
}

// 支払い成功時の処理
async function handleInvoicePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;

  // サブスクリプション継続確認
  const { error } = await supabase
    .from('users')
    .update({
      is_premium: true,
      last_payment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('Failed to confirm payment:', error);
    throw error;
  }

  console.log(`Payment succeeded for subscription ${subscriptionId}`);
}

// 支払い失敗時の処理
async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;

  // 支払い失敗の記録（即座にPremiumを無効化しない）
  console.log(`Payment failed for subscription ${subscriptionId}`);
  
  // 必要に応じて通知やリトライ処理を実装
}

// Vercel用の設定
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};