import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));
const { handle, buildRequest, parseOutput, SCHEMAS } = await import('../timeline-llm.js');

const KEY = 'sk-test0123456789abcdefghijkl';
const okResponse = (obj, extra = {}) => new Response(JSON.stringify({ output_text: JSON.stringify(obj), usage: { input_tokens: 10, output_tokens: 5 }, ...extra }), { status: 200 });

describe('timeline-llm (OpenAI Responses API, user key)', () => {
  it('requires the user key and never calls OpenAI without it', async () => {
    const fetchImpl = vi.fn();
    const r = await handle({ task: 'chat', input: { message: 'hi' } }, { fetchImpl });
    expect(r.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('chat uses the Responses API with a strict JSON schema and the mode', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ answer: 'Two clips.', citations: [{ label: 'intro', time: 2 }], cuts: [], edits: [] }));
    const r = await handle({ task: 'chat', input: { mode: 'search', message: 'where is the intro?', context: 'CLIPS: a', history: [{ role: 'user', text: 'x' }] } }, { key: KEY, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body);
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true, name: 'timeline_chat' });
    expect(body.instructions).toMatch(/citation/);
    expect(body.input.at(-1).content).toMatch(/REQUEST \(search\)/);
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, data: { answer: 'Two clips.' }, usage: { input_tokens: 10 } });
  });

  it('every schema is strict (all fields required, no extras)', () => {
    const check = (s) => {
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        expect(Object.keys(s.properties).sort()).toEqual([...s.required].sort());
        Object.values(s.properties).forEach(check);
      } else if (s.type === 'array') check(s.items);
    };
    Object.values(SCHEMAS).forEach(check);
  });

  it('validates input and explains key problems', async () => {
    expect(buildRequest('nope').error).toMatch(/Unknown task/);
    expect(buildRequest('storyboard', { text: '' }).error).toMatch(/text/);
    const bad = await handle({ task: 'beatsheet', input: { text: 'a' } }, { key: KEY, fetchImpl: async () => new Response('{}', { status: 401 }) });
    expect(JSON.parse(bad.body).error.code).toBe('bad_key');
  });

  it('reads JSON from output messages too', () => {
    expect(parseOutput({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }] })).toEqual({ a: 1 });
    expect(parseOutput({ output_text: 'not json' })).toBeNull();
  });
});

describe('timeline-llm frame task (Frame Chat)', () => {
  it('sends the frame as an image input and accepts only https or base64 images', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ answer: 'The text is small.' }));
    const r = await handle({ task: 'frame', input: { text: 'is the text readable?', image: 'data:image/jpeg;base64,/9j/4AAQ' } }, { key: KEY, fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.input[0].content).toEqual([{ type: 'input_text', text: 'is the text readable?' }, { type: 'input_image', image_url: 'data:image/jpeg;base64,/9j/4AAQ' }]);
    expect(body.text.format.name).toBe('timeline_frame');
    expect(JSON.parse(r.body).data.answer).toBe('The text is small.');
    expect(buildRequest('frame', { text: 'q', image: 'file:///etc/passwd' }).error).toMatch(/image/);
    expect(buildRequest('frame', { text: ' ', image: 'https://x/y.png' }).error).toMatch(/text/);
  });
});
