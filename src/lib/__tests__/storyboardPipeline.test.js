import { describe, it, expect, vi } from 'vitest';
vi.mock('../supabase.js', () => ({ supabase: {} }));
vi.mock('../editor/validateFile.js', () => ({}));
import {
  parseScript, detectScriptFormat, buildShotList, shotsToFrames, shotListToCsv, csvToFrames,
  buildAnimaticTimeline, animaticToVtt, cameraMoveTransform, buildPitchDeckHtml,
  saveStoryboardHandoff, loadStoryboardHandoff, handoffToVideoJobs, extractCharacters,
} from '../storyboardPipeline.js';

const FOUNTAIN = `Title: Test
Author: A

EXT. CITY STREET - DAY

Rain hammers the skyline. MAYA runs toward a taxi.

MAYA
Wait! Hold the door!

DRIVER
(annoyed)
Make it quick.

INT. TAXI - CONTINUOUS

Maya slams the door and looks at her phone.
`;

describe('parseScript', () => {
  it('parses fountain scenes, dialogue and characters', () => {
    const s = parseScript(FOUNTAIN);
    expect(s).toHaveLength(2);
    expect(s[0].heading).toBe('EXT. CITY STREET - DAY');
    expect(s[0].location).toBe('CITY STREET');
    expect(s[0].characters).toEqual(['MAYA', 'DRIVER']);
    expect(s[0].dialogue[0]).toEqual({ character: 'MAYA', line: 'Wait! Hold the door!' });
    expect(extractCharacters(s).find((c) => c.name === 'MAYA').scenes).toEqual([1]);
  });
  it('parses FDX', () => {
    const xml = `<FinalDraft><Content><Paragraph Type="Scene Heading"><Text>INT. LAB - NIGHT</Text></Paragraph><Paragraph Type="Action"><Text>A beaker &amp; flame.</Text></Paragraph><Paragraph Type="Character"><Text>DR. K</Text></Paragraph><Paragraph Type="Dialogue"><Text>It works.</Text></Paragraph></Content></FinalDraft>`;
    expect(detectScriptFormat(xml)).toBe('fdx');
    const s = parseScript(xml);
    expect(s[0].action[0]).toBe('A beaker & flame.');
    expect(s[0].dialogue[0].character).toBe('DR. K');
  });
  it('splits plain prose into scenes by paragraph', () => {
    const s = parseScript('A man walks in.\n\nHe sits down.');
    expect(s.length).toBe(2);
  });
  it('handles empty input', () => { expect(parseScript('')).toEqual([]); });
});

describe('shot list', () => {
  const scenes = parseScript(FOUNTAIN);
  it('builds ordered shots with coverage and durations', () => {
    const shots = buildShotList(scenes);
    expect(shots[0].shot).toBe('Wide Shot');
    expect(shots[0].cameraMovement).toBe('Tracking');
    expect(shots.every((s) => s.duration >= 2 && s.duration <= 12)).toBe(true);
    expect(shots.some((s) => s.narration === 'Wait! Hold the door!')).toBe(true);
  });
  it('caps shots per scene', () => {
    expect(buildShotList(scenes, { maxShotsPerScene: 1 }).filter((s) => s.sceneNumber === 1)).toHaveLength(1);
  });
  it('round-trips through CSV', () => {
    const frames = shotsToFrames(buildShotList(scenes));
    const back = csvToFrames(shotListToCsv(frames));
    expect(back).toHaveLength(frames.length);
    expect(back[0].prompt).toBe(frames[0].prompt);
    expect(back[1].narration).toBe(frames[1].narration);
  });
});

describe('animatic', () => {
  const frames = shotsToFrames(buildShotList(parseScript(FOUNTAIN)));
  it('builds a contiguous timeline', () => {
    const tl = buildAnimaticTimeline(frames);
    expect(tl.entries[0].start).toBe(0);
    tl.entries.slice(1).forEach((e, i) => expect(e.start).toBe(tl.entries[i].end));
    expect(tl.at(0).index).toBe(0);
    expect(tl.at(tl.total + 50).index).toBe(frames.length - 1);
  });
  it('emits VTT and camera transforms', () => {
    expect(animaticToVtt(frames)).toMatch(/^WEBVTT[\s\S]*-->/);
    expect(cameraMoveTransform('Dolly In', 1)).toBe('scale(1.1500)');
    expect(cameraMoveTransform('Static', 0.5)).toBe('scale(1)');
  });
});

describe('deck + handoff', () => {
  const frames = shotsToFrames(buildShotList(parseScript(FOUNTAIN)));
  it('escapes user content and rejects unsafe image URLs', () => {
    frames[0].prompt = '<script>alert(1)</script>';
    frames[0].imageUrl = 'javascript:alert(1)';
    const html = buildPitchDeckHtml({ title: '<b>T</b>', frames });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('&lt;b&gt;T&lt;/b&gt;');
  });
  it('saves, loads and converts a hand-off', () => {
    const mem = { d: {}, setItem(k, v) { this.d[k] = v; }, getItem(k) { return this.d[k] ?? null; }, removeItem(k) { delete this.d[k]; } };
    frames[1].imageUrl = 'https://x/y.png';
    saveStoryboardHandoff({ title: 'T', frames }, mem);
    const h = loadStoryboardHandoff(mem);
    expect(h.shots).toHaveLength(frames.length);
    const jobs = handoffToVideoJobs(h);
    expect(jobs[1].mode).toBe('image-to-video');
    expect(jobs[0].mode).toBe('text-to-video');
  });
});
