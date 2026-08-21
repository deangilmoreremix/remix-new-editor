// Shared branded layout for all Clerk auth pages (sign in, sign up,
// forgot password, reset password). Keeps the custom design consistent
// across every authentication surface while each page owns its own form.

import React, { useState } from 'react';
import { navigate } from '../../lib/router.js';

// In-app nav handler used by every <a> in the auth header. We keep the
// hrefs as `href="#/<route>"` so the links remain valid and bookmarkable,
// but intercept the click to route through the hash router — a real
// `href="/image"` would 404 in production because Netlify has no file or
// SPA fallback for those paths.
export function handleNavClick(e, route) {
  e.preventDefault();
  navigate(route);
}

// The exact top navigation chrome used by SignInPage / SignUpPage, reused
// here so the auth pages never drift in appearance.
export function AuthHeader() {
  return (
    <header className="sticky top-0 z-50 w-full h-16 backdrop-blur-md bg-[#0a0b0f] border-b border-white/10">
      <nav className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[auto_1fr_auto] pr-4 h-full items-center relative container">
        <a href="/" className="shrink-0 flex items-center gap-2 transition hover:text-[#22d3ee] active:opacity-60">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10" style={{ boxShadow: '0 0 16px rgba(56,189,248,0.12)' }}>
            <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
              <rect width="80" height="80" rx="16" fill="#22d3ee" />
              <path d="M32 22 L58 40 L32 58 Z" fill="#020205" />
            </svg>
          </div>
          <span className="hidden md:block text-lg font-bold text-white">Timeline Editor</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          <a href="/explore" className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Explore</a>
          <a href="/image" className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Image</a>
          <a href="/video" className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Video</a>
          <a href="/timeline" className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Timeline</a>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <a href="/signin" className="px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium">Sign In</a>
          <a href="/" className="px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Home</a>
        </div>
      </nav>
    </header>
  );
}

// Standard card wrapper: centered, blurred, rounded — identical to the
// sign-in / sign-up cards.
export function AuthCard({ title, subtitle, children }) {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h1>
            {subtitle && <p className="text-slate-400">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

// Reusable error banner + primary button + footer link, matching the
// sign-in / sign-up styling exactly.
export function AuthError({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 p-3 text-sm">
      {message}
    </div>
  );
}

export function AuthSubmitButton({ loading, disabled, loadingLabel, label }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

export function AuthFooter({ children }) {
  return <div className="mt-8 text-center text-slate-300">{children}</div>;
}

// Wrap a Clerk custom-flow promise with a timeout. The @clerk/react v6
// signals API resolves `{ data?, error? }` and never throws for auth
// failures, but a stalled network request would otherwise leave the page
// in its loading state forever. On timeout (or an unexpected throw) this
// resolves the same `{ error }` shape so callers handle it uniformly.
export function clerkWithTimeout(promise, ms = 15000) {
  return Promise.race([
    Promise.resolve(promise).catch((error) => ({ error })),
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            error: {
              message: 'The request timed out. Please check your connection and try again.',
              longMessage: 'The request timed out. Please check your connection and try again.',
            },
          }),
        ms,
      ),
    ),
  ]);
}

// Extract a human-readable message from a Clerk custom-flow result.
//
// The installed @clerk/react (v6, signals API) NEVER throws for validation
// errors — every method resolves to `{ error: ClerkError | null }` and the
// live errors are also exposed on the hook's `errors` object
// (errors?.fields?.x, errors?.global, errors?.raw). Reading only a thrown
// `err.errors[0]` silently swallows failures, which is why the submit
// buttons appeared to "do nothing".
export function clerkErrorMessage(resultError, hookErrors) {
  if (resultError) {
    return (
      resultError.longMessage ||
      resultError.message ||
      (Array.isArray(resultError) ? resultError[0]?.longMessage : null)
    );
  }
  const e = hookErrors;
  if (!e) return null;
  if (e.global && e.global.length) {
    return e.global[0].longMessage || e.global[0].message;
  }
  if (e.raw && e.raw.length) {
    return e.raw[0].longMessage || e.raw[0].message;
  }
  const fieldValues = e.fields ? Object.values(e.fields) : [];
  for (const f of fieldValues) {
    if (f && (f.longMessage || f.message)) {
      return f.longMessage || f.message;
    }
  }
  return null;
}

// Wipe every Clerk session cookie + browser storage for the current origin
// and reload. Use this when the app is stuck in the "You're already signed
// in" / blank app state because of stale dev-instance cookies (e.g. after
// rotating from pk_test_ to pk_live_). Safe to call on any page; the
// reload re-runs the router and lets the user sign in cleanly.
export async function clearClerkSession({ reload = true } = {}) {
  try {
    // Cookies — delete every name we know Clerk uses, on every domain
    // scope that might be set (.smartvid.app, smartvid.app, localhost, etc.)
    if (typeof document !== 'undefined' && document.cookie) {
      const known = ['__session', '__client_uat', '__clerk_db_jwt', '__clerk_redirect_url'];
      for (const name of known) {
        for (const scope of ['/', '/']) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${scope}`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${scope};domain=.smartvid.app`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${scope};domain=smartvid.app`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${scope};domain=localhost`;
        }
      }
    }
    // cookieStore (modern API) — catches HttpOnly/secure cookies the DOM
    // can't see but the dev-tools panel can.
    if (typeof cookieStore !== 'undefined') {
      try {
        const all = await cookieStore.getAll();
        for (const c of all) {
          const opts = { name: c.name, path: '/' };
          try { await cookieStore.delete(opts); } catch {}
          if (c.domain) {
            for (const d of [c.domain, '.' + c.domain]) {
              try { await cookieStore.delete({ ...opts, domain: d }); } catch {}
            }
          }
        }
      } catch {}
    }
    // local + session storage
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    // IndexedDB (Clerk caches tokens here)
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        for (const d of dbs) { if (d.name) indexedDB.deleteDatabase(d.name); }
      } catch {}
    }
    // Cache Storage (service worker caches for the FAPI)
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const k of keys) caches.delete(k);
      } catch {}
    }
    // Unregister the service worker so its old cache stops intercepting
    // future requests with the stale bundle.
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      } catch {}
    }
  } finally {
    if (reload && typeof window !== 'undefined') {
      // Use a full reload so the SPA re-bootstraps with a clean slate.
      window.location.reload();
    }
  }
}

// Shared text-input styling used across every auth field.
export const authInputClass =
  'w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200';

// Password input with a show/hide toggle. Replaces the static lock icon
// on every auth page so users can verify what they're typing before they
// submit. Accepts the same props as a native <input> (id, name, value,
// onChange, autoComplete, placeholder, required) and renders an eye /
// eye-slash button absolutely positioned on the right side.
//
// The button is keyboard-reachable, has a descriptive aria-label that
// flips with state, and is `type="button"` so it never submits the form.
export function PasswordInput(props) {
  const { className, ...rest } = props;
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={`${authInputClass} pr-12 ${className || ''}`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={0}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-cyan-300 focus:outline-none focus:text-cyan-300 transition-colors rounded-md"
      >
        {visible ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// Full-page shell: dark background + header + centered card content.
export function AuthPage({ title, subtitle, children }) {
  return (
    <div
      className="auth-page min-h-screen bg-[#020205] flex flex-col"
      lang={document.documentElement.lang || 'en'}
    >
      <AuthHeader />
      <AuthCard title={title} subtitle={subtitle}>
        {children}
      </AuthCard>
    </div>
  );
}
