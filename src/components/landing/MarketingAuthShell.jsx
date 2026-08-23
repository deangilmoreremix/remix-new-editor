// Marketing-first auth shell shared by /signin, /signup, /forgot-password,
// /reset-password.
//
// Mirrors the landing page visually: full LandingHeader + a cinematic hero
// split (auth form on the left, a live demo video on the right) followed by
// the "Made With SmartVideo" commercial reel and the "Create UGC Ads" social
// showcase rendered below the form.
//
// The form itself (and all Clerk logic) lives in the per-page React component
// and is passed in as `children`. This shell only owns the chrome and the demo
// reels, so swapping the shell into an existing auth page is a one-line change.
//
// Note on the header: LandingHeader (from common/Header.jsx) is a *vanilla DOM
// factory* (returns a <header> element), not a React component — so it is
// mounted imperatively into a ref. The two reel sections are vanilla too and
// are mounted through VanillaSection. AuthHeroVideo is a real React component.
import React, { useEffect, useRef } from 'react';
import { LandingHeader } from './common/Header.jsx';
import { AuthHeroVideo } from './AuthHeroVideo.jsx';
import { VanillaSection } from './VanillaSection.jsx';
import { MadeWithSmartVideo } from './sections/MadeWithSmartVideo.jsx';
import { UGCDemoShowcase } from './sections/UGCDemoShowcase.jsx';

export function MarketingAuthShell({ title, subtitle, children, heroVideo = true }) {
  const headerRef = useRef(null);

  // Mount the landing nav (vanilla) once, remove on unmount.
  useEffect(() => {
    const host = headerRef.current;
    if (!host) return;
    const header = LandingHeader();
    host.appendChild(header);
    return () => {
      try { header.remove(); } catch { /* may already be detached */ }
    };
  }, []);

  return (
    <div
      className="auth-marketing-page relative min-h-screen bg-[#020205] text-white"
      lang={document.documentElement.lang || 'en'}
    >
      {/* Full landing nav — shared chrome with the landing page. */}
      <div ref={headerRef} data-auth-header />

      {/* Hero split: form (left) + cinematic demo video (right on desktop). */}
      <section
        className="relative isolate min-h-[70svh] w-full overflow-hidden"
        aria-labelledby="auth-hero-headline"
        data-testid="auth-hero"
      >
        {/* Background texture + vignette for parity with CinematicVideoHero. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(34,211,238,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(34,211,238,0.04) 0%, transparent 50%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 -z-[9] bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(2,2,5,0.86),transparent_70%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 -z-[7] shadow-[inset_0_0_180px_60px_rgba(2,2,5,0.92)]" aria-hidden="true" />

        <div className="container relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 py-16 sm:px-6 md:grid-cols-2 md:gap-16 md:py-20">
          {/* Left rail — the auth form drops in here. */}
          <div className="w-full">
            <h1
              id="auth-hero-headline"
              className="mb-2 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl"
            >
              {title}
              {subtitle && (
                <span className="block italic text-cyan-400">
                  <br />
                  {subtitle}
                </span>
              )}
            </h1>
            {children}
          </div>

          {/* Right rail — the featured demo video. */}
          {heroVideo && <AuthHeroVideo />}
        </div>

        {/* Scroll cue (desktop). */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5 animate-bounce text-white/25"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </section>

      {/* Demo reels — identical sections to the landing page. */}
      <VanillaSection factory={MadeWithSmartVideo} />
      <VanillaSection factory={UGCDemoShowcase} />
    </div>
  );
}
