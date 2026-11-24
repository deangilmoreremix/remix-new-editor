// One login for the whole product. SmartWarmupAI has no sign-in of its own: the person signed in
// once, to the host app, through Clerk. The dashboard runs in a same-origin iframe of that app, so it
// reads the host's already-loaded Clerk session (window.top.Clerk) and exchanges that Clerk token with
// the Warmbly API (POST /auth/clerk) for a Warmbly session, which the rest of the dashboard uses as
// usual. Nothing else in the dashboard knows about Clerk, and no second Clerk instance is created.
//
// The exchange runs once at startup and again only when the dashboard needs a fresh token (the
// request layer calls refreshToken, which comes back here). Signing out of the host ends this session
// through Clerk's own listener. Demo builds never get here (they use recorded data).

import { clearTokens, saveTokens } from "./auth";
import type Token from "./api/models/auth/Token";
import exchangeClerk from "./api/client/auth/exchangeClerk";

export const HOST_SIGN_IN_URL = (import.meta.env.VITE_HOST_SIGN_IN_URL as string | undefined) || "/signin";
const WAIT_FOR_CLERK_MS = 10_000;

type HostClerk = {
    loaded?: boolean;
    session?: { getToken: () => Promise<string | null> } | null;
    signOut: () => Promise<void>;
    addListener?: (cb: (resources: { session?: unknown | null }) => void) => () => void;
};

let unlisten: (() => void) | undefined;

/** The host app's window when embedded in one (same origin), else this window. */
function hostWindow(): Window {
    try {
        return window.top && window.top !== window ? window.top : window;
    } catch {
        return window;
    }
}

function hostClerk(): HostClerk | undefined {
    try {
        return (hostWindow() as unknown as { Clerk?: HostClerk }).Clerk;
    } catch {
        return undefined;
    }
}

async function clerkReady(): Promise<HostClerk | undefined> {
    const until = Date.now() + WAIT_FOR_CLERK_MS;
    for (;;) {
        const c = hostClerk();
        if (c?.loaded) return c;
        if (Date.now() > until) return undefined;
        await new Promise((r) => setTimeout(r, 100));
    }
}

/**
 * Exchanges a fresh host Clerk token for a Warmbly session and stores it. Returns it, or null when
 * the host is signed out. Throws when the account needs a step this dashboard has no screen for
 * (two-factor, or linking a password account), since there is no second login to fall back to.
 */
export async function syncHostToken(): Promise<Token | null> {
    const jwt = await hostClerk()?.session?.getToken();
    if (!jwt) {
        clearTokens();
        return null;
    }
    const res = await exchangeClerk(jwt);
    if (!res.access_token || !res.access_token_expires_at || !res.refresh_token || !res.refresh_token_expires_at) {
        clearTokens();
        throw new Error("This account needs extra sign-in steps that the host app's sign-in does not cover.");
    }
    const token = res as Token;
    saveTokens({ ...token }); // every key the dashboard reads, as the sign-in does
    return token;
}

function toHostSignIn(): Promise<never> {
    const top = hostWindow();
    top.location.replace(`${HOST_SIGN_IN_URL}?redirect_url=${encodeURIComponent(top.location.href)}`);
    return new Promise<never>(() => {});
}

/**
 * Takes the host session before the dashboard renders. A signed-out visitor goes to the host app's
 * sign-in and this never resolves, so no Warmbly sign-in screen ever shows.
 */
export async function bootHostSession(): Promise<void> {
    const clerk = await clerkReady();
    if (!clerk?.session) await toHostSignIn();
    await syncHostToken();
    // Signed out of the host (here or in another tab): this session ends with it.
    unlisten?.();
    unlisten = clerk?.addListener?.(({ session }) => {
        if (session) return;
        clearTokens();
        void toHostSignIn();
    });
}

/** Signs out of the host app, which ends the dashboard session with it. */
export async function signOutOfHost(): Promise<void> {
    unlisten?.();
    unlisten = undefined;
    clearTokens();
    await hostClerk()?.signOut();
    hostWindow().location.replace(HOST_SIGN_IN_URL);
}
