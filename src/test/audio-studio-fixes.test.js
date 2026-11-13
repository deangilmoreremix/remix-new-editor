// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { audioModels } from '../lib/models.js';
import { modelHasField, deliveryParams, hardcodedAudioKeys, DELIVERY_HINT } from '../lib/audioStudioFields.js';

const byId = (id) => audioModels.find((m) => m.id === id);

describe('Audio Studio delivery controls (Tone / Emotion / Pitch)', () => {
  it('no audio model today has a tone, emotion or pitch field, so none of the controls apply', () => {
    for (const m of audioModels) for (const f of ['tone', 'emotion', 'pitch']) expect(modelHasField(m, f), `${m.id}.${f}`).toBe(false);
  });
  it('sends only what the model schema supports', () => {
    const model = { inputs: { emotion: {}, pitch: {} } };
    expect(deliveryParams(model, { tone: 'warm', emotion: 'happy', pitch: 1.2 })).toEqual({ emotion: 'happy', pitch: 1.2 });
    expect(deliveryParams(model, { tone: 'warm', emotion: 'none', pitch: 1 })).toEqual({ pitch: 1 });
    expect(deliveryParams({ inputs: { tone: {} } }, { tone: 'neutral' })).toEqual({});
    expect(deliveryParams(byId('minimax-speech-2.6-turbo'), { tone: 'warm', emotion: 'happy', pitch: 1.5 })).toEqual({});
    expect(deliveryParams(undefined, { tone: 'x', emotion: 'y', pitch: 2 })).toEqual({});
  });
  it('explains what to do instead', () => expect(DELIVERY_HINT).toMatch(/Describe the delivery in your prompt/));
});

describe('speed', () => {
  it('is drawn by the studio only for speech models; ElevenLabs Turbo renders its own speed field', () => {
    expect(hardcodedAudioKeys(byId('minimax-speech-2.6-turbo'))).toContain('speed');
    const eleven = byId('elevenlabs-tts-turbo-2-5');
    expect(eleven.inputs.speed).toBeTruthy();
    expect(hardcodedAudioKeys(eleven)).not.toContain('speed');
  });
});

describe('Audio Studio wiring', () => {
  const src = fs.readFileSync('src/components/AudioStudio.js', 'utf8');
  it('gates the three controls on the model schema and shows the hint', () => {
    expect(src).toMatch(/toneGroup\.classList\.toggle\('hidden', !hasTone\)/);
    expect(src).toMatch(/emotionGroup\.classList\.toggle\('hidden', !hasEmotion\)/);
    expect(src).toMatch(/pitchGroup\.classList\.toggle\('hidden', !hasPitch\)/);
    expect(src).toContain('deliveryHint');
  });
  it('sends the delivery params and the speech text as prompt', () => {
    expect(src).toContain('deliveryParams(selectedModel');
    expect(src).toMatch(/prompt: processedPrompt,[^\n]*\n\s*text: processedPrompt/);
  });
  it('mounts and, for a speech model, shows the hint and hides Tone / Emotion / Pitch', async () => {
    localStorage.clear();
    localStorage.setItem('audio_studio_state', JSON.stringify({ selectedModelId: 'minimax-speech-2.6-turbo' }));
    const { AudioStudio } = await import('../components/AudioStudio.js');
    const el = AudioStudio();
    document.body.appendChild(el);
    const labels = (t) => [...el.querySelectorAll('label')].filter((l) => l.textContent.trim() === t);
    const modelSel = [...el.querySelectorAll('[data-model-id]')];
    expect(el.textContent).toContain('Audio');
    // Tone / Emotion / Pitch groups exist but are hidden for models without those fields.
    for (const t of ['Tone', 'Emotion', 'Pitch']) {
      expect(labels(t), `${t} control exists`).toHaveLength(1);
      expect(labels(t)[0].parentElement.classList.contains('hidden'), `${t} visible`).toBe(true);
    }
    const hint = [...el.querySelectorAll('p')].find((p) => p.textContent === DELIVERY_HINT);
    expect(hint, 'hint exists').toBeTruthy();
    expect(hint.classList.contains('hidden'), 'hint visible for a speech model').toBe(false);
    expect(modelSel).toBeDefined();
  });
});

describe('muapi.generateAudio', () => {
  it('forwards the speech text as prompt', () => {
    const src = fs.readFileSync('src/lib/muapi.js', 'utf8');
    const i = src.indexOf('async generateAudio(params, signal)');
    expect(src.slice(i, i + 1400)).toContain('const spokenText = params.prompt || params.text');
  });
});
