// netlify/functions/stripe-checkout.js
//
// Creates a Stripe Checkout session for a one-time purchase.
// Accepts { priceId } in the body and returns the checkout URL.
//
// POST /.netlify/functions/stripe-checkout
// Body: { priceId: "price_..." }

const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

const APP_URL = process.env.APP_URL || 'https://smartvid.app'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  if (!body.priceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing priceId' }) }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: body.userId,
      customer_email: body.email,
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/billing?canceled=true`,
      metadata: {
        user_id: body.userId || '',
      },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    console.error('[stripe-checkout] error:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    }
  }
}
