/**
 * TemplateCompositionBuilder
 *
 * Converts Template Generator state into a normalized Timeline composition.
 * Replaces the legacy `MultiselectTemplateStore.getProjectData()` behavior
 * but produces output compatible with TimelineFeatureApi.applyTemplate()
 * (so it participates in one transactional history entry).
 *
 * Inputs: Template Generator state
 *   {
 *     niche, script, template, media[], transitions[], overlays[],
 *     voice, personalization, preview
 *   }
 *
 * Output: { name, tracks: [{ type, name, clips: [...] }] }
 *
 * Design rules:
 *  - If a Niche Script was selected and provides base composition data,
 *    use it as the base. Otherwise build a fresh composition from media.
 *  - If a visual Template was selected (and no Niche Script base), use the
 *    template's base prompt/data as the foundation.
 *  - Media items are placed in order on a single Video track.
 *  - Transitions are inserted between consecutive media clips.
 *  - Content overlays (text, CTA, captions) are placed on dedicated tracks.
 *  - Voice is placed on an Audio track.
 *  - Personalization is stored as metadata, not mutated into clips.
 *  - Result remains fully editable (no flattening).
 */

import { ALL_NICHE_TEMPLATES } from '../nicheTemplatesIndex.js';

const DEFAULT_CLIP_DURATION = 5;

function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse a legacy Popcorn-style niche script project string.
 * Returns null if the input is not parseable.
 */
