// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initRouter, navigate, getCurrentPage, academyKey } from '../../../lib/router.js';
import { ACADEMY_TRACKS, ACADEMY_LESSONS } from '../../../data/academy/catalog.js';
import { STUDIO_ACADEMY, academyLessonUrl, academyTrackUrl } from '../../../data/askAcademyMap.js';

const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/askIndex.json'), 'utf8'));
const LESSON_URL = /^#\/academy\/track\/([^/]+)\/lesson\/([^/]+)$/;
const TRACK_URL = /^#\/academy\/track\/([^/]+)$/;
const trackSlugs = new Set(ACADEMY_TRACKS.map((t) => t.slug));
const lessonIds = new Set(ACADEMY_LESSONS.map((l) => l.id));

// Every Academy URL Ask SmartVideo can show must open a real track/lesson. The Academy
// page silently falls back to its hub for unknown ids, so a bad id would never error.
describe('assistant Academy links resolve to real content', () => {
  const urls = new Set([
    ...index.chunks.map((c) => c.url).filter((u) => u.startsWith('#/academy')),
    ...Object.values(STUDIO_ACADEMY).flatMap((a) => [...a.tracks.map(academyTrackUrl), ...a.lessons.map((l) => academyLessonUrl(l.track, l.lesson))]),
  ]);
  it('has Academy links to check', () => expect(urls.size).toBeGreaterThan(50));
  it.each([...urls])('%s', (u) => {
    const lesson = u.match(LESSON_URL);
    const track = u.match(TRACK_URL);
    expect(lesson || track, `unrecognised academy url ${u}`).toBeTruthy();
    expect(trackSlugs.has((lesson || track)[1]), `unknown track in ${u}`).toBe(true);
    if (lesson) expect(lessonIds.has(lesson[2]), `unknown lesson id in ${u}`).toBe(true);
  });
});

describe('academy route', () => {
  let area;
  beforeEach(() => {
    area = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(area);
    initRouter(area, () => {});
  });

  it('maps academy sub-paths to the academy loader only', () => {
    expect(academyKey('academy')).toBe('academy');
    expect(academyKey('academy/track/02-ai-filmmaking')).toBe('academy');
    expect(academyKey('image')).toBe('image');
    expect(academyKey('academyfoo')).toBe('academyfoo');
  });

  it('mounts the Academy hub for #/academy', async () => {
    await navigate('academy');
    await vi.waitFor(() => expect(area.textContent).toContain('AI Creator Academy'));
  });

  it('opens a track from a sub-path', async () => {
    const track = ACADEMY_TRACKS.find((t) => t.slug === '02-ai-filmmaking');
    await navigate('academy/track/02-ai-filmmaking');
    expect(getCurrentPage()).toBe('academy/track/02-ai-filmmaking');
    await vi.waitFor(() => expect(area.textContent).toContain(track.title));
    expect(area.textContent).not.toContain('Failed to load');
  });

  it('opens a lesson whose id contains "::"', async () => {
    const id = '06-ai-audio-and-music::04-music-sfx-generation';
    const lesson = ACADEMY_LESSONS.find((l) => l.id === id);
    expect(lesson).toBeTruthy();
    await navigate(`academy/track/06-ai-audio-and-music/lesson/${id}`);
    await vi.waitFor(() => expect(area.textContent).toContain(lesson.title));
  });
});
