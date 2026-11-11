/**
 * HyperFramesClip: mounts a HyperFrames-contract composition (HTML markup +
 * the composition's own <script>) inside a Remotion composition, and drives
 * the timeline the composition registers on `window.__timelines[id]` from
 * Remotion's frame clock. Because the DOM lives in the React tree (no iframe),
 * Remotion's web renderer can capture it.
 *
 * Deterministic seek: totalTime(0) then totalTime(t), as @remotion/gsap does.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, delayRender, continueRender } from 'remotion';
import { gsap } from 'gsap';

export function HyperFramesClip({ html, script, compositionId, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const host = useRef(null);
  const timeline = useRef(null);
  const handle = useRef(null);
  if (handle.current === null) handle.current = delayRender('hyperframes-mount');

  // Mount once: inject markup, run the composition script, grab its timeline.
  useLayoutEffect(() => {
    const el = host.current;
    el.innerHTML = html;
    const registry = (window.__timelines = window.__timelines || {});
    delete registry[compositionId];
    // eslint-disable-next-line no-new-func
    new Function('gsap', 'document', script).call(window, gsap, el.ownerDocument);
    const tl = registry[compositionId];
    if (!tl) throw new Error(`composition "${compositionId}" did not register window.__timelines`);
    tl.pause();
    timeline.current = tl;
    continueRender(handle.current);
    return () => { tl.kill(); delete registry[compositionId]; };
  }, [html, script, compositionId]);

  // Every frame: seek to frame/fps.
  useLayoutEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    // Reset silently, then seek WITH events so composition onUpdate hooks
    // (canvas/WebGL redraws) fire. Native HyperFrames scripts rely on them.
    tl.totalTime(0, true);
    tl.totalTime(frame / fps, false);
  }, [frame, fps]);

  return <div ref={host} style={{ position: 'absolute', inset: 0, ...style }} />;
}
