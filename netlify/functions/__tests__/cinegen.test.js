import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));
const { handler } = await import('../cinegen.js');

const call = (tool, headers = {}) => handler({ httpMethod: 'POST', headers, body: JSON.stringify({ tool, params: { imageUrl: 'https://x.test/a.png' } }) });

describe('cinegen function (legacy Timeline AI route)', () => {
  it('never spends the platform MuAPI key: MuAPI tools need the user key', async () => {
    process.env.MUAPI_API_KEY = 'platform-key-should-not-be-used';
    for (const tool of ['fill_gap', 'extend', 'music_generation', 'layer_decompose', 'shot_board', 'element_create']) {
      const r = await call(tool);
      expect(r.statusCode, tool).toBe(401);
      expect(JSON.parse(r.body).code).toBe('need_key');
    }
    delete process.env.MUAPI_API_KEY;
  });

  it('the removed tools are gone and masking points to the browser', async () => {
    expect((await call('llm_chat')).statusCode).toBe(400);
    const r = await call('sam3_segment');
    expect(JSON.parse(r.body)).toMatchObject({ success: false, code: 'RUNS_IN_BROWSER' });
  });
});
