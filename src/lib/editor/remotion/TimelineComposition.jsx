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
import { stretchLowerThird } from '../addons/lowerThirds.js';

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

export function registerGoogleFont(family) {
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
function FontGate({ fonts, children }) {
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

function ImageOverlay({ o, durationInFrames, personalized }) {
  const src = o.resolvedSrc;
  if (!src) return null;
  const radius = personalized ? `${Number(o.cornerRadius) || 0}%` : (o.cornerRadius ? '50%' : 0);
  return (
    <Animated o={{ ...o, geometry: o.fill ? { left: 0, top: 0, width: 100, height: 100 } : o.geometry }} durationInFrames={durationInFrames}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: radius }}>
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: o.fill || personalized ? 'cover' : 'contain' }} />
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

function StickerOverlay({ o, durationInFrames }) {
  const lottieData = useJson(o.kind === 'lottie' ? o.resolvedSrc : null);
  if (!o.resolvedSrc) return null;
  return (
    <Animated o={o} durationInFrames={durationInFrames}>
      {o.kind === 'lottie'
        ? (lottieData ? <Lottie animationData={lottieData} loop style={{ width: '100%', height: '100%' }} /> : null)
        : <Img src={o.resolvedSrc} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
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

const OVERLAYS = {
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

function MediaLayer({ layer }) {
  const fit = layer.fit === 'contain' ? 'contain' : 'cover';
  if (layer.kind === 'video') {
    return <Video src={layer.src} trimBefore={layer.trimBefore || undefined} volume={layer.volume} objectFit={fit} style={{ width: '100%', height: '100%' }} />;
  }
  return <Img src={layer.src} style={{ width: '100%', height: '100%', objectFit: fit }} />;
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
      <FontGate fonts={m.fonts}>
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
            const content = <MediaLayer layer={{ ...layer, trimBefore }} />;
            return (
              <Sequence key={layer.id} from={from} durationInFrames={Math.max(1, end - from)} layout="absolute-fill">
                <InTransition tr={inTr} direction="entering" layerFrom={from}>
                  <InTransition tr={outTr} direction="exiting" layerFrom={from}>
                    <AbsoluteFill>{content}</AbsoluteFill>
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
                <Comp o={layer.options} durationInFrames={layer.durationInFrames} />
              </Sequence>
            );
          }
          if (layer.kind === 'title') {
            return (
              <Sequence key={layer.id} from={layer.from} durationInFrames={layer.durationInFrames} layout="absolute-fill">
                <TitleCard layer={layer} />
              </Sequence>
            );
          }
          return null;
        })}
      </FontGate>
      {(m.audio || []).map((a) => (
        <Sequence key={a.id} from={a.from} durationInFrames={a.durationInFrames}>
          <Audio src={a.src} trimBefore={a.trimBefore || undefined} volume={a.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export default TimelineComposition;
