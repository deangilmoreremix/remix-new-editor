/**
 * The editor timeline as a Remotion composition.
 *
 * Renders the model from timelineToComposition.js. Used both by the
 * in-editor <Player> preview and by the sandboxed export runner
 * (renderMediaOnWeb), so preview and export match.
 *
 * Only CSS the web renderer supports is used: absolute % boxes in DOM paint
 * order (no z-index), opacity, transforms, border-radius, text-shadow,
 * box-shadow (no spread/inset), linear-gradient backgrounds and
 * mix-blend-mode (Remotion ≥ 4.0.540). Things the renderer can't draw
 * directly (Text Mask's SVG mask) are pre-rendered to an image.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill, Sequence, Img, useCurrentFrame, useVideoConfig, delayRender, continueRender,
} from 'remotion';
import { Video, Audio } from '@remotion/media';
import { Lottie } from '@remotion/lottie';
import { fitText } from '@remotion/layout-utils';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { iris } from '@remotion/transitions/iris';
import { cube } from '@remotion/transitions/cube';
import { pushCut } from '@remotion/transitions/push-cut';
import { loadFont } from '@remotion/fonts';
import { animationStyle } from './overlayAnimations.js';
import { buildEffectDescriptors } from './effects.js';
import { stretchLowerThird } from '../addons/lowerThirds.js';
import { transformStyleAt, effectOverridesAt, valueAt, hasKeyframes } from './keyframes.js';
import { captionPages, pageAt } from './captions.js';
import { CodeLayer } from './codeLayer.jsx';
// [hyperframes] additive layer kind; renders nothing unless a layer of kind 'hyperframes' exists in the model
import { HyperframesLayer } from './hyperframes/HyperframesLayer.jsx';
import { ClipFx as OccClipFx } from '../../../openchatcut/gl/ClipFx';
import { zoomAt } from '../../../openchatcut/editor/zoom';
import { clipTransformCss, clipTransformClipPath } from '../../../cinegen/lib/occ/transform';
import { backgroundFillAppearance, backgroundFillFilter } from '../../../openchatcut/editor/backgroundFill';
import { sampleKeyframes as sampleFxKey } from '../../../openchatcut/editor/keyframes';
import { clipFadeFactor } from '../../../openchatcut/editor/clipFade';
import { CaptionsLayer as OccCaptionsLayer } from '../../../openchatcut/captions/CaptionsLayer';
import { GlTransitionLayer } from '../../../openchatcut/gl/GlTransitionLayer';
import { registerUserLut } from '../../../cinegen/lib/occ/user-luts';
import { registerSnapshot } from '../../../cinegen/lib/occ/plugins';
import { ctaBox, CTA_FPS } from '../addons/ctaLottie.js';

// ------------------------------------------------------------------ fonts

const FontsReady = React.createContext(false);

function googleFontHref(family) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400;1,700&display=block`;
}

/**
 * Register a Google font family with Remotion (@remotion/fonts), so both
 * HTML text and SVG text (Lottie lower thirds) render with it in the Player
 * and in the web renderer. Reads Google's CSS for the latin woff2 files.
 */
const registered = new Map();
const registeredDone = new Set();

/** Register every family; resolves when all are loaded (or failed). */
export function registerGoogleFonts(families = []) {
  return Promise.all(families.map(registerGoogleFont));
}

/** [remix] user-imported fonts (TTF/OTF/WOFF2 chosen in the caption font control). Registered through the same Remotion loader; the export
 *  carries the font bytes as a data URL because the sandboxed runner has no access to the editor's IndexedDB. */
const userFontPromises = new Map();
export function registerUserFont({ family, dataUrl }) {
  if (!userFontPromises.has(family)) {
    userFontPromises.set(family, loadFont({ family, url: dataUrl, weight: '100 900' }).catch(() => null).then(() => { registeredDone.add(family); }));
  }
  return userFontPromises.get(family);
}

