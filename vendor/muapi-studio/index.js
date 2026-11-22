import { jsx as a, jsxs as s, Fragment as Ge } from "react/jsx-runtime";
import { createContext as Jt, useContext as Yt, useState as A, useRef as z, useEffect as U, useCallback as ae, useMemo as ee, createElement as Kt, useId as Wt, useLayoutEffect as Xt } from "react";
function Qt(e, t, r = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : r);
}
function Zt(e) {
  const t = Number(e);
  return e && Number.isFinite(t) && t >= 0 ? Math.min(t, 120) * 1e3 : void 0;
}
class fe extends Error {
  constructor(t, r, n) {
    super(t), this.status = r, this.retryAfterMs = n;
  }
}
function Et(e) {
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
function er(e, t) {
  var n;
  const r = e == null ? void 0 : e.detail;
  return ((n = r == null ? void 0 : r.error) == null ? void 0 : n.message) || (typeof r == "string" ? r : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class tr {
  constructor(t = "/api/muapi", r, n = {}) {
    this.base = t, this.teamId = r, this.opts = n;
  }
  async request(t, r = {}) {
    var h, w, x, I;
    const n = new Headers(r.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [k, b] of Object.entries(await this.opts.getHeaders())) n.set(k, b);
    const i = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...r, headers: n }), l = await i.text();
    let o = null;
    try {
      o = l ? JSON.parse(l) : null;
    } catch {
    }
    if (!i.ok && Qt(i.status, o, l) && !t.startsWith("/app/") && ((w = (h = this.opts).onKeyRejected) == null || w.call(h)), !i.ok) throw new fe(er(o, `${i.status} ${i.statusText}`), i.status, Zt((I = (x = i.headers) == null ? void 0 : x.get) == null ? void 0 : I.call(x, "retry-after")));
    if (o === null && l.trim()) throw new fe("Unexpected non-JSON response from the server", 502);
    return o;
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
    var o;
    const i = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(r)
    }), l = i.request_id || i.id;
    if (!l) throw new fe("The API did not return a request id", 502);
    return { requestId: l, cost: (o = i.cost) == null ? void 0 : o.amount_usd };
  }
  async poll(t) {
    var o;
    const r = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), n = String(r.status || "").toLowerCase(), i = ["completed", "succeeded", "success"].includes(n) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(n) ? "failed" : n === "pending" ? "pending" : "processing", l = Array.isArray(r.outputs) ? r.outputs : r.url ? [r.url] : [];
    return { status: i, outputs: l, error: Et(r.error), cost: (o = r.cost) == null ? void 0 : o.amount_usd };
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
    const t = (n) => n instanceof fe && [403, 404, 405].includes(n.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((n) => !t(n)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var l;
    const r = new FormData();
    r.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: r }), i = n.url || n.file_url || ((l = n.data) == null ? void 0 : l.url);
    if (!i) throw new fe("Upload returned no URL", 502);
    return i;
  }
}
const rr = (e) => Math.min(Math.round(e * 1.15), 6e3), ar = 3e4, nr = (e, t) => new Promise((r) => {
  const n = setTimeout(i, e);
  function i() {
    clearTimeout(n), t == null || t.removeEventListener("abort", i), r();
  }
  t == null || t.addEventListener("abort", i);
});
async function ct(e, t, r = {}) {
  const { intervalMs: n = 2e3, timeoutMs: i = 15 * 60 * 1e3, signal: l, onUpdate: o } = r, h = Date.now();
  let w = 0, x = n;
  for (; Date.now() - h < i; ) {
    if (l != null && l.aborted) throw new DOMException("Aborted", "AbortError");
    let I = x;
    try {
      const k = await e.poll(t);
      if (w = 0, o == null || o(k), k.status === "completed" || k.status === "failed") return k;
      x = rr(x), I = x;
    } catch (k) {
      if (k instanceof fe && k.status === 429) I = k.retryAfterMs ?? ar;
      else if (++w >= 5) throw k;
    }
    await nr(I, l);
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Tt = Jt({ library: !0, deleteMedia: !0 }), $t = () => Yt(Tt), ze = {
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
}, or = {
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
}, ir = { lime: ze, cyan: or }, dt = {
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
function _t(e = "lime") {
  return typeof e == "string" ? ir[e] ?? ze : { ...ze, ...e };
}
function sr(e = "lime") {
  const t = _t(e), r = {};
  for (const n of Object.keys(dt)) r[dt[n]] = t[n];
  return r;
}
function lr(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const cr = (e = "lime") => _t(e).buttonStyle, ye = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], dr = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function rt(e) {
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
const ur = (e) => !!e && ye.some((t) => t.id === e);
function mr(e, t) {
  const r = ye.find((n) => n.id === t).groups;
  return e.filter((n) => r.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const pr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Lt(e, t, r = {}) {
  const n = (l) => {
    var o;
    return ((o = l.sale) == null ? void 0 : o.from) ?? l.cost ?? 1 / 0;
  }, i = [...e];
  return t === "a-z" ? i.sort((l, o) => l.name.localeCompare(o.name)) : t === "price-asc" ? i.sort((l, o) => n(l) - n(o)) : t === "price-desc" ? i.sort((l, o) => n(o) - n(l)) : t === "most-used" ? i.filter((l) => {
    var o;
    return (((o = r.usage) == null ? void 0 : o[l.name]) ?? 0) > 0;
  }).sort((l, o) => (r.usage[o.name] ?? 0) - (r.usage[l.name] ?? 0)) : t === "favourites" ? i.filter((l) => {
    var o;
    return (o = r.favorites) == null ? void 0 : o.includes(l.name);
  }) : i.sort((l, o) => +!!o.sale - +!!l.sale);
}
const hr = { completed: "completed", succeeded: "completed", success: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function fr(e, t) {
  var n, i;
  const r = (n = t.find((l) => l.name === e)) == null ? void 0 : n.group_of;
  return ((i = ye.find((l) => r && l.groups.includes(r))) == null ? void 0 : i.id) ?? "ai-tools";
}
function gr(e, t, r = {}) {
  var l;
  const n = e.output ?? {}, i = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: fr(e.model, t),
    prompt: typeof i.prompt == "string" ? i.prompt : "",
    inputs: i,
    status: hr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: Et(n.error),
    cost: (l = n.cost) == null ? void 0 : l.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: r[e.request_id] ?? null,
    source: "server"
  };
}
function br(e, t, r = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((h) => h.requestId).map((h) => [h.requestId, h])), i = new Set(e.map((h) => h.requestId).filter(Boolean));
  return [...e.map((h) => {
    const w = h.requestId ? n.get(h.requestId) : void 0;
    return h.status === "failed" && w && w.status === "completed" && w.outputs.length ? { ...h, status: w.status, outputs: w.outputs, error: void 0, cost: h.cost ?? w.cost } : h;
  }), ...t.filter((h) => !h.requestId || !i.has(h.requestId))].filter((h) => !(h.requestId && r.has(h.requestId))).sort((h, w) => w.createdAt - h.createdAt);
}
function yr(e) {
  const t = {};
  for (const r of e) t[r.model] = (t[r.model] ?? 0) + 1;
  return t;
}
function se(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function be(e, t) {
  var r;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((r = e.sale) == null ? void 0 : r.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Gt = "muapi-studio:history:v1", xr = 200, ve = (e, t) => t ? `${e}:${t}` : e;
function vr(e) {
  if (!e) return "";
  let t = 2166136261, r = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, r = Math.imul(r ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${r.toString(36)}`;
}
function Pe(e = "") {
  try {
    const t = localStorage.getItem(ve(Gt, e));
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function wr(e, t = "") {
  try {
    localStorage.setItem(ve(Gt, t), JSON.stringify(e.slice(0, xr)));
  } catch {
  }
}
const kr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, ut = (e, t) => {
  try {
    const r = localStorage.getItem(e);
    return r ? JSON.parse(r) : t;
  } catch {
    return t;
  }
}, mt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, pt = "muapi-studio:labels:v1", ht = "muapi-studio:hidden:v1";
function Nr(e, t, r, n = "") {
  const [i, l] = A(() => Pe(n)), [o, h] = A([]), [w, x] = A(null), [I, k] = A(!1), [b, N] = A(null), M = z(!1), [O, E] = A(() => ut(ve(pt, n), {})), [R, f] = A(() => ut(ve(ht, n), [])), p = z(/* @__PURE__ */ new Set()), v = z(new AbortController()), $ = z([]);
  $.current = t ?? [], U(() => wr(i, n), [i, n]), U(() => mt(ve(pt, n), O), [O, n]), U(() => mt(ve(ht, n), R), [R, n]), U(() => (v.current = new AbortController(), () => v.current.abort()), []);
  const _ = ae((u, y) => l((G) => G.map((c) => c.id === u ? { ...c, ...y } : c)), []), C = ae(async (u, y) => {
    if (!p.current.has(u)) {
      p.current.add(u);
      try {
        const G = await ct(e, y, {
          signal: v.current.signal,
          onUpdate: (c) => _(u, { status: c.status, outputs: c.outputs, error: c.error, cost: c.cost })
        });
        _(u, { status: G.status, outputs: G.outputs, error: G.error, cost: G.cost }), r == null || r();
      } catch (G) {
        G.name !== "AbortError" && _(u, { status: "failed", error: G.message });
      } finally {
        p.current.delete(u);
      }
    }
  }, [e, _, r]), D = ae(async (u) => {
    if (!u.requestId || p.current.has(u.id)) return;
    p.current.add(u.id);
    const y = (G) => h((c) => c.map((V) => V.id === u.id ? { ...V, status: G.status, outputs: G.outputs, error: G.error, cost: G.cost ?? V.cost } : V));
    try {
      const G = await ct(e, u.requestId, { signal: v.current.signal, onUpdate: y });
      y(G), r == null || r();
    } catch {
    } finally {
      p.current.delete(u.id);
    }
  }, [e, r]);
  U(() => {
    const u = new Set(Pe(n).map((y) => y.requestId));
    for (const y of o) (y.status === "pending" || y.status === "processing") && y.requestId && !u.has(y.requestId) && D(y);
  }, [o, n, D]), U(() => {
    for (const u of Pe(n)) (u.status === "pending" || u.status === "processing") && u.requestId && C(u.id, u.requestId);
  }, []);
  const L = ae(async (u = !1) => {
    if (!M.current) {
      k(!0), N(null);
      try {
        const y = await e.history(u ? void 0 : w ?? void 0), G = y.items.map((c) => gr(c, $.current));
        h((c) => u ? G : [...c, ...G]), x(y.next_cursor);
      } catch (y) {
        y instanceof fe && [403, 404, 405].includes(y.status) ? (M.current = !0, x(null)) : N(y.message);
      } finally {
        k(!1);
      }
    }
  }, [e, w]), J = z(!1);
  U(() => {
    t && !J.current && (J.current = !0, L(!0));
  }, [t, L]);
  const q = ae((u) => {
    const y = Array.from({ length: u.count }, () => ({
      id: kr(),
      model: u.model,
      mode: u.mode,
      prompt: u.prompt,
      inputs: u.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: u.unitCost,
      source: "local"
    }));
    return l((G) => [...y, ...G]), Promise.all(y.map(async (G) => {
      try {
        const { requestId: c, cost: V } = await e.submit(u.endpointUrl, u.payload, u.kind);
        _(G.id, { requestId: c, ...V !== void 0 ? { cost: V } : {} }), await C(G.id, c);
      } catch (c) {
        _(G.id, { status: "failed", error: c.message });
      }
    }));
  }, [e, _, C]), Q = ee(() => {
    const u = (y) => ({ ...y, label: y.requestId && O[y.requestId] || y.label });
    return br(i.map(u), o.map(u), new Set(R));
  }, [i, o, O, R]), g = ae((u, y) => {
    u.requestId && E((G) => {
      const c = { ...G };
      return y ? c[u.requestId] = y : delete c[u.requestId], c;
    }), _(u.id, { label: y });
  }, [_]), m = ae((u) => {
    l((y) => y.filter((G) => G.id !== u.id)), u.requestId && f((y) => [.../* @__PURE__ */ new Set([...y, u.requestId])]);
  }, []), d = ae(async (u) => {
    u.requestId && (await e.deleteMedia(u.requestId), _(u.id, { outputs: [] }), h((y) => y.map((G) => G.requestId === u.requestId ? { ...G, outputs: [] } : G)));
  }, [e, _]);
  return { items: Q, run: q, setLabel: g, remove: m, deleteMedia: d, loadMore: () => L(!1), hasMore: !!w, loadingMore: I, serverError: b };
}
const Sr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Rt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : Sr.test(e) ? "file" : "image" : "text";
}
function Cr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const Ar = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), X = ({ children: e, ...t }) => /* @__PURE__ */ a("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Le = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ a("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ a("path", { d: "m21 15-4.5-4.5L6 21" })
] }), Ir = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ a("path", { d: "m16 10 6-3v10l-6-3" })
] }), Mr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ a("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ a("circle", { cx: "17", cy: "16", r: "3" })
] }), Er = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ a("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ a("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), at = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ a("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), Tr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ a("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), nt = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), ft = ({ filled: e, ...t }) => /* @__PURE__ */ a(X, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ a("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), ot = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ a("path", { d: "m20 20-3.5-3.5" })
] }), Re = ({ up: e, ...t }) => /* @__PURE__ */ a(X, { ...t, children: /* @__PURE__ */ a("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), $r = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), _r = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "3" })
] }), He = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), Ie = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "m5 12 5 5 9-10" }) }), ke = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "M6 6l12 12M18 6 6 18" }) }), Ot = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), Lr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ a("path", { d: "M12 11v5M12 8v.01" })
] }), Ne = (e) => /* @__PURE__ */ a(X, { ...e, className: "ms-spin", children: /* @__PURE__ */ a("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Gr = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Rr = (e) => /* @__PURE__ */ a(X, { ...e, children: /* @__PURE__ */ a("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Or = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), gt = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ a("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Dt({ url: e }) {
  return /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ a(at, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let bt = null;
const Dr = () => bt ?? (bt = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw bt = null, e;
}));
function jr({ url: e, hidden: t = !1 }) {
  const [r, n] = A("loading"), i = z(null);
  return U(() => {
    let l = !0;
    return n("loading"), Dr().catch(() => l && n("failed")), () => {
      l = !1;
    };
  }, [e]), U(() => {
    const l = i.current;
    if (!l) return;
    const o = () => n("ready"), h = () => n("failed");
    return l.addEventListener("load", o), l.addEventListener("error", h), () => {
      l.removeEventListener("load", o), l.removeEventListener("error", h);
    };
  }), r === "failed" ? /* @__PURE__ */ a(Dt, { url: e }) : /* @__PURE__ */ s("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    Kt("model-viewer", {
      ref: i,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    r === "loading" && /* @__PURE__ */ s("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ a(Ne, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    r === "ready" && /* @__PURE__ */ a("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ a(at, { width: 14, height: 14 }) })
  ] });
}
const Pr = ["All", "Approved", "Rejected", "Unlabeled"], Vr = [1, 2, 4, 6, 8];
function Ur({ url: e, hidden: t, onOpen: r }) {
  const n = t ? { filter: "blur(18px)" } : void 0, i = Rt(e);
  return i === "text" ? /* @__PURE__ */ a("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: Cr(e) }) : i === "video" ? /* @__PURE__ */ a("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : i === "audio" ? /* @__PURE__ */ a("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ a("audio", { src: e, controls: !0, className: "w-full" }) }) : i === "3d" ? Ar(e) ? /* @__PURE__ */ a(jr, { url: e, hidden: t }) : /* @__PURE__ */ a(Dt, { url: e }) : i === "file" ? /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ a(He, { width: 28, height: 28 }),
    /* @__PURE__ */ a("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ a("button", { type: "button", onClick: r, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ a("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function qr({ g: e, hidden: t, onLabel: r, onRemove: n, onReuse: i, onRerun: l, onDeleteMedia: o, onOpen: h, estimateFor: w }) {
  const [x, I] = A(0), k = e.outputs.length, b = Math.min(x, Math.max(k - 1, 0)), N = e.outputs[b], M = !!N && Rt(N) === "text", [O, E] = A(!1), [R, f] = A(null), p = $t(), v = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", $ = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ s("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && N ? /* @__PURE__ */ s("div", { className: "relative", children: [
      /* @__PURE__ */ a(Ur, { url: N, hidden: t, onOpen: () => h(N) }),
      k > 1 && /* @__PURE__ */ s("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ a("button", { type: "button", "aria-label": "Previous output", disabled: b === 0, onClick: () => I(b - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ s("span", { "aria-live": "polite", children: [
          b + 1,
          " / ",
          k
        ] }),
        /* @__PURE__ */ a("button", { type: "button", "aria-label": "Next output", disabled: b === k - 1, onClick: () => I(b + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ s("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ a(ke, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ a("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ s("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ a(Ne, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ s("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ a("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ s("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ a("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ a("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? se(e.cost) : e.status === "completed" && (w == null ? void 0 : w(e.model)) !== void 0 ? `est. ${se(w(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && N && (M ? /* @__PURE__ */ a("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(N)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${$} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ a(He, { width: 14, height: 14 }) }) : /* @__PURE__ */ a("a", { href: N, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${$} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ a(He, { width: 14, height: 14 }) })),
        /* @__PURE__ */ a(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => r(e, e.label === "approved" ? null : "approved"),
            className: `${$} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ a(Ie, { width: 14, height: 14 })
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
            className: `${$} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ a(ke, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ a("button", { type: "button", onClick: () => i(e), title: "Load this model and settings back into the form", className: v, children: "Reuse" }),
        /* @__PURE__ */ a("button", { type: "button", onClick: () => l(e), title: "Generate again with the same settings", className: v, children: "Re-run" }),
        e.status === "completed" && N && /* @__PURE__ */ a("button", { type: "button", onClick: () => {
          var _;
          (_ = navigator.clipboard) == null || _.writeText(N).then(() => {
            E(!0), setTimeout(() => E(!1), 1500);
          });
        }, className: v, children: O ? "Copied" : M ? "Copy text" : "Copy link" })
      ] }),
      R && /* @__PURE__ */ s("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        R
      ] }),
      /* @__PURE__ */ s("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ s("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ s("span", { className: "flex shrink-0 gap-3", children: [
          p.deleteMedia && e.requestId && e.status === "completed" && N && /* @__PURE__ */ a("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (f(null), o(e).catch((_) => f(_.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Fr({ url: e, onClose: t }) {
  return U(() => {
    const r = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", r), () => document.removeEventListener("keydown", r);
  }, [t]), /* @__PURE__ */ s("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ a("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ a(ke, { width: 24, height: 24 }) }),
    /* @__PURE__ */ a("img", { src: e, alt: "Full size output", onClick: (r) => r.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Br({ mode: e, items: t, batch: r, onBatch: n, onLabel: i, onRemove: l, onReuse: o, onRerun: h, onDeleteMedia: w, onLoadMore: x, hasMore: I, loadingMore: k, serverError: b, estimateFor: N }) {
  const [M, O] = A("All"), [E, R] = A(""), [f, p] = A(!1), [v, $] = A(null), _ = ee(() => {
    const C = E.trim().toLowerCase();
    return t.filter((D) => D.mode !== e || M === "Approved" && D.label !== "approved" || M === "Rejected" && D.label !== "rejected" || M === "Unlabeled" && D.label !== null ? !1 : !C || D.prompt.toLowerCase().includes(C) || D.model.toLowerCase().includes(C));
  }, [t, e, M, E]);
  return /* @__PURE__ */ s("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ a("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Pr.map((C) => /* @__PURE__ */ a(
        "button",
        {
          role: "tab",
          "aria-selected": M === C,
          onClick: () => O(C),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${M === C ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: C
        },
        C
      )) }),
      /* @__PURE__ */ s("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ a(ot, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ a("input", { value: E, onChange: (C) => R(C.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ a("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Vr.map((C) => /* @__PURE__ */ a(
        "button",
        {
          role: "radio",
          "aria-checked": r === C,
          onClick: () => n(C),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${r === C ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: C
        },
        C
      )) }),
      /* @__PURE__ */ a("button", { type: "button", "aria-pressed": f, "aria-label": f ? "Show previews" : "Hide previews", title: f ? "Show previews" : "Hide previews", onClick: () => p((C) => !C), className: f ? "text-primary" : "text-secondary hover:text-fg", children: f ? /* @__PURE__ */ a($r, { width: 18, height: 18 }) : /* @__PURE__ */ a(_r, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      _.length === 0 ? /* @__PURE__ */ s("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ a("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ a(nt, { width: 36, height: 36 }) }),
        /* @__PURE__ */ a("p", { className: "font-semibold", children: t.some((C) => C.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ a("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((C) => C.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ a("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: _.map((C) => /* @__PURE__ */ a(qr, { g: C, hidden: f, onLabel: i, onRemove: l, onReuse: o, onRerun: h, onDeleteMedia: w, onOpen: $, estimateFor: N }, C.id)) }),
      b && /* @__PURE__ */ s("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        b
      ] }),
      I && /* @__PURE__ */ a("div", { className: "mt-4 text-center", children: /* @__PURE__ */ a("button", { type: "button", disabled: k, onClick: x, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: k ? "Loading…" : "Load more history" }) }),
      v && /* @__PURE__ */ a(Fr, { url: v, onClose: () => $(null) })
    ] })
  ] });
}
const zr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Hr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Jr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? zr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Hr.test(e.name) ? "media" : "text" : "text";
}
function Ve(e) {
  var o, h;
  const t = (h = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : h.input_data, r = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(r), i = [...n.filter((w) => r[w]), ...Object.keys(r).filter((w) => !n.includes(w))], l = new Set(e.required_fields ?? []);
  return i.map((w) => ({ prop: { ...r[w], name: w }, kind: Jr({ ...r[w], name: w }), required: l.has(w) }));
}
function Je(e) {
  var r;
  const t = {};
  for (const { prop: n, kind: i, required: l } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : l && (i === "textarea" || i === "text") && typeof ((r = n.examples) == null ? void 0 : r[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const ge = (e) => `__auto:${e}`, Ye = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Ke = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function Ue(e, t) {
  const r = {};
  for (const { prop: n, kind: i } of e) {
    if (t[ge(n.name)] === !0) continue;
    const l = t[n.name] ?? n.default;
    if (!Ke(l))
      if (i === "number") {
        const o = Number(l);
        Number.isFinite(o) && (r[n.name] = o);
      } else if (i === "json" && typeof l == "string")
        try {
          r[n.name] = JSON.parse(l);
        } catch {
        }
      else r[n.name] = l;
  }
  return r;
}
function Yr(e, t) {
  for (const { prop: r, kind: n, required: i } of e) {
    if (t[ge(r.name)] === !0) continue;
    const l = t[r.name] ?? r.default, o = r.title || r.name;
    if (i && Ke(l)) return `${o} is required`;
    if (n === "json" && typeof l == "string" && l)
      try {
        JSON.parse(l);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !Ke(l)) {
      const h = Number(l);
      if (!Number.isFinite(h)) return `${o} must be a number`;
      if (r.minValue !== void 0 && h < r.minValue) return `${o} must be at least ${r.minValue}`;
      if (r.maxValue !== void 0 && h > r.maxValue) return `${o} must be at most ${r.maxValue}`;
    }
  }
  return null;
}
const Kr = 12, it = 240, Ee = (e) => `${typeof e}:${e}`, Wr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Xr(e, t) {
  const r = t.trim().toLowerCase();
  return r ? e.filter((n) => n.label.toLowerCase().includes(r)) : e;
}
function Qr(e, t, r = it) {
  return e >= r || e >= t ? "down" : "up";
}
const Zr = 36, ea = 48;
function ta(e, t) {
  return Math.min(it, Math.max(1, e) * Zr + 8) + (t ? ea : 0);
}
function ra(e, t, r) {
  return r <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, r - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? r - 1 : t === "PageDown" ? Math.min(e + 5, r - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const yt = "Auto (let model decide)", qe = "__auto__";
function We({ id: e, label: t, options: r, value: n, onChange: i, allowAuto: l, auto: o, onAuto: h, combobox: w }) {
  const x = Wt(), I = e ?? `ms-dd-${x}`, k = w ?? r.length > Kr, [b, N] = A(!1), [M, O] = A(""), [E, R] = A(0), [f, p] = A("down"), v = z(null), $ = z(null), _ = z(null), C = r.find((d) => n !== void 0 && Ee(d.value) === Ee(n)), D = ee(() => k ? Xr(r, M) : r, [k, r, M]), L = ee(
    () => [...l ? [{ key: qe, label: yt, value: qe, isAuto: !0 }] : [], ...D.map((d) => ({ key: Ee(d.value), label: d.label, hint: d.hint, value: d.value }))],
    [l, D]
  ), J = o ? qe : C ? Ee(C.value) : void 0, q = () => {
    N(!1), O("");
  }, Q = (d) => {
    d.isAuto ? h == null || h() : i(d.value), q();
  };
  Xt(() => {
    if (!b || !v.current) return;
    const d = v.current.getBoundingClientRect();
    let u = v.current.parentElement;
    for (; u && !/(auto|scroll)/.test(getComputedStyle(u).overflowY); ) u = u.parentElement;
    const y = u ? u.getBoundingClientRect() : null, G = Math.min(window.innerHeight, y ? y.bottom : window.innerHeight), c = Math.max(0, y ? y.top : 0);
    p(Qr(G - d.bottom, d.top - c, ta(r.length + (l ? 1 : 0), k)));
  }, [b]), U(() => {
    if (!b) return;
    const d = L.findIndex((u) => u.key === J);
    R(d >= 0 ? d : 0);
  }, [b, M]), U(() => {
    var d, u, y;
    b && ((y = (u = (d = $.current) == null ? void 0 : d.querySelector(`[data-i="${E}"]`)) == null ? void 0 : u.scrollIntoView) == null || y.call(u, { block: "nearest" }));
  }, [E, b]), U(() => {
    var d;
    b && k && ((d = _.current) == null || d.focus());
  }, [b, k]), U(() => {
    if (!b) return;
    const d = (u) => {
      var y;
      (y = v.current) != null && y.contains(u.target) || q();
    };
    return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
  }, [b]);
  const g = (d) => {
    if (!b) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(d.key) && (d.preventDefault(), N(!0));
      return;
    }
    if (d.key === "Escape") {
      d.preventDefault(), d.stopPropagation(), q();
      return;
    }
    if (d.key === "Enter") {
      d.preventDefault(), L[E] && Q(L[E]);
      return;
    }
    if (d.key === "Tab") {
      q();
      return;
    }
    if (d.key === " " && !k) {
      d.preventDefault(), L[E] && Q(L[E]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(d.key) && (d.preventDefault(), R((u) => ra(u, d.key, L.length)));
  }, m = o ? yt : (C == null ? void 0 : C.label) ?? "Select…";
  return /* @__PURE__ */ s("div", { ref: v, className: "relative w-full", onKeyDown: g, children: [
    /* @__PURE__ */ s(
      "button",
      {
        id: I,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": b,
        "aria-label": `${t}: ${m}`,
        "aria-controls": `${I}-list`,
        onClick: () => N((d) => !d),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${b ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ a("span", { className: "truncate", children: m }),
          /* @__PURE__ */ a(Re, { up: b, width: 16, height: 16 })
        ]
      }
    ),
    b && /* @__PURE__ */ s("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${f === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      k && /* @__PURE__ */ a(
        "input",
        {
          ref: _,
          value: M,
          onChange: (d) => O(d.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${I}-list`,
          "aria-activedescendant": L[E] ? `${I}-o${E}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ s("ul", { id: `${I}-list`, ref: $, role: "listbox", "aria-label": t, style: { maxHeight: it }, className: "overflow-y-auto", children: [
        L.map((d, u) => {
          const y = d.key === J;
          return /* @__PURE__ */ s(
            "li",
            {
              id: `${I}-o${u}`,
              "data-i": u,
              role: "option",
              "aria-selected": y,
              onMouseEnter: () => R(u),
              onClick: () => Q(d),
              className: `flex cursor-pointer items-center justify-between gap-2 ${d.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${y ? "bg-primary text-primary-ink" : u === E ? "bg-card-bg" : ""} ${d.isAuto && !y ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ s("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ a("span", { className: "block truncate", children: d.label }),
                  d.hint && /* @__PURE__ */ a("span", { className: `block truncate text-[11px] ${y ? "opacity-70" : "text-muted"}`, children: d.hint })
                ] }),
                y && /* @__PURE__ */ a(Ie, { width: 14, height: 14 })
              ]
            },
            d.key
          );
        }),
        L.length === 0 && /* @__PURE__ */ a("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const aa = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function na({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ a("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ a("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ a("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ a(Le, {}) });
}
function oa({ client: e, max: t, initialType: r = "image", onInsert: n, onClose: i }) {
  const [l, o] = A(r), [h, w] = A(""), [x, I] = A(1), [k, b] = A(null), [N, M] = A(null), [O, E] = A(!1), [R, f] = A([]), [p, v] = A(""), [$, _] = A(!1), C = z(null), D = z(null), L = ae(async () => {
    E(!0), M(null);
    try {
      b(await e.mediaLibrary({ mediaType: l, search: h, page: x }));
    } catch (m) {
      M(m.message);
    } finally {
      E(!1);
    }
  }, [e, l, h, x]);
  U(() => {
    const m = setTimeout(L, h ? 300 : 0);
    return () => clearTimeout(m);
  }, [L, h]), U(() => {
    I(1);
  }, [l, h]), U(() => {
    var u;
    const m = document.activeElement;
    (u = C.current) == null || u.focus();
    const d = (y) => {
      if (y.key === "Escape") {
        y.stopPropagation(), i();
        return;
      }
      if (y.key !== "Tab" || !C.current) return;
      const G = [...C.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!G.length) return;
      const c = G[0], V = G[G.length - 1];
      y.shiftKey && document.activeElement === c ? (y.preventDefault(), V.focus()) : !y.shiftKey && document.activeElement === V && (y.preventDefault(), c.focus());
    };
    return document.addEventListener("keydown", d), () => {
      var y;
      document.removeEventListener("keydown", d), (y = m == null ? void 0 : m.focus) == null || y.call(m);
    };
  }, [i]);
  const J = (m) => f((d) => d.includes(m) ? d.filter((u) => u !== m) : t === 1 ? [m] : d.length < t ? [...d, m] : d), q = async (m) => {
    if (m.length) {
      E(!0), M(null);
      try {
        for (const d of m) {
          const u = await e.upload(d);
          await e.saveToLibrary({ url: u, name: d.name, mime_type: d.type || void 0, size_bytes: d.size, media_type: d.type.startsWith("video") ? "video" : d.type.startsWith("audio") ? "audio" : d.type.startsWith("image") ? "image" : "archive" });
        }
        await L();
      } catch (d) {
        M(d.message), E(!1);
      }
    }
  }, Q = async () => {
    var d;
    const m = p.trim();
    if (!/^https?:\/\//i.test(m)) {
      M("Enter a full http(s) URL");
      return;
    }
    E(!0), M(null);
    try {
      const u = ((d = m.split("?")[0].split(".").pop()) == null ? void 0 : d.toLowerCase()) ?? "", y = ["mp4", "webm", "mov"].includes(u) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(u) ? "audio" : ["zip", "rar", "7z"].includes(u) ? "archive" : "image";
      await e.saveToLibrary({ url: m, name: m.split("/").pop() || "link", media_type: y }), v(""), _(!1), await L();
    } catch (u) {
      M(u.message), E(!1);
    }
  }, g = async (m) => {
    if (window.confirm(`Delete "${m.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(m.id), f((d) => d.filter((u) => u !== m.url)), await L();
      } catch (d) {
        M(d.message);
      }
  };
  return /* @__PURE__ */ a("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (m) => {
    m.target === m.currentTarget && i();
  }, children: /* @__PURE__ */ s("div", { ref: C, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ s("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ a("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ a(Le, {}) }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ s("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ a("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ s("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
            (k == null ? void 0 : k.total) ?? 0,
            " ",
            (k == null ? void 0 : k.total) === 1 ? "item" : "items"
          ] })
        ] }),
        /* @__PURE__ */ s("p", { className: "hidden text-xs text-secondary sm:block", children: [
          "Select up to ",
          t,
          " item",
          t === 1 ? "" : "s",
          " to insert into your form"
        ] })
      ] }),
      /* @__PURE__ */ a("input", { ref: D, type: "file", hidden: !0, multiple: !0, onChange: (m) => {
        const d = Array.from(m.target.files ?? []);
        m.target.value = "", q(d);
      } }),
      /* @__PURE__ */ s("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var m;
        return (m = D.current) == null ? void 0 : m.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ a(Ot, { width: 14, height: 14 }),
        /* @__PURE__ */ a("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ a("button", { type: "button", "aria-label": "Close", onClick: i, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ a(ke, {}) })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: aa.map((m) => /* @__PURE__ */ a("button", { role: "tab", "aria-selected": l === m.id, onClick: () => o(m.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${l === m.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: m.label }, m.id)) }),
      /* @__PURE__ */ a("input", { value: h, onChange: (m) => w(m.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ a("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": $, onClick: () => _((m) => !m), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    $ && /* @__PURE__ */ s("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ a("input", { value: p, onChange: (m) => v(m.target.value), onKeyDown: (m) => m.key === "Enter" && void Q(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ a("button", { type: "button", onClick: () => void Q(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      N && /* @__PURE__ */ a("p", { role: "alert", className: "mb-3 text-sm text-danger", children: N }),
      O && !k ? /* @__PURE__ */ s("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ a(Ne, {}),
        " Loading…"
      ] }) : k != null && k.items.length ? /* @__PURE__ */ a("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: k.items.map((m) => {
        const d = R.includes(m.url);
        return /* @__PURE__ */ s("li", { className: `group relative overflow-hidden rounded-card border ${d ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ a("button", { type: "button", "aria-pressed": d, "aria-label": `${d ? "Deselect" : "Select"} ${m.name ?? "file"}`, onClick: () => J(m.url), className: "block aspect-square w-full", children: /* @__PURE__ */ a(na, { a: m }) }),
          d && /* @__PURE__ */ a("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ a(Ie, { width: 12, height: 12 }) }),
          /* @__PURE__ */ a("button", { type: "button", "aria-label": `Delete ${m.name ?? "file"}`, onClick: () => void g(m), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ a(ke, { width: 12, height: 12 }) }),
          /* @__PURE__ */ a("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: m.name ?? "", children: m.name })
        ] }, m.id);
      }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ a("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ a(Le, { width: 28, height: 28 }) }),
        /* @__PURE__ */ a("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ a("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      k && k.total_pages > 1 && /* @__PURE__ */ s("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ a("button", { type: "button", disabled: x <= 1, onClick: () => I((m) => m - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        x,
        " of ",
        k.total_pages,
        /* @__PURE__ */ a("button", { type: "button", disabled: x >= k.total_pages, onClick: () => I((m) => m + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ s("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ s("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ a("b", { className: "text-primary", children: R.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !R.length, onClick: () => {
        n(R), i();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ a(Ie, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const jt = (e, t = "") => {
  const r = `${e ?? ""} ${t}`.toLowerCase();
  return r.includes("video") ? "video/*" : r.includes("audio") || r.includes("voice") ? "audio/*" : r.includes("image") || r.includes("mask") || r.includes("photo") || r.includes("face") ? "image/*" : void 0;
}, ia = (e, t = "") => {
  const r = jt(e, t);
  return r === "video/*" ? "video" : r === "audio/*" ? "audio" : r === "image/*" ? "image" : "all";
}, sa = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function la(e, t) {
  const r = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, i) => void e.saveToLibrary({ url: r[i], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: sa(n) }).catch(() => {
  })), r;
}
function Xe({ client: e, field: t, multiple: r, max: n, current: i, onUrls: l, onError: o }) {
  const h = z(null), [w, x] = A(!1), [I, k] = A(!1), [b, N] = A(!1), M = n - i.length, O = $t(), E = async (p) => {
    if (p.length) {
      x(!0);
      try {
        l(await la(e, r ? p.slice(0, Math.max(M, 1)) : p.slice(0, 1)));
      } catch (v) {
        o(v.message);
      } finally {
        x(!1);
      }
    }
  }, R = jt(t.prop.field, t.prop.name), f = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ s(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), k(!0);
      },
      onDragLeave: () => k(!1),
      onDrop: (p) => {
        p.preventDefault(), k(!1), E(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${I ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ a("input", { ref: h, type: "file", hidden: !0, accept: R, multiple: r, onChange: (p) => {
          const v = Array.from(p.target.files ?? []);
          p.target.value = "", E(v);
        } }),
        (r ? M > 0 : !0) && /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ a(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: r ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: r ? void 0 : i[0] ?? "",
              defaultValue: void 0,
              onChange: r ? void 0 : (p) => l([p.target.value]),
              onKeyDown: r ? (p) => {
                p.key === "Enter" && p.currentTarget.value.trim() && (l([p.currentTarget.value.trim()]), p.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ a("button", { type: "button", disabled: w, onClick: () => {
            var p;
            return (p = h.current) == null ? void 0 : p.click();
          }, "aria-label": "Upload file", title: "Upload file", className: f, children: w ? /* @__PURE__ */ a(Ne, { width: 16, height: 16 }) : /* @__PURE__ */ a(Ot, { width: 16, height: 16 }) }),
          O.library && /* @__PURE__ */ a("button", { type: "button", onClick: () => N(!0), "aria-label": "Choose from media library", title: "Media library", className: f, children: /* @__PURE__ */ s("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ a("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ a("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ a("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        b && O.library && /* @__PURE__ */ a(oa, { client: e, max: r ? Math.max(M, 1) : 1, initialType: ia(t.prop.field, t.prop.name), onInsert: l, onClose: () => N(!1) })
      ]
    }
  );
}
function ca({ field: e, values: t, onChange: r, client: n, onError: i, tagCount: l = 0 }) {
  const { prop: o, kind: h, required: w } = e, x = t[o.name], I = (p) => r(o.name, p), k = o.title || o.name, b = `ms-f-${o.name}`, N = x == null ? "" : String(x), M = Array.isArray(x) ? x : [], O = t[ge(o.name)] === !0, E = z(null), R = (p) => {
    const v = E.current, $ = typeof x == "string" ? x : "", _ = (v == null ? void 0 : v.selectionStart) ?? $.length, C = (v == null ? void 0 : v.selectionEnd) ?? _;
    I($.slice(0, _) + p + " " + $.slice(C)), requestAnimationFrame(() => {
      v == null || v.focus(), v == null || v.setSelectionRange(_ + p.length + 1, _ + p.length + 1);
    });
  };
  let f;
  if (h === "textarea" || h === "json")
    f = /* @__PURE__ */ s(Ge, { children: [
      /* @__PURE__ */ a("textarea", { ref: E, id: b, rows: h === "json" ? 4 : 5, value: typeof x == "string" ? x : x ? JSON.stringify(x, null, 2) : "", onChange: (p) => I(p.target.value), className: `w-full resize-y p-3 text-sm ${h === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && l > 0 && /* @__PURE__ */ s("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ a("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(l, 9) }, (p, v) => `@image${v + 1}`).map((p) => /* @__PURE__ */ a("button", { type: "button", onClick: () => R(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (h === "select") {
    const p = o.enum ?? [];
    f = /* @__PURE__ */ a(
      We,
      {
        id: b,
        label: k,
        options: Wr(p),
        value: x,
        onChange: (v) => {
          I(v), r(ge(o.name), !1);
        },
        allowAuto: Ye(e),
        auto: O,
        onAuto: () => r(ge(o.name), !0)
      }
    );
  } else if (h === "boolean") {
    const p = x === !0;
    f = /* @__PURE__ */ a(
      "button",
      {
        id: b,
        type: "button",
        role: "switch",
        "aria-checked": p,
        onClick: () => I(!p),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${p ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ a("span", { className: `h-5 w-5 rounded-full ${p ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (h === "number") {
    const p = o.minValue !== void 0 && o.maxValue !== void 0;
    f = /* @__PURE__ */ s("div", { className: `flex items-center gap-3 ${O ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ a("input", { type: "range", disabled: O, "aria-label": `${k} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: N === "" ? o.minValue : Number(N), onChange: (v) => I(Number(v.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ a("input", { id: b, type: "number", disabled: O, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: N, onChange: (v) => I(v.target.value === "" ? "" : Number(v.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (h === "media")
    f = /* @__PURE__ */ a(Xe, { client: n, field: e, multiple: !1, max: 1, current: N ? [N] : [], onUrls: (p) => I(p[0]), onError: i });
  else if (h === "media-list") {
    const p = o.maxItems ?? 8;
    f = /* @__PURE__ */ s("div", { className: "space-y-2", children: [
      M.map((v, $) => /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ a("input", { "aria-label": `${k} ${$ + 1}`, value: v, onChange: (_) => I(M.map((C, D) => D === $ ? _.target.value : C)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ a("button", { type: "button", "aria-label": `Remove ${k} ${$ + 1}`, onClick: () => I(M.filter((_, C) => C !== $)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ a(ke, { width: 14, height: 14 }) })
      ] }, $)),
      /* @__PURE__ */ a(Xe, { client: n, field: e, multiple: !0, max: p, current: M, onUrls: (v) => I([...M, ...v].slice(0, p)), onError: i })
    ] });
  } else
    f = /* @__PURE__ */ a("input", { id: b, value: N, onChange: (p) => I(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ s("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ s("label", { htmlFor: b, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        k,
        o.description && /* @__PURE__ */ a("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ a(Lr, { width: 13, height: 13 }) })
      ] }),
      Ye(e) && h === "number" ? /* @__PURE__ */ s("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ a("input", { type: "checkbox", checked: O, onChange: (p) => r(ge(o.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ a("span", { className: "text-[11px] text-primary", children: h === "media-list" ? `${M.length}/${o.maxItems ?? 8} items${w ? " · required" : ""}` : w ? "* required" : "" })
    ] }),
    f
  ] });
}
const Te = {
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
}, we = "Other", da = 3, ua = 2, ma = 20, pa = 2, ha = 4, fa = 40, ga = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Pt(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", r = t.replace(/\d+[a-z]?$/, "") || t;
  return Te[t] ? Te[t] : Te[r] ? Te[r] : r.startsWith("tripo") ? "Tripo" : r === "ai" || r === "" || r.length < 2 ? we : ga(r);
}
function ba(e) {
  const t = /* @__PURE__ */ new Map();
  for (const i of e) {
    const l = Pt(i.name);
    t.set(l, (t.get(l) ?? 0) + 1);
  }
  let r = 0;
  const n = [];
  for (const [i, l] of t)
    i === we || l < da ? r += l : n.push({ id: i, label: i, count: l });
  return n.sort((i, l) => l.count - i.count || i.label.localeCompare(l.label)), r && n.push({ id: we, label: we, count: r }), n;
}
function Vt(e, t) {
  const r = Pt(e.name);
  return t.some((n) => n.id === r) ? r : we;
}
function ya(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function xa(e) {
  let t = 7;
  for (const r of e) t = (t * 33 + r.charCodeAt(0)) % 360;
  return t;
}
const xt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function va(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const r = (n) => {
    const i = xt.indexOf(n);
    return i < 0 ? xt.length : i;
  };
  return [...t].map(([n, i]) => ({ id: n, count: i })).sort((n, i) => r(n.id) - r(i.id) || i.count - n.count || n.id.localeCompare(i.id));
}
const he = "__favourites__", oe = "__all__";
function wa(e, t, r) {
  return e.filter((n) => {
    var i;
    return t.category !== oe && n.category !== t.category ? !1 : t.provider === he ? !!((i = t.favourites) != null && i.includes(n.name)) : t.provider === oe || Vt(n, r) === t.provider;
  });
}
const ka = (e, t) => t.filter((r) => r.id !== we).length >= ua && e.length >= ma;
function Na(e) {
  const t = va(e);
  return e.length >= fa ? t.filter((r) => r.count >= ha) : t;
}
const $e = 200;
function Sa({ model: e }) {
  const t = be(e);
  return t ? /* @__PURE__ */ s("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ a("s", { className: "font-normal text-muted", children: se(t.original) }),
    t.from && t.original !== null ? "from " : "",
    se(t.current)
  ] }) : null;
}
const vt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, wt = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Fe({ label: e, active: t, onClick: r, hue: n, children: i }) {
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
      children: i
    }
  );
}
function Ca({ models: e, value: t, onChange: r, favorites: n, onToggleFavorite: i, usage: l, showGroup: o, scope: h = "default" }) {
  var G;
  const [w, x] = A(!1), [I, k] = A(""), [b, N] = A("popular"), [M, O] = A(!1), E = z(null), R = ee(() => ba(e), [e]), f = ee(() => Na(e), [e]), p = ka(e, R), v = f.length >= pa, [$, _] = A(() => vt(`muapi-studio:provider:${h}`, oe)), [C, D] = A(() => vt(`muapi-studio:category:${h}`, oe)), L = p && ($ === he || $ === oe || R.some((c) => c.id === $)) ? $ : oe, J = v && (C === oe || f.some((c) => c.id === C)) ? C : oe, q = (c) => {
    _(c), wt(`muapi-studio:provider:${h}`, c);
  }, Q = (c) => {
    D(c), wt(`muapi-studio:category:${h}`, c);
  }, g = z(null);
  U(() => {
    w || O(!1);
  }, [w]), U(() => {
    if (!w) return;
    const c = (ie) => {
      var H;
      (H = E.current) != null && H.contains(ie.target) || x(!1);
    }, V = (ie) => {
      ie.key === "Escape" && x(!1);
    };
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", V), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", V);
    };
  }, [w]);
  const m = ee(() => {
    const c = I.trim().toLowerCase(), V = wa(e, { category: J, provider: L, favourites: n }, R), ie = c ? V.filter((W) => W.name.toLowerCase().includes(c) || W.category.toLowerCase().includes(c)) : V, H = Lt(ie, b, { usage: l, favorites: n });
    if (b === "favourites" || b === "most-used") return H;
    const te = new Set(n);
    return [...H.filter((W) => te.has(W.name)), ...H.filter((W) => !te.has(W.name))];
  }, [e, I, b, n, l, J, L, R]), [d, u] = A(0);
  U(() => {
    var c, V;
    u(0), (V = (c = g.current) == null ? void 0 : c.scrollTo) == null || V.call(c, { top: 0 });
  }, [I, b, w, J, L]);
  const y = (c) => {
    c.key === "ArrowDown" ? (c.preventDefault(), u((V) => Math.min(V + 1, Math.min(m.length, $e) - 1))) : c.key === "ArrowUp" ? (c.preventDefault(), u((V) => Math.max(V - 1, 0))) : c.key === "Enter" && m[d] && (c.preventDefault(), r(m[d].name), x(!1));
  };
  return U(() => {
    var c, V;
    (V = (c = document.getElementById(`ms-opt-${d}`)) == null ? void 0 : c.scrollIntoView) == null || V.call(c, { block: "nearest" });
  }, [d]), /* @__PURE__ */ s("div", { ref: E, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => x((c) => !c),
        "aria-haspopup": "listbox",
        "aria-expanded": w,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ a("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (G = (t ?? "?")[0]) == null ? void 0 : G.toUpperCase() }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ a(Re, { up: w, width: 16, height: 16 })
        ]
      }
    ),
    w && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ s("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ a(Fe, { label: "All providers", active: L === oe, onClick: () => q(oe), children: /* @__PURE__ */ a("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ a(Fe, { label: "Favourites", active: L === he, onClick: () => q(he), children: /* @__PURE__ */ a(ft, { width: 14, height: 14, filled: L === he }) }),
        R.map((c) => /* @__PURE__ */ a(Fe, { label: `${c.label} (${c.count})`, active: L === c.id, onClick: () => q(c.id), hue: xa(c.label), children: ya(c.label) }, c.id))
      ] }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        v && /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: oe, label: "All" }, ...f.map((c) => ({ id: c.id, label: c.id }))].map((c) => /* @__PURE__ */ a(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": J === c.id,
            onClick: () => Q(c.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${J === c.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: c.label
          },
          c.id
        )) }),
        /* @__PURE__ */ s("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ s("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ a(ot, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ a("input", { autoFocus: !0, onKeyDown: y, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${d}`, value: I, onChange: (c) => k(c.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ s("div", { className: "relative", children: [
            /* @__PURE__ */ a(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": M,
                onClick: () => O((c) => !c),
                className: `flex h-full items-center rounded-ctl border px-3 ${M ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ a(Gr, { width: 16, height: 16 })
              }
            ),
            M && /* @__PURE__ */ a("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: pr.map((c) => /* @__PURE__ */ a("li", { role: "none", children: /* @__PURE__ */ s(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": b === c.id,
                onClick: () => {
                  N(c.id), O(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${b === c.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  c.label,
                  b === c.id && /* @__PURE__ */ a(Ie, { width: 14, height: 14 })
                ]
              }
            ) }, c.id)) })
          ] })
        ] }),
        (p || v) && /* @__PURE__ */ s("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ s("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            L === he ? "Favourites" : "All models",
            " · ",
            m.length
          ] }),
          p && L !== oe && L !== he && /* @__PURE__ */ a("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: L })
        ] }),
        /* @__PURE__ */ s("ul", { id: "ms-listbox", ref: g, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          m.slice(0, $e).map((c, V) => {
            const ie = c.name === t;
            return /* @__PURE__ */ a(
              "li",
              {
                id: `ms-opt-${V}`,
                role: "option",
                "aria-selected": ie,
                onClick: () => {
                  r(c.name), x(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${ie ? "bg-primary-soft" : V === d ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ a("div", { className: `min-w-0 flex-1 truncate text-sm ${ie ? "text-primary" : ""}`, title: c.name, children: c.name }),
                    /* @__PURE__ */ a(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(c.name) ? "Remove favorite" : "Add favorite",
                        onClick: (H) => {
                          H.stopPropagation(), i(c.name);
                        },
                        className: n.includes(c.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ a(ft, { width: 15, height: 15, filled: n.includes(c.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ s("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ a("span", { className: "truncate text-[10px] text-secondary", children: o ? `${c.group_of} · ${c.category}` : p && L === oe ? `${Vt(c, R)} · ${c.category}` : c.category }),
                    /* @__PURE__ */ a(Sa, { model: c })
                  ] })
                ] })
              },
              c.name
            );
          }),
          m.length === 0 && /* @__PURE__ */ a("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: b === "favourites" ? "No favourites yet. Tap the heart on a model." : b === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${I}”.` }),
          m.length > $e && /* @__PURE__ */ s("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            $e,
            " of ",
            m.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const kt = (e, t) => {
  try {
    const r = localStorage.getItem(e);
    return r ? JSON.parse(r) : t;
  } catch {
    return t;
  }
}, Be = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, Ut = 0.25;
function Qe(e, t) {
  const r = Je(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (r[n.prop.name] = t[n.prop.name]);
  return r;
}
function Aa(e, t) {
  const r = Qe(e, t);
  for (const n of e)
    t[n.prop.name] === void 0 && (delete r[n.prop.name], Ye(n) && (r[ge(n.prop.name)] = !0));
  return r;
}
function Ia({ mode: e, models: t, client: r, batch: n, onRun: i, usage: l, reuse: o, switcher: h }) {
  const w = ye.find((S) => S.id === e), x = ee(() => mr(t, e), [t, e]), [I, k] = A(), [b, N] = A(null), [M, O] = A(null), [E, R] = A({}), [f, p] = A(null), [v, $] = A(null), [_, C] = A(() => kt("muapi-studio:favorites", [])), [D, L] = A("form"), [J, q] = A(!1), [Q, g] = A("{}"), [m, d] = A(null), u = z(0), y = z(null), G = z(void 0), c = z(null);
  U(() => {
    if (!J) return;
    const S = (K) => {
      var re;
      (re = c.current) != null && re.contains(K.target) || q(!1);
    }, F = (K) => {
      K.key === "Escape" && q(!1);
    };
    return document.addEventListener("mousedown", S), document.addEventListener("keydown", F), () => {
      document.removeEventListener("mousedown", S), document.removeEventListener("keydown", F);
    };
  }, [J]);
  const V = z(null), ie = z(null), H = z("form");
  U(() => {
    var K, re, me;
    const S = kt(`muapi-studio:model:${e}`, null), F = ((K = x.find((ue) => ue.name === S)) == null ? void 0 : K.name) ?? ((re = x.find((ue) => ue.name === dr[e])) == null ? void 0 : re.name) ?? ((me = Lt(x, "popular")[0]) == null ? void 0 : me.name);
    k(F);
  }, [e, x]), U(() => {
    if (!o) return;
    V.current = o.inputs;
    const S = ie.current;
    if (S && S.name === o.model) {
      V.current = null, R(Qe(Ve(S), o.inputs)), L("form");
      return;
    }
    x.some((F) => F.name === o.model) ? (k(o.model), Be(`muapi-studio:model:${e}`, o.model)) : V.current = null, L("form");
  }, [o == null ? void 0 : o.nonce]);
  const te = x.find((S) => S.name === I);
  ie.current = b, H.current = D, U(() => {
    if (!I) {
      N(null), R({}), p(null), O(null), $(null), d(null);
      return;
    }
    let S = !0;
    return N(null), O(null), p(null), $(null), d(null), r.model(I).then((F) => {
      if (!S) return;
      const K = Ve(F), re = V.current;
      V.current = null;
      const me = Qe(K, re);
      N(F), R(me), H.current === "json" && g(JSON.stringify(Ue(K, me), null, 2));
    }).catch((F) => {
      S && O(F.message);
    }), () => {
      S = !1;
    };
  }, [I, r]);
  const W = ee(() => b ? Ve(b) : [], [b]), pe = ee(() => Ue(W, E), [W, E]), ne = ee(() => {
    try {
      const S = JSON.parse(Q);
      return S && typeof S == "object" && !Array.isArray(S) ? S : null;
    } catch {
      return null;
    }
  }, [Q]), le = D === "json" ? ne ?? {} : pe, ce = JSON.stringify(le);
  U(() => {
    if (!b || D === "json" && !ne) return;
    const S = ++u.current;
    y.current = null;
    const F = setTimeout(() => {
      r.estimate(b.name, le).then((K) => {
        S === u.current && (p(K), y.current = ce);
      }).catch(() => {
        S === u.current && (p(null), y.current = ce);
      });
    }, 500);
    return () => clearTimeout(F);
  }, [b, ce, r]), U(() => {
    d(null);
  }, [n, ce, D]);
  const De = (S) => {
    k(S), Be(`muapi-studio:model:${e}`, S);
  }, Me = (S) => C((F) => {
    const K = F.includes(S) ? F.filter((re) => re !== S) : [...F, S];
    return Be("muapi-studio:favorites", K), K;
  }), je = (S) => {
    q(!1), S !== D && (S === "json" ? g(JSON.stringify(pe, null, 2)) : ne && R(Aa(W, ne)), L(S), $(null));
  }, Z = te ? be(te, f) : null, Se = ae(async () => {
    if (!b) return;
    d(null);
    const S = W.find((F) => F.prop.name === "prompt");
    await i({
      model: b.name,
      endpointUrl: b.endpoint_url,
      mode: e,
      payload: le,
      count: n,
      kind: rt(b.category),
      prompt: S ? String(le.prompt ?? "") : "",
      unitCost: G.current ?? (Z == null ? void 0 : Z.current)
    });
  }, [b, W, i, e, le, n, Z]), P = ae(async () => {
    var re, me;
    if (!b) return;
    if (D === "json") {
      if (!ne) {
        $("The JSON is not valid");
        return;
      }
      const ue = (b.required_fields ?? []).find((lt) => ne[lt] === void 0 || ne[lt] === "");
      if (ue) {
        $(`${ue} is required`);
        return;
      }
    } else {
      const ue = Yr(W, E);
      if (ue) {
        $(ue);
        return;
      }
    }
    $(null);
    let S = (Z == null ? void 0 : Z.current) ?? 0, F = !0;
    if (y.current !== ce)
      try {
        S = te ? ((re = be(te, await r.estimate(b.name, le))) == null ? void 0 : re.current) ?? S : S;
      } catch {
        F = !1, S = te ? ((me = be(te, null)) == null ? void 0 : me.current) ?? S : S;
      }
    G.current = S;
    const K = S * n;
    if (K > Ut || !F) {
      d(K);
      return;
    }
    await Se();
  }, [b, D, ne, W, E, Z, n, Se, ce, te, r, le]), Y = !!b && !M, de = (() => {
    var F;
    const S = W.find((K) => K.kind === "media-list");
    return S ? Math.max(((F = E[S.prop.name]) == null ? void 0 : F.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ s("section", { "aria-label": w.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ s("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ a("h2", { className: "text-lg font-semibold", children: w.title }),
        /* @__PURE__ */ s("div", { ref: c, className: "relative", children: [
          /* @__PURE__ */ s("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": J, onClick: () => q((S) => !S), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            D === "json" ? "JSON" : "Form",
            /* @__PURE__ */ a(Re, { up: J, width: 12, height: 12 })
          ] }),
          J && /* @__PURE__ */ a("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((S) => /* @__PURE__ */ a("li", { role: "none", children: /* @__PURE__ */ a("button", { role: "menuitemradio", "aria-checked": D === S, type: "button", onClick: () => je(S), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${D === S ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: S === "json" ? "JSON" : "Form" }) }, S)) })
        ] })
      ] }),
      h,
      /* @__PURE__ */ a("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ a("div", { className: "mb-5", children: /* @__PURE__ */ a(Ca, { models: x, value: I, onChange: De, favorites: _, onToggleFavorite: Me, usage: l, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ a("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: D === "json" ? "Request body" : "Parameters" }),
      (te == null ? void 0 : te.description) && /* @__PURE__ */ a("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: te.description }),
      !Y && !M && I && /* @__PURE__ */ s("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ a(Ne, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      M && /* @__PURE__ */ s("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        M
      ] }),
      x.length === 0 && /* @__PURE__ */ a("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      Y && D === "json" && /* @__PURE__ */ s("div", { children: [
        /* @__PURE__ */ a("textarea", { "aria-label": "Request JSON", "aria-invalid": !ne, spellCheck: !1, rows: 16, value: Q, onChange: (S) => g(S.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ a("p", { className: `mt-1.5 text-[11px] ${ne ? "text-muted" : "text-danger"}`, children: ne ? `Sent as the body of POST /api/v1/${b.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      Y && D === "form" && W.map((S) => /* @__PURE__ */ a(
        ca,
        {
          field: S,
          values: E,
          client: r,
          onError: $,
          tagCount: S.prop.name === "prompt" ? de : 0,
          onChange: (F, K) => R((re) => ({ ...re, [F]: K }))
        },
        S.prop.name
      ))
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      v && /* @__PURE__ */ a("p", { role: "alert", className: "mb-2 text-xs text-danger", children: v }),
      m !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: se(m) }),
        " (",
        n,
        " × ",
        se((Z == null ? void 0 : Z.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ a("button", { type: "button", onClick: () => void Se(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => d(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ a("button", { type: "button", onClick: () => {
          b && (R(Je(W)), g(JSON.stringify(Ue(W, Je(W)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ s(
          "button",
          {
            type: "button",
            onClick: () => void P(),
            disabled: !Y,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ a(nt, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              Z && /* @__PURE__ */ s("span", { className: "font-normal", children: [
                "(",
                Z.original !== null ? /* @__PURE__ */ s(Ge, { children: [
                  /* @__PURE__ */ a("s", { className: "opacity-60", children: se(Z.original * n) }),
                  " "
                ] }) : null,
                se(Z.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Ma = {
  image: Le,
  video: Ir,
  audio: Mr,
  avatar: Er,
  "3d": at,
  "ai-tools": Tr,
  text: Rr,
  more: Or
};
function Ea({ mode: e, onChange: t, layout: r = "rail", onChangeKey: n }) {
  return r === "tabs" ? /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    ye.map((i) => {
      const l = i.id === e;
      return /* @__PURE__ */ s(
        "button",
        {
          onClick: () => t(i.id),
          "aria-current": l ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${l ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            i.label,
            l && /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        i.id
      );
    }),
    n && /* @__PURE__ */ s("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ a(gt, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    ye.map((i) => {
      const l = Ma[i.id], o = i.id === e;
      return /* @__PURE__ */ s(
        "button",
        {
          onClick: () => t(i.id),
          "aria-current": o ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${o ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ a(l, {}),
            i.label
          ]
        },
        i.id
      );
    }),
    n && /* @__PURE__ */ s("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ a(gt, {}),
      "Key"
    ] })
  ] });
}
const Ta = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, Nt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, $a = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], _a = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], La = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], Ga = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), St = { minimax: "2k" }, Ra = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], Oa = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), Da = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], ja = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], Pa = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], Va = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], Ua = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), qa = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Fa = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), Ba = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], qt = {
  seedream: { aspect: $a, resolution: _a },
  seedance: { aspect: La, duration: Ga },
  minimax: { resolution: Ra, duration: Oa },
  wan: { aspect: Da, resolution: ja, quality: Pa, duration: Va },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, za = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, xe = (e, t, r = !1) => ({ id: e, label: t, kind: "image", optional: r });
function Ft(e) {
  return ((r) => r.map((n, i) => {
    var l;
    return { ...n, label: ((l = Ta[e.slug]) == null ? void 0 : l[i]) ?? n.label };
  }))(Ha(e));
}
function Ha(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [xe("base", "Target base image"), xe("face", "New face image")];
    case "video-face-swap":
      return [xe("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [xe("start", "Starting frame image"), xe("end", "Ending frame image", !0)];
    default:
      return [xe("source", "Source image")];
  }
}
function Ja(e) {
  return za[e.template];
}
function Ct(e) {
  var n, i, l, o, h, w, x, I, k, b, N, M, O;
  const t = qt[e.template], r = {};
  for (const E of e.sliders ?? []) r[E.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: r,
    aspect: (l = (i = t.aspect) == null ? void 0 : i[0]) == null ? void 0 : l.value,
    resolution: St[e.template] && ((h = (o = t.resolution) == null ? void 0 : o.find((E) => E.value === St[e.template])) == null ? void 0 : h.value) || ((x = (w = t.resolution) == null ? void 0 : w[0]) == null ? void 0 : x.value),
    duration: ((k = (I = t.duration) == null ? void 0 : I.find((E) => E.value === 5)) == null ? void 0 : k.value) ?? ((N = (b = t.duration) == null ? void 0 : b[0]) == null ? void 0 : N.value),
    quality: (O = (M = t.quality) == null ? void 0 : M[0]) == null ? void 0 : O.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Bt(e, t) {
  var i;
  const r = [e.prompt], n = (i = e.presets) == null ? void 0 : i.find((l) => l.id === t.preset);
  n != null && n.prompt && r.push(n.prompt);
  for (const l of e.sliders ?? []) {
    const o = t.sliders[l.id] ?? 0;
    if (o !== 0) {
      const h = l.phrase(o);
      h && r.push(h);
    }
  }
  return t.refinement.trim() && r.push(t.refinement.trim()), r.filter(Boolean).join(" ");
}
function At(e, t, r) {
  var l;
  const n = (l = e.presets) == null ? void 0 : l.find((o) => o.id === r), i = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: r, sliders: i };
}
function Ya(e, t) {
  for (const r of Ft(e)) if (!r.optional && !t.uploads[r.id]) return `${r.label} is required`;
  return null;
}
function Ka(e, t) {
  const r = Bt(e, t), n = t.uploads;
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
function Wa(e) {
  return Nt[e.slug] ? Nt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Xa = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], T = (e, t, r, n, i) => ({ id: e, label: t, hint: r, prompt: n, values: i }), Ze = (e, t, r, n = "") => `${e > 0 ? t : r} ${Math.abs(e)}${n}`, B = (e, t, r, n, i, l, o = {}) => ({ slug: e, name: t, emoji: r, category: n, badge: "IMAGE", template: "seedream", blurb: i, prompt: l, ...o }), j = (e, t, r, n, i, l, o = {}) => ({ slug: e, name: t, emoji: r, category: n, badge: "VIDEO", template: "seedance", blurb: i, prompt: l, ...o }), _e = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${Ze(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${Ze(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Qa = [_e[2], { ..._e[1], id: "vertical", label: "Vertical angle" }, _e[0]].map((e) => ({ ...e, id: e.id })), Za = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${Ze(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], en = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], tn = "Keep the result tasteful and suitable for general audiences.", zt = [
  // ---- Professional
  B(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: _e, presets: [
      T("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      T("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      T("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      T("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      T("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      T("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      T("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  B(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  B(
    "shots",
    "Shots",
    "🎥",
    "professional",
    "Reframe one photo as different cinematic shot types.",
    "Reframe this scene as a professional cinematic shot while keeping the same subject and setting.",
    { presets: [
      T("wide", "Wide", void 0, "Use a wide establishing shot."),
      T("medium", "Medium", void 0, "Use a medium shot from the waist up."),
      T("close", "Close-up", void 0, "Use a close-up on the subject’s face or key detail."),
      T("xcu", "Extreme close-up", void 0, "Use an extreme close-up on a small detail."),
      T("ots", "Over-the-shoulder", void 0, "Use an over-the-shoulder shot."),
      T("low", "Low angle", void 0, "Shoot from a low angle looking up."),
      T("high", "High angle", void 0, "Shoot from a high angle looking down."),
      T("dutch", "Dutch angle", void 0, "Tilt the camera for a Dutch angle.")
    ] }
  ),
  B(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Qa.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
  ),
  j(
    "behind-the-scenes",
    "Behind the Scenes",
    "🎞️",
    "professional",
    "Pull back from the photo to reveal the film set around it.",
    "Start on this photograph, then pull the camera back to reveal it is a film set with lighting rigs, cameras and crew working around the scene."
  ),
  j(
    "transitions",
    "Transitions",
    "🔄",
    "professional",
    "Animate a smooth cinematic transition out of the image.",
    "Create a smooth, professional cinematic transition starting from this image with fluid motion.",
    { presets: [
      T("morph", "Morph", void 0, "Use a morph transition."),
      T("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      T("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      T("whip", "Whip pan", void 0, "Use a fast whip pan."),
      T("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  B(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  B(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: en, presets: [
      T("natural", "Natural", "Clean, true to life", void 0, { saturation: 5, contrast: 5 }),
      T("cinematic", "Cinematic", "Teal and orange", "Give it a cinematic teal and orange look.", { contrast: 20, saturation: 10, temperature: -5 }),
      T("split", "Split tone", "Warm highlights, cool shadows", "Use split toning with warm highlights and cool shadows.", { contrast: 10 }),
      T("softskin", "Soft skin", "Gentle and flattering", "Soften skin tones gently.", { contrast: -10, highlights: -10 }),
      T("oldlens", "Old lens", "Vintage glass", "Mimic a vintage lens with soft edges and subtle flare.", { saturation: -10, grain: 20 }),
      T("film16", "16mm film", "Grain and warmth", "Mimic 16mm film stock.", { temperature: 15, grain: 55, contrast: 10 }),
      T("moody", "Moody", "Dark and desaturated", "Make it dark and moody.", { exposure: -20, saturation: -25, contrast: 25 })
    ] }
  ),
  // ---- Enhance & Style
  B(
    "ai-stylist",
    "AI Stylist",
    "👗",
    "enhance-style",
    "Try outfit styles on your photo while keeping your pose.",
    "Restyle the person in this photo with a new outfit while keeping their face, pose and the background natural.",
    { presets: [
      T("casual", "Casual", void 0, "Dress them in a relaxed casual outfit."),
      T("formal", "Formal", void 0, "Dress them in a sharp formal outfit."),
      T("street", "Streetwear", void 0, "Dress them in streetwear."),
      T("athletic", "Athletic", void 0, "Dress them in athletic wear."),
      T("evening", "Evening", void 0, "Dress them in an elegant evening outfit."),
      T("vintage", "Vintage", void 0, "Dress them in a vintage-style outfit.")
    ] }
  ),
  B(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Za }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  B(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  B(
    "style-snap",
    "Style Snap",
    "📸",
    "enhance-style",
    "Quick style makeovers that keep your pose.",
    "Give the person a new fashion style while keeping the same pose, face and setting.",
    { presets: [
      T("boho", "Boho chic", void 0, "Use a boho chic look."),
      T("minimal", "Minimalist", void 0, "Use a clean minimalist look."),
      T("punk", "Punk rock", void 0, "Use a punk rock look."),
      T("preppy", "Preppy", void 0, "Use a preppy look."),
      T("y2k", "Y2K", void 0, "Use an early-2000s Y2K look."),
      T("cottage", "Cottagecore", void 0, "Use a cottagecore look.")
    ] }
  ),
  B(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  B(
    "glitter-sticker",
    "Glitter Sticker",
    "🌟",
    "enhance-style",
    "Turn a portrait into a holographic glitter sticker on a street wall.",
    "Turn this portrait into a shiny holographic glitter sticker stuck onto a gritty urban surface."
  ),
  j(
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
  B(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  B(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  B(
    "headshot-generator",
    "Headshot Generator",
    "📷",
    "face-identity",
    "Studio-style professional headshots from a photo.",
    "Create a professional studio headshot of this person: flattering lighting, clean background, natural expression and sharp focus on the face.",
    { consent: !0, presets: [
      T("corporate", "Corporate", void 0, "Use a classic corporate look."),
      T("creative", "Creative", void 0, "Use a modern creative look with a colored backdrop."),
      T("linkedin", "LinkedIn", void 0, "Frame it as a friendly LinkedIn profile photo."),
      T("exec", "Executive", void 0, "Use an authoritative executive look.")
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
  B(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  B(
    "japanese-show",
    "Japanese Show",
    "📺",
    "video-editing",
    "Retro variety-show look with CRT scanlines.",
    "Turn this photo into a still from a retro 2000s Japanese variety show, with CRT scanlines, on-screen captions and broadcast effects."
  ),
  { slug: "video-bg-remover", name: "Video Background Remover", emoji: "🎬", category: "video-editing", badge: "VIDEO", template: "bg-remover", blurb: "Remove the background from a video.", prompt: "" },
  // ---- Ads & Products (the uploaded image is the product or subject)
  j("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  j("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  j("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  B("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
  j("bullet-time-scene", "Bullet Time Scene", "⏱️", "ads", "Frozen-moment bullet-time camera move.", "Create a bullet-time effect: time freezes while the camera sweeps around the subject and product in the image."),
  j("chameleon", "Chameleon", "🦎", "ads", "A character changes to match the product’s look.", "Show the character smoothly transforming their outfit and colors to match the brand look of the product in the image."),
  j("asmr-host", "ASMR Host", "🎙️", "ads", "A whispering host presents the product.", "Create an ASMR presentation where a soft-spoken host presents the product from the image up close."),
  j("packshot", "Packshot", "📦", "ads", "Polished product showcase with slow rotation.", "Create a clean studio packshot video of the product in the image, slowly rotating under soft studio lighting."),
  j("macro-scene", "Macro Scene", "🔬", "ads", "Extreme close-up of product details.", "Create an extreme macro close-up video that glides over the textures and details of the product in the image."),
  j("magic-button", "Magic Button", "✨", "ads", "The product appears in a burst of light.", "Show the product from the image appearing magically in a burst of light and drifting particles."),
  j("truck-ad", "Truck Ad", "🚛", "ads", "Product displayed on a truck driving through a city.", "Show the product from the image printed large on the side of a truck driving through a busy city street."),
  j("giant-product", "Giant Product", "🦖", "ads", "A building-sized product towering over a person.", "Create a surreal scene where the product from the image is as tall as a building, towering over a small person on the street."),
  j("bullet-time-white", "Bullet Time White", "⚪", "ads", "360° rotation on a clean white background.", "Create a bullet-time 360 degree rotation around the subject and product in the image on a clean white background."),
  j("kick-ad", "Kick Ad", "🦵", "ads", "A character kicks the product into frame.", "Create an energetic action ad where a character kicks the product from the image into the frame."),
  j("billboard-ad", "Billboard Ad", "🏙️", "ads", "Product on a glowing billboard at night.", "Show the product from the image on a huge glowing billboard in a busy city at night."),
  B("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  j("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  j("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  j("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  B("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  B(
    "game-dump",
    "Game Dump",
    "🎮",
    "games-characters",
    "See yourself as a hero in different game genres.",
    "Transform the person in this photo into a video game character with a game-style interface overlay, keeping their likeness.",
    { presets: [
      T("fps", "FPS shooter", void 0, "Use a first-person shooter look."),
      T("rpg", "RPG fantasy", void 0, "Use a fantasy role-playing game look."),
      T("racing", "Racing", void 0, "Use a racing game look."),
      T("fighting", "Fighting", void 0, "Use a fighting game look."),
      T("horror", "Survival horror", void 0, "Use a survival horror game look."),
      T("sports", "Sports", void 0, "Use a sports game look."),
      T("open", "Open world", void 0, "Use an open-world adventure game look."),
      T("platform", "Platformer", void 0, "Use a colorful platformer look.")
    ] }
  ),
  B("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  B("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  B("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  B("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  B("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  B("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  B(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [T("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), T("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), T("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), T("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  B("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  j("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  j("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${tn}`),
  j("roller-coaster", "Roller Coaster", "🎢", "trending-templates", "A thrilling roller-coaster ride.", "Put the person from this photo on a roller coaster ride with wind, speed and a dramatic camera."),
  j("60s-cafe", "60s Cafe", "☕", "trending-templates", "A vintage 1960s cafe scene.", "Place the person from this photo in a vintage 1960s cafe with retro decor, warm film tones and gentle motion."),
  j("victory-card", "Victory Card", "🃏", "trending-templates", "A winning playing-card moment.", "Turn this photo into a winning playing card, with the person triumphant as the card flips and glows."),
  j("sand-worm", "Sand Worm", "🐛", "trending-templates", "An epic desert creature scene.", "Place the person from this photo in an epic desert scene with a giant sand creature rising behind them."),
  j("skibidi", "Toilet Meme", "🚽", "trending-templates", "A silly toilet-character meme look.", "Turn this photo into a goofy toilet-themed meme character with exaggerated head bobbing."),
  j("j-poster", "J Poster", "🎌", "trending-templates", "A Japanese-style poster.", "Turn this photo into a bold Japanese-style poster with dramatic typography and animated accents."),
  j("mascot", "Mascot", "🏈", "trending-templates", "A sports mascot character.", "Transform the person in this photo into an energetic sports mascot character cheering in a stadium."),
  j("storm-creature", "Storm Creature", "⛈️", "trending-templates", "An epic storm creature scene.", "Place the person from this photo in a stormy sky scene with a giant creature made of clouds and lightning."),
  j("burning-sunset", "Burning Sunset", "🌅", "trending-templates", "An epic burning-sunset scene.", "Place the person from this photo against an epic burning sunset sky with drifting embers."),
  j("on-fire", "On Fire", "🔥", "trending-templates", "A calm-in-chaos burning-room meme scene.", "Show the person from this photo calmly sitting in a room that is on fire, in a humorous cartoon-like meme style."),
  j("comic-book", "Comic Book", "💥", "trending-templates", "Comic-book panels and action lines.", "Turn this photo into an animated comic-book page with bold ink lines, halftone dots and action bursts."),
  j("cloud-surf", "Cloud Surf", "☁️", "trending-templates", "Surfing on dreamy pink clouds.", "Show the person from this photo surfing on a wave of dreamy pink clouds at sunset."),
  j("mukbang", "Mukbang", "🍜", "trending-templates", "A viral eating-show scene.", "Turn this photo into a viral eating-show video with the person enjoying a big spread of food at a table."),
  j("melting-doodle", "Melting Doodle", "🫠", "trending-templates", "Mesmerizing melting doodle art.", "Turn this photo into colorful doodle art that slowly melts and swirls."),
  j("giallo-horror", "Giallo Horror", "🩸", "trending-templates", "A stylised 1970s thriller scene.", "Turn this photo into a stylised 1970s Italian thriller scene with saturated colors, dramatic shadows and a suspenseful camera move. Keep it non-graphic."),
  j("renaissance", "Renaissance", "🖼️", "trending-templates", "A classical gallery painting.", "Turn this photo into a classical Renaissance oil painting hanging in a gallery, subtly coming to life."),
  j("rap-god", "Rap God", "🎤", "trending-templates", "A rap-video style clip.", "Turn this photo into a stylish rap music video clip with the person performing, with dynamic lighting and camera moves.")
], Oe = (e) => zt.find((t) => t.slug === e), et = (e) => e.badge === "VIDEO" ? "video" : "image", st = (e) => zt.filter((t) => et(t) === e), tt = (e) => st(e).length > 0;
function Ht(e) {
  const t = new URLSearchParams(e), r = t.get("tab"), n = Oe(t.get("app"));
  return r === "apps" ? { mode: n ? et(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && r === et(n) ? { mode: r, app: n.slug } : { mode: null, app: null };
}
function rn(e, t, r) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), r ? n.set("app", r) : n.delete("app"), `?${n.toString()}`;
}
function an(e, t, r) {
  return `${e.pathname}${rn(e.search, t, r)}${e.hash}`;
}
function nn(e, t) {
  const r = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!r || `${n.name} ${n.blurb}`.toLowerCase().includes(r)));
}
const on = (e) => Xa.filter((t) => st(e).some((r) => r.category === t.id));
function sn({ mode: e, value: t, onChange: r }) {
  const [n, i] = A(!1), [l, o] = A(""), [h, w] = A("all"), [x, I] = A(0), k = z(null), b = ee(() => on(e), [e]), N = ee(() => nn(st(e), { category: h, q: l }), [e, h, l]), M = Oe(t);
  U(() => I(0), [l, h, n]), U(() => {
    if (!n) return;
    const f = (v) => {
      var $;
      ($ = k.current) != null && $.contains(v.target) || i(!1);
    }, p = (v) => {
      v.key === "Escape" && i(!1);
    };
    return document.addEventListener("mousedown", f), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", f), document.removeEventListener("keydown", p);
    };
  }, [n]), U(() => {
    var f, p;
    (p = (f = document.getElementById(`ms-app-${x}`)) == null ? void 0 : f.scrollIntoView) == null || p.call(f, { block: "nearest" });
  }, [x]);
  const O = (f) => {
    r(f), i(!1), o("");
  }, E = (f) => {
    f.key === "ArrowDown" ? (f.preventDefault(), I((p) => Math.min(p + 1, N.length - 1))) : f.key === "ArrowUp" ? (f.preventDefault(), I((p) => Math.max(p - 1, 0))) : f.key === "Enter" && N[x] && (f.preventDefault(), O(N[x].slug));
  }, R = (f) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${f ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ s("div", { ref: k, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => i((f) => !f),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (M == null ? void 0 : M.emoji) ?? "✨" }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", children: (M == null ? void 0 : M.name) ?? "Choose an app" }),
          /* @__PURE__ */ a(Re, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ s("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ a(ot, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ a("input", { autoFocus: !0, onKeyDown: E, value: l, onChange: (f) => o(f.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ s("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ a("button", { role: "tab", type: "button", "aria-selected": h === "all", onClick: () => w("all"), className: R(h === "all"), children: "All" }),
        b.map((f) => /* @__PURE__ */ a("button", { role: "tab", type: "button", "aria-selected": h === f.id, onClick: () => w(f.id), className: R(h === f.id), children: f.label }, f.id))
      ] }),
      /* @__PURE__ */ s("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        N.map((f, p) => /* @__PURE__ */ s(
          "li",
          {
            id: `ms-app-${p}`,
            role: "option",
            "aria-selected": f.slug === t,
            onClick: () => O(f.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${f.slug === t ? "bg-primary-soft" : p === x ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-lg", children: f.emoji }),
              /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ a("div", { className: `truncate text-sm ${f.slug === t ? "text-primary" : ""}`, children: f.name }),
                /* @__PURE__ */ a("div", { className: "truncate text-[10px] text-secondary", children: f.blurb })
              ] })
            ]
          },
          f.slug
        )),
        N.length === 0 && /* @__PURE__ */ s("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          l,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const ln = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), Ce = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function cn({ mode: e, slug: t, onApp: r, switcher: n, models: i, client: l, batch: o, onRun: h }) {
  const w = Oe(t), x = ye.find((I) => I.id === e).title;
  return /* @__PURE__ */ s("section", { "aria-label": x, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ a("h2", { className: "mb-4 text-lg font-semibold", children: x }),
      n,
      /* @__PURE__ */ a("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ a("div", { className: "relative z-20", children: /* @__PURE__ */ a(sn, { mode: e, value: t, onChange: r }) })
    ] }),
    w ? /* @__PURE__ */ a(dn, { app: w, mode: e, models: i, client: l, batch: o, onRun: h }, w.slug) : /* @__PURE__ */ a("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function dn({ app: e, mode: t, models: r, client: n, batch: i, onRun: l }) {
  var Q;
  const [o, h] = A(() => Ct(e)), [w, x] = A(null), [I, k] = A(null), [b, N] = A(null), M = z(0), O = z(null), E = z(void 0);
  U(() => {
    h(Ct(e)), x(null), k(null), N(null);
  }, [e]);
  const R = Ja(e), f = r.find((g) => g.name === R), p = qt[e.template], v = ee(() => Ka(e, o), [e, o]), $ = JSON.stringify(v), _ = (g) => h((m) => ({ ...m, ...g }));
  U(() => {
    if (!f) return;
    const g = ++M.current;
    O.current = null;
    const m = setTimeout(() => {
      n.estimate(R, v).then((d) => {
        g === M.current && (k(d), O.current = $);
      }).catch(() => {
        g === M.current && (k(null), O.current = $);
      });
    }, 500);
    return () => clearTimeout(m);
  }, [$, f, n]), U(() => {
    N(null);
  }, [i, $]);
  const C = f ? be(f, I) : null, D = Ft(e), L = async () => {
    f && (N(null), await l({ model: R, endpointUrl: f.endpoint_url, mode: t, prompt: Bt(e, o) || e.name, payload: v, count: i, kind: rt(f.category), unitCost: E.current ?? (C == null ? void 0 : C.current) }));
  }, J = async () => {
    var y, G;
    const g = Ya(e, o);
    if (g) {
      x(g);
      return;
    }
    x(null);
    let m = (C == null ? void 0 : C.current) ?? 0, d = !0;
    if (f && O.current !== $)
      try {
        m = ((y = be(f, await n.estimate(R, v))) == null ? void 0 : y.current) ?? m;
      } catch {
        d = !1, m = ((G = be(f, null)) == null ? void 0 : G.current) ?? m;
      }
    E.current = m;
    const u = m * i;
    if (u > Ut || !d) {
      N(u);
      return;
    }
    await L();
  }, q = (g, m, d, u) => m && m.length > 0 ? /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ a("div", { className: Ce, children: g }),
    /* @__PURE__ */ a(We, { label: g, options: ln(m), value: d, onChange: u })
  ] }) : null;
  return /* @__PURE__ */ s("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ a("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ a("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !f && /* @__PURE__ */ s("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        R,
        "”, which is not in your catalog right now."
      ] }),
      D.map((g) => /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: Ce, children: [
          /* @__PURE__ */ a("span", { children: g.label }),
          /* @__PURE__ */ a("span", { className: "text-[11px] text-primary", children: g.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ a(
          Xe,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: o.uploads[g.id] ? [o.uploads[g.id]] : [],
            field: { prop: { name: `${g.kind}_${g.id}`, title: g.label, field: g.kind }, kind: "media", required: !g.optional },
            onUrls: (m) => _({ uploads: { ...o.uploads, [g.id]: m[0] ?? "" } }),
            onError: x
          }
        )
      ] }, g.id)),
      e.presets && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ a("div", { className: Ce, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ a(We, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((g) => ({ value: g.id, label: g.label, hint: g.hint }))], value: o.preset, onChange: (g) => h(At(e, o, String(g))) })
      ] }),
      e.sliders && /* @__PURE__ */ a("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (Q = e.sliders) == null ? void 0 : Q.map((g) => /* @__PURE__ */ s("div", { className: "mb-4", children: [
        /* @__PURE__ */ s("div", { className: Ce, children: [
          /* @__PURE__ */ a("label", { htmlFor: `ms-sl-${g.id}`, children: g.label }),
          /* @__PURE__ */ s("span", { className: "tabular-nums text-primary", children: [
            o.sliders[g.id] ?? 0,
            g.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ a("input", { id: `ms-sl-${g.id}`, type: "range", min: g.min, max: g.max, step: g.step, value: o.sliders[g.id] ?? 0, className: "w-full", onChange: (m) => _({ sliders: { ...o.sliders, [g.id]: Number(m.target.value) } }) })
      ] }, g.id)),
      e.sliders && /* @__PURE__ */ a("button", { type: "button", onClick: () => h(At(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: Ce, children: [
          "Prompt refinement ",
          /* @__PURE__ */ a("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ a("textarea", { "aria-label": "Prompt refinement", rows: 3, value: o.refinement, onChange: (g) => _({ refinement: g.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      q("Aspect Ratio", p.aspect, o.aspect, (g) => _({ aspect: g })),
      q(e.template === "seedream" ? "Output Resolution" : "Resolution", p.resolution, o.resolution, (g) => _({ resolution: g })),
      q("Quality Level", p.quality, o.quality, (g) => _({ quality: String(g) })),
      q("Duration", p.duration, o.duration, (g) => _({ duration: Number(g) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && q("Target Face Index", Ua, o.targetIndex, (g) => _({ targetIndex: Number(g) })),
      e.template === "video-face-swap" && q("Target Gender Filter", qa, o.gender, (g) => _({ gender: String(g) })),
      e.template === "bg-remover" && /* @__PURE__ */ s(Ge, { children: [
        q("Background Color", Fa, o.background, (g) => _({ background: String(g) })),
        q("Output Container & Codec", Ba, o.container, (g) => _({ container: String(g) })),
        /* @__PURE__ */ s("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ a("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ a("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": o.keepAudio, onClick: () => _({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ a("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      w && /* @__PURE__ */ a("p", { role: "alert", className: "mb-2 text-xs text-danger", children: w }),
      b !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: se(b) }),
        " (",
        i,
        " × ",
        se((C == null ? void 0 : C.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ a("button", { type: "button", onClick: () => void L(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => N(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !f, onClick: () => void J(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ a(nt, { width: 16, height: 16, className: "shrink-0" }),
        Wa(e),
        i > 1 ? ` ×${i}` : "",
        C && C.current > 0 && /* @__PURE__ */ s("span", { className: "font-normal", children: [
          "(",
          se(C.current * i),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function It({ view: e, onChange: t }) {
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
function un() {
  try {
    const e = window.location.search, t = Ht(e);
    if (t.mode) return t.mode;
    const r = new URLSearchParams(e).get("tab");
    return ur(r) ? r : null;
  } catch {
    return null;
  }
}
const Ae = {
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
function Mt(e) {
  if (!tt(e)) return { view: "models", app: null };
  try {
    const r = Ht(window.location.search);
    if (r.mode === e && r.app) return { view: "apps", app: r.app };
    if (r.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = Ae.get(`muapi-studio:app:${e}`);
  return { view: Ae.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Oe(t) ? t : null };
}
function mn({ scope: e, apiBase: t = "/api/muapi", initialTab: r = "image", showHeader: n = !0, title: i = "Studio", teamId: l, theme: o = "lime", layout: h, apiKey: w, onRequestApiKey: x, getHeaders: I, connected: k, fetchImpl: b, features: N, className: M = "", onTabChange: O }) {
  const E = k === !1 || w === "" || w === null, R = z(I);
  R.current = I;
  const [f, p] = A(!1), v = ee(() => new tr(t, l, { apiKey: w || void 0, getHeaders: () => {
    var P;
    return ((P = R.current) == null ? void 0 : P.call(R)) ?? {};
  }, fetchImpl: b, onKeyRejected: () => p(!0) }), [t, l, w, b]);
  U(() => p(!1), [v]);
  const [$, _] = A({ library: !0, deleteMedia: !0 }), C = ee(() => ({ library: $.library && (N == null ? void 0 : N.library) !== !1, deleteMedia: (N == null ? void 0 : N.deleteMedia) !== !1 }), [$, N == null ? void 0 : N.library, N == null ? void 0 : N.deleteMedia]), D = h ?? lr(o), [L, J] = A(() => un() ?? r), [q, Q] = A(4), [g, m] = A(null), [d, u] = A(null), [y, G] = A(null), c = ae(() => {
    v.balance().then(G).catch(() => G(null));
  }, [v]), [V, ie] = A(null), H = Nr(v, g, c, e), te = ee(() => yr(H.items), [H.items]);
  U(() => {
    E || (u(null), m(null), v.models().then(m).catch((P) => u(P.message)), c(), (N == null ? void 0 : N.library) !== !1 && v.probe().then(_));
  }, [v, c, E, N == null ? void 0 : N.library]);
  const [W, pe] = A(() => Mt(L)), ne = (P, Y) => {
    try {
      window.history.replaceState(null, "", an(window.location, P, Y));
    } catch {
    }
  }, le = (P) => {
    const Y = Mt(P);
    J(P), pe(Y), O == null || O(P), ne(P, Y.view === "apps" ? Y.app : null);
  }, ce = (P) => {
    pe((Y) => ({ ...Y, view: P })), Ae.set(`muapi-studio:view:${L}`, P), ne(L, P === "apps" ? W.app : null);
  }, De = (P) => {
    pe({ view: "apps", app: P }), Ae.set(`muapi-studio:app:${L}`, P), Ae.set(`muapi-studio:view:${L}`, "apps"), ne(L, P);
  }, Me = ae(async (P) => {
    await H.run(P);
  }, [H.run]), je = ae((P) => {
    var de;
    const Y = g == null ? void 0 : g.find((S) => S.name === P);
    return Y ? ((de = Y.sale) == null ? void 0 : de.from) ?? Y.cost ?? void 0 : void 0;
  }, [g]), Z = ae((P) => {
    J(P.mode), pe((Y) => ({ ...Y, view: "models" })), ie({ model: P.model, inputs: P.inputs, nonce: Date.now() });
  }, []), Se = ae(async (P) => {
    var K;
    const Y = g == null ? void 0 : g.find((re) => re.name === P.model);
    if (!Y) return;
    let de = ((K = Y.sale) == null ? void 0 : K.from) ?? Y.cost ?? 0, S = !1;
    try {
      de = (await v.estimate(P.model, P.inputs)).cost, S = !0;
    } catch {
    }
    const F = S ? "" : " (the exact price could not be checked)";
    (de > 0.25 || !S) && !window.confirm(`Re-run ${P.model} for about $${de.toFixed(2)}?${F}`) || H.run({ model: P.model, endpointUrl: Y.endpoint_url, mode: P.mode, prompt: P.prompt, payload: P.inputs, count: 1, unitCost: de, kind: rt(Y.category) });
  }, [g, H.run, v]);
  return /* @__PURE__ */ s("div", { className: `ms-root ${M}`.trim(), style: sr(o), "data-layout": D, "data-btn": cr(o), children: [
    n && /* @__PURE__ */ s("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ a("h1", { className: "text-base font-semibold", children: i }),
      y && /* @__PURE__ */ s("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: se(y.balance) })
      ] })
    ] }),
    E ? /* @__PURE__ */ s("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ a("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ a("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      x && /* @__PURE__ */ a("button", { type: "button", onClick: x, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ s(Tt.Provider, { value: C, children: [
      f && /* @__PURE__ */ s("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ a("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        x && /* @__PURE__ */ a("button", { type: "button", onClick: x, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ s("div", { className: `flex min-h-0 flex-1 flex-col ${D === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ a(Ea, { mode: L, onChange: le, layout: D, onChangeKey: x }),
        /* @__PURE__ */ a("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: d ? /* @__PURE__ */ s("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          d
        ] }) : g ? /* @__PURE__ */ s(Ge, { children: [
          W.view === "apps" && tt(L) ? /* @__PURE__ */ a(cn, { mode: L, slug: W.app, onApp: De, switcher: /* @__PURE__ */ a(It, { view: "apps", onChange: ce }), models: g, client: v, batch: q, onRun: Me }) : /* @__PURE__ */ a(Ia, { mode: L, models: g, client: v, batch: q, onRun: Me, usage: te, reuse: V, switcher: tt(L) ? /* @__PURE__ */ a(It, { view: "models", onChange: ce }) : void 0 }),
          /* @__PURE__ */ a(Br, { mode: L, items: H.items, batch: q, onBatch: Q, onLabel: H.setLabel, onRemove: H.remove, onReuse: Z, onRerun: Se, onDeleteMedia: H.deleteMedia, onLoadMore: H.loadMore, hasMore: H.hasMore, loadingMore: H.loadingMore, serverError: H.serverError, estimateFor: je })
        ] }) : /* @__PURE__ */ s("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ a(Ne, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function fn(e) {
  const t = e.accountId ?? vr(e.apiKey);
  return /* @__PURE__ */ a(mn, { scope: t, ...e }, t);
}
export {
  fe as ApiError,
  tr as MuapiClient,
  fn as MuapiStudio,
  ir as THEMES,
  or as cyanTheme,
  lr as defaultLayout,
  rt as generationKind,
  ze as limeTheme,
  ct as pollUntilDone,
  _t as resolveTheme,
  vr as scopeOfKey,
  sr as themeStyle
};
