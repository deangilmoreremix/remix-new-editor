/**
 * Timeline addon registry.
 *
 * Interactive-video addons (lead generator, pause, loop, skip, CTA, ...) were
 * Popcorn.js plugins in the upstream editor (strategic-limited/
 * remix-new-editor, lib/popcorn/plugins/*). They are re-implemented here as
 * plain descriptor objects — no Popcorn, no jQuery — so the timeline page can
 * list them, create clips from them, edit their options through a schema, and
 * run their playback behaviour through ./runtime.js.
 *
 * Descriptor shape:
 *   {
 *     type,            // clip.type stored on the timeline
 *     label, icon, description,
 *     category,        // 'interactive' | 'overlay'
 *     track,           // preferred timeline track name
 *     defaultDuration, // seconds
 *     defaults(),      // fresh option object, stored at clip.addon
 *     fields,          // schema consumed by ./addonEditor.js (optional)
 *     customEditor,    // true when the page renders its own settings panel
 *     behavior,        // key handled by ./runtime.js ('pause'|'loop'|'skip'|'gate')
 *   }
 */

const registry = new Map();

export function registerAddon(descriptor) {
  if (!descriptor || !descriptor.type) throw new Error('registerAddon: descriptor.type is required');
  registry.set(descriptor.type, Object.freeze({ category: 'interactive', track: 'Text', defaultDuration: 3, ...descriptor }));
  return registry.get(descriptor.type);
}

export function getAddon(type) {
  return registry.get(type) || null;
}

export function isAddonType(type) {
  return registry.has(type);
}

export function listAddons(category) {
  const all = Array.from(registry.values());
  return category ? all.filter((a) => a.category === category) : all;
}

/**
 * Build a new timeline clip for an addon, positioned at `startSec`.
 * Options live under `clip.addon` so the timeline view model can forward
 * them wholesale instead of whitelisting each field.
 */
export function createAddonClip(type, { startSec = 0, timelineSeconds = 60, id } = {}) {
  const addon = getAddon(type);
  if (!addon) throw new Error(`Unknown addon type: ${type}`);
  const duration = Math.max(0.1, addon.defaultDuration);
  const start = Math.max(0, Math.min(startSec, Math.max(0, timelineSeconds - duration)));
  const end = Math.min(timelineSeconds, start + duration);
  const base = {
    id: id ?? Date.now() + Math.floor(Math.random() * 1000),
    name: addon.label,
    type,
    start,
    end,
  };
  // Types with their own legacy flat-field shape (lead-form, click-to-call)
  // spread their defaults onto the clip; schema-driven ones nest them.
  if (addon.flatOptions) return { ...base, ...addon.defaults() };
  return { ...base, addon: addon.defaults() };
}

/** Clip timing in seconds from the page's left/width percentage model. */
export function clipTimeRange(clip, timelineSeconds) {
  if (typeof clip.left === 'number' && typeof clip.width === 'number') {
    const start = (clip.left / 100) * timelineSeconds;
    return { start, end: start + (clip.width / 100) * timelineSeconds };
  }
  return { start: Number(clip.start) || 0, end: Number(clip.end) || 0 };
}

/** Resolve a clip's addon options, filling any missing keys from defaults. */
export function addonOptions(clip) {
  const addon = getAddon(clip?.type);
  if (!addon) return {};
  if (addon.flatOptions) return clip;
  return { ...addon.defaults(), ...(clip.addon || {}) };
}