export function registerGoogleFont(family) {
  if (userFontPromises.has(family)) return userFontPromises.get(family);
  if (registered.has(family)) return registered.get(family);
  const p = fetch(googleFontHref(family))
    .then((r) => (r.ok ? r.text() : ''))
    .then((css) => {
      const faces = [];
      css.split('@font-face').slice(1).forEach((block) => {
        const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
        const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
        const style = (block.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
        const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
        // The last block per weight/style is Google's basic latin subset.
        if (url && (!range || /U\+0000-00FF/i.test(range))) faces.push({ url, weight, style, range });
      });
      return Promise.all(faces.map((f) => loadFont({ family, url: f.url, weight: f.weight, style: f.style, unicodeRange: f.range, format: 'woff2' }).catch(() => null)));
    })
    .catch(() => null)
    .then(() => { registeredDone.add(family); });
  registered.set(family, p);
  return p;
}

/** Load the Google fonts the timeline uses before any text is measured or drawn. */
function FontGate({ fonts, userFonts, children }) {
  (userFonts || []).forEach(registerUserFont);
  // The export runner registers fonts before rendering starts, so this is
  // normally ready immediately; the delayRender path covers the Player.
  const initiallyReady = !fonts?.length || fonts.every((f) => registeredDone.has(f));
  const [ready, setReady] = useState(initiallyReady);
  const [handle] = useState(() => (initiallyReady ? null : delayRender('Loading fonts')));
  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    const timeout = new Promise((r) => setTimeout(r, 10000));
    Promise.race([Promise.all(fonts.map(registerGoogleFont)), timeout]).then(() => {
      if (cancelled) return;
      setReady(true);
      if (handle !== null) continueRender(handle);
    });
    return () => { cancelled = true; };
  }, [fonts, handle, ready]);
  return <FontsReady.Provider value={ready}>{ready ? children : null}</FontsReady.Provider>;
}

// ------------------------------------------------------------------ helpers

const pct = (n, fallback) => `${Number.isFinite(Number(n)) ? Number(n) : fallback}%`;

function boxStyle(o, extra = {}) {
  const g = { left: 0, top: 0, width: 100, height: 100, ...(o.geometry || {}) };
  return {
    position: 'absolute',
    left: pct(g.left, 0),
    top: pct(g.top, 0),
    width: pct(g.width, 100),
    height: pct(g.height, 100),
    opacity: (o.opacity ?? 100) / 100,
    mixBlendMode: o.blendMode && o.blendMode !== 'normal' ? o.blendMode : undefined,
    ...extra,
  };
}

/** Wrap an overlay in its box + in/idle/out animation. */
function Animated({ o, durationInFrames, children, fullFrame = false }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = animationStyle(o, frame, durationInFrames, fps, Number(o.rotation) || 0);
  const base = fullFrame ? { position: 'absolute', inset: 0, opacity: (o.opacity ?? 100) / 100 } : boxStyle(o);
  return (
    <div style={{ ...base, opacity: base.opacity * anim.opacity, transform: anim.transform, mixBlendMode: base.mixBlendMode || (o.blendMode !== 'normal' ? o.blendMode : undefined) }}>
      {children}
    </div>
  );
}

function strokeShadow(color, px) {
  const d = Math.max(1, px);
  return [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]].map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(', ');
}

// ------------------------------------------------------------------ overlays

function SmartText({ o, durationInFrames }) {
  const { width: W, height: H } = useVideoConfig();
  const fontsReady = React.useContext(FontsReady);
  const g = { width: 22, height: 10, ...(o.geometry || {}) };
  const boxW = (g.width / 100) * W;
  const boxH = (g.height / 100) * H;
  const deco = o.fontDecorations || {};
  const weight = deco.bold ? 700 : 400;
  const lines = String(o.text ?? '').split('\n');
  let fontSize;
  if (deco.responsive !== false) {
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '') || ' ';
    let byWidth = boxH;
    try {
      byWidth = fitText({ text: longest, withinWidth: boxW * 0.96, fontFamily: o.fontFamily || 'Anton', fontWeight: weight }).fontSize;
    } catch { /* fonts not ready / no canvas: fall back to height */ }
    fontSize = Math.max(6, Math.min(byWidth, boxH / (lines.length * 1.18)));
  } else {
    fontSize = ((Number(o.fontSize) || 8) / 100) * H;
  }
  const shadows = [];
  if (o.stroke) shadows.push(strokeShadow(o.strokeColor || '#000', fontSize * 0.04));
  if (o.shadow) shadows.push(`0 1px 5px ${o.shadowColor}`, `0 1px 10px ${o.shadowColor}`);
  const align = o.alignment || 'center';
  if (!fontsReady) return null;
  return (
    <Animated o={o} durationInFrames={durationInFrames}>
      <div style={{
        width: '100%', height: deco.responsive === false ? 'auto' : '100%', display: 'flex', alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        background: o.background ? (o.backgroundColor || '#888888') : undefined,
      }}>
        <div style={{
          color: o.fontColor || '#FFFFFF', fontFamily: `"${o.fontFamily || 'Anton'}"`, fontWeight: weight,
          fontStyle: deco.italics ? 'italic' : 'normal', fontSize, lineHeight: 1.15, textAlign: align,
          whiteSpace: 'pre-wrap', textShadow: shadows.join(', ') || undefined, width: '100%',
        }}>
          {o.text}
        </div>
      </div>
    </Animated>
  );
}

