import { describe, it, expect, vi, afterEach } from 'vitest';
import { handler, buildContextBlock, sceneRules, cleanScenes, cleanBusiness } from '../timeline-script.js';

const KEY = 'sk-test_0123456789abcdefghij';
const post = (body, headers = { 'x-openai-key': KEY }) => handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('timeline-script: customer\'s own OpenAI key, scene-aware', () => {
  it('needs the customer\'s own key (no platform fallback)', async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy);
    const res = await post({ action: 'generate' }, {});
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/your own OpenAI key/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks the model for one line per scene, with the business details, using the customer\'s key', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ output_text: 'a\nb\nc', id: 'resp_1', model: 'm' }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await post({
      action: 'generate', niche: 'Restaurant & Cafe', tone: 'warm', duration: 30,
      scenes: ['opening tease', 'plate reveal', 'final presentation'],
      business: { business_name: 'Luna Bistro', city: 'Austin', offer: '2-for-1 pasta', about: 'Family-run, wood-fired' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, text: 'a\nb\nc' });
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(opts.headers.Authorization).toBe(`Bearer ${KEY}`);                    // the customer's key, nothing else
    const sent = JSON.parse(opts.body);
    expect(sent.instructions).toMatch(/exactly 3 lines/);
    expect(sent.instructions).toMatch(/do NOT put it in the lines/);
    const input = sent.input[0].content;
    expect(input).toContain('Luna Bistro'); expect(input).toContain('Austin'); expect(input).toContain('2-for-1 pasta');
    expect(input).toMatch(/1\. opening tease\n2\. plate reveal\n3\. final presentation/);
    expect(input).toContain('Word budget: about 72 words');                       // 30 s × 2.4
    expect(input).toMatch(/Do not invent facts/);
  });

  it('without scenes it behaves as before (no structure rules)', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ output_text: 'x' }) }));
    vi.stubGlobal('fetch', fetchSpy);
    await post({ action: 'generate', niche: 'Real Estate' });
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).instructions).not.toMatch(/SCENE STRUCTURE/);
  });

  it('turns a bad or empty-credit key into a clear message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    const res = await post({ action: 'generate' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/rejected your API key/);
  });

  it('cleans and caps what the browser sends', () => {
    expect(cleanScenes(['  a  ', '', 'b'.repeat(200), ...Array(20).fill('x')])).toHaveLength(12);
    expect(cleanScenes('nope')).toEqual([]);
    expect(cleanBusiness({ business_name: ' Luna\n Bistro ', about: 'y'.repeat(900) })).toMatchObject({ business_name: 'Luna Bistro', about: 'y'.repeat(600) });
    expect(sceneRules([])).toBe('');
    expect(buildContextBlock({ scenes: ['one'], business: {} })).toContain('1. one');
  });
});
