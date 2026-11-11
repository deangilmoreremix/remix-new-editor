/**
 * AI-written animation clips (`remotion-code` layers).
 *
 * The code is compiled (sucrase, JSX → JS) and run ONLY inside a sandboxed,
 * opaque-origin iframe — the export runner and the animation preview
 * frame. In the editor page itself these layers render nothing; the page
 * shows them through the preview frame instead. Before compiling, the code
 * passes the static gate in ../agent/codeGate.js, and it runs with browser
 * globals shadowed and only a whitelisted Remotion scope in reach.
 */
import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill, Sequence, Series, Loop, Freeze, Img, useCurrentFrame, useVideoConfig, interpolate, interpolateColors,
  spring, Easing, random, delayRender, continueRender,
} from 'remotion';
import { Video, Audio } from '@remotion/media';
import { Lottie } from '@remotion/lottie';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { iris } from '@remotion/transitions/iris';
import { measureText, fitText } from '@remotion/layout-utils';
import { checkAnimationCode, normalizeAnimationCode } from '../agent/codeGate.js';

/** True only in an opaque-origin (sandboxed) frame. */
export const isSandboxed = () => typeof window !== 'undefined' && window.origin === 'null';

const SCOPE = {
  React, AbsoluteFill, Sequence, Series, Loop, Freeze, Img, useCurrentFrame, useVideoConfig, interpolate, interpolateColors,
  spring, Easing, random, Video, OffthreadVideo: Video, Audio, Lottie, TransitionSeries, linearTiming, springTiming,
  fade, slide, wipe, flip, clockWipe, iris, measureText, fitText,
};

// Shadowed to undefined inside the animation (defence in depth behind the gate and the sandbox).
const SHADOWED = [
  'window', 'document', 'globalThis', 'self', 'parent', 'top', 'opener', 'frames', 'navigator', 'location', 'history',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'caches',
  'postMessage', 'importScripts', 'Worker', 'SharedWorker', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Function',
];

const compiled = new Map(); // code → Promise<Component>

export function compileAnimation(code) {
  if (!isSandboxed()) return Promise.reject(new Error('Animations only run in the sandboxed renderer'));
  const key = String(code || '');
  if (compiled.has(key)) return compiled.get(key);
  const p = (async () => {
    const gate = checkAnimationCode(key);
    if (!gate.ok) throw new Error(gate.errors.join('; '));
    const { transform } = await import('sucrase');
    const js = transform(normalizeAnimationCode(key), { transforms: ['jsx'], production: true }).code;
    const names = [...Object.keys(SCOPE), ...SHADOWED];
    // eslint-disable-next-line no-new-func -- sandboxed, gated animation code (see header)
    const factory = new Function(...names, `"use strict";\n${js}\n;return typeof Animation === 'function' ? Animation : null;`);
    const Comp = factory(...Object.values(SCOPE), ...SHADOWED.map(() => undefined));
    if (typeof Comp !== 'function') throw new Error('The code must define `function Animation({ props })`');
    return Comp;
  })();
  compiled.set(key, p);
  p.catch(() => compiled.delete(key));
  return p;
}

// ------------------------------------------------------------------ errors

const errors = new Map(); // layer id → message
const listeners = new Set();
export function reportCodeError(id, message) {
  errors.set(id, String(message || 'Animation error'));
  listeners.forEach((fn) => fn(id, errors.get(id)));
}
export const onCodeError = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function takeCodeErrors() {
  const out = Object.fromEntries(errors);
  errors.clear();
  return out;
}

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(err) { reportCodeError(this.props.id, err?.message || err); }

  render() { return this.state.failed ? null : this.props.children; }
}

/** Renders one animation clip (inside its Sequence). */
export function CodeLayer({ layer }) {
  const sandboxed = isSandboxed();
  const [Comp, setComp] = useState(null);
  const [handle] = useState(() => (sandboxed ? delayRender(`Compiling animation ${layer.id}`) : null));
  useEffect(() => {
    if (!sandboxed) return undefined;
    let done = false;
    compileAnimation(layer.code).then((C) => { if (!done) setComp(() => C); }, (err) => reportCodeError(layer.id, err.message))
      .finally(() => { if (handle !== null) continueRender(handle); });
    return () => { done = true; };
  }, [layer.code, layer.id, sandboxed, handle]);
  if (!sandboxed || !Comp) return null;
  return (
    <Boundary id={layer.id} key={layer.code}>
      <AbsoluteFill>
        <Comp props={layer.props || {}} />
      </AbsoluteFill>
    </Boundary>
  );
}
