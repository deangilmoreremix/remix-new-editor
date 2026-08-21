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
import { clerkErrorMessage, clerkWithTimeout, clearClerkSession, AuthPage as AuthPageComponent, AuthError as AuthErrorComponent, AuthSubmitButton as AuthSubmitButtonComponent, AuthFooter as AuthFooterComponent, authInputClass, PasswordInput as PasswordInputComponent } from './AuthLayout.jsx';
import { navigate } from '../../lib/router.js';

export function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn, isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();
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
      signUp.password.create({
        emailAddress: email,
        password,
        firstName,
      })
    );
    if (resultError) {
      setError(clerkErrorMessage(resultError, errors) || 'Could not create your account. Please try again.');
      setLoading(false);
      return;
    }

    // Send email verification code
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
      await signUp.finalize({ navigate: (destination) => { window.location.href = destination || '/#/image'; } });
      return;
    }

    setLoading(false);
  };

  return (
    <AuthPageComponent title="Create Your Account" subtitle="Start your creative journey with SmartVideo">
      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your name"
              className={authInputClass}
              required
            />
          </div>

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
              placeholder="Create a strong password"
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
