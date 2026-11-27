import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));
const { handle, buildRequest, buildWriteRequest, usableOption, SCHEMA } = await import('../landing-rewrite.js');

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

  describe('write mode (one field, empty allowed)', () => {
    it('accepts an empty current text and asks for the requested number of options', () => {
      const r = buildRequest({ mode: 'write', label: 'Headline', role: 'headline', current: '', maxChars: 80, n: 3, context: 'Plumber in Reno', instruction: 'friendly' });
      expect(r.error).toBeUndefined();
      expect(r.ids).toEqual(['o1', 'o2', 'o3']);
      expect(JSON.parse(r.body ? JSON.stringify(r.body) : '{}').text.format).toMatchObject({ type: 'json_schema', strict: true });
      expect(r.body.store).toBe(false);
      expect(r.body.input[0].content).toContain('"maxChars":80');
    });
    it('clamps n and maxChars and needs a field name', () => {
      expect(buildWriteRequest({ mode: 'write', label: 'x', n: 99 }).ids).toHaveLength(3);
      expect(buildWriteRequest({ mode: 'write', label: 'x', n: 0 }).ids).toHaveLength(3);
      expect(buildWriteRequest({ mode: 'write', label: 'x', n: 1 }).ids).toEqual(['o1']);
      expect(buildWriteRequest({ mode: 'write', label: 'x', maxChars: 99999 }).maxChars).toBe(700);
      expect(buildWriteRequest({ mode: 'write', label: '   ' }).error).toBeTruthy();
      expect(buildWriteRequest({ mode: 'write', label: 'x', current: 'a'.repeat(800) }).error).toBeTruthy();
    });
    it('returns only usable options for the ids it asked for', async () => {
      const fetchImpl = vi.fn(async () => ok({ items: [
        { id: 'o1', text: 'Fast, friendly plumbing' },
        { id: 'o2', text: 'See https://evil.test now' },
        { id: 'o3', text: '<b>Bold</b>' },
        { id: 'o9', text: 'not asked for' },
      ] }));
      const r = await handle({ input: { mode: 'write', label: 'Headline', maxChars: 60, n: 3 } }, { key: KEY, fetchImpl });
      expect(JSON.parse(r.body)).toMatchObject({ ok: true, items: [{ id: 'o1', text: 'Fast, friendly plumbing' }] });
    });
    it('still needs the user key and maps provider errors', async () => {
      expect((await handle({ input: { mode: 'write', label: 'x' } }, { fetchImpl: vi.fn() })).statusCode).toBe(401);
      expect((await handle({ input: { mode: 'write', label: 'x' } }, { key: KEY, fetchImpl: async () => new Response('{}', { status: 429 }) })).statusCode).toBe(429);
    });
    it('tells the model how the field must look (casing, highlight, list, rows, numbers)', () => {
      const r = buildWriteRequest({ mode: 'write', label: 'Headline', current: 'GROW FAST', casing: 'upper', format: { highlight: true, list: { count: 7 }, lines: { count: 2 }, numeric: true } });
      const field = JSON.parse(r.body.input[0].content.split('FIELD (JSON):\n')[1]);
      expect(field).toMatchObject({ casing: 'upper', highlight: true, list: { items: 7 }, lines: 2, numeric: true });
      expect(r.body.instructions).toMatch(/ALL CAPS/);
      expect(r.body.instructions).toMatch(/double brackets/);
    });
    it('ignores a made-up casing or format and defaults to no highlight', () => {
      const r = buildWriteRequest({ mode: 'write', label: 'Headline', casing: 'shout', format: 'nope' });
      const field = JSON.parse(r.body.input[0].content.split('FIELD (JSON):\n')[1]);
      expect(field.casing).toBeUndefined();
      expect(field.highlight).toBe(false);
    });
    it('usableOption rejects empty, too long, markup and links', () => {
      expect(usableOption('Book now', 20)).toBe(true);
      for (const bad of ['', '   ', 'x'.repeat(40), '<script>', 'visit www.x.com', 'http://x.test']) expect(usableOption(bad, 20), bad).toBe(false);
    });
  });
});
