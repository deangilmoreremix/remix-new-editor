/**
 * personalization-discovery.test.js
 *
 * Unit tests for the Netlify function that exposes the EXISTING discovery
 * engine. The engine is mocked at the module boundary the function imports
 * it from (the function dynamic-imports
 * `../../src/components/personalize/discovery/...`; from this test file the
 * same module is `../../../src/...`), and the Supabase client (auth
 * verification + durable job rows) is mocked too, so no network or real
 * backend is involved.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mocked discovery engine ──────────────────────────────────────────────

const discoverAssets = vi.fn(() => ({ jobId: 'job-1', status: 'pending' }));
const getJobStatus = vi.fn(() => ({ status: 'pending', errors: [] }));
const cancelJob = vi.fn(() => true);
const validateUrl = vi.fn(async () => ({ safe: true, normalized: 'https://s.test/', addresses: ['93.184.216.34'] }));

vi.mock('../../../src/components/personalize/discovery/index.js', () => ({
  discoverAssets: (...args) => discoverAssets(...args),
  getJobStatus: (...args) => getJobStatus(...args),
  cancelJob: (...args) => cancelJob(...args),
}));

vi.mock('../../../src/components/personalize/discovery/urlSafety.js', () => ({
  validateUrl: (...args) => validateUrl(...args),
}));

// ─── Mocked Supabase (auth verification + durable job rows) ───────────────

const getUser = vi.fn();
const upsert = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ upsert, select }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: (token) => getUser(token) }, from: (...args) => from(...args) }),
}));

const { handler } = await import('../personalization-discovery.js');

// ─── Harness ──────────────────────────────────────────────────────────────

/** The durable row the mocked Supabase layer returns on reads. */
let durableRow;

