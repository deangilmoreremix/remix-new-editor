import { describe, it, expect } from 'vitest';
import fixtures from './fixtures/upstream-fixtures.json';
import {
  normalizeBeats, characterSheetPrompt, keyframePrompt, clipPrompt, ttsPayload, narrationText, allShots, MODELS, DEFAULT_TTS_SPEED, UPSTREAM_VOICE, IMAGE_PREFIX,
} from '../../../../netlify/functions/_shared/zackdPrompts.js';
import { buildAssemblyPlan, CANVAS_W, CANVAS_H, FPS, DEFAULT_TRANSITION_SEC, TRANSITIONS } from '../assemble.js';

const { buildSubmit } = await import('../../../../netlify/functions/zackd.js');
const map = normalizeBeats(fixtures.beats, { topic: fixtures.beats.topic });
const shots = allShots(map);
const sheets = map.character_sheets;

describe('prompts and requests match what upstream sends', () => {
  it('character sheets: exact prompt, 16:9, nano-banana-2 first', () => {
    expect(fixtures.character_sheets).toHaveLength(sheets.length);
    fixtures.character_sheets.forEach((f, i) => {
      expect(sheets[i].id).toBe(f.sheet);
      expect(characterSheetPrompt(sheets[i])).toBe(f.payload.prompt);
      expect(f.payload.aspect_ratio).toBe('16:9');
      expect(buildSubmit({ kind: 'image', prompt: characterSheetPrompt(sheets[i]), aspect: '16:9' }).payload).toEqual(f.payload);
      expect(MODELS.image[0]).toBe(f.endpoint);
    });
  });

  it('keyframes: exact prompt (provider prefix + style + "Anchored on character sheet refs"), 9:16', () => {
    expect(fixtures.keyframes).toHaveLength(shots.length);
    fixtures.keyframes.forEach((f, i) => {
      expect(shots[i].shot_id).toBe(f.shot_id);
      expect(keyframePrompt(shots[i], sheets)).toBe(f.payload.prompt);
      expect(keyframePrompt(shots[i], sheets).startsWith(IMAGE_PREFIX)).toBe(true);
      expect(buildSubmit({ kind: 'image', prompt: keyframePrompt(shots[i], sheets), aspect: '9:16' }).payload).toEqual(f.payload);
    });
  });

  it('clips: exact Veo prompt (raw camera move) and the same payload shape, veo3.1-fast first', () => {
    expect(fixtures.clips).toHaveLength(shots.length);
    fixtures.clips.forEach((f, i) => {
      expect(clipPrompt(shots[i])).toBe(f.payload.prompt);
      const sub = buildSubmit({ kind: 'clip', imageUrl: 'https://cdn.example.com/kf.png', prompt: clipPrompt(shots[i]) });
      expect(sub.payload).toEqual({ ...f.payload, image_url: 'https://cdn.example.com/kf.png' });
      expect(sub.models).toEqual([f.endpoint, f.fallback_endpoint]);
    });
  });

  it('narration: one call, every beat joined by a single space, speed 1.1, upstream voice available', () => {
    const [f] = fixtures.audio;
    expect(narrationText(map)).toBe(f.payload.text);
    const t = ttsPayload({ text: narrationText(map), voice: UPSTREAM_VOICE });
    expect(t).toMatchObject({ text: f.payload.text, voice_id: f.payload.voice_id, speed: f.payload.speed });
    expect(DEFAULT_TTS_SPEED).toBe(f.payload.speed);
    expect(MODELS.tts).toBe(f.endpoint);
  });

  it('known, intentional difference: the image fallback is flux-dev-image (upstream flux-dev 404s on MuAPI)', () => {
    expect(fixtures.keyframes[0].fallback_endpoint).toBe('flux-dev');
    expect(MODELS.image[1]).toBe('flux-dev-image');
  });
});

describe('final cut matches upstream assemble.py', () => {
  const toShots = (ci) => ci.map((c) => ({ duration: c.duration, zoom: c.zoom_impact, hasAudio: c.audio_index === c.video_index }));

  for (const [name, sc] of Object.entries(fixtures.filter_graphs)) {
    it(`filter graph is identical: ${name}`, () => {
      const plan = buildAssemblyPlan(toShots(sc.clip_info), { transition: sc.transition_duration });
      expect(plan.filterComplex).toBe(sc.graph);
      expect(plan.audioLabel).toBe('aout');
      // same input layout: each audio-less clip is followed by its silent lavfi input
      expect(plan.inputs.map((x, i) => (x.type === 'silence' ? i : null)).filter((x) => x !== null))
        .toEqual(sc.clip_info.filter((c) => c.audio_index !== c.video_index).map((c) => c.audio_index));
    });
  }

  it('uses each clip\'s real length: 5 x 8 s with 0.35 s transitions is the 38.6 s of upstream\'s own demo', () => {
    const sc = fixtures.filter_graphs.five_clips_all_audio_td035;
    expect(buildAssemblyPlan(toShots(sc.clip_info), { transition: 0.35 }).total).toBeCloseTo(38.6, 6);
  });

  it('constants match', () => {
    const c = fixtures.assemble_constants;
    expect([CANVAS_W, CANVAS_H, FPS, DEFAULT_TRANSITION_SEC]).toEqual([c.CANVAS_WIDTH, c.CANVAS_HEIGHT, c.FRAME_RATE, c.DEFAULT_TRANSITION_DURATION]);
    expect(TRANSITIONS).toEqual(c.TRANSITIONS);
  });

  it('our extras are appended AFTER the upstream graph, never altering it', () => {
    const sc = fixtures.filter_graphs.five_clips_all_audio_td035;
    const plan = buildAssemblyPlan(toShots(sc.clip_info), { transition: 0.35, hasNarration: true, hasMusic: true });
    expect(plan.filterComplex.startsWith(`${sc.graph};`)).toBe(true);
    expect(plan.audioLabel).toBe('aout2');
  });
});