function ImageOverlay({ o, durationInFrames, personalized, effects }) {
  const src = o.resolvedSrc;
  if (!src) return null;
  const radius = personalized ? `${Number(o.cornerRadius) || 0}%` : (o.cornerRadius ? '50%' : 0);
  // Logo backing plate (personalized images): padded, rounded.
  const plate = personalized && o.plateColor
    ? { background: o.plateColor, padding: '6%', boxSizing: 'border-box', borderRadius: o.cornerRadius ? radius : '10%' }
    : null;
  return (
    <Animated o={{ ...o, geometry: o.fill ? { left: 0, top: 0, width: 100, height: 100 } : o.geometry }} durationInFrames={durationInFrames}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: radius, ...(plate || {}) }}>
        <Img src={src} effects={effects} style={{ width: '100%', height: '100%', objectFit: o.fit === 'contain' ? 'contain' : (o.fill || personalized ? 'cover' : 'contain'), objectPosition: personalized && o.objectPosition ? o.objectPosition : undefined }} />
      </div>
    </Animated>
  );
}

function useJson(url) {
  const [data, setData] = useState(null);
  const [handle] = useState(() => (url ? delayRender(`Loading ${url}`) : null));
  useEffect(() => {
    if (!url) return;
    let done = false;
    fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((json) => {
      if (done) return;
      setData(json);
      if (handle !== null) continueRender(handle);
    });
    return () => { done = true; };
  }, [url, handle]);
  return data;
}

