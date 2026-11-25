import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import getToken from "./helper/getToken";
import exchangeClerk from "./api/client/auth/exchangeClerk";
import { bootHostSession, isHostSessionExempt, showHostSessionFailure, signOutOfHost, syncHostToken } from "./hostSession";

vi.mock("./api/client/auth/exchangeClerk", () => ({ default: vi.fn() }));

const later = (ms: number) => new Date(Date.now() + ms);
const warmblySession = () => ({
    access_token: "warmbly-access",
    access_token_expires_at: later(60_000),
    refresh_token: "warmbly-refresh",
    refresh_token_expires_at: later(86_400_000),
});

// The same window the module reads: the top one when embedded, else this one.
const host = () => (window.top && window.top !== window ? window.top : window) as unknown as { Clerk?: unknown };
type Listener = (r: { session: unknown | null }) => void;
const clerk = (session: unknown) => {
    const c = { loaded: true, session, signOut: vi.fn(), listeners: [] as Listener[], addListener: vi.fn((cb: Listener) => (c.listeners.push(cb), () => {})) };
    host().Clerk = c;
    return c;
};
const signedIn = () => ({ getToken: async () => "clerk-jwt" });

describe("host session (one login)", () => {
    beforeEach(() => {
        // setupTests stubs localStorage with bare mocks; give them a real store.
        const store = new Map<string, string>();
        vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
        vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
        vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
        vi.mocked(localStorage).key = vi.fn((i: number) => [...store.keys()][i] ?? null);
        Object.defineProperty(localStorage, "length", { configurable: true, get: () => store.size });
        delete host().Clerk;
        vi.mocked(exchangeClerk).mockReset();
    });

    it("exchanges the host Clerk token for a Warmbly session", async () => {
        clerk(signedIn());
        vi.mocked(exchangeClerk).mockResolvedValue(warmblySession());
        const t = await syncHostToken();
        expect(exchangeClerk).toHaveBeenCalledWith("clerk-jwt");
        expect(t?.access_token).toBe("warmbly-access");
        expect(getToken()?.access_token).toBe("warmbly-access");
    });

    it("clears the token and asks for nothing when the host is signed out", async () => {
        clerk(signedIn());
        vi.mocked(exchangeClerk).mockResolvedValue(warmblySession());
        await syncHostToken();
        clerk(null);
        expect(await syncHostToken()).toBeNull();
        expect(getToken()).toBeNull();
        expect(exchangeClerk).toHaveBeenCalledTimes(1);
    });

    it("refuses an account that would need a second sign-in step", async () => {
        clerk(signedIn());
        vi.mocked(exchangeClerk).mockResolvedValue({ two_fa_required: true, pending_token: "p" });
        await expect(syncHostToken()).rejects.toThrow(/extra sign-in steps/);
        expect(getToken()).toBeNull();
    });

    it("boots with one exchange and no sign-in screen when the host is signed in", async () => {
        const c = clerk(signedIn());
        vi.mocked(exchangeClerk).mockResolvedValue(warmblySession());
        await expect(bootHostSession()).resolves.toBeUndefined();
        expect(exchangeClerk).toHaveBeenCalledTimes(1);
        expect(c.addListener).toHaveBeenCalled();
        expect(getToken()).not.toBeNull();
    });

    it("ends the session when the host signs out elsewhere", async () => {
        const c = clerk(signedIn());
        vi.mocked(exchangeClerk).mockResolvedValue(warmblySession());
        await bootHostSession();
        c.listeners.forEach((cb) => cb({ session: null }));
        expect(getToken()).toBeNull();
    });

    it("signs out of the host, not of a Warmbly account", async () => {
        const c = clerk(signedIn());
        await signOutOfHost().catch(() => {});
        expect(c.signOut).toHaveBeenCalled();
        expect(getToken()).toBeNull();
    });

    it("shows a message with a retry button, not a blank page, when the session cannot be taken", () => {
        document.body.innerHTML = '<div id="root"></div>';
        vi.spyOn(console, "error").mockImplementation(() => {});
        showHostSessionFailure(new Error("boom"));
        const root = document.getElementById("root")!;
        expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/couldn't connect you/);
        expect(root.querySelector("button")?.textContent).toBe("Try again");
        expect(root.classList.contains("app-ready")).toBe(true); // visible, not left at opacity 0
    });

    it("leaves the provider pop-up landing pages alone (they have no host app to read a session from)", () => {
        for (const p of ["/smartwarmupai-app/oauth-return", "/smartwarmupai-app/cloud-oauth/done", "/smartwarmupai-app/reauth/complete/"]) {
            expect(isHostSessionExempt(p)).toBe(true);
        }
        for (const p of ["/smartwarmupai-app/app/emails", "/smartwarmupai-app/oauth/authorize", "/smartwarmupai-app/auth/login"]) {
            expect(isHostSessionExempt(p)).toBe(false);
        }
    });

    describe("when the backend is waking from idle", () => {
        afterEach(() => vi.useRealTimers());

        it("while starting up, asks again after a gateway timeout instead of failing, and says it is starting", async () => {
            vi.useFakeTimers();
            document.body.innerHTML = '<div id="root"></div>';
            clerk(signedIn());
            vi.mocked(exchangeClerk)
                .mockRejectedValueOnce({ error: "Gateway Timeout", message: "x", status: 504 })
                .mockRejectedValueOnce({ error: "Network Error", message: "x" })
                .mockResolvedValue(warmblySession());
            const done = bootHostSession(); // startup: nothing is mounted yet, so the screen is safe to show
            await vi.advanceTimersByTimeAsync(4_000);
            expect(document.getElementById("root")?.textContent).toMatch(/Starting SmartWarmupAI/);
            await vi.advanceTimersByTimeAsync(8_000);
            await expect(done).resolves.toBeUndefined();
            expect(exchangeClerk).toHaveBeenCalledTimes(3);
        });

        it("stays silent on a refresh while the dashboard is already running, so it is never wiped", async () => {
            vi.useFakeTimers();
            document.body.innerHTML = '<div id="root"><main id="app">running dashboard</main></div>';
            clerk(signedIn());
            vi.mocked(exchangeClerk)
                .mockRejectedValueOnce({ error: "Gateway Timeout", message: "x", status: 504 })
                .mockResolvedValue(warmblySession());
            const done = syncHostToken(); // a refresh: bootHostSession is not running
            await vi.advanceTimersByTimeAsync(4_000);
            expect(document.getElementById("app")?.textContent).toBe("running dashboard");
            await expect(done).resolves.toMatchObject({ access_token: "warmbly-access" });
        });

        it("reads a fresh host token for every attempt, since a Clerk token lives about a minute", async () => {
            vi.useFakeTimers();
            let n = 0;
            clerk({ getToken: async () => `jwt-${++n}` });
            vi.mocked(exchangeClerk)
                .mockRejectedValueOnce({ error: "Gateway Timeout", message: "x", status: 504 })
                .mockResolvedValue(warmblySession());
            const done = syncHostToken();
            await vi.advanceTimersByTimeAsync(4_000);
            await done;
            expect(vi.mocked(exchangeClerk).mock.calls.map((c) => c[0])).toEqual(["jwt-1", "jwt-2"]);
        });

        it("stops quietly if the person signs out of the host while the backend is waking", async () => {
            vi.useFakeTimers();
            const c = clerk({ getToken: async () => "jwt" });
            vi.mocked(exchangeClerk).mockRejectedValue({ error: "Gateway Timeout", message: "x", status: 504 });
            const done = syncHostToken();
            await vi.advanceTimersByTimeAsync(1);
            (c as { session: unknown }).session = null;
            await vi.advanceTimersByTimeAsync(4_000);
            await expect(done).resolves.toBeNull();
            expect(exchangeClerk).toHaveBeenCalledTimes(1);
        });

        it("does not retry a refusal", async () => {
            clerk(signedIn());
            vi.mocked(exchangeClerk).mockRejectedValue({ error: "Bad Request", message: "x", status: 400 });
            await expect(syncHostToken()).rejects.toMatchObject({ status: 400 });
            expect(exchangeClerk).toHaveBeenCalledTimes(1);
        });

        it("gives up after the last retry", async () => {
            vi.useFakeTimers();
            clerk(signedIn());
            vi.mocked(exchangeClerk).mockRejectedValue({ error: "Gateway Timeout", message: "x", status: 504 });
            const done = syncHostToken().catch((e) => e);
            await vi.advanceTimersByTimeAsync(30_000);
            await expect(done).resolves.toMatchObject({ status: 504 });
            expect(exchangeClerk).toHaveBeenCalledTimes(4);
        });
    });
});
