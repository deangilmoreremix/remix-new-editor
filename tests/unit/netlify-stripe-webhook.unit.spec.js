// tests/unit/netlify-stripe-webhook.unit.spec.js
//
// Unit tests for netlify/functions/stripe-webhook.js — the Stripe ->
// entitlement fulfillment webhook.
//
// The stripe SDK, the Clerk backend client and the Supabase client are all
// mocked; no network calls happen. Env vars are read per request by the
// handler, so each test configures process.env directly.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

// Fixed event timestamp (unix seconds) so replay comparisons are deterministic.
const EVENT_CREATED = 1_760_000_000;

const state = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSession: vi.fn(),
  getUserList: vi.fn(),
  updateUser: vi.fn(),
  supabaseCalls: [],
  supabase: {
    // Row returned by the stripe_events dedupe lookup (null = not processed).
    stripeEventsRow: null,
    // Error message to simulate a missing stripe_events table.
    stripeEventsError: null,
    upsertError: null,
  },
}));

vi.mock('stripe', () => ({
  default: class Stripe {
    constructor(secretKey) {
      this.secretKey = secretKey;
    }

    webhooks = { constructEvent: state.constructEvent };

    checkout = { sessions: { retrieve: state.retrieveSession } };
  },
}));

// The mocked Clerk client intentionally exposes no user-creation API: if the
// webhook tried to create a user this mock would throw and the handler 500.
vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    users: {
      getUserList: state.getUserList,
      updateUser: state.updateUser,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => {
          state.supabaseCalls.push({ table, op: 'maybeSingle' });
          if (state.supabase.stripeEventsError) {
            return { data: null, error: { message: state.supabase.stripeEventsError } };
          }
          return { data: state.supabase.stripeEventsRow, error: null };
        }),
        upsert: vi.fn(async (row, options) => {
          state.supabaseCalls.push({
            table, op: 'upsert', row, options,
          });
          return { error: state.supabase.upsertError };
        }),
      };
      return builder;
    },
  })),
}));

const { handler } = await import('../../netlify/functions/stripe-webhook');

const ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CLERK_SECRET_KEY',
  'STRIPE_PRICE_ENTITLEMENT_MAP',
  'STRIPE_DEFAULT_ENTITLEMENT',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function configureEnv(overrides = {}) {
  const config = {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    CLERK_SECRET_KEY: 'sk_test_clerk',
    STRIPE_PRICE_ENTITLEMENT_MAP: '{"price_lifetime_199":"legacy_access"}',
    STRIPE_DEFAULT_ENTITLEMENT: 'legacy_access',
    ...overrides,
  };
  ENV_KEYS.forEach((key) => {
    const value = config[key];
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = value;
  });
}

function buildStripeEvent(type, object, overrides = {}) {
  return {
    id: overrides.id || `evt_${type}_1`,
    object: 'event',
    type,
    created: overrides.created === undefined ? EVENT_CREATED : overrides.created,
    data: { object },
  };
}

function buildRequest(stripeEvent, { signature = 'sig_valid' } = {}) {
  return {
    httpMethod: 'POST',
    headers: { 'stripe-signature': signature },
    body: JSON.stringify(stripeEvent),
    isBase64Encoded: false,
  };
}

function session(overrides = {}) {
  return {
    id: 'cs_test_1',
    object: 'checkout.session',
    customer_details: { email: 'buyer@example.com' },
    metadata: {},
    ...overrides,
  };
}

function clerkUser(publicMetadata = {}) {
  return { id: 'user_123', publicMetadata };
}

function errorLogged() {
  return console.error.mock.calls.some((call) => String(call[0]).includes('[stripe-webhook]'));
}

beforeEach(() => {
  state.constructEvent.mockReset();
  state.retrieveSession.mockReset();
  state.getUserList.mockReset();
  state.updateUser.mockReset();
  state.supabaseCalls.length = 0;
  state.supabase.stripeEventsRow = null;
  state.supabase.stripeEventsError = null;
  state.supabase.upsertError = null;
  state.constructEvent.mockImplementation((raw, signature) => {
    if (signature !== 'sig_valid') {
      throw new Error('No signatures found matching the expected signature for this payload');
    }
    return JSON.parse(raw);
  });
  configureEnv();
  console.error.mockClear();
});

