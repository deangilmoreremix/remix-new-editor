import { beforeEach, describe, expect, it, vi } from "vitest";

import getToken from "./helper/getToken";
import { bootHostSession, signOutOfHost, syncHostToken } from "./hostSession";

const jwt = (exp: number) => `h.${btoa(JSON.stringify({ exp })).replace(/=/g, "")}.s`;
// The same window the module reads: the top one when embedded, else this one.
const host = () => (window.top && window.top !== window ? window.top : window) as unknown as { Clerk?: unknown };
const clerk = (session: unknown) => (host().Clerk = { loaded: true, session, signOut: vi.fn() });

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
    });

    it("turns the host Clerk session into the dashboard token", async () => {
        const exp = Math.floor(Date.now() / 1000) + 600;
        clerk({ getToken: async () => jwt(exp) });
        const t = await syncHostToken();
        expect(t?.access_token).toBe(jwt(exp));
        expect(t?.access_token_expires_at.getTime()).toBe(exp * 1000);
        expect(getToken()?.access_token).toBe(jwt(exp));
    });

    it("clears the token when the host session is gone", async () => {
        clerk({ getToken: async () => jwt(Math.floor(Date.now() / 1000) + 600) });
        await syncHostToken();
        clerk(null);
        expect(await syncHostToken()).toBeNull();
        expect(getToken()).toBeNull();
    });

    it("boots without any sign-in screen when the host is signed in", async () => {
        clerk({ getToken: async () => jwt(Math.floor(Date.now() / 1000) + 600) });
        await expect(bootHostSession()).resolves.toBeUndefined();
        expect(getToken()).not.toBeNull();
    });

    it("signs out of the host, not of a Warmbly account", async () => {
        const c = clerk({ getToken: async () => jwt(Math.floor(Date.now() / 1000) + 600) });
        await signOutOfHost().catch(() => {});
        expect((c as { signOut: unknown }).signOut).toHaveBeenCalled();
        expect(getToken()).toBeNull();
    });
});
