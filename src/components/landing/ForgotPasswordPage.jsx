// Custom Forgot Password Page — app-styled, powered by Clerk's
// useSignIn reset_password_email_code flow (current v6 API):
//   const { signIn, errors, fetchStatus } = useSignIn()
//   await signIn.create({ identifier: email })
//   await signIn.resetPasswordEmailCode.sendCode()
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /forgot-password).

import React, { useState, useEffect } from 'react';
import { useSignIn, useUser } from '@clerk/react';
import {
  AuthPage as AuthPageComponent,
  AuthError as AuthErrorComponent,
  AuthSubmitButton as AuthSubmitButtonComponent,
  AuthFooter as AuthFooterComponent,
  authInputClass,
  clerkErrorMessage,
  clerkWithTimeout,
  clearClerkSession,
} from './AuthLayout.jsx';
import { navigate } from '../../lib/router.js';

export function ForgotPasswordPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn, isLoaded: userLoaded, user } = useUser();
  const isLoaded = signIn !== undefined;
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect already-signed-in users
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
      setError(clerkErrorMessage(sendError, errors) || 'Could not send reset code. Please try again.');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <AuthPageComponent title="Forgot Password" subtitle="Enter your email and we'll send you a reset code">
      {success ? (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Check your email</h3>
            <p className="text-slate-300 text-sm">We sent a reset code to <span className="text-cyan-300">{email}</span>.</p>
          </div>
          <div className="space-y-3">
            <AuthSubmitButtonComponent onClick={() => window.location.href = `/reset-password?email=${encodeURIComponent(email)}`}>
              Enter Reset Code
            </AuthSubmitButtonComponent>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="w-full text-sm text-slate-300 hover:text-white transition"
            >
              Request again
            </button>
          </div>
          <AuthFooterComponent>
            <button type="button" onClick={() => navigate('/signin')} className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Back to sign in
            </button>
          </AuthFooterComponent>
        </div>
      ) : (
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

          {/* Error */}
          {error && <AuthErrorComponent message={error} />}

          {/* Submit Button */}
          <AuthSubmitButtonComponent type="submit" loading={loading} disabled={!isLoaded}>
            Send Reset Code
          </AuthSubmitButtonComponent>

          <AuthFooterComponent>
            {'Remember your password? '}
            <button type="button" onClick={() => navigate('/signin')} className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Back to sign in
            </button>
          </AuthFooterComponent>
        </form>
      )}
    </AuthPageComponent>
  );
}
