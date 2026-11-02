// @vitest-environment node
import { describe, it, expect } from 'vitest';
import handler from '../../netlify/functions/video-agent-generate.mjs';
import { POST } from '../../netlify/functions/_shared/videoAgentGenerate.generated.mjs';
import { stripMarkdownFences, extractComponentCode } from '../../apps/motion-agent/src/helpers/sanitize-response.ts';
import { examples } from '../../apps/motion-agent/src/examples/code/index.ts';

describe('video-agent-generate function (Remotion prompt-to-motion-graphics port)', () => {
  it('requires a Clerk session and POST', async () => {
    const noAuth = await handler(new Request('http://x/fn', { method: 'POST', body: JSON.stringify({ prompt: 'a ball' }) }));
    expect(noAuth.status).toBe(401);
    const get = await handler(new Request('http://x/fn', { method: 'GET' }));
    expect(get.status).toBe(405);
  });

  it('template route reports a missing OpenAI key without leaking server details', async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const r = await POST(new Request('http://x/fn', { method: 'POST', body: JSON.stringify({ prompt: 'a bouncing ball' }) }));
      expect(r.status).toBe(400);
      const body = await r.json();
      expect(body.error).toMatch(/not configured/i);
      expect(body.error).not.toMatch(/\.env/);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});

describe('video agent client helpers (upstream template code)', () => {
  it('strips fences and keeps the component code', () => {
    const fenced = '```tsx\nimport { AbsoluteFill } from "remotion";\n\nexport const MyAnimation = () => {\n  return <AbsoluteFill />;\n};\n```';
    const code = extractComponentCode(stripMarkdownFences(fenced));
    expect(code.startsWith('import')).toBe(true);
    expect(code.trim().endsWith('};')).toBe(true);
    expect(code).not.toContain('```');
  });

  it('ships the template examples used as skills', () => {
    expect(examples.length).toBeGreaterThanOrEqual(9);
    for (const e of examples) {
      expect(e.code).toMatch(/export const \w+ = \(\) =>/);
      expect(e.durationInFrames).toBeGreaterThan(0);
    }
  });
});
