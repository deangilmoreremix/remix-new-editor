import { beforeEach, describe, expect, it, vi } from "vitest";

import getToken from "./helper/getToken";
import exchangeClerk from "./api/client/auth/exchangeClerk";
import { bootHostSession, showHostSessionFailure, signOutOfHost, syncHostToken } from "./hostSession";

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
    });
});
