import { jsx as r, jsxs as l, Fragment as Ge } from "react/jsx-runtime";
import { createContext as Jt, useContext as Yt, useState as I, useRef as z, useEffect as q, useCallback as ne, useMemo as te, createElement as Kt, useId as Wt, useLayoutEffect as Xt } from "react";
function Qt(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
function Zt(e) {
  const t = Number(e);
  return e && Number.isFinite(t) && t >= 0 ? Math.min(t, 120) * 1e3 : void 0;
}
class fe extends Error {
  constructor(t, a, n) {
    super(t), this.status = a, this.retryAfterMs = n;
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
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class tr {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    var u, x, g, C;
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [A, f] of Object.entries(await this.opts.getHeaders())) n.set(A, f);
    const o = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), i = await o.text();
    let s = null;
    try {
      s = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!o.ok && Qt(o.status, s, i) && !t.startsWith("/app/") && ((x = (u = this.opts).onKeyRejected) == null || x.call(u)), !o.ok) throw new fe(er(s, `${o.status} ${o.statusText}`), o.status, Zt((C = (g = o.headers) == null ? void 0 : g.get) == null ? void 0 : C.call(g, "retry-after")));
    if (s === null && i.trim()) throw new fe("Unexpected non-JSON response from the server", 502);
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
  estimate(t, a) {
    return this.request(`/api/v1/models/${encodeURIComponent(t)}/estimate-cost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(a)
    });
  }
  /** Submit with the model's `endpoint_url` (the catalog's `endpoint` field can be wrong). */
  async submit(t, a, n) {
    var s;
    const o = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(a)
    }), i = o.request_id || o.id;
    if (!i) throw new fe("The API did not return a request id", 502);
    return { requestId: i, cost: (s = o.cost) == null ? void 0 : s.amount_usd };
  }
  async poll(t, a) {
    var u;
    const n = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`, a ? { signal: a } : {}), o = String(n.status || "").toLowerCase(), i = ["completed", "succeeded", "success"].includes(o) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(o) ? "failed" : o === "pending" ? "pending" : "processing", s = Array.isArray(n.outputs) ? n.outputs : n.url ? [n.url] : [];
    return { status: i, outputs: s, error: Et(n.error), cost: (u = n.cost) == null ? void 0 : u.amount_usd };
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
    const t = (n) => n instanceof fe && [403, 404, 405].includes(n.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((n) => !t(n)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var i;
    const a = new FormData();
    a.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: a }), o = n.url || n.file_url || ((i = n.data) == null ? void 0 : i.url);
    if (!o) throw new fe("Upload returned no URL", 502);
    return o;
  }
}
const rr = (e) => Math.min(Math.round(e * 1.15), 6e3), ar = 3e4, nr = (e, t) => new Promise((a) => {
  const n = setTimeout(o, e);
  function o() {
    clearTimeout(n), t == null || t.removeEventListener("abort", o), a();
  }
  t == null || t.addEventListener("abort", o);
});
async function ct(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: o = 15 * 60 * 1e3, signal: i, onUpdate: s } = a, u = Date.now();
  let x = 0, g = n;
  for (; Date.now() - u < o; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    let C = g;
    const A = new AbortController(), f = () => A.abort();
    i == null || i.addEventListener("abort", f);
    const k = setTimeout(() => A.abort(), Math.max(o - (Date.now() - u), 0));
    try {
      const N = await e.poll(t, A.signal);
      if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
      if (x = 0, s == null || s(N), N.status === "completed" || N.status === "failed") return N;
      g = rr(g), C = g;
    } catch (N) {
      if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
      if (A.signal.aborted) break;
      if (N instanceof fe && N.status === 429) C = N.retryAfterMs ?? ar;
      else if (++x >= 5) throw N;
    } finally {
      clearTimeout(k), i == null || i.removeEventListener("abort", f);
    }
    await nr(C, i);
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
  const t = _t(e), a = {};
  for (const n of Object.keys(dt)) a[dt[n]] = t[n];
  return a;
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
  const a = ye.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const pr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Lt(e, t, a = {}) {
  const n = (i) => {
    var s;
    return ((s = i.sale) == null ? void 0 : s.from) ?? i.cost ?? 1 / 0;
  }, o = [...e];
  return t === "a-z" ? o.sort((i, s) => i.name.localeCompare(s.name)) : t === "price-asc" ? o.sort((i, s) => n(i) - n(s)) : t === "price-desc" ? o.sort((i, s) => n(s) - n(i)) : t === "most-used" ? o.filter((i) => {
    var s;
    return (((s = a.usage) == null ? void 0 : s[i.name]) ?? 0) > 0;
  }).sort((i, s) => (a.usage[s.name] ?? 0) - (a.usage[i.name] ?? 0)) : t === "favourites" ? o.filter((i) => {
    var s;
    return (s = a.favorites) == null ? void 0 : s.includes(i.name);
  }) : o.sort((i, s) => +!!s.sale - +!!i.sale);
}
const hr = { completed: "completed", succeeded: "completed", success: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function fr(e, t) {
  var n, o;
  const a = (n = t.find((i) => i.name === e)) == null ? void 0 : n.group_of;
  return ((o = ye.find((i) => a && i.groups.includes(a))) == null ? void 0 : o.id) ?? "ai-tools";
}
function gr(e, t, a = {}) {
  var i;
  const n = e.output ?? {}, o = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: fr(e.model, t),
    prompt: typeof o.prompt == "string" ? o.prompt : "",
    inputs: o,
    status: hr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: Et(n.error),
    cost: (i = n.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function br(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((u) => u.requestId).map((u) => [u.requestId, u])), o = new Set(e.map((u) => u.requestId).filter(Boolean));
  return [...e.map((u) => {
    const x = u.requestId ? n.get(u.requestId) : void 0;
    return u.status === "failed" && x && x.status === "completed" && x.outputs.length ? { ...u, status: x.status, outputs: x.outputs, error: void 0, cost: u.cost ?? x.cost } : u;
  }), ...t.filter((u) => !u.requestId || !o.has(u.requestId))].filter((u) => !(u.requestId && a.has(u.requestId))).sort((u, x) => x.createdAt - u.createdAt);
}
function yr(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function se(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function be(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Gt = "muapi-studio:history:v1", xr = 200, ve = (e, t) => t ? `${e}:${t}` : e;
function vr(e) {
  if (!e) return "";
  let t = 2166136261, a = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, a = Math.imul(a ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${a.toString(36)}`;
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
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, mt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, pt = "muapi-studio:labels:v1", ht = "muapi-studio:hidden:v1";
function Nr(e, t, a, n = "", o = !0) {
  const [i, s] = I(() => Pe(n)), [u, x] = I([]), [g, C] = I(null), [A, f] = I(!1), [k, N] = I(null), R = z(!1), [E, L] = I(() => ut(ve(pt, n), {})), [p, m] = I(() => ut(ve(ht, n), [])), b = z(/* @__PURE__ */ new Set()), $ = z(new AbortController()), O = z([]);
  O.current = t ?? [], q(() => wr(i, n), [i, n]), q(() => mt(ve(pt, n), E), [E, n]), q(() => mt(ve(ht, n), p), [p, n]), q(() => ($.current = new AbortController(), () => $.current.abort()), []);
  const w = ne((y, d) => s((M) => M.map((D) => D.id === y ? { ...D, ...d } : D)), []), j = ne(async (y, d) => {
    if (!b.current.has(y)) {
      b.current.add(y);
      try {
        const M = await ct(e, d, {
          signal: $.current.signal,
          onUpdate: (D) => w(y, { status: D.status, outputs: D.outputs, error: D.error, cost: D.cost })
        });
        w(y, { status: M.status, outputs: M.outputs, error: M.error, cost: M.cost }), a == null || a();
      } catch (M) {
        M.name !== "AbortError" && w(y, { status: "failed", error: M.message });
      } finally {
        b.current.delete(y);
      }
    }
  }, [e, w, a]), _ = ne(async (y) => {
    if (!y.requestId || b.current.has(y.id)) return;
    b.current.add(y.id);
    const d = (M) => x((D) => D.map((F) => F.id === y.id ? { ...F, status: M.status, outputs: M.outputs, error: M.error, cost: M.cost ?? F.cost } : F));
    try {
      const M = await ct(e, y.requestId, { signal: $.current.signal, onUpdate: d });
      d(M), a == null || a();
    } catch {
    } finally {
      b.current.delete(y.id);
    }
  }, [e, a]);
  q(() => {
    const y = new Set(Pe(n).map((d) => d.requestId));
    for (const d of u) (d.status === "pending" || d.status === "processing") && d.requestId && !y.has(d.requestId) && _(d);
  }, [u, n, _]);
  const Y = z(!1);
  q(() => {
    if (!(!o || Y.current)) {
      Y.current = !0;
      for (const y of Pe(n)) (y.status === "pending" || y.status === "processing") && y.requestId && j(y.id, y.requestId);
    }
  }, [o]);
  const B = ne(async (y = !1) => {
    if (!R.current) {
      f(!0), N(null);
      try {
        const d = await e.history(y ? void 0 : g ?? void 0), M = d.items.map((D) => gr(D, O.current));
        x((D) => y ? M : [...D, ...M]), C(d.next_cursor);
      } catch (d) {
        d instanceof fe && [403, 404, 405].includes(d.status) ? (R.current = !0, C(null)) : N(d.message);
      } finally {
        f(!1);
      }
    }
  }, [e, g]), Z = z(!1);
  q(() => {
    t && !Z.current && (Z.current = !0, B(!0));
  }, [t, B]);
  const h = ne((y) => {
    const d = Array.from({ length: y.count }, () => ({
      id: kr(),
      model: y.model,
      mode: y.mode,
      prompt: y.prompt,
      inputs: y.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: y.unitCost,
      source: "local"
    }));
    return s((M) => [...d, ...M]), Promise.all(d.map(async (M) => {
      try {
        const { requestId: D, cost: F } = await e.submit(y.endpointUrl, y.payload, y.kind);
        w(M.id, { requestId: D, ...F !== void 0 ? { cost: F } : {} }), await j(M.id, D);
      } catch (D) {
        w(M.id, { status: "failed", error: D.message });
      }
    }));
  }, [e, w, j]), P = te(() => {
    const y = (d) => ({ ...d, label: d.requestId && E[d.requestId] || d.label });
    return br(i.map(y), u.map(y), new Set(p));
  }, [i, u, E, p]), c = ne((y, d) => {
    y.requestId && L((M) => {
      const D = { ...M };
      return d ? D[y.requestId] = d : delete D[y.requestId], D;
    }), w(y.id, { label: d });
  }, [w]), v = ne((y) => {
    s((d) => d.filter((M) => M.id !== y.id)), y.requestId && m((d) => [.../* @__PURE__ */ new Set([...d, y.requestId])]);
  }, []), G = ne(async (y) => {
    y.requestId && (await e.deleteMedia(y.requestId), w(y.id, { outputs: [] }), x((d) => d.map((M) => M.requestId === y.requestId ? { ...M, outputs: [] } : M)));
  }, [e, w]);
  return { items: P, run: h, setLabel: c, remove: v, deleteMedia: G, loadMore: () => B(!1), hasMore: !!g, loadingMore: A, serverError: k };
}
const Sr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Rt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : Sr.test(e) ? "file" : "image" : "text";
}
function Ar(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const Cr = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), Q = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Le = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), Ir = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), Mr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), Er = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), at = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), Tr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), nt = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), ft = ({ filled: e, ...t }) => /* @__PURE__ */ r(Q, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), ot = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Re = ({ up: e, ...t }) => /* @__PURE__ */ r(Q, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), $r = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), _r = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), He = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), Ie = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), ke = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), Ot = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), Lr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), Ne = (e) => /* @__PURE__ */ r(Q, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Gr = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Rr = (e) => /* @__PURE__ */ r(Q, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Or = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), gt = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Dt({ url: e }) {
  return /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(at, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let bt = null;
const Dr = () => bt ?? (bt = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw bt = null, e;
}));
function jr({ url: e, hidden: t = !1 }) {
  const [a, n] = I("loading"), o = z(null);
  return q(() => {
    let i = !0;
    return n("loading"), Dr().catch(() => i && n("failed")), () => {
      i = !1;
    };
  }, [e]), q(() => {
    const i = o.current;
    if (!i) return;
    const s = () => n("ready"), u = () => n("failed");
    return i.addEventListener("load", s), i.addEventListener("error", u), () => {
      i.removeEventListener("load", s), i.removeEventListener("error", u);
    };
  }), a === "failed" ? /* @__PURE__ */ r(Dt, { url: e }) : /* @__PURE__ */ l("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    Kt("model-viewer", {
      ref: o,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    a === "loading" && /* @__PURE__ */ l("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(Ne, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(at, { width: 14, height: 14 }) })
  ] });
}
const Pr = ["All", "Approved", "Rejected", "Unlabeled"], Vr = [1, 2, 4, 6, 8];
function Ur({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, o = Rt(e);
  return o === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: Ar(e) }) : o === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : o === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : o === "3d" ? Cr(e) ? /* @__PURE__ */ r(jr, { url: e, hidden: t }) : /* @__PURE__ */ r(Dt, { url: e }) : o === "file" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(He, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function qr({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: o, onRerun: i, onDeleteMedia: s, onOpen: u, estimateFor: x }) {
  const [g, C] = I(0), A = e.outputs.length, f = Math.min(g, Math.max(A - 1, 0)), k = e.outputs[f], N = !!k && Rt(k) === "text", [R, E] = I(!1), [L, p] = I(null), m = $t(), b = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", $ = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ l("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && k ? /* @__PURE__ */ l("div", { className: "relative", children: [
      /* @__PURE__ */ r(Ur, { url: k, hidden: t, onOpen: () => u(k) }),
      A > 1 && /* @__PURE__ */ l("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Previous output", disabled: f === 0, onClick: () => C(f - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ l("span", { "aria-live": "polite", children: [
          f + 1,
          " / ",
          A
        ] }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Next output", disabled: f === A - 1, onClick: () => C(f + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ l("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(ke, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ l("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(Ne, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ l("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ l("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? se(e.cost) : e.status === "completed" && (x == null ? void 0 : x(e.model)) !== void 0 ? `est. ${se(x(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && k && (N ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(k)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${$} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(He, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: k, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${$} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(He, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${$} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ r(Ie, { width: 14, height: 14 })
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
            className: `${$} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ r(ke, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => o(e), title: "Load this model and settings back into the form", className: b, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: b, children: "Re-run" }),
        e.status === "completed" && k && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var O;
          (O = navigator.clipboard) == null || O.writeText(k).then(() => {
            E(!0), setTimeout(() => E(!1), 1500);
          });
        }, className: b, children: R ? "Copied" : N ? "Copy text" : "Copy link" })
      ] }),
      L && /* @__PURE__ */ l("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        L
      ] }),
      /* @__PURE__ */ l("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ l("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ l("span", { className: "flex shrink-0 gap-3", children: [
          m.deleteMedia && e.requestId && e.status === "completed" && k && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (p(null), s(e).catch((O) => p(O.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Fr({ url: e, onClose: t }) {
  const a = z(null), n = z(null);
  return q(() => {
    var s;
    const o = document.activeElement;
    (s = n.current) == null || s.focus();
    const i = (u) => {
      var x;
      if (u.key === "Escape") {
        t();
        return;
      }
      u.key === "Tab" && (u.preventDefault(), (x = n.current) == null || x.focus());
    };
    return document.addEventListener("keydown", i), () => {
      var u;
      document.removeEventListener("keydown", i), (u = o == null ? void 0 : o.focus) == null || u.call(o);
    };
  }, [t]), /* @__PURE__ */ l("div", { ref: a, role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { ref: n, type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(ke, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (o) => o.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Br({ mode: e, items: t, batch: a, onBatch: n, onLabel: o, onRemove: i, onReuse: s, onRerun: u, onDeleteMedia: x, onLoadMore: g, hasMore: C, loadingMore: A, serverError: f, estimateFor: k }) {
  const [N, R] = I("All"), [E, L] = I(""), [p, m] = I(!1), [b, $] = I(null), O = te(() => {
    const w = E.trim().toLowerCase();
    return t.filter((j) => j.mode !== e || N === "Approved" && j.label !== "approved" || N === "Rejected" && j.label !== "rejected" || N === "Unlabeled" && j.label !== null ? !1 : !w || j.prompt.toLowerCase().includes(w) || j.model.toLowerCase().includes(w));
  }, [t, e, N, E]);
  return /* @__PURE__ */ l("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Pr.map((w) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": N === w,
          onClick: () => R(w),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${N === w ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: w
        },
        w
      )) }),
      /* @__PURE__ */ l("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(ot, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: E, onChange: (w) => L(w.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Vr.map((w) => /* @__PURE__ */ r(
        "button",
        {
          role: "radio",
          "aria-checked": a === w,
          onClick: () => n(w),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${a === w ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: w
        },
        w
      )) }),
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": p, "aria-label": p ? "Show previews" : "Hide previews", title: p ? "Show previews" : "Hide previews", onClick: () => m((w) => !w), className: p ? "text-primary" : "text-secondary hover:text-fg", children: p ? /* @__PURE__ */ r($r, { width: 18, height: 18 }) : /* @__PURE__ */ r(_r, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      O.length === 0 ? /* @__PURE__ */ l("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(nt, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some((w) => w.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((w) => w.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: O.map((w) => /* @__PURE__ */ r(qr, { g: w, hidden: p, onLabel: o, onRemove: i, onReuse: s, onRerun: u, onDeleteMedia: x, onOpen: $, estimateFor: k }, w.id)) }),
      f && /* @__PURE__ */ l("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        f
      ] }),
      C && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: A, onClick: g, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: A ? "Loading…" : "Load more history" }) }),
      b && /* @__PURE__ */ r(Fr, { url: b, onClose: () => $(null) })
    ] })
  ] });
}
const zr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Hr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Jr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? zr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Hr.test(e.name) ? "media" : "text" : "text";
}
function Ve(e) {
  var s, u;
  const t = (u = (s = e.input_schema) == null ? void 0 : s.schemas) == null ? void 0 : u.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), o = [...n.filter((x) => a[x]), ...Object.keys(a).filter((x) => !n.includes(x))], i = new Set(e.required_fields ?? []);
  return o.map((x) => ({ prop: { ...a[x], name: x }, kind: Jr({ ...a[x], name: x }), required: i.has(x) }));
}
function Je(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: o, required: i } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : i && (o === "textarea" || o === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const ge = (e) => `__auto:${e}`, Ye = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Ke = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function Ue(e, t) {
  const a = {};
  for (const { prop: n, kind: o } of e) {
    if (t[ge(n.name)] === !0) continue;
    const i = t[n.name] ?? n.default;
    if (!Ke(i))
      if (o === "number") {
        const s = Number(i);
        Number.isFinite(s) && (a[n.name] = s);
      } else if (o === "json" && typeof i == "string")
        try {
          a[n.name] = JSON.parse(i);
        } catch {
        }
      else a[n.name] = i;
  }
  return a;
}
function Yr(e, t) {
  for (const { prop: a, kind: n, required: o } of e) {
    if (t[ge(a.name)] === !0) continue;
    const i = t[a.name] ?? a.default, s = a.title || a.name;
    if (o && Ke(i)) return `${s} is required`;
    if (n === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${s} must be valid JSON`;
      }
    if (n === "number" && !Ke(i)) {
      const u = Number(i);
      if (!Number.isFinite(u)) return `${s} must be a number`;
      if (a.minValue !== void 0 && u < a.minValue) return `${s} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && u > a.maxValue) return `${s} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const Kr = 12, it = 240, Ee = (e) => `${typeof e}:${e}`, Wr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Xr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Qr(e, t, a = it) {
  return e >= a || e >= t ? "down" : "up";
}
const Zr = 36, ea = 48;
function ta(e, t) {
  return Math.min(it, Math.max(1, e) * Zr + 8) + (t ? ea : 0);
}
function ra(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const yt = "Auto (let model decide)", qe = "__auto__";
function We({ id: e, label: t, options: a, value: n, onChange: o, allowAuto: i, auto: s, onAuto: u, combobox: x }) {
  const g = Wt(), C = e ?? `ms-dd-${g}`, A = x ?? a.length > Kr, [f, k] = I(!1), [N, R] = I(""), [E, L] = I(0), [p, m] = I("down"), b = z(null), $ = z(null), O = z(null), w = a.find((c) => n !== void 0 && Ee(c.value) === Ee(n)), j = te(() => A ? Xr(a, N) : a, [A, a, N]), _ = te(
    () => [...i ? [{ key: qe, label: yt, value: qe, isAuto: !0 }] : [], ...j.map((c) => ({ key: Ee(c.value), label: c.label, hint: c.hint, value: c.value }))],
    [i, j]
  ), Y = s ? qe : w ? Ee(w.value) : void 0, B = () => {
    k(!1), R("");
  }, Z = (c) => {
    c.isAuto ? u == null || u() : o(c.value), B();
  };
  Xt(() => {
    if (!f || !b.current) return;
    const c = b.current.getBoundingClientRect();
    let v = b.current.parentElement;
    for (; v && !/(auto|scroll)/.test(getComputedStyle(v).overflowY); ) v = v.parentElement;
    const G = v ? v.getBoundingClientRect() : null, y = Math.min(window.innerHeight, G ? G.bottom : window.innerHeight), d = Math.max(0, G ? G.top : 0);
    m(Qr(y - c.bottom, c.top - d, ta(a.length + (i ? 1 : 0), A)));
  }, [f]), q(() => {
    if (!f) return;
    const c = _.findIndex((v) => v.key === Y);
    L(c >= 0 ? c : 0);
  }, [f, N]), q(() => {
    var c, v, G;
    f && ((G = (v = (c = $.current) == null ? void 0 : c.querySelector(`[data-i="${E}"]`)) == null ? void 0 : v.scrollIntoView) == null || G.call(v, { block: "nearest" }));
  }, [E, f]), q(() => {
    var c;
    f && A && ((c = O.current) == null || c.focus());
  }, [f, A]), q(() => {
    if (!f) return;
    const c = (v) => {
      var G;
      (G = b.current) != null && G.contains(v.target) || B();
    };
    return document.addEventListener("mousedown", c), () => document.removeEventListener("mousedown", c);
  }, [f]);
  const h = (c) => {
    if (!f) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(c.key) && (c.preventDefault(), k(!0));
      return;
    }
    if (c.key === "Escape") {
      c.preventDefault(), c.stopPropagation(), B();
      return;
    }
    if (c.key === "Enter") {
      c.preventDefault(), _[E] && Z(_[E]);
      return;
    }
    if (c.key === "Tab") {
      B();
      return;
    }
    if (c.key === " " && !A) {
      c.preventDefault(), _[E] && Z(_[E]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(c.key) && (c.preventDefault(), L((v) => ra(v, c.key, _.length)));
  }, P = s ? yt : (w == null ? void 0 : w.label) ?? "Select…";
  return /* @__PURE__ */ l("div", { ref: b, className: "relative w-full", onKeyDown: h, children: [
    /* @__PURE__ */ l(
      "button",
      {
        id: C,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": f,
        "aria-label": `${t}: ${P}`,
        "aria-controls": `${C}-list`,
        onClick: () => k((c) => !c),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${f ? "border-primary" : "border-line hover:border-muted"} ${s ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: P }),
          /* @__PURE__ */ r(Re, { up: f, width: 16, height: 16 })
        ]
      }
    ),
    f && /* @__PURE__ */ l("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${p === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      A && /* @__PURE__ */ r(
        "input",
        {
          ref: O,
          value: N,
          onChange: (c) => R(c.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${C}-list`,
          "aria-activedescendant": _[E] ? `${C}-o${E}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ l("ul", { id: `${C}-list`, ref: $, role: "listbox", "aria-label": t, style: { maxHeight: it }, className: "overflow-y-auto", children: [
        _.map((c, v) => {
          const G = c.key === Y;
          return /* @__PURE__ */ l(
            "li",
            {
              id: `${C}-o${v}`,
              "data-i": v,
              role: "option",
              "aria-selected": G,
              onMouseEnter: () => L(v),
              onClick: () => Z(c),
              className: `flex cursor-pointer items-center justify-between gap-2 ${c.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${G ? "bg-primary text-primary-ink" : v === E ? "bg-card-bg" : ""} ${c.isAuto && !G ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ l("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: c.label }),
                  c.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${G ? "opacity-70" : "text-muted"}`, children: c.hint })
                ] }),
                G && /* @__PURE__ */ r(Ie, { width: 14, height: 14 })
              ]
            },
            c.key
          );
        }),
        _.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const aa = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function na({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Le, {}) });
}
function oa({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: o }) {
  const [i, s] = I(a), [u, x] = I(""), [g, C] = I(1), [A, f] = I(null), [k, N] = I(null), [R, E] = I(!1), [L, p] = I([]), [m, b] = I(""), [$, O] = I(!1), w = z(null), j = z(null), _ = z(0), Y = ne(async () => {
    const c = ++_.current;
    E(!0), N(null);
    try {
      const v = await e.mediaLibrary({ mediaType: i, search: u, page: g });
      c === _.current && f(v);
    } catch (v) {
      c === _.current && N(v.message);
    } finally {
      c === _.current && E(!1);
    }
  }, [e, i, u, g]);
  q(() => {
    const c = setTimeout(Y, u ? 300 : 0);
    return () => clearTimeout(c);
  }, [Y, u]), q(() => {
    C(1);
  }, [i, u]), q(() => {
    var G;
    const c = document.activeElement;
    (G = w.current) == null || G.focus();
    const v = (y) => {
      if (y.key === "Escape") {
        y.stopPropagation(), o();
        return;
      }
      if (y.key !== "Tab" || !w.current) return;
      const d = [...w.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!d.length) return;
      const M = d[0], D = d[d.length - 1];
      y.shiftKey && document.activeElement === M ? (y.preventDefault(), D.focus()) : !y.shiftKey && document.activeElement === D && (y.preventDefault(), M.focus());
    };
    return document.addEventListener("keydown", v), () => {
      var y;
      document.removeEventListener("keydown", v), (y = c == null ? void 0 : c.focus) == null || y.call(c);
    };
  }, [o]);
  const B = (c) => p((v) => v.includes(c) ? v.filter((G) => G !== c) : t === 1 ? [c] : v.length < t ? [...v, c] : v), Z = async (c) => {
    if (c.length) {
      E(!0), N(null);
      try {
        for (const v of c) {
          const G = await e.upload(v);
          await e.saveToLibrary({ url: G, name: v.name, mime_type: v.type || void 0, size_bytes: v.size, media_type: v.type.startsWith("video") ? "video" : v.type.startsWith("audio") ? "audio" : v.type.startsWith("image") ? "image" : "archive" });
        }
        await Y();
      } catch (v) {
        N(v.message), E(!1);
      }
    }
  }, h = async () => {
    var v;
    const c = m.trim();
    if (!/^https?:\/\//i.test(c)) {
      N("Enter a full http(s) URL");
      return;
    }
    E(!0), N(null);
    try {
      const G = ((v = c.split("?")[0].split(".").pop()) == null ? void 0 : v.toLowerCase()) ?? "", y = ["mp4", "webm", "mov"].includes(G) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(G) ? "audio" : ["zip", "rar", "7z"].includes(G) ? "archive" : "image";
      await e.saveToLibrary({ url: c, name: c.split("/").pop() || "link", media_type: y }), b(""), O(!1), await Y();
    } catch (G) {
      N(G.message), E(!1);
    }
  }, P = async (c) => {
    if (window.confirm(`Delete "${c.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(c.id), p((v) => v.filter((G) => G !== c.url)), await Y();
      } catch (v) {
        N(v.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (c) => {
    c.target === c.currentTarget && o();
  }, children: /* @__PURE__ */ l("div", { ref: w, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ l("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Le, {}) }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ l("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
            (A == null ? void 0 : A.total) ?? 0,
            " ",
            (A == null ? void 0 : A.total) === 1 ? "item" : "items"
          ] })
        ] }),
        /* @__PURE__ */ l("p", { className: "hidden text-xs text-secondary sm:block", children: [
          "Select up to ",
          t,
          " item",
          t === 1 ? "" : "s",
          " to insert into your form"
        ] })
      ] }),
      /* @__PURE__ */ r("input", { ref: j, type: "file", hidden: !0, multiple: !0, onChange: (c) => {
        const v = Array.from(c.target.files ?? []);
        c.target.value = "", Z(v);
      } }),
      /* @__PURE__ */ l("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var c;
        return (c = j.current) == null ? void 0 : c.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ r(Ot, { width: 14, height: 14 }),
        /* @__PURE__ */ r("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: o, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(ke, {}) })
    ] }),
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: aa.map((c) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": i === c.id, onClick: () => s(c.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === c.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: c.label }, c.id)) }),
      /* @__PURE__ */ r("input", { value: u, onChange: (c) => x(c.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": $, onClick: () => O((c) => !c), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    $ && /* @__PURE__ */ l("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: m, onChange: (c) => b(c.target.value), onKeyDown: (c) => c.key === "Enter" && void h(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void h(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      k && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: k }),
      R && !A ? /* @__PURE__ */ l("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(Ne, {}),
        " Loading…"
      ] }) : A != null && A.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: A.items.map((c) => {
        const v = L.includes(c.url);
        return /* @__PURE__ */ l("li", { className: `group relative overflow-hidden rounded-card border ${v ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": v, "aria-label": `${v ? "Deselect" : "Select"} ${c.name ?? "file"}`, onClick: () => B(c.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(na, { a: c }) }),
          v && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(Ie, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${c.name ?? "file"}`, onClick: () => void P(c), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(ke, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: c.name ?? "", children: c.name })
        ] }, c.id);
      }) }) : /* @__PURE__ */ l("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Le, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      A && A.total_pages > 1 && /* @__PURE__ */ l("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: g <= 1, onClick: () => C((c) => c - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        g,
        " of ",
        A.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: g >= A.total_pages, onClick: () => C((c) => c + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ l("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ l("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: L.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !L.length, onClick: () => {
        n(L), o();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(Ie, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const jt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, ia = (e, t = "") => {
  const a = jt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, sa = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function la(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, o) => void e.saveToLibrary({ url: a[o], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: sa(n) }).catch(() => {
  })), a;
}
function Xe({ client: e, field: t, multiple: a, max: n, current: o, onUrls: i, onError: s }) {
  const u = z(null), [x, g] = I(!1), [C, A] = I(!1), [f, k] = I(!1), N = n - o.length, R = $t(), E = async (m) => {
    if (!(!m.length || a && N <= 0)) {
      g(!0);
      try {
        i(await la(e, a ? m.slice(0, N) : m.slice(0, 1)));
      } catch (b) {
        s(b.message);
      } finally {
        g(!1);
      }
    }
  }, L = jt(t.prop.field, t.prop.name), p = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ l(
    "div",
    {
      onDragOver: (m) => {
        m.preventDefault(), A(!0);
      },
      onDragLeave: () => A(!1),
      onDrop: (m) => {
        m.preventDefault(), A(!1), E(Array.from(m.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${C ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: u, type: "file", hidden: !0, accept: L, multiple: a, onChange: (m) => {
          const b = Array.from(m.target.files ?? []);
          m.target.value = "", E(b);
        } }),
        (a ? N > 0 : !0) && /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ r(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: a ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: a ? void 0 : o[0] ?? "",
              defaultValue: void 0,
              onChange: a ? void 0 : (m) => i([m.target.value]),
              onKeyDown: a ? (m) => {
                m.key === "Enter" && m.currentTarget.value.trim() && (i([m.currentTarget.value.trim()]), m.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ r("button", { type: "button", disabled: x, onClick: () => {
            var m;
            return (m = u.current) == null ? void 0 : m.click();
          }, "aria-label": "Upload file", title: "Upload file", className: p, children: x ? /* @__PURE__ */ r(Ne, { width: 16, height: 16 }) : /* @__PURE__ */ r(Ot, { width: 16, height: 16 }) }),
          R.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => k(!0), "aria-label": "Choose from media library", title: "Media library", className: p, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        f && R.library && /* @__PURE__ */ r(oa, { client: e, max: a ? Math.max(N, 1) : 1, initialType: ia(t.prop.field, t.prop.name), onInsert: i, onClose: () => k(!1) })
      ]
    }
  );
}
function ca({ field: e, values: t, onChange: a, client: n, onError: o, tagCount: i = 0 }) {
  const { prop: s, kind: u, required: x } = e, g = t[s.name], C = (m) => a(s.name, m), A = s.title || s.name, f = `ms-f-${s.name}`, k = g == null ? "" : String(g), N = Array.isArray(g) ? g : [], R = t[ge(s.name)] === !0, E = z(null), L = (m) => {
    const b = E.current, $ = typeof g == "string" ? g : "", O = (b == null ? void 0 : b.selectionStart) ?? $.length, w = (b == null ? void 0 : b.selectionEnd) ?? O;
    C($.slice(0, O) + m + " " + $.slice(w)), requestAnimationFrame(() => {
      b == null || b.focus(), b == null || b.setSelectionRange(O + m.length + 1, O + m.length + 1);
    });
  };
  let p;
  if (u === "textarea" || u === "json")
    p = /* @__PURE__ */ l(Ge, { children: [
      /* @__PURE__ */ r("textarea", { ref: E, id: f, rows: u === "json" ? 4 : 5, value: typeof g == "string" ? g : g ? JSON.stringify(g, null, 2) : "", onChange: (m) => C(m.target.value), className: `w-full resize-y p-3 text-sm ${u === "json" ? "font-mono text-xs" : ""}` }),
      s.name === "prompt" && i > 0 && /* @__PURE__ */ l("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (m, b) => `@image${b + 1}`).map((m) => /* @__PURE__ */ r("button", { type: "button", onClick: () => L(m), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: m }, m))
      ] })
    ] });
  else if (u === "select") {
    const m = s.enum ?? [];
    p = /* @__PURE__ */ r(
      We,
      {
        id: f,
        label: A,
        options: Wr(m),
        value: g,
        onChange: (b) => {
          C(b), a(ge(s.name), !1);
        },
        allowAuto: Ye(e),
        auto: R,
        onAuto: () => a(ge(s.name), !0)
      }
    );
  } else if (u === "boolean") {
    const m = g === !0;
    p = /* @__PURE__ */ r(
      "button",
      {
        id: f,
        type: "button",
        role: "switch",
        "aria-checked": m,
        onClick: () => C(!m),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${m ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${m ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (u === "number") {
    const m = s.minValue !== void 0 && s.maxValue !== void 0;
    p = /* @__PURE__ */ l("div", { className: `flex items-center gap-3 ${R ? "opacity-40" : ""}`, children: [
      m && /* @__PURE__ */ r("input", { type: "range", disabled: R, "aria-label": `${A} slider`, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? 0.01 : 1), value: k === "" ? s.minValue : Number(k), onChange: (b) => C(Number(b.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: f, type: "number", disabled: R, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? "any" : 1), value: k, onChange: (b) => C(b.target.value === "" ? "" : Number(b.target.value)), className: `px-3 py-2 text-sm ${m ? "w-24" : "w-full"}` })
    ] });
  } else if (u === "media")
    p = /* @__PURE__ */ r(Xe, { client: n, field: e, multiple: !1, max: 1, current: k ? [k] : [], onUrls: (m) => C(m[0]), onError: o });
  else if (u === "media-list") {
    const m = s.maxItems ?? 8;
    p = /* @__PURE__ */ l("div", { className: "space-y-2", children: [
      N.map((b, $) => /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${A} ${$ + 1}`, value: b, onChange: (O) => C(N.map((w, j) => j === $ ? O.target.value : w)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${A} ${$ + 1}`, onClick: () => C(N.filter((O, w) => w !== $)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(ke, { width: 14, height: 14 }) })
      ] }, $)),
      /* @__PURE__ */ r(Xe, { client: n, field: e, multiple: !0, max: m, current: N, onUrls: (b) => C([...N, ...b].slice(0, m)), onError: o })
    ] });
  } else
    p = /* @__PURE__ */ r("input", { id: f, value: k, onChange: (m) => C(m.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ l("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ l("label", { htmlFor: f, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        A,
        s.description && /* @__PURE__ */ r("span", { title: s.description, className: "text-muted", children: /* @__PURE__ */ r(Lr, { width: 13, height: 13 }) })
      ] }),
      Ye(e) && u === "number" ? /* @__PURE__ */ l("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: R, onChange: (m) => a(ge(s.name), m.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: u === "media-list" ? `${N.length}/${s.maxItems ?? 8} items${x ? " · required" : ""}` : x ? "* required" : "" })
    ] }),
    p
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
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Te[t] ? Te[t] : Te[a] ? Te[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? we : ga(a);
}
function ba(e) {
  const t = /* @__PURE__ */ new Map();
  for (const o of e) {
    const i = Pt(o.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [o, i] of t)
    o === we || i < da ? a += i : n.push({ id: o, label: o, count: i });
  return n.sort((o, i) => i.count - o.count || o.label.localeCompare(i.label)), a && n.push({ id: we, label: we, count: a }), n;
}
function Vt(e, t) {
  const a = Pt(e.name);
  return t.some((n) => n.id === a) ? a : we;
}
function ya(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function xa(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const xt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function va(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const o = xt.indexOf(n);
    return o < 0 ? xt.length : o;
  };
  return [...t].map(([n, o]) => ({ id: n, count: o })).sort((n, o) => a(n.id) - a(o.id) || o.count - n.count || n.id.localeCompare(o.id));
}
const he = "__favourites__", ie = "__all__";
function wa(e, t, a) {
  return e.filter((n) => {
    var o;
    return t.category !== ie && n.category !== t.category ? !1 : t.provider === he ? !!((o = t.favourites) != null && o.includes(n.name)) : t.provider === ie || Vt(n, a) === t.provider;
  });
}
const ka = (e, t) => t.filter((a) => a.id !== we).length >= ua && e.length >= ma;
function Na(e) {
  const t = va(e);
  return e.length >= fa ? t.filter((a) => a.count >= ha) : t;
}
const $e = 200;
function Sa({ model: e }) {
  const t = be(e);
  return t ? /* @__PURE__ */ l("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: se(t.original) }),
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
function Fe({ label: e, active: t, onClick: a, hue: n, children: o }) {
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
      children: o
    }
  );
}
function Aa({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: o, usage: i, showGroup: s, scope: u = "default" }) {
  var y;
  const [x, g] = I(!1), [C, A] = I(""), [f, k] = I("popular"), [N, R] = I(!1), E = z(null), L = te(() => ba(e), [e]), p = te(() => Na(e), [e]), m = ka(e, L), b = p.length >= pa, [$, O] = I(() => vt(`muapi-studio:provider:${u}`, ie)), [w, j] = I(() => vt(`muapi-studio:category:${u}`, ie)), _ = m && ($ === he || $ === ie || L.some((d) => d.id === $)) ? $ : ie, Y = b && (w === ie || p.some((d) => d.id === w)) ? w : ie, B = (d) => {
    O(d), wt(`muapi-studio:provider:${u}`, d);
  }, Z = (d) => {
    j(d), wt(`muapi-studio:category:${u}`, d);
  }, h = z(null);
  q(() => {
    x || R(!1);
  }, [x]), q(() => {
    if (!x) return;
    const d = (D) => {
      var F;
      (F = E.current) != null && F.contains(D.target) || g(!1);
    }, M = (D) => {
      D.key === "Escape" && g(!1);
    };
    return document.addEventListener("mousedown", d), document.addEventListener("keydown", M), () => {
      document.removeEventListener("mousedown", d), document.removeEventListener("keydown", M);
    };
  }, [x]);
  const P = te(() => {
    const d = C.trim().toLowerCase(), M = wa(e, { category: Y, provider: _, favourites: n }, L), D = d ? M.filter((X) => X.name.toLowerCase().includes(d) || X.category.toLowerCase().includes(d)) : M, F = Lt(D, f, { usage: i, favorites: n });
    if (f === "favourites" || f === "most-used") return F;
    const re = new Set(n);
    return [...F.filter((X) => re.has(X.name)), ...F.filter((X) => !re.has(X.name))];
  }, [e, C, f, n, i, Y, _, L]), [c, v] = I(0);
  q(() => {
    var d, M;
    v(0), (M = (d = h.current) == null ? void 0 : d.scrollTo) == null || M.call(d, { top: 0 });
  }, [C, f, x, Y, _]);
  const G = (d) => {
    d.key === "ArrowDown" ? (d.preventDefault(), v((M) => Math.min(M + 1, Math.min(P.length, $e) - 1))) : d.key === "ArrowUp" ? (d.preventDefault(), v((M) => Math.max(M - 1, 0))) : d.key === "Enter" && P[c] && (d.preventDefault(), a(P[c].name), g(!1));
  };
  return q(() => {
    var d, M;
    (M = (d = document.getElementById(`ms-opt-${c}`)) == null ? void 0 : d.scrollIntoView) == null || M.call(d, { block: "nearest" });
  }, [c]), /* @__PURE__ */ l("div", { ref: E, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        onClick: () => g((d) => !d),
        "aria-haspopup": "listbox",
        "aria-expanded": x,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (y = (t ?? "?")[0]) == null ? void 0 : y.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Re, { up: x, width: 16, height: 16 })
        ]
      }
    ),
    x && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      m && /* @__PURE__ */ l("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(Fe, { label: "All providers", active: _ === ie, onClick: () => B(ie), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(Fe, { label: "Favourites", active: _ === he, onClick: () => B(he), children: /* @__PURE__ */ r(ft, { width: 14, height: 14, filled: _ === he }) }),
        L.map((d) => /* @__PURE__ */ r(Fe, { label: `${d.label} (${d.count})`, active: _ === d.id, onClick: () => B(d.id), hue: xa(d.label), children: ya(d.label) }, d.id))
      ] }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        b && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ie, label: "All" }, ...p.map((d) => ({ id: d.id, label: d.id }))].map((d) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": Y === d.id,
            onClick: () => Z(d.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${Y === d.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: d.label
          },
          d.id
        )) }),
        /* @__PURE__ */ l("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ l("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(ot, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: G, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${c}`, value: C, onChange: (d) => A(d.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ l("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": N,
                onClick: () => R((d) => !d),
                className: `flex h-full items-center rounded-ctl border px-3 ${N ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(Gr, { width: 16, height: 16 })
              }
            ),
            N && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: pr.map((d) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ l(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": f === d.id,
                onClick: () => {
                  k(d.id), R(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${f === d.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  d.label,
                  f === d.id && /* @__PURE__ */ r(Ie, { width: 14, height: 14 })
                ]
              }
            ) }, d.id)) })
          ] })
        ] }),
        (m || b) && /* @__PURE__ */ l("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ l("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            _ === he ? "Favourites" : "All models",
            " · ",
            P.length
          ] }),
          m && _ !== ie && _ !== he && /* @__PURE__ */ r("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: _ })
        ] }),
        /* @__PURE__ */ l("ul", { id: "ms-listbox", ref: h, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          P.slice(0, $e).map((d, M) => {
            const D = d.name === t;
            return /* @__PURE__ */ r(
              "li",
              {
                id: `ms-opt-${M}`,
                role: "option",
                "aria-selected": D,
                onClick: () => {
                  a(d.name), g(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${D ? "bg-primary-soft" : M === c ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ l("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ r("div", { className: `min-w-0 flex-1 truncate text-sm ${D ? "text-primary" : ""}`, title: d.name, children: d.name }),
                    /* @__PURE__ */ r(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(d.name) ? "Remove favorite" : "Add favorite",
                        onClick: (F) => {
                          F.stopPropagation(), o(d.name);
                        },
                        className: n.includes(d.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ r(ft, { width: 15, height: 15, filled: n.includes(d.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ l("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ r("span", { className: "truncate text-[10px] text-secondary", children: s ? `${d.group_of} · ${d.category}` : m && _ === ie ? `${Vt(d, L)} · ${d.category}` : d.category }),
                    /* @__PURE__ */ r(Sa, { model: d })
                  ] })
                ] })
              },
              d.name
            );
          }),
          P.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: f === "favourites" ? "No favourites yet. Tap the heart on a model." : f === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${C}”.` }),
          P.length > $e && /* @__PURE__ */ l("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            $e,
            " of ",
            P.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const kt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
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
  const a = Je(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (a[n.prop.name] = t[n.prop.name]);
  return a;
}
function Ca(e, t) {
  const a = Qe(e, t);
  for (const n of e)
    t[n.prop.name] === void 0 && (delete a[n.prop.name], Ye(n) && (a[ge(n.prop.name)] = !0));
  return a;
}
function Ia({ mode: e, models: t, client: a, batch: n, onRun: o, usage: i, reuse: s, switcher: u }) {
  const x = ye.find((S) => S.id === e), g = te(() => mr(t, e), [t, e]), [C, A] = I(), [f, k] = I(null), [N, R] = I(null), [E, L] = I({}), [p, m] = I(null), [b, $] = I(null), [O, w] = I(() => kt("muapi-studio:favorites", [])), [j, _] = I("form"), [Y, B] = I(!1), [Z, h] = I("{}"), [P, c] = I(null), v = z(0), G = z(null), y = z(void 0), d = z(null);
  q(() => {
    if (!Y) return;
    const S = (W) => {
      var ae;
      (ae = d.current) != null && ae.contains(W.target) || B(!1);
    }, H = (W) => {
      W.key === "Escape" && B(!1);
    };
    return document.addEventListener("mousedown", S), document.addEventListener("keydown", H), () => {
      document.removeEventListener("mousedown", S), document.removeEventListener("keydown", H);
    };
  }, [Y]);
  const M = z(null), D = z(null), F = z("form");
  q(() => {
    var W, ae, me;
    const S = kt(`muapi-studio:model:${e}`, null), H = ((W = g.find((de) => de.name === S)) == null ? void 0 : W.name) ?? ((ae = g.find((de) => de.name === dr[e])) == null ? void 0 : ae.name) ?? ((me = Lt(g, "popular")[0]) == null ? void 0 : me.name);
    A(H);
  }, [e, g]), q(() => {
    if (!s) return;
    M.current = s.inputs;
    const S = D.current;
    if (S && S.name === s.model) {
      M.current = null, L(Qe(Ve(S), s.inputs)), _("form");
      return;
    }
    g.some((H) => H.name === s.model) ? (A(s.model), Be(`muapi-studio:model:${e}`, s.model)) : M.current = null, _("form");
  }, [s == null ? void 0 : s.nonce]);
  const re = g.find((S) => S.name === C);
  D.current = f, F.current = j, q(() => {
    if (!C) {
      k(null), L({}), m(null), R(null), $(null), c(null);
      return;
    }
    let S = !0;
    return k(null), R(null), m(null), $(null), c(null), a.model(C).then((H) => {
      if (!S) return;
      const W = Ve(H), ae = M.current;
      M.current = null;
      const me = Qe(W, ae);
      k(H), L(me), F.current === "json" && h(JSON.stringify(Ue(W, me), null, 2));
    }).catch((H) => {
      S && R(H.message);
    }), () => {
      S = !1;
    };
  }, [C, a]);
  const X = te(() => f ? Ve(f) : [], [f]), pe = te(() => Ue(X, E), [X, E]), oe = te(() => {
    try {
      const S = JSON.parse(Z);
      return S && typeof S == "object" && !Array.isArray(S) ? S : null;
    } catch {
      return null;
    }
  }, [Z]), le = j === "json" ? oe ?? {} : pe, ue = JSON.stringify(le);
  q(() => {
    if (!f || j === "json" && !oe) return;
    const S = ++v.current;
    G.current = null;
    const H = setTimeout(() => {
      a.estimate(f.name, le).then((W) => {
        S === v.current && (m(W), G.current = ue);
      }).catch(() => {
        S === v.current && m(null);
      });
    }, 500);
    return () => clearTimeout(H);
  }, [f, ue, a]), q(() => {
    c(null);
  }, [n, ue, j]);
  const De = (S) => {
    A(S), Be(`muapi-studio:model:${e}`, S);
  }, Me = (S) => w((H) => {
    const W = H.includes(S) ? H.filter((ae) => ae !== S) : [...H, S];
    return Be("muapi-studio:favorites", W), W;
  }), je = (S) => {
    B(!1), S !== j && (S === "json" ? h(JSON.stringify(pe, null, 2)) : oe && L(Ca(X, oe)), _(S), $(null));
  }, ee = re ? be(re, p) : null, Se = ne(async () => {
    if (!f) return;
    c(null);
    const S = X.find((H) => H.prop.name === "prompt");
    await o({
      model: f.name,
      endpointUrl: f.endpoint_url,
      mode: e,
      payload: le,
      count: n,
      kind: rt(f.category),
      prompt: S ? String(le.prompt ?? "") : "",
      unitCost: y.current ?? (ee == null ? void 0 : ee.current)
    });
  }, [f, X, o, e, le, n, ee]), U = ne(async () => {
    var ae, me;
    if (!f) return;
    if (j === "json") {
      if (!oe) {
        $("The JSON is not valid");
        return;
      }
      const de = (f.required_fields ?? []).find((lt) => oe[lt] === void 0 || oe[lt] === "");
      if (de) {
        $(`${de} is required`);
        return;
      }
    } else {
      const de = Yr(X, E);
      if (de) {
        $(de);
        return;
      }
    }
    $(null);
    let S = (ee == null ? void 0 : ee.current) ?? 0, H = !0;
    if (G.current !== ue)
      try {
        S = re ? ((ae = be(re, await a.estimate(f.name, le))) == null ? void 0 : ae.current) ?? S : S;
      } catch {
        H = !1, S = re ? ((me = be(re, null)) == null ? void 0 : me.current) ?? S : S;
      }
    y.current = S;
    const W = S * n;
    if (W > Ut || !H) {
      c(W);
      return;
    }
    await Se();
  }, [f, j, oe, X, E, ee, n, Se, ue, re, a, le]), K = !!f && !N, ce = (() => {
    var H;
    const S = X.find((W) => W.kind === "media-list");
    return S ? Math.max(((H = E[S.prop.name]) == null ? void 0 : H.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ l("section", { "aria-label": x.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ l("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: x.title }),
        /* @__PURE__ */ l("div", { ref: d, className: "relative", children: [
          /* @__PURE__ */ l("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": Y, onClick: () => B((S) => !S), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            j === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Re, { up: Y, width: 12, height: 12 })
          ] }),
          Y && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((S) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": j === S, type: "button", onClick: () => je(S), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${j === S ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: S === "json" ? "JSON" : "Form" }) }, S)) })
        ] })
      ] }),
      u,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(Aa, { models: g, value: C, onChange: De, favorites: O, onToggleFavorite: Me, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: j === "json" ? "Request body" : "Parameters" }),
      (re == null ? void 0 : re.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: re.description }),
      !K && !N && C && /* @__PURE__ */ l("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(Ne, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      N && /* @__PURE__ */ l("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        N
      ] }),
      g.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      K && j === "json" && /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !oe, spellCheck: !1, rows: 16, value: Z, onChange: (S) => h(S.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${oe ? "text-muted" : "text-danger"}`, children: oe ? `Sent as the body of POST /api/v1/${f.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      K && j === "form" && X.map((S) => /* @__PURE__ */ r(
        ca,
        {
          field: S,
          values: E,
          client: a,
          onError: $,
          tagCount: S.prop.name === "prompt" ? ce : 0,
          onChange: (H, W) => L((ae) => ({ ...ae, [H]: W }))
        },
        S.prop.name
      ))
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      b && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: b }),
      P !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: se(P) }),
        " (",
        n,
        " × ",
        se((ee == null ? void 0 : ee.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void Se(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => c(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          f && (L(Je(X)), h(JSON.stringify(Ue(X, Je(X)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ l(
          "button",
          {
            type: "button",
            onClick: () => void U(),
            disabled: !K,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(nt, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              ee && /* @__PURE__ */ l("span", { className: "font-normal", children: [
                "(",
                ee.original !== null ? /* @__PURE__ */ l(Ge, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: se(ee.original * n) }),
                  " "
                ] }) : null,
                se(ee.current * n),
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
function Ea({ mode: e, onChange: t, layout: a = "rail", onChangeKey: n }) {
  return a === "tabs" ? /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    ye.map((o) => {
      const i = o.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(o.id),
          "aria-current": i ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${i ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            o.label,
            i && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        o.id
      );
    }),
    n && /* @__PURE__ */ l("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ r(gt, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    ye.map((o) => {
      const i = Ma[o.id], s = o.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(o.id),
          "aria-current": s ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${s ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ r(i, {}),
            o.label
          ]
        },
        o.id
      );
    }),
    n && /* @__PURE__ */ l("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ r(gt, {}),
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
}, xe = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Ft(e) {
  return ((a) => a.map((n, o) => {
    var i;
    return { ...n, label: ((i = Ta[e.slug]) == null ? void 0 : i[o]) ?? n.label };
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
function At(e) {
  var n, o, i, s, u, x, g, C, A, f, k, N, R;
  const t = qt[e.template], a = {};
  for (const E of e.sliders ?? []) a[E.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (i = (o = t.aspect) == null ? void 0 : o[0]) == null ? void 0 : i.value,
    resolution: St[e.template] && ((u = (s = t.resolution) == null ? void 0 : s.find((E) => E.value === St[e.template])) == null ? void 0 : u.value) || ((g = (x = t.resolution) == null ? void 0 : x[0]) == null ? void 0 : g.value),
    duration: ((A = (C = t.duration) == null ? void 0 : C.find((E) => E.value === 5)) == null ? void 0 : A.value) ?? ((k = (f = t.duration) == null ? void 0 : f[0]) == null ? void 0 : k.value),
    quality: (R = (N = t.quality) == null ? void 0 : N[0]) == null ? void 0 : R.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Bt(e, t) {
  var o;
  const a = [e.prompt], n = (o = e.presets) == null ? void 0 : o.find((i) => i.id === t.preset);
  n != null && n.prompt && a.push(n.prompt);
  for (const i of e.sliders ?? []) {
    const s = t.sliders[i.id] ?? 0;
    if (s !== 0) {
      const u = i.phrase(s);
      u && a.push(u);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function Ct(e, t, a) {
  var i;
  const n = (i = e.presets) == null ? void 0 : i.find((s) => s.id === a), o = { ...Object.fromEntries((e.sliders ?? []).map((s) => [s.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: o };
}
function Ya(e, t) {
  for (const a of Ft(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function Ka(e, t) {
  const a = Bt(e, t), n = t.uploads;
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
], T = (e, t, a, n, o) => ({ id: e, label: t, hint: a, prompt: n, values: o }), Ze = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, J = (e, t, a, n, o, i, s = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: o, prompt: i, ...s }), V = (e, t, a, n, o, i, s = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: o, prompt: i, ...s }), _e = [
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
  J(
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
  J(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  J(
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
  J(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Qa.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
      T("morph", "Morph", void 0, "Use a morph transition."),
      T("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      T("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      T("whip", "Whip pan", void 0, "Use a fast whip pan."),
      T("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  J(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  J(
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
  J(
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
  J(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Za }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  J(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  J(
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
  J(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  J(
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
  J(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  J(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  J(
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
  J(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  J(
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
  J("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
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
  J("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  V("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  V("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  V("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  J("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  J(
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
  J("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  J("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  J("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  J("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  J("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  J("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  J(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [T("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), T("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), T("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), T("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  J("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  V("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  V("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${tn}`),
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
], Oe = (e) => zt.find((t) => t.slug === e), et = (e) => e.badge === "VIDEO" ? "video" : "image", st = (e) => zt.filter((t) => et(t) === e), tt = (e) => st(e).length > 0;
function Ht(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = Oe(t.get("app"));
  return a === "apps" ? { mode: n ? et(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === et(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function rn(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function an(e, t, a) {
  return `${e.pathname}${rn(e.search, t, a)}${e.hash}`;
}
function nn(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const on = (e) => Xa.filter((t) => st(e).some((a) => a.category === t.id));
function sn({ mode: e, value: t, onChange: a }) {
  const [n, o] = I(!1), [i, s] = I(""), [u, x] = I("all"), [g, C] = I(0), A = z(null), f = te(() => on(e), [e]), k = te(() => nn(st(e), { category: u, q: i }), [e, u, i]), N = Oe(t);
  q(() => C(0), [i, u, n]), q(() => {
    if (!n) return;
    const p = (b) => {
      var $;
      ($ = A.current) != null && $.contains(b.target) || o(!1);
    }, m = (b) => {
      b.key === "Escape" && o(!1);
    };
    return document.addEventListener("mousedown", p), document.addEventListener("keydown", m), () => {
      document.removeEventListener("mousedown", p), document.removeEventListener("keydown", m);
    };
  }, [n]), q(() => {
    var p, m;
    (m = (p = document.getElementById(`ms-app-${g}`)) == null ? void 0 : p.scrollIntoView) == null || m.call(p, { block: "nearest" });
  }, [g]);
  const R = (p) => {
    a(p), o(!1), s("");
  }, E = (p) => {
    p.key === "ArrowDown" ? (p.preventDefault(), C((m) => Math.min(m + 1, k.length - 1))) : p.key === "ArrowUp" ? (p.preventDefault(), C((m) => Math.max(m - 1, 0))) : p.key === "Enter" && k[g] && (p.preventDefault(), R(k[g].slug));
  }, L = (p) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${p ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ l("div", { ref: A, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => o((p) => !p),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (N == null ? void 0 : N.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (N == null ? void 0 : N.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Re, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ l("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(ot, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: E, value: i, onChange: (p) => s(p.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ l("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": u === "all", onClick: () => x("all"), className: L(u === "all"), children: "All" }),
        f.map((p) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": u === p.id, onClick: () => x(p.id), className: L(u === p.id), children: p.label }, p.id))
      ] }),
      /* @__PURE__ */ l("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        k.map((p, m) => /* @__PURE__ */ l(
          "li",
          {
            id: `ms-app-${m}`,
            role: "option",
            "aria-selected": p.slug === t,
            onClick: () => R(p.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${p.slug === t ? "bg-primary-soft" : m === g ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: p.emoji }),
              /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${p.slug === t ? "text-primary" : ""}`, children: p.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: p.blurb })
              ] })
            ]
          },
          p.slug
        )),
        k.length === 0 && /* @__PURE__ */ l("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          i,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const ln = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), Ae = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function cn({ mode: e, slug: t, onApp: a, switcher: n, models: o, client: i, batch: s, onRun: u }) {
  const x = Oe(t), g = ye.find((C) => C.id === e).title;
  return /* @__PURE__ */ l("section", { "aria-label": g, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: g }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(sn, { mode: e, value: t, onChange: a }) })
    ] }),
    x ? /* @__PURE__ */ r(dn, { app: x, mode: e, models: o, client: i, batch: s, onRun: u }, x.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function dn({ app: e, mode: t, models: a, client: n, batch: o, onRun: i }) {
  var Z;
  const [s, u] = I(() => At(e)), [x, g] = I(null), [C, A] = I(null), [f, k] = I(null), N = z(0), R = z(null), E = z(void 0);
  q(() => {
    u(At(e)), g(null), A(null), k(null);
  }, [e]);
  const L = Ja(e), p = a.find((h) => h.name === L), m = qt[e.template], b = te(() => Ka(e, s), [e, s]), $ = JSON.stringify(b), O = (h) => u((P) => ({ ...P, ...h }));
  q(() => {
    if (!p) return;
    const h = ++N.current;
    R.current = null;
    const P = setTimeout(() => {
      n.estimate(L, b).then((c) => {
        h === N.current && (A(c), R.current = $);
      }).catch(() => {
        h === N.current && A(null);
      });
    }, 500);
    return () => clearTimeout(P);
  }, [$, p, n]), q(() => {
    k(null);
  }, [o, $]);
  const w = p ? be(p, C) : null, j = Ft(e), _ = async () => {
    p && (k(null), await i({ model: L, endpointUrl: p.endpoint_url, mode: t, prompt: Bt(e, s) || e.name, payload: b, count: o, kind: rt(p.category), unitCost: E.current ?? (w == null ? void 0 : w.current) }));
  }, Y = async () => {
    var G, y;
    const h = Ya(e, s);
    if (h) {
      g(h);
      return;
    }
    g(null);
    let P = (w == null ? void 0 : w.current) ?? 0, c = !0;
    if (p && R.current !== $)
      try {
        P = ((G = be(p, await n.estimate(L, b))) == null ? void 0 : G.current) ?? P;
      } catch {
        c = !1, P = ((y = be(p, null)) == null ? void 0 : y.current) ?? P;
      }
    E.current = P;
    const v = P * o;
    if (v > Ut || !c) {
      k(v);
      return;
    }
    await _();
  }, B = (h, P, c, v) => P && P.length > 0 ? /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: Ae, children: h }),
    /* @__PURE__ */ r(We, { label: h, options: ln(P), value: c, onChange: v })
  ] }) : null;
  return /* @__PURE__ */ l("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !p && /* @__PURE__ */ l("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        L,
        "”, which is not in your catalog right now."
      ] }),
      j.map((h) => /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: Ae, children: [
          /* @__PURE__ */ r("span", { children: h.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: h.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          Xe,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: s.uploads[h.id] ? [s.uploads[h.id]] : [],
            field: { prop: { name: `${h.kind}_${h.id}`, title: h.label, field: h.kind }, kind: "media", required: !h.optional },
            onUrls: (P) => u((c) => ({ ...c, uploads: { ...c.uploads, [h.id]: P[0] ?? "" } })),
            onError: g
          }
        )
      ] }, h.id)),
      e.presets && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: Ae, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(We, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((h) => ({ value: h.id, label: h.label, hint: h.hint }))], value: s.preset, onChange: (h) => u(Ct(e, s, String(h))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (Z = e.sliders) == null ? void 0 : Z.map((h) => /* @__PURE__ */ l("div", { className: "mb-4", children: [
        /* @__PURE__ */ l("div", { className: Ae, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${h.id}`, children: h.label }),
          /* @__PURE__ */ l("span", { className: "tabular-nums text-primary", children: [
            s.sliders[h.id] ?? 0,
            h.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${h.id}`, type: "range", min: h.min, max: h.max, step: h.step, value: s.sliders[h.id] ?? 0, className: "w-full", onChange: (P) => O({ sliders: { ...s.sliders, [h.id]: Number(P.target.value) } }) })
      ] }, h.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => u(Ct(e, s, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: Ae, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: s.refinement, onChange: (h) => O({ refinement: h.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      B("Aspect Ratio", m.aspect, s.aspect, (h) => O({ aspect: h })),
      B(e.template === "seedream" ? "Output Resolution" : "Resolution", m.resolution, s.resolution, (h) => O({ resolution: h })),
      B("Quality Level", m.quality, s.quality, (h) => O({ quality: String(h) })),
      B("Duration", m.duration, s.duration, (h) => O({ duration: Number(h) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && B("Target Face Index", Ua, s.targetIndex, (h) => O({ targetIndex: Number(h) })),
      e.template === "video-face-swap" && B("Target Gender Filter", qa, s.gender, (h) => O({ gender: String(h) })),
      e.template === "bg-remover" && /* @__PURE__ */ l(Ge, { children: [
        B("Background Color", Fa, s.background, (h) => O({ background: String(h) })),
        B("Output Container & Codec", Ba, s.container, (h) => O({ container: String(h) })),
        /* @__PURE__ */ l("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": s.keepAudio, onClick: () => O({ keepAudio: !s.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${s.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${s.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      x && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: x }),
      f !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: se(f) }),
        " (",
        o,
        " × ",
        se((w == null ? void 0 : w.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void _(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => k(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !p, onClick: () => void Y(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(nt, { width: 16, height: 16, className: "shrink-0" }),
        Wa(e),
        o > 1 ? ` ×${o}` : "",
        w && w.current > 0 && /* @__PURE__ */ l("span", { className: "font-normal", children: [
          "(",
          se(w.current * o),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function It({ view: e, onChange: t }) {
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
function un() {
  try {
    const e = window.location.search, t = Ht(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return ur(a) ? a : null;
  } catch {
    return null;
  }
}
const Ce = {
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
    const a = Ht(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = Ce.get(`muapi-studio:app:${e}`);
  return { view: Ce.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Oe(t) ? t : null };
}
function mn({ scope: e, apiBase: t = "/api/muapi", initialTab: a = "image", showHeader: n = !0, title: o = "Studio", teamId: i, theme: s = "lime", layout: u, apiKey: x, onRequestApiKey: g, getHeaders: C, connected: A, fetchImpl: f, features: k, className: N = "", onTabChange: R }) {
  const E = A === !1 || x === "" || x === null, L = z(C);
  L.current = C;
  const [p, m] = I(!1), b = te(() => new tr(t, i, { apiKey: x || void 0, getHeaders: () => {
    var U;
    return ((U = L.current) == null ? void 0 : U.call(L)) ?? {};
  }, fetchImpl: f, onKeyRejected: () => m(!0) }), [t, i, x, f]);
  q(() => m(!1), [b]);
  const [$, O] = I({ library: !0, deleteMedia: !0 }), w = te(() => ({ library: $.library && (k == null ? void 0 : k.library) !== !1, deleteMedia: (k == null ? void 0 : k.deleteMedia) !== !1 }), [$, k == null ? void 0 : k.library, k == null ? void 0 : k.deleteMedia]), j = u ?? lr(s), [_, Y] = I(() => un() ?? a), [B, Z] = I(4), [h, P] = I(null), [c, v] = I(null), [G, y] = I(null), d = ne(() => {
    b.balance().then(y).catch(() => y(null));
  }, [b]), [M, D] = I(null), F = Nr(b, h, d, e, !E), re = te(() => yr(F.items), [F.items]);
  q(() => {
    E || (v(null), P(null), b.models().then(P).catch((U) => v(U.message)), d(), (k == null ? void 0 : k.library) !== !1 && b.probe().then(O));
  }, [b, d, E, k == null ? void 0 : k.library]);
  const [X, pe] = I(() => Mt(_)), oe = (U, K) => {
    try {
      window.history.replaceState(null, "", an(window.location, U, K));
    } catch {
    }
  }, le = (U) => {
    const K = Mt(U);
    Y(U), pe(K), R == null || R(U), oe(U, K.view === "apps" ? K.app : null);
  }, ue = (U) => {
    pe((K) => ({ ...K, view: U })), Ce.set(`muapi-studio:view:${_}`, U), oe(_, U === "apps" ? X.app : null);
  }, De = (U) => {
    pe({ view: "apps", app: U }), Ce.set(`muapi-studio:app:${_}`, U), Ce.set(`muapi-studio:view:${_}`, "apps"), oe(_, U);
  }, Me = ne(async (U) => {
    await F.run(U);
  }, [F.run]), je = ne((U) => {
    var ce;
    const K = h == null ? void 0 : h.find((S) => S.name === U);
    return K ? ((ce = K.sale) == null ? void 0 : ce.from) ?? K.cost ?? void 0 : void 0;
  }, [h]), ee = ne((U) => {
    Y(U.mode), pe((K) => ({ ...K, view: "models" })), D({ model: U.model, inputs: U.inputs, nonce: Date.now() });
  }, []), Se = ne(async (U) => {
    var W;
    const K = h == null ? void 0 : h.find((ae) => ae.name === U.model);
    if (!K) return;
    let ce = ((W = K.sale) == null ? void 0 : W.from) ?? K.cost ?? 0, S = !1;
    try {
      ce = (await b.estimate(U.model, U.inputs)).cost, S = !0;
    } catch {
    }
    const H = S ? "" : " (the exact price could not be checked)";
    (ce > 0.25 || !S) && !window.confirm(`Re-run ${U.model} for about $${ce.toFixed(2)}?${H}`) || F.run({ model: U.model, endpointUrl: K.endpoint_url, mode: U.mode, prompt: U.prompt, payload: U.inputs, count: 1, unitCost: ce, kind: rt(K.category) });
  }, [h, F.run, b]);
  return /* @__PURE__ */ l("div", { className: `ms-root ${N}`.trim(), style: sr(s), "data-layout": j, "data-btn": cr(s), children: [
    n && /* @__PURE__ */ l("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: o }),
      G && /* @__PURE__ */ l("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: se(G.balance) })
      ] })
    ] }),
    E ? /* @__PURE__ */ l("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      g && /* @__PURE__ */ r("button", { type: "button", onClick: g, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ l(Tt.Provider, { value: w, children: [
      p && /* @__PURE__ */ l("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        g && /* @__PURE__ */ r("button", { type: "button", onClick: g, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ l("div", { className: `flex min-h-0 flex-1 flex-col ${j === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(Ea, { mode: _, onChange: le, layout: j, onChangeKey: g }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: c ? /* @__PURE__ */ l("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          c
        ] }) : h ? /* @__PURE__ */ l(Ge, { children: [
          X.view === "apps" && tt(_) ? /* @__PURE__ */ r(cn, { mode: _, slug: X.app, onApp: De, switcher: /* @__PURE__ */ r(It, { view: "apps", onChange: ue }), models: h, client: b, batch: B, onRun: Me }) : /* @__PURE__ */ r(Ia, { mode: _, models: h, client: b, batch: B, onRun: Me, usage: re, reuse: M, switcher: tt(_) ? /* @__PURE__ */ r(It, { view: "models", onChange: ue }) : void 0 }),
          /* @__PURE__ */ r(Br, { mode: _, items: F.items, batch: B, onBatch: Z, onLabel: F.setLabel, onRemove: F.remove, onReuse: ee, onRerun: Se, onDeleteMedia: F.deleteMedia, onLoadMore: F.loadMore, hasMore: F.hasMore, loadingMore: F.loadingMore, serverError: F.serverError, estimateFor: je })
        ] }) : /* @__PURE__ */ l("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(Ne, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function fn(e) {
  const t = e.accountId ?? vr(e.apiKey);
  return /* @__PURE__ */ r(mn, { scope: t, ...e }, t);
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
