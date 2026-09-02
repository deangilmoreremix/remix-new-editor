// Featured cinematic demo video for the auth-page hero split.
//
// Renders a single poster-first, muted + looped video using the same
// createMediaFrame() engine the landing page uses — so playback governance
// (max 2 concurrent, reduced-motion, lazy element creation) is shared.
//
// The video is purely illustrative: it never competes with the sign-in/sign-up
// form. On mobile the form takes priority (see MarketingAuthShell layout notes).
import React, { useEffect, useRef } from 'react';
import { requireDemo } from '../../data/minimaxH3Demos.js';
import { createMediaFrame, cleanupFrames, prefersReducedMotion } from './sections/minimax/mediaFrame.js';
import { injectMinimaxStyles } from './sections/minimax/ui.js';

// The first reel in "Made With SmartVideo" — a premium 15s luxury perfume
// commercial that sells the product without needing a real account to see.
const HERO_SLUG = 'luxury-perfume-commercial';

export function AuthHeroVideo() {
  const hostRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Never mount the frame twice.
    if (host.firstChild) return;

    injectMinimaxStyles();
    const demo = requireDemo(HERO_SLUG);
    const reduced = prefersReducedMotion();

    const frame = createMediaFrame(demo, {
      mode: reduced ? 'poster' : 'inview',
      priority: true, // eager poster so the hero frame is never empty
      className: 'h-full w-full',
      ariaLabel: null, // decorative
    });
    frameRef.current = frame;
    host.appendChild(frame);

    return () => {
      try { cleanupFrames(host); } catch { /* ignore */ }
      frameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="relative mx-auto aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
      aria-hidden="true"
    />
  );
}
