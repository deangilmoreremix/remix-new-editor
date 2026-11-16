// The host app's session stands in for Warmbly's own sign-in. Warmbly ships no login, register or
// reset screens here: the person is already signed in to the host app through Clerk, and this
// turns that session into the Token the rest of the dashboard already reads (TOKEN_KEY).
//
// The backend is added last, so the Token carries the Clerk JWT as its access token; the Warmbly
// API will verify it (or exchange it) on arrival. Nothing else in the dashboard knows about Clerk.

import { Clerk } from "@clerk/clerk-js";

import setToken from "./helper/setToken";
import type Token from "./api/models/auth/Token";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
// Where a signed-out visitor goes: the host app's own sign-in, never a Warmbly page.
export const HOST_SIGN_IN_URL = (import.meta.env.VITE_HOST_SIGN_IN_URL as string | undefined) || "/sign-in";
// The Clerk "refresh" the client keeps; the real refreshing is Clerk's.
const HOST_REFRESH = "host-session";
const REFRESH_EVERY_MS = 45_000;

let clerk: Clerk | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function expiry(jwt: string): Date {
    try {
        const exp = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp;
        if (typeof exp === "number") return new Date(exp * 1000);
    } catch {
        /* fall through */
    }
    return new Date(Date.now() + 60_000);
}

/** Reads a fresh Clerk token into the Token the dashboard reads. Returns it, or null when signed out. */
export async function syncHostToken(): Promise<Token | null> {
    const jwt = await clerk?.session?.getToken();
    if (!jwt) {
        setToken(null);
        return null;
    }
    const token: Token = {
        access_token: jwt,
        access_token_expires_at: expiry(jwt),
        refresh_token: HOST_REFRESH,
        refresh_token_expires_at: new Date(Date.now() + 365 * 86_400_000),
    };
    setToken(token);
    return token;
}

/**
 * Loads Clerk and the person's session before the dashboard renders. A signed-out visitor is sent
 * to the host app's sign-in and this never resolves, so no Warmbly screen ever shows without one.
 */
export async function bootHostSession(): Promise<void> {
    if (!PUBLISHABLE_KEY) {
        console.warn("[host session] VITE_CLERK_PUBLISHABLE_KEY is not set");
        return;
    }
    clerk = new Clerk(PUBLISHABLE_KEY);
    await clerk.load();
    if (!clerk.session) {
        window.location.replace(`${HOST_SIGN_IN_URL}?redirect_url=${encodeURIComponent(window.location.href)}`);
        await new Promise<never>(() => {});
    }
    await syncHostToken();
    timer ??= setInterval(() => void syncHostToken(), REFRESH_EVERY_MS);
}

/** Signs out of the host app, which ends the dashboard session with it. */
export async function signOutOfHost(): Promise<void> {
    if (timer) clearInterval(timer);
    timer = undefined;
    setToken(null);
    await clerk?.signOut();
    window.location.replace(HOST_SIGN_IN_URL);
}
