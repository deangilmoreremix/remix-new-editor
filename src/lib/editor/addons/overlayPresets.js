/**
 * Presets (upstream "combined" plugin): save a group of overlays — e.g. a
 * lower third + logo + sticker — and drop the whole group onto any video
 * later. Upstream rendered a preset as one combined element; here the
 * overlays are re-inserted individually so each stays editable.
 *
 * Presets are kept per browser in localStorage.
 */
import { getAddon } from './registry.js';

export const PRESETS_STORAGE_KEY = 'timeline-overlay-presets';
const MAX_PRESETS = 50;

/**
 * Capture the overlays active at time `t` (s) as a preset. Times are stored
 * relative to the earliest overlay so the preset can be dropped anywhere.
 */
export function capturePreset(tracks, t, timelineSeconds, name) {
  const items = [];
  (tracks || []).forEach((track, trackIndex) => {
    (track.items || track.clips || []).forEach((clip) => {
      if (getAddon(clip.type)?.category !== 'overlay') return;
      const start = (clip.left / 100) * timelineSeconds;
      const end = start + (clip.width / 100) * timelineSeconds;
      if (t >= start && t < end) {
        items.push({ type: clip.type, addon: JSON.parse(JSON.stringify(clip.addon || {})), start, duration: end - start, trackName: track.name, trackIndex });
      }
    });
  });
  if (!items.length) return null;
  const t0 = Math.min(...items.map((i) => i.start));
  return {
    id: `preset-${Date.now()}`,
    name: String(name || 'Preset').slice(0, 60),
    createdAt: new Date().toISOString(),
    items: items.map(({ start, duration, ...rest }) => ({
      ...rest,
      offset: Math.round((start - t0) * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
    })),
  };
}

/** Clips (start/end in seconds) for inserting `preset` at `startSec`. */
export function presetToClips(preset, startSec, timelineSeconds, idBase = Date.now()) {
  return (preset?.items || [])
    .filter((item) => getAddon(item.type))
    .map((item, i) => {
      const start = Math.min(Math.max(0, startSec + item.offset), Math.max(0, timelineSeconds - 0.1));
      const end = Math.min(timelineSeconds, start + Math.max(0.1, item.duration));
      const addon = getAddon(item.type);
      return {
        id: idBase + i,
        type: item.type,
        name: addon.summary ? addon.summary({ ...addon.defaults(), ...item.addon }) : addon.label,
        start,
        end,
        addon: JSON.parse(JSON.stringify(item.addon || {})),
        trackName: item.trackName,
      };
    });
}

export function loadPresets(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(PRESETS_STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePresets(list, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PRESETS_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_PRESETS)));
    return true;
  } catch {
    return false;
  }
}
