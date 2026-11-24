// One login for the whole product. SmartWarmupAI has no sign-in of its own: the person signed in
// once, to the host app, through Clerk. The dashboard runs in a same-origin iframe of that app, so it
// reads the host's already-loaded Clerk session (window.top.Clerk) and turns it into the Token the rest
// of the dashboard already reads. Nothing else in the dashboard knows about Clerk, and no second Clerk
// instance is created.
//
// The Warmbly API must accept the Clerk JWT (verify it, or exchange it) before a real backend is
// connected; demo builds never get here (they use recorded data).

import { clearTokens, saveTokens } from "./auth";
import type Token from "./api/models/auth/Token";

export const HOST_SIGN_IN_URL = (import.meta.env.VITE_HOST_SIGN_IN_URL as string | undefined) || "/signin";
// The Clerk "refresh" the client keeps; the real refreshing is Clerk's.
const HOST_REFRESH = "host-session";
const REFRESH_EVERY_MS = 45_000;
const WAIT_FOR_CLERK_MS = 10_000;

type HostClerk = {
    loaded?: boolean;
    session?: { getToken: () => Promise<string | null> } | null;
    signOut: () => Promise<void>;
};

let timer: ReturnType<typeof setInterval> | undefined;

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

function expiry(jwt: string): Date {
    try {
        const exp = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp;
        if (typeof exp === "number") return new Date(exp * 1000);
    } catch {
        /* fall through */
    }
    return new Date(Date.now() + 60_000);
}

/** Reads a fresh host Clerk token into the Token the dashboard reads. Returns it, or null when signed out. */
export async function syncHostToken(): Promise<Token | null> {
    const jwt = await hostClerk()?.session?.getToken();
    if (!jwt) {
        clearTokens();
        return null;
    }
    const token: Token = {
        access_token: jwt,
        access_token_expires_at: expiry(jwt),
        refresh_token: HOST_REFRESH,
        refresh_token_expires_at: new Date(Date.now() + 365 * 86_400_000),
    };
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
    timer ??= setInterval(() => {
        void syncHostToken().then((t) => {
            if (!t) void toHostSignIn(); // signed out of the host elsewhere: end here too
        });
    }, REFRESH_EVERY_MS);
}

/** Signs out of the host app, which ends the dashboard session with it. */
export async function signOutOfHost(): Promise<void> {
    if (timer) clearInterval(timer);
    timer = undefined;
    clearTokens();
    await hostClerk()?.signOut();
    hostWindow().location.replace(HOST_SIGN_IN_URL);
}
