import { describe, it, expect, vi } from 'vitest';
import { interpretEvent, toolResultMessages, createVoiceSession } from '../voiceDirector.js';
import { quickEdit } from '../frameTools.js';

vi.mock('../../ml/aiActions.js', async (orig) => ({ ...(await orig()), frameAtPlayhead: vi.fn(async () => ({ width: 4, height: 2 })) }));
vi.mock('../../ml/frameGrab.js', async (orig) => ({ ...(await orig()), canvasToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }));

describe('voice director', () => {
  it('interprets realtime events', () => {
    expect(interpretEvent({ type: 'response.function_call_arguments.done', call_id: 'c1', name: 'get_timeline', arguments: '{"a":1}' })).toEqual({ kind: 'tool', callId: 'c1', name: 'get_timeline', args: { a: 1 } });
    expect(interpretEvent({ type: 'response.function_call_arguments.done', call_id: 'c2', name: 'x', arguments: '{bad' }).args).toEqual({ _invalidJson: true });
    expect(interpretEvent({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'cut the intro' })).toEqual({ kind: 'heard', text: 'cut the intro' });
    expect(interpretEvent({ type: 'response.output_audio_transcript.done', transcript: 'Done.' })).toEqual({ kind: 'said', text: 'Done.' });
    expect(interpretEvent({ type: 'error', error: { message: 'boom' } })).toEqual({ kind: 'error', message: 'boom' });
    expect(interpretEvent({ type: 'session.updated' }).kind).toBe('ignore');
  });
  it('returns a tool result and asks the model to continue', () => {
    const [item, resp] = toolResultMessages('c1', 'x'.repeat(30_000));
    expect(item.item).toMatchObject({ type: 'function_call_output', call_id: 'c1' });
    expect(item.item.output).toHaveLength(20_000);
    expect(resp).toEqual({ type: 'response.create' });
  });
  it('needs the user key and posts the editor tools to the session function', async () => {
    await expect(createVoiceSession({ definitions: [] }, { headers: {}, fetchImpl: vi.fn() })).rejects.toThrow(/own OpenAI key/);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, secret: 'ek_1' }), { status: 200 }));
    const r = await createVoiceSession({ definitions: [{ name: 'get_timeline' }] }, { headers: { 'X-OpenAI-Key': 'sk-x' }, fetchImpl, voice: 'cedar' });
    expect(r.secret).toBe('ek_1');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ voice: 'cedar', tools: [{ name: 'get_timeline' }] });
    expect(fetchImpl.mock.calls[0][1].headers['X-OpenAI-Key']).toBe('sk-x');
  });
});

describe('quick edit', () => {
  it('edits the playhead frame with the frame as a reference and adds the result at the playhead', async () => {
    const editor = {
      playheadSec: () => 7, snapshot: vi.fn(), commit: vi.fn(), toast: vi.fn(),
      storeBlob: vi.fn(async () => 'https://store/source.png'),
      insertClip: vi.fn((c) => c),
    };
    const make = vi.fn(async () => ({ url: 'https://store/edited.png' }));
    const clip = await quickEdit(editor, { id: 'v' }, 'make it night', { make });
    const [, prompt, opts] = make.mock.calls[0];
    expect(prompt).toMatch(/Edit this image: make it night/);
    expect(opts).toMatchObject({ model: 'gpt-image-2.6-sunburst', refs: ['https://store/source.png'] });
    expect(clip).toMatchObject({ type: 'image', src: 'https://store/edited.png', start: 7, end: 10 });
    expect(editor.storeBlob.mock.calls[0][2]).toEqual({ requireRemote: true });
    await expect(quickEdit(editor, { id: 'v' }, '  ', { make })).rejects.toThrow(/Say what to change/);
  });
});
