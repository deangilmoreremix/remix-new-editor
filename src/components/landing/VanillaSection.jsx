// React bridge for vanilla DOM landing sections.
//
// The MiniMax showcase sections (MadeWithSmartVideo, UGCDemoShowcase, etc.)
// are plain document.createElement factories that return a <section> carrying a
// .cleanup() method. Auth pages are React components, so this wrapper mounts
// the vanilla section into a ref and tears it down on unmount — keeping video
// playback and observers from leaking between navigations.
import React, { useEffect, useRef } from 'react';

export function VanillaSection({ factory, args = [] }) {
  const hostRef = useRef(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof factory !== 'function') return;
    // Guard against double-invoke (StrictMode / re-mount) — never mount twice.
    if (host.firstChild) return;

    // The factory returns a section element (and may accept constructor args).
    const section = factory(...args);
    sectionRef.current = section;
    host.appendChild(section);

    return () => {
      // Honour the section's own teardown (pauses videos, disconnects observers)
      // then remove it from the DOM as a safety net.
      try {
        if (typeof section.cleanup === 'function') section.cleanup();
      } catch (err) {
        console.warn('[VanillaSection] cleanup error:', err);
      }
      try {
        section.remove();
      } catch {
        /* element may already be detached */
      }
      sectionRef.current = null;
    };
  }, [factory]);

  return <div ref={hostRef} data-vanilla-section={sectionRef.current ? sectionRef.current.id : undefined} />;
}
