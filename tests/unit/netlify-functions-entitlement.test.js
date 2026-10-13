// tests/unit/netlify-functions-entitlement.test.js
//
// Unit tests for the Clerk auth + entitlement gates added to the Netlify
// functions that spend the COMPANY SERVER keys:
//   - cinegen.js                (MUAPI_API_KEY / FAL_KEY via providers)
//   - timeline-script.js        (OPENAI_API_KEY)
//   - timeline-image-generate.js(OPENAI_API_KEY)
// and the auth-only gate on:
//   - pixabay-search.js         (cheap stock search — 401 only, no entitlement)
//
// No real provider endpoints are contacted — global fetch is routed by the
// test helper.

import { describe, it, expect, afterAll } from 'vitest';
import {
  installClerkFetchRouter,
  signClerkToken,
  clerkUser,
  withClerkEnv,
  TEST_ISSUER,
  jsonResponse,
} from './clerk-auth-test-utils.js';

const { handler: cinegenHandler } = await import('../../netlify/functions/cinegen.js');
const { handler: timelineScriptHandler } = await import('../../netlify/functions/timeline-script.js');
const { handler: timelineImageHandler } = await import('../../netlify/functions/timeline-image-generate.js');
const { handler: pixabayHandler } = await import('../../netlify/functions/pixabay-search.js');

const USER_ID = 'user_test_123';

function openaiResponsesRouter() {
  return installClerkFetchRouter({
    users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: true }) },
    extra: {
      'api.openai.com/v1/responses': () => jsonResponse({ id: 'resp_1', output_text: 'script text' }),
      'api.openai.com/v1/images': () => jsonResponse({ data: [{ b64_json: ' ZmFrZQ== ' }] }),
      'pixabay.com': () => jsonResponse({ hits: [{ id: 1, tags: 'cat' }], total: 1 }),
    },
  });
}

describe('Netlify function entitlement gates', () => {
  afterAll(() => {});

  describe('cinegen', () => {
    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      openaiResponsesRouter();
      const res = await cinegenHandler({
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ tool: 'llm_chat', params: {} }),
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('AUTH_REQUIRED');
      restore();
    });

    it('returns 403 PAYMENT_REQUIRED for an unpaid user', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      const fetchMock = installClerkFetchRouter({
        users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: false }) },
        extra: {
          'api.muapi.ai': () => jsonResponse({ request_id: 'req_1' }),
          'api.openai.com/v1/responses': () => jsonResponse({ output_text: 'x' }),
        },
      });
      const token = await signClerkToken({ sub: USER_ID });
      const res = await cinegenHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ tool: 'llm_chat', params: {} }),
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('PAYMENT_REQUIRED');
      expect(body.upgradeRequired).toBe(true);
      // No provider endpoint was touched.
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('muapi') || String(url).includes('openai'))).toHaveLength(0);
      restore();
    });

    it('lets an entitled (legacy_access) user reach the provider dispatch', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      installClerkFetchRouter({
        users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: true }) },
        extra: {},
      });
      const token = await signClerkToken({ sub: USER_ID });
      const res = await cinegenHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ tool: 'llm_chat', params: {} }),
      });
      expect(res.statusCode).toBe(200);
      // Provider dispatch happened (MUAPI_API_KEY not configured -> localFallback).
      expect(JSON.parse(res.body).code).toBe('PROVIDER_NOT_CONFIGURED');
      restore();
    });
  });

  describe('timeline-script', () => {
    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      openaiResponsesRouter();
      const res = await timelineScriptHandler({
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ action: 'generate', niche: 'fitness' }),
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('AUTH_REQUIRED');
      restore();
    });

    it('returns 403 PAYMENT_REQUIRED for an unpaid user', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      installClerkFetchRouter({
        users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: false }) },
        extra: { 'api.openai.com/v1/responses': () => jsonResponse({ output_text: 'x' }) },
      });
      const token = await signClerkToken({ sub: USER_ID });
      const res = await timelineScriptHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate', niche: 'fitness' }),
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe('PAYMENT_REQUIRED');
      restore();
    });

    it('lets an entitled user through to OpenAI', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      process.env.OPENAI_API_KEY = 'sk-test-openai';
      openaiResponsesRouter();
      const token = await signClerkToken({ sub: USER_ID });
      const res = await timelineScriptHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate', niche: 'fitness' }),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
      expect(body.text).toBe('script text');
      restore();
    });
  });

  describe('timeline-image-generate', () => {
    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      openaiResponsesRouter();
      const res = await timelineImageHandler({
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ prompt: 'a cat' }),
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('AUTH_REQUIRED');
      restore();
    });

    it('returns 403 PAYMENT_REQUIRED for an unpaid user', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      installClerkFetchRouter({
        users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: false }) },
        extra: { 'api.openai.com': () => jsonResponse({ data: [] }) },
      });
      const token = await signClerkToken({ sub: USER_ID });
      const res = await timelineImageHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: 'a cat' }),
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe('PAYMENT_REQUIRED');
      restore();
    });

    it('lets an entitled user through to OpenAI', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      process.env.OPENAI_API_KEY = 'sk-test-openai';
      openaiResponsesRouter();
      const token = await signClerkToken({ sub: USER_ID });
      const res = await timelineImageHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: 'a cat' }),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
      expect(body.assets).toHaveLength(1);
      restore();
    });
  });

  describe('pixabay-search (auth only, no entitlement)', () => {
    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      installClerkFetchRouter({
        users: {},
        extra: { 'pixabay.com': () => jsonResponse({ hits: [], total: 0 }) },
      });
      const res = await pixabayHandler({
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ type: 'images', query: 'cat' }),
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('AUTH_REQUIRED');
      restore();
    });

    it('allows a signed-in but unpaid user (stock search is cheap)', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      process.env.PIXABAY_API_KEY = 'pixabay-test-key';
      openaiResponsesRouter();
      const token = await signClerkToken({ sub: USER_ID });
      const res = await pixabayHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'images', query: 'cat' }),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
      expect(body.total).toBe(1);
      restore();
    });

    it('allows an entitled user', async () => {
      const restore = withClerkEnv({
        CLERK_ISSUER_URL: TEST_ISSUER,
        CLERK_SECRET_KEY: 'sk_test_123',
      });
      process.env.PIXABAY_API_KEY = 'pixabay-test-key';
      openaiResponsesRouter();
      const token = await signClerkToken({ sub: USER_ID });
      const res = await pixabayHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'images', query: 'cat' }),
      });
      expect(res.statusCode).toBe(200);
      restore();
    });
  });
});
