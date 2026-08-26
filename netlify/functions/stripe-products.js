// netlify/functions/stripe-products.js
//
// Lists all active one-time (and subscription) products from Stripe.
// Used by the pricing/billing UI to dynamically render available upgrades.
//
// GET /.netlify/functions/stripe-products

const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    })

    const products = prices.data
      .filter((price) => price.active)
      .map((price) => {
        const product = price.product
        const isRecurring = price.recurring !== null

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          priceId: price.id,
          amount: (price.unit_amount ?? 0) / 100,
          currency: price.currency.toUpperCase(),
          interval: isRecurring
            ? price.recurring?.interval === 'year'
              ? 'yearly'
              : 'monthly'
            : 'one_time',
        }
      })

    return {
      statusCode: 200,
      body: JSON.stringify({ products }),
    }
  } catch (err) {
    console.error('[stripe-products] error:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch products' }),
    }
  }
}
