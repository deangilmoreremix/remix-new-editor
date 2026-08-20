import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useUser, useClerk, UserButton, useAuth } from '@clerk/react';
import { setEntitlement } from '../../lib/clerkEntitlements.js';
import { setExternalUserId } from '../../lib/socialPublishing';
import { isClerkReady, getClerkInstance } from '../../lib/clerkInit.js';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function EntitlementBridge() {
  const { has, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setEntitlement({ hasFullAccess: false });
      return;
    }
    const hasBillingAccess = has?.({ feature: 'smartvideo_full_access' }) ?? false;
    const hasLegacyAccess = user?.publicMetadata?.legacy_access === true;
    const hasFullAccess = hasBillingAccess || hasLegacyAccess;
    setEntitlement({ hasFullAccess });
  }, [isLoaded, isSignedIn, has, user?.publicMetadata?.legacy_access]);

  return null;
}

function HeaderAuthButton() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();

  // Map the Clerk user to muapi's external_user_id so each user's connected
  // social accounts are isolated (otherwise the service falls back to a
  // per-browser localStorage id shared by everyone on the device).
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

export function mountHeaderAuth(container) {
  if (!PUBLISHABLE_KEY || !container) return;

  // If Clerk failed to load during app startup, don't render <ClerkProvider>
  // because it will try to load Clerk JS from CDN again and crash.
  const clerk = getClerkInstance();
  if (!clerk || !clerk.loaded) {
    const root = createRoot(container);
    root.render(
      <a href="/signin" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition px-3 py-2">
        Sign In
      </a>
    );
    return;
  }

  const root = createRoot(container);
  root.render(
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} routing="path">
      <EntitlementBridge />
      <HeaderAuthButton />
    </ClerkProvider>
  );
}
