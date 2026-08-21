// Custom Sign Up Page — your design, powered by Clerk's useSignUp hook.
// Uses the current (v6) Clerk custom-flow API:
//   const { signUp, errors, fetchStatus } = useSignUp()
//   await signUp.password({ emailAddress, password, firstName })
//   await signUp.verifications.sendEmailCode()
//   await signUp.verifications.verifyEmailCode({ code })
//   if (signUp.status === 'complete') await signUp.finalize({ navigate })
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /signup).

import React, { useState, useEffect } from 'react';
import { useSignUp, useUser } from '@clerk/react';
import { clerkErrorMessage, clerkWithTimeout, handleNavClick, clearClerkSession } from './AuthLayout.jsx';

export function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const isLoaded = signUp !== undefined;
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect already-signed-in users away from the sign-up form
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

    // Clear any stale sign-up state before retrying
    try { signUp.reset(); } catch {}

    const { error: resultError } = await clerkWithTimeout(
      signUp.password({
        emailAddress: email,
        password,
        ...(firstName ? { firstName } : {}),
      })
    );
    if (resultError) {
      setError(clerkErrorMessage(resultError, errors) || 'Could not create your account. Please try again.');
      setLoading(false);
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: async ({ decorateUrl }) => {
          const url = decorateUrl('/#/image');
          window.location.href = url.startsWith('http') ? url : '/#/image';
        },
      });
      return;
    }
    // Instance requires email verification — send the code, move to step 2.
    const { error: sendError } = await clerkWithTimeout(
      signUp.verifications.sendEmailCode()
    );
    if (sendError) {
      setError(clerkErrorMessage(sendError, errors) || 'Could not send verification email. Please try again.');
      setLoading(false);
      return;
    }

    setStep('verify');
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');
    const { error: resultError } = await clerkWithTimeout(
      signUp.verifications.verifyEmailCode({ code })
    );
    if (resultError) {
      setError(clerkErrorMessage(resultError, errors) || 'Verification failed. Please check your code and try again.');
      setLoading(false);
      return;
    }

    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: async ({ decorateUrl }) => {
          const url = decorateUrl('/#/image');
          window.location.href = url.startsWith('http') ? url : '/#/image';
        },
      });
      return;
    }

    setLoading(false);
  };

  return (
    <div
      className="signup-page min-h-screen bg-[#020205] flex flex-col"
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
            <a href="/signin" className="px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium">Sign In</a>
            <a href="#/apps" onClick={(e) => handleNavClick(e, 'apps')} className="px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Home</a>
          </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Sign Up Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
            {step === 'form' ? (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Start Your Journey</h1>
                  <p className="text-slate-400">Create your account and start creating</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-white mb-2">
                      Full Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      autoComplete="name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200"
                      placeholder="Jane Doe"
                    />
                  </div>

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
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200"
                        placeholder="Create a password"
                      />
                      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002 2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 p-3 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !isLoaded}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account…' : 'Create Account'}
                  </button>
                  <div id="clerk-captcha" />
                </form>

                <div className="mt-8 text-center">
                  <p className="text-slate-300">
                    Already have an account?
                    <a href="/signin" className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium transition">
                      Sign in
                    </a>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Verify Your Email</h1>
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
                    type="submit"
                    disabled={loading || !isLoaded}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying…' : 'Verify Email'}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!signUp) return;
                      setError('');
                      try {
                        await signUp.verifications.sendEmailCode();
                      } catch (err) {
                        setError(err?.errors?.[0]?.longMessage || 'Could not resend code.');
                      }
                    }}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Resend code
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isLoaded}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>
          <div id="clerk-captcha" />

          <AuthFooterComponent>
            Already have an account?{' '}
            <button type="button" onClick={() => navigate('/signin')} className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Sign in
            </button>
          </AuthFooterComponent>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          <p className="text-sm text-slate-300">We sent a verification code to <span className="text-cyan-300">{email}</span>.</p>

          {/* Verification Code */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Verification Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter the 6-digit code"
              className={authInputClass}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isLoaded}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25 hover:shadow-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
          <div id="clerk-captcha" />
        </form>
      )}
    </AuthPageComponent>
  );
}
