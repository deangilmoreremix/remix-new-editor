import { describe, expect, it } from "vitest";
import { handleDemoRequest } from "./server";

const get = (path: string, search = "") => handleDemoRequest({ method: "GET", path, search, body: undefined });
const send = (method: string, path: string, body?: unknown) => handleDemoRequest({ method, path, search: "", body });
const rows = (r: { body: unknown }) => ((r.body as { data?: unknown[] }).data ?? (r.body as unknown[])) as Array<Record<string, unknown>>;

describe("demo API server", () => {
    it("replays a recorded response", () => {
        const r = get("/v1/campaigns", "?limit=50");
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.body)).toContain("Sunrise Q3 launch outreach");
    });

    it("falls back to the same path with other query params", () => {
        expect(get("/v1/campaigns", "?limit=7&odd=1").status).toBe(200);
    });

    it("answers a view that was never recorded with a clear 404, not a crash", () => {
        const r = get("/v1/never/recorded");
        expect(r.status).toBe(404);
        expect((r.body as { code: string }).code).toBe("demo_not_recorded");
    });

    it("hands out a websocket ticket", () => {
        const r = get("/v1/ws/ticket");
        expect((r.body as { url: string }).url).toMatch(/^ws:/);
    });

    it("creates, updates and deletes through later reads", () => {
        const before = rows(get("/v1/campaigns", "?limit=50")).length;
        const created = send("POST", "/v1/campaigns", { name: "Demo created" }).body as { id: string };
        expect(created.id).toBeTruthy();
        const after = rows(get("/v1/campaigns", "?limit=50"));
        expect(after.length).toBe(before + 1);
        expect(after[0].name).toBe("Demo created");

        send("PATCH", `/v1/campaigns/${created.id}`, { name: "Renamed" });
        expect(rows(get("/v1/campaigns", "?limit=50")).find((c) => c.id === created.id)?.name).toBe("Renamed");

        send("DELETE", `/v1/campaigns/${created.id}`);
        expect(rows(get("/v1/campaigns", "?limit=50")).some((c) => c.id === created.id)).toBe(false);
    });

    it("start/pause actions flip the status shown in lists", () => {
        const id = String(rows(get("/v1/campaigns", "?limit=50"))[1].id);
        send("POST", `/v1/campaigns/${id}/pause`);
        expect(rows(get("/v1/campaigns", "?limit=50")).find((c) => c.id === id)?.status).toBe("paused");
        send("POST", `/v1/campaigns/${id}/start`);
        expect(rows(get("/v1/campaigns", "?limit=50")).find((c) => c.id === id)?.status).toBe("active");
    });

    it("a recorded POST (a search) is a read, not a create", () => {
        const a = handleDemoRequest({ method: "POST", path: "/v1/contacts/search", search: "", body: { query: "x" } });
        const b = handleDemoRequest({ method: "POST", path: "/v1/contacts/search", search: "", body: { query: "y" } });
        expect(a.status).toBe(200);
        expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
    });
});
