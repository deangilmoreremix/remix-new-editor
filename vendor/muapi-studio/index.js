import { jsx as a, jsxs as u, Fragment as Ve } from "react/jsx-runtime";
import { createContext as lt, useContext as ct, useState as A, useRef as j, useEffect as U, useCallback as ee, useMemo as ae, createElement as ur, useId as mr, useLayoutEffect as pr } from "react";
function hr(e, t, r = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : r);
}
function fr(e) {
  const t = Number(e);
  return e && Number.isFinite(t) && t >= 0 ? Math.min(t, 120) * 1e3 : void 0;
}
class ye extends Error {
  constructor(t, r, n) {
    super(t), this.status = r, this.retryAfterMs = n;
  }
}
function dt(e) {
  if (!e) return;
  if (typeof e == "string") return e;
  const t = e.message ?? e.detail;
  if (typeof t == "string") return t;
  try {
    return JSON.stringify(e);
  } catch {
    return "Generation failed";
  }
}
function gr(e, t) {
  var n;
  const r = e == null ? void 0 : e.detail;
  return ((n = r == null ? void 0 : r.error) == null ? void 0 : n.message) || (typeof r == "string" ? r : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class br {
  constructor(t = "/api/muapi", r, n = {}) {
    this.base = t, this.teamId = r, this.opts = n;
  }
  async request(t, r = {}) {
    var p, y, h, k;
    const n = new Headers(r.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [I, g] of Object.entries(await this.opts.getHeaders())) n.set(I, g);
    const o = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...r, headers: n }), i = await o.text();
    let s = null;
    try {
      s = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!o.ok && hr(o.status, s, i) && !t.startsWith("/app/") && ((y = (p = this.opts).onKeyRejected) == null || y.call(p)), !o.ok) throw new ye(gr(s, `${o.status} ${o.statusText}`), o.status, fr((k = (h = o.headers) == null ? void 0 : h.get) == null ? void 0 : k.call(h, "retry-after")));
    if (s === null && i.trim()) throw new ye("Unexpected non-JSON response from the server", 502);
    return s;
  }
  withTeam(t) {
    return this.teamId ? t + (t.includes("?") ? "&" : "?") + "team_id=" + encodeURIComponent(this.teamId) : t;
  }
  models() {
    return this.catalog ?? (this.catalog = this.request("/api/v1/models").then((t) => t.models).catch((t) => {
      throw this.catalog = void 0, t;
    })), this.catalog;
  }
  model(t) {
    return this.request(`/api/v1/models/${encodeURIComponent(t)}`);
  }
  estimate(t, r) {
    return this.request(`/api/v1/models/${encodeURIComponent(t)}/estimate-cost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(r)
    });
  }
  /** Submit with the model's `endpoint_url` (the catalog's `endpoint` field can be wrong). */
  async submit(t, r, n) {
    var s;
    const o = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(r)
    }), i = o.request_id || o.id;
    if (!i) throw new ye("The API did not return a request id", 502);
    return { requestId: i, cost: (s = o.cost) == null ? void 0 : s.amount_usd };
  }
  async poll(t, r) {
    var p;
    const n = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`, r ? { signal: r } : {}), o = String(n.status || "").toLowerCase(), i = ["completed", "succeeded", "success"].includes(o) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(o) ? "failed" : o === "pending" ? "pending" : "processing", s = Array.isArray(n.outputs) ? n.outputs : n.url ? [n.url] : [];
    return { status: i, outputs: s, error: dt(n.error), cost: (p = n.cost) == null ? void 0 : p.amount_usd };
  }
  /** muapi's server-side generation history (works with an API key), newest first. */
  history(t, r = 30) {
    const n = new URLSearchParams({ limit: String(r) });
    return t && n.set("cursor", t), this.request(`/api/v1/history?${n}`);
  }
  mediaLibrary(t = {}) {
    const r = new URLSearchParams({ page: String(t.page ?? 1), page_size: String(t.pageSize ?? 24) });
    return t.mediaType && t.mediaType !== "all" && r.set("media_type", t.mediaType), t.search && r.set("search", t.search), this.request(`/app/media-library?${r}`);
  }
  saveToLibrary(t) {
    return this.request("/app/media-library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) });
  }
  deleteFromLibrary(t) {
    return this.request(`/app/media-library/${t}`, { method: "DELETE" });
  }
  /** Removes the generated files on muapi's side (the history row is kept unless deleteRecord is true). */
  deleteMedia(t, r = !1) {
    return this.request(`/api/v1/predictions/${encodeURIComponent(t)}/media${r ? "?delete_record=true" : ""}`, { method: "DELETE" });
  }
  /** Which optional features the host's proxy supports. A 403/404/405 means the route is not forwarded, so the UI hides it. */
  async probe() {
    const t = (n) => n instanceof ye && [403, 404, 405].includes(n.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((n) => !t(n)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var i;
    const r = new FormData();
    r.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: r }), o = n.url || n.file_url || ((i = n.data) == null ? void 0 : i.url);
    if (!o) throw new ye("Upload returned no URL", 502);
    return o;
  }
}
const yr = (e) => Math.min(Math.round(e * 1.15), 6e3), xr = 3e4, vr = (e, t) => new Promise((r) => {
  const n = setTimeout(o, e);
  function o() {
    clearTimeout(n), t == null || t.removeEventListener("abort", o), r();
  }
  t == null || t.addEventListener("abort", o);
});
async function kt(e, t, r = {}) {
  const { intervalMs: n = 2e3, timeoutMs: o = 15 * 60 * 1e3, signal: i, onUpdate: s } = r, p = Date.now();
  let y = 0, h = n;
  for (; Date.now() - p < o; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    let k = h;
    const I = new AbortController(), g = () => I.abort();
    i == null || i.addEventListener("abort", g);
    const f = setTimeout(() => I.abort(), Math.max(o - (Date.now() - p), 0));
    try {
      const w = await e.poll(t, I.signal);
      if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
      if (y = 0, s == null || s(w), w.status === "completed" || w.status === "failed") return w;
      h = yr(h), k = h;
    } catch (w) {
      if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
      if (I.signal.aborted) break;
      if (w instanceof ye && w.status === 429) k = w.retryAfterMs ?? xr;
      else if (++y >= 5) throw w;
    } finally {
      clearTimeout(f), i == null || i.removeEventListener("abort", g);
    }
    await vr(k, i);
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Bt = lt({ library: !0, deleteMedia: !0 }), zt = () => ct(Bt), Xe = {
  bgApp: "#050505",
  bgPanel: "#0a0a0a",
  bgCard: "#141414",
  primary: "#d9ff00",
  primaryHover: "#c4e600",
  primarySoft: "rgba(217, 255, 0, 0.12)",
  primaryGlow: "rgba(217, 255, 0, 0.4)",
  primaryInk: "#050505",
  accent: "#c4e600",
  fg: "#fafafa",
  secondary: "#a1a1aa",
  muted: "#52525b",
  line: "#27272a",
  danger: "#f87171",
  radiusInput: "0.75rem",
  radiusButton: "0.75rem",
  radiusCard: "1rem",
  font: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  buttonStyle: "outline"
}, wr = {
  bgApp: "#030303",
  bgPanel: "#0a0a0a",
  bgCard: "#111111",
  primary: "#22d3ee",
  primaryHover: "#06b6d4",
  primarySoft: "rgba(34, 211, 238, 0.12)",
  primaryGlow: "rgba(34, 211, 238, 0.4)",
  primaryInk: "#031014",
  accent: "#a855f7",
  fg: "#fafafa",
  secondary: "#a1a1aa",
  muted: "#52525b",
  line: "rgba(255, 255, 255, 0.08)",
  danger: "#f87171",
  radiusInput: "0.75rem",
  radiusButton: "9999px",
  radiusCard: "1rem",
  font: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  buttonStyle: "solid"
}, kr = { lime: Xe, cyan: wr }, Nt = {
  bgApp: "--ms-bg-app",
  bgPanel: "--ms-bg-panel",
  bgCard: "--ms-bg-card",
  primary: "--ms-primary",
  primaryHover: "--ms-primary-hover",
  primarySoft: "--ms-primary-soft",
  primaryGlow: "--ms-primary-glow",
  primaryInk: "--ms-primary-ink",
  accent: "--ms-accent",
  fg: "--ms-fg",
  secondary: "--ms-secondary",
  muted: "--ms-muted",
  line: "--ms-line",
  danger: "--ms-danger",
  radiusInput: "--ms-r-input",
  radiusButton: "--ms-r-btn",
  radiusCard: "--ms-r-card",
  font: "--ms-font"
};
function Ht(e = "lime") {
  return typeof e == "string" ? kr[e] ?? Xe : { ...Xe, ...e };
}
function Nr(e = "lime") {
  const t = Ht(e), r = {};
  for (const n of Object.keys(Nt)) r[Nt[n]] = t[n];
  return r;
}
function Sr(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const Cr = (e = "lime") => Ht(e).buttonStyle, we = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], Ar = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function ut(e) {
  switch (e) {
    case "Text to Image":
    case "Lora Support":
      return "image";
    case "Image to Image":
      return "i2i";
    case "Text to Video":
      return "video";
    case "Image to Video":
      return "i2v";
    case "Video to Video":
      return "v2v";
    case "Text to Audio":
      return "audio";
    case "Audio to Video":
      return "lipsync";
    case "Text to Text":
      return "text";
    case "Training":
      return "train";
    default:
      return "tool";
  }
}
const Ir = (e) => !!e && we.some((t) => t.id === e);
function Mr(e, t) {
  const r = we.find((n) => n.id === t).groups;
  return e.filter((n) => r.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const Er = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Jt(e, t, r = {}) {
  const n = (i) => {
    var s;
    return ((s = i.sale) == null ? void 0 : s.from) ?? i.cost ?? 1 / 0;
  }, o = [...e];
  return t === "a-z" ? o.sort((i, s) => i.name.localeCompare(s.name)) : t === "price-asc" ? o.sort((i, s) => n(i) - n(s)) : t === "price-desc" ? o.sort((i, s) => n(s) - n(i)) : t === "most-used" ? o.filter((i) => {
    var s;
    return (((s = r.usage) == null ? void 0 : s[i.name]) ?? 0) > 0;
  }).sort((i, s) => (r.usage[s.name] ?? 0) - (r.usage[i.name] ?? 0)) : t === "favourites" ? o.filter((i) => {
    var s;
    return (s = r.favorites) == null ? void 0 : s.includes(i.name);
  }) : o.sort((i, s) => +!!s.sale - +!!i.sale);
}
const Tr = { completed: "completed", succeeded: "completed", success: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function $r(e, t) {
  var n, o;
  const r = (n = t.find((i) => i.name === e)) == null ? void 0 : n.group_of;
  return ((o = we.find((i) => r && i.groups.includes(r))) == null ? void 0 : o.id) ?? "ai-tools";
}
function Lr(e, t, r = {}) {
  var i;
  const n = e.output ?? {}, o = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: $r(e.model, t),
    prompt: typeof o.prompt == "string" ? o.prompt : "",
    inputs: o,
    status: Tr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: dt(n.error),
    cost: (i = n.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: r[e.request_id] ?? null,
    source: "server"
  };
}
function _r(e, t, r = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((p) => p.requestId).map((p) => [p.requestId, p])), o = new Set(e.map((p) => p.requestId).filter(Boolean));
  return [...e.map((p) => {
    const y = p.requestId ? n.get(p.requestId) : void 0;
    return p.status === "failed" && y && y.status === "completed" && y.outputs.length ? { ...p, status: y.status, outputs: y.outputs, error: void 0, cost: p.cost ?? y.cost } : p;
  }), ...t.filter((p) => !p.requestId || !o.has(p.requestId))].filter((p) => !(p.requestId && r.has(p.requestId))).sort((p, y) => y.createdAt - p.createdAt);
}
function Dr(e) {
  const t = {};
  for (const r of e) t[r.model] = (t[r.model] ?? 0) + 1;
  return t;
}
function ce(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function ve(e, t) {
  var r;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((r = e.sale) == null ? void 0 : r.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Wt = "muapi-studio:history:v1", Rr = 200, Ce = (e, t) => t ? `${e}:${t}` : e;
function Gr(e) {
  if (!e) return "";
  let t = 2166136261, r = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, r = Math.imul(r ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${r.toString(36)}`;
}
function ze(e = "") {
  try {
    const t = localStorage.getItem(Ce(Wt, e));
    return (t ? JSON.parse(t) : []).map((n) => n.error !== void 0 && typeof n.error != "string" ? { ...n, error: dt(n.error) } : n);
  } catch {
    return [];
  }
}
function Or(e, t = "") {
  try {
    localStorage.setItem(Ce(Wt, t), JSON.stringify(e.slice(0, Rr)));
  } catch {
  }
}
const jr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, St = (e, t) => {
  try {
    const r = localStorage.getItem(e);
    return r ? JSON.parse(r) : t;
  } catch {
    return t;
  }
}, Ct = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, At = "muapi-studio:labels:v1", It = "muapi-studio:hidden:v1";
function Pr(e, t, r, n = "", o = !0) {
  const [i, s] = A(() => ze(n)), [p, y] = A([]), [h, k] = A(null), [I, g] = A(!1), [f, w] = A(null), R = j(!1), [S, D] = A(() => St(Ce(At, n), {})), [b, v] = A(() => St(Ce(It, n), [])), x = j(/* @__PURE__ */ new Set()), N = j(!1), P = j(new AbortController()), T = j([]);
  T.current = t ?? [], U(() => Or(i, n), [i, n]), U(() => Ct(Ce(At, n), S), [S, n]), U(() => Ct(Ce(It, n), b), [b, n]), U(() => (P.current = new AbortController(), () => {
    P.current.abort(), x.current.clear(), N.current = !1;
  }), []);
  const $ = ee((c, l) => s((C) => C.map((G) => G.id === c ? { ...G, ...l } : G)), []), E = ee(async (c, l) => {
    if (!x.current.has(c)) {
      x.current.add(c);
      try {
        const C = await kt(e, l, {
          signal: P.current.signal,
          onUpdate: (G) => $(c, { status: G.status, outputs: G.outputs, error: G.error, cost: G.cost })
        });
        $(c, { status: C.status, outputs: C.outputs, error: C.error, cost: C.cost }), r == null || r();
      } catch (C) {
        C.name !== "AbortError" && $(c, { status: "failed", error: C.message });
      } finally {
        x.current.delete(c);
      }
    }
  }, [e, $, r]), O = ee(async (c) => {
    if (!c.requestId || x.current.has(c.id)) return;
    x.current.add(c.id);
    const l = (C) => y((G) => G.map((q) => q.id === c.id ? { ...q, status: C.status, outputs: C.outputs, error: C.error, cost: C.cost ?? q.cost } : q));
    try {
      const C = await kt(e, c.requestId, { signal: P.current.signal, onUpdate: l });
      l(C), r == null || r();
    } catch {
    } finally {
      x.current.delete(c.id);
    }
  }, [e, r]);
  U(() => {
    const c = new Set(ze(n).map((l) => l.requestId));
    for (const l of p) (l.status === "pending" || l.status === "processing") && l.requestId && !c.has(l.requestId) && O(l);
  }, [p, n, O]), U(() => {
    if (!(!o || N.current)) {
      N.current = !0;
      for (const c of ze(n))
        c.status !== "pending" && c.status !== "processing" || (c.requestId ? E(c.id, c.requestId) : Date.now() - c.createdAt > 6e4 && $(c.id, { status: "failed", error: "Interrupted before it was sent. Check your account activity, then run it again." }));
    }
  }, [o]);
  const K = ee(async (c = !1) => {
    if (!R.current) {
      g(!0), w(null);
      try {
        const l = await e.history(c ? void 0 : h ?? void 0), C = l.items.map((G) => Lr(G, T.current));
        y((G) => c ? C : [...G, ...C]), k(l.next_cursor);
      } catch (l) {
        l instanceof ye && [403, 404, 405].includes(l.status) ? (R.current = !0, k(null)) : w(l.message);
      } finally {
        g(!1);
      }
    }
  }, [e, h]), X = j(!1);
  U(() => {
    t && !X.current && (X.current = !0, K(!0));
  }, [t, K]);
  const H = ee((c) => {
    const l = Array.from({ length: c.count }, () => ({
      id: jr(),
      model: c.model,
      mode: c.mode,
      prompt: c.prompt,
      inputs: c.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: c.unitCost,
      source: "local"
    }));
    return s((C) => [...l, ...C]), Promise.all(l.map(async (C) => {
      try {
        const { requestId: G, cost: q } = await e.submit(c.endpointUrl, c.payload, c.kind);
        $(C.id, { requestId: G, ...q !== void 0 ? { cost: q } : {} }), await E(C.id, G);
      } catch (G) {
        $(C.id, { status: "failed", error: G.message });
      }
    }));
  }, [e, $, E]), z = ae(() => {
    const c = (l) => ({ ...l, label: l.requestId && S[l.requestId] || l.label });
    return _r(i.map(c), p.map(c), new Set(b));
  }, [i, p, S, b]), m = ee((c, l) => {
    c.requestId && D((C) => {
      const G = { ...C };
      return l ? G[c.requestId] = l : delete G[c.requestId], G;
    }), $(c.id, { label: l });
  }, [$]), d = ee((c) => {
    s((l) => l.filter((C) => C.id !== c.id)), c.requestId && v((l) => [.../* @__PURE__ */ new Set([...l, c.requestId])]);
  }, []), M = ee(async (c) => {
    c.requestId && (await e.deleteMedia(c.requestId), $(c.id, { outputs: [] }), y((l) => l.map((C) => C.requestId === c.requestId ? { ...C, outputs: [] } : C)));
  }, [e, $]);
  return { items: z, run: H, setLabel: m, remove: d, deleteMedia: M, loadMore: () => K(!1), hasMore: !!h, loadingMore: I, serverError: f };
}
const Vr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Yt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : Vr.test(e) ? "file" : "image" : "text";
}
function Ur(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const qr = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), Z = ({ children: e, ...t }) => /* @__PURE__ */ a("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Pe = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ a("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ a("path", { d: "m21 15-4.5-4.5L6 21" })
] }), Fr = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ a("path", { d: "m16 10 6-3v10l-6-3" })
] }), Br = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ a("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ a("circle", { cx: "17", cy: "16", r: "3" })
] }), zr = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ a("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ a("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), mt = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ a("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), Hr = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ a("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), pt = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), Mt = ({ filled: e, ...t }) => /* @__PURE__ */ a(Z, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ a("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), ht = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ a("path", { d: "m20 20-3.5-3.5" })
] }), Ue = ({ up: e, ...t }) => /* @__PURE__ */ a(Z, { ...t, children: /* @__PURE__ */ a("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), Jr = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), Wr = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "3" })
] }), Ze = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), Te = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "m5 12 5 5 9-10" }) }), fe = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "M6 6l12 12M18 6 6 18" }) }), Kt = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), Yr = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ a("path", { d: "M12 11v5M12 8v.01" })
] }), ke = (e) => /* @__PURE__ */ a(Z, { ...e, className: "ms-spin", children: /* @__PURE__ */ a("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Kr = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Xr = (e) => /* @__PURE__ */ a(Z, { ...e, children: /* @__PURE__ */ a("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Zr = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), Et = (e) => /* @__PURE__ */ u(Z, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ a("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Xt({ url: e }) {
  return /* @__PURE__ */ u("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ a(mt, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let Tt = null;
const Qr = () => Tt ?? (Tt = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw Tt = null, e;
}));
function ea({ url: e, hidden: t = !1 }) {
  const [r, n] = A("loading"), o = j(null);
  return U(() => {
    let i = !0;
    return n("loading"), Qr().catch(() => i && n("failed")), () => {
      i = !1;
    };
  }, [e]), U(() => {
    const i = o.current;
    if (!i) return;
    const s = () => n("ready"), p = () => n("failed");
    return i.addEventListener("load", s), i.addEventListener("error", p), () => {
      i.removeEventListener("load", s), i.removeEventListener("error", p);
    };
  }), r === "failed" ? /* @__PURE__ */ a(Xt, { url: e }) : /* @__PURE__ */ u("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    ur("model-viewer", {
      ref: o,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    r === "loading" && /* @__PURE__ */ u("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ a(ke, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    r === "ready" && /* @__PURE__ */ a("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ a(mt, { width: 14, height: 14 }) })
  ] });
}
const ta = ["All", "Approved", "Rejected", "Unlabeled"], ra = [1, 2, 4, 6, 8];
function aa({ url: e, hidden: t, onOpen: r }) {
  const n = t ? { filter: "blur(18px)" } : void 0, o = Yt(e);
  return o === "text" ? /* @__PURE__ */ a("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: Ur(e) }) : o === "video" ? /* @__PURE__ */ a("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : o === "audio" ? /* @__PURE__ */ a("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ a("audio", { src: e, controls: !0, className: "w-full" }) }) : o === "3d" ? qr(e) ? /* @__PURE__ */ a(ea, { url: e, hidden: t }) : /* @__PURE__ */ a(Xt, { url: e }) : o === "file" ? /* @__PURE__ */ u("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ a(Ze, { width: 28, height: 28 }),
    /* @__PURE__ */ a("span", { className: "break-all", children: na(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ a("button", { type: "button", onClick: r, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ a("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function na(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e;
  }
}
function oa({ g: e, hidden: t, onLabel: r, onRemove: n, onReuse: o, onRerun: i, onDeleteMedia: s, onOpen: p, estimateFor: y }) {
  const [h, k] = A(0), I = e.outputs.length, g = Math.min(h, Math.max(I - 1, 0)), f = e.outputs[g], w = !!f && Yt(f) === "text", [R, S] = A(!1), [D, b] = A(null), v = zt(), x = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", N = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ u("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && f ? /* @__PURE__ */ u("div", { className: "relative", children: [
      /* @__PURE__ */ a(aa, { url: f, hidden: t, onOpen: () => p(f) }),
      I > 1 && /* @__PURE__ */ u("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ a("button", { type: "button", "aria-label": "Previous output", disabled: g === 0, onClick: () => k(g - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ u("span", { "aria-live": "polite", children: [
          g + 1,
          " / ",
          I
        ] }),
        /* @__PURE__ */ a("button", { type: "button", "aria-label": "Next output", disabled: g === I - 1, onClick: () => k(g + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ u("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ a(fe, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ a("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ u("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ a(ke, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ u("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ a("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ u("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ a("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ a("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ce(e.cost) : e.status === "completed" && (y == null ? void 0 : y(e.model)) !== void 0 ? `est. ${ce(y(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ u("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && f && (w ? /* @__PURE__ */ a("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(f)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${N} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ a(Ze, { width: 14, height: 14 }) }) : /* @__PURE__ */ a("a", { href: f, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${N} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ a(Ze, { width: 14, height: 14 }) })),
        /* @__PURE__ */ a(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => r(e, e.label === "approved" ? null : "approved"),
            className: `${N} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ a(Te, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ a(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "rejected",
            "aria-label": "Reject",
            title: "Reject",
            onClick: () => r(e, e.label === "rejected" ? null : "rejected"),
            className: `${N} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ a(fe, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ a("button", { type: "button", onClick: () => o(e), title: "Load this model and settings back into the form", className: x, children: "Reuse" }),
        /* @__PURE__ */ a("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: x, children: "Re-run" }),
        e.status === "completed" && f && /* @__PURE__ */ a("button", { type: "button", onClick: () => {
          var P;
          (P = navigator.clipboard) == null || P.writeText(f).then(() => {
            S(!0), setTimeout(() => S(!1), 1500);
          }).catch(() => {
          });
        }, className: x, children: R ? "Copied" : w ? "Copy text" : "Copy link" })
      ] }),
      D && /* @__PURE__ */ u("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        D
      ] }),
      /* @__PURE__ */ u("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ u("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ u("span", { className: "flex shrink-0 gap-3", children: [
          v.deleteMedia && e.requestId && e.status === "completed" && f && /* @__PURE__ */ a("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (b(null), s(e).catch((P) => b(P.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function ia({ url: e, onClose: t }) {
  const r = j(null), n = j(null);
  return U(() => {
    var s;
    const o = document.activeElement;
    (s = n.current) == null || s.focus();
    const i = (p) => {
      var y;
      if (p.key === "Escape") {
        t();
        return;
      }
      p.key === "Tab" && (p.preventDefault(), (y = n.current) == null || y.focus());
    };
    return document.addEventListener("keydown", i), () => {
      var p;
      document.removeEventListener("keydown", i), (p = o == null ? void 0 : o.focus) == null || p.call(o);
    };
  }, [t]), /* @__PURE__ */ u("div", { ref: r, role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ a("button", { ref: n, type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ a(fe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ a("img", { src: e, alt: "Full size output", onClick: (o) => o.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function sa({ mode: e, items: t, batch: r, onBatch: n, onLabel: o, onRemove: i, onReuse: s, onRerun: p, onDeleteMedia: y, onLoadMore: h, hasMore: k, loadingMore: I, serverError: g, estimateFor: f }) {
  const [w, R] = A("All"), [S, D] = A(""), [b, v] = A(!1), [x, N] = A(null), P = ae(() => {
    const T = S.trim().toLowerCase();
    return t.filter(($) => $.mode !== e || w === "Approved" && $.label !== "approved" || w === "Rejected" && $.label !== "rejected" || w === "Unlabeled" && $.label !== null ? !1 : !T || $.prompt.toLowerCase().includes(T) || $.model.toLowerCase().includes(T));
  }, [t, e, w, S]);
  return /* @__PURE__ */ u("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ u("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ a("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: ta.map((T) => /* @__PURE__ */ a(
        "button",
        {
          role: "tab",
          "aria-selected": w === T,
          onClick: () => R(T),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${w === T ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: T
        },
        T
      )) }),
      /* @__PURE__ */ u("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ a(ht, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ a("input", { value: S, onChange: (T) => D(T.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ a("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: ra.map((T) => /* @__PURE__ */ a(
        "button",
        {
          role: "radio",
          "aria-checked": r === T,
          onClick: () => n(T),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${r === T ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: T
        },
        T
      )) }),
      /* @__PURE__ */ a("button", { type: "button", "aria-pressed": b, "aria-label": b ? "Show previews" : "Hide previews", title: b ? "Show previews" : "Hide previews", onClick: () => v((T) => !T), className: b ? "text-primary" : "text-secondary hover:text-fg", children: b ? /* @__PURE__ */ a(Jr, { width: 18, height: 18 }) : /* @__PURE__ */ a(Wr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ u("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      P.length === 0 ? /* @__PURE__ */ u("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ a("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ a(pt, { width: 36, height: 36 }) }),
        /* @__PURE__ */ a("p", { className: "font-semibold", children: t.some((T) => T.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ a("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((T) => T.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ a("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: P.map((T) => /* @__PURE__ */ a(oa, { g: T, hidden: b, onLabel: o, onRemove: i, onReuse: s, onRerun: p, onDeleteMedia: y, onOpen: N, estimateFor: f }, T.id)) }),
      g && /* @__PURE__ */ u("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        g
      ] }),
      k && /* @__PURE__ */ a("div", { className: "mt-4 text-center", children: /* @__PURE__ */ a("button", { type: "button", disabled: I, onClick: h, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: I ? "Loading…" : "Load more history" }) }),
      x && /* @__PURE__ */ a(ia, { url: x, onClose: () => N(null) })
    ] })
  ] });
}
const la = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
function $e(e, t) {
  return t ? t.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean).some((r) => r.endsWith("/*") ? e.type.toLowerCase().startsWith(r.slice(0, -1)) : r.startsWith(".") ? e.name.toLowerCase().endsWith(r) : e.type.toLowerCase() === r) : !0;
}
const ca = (e) => e ? e.startsWith("image") ? "image files" : e.startsWith("video") ? "video files" : e.startsWith("audio") ? "audio files" : "those file types" : "files", $t = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function da(e, t, r) {
  const n = t.map((h) => ({ id: la(), name: h.name || "file", size: h.size, state: "queued", file: h })), o = (h) => r.onItem({ ...h });
  let i = Math.max(r.max, 0);
  const s = [];
  for (const h of n)
    $e(h.file, r.accept) ? h.size === 0 ? (h.state = "failed", h.error = "The file is empty.") : i <= 0 ? (h.state = "failed", h.error = "No room left in this field.") : (i -= 1, s.push(h)) : (h.state = "failed", h.error = `This field takes ${ca(r.accept)}.`), o(h);
  let p = 0;
  const y = async () => {
    for (; p < s.length; ) {
      const h = s[p++];
      h.state = "uploading", o(h);
      try {
        h.url = await e.upload(h.file), h.state = "done";
      } catch (k) {
        h.state = "failed", h.error = k.message || "Upload failed";
      }
      o(h);
    }
  };
  return await Promise.all(Array.from({ length: Math.min(r.concurrency ?? 3, s.length) }, y)), { urls: n.filter((h) => h.state === "done" && h.url).map((h) => h.url), items: n };
}
const Lt = "muapi-studio:uploads:v1", ua = 40, ft = (e) => e ? `${Lt}:${e}` : Lt;
function gt(e = "") {
  try {
    const t = localStorage.getItem(ft(e)), r = t ? JSON.parse(t) : [];
    return Array.isArray(r) ? r.filter((n) => n && typeof n.url == "string") : [];
  } catch {
    return [];
  }
}
function ma(e, t) {
  const r = /* @__PURE__ */ new Set(), n = [...t, ...gt(e)].filter((o) => r.has(o.url) ? !1 : (r.add(o.url), !0)).slice(0, ua);
  try {
    localStorage.setItem(ft(e), JSON.stringify(n));
  } catch {
  }
  return n;
}
function pa(e, t) {
  const r = gt(e).filter((n) => n.url !== t);
  try {
    localStorage.setItem(ft(e), JSON.stringify(r));
  } catch {
  }
  return r;
}
const Zt = lt(null), Qt = lt("");
function ha(e) {
  const t = ct(Zt), r = j(e);
  r.current = e;
  const n = j(null);
  return U(() => {
    const o = {
      get accept() {
        return r.current.accept;
      },
      hasRoom: () => r.current.hasRoom(),
      priority: () => r.current.priority(),
      receive: (s) => r.current.receive(s)
    };
    n.current = o;
    const i = t == null ? void 0 : t.register(o);
    return () => {
      i == null || i(), n.current = null;
    };
  }, [t == null ? void 0 : t.register]), !!(t != null && t.receiver) && t.receiver === n.current;
}
const De = (e) => {
  var t;
  return Array.from(((t = e.dataTransfer) == null ? void 0 : t.types) ?? []).includes("Files");
}, er = (e) => e.map((t, r) => ({ t, i: r })).sort((t, r) => t.t.priority() - r.t.priority() || t.i - r.i).map((t) => t.t);
function fa(e, t) {
  const r = er(t), n = /* @__PURE__ */ new Map(), o = [];
  for (const i of e) {
    const s = r.find((p) => p.hasRoom() && $e(i, p.accept));
    if (!s) {
      o.push(i);
      continue;
    }
    n.set(s, [...n.get(s) ?? [], i]);
  }
  return { assigned: n, rejected: o };
}
function ga(e, t) {
  const r = e[0] ?? "";
  return er(t).find((n) => n.hasRoom() && $e({ type: r, name: "" }, n.accept)) ?? null;
}
function tr({ children: e, className: t = "" }) {
  const r = j(/* @__PURE__ */ new Set()), [n, o] = A(null), [i, s] = A(null), p = j(0), y = ee((f) => (r.current.add(f), () => {
    r.current.delete(f);
  }), []), h = ae(() => ({ register: y, receiver: n }), [y, n]), k = ee(() => {
    p.current = 0, o(null);
  }, []);
  U(() => (document.addEventListener("dragend", k), document.addEventListener("drop", k), () => {
    document.removeEventListener("dragend", k), document.removeEventListener("drop", k);
  }), [k]), U(() => {
    if (!i) return;
    const f = setTimeout(() => s(null), 3500);
    return () => clearTimeout(f);
  }, [i]);
  const I = ee((f) => {
    var S, D;
    if (!De(f)) return;
    const w = f.defaultPrevented || !!((D = (S = f.target).closest) != null && D.call(S, "[data-ms-dropzone]"));
    if (f.preventDefault(), w) {
      o(null);
      return;
    }
    const R = Array.from(f.dataTransfer.items ?? []).filter((b) => b.kind === "file").map((b) => b.type);
    o(ga(R, [...r.current]));
  }, []), g = ee((f) => {
    if (k(), !De(f) || f.defaultPrevented) return;
    f.preventDefault();
    const w = Array.from(f.dataTransfer.files);
    if (!w.length) return;
    const { assigned: R, rejected: S } = fa(w, [...r.current]);
    R.forEach((D, b) => b.receive(D)), S.length && s(R.size ? `${S.length} file${S.length > 1 ? "s" : ""} did not fit any field here.` : "No field here takes that kind of file.");
  }, [k]);
  return /* @__PURE__ */ a(Zt.Provider, { value: h, children: /* @__PURE__ */ u(
    "div",
    {
      className: t,
      onDragEnter: (f) => {
        De(f) && (p.current += 1);
      },
      onDragOver: I,
      onDragLeave: (f) => {
        De(f) && (p.current = Math.max(p.current - 1, 0), p.current === 0 && o(null));
      },
      onDrop: g,
      children: [
        e,
        i && /* @__PURE__ */ a("div", { role: "status", className: "sticky bottom-0 mt-2 rounded-ctl border border-line bg-panel-bg px-3 py-2 text-xs text-secondary", children: i })
      ]
    }
  ) });
}
const ba = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, ya = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function xa(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? ba.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || ya.test(e.name) ? "media" : "text" : "text";
}
function He(e) {
  var s, p;
  const t = (p = (s = e.input_schema) == null ? void 0 : s.schemas) == null ? void 0 : p.input_data, r = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(r), o = [...n.filter((y) => r[y]), ...Object.keys(r).filter((y) => !n.includes(y))], i = new Set(e.required_fields ?? []);
  return o.map((y) => ({ prop: { ...r[y], name: y }, kind: xa({ ...r[y], name: y }), required: i.has(y) }));
}
function Qe(e) {
  var r;
  const t = {};
  for (const { prop: n, kind: o, required: i } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : i && (o === "textarea" || o === "text") && typeof ((r = n.examples) == null ? void 0 : r[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const xe = (e) => `__auto:${e}`, et = (e) => (e.kind === "number" || e.kind === "select") && !e.required, tt = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function Je(e, t) {
  const r = {};
  for (const { prop: n, kind: o } of e) {
    if (t[xe(n.name)] === !0) continue;
    const i = t[n.name] ?? n.default;
    if (!tt(i))
      if (o === "number") {
        const s = Number(i);
        Number.isFinite(s) && (r[n.name] = s);
      } else if (o === "json" && typeof i == "string")
        try {
          r[n.name] = JSON.parse(i);
        } catch {
        }
      else r[n.name] = i;
  }
  return r;
}
function va(e, t) {
  for (const { prop: r, kind: n, required: o } of e) {
    if (t[xe(r.name)] === !0) continue;
    const i = t[r.name] ?? r.default, s = r.title || r.name;
    if (o && tt(i)) return `${s} is required`;
    if (n === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${s} must be valid JSON`;
      }
    if (n === "number" && !tt(i)) {
      const p = Number(i);
      if (!Number.isFinite(p)) return `${s} must be a number`;
      if (r.minValue !== void 0 && p < r.minValue) return `${s} must be at least ${r.minValue}`;
      if (r.maxValue !== void 0 && p > r.maxValue) return `${s} must be at most ${r.maxValue}`;
    }
  }
  return null;
}
const wa = 12, bt = 240, Re = (e) => `${typeof e}:${e}`, ka = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Na(e, t) {
  const r = t.trim().toLowerCase();
  return r ? e.filter((n) => n.label.toLowerCase().includes(r)) : e;
}
function Sa(e, t, r = bt) {
  return e >= r || e >= t ? "down" : "up";
}
const Ca = 36, Aa = 48;
function Ia(e, t) {
  return Math.min(bt, Math.max(1, e) * Ca + 8) + (t ? Aa : 0);
}
function Ma(e, t, r) {
  return r <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, r - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? r - 1 : t === "PageDown" ? Math.min(e + 5, r - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const _t = "Auto (let model decide)", We = "__auto__";
function rt({ id: e, label: t, options: r, value: n, onChange: o, allowAuto: i, auto: s, onAuto: p, combobox: y }) {
  const h = mr(), k = e ?? `ms-dd-${h}`, I = y ?? r.length > wa, [g, f] = A(!1), [w, R] = A(""), [S, D] = A(0), [b, v] = A("down"), x = j(null), N = j(null), P = j(null), T = r.find((m) => n !== void 0 && Re(m.value) === Re(n)), $ = ae(() => I ? Na(r, w) : r, [I, r, w]), E = ae(
    () => [...i ? [{ key: We, label: _t, value: We, isAuto: !0 }] : [], ...$.map((m) => ({ key: Re(m.value), label: m.label, hint: m.hint, value: m.value }))],
    [i, $]
  ), O = s ? We : T ? Re(T.value) : void 0, K = () => {
    f(!1), R("");
  }, X = (m) => {
    m.isAuto ? p == null || p() : o(m.value), K();
  };
  pr(() => {
    if (!g || !x.current) return;
    const m = x.current.getBoundingClientRect();
    let d = x.current.parentElement;
    for (; d && !/(auto|scroll)/.test(getComputedStyle(d).overflowY); ) d = d.parentElement;
    const M = d ? d.getBoundingClientRect() : null, c = Math.min(window.innerHeight, M ? M.bottom : window.innerHeight), l = Math.max(0, M ? M.top : 0);
    v(Sa(c - m.bottom, m.top - l, Ia(r.length + (i ? 1 : 0), I)));
  }, [g]), U(() => {
    if (!g) return;
    const m = E.findIndex((d) => d.key === O);
    D(m >= 0 ? m : 0);
  }, [g, w]), U(() => {
    var m, d, M;
    g && ((M = (d = (m = N.current) == null ? void 0 : m.querySelector(`[data-i="${S}"]`)) == null ? void 0 : d.scrollIntoView) == null || M.call(d, { block: "nearest" }));
  }, [S, g]), U(() => {
    var m;
    g && I && ((m = P.current) == null || m.focus());
  }, [g, I]), U(() => {
    if (!g) return;
    const m = (d) => {
      var M;
      (M = x.current) != null && M.contains(d.target) || K();
    };
    return document.addEventListener("mousedown", m), () => document.removeEventListener("mousedown", m);
  }, [g]);
  const H = (m) => {
    if (!g) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(m.key) && (m.preventDefault(), f(!0));
      return;
    }
    if (m.key === "Escape") {
      m.preventDefault(), m.stopPropagation(), K();
      return;
    }
    if (m.key === "Enter") {
      m.preventDefault(), E[S] && X(E[S]);
      return;
    }
    if (m.key === "Tab") {
      K();
      return;
    }
    if (m.key === " " && !I) {
      m.preventDefault(), E[S] && X(E[S]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(m.key) && (m.preventDefault(), D((d) => Ma(d, m.key, E.length)));
  }, z = s ? _t : (T == null ? void 0 : T.label) ?? "Select…";
  return /* @__PURE__ */ u("div", { ref: x, className: "relative w-full", onKeyDown: H, children: [
    /* @__PURE__ */ u(
      "button",
      {
        id: k,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": g,
        "aria-label": `${t}: ${z}`,
        "aria-controls": `${k}-list`,
        onClick: () => f((m) => !m),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${g ? "border-primary" : "border-line hover:border-muted"} ${s ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ a("span", { className: "truncate", children: z }),
          /* @__PURE__ */ a(Ue, { up: g, width: 16, height: 16 })
        ]
      }
    ),
    g && /* @__PURE__ */ u("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${b === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      I && /* @__PURE__ */ a(
        "input",
        {
          ref: P,
          value: w,
          onChange: (m) => R(m.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${k}-list`,
          "aria-activedescendant": E[S] ? `${k}-o${S}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ u("ul", { id: `${k}-list`, ref: N, role: "listbox", "aria-label": t, style: { maxHeight: bt }, className: "overflow-y-auto", children: [
        E.map((m, d) => {
          const M = m.key === O;
          return /* @__PURE__ */ u(
            "li",
            {
              id: `${k}-o${d}`,
              "data-i": d,
              role: "option",
              "aria-selected": M,
              onMouseEnter: () => D(d),
              onClick: () => X(m),
              className: `flex cursor-pointer items-center justify-between gap-2 ${m.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${M ? "bg-primary text-primary-ink" : d === S ? "bg-card-bg" : ""} ${m.isAuto && !M ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ u("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ a("span", { className: "block truncate", children: m.label }),
                  m.hint && /* @__PURE__ */ a("span", { className: `block truncate text-[11px] ${M ? "opacity-70" : "text-muted"}`, children: m.hint })
                ] }),
                M && /* @__PURE__ */ a(Te, { width: 14, height: 14 })
              ]
            },
            m.key
          );
        }),
        E.length === 0 && /* @__PURE__ */ a("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Ea = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Ta({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ a("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ a("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ a("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ a(Pe, {}) });
}
function $a({ client: e, max: t, initialType: r = "image", onInsert: n, onClose: o }) {
  const [i, s] = A(r), [p, y] = A(""), [h, k] = A(1), [I, g] = A(null), [f, w] = A(null), [R, S] = A(!1), [D, b] = A([]), [v, x] = A(""), [N, P] = A(!1), T = j(null), $ = j(null), E = j(0), O = ee(async () => {
    const m = ++E.current;
    S(!0), w(null);
    try {
      const d = await e.mediaLibrary({ mediaType: i, search: p, page: h });
      m === E.current && g(d);
    } catch (d) {
      m === E.current && w(d.message);
    } finally {
      m === E.current && S(!1);
    }
  }, [e, i, p, h]);
  U(() => {
    const m = setTimeout(O, p ? 300 : 0);
    return () => clearTimeout(m);
  }, [O, p]), U(() => {
    k(1);
  }, [i, p]), U(() => {
    var M;
    const m = document.activeElement;
    (M = T.current) == null || M.focus();
    const d = (c) => {
      if (c.key === "Escape") {
        c.stopPropagation(), o();
        return;
      }
      if (c.key !== "Tab" || !T.current) return;
      const l = [...T.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!l.length) return;
      const C = l[0], G = l[l.length - 1];
      c.shiftKey && document.activeElement === C ? (c.preventDefault(), G.focus()) : !c.shiftKey && document.activeElement === G && (c.preventDefault(), C.focus());
    };
    return document.addEventListener("keydown", d), () => {
      var c;
      document.removeEventListener("keydown", d), (c = m == null ? void 0 : m.focus) == null || c.call(m);
    };
  }, [o]);
  const K = (m) => b((d) => d.includes(m) ? d.filter((M) => M !== m) : t === 1 ? [m] : d.length < t ? [...d, m] : d), X = async (m) => {
    if (m.length) {
      S(!0), w(null);
      try {
        for (const d of m) {
          const M = await e.upload(d);
          await e.saveToLibrary({ url: M, name: d.name, mime_type: d.type || void 0, size_bytes: d.size, media_type: d.type.startsWith("video") ? "video" : d.type.startsWith("audio") ? "audio" : d.type.startsWith("image") ? "image" : "archive" });
        }
        await O();
      } catch (d) {
        w(d.message), S(!1);
      }
    }
  }, H = async () => {
    var d;
    const m = v.trim();
    if (!/^https?:\/\//i.test(m)) {
      w("Enter a full http(s) URL");
      return;
    }
    S(!0), w(null);
    try {
      const M = ((d = m.split("?")[0].split(".").pop()) == null ? void 0 : d.toLowerCase()) ?? "", c = ["mp4", "webm", "mov"].includes(M) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(M) ? "audio" : ["zip", "rar", "7z"].includes(M) ? "archive" : "image";
      await e.saveToLibrary({ url: m, name: m.split("/").pop() || "link", media_type: c }), x(""), P(!1), await O();
    } catch (M) {
      w(M.message), S(!1);
    }
  }, z = async (m) => {
    if (window.confirm(`Delete "${m.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(m.id), b((d) => d.filter((M) => M !== m.url)), await O();
      } catch (d) {
        w(d.message);
      }
  };
  return /* @__PURE__ */ a("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (m) => {
    m.target === m.currentTarget && o();
  }, children: /* @__PURE__ */ u("div", { ref: T, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ u("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ a("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ a(Pe, {}) }),
      /* @__PURE__ */ u("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ u("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ a("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ u("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
            (I == null ? void 0 : I.total) ?? 0,
            " ",
            (I == null ? void 0 : I.total) === 1 ? "item" : "items"
          ] })
        ] }),
        /* @__PURE__ */ u("p", { className: "hidden text-xs text-secondary sm:block", children: [
          "Select up to ",
          t,
          " item",
          t === 1 ? "" : "s",
          " to insert into your form"
        ] })
      ] }),
      /* @__PURE__ */ a("input", { ref: $, type: "file", hidden: !0, multiple: !0, onChange: (m) => {
        const d = Array.from(m.target.files ?? []);
        m.target.value = "", X(d);
      } }),
      /* @__PURE__ */ u("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var m;
        return (m = $.current) == null ? void 0 : m.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ a(Kt, { width: 14, height: 14 }),
        /* @__PURE__ */ a("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ a("button", { type: "button", "aria-label": "Close", onClick: o, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ a(fe, {}) })
    ] }),
    /* @__PURE__ */ u("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Ea.map((m) => /* @__PURE__ */ a("button", { role: "tab", "aria-selected": i === m.id, onClick: () => s(m.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === m.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: m.label }, m.id)) }),
      /* @__PURE__ */ a("input", { value: p, onChange: (m) => y(m.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ a("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": N, onClick: () => P((m) => !m), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    N && /* @__PURE__ */ u("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ a("input", { value: v, onChange: (m) => x(m.target.value), onKeyDown: (m) => m.key === "Enter" && void H(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ a("button", { type: "button", onClick: () => void H(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ u("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      f && /* @__PURE__ */ a("p", { role: "alert", className: "mb-3 text-sm text-danger", children: f }),
      R && !I ? /* @__PURE__ */ u("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ a(ke, {}),
        " Loading…"
      ] }) : I != null && I.items.length ? /* @__PURE__ */ a("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: I.items.map((m) => {
        const d = D.includes(m.url);
        return /* @__PURE__ */ u("li", { className: `group relative overflow-hidden rounded-card border ${d ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ a("button", { type: "button", "aria-pressed": d, "aria-label": `${d ? "Deselect" : "Select"} ${m.name ?? "file"}`, onClick: () => K(m.url), className: "block aspect-square w-full", children: /* @__PURE__ */ a(Ta, { a: m }) }),
          d && /* @__PURE__ */ a("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ a(Te, { width: 12, height: 12 }) }),
          /* @__PURE__ */ a("button", { type: "button", "aria-label": `Delete ${m.name ?? "file"}`, onClick: () => void z(m), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ a(fe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ a("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: m.name ?? "", children: m.name })
        ] }, m.id);
      }) }) : /* @__PURE__ */ u("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ a("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ a(Pe, { width: 28, height: 28 }) }),
        /* @__PURE__ */ a("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ a("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      I && I.total_pages > 1 && /* @__PURE__ */ u("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ a("button", { type: "button", disabled: h <= 1, onClick: () => k((m) => m - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        h,
        " of ",
        I.total_pages,
        /* @__PURE__ */ a("button", { type: "button", disabled: h >= I.total_pages, onClick: () => k((m) => m + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ u("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ u("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ a("b", { className: "text-primary", children: D.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ u("button", { type: "button", disabled: !D.length, onClick: () => {
        n(D), o();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ a(Te, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const rr = (e, t = "") => {
  const r = `${e ?? ""} ${t}`.toLowerCase();
  return r.includes("video") ? "video/*" : r.includes("audio") || r.includes("voice") ? "audio/*" : r.includes("image") || r.includes("mask") || r.includes("photo") || r.includes("face") ? "image/*" : void 0;
}, La = (e, t = "") => {
  const r = rr(e, t);
  return r === "video/*" ? "video" : r === "audio/*" ? "audio" : r === "image/*" ? "image" : "all";
};
function at({ client: e, field: t, multiple: r, max: n, current: o, onUrls: i, onError: s }) {
  const p = j(null), [y, h] = A(!1), [k, I] = A(!1), [g, f] = A(!1), [w, R] = A([]), S = ct(Qt), [D, b] = A(() => gt(S)), v = n - o.length, x = zt(), N = rr(t.prop.field, t.prop.name), P = w.some((d) => d.state === "queued" || d.state === "uploading"), T = ee((d) => {
    R((M) => M.some((c) => c.id === d.id) ? M.map((c) => c.id === d.id ? d : c) : [...M, d]), d.state === "done" && setTimeout(() => R((M) => M.filter((c) => c.id !== d.id)), 1800);
  }, []), $ = async (d) => {
    if (!(!d.length || r && v <= 0))
      try {
        const M = await da(e, r ? d : d.slice(0, 1), { accept: N, max: r ? v : 1, onItem: T });
        if (M.urls.length) {
          i(M.urls);
          const c = M.items.filter((l) => l.state === "done" && l.url && l.file);
          b(ma(S, c.map((l) => ({ url: l.url, name: l.name, type: $t(l.file), at: Date.now() })))), x.library && c.forEach((l) => void e.saveToLibrary({ url: l.url, name: l.name, mime_type: l.file.type || void 0, size_bytes: l.size, media_type: $t(l.file) }).catch(() => {
          }));
        }
      } catch (M) {
        s(M.message);
      }
  }, E = (d) => {
    R((M) => M.filter((c) => c.id !== d.id)), d.file && $([d.file]);
  }, O = ha({ accept: N, hasRoom: () => r ? v > 0 : !0, priority: () => o.length === 0 ? 0 : 1, receive: (d) => void $(d) });
  U(() => {
    const d = () => h(!1);
    return document.addEventListener("dragend", d), document.addEventListener("drop", d), () => {
      document.removeEventListener("dragend", d), document.removeEventListener("drop", d);
    };
  }, []);
  const K = r ? v > 0 : !0, X = y && K || O, H = N === "video/*" ? "video" : N === "audio/*" ? "audio file" : N === "image/*" ? "image" : "file", z = D.filter((d) => $e({ type: d.type === "archive" ? "" : `${d.type}/x`, name: d.name }, N)), m = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ u(
    "div",
    {
      "data-ms-dropzone": !0,
      onDragOver: (d) => {
        d.preventDefault(), h(!0);
      },
      onDragLeave: (d) => {
        d.currentTarget.contains(d.relatedTarget) || h(!1);
      },
      onDrop: (d) => {
        d.preventDefault(), h(!1), $(Array.from(d.dataTransfer.files));
      },
      onPaste: (d) => {
        var c;
        const M = Array.from(((c = d.clipboardData) == null ? void 0 : c.files) ?? []);
        M.length && (d.preventDefault(), $(M));
      },
      className: `rounded-card border-dashed p-2 ${X ? "border-2 border-primary bg-primary-soft" : "border border-line"}`,
      children: [
        /* @__PURE__ */ a("input", { ref: p, type: "file", hidden: !0, accept: N, multiple: r, onChange: (d) => {
          const M = Array.from(d.target.files ?? []);
          d.target.value = "", $(M);
        } }),
        (r ? v > 0 : !0) && /* @__PURE__ */ u("div", { className: `relative flex gap-2 ${X ? "[&>:not([role=status])]:invisible" : ""}`, children: [
          X && /* @__PURE__ */ u("div", { role: "status", className: "pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-ctl border border-primary text-xs font-semibold text-primary", children: [
            /* @__PURE__ */ u("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
              /* @__PURE__ */ a("path", { d: "M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1 .5 9H7Z" }),
              /* @__PURE__ */ a("path", { d: "M12 17v-6M9.5 13.5 12 11l2.5 2.5" })
            ] }),
            "Drop ",
            H,
            r ? "(s)" : "",
            " here to upload"
          ] }),
          /* @__PURE__ */ a(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: r ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: r ? void 0 : o[0] ?? "",
              defaultValue: void 0,
              onChange: r ? void 0 : (d) => i([d.target.value]),
              onKeyDown: r ? (d) => {
                d.key === "Enter" && d.currentTarget.value.trim() && (i([d.currentTarget.value.trim()]), d.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ a("button", { type: "button", disabled: P, onClick: () => {
            var d;
            return (d = p.current) == null ? void 0 : d.click();
          }, "aria-label": "Upload file", title: "Upload file", className: m, children: P ? /* @__PURE__ */ a(ke, { width: 16, height: 16 }) : /* @__PURE__ */ a(Kt, { width: 16, height: 16 }) }),
          z.length > 0 && /* @__PURE__ */ a("button", { type: "button", "aria-haspopup": "listbox", "aria-expanded": g, onClick: () => f((d) => !d), "aria-label": "Recent uploads", title: "Recent uploads", className: m, children: /* @__PURE__ */ u("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "9" }),
            /* @__PURE__ */ a("path", { d: "M12 7v5l3 2" })
          ] }) }),
          x.library && /* @__PURE__ */ a("button", { type: "button", onClick: () => I(!0), "aria-label": "Choose from media library", title: "Media library", className: m, children: /* @__PURE__ */ u("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ a("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ a("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        g && z.length > 0 && /* @__PURE__ */ a("ul", { role: "listbox", "aria-label": "Recent uploads", className: "mt-2 max-h-44 overflow-y-auto rounded-ctl border border-line bg-panel-bg p-1", children: z.map((d) => /* @__PURE__ */ u("li", { role: "none", className: "flex items-center gap-2", children: [
          /* @__PURE__ */ u("button", { type: "button", role: "option", "aria-selected": o.includes(d.url), onClick: () => {
            i([d.url]), f(!1);
          }, className: "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:text-primary", children: [
            d.type === "image" ? /* @__PURE__ */ a("img", { src: d.url, alt: "", loading: "lazy", className: "h-8 w-8 shrink-0 rounded object-cover" }) : /* @__PURE__ */ a("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line text-[10px] uppercase text-muted", children: d.type.slice(0, 3) }),
            /* @__PURE__ */ a("span", { className: "truncate", children: d.name })
          ] }),
          /* @__PURE__ */ a("button", { type: "button", "aria-label": `Forget ${d.name}`, title: "Forget", onClick: () => b(pa(S, d.url)), className: "flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:text-danger", children: /* @__PURE__ */ a(fe, { width: 12, height: 12 }) })
        ] }, d.url)) }),
        w.length > 0 && /* @__PURE__ */ a("ul", { "aria-label": "Uploads", className: "mt-2 space-y-1", children: w.map((d) => /* @__PURE__ */ u("li", { className: "flex items-center gap-2 text-[11px]", children: [
          d.state === "failed" ? /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-danger", children: "!" }) : d.state === "done" ? /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-primary", children: "✓" }) : /* @__PURE__ */ a(ke, { width: 12, height: 12 }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", title: d.name, children: d.name }),
          /* @__PURE__ */ a("span", { role: d.state === "failed" ? "alert" : void 0, className: d.state === "failed" ? "max-w-[55%] truncate text-danger" : "text-muted", title: d.error, children: d.state === "failed" ? d.error : d.state === "queued" ? "Waiting…" : d.state === "uploading" ? "Uploading…" : "Added" }),
          d.state === "failed" && d.file && $e(d.file, N) && d.size > 0 && /* @__PURE__ */ a("button", { type: "button", onClick: () => E(d), className: "rounded-md border border-line px-2 py-0.5 text-secondary hover:text-primary", children: "Retry" }),
          d.state === "failed" && /* @__PURE__ */ a("button", { type: "button", "aria-label": `Dismiss ${d.name}`, onClick: () => R((M) => M.filter((c) => c.id !== d.id)), className: "text-muted hover:text-danger", children: /* @__PURE__ */ a(fe, { width: 12, height: 12 }) })
        ] }, d.id)) }),
        /* @__PURE__ */ a("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop, paste, or click to upload" }),
        k && x.library && /* @__PURE__ */ a($a, { client: e, max: r ? Math.max(v, 1) : 1, initialType: La(t.prop.field, t.prop.name), onInsert: i, onClose: () => I(!1) })
      ]
    }
  );
}
function _a({ field: e, values: t, onChange: r, client: n, onError: o, tagCount: i = 0 }) {
  const { prop: s, kind: p, required: y } = e, h = t[s.name], k = (v) => r(s.name, v), I = s.title || s.name, g = `ms-f-${s.name}`, f = h == null ? "" : String(h), w = Array.isArray(h) ? h : [], R = t[xe(s.name)] === !0, S = j(null), D = (v) => {
    const x = S.current, N = typeof h == "string" ? h : "", P = (x == null ? void 0 : x.selectionStart) ?? N.length, T = (x == null ? void 0 : x.selectionEnd) ?? P;
    k(N.slice(0, P) + v + " " + N.slice(T)), requestAnimationFrame(() => {
      x == null || x.focus(), x == null || x.setSelectionRange(P + v.length + 1, P + v.length + 1);
    });
  };
  let b;
  if (p === "textarea" || p === "json")
    b = /* @__PURE__ */ u(Ve, { children: [
      /* @__PURE__ */ a("textarea", { ref: S, id: g, rows: p === "json" ? 4 : 5, value: typeof h == "string" ? h : h ? JSON.stringify(h, null, 2) : "", onChange: (v) => k(v.target.value), className: `w-full resize-y p-3 text-sm ${p === "json" ? "font-mono text-xs" : ""}` }),
      s.name === "prompt" && i > 0 && /* @__PURE__ */ u("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ a("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (v, x) => `@image${x + 1}`).map((v) => /* @__PURE__ */ a("button", { type: "button", onClick: () => D(v), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: v }, v))
      ] })
    ] });
  else if (p === "select") {
    const v = s.enum ?? [];
    b = /* @__PURE__ */ a(
      rt,
      {
        id: g,
        label: I,
        options: ka(v),
        value: h,
        onChange: (x) => {
          k(x), r(xe(s.name), !1);
        },
        allowAuto: et(e),
        auto: R,
        onAuto: () => r(xe(s.name), !0)
      }
    );
  } else if (p === "boolean") {
    const v = h === !0;
    b = /* @__PURE__ */ a(
      "button",
      {
        id: g,
        type: "button",
        role: "switch",
        "aria-checked": v,
        onClick: () => k(!v),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${v ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ a("span", { className: `h-5 w-5 rounded-full ${v ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (p === "number") {
    const v = s.minValue !== void 0 && s.maxValue !== void 0;
    b = /* @__PURE__ */ u("div", { className: `flex items-center gap-3 ${R ? "opacity-40" : ""}`, children: [
      v && /* @__PURE__ */ a("input", { type: "range", disabled: R, "aria-label": `${I} slider`, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? 0.01 : 1), value: f === "" ? s.minValue : Number(f), onChange: (x) => k(Number(x.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ a("input", { id: g, type: "number", disabled: R, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? "any" : 1), value: f, onChange: (x) => k(x.target.value === "" ? "" : Number(x.target.value)), className: `px-3 py-2 text-sm ${v ? "w-24" : "w-full"}` })
    ] });
  } else if (p === "media")
    b = /* @__PURE__ */ a(at, { client: n, field: e, multiple: !1, max: 1, current: f ? [f] : [], onUrls: (v) => k(v[0]), onError: o });
  else if (p === "media-list") {
    const v = s.maxItems ?? 8;
    b = /* @__PURE__ */ u("div", { className: "space-y-2", children: [
      w.map((x, N) => /* @__PURE__ */ u("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ a("input", { "aria-label": `${I} ${N + 1}`, value: x, onChange: (P) => k(w.map((T, $) => $ === N ? P.target.value : T)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ a("button", { type: "button", "aria-label": `Remove ${I} ${N + 1}`, onClick: () => k(w.filter((P, T) => T !== N)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ a(fe, { width: 14, height: 14 }) })
      ] }, N)),
      /* @__PURE__ */ a(at, { client: n, field: e, multiple: !0, max: v, current: w, onUrls: (x) => r(s.name, (N) => [...Array.isArray(N) ? N : [], ...x].slice(0, v)), onError: o })
    ] });
  } else
    b = /* @__PURE__ */ a("input", { id: g, value: f, onChange: (v) => k(v.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ u("div", { className: "mb-5", children: [
    /* @__PURE__ */ u("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ u("label", { htmlFor: g, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        I,
        s.description && /* @__PURE__ */ a("span", { title: s.description, className: "text-muted", children: /* @__PURE__ */ a(Yr, { width: 13, height: 13 }) })
      ] }),
      et(e) && p === "number" ? /* @__PURE__ */ u("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ a("input", { type: "checkbox", checked: R, onChange: (v) => r(xe(s.name), v.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ a("span", { className: "text-[11px] text-primary", children: p === "media-list" ? `${w.length}/${s.maxItems ?? 8} items${y ? " · required" : ""}` : y ? "* required" : "" })
    ] }),
    b
  ] });
}
const Ge = {
  kling: "Kling AI",
  seedance: "ByteDance",
  seedream: "ByteDance",
  bytedance: "ByteDance",
  seedvr: "ByteDance",
  omnihuman: "ByteDance",
  volcengine: "ByteDance",
  minimax: "MiniMax",
  wan: "Alibaba",
  qwen: "Alibaba",
  z: "Alibaba",
  veo: "Google",
  gemini: "Google",
  google: "Google",
  nano: "Google",
  lyria: "Google",
  openai: "OpenAI",
  gpt: "OpenAI",
  sora: "OpenAI",
  grok: "xAI",
  flux: "Black Forest Labs",
  ltx: "Lightricks",
  hunyuan: "Tencent",
  suno: "Suno",
  elevenlabs: "ElevenLabs",
  ideogram: "Ideogram",
  midjourney: "Midjourney",
  vidu: "Vidu",
  pixverse: "PixVerse",
  runway: "Runway",
  luma: "Luma",
  leonardoai: "Leonardo.ai",
  krea: "Krea",
  hidream: "HiDream",
  meshy: "Meshy",
  tripo: "Tripo",
  topaz: "Topaz Labs",
  heygen: "HeyGen",
  sdxl: "Stability AI",
  veed: "VEED",
  creatify: "Creatify",
  fish: "Fish Audio",
  mmaudio: "MMAudio",
  infinitetalk: "InfiniteTalk",
  sync: "Sync",
  happy: "HappyHorse"
}, Ae = "Other", Da = 3, Ra = 2, Ga = 20, Oa = 2, ja = 4, Pa = 40, Va = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function ar(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", r = t.replace(/\d+[a-z]?$/, "") || t;
  return Ge[t] ? Ge[t] : Ge[r] ? Ge[r] : r.startsWith("tripo") ? "Tripo" : r === "ai" || r === "" || r.length < 2 ? Ae : Va(r);
}
function Ua(e) {
  const t = /* @__PURE__ */ new Map();
  for (const o of e) {
    const i = ar(o.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let r = 0;
  const n = [];
  for (const [o, i] of t)
    o === Ae || i < Da ? r += i : n.push({ id: o, label: o, count: i });
  return n.sort((o, i) => i.count - o.count || o.label.localeCompare(i.label)), r && n.push({ id: Ae, label: Ae, count: r }), n;
}
function nr(e, t) {
  const r = ar(e.name);
  return t.some((n) => n.id === r) ? r : Ae;
}
function qa(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function Fa(e) {
  let t = 7;
  for (const r of e) t = (t * 33 + r.charCodeAt(0)) % 360;
  return t;
}
const Dt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function Ba(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const r = (n) => {
    const o = Dt.indexOf(n);
    return o < 0 ? Dt.length : o;
  };
  return [...t].map(([n, o]) => ({ id: n, count: o })).sort((n, o) => r(n.id) - r(o.id) || o.count - n.count || n.id.localeCompare(o.id));
}
const be = "__favourites__", ne = "__all__";
function za(e, t, r) {
  return e.filter((n) => {
    var o;
    return t.category !== ne && n.category !== t.category ? !1 : t.provider === be ? !!((o = t.favourites) != null && o.includes(n.name)) : t.provider === ne || nr(n, r) === t.provider;
  });
}
const Ha = (e, t) => t.filter((r) => r.id !== Ae).length >= Ra && e.length >= Ga;
function Ja(e) {
  const t = Ba(e);
  return e.length >= Pa ? t.filter((r) => r.count >= ja) : t;
}
const Oe = 200;
function Wa({ model: e }) {
  const t = ve(e);
  return t ? /* @__PURE__ */ u("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ a("s", { className: "font-normal text-muted", children: ce(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ce(t.current)
  ] }) : null;
}
const Rt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, Gt = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Ye({ label: e, active: t, onClick: r, hue: n, children: o }) {
  return /* @__PURE__ */ a(
    "button",
    {
      type: "button",
      role: "radio",
      "aria-checked": t,
      "aria-label": e,
      title: e,
      onClick: r,
      style: n !== void 0 && !t ? { boxShadow: `inset 0 0 0 1.5px hsl(${n} 60% 55% / 0.55)` } : void 0,
      className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${t ? "bg-primary text-primary-ink" : "bg-card-bg text-secondary hover:text-fg"}`,
      children: o
    }
  );
}
function Ya({ models: e, value: t, onChange: r, favorites: n, onToggleFavorite: o, usage: i, showGroup: s, scope: p = "default" }) {
  var c;
  const [y, h] = A(!1), [k, I] = A(""), [g, f] = A("popular"), [w, R] = A(!1), S = j(null), D = ae(() => Ua(e), [e]), b = ae(() => Ja(e), [e]), v = Ha(e, D), x = b.length >= Oa, [N, P] = A(() => Rt(`muapi-studio:provider:${p}`, ne)), [T, $] = A(() => Rt(`muapi-studio:category:${p}`, ne)), E = v && (N === be || N === ne || D.some((l) => l.id === N)) ? N : ne, O = x && (T === ne || b.some((l) => l.id === T)) ? T : ne, K = (l) => {
    P(l), Gt(`muapi-studio:provider:${p}`, l);
  }, X = (l) => {
    $(l), Gt(`muapi-studio:category:${p}`, l);
  }, H = j(null);
  U(() => {
    y || R(!1);
  }, [y]), U(() => {
    if (!y) return;
    const l = (G) => {
      var q;
      (q = S.current) != null && q.contains(G.target) || h(!1);
    }, C = (G) => {
      G.key === "Escape" && h(!1);
    };
    return document.addEventListener("mousedown", l), document.addEventListener("keydown", C), () => {
      document.removeEventListener("mousedown", l), document.removeEventListener("keydown", C);
    };
  }, [y]);
  const z = ae(() => {
    const l = k.trim().toLowerCase(), C = za(e, { category: O, provider: E, favourites: n }, D), G = l ? C.filter((te) => te.name.toLowerCase().includes(l) || te.category.toLowerCase().includes(l)) : C, q = Jt(G, g, { usage: i, favorites: n });
    if (g === "favourites" || g === "most-used") return q;
    const ie = new Set(n);
    return [...q.filter((te) => ie.has(te.name)), ...q.filter((te) => !ie.has(te.name))];
  }, [e, k, g, n, i, O, E, D]), [m, d] = A(0);
  U(() => {
    var l, C;
    d(0), (C = (l = H.current) == null ? void 0 : l.scrollTo) == null || C.call(l, { top: 0 });
  }, [k, g, y, O, E]);
  const M = (l) => {
    l.key === "ArrowDown" ? (l.preventDefault(), d((C) => Math.min(C + 1, Math.min(z.length, Oe) - 1))) : l.key === "ArrowUp" ? (l.preventDefault(), d((C) => Math.max(C - 1, 0))) : l.key === "Enter" && z[m] && (l.preventDefault(), r(z[m].name), h(!1));
  };
  return U(() => {
    var l, C;
    (C = (l = document.getElementById(`ms-opt-${m}`)) == null ? void 0 : l.scrollIntoView) == null || C.call(l, { block: "nearest" });
  }, [m]), /* @__PURE__ */ u("div", { ref: S, className: "relative", children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        onClick: () => h((l) => !l),
        "aria-haspopup": "listbox",
        "aria-expanded": y,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ a("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (c = (t ?? "?")[0]) == null ? void 0 : c.toUpperCase() }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ a(Ue, { up: y, width: 16, height: 16 })
        ]
      }
    ),
    y && /* @__PURE__ */ u("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      v && /* @__PURE__ */ u("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ a(Ye, { label: "All providers", active: E === ne, onClick: () => K(ne), children: /* @__PURE__ */ a("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ a(Ye, { label: "Favourites", active: E === be, onClick: () => K(be), children: /* @__PURE__ */ a(Mt, { width: 14, height: 14, filled: E === be }) }),
        D.map((l) => /* @__PURE__ */ a(Ye, { label: `${l.label} (${l.count})`, active: E === l.id, onClick: () => K(l.id), hue: Fa(l.label), children: qa(l.label) }, l.id))
      ] }),
      /* @__PURE__ */ u("div", { className: "min-w-0 flex-1", children: [
        x && /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ne, label: "All" }, ...b.map((l) => ({ id: l.id, label: l.id }))].map((l) => /* @__PURE__ */ a(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": O === l.id,
            onClick: () => X(l.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${O === l.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: l.label
          },
          l.id
        )) }),
        /* @__PURE__ */ u("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ u("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ a(ht, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ a("input", { autoFocus: !0, onKeyDown: M, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${m}`, value: k, onChange: (l) => I(l.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ u("div", { className: "relative", children: [
            /* @__PURE__ */ a(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": w,
                onClick: () => R((l) => !l),
                className: `flex h-full items-center rounded-ctl border px-3 ${w ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ a(Kr, { width: 16, height: 16 })
              }
            ),
            w && /* @__PURE__ */ a("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: Er.map((l) => /* @__PURE__ */ a("li", { role: "none", children: /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": g === l.id,
                onClick: () => {
                  f(l.id), R(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${g === l.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  l.label,
                  g === l.id && /* @__PURE__ */ a(Te, { width: 14, height: 14 })
                ]
              }
            ) }, l.id)) })
          ] })
        ] }),
        (v || x) && /* @__PURE__ */ u("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ u("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            E === be ? "Favourites" : "All models",
            " · ",
            z.length
          ] }),
          v && E !== ne && E !== be && /* @__PURE__ */ a("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: E })
        ] }),
        /* @__PURE__ */ u("ul", { id: "ms-listbox", ref: H, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          z.slice(0, Oe).map((l, C) => {
            const G = l.name === t;
            return /* @__PURE__ */ a(
              "li",
              {
                id: `ms-opt-${C}`,
                role: "option",
                "aria-selected": G,
                onClick: () => {
                  r(l.name), h(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${G ? "bg-primary-soft" : C === m ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ u("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ u("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ a("div", { className: `min-w-0 flex-1 truncate text-sm ${G ? "text-primary" : ""}`, title: l.name, children: l.name }),
                    /* @__PURE__ */ a(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(l.name) ? "Remove favorite" : "Add favorite",
                        onClick: (q) => {
                          q.stopPropagation(), o(l.name);
                        },
                        className: n.includes(l.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ a(Mt, { width: 15, height: 15, filled: n.includes(l.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ u("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ a("span", { className: "truncate text-[10px] text-secondary", children: s ? `${l.group_of} · ${l.category}` : v && E === ne ? `${nr(l, D)} · ${l.category}` : l.category }),
                    /* @__PURE__ */ a(Wa, { model: l })
                  ] })
                ] })
              },
              l.name
            );
          }),
          z.length === 0 && /* @__PURE__ */ a("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: g === "favourites" ? "No favourites yet. Tap the heart on a model." : g === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${k}”.` }),
          z.length > Oe && /* @__PURE__ */ u("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Oe,
            " of ",
            z.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const Ot = (e, t) => {
  try {
    const r = localStorage.getItem(e);
    return r ? JSON.parse(r) : t;
  } catch {
    return t;
  }
}, Ke = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, or = 0.25;
function nt(e, t) {
  const r = Qe(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (r[n.prop.name] = t[n.prop.name]);
  return r;
}
function Ka(e, t) {
  const r = nt(e, t);
  for (const n of e)
    t[n.prop.name] === void 0 && (delete r[n.prop.name], et(n) && (r[xe(n.prop.name)] = !0));
  return r;
}
function Xa({ mode: e, models: t, client: r, batch: n, onRun: o, usage: i, reuse: s, switcher: p }) {
  var _e, xt;
  const y = we.find((L) => L.id === e), h = ae(() => Mr(t, e), [t, e]), [k, I] = A(), [g, f] = A(null), [w, R] = A(null), [S, D] = A({}), [b, v] = A(null), [x, N] = A(null), [P, T] = A(() => Ot("muapi-studio:favorites", [])), [$, E] = A("form"), [O, K] = A(!1), [X, H] = A("{}"), [z, m] = A(null), d = j(0), M = j(null), c = j(null), l = j({ payloadKey: "", batch: 0 }), C = j(!1), G = j(0), q = j(null);
  U(() => {
    if (!O) return;
    const L = (W) => {
      var Q;
      (Q = q.current) != null && Q.contains(W.target) || K(!1);
    }, J = (W) => {
      W.key === "Escape" && K(!1);
    };
    return document.addEventListener("mousedown", L), document.addEventListener("keydown", J), () => {
      document.removeEventListener("mousedown", L), document.removeEventListener("keydown", J);
    };
  }, [O]);
  const ie = j(null), te = j(null), ue = j("form");
  U(() => {
    var W, Q, he;
    const L = Ot(`muapi-studio:model:${e}`, null), J = ((W = h.find((le) => le.name === L)) == null ? void 0 : W.name) ?? ((Q = h.find((le) => le.name === Ar[e])) == null ? void 0 : Q.name) ?? ((he = Jt(h, "popular")[0]) == null ? void 0 : he.name);
    I(J);
  }, [e, h]), U(() => {
    if (!s) return;
    ie.current = s.inputs;
    const L = te.current;
    if (L && L.name === s.model) {
      ie.current = null, D(nt(He(L), s.inputs)), E("form");
      return;
    }
    h.some((J) => J.name === s.model) ? (I(s.model), Ke(`muapi-studio:model:${e}`, s.model)) : ie.current = null, E("form");
  }, [s == null ? void 0 : s.nonce]);
  const re = h.find((L) => L.name === k);
  te.current = g, ue.current = $, U(() => {
    if (!k) {
      f(null), D({}), v(null), R(null), N(null), m(null);
      return;
    }
    let L = !0;
    return f(null), R(null), v(null), N(null), m(null), r.model(k).then((J) => {
      if (!L) return;
      const W = He(J), Q = ie.current;
      ie.current = null;
      const he = nt(W, Q);
      f(J), D(he), ue.current === "json" && H(JSON.stringify(Je(W, he), null, 2));
    }).catch((J) => {
      L && R(J.message);
    }), () => {
      L = !1;
    };
  }, [k, r]);
  const oe = ae(() => g ? He(g) : [], [g]), Ie = ae(() => Je(oe, S), [oe, S]), se = ae(() => {
    try {
      const L = JSON.parse(X);
      return L && typeof L == "object" && !Array.isArray(L) ? L : null;
    } catch {
      return null;
    }
  }, [X]), me = $ === "json" ? se ?? {} : Ie, pe = JSON.stringify(me);
  U(() => {
    if (!g || $ === "json" && !se) return;
    const L = ++d.current;
    M.current = null;
    const J = setTimeout(() => {
      r.estimate(g.name, me).then((W) => {
        L === d.current && (v(W), M.current = pe);
      }).catch(() => {
        L === d.current && v(null);
      });
    }, 500);
    return () => clearTimeout(J);
  }, [g, pe, r]), U(() => {
    m(null);
  }, [n, pe, $]);
  const Fe = (L) => {
    I(L), Ke(`muapi-studio:model:${e}`, L);
  }, Be = (L) => T((J) => {
    const W = J.includes(L) ? J.filter((Q) => Q !== L) : [...J, L];
    return Ke("muapi-studio:favorites", W), W;
  }), F = (L) => {
    K(!1), L !== $ && (L === "json" ? H(JSON.stringify(Ie, null, 2)) : se && D(Ka(oe, se)), E(L), N(null));
  }, B = re ? ve(re, b) : null;
  l.current = { payloadKey: pe, batch: n };
  const de = ee(async (L) => {
    if (!g) return;
    m(null);
    const J = L ?? { payload: me, batch: n, unit: (B == null ? void 0 : B.current) ?? 0 }, W = oe.find((Q) => Q.prop.name === "prompt");
    G.current = Date.now() + 1500, o({
      model: g.name,
      endpointUrl: g.endpoint_url,
      mode: e,
      payload: J.payload,
      count: J.batch,
      kind: ut(g.category),
      prompt: W ? String(J.payload.prompt ?? "") : "",
      unitCost: J.unit
    });
  }, [g, oe, o, e, me, n, B]), ge = ee(async () => {
    var L, J;
    if (!(!g || C.current || Date.now() < G.current)) {
      if ($ === "json") {
        if (!se) {
          N("The JSON is not valid");
          return;
        }
        const W = (g.required_fields ?? []).find((Q) => se[Q] === void 0 || se[Q] === "");
        if (W) {
          N(`${W} is required`);
          return;
        }
      } else {
        const W = va(oe, S);
        if (W) {
          N(W);
          return;
        }
      }
      N(null), C.current = !0;
      try {
        const W = pe, Q = n, he = me;
        let le = (B == null ? void 0 : B.current) ?? 0, vt = !0;
        if (M.current !== W) {
          try {
            le = re ? ((L = ve(re, await r.estimate(g.name, he))) == null ? void 0 : L.current) ?? le : le;
          } catch {
            vt = !1, le = re ? ((J = ve(re, null)) == null ? void 0 : J.current) ?? le : le;
          }
          if (l.current.payloadKey !== W || l.current.batch !== Q) return;
        }
        c.current = { payload: he, batch: Q, unit: le };
        const wt = le * Q;
        if (wt > or || !vt) {
          m(wt);
          return;
        }
        await de(c.current);
      } finally {
        C.current = !1;
      }
    }
  }, [g, $, se, oe, S, B, n, de, pe, re, r, me]), Ne = !!g && !w, Le = (() => {
    var J;
    const L = oe.find((W) => W.kind === "media-list");
    return L ? Math.max(((J = S[L.prop.name]) == null ? void 0 : J.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ u("section", { "aria-label": y.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ u(tr, { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ u("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ a("h2", { className: "text-lg font-semibold", children: y.title }),
        /* @__PURE__ */ u("div", { ref: q, className: "relative", children: [
          /* @__PURE__ */ u("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": O, onClick: () => K((L) => !L), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            $ === "json" ? "JSON" : "Form",
            /* @__PURE__ */ a(Ue, { up: O, width: 12, height: 12 })
          ] }),
          O && /* @__PURE__ */ a("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((L) => /* @__PURE__ */ a("li", { role: "none", children: /* @__PURE__ */ a("button", { role: "menuitemradio", "aria-checked": $ === L, type: "button", onClick: () => F(L), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${$ === L ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: L === "json" ? "JSON" : "Form" }) }, L)) })
        ] })
      ] }),
      p,
      /* @__PURE__ */ a("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ a("div", { className: "mb-5", children: /* @__PURE__ */ a(Ya, { models: h, value: k, onChange: Fe, favorites: P, onToggleFavorite: Be, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ a("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: $ === "json" ? "Request body" : "Parameters" }),
      (re == null ? void 0 : re.description) && /* @__PURE__ */ a("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: re.description }),
      !Ne && !w && k && /* @__PURE__ */ u("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ a(ke, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      w && /* @__PURE__ */ u("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        w
      ] }),
      h.length === 0 && /* @__PURE__ */ a("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      Ne && $ === "json" && /* @__PURE__ */ u("div", { children: [
        /* @__PURE__ */ a("textarea", { "aria-label": "Request JSON", "aria-invalid": !se, spellCheck: !1, rows: 16, value: X, onChange: (L) => H(L.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ a("p", { className: `mt-1.5 text-[11px] ${se ? "text-muted" : "text-danger"}`, children: se ? `Sent as the body of POST /api/v1/${g.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      Ne && $ === "form" && oe.map((L) => /* @__PURE__ */ a(
        _a,
        {
          field: L,
          values: S,
          client: r,
          onError: N,
          tagCount: L.prop.name === "prompt" ? Le : 0,
          onChange: (J, W) => D((Q) => ({ ...Q, [J]: typeof W == "function" ? W(Q[J]) : W }))
        },
        L.prop.name
      ))
    ] }),
    /* @__PURE__ */ u("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      x && /* @__PURE__ */ a("p", { role: "alert", className: "mb-2 text-xs text-danger", children: x }),
      z !== null && /* @__PURE__ */ u("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: ce(z) }),
        " (",
        ((_e = c.current) == null ? void 0 : _e.batch) ?? n,
        " × ",
        ce(((xt = c.current) == null ? void 0 : xt.unit) ?? (B == null ? void 0 : B.current) ?? 0),
        ").",
        /* @__PURE__ */ u("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ a("button", { type: "button", onClick: () => void de(c.current ?? void 0), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => m(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ u("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ a("button", { type: "button", onClick: () => {
          g && (D(Qe(oe)), H(JSON.stringify(Je(oe, Qe(oe)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: () => void ge(),
            disabled: !Ne,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ a(pt, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              B && /* @__PURE__ */ u("span", { className: "font-normal", children: [
                "(",
                B.original !== null ? /* @__PURE__ */ u(Ve, { children: [
                  /* @__PURE__ */ a("s", { className: "opacity-60", children: ce(B.original * n) }),
                  " "
                ] }) : null,
                ce(B.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Za = {
  image: Pe,
  video: Fr,
  audio: Br,
  avatar: zr,
  "3d": mt,
  "ai-tools": Hr,
  text: Xr,
  more: Zr
};
function Qa({ mode: e, onChange: t, layout: r = "rail", onChangeKey: n }) {
  return r === "tabs" ? /* @__PURE__ */ u("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    we.map((o) => {
      const i = o.id === e;
      return /* @__PURE__ */ u(
        "button",
        {
          onClick: () => t(o.id),
          "aria-current": i ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${i ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            o.label,
            i && /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        o.id
      );
    }),
    n && /* @__PURE__ */ u("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ a(Et, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ u("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    we.map((o) => {
      const i = Za[o.id], s = o.id === e;
      return /* @__PURE__ */ u(
        "button",
        {
          onClick: () => t(o.id),
          "aria-current": s ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${s ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ a(i, {}),
            o.label
          ]
        },
        o.id
      );
    }),
    n && /* @__PURE__ */ u("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ a(Et, {}),
      "Key"
    ] })
  ] });
}
const en = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, jt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, tn = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], rn = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], an = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], nn = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), Pt = { minimax: "2k" }, on = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], sn = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), ln = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], cn = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], dn = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], un = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], mn = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), pn = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], hn = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), fn = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], ir = {
  seedream: { aspect: tn, resolution: rn },
  seedance: { aspect: an, duration: nn },
  minimax: { resolution: on, duration: sn },
  wan: { aspect: ln, resolution: cn, quality: dn, duration: un },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, gn = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, Se = (e, t, r = !1) => ({ id: e, label: t, kind: "image", optional: r });
function sr(e) {
  return ((r) => r.map((n, o) => {
    var i;
    return { ...n, label: ((i = en[e.slug]) == null ? void 0 : i[o]) ?? n.label };
  }))(bn(e));
}
function bn(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [Se("base", "Target base image"), Se("face", "New face image")];
    case "video-face-swap":
      return [Se("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [Se("start", "Starting frame image"), Se("end", "Ending frame image", !0)];
    default:
      return [Se("source", "Source image")];
  }
}
function yn(e) {
  return gn[e.template];
}
function Vt(e) {
  var n, o, i, s, p, y, h, k, I, g, f, w, R;
  const t = ir[e.template], r = {};
  for (const S of e.sliders ?? []) r[S.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: r,
    aspect: (i = (o = t.aspect) == null ? void 0 : o[0]) == null ? void 0 : i.value,
    resolution: Pt[e.template] && ((p = (s = t.resolution) == null ? void 0 : s.find((S) => S.value === Pt[e.template])) == null ? void 0 : p.value) || ((h = (y = t.resolution) == null ? void 0 : y[0]) == null ? void 0 : h.value),
    duration: ((I = (k = t.duration) == null ? void 0 : k.find((S) => S.value === 5)) == null ? void 0 : I.value) ?? ((f = (g = t.duration) == null ? void 0 : g[0]) == null ? void 0 : f.value),
    quality: (R = (w = t.quality) == null ? void 0 : w[0]) == null ? void 0 : R.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function lr(e, t) {
  var o;
  const r = [e.prompt], n = (o = e.presets) == null ? void 0 : o.find((i) => i.id === t.preset);
  n != null && n.prompt && r.push(n.prompt);
  for (const i of e.sliders ?? []) {
    const s = t.sliders[i.id] ?? 0;
    if (s !== 0) {
      const p = i.phrase(s);
      p && r.push(p);
    }
  }
  return t.refinement.trim() && r.push(t.refinement.trim()), r.filter(Boolean).join(" ");
}
function Ut(e, t, r) {
  var i;
  const n = (i = e.presets) == null ? void 0 : i.find((s) => s.id === r), o = { ...Object.fromEntries((e.sliders ?? []).map((s) => [s.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: r, sliders: o };
}
function xn(e, t) {
  for (const r of sr(e)) if (!r.optional && !t.uploads[r.id]) return `${r.label} is required`;
  return null;
}
function vn(e, t) {
  const r = lr(e, t), n = t.uploads;
  switch (e.template) {
    case "seedream":
      return { prompt: r, images_list: [n.source], aspect_ratio: t.aspect, resolution: t.resolution };
    case "seedance":
      return { prompt: r, images_list: [n.source], aspect_ratio: t.aspect, duration: Number(t.duration) };
    case "minimax":
      return { prompt: r, image_url: n.start, ...n.end ? { last_image_url: n.end } : {}, resolution: t.resolution, duration: Number(t.duration) };
    case "wan":
      return { prompt: r, image_url: n.start, ...n.end ? { last_image: n.end } : {}, aspect_ratio: t.aspect, resolution: t.resolution, quality: t.quality, duration: Number(t.duration) };
    case "skin":
      return { image_url: n.source };
    case "face-swap":
      return { image_url: n.base, swap_url: n.face, target_index: t.targetIndex };
    case "video-face-swap":
      return { image_url: n.face, video_url: n.video, target_gender: t.gender, target_index: t.targetIndex };
    case "bg-remover":
      return { video_url: n.video, background_color: t.background, output_container_and_codec: t.container, preserve_audio: t.keepAudio };
  }
}
function wn(e) {
  return jt[e.slug] ? jt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const kn = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], _ = (e, t, r, n, o) => ({ id: e, label: t, hint: r, prompt: n, values: o }), ot = (e, t, r, n = "") => `${e > 0 ? t : r} ${Math.abs(e)}${n}`, Y = (e, t, r, n, o, i, s = {}) => ({ slug: e, name: t, emoji: r, category: n, badge: "IMAGE", template: "seedream", blurb: o, prompt: i, ...s }), V = (e, t, r, n, o, i, s = {}) => ({ slug: e, name: t, emoji: r, category: n, badge: "VIDEO", template: "seedance", blurb: o, prompt: i, ...s }), je = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${ot(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${ot(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Nn = [je[2], { ...je[1], id: "vertical", label: "Vertical angle" }, je[0]].map((e) => ({ ...e, id: e.id })), Sn = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${ot(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Cn = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], An = "Keep the result tasteful and suitable for general audiences.", cr = [
  // ---- Professional
  Y(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: je, presets: [
      _("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      _("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      _("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      _("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      _("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      _("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      _("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  Y(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  Y(
    "shots",
    "Shots",
    "🎥",
    "professional",
    "Reframe one photo as different cinematic shot types.",
    "Reframe this scene as a professional cinematic shot while keeping the same subject and setting.",
    { presets: [
      _("wide", "Wide", void 0, "Use a wide establishing shot."),
      _("medium", "Medium", void 0, "Use a medium shot from the waist up."),
      _("close", "Close-up", void 0, "Use a close-up on the subject’s face or key detail."),
      _("xcu", "Extreme close-up", void 0, "Use an extreme close-up on a small detail."),
      _("ots", "Over-the-shoulder", void 0, "Use an over-the-shoulder shot."),
      _("low", "Low angle", void 0, "Shoot from a low angle looking up."),
      _("high", "High angle", void 0, "Shoot from a high angle looking down."),
      _("dutch", "Dutch angle", void 0, "Tilt the camera for a Dutch angle.")
    ] }
  ),
  Y(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Nn.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
  ),
  V(
    "behind-the-scenes",
    "Behind the Scenes",
    "🎞️",
    "professional",
    "Pull back from the photo to reveal the film set around it.",
    "Start on this photograph, then pull the camera back to reveal it is a film set with lighting rigs, cameras and crew working around the scene."
  ),
  V(
    "transitions",
    "Transitions",
    "🔄",
    "professional",
    "Animate a smooth cinematic transition out of the image.",
    "Create a smooth, professional cinematic transition starting from this image with fluid motion.",
    { presets: [
      _("morph", "Morph", void 0, "Use a morph transition."),
      _("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      _("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      _("whip", "Whip pan", void 0, "Use a fast whip pan."),
      _("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  Y(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  Y(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: Cn, presets: [
      _("natural", "Natural", "Clean, true to life", void 0, { saturation: 5, contrast: 5 }),
      _("cinematic", "Cinematic", "Teal and orange", "Give it a cinematic teal and orange look.", { contrast: 20, saturation: 10, temperature: -5 }),
      _("split", "Split tone", "Warm highlights, cool shadows", "Use split toning with warm highlights and cool shadows.", { contrast: 10 }),
      _("softskin", "Soft skin", "Gentle and flattering", "Soften skin tones gently.", { contrast: -10, highlights: -10 }),
      _("oldlens", "Old lens", "Vintage glass", "Mimic a vintage lens with soft edges and subtle flare.", { saturation: -10, grain: 20 }),
      _("film16", "16mm film", "Grain and warmth", "Mimic 16mm film stock.", { temperature: 15, grain: 55, contrast: 10 }),
      _("moody", "Moody", "Dark and desaturated", "Make it dark and moody.", { exposure: -20, saturation: -25, contrast: 25 })
    ] }
  ),
  // ---- Enhance & Style
  Y(
    "ai-stylist",
    "AI Stylist",
    "👗",
    "enhance-style",
    "Try outfit styles on your photo while keeping your pose.",
    "Restyle the person in this photo with a new outfit while keeping their face, pose and the background natural.",
    { presets: [
      _("casual", "Casual", void 0, "Dress them in a relaxed casual outfit."),
      _("formal", "Formal", void 0, "Dress them in a sharp formal outfit."),
      _("street", "Streetwear", void 0, "Dress them in streetwear."),
      _("athletic", "Athletic", void 0, "Dress them in athletic wear."),
      _("evening", "Evening", void 0, "Dress them in an elegant evening outfit."),
      _("vintage", "Vintage", void 0, "Dress them in a vintage-style outfit.")
    ] }
  ),
  Y(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Sn }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  Y(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  Y(
    "style-snap",
    "Style Snap",
    "📸",
    "enhance-style",
    "Quick style makeovers that keep your pose.",
    "Give the person a new fashion style while keeping the same pose, face and setting.",
    { presets: [
      _("boho", "Boho chic", void 0, "Use a boho chic look."),
      _("minimal", "Minimalist", void 0, "Use a clean minimalist look."),
      _("punk", "Punk rock", void 0, "Use a punk rock look."),
      _("preppy", "Preppy", void 0, "Use a preppy look."),
      _("y2k", "Y2K", void 0, "Use an early-2000s Y2K look."),
      _("cottage", "Cottagecore", void 0, "Use a cottagecore look.")
    ] }
  ),
  Y(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  Y(
    "glitter-sticker",
    "Glitter Sticker",
    "🌟",
    "enhance-style",
    "Turn a portrait into a holographic glitter sticker on a street wall.",
    "Turn this portrait into a shiny holographic glitter sticker stuck onto a gritty urban surface."
  ),
  V(
    "outfit-shot",
    "Outfit Shot",
    "🧥",
    "enhance-style",
    "A short photoshoot-style video that shows off the outfit.",
    "Create a short fashion photoshoot video of this outfit with natural poses and smooth camera movement."
  ),
  // ---- Face & Identity
  {
    slug: "recast",
    name: "Recast",
    emoji: "🎭",
    category: "face-identity",
    badge: "VIDEO",
    template: "wan",
    consent: !0,
    blurb: "Bring a character image to life as a video, with optional end frame.",
    prompt: "Animate this character naturally with lifelike body motion and expression, keeping their identity and outfit consistent.",
    uploads: [{ id: "start", label: "Character image", kind: "image" }, { id: "end", label: "Ending frame image", kind: "image", optional: !0 }]
  },
  Y(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  Y(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  Y(
    "headshot-generator",
    "Headshot Generator",
    "📷",
    "face-identity",
    "Studio-style professional headshots from a photo.",
    "Create a professional studio headshot of this person: flattering lighting, clean background, natural expression and sharp focus on the face.",
    { consent: !0, presets: [
      _("corporate", "Corporate", void 0, "Use a classic corporate look."),
      _("creative", "Creative", void 0, "Use a modern creative look with a colored backdrop."),
      _("linkedin", "LinkedIn", void 0, "Frame it as a friendly LinkedIn profile photo."),
      _("exec", "Executive", void 0, "Use an authoritative executive look.")
    ] }
  ),
  // ---- Video Editing
  {
    slug: "clipcut",
    name: "ClipCut",
    emoji: "✂️",
    category: "video-editing",
    badge: "VIDEO",
    template: "minimax",
    blurb: "A fast fashion-style montage clip from a starting frame.",
    prompt: "Create a fast, stylish montage with quick cuts between outfits and poses based on this person, energetic and rhythmic."
  },
  {
    slug: "urban-cuts",
    name: "Urban Cuts",
    emoji: "🎵",
    category: "video-editing",
    badge: "VIDEO",
    template: "minimax",
    blurb: "Beat-style urban outfit video with dynamic cuts.",
    prompt: "Create a dynamic urban street-style video with sharp rhythmic cuts, strong movement and varied outfits for this person."
  },
  {
    slug: "sticker-matchcut",
    name: "Sticker Match Cut",
    emoji: "✨",
    category: "video-editing",
    badge: "VIDEO",
    template: "minimax",
    blurb: "Turn a clip into a glittery sticker animation.",
    prompt: "Turn this into a playful animation where the subject becomes a sparkling holographic sticker, with match cuts between sticker frames."
  },
  Y(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  Y(
    "japanese-show",
    "Japanese Show",
    "📺",
    "video-editing",
    "Retro variety-show look with CRT scanlines.",
    "Turn this photo into a still from a retro 2000s Japanese variety show, with CRT scanlines, on-screen captions and broadcast effects."
  ),
  { slug: "video-bg-remover", name: "Video Background Remover", emoji: "🎬", category: "video-editing", badge: "VIDEO", template: "bg-remover", blurb: "Remove the background from a video.", prompt: "" },
  // ---- Ads & Products (the uploaded image is the product or subject)
  V("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  V("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  V("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  Y("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
  V("bullet-time-scene", "Bullet Time Scene", "⏱️", "ads", "Frozen-moment bullet-time camera move.", "Create a bullet-time effect: time freezes while the camera sweeps around the subject and product in the image."),
  V("chameleon", "Chameleon", "🦎", "ads", "A character changes to match the product’s look.", "Show the character smoothly transforming their outfit and colors to match the brand look of the product in the image."),
  V("asmr-host", "ASMR Host", "🎙️", "ads", "A whispering host presents the product.", "Create an ASMR presentation where a soft-spoken host presents the product from the image up close."),
  V("packshot", "Packshot", "📦", "ads", "Polished product showcase with slow rotation.", "Create a clean studio packshot video of the product in the image, slowly rotating under soft studio lighting."),
  V("macro-scene", "Macro Scene", "🔬", "ads", "Extreme close-up of product details.", "Create an extreme macro close-up video that glides over the textures and details of the product in the image."),
  V("magic-button", "Magic Button", "✨", "ads", "The product appears in a burst of light.", "Show the product from the image appearing magically in a burst of light and drifting particles."),
  V("truck-ad", "Truck Ad", "🚛", "ads", "Product displayed on a truck driving through a city.", "Show the product from the image printed large on the side of a truck driving through a busy city street."),
  V("giant-product", "Giant Product", "🦖", "ads", "A building-sized product towering over a person.", "Create a surreal scene where the product from the image is as tall as a building, towering over a small person on the street."),
  V("bullet-time-white", "Bullet Time White", "⚪", "ads", "360° rotation on a clean white background.", "Create a bullet-time 360 degree rotation around the subject and product in the image on a clean white background."),
  V("kick-ad", "Kick Ad", "🦵", "ads", "A character kicks the product into frame.", "Create an energetic action ad where a character kicks the product from the image into the frame."),
  V("billboard-ad", "Billboard Ad", "🏙️", "ads", "Product on a glowing billboard at night.", "Show the product from the image on a huge glowing billboard in a busy city at night."),
  Y("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  V("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  V("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  V("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  Y("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  Y(
    "game-dump",
    "Game Dump",
    "🎮",
    "games-characters",
    "See yourself as a hero in different game genres.",
    "Transform the person in this photo into a video game character with a game-style interface overlay, keeping their likeness.",
    { presets: [
      _("fps", "FPS shooter", void 0, "Use a first-person shooter look."),
      _("rpg", "RPG fantasy", void 0, "Use a fantasy role-playing game look."),
      _("racing", "Racing", void 0, "Use a racing game look."),
      _("fighting", "Fighting", void 0, "Use a fighting game look."),
      _("horror", "Survival horror", void 0, "Use a survival horror game look."),
      _("sports", "Sports", void 0, "Use a sports game look."),
      _("open", "Open world", void 0, "Use an open-world adventure game look."),
      _("platform", "Platformer", void 0, "Use a colorful platformer look.")
    ] }
  ),
  Y("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  Y("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  Y("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  Y("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  Y("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  Y("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  Y(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [_("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), _("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), _("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), _("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  Y("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  V("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  V("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${An}`),
  V("roller-coaster", "Roller Coaster", "🎢", "trending-templates", "A thrilling roller-coaster ride.", "Put the person from this photo on a roller coaster ride with wind, speed and a dramatic camera."),
  V("60s-cafe", "60s Cafe", "☕", "trending-templates", "A vintage 1960s cafe scene.", "Place the person from this photo in a vintage 1960s cafe with retro decor, warm film tones and gentle motion."),
  V("victory-card", "Victory Card", "🃏", "trending-templates", "A winning playing-card moment.", "Turn this photo into a winning playing card, with the person triumphant as the card flips and glows."),
  V("sand-worm", "Sand Worm", "🐛", "trending-templates", "An epic desert creature scene.", "Place the person from this photo in an epic desert scene with a giant sand creature rising behind them."),
  V("skibidi", "Toilet Meme", "🚽", "trending-templates", "A silly toilet-character meme look.", "Turn this photo into a goofy toilet-themed meme character with exaggerated head bobbing."),
  V("j-poster", "J Poster", "🎌", "trending-templates", "A Japanese-style poster.", "Turn this photo into a bold Japanese-style poster with dramatic typography and animated accents."),
  V("mascot", "Mascot", "🏈", "trending-templates", "A sports mascot character.", "Transform the person in this photo into an energetic sports mascot character cheering in a stadium."),
  V("storm-creature", "Storm Creature", "⛈️", "trending-templates", "An epic storm creature scene.", "Place the person from this photo in a stormy sky scene with a giant creature made of clouds and lightning."),
  V("burning-sunset", "Burning Sunset", "🌅", "trending-templates", "An epic burning-sunset scene.", "Place the person from this photo against an epic burning sunset sky with drifting embers."),
  V("on-fire", "On Fire", "🔥", "trending-templates", "A calm-in-chaos burning-room meme scene.", "Show the person from this photo calmly sitting in a room that is on fire, in a humorous cartoon-like meme style."),
  V("comic-book", "Comic Book", "💥", "trending-templates", "Comic-book panels and action lines.", "Turn this photo into an animated comic-book page with bold ink lines, halftone dots and action bursts."),
  V("cloud-surf", "Cloud Surf", "☁️", "trending-templates", "Surfing on dreamy pink clouds.", "Show the person from this photo surfing on a wave of dreamy pink clouds at sunset."),
  V("mukbang", "Mukbang", "🍜", "trending-templates", "A viral eating-show scene.", "Turn this photo into a viral eating-show video with the person enjoying a big spread of food at a table."),
  V("melting-doodle", "Melting Doodle", "🫠", "trending-templates", "Mesmerizing melting doodle art.", "Turn this photo into colorful doodle art that slowly melts and swirls."),
  V("giallo-horror", "Giallo Horror", "🩸", "trending-templates", "A stylised 1970s thriller scene.", "Turn this photo into a stylised 1970s Italian thriller scene with saturated colors, dramatic shadows and a suspenseful camera move. Keep it non-graphic."),
  V("renaissance", "Renaissance", "🖼️", "trending-templates", "A classical gallery painting.", "Turn this photo into a classical Renaissance oil painting hanging in a gallery, subtly coming to life."),
  V("rap-god", "Rap God", "🎤", "trending-templates", "A rap-video style clip.", "Turn this photo into a stylish rap music video clip with the person performing, with dynamic lighting and camera moves.")
], qe = (e) => cr.find((t) => t.slug === e), it = (e) => e.badge === "VIDEO" ? "video" : "image", yt = (e) => cr.filter((t) => it(t) === e), st = (e) => yt(e).length > 0;
function dr(e) {
  const t = new URLSearchParams(e), r = t.get("tab"), n = qe(t.get("app"));
  return r === "apps" ? { mode: n ? it(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && r === it(n) ? { mode: r, app: n.slug } : { mode: null, app: null };
}
function In(e, t, r) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), r ? n.set("app", r) : n.delete("app"), `?${n.toString()}`;
}
function Mn(e, t, r) {
  return `${e.pathname}${In(e.search, t, r)}${e.hash}`;
}
function En(e, t) {
  const r = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!r || `${n.name} ${n.blurb}`.toLowerCase().includes(r)));
}
const Tn = (e) => kn.filter((t) => yt(e).some((r) => r.category === t.id));
function $n({ mode: e, value: t, onChange: r }) {
  const [n, o] = A(!1), [i, s] = A(""), [p, y] = A("all"), [h, k] = A(0), I = j(null), g = ae(() => Tn(e), [e]), f = ae(() => En(yt(e), { category: p, q: i }), [e, p, i]), w = qe(t);
  U(() => k(0), [i, p, n]), U(() => {
    if (!n) return;
    const b = (x) => {
      var N;
      (N = I.current) != null && N.contains(x.target) || o(!1);
    }, v = (x) => {
      x.key === "Escape" && o(!1);
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", v), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", v);
    };
  }, [n]), U(() => {
    var b, v;
    (v = (b = document.getElementById(`ms-app-${h}`)) == null ? void 0 : b.scrollIntoView) == null || v.call(b, { block: "nearest" });
  }, [h]);
  const R = (b) => {
    r(b), o(!1), s("");
  }, S = (b) => {
    b.key === "ArrowDown" ? (b.preventDefault(), k((v) => Math.min(v + 1, f.length - 1))) : b.key === "ArrowUp" ? (b.preventDefault(), k((v) => Math.max(v - 1, 0))) : b.key === "Enter" && f[h] && (b.preventDefault(), R(f[h].slug));
  }, D = (b) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${b ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ u("div", { ref: I, className: "relative", children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => o((b) => !b),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (w == null ? void 0 : w.emoji) ?? "✨" }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", children: (w == null ? void 0 : w.name) ?? "Choose an app" }),
          /* @__PURE__ */ a(Ue, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ u("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ u("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ a(ht, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ a("input", { autoFocus: !0, onKeyDown: S, value: i, onChange: (b) => s(b.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ u("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ a("button", { role: "tab", type: "button", "aria-selected": p === "all", onClick: () => y("all"), className: D(p === "all"), children: "All" }),
        g.map((b) => /* @__PURE__ */ a("button", { role: "tab", type: "button", "aria-selected": p === b.id, onClick: () => y(b.id), className: D(p === b.id), children: b.label }, b.id))
      ] }),
      /* @__PURE__ */ u("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        f.map((b, v) => /* @__PURE__ */ u(
          "li",
          {
            id: `ms-app-${v}`,
            role: "option",
            "aria-selected": b.slug === t,
            onClick: () => R(b.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${b.slug === t ? "bg-primary-soft" : v === h ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-lg", children: b.emoji }),
              /* @__PURE__ */ u("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ a("div", { className: `truncate text-sm ${b.slug === t ? "text-primary" : ""}`, children: b.name }),
                /* @__PURE__ */ a("div", { className: "truncate text-[10px] text-secondary", children: b.blurb })
              ] })
            ]
          },
          b.slug
        )),
        f.length === 0 && /* @__PURE__ */ u("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          i,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const Ln = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), Me = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function _n({ mode: e, slug: t, onApp: r, switcher: n, models: o, client: i, batch: s, onRun: p }) {
  const y = qe(t), h = we.find((k) => k.id === e).title;
  return /* @__PURE__ */ u("section", { "aria-label": h, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ u("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ a("h2", { className: "mb-4 text-lg font-semibold", children: h }),
      n,
      /* @__PURE__ */ a("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ a("div", { className: "relative z-20", children: /* @__PURE__ */ a($n, { mode: e, value: t, onChange: r }) })
    ] }),
    y ? /* @__PURE__ */ a(Dn, { app: y, mode: e, models: o, client: i, batch: s, onRun: p }, y.slug) : /* @__PURE__ */ a("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Dn({ app: e, mode: t, models: r, client: n, batch: o, onRun: i }) {
  var m, d, M;
  const [s, p] = A(() => Vt(e)), [y, h] = A(null), [k, I] = A(null), [g, f] = A(null), w = j(0), R = j(null), S = j(null), D = j({ payloadKey: "", batch: 0 }), b = j(!1), v = j(0);
  U(() => {
    p(Vt(e)), h(null), I(null), f(null);
  }, [e]);
  const x = yn(e), N = r.find((c) => c.name === x), P = ir[e.template], T = ae(() => vn(e, s), [e, s]), $ = JSON.stringify(T), E = (c) => p((l) => ({ ...l, ...c }));
  U(() => {
    if (!N) return;
    const c = ++w.current;
    R.current = null;
    const l = setTimeout(() => {
      n.estimate(x, T).then((C) => {
        c === w.current && (I(C), R.current = $);
      }).catch(() => {
        c === w.current && I(null);
      });
    }, 500);
    return () => clearTimeout(l);
  }, [$, N, n]), U(() => {
    f(null);
  }, [o, $]);
  const O = N ? ve(N, k) : null;
  D.current = { payloadKey: $, batch: o };
  const K = sr(e), X = async (c) => {
    if (!N) return;
    f(null);
    const l = c ?? { payload: T, batch: o, unit: (O == null ? void 0 : O.current) ?? 0 };
    v.current = Date.now() + 1500, i({ model: x, endpointUrl: N.endpoint_url, mode: t, prompt: lr(e, s) || e.name, payload: l.payload, count: l.batch, kind: ut(N.category), unitCost: l.unit });
  }, H = async () => {
    var l, C;
    if (b.current || Date.now() < v.current) return;
    const c = xn(e, s);
    if (c) {
      h(c);
      return;
    }
    h(null), b.current = !0;
    try {
      const G = $, q = o, ie = T;
      let te = (O == null ? void 0 : O.current) ?? 0, ue = !0;
      if (N && R.current !== G) {
        try {
          te = ((l = ve(N, await n.estimate(x, ie))) == null ? void 0 : l.current) ?? te;
        } catch {
          ue = !1, te = ((C = ve(N, null)) == null ? void 0 : C.current) ?? te;
        }
        if (D.current.payloadKey !== G || D.current.batch !== q) return;
      }
      S.current = { payload: ie, batch: q, unit: te };
      const re = te * q;
      if (re > or || !ue) {
        f(re);
        return;
      }
      await X(S.current);
    } finally {
      b.current = !1;
    }
  }, z = (c, l, C, G) => l && l.length > 0 ? /* @__PURE__ */ u("div", { className: "mb-5", children: [
    /* @__PURE__ */ a("div", { className: Me, children: c }),
    /* @__PURE__ */ a(rt, { label: c, options: Ln(l), value: C, onChange: G })
  ] }) : null;
  return /* @__PURE__ */ u("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ u(tr, { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ a("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ a("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !N && /* @__PURE__ */ u("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        x,
        "”, which is not in your catalog right now."
      ] }),
      K.map((c) => /* @__PURE__ */ u("div", { className: "mb-5", children: [
        /* @__PURE__ */ u("div", { className: Me, children: [
          /* @__PURE__ */ a("span", { children: c.label }),
          /* @__PURE__ */ a("span", { className: "text-[11px] text-primary", children: c.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ a(
          at,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: s.uploads[c.id] ? [s.uploads[c.id]] : [],
            field: { prop: { name: `${c.kind}_${c.id}`, title: c.label, field: c.kind }, kind: "media", required: !c.optional },
            onUrls: (l) => p((C) => ({ ...C, uploads: { ...C.uploads, [c.id]: l[0] ?? "" } })),
            onError: h
          }
        )
      ] }, c.id)),
      e.presets && /* @__PURE__ */ u("div", { className: "mb-5", children: [
        /* @__PURE__ */ a("div", { className: Me, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ a(rt, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((c) => ({ value: c.id, label: c.label, hint: c.hint }))], value: s.preset, onChange: (c) => p(Ut(e, s, String(c))) })
      ] }),
      e.sliders && /* @__PURE__ */ a("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (m = e.sliders) == null ? void 0 : m.map((c) => /* @__PURE__ */ u("div", { className: "mb-4", children: [
        /* @__PURE__ */ u("div", { className: Me, children: [
          /* @__PURE__ */ a("label", { htmlFor: `ms-sl-${c.id}`, children: c.label }),
          /* @__PURE__ */ u("span", { className: "tabular-nums text-primary", children: [
            s.sliders[c.id] ?? 0,
            c.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ a("input", { id: `ms-sl-${c.id}`, type: "range", min: c.min, max: c.max, step: c.step, value: s.sliders[c.id] ?? 0, className: "w-full", onChange: (l) => E({ sliders: { ...s.sliders, [c.id]: Number(l.target.value) } }) })
      ] }, c.id)),
      e.sliders && /* @__PURE__ */ a("button", { type: "button", onClick: () => p(Ut(e, s, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ u("div", { className: "mb-5", children: [
        /* @__PURE__ */ u("div", { className: Me, children: [
          "Prompt refinement ",
          /* @__PURE__ */ a("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ a("textarea", { "aria-label": "Prompt refinement", rows: 3, value: s.refinement, onChange: (c) => E({ refinement: c.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      z("Aspect Ratio", P.aspect, s.aspect, (c) => E({ aspect: c })),
      z(e.template === "seedream" ? "Output Resolution" : "Resolution", P.resolution, s.resolution, (c) => E({ resolution: c })),
      z("Quality Level", P.quality, s.quality, (c) => E({ quality: String(c) })),
      z("Duration", P.duration, s.duration, (c) => E({ duration: Number(c) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && z("Target Face Index", mn, s.targetIndex, (c) => E({ targetIndex: Number(c) })),
      e.template === "video-face-swap" && z("Target Gender Filter", pn, s.gender, (c) => E({ gender: String(c) })),
      e.template === "bg-remover" && /* @__PURE__ */ u(Ve, { children: [
        z("Background Color", hn, s.background, (c) => E({ background: String(c) })),
        z("Output Container & Codec", fn, s.container, (c) => E({ container: String(c) })),
        /* @__PURE__ */ u("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ a("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ a("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": s.keepAudio, onClick: () => E({ keepAudio: !s.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${s.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ a("span", { className: `h-5 w-5 rounded-full ${s.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ u("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      y && /* @__PURE__ */ a("p", { role: "alert", className: "mb-2 text-xs text-danger", children: y }),
      g !== null && /* @__PURE__ */ u("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: ce(g) }),
        " (",
        ((d = S.current) == null ? void 0 : d.batch) ?? o,
        " × ",
        ce(((M = S.current) == null ? void 0 : M.unit) ?? (O == null ? void 0 : O.current) ?? 0),
        ").",
        /* @__PURE__ */ u("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ a("button", { type: "button", onClick: () => void X(S.current ?? void 0), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => f(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ u("button", { type: "button", disabled: !N, onClick: () => void H(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ a(pt, { width: 16, height: 16, className: "shrink-0" }),
        wn(e),
        o > 1 ? ` ×${o}` : "",
        O && O.current > 0 && /* @__PURE__ */ u("span", { className: "font-normal", children: [
          "(",
          ce(O.current * o),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function qt({ view: e, onChange: t }) {
  return /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Generate with", className: "mb-4 flex rounded-full border border-line bg-card-bg p-0.5", children: ["models", "apps"].map((r) => /* @__PURE__ */ a(
    "button",
    {
      role: "tab",
      type: "button",
      "aria-selected": e === r,
      onClick: () => t(r),
      className: `flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${e === r ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
      children: r === "models" ? "Models" : "Apps"
    },
    r
  )) });
}
function Rn() {
  try {
    const e = window.location.search, t = dr(e);
    if (t.mode) return t.mode;
    const r = new URLSearchParams(e).get("tab");
    return Ir(r) ? r : null;
  } catch {
    return null;
  }
}
const Ee = {
  get: (e) => {
    try {
      return localStorage.getItem(e);
    } catch {
      return null;
    }
  },
  set: (e, t) => {
    try {
      t === null ? localStorage.removeItem(e) : localStorage.setItem(e, t);
    } catch {
    }
  }
};
function Ft(e) {
  if (!st(e)) return { view: "models", app: null };
  try {
    const r = dr(window.location.search);
    if (r.mode === e && r.app) return { view: "apps", app: r.app };
    if (r.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = Ee.get(`muapi-studio:app:${e}`);
  return { view: Ee.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: qe(t) ? t : null };
}
function Gn({ scope: e, apiBase: t = "/api/muapi", initialTab: r = "image", showHeader: n = !0, title: o = "Studio", teamId: i, theme: s = "lime", layout: p, apiKey: y, onRequestApiKey: h, getHeaders: k, connected: I, fetchImpl: g, features: f, className: w = "", onTabChange: R }) {
  const S = I === !1 || y === "" || y === null, D = j(k);
  D.current = k;
  const [b, v] = A(!1), x = ae(() => new br(t, i, { apiKey: y || void 0, getHeaders: () => {
    var F;
    return ((F = D.current) == null ? void 0 : F.call(D)) ?? {};
  }, fetchImpl: g, onKeyRejected: () => v(!0) }), [t, i, y, g]);
  U(() => v(!1), [x]);
  const [N, P] = A({ library: !0, deleteMedia: !0 }), T = ae(() => ({ library: N.library && (f == null ? void 0 : f.library) !== !1, deleteMedia: (f == null ? void 0 : f.deleteMedia) !== !1 }), [N, f == null ? void 0 : f.library, f == null ? void 0 : f.deleteMedia]), $ = p ?? Sr(s), [E, O] = A(() => Rn() ?? r), [K, X] = A(4), [H, z] = A(null), [m, d] = A(null), [M, c] = A(null), l = ee(() => {
    x.balance().then(c).catch(() => c(null));
  }, [x]), [C, G] = A(null), q = Pr(x, H, l, e, !S), ie = ae(() => Dr(q.items), [q.items]);
  U(() => {
    S || (d(null), z(null), x.models().then(z).catch((F) => d(F.message)), l(), (f == null ? void 0 : f.library) !== !1 && x.probe().then(P));
  }, [x, l, S, f == null ? void 0 : f.library]);
  const [te, ue] = A(() => Ft(E)), re = (F, B) => {
    try {
      window.history.replaceState(null, "", Mn(window.location, F, B));
    } catch {
    }
  }, oe = (F) => {
    const B = Ft(F);
    O(F), ue(B), R == null || R(F), re(F, B.view === "apps" ? B.app : null);
  }, Ie = (F) => {
    ue((B) => ({ ...B, view: F })), Ee.set(`muapi-studio:view:${E}`, F), re(E, F === "apps" ? te.app : null);
  }, se = (F) => {
    ue({ view: "apps", app: F }), Ee.set(`muapi-studio:app:${E}`, F), Ee.set(`muapi-studio:view:${E}`, "apps"), re(E, F);
  }, me = ee(async (F) => {
    await q.run(F);
  }, [q.run]), pe = ee((F) => {
    var de;
    const B = H == null ? void 0 : H.find((ge) => ge.name === F);
    return B ? ((de = B.sale) == null ? void 0 : de.from) ?? B.cost ?? void 0 : void 0;
  }, [H]), Fe = ee((F) => {
    O(F.mode), ue((B) => ({ ...B, view: "models" })), G({ model: F.model, inputs: F.inputs, nonce: Date.now() });
  }, []), Be = ee(async (F) => {
    var Le;
    const B = H == null ? void 0 : H.find((_e) => _e.name === F.model);
    if (!B) return;
    let de = ((Le = B.sale) == null ? void 0 : Le.from) ?? B.cost ?? 0, ge = !1;
    try {
      de = (await x.estimate(F.model, F.inputs)).cost, ge = !0;
    } catch {
    }
    const Ne = ge ? "" : " (the exact price could not be checked)";
    (de > 0.25 || !ge) && !window.confirm(`Re-run ${F.model} for about $${de.toFixed(2)}?${Ne}`) || q.run({ model: F.model, endpointUrl: B.endpoint_url, mode: F.mode, prompt: F.prompt, payload: F.inputs, count: 1, unitCost: de, kind: ut(B.category) });
  }, [H, q.run, x]);
  return /* @__PURE__ */ u("div", { className: `ms-root ${w}`.trim(), style: Nr(s), "data-layout": $, "data-btn": Cr(s), children: [
    n && /* @__PURE__ */ u("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ a("h1", { className: "text-base font-semibold", children: o }),
      M && /* @__PURE__ */ u("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: ce(M.balance) })
      ] })
    ] }),
    S ? /* @__PURE__ */ u("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ a("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ a("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      h && /* @__PURE__ */ a("button", { type: "button", onClick: h, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ a(Qt.Provider, { value: e, children: /* @__PURE__ */ u(Bt.Provider, { value: T, children: [
      b && /* @__PURE__ */ u("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ a("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        h && /* @__PURE__ */ a("button", { type: "button", onClick: h, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ u("div", { className: `flex min-h-0 flex-1 flex-col ${$ === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ a(Qa, { mode: E, onChange: oe, layout: $, onChangeKey: h }),
        /* @__PURE__ */ a("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: m ? /* @__PURE__ */ u("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          m
        ] }) : H ? /* @__PURE__ */ u(Ve, { children: [
          te.view === "apps" && st(E) ? /* @__PURE__ */ a(_n, { mode: E, slug: te.app, onApp: se, switcher: /* @__PURE__ */ a(qt, { view: "apps", onChange: Ie }), models: H, client: x, batch: K, onRun: me }) : /* @__PURE__ */ a(Xa, { mode: E, models: H, client: x, batch: K, onRun: me, usage: ie, reuse: C, switcher: st(E) ? /* @__PURE__ */ a(qt, { view: "models", onChange: Ie }) : void 0 }),
          /* @__PURE__ */ a(sa, { mode: E, items: q.items, batch: K, onBatch: X, onLabel: q.setLabel, onRemove: q.remove, onReuse: Fe, onRerun: Be, onDeleteMedia: q.deleteMedia, onLoadMore: q.loadMore, hasMore: q.hasMore, loadingMore: q.loadingMore, serverError: q.serverError, estimateFor: pe })
        ] }) : /* @__PURE__ */ u("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ a(ke, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] }) })
  ] });
}
function Pn(e) {
  const t = e.accountId ?? Gr(e.apiKey), r = e.teamId ? `${t}:t${e.teamId}` : t;
  return /* @__PURE__ */ a(Gn, { scope: r, ...e }, `${r}|${e.apiBase ?? ""}`);
}
export {
  ye as ApiError,
  br as MuapiClient,
  Pn as MuapiStudio,
  kr as THEMES,
  wr as cyanTheme,
  Sr as defaultLayout,
  ut as generationKind,
  Xe as limeTheme,
  kt as pollUntilDone,
  Ht as resolveTheme,
  Gr as scopeOfKey,
  Nr as themeStyle
};
