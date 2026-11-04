import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic { constructor() { this.beta = { messages: { create } }; } }
  Anthropic.RateLimitError = class extends Error {};
  return { default: Anthropic };
});

const { validateRequest, toOpenAIInput, toAnthropicMessages, step } = await import('../video-agent.js');

const TOOLS = [{ name: 'get_timeline', description: 'Read', parameters: { type: 'object', properties: {} } }];
const HISTORY = [
  { role: 'user', text: 'Make a video' },
  { role: 'assistant', provider: 'openai', raw: [{ type: 'reasoning', encrypted_content: 'e' }, { type: 'function_call', call_id: 'c1', name: 'get_timeline', arguments: '{}' }] },
  { role: 'tool_results', results: [{ id: 'c1', name: 'get_timeline', content: '{"tracks":[]}' }, { id: 'c2', name: 'x', content: 'bad', isError: true }] },
];

describe('video-agent function', () => {
  const env = { ...process.env };
  beforeEach(() => { create.mockReset(); });
  afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });

  it('validates requests', () => {
    expect(validateRequest({ messages: HISTORY, tools: TOOLS })).toBeNull();
    expect(validateRequest({ messages: [], tools: [] })).toMatch(/messages/);
    expect(validateRequest({ messages: [{ role: 'assistant', text: 'x' }], tools: [] })).toMatch(/start with a user/);
    expect(validateRequest({ messages: HISTORY, tools: [{ name: 'bad name!' }] })).toMatch(/tool name/);
    expect(validateRequest({ messages: [{ role: 'system', text: 'x' }], tools: [] })).toMatch(/role/);
  });

  it('converts history for OpenAI (raw items replayed, tool outputs by call id)', () => {
    expect(toOpenAIInput(HISTORY)).toEqual([
      { role: 'user', content: 'Make a video' },
      HISTORY[1].raw[0], HISTORY[1].raw[1],
      { type: 'function_call_output', call_id: 'c1', output: '{"tracks":[]}' },
      { type: 'function_call_output', call_id: 'c2', output: 'ERROR: bad' },
    ]);
  });

  it('converts history for Claude (raw content unchanged, all results in one user message)', () => {
    const h = [HISTORY[0], { role: 'assistant', provider: 'anthropic', raw: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 'c1', name: 'get_timeline', input: {} }] }, HISTORY[2]];
    const out = toAnthropicMessages(h);
    expect(out[1]).toEqual({ role: 'assistant', content: h[1].raw });
    expect(out[2]).toEqual({ role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'c1', content: '{"tracks":[]}' },
      { type: 'tool_result', tool_use_id: 'c2', content: 'bad', is_error: true },
    ] });
  });

  it('runs an OpenAI step and returns tool calls', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ model: 'gpt-x', status: 'completed', output: [
      { type: 'message', content: [{ type: 'output_text', text: 'Looking' }] },
      { type: 'function_call', call_id: 'k1', name: 'get_timeline', arguments: '{"a":1}' },
    ] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await step({ messages: [HISTORY[0]], tools: TOOLS }, { openaiKey: 'sk-test0123456789abcdefghijkl' });
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ ok: true, provider: 'openai', text: 'Looking', toolCalls: [{ id: 'k1', name: 'get_timeline', args: { a: 1 } }], stopReason: 'tool_use' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ store: false, include: ['reasoning.encrypted_content'], tools: [{ type: 'function', name: 'get_timeline' }] });
    expect(sent.instructions).toMatch(/create_animation/);
    expect(init.headers.Authorization).toBe('Bearer sk-test0123456789abcdefghijkl');
  });

  it('needs the user\'s own OpenAI key (BYOK) and reports bad keys', async () => {
    process.env.OPENAI_API_KEY = 'sk-server-key-should-not-be-used-000';
    delete process.env.ANTHROPIC_API_KEY;
    const noKey = await step({ messages: [HISTORY[0]], tools: TOOLS });
    expect(noKey.statusCode).toBe(401);
    expect(JSON.parse(noKey.body).error.message).toMatch(/Settings → API keys/);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    expect((await step({ messages: [HISTORY[0]], tools: TOOLS }, { openaiKey: 'sk-test0123456789abcdefghijkl' })).statusCode).toBe(401);
    delete process.env.OPENAI_API_KEY;
    expect((await step({ provider: 'anthropic', messages: [HISTORY[0]], tools: TOOLS })).statusCode).toBe(503);
  });

  it('runs a Claude step with cached system prompt, fallbacks and effort', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    create.mockResolvedValue({ model: 'claude-opus-5-5', stop_reason: 'tool_use', content: [
      { type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'On it' }, { type: 'tool_use', id: 't1', name: 'get_timeline', input: {} },
    ] });
    const body = JSON.parse((await step({ provider: 'anthropic', messages: [HISTORY[0]], tools: TOOLS })).body);
    expect(body).toMatchObject({ ok: true, provider: 'anthropic', text: 'On it', toolCalls: [{ id: 't1', name: 'get_timeline', args: {} }] });
    expect(body.raw).toHaveLength(3); // thinking kept for replay
    const req = create.mock.calls[0][0];
    expect(req).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'], output_config: { effort: 'medium' }, tool_choice: { type: 'auto' } });
    expect(req.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(req.tools[0]).toMatchObject({ name: 'get_timeline', input_schema: { type: 'object' } });
    expect(req).not.toHaveProperty('thinking');
  });

  it('handles Claude refusals and max_tokens cut-offs without running tools', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    create.mockResolvedValueOnce({ model: 'm', stop_reason: 'refusal', content: [] });
    expect(JSON.parse((await step({ provider: 'anthropic', messages: [HISTORY[0]], tools: TOOLS })).body)).toMatchObject({ stopReason: 'refusal', toolCalls: [] });
    create.mockResolvedValueOnce({ model: 'm', stop_reason: 'max_tokens', content: [{ type: 'tool_use', id: 'x', name: 'get_timeline', input: {} }] });
    expect(JSON.parse((await step({ provider: 'anthropic', messages: [HISTORY[0]], tools: TOOLS })).body).toolCalls).toEqual([]);
  });
});
