// Clerk authentication — owns ALL auth (Option A: replaces Supabase sign-in).
// Routes: /signin, /signup, /forgot-password, /reset-password,
// /account, /profile. The publishable key comes from VITE_CLERK_PUBLISHABLE_KEY
// (set in Netlify env + .env.local via `clerk env pull`).
//
// /signin and /signup render the custom, app-styled pages (SignInPage /
// SignUpPage). The forgot-password and reset-password flows are custom pages
// too (ForgotPasswordPage / ResetPasswordPage), built on Clerk's
// reset_password_email_code strategy so they match the app's design.

import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useUser,
  UserButton,
  UserProfile,
} from '@clerk/react';
import { SignInPage } from '../landing/SignInPage.jsx';
import { SignUpPage } from '../landing/SignUpPage.jsx';
import { ForgotPasswordPage } from '../landing/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../landing/ResetPasswordPage.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkGate({ children }) {
  if (!PUBLISHABLE_KEY) {
    return (
      <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code>.
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} routing="path">
      {children}
    </ClerkProvider>
  );
}

// Inner cards — the styled <SignIn>/<SignUp> surface WITHOUT a ClerkProvider.
// Used directly inside AccountShell/ProfileShell (which already sit under a
// ClerkGate) to avoid nesting two <ClerkProvider> instances, which crashes
// React and blanks the page for signed-out visitors.
function SignInCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020205]">
      <SignIn
        routing="path"
        path="/signin"
        signUpUrl="/signup"
        afterSignInUrl="/#/image"
        afterSignUpUrl="/#/image"
      />
    </div>
  );
}

function SignUpCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020205]">
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/signin"
        afterSignInUrl="/#/image"
        afterSignUpUrl="/#/image"
      />
    </div>
  );
}

export function ClerkSignIn() {
  return <ClerkGate><SignInCard /></ClerkGate>;
}

export function ClerkSignUp() {
  return <ClerkGate><SignUpCard /></ClerkGate>;
}

function AccountShell() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>;
  if (!isSignedIn || !user) return <SignInPage />;

  const createdAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const emails = user?.emailAddresses || [];
  const hasPassword = user?.hasPassword ?? true;

  return (
    <div className="min-h-screen bg-[#020205] text-white">
      <div className="max-w-2xl mx-auto p-6 md:p-10">
        <div className="flex items-center gap-4 mb-8">
          <img
            src={user?.imageUrl || '/assets/placeholder-avatar.png'}
            alt={user?.fullName || 'Avatar'}
            className="w-16 h-16 rounded-full border border-white/10 bg-white/5"
          />
          <div>
            <h1 className="text-2xl font-bold text-white">Account</h1>
            <p className="text-slate-400 text-sm">{user?.fullName || '—'}</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-400 text-sm">Full Name</dt>
                <dd className="text-white text-sm">{user?.fullName || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400 text-sm">Username</dt>
                <dd className="text-white text-sm">{user?.username || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400 text-sm">Member since</dt>
                <dd className="text-white text-sm">{createdAt}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Email Addresses</h2>
            <ul className="space-y-2">
              {emails.map((entry) => (
                <li key={entry.emailAddress} className="flex items-center justify-between text-sm">
                  <span className="text-white">{entry.emailAddress}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${entry.verified ? 'bg-cyan-400/10 text-cyan-300' : 'bg-red-400/10 text-red-300'}`}>
                    {entry.verified ? 'Verified' : 'Unverified'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Quick Links</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/profile" className="text-sm text-cyan-400 hover:text-cyan-300 transition">Edit Profile</a>
              <button
                type="button"
                onClick={() => window.location.href = '/forgot-password'}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition"
              >
                Change Password
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Sign Out</h2>
              <p className="text-slate-400 text-sm">Sign out of this device.</p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileShell() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>;
  if (!isSignedIn || !user) return <SignUpPage />;

  return (
    <div className="min-h-screen bg-[#020205] text-white">
      <div className="max-w-5xl mx-auto p-6 md:p-10 flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col items-center text-center">
            <img
              src={user?.imageUrl || '/assets/placeholder-avatar.png'}
              alt={user?.fullName || 'User'}
              className="w-20 h-20 rounded-full border border-white/10 bg-white/5 mb-4"
            />
            <h2 className="text-lg font-bold text-white">{user?.fullName || 'User'}</h2>
            <p className="text-slate-400 text-sm mb-1">{user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-slate-500 text-xs mb-4">@{user?.username || 'user'}</p>
            <UserButton afterSignOutUrl="/" />
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            <p className="text-slate-400 text-sm">Manage your account details, security, and preferences.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <UserProfile />
          </div>
        </main>
      </div>
    </div>
  );
}

export function ClerkAccount() {
  return <ClerkGate><AccountShell /></ClerkGate>;
}

export function ClerkProfile() {
  return <ClerkGate><ProfileShell /></ClerkGate>;
}

// Mount the correct Clerk page for a given route (called from main.js).
// /signin, /signup, /forgot-password, /reset-password render the custom
// app-styled pages (SignInPage / SignUpPage / ForgotPasswordPage /
// ResetPasswordPage) backed by Clerk's useSignIn / useSignUp hooks. The
// /account and /profile routes render the prebuilt Clerk components
// (UserProfile, AccountShell). Any unrecognized route falls through to
// the custom SignInPage so users never hit Clerk's prebuilt <SignIn>
// (which shows the unhelpful "You're already signed in" message and
// gives them no way to clear stale session cookies).
export function mountClerkRoute(route, container) {
  const root = createRoot(container);
  const pages = {
    signin: <ClerkGate><SignInPage /></ClerkGate>,
    signup: <ClerkGate><SignUpPage /></ClerkGate>,
    'forgot-password': <ClerkGate><ForgotPasswordPage /></ClerkGate>,
    'reset-password': <ClerkGate><ResetPasswordPage /></ClerkGate>,
    account: <ClerkAccount />,
    profile: <ClerkProfile />,
  };
  root.render(pages[route] || <ClerkGate><SignInPage /></ClerkGate>);
}
