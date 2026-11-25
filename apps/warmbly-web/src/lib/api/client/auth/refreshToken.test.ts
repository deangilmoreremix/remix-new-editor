import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/information", () => ({ HOST_SESSION: true }));
vi.mock("@/lib/hostSession", () => ({ syncHostToken: vi.fn() }));
vi.mock("../app/organizations/switchOrganization", () => ({ default: vi.fn() }));
vi.mock("../Request", () => ({ default: vi.fn() }));

import refreshToken from "./refreshToken";
import { syncHostToken } from "@/lib/hostSession";
import switchOrganization from "../app/organizations/switchOrganization";
import { useAppStore } from "@/stores/useAppStore";

const token = { access_token: "a", access_token_expires_at: new Date(), refresh_token: "r", refresh_token_expires_at: new Date() };

describe("refreshing a host session", () => {
    beforeEach(() => {
        vi.mocked(syncHostToken).mockReset();
        vi.mocked(switchOrganization).mockReset().mockResolvedValue(undefined);
        useAppStore.setState({ currentOrganization: null });
    });

    it("puts the selected workspace back on the new session", async () => {
        vi.mocked(syncHostToken).mockResolvedValue(token);
        useAppStore.setState({ currentOrganization: { id: "org-2" } as never });
        await expect(refreshToken("ignored")).resolves.toBe(token);
        expect(switchOrganization).toHaveBeenCalledWith("org-2");
    });

    it("does not switch when no workspace was selected", async () => {
        vi.mocked(syncHostToken).mockResolvedValue(token);
        await refreshToken("ignored");
        expect(switchOrganization).not.toHaveBeenCalled();
    });

    it("fails when the host is signed out", async () => {
        vi.mocked(syncHostToken).mockResolvedValue(null);
        await expect(refreshToken("ignored")).rejects.toThrow(/host session ended/);
    });
});
