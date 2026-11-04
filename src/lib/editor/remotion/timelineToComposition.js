/**
 * Timeline → Remotion composition model.
 *
 * A pure function: turns the editor's state (tracks with clips positioned as
 * left/width percentages of state.timelineSeconds) into a plain, JSON-safe
 * model that TimelineComposition.jsx renders. The same model drives the
 * in-editor <Player> preview and the export runner (renderMediaOnWeb), so
 * what you see is what renders.
 *
 * Layers are listed in paint order (earlier tracks underneath, later tracks
 * on top; within a track, by start time). Interactive addons (Pause, Loop,
 * Skip, Lead Generator, CTA, List Builder) are live UI, not pixels: they are
 * left out of the rendered frames but stay in the editor.
 */
import { getAddon, addonOptions } from '../addons/registry.js';
import { resolveOverlayText, safeImageUrl, sanitizeWrapperStyles } from '../addons/overlayRender.js';
import { buildLowerThirdLottie } from '../addons/lowerThirds.js';
import { mapVideoTransition } from './transitionMap.js';
import { defaultCaptionStyle } from './captions.js';
import { buildCtaLottie } from '../addons/ctaLottie.js';

function ctaOptions(clip, profile) {
  const style = clip.style || {};
  const buttonText = resolveOverlayText(clip.buttonText || 'Call Now', profile);
  const animation = clip.animation || 'none';
  return {
    buttonText,
    animation,
    fontFamily: clip.fontFamily || 'Montserrat',
    textColor: clip.textColor || '#ffffff',
    buttonColor: style.buttonColor || '#eb5054',
    iconColor: clip.iconColor || '',
    accentColor: clip.accentColor || '',
    posLeft: style.posLeft ?? 50,
    posTop: style.posTop ?? 50,
    posWidth: style.posWidth ?? 40,
    opacity: style.opacity ?? 100,
    blendMode: style.blendMode || 'normal',
    resolvedSrc: animation === 'custom' ? safeImageUrl(clip.lottieSrc) : null,
    lottie: animation !== 'custom' ? buildCtaLottie({ ...clip, animation, buttonText, buttonColor: style.buttonColor }) : null,
  };
}

export const QUALITY_PRESETS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

const round = (n) => Math.round(n * 1000) / 1000;

function clipSeconds(clip, T) {
  if (typeof clip.left === 'number' && typeof clip.width === 'number') {
    const start = (clip.left / 100) * T;
    return { start, end: start + (clip.width / 100) * T };
  }
  return { start: Number(clip.start) || 0, end: Number(clip.end) || 0 };
}

const isVideoTrack = (track) => (track.type || '').toLowerCase() === 'video';
const isAudioTrack = (track) => (track.type || '').toLowerCase() === 'audio';

/** Track audibility honouring mute/solo across tracks. */
function audibleTracks(tracks) {
  const anySolo = tracks.some((t) => t.solo);
  return new Set(tracks.filter((t) => !t.muted && (!anySolo || t.solo)).map((t) => t.id));
}

