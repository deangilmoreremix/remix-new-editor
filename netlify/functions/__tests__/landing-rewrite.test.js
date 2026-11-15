import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));
const { handle, buildRequest, SCHEMA } = await import('../landing-rewrite.js');

const KEY = 'sk-test0123456789abcdefghijkl';
const ok = (obj) => new Response(JSON.stringify({ output_text: JSON.stringify(obj) }), { status: 200 });

describe('landing-rewrite', () => {
  it('requires the user key', async () => {
    const fetchImpl = vi.fn();
    expect((await handle({ input: { items: [{ id: 'a', text: 'Hi' }] } }, { fetchImpl })).statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('sends only ids and texts with a strict schema, and drops unknown ids', async () => {
    const fetchImpl = vi.fn(async () => ok({ items: [{ id: 'a', text: 'Hello' }, { id: 'zzz', text: 'injected' }] }));
    const r = await handle({ input: { items: [{ id: 'a', role: 'headline', text: 'Hi' }], instruction: 'friendlier' } }, { key: KEY, fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.store).toBe(false);
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, items: [{ id: 'a', text: 'Hello' }] });
  });
  it('validates input', () => {
    expect(buildRequest({ items: [] }).error).toBeTruthy();
    expect(buildRequest({ items: [{ id: 'a', text: 'x'.repeat(800) }] }).error).toBeTruthy();
    expect(buildRequest({ items: Array.from({ length: 81 }, (_, i) => ({ id: `${i}`, text: 'a' })) }).error).toBeTruthy();
    expect(SCHEMA.additionalProperties).toBe(false);
  });
  it('maps provider errors', async () => {
    expect((await handle({ input: { items: [{ id: 'a', text: 'Hi' }] } }, { key: KEY, fetchImpl: async () => new Response('{}', { status: 401 }) })).statusCode).toBe(401);
    expect((await handle({ input: { items: [{ id: 'a', text: 'Hi' }] } }, { key: KEY, fetchImpl: async () => new Response('{}', { status: 429 }) })).statusCode).toBe(429);
  });
});
