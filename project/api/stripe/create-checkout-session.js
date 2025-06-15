const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      priceId, 
      userId, 
      customerEmail, 
      automaticTax = true,
      successUrl,
      cancelUrl 
    } = req.body;

    // 必須パラメータチェック
    if (!priceId || !userId || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required parameters: priceId, userId, customerEmail' 
      });
    }

    // Stripeカスタマー検索または作成
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          userId: userId,
        },
      });
    }

    // Checkoutセッション作成
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      automatic_tax: {
        enabled: automaticTax,
      },
      tax_id_collection: {
        enabled: false, // 個人向けサービスのため無効
      },
      billing_address_collection: 'auto',
      success_url: successUrl || `${req.headers.origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/premium/cancel`,
      metadata: {
        userId: userId,
      },
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}