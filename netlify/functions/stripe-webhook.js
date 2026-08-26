// netlify/functions/stripe-webhook.js
//
// Stripe webhook receiver. Verifies the Stripe signature on incoming events
// using STRIPE_WEBHOOK_SECRET, then persists the subscription into Supabase.
//
// Register this endpoint in Stripe Dashboard (Developers -> Webhooks):
//   URL:    https://smartvid.app/.netlify/functions/stripe-webhook
//   Secret: STRIPE_WEBHOOK_SECRET
//   Events: checkout.session.completed

const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getHeader(headers, name) {
  if (!headers) return undefined
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

async function resolveTenant(session) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  const customerEmail = session.customer_details?.email

  if (customerId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('tenant_id')
      .eq('payment_provider_id', customerId)
      .limit(1)
      .single()
    if (data?.tenant_id) return data.tenant_id
  }

  if (customerEmail) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', customerEmail)
      .limit(1)
      .single()
    if (data?.id) return data.id
  }

  if (session.client_reference_id) {
    return session.client_reference_id
  }

  return null
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const sig = getHeader(event.headers, 'stripe-signature')
  if (!sig) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing signature' }) }
  }

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('[stripe-webhook] signature error:', err.message)
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) }
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object

    let tenantId
    try {
      tenantId = await resolveTenant(session)
    } catch (err) {
      console.error('[stripe-webhook] resolveTenant error:', err.message)
    }

    if (!tenantId) {
      console.error('[stripe-webhook] could not resolve tenant for session', session.id)
      return { statusCode: 400, body: JSON.stringify({ error: 'Tenant not found' }) }
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const item = lineItems.data[0]
    const price = item?.price

    if (!price) {
      console.error('[stripe-webhook] no line items for session', session.id)
      return { statusCode: 400, body: JSON.stringify({ error: 'No line items' }) }
    }

    const isRecurring = price.recurring !== null
    const billingInterval = isRecurring
      ? price.recurring?.interval === 'year'
        ? 'yearly'
        : 'monthly'
      : 'one_time'

    const product = price.product
    const productId = typeof product === 'string' ? product : product?.id || 'unknown'
    const productName =
      typeof product === 'string' ? product : product?.name || 'Unknown'

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { error } = await supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan_type: productId,
      status: 'active',
      billing_interval: billingInterval,
      price_amount: (item.amount_total ?? 0) / 100,
      currency: (item.currency ?? 'usd').toUpperCase(),
      payment_provider: 'stripe',
      payment_provider_id: session.id,
      started_at: new Date().toISOString(),
      metadata: {
        stripe_session_id: session.id,
        stripe_customer_id:
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id,
        stripe_price_id: price.id,
        product_name: productName,
      },
    })

    if (error) {
      console.error('[stripe-webhook] supabase insert error:', error.message)
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