describe('netlify/functions/stripe-webhook — grants', () => {
  it('grants legacy_access on checkout.session.completed for an existing Clerk user', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
    )));

    expect(res.statusCode).toBe(200);
    expect(state.getUserList).toHaveBeenCalledWith({ emailAddress: ['buyer@example.com'] });
    expect(state.updateUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = state.updateUser.mock.calls[0];
    expect(userId).toBe('user_123');
    expect(payload.publicMetadata.legacy_access).toBe(true);
    expect(payload.publicMetadata.entitlement_key).toBe('legacy_access');
    expect(payload.publicMetadata.entitlement_source).toBe('price_map:price_lifetime_199');
  });

  it('resolves the price through the Stripe API when the payload omits line items', async () => {
    state.retrieveSession.mockResolvedValue({
      line_items: { data: [{ price: { id: 'price_lifetime_199' } }] },
    });
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent('checkout.session.completed', session())));

    expect(res.statusCode).toBe(200);
    expect(state.retrieveSession).toHaveBeenCalledWith('cs_test_1', { expand: ['line_items'] });
    expect(state.updateUser.mock.calls[0][1].publicMetadata.entitlement_source)
      .toBe('price_map:price_lifetime_199');
  });

  it('prioritises session metadata.entitlement over the price map', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199', entitlement: 'custom_key' } }),
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser.mock.calls[0][1].publicMetadata.entitlement_key).toBe('custom_key');
    expect(state.updateUser.mock.calls[0][1].publicMetadata.entitlement_source)
      .toBe('metadata.entitlement');
  });

  it('falls back to STRIPE_DEFAULT_ENTITLEMENT for an unmapped price', async () => {
    state.retrieveSession.mockResolvedValue({
      line_items: { data: [{ price: { id: 'price_not_in_map' } }] },
    });
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent('checkout.session.completed', session())));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser.mock.calls[0][1].publicMetadata.legacy_access).toBe(true);
    expect(state.updateUser.mock.calls[0][1].publicMetadata.entitlement_key).toBe('legacy_access');
    expect(state.updateUser.mock.calls[0][1].publicMetadata.entitlement_source)
      .toBe('STRIPE_DEFAULT_ENTITLEMENT');
  });

  it('grants on payment_intent.succeeded using the receipt email', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent(
      'payment_intent.succeeded',
      {
        id: 'pi_test_1', object: 'payment_intent', receipt_email: 'buyer@example.com', metadata: {},
      },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.getUserList).toHaveBeenCalledWith({ emailAddress: ['buyer@example.com'] });
    expect(state.updateUser.mock.calls[0][1].publicMetadata.legacy_access).toBe(true);
    // PaymentIntent objects carry no line items — the default entitlement applies.
    expect(state.updateUser.mock.calls[0][1].publicMetadata.entitlement_source)
      .toBe('STRIPE_DEFAULT_ENTITLEMENT');
    expect(state.retrieveSession).not.toHaveBeenCalled();
  });

  it('treats payment_intent.succeeded for an already-granted user as an idempotent no-op', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser({ legacy_access: true })] });

    const res = await handler(buildRequest(buildStripeEvent(
      'payment_intent.succeeded',
      {
        id: 'pi_test_2', object: 'payment_intent', receipt_email: 'buyer@example.com', metadata: {},
      },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.getUserList).toHaveBeenCalledTimes(1);
    expect(state.updateUser).not.toHaveBeenCalled();
  });

  it('does not grant and returns 200 when no entitlement key can be resolved', async () => {
    configureEnv({ STRIPE_DEFAULT_ENTITLEMENT: '' });
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_not_in_map' } }),
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.getUserList).not.toHaveBeenCalled();
    expect(errorLogged()).toBe(true);
  });

  it('returns 200 without granting when the purchase carries no email', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      { id: 'cs_no_email', object: 'checkout.session', metadata: { price_id: 'price_lifetime_199' } },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(errorLogged()).toBe(true);
  });

  it('decodes a base64 body before signature verification', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });
    const stripeEvent = buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
    );

    const res = await handler({
      httpMethod: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: Buffer.from(JSON.stringify(stripeEvent), 'utf8').toString('base64'),
      isBase64Encoded: true,
    });

    expect(res.statusCode).toBe(200);
    expect(state.constructEvent.mock.calls[0][0]).toBe(JSON.stringify(stripeEvent));
    expect(state.updateUser).toHaveBeenCalledTimes(1);
  });
});

describe('netlify/functions/stripe-webhook — signature + config', () => {
  it('returns 400 when the Stripe signature is invalid', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(
      buildStripeEvent('checkout.session.completed', session()),
      { signature: 'sig_tampered' },
    ));

    expect(res.statusCode).toBe(400);
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.getUserList).not.toHaveBeenCalled();
  });

  it('returns 400 when the stripe-signature header is missing', async () => {
    const res = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify(buildStripeEvent('checkout.session.completed', session())),
      isBase64Encoded: false,
    });

    expect(res.statusCode).toBe(400);
    expect(state.constructEvent).not.toHaveBeenCalled();
  });

  it('returns 500 when STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing', async () => {
    configureEnv({ STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined });

    const res = await handler(buildRequest(buildStripeEvent('checkout.session.completed', session())));

    expect(res.statusCode).toBe(500);
    expect(state.constructEvent).not.toHaveBeenCalled();
    expect(errorLogged()).toBe(true);
  });

  it('returns 500 when CLERK_SECRET_KEY is missing', async () => {
    configureEnv({ CLERK_SECRET_KEY: undefined });

    const res = await handler(buildRequest(buildStripeEvent('checkout.session.completed', session())));

    expect(res.statusCode).toBe(500);
    expect(state.updateUser).not.toHaveBeenCalled();
  });

  it('returns 405 for non-POST requests', async () => {
    const res = await handler({ httpMethod: 'GET', headers: {}, body: '' });

    expect(res.statusCode).toBe(405);
    expect(state.constructEvent).not.toHaveBeenCalled();
  });

  it('returns 200 and does nothing for unhandled event types', async () => {
    const res = await handler(buildRequest(buildStripeEvent(
      'customer.subscription.created',
      { id: 'sub_1', object: 'subscription' },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.getUserList).not.toHaveBeenCalled();
  });

  it('supports the Netlify Functions 2.x default-export Request adapter', async () => {
    const { default: defaultExport } = await import('../../netlify/functions/stripe-webhook');
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });
    const stripeEvent = buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
    );

    const res = await defaultExport(new Request('https://smartvid.app/.netlify/functions/stripe-webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_valid' },
      body: JSON.stringify(stripeEvent),
    }));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).toHaveBeenCalledTimes(1);
  });
});

