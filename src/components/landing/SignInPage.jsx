// Custom Sign In Page — your design, powered by Clerk's useSignIn hook.
// Uses the current (v6) Clerk custom-flow API:
//   const { signIn, errors, fetchStatus } = useSignIn()
//   await signIn.password({ identifier, password })
//   if (signIn.status === 'complete') await signIn.finalize({ navigate })
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /signin).

import React, { useState } from 'react';
import { useSignIn } from '@clerk/react';
import { clerkErrorMessage } from './AuthLayout.jsx';

export function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const isLoaded = fetchStatus !== 'fetching';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!signIn || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');
    const { error: resultError } = await signIn.password({ identifier: email, password });
    if (resultError) {
      setError(clerkErrorMessage(resultError, errors) || 'Sign in failed. Please check your credentials.');
      setLoading(false);
      return;
    }
    if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      setError('Additional verification is required. This flow needs the email/authenticator code step.');
      setLoading(false);
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: async ({ session, decorateUrl }) => {
          const url = decorateUrl('/#/image');
          window.location.href = url.startsWith('http') ? url : '/#/image';
        },
      });
      return;
    }
    setError(clerkErrorMessage(null, errors) || 'Sign in could not be completed. Please try again.');
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
            <a href="/signup" className="px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium">Sign Up</a>
            <a href="/" className="px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Home</a>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Sign In Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
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
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200"
                    placeholder="Enter your password"
                  />
                  <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002 2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
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
          </div>
        </div>
      </main>
    </div>
  );
}
