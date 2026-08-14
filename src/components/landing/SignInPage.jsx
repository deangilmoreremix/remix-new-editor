// Custom Sign In Page — your design, powered by Clerk's useSignIn hook.
// Follows the v6 signals API pattern from the clerk-custom-ui skill:
//   const { signIn, errors, fetchStatus } = useSignIn()
//   const { error } = await signIn.create({ identifier, password })
//   if (signIn.status === 'complete') await setActive({ session: signIn.createdSessionId })
// For client-trust (needs_client_trust) and MFA (needs_second_factor), use
// prepareFirstFactor / attemptFirstFactor for client trust (it is a first
// factor), and prepareSecondFactor / attemptSecondFactor for MFA.
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /signin).

import React, { useState } from 'react';
import { useSignIn } from '@clerk/react';
import { clerkErrorMessage, PasswordInput } from './AuthLayout.jsx';
import { navigate } from '../../lib/router.js';

// In-app nav handler. Real `href="/image"` etc. would 404 on production
// because the SPA has no Netlify fallback for those paths, so we use
// `href="#/..."` (valid + bookmarkable) and intercept the click to route
// through the hash router.
function handleNavClick(e, route) {
  e.preventDefault();
  navigate(route);
}

const AFTER_SIGN_IN_ROUTE = '/#/image';

export function SignInPage() {
  // useSignIn() in v6 returns { signIn, errors, fetchStatus }. We need both
  // signIn (the sign-in object) and a ready check. fetchStatus === 'fetching'
  // means the hook is still loading; anything else means it's ready.
  const { signIn, errors, fetchStatus } = useSignIn();
  const isLoaded = fetchStatus !== 'fetching';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationType, setVerificationType] = useState(''); // 'client_trust' | 'mfa'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!signIn || !isLoaded) {
      setError('Authentication is still loading. Please wait a moment and try again.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: createError } = await signIn.create({ identifier: email, password });
    if (createError) {
      setError(clerkErrorMessage(createError, errors) || 'Sign in failed. Please check your credentials.');
      setLoading(false);
      return;
    }
    await advanceSignIn();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!signIn || !isLoaded) {
      setError('Authentication is still loading. Please wait a moment and try again.');
      return;
    }
    setLoading(true);
    setError('');
    let verifyError;
    if (verificationType === 'client_trust') {
      ({ error: verifyError } = await signIn.attemptFirstFactor({ strategy: 'email_code', code }));
    } else {
      ({ error: verifyError } = await signIn.attemptSecondFactor({ strategy: 'email_code', code }));
    }
    if (verifyError) {
      setError(clerkErrorMessage(verifyError, errors) || 'Invalid verification code.');
      setLoading(false);
      return;
    }
    await advanceSignIn();
  };

  const advanceSignIn = async () => {
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: async ({ session, decorateUrl }) => {
          const url = decorateUrl('/#/templates');
          window.location.href = url.startsWith('http') ? url : '/#/templates';
        },
      });
      return;
    }

    if (signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code',
      );
      if (!emailCodeFactor) {
        setError('Email verification is required but not available. Please contact support.');
        setLoading(false);
        return;
      }
      await signIn.prepareFirstFactor({ strategy: 'email_code' });
      setVerificationType('client_trust');
      setStep('verify');
      setLoading(false);
      return;
    }

    if (signIn.status === 'needs_first_factor') {
      const emailCodeFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code',
      );
      if (emailCodeFactor) {
        await signIn.prepareFirstFactor({ strategy: 'email_code' });
        setVerificationType('client_trust');
        setStep('verify');
        setLoading(false);
        return;
      }
    }

    if (signIn.status === 'needs_second_factor') {
      await signIn.prepareSecondFactor({ strategy: 'email_code' });
      setVerificationType('mfa');
      setStep('verify');
      setLoading(false);
      return;
    }

    setError('Sign in could not be completed. Please try again.');
    setLoading(false);
  };

  return (
    <div
      className="signin-page min-h-screen bg-[#020205] flex flex-col"
      lang={document.documentElement.lang || 'en'}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 w-full h-16 backdrop-blur-md bg-[#0a0b0f] border-b border-white/10">
        <nav className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[auto_1fr_auto] pr-4 h-full items-center relative container">
          <a href="#/apps" onClick={(e) => handleNavClick(e, 'apps')} className="shrink-0 flex items-center gap-2 transition hover:text-[#22d3ee] active:opacity-60">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10" style={{ boxShadow: '0 0 16px rgba(56,189,248,0.12)' }}>
              <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
                <rect width="80" height="80" rx="16" fill="#22d3ee" />
                <path d="M32 22 L58 40 L32 58 Z" fill="#020205" />
              </svg>
            </div>
            <span className="hidden md:block text-lg font-bold text-white">Timeline Editor</span>
          </a>

          <div className="hidden md:flex items-center gap-6">
            <a href="#/explore" onClick={(e) => handleNavClick(e, 'explore')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Explore</a>
            <a href="#/image" onClick={(e) => handleNavClick(e, 'image')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Image</a>
            <a href="#/video" onClick={(e) => handleNavClick(e, 'video')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Video</a>
            <a href="#/timeline" onClick={(e) => handleNavClick(e, 'timeline')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Timeline</a>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <a href="/signup" className="px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium">Sign Up</a>
            <a href="#/apps" onClick={(e) => handleNavClick(e, 'apps')} className="px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Home</a>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Sign In Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
            {step === 'form' ? (
              <>
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Welcome Back</h1>
              <p className="text-slate-400">Sign in to continue your creative journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200"
                    placeholder="you@example.com"
                  />
                  <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002 2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input type="checkbox" name="remember" className="w-4 h-4 rounded border-white/20 bg-slate-800 text-cyan-400 focus:ring-cyan-400/20" />
                  <span className="ml-2 text-sm text-slate-300">Remember me</span>
                </label>
                <a href="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300 transition">
                  Forgot password?
                </a>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 p-3 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !isLoaded}
                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing In…' : 'Sign In'}
              </button>

              {/* Required for custom auth flows: Clerk's Smart CAPTCHA widget
                  renders into this element. Without it bot protection silently
                  falls back to invisible mode and the page can fail with
                  "The CAPTCHA failed to load" for edge-case traffic. */}
              <div id="clerk-captcha" />
            </form>

            {/* Sign Up Link */}
            <div className="mt-8 text-center">
              <p className="text-slate-300">
                Don't have an account?
                <a href="/signup" className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium transition">
                  Sign up
                </a>
              </p>
            </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Verify It's You</h1>
                  <p className="text-slate-400">Enter the 6-digit code we sent to {email}</p>
                </div>

                <form onSubmit={handleVerify} className="space-y-6">
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-white mb-2">
                      Verification Code
                    </label>
                    <input
                      id="code"
                      type="text"
                      name="code"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200 tracking-widest text-center text-lg"
                      placeholder="123456"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 p-3 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={loading || !isLoaded}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying…' : 'Verify'}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={async () => { setStep('form'); setError(''); setCode(''); await signIn.reset(); }}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