function StickerOverlay({ o, durationInFrames, effects }) {
  const lottieData = useJson(o.kind === 'lottie' ? o.resolvedSrc : null);
  if (!o.resolvedSrc) return null;
  return (
    <Animated o={o} durationInFrames={durationInFrames}>
      {o.kind === 'lottie'
        ? (lottieData ? <Lottie animationData={lottieData} loop style={{ width: '100%', height: '100%' }} /> : null)
        : <Img src={o.resolvedSrc} effects={effects} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
    </Animated>
  );
}

function LowerThird({ o, durationInFrames }) {
  const { fps } = useVideoConfig();
  const fontsReady = React.useContext(FontsReady);
  // Lottie files are authored at 30 fps; stretch the hold to the clip length.
  const data = useMemo(() => (o.lottie ? stretchLowerThird(o.lottie, (durationInFrames / fps) * 30) : null), [o.lottie, durationInFrames, fps]);
  if (!data || !fontsReady) return null;
  return (
    <div style={boxStyle(o, { transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined })}>
      <Lottie animationData={data} loop={false} playbackRate={30 / fps} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

function OverlayTransition({ o }) {
  if (!o.resolvedSrc) return null;
  return (
    <AbsoluteFill style={{ opacity: (o.opacity ?? 100) / 100, mixBlendMode: o.blendMode || 'screen' }}>
      <Video src={o.resolvedSrc} muted objectFit="cover" style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
}

function Wrapper({ o }) {
  const s = o.resolvedStyles || {};
  const style = { position: 'absolute', inset: 0, background: o.background || '#888888', opacity: (o.opacity ?? 100) / 100, mixBlendMode: o.blendMode !== 'normal' ? o.blendMode : undefined };
  const camel = (p) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  Object.entries(s).forEach(([prop, value]) => { style[camel(prop)] = value; });
  return <div style={style} />;
}

/** Text Mask: colour frame with the text cut out, pre-rendered to a PNG. */
function TextMask({ o }) {
  const { width: W, height: H } = useVideoConfig();
  const fontsReady = React.useContext(FontsReady);
  const url = useMemo(() => {
    if (!fontsReady || typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = o.backgroundColor || '#000000';
    ctx.fillRect(0, 0, W, H);
    const weight = o.fontDecorations?.bold ? 'bold ' : '';
    const family = `"${o.fontFamily || 'Bowlby One SC'}", sans-serif`;
    let size = H * 0.6;
    ctx.font = `${weight}${size}px ${family}`;
    while (size > 8 && ctx.measureText(String(o.text || '')).width > W * 0.92) {
      size *= 0.95;
      ctx.font = `${weight}${size}px ${family}`;
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(o.text || ''), W / 2, H / 2);
    return c.toDataURL('image/png');
  }, [fontsReady, W, H, o.backgroundColor, o.fontFamily, o.fontDecorations, o.text]);
  if (!url) return null;
  return (
    <AbsoluteFill style={{ opacity: (o.opacity ?? 100) / 100, mixBlendMode: o.blendMode !== 'normal' ? o.blendMode : undefined }}>
      <Img src={url} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
}

function TitleCard({ layer }) {
  const fontsReady = React.useContext(FontsReady);
  if (!fontsReady) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '8%' }}>
      <div style={{ color: '#fff', fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
        {layer.heading ? <div style={{ fontSize: 64, fontWeight: 700 }}>{layer.heading}</div> : null}
        {layer.body ? <div style={{ fontSize: 32, marginTop: 16, opacity: 0.85 }}>{layer.body}</div> : null}
      </div>
    </AbsoluteFill>
  );
}

/** CTA button (click-to-call clip): animated Lottie, custom Lottie, or a plain pill. */
function CtaButton({ o }) {
  const { width: W, height: H, fps } = useVideoConfig();
  const fontsReady = React.useContext(FontsReady);
  const custom = useJson(o.animation === 'custom' ? o.resolvedSrc : null);
  const box = ctaBox(o, W / H);
  const style = {
    position: 'absolute', left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`,
    opacity: (o.opacity ?? 100) / 100, mixBlendMode: o.blendMode && o.blendMode !== 'normal' ? o.blendMode : undefined,
  };
  if (!fontsReady) return null;
  const data = o.lottie || custom;
  if (data) {
    return <div style={style}><Lottie animationData={data} loop playbackRate={(data.fr || CTA_FPS) / fps} style={{ width: '100%', height: '100%' }} /></div>;
  }
  if (o.animation === 'custom') return null; // still loading / invalid
  const h = (box.height / 100) * H;
  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: '90%', height: '60%', borderRadius: 999, background: o.buttonColor, color: o.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: `"${o.fontFamily}", system-ui, sans-serif`, fontWeight: 700, fontSize: h * 0.26, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', whiteSpace: 'nowrap', overflow: 'hidden',
      }}
      >
        {o.buttonText}
      </div>
    </div>
  );
}

const OVERLAYS = {
  'cta-button': CtaButton,
  'overlay-text': SmartText,
  'overlay-image': (p) => <ImageOverlay {...p} />,
  'overlay-personalized-image': (p) => <ImageOverlay {...p} personalized />,
  'overlay-sticker': StickerOverlay,
  'overlay-lower-third': LowerThird,
  'overlay-transition': OverlayTransition,
  'overlay-background': Wrapper,
  'overlay-text-mask': TextMask,
};

// ------------------------------------------------------------------ transitions

const PRESENTATIONS = {
  fade: () => fade(),
  slide: (p) => slide(p),
  wipe: (p) => wipe(p),
  flip: (p) => flip(p),
  'clock-wipe': (_p, W, H) => clockWipe({ width: W, height: H }),
  iris: (_p, W, H) => iris({ width: W, height: H }),
  cube: (p) => cube({ direction: 'from-right', ...p }),
  'push-cut': () => pushCut(),
};

export function presentationFor(tr, W, H) {
  // GPU (HtmlInCanvas) presentations are experimental; use the CSS fallback.
  const name = tr.gpu ? tr.fallback : tr.presentation;
  const make = PRESENTATIONS[name] || PRESENTATIONS.fade;
  return make(tr.presentationProps || {}, W, H);
}

/** Apply a transition presentation to a media layer during its window. */
function InTransition({ tr, direction, layerFrom, children }) {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const abs = layerFrom + frame;
  if (!tr || abs < tr.from || abs >= tr.from + tr.durationInFrames) {
    // Outside the window the extended part of an outgoing clip is hidden.
    if (tr && direction === 'exiting' && abs >= tr.from + tr.durationInFrames) return null;
    if (tr && direction === 'entering' && abs < tr.from) return null;
    return children;
  }
  const progress = (abs - tr.from) / tr.durationInFrames;
  const p = presentationFor(tr, W, H);
  const Comp = p.component;
  return (
    <Comp
      presentationProgress={progress}
      presentationDirection={direction}
      passedProps={p.props}
      presentationDurationInFrames={tr.durationInFrames}
      onElementImage={() => {}}
      onUnmount={() => {}}
      bothEnteringAndExiting
    >
      {children}
    </Comp>
  );
}

/** Seconds since the layer's own start, for keyframes (seqFrom = the Sequence's start). */
function useLayerTime(layer, seqFrom) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (seqFrom + frame - layer.from) / fps;
}

const hasFxKeyframes = (kf) => !!kf && Object.keys(kf).some((k) => k.startsWith('fx:'));

function useLayerEffects(layer, t) {
  const overrides = hasFxKeyframes(layer.keyframes) ? effectOverridesAt(layer.keyframes, t) : null;
  if (!layer.effects?.length) return undefined;
  const fx = buildEffectDescriptors(layer.effects, overrides);
  return fx.length ? fx : undefined;
}

/** Keyframed position / scale / rotation / opacity for a whole layer. */
function KeyframeWrap({ layer, seqFrom, origin, children }) {
  const t = useLayerTime(layer, seqFrom);
  if (!hasKeyframes(layer.keyframes)) return children;
  const style = transformStyleAt(layer.keyframes, t, origin);
  if (!style) return children;
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
}

/** A Multi-Cam window (picture-in-picture or one half of a split screen). */
function CameraBox({ box, children }) {
  const border = box.border ? `${box.border}px solid rgba(255,255,255,0.9)` : undefined;
  return (
    <div style={{ position: 'absolute', left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, overflow: 'hidden', borderRadius: box.radius ? `${box.radius}px` : undefined, border, boxSizing: 'border-box', boxShadow: box.radius ? '0 6px 24px rgba(0,0,0,0.5)' : undefined }}>
      <AbsoluteFill>{children}</AbsoluteFill>
    </div>
  );
}

/** [remix] OpenChatCut zoom / follow-subject reframe: scale about the focal point (their TimelineMediaLayer transform). */
function OccZoom({ zoom, durationInFrames, children }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // zoom frames are authored on a 30 fps basis (editor preview), so convert to this render's fps
  const z = zoomAt(zoom, (frame * 30) / fps, Math.max(1, (durationInFrames * 30) / fps));
  return <AbsoluteFill style={{ transform: `scale(${z.magnification})`, transformOrigin: `${z.focalX * 100}% ${z.focalY * 100}%` }}>{children}</AbsoluteFill>;
}

/** [remix] OpenChatCut clip fades: volume (number or per-frame function) with the fade-in/out multiplier applied. */
function fadedVolume(layer, fps, base, kf) {
  const fi = layer.fadeIn || 0; const fo = layer.fadeOut || 0;
  if (!fi && !fo && !kf?.length) return base;
  const dur = layer.durationInFrames / fps;
  return (f) => Math.max(0, Math.min(1, base * (kf?.length ? valueAt(kf, f / fps, 1) : 1) * clipFadeFactor(f / fps, dur, fi, fo)));
}

/** [remix] fade-in/out of a visual clip = opacity multiplier over the whole layer. */
/** [remix] clip position / scale / rotation (+ tracked path): same CSS as the editor viewer (cinegen/lib/occ/transform.ts). */
/** [remix] OpenChatCut backgroundFill: blurred, darkened, over-scanned cover copy of the clip behind the contained picture. */
function OccFill({ layer, trimBefore, seqFrom }) {
  const { width: W, height: H } = useVideoConfig();
  const a = backgroundFillAppearance(W, H, layer.clipTransform.fill);
  return (
    <AbsoluteFill style={{ filter: backgroundFillFilter(a), transform: `scale(${a.overscanScale})` }}>
      <MediaLayer layer={{ ...layer, trimBefore, occFx: undefined, fit: 'cover', volume: 0, fadeIn: 0, fadeOut: 0 }} seqFrom={seqFrom} />
    </AbsoluteFill>
  );
}

function OccTransform({ transform, children }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const css = clipTransformCss(transform, frame / fps);
  const clipPath = clipTransformClipPath(transform);
  return css || clipPath ? <AbsoluteFill style={{ ...(css ? { transform: css } : {}), ...(clipPath ? { clipPath } : {}) }}>{children}</AbsoluteFill> : children;
}

function MediaLayer(props) {
  const { layer, seqFrom } = props;
  const t = useLayerTime(layer, seqFrom);
  const { fps } = useVideoConfig();
  if (!layer.fadeIn && !layer.fadeOut) return <MediaLayerBody {...props} />;
  const f = clipFadeFactor(t, layer.durationInFrames / fps, layer.fadeIn || 0, layer.fadeOut || 0);
  return <AbsoluteFill style={{ opacity: f }}><MediaLayerBody {...props} /></AbsoluteFill>;
}

function MediaLayerBody({ layer, seqFrom }) {
  const t = useLayerTime(layer, seqFrom);
  const { width: W, height: H, fps } = useVideoConfig();
  const fit = layer.fit === 'contain' ? 'contain' : 'cover';
  const fx = useLayerEffects(layer, t);
  const mirror = layer.flip ? { transform: `scale(${layer.flip.h ? -1 : 1}, ${layer.flip.v ? -1 : 1})` } : {};
  // [remix] OpenChatCut effects / LUT: render through the GL pipeline (also during export, so they are burned in).
  if (layer.occFx?.length && (layer.kind === 'video' || layer.kind === 'image')) {
    for (const e of layer.occFx) { if (e.cubeText) registerUserLut({ id: e.id, name: e.name || e.id, text: e.cubeText }); if (e.def) registerSnapshot(e.def); }
    return (
      <AbsoluteFill style={mirror}>
        <OccClipFx
          item={{ id: layer.id, kind: layer.kind, src: layer.src, trimBefore: layer.trimBefore || 0, playbackRate: layer.playbackRate || 1,
            // [remix] animated effect properties: keyframed values (30 fps from the clip start) override the static sliders each frame
            effects: layer.occFx.map((e) => (e.keys ? { ...e, overrides: { ...(e.overrides || {}), ...Object.fromEntries(Object.entries(e.keys).filter(([, l]) => l?.length).map(([k, l]) => [k, sampleFxKey(l, t * 30)])) } } : e)) }}
          fit={fit} width={W} height={H}
        />
        {layer.kind === 'video' && <Audio src={layer.src} trimBefore={layer.trimBefore || undefined} playbackRate={layer.playbackRate || undefined} volume={fadedVolume(layer, fps, Math.max(0, Math.min(1, layer.volume ?? 1)), layer.keyframes?.volume)} />}
      </AbsoluteFill>
    );
  }
  if (layer.kind === 'video') {
    const volume = fadedVolume(layer, fps, Math.max(0, Math.min(1, layer.volume ?? 1)), layer.keyframes?.volume);
    return <Video src={layer.src} trimBefore={layer.trimBefore || undefined} playbackRate={layer.playbackRate || undefined} volume={volume} objectFit={fit} effects={fx} style={{ width: '100%', height: '100%', ...mirror }} />;
  }
  return <Img src={layer.src} effects={fx} style={{ width: '100%', height: '100%', objectFit: fit, ...mirror }} />;
}

function OverlayLayer({ layer, Comp }) {
  const t = useLayerTime(layer, layer.from);
  const fx = useLayerEffects(layer, t);
  return <Comp o={layer.options} durationInFrames={layer.durationInFrames} effects={fx} />;
}

const overlayOrigin = (o = {}) => {
  const g = o.geometry;
  if (!g || o.fill) return '50% 50%';
  return `${(Number(g.left) || 0) + (Number(g.width) || 0) / 2}% ${(Number(g.top) || 0) + (Number(g.height) || 0) / 2}%`;
};

/** Audio clip; volume keyframes (fades, ducking under a voiceover) multiply its volume. */
export function AudioLayer({ layer }) {
  const { fps } = useVideoConfig();
  const kf = layer.keyframes?.volume;
  const base = Math.max(0, Math.min(1, layer.volume ?? 1));
  const volume = fadedVolume(layer, fps, base, kf);
  return <Audio src={layer.src} trimBefore={layer.trimBefore || undefined} playbackRate={layer.playbackRate || undefined} volume={volume} />;
}

// ------------------------------------------------------------------ captions

const CAPTION_TOP = { top: '8%', middle: '50%', bottom: '82%' };

export function CaptionsLayer({ layer }) {
  const frame = useCurrentFrame();
  const { fps, height: H } = useVideoConfig();
  const fontsReady = React.useContext(FontsReady);
  const s = layer.style || {};
  const pages = useMemo(() => captionPages(layer.captions, s), [layer.captions, s.combineMs]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!fontsReady) return null;
  const ms = (frame / fps) * 1000;
  const page = pageAt(pages, ms);
  if (!page) return null;
  const fontSize = (Math.max(1, Number(s.fontSize) || 6) / 100) * H;
  const stroke = s.stroke ? strokeShadow('#000000', fontSize * 0.06) : undefined;
  const shadow = [stroke, '0 2px 10px rgba(0,0,0,0.55)'].filter(Boolean).join(', ');
  const boxedWords = s.preset === 'box';
  const lineBg = s.background && !boxedWords ? (s.backgroundColor || 'rgba(0,0,0,0.6)') : undefined;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: '6%', right: '6%', top: CAPTION_TOP[s.position] || CAPTION_TOP.bottom, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          fontFamily: `"${s.fontFamily || 'Inter'}", Arial, sans-serif`, fontWeight: s.bold ? 800 : 500, fontSize, lineHeight: 1.25,
          textAlign: 'center', color: s.color || '#fff', textTransform: s.uppercase ? 'uppercase' : 'none', textShadow: lineBg ? undefined : shadow,
          background: lineBg, padding: lineBg ? `${fontSize * 0.12}px ${fontSize * 0.35}px` : undefined, borderRadius: lineBg ? fontSize * 0.18 : undefined,
          whiteSpace: 'pre-wrap',
        }}>
          {page.tokens.map((tk, i) => {
            const active = s.highlightActive !== false && ms >= tk.fromMs && ms < tk.toMs;
            const spoken = s.preset === 'karaoke' && ms >= tk.fromMs;
            const color = active || spoken ? (s.highlightColor || '#FFE14D') : (s.color || '#fff');
            const box = boxedWords ? { background: active ? (s.highlightColor || '#EB5054') : (s.backgroundColor || 'rgba(0,0,0,0.6)'), color: '#fff', borderRadius: fontSize * 0.15, padding: `0 ${fontSize * 0.15}px`, textShadow: 'none' } : null;
            return <span key={i} style={{ color, ...(box || {}) }}>{tk.text}</span>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ root

export function TimelineComposition({ model }) {
  const m = model || { layers: [], audio: [], transitions: [], fonts: [] };
  const byOutgoing = new Map();
  const byIncoming = new Map();
  (m.transitions || []).forEach((tr) => {
    if (tr.outgoingId) byOutgoing.set(tr.outgoingId, tr);
    if (tr.incomingId) byIncoming.set(tr.incomingId, tr);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: m.background || '#000' }}>
      <FontGate fonts={m.fonts} userFonts={m.userFonts}>
        {(m.layers || []).map((layer) => {
          if (layer.kind === 'video' || layer.kind === 'image') {
            const outTr = byOutgoing.get(layer.id);
            const inTr = byIncoming.get(layer.id);
            // Extend the outgoing clip to the end of its transition window,
            // and start the incoming clip at the beginning of its window.
            let from = layer.from;
            let end = layer.from + layer.durationInFrames;
            let trimBefore = layer.trimBefore || 0;
            if (outTr) end = Math.max(end, outTr.from + outTr.durationInFrames);
            if (inTr && inTr.from < from) {
              trimBefore = Math.max(0, trimBefore - (from - inTr.from));
              from = inTr.from;
            }
            const content = (
              <KeyframeWrap layer={layer} seqFrom={from}>
                {/* [remix] clip blend mode (CSS mix-blend-mode, burned into export) */}
                <AbsoluteFill style={layer.clipBlend ? { mixBlendMode: layer.clipBlend } : undefined}>
                  {layer.clipTransform?.fill !== undefined && layer.kind !== 'audio' && <OccFill layer={layer} trimBefore={trimBefore} seqFrom={from} />}
                  <OccTransform transform={layer.clipTransform}>
                  {layer.clipZoom
                    ? <OccZoom zoom={layer.clipZoom} durationInFrames={layer.durationInFrames}><MediaLayer layer={{ ...layer, trimBefore }} seqFrom={from} /></OccZoom>
                    : <MediaLayer layer={{ ...layer, trimBefore }} seqFrom={from} />}
                  </OccTransform>
                </AbsoluteFill>
              </KeyframeWrap>
            );
            return (
              <Sequence key={layer.id} from={from} durationInFrames={Math.max(1, end - from)} layout="absolute-fill">
                <InTransition tr={inTr} direction="entering" layerFrom={from}>
                  <InTransition tr={outTr} direction="exiting" layerFrom={from}>
                    {layer.box ? <CameraBox box={layer.box}>{content}</CameraBox> : <AbsoluteFill>{content}</AbsoluteFill>}
                  </InTransition>
                </InTransition>
              </Sequence>
            );
          }
          if (layer.kind === 'overlay') {
            const Comp = OVERLAYS[layer.type];
            if (!Comp) return null;
            return (
              <Sequence key={layer.id} from={layer.from} durationInFrames={layer.durationInFrames} layout="absolute-fill">
                <KeyframeWrap layer={layer} seqFrom={layer.from} origin={overlayOrigin(layer.options)}>
                  <OverlayLayer layer={layer} Comp={Comp} />
                </KeyframeWrap>
              </Sequence>
            );
          }
          if (layer.kind === 'title') {
            return (
              <Sequence key={layer.id} from={layer.from} durationInFrames={layer.durationInFrames} layout="absolute-fill">
                <KeyframeWrap layer={layer} seqFrom={layer.from}>
                  <TitleCard layer={layer} />
                </KeyframeWrap>
              </Sequence>
            );
          }
          if (layer.kind === 'code') {
            return (
              <Sequence key={layer.id} from={layer.from} durationInFrames={layer.durationInFrames} layout="absolute-fill">
                <KeyframeWrap layer={layer} seqFrom={layer.from}>
                  <CodeLayer layer={layer} />
                </KeyframeWrap>
              </Sequence>
            );
          }
          if (layer.kind === 'hyperframes') {
            return (
              <Sequence key={layer.id} from={layer.from} durationInFrames={layer.durationInFrames} layout="absolute-fill">
                <HyperframesLayer layer={layer} />
              </Sequence>
            );
          }
          if (layer.kind === 'captions') {
            return (
              <Sequence key={layer.id} from={layer.from} durationInFrames={layer.durationInFrames} layout="absolute-fill">
                <KeyframeWrap layer={layer} seqFrom={layer.from}>
                  <CaptionsLayer layer={layer} />
                </KeyframeWrap>
              </Sequence>
            );
          }
          return null;
        })}
        {/* [remix] OpenChatCut captions, burned into the render */}
        {(m.occCaptions || []).map((c, i) => (
          <Sequence key={`occ-cap-${i}`} from={0} durationInFrames={m.durationInFrames} layout="absolute-fill">
            <OccCaptionsLayer captions={c} items={[]} />
          </Sequence>
        ))}
        {/* [remix] OpenChatCut GL transitions between CineGen clips */}
        {(m.glTransitions || []).map((g) => (
          <Sequence key={g.id} from={g.from} durationInFrames={g.durationInFrames} layout="absolute-fill">
            <GlTransitionLayer out={g.out} inn={g.inn} glType={g.glType} durationInFrames={g.durationInFrames} customDef={g.customDef} glParams={g.glParams} />
          </Sequence>
        ))}
      </FontGate>
      {(m.audio || []).map((a) => (
        <Sequence key={a.id} from={a.from} durationInFrames={a.durationInFrames}>
          <AudioLayer layer={a} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export default TimelineComposition;
