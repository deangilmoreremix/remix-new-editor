import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateThumbnail, isModerationBlocked } from '../thumbnailService';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ok = () => new Response(JSON.stringify({ urls: ['data:image/png;base64,AAAA'], request_id: 'r' }), { status: 200 });

describe('thumbnail service content filter', () => {
  it('sends moderation only when relaxed', async () => {
    const f = vi.fn(async () => ok());
    globalThis.fetch = f as any;
    await generateThumbnail({ prompt: 'p', moderation: 'low' });
    await generateThumbnail({ prompt: 'p', moderation: 'auto' });
    await generateThumbnail({ prompt: 'p' });
    const bodies = f.mock.calls.map((c: any) => JSON.parse(c[1].body));
    expect(bodies[0].moderation).toBe('low');
    expect(bodies[1].moderation).toBeUndefined();
    expect(bodies[2].moderation).toBeUndefined();
  });

  it('keeps the readable message and flags a moderation block', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "OpenAI's content filter blocked your prompt or picture (violence).", code: 'moderation_blocked', moderation_details: { moderation_stage: 'input' } }), { status: 400 })) as any;
    const err = await generateThumbnail({ prompt: 'p' }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/content filter/);
    expect(isModerationBlocked(err)).toBe(true);
    expect(isModerationBlocked(new Error('other'))).toBe(false);
  });
});

import { readSse } from '../thumbnailService';

const sseResponse = (blocks: string[], headers: Record<string, string> = { 'content-type': 'text/event-stream' }) =>
  new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const b of blocks) c.enqueue(e.encode(b)); c.close(); } }), { status: 200, headers });

describe('live preview stream', () => {
  it('reads events even when a block is split across chunks', async () => {
    const events: any[] = [];
    await readSse(sseResponse(['data: {"type":"partial","index":0,"url":"data:image/png;base64,A"}\n', '\ndata: {"type":"done","urls":["data:image/png;base64,B"]}\n\n']), (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(['partial', 'done']);
  });

  it('reports partial pictures and returns the final result with usage', async () => {
    globalThis.fetch = vi.fn(async (_u: any, init: any) => {
      expect(JSON.parse(init.body).stream).toBe(true);
      return sseResponse([
        'data: {"type":"partial","index":0,"url":"data:image/png;base64,P0"}\n\n',
        'data: {"type":"done","urls":["data:image/png;base64,FINAL"],"model":"gpt-image-2.6-flare","usage":{"output_tokens":99}}\n\n',
      ]);
    }) as any;
    const seen: string[] = [];
    const out = await generateThumbnail({ prompt: 'p', model: 'gpt-image-2.6-flare' }, { onPartial: (u) => seen.push(u) });
    expect(seen).toEqual(['data:image/png;base64,P0']);
    expect(out[0].url).toBe('data:image/png;base64,FINAL');
    expect((out[0].usage as any).output_tokens).toBe(99);
  });

  it('does not stream for several images, and surfaces a stream error', async () => {
    const f = vi.fn(async () => ok());
    globalThis.fetch = f as any;
    await generateThumbnail({ prompt: 'p', n: 2 }, { onPartial: () => {} });
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).stream).toBeUndefined();
    globalThis.fetch = vi.fn(async () => sseResponse(['data: {"type":"error","error":"blocked by filter","code":"moderation_blocked"}\n\n'])) as any;
    const err = await generateThumbnail({ prompt: 'p' }, { onPartial: () => {} }).catch((e) => e);
    expect(err.message).toBe('blocked by filter');
    expect(isModerationBlocked(err)).toBe(true);
  });
});
