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
  AuthPage,
  AuthError,
  AuthSubmitButton,
  AuthFooter,
  authInputClass,
  PasswordInput,
  clerkErrorMessage,
  clerkWithTimeout,
  clearClerkSession,
} from './AuthLayout.jsx';

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
      setError(clerkErrorMessage(verifyError, errors) || 'Invalid or expired code. Please request a new one.');
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
      setError(clerkErrorMessage(submitError, errors) || 'Could not reset the password. Please try again.');
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

  if (done) {
    return (
      <AuthPage title="Password Updated" subtitle="Redirecting you to the app…">
        <AuthFooter>
          <p>
            <a href="/signin" className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Back to sign in
            </a>
          </p>
        </AuthFooter>
      </AuthPage>
    );
  }

  return (
    <AuthPage
      title="Set New Password"
      subtitle={email ? `Resetting password for ${email}` : 'Enter the code from your email'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {!email && (
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
              Email Address
            </label>
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
          </div>
        )}

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
            className={`${authInputClass} tracking-widest text-center text-lg`}
            placeholder="123456"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
            New Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a new password"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-white mb-2">
            Confirm New Password
          </label>
          <PasswordInput
            id="confirm"
            name="confirm"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your new password"
          />
        </div>

        <AuthError message={error} />

        <AuthSubmitButton
          loading={loading}
          disabled={!isLoaded}
          loadingLabel="Updating…"
          label="Update Password"
        />

        {/* Required for custom auth flows: Clerk's Smart CAPTCHA widget
            renders into this element so password-reset requests pass
            bot protection instead of silently failing on edge traffic. */}
        <div id="clerk-captcha" />
      </form>

      <AuthFooter>
        <p>
          Didn't get a code?
          <a href="/forgot-password" className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium transition">
            Request again
          </a>
        </p>
      </AuthFooter>
    </AuthPage>
  );
}
