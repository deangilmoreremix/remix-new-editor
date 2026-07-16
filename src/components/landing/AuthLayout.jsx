// Shared branded layout for all Clerk auth pages (sign in, sign up,
// forgot password, reset password). Keeps the custom design consistent
// across every authentication surface while each page owns its own form.

import React from 'react';

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

// Shared text-input styling used across every auth field.
export const authInputClass =
  'w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200';

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
