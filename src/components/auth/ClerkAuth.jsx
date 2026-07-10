// Clerk authentication scaffold
// Mounts Clerk's prebuilt <SignIn> / <SignUp> on the /signin and /signup routes.
// The publishable key is read from VITE_CLERK_PUBLISHABLE_KEY (set in Netlify env
// and .env.local via `clerk env pull`).
//
// This is a non-destructive scaffold: the existing Supabase auth flow in the app
// is left intact. Swap the app's auth calls to Clerk (or gate the studio shell
// with Clerk's <Protect>/auth() checks) as a follow-up migration step.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, SignIn, SignUp } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkGate({ children }) {
  if (!PUBLISHABLE_KEY) {
    return (
      <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code> environment variable.
      </div>
    );
  }
  return <ClerkProvider publishableKey={PUBLISHABLE_KEY}>{children}</ClerkProvider>;
}

export function ClerkSignIn() {
  return (
    <ClerkGate>
      <div className="min-h-screen flex items-center justify-center bg-[#020205]">
        <SignIn routing="path" path="/signin" signUpUrl="/signup" />
      </div>
    </ClerkGate>
  );
}

export function ClerkSignUp() {
  return (
    <ClerkGate>
      <div className="min-h-screen flex items-center justify-center bg-[#020205]">
        <SignUp routing="path" path="/signup" signInUrl="/signin" />
      </div>
    </ClerkGate>
  );
}

// Mount the correct Clerk page into a container (called from main.js, which is
// plain JS and therefore avoids JSX here).
export function mountClerkPage(page, container) {
  const root = createRoot(container);
  root.render(page === 'signup' ? <ClerkSignUp /> : <ClerkSignIn />);
}
