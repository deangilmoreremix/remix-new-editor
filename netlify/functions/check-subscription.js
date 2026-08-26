// netlify/functions/check-subscription.js
//
// Checks if the current user has an active one-time subscription.
// Used to gate access to the smartvideo viral app.
//
// GET /.netlify/functions/check-subscription
// Header: on-behalf: <user_id>

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getHeader(headers, name) {
  if (!headers) return undefined
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const userId = getHeader(event.headers, 'on-behalf')
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, plan_type, status, billing_interval, started_at')
    .eq('tenant_id', userId)
    .eq('status', 'active')
    .eq('billing_interval', 'one_time')
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[check-subscription] error:', error.message)
    return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      hasAccess: !!data,
      subscription: data || null,
    }),
  }
}