export function parseNicheScriptProjectData(projectDataString) {
  if (!projectDataString || typeof projectDataString !== 'string') return null;
  try {
    const data = JSON.parse(projectDataString);
    if (!data?.media) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Convert a parsed Popcorn project into a normalized track spec.
 * Returns { tracks: [{ type, name, clips: [...] }] }.
 */
function popcorProjectToTemplateSpec(popcornData) {
  const tracks = [];
  const media = popcornData.media?.[0];
  if (!media?.tracks) return { tracks: [] };

  for (const track of media.tracks) {
    const isAudio = track.name?.toLowerCase().includes('audio') || track.track === 1;
    const trackType = isAudio ? 'audio' : 'video';
    const clips = (track.trackEvents || []).map((evt) => {
      const clipDuration = (evt.popcornOptions?.end || 0) - (evt.popcornOptions?.start || 0);
      return {
        type: isAudio ? 'audio' : (evt.type === 'image' ? 'image' : 'video'),
        name: evt.name || 'Clip',
        duration: clipDuration || DEFAULT_CLIP_DURATION,
        startTime: evt.popcornOptions?.start || 0,
        text: evt.popcornOptions?.text || undefined,
        // Keep a reference to the underlying event for reference, but do not
        // bake legacy data into the timeline state.
        _legacyEventId: evt.id,
      };
    }).filter(c => c.duration > 0);

    if (clips.length > 0) {
      tracks.push({
        type: trackType,
        name: track.name || (isAudio ? 'Audio' : 'Video'),
        clips,
      });
    }
  }
  return { tracks };
}

/**
 * Build a normalized composition from Template Generator state.
 *
 * @param {Object} state - Template Generator state
 * @returns {{
 *   name: string,
 *   tracks: Array<{ type: string, name: string, clips: Array }>,
 *   meta: { source: string, totalDuration: number, clipCount: number }
 * }}
 */
export function buildCompositionFromState(state) {
  const composition = {
    name: state.template?.selected?.name || state.script?.selectedNicheScript?.title || 'Template Composition',
    tracks: [],
    meta: { source: 'template-generator', totalDuration: 0, clipCount: 0 },
  };

  // 1. Determine the base composition.
  //    Priority: Niche Script base > Template base > empty.
  let baseTracks = [];

  if (state.script?.selectedNicheScript?.project?.data) {
    const parsed = parseNicheScriptProjectData(state.script.selectedNicheScript.project.data);
    if (parsed) {
      const spec = popcorProjectToTemplateSpec(parsed);
      baseTracks = spec.tracks;
      composition.meta.source = 'template-generator:niche-script';
    }
  }

  // If Niche Script provided nothing usable, try the visual template's
  // base prompt as a single-clip starter.
  if (baseTracks.length === 0 && state.template?.selected) {
    const tpl = state.template.selected;
    const duration = tpl.duration?.default || tpl.duration?.min || DEFAULT_CLIP_DURATION;
    baseTracks = [{
      type: 'video',
      name: tpl.name || 'Template',
      clips: [{
        type: 'video',
        name: tpl.name || 'Template Clip',
        duration,
        text: tpl.basePrompt || tpl.description,
      }],
    }];
    composition.meta.source = 'template-generator:visual-template';
  }

  // 2. If user-selected media exists, REPLACE any placeholder video clips
  //    with the user's media in the order they were selected.
  if (state.media && state.media.length > 0) {
    const userClips = state.media
      .filter(m => m && (m.url || m.id || m.assetId))
      .map((m, i) => {
        const duration = m.duration || DEFAULT_CLIP_DURATION;
        return {
          assetId: m.assetId || m.id,
          asset: m.asset || (m.url ? {
            id: m.id || generateId('asset'),
            type: m.type || 'video',
            name: m.name || `Media ${i + 1}`,
            url: m.url,
            duration,
            thumbnail: m.thumbnail,
          } : null),
          type: m.type || 'video',
          name: m.name || `Media ${i + 1}`,
          duration,
          startTime: undefined, // set sequentially below
        };
      })
      .filter(c => c.asset);

    if (userClips.length > 0) {
      // Place user media on a dedicated "User Media" track at the top,
      // and keep base template content on a "Template Content" track below.
      baseTracks.unshift({
        type: 'video',
        name: 'User Media',
        clips: userClips,
      });
    }
  }

  // 3. Compute sequential start times for each track and total duration.
  let maxDuration = 0;
  for (const track of baseTracks) {
    let cursor = 0;
    for (const clip of track.clips) {
      if (clip.startTime === undefined) {
        clip.startTime = cursor;
      }
      cursor = clip.startTime + (clip.duration || DEFAULT_CLIP_DURATION);
    }
    maxDuration = Math.max(maxDuration, cursor);
  }

  // 4. Insert transitions between consecutive user-media clips.
  if (state.transitions && state.transitions.length > 0 && baseTracks.length > 0) {
    const userMediaTrack = baseTracks[0]; // User Media is at index 0
    if (userMediaTrack && userMediaTrack.clips.length >= 2) {
      userMediaTrack.clips.forEach((clip, i) => {
        if (i < userMediaTrack.clips.length - 1) {
          const transition = state.transitions.find(t => t.position === i)
            || state.transitions[Math.min(i, state.transitions.length - 1)];
          if (transition) {
            clip.transition = {
              type: transition.type || 'dissolve',
              duration: transition.duration || 1,
              direction: transition.direction,
              easing: transition.easing,
              parameters: transition.parameters,
            };
          }
        }
      });
    }
  }

  // 5. Add content overlays as dedicated tracks.
  if (state.overlays && state.overlays.length > 0) {
    const overlayTracks = new Map(); // type -> track
    for (const overlay of state.overlays) {
      const kind = overlay.kind || 'overlay';
      const type = overlay.type || (kind === 'text' || kind === 'caption' ? 'caption' : 'overlay');
      const trackName = overlay.trackName || type.charAt(0).toUpperCase() + type.slice(1);

      if (!overlayTracks.has(trackName)) {
        overlayTracks.set(trackName, {
          type: type === 'audio' ? 'audio' : 'video',
          name: trackName,
          clips: [],
        });
      }
      const track = overlayTracks.get(trackName);
      track.clips.push({
        type,
        name: overlay.name || trackName,
        duration: overlay.duration || DEFAULT_CLIP_DURATION,
        startTime: overlay.startTime ?? 0,
        text: overlay.text,
        // Persist the full overlay config so the feature API can rebuild
        // the right asset (CTA, lead form, sticker, etc.)
        _overlayConfig: overlay,
      });
    }
    for (const t of overlayTracks.values()) composition.tracks.push(t);
  }

  // 6. Add voice narration track if voice is enabled.
  if (state.voice?.enabled) {
    const voiceDuration = state.voice.generatedAsset?.duration
      || (state.script?.text ? Math.max(3, state.script.text.split(/\s+/).length * 0.4) : DEFAULT_CLIP_DURATION);
    composition.tracks.push({
      type: 'audio',
      name: 'Voice',
      clips: [{
        type: 'audio',
        name: 'Voice Narration',
        duration: voiceDuration,
        startTime: 0,
        asset: state.voice.generatedAsset,
        // Voice metadata so it can be regenerated / re-edited later
        _voiceMeta: {
          provider: state.voice.provider,
          voice: state.voice.voice,
          instructions: state.voice.instructions,
          text: state.voice.text,
        },
      }],
    });
    maxDuration = Math.max(maxDuration, voiceDuration);
  }

  // 7. Append the base tracks.
  for (const t of baseTracks) composition.tracks.push(t);

  // 8. Stamp total meta.
  composition.meta.totalDuration = maxDuration;
  composition.meta.clipCount = composition.tracks.reduce((n, t) => n + t.clips.length, 0);

  return composition;
}

/**
 * Build a preview-only description of the composition.
 * Mirrors buildCompositionFromState but produces a lightweight
 * description suitable for rendering in the Preview step without
 * committing to the timeline.
 */
export function buildPreviewFromState(state) {
  const composition = buildCompositionFromState(state);
  return {
    name: composition.name,
    duration: composition.meta.totalDuration,
    clipCount: composition.meta.clipCount,
    tracks: composition.tracks.map(t => ({
      type: t.type,
      name: t.name,
      clipCount: t.clips.length,
      duration: t.clips.reduce((sum, c) => sum + (c.duration || 0), 0),
      clips: t.clips.map((c, i) => ({
        index: i,
        name: c.name,
        type: c.type,
        duration: c.duration,
        startTime: c.startTime,
        hasTransition: !!c.transition,
        hasOverlay: !!c._overlayConfig,
        hasVoiceMeta: !!c._voiceMeta,
      })),
    })),
    meta: composition.meta,
  };
}

/**
 * Resolve personalization tokens against a contact record.
 * Example tokens: {{first_name}}, {{company}}
 * Falls back to contact fallback values, then to "".
 */
export function resolvePersonalizationTokens(text, contact) {
  if (!text || typeof text !== 'string') return text;
  if (!contact) return text;
  const map = {
    first_name: contact.first_name || contact.firstName || contact.fallback?.first_name || '',
    last_name: contact.last_name || contact.lastName || contact.fallback?.last_name || '',
    company: contact.company || contact.fallback?.company || '',
    city: contact.city || contact.fallback?.city || '',
    industry: contact.industry || contact.fallback?.industry || '',
    offer: contact.offer || contact.fallback?.offer || '',
    email: contact.email || contact.fallback?.email || '',
    phone: contact.phone || contact.fallback?.phone || '',
    custom_field: contact.custom_field || contact.fallback?.custom_field || '',
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => {
    const v = map[key.toLowerCase()];
    return v != null ? String(v) : '';
  });
}

export default {
  buildCompositionFromState,
  buildPreviewFromState,
  parseNicheScriptProjectData,
  resolvePersonalizationTokens,
};
