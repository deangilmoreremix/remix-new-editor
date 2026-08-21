// Custom Reset Password Page — app-styled, powered by Clerk's
// useSignIn reset_password_email_code flow (current v6 API):
//   const { signIn, errors, fetchStatus } = useSignIn()
//   await signIn.resetPasswordEmailCode.verifyCode({ code })
//   await signIn.resetPasswordEmailCode.submitPassword({ password })
// Completes the password reset started on ForgotPasswordPage.
// Requires a <ClerkProvider> ancestor (provided by ClerkGate in
// ClerkAuth.jsx when this page is mounted at /reset-password).

import React, { useState, useEffect } from 'react';
import { useSignIn, useUser } from '@clerk/react';
import {
  AuthPage as AuthPageComponent,
  AuthError as AuthErrorComponent,
  AuthSubmitButton as AuthSubmitButtonComponent,
  AuthFooter as AuthFooterComponent,
  authInputClass,
  PasswordInput as PasswordInputComponent,
  clerkErrorMessage,
  clerkWithTimeout,
  clearClerkSession,
} from './AuthLayout.jsx';
import { navigate } from '../../lib/router.js';

export function ResetPasswordPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const isLoaded = signIn !== undefined;
  const [email, setEmail] = useState(
    () => new URLSearchParams(window.location.search).get('email') || ''
  );
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Redirect already-signed-in users to the app
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
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    // Step 1: verify the emailed code.
    const { error: verifyError } = await clerkWithTimeout(
      signIn.resetPasswordEmailCode.verifyCode({ code })
    );
    if (verifyError) {
      setError(clerkErrorMessage(verifyError, errors) || 'Invalid or expired code.');
      setLoading(false);
      return;
    }
    // Step 2: submit the new password. On success the
    // sign-in is complete and the session is created.
    const { error: submitError } = await clerkWithTimeout(
      signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      })
    );
    if (submitError) {
      setError(clerkErrorMessage(submitError, errors) || 'Could not reset password. Please try again.');
      setLoading(false);
      return;
    }
    if (signIn.status === 'complete') {
      setDone(true);
      await signIn.finalize({
        navigate: async ({ decorateUrl }) => {
          const url = decorateUrl('/#/image');
          window.location.href = url.startsWith('http') ? url : '/#/image';
        },
      });
      return;
    }
    if (signIn.status === 'needs_second_factor') {
      setError('Two-factor authentication is required. Please use the sign-in page.');
      setLoading(false);
      return;
    }
    setError(clerkErrorMessage(null, errors) || 'Could not reset the password. Please try again.');
    setLoading(false);
  };

  return (
    <AuthPageComponent title="Reset Password" subtitle="Enter the code from your email and choose a new password">
      {done ? (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Password updated</h3>
            <p className="text-slate-300 text-sm">You can now sign in with your new password.</p>
          </div>
          <AuthSubmitButtonComponent onClick={() => { window.location.href = '/signin'; }}>
            Go to Sign In
          </AuthSubmitButtonComponent>
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

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Reset Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter the 6-digit code"
              className={authInputClass}
              required
            />
          </div>

          {/* New Password */}
          <PasswordInputComponent
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
          />

          {/* Confirm Password */}
          <PasswordInputComponent
            label="Confirm New Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your new password"
            required
          />

          {/* Error */}
          {error && <AuthErrorComponent message={error} />}

          {/* Submit Button */}
          <AuthSubmitButtonComponent type="submit" loading={loading} disabled={!isLoaded}>
            Reset Password
          </AuthSubmitButtonComponent>

          <AuthFooterComponent>
            <button type="button" onClick={() => window.location.href = '/forgot-password'} className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Request again
            </button>
            <span className="text-slate-500">|</span>
            <button type="button" onClick={() => navigate('/signin')} className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Back to sign in
            </button>
          </AuthFooterComponent>
        </form>
      )}
    </AuthPageComponent>
  );
}
