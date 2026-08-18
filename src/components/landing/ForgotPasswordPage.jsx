// Custom Forgot Password Page — app-styled, powered by Clerk's
// useSignIn reset_password_email_code flow (current v6 API):
//   const { signIn, errors, fetchStatus } = useSignIn()
//   await signIn.resetPasswordEmailCode.sendCode()
//   await signIn.resetPasswordEmailCode.verifyCode({ code })
//   await signIn.resetPasswordEmailCode.submitPassword({ password })
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /forgot-password).

import React, { useState, useEffect } from 'react';
import { useSignIn, useUser } from '@clerk/react';
import {
  AuthPage,
  AuthError,
  AuthSubmitButton,
  AuthFooter,
  authInputClass,
  clerkErrorMessage,
  clerkWithTimeout,
} from './AuthLayout.jsx';

export function ForgotPasswordPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const isLoaded = signIn !== undefined;
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect already-signed-in users
  useEffect(() => {
    if (userLoaded && isSignedIn) {
      window.location.href = '/#/image';
    }
  }, [userLoaded, isSignedIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');
    setSuccess(false);

    const { error: createError } = await clerkWithTimeout(
      signIn.create({ identifier: email })
    );
    if (createError) {
      setError(clerkErrorMessage(createError, errors) || 'Could not start password reset. Please try again.');
      setLoading(false);
      return;
    }

    const { error: sendError } = await clerkWithTimeout(
      signIn.resetPasswordEmailCode.sendCode()
    );
    if (sendError) {
      setError(clerkErrorMessage(sendError, errors) || 'Could not send a reset code. Please check the email and try again.');
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  return (
    <AuthPage
      title="Reset Password"
      subtitle="Enter your email and we'll send a reset code"
    >
      {success ? (
        <>
          <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 p-4 text-sm mb-6 text-center">
            If an account exists for <span className="font-semibold">{email}</span>,
            a reset code is on its way. Check your inbox.
          </div>
          <p className="text-sm text-slate-300 mb-6 text-center">
            Once you have your code, continue to set a new password.
          </p>
          <a
            href={`/reset-password?email=${encodeURIComponent(email)}`}
            className="block w-full px-6 py-3 text-center bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-200 shadow-lg shadow-cyan-400/25"
          >
            Enter reset code
          </a>
          <AuthFooter>
            <p>
              Remembered it?
              <a href="/signin" className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium transition">
                Back to sign in
              </a>
            </p>
          </AuthFooter>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-300 mb-4 text-center">
            If you previously signed up with a magic link and don’t have a password,
            use this page to set one so you can sign in with email + password.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  className={authInputClass}
                  placeholder="you@example.com"
                />
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002 2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

              <AuthError message={error} />

              <AuthSubmitButton
                loading={loading}
                disabled={!isLoaded}
                loadingLabel="Sending…"
                label="Send Reset Code"
              />

              {/* Required for custom auth flows: Clerk's Smart CAPTCHA widget
                  renders into this element so password-reset requests pass
                  bot protection instead of silently failing. */}
              <div id="clerk-captcha" />
            </form>

          <AuthFooter>
            <p>
              Remembered it?
              <a href="/signin" className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium transition">
                Back to sign in
              </a>
            </p>
          </AuthFooter>
        </>
      )}
    </AuthPage>
  );
}
