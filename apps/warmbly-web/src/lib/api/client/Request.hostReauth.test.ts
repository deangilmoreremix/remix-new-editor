import { beforeEach, describe, expect, it, vi } from "vitest";

// One login: with the host session on, a "confirm it is you" demand is met by taking the host session again.
vi.mock("@/lib/information", async (orig) => ({ ...(await orig<object>()), HOST_SESSION: true }));
vi.mock("./auth/refreshToken", () => ({ default: vi.fn() }));
vi.mock("./Client", () => ({ default: { request: vi.fn() } }));
vi.mock("@/lib/helper/getToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/reauthPrompt", () => ({ askForReauth: vi.fn() }));

import Client from "./Client";
import Request from "./Request";
import getToken from "@/lib/helper/getToken";
import refreshTokenFn from "./auth/refreshToken";
import { askForReauth } from "@/lib/reauthPrompt";

// The client's interceptor has already turned the HTTP error into this shape by the time Request sees it.
const reauthRequired = () => ({ error: "Forbidden", message: "Confirm it is you.", status: 403, code: "reauth_required" });

describe("a change that needs a fresher proof of identity, on the host session", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getToken).mockReturnValue({
            access_token: "old",
            access_token_expires_at: new Date(Date.now() + 60_000),
            refresh_token: "r",
            refresh_token_expires_at: new Date(Date.now() + 120_000),
        });
    });

    it("takes the host session again instead of opening a dialog, then retries once with the new token", async () => {
        vi.mocked(Client.request).mockRejectedValueOnce(reauthRequired()).mockResolvedValueOnce({ data: { ok: true } });
        vi.mocked(refreshTokenFn).mockResolvedValue({
            access_token: "fresh",
            access_token_expires_at: new Date(Date.now() + 60_000),
            refresh_token: "r2",
            refresh_token_expires_at: new Date(Date.now() + 120_000),
        });

        const out = await Request({ method: "POST", url: "/api-keys", authorization: true });

        expect(out).toEqual({ ok: true });
        expect(askForReauth).not.toHaveBeenCalled();
        expect(refreshTokenFn).toHaveBeenCalledTimes(1);
        expect(Client.request).toHaveBeenCalledTimes(2);
        expect(vi.mocked(Client.request).mock.calls[1][0].headers).toMatchObject({ Authorization: "Bearer fresh" });
    });

    it("gives up after one retry if the server still wants more", async () => {
        vi.mocked(Client.request).mockRejectedValue(reauthRequired());
        vi.mocked(refreshTokenFn).mockResolvedValue({
            access_token: "fresh",
            access_token_expires_at: new Date(Date.now() + 60_000),
            refresh_token: "r2",
            refresh_token_expires_at: new Date(Date.now() + 120_000),
        });
        await expect(Request({ method: "POST", url: "/api-keys", authorization: true })).rejects.toBeTruthy();
        expect(Client.request).toHaveBeenCalledTimes(2);
    });
});