function overlayLayer(clip, opts, profile, base) {
  const o = { ...opts };
  // Personalization and media resolved up front so the composition (which
  // may run in a sandboxed iframe) needs no access to editor state.
  if (typeof o.text === 'string') o.text = resolveOverlayText(o.text, profile);
  if (typeof o.name === 'string' && clip.type === 'overlay-lower-third') o.name = resolveOverlayText(o.name, profile);
  if (typeof o.title === 'string') o.title = resolveOverlayText(o.title, profile);
  switch (clip.type) {
    case 'overlay-personalized-image': {
      const resolved = resolveOverlayText(o.src, profile);
      o.resolvedSrc = (!/\{\{/.test(resolved) && safeImageUrl(resolved)) || safeImageUrl(o.fallbackSrc) || null;
      break;
    }
    case 'overlay-image':
    case 'overlay-sticker':
    case 'overlay-transition':
      o.resolvedSrc = safeImageUrl(o.src);
      break;
    case 'overlay-background':
      o.resolvedStyles = sanitizeWrapperStyles(o.styles);
      break;
    case 'overlay-lower-third':
      o.lottie = buildLowerThirdLottie(o);
      break;
    default:
      break;
  }
  return { ...base, kind: 'overlay', type: clip.type, options: o };
}

/**
 * @param {object} state      editor state
 * @param {object} opts       { fps=30, quality='1080p', profile=null }
 */
export function timelineToComposition(state, { fps = 30, quality = '1080p', profile = null } = {}) {
  const { width, height } = QUALITY_PRESETS[quality] || QUALITY_PRESETS['1080p'];
  const T = Number(state?.timelineSeconds) || 60;
  const tracks = Array.isArray(state?.tracks) ? state.tracks : [];
  const audible = audibleTracks(tracks);
  const toFrame = (sec) => Math.max(0, Math.round(sec * fps));

  const layers = [];
  const audio = [];
  const transitions = [];
  const skipped = [];
  const media = []; // base video/image clips, for transition pairing

  tracks.forEach((track, trackIndex) => {
    const items = (track.items || track.clips || [])
      .map((clip) => ({ clip, ...clipSeconds(clip, T) }))
      .filter((c) => c.end > c.start)
      .sort((a, b) => a.start - b.start);

    items.forEach(({ clip, start, end }) => {
      const from = toFrame(start);
      const durationInFrames = Math.max(1, toFrame(end) - from);
      const base = {
        id: String(clip.id),
        trackIndex,
        from,
        durationInFrames,
        effects: Array.isArray(clip.effects) ? clip.effects : [],
        keyframes: clip.keyframes || null,
      };
      const addon = getAddon(clip.type);

      // CTA buttons are drawn in the video (animated or plain); clicking them
      // works in the interactive player only.
      if (clip.type === 'click-to-call') {
        layers.push({ ...base, kind: 'overlay', type: 'cta-button', options: ctaOptions(clip, profile) });
        return;
      }
      if (addon && addon.category !== 'overlay') {
        skipped.push({ id: base.id, type: clip.type, label: addon.label });
        return;
      }
      if (clip.type === 'overlay-video-transition') {
        const opts = addonOptions(clip);
        transitions.push({ id: base.id, from, durationInFrames, name: opts.transition, ...mapVideoTransition(opts.transition) });
        return;
      }
      if (addon) {
        layers.push(overlayLayer(clip, addonOptions(clip), profile, base));
        return;
      }
      if (clip.type === 'remotion-code') {
        layers.push({ ...base, kind: 'code', code: String(clip.code || ''), props: clip.props || {}, title: clip.name || '' });
        return;
      }
      if (clip.type === 'caption-track' || clip.type === 'captions') {
        layers.push({ ...base, kind: 'captions', captions: Array.isArray(clip.captions) ? clip.captions : [], style: { ...defaultCaptionStyle(clip.captionStyle?.preset), ...(clip.captionStyle || {}) } });
        return;
      }

      const src = clip.src ? String(clip.src) : '';
      const volume = Math.max(0, Math.min(1, clip.volume ?? 1));
      const trimBefore = toFrame(Number(clip.trimIn ?? clip.sourceStart ?? 0));
      if ((clip.type === 'audio' || isAudioTrack(track)) && clip.type !== 'video') {
        if (src) audio.push({ ...base, kind: 'audio', src, trimBefore, volume: audible.has(track.id) ? volume : 0 });
        return;
      }
      if (clip.type === 'video' && src) {
        const layer = { ...base, kind: 'video', src, trimBefore, fit: clip.fit || 'cover', volume: audible.has(track.id) ? volume : 0 };
        layers.push(layer);
        if (isVideoTrack(track)) media.push(layer);
        return;
      }
      if (clip.type === 'image' && src) {
        const layer = { ...base, kind: 'image', src, fit: clip.fit || 'cover' };
        layers.push(layer);
        if (isVideoTrack(track)) media.push(layer);
        return;
      }
      if (clip.type === 'text' && (clip.heading || clip.body)) {
        layers.push({ ...base, kind: 'title', heading: resolveOverlayText(clip.heading || '', profile), body: resolveOverlayText(clip.body || '', profile) });
      }
      // Clips with no media yet (placeholders) render nothing — black.
    });
  });

  // Pair each video transition with the clips either side of its centre.
  media.sort((a, b) => a.from - b.from);
  transitions.forEach((tr) => {
    const mid = tr.from + tr.durationInFrames / 2;
    const out = [...media].reverse().find((m) => m.from < mid && m.from + m.durationInFrames <= mid + tr.durationInFrames);
    const into = media.find((m) => m !== out && m.from >= mid - tr.durationInFrames);
    tr.outgoingId = out?.id || null;
    tr.incomingId = into?.id || null;
  });

  const lastFrame = Math.max(
    toFrame(T),
    ...layers.map((l) => l.from + l.durationInFrames),
    ...audio.map((l) => l.from + l.durationInFrames),
  );

  return {
    version: 1,
    fps,
    width,
    height,
    durationInFrames: Math.max(1, lastFrame),
    durationInSeconds: round(Math.max(1, lastFrame) / fps),
    background: '#000000',
    layers,
    audio,
    transitions,
    skipped,
    fonts: collectFonts(layers),
  };
}

/** Fonts AI animations may use (create_animation); loaded when the timeline has any. */
export const ANIMATION_FONTS = ['Inter', 'Montserrat', 'Poppins', 'Anton', 'Bebas Neue', 'Roboto', 'Lobster', 'Pacifico'];

/** Google font families the composition needs to load. */
export function collectFonts(layers) {
  const set = new Set();
  if (layers.some((l) => l.kind === 'code')) ANIMATION_FONTS.forEach((f) => set.add(f));
  layers.forEach((l) => {
    const f = l.options?.fontFamily || (l.kind === 'captions' ? l.style?.fontFamily : null);
    if (f) set.add(String(f));
  });
  return [...set];
}