describe('netlify/functions/stripe-webhook — refunds + idempotency', () => {
  it('revokes legacy_access on charge.refunded', async () => {
    state.getUserList.mockResolvedValue({ data: [clerkUser({ legacy_access: true })] });

    const res = await handler(buildRequest(buildStripeEvent(
      'charge.refunded',
      { id: 'ch_test_1', object: 'charge', billing_details: { email: 'buyer@example.com' } },
    )));

    expect(res.statusCode).toBe(200);
    const [userId, payload] = state.updateUser.mock.calls[0];
    expect(userId).toBe('user_123');
    expect(payload.publicMetadata.legacy_access).toBe(false);
    expect(payload.publicMetadata.legacy_access_revoked_at)
      .toBe(new Date(EVENT_CREATED * 1000).toISOString());
  });

  it('does not re-grant when a replayed completed event predates the refund', async () => {
    state.getUserList.mockResolvedValue({
      data: [clerkUser({
        legacy_access: false,
        legacy_access_revoked_at: new Date(EVENT_CREATED * 1000).toISOString(),
      })],
    });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
      { created: EVENT_CREATED - 3600, id: 'evt_replayed_grant' },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
  });

  it('re-grants when a newer purchase arrives after the refund', async () => {
    state.getUserList.mockResolvedValue({
      data: [clerkUser({
        legacy_access: false,
        legacy_access_revoked_at: new Date(EVENT_CREATED * 1000).toISOString(),
      })],
    });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
      { created: EVENT_CREATED + 86400, id: 'evt_newer_grant' },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).toHaveBeenCalledTimes(1);
    expect(state.updateUser.mock.calls[0][1].publicMetadata.legacy_access).toBe(true);
  });

  it('skips a duplicate delivery already recorded in stripe_events', async () => {
    configureEnv({
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });
    state.supabase.stripeEventsRow = { event_id: 'evt_checkout.session.completed_1' };
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent('checkout.session.completed', session())));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.getUserList).not.toHaveBeenCalled();
  });

  it('falls back to the Clerk-state guard when the stripe_events table is absent', async () => {
    configureEnv({
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });
    state.supabase.stripeEventsError = 'relation "public.stripe_events" does not exist';
    state.getUserList.mockResolvedValue({ data: [clerkUser()] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).toHaveBeenCalledTimes(1);
  });
});

describe('netlify/functions/stripe-webhook — pending grants', () => {
  it('records a pending grant in the users table when no Clerk user matches', async () => {
    configureEnv({
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });
    state.getUserList.mockResolvedValue({ data: [] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
    const pendingWrite = state.supabaseCalls.find((c) => c.table === 'users' && c.op === 'upsert');
    expect(pendingWrite).toBeDefined();
    expect(pendingWrite.row.clerk_id).toBe('pending:buyer@example.com');
    expect(pendingWrite.row.email).toBe('buyer@example.com');
    expect(pendingWrite.row.name)
      .toBe('stripe_pending_grant:legacy_access:evt_checkout.session.completed_1');
  });

  it('never creates a Clerk user when the buyer has no account and Supabase is unset', async () => {
    state.getUserList.mockResolvedValue({ data: [] });

    const res = await handler(buildRequest(buildStripeEvent(
      'checkout.session.completed',
      session({ metadata: { price_id: 'price_lifetime_199' } }),
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.getUserList).toHaveBeenCalledTimes(1);
    // No user-creation path exists on the mocked Clerk client: a create attempt
    // would throw and surface as a 500.
    expect(errorLogged()).toBe(true);
  });

  it('treats a refund for a user without a Clerk account as a no-op', async () => {
    state.getUserList.mockResolvedValue({ data: [] });

    const res = await handler(buildRequest(buildStripeEvent(
      'charge.refunded',
      { id: 'ch_test_2', object: 'charge', billing_details: { email: 'buyer@example.com' } },
    )));

    expect(res.statusCode).toBe(200);
    expect(state.updateUser).not.toHaveBeenCalled();
  });
});
