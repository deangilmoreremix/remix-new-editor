// Clerk authentication — owns ALL auth (Option A: replaces Supabase sign-in).
// Routes: /signin, /signup, /forgot-password, /reset-password,
// /account, /profile. The publishable key comes from VITE_CLERK_PUBLISHABLE_KEY
// (set in Netlify env + .env.local via `clerk env pull`).
//
// Clerk's <SignIn> natively includes the "Forgot password?" flow and the
// password-reset completion, so /forgot-password and /reset-password simply
// mount the same Clerk sign-in surface.

import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useUser,
  UserButton,
} from '@clerk/react';
import { SignInPage } from '../landing/SignInPage.jsx';
import { SignUpPage } from '../landing/SignUpPage.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkGate({ children }) {
  if (!PUBLISHABLE_KEY) {
    return (
      <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code>.
      </div>
    );
  }
  return <ClerkProvider publishableKey={PUBLISHABLE_KEY}>{children}</ClerkProvider>;
}

export function ClerkSignIn() {
  return (
    <ClerkGate>
      <div className="min-h-screen flex items-center justify-center bg-[#020205]">
        <SignIn
          routing="path"
          path="/signin"
          signUpUrl="/signup"
          afterSignInUrl="/#/image"
          afterSignUpUrl="/#/image"
        />
      </div>
    </ClerkGate>
  );
}

export function ClerkSignUp() {
  return (
    <ClerkGate>
      <div className="min-h-screen flex items-center justify-center bg-[#020205]">
        <SignUp
          routing="path"
          path="/signup"
          signInUrl="/signin"
          afterSignInUrl="/#/image"
          afterSignUpUrl="/#/image"
        />
      </div>
    </ClerkGate>
  );
}

function AccountShell() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>;
  if (!isSignedIn) return <ClerkSignIn />;
  return (
    <div className="min-h-screen bg-[#020205] text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Account</h1>
      <p className="text-slate-300 mb-6">
        Signed in as {user?.primaryEmailAddress?.emailAddress || user?.username || 'user'}
      </p>
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}

function ProfileShell() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>;
  if (!isSignedIn) return <ClerkSignUp />;
  return (
    <div className="min-h-screen bg-[#020205] text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <p className="text-slate-300 mb-2">Username: {user?.username || '—'}</p>
      <p className="text-slate-300 mb-6">
        Email: {user?.primaryEmailAddress?.emailAddress || '—'}
      </p>
      <UserButton afterSignOutUrl="/" />
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
// /signin and /signup render the custom, app-styled pages (SignInPage /
// SignUpPage) backed by Clerk's useSignIn / useSignUp hooks. The remaining
// routes fall back to Clerk's prebuilt components.
export function mountClerkRoute(route, container) {
  const root = createRoot(container);
  const pages = {
    signin: <ClerkGate><SignInPage /></ClerkGate>,
    signup: <ClerkGate><SignUpPage /></ClerkGate>,
    'forgot-password': <ClerkSignIn />,
    'reset-password': <ClerkSignIn />,
    account: <ClerkAccount />,
    profile: <ClerkProfile />,
  };
  root.render(pages[route] || <ClerkSignIn />);
}
