import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useUser, useClerk, UserButton, useAuth } from '@clerk/react';
import { setEntitlement } from '../../lib/clerkEntitlements.js';
import { setExternalUserId } from '../../lib/socialPublishing';
import { ensureClerkLoaded } from '../../lib/clerkInit.js';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function EntitlementBridge() {
  const { has, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setEntitlement({ hasFullAccess: false });
      return;
    }
    const value = { hasFullAccess: has?.({ feature: 'smartvideo_full_access' }) ?? false };
    setEntitlement(value);
  }, [isLoaded, isSignedIn, has]);

  return null;
}

function HeaderAuthButton() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();

  useEffect(() => {
    if (isSignedIn && user?.id) {
      setExternalUserId(user.id);
    }
  }, [isSignedIn, user?.id]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <a
        href="/signin"
        className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition px-3 py-2"
      >
        Sign In
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 hidden md:inline max-w-[160px] truncate">
        {user?.primaryEmailAddress?.emailAddress}
      </span>
      <UserButton afterSignOutUrl="/">
        <UserButton.MenuItems>
          <UserButton.Link label="Profile" url="/profile" />
          <UserButton.Link label="Account" url="/account" />
          <UserButton.Action label="Sign out" onClick={() => clerk.signOut()} destructive />
        </UserButton.MenuItems>
      </UserButton>
    </div>
  );
}

function HeaderAuthRoot() {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!PUBLISHABLE_KEY) {
      setLoadError('missing_key');
      return;
    }

    let cancelled = false;
    ensureClerkLoaded()
      .then((clerk) => {
        if (cancelled) return;
        if (clerk && clerk.loaded) {
          setIsReady(true);
        } else {
          setLoadError('load_failed');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('load_failed');
      });

    return () => { cancelled = true; };
  }, []);

  if (!PUBLISHABLE_KEY || loadError) {
    return (
      <a href="/signin" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition px-3 py-2">
        Sign In
      </a>
    );
  }

  if (!isReady) return null;

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} routing="path">
      <EntitlementBridge />
      <HeaderAuthButton />
    </ClerkProvider>
  );
}

export function mountHeaderAuth(container) {
  if (!container) return;
  const root = createRoot(container);
  root.render(<HeaderAuthRoot />);
}
