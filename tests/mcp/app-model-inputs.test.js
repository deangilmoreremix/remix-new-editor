/**
 * The five models that used to be MCP-only gaps (second image, mask, dialogue turns, track ids, mashup tracks) are now sent by the app's own client
 * the way the model's schema lists them. Runs the real MuapiClient against a mocked fetch.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient } from '../../src/lib/muapi.js';
import { getI2IModelById, getAudioModelById } from '../../src/lib/models.js';

vi.mock('../../src/lib/services/RateLimiter.js', () => ({ rateLimiter: { acquire: vi.fn(() => Promise.resolve()) } }));
vi.mock('../../src/lib/supabase.js', () => ({ uploadFileToStorage: vi.fn(async (f) => `https://cdn.example.com/${f?.name ?? 'file'}`) }));
vi.mock('../../src/lib/analytics.js', () => ({ analytics: { trackGeneration: vi.fn(), trackGenerationComplete: vi.fn(), trackGenerationError: vi.fn() } }));

const IMG = 'https://cdn.example.com/in.png';
const AUD = 'https://cdn.example.com/in.mp3';
let client;
let fetchMock;
beforeEach(async () => {
  client = new MuapiClient();
  await client.apiKeyManager.setMuapiKey('test-key-0123456789');
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ outputs: ['https://cdn.example.com/out.mp3'] }) }));
  globalThis.fetch = fetchMock;
});
const sent = () => { const b = JSON.parse(fetchMock.mock.calls[0][1].body); return { endpoint: String(b.endpoint).replace(/^\//, ''), params: b.params ?? b }; };

describe('Edit Studio tools send their second image', () => {
  test('AI Dress Change forwards the outfit image', async () => {
    await client.generateI2I({ model: 'ai-dress-change', image_url: IMG, garment_image_url: 'https://cdn.example.com/dress.png' });
    expect(sent().endpoint).toBe('ai-dress-change');
    expect(sent().params).toMatchObject({ model_image_url: IMG, garment_image_url: 'https://cdn.example.com/dress.png' });
  });
  test('AI Object Eraser forwards the mask image', async () => {
    await client.generateI2I({ model: 'ai-object-eraser', image_url: IMG, mask_image_url: 'https://cdn.example.com/mask.png' });
    expect(sent().endpoint).toBe('ai-object-eraser');
    expect(sent().params).toMatchObject({ image_url: IMG, mask_image_url: 'https://cdn.example.com/mask.png' });
  });
  test('the registry lists the field, and as an image field (so the studio adds no stray text box for it)', () => {
    expect(getI2IModelById('ai-dress-change').inputs.garment_image_url).toMatchObject({ type: 'string', field: 'image' });
    expect(getI2IModelById('ai-object-eraser').inputs.mask_image_url).toMatchObject({ type: 'string', field: 'image' });
  });
});

describe('Audio Studio models send exactly the fields their schema lists', () => {
  const turns = [{ text: 'Hello there', voice_id: 'ZQe5CZNOzWyzPSCn5a3c' }, { text: 'Hi!', voice_id: 'Z3R5wn05IrDiVCyEkUrK' }];

  test('Text to Dialogue V3: turns (plus its own options), no prompt, no duration, no registry id as "model"', async () => {
    await client.generateAudio({ model: 'elevenlabs-text-to-dialogue-v3', dialogue: turns, stability: 0.4, duration: 12, style: 'x', prompt: 'ignored' });
    const { endpoint, params } = sent();
    expect(endpoint).toBe('elevenlabs-text-to-dialogue-v3');
    expect(params).toEqual({ dialogue: turns, stability: 0.4 });
  });
  test('Suno Convert to WAV: the two track ids only', async () => {
    await client.generateAudio({ model: 'suno-convert-to-wav', task_id: 'task-1', audio_id: 'audio-1', duration: 30 });
    expect(sent().params).toEqual({ task_id: 'task-1', audio_id: 'audio-1' });
  });
  test('Suno Mashup: the tracks and its options; the suno version field is left to the backend default', async () => {
    await client.generateAudio({ model: 'suno-generate-mashup', audios_list: [AUD, AUD], prompt: 'lofi', style: 'chill', instrumental: true, duration: 30 });
    const { params } = sent();
    expect(params).toMatchObject({ audios_list: [AUD, AUD], prompt: 'lofi', style: 'chill', instrumental: true });
    expect(params.model).toBeUndefined();
    expect(params.duration).toBeUndefined();
  });
  test('empty values are not sent', async () => {
    await client.generateAudio({ model: 'suno-generate-mashup', audios_list: [], style: '', title: undefined });
    expect(sent().params).toEqual({});
  });
  test('models that did not opt in still send the generic set (nothing else changes)', async () => {
    expect(getAudioModelById('suno-create-music').forwardInputs).toBeUndefined();
    await client.generateAudio({ model: 'minimax-speech-2.6-turbo', prompt: 'hello', voice: 'v1', speed: 1 });
    expect(sent().params).toMatchObject({ model: 'minimax-speech-2.6-turbo', prompt: 'hello', voice: 'v1', speed: 1 });
  });
  test('registry flags: the three opt in, and the two that take no prompt say so', () => {
    for (const id of ['elevenlabs-text-to-dialogue-v3', 'suno-convert-to-wav', 'suno-generate-mashup']) expect(getAudioModelById(id).forwardInputs, id).toBe(true);
    expect(getAudioModelById('elevenlabs-text-to-dialogue-v3').hasPrompt).toBe(false);
    expect(getAudioModelById('suno-convert-to-wav').hasPrompt).toBe(false);
  });
});
