import { handleDemoRequest } from "./server";
import { DemoSocket } from "./fakeSocket";
import { saveTokens } from "@/lib/auth";
import getToken from "@/lib/helper/getToken";

// Routes every API call to the in-browser server. Axios runs on fetch (see Client), so one hook covers every call.
export function installDemo(): void {
    if (!getToken()) {
        const exp = new Date(Date.now() + 365 * 86_400_000);
        saveTokens({ access_token: "demo-access", access_token_expires_at: exp, refresh_token: "demo-refresh", refresh_token_expires_at: exp });
    }
    const real = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const req = input instanceof Request ? input : null;
        const url = new URL(req?.url ?? String(input), window.location.href);
        if (!url.pathname.startsWith("/v1/")) return real(input, init);
        const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
        let body: unknown;
        const raw = init?.body ?? (req ? await req.clone().text() : undefined);
        if (typeof raw === "string" && raw) { try { body = JSON.parse(raw); } catch { body = raw; } }
        await new Promise((r) => setTimeout(r, 40));
        const out = handleDemoRequest({ method, path: url.pathname, search: url.search, body });
        return new Response(out.status === 204 ? null : JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json" } });
    };
    (window as unknown as { WebSocket: unknown }).WebSocket = DemoSocket;
}
