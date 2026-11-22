import { jsx as r, jsxs as s, Fragment as Ee } from "react/jsx-runtime";
import { createContext as Ft, useContext as Bt, useState as C, useRef as K, useEffect as q, useCallback as te, useMemo as ee, createElement as zt, useId as Ht, useLayoutEffect as Jt } from "react";
function Yt(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
function Kt(e) {
  const t = Number(e);
  return e && Number.isFinite(t) && t >= 0 ? Math.min(t, 120) * 1e3 : void 0;
}
class ce extends Error {
  constructor(t, a, n) {
    super(t), this.status = a, this.retryAfterMs = n;
  }
}
function Ct(e) {
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
function Wt(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Xt {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    var m, k, y, A;
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [N, b] of Object.entries(await this.opts.getHeaders())) n.set(N, b);
    const i = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), l = await i.text();
    let o = null;
    try {
      o = l ? JSON.parse(l) : null;
    } catch {
    }
    if (!i.ok && Yt(i.status, o, l) && !t.startsWith("/app/") && ((k = (m = this.opts).onKeyRejected) == null || k.call(m)), !i.ok) throw new ce(Wt(o, `${i.status} ${i.statusText}`), i.status, Kt((A = (y = i.headers) == null ? void 0 : y.get) == null ? void 0 : A.call(y, "retry-after")));
    if (o === null && l.trim()) throw new ce("Unexpected non-JSON response from the server", 502);
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
  estimate(t, a) {
    return this.request(`/api/v1/models/${encodeURIComponent(t)}/estimate-cost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(a)
    });
  }
  /** Submit with the model's `endpoint_url` (the catalog's `endpoint` field can be wrong). */
  async submit(t, a, n) {
    var o;
    const i = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(a)
    }), l = i.request_id || i.id;
    if (!l) throw new ce("The API did not return a request id", 502);
    return { requestId: l, cost: (o = i.cost) == null ? void 0 : o.amount_usd };
  }
  async poll(t) {
    var o;
    const a = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), n = String(a.status || "").toLowerCase(), i = ["completed", "succeeded", "success"].includes(n) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(n) ? "failed" : n === "pending" ? "pending" : "processing", l = Array.isArray(a.outputs) ? a.outputs : a.url ? [a.url] : [];
    return { status: i, outputs: l, error: Ct(a.error), cost: (o = a.cost) == null ? void 0 : o.amount_usd };
  }
  /** muapi's server-side generation history (works with an API key), newest first. */
  history(t, a = 30) {
    const n = new URLSearchParams({ limit: String(a) });
    return t && n.set("cursor", t), this.request(`/api/v1/history?${n}`);
  }
  mediaLibrary(t = {}) {
    const a = new URLSearchParams({ page: String(t.page ?? 1), page_size: String(t.pageSize ?? 24) });
    return t.mediaType && t.mediaType !== "all" && a.set("media_type", t.mediaType), t.search && a.set("search", t.search), this.request(`/app/media-library?${a}`);
  }
  saveToLibrary(t) {
    return this.request("/app/media-library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) });
  }
  deleteFromLibrary(t) {
    return this.request(`/app/media-library/${t}`, { method: "DELETE" });
  }
  /** Removes the generated files on muapi's side (the history row is kept unless deleteRecord is true). */
  deleteMedia(t, a = !1) {
    return this.request(`/api/v1/predictions/${encodeURIComponent(t)}/media${a ? "?delete_record=true" : ""}`, { method: "DELETE" });
  }
  /** Which optional features the host's proxy supports. A 403/404/405 means the route is not forwarded, so the UI hides it. */
  async probe() {
    const t = (n) => n instanceof ce && [403, 404, 405].includes(n.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((n) => !t(n)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var l;
    const a = new FormData();
    a.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: a }), i = n.url || n.file_url || ((l = n.data) == null ? void 0 : l.url);
    if (!i) throw new ce("Upload returned no URL", 502);
    return i;
  }
}
const Qt = (e) => Math.min(Math.round(e * 1.15), 6e3), Zt = 3e4, er = (e, t) => new Promise((a) => {
  const n = setTimeout(i, e);
  function i() {
    clearTimeout(n), t == null || t.removeEventListener("abort", i), a();
  }
  t == null || t.addEventListener("abort", i);
});
async function it(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: i = 15 * 60 * 1e3, signal: l, onUpdate: o } = a, m = Date.now();
  let k = 0, y = n;
  for (; Date.now() - m < i; ) {
    if (l != null && l.aborted) throw new DOMException("Aborted", "AbortError");
    let A = y;
    try {
      const N = await e.poll(t);
      if (k = 0, o == null || o(N), N.status === "completed" || N.status === "failed") return N;
      y = Qt(y), A = y;
    } catch (N) {
      if (N instanceof ce && N.status === 429) A = N.retryAfterMs ?? Zt;
      else if (++k >= 5) throw N;
    }
    await er(A, l);
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const At = Ft({ library: !0, deleteMedia: !0 }), It = () => Bt(At), qe = {
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
}, tr = {
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
}, rr = { lime: qe, cyan: tr }, st = {
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
function Mt(e = "lime") {
  return typeof e == "string" ? rr[e] ?? qe : { ...qe, ...e };
}
function ar(e = "lime") {
  const t = Mt(e), a = {};
  for (const n of Object.keys(st)) a[st[n]] = t[n];
  return a;
}
function nr(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const or = (e = "lime") => Mt(e).buttonStyle, ue = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], ir = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Ze(e) {
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
const sr = (e) => !!e && ue.some((t) => t.id === e);
function lr(e, t) {
  const a = ue.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const cr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function $t(e, t, a = {}) {
  const n = (l) => {
    var o;
    return ((o = l.sale) == null ? void 0 : o.from) ?? l.cost ?? 1 / 0;
  }, i = [...e];
  return t === "a-z" ? i.sort((l, o) => l.name.localeCompare(o.name)) : t === "price-asc" ? i.sort((l, o) => n(l) - n(o)) : t === "price-desc" ? i.sort((l, o) => n(o) - n(l)) : t === "most-used" ? i.filter((l) => {
    var o;
    return (((o = a.usage) == null ? void 0 : o[l.name]) ?? 0) > 0;
  }).sort((l, o) => (a.usage[o.name] ?? 0) - (a.usage[l.name] ?? 0)) : t === "favourites" ? i.filter((l) => {
    var o;
    return (o = a.favorites) == null ? void 0 : o.includes(l.name);
  }) : i.sort((l, o) => +!!o.sale - +!!l.sale);
}
const dr = { completed: "completed", succeeded: "completed", success: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function ur(e, t) {
  var n, i;
  const a = (n = t.find((l) => l.name === e)) == null ? void 0 : n.group_of;
  return ((i = ue.find((l) => a && l.groups.includes(a))) == null ? void 0 : i.id) ?? "ai-tools";
}
function mr(e, t, a = {}) {
  var l;
  const n = e.output ?? {}, i = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: ur(e.model, t),
    prompt: typeof i.prompt == "string" ? i.prompt : "",
    inputs: i,
    status: dr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: Ct(n.error),
    cost: (l = n.cost) == null ? void 0 : l.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function pr(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((m) => m.requestId).map((m) => [m.requestId, m])), i = new Set(e.map((m) => m.requestId).filter(Boolean));
  return [...e.map((m) => {
    const k = m.requestId ? n.get(m.requestId) : void 0;
    return m.status === "failed" && k && k.status === "completed" && k.outputs.length ? { ...m, status: k.status, outputs: k.outputs, error: void 0, cost: m.cost ?? k.cost } : m;
  }), ...t.filter((m) => !m.requestId || !i.has(m.requestId))].filter((m) => !(m.requestId && a.has(m.requestId))).sort((m, k) => k.createdAt - m.createdAt);
}
function hr(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function ne(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function et(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Et = "muapi-studio:history:v1", fr = 200, fe = (e, t) => t ? `${e}:${t}` : e;
function gr(e) {
  if (!e) return "";
  let t = 2166136261, a = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, a = Math.imul(a ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${a.toString(36)}`;
}
function Oe(e = "") {
  try {
    const t = localStorage.getItem(fe(Et, e));
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function br(e, t = "") {
  try {
    localStorage.setItem(fe(Et, t), JSON.stringify(e.slice(0, fr)));
  } catch {
  }
}
const yr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, lt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, ct = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, dt = "muapi-studio:labels:v1", ut = "muapi-studio:hidden:v1";
function xr(e, t, a, n = "") {
  const [i, l] = C(() => Oe(n)), [o, m] = C([]), [k, y] = C(null), [A, N] = C(!1), [b, S] = C(null), I = K(!1), [R, T] = C(() => lt(fe(dt, n), {})), [G, x] = C(() => lt(fe(ut, n), [])), p = K(/* @__PURE__ */ new Set()), h = K(new AbortController()), M = K([]);
  M.current = t ?? [], q(() => br(i, n), [i, n]), q(() => ct(fe(dt, n), R), [R, n]), q(() => ct(fe(ut, n), G), [G, n]), q(() => (h.current = new AbortController(), () => h.current.abort()), []);
  const O = te((u, v) => l((L) => L.map((c) => c.id === u ? { ...c, ...v } : c)), []), $ = te(async (u, v) => {
    if (!p.current.has(u)) {
      p.current.add(u);
      try {
        const L = await it(e, v, {
          signal: h.current.signal,
          onUpdate: (c) => O(u, { status: c.status, outputs: c.outputs, error: c.error, cost: c.cost })
        });
        O(u, { status: L.status, outputs: L.outputs, error: L.error, cost: L.cost }), a == null || a();
      } catch (L) {
        L.name !== "AbortError" && O(u, { status: "failed", error: L.message });
      } finally {
        p.current.delete(u);
      }
    }
  }, [e, O, a]), D = te(async (u) => {
    if (!u.requestId || p.current.has(u.id)) return;
    p.current.add(u.id);
    const v = (L) => m((c) => c.map((F) => F.id === u.id ? { ...F, status: L.status, outputs: L.outputs, error: L.error, cost: L.cost ?? F.cost } : F));
    try {
      const L = await it(e, u.requestId, { signal: h.current.signal, onUpdate: v });
      v(L), a == null || a();
    } catch {
    } finally {
      p.current.delete(u.id);
    }
  }, [e, a]);
  q(() => {
    const u = new Set(Oe(n).map((v) => v.requestId));
    for (const v of o) (v.status === "pending" || v.status === "processing") && v.requestId && !u.has(v.requestId) && D(v);
  }, [o, n, D]), q(() => {
    for (const u of Oe(n)) (u.status === "pending" || u.status === "processing") && u.requestId && $(u.id, u.requestId);
  }, []);
  const E = te(async (u = !1) => {
    if (!I.current) {
      N(!0), S(null);
      try {
        const v = await e.history(u ? void 0 : k ?? void 0), L = v.items.map((c) => mr(c, M.current));
        m((c) => u ? L : [...c, ...L]), y(v.next_cursor);
      } catch (v) {
        v instanceof ce && [403, 404, 405].includes(v.status) ? (I.current = !0, y(null)) : S(v.message);
      } finally {
        N(!1);
      }
    }
  }, [e, k]), Y = K(!1);
  q(() => {
    t && !Y.current && (Y.current = !0, E(!0));
  }, [t, E]);
  const g = te((u) => {
    const v = Array.from({ length: u.count }, () => ({
      id: yr(),
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
    return l((L) => [...v, ...L]), Promise.all(v.map(async (L) => {
      try {
        const { requestId: c, cost: F } = await e.submit(u.endpointUrl, u.payload, u.kind);
        O(L.id, { requestId: c, ...F !== void 0 ? { cost: F } : {} }), await $(L.id, c);
      } catch (c) {
        O(L.id, { status: "failed", error: c.message });
      }
    }));
  }, [e, O, $]), B = ee(() => {
    const u = (v) => ({ ...v, label: v.requestId && R[v.requestId] || v.label });
    return pr(i.map(u), o.map(u), new Set(G));
  }, [i, o, R, G]), z = te((u, v) => {
    u.requestId && T((L) => {
      const c = { ...L };
      return v ? c[u.requestId] = v : delete c[u.requestId], c;
    }), O(u.id, { label: v });
  }, [O]), f = te((u) => {
    l((v) => v.filter((L) => L.id !== u.id)), u.requestId && x((v) => [.../* @__PURE__ */ new Set([...v, u.requestId])]);
  }, []), d = te(async (u) => {
    u.requestId && (await e.deleteMedia(u.requestId), O(u.id, { outputs: [] }), m((v) => v.map((L) => L.requestId === u.requestId ? { ...L, outputs: [] } : L)));
  }, [e, O]);
  return { items: B, run: g, setLabel: z, remove: f, deleteMedia: d, loadMore: () => E(!1), hasMore: !!k, loadingMore: A, serverError: b };
}
const vr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Tt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : vr.test(e) ? "file" : "image" : "text";
}
function wr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const kr = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), X = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), $e = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), Nr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), Sr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), Cr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), tt = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), Ar = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), rt = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), mt = ({ filled: e, ...t }) => /* @__PURE__ */ r(X, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), at = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Te = ({ up: e, ...t }) => /* @__PURE__ */ r(X, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), Ir = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), Mr = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), Fe = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), Ne = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), be = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), _t = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), $r = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), ye = (e) => /* @__PURE__ */ r(X, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Er = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Tr = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), _r = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), pt = (e) => /* @__PURE__ */ s(X, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Lt({ url: e }) {
  return /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(tt, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let ht = null;
const Lr = () => ht ?? (ht = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw ht = null, e;
}));
function Gr({ url: e, hidden: t = !1 }) {
  const [a, n] = C("loading"), i = K(null);
  return q(() => {
    let l = !0;
    return n("loading"), Lr().catch(() => l && n("failed")), () => {
      l = !1;
    };
  }, [e]), q(() => {
    const l = i.current;
    if (!l) return;
    const o = () => n("ready"), m = () => n("failed");
    return l.addEventListener("load", o), l.addEventListener("error", m), () => {
      l.removeEventListener("load", o), l.removeEventListener("error", m);
    };
  }), a === "failed" ? /* @__PURE__ */ r(Lt, { url: e }) : /* @__PURE__ */ s("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    zt("model-viewer", {
      ref: i,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    a === "loading" && /* @__PURE__ */ s("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(ye, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(tt, { width: 14, height: 14 }) })
  ] });
}
const Rr = ["All", "Approved", "Rejected", "Unlabeled"], Or = [1, 2, 4, 6, 8];
function Dr({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, i = Tt(e);
  return i === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: wr(e) }) : i === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : i === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : i === "3d" ? kr(e) ? /* @__PURE__ */ r(Gr, { url: e, hidden: t }) : /* @__PURE__ */ r(Lt, { url: e }) : i === "file" ? /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Fe, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function jr({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: i, onRerun: l, onDeleteMedia: o, onOpen: m, estimateFor: k }) {
  const [y, A] = C(0), N = e.outputs.length, b = Math.min(y, Math.max(N - 1, 0)), S = e.outputs[b], I = !!S && Tt(S) === "text", [R, T] = C(!1), [G, x] = C(null), p = It(), h = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", M = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ s("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && S ? /* @__PURE__ */ s("div", { className: "relative", children: [
      /* @__PURE__ */ r(Dr, { url: S, hidden: t, onOpen: () => m(S) }),
      N > 1 && /* @__PURE__ */ s("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Previous output", disabled: b === 0, onClick: () => A(b - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ s("span", { "aria-live": "polite", children: [
          b + 1,
          " / ",
          N
        ] }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Next output", disabled: b === N - 1, onClick: () => A(b + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ s("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(be, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ s("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(ye, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ s("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ s("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ne(e.cost) : e.status === "completed" && (k == null ? void 0 : k(e.model)) !== void 0 ? `est. ${ne(k(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && S && (I ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(S)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Fe, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: S, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Fe, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${M} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ r(Ne, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "rejected",
            "aria-label": "Reject",
            title: "Reject",
            onClick: () => a(e, e.label === "rejected" ? null : "rejected"),
            className: `${M} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ r(be, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Load this model and settings back into the form", className: h, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => l(e), title: "Generate again with the same settings", className: h, children: "Re-run" }),
        e.status === "completed" && S && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var O;
          (O = navigator.clipboard) == null || O.writeText(S).then(() => {
            T(!0), setTimeout(() => T(!1), 1500);
          });
        }, className: h, children: R ? "Copied" : I ? "Copy text" : "Copy link" })
      ] }),
      G && /* @__PURE__ */ s("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        G
      ] }),
      /* @__PURE__ */ s("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ s("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ s("span", { className: "flex shrink-0 gap-3", children: [
          p.deleteMedia && e.requestId && e.status === "completed" && S && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (x(null), o(e).catch((O) => x(O.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Pr({ url: e, onClose: t }) {
  return q(() => {
    const a = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ s("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(be, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Vr({ mode: e, items: t, batch: a, onBatch: n, onLabel: i, onRemove: l, onReuse: o, onRerun: m, onDeleteMedia: k, onLoadMore: y, hasMore: A, loadingMore: N, serverError: b, estimateFor: S }) {
  const [I, R] = C("All"), [T, G] = C(""), [x, p] = C(!1), [h, M] = C(null), O = ee(() => {
    const $ = T.trim().toLowerCase();
    return t.filter((D) => D.mode !== e || I === "Approved" && D.label !== "approved" || I === "Rejected" && D.label !== "rejected" || I === "Unlabeled" && D.label !== null ? !1 : !$ || D.prompt.toLowerCase().includes($) || D.model.toLowerCase().includes($));
  }, [t, e, I, T]);
  return /* @__PURE__ */ s("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Rr.map(($) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": I === $,
          onClick: () => R($),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${I === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ s("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(at, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: T, onChange: ($) => G($.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Or.map(($) => /* @__PURE__ */ r(
        "button",
        {
          role: "radio",
          "aria-checked": a === $,
          onClick: () => n($),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${a === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": x, "aria-label": x ? "Show previews" : "Hide previews", title: x ? "Show previews" : "Hide previews", onClick: () => p(($) => !$), className: x ? "text-primary" : "text-secondary hover:text-fg", children: x ? /* @__PURE__ */ r(Ir, { width: 18, height: 18 }) : /* @__PURE__ */ r(Mr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      O.length === 0 ? /* @__PURE__ */ s("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(rt, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some(($) => $.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some(($) => $.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: O.map(($) => /* @__PURE__ */ r(jr, { g: $, hidden: x, onLabel: i, onRemove: l, onReuse: o, onRerun: m, onDeleteMedia: k, onOpen: M, estimateFor: S }, $.id)) }),
      b && /* @__PURE__ */ s("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        b
      ] }),
      A && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: N, onClick: y, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: N ? "Loading…" : "Load more history" }) }),
      h && /* @__PURE__ */ r(Pr, { url: h, onClose: () => M(null) })
    ] })
  ] });
}
const Ur = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, qr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Fr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Ur.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || qr.test(e.name) ? "media" : "text" : "text";
}
function De(e) {
  var o, m;
  const t = (m = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : m.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), i = [...n.filter((k) => a[k]), ...Object.keys(a).filter((k) => !n.includes(k))], l = new Set(e.required_fields ?? []);
  return i.map((k) => ({ prop: { ...a[k], name: k }, kind: Fr({ ...a[k], name: k }), required: l.has(k) }));
}
function Be(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: i, required: l } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : l && (i === "textarea" || i === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const de = (e) => `__auto:${e}`, ze = (e) => (e.kind === "number" || e.kind === "select") && !e.required, He = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function je(e, t) {
  const a = {};
  for (const { prop: n, kind: i } of e) {
    if (t[de(n.name)] === !0) continue;
    const l = t[n.name] ?? n.default;
    if (!He(l))
      if (i === "number") {
        const o = Number(l);
        Number.isFinite(o) && (a[n.name] = o);
      } else if (i === "json" && typeof l == "string")
        try {
          a[n.name] = JSON.parse(l);
        } catch {
        }
      else a[n.name] = l;
  }
  return a;
}
function Br(e, t) {
  for (const { prop: a, kind: n, required: i } of e) {
    if (t[de(a.name)] === !0) continue;
    const l = t[a.name] ?? a.default, o = a.title || a.name;
    if (i && He(l)) return `${o} is required`;
    if (n === "json" && typeof l == "string" && l)
      try {
        JSON.parse(l);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !He(l)) {
      const m = Number(l);
      if (!Number.isFinite(m)) return `${o} must be a number`;
      if (a.minValue !== void 0 && m < a.minValue) return `${o} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && m > a.maxValue) return `${o} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const zr = 12, nt = 240, Ce = (e) => `${typeof e}:${e}`, Hr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Jr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Yr(e, t, a = nt) {
  return e >= a || e >= t ? "down" : "up";
}
const Kr = 36, Wr = 48;
function Xr(e, t) {
  return Math.min(nt, Math.max(1, e) * Kr + 8) + (t ? Wr : 0);
}
function Qr(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const ft = "Auto (let model decide)", Pe = "__auto__";
function Je({ id: e, label: t, options: a, value: n, onChange: i, allowAuto: l, auto: o, onAuto: m, combobox: k }) {
  const y = Ht(), A = e ?? `ms-dd-${y}`, N = k ?? a.length > zr, [b, S] = C(!1), [I, R] = C(""), [T, G] = C(0), [x, p] = C("down"), h = K(null), M = K(null), O = K(null), $ = a.find((d) => n !== void 0 && Ce(d.value) === Ce(n)), D = ee(() => N ? Jr(a, I) : a, [N, a, I]), E = ee(
    () => [...l ? [{ key: Pe, label: ft, value: Pe, isAuto: !0 }] : [], ...D.map((d) => ({ key: Ce(d.value), label: d.label, hint: d.hint, value: d.value }))],
    [l, D]
  ), Y = o ? Pe : $ ? Ce($.value) : void 0, g = () => {
    S(!1), R("");
  }, B = (d) => {
    d.isAuto ? m == null || m() : i(d.value), g();
  };
  Jt(() => {
    if (!b || !h.current) return;
    const d = h.current.getBoundingClientRect();
    let u = h.current.parentElement;
    for (; u && !/(auto|scroll)/.test(getComputedStyle(u).overflowY); ) u = u.parentElement;
    const v = u ? u.getBoundingClientRect() : null, L = Math.min(window.innerHeight, v ? v.bottom : window.innerHeight), c = Math.max(0, v ? v.top : 0);
    p(Yr(L - d.bottom, d.top - c, Xr(a.length + (l ? 1 : 0), N)));
  }, [b]), q(() => {
    if (!b) return;
    const d = E.findIndex((u) => u.key === Y);
    G(d >= 0 ? d : 0);
  }, [b, I]), q(() => {
    var d, u, v;
    b && ((v = (u = (d = M.current) == null ? void 0 : d.querySelector(`[data-i="${T}"]`)) == null ? void 0 : u.scrollIntoView) == null || v.call(u, { block: "nearest" }));
  }, [T, b]), q(() => {
    var d;
    b && N && ((d = O.current) == null || d.focus());
  }, [b, N]), q(() => {
    if (!b) return;
    const d = (u) => {
      var v;
      (v = h.current) != null && v.contains(u.target) || g();
    };
    return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
  }, [b]);
  const z = (d) => {
    if (!b) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(d.key) && (d.preventDefault(), S(!0));
      return;
    }
    if (d.key === "Escape") {
      d.preventDefault(), d.stopPropagation(), g();
      return;
    }
    if (d.key === "Enter") {
      d.preventDefault(), E[T] && B(E[T]);
      return;
    }
    if (d.key === "Tab") {
      g();
      return;
    }
    if (d.key === " " && !N) {
      d.preventDefault(), E[T] && B(E[T]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(d.key) && (d.preventDefault(), G((u) => Qr(u, d.key, E.length)));
  }, f = o ? ft : ($ == null ? void 0 : $.label) ?? "Select…";
  return /* @__PURE__ */ s("div", { ref: h, className: "relative w-full", onKeyDown: z, children: [
    /* @__PURE__ */ s(
      "button",
      {
        id: A,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": b,
        "aria-label": `${t}: ${f}`,
        "aria-controls": `${A}-list`,
        onClick: () => S((d) => !d),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${b ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: f }),
          /* @__PURE__ */ r(Te, { up: b, width: 16, height: 16 })
        ]
      }
    ),
    b && /* @__PURE__ */ s("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${x === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      N && /* @__PURE__ */ r(
        "input",
        {
          ref: O,
          value: I,
          onChange: (d) => R(d.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${A}-list`,
          "aria-activedescendant": E[T] ? `${A}-o${T}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ s("ul", { id: `${A}-list`, ref: M, role: "listbox", "aria-label": t, style: { maxHeight: nt }, className: "overflow-y-auto", children: [
        E.map((d, u) => {
          const v = d.key === Y;
          return /* @__PURE__ */ s(
            "li",
            {
              id: `${A}-o${u}`,
              "data-i": u,
              role: "option",
              "aria-selected": v,
              onMouseEnter: () => G(u),
              onClick: () => B(d),
              className: `flex cursor-pointer items-center justify-between gap-2 ${d.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${v ? "bg-primary text-primary-ink" : u === T ? "bg-card-bg" : ""} ${d.isAuto && !v ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ s("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: d.label }),
                  d.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${v ? "opacity-70" : "text-muted"}`, children: d.hint })
                ] }),
                v && /* @__PURE__ */ r(Ne, { width: 14, height: 14 })
              ]
            },
            d.key
          );
        }),
        E.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Zr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function ea({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r($e, {}) });
}
function ta({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: i }) {
  const [l, o] = C(a), [m, k] = C(""), [y, A] = C(1), [N, b] = C(null), [S, I] = C(null), [R, T] = C(!1), [G, x] = C([]), [p, h] = C(""), [M, O] = C(!1), $ = K(null), D = K(null), E = te(async () => {
    T(!0), I(null);
    try {
      b(await e.mediaLibrary({ mediaType: l, search: m, page: y }));
    } catch (f) {
      I(f.message);
    } finally {
      T(!1);
    }
  }, [e, l, m, y]);
  q(() => {
    const f = setTimeout(E, m ? 300 : 0);
    return () => clearTimeout(f);
  }, [E, m]), q(() => {
    A(1);
  }, [l, m]), q(() => {
    var u;
    const f = document.activeElement;
    (u = $.current) == null || u.focus();
    const d = (v) => {
      if (v.key === "Escape") {
        v.stopPropagation(), i();
        return;
      }
      if (v.key !== "Tab" || !$.current) return;
      const L = [...$.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!L.length) return;
      const c = L[0], F = L[L.length - 1];
      v.shiftKey && document.activeElement === c ? (v.preventDefault(), F.focus()) : !v.shiftKey && document.activeElement === F && (v.preventDefault(), c.focus());
    };
    return document.addEventListener("keydown", d), () => {
      var v;
      document.removeEventListener("keydown", d), (v = f == null ? void 0 : f.focus) == null || v.call(f);
    };
  }, [i]);
  const Y = (f) => x((d) => d.includes(f) ? d.filter((u) => u !== f) : t === 1 ? [f] : d.length < t ? [...d, f] : d), g = async (f) => {
    if (f.length) {
      T(!0), I(null);
      try {
        for (const d of f) {
          const u = await e.upload(d);
          await e.saveToLibrary({ url: u, name: d.name, mime_type: d.type || void 0, size_bytes: d.size, media_type: d.type.startsWith("video") ? "video" : d.type.startsWith("audio") ? "audio" : d.type.startsWith("image") ? "image" : "archive" });
        }
        await E();
      } catch (d) {
        I(d.message), T(!1);
      }
    }
  }, B = async () => {
    var d;
    const f = p.trim();
    if (!/^https?:\/\//i.test(f)) {
      I("Enter a full http(s) URL");
      return;
    }
    T(!0), I(null);
    try {
      const u = ((d = f.split("?")[0].split(".").pop()) == null ? void 0 : d.toLowerCase()) ?? "", v = ["mp4", "webm", "mov"].includes(u) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(u) ? "audio" : ["zip", "rar", "7z"].includes(u) ? "archive" : "image";
      await e.saveToLibrary({ url: f, name: f.split("/").pop() || "link", media_type: v }), h(""), O(!1), await E();
    } catch (u) {
      I(u.message), T(!1);
    }
  }, z = async (f) => {
    if (window.confirm(`Delete "${f.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(f.id), x((d) => d.filter((u) => u !== f.url)), await E();
      } catch (d) {
        I(d.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (f) => {
    f.target === f.currentTarget && i();
  }, children: /* @__PURE__ */ s("div", { ref: $, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ s("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r($e, {}) }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ s("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ s("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
            (N == null ? void 0 : N.total) ?? 0,
            " ",
            (N == null ? void 0 : N.total) === 1 ? "item" : "items"
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
      /* @__PURE__ */ r("input", { ref: D, type: "file", hidden: !0, multiple: !0, onChange: (f) => {
        const d = Array.from(f.target.files ?? []);
        f.target.value = "", g(d);
      } }),
      /* @__PURE__ */ s("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var f;
        return (f = D.current) == null ? void 0 : f.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ r(_t, { width: 14, height: 14 }),
        /* @__PURE__ */ r("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: i, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(be, {}) })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Zr.map((f) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": l === f.id, onClick: () => o(f.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${l === f.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: f.label }, f.id)) }),
      /* @__PURE__ */ r("input", { value: m, onChange: (f) => k(f.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": M, onClick: () => O((f) => !f), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    M && /* @__PURE__ */ s("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: p, onChange: (f) => h(f.target.value), onKeyDown: (f) => f.key === "Enter" && void B(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void B(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      S && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: S }),
      R && !N ? /* @__PURE__ */ s("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(ye, {}),
        " Loading…"
      ] }) : N != null && N.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: N.items.map((f) => {
        const d = G.includes(f.url);
        return /* @__PURE__ */ s("li", { className: `group relative overflow-hidden rounded-card border ${d ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": d, "aria-label": `${d ? "Deselect" : "Select"} ${f.name ?? "file"}`, onClick: () => Y(f.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(ea, { a: f }) }),
          d && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(Ne, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${f.name ?? "file"}`, onClick: () => void z(f), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(be, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: f.name ?? "", children: f.name })
        ] }, f.id);
      }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r($e, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      N && N.total_pages > 1 && /* @__PURE__ */ s("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: y <= 1, onClick: () => A((f) => f - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        y,
        " of ",
        N.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: y >= N.total_pages, onClick: () => A((f) => f + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ s("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ s("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: G.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !G.length, onClick: () => {
        n(G), i();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(Ne, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const Gt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, ra = (e, t = "") => {
  const a = Gt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, aa = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function na(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, i) => void e.saveToLibrary({ url: a[i], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: aa(n) }).catch(() => {
  })), a;
}
function Ye({ client: e, field: t, multiple: a, max: n, current: i, onUrls: l, onError: o }) {
  const m = K(null), [k, y] = C(!1), [A, N] = C(!1), [b, S] = C(!1), I = n - i.length, R = It(), T = async (p) => {
    if (p.length) {
      y(!0);
      try {
        l(await na(e, a ? p.slice(0, Math.max(I, 1)) : p.slice(0, 1)));
      } catch (h) {
        o(h.message);
      } finally {
        y(!1);
      }
    }
  }, G = Gt(t.prop.field, t.prop.name), x = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ s(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), N(!0);
      },
      onDragLeave: () => N(!1),
      onDrop: (p) => {
        p.preventDefault(), N(!1), T(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${A ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: m, type: "file", hidden: !0, accept: G, multiple: a, onChange: (p) => {
          const h = Array.from(p.target.files ?? []);
          p.target.value = "", T(h);
        } }),
        (a ? I > 0 : !0) && /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ r(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: a ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: a ? void 0 : i[0] ?? "",
              defaultValue: void 0,
              onChange: a ? void 0 : (p) => l([p.target.value]),
              onKeyDown: a ? (p) => {
                p.key === "Enter" && p.currentTarget.value.trim() && (l([p.currentTarget.value.trim()]), p.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ r("button", { type: "button", disabled: k, onClick: () => {
            var p;
            return (p = m.current) == null ? void 0 : p.click();
          }, "aria-label": "Upload file", title: "Upload file", className: x, children: k ? /* @__PURE__ */ r(ye, { width: 16, height: 16 }) : /* @__PURE__ */ r(_t, { width: 16, height: 16 }) }),
          R.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => S(!0), "aria-label": "Choose from media library", title: "Media library", className: x, children: /* @__PURE__ */ s("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        b && R.library && /* @__PURE__ */ r(ta, { client: e, max: a ? Math.max(I, 1) : 1, initialType: ra(t.prop.field, t.prop.name), onInsert: l, onClose: () => S(!1) })
      ]
    }
  );
}
function oa({ field: e, values: t, onChange: a, client: n, onError: i, tagCount: l = 0 }) {
  const { prop: o, kind: m, required: k } = e, y = t[o.name], A = (p) => a(o.name, p), N = o.title || o.name, b = `ms-f-${o.name}`, S = y == null ? "" : String(y), I = Array.isArray(y) ? y : [], R = t[de(o.name)] === !0, T = K(null), G = (p) => {
    const h = T.current, M = typeof y == "string" ? y : "", O = (h == null ? void 0 : h.selectionStart) ?? M.length, $ = (h == null ? void 0 : h.selectionEnd) ?? O;
    A(M.slice(0, O) + p + " " + M.slice($)), requestAnimationFrame(() => {
      h == null || h.focus(), h == null || h.setSelectionRange(O + p.length + 1, O + p.length + 1);
    });
  };
  let x;
  if (m === "textarea" || m === "json")
    x = /* @__PURE__ */ s(Ee, { children: [
      /* @__PURE__ */ r("textarea", { ref: T, id: b, rows: m === "json" ? 4 : 5, value: typeof y == "string" ? y : y ? JSON.stringify(y, null, 2) : "", onChange: (p) => A(p.target.value), className: `w-full resize-y p-3 text-sm ${m === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && l > 0 && /* @__PURE__ */ s("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(l, 9) }, (p, h) => `@image${h + 1}`).map((p) => /* @__PURE__ */ r("button", { type: "button", onClick: () => G(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (m === "select") {
    const p = o.enum ?? [];
    x = /* @__PURE__ */ r(
      Je,
      {
        id: b,
        label: N,
        options: Hr(p),
        value: y,
        onChange: (h) => {
          A(h), a(de(o.name), !1);
        },
        allowAuto: ze(e),
        auto: R,
        onAuto: () => a(de(o.name), !0)
      }
    );
  } else if (m === "boolean") {
    const p = y === !0;
    x = /* @__PURE__ */ r(
      "button",
      {
        id: b,
        type: "button",
        role: "switch",
        "aria-checked": p,
        onClick: () => A(!p),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${p ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${p ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (m === "number") {
    const p = o.minValue !== void 0 && o.maxValue !== void 0;
    x = /* @__PURE__ */ s("div", { className: `flex items-center gap-3 ${R ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ r("input", { type: "range", disabled: R, "aria-label": `${N} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: S === "" ? o.minValue : Number(S), onChange: (h) => A(Number(h.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: b, type: "number", disabled: R, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: S, onChange: (h) => A(h.target.value === "" ? "" : Number(h.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (m === "media")
    x = /* @__PURE__ */ r(Ye, { client: n, field: e, multiple: !1, max: 1, current: S ? [S] : [], onUrls: (p) => A(p[0]), onError: i });
  else if (m === "media-list") {
    const p = o.maxItems ?? 8;
    x = /* @__PURE__ */ s("div", { className: "space-y-2", children: [
      I.map((h, M) => /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${N} ${M + 1}`, value: h, onChange: (O) => A(I.map(($, D) => D === M ? O.target.value : $)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${N} ${M + 1}`, onClick: () => A(I.filter((O, $) => $ !== M)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(be, { width: 14, height: 14 }) })
      ] }, M)),
      /* @__PURE__ */ r(Ye, { client: n, field: e, multiple: !0, max: p, current: I, onUrls: (h) => A([...I, ...h].slice(0, p)), onError: i })
    ] });
  } else
    x = /* @__PURE__ */ r("input", { id: b, value: S, onChange: (p) => A(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ s("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ s("label", { htmlFor: b, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        N,
        o.description && /* @__PURE__ */ r("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ r($r, { width: 13, height: 13 }) })
      ] }),
      ze(e) && m === "number" ? /* @__PURE__ */ s("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: R, onChange: (p) => a(de(o.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: m === "media-list" ? `${I.length}/${o.maxItems ?? 8} items${k ? " · required" : ""}` : k ? "* required" : "" })
    ] }),
    x
  ] });
}
const Ae = {
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
}, ge = "Other", ia = 3, sa = 2, la = 20, ca = 2, da = 4, ua = 40, ma = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Rt(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ae[t] ? Ae[t] : Ae[a] ? Ae[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? ge : ma(a);
}
function pa(e) {
  const t = /* @__PURE__ */ new Map();
  for (const i of e) {
    const l = Rt(i.name);
    t.set(l, (t.get(l) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [i, l] of t)
    i === ge || l < ia ? a += l : n.push({ id: i, label: i, count: l });
  return n.sort((i, l) => l.count - i.count || i.label.localeCompare(l.label)), a && n.push({ id: ge, label: ge, count: a }), n;
}
function Ot(e, t) {
  const a = Rt(e.name);
  return t.some((n) => n.id === a) ? a : ge;
}
function ha(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function fa(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const gt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function ga(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const i = gt.indexOf(n);
    return i < 0 ? gt.length : i;
  };
  return [...t].map(([n, i]) => ({ id: n, count: i })).sort((n, i) => a(n.id) - a(i.id) || i.count - n.count || n.id.localeCompare(i.id));
}
const le = "__favourites__", re = "__all__";
function ba(e, t, a) {
  return e.filter((n) => {
    var i;
    return t.category !== re && n.category !== t.category ? !1 : t.provider === le ? !!((i = t.favourites) != null && i.includes(n.name)) : t.provider === re || Ot(n, a) === t.provider;
  });
}
const ya = (e, t) => t.filter((a) => a.id !== ge).length >= sa && e.length >= la;
function xa(e) {
  const t = ga(e);
  return e.length >= ua ? t.filter((a) => a.count >= da) : t;
}
const Ie = 200;
function va({ model: e }) {
  const t = et(e);
  return t ? /* @__PURE__ */ s("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ne(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ne(t.current)
  ] }) : null;
}
const bt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, yt = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Ve({ label: e, active: t, onClick: a, hue: n, children: i }) {
  return /* @__PURE__ */ r(
    "button",
    {
      type: "button",
      role: "radio",
      "aria-checked": t,
      "aria-label": e,
      title: e,
      onClick: a,
      style: n !== void 0 && !t ? { boxShadow: `inset 0 0 0 1.5px hsl(${n} 60% 55% / 0.55)` } : void 0,
      className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${t ? "bg-primary text-primary-ink" : "bg-card-bg text-secondary hover:text-fg"}`,
      children: i
    }
  );
}
function wa({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: i, usage: l, showGroup: o, scope: m = "default" }) {
  var L;
  const [k, y] = C(!1), [A, N] = C(""), [b, S] = C("popular"), [I, R] = C(!1), T = K(null), G = ee(() => pa(e), [e]), x = ee(() => xa(e), [e]), p = ya(e, G), h = x.length >= ca, [M, O] = C(() => bt(`muapi-studio:provider:${m}`, re)), [$, D] = C(() => bt(`muapi-studio:category:${m}`, re)), E = p && (M === le || M === re || G.some((c) => c.id === M)) ? M : re, Y = h && ($ === re || x.some((c) => c.id === $)) ? $ : re, g = (c) => {
    O(c), yt(`muapi-studio:provider:${m}`, c);
  }, B = (c) => {
    D(c), yt(`muapi-studio:category:${m}`, c);
  }, z = K(null);
  q(() => {
    k || R(!1);
  }, [k]), q(() => {
    if (!k) return;
    const c = (Q) => {
      var U;
      (U = T.current) != null && U.contains(Q.target) || y(!1);
    }, F = (Q) => {
      Q.key === "Escape" && y(!1);
    };
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", F), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", F);
    };
  }, [k]);
  const f = ee(() => {
    const c = A.trim().toLowerCase(), F = ba(e, { category: Y, provider: E, favourites: n }, G), Q = c ? F.filter((W) => W.name.toLowerCase().includes(c) || W.category.toLowerCase().includes(c)) : F, U = $t(Q, b, { usage: l, favorites: n });
    if (b === "favourites" || b === "most-used") return U;
    const se = new Set(n);
    return [...U.filter((W) => se.has(W.name)), ...U.filter((W) => !se.has(W.name))];
  }, [e, A, b, n, l, Y, E, G]), [d, u] = C(0);
  q(() => {
    var c, F;
    u(0), (F = (c = z.current) == null ? void 0 : c.scrollTo) == null || F.call(c, { top: 0 });
  }, [A, b, k, Y, E]);
  const v = (c) => {
    c.key === "ArrowDown" ? (c.preventDefault(), u((F) => Math.min(F + 1, Math.min(f.length, Ie) - 1))) : c.key === "ArrowUp" ? (c.preventDefault(), u((F) => Math.max(F - 1, 0))) : c.key === "Enter" && f[d] && (c.preventDefault(), a(f[d].name), y(!1));
  };
  return q(() => {
    var c, F;
    (F = (c = document.getElementById(`ms-opt-${d}`)) == null ? void 0 : c.scrollIntoView) == null || F.call(c, { block: "nearest" });
  }, [d]), /* @__PURE__ */ s("div", { ref: T, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => y((c) => !c),
        "aria-haspopup": "listbox",
        "aria-expanded": k,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (L = (t ?? "?")[0]) == null ? void 0 : L.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Te, { up: k, width: 16, height: 16 })
        ]
      }
    ),
    k && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ s("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(Ve, { label: "All providers", active: E === re, onClick: () => g(re), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(Ve, { label: "Favourites", active: E === le, onClick: () => g(le), children: /* @__PURE__ */ r(mt, { width: 14, height: 14, filled: E === le }) }),
        G.map((c) => /* @__PURE__ */ r(Ve, { label: `${c.label} (${c.count})`, active: E === c.id, onClick: () => g(c.id), hue: fa(c.label), children: ha(c.label) }, c.id))
      ] }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        h && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: re, label: "All" }, ...x.map((c) => ({ id: c.id, label: c.id }))].map((c) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": Y === c.id,
            onClick: () => B(c.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${Y === c.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: c.label
          },
          c.id
        )) }),
        /* @__PURE__ */ s("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ s("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(at, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: v, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${d}`, value: A, onChange: (c) => N(c.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ s("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": I,
                onClick: () => R((c) => !c),
                className: `flex h-full items-center rounded-ctl border px-3 ${I ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(Er, { width: 16, height: 16 })
              }
            ),
            I && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: cr.map((c) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ s(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": b === c.id,
                onClick: () => {
                  S(c.id), R(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${b === c.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  c.label,
                  b === c.id && /* @__PURE__ */ r(Ne, { width: 14, height: 14 })
                ]
              }
            ) }, c.id)) })
          ] })
        ] }),
        (p || h) && /* @__PURE__ */ s("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ s("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            E === le ? "Favourites" : "All models",
            " · ",
            f.length
          ] }),
          p && E !== re && E !== le && /* @__PURE__ */ r("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: E })
        ] }),
        /* @__PURE__ */ s("ul", { id: "ms-listbox", ref: z, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          f.slice(0, Ie).map((c, F) => {
            const Q = c.name === t;
            return /* @__PURE__ */ r(
              "li",
              {
                id: `ms-opt-${F}`,
                role: "option",
                "aria-selected": Q,
                onClick: () => {
                  a(c.name), y(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${Q ? "bg-primary-soft" : F === d ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ r("div", { className: `min-w-0 flex-1 truncate text-sm ${Q ? "text-primary" : ""}`, title: c.name, children: c.name }),
                    /* @__PURE__ */ r(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(c.name) ? "Remove favorite" : "Add favorite",
                        onClick: (U) => {
                          U.stopPropagation(), i(c.name);
                        },
                        className: n.includes(c.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ r(mt, { width: 15, height: 15, filled: n.includes(c.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ s("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ r("span", { className: "truncate text-[10px] text-secondary", children: o ? `${c.group_of} · ${c.category}` : p && E === re ? `${Ot(c, G)} · ${c.category}` : c.category }),
                    /* @__PURE__ */ r(va, { model: c })
                  ] })
                ] })
              },
              c.name
            );
          }),
          f.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: b === "favourites" ? "No favourites yet. Tap the heart on a model." : b === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${A}”.` }),
          f.length > Ie && /* @__PURE__ */ s("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ie,
            " of ",
            f.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const xt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, Ue = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, Dt = 0.25;
function Ke(e, t) {
  const a = Be(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (a[n.prop.name] = t[n.prop.name]);
  return a;
}
function ka(e, t) {
  const a = Ke(e, t);
  for (const n of e)
    t[n.prop.name] === void 0 && (delete a[n.prop.name], ze(n) && (a[de(n.prop.name)] = !0));
  return a;
}
function Na({ mode: e, models: t, client: a, batch: n, onRun: i, usage: l, reuse: o, switcher: m }) {
  const k = ue.find((w) => w.id === e), y = ee(() => lr(t, e), [t, e]), [A, N] = C(), [b, S] = C(null), [I, R] = C(null), [T, G] = C({}), [x, p] = C(null), [h, M] = C(null), [O, $] = C(() => xt("muapi-studio:favorites", [])), [D, E] = C("form"), [Y, g] = C(!1), [B, z] = C("{}"), [f, d] = C(null), u = K(0), v = K(null);
  q(() => {
    if (!Y) return;
    const w = (J) => {
      var ae;
      (ae = v.current) != null && ae.contains(J.target) || g(!1);
    }, V = (J) => {
      J.key === "Escape" && g(!1);
    };
    return document.addEventListener("mousedown", w), document.addEventListener("keydown", V), () => {
      document.removeEventListener("mousedown", w), document.removeEventListener("keydown", V);
    };
  }, [Y]);
  const L = K(null), c = K(null), F = K("form");
  q(() => {
    var J, ae, ie;
    const w = xt(`muapi-studio:model:${e}`, null), V = ((J = y.find((ve) => ve.name === w)) == null ? void 0 : J.name) ?? ((ae = y.find((ve) => ve.name === ir[e])) == null ? void 0 : ae.name) ?? ((ie = $t(y, "popular")[0]) == null ? void 0 : ie.name);
    N(V);
  }, [e, y]), q(() => {
    if (!o) return;
    L.current = o.inputs;
    const w = c.current;
    if (w && w.name === o.model) {
      L.current = null, G(Ke(De(w), o.inputs)), E("form");
      return;
    }
    y.some((V) => V.name === o.model) ? (N(o.model), Ue(`muapi-studio:model:${e}`, o.model)) : L.current = null, E("form");
  }, [o == null ? void 0 : o.nonce]);
  const Q = y.find((w) => w.name === A);
  c.current = b, F.current = D, q(() => {
    if (!A) {
      S(null), G({}), p(null), R(null), M(null), d(null);
      return;
    }
    let w = !0;
    return S(null), R(null), p(null), M(null), d(null), a.model(A).then((V) => {
      if (!w) return;
      const J = De(V), ae = L.current;
      L.current = null;
      const ie = Ke(J, ae);
      S(V), G(ie), F.current === "json" && z(JSON.stringify(je(J, ie), null, 2));
    }).catch((V) => {
      w && R(V.message);
    }), () => {
      w = !1;
    };
  }, [A, a]);
  const U = ee(() => b ? De(b) : [], [b]), se = ee(() => je(U, T), [U, T]), W = ee(() => {
    try {
      const w = JSON.parse(B);
      return w && typeof w == "object" && !Array.isArray(w) ? w : null;
    } catch {
      return null;
    }
  }, [B]), oe = D === "json" ? W ?? {} : se, me = JSON.stringify(oe);
  q(() => {
    if (!b || D === "json" && !W) return;
    const w = ++u.current, V = setTimeout(() => {
      a.estimate(b.name, oe).then((J) => {
        w === u.current && p(J);
      }).catch(() => {
        w === u.current && p(null);
      });
    }, 500);
    return () => clearTimeout(V);
  }, [b, me, a]), q(() => {
    d(null);
  }, [n, me, D]);
  const Le = (w) => {
    N(w), Ue(`muapi-studio:model:${e}`, w);
  }, Se = (w) => $((V) => {
    const J = V.includes(w) ? V.filter((ae) => ae !== w) : [...V, w];
    return Ue("muapi-studio:favorites", J), J;
  }), Ge = (w) => {
    g(!1), w !== D && (w === "json" ? z(JSON.stringify(se, null, 2)) : W && G(ka(U, W)), E(w), M(null));
  }, Z = Q ? et(Q, x) : null, xe = te(async () => {
    if (!b) return;
    d(null);
    const w = U.find((V) => V.prop.name === "prompt");
    await i({
      model: b.name,
      endpointUrl: b.endpoint_url,
      mode: e,
      payload: oe,
      count: n,
      kind: Ze(b.category),
      prompt: w ? String(oe.prompt ?? "") : "",
      unitCost: Z == null ? void 0 : Z.current
    });
  }, [b, U, i, e, oe, n, Z]), Re = te(async () => {
    if (!b) return;
    if (D === "json") {
      if (!W) {
        M("The JSON is not valid");
        return;
      }
      const V = (b.required_fields ?? []).find((J) => W[J] === void 0 || W[J] === "");
      if (V) {
        M(`${V} is required`);
        return;
      }
    } else {
      const V = Br(U, T);
      if (V) {
        M(V);
        return;
      }
    }
    M(null);
    const w = ((Z == null ? void 0 : Z.current) ?? 0) * n;
    if (w > Dt) {
      d(w);
      return;
    }
    await xe();
  }, [b, D, W, U, T, Z, n, xe]), pe = !!b && !I, P = (() => {
    var V;
    const w = U.find((J) => J.kind === "media-list");
    return w ? Math.max(((V = T[w.prop.name]) == null ? void 0 : V.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ s("section", { "aria-label": k.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ s("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: k.title }),
        /* @__PURE__ */ s("div", { ref: v, className: "relative", children: [
          /* @__PURE__ */ s("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": Y, onClick: () => g((w) => !w), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            D === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Te, { up: Y, width: 12, height: 12 })
          ] }),
          Y && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((w) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": D === w, type: "button", onClick: () => Ge(w), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${D === w ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: w === "json" ? "JSON" : "Form" }) }, w)) })
        ] })
      ] }),
      m,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(wa, { models: y, value: A, onChange: Le, favorites: O, onToggleFavorite: Se, usage: l, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: D === "json" ? "Request body" : "Parameters" }),
      (Q == null ? void 0 : Q.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: Q.description }),
      !pe && !I && A && /* @__PURE__ */ s("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(ye, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      I && /* @__PURE__ */ s("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        I
      ] }),
      y.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      pe && D === "json" && /* @__PURE__ */ s("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !W, spellCheck: !1, rows: 16, value: B, onChange: (w) => z(w.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${W ? "text-muted" : "text-danger"}`, children: W ? `Sent as the body of POST /api/v1/${b.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      pe && D === "form" && U.map((w) => /* @__PURE__ */ r(
        oa,
        {
          field: w,
          values: T,
          client: a,
          onError: M,
          tagCount: w.prop.name === "prompt" ? P : 0,
          onChange: (V, J) => G((ae) => ({ ...ae, [V]: J }))
        },
        w.prop.name
      ))
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      h && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: h }),
      f !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(f) }),
        " (",
        n,
        " × ",
        ne((Z == null ? void 0 : Z.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void xe(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => d(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          b && (G(Be(U)), z(JSON.stringify(je(U, Be(U)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ s(
          "button",
          {
            type: "button",
            onClick: () => void Re(),
            disabled: !pe,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(rt, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              Z && /* @__PURE__ */ s("span", { className: "font-normal", children: [
                "(",
                Z.original !== null ? /* @__PURE__ */ s(Ee, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: ne(Z.original * n) }),
                  " "
                ] }) : null,
                ne(Z.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Sa = {
  image: $e,
  video: Nr,
  audio: Sr,
  avatar: Cr,
  "3d": tt,
  "ai-tools": Ar,
  text: Tr,
  more: _r
};
function Ca({ mode: e, onChange: t, layout: a = "rail", onChangeKey: n }) {
  return a === "tabs" ? /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    ue.map((i) => {
      const l = i.id === e;
      return /* @__PURE__ */ s(
        "button",
        {
          onClick: () => t(i.id),
          "aria-current": l ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${l ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            i.label,
            l && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        i.id
      );
    }),
    n && /* @__PURE__ */ s("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ r(pt, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    ue.map((i) => {
      const l = Sa[i.id], o = i.id === e;
      return /* @__PURE__ */ s(
        "button",
        {
          onClick: () => t(i.id),
          "aria-current": o ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${o ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ r(l, {}),
            i.label
          ]
        },
        i.id
      );
    }),
    n && /* @__PURE__ */ s("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ r(pt, {}),
      "Key"
    ] })
  ] });
}
const Aa = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, vt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, Ia = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], Ma = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], $a = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], Ea = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), Ta = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], _a = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), La = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], Ga = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], Ra = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], Oa = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], Da = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), ja = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Pa = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), Va = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], jt = {
  seedream: { aspect: Ia, resolution: Ma },
  seedance: { aspect: $a, duration: Ea },
  minimax: { resolution: Ta, duration: _a },
  wan: { aspect: La, resolution: Ga, quality: Ra, duration: Oa },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, Ua = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, he = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Pt(e) {
  return ((a) => a.map((n, i) => {
    var l;
    return { ...n, label: ((l = Aa[e.slug]) == null ? void 0 : l[i]) ?? n.label };
  }))(qa(e));
}
function qa(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [he("base", "Target base image"), he("face", "New face image")];
    case "video-face-swap":
      return [he("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [he("start", "Starting frame image"), he("end", "Ending frame image", !0)];
    default:
      return [he("source", "Source image")];
  }
}
function Fa(e) {
  return Ua[e.template];
}
function wt(e) {
  var n, i, l, o, m, k, y, A, N, b, S;
  const t = jt[e.template], a = {};
  for (const I of e.sliders ?? []) a[I.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (l = (i = t.aspect) == null ? void 0 : i[0]) == null ? void 0 : l.value,
    resolution: (m = (o = t.resolution) == null ? void 0 : o[0]) == null ? void 0 : m.value,
    duration: ((y = (k = t.duration) == null ? void 0 : k.find((I) => I.value === 5)) == null ? void 0 : y.value) ?? ((N = (A = t.duration) == null ? void 0 : A[0]) == null ? void 0 : N.value),
    quality: (S = (b = t.quality) == null ? void 0 : b[0]) == null ? void 0 : S.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Vt(e, t) {
  var i;
  const a = [e.prompt], n = (i = e.presets) == null ? void 0 : i.find((l) => l.id === t.preset);
  n != null && n.prompt && a.push(n.prompt);
  for (const l of e.sliders ?? []) {
    const o = t.sliders[l.id] ?? 0;
    if (o !== 0) {
      const m = l.phrase(o);
      m && a.push(m);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function kt(e, t, a) {
  var l;
  const n = (l = e.presets) == null ? void 0 : l.find((o) => o.id === a), i = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: i };
}
function Ba(e, t) {
  for (const a of Pt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function za(e, t) {
  const a = Vt(e, t), n = t.uploads;
  switch (e.template) {
    case "seedream":
      return { prompt: a, images_list: [n.source], aspect_ratio: t.aspect, resolution: t.resolution };
    case "seedance":
      return { prompt: a, images_list: [n.source], aspect_ratio: t.aspect, duration: Number(t.duration) };
    case "minimax":
      return { prompt: a, image_url: n.start, ...n.end ? { last_image_url: n.end } : {}, resolution: t.resolution, duration: Number(t.duration) };
    case "wan":
      return { prompt: a, image_url: n.start, ...n.end ? { last_image: n.end } : {}, aspect_ratio: t.aspect, resolution: t.resolution, quality: t.quality, duration: Number(t.duration) };
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
function Ha(e) {
  return vt[e.slug] ? vt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Ja = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], _ = (e, t, a, n, i) => ({ id: e, label: t, hint: a, prompt: n, values: i }), We = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, H = (e, t, a, n, i, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: i, prompt: l, ...o }), j = (e, t, a, n, i, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: i, prompt: l, ...o }), Me = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${We(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${We(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Ya = [Me[2], { ...Me[1], id: "vertical", label: "Vertical angle" }, Me[0]].map((e) => ({ ...e, id: e.id })), Ka = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${We(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Wa = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], Xa = "Keep the result tasteful and suitable for general audiences.", Ut = [
  // ---- Professional
  H(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Me, presets: [
      _("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      _("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      _("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      _("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      _("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      _("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      _("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  H(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  H(
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
  H(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Ya.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
      _("morph", "Morph", void 0, "Use a morph transition."),
      _("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      _("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      _("whip", "Whip pan", void 0, "Use a fast whip pan."),
      _("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  H(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  H(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: Wa, presets: [
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
  H(
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
  H(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Ka }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  H(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  H(
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
  H(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  H(
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
  H(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  H(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  H(
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
  H(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  H(
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
  H("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
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
  H("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  j("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  j("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  j("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  H("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  H(
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
  H("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  H("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  H("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  H("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  H("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  H("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  H(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [_("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), _("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), _("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), _("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  H("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  j("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  j("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${Xa}`),
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
], _e = (e) => Ut.find((t) => t.slug === e), Xe = (e) => e.badge === "VIDEO" ? "video" : "image", ot = (e) => Ut.filter((t) => Xe(t) === e), Qe = (e) => ot(e).length > 0;
function qt(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = _e(t.get("app"));
  return a === "apps" ? { mode: n ? Xe(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === Xe(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function Qa(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function Za(e, t, a) {
  return `${e.pathname}${Qa(e.search, t, a)}${e.hash}`;
}
function en(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const tn = (e) => Ja.filter((t) => ot(e).some((a) => a.category === t.id));
function rn({ mode: e, value: t, onChange: a }) {
  const [n, i] = C(!1), [l, o] = C(""), [m, k] = C("all"), [y, A] = C(0), N = K(null), b = ee(() => tn(e), [e]), S = ee(() => en(ot(e), { category: m, q: l }), [e, m, l]), I = _e(t);
  q(() => A(0), [l, m, n]), q(() => {
    if (!n) return;
    const x = (h) => {
      var M;
      (M = N.current) != null && M.contains(h.target) || i(!1);
    }, p = (h) => {
      h.key === "Escape" && i(!1);
    };
    return document.addEventListener("mousedown", x), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", x), document.removeEventListener("keydown", p);
    };
  }, [n]), q(() => {
    var x, p;
    (p = (x = document.getElementById(`ms-app-${y}`)) == null ? void 0 : x.scrollIntoView) == null || p.call(x, { block: "nearest" });
  }, [y]);
  const R = (x) => {
    a(x), i(!1), o("");
  }, T = (x) => {
    x.key === "ArrowDown" ? (x.preventDefault(), A((p) => Math.min(p + 1, S.length - 1))) : x.key === "ArrowUp" ? (x.preventDefault(), A((p) => Math.max(p - 1, 0))) : x.key === "Enter" && S[y] && (x.preventDefault(), R(S[y].slug));
  }, G = (x) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${x ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ s("div", { ref: N, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => i((x) => !x),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (I == null ? void 0 : I.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (I == null ? void 0 : I.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Te, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ s("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(at, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: T, value: l, onChange: (x) => o(x.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ s("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === "all", onClick: () => k("all"), className: G(m === "all"), children: "All" }),
        b.map((x) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === x.id, onClick: () => k(x.id), className: G(m === x.id), children: x.label }, x.id))
      ] }),
      /* @__PURE__ */ s("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        S.map((x, p) => /* @__PURE__ */ s(
          "li",
          {
            id: `ms-app-${p}`,
            role: "option",
            "aria-selected": x.slug === t,
            onClick: () => R(x.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${x.slug === t ? "bg-primary-soft" : p === y ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: x.emoji }),
              /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${x.slug === t ? "text-primary" : ""}`, children: x.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: x.blurb })
              ] })
            ]
          },
          x.slug
        )),
        S.length === 0 && /* @__PURE__ */ s("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          l,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const an = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), we = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function nn({ mode: e, slug: t, onApp: a, switcher: n, models: i, client: l, batch: o, onRun: m }) {
  const k = _e(t), y = ue.find((A) => A.id === e).title;
  return /* @__PURE__ */ s("section", { "aria-label": y, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: y }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(rn, { mode: e, value: t, onChange: a }) })
    ] }),
    k ? /* @__PURE__ */ r(on, { app: k, mode: e, models: i, client: l, batch: o, onRun: m }, k.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function on({ app: e, mode: t, models: a, client: n, batch: i, onRun: l }) {
  var Y;
  const [o, m] = C(() => wt(e)), [k, y] = C(null), [A, N] = C(null), [b, S] = C(null), I = K(0);
  q(() => {
    m(wt(e)), y(null), N(null), S(null);
  }, [e]);
  const R = Fa(e), T = a.find((g) => g.name === R), G = jt[e.template], x = ee(() => za(e, o), [e, o]), p = JSON.stringify(x), h = (g) => m((B) => ({ ...B, ...g }));
  q(() => {
    if (!T) return;
    const g = ++I.current, B = setTimeout(() => {
      n.estimate(R, x).then((z) => {
        g === I.current && N(z);
      }).catch(() => {
        g === I.current && N(null);
      });
    }, 500);
    return () => clearTimeout(B);
  }, [p, T, n]), q(() => {
    S(null);
  }, [i, p]);
  const M = T ? et(T, A) : null, O = Pt(e), $ = async () => {
    T && (S(null), await l({ model: R, endpointUrl: T.endpoint_url, mode: t, prompt: Vt(e, o) || e.name, payload: x, count: i, kind: Ze(T.category), unitCost: M == null ? void 0 : M.current }));
  }, D = async () => {
    const g = Ba(e, o);
    if (g) {
      y(g);
      return;
    }
    y(null);
    const B = ((M == null ? void 0 : M.current) ?? 0) * i;
    if (B > Dt) {
      S(B);
      return;
    }
    await $();
  }, E = (g, B, z, f) => B && B.length > 0 ? /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: we, children: g }),
    /* @__PURE__ */ r(Je, { label: g, options: an(B), value: z, onChange: f })
  ] }) : null;
  return /* @__PURE__ */ s("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !T && /* @__PURE__ */ s("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        R,
        "”, which is not in your catalog right now."
      ] }),
      O.map((g) => /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: we, children: [
          /* @__PURE__ */ r("span", { children: g.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: g.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          Ye,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: o.uploads[g.id] ? [o.uploads[g.id]] : [],
            field: { prop: { name: `${g.kind}_${g.id}`, title: g.label, field: g.kind }, kind: "media", required: !g.optional },
            onUrls: (B) => h({ uploads: { ...o.uploads, [g.id]: B[0] ?? "" } }),
            onError: y
          }
        )
      ] }, g.id)),
      e.presets && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: we, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(Je, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((g) => ({ value: g.id, label: g.label, hint: g.hint }))], value: o.preset, onChange: (g) => m(kt(e, o, String(g))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (Y = e.sliders) == null ? void 0 : Y.map((g) => /* @__PURE__ */ s("div", { className: "mb-4", children: [
        /* @__PURE__ */ s("div", { className: we, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${g.id}`, children: g.label }),
          /* @__PURE__ */ s("span", { className: "tabular-nums text-primary", children: [
            o.sliders[g.id] ?? 0,
            g.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${g.id}`, type: "range", min: g.min, max: g.max, step: g.step, value: o.sliders[g.id] ?? 0, className: "w-full", onChange: (B) => h({ sliders: { ...o.sliders, [g.id]: Number(B.target.value) } }) })
      ] }, g.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => m(kt(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: we, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: o.refinement, onChange: (g) => h({ refinement: g.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      E("Aspect Ratio", G.aspect, o.aspect, (g) => h({ aspect: g })),
      E(e.template === "seedream" ? "Output Resolution" : "Resolution", G.resolution, o.resolution, (g) => h({ resolution: g })),
      E("Quality Level", G.quality, o.quality, (g) => h({ quality: String(g) })),
      E("Duration", G.duration, o.duration, (g) => h({ duration: Number(g) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && E("Target Face Index", Da, o.targetIndex, (g) => h({ targetIndex: Number(g) })),
      e.template === "video-face-swap" && E("Target Gender Filter", ja, o.gender, (g) => h({ gender: String(g) })),
      e.template === "bg-remover" && /* @__PURE__ */ s(Ee, { children: [
        E("Background Color", Pa, o.background, (g) => h({ background: String(g) })),
        E("Output Container & Codec", Va, o.container, (g) => h({ container: String(g) })),
        /* @__PURE__ */ s("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": o.keepAudio, onClick: () => h({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      k && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: k }),
      b !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(b) }),
        " (",
        i,
        " × ",
        ne((M == null ? void 0 : M.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void $(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => S(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !T, onClick: () => void D(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(rt, { width: 16, height: 16, className: "shrink-0" }),
        Ha(e),
        i > 1 ? ` ×${i}` : "",
        M && M.current > 0 && /* @__PURE__ */ s("span", { className: "font-normal", children: [
          "(",
          ne(M.current * i),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function Nt({ view: e, onChange: t }) {
  return /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Generate with", className: "mb-4 flex rounded-full border border-line bg-card-bg p-0.5", children: ["models", "apps"].map((a) => /* @__PURE__ */ r(
    "button",
    {
      role: "tab",
      type: "button",
      "aria-selected": e === a,
      onClick: () => t(a),
      className: `flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${e === a ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
      children: a === "models" ? "Models" : "Apps"
    },
    a
  )) });
}
function sn() {
  try {
    const e = window.location.search, t = qt(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return sr(a) ? a : null;
  } catch {
    return null;
  }
}
const ke = {
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
function St(e) {
  if (!Qe(e)) return { view: "models", app: null };
  try {
    const a = qt(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = ke.get(`muapi-studio:app:${e}`);
  return { view: ke.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: _e(t) ? t : null };
}
function ln({ scope: e, apiBase: t = "/api/muapi", initialTab: a = "image", showHeader: n = !0, title: i = "Studio", teamId: l, theme: o = "lime", layout: m, apiKey: k, onRequestApiKey: y, getHeaders: A, connected: N, fetchImpl: b, features: S, className: I = "", onTabChange: R }) {
  const T = N === !1 || k === "" || k === null, G = K(A);
  G.current = A;
  const [x, p] = C(!1), h = ee(() => new Xt(t, l, { apiKey: k || void 0, getHeaders: () => {
    var P;
    return ((P = G.current) == null ? void 0 : P.call(G)) ?? {};
  }, fetchImpl: b, onKeyRejected: () => p(!0) }), [t, l, k, b]);
  q(() => p(!1), [h]);
  const [M, O] = C({ library: !0, deleteMedia: !0 }), $ = ee(() => ({ library: M.library && (S == null ? void 0 : S.library) !== !1, deleteMedia: (S == null ? void 0 : S.deleteMedia) !== !1 }), [M, S == null ? void 0 : S.library, S == null ? void 0 : S.deleteMedia]), D = m ?? nr(o), [E, Y] = C(() => sn() ?? a), [g, B] = C(4), [z, f] = C(null), [d, u] = C(null), [v, L] = C(null), c = te(() => {
    h.balance().then(L).catch(() => L(null));
  }, [h]), [F, Q] = C(null), U = xr(h, z, c, e), se = ee(() => hr(U.items), [U.items]);
  q(() => {
    T || (u(null), f(null), h.models().then(f).catch((P) => u(P.message)), c(), (S == null ? void 0 : S.library) !== !1 && h.probe().then(O));
  }, [h, c, T, S == null ? void 0 : S.library]);
  const [W, oe] = C(() => St(E)), me = (P, w) => {
    try {
      window.history.replaceState(null, "", Za(window.location, P, w));
    } catch {
    }
  }, Le = (P) => {
    const w = St(P);
    Y(P), oe(w), R == null || R(P), me(P, w.view === "apps" ? w.app : null);
  }, Se = (P) => {
    oe((w) => ({ ...w, view: P })), ke.set(`muapi-studio:view:${E}`, P), me(E, P === "apps" ? W.app : null);
  }, Ge = (P) => {
    oe({ view: "apps", app: P }), ke.set(`muapi-studio:app:${E}`, P), ke.set(`muapi-studio:view:${E}`, "apps"), me(E, P);
  }, Z = te(async (P) => {
    await U.run(P);
  }, [U.run]), xe = te((P) => {
    var V;
    const w = z == null ? void 0 : z.find((J) => J.name === P);
    return w ? ((V = w.sale) == null ? void 0 : V.from) ?? w.cost ?? void 0 : void 0;
  }, [z]), Re = te((P) => {
    Y(P.mode), oe((w) => ({ ...w, view: "models" })), Q({ model: P.model, inputs: P.inputs, nonce: Date.now() });
  }, []), pe = te(async (P) => {
    var ie;
    const w = z == null ? void 0 : z.find((ve) => ve.name === P.model);
    if (!w) return;
    let V = ((ie = w.sale) == null ? void 0 : ie.from) ?? w.cost ?? 0, J = !1;
    try {
      V = (await h.estimate(P.model, P.inputs)).cost, J = !0;
    } catch {
    }
    const ae = J ? "" : " (the exact price could not be checked)";
    (V > 0.25 || !J) && !window.confirm(`Re-run ${P.model} for about $${V.toFixed(2)}?${ae}`) || U.run({ model: P.model, endpointUrl: w.endpoint_url, mode: P.mode, prompt: P.prompt, payload: P.inputs, count: 1, unitCost: V, kind: Ze(w.category) });
  }, [z, U.run, h]);
  return /* @__PURE__ */ s("div", { className: `ms-root ${I}`.trim(), style: ar(o), "data-layout": D, "data-btn": or(o), children: [
    n && /* @__PURE__ */ s("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: i }),
      v && /* @__PURE__ */ s("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(v.balance) })
      ] })
    ] }),
    T ? /* @__PURE__ */ s("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      y && /* @__PURE__ */ r("button", { type: "button", onClick: y, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ s(At.Provider, { value: $, children: [
      x && /* @__PURE__ */ s("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        y && /* @__PURE__ */ r("button", { type: "button", onClick: y, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ s("div", { className: `flex min-h-0 flex-1 flex-col ${D === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(Ca, { mode: E, onChange: Le, layout: D, onChangeKey: y }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: d ? /* @__PURE__ */ s("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          d
        ] }) : z ? /* @__PURE__ */ s(Ee, { children: [
          W.view === "apps" && Qe(E) ? /* @__PURE__ */ r(nn, { mode: E, slug: W.app, onApp: Ge, switcher: /* @__PURE__ */ r(Nt, { view: "apps", onChange: Se }), models: z, client: h, batch: g, onRun: Z }) : /* @__PURE__ */ r(Na, { mode: E, models: z, client: h, batch: g, onRun: Z, usage: se, reuse: F, switcher: Qe(E) ? /* @__PURE__ */ r(Nt, { view: "models", onChange: Se }) : void 0 }),
          /* @__PURE__ */ r(Vr, { mode: E, items: U.items, batch: g, onBatch: B, onLabel: U.setLabel, onRemove: U.remove, onReuse: Re, onRerun: pe, onDeleteMedia: U.deleteMedia, onLoadMore: U.loadMore, hasMore: U.hasMore, loadingMore: U.loadingMore, serverError: U.serverError, estimateFor: xe })
        ] }) : /* @__PURE__ */ s("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(ye, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function un(e) {
  const t = e.accountId ?? gr(e.apiKey);
  return /* @__PURE__ */ r(ln, { scope: t, ...e }, t);
}
export {
  ce as ApiError,
  Xt as MuapiClient,
  un as MuapiStudio,
  rr as THEMES,
  tr as cyanTheme,
  nr as defaultLayout,
  Ze as generationKind,
  qe as limeTheme,
  it as pollUntilDone,
  Mt as resolveTheme,
  gr as scopeOfKey,
  ar as themeStyle
};
