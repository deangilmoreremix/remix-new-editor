// Custom Sign In Page — your design, powered by Clerk's useSignIn hook.
// Uses the current (v6) Clerk custom-flow API:
//   const { signIn, errors, fetchStatus } = useSignIn()
//   await signIn.password({ identifier, password })
//   if (signIn.status === 'complete') await signIn.finalize({ navigate })
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /signin).

import React, { useState, useEffect } from 'react';
import { useSignIn, useUser, useClerk } from '@clerk/react';
import { clerkErrorMessage, clerkWithTimeout, clearClerkSession } from './AuthLayout.jsx';
import { navigate } from '../../lib/router.js';

export function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn, isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();
  const isLoaded = signIn !== undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If the user is already signed in, redirect them away from the sign-in
  // page to the app. Without this check, signed-in users see the form and
  // can't proceed — they're stuck on /signin with no usable navigation.
  //
  // Guard against the stale-session state where Clerk reports isSignedIn=true
  // but user is null/undefined. In that case the session cookies are invalid,
  // so clearing them and reloading is safer than redirecting into a broken
  // authenticated state or a redirect loop.
  useEffect(() => {
    if (!userLoaded) return;
    if (isSignedIn && !user) {
      clearClerkSession({ reload: true });
      return;
    }
    if (isSignedIn) {
      window.location.href = '/#/image';
    }
  }, [userLoaded, isSignedIn, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');

    // Clear any stale in-progress sign-in before retrying
    try { signIn.reset(); } catch {}

    const { error: resultError } = await clerkWithTimeout(
      signIn.password({ identifier: email, password })
    );
    if (resultError) {
      setError(clerkErrorMessage(resultError, errors) || 'Sign in failed. Please check your credentials.');
      setLoading(false);
      return;
    }
    if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      // let the built-in UI handle 2FA / client trust
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: (destination) => { window.location.href = destination || '/#/image'; } });
      return;
    }
    setLoading(false);
  };

  return (
    <AuthPage title="Welcome Back" subtitle="Sign in to continue your creative journey">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={authInputClass}
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={authInputClass}
            required
          />
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input type="checkbox" className="rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/50" />
            Remember me
          </label>
            <button type="button" onClick={() => navigate('/forgot-password')} className="text-cyan-400 hover:text-cyan-300 transition">
              Forgot password?
            </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !isLoaded}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing In…' : 'Sign In'}
        </button>
        <div id="clerk-captcha" />
      </form>

      <AuthFooter>
        Don&apos;t have an account?{' '}
        <button type="button" onClick={() => navigate('/signup')} className="text-cyan-400 hover:text-cyan-300 font-medium transition">
          Sign up
        </button>
      </AuthFooter>
    </AuthPage>
  );
}
