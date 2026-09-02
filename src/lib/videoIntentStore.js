/**
 * Shared Video Intent Store
 *
 * Single source of truth for video intent data used by both
 * CinemaTemplateStudio and StoryboardStudio.
 */

const STORAGE_KEY = 'smartvideo_video_intent';

const DEFAULTS = {
  videoType: 'commercial',
  duration: 60,
  aspectRatio: '16:9',
  subject: '',
  premise: '',
  tone: 'cinematic',
  targetAudience: '',
  stylePreset: 'Cinematic',
  lightingPreset: 'Golden Hour',
  colorGrade: 'Teal & Orange',
  cta: '',
};

let state = { ...DEFAULTS };
let listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...DEFAULTS, ...parsed };
    }
  } catch {
    // ignore
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function notify() {
  listeners.forEach(fn => fn(state));
}

export function getVideoIntent() {
  return { ...state };
}

export function setVideoIntent(partial) {
  state = { ...state, ...partial };
  persist();
  notify();
}

export function resetVideoIntent() {
  state = { ...DEFAULTS };
  persist();
  notify();
}

export function subscribeVideoIntent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Initialize from storage once at module load
load();