function makeEvent({ method = 'GET', query, body, headers = {} } = {}) {
  return {
    httpMethod: method,
    queryStringParameters: query,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

const AUTH_HEADERS = { authorization: 'Bearer good-token' };

function parseBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  durableRow = null;
  maybeSingle.mockImplementation(async () => ({ data: durableRow, error: null }));
  discoverAssets.mockClear();
  discoverAssets.mockImplementation(() => ({ jobId: 'job-1', status: 'pending' }));
  getJobStatus.mockClear();
  getJobStatus.mockImplementation(() => ({ status: 'pending', errors: [] }));
  cancelJob.mockClear();
  cancelJob.mockImplementation(() => true);
  validateUrl.mockClear();
  validateUrl.mockImplementation(async () => ({ safe: true, normalized: 'https://s.test/', addresses: ['93.184.216.34'] }));
  getUser.mockClear();
  getUser.mockImplementation(async (token) => (
    token === 'good-token'
      ? { data: { user: { id: 'user-1' } }, error: null }
      : { data: { user: null }, error: { message: 'invalid token' } }
  ));
  upsert.mockClear();
  from.mockClear();
  select.mockClear();
  // Enable the durable layer (createClient itself is mocked).
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  delete process.env.PERSONALIZATION_DISCOVERY_SECRET;
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Auth ─────────────────────────────────────────────────────────────────

describe('auth', () => {
  it('answers CORS preflight without authentication', async () => {
    const res = await handler(makeEvent({ method: 'OPTIONS' }));
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('DELETE');
  });

  it('rejects a POST without an Authorization header', async () => {
    const res = await handler(makeEvent({ method: 'POST', body: { url: 'https://s.test' } }));
    expect(res.statusCode).toBe(401);
    expect(discoverAssets).not.toHaveBeenCalled();
  });

  it('rejects a POST with an invalid token', async () => {
    const res = await handler(makeEvent({
      method: 'POST',
      headers: { authorization: 'Bearer bad-token' },
      body: { url: 'https://s.test' },
    }));
    expect(res.statusCode).toBe(401);
    expect(discoverAssets).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated GET / DELETE', async () => {
    expect((await handler(makeEvent({ query: { jobId: 'job-1' } }))).statusCode).toBe(401);
    expect((await handler(makeEvent({ method: 'DELETE', query: { jobId: 'job-1' } }))).statusCode).toBe(401);
  });

  it('accepts the internal shared secret when configured', async () => {
    process.env.PERSONALIZATION_DISCOVERY_SECRET = 'internal-secret';
    const ok = await handler(makeEvent({
      method: 'POST',
      headers: { 'X-Discovery-Secret': 'internal-secret' },
      body: { url: 'https://s.test' },
    }));
    expect(ok.statusCode).toBe(200);
    expect(parseBody(ok)).toEqual({ jobId: 'job-1', status: 'pending' });

    const wrong = await handler(makeEvent({
      method: 'POST',
      headers: { 'x-discovery-secret': 'nope' },
      body: { url: 'https://s.test' },
    }));
    expect(wrong.statusCode).toBe(401);
  });
});

// ─── POST (start) ─────────────────────────────────────────────────────────

describe('POST starts a discovery job', () => {
  it('validates the url with the engine, enqueues and returns a jobId', async () => {
    const res = await handler(makeEvent({
      method: 'POST',
      headers: AUTH_HEADERS,
      body: { url: 'https://s.test' },
    }));
    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual({ jobId: 'job-1', status: 'pending' });
    expect(validateUrl).toHaveBeenCalledWith('https://s.test');
    expect(discoverAssets).toHaveBeenCalledWith('https://s.test');
    // Durable mirror written (pending) for the authenticated caller.
    expect(from).toHaveBeenCalledWith('personalization_discovery_jobs');
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row] = upsert.mock.calls[0];
    expect(row).toMatchObject({ id: 'job-1', user_id: 'user-1', status: 'pending', url: 'https://s.test' });
  });

  it('rejects a missing url with 400', async () => {
    const res = await handler(makeEvent({ method: 'POST', headers: AUTH_HEADERS, body: {} }));
    expect(res.statusCode).toBe(400);
    expect(parseBody(res).error).toBe('url is required');
    expect(discoverAssets).not.toHaveBeenCalled();
  });

  it('rejects a non-string url with 400', async () => {
    const res = await handler(makeEvent({ method: 'POST', headers: AUTH_HEADERS, body: { url: 42 } }));
    expect(res.statusCode).toBe(400);
  });

  it('rejects a non-http(s) scheme with 400', async () => {
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: { url: 'ftp://files.example.com' },
    }));
    expect(res.statusCode).toBe(400);
    expect(parseBody(res).error).toBe('UNSAFE_URL');
    expect(parseBody(res).reason).toContain('http:// or https://');
    expect(discoverAssets).not.toHaveBeenCalled();
  });

  it('rejects an over-long url with 400', async () => {
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: { url: `https://s.test/${'a'.repeat(2100)}` },
    }));
    expect(res.statusCode).toBe(400);
    expect(parseBody(res).reason).toContain('2048');
  });

  it('surfaces the engine SSRF rejection reason verbatim with 400', async () => {
    validateUrl.mockImplementation(async () => ({
      safe: false,
      reason: 'Hostname resolves to private IP 127.0.0.1',
    }));
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: { url: 'http://localhost' },
    }));
    expect(res.statusCode).toBe(400);
    expect(parseBody(res).error).toBe('UNSAFE_URL');
    expect(parseBody(res).reason).toBe('Hostname resolves to private IP 127.0.0.1');
    expect(discoverAssets).not.toHaveBeenCalled();
  });

  it('reports a blocked social domain verbatim with 400', async () => {
    discoverAssets.mockImplementation(() => ({
      error: 'UNSUPPORTED_DOMAIN',
      message: 'Domain "facebook.com" is not supported',
    }));
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: { url: 'https://facebook.com' },
    }));
    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toEqual({ error: 'UNSUPPORTED_DOMAIN', message: 'Domain "facebook.com" is not supported' });
  });

  it('reports the concurrent job limit with 429', async () => {
    discoverAssets.mockImplementation(() => ({
      error: 'JOB_LIMIT_REACHED',
      message: 'Concurrent job limit (3) reached',
    }));
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: { url: 'https://s.test' },
    }));
    expect(res.statusCode).toBe(429);
    expect(parseBody(res).message).toBe('Concurrent job limit (3) reached');
  });

  it('rejects an invalid JSON body with 400', async () => {
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: undefined,
    }));
    // No body at all is treated as an empty object → url required.
    expect(res.statusCode).toBe(400);
    const res2 = await handler({
      httpMethod: 'POST',
      headers: AUTH_HEADERS,
      body: '{not json',
    });
    expect(res2.statusCode).toBe(400);
    expect(parseBody(res2).error).toBe('Invalid JSON body');
  });
});

// ─── GET (status) ─────────────────────────────────────────────────────────

