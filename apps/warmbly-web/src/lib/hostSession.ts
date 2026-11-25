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
import type { LoginResult } from "./api/models/auth/LoginResult";

export const HOST_SIGN_IN_URL = (import.meta.env.VITE_HOST_SIGN_IN_URL as string | undefined) || "/signin";
const WAIT_FOR_CLERK_MS = 10_000;

type HostClerk = {
    loaded?: boolean;
    session?: { getToken: () => Promise<string | null> } | null;
    signOut: () => Promise<void>;
    addListener?: (cb: (resources: { session?: unknown | null }) => void) => () => void;
};

let unlisten: (() => void) | undefined;
// The waiting screen replaces #root, which is only safe before the app has mounted. After that (a token refresh
// while the person is using the dashboard) a retry stays silent.
let booting = false;

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
// The backend scales to zero when idle and takes a while to wake, so the first sign-in after a quiet
// spell can be answered with a gateway timeout. That is not a refusal: wait for it and ask again.
const WAKE_RETRY_DELAYS_MS = [4_000, 8_000, 12_000];
const isStillWaking = (err: unknown) => {
    const status = (err as { status?: number } | null)?.status;
    return status === undefined || status >= 500;
};

async function exchangeWhenAwake(jwt: string): Promise<LoginResult> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await exchangeClerk(jwt);
        } catch (err) {
            if (attempt >= WAKE_RETRY_DELAYS_MS.length || !isStillWaking(err)) throw err;
            if (attempt === 0 && booting) showHostSessionWaiting();
            await new Promise((resolve) => setTimeout(resolve, WAKE_RETRY_DELAYS_MS[attempt]));
        }
    }
}

export async function syncHostToken(): Promise<Token | null> {
    const jwt = await hostClerk()?.session?.getToken();
    if (!jwt) {
        clearTokens();
        return null;
    }
    const res = await exchangeWhenAwake(jwt);
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
    booting = true;
    try {
        const clerk = await clerkReady();
        if (!clerk?.session) await toHostSignIn();
        await syncHostToken();
        listenForHostSignOut(clerk);
    } finally {
        booting = false;
    }
}

function listenForHostSignOut(clerk: HostClerk | undefined): void {
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

/**
 * Shown when the host session could not be turned into a dashboard session (the backend is asleep or
 * unreachable, or this account needs a step the dashboard has no screen for). It does not send the
 * person back to the host sign-in: they are signed in there, so that would loop.
 */
export function showHostSessionFailure(err: unknown): void {
    console.error("[host session]", err);
    const root = document.getElementById("root") ?? document.body;
    root.replaceChildren();
    root.classList.add("app-ready"); // the page keeps #root invisible until the app is ready, which never comes here
    const box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText = "font:14px system-ui,sans-serif;max-width:28rem;margin:20vh auto;padding:0 1rem;text-align:center";
    const msg = document.createElement("p");
    msg.textContent = "We couldn't connect you to SmartWarmupAI. The service may be starting up. Please try again in a moment.";
    const retry = document.createElement("button");
    retry.textContent = "Try again";
    retry.style.cssText = "margin-top:.75rem;padding:.5rem 1rem;cursor:pointer";
    retry.onclick = () => window.location.reload();
    box.append(msg, retry);
    root.append(box);
}

/**
 * Provider pop-ups (mailbox connection, "confirm it is you") land on pages that only hand their result to the
 * dashboard tab that opened them and close. Such a window has no host app around it to read a session from, so
 * it must not wait for one or be sent to the sign-in page.
 */
export function isHostSessionExempt(pathname: string): boolean {
    return /\/(oauth-return|cloud-oauth\/done|reauth\/complete)\/?$/.test(pathname);
}

/** Shown while the backend wakes from idle; the app replaces it when it mounts. */
export function showHostSessionWaiting(): void {
    const root = document.getElementById("root") ?? document.body;
    root.replaceChildren();
    root.classList.add("app-ready"); // the page keeps #root invisible until the app is ready
    const box = document.createElement("div");
    box.setAttribute("role", "status");
    box.style.cssText = "font:14px system-ui,sans-serif;max-width:28rem;margin:20vh auto;padding:0 1rem;text-align:center";
    box.textContent = "Starting SmartWarmupAI… this can take up to a minute after a quiet period.";
    root.append(box);
}
