// In-browser stand-in for the Warmbly API: replays responses recorded from a seeded instance and applies edits in memory.
import fixtures from "./fixtures.json";

type Entry = { s: number; b: unknown };
const store = new Map<string, Entry>(Object.entries(fixtures as Record<string, Entry>).map(([k, v]) => [k, structuredClone(v)]));
const byPath = new Map<string, string[]>();
for (const key of store.keys()) {
    const [method, rest] = key.split(" ");
    const path = rest.split("?")[0];
    const id = `${method} ${path}`;
    byPath.set(id, [...(byPath.get(id) ?? []), key]);
}

export interface DemoRequest { method: string; path: string; search: string; body: unknown }
export interface DemoResponse { status: number; body: unknown }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const json = (status: number, body: unknown): DemoResponse => ({ status, body });
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`);

// Every array of id-bearing objects inside a body.
function lists(node: unknown, out: Record<string, unknown>[][] = []): Record<string, unknown>[][] {
    if (Array.isArray(node)) {
        if (node.some((x) => isObj(x) && "id" in x)) out.push(node as Record<string, unknown>[]);
        node.forEach((x) => lists(x, out));
    } else if (isObj(node)) Object.values(node).forEach((x) => lists(x, out));
    return out;
}
function objectsWithId(node: unknown, id: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
    if (Array.isArray(node)) node.forEach((x) => objectsWithId(x, id, out));
    else if (isObj(node)) { if (node.id === id) out.push(node); Object.values(node).forEach((x) => objectsWithId(x, id, out)); }
    return out;
}
function bump(body: unknown, by: number) {
    if (!isObj(body)) return;
    if (typeof body.total === "number") body.total += by;
    if (isObj(body.pagination) && typeof body.pagination.total === "number") body.pagination.total += by;
}

// How a detail response wraps its item (e.g. { automation: {...} }), learned from a recorded sibling; null when bare.
function envelopeKey(collection: string): string | null {
    for (const [key, e] of store) {
        const [method, rest] = key.split(" ");
        if (method !== "GET") continue;
        const path = rest.split("?")[0];
        if (!path.startsWith(`${collection}/`) || path.slice(collection.length + 1).includes("/")) continue;
        if (isObj(e.b)) {
            const keys = Object.keys(e.b);
            if (keys.length === 1 && isObj(e.b[keys[0]]) && "id" in (e.b[keys[0]] as object)) return keys[0];
            if ("id" in e.b) return null;
        }
    }
    return null;
}

const looksLikeId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^[0-9a-z_-]{6,}$/i.test(s) && /\d/.test(s);

function mutate(method: string, path: string, body: unknown): DemoResponse {
    const parts = path.split("/").filter(Boolean); // v1, collection, id?, action?
    const payload = isObj(body) ? body : {};
    const idIndex = parts.findIndex((p, i) => i >= 2 && looksLikeId(p));
    const id = idIndex > 0 ? parts[idIndex] : undefined;
    const tail = idIndex > 0 ? parts.slice(idIndex + 1) : [];
    const collection = "/" + parts.slice(0, idIndex > 0 ? idIndex : parts.length).join("/");

    if (method === "DELETE" && id && tail.length === 0) {
        for (const e of store.values()) for (const l of lists(e.b)) { const i = l.findIndex((x) => x.id === id); if (i >= 0) { l.splice(i, 1); bump(e.b, -1); } }
        return json(200, { success: true });
    }
    if ((method === "PATCH" || method === "PUT") && id && tail.length === 0) {
        let last: Record<string, unknown> | undefined;
        for (const e of store.values()) for (const o of objectsWithId(e.b, id)) { Object.assign(o, payload, { updated_at: new Date().toISOString() }); last = o; }
        return json(200, last ?? { id, ...payload });
    }
    if (method === "POST" && id && tail.length > 0) {
        const action = tail[tail.length - 1];
        const status = ({ start: "active", resume: "active", pause: "paused", stop: "stopped", archive: "archived", complete: "completed" } as Record<string, string>)[action];
        if (status) for (const e of store.values()) for (const o of objectsWithId(e.b, id)) o.status = status;
        return json(200, { success: true, id, status });
    }
    if (method === "POST" && !id) {
        const created = { id: uuid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
        for (const [key, e] of store) {
            const p = key.split(" ")[1].split("?")[0];
            if (p === collection || p === `${collection}/search`) {
                const l = lists(e.b)[0] ?? (isObj(e.b) && Array.isArray(e.b.data) ? (e.b.data as Record<string, unknown>[]) : undefined);
                if (l) { l.unshift(created); bump(e.b, 1); }
            }
        }
        const key = envelopeKey(collection);
        const wrapped = key ? { [key]: created } : created;
        // Make the new item's own page openable.
        store.set(`GET ${collection}/${created.id}`, { s: 200, b: wrapped });
        return json(201, wrapped);
    }
    return json(200, { success: true, ...payload });
}

export function handleDemoRequest(req: DemoRequest): DemoResponse {
    const method = req.method.toUpperCase();
    const exact = `${method} ${req.path}${req.search}`;
    const hit = store.get(exact) ?? (() => { const keys = byPath.get(`${method} ${req.path}`); return keys ? store.get(keys[0]) : undefined; })();
    // A recorded POST is a read (search endpoints); replay it.
    if (hit) return json(hit.s, hit.b);
    if (method === "GET" || method === "HEAD") {
        if (req.path.endsWith("/ws/ticket") || req.path.includes("/ticket")) return json(200, { url: "ws://demo.invalid/socket/websocket?token=demo", expires_at: new Date(Date.now() + 600_000).toISOString() });
        console.warn("[demo] no recorded response for", exact);
        return json(404, { error: "Not Found", message: "This view has no recorded demo data yet.", code: "demo_not_recorded" });
    }
    return mutate(method, req.path, req.body);
}
