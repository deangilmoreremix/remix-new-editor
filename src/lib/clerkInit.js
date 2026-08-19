// Singleton Clerk instance — shared between the pre-router auth gate
// (router.js ensureStudioAccess) and every <ClerkProvider> in the app.
//
// By initialising and loading Clerk ONCE at app-start, window.Clerk is
// guaranteed to be set and loaded before the router checks authentication,
// eliminating the timing gap where waitForClerk() falls back to the Clerk
// *class* (which has no `.user`).
//
// If ClerkProvider has already set window.Clerk (e.g. user navigated from
// /signin to a studio page), ensureClerkLoaded will WAIT for that instance
// to finish loading rather than creating a duplicate.
import { Clerk } from '@clerk/clerk-js';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let clerkInstance = null;
let clerkLoadPromise = null;

export function getClerkInstance() {
  if (clerkInstance) return clerkInstance;
  if (!PUBLISHABLE_KEY) {
    console.warn('[Clerk] VITE_CLERK_PUBLISHABLE_KEY is not set');
    return null;
  }
  clerkInstance = new Clerk(PUBLISHABLE_KEY);
  return clerkInstance;
}

export function isClerkReady() {
  return !!(clerkInstance && clerkInstance.loaded);
}

// Ensure the shared Clerk instance is created, loaded, and set on window.Clerk.
// Safe to call multiple times — returns the same promise.
//
// If window.Clerk is already set (by ClerkProvider's CDN loading) but not yet
// loaded, this waits for it rather than creating a duplicate instance.
export async function ensureClerkLoaded() {
  if (typeof window === 'undefined') return null;

  // Case 1: window.Clerk is already set (possibly by ClerkProvider's CDN load)
  const existing = window.Clerk;
  if (existing && existing.loaded) {
    clerkInstance = existing;
    return existing;
  }

  // Case 2: window.Clerk exists but isn't loaded yet — wait for it to finish.
  // This happens when ClerkProvider has started a CDN load in its effect but
  // hasn't completed yet.
  if (existing && !existing.loaded) {
    await new Promise((resolve) => {
      let resolved = false;
      const timer = setInterval(() => {
        if (existing.loaded) {
          clearInterval(timer);
          if (!resolved) { resolved = true; resolve(); }
        }
      }, 200);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          clearInterval(timer);
          resolve();
        }
      }, 10000);
    });
    if (existing.loaded) {
      clerkInstance = existing;
      return existing;
    }
  }

  // Case 3: No existing instance on window.Clerk — create and load our own.
  const clerk = getClerkInstance();
  if (!clerk) return null;

  if (clerk.loaded) {
    window.Clerk = clerk;
    return clerk;
  }

  // Already loading — return the in-flight promise
  if (clerkLoadPromise) return clerkLoadPromise;

  // Set window.Clerk synchronously so any concurrent waiter (router.js)
  // sees the instance immediately, even before `load()` resolves.
  window.Clerk = clerk;

  clerkLoadPromise = clerk.load().then(() => clerk).catch((err) => {
    console.error('[Clerk] Failed to load:', err);
    clerkLoadPromise = null;
    throw err;
  });

  return clerkLoadPromise;
}

export { Clerk };
