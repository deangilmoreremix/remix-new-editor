// @vitest-environment node
// Model output is checked before it is saved: enrichment JSON must have the right field types
// (intelligence-api), and an empty or token-exhausted completion is a failure (personalizer-api).
import { describe, it, expect, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({}), auth: {}, storage: { from: () => ({}) } }) }));
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';

const { sanitizeEnrichment } = await import('../intelligence-api.js');
const { completionText } = await import('../personalizer-api.js');

describe('sanitizeEnrichment', () => {
  it('keeps well-typed fields and leaves omitted ones out', () => {
    const r = sanitizeEnrichment({
      company: { name: 'Acme', industry: 'Rockets' },
      intelligence: { painPoints: ['slow launches'], tone: 'friendly' },
      brand: { colors: { primary: '#ff0000' } },
    });
    expect(r).toEqual({
      company: { name: 'Acme', industry: 'Rockets' },
      intelligence: { painPoints: ['slow launches'], tone: 'friendly' },
      brandColors: { primary: '#ff0000' },
    });
  });
  it('drops fields of the wrong type', () => {
    const r = sanitizeEnrichment({
      company: { name: 42, domain: 'acme.test', size: { n: 5 } },
      intelligence: { painPoints: [42], products: 'rockets', services: ['launch', null], interests: ['space'], summary: ['x'], tone: 'angry' },
      brand: { colors: { primary: 7, accent: '#00ff00' } },
    });
    expect(r.company).toEqual({ domain: 'acme.test' });
    expect(r.intelligence).toEqual({ interests: ['space'] });
    expect(r.brandColors).toEqual({ accent: '#00ff00' });
  });
  it('returns empty objects for non-object output', () => {
    for (const bad of [null, 'text', [1, 2], { company: [], intelligence: 'x', brand: { colors: [] } }]) {
      expect(sanitizeEnrichment(bad)).toEqual({ company: {}, intelligence: {}, brandColors: {} });
    }
  });
});

describe('completionText', () => {
  it('returns visible text', () => {
    expect(completionText({ choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }] })).toBe('Hello');
  });
  it('throws on null, empty or missing content', () => {
    expect(() => completionText({ choices: [{ message: { content: null }, finish_reason: 'stop' }] })).toThrow(/no content/);
    expect(() => completionText({ choices: [{ message: { content: '  ' } }] })).toThrow(/no content/);
    expect(() => completionText({})).toThrow(/no content/);
  });
  it('throws when the token budget ran out before any text', () => {
    expect(() => completionText({ choices: [{ message: { content: '' }, finish_reason: 'length' }] })).toThrow(/ran out of tokens/);
  });
});
