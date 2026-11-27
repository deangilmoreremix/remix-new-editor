import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient } from '../lib/muapi.js';

const sentBody = () => JSON.parse(global.fetch.mock.calls[0][1].body);

describe('extraParams passthrough', () => {
  let client;
  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ request_id: 'r1' }) }));
    client.pollForResult = vi.fn(async () => ({ url: 'https://cdn.example/out.webm' }));
  });

  test('sends settings the model schema does not list, without replacing the video field', async () => {
    await client.processV2V({
      model: 'video-background-remover',
      video_url: 'https://x/clip.mp4',
      extraParams: { background_color: 'transparent', preserve_audio: false, video_url: 'https://evil/x.mp4' },
    });
    expect(sentBody().params).toMatchObject({ video_url: 'https://x/clip.mp4', background_color: 'transparent', preserve_audio: false });
  });

  test('ignores empty, nested and oddly named values', async () => {
    await client.processV2V({
      model: 'video-background-remover',
      video_url: 'https://x/clip.mp4',
      extraParams: { a: '', b: null, c: { d: 1 }, 'bad key': 'x', ok_one: 3 },
    });
    const p = sentBody().params;
    expect(Object.keys(p).sort()).toEqual(['ok_one', 'video_url']);
  });
});