describe('GET returns job status', () => {
  it('maps the engine completed status to done and flattens assets', async () => {
    getJobStatus.mockImplementation(() => ({
      status: 'completed',
      errors: [],
      found: {
        logos: ['https://s.test/logo.png'],
        products: ['https://s.test/product.png'],
        brandReferences: [],
        urls: [],
      },
    }));
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(res.statusCode).toBe(200);
    const body = parseBody(res);
    expect(body.jobId).toBe('job-1');
    expect(body.status).toBe('done');
    expect(body.errors).toEqual([]);
    expect(body.found.logos).toEqual(['https://s.test/logo.png']);
    expect(body.assets).toEqual([
      { url: 'https://s.test/logo.png', category: 'logos', role: 'logo' },
      { url: 'https://s.test/product.png', category: 'products', role: 'product_reference' },
    ]);
  });

  it('returns non-terminal statuses as-is', async () => {
    getJobStatus.mockImplementation(() => ({ status: 'running', errors: [] }));
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(parseBody(res).status).toBe('running');
    expect(parseBody(res).assets).toEqual([]);
  });

  it('requires a jobId', async () => {
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: {} }));
    expect(res.statusCode).toBe(400);
    expect(parseBody(res).error).toBe('jobId is required');
  });

  it('returns 404 not_found for an unknown jobId', async () => {
    getJobStatus.mockImplementation(() => ({ status: 'not_found', errors: [] }));
    durableRow = null;
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: { jobId: 'nope' } }));
    expect(res.statusCode).toBe(404);
    expect(parseBody(res).status).toBe('not_found');
  });

  it('falls back to the durable record after the engine GCs the job', async () => {
    getJobStatus.mockImplementation(() => ({ status: 'not_found', errors: [] }));
    durableRow = {
      id: 'job-1',
      user_id: 'user-1',
      url: 'https://s.test',
      status: 'done',
      found: { logos: ['https://s.test/logo.png'], products: [], brandReferences: [], urls: [] },
      errors: [],
    };
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(res.statusCode).toBe(200);
    const body = parseBody(res);
    expect(body.status).toBe('done');
    expect(body.assets[0]).toEqual({ url: 'https://s.test/logo.png', category: 'logos', role: 'logo' });
  });

  it('reports unknown for a durable row whose engine record was lost (cold instance)', async () => {
    getJobStatus.mockImplementation(() => ({ status: 'not_found', errors: [] }));
    durableRow = { id: 'job-1', user_id: 'user-1', url: 'https://s.test', status: 'running', found: null, errors: [] };
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(res.statusCode).toBe(200);
    expect(parseBody(res).status).toBe('unknown');
  });

  it('never leaks another caller\'s job', async () => {
    getJobStatus.mockImplementation(() => ({ status: 'not_found', errors: [] }));
    durableRow = { id: 'job-1', user_id: 'someone-else', url: 'https://s.test', status: 'done', found: null, errors: [] };
    const res = await handler(makeEvent({ headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(res.statusCode).toBe(404);
  });
});

// ─── DELETE / cancel ──────────────────────────────────────────────────────

describe('cancelling jobs', () => {
  it('cancels via DELETE and mirrors the durable row', async () => {
    durableRow = { id: 'job-1', user_id: 'user-1', url: 'https://s.test', status: 'running', found: null, errors: [] };
    const res = await handler(makeEvent({ method: 'DELETE', headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual({ jobId: 'job-1', status: 'cancelled' });
    expect(cancelJob).toHaveBeenCalledWith('job-1');
  });

  it('cancels via POST action:cancel', async () => {
    const res = await handler(makeEvent({
      method: 'POST', headers: AUTH_HEADERS, body: { action: 'cancel', jobId: 'job-1' },
    }));
    expect(res.statusCode).toBe(200);
    expect(cancelJob).toHaveBeenCalledWith('job-1');
  });

  it('404s when the job is unknown to both layers', async () => {
    cancelJob.mockImplementation(() => false);
    durableRow = null;
    const res = await handler(makeEvent({ method: 'DELETE', headers: AUTH_HEADERS, query: { jobId: 'nope' } }));
    expect(res.statusCode).toBe(404);
  });

  it('reports a durable terminal job when the engine no longer cancels', async () => {
    cancelJob.mockImplementation(() => false);
    durableRow = {
      id: 'job-1', user_id: 'user-1', url: 'https://s.test', status: 'done',
      found: { logos: ['https://s.test/logo.png'], products: [], brandReferences: [], urls: [] }, errors: [],
    };
    const res = await handler(makeEvent({ method: 'DELETE', headers: AUTH_HEADERS, query: { jobId: 'job-1' } }));
    expect(res.statusCode).toBe(200);
    expect(parseBody(res).status).toBe('done');
  });

  it('requires a jobId to cancel', async () => {
    const res = await handler(makeEvent({ method: 'DELETE', headers: AUTH_HEADERS }));
    expect(res.statusCode).toBe(400);
  });
});

// ─── Methods ──────────────────────────────────────────────────────────────

describe('method handling', () => {
  it('rejects unsupported methods with 405', async () => {
    const res = await handler(makeEvent({ method: 'PUT', headers: AUTH_HEADERS }));
    expect(res.statusCode).toBe(405);
  });
});
