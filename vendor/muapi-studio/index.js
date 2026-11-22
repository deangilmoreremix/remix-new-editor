import { jsx as r, jsxs as s, Fragment as Me } from "react/jsx-runtime";
import { createContext as qt, useContext as Ft, useState as S, useRef as K, useEffect as U, useCallback as re, useMemo as ee, createElement as Bt, useId as zt, useLayoutEffect as Ht } from "react";
function Jt(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
class ue extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function St(e) {
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
function Yt(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Kt {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    var m, k;
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [y, I] of Object.entries(await this.opts.getHeaders())) n.set(y, I);
    const i = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), l = await i.text();
    let o = null;
    try {
      o = l ? JSON.parse(l) : null;
    } catch {
    }
    if (!i.ok && Jt(i.status, o, l) && !t.startsWith("/app/") && ((k = (m = this.opts).onKeyRejected) == null || k.call(m)), !i.ok) throw new ue(Yt(o, `${i.status} ${i.statusText}`), i.status);
    if (o === null && l.trim()) throw new ue("Unexpected non-JSON response from the server", 502);
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
    if (!l) throw new ue("The API did not return a request id", 502);
    return { requestId: l, cost: (o = i.cost) == null ? void 0 : o.amount_usd };
  }
  async poll(t) {
    var o;
    const a = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), n = String(a.status || "").toLowerCase(), i = ["completed", "succeeded"].includes(n) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(n) ? "failed" : n === "pending" ? "pending" : "processing", l = Array.isArray(a.outputs) ? a.outputs : a.url ? [a.url] : [];
    return { status: i, outputs: l, error: St(a.error), cost: (o = a.cost) == null ? void 0 : o.amount_usd };
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
    const t = (n) => n instanceof ue && [403, 404, 405].includes(n.status);
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
    if (!i) throw new ue("Upload returned no URL", 502);
    return i;
  }
}
async function rt(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: i = 15 * 60 * 1e3, signal: l, onUpdate: o } = a, m = Date.now();
  let k = 0;
  for (; Date.now() - m < i; ) {
    if (l != null && l.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const y = await e.poll(t);
      if (k = 0, o == null || o(y), y.status === "completed" || y.status === "failed") return y;
    } catch (y) {
      if (++k >= 5) throw y;
    }
    await new Promise((y) => setTimeout(y, n));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Ct = qt({ library: !0, deleteMedia: !0 }), At = () => Ft(Ct), Ve = {
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
}, Wt = {
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
}, Xt = { lime: Ve, cyan: Wt }, at = {
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
function It(e = "lime") {
  return typeof e == "string" ? Xt[e] ?? Ve : { ...Ve, ...e };
}
function Qt(e = "lime") {
  const t = It(e), a = {};
  for (const n of Object.keys(at)) a[at[n]] = t[n];
  return a;
}
function Zt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const er = (e = "lime") => It(e).buttonStyle, ie = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], tr = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Ke(e) {
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
const rr = (e) => !!e && ie.some((t) => t.id === e);
function ar(e, t) {
  const a = ie.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const nr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Mt(e, t, a = {}) {
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
const or = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function ir(e, t) {
  var n, i;
  const a = (n = t.find((l) => l.name === e)) == null ? void 0 : n.group_of;
  return ((i = ie.find((l) => a && l.groups.includes(a))) == null ? void 0 : i.id) ?? "ai-tools";
}
function sr(e, t, a = {}) {
  var l;
  const n = e.output ?? {}, i = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: ir(e.model, t),
    prompt: typeof i.prompt == "string" ? i.prompt : "",
    inputs: i,
    status: or[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: St(n.error),
    cost: (l = n.cost) == null ? void 0 : l.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function lr(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((m) => m.requestId).map((m) => [m.requestId, m])), i = new Set(e.map((m) => m.requestId).filter(Boolean));
  return [...e.map((m) => {
    const k = m.requestId ? n.get(m.requestId) : void 0;
    return m.status === "failed" && k && k.status === "completed" && k.outputs.length ? { ...m, status: k.status, outputs: k.outputs, error: void 0, cost: m.cost ?? k.cost } : m;
  }), ...t.filter((m) => !m.requestId || !i.has(m.requestId))].filter((m) => !(m.requestId && a.has(m.requestId))).sort((m, k) => k.createdAt - m.createdAt);
}
function cr(e) {
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
function We(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const $t = "muapi-studio:history:v1", dr = 200, me = (e, t) => t ? `${e}:${t}` : e;
function ur(e) {
  if (!e) return "";
  let t = 2166136261, a = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, a = Math.imul(a ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${a.toString(36)}`;
}
function Re(e = "") {
  try {
    const t = localStorage.getItem(me($t, e));
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function mr(e, t = "") {
  try {
    localStorage.setItem(me($t, t), JSON.stringify(e.slice(0, dr)));
  } catch {
  }
}
const pr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, nt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, ot = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, it = "muapi-studio:labels:v1", st = "muapi-studio:hidden:v1";
function hr(e, t, a, n = "") {
  const [i, l] = S(() => Re(n)), [o, m] = S([]), [k, y] = S(null), [I, A] = S(!1), [x, N] = S(null), C = K(!1), [O, T] = S(() => nt(me(it, n), {})), [R, v] = S(() => nt(me(st, n), [])), p = K(/* @__PURE__ */ new Set()), g = K(new AbortController()), M = K([]);
  M.current = t ?? [], U(() => mr(i, n), [i, n]), U(() => ot(me(it, n), O), [O, n]), U(() => ot(me(st, n), R), [R, n]), U(() => (g.current = new AbortController(), () => g.current.abort()), []);
  const D = re((d, w) => l((G) => G.map((c) => c.id === d ? { ...c, ...w } : c)), []), $ = re(async (d, w) => {
    if (!p.current.has(d)) {
      p.current.add(d);
      try {
        const G = await rt(e, w, {
          signal: g.current.signal,
          onUpdate: (c) => D(d, { status: c.status, outputs: c.outputs, error: c.error, cost: c.cost })
        });
        D(d, { status: G.status, outputs: G.outputs, error: G.error, cost: G.cost }), a == null || a();
      } catch (G) {
        G.name !== "AbortError" && D(d, { status: "failed", error: G.message });
      } finally {
        p.current.delete(d);
      }
    }
  }, [e, D, a]), V = re(async (d) => {
    if (!d.requestId || p.current.has(d.id)) return;
    p.current.add(d.id);
    const w = (G) => m((c) => c.map((P) => P.id === d.id ? { ...P, status: G.status, outputs: G.outputs, error: G.error, cost: G.cost ?? P.cost } : P));
    try {
      const G = await rt(e, d.requestId, { signal: g.current.signal, onUpdate: w });
      w(G), a == null || a();
    } catch {
    } finally {
      p.current.delete(d.id);
    }
  }, [e, a]);
  U(() => {
    const d = new Set(Re(n).map((w) => w.requestId));
    for (const w of o) (w.status === "pending" || w.status === "processing") && w.requestId && !d.has(w.requestId) && V(w);
  }, [o, n, V]), U(() => {
    for (const d of Re(n)) (d.status === "pending" || d.status === "processing") && d.requestId && $(d.id, d.requestId);
  }, []);
  const E = re(async (d = !1) => {
    if (!C.current) {
      A(!0), N(null);
      try {
        const w = await e.history(d ? void 0 : k ?? void 0), G = w.items.map((c) => sr(c, M.current));
        m((c) => d ? G : [...c, ...G]), y(w.next_cursor);
      } catch (w) {
        w instanceof ue && [403, 404, 405].includes(w.status) ? (C.current = !0, y(null)) : N(w.message);
      } finally {
        A(!1);
      }
    }
  }, [e, k]), J = K(!1);
  U(() => {
    t && !J.current && (J.current = !0, E(!0));
  }, [t, E]);
  const b = re((d) => {
    const w = Array.from({ length: d.count }, () => ({
      id: pr(),
      model: d.model,
      mode: d.mode,
      prompt: d.prompt,
      inputs: d.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: d.unitCost,
      source: "local"
    }));
    return l((G) => [...w, ...G]), Promise.all(w.map(async (G) => {
      try {
        const { requestId: c, cost: P } = await e.submit(d.endpointUrl, d.payload, d.kind);
        D(G.id, { requestId: c, ...P !== void 0 ? { cost: P } : {} }), await $(G.id, c);
      } catch (c) {
        D(G.id, { status: "failed", error: c.message });
      }
    }));
  }, [e, D, $]), q = ee(() => {
    const d = (w) => ({ ...w, label: w.requestId && O[w.requestId] || w.label });
    return lr(i.map(d), o.map(d), new Set(R));
  }, [i, o, O, R]), B = re((d, w) => {
    d.requestId && T((G) => {
      const c = { ...G };
      return w ? c[d.requestId] = w : delete c[d.requestId], c;
    }), D(d.id, { label: w });
  }, [D]), f = re((d) => {
    l((w) => w.filter((G) => G.id !== d.id)), d.requestId && v((w) => [.../* @__PURE__ */ new Set([...w, d.requestId])]);
  }, []), u = re(async (d) => {
    d.requestId && (await e.deleteMedia(d.requestId), D(d.id, { outputs: [] }), m((w) => w.map((G) => G.requestId === d.requestId ? { ...G, outputs: [] } : G)));
  }, [e, D]);
  return { items: q, run: b, setLabel: B, remove: f, deleteMedia: u, loadMore: () => E(!1), hasMore: !!k, loadingMore: I, serverError: x };
}
const fr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Et(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : fr.test(e) ? "file" : "image" : "text";
}
function gr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const br = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), W = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Ie = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), yr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), xr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), vr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), Xe = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), wr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Qe = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), lt = ({ filled: e, ...t }) => /* @__PURE__ */ r(W, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Ze = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), $e = ({ up: e, ...t }) => /* @__PURE__ */ r(W, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), kr = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), Nr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), Ue = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ve = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), fe = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), Tt = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), Sr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), ge = (e) => /* @__PURE__ */ r(W, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Cr = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Ar = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Ir = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), ct = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function _t({ url: e }) {
  return /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Xe, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let dt = null;
const Mr = () => dt ?? (dt = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw dt = null, e;
}));
function $r({ url: e, hidden: t = !1 }) {
  const [a, n] = S("loading"), i = K(null);
  return U(() => {
    let l = !0;
    return n("loading"), Mr().catch(() => l && n("failed")), () => {
      l = !1;
    };
  }, [e]), U(() => {
    const l = i.current;
    if (!l) return;
    const o = () => n("ready"), m = () => n("failed");
    return l.addEventListener("load", o), l.addEventListener("error", m), () => {
      l.removeEventListener("load", o), l.removeEventListener("error", m);
    };
  }), a === "failed" ? /* @__PURE__ */ r(_t, { url: e }) : /* @__PURE__ */ s("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    Bt("model-viewer", {
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
      /* @__PURE__ */ r(ge, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(Xe, { width: 14, height: 14 }) })
  ] });
}
const Er = ["All", "Approved", "Rejected", "Unlabeled"], Tr = [1, 2, 4, 6, 8];
function _r({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, i = Et(e);
  return i === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: gr(e) }) : i === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : i === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : i === "3d" ? br(e) ? /* @__PURE__ */ r($r, { url: e, hidden: t }) : /* @__PURE__ */ r(_t, { url: e }) : i === "file" ? /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Ue, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function Gr({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: i, onRerun: l, onDeleteMedia: o, onOpen: m, estimateFor: k }) {
  const [y, I] = S(0), A = e.outputs.length, x = Math.min(y, Math.max(A - 1, 0)), N = e.outputs[x], C = !!N && Et(N) === "text", [O, T] = S(!1), [R, v] = S(null), p = At(), g = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", M = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ s("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && N ? /* @__PURE__ */ s("div", { className: "relative", children: [
      /* @__PURE__ */ r(_r, { url: N, hidden: t, onOpen: () => m(N) }),
      A > 1 && /* @__PURE__ */ s("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Previous output", disabled: x === 0, onClick: () => I(x - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ s("span", { "aria-live": "polite", children: [
          x + 1,
          " / ",
          A
        ] }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Next output", disabled: x === A - 1, onClick: () => I(x + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ s("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(fe, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ s("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(ge, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ s("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ s("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ne(e.cost) : e.status === "completed" && (k == null ? void 0 : k(e.model)) !== void 0 ? `est. ${ne(k(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && N && (C ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(N)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Ue, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: N, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Ue, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${M} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ r(ve, { width: 14, height: 14 })
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
            children: /* @__PURE__ */ r(fe, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Load this model and settings back into the form", className: g, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => l(e), title: "Generate again with the same settings", className: g, children: "Re-run" }),
        e.status === "completed" && N && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var D;
          (D = navigator.clipboard) == null || D.writeText(N).then(() => {
            T(!0), setTimeout(() => T(!1), 1500);
          });
        }, className: g, children: O ? "Copied" : C ? "Copy text" : "Copy link" })
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
          p.deleteMedia && e.requestId && e.status === "completed" && N && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (v(null), o(e).catch((D) => v(D.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Lr({ url: e, onClose: t }) {
  return U(() => {
    const a = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ s("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(fe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Rr({ mode: e, items: t, batch: a, onBatch: n, onLabel: i, onRemove: l, onReuse: o, onRerun: m, onDeleteMedia: k, onLoadMore: y, hasMore: I, loadingMore: A, serverError: x, estimateFor: N }) {
  const [C, O] = S("All"), [T, R] = S(""), [v, p] = S(!1), [g, M] = S(null), D = ee(() => {
    const $ = T.trim().toLowerCase();
    return t.filter((V) => V.mode !== e || C === "Approved" && V.label !== "approved" || C === "Rejected" && V.label !== "rejected" || C === "Unlabeled" && V.label !== null ? !1 : !$ || V.prompt.toLowerCase().includes($) || V.model.toLowerCase().includes($));
  }, [t, e, C, T]);
  return /* @__PURE__ */ s("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Er.map(($) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": C === $,
          onClick: () => O($),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${C === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ s("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(Ze, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: T, onChange: ($) => R($.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Tr.map(($) => /* @__PURE__ */ r(
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
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": v, "aria-label": v ? "Show previews" : "Hide previews", title: v ? "Show previews" : "Hide previews", onClick: () => p(($) => !$), className: v ? "text-primary" : "text-secondary hover:text-fg", children: v ? /* @__PURE__ */ r(kr, { width: 18, height: 18 }) : /* @__PURE__ */ r(Nr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      D.length === 0 ? /* @__PURE__ */ s("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Qe, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some(($) => $.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some(($) => $.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: D.map(($) => /* @__PURE__ */ r(Gr, { g: $, hidden: v, onLabel: i, onRemove: l, onReuse: o, onRerun: m, onDeleteMedia: k, onOpen: M, estimateFor: N }, $.id)) }),
      x && /* @__PURE__ */ s("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        x
      ] }),
      I && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: A, onClick: y, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: A ? "Loading…" : "Load more history" }) }),
      g && /* @__PURE__ */ r(Lr, { url: g, onClose: () => M(null) })
    ] })
  ] });
}
const Or = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Dr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function jr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Or.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Dr.test(e.name) ? "media" : "text" : "text";
}
function Oe(e) {
  var o, m;
  const t = (m = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : m.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), i = [...n.filter((k) => a[k]), ...Object.keys(a).filter((k) => !n.includes(k))], l = new Set(e.required_fields ?? []);
  return i.map((k) => ({ prop: { ...a[k], name: k }, kind: jr({ ...a[k], name: k }), required: l.has(k) }));
}
function qe(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: i, required: l } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : l && (i === "textarea" || i === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const pe = (e) => `__auto:${e}`, ut = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Fe = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function mt(e, t) {
  const a = {};
  for (const { prop: n, kind: i } of e) {
    if (t[pe(n.name)] === !0) continue;
    const l = t[n.name] ?? n.default;
    if (!Fe(l))
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
function Pr(e, t) {
  for (const { prop: a, kind: n, required: i } of e) {
    if (t[pe(a.name)] === !0) continue;
    const l = t[a.name] ?? a.default, o = a.title || a.name;
    if (i && Fe(l)) return `${o} is required`;
    if (n === "json" && typeof l == "string" && l)
      try {
        JSON.parse(l);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !Fe(l)) {
      const m = Number(l);
      if (!Number.isFinite(m)) return `${o} must be a number`;
      if (a.minValue !== void 0 && m < a.minValue) return `${o} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && m > a.maxValue) return `${o} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const Vr = 12, et = 240, Ne = (e) => `${typeof e}:${e}`, Ur = (e) => e.map((t) => ({ value: t, label: String(t) }));
function qr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Fr(e, t, a = et) {
  return e >= a || e >= t ? "down" : "up";
}
const Br = 36, zr = 48;
function Hr(e, t) {
  return Math.min(et, Math.max(1, e) * Br + 8) + (t ? zr : 0);
}
function Jr(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const pt = "Auto (let model decide)", De = "__auto__";
function Be({ id: e, label: t, options: a, value: n, onChange: i, allowAuto: l, auto: o, onAuto: m, combobox: k }) {
  const y = zt(), I = e ?? `ms-dd-${y}`, A = k ?? a.length > Vr, [x, N] = S(!1), [C, O] = S(""), [T, R] = S(0), [v, p] = S("down"), g = K(null), M = K(null), D = K(null), $ = a.find((u) => n !== void 0 && Ne(u.value) === Ne(n)), V = ee(() => A ? qr(a, C) : a, [A, a, C]), E = ee(
    () => [...l ? [{ key: De, label: pt, value: De, isAuto: !0 }] : [], ...V.map((u) => ({ key: Ne(u.value), label: u.label, hint: u.hint, value: u.value }))],
    [l, V]
  ), J = o ? De : $ ? Ne($.value) : void 0, b = () => {
    N(!1), O("");
  }, q = (u) => {
    u.isAuto ? m == null || m() : i(u.value), b();
  };
  Ht(() => {
    if (!x || !g.current) return;
    const u = g.current.getBoundingClientRect();
    let d = g.current.parentElement;
    for (; d && !/(auto|scroll)/.test(getComputedStyle(d).overflowY); ) d = d.parentElement;
    const w = d ? d.getBoundingClientRect() : null, G = Math.min(window.innerHeight, w ? w.bottom : window.innerHeight), c = Math.max(0, w ? w.top : 0);
    p(Fr(G - u.bottom, u.top - c, Hr(a.length + (l ? 1 : 0), A)));
  }, [x]), U(() => {
    if (!x) return;
    const u = E.findIndex((d) => d.key === J);
    R(u >= 0 ? u : 0);
  }, [x, C]), U(() => {
    var u, d, w;
    x && ((w = (d = (u = M.current) == null ? void 0 : u.querySelector(`[data-i="${T}"]`)) == null ? void 0 : d.scrollIntoView) == null || w.call(d, { block: "nearest" }));
  }, [T, x]), U(() => {
    var u;
    x && A && ((u = D.current) == null || u.focus());
  }, [x, A]), U(() => {
    if (!x) return;
    const u = (d) => {
      var w;
      (w = g.current) != null && w.contains(d.target) || b();
    };
    return document.addEventListener("mousedown", u), () => document.removeEventListener("mousedown", u);
  }, [x]);
  const B = (u) => {
    if (!x) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(u.key) && (u.preventDefault(), N(!0));
      return;
    }
    if (u.key === "Escape") {
      u.preventDefault(), u.stopPropagation(), b();
      return;
    }
    if (u.key === "Enter") {
      u.preventDefault(), E[T] && q(E[T]);
      return;
    }
    if (u.key === "Tab") {
      b();
      return;
    }
    if (u.key === " " && !A) {
      u.preventDefault(), E[T] && q(E[T]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(u.key) && (u.preventDefault(), R((d) => Jr(d, u.key, E.length)));
  }, f = o ? pt : ($ == null ? void 0 : $.label) ?? "Select…";
  return /* @__PURE__ */ s("div", { ref: g, className: "relative w-full", onKeyDown: B, children: [
    /* @__PURE__ */ s(
      "button",
      {
        id: I,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": x,
        "aria-label": `${t}: ${f}`,
        "aria-controls": `${I}-list`,
        onClick: () => N((u) => !u),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${x ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: f }),
          /* @__PURE__ */ r($e, { up: x, width: 16, height: 16 })
        ]
      }
    ),
    x && /* @__PURE__ */ s("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${v === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      A && /* @__PURE__ */ r(
        "input",
        {
          ref: D,
          value: C,
          onChange: (u) => O(u.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${I}-list`,
          "aria-activedescendant": E[T] ? `${I}-o${T}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ s("ul", { id: `${I}-list`, ref: M, role: "listbox", "aria-label": t, style: { maxHeight: et }, className: "overflow-y-auto", children: [
        E.map((u, d) => {
          const w = u.key === J;
          return /* @__PURE__ */ s(
            "li",
            {
              id: `${I}-o${d}`,
              "data-i": d,
              role: "option",
              "aria-selected": w,
              onMouseEnter: () => R(d),
              onClick: () => q(u),
              className: `flex cursor-pointer items-center justify-between gap-2 ${u.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${w ? "bg-primary text-primary-ink" : d === T ? "bg-card-bg" : ""} ${u.isAuto && !w ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ s("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: u.label }),
                  u.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${w ? "opacity-70" : "text-muted"}`, children: u.hint })
                ] }),
                w && /* @__PURE__ */ r(ve, { width: 14, height: 14 })
              ]
            },
            u.key
          );
        }),
        E.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Yr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Kr({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Ie, {}) });
}
function Wr({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: i }) {
  const [l, o] = S(a), [m, k] = S(""), [y, I] = S(1), [A, x] = S(null), [N, C] = S(null), [O, T] = S(!1), [R, v] = S([]), [p, g] = S(""), [M, D] = S(!1), $ = K(null), V = K(null), E = re(async () => {
    T(!0), C(null);
    try {
      x(await e.mediaLibrary({ mediaType: l, search: m, page: y }));
    } catch (f) {
      C(f.message);
    } finally {
      T(!1);
    }
  }, [e, l, m, y]);
  U(() => {
    const f = setTimeout(E, m ? 300 : 0);
    return () => clearTimeout(f);
  }, [E, m]), U(() => {
    I(1);
  }, [l, m]), U(() => {
    var d;
    const f = document.activeElement;
    (d = $.current) == null || d.focus();
    const u = (w) => {
      if (w.key === "Escape") {
        w.stopPropagation(), i();
        return;
      }
      if (w.key !== "Tab" || !$.current) return;
      const G = [...$.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!G.length) return;
      const c = G[0], P = G[G.length - 1];
      w.shiftKey && document.activeElement === c ? (w.preventDefault(), P.focus()) : !w.shiftKey && document.activeElement === P && (w.preventDefault(), c.focus());
    };
    return document.addEventListener("keydown", u), () => {
      var w;
      document.removeEventListener("keydown", u), (w = f == null ? void 0 : f.focus) == null || w.call(f);
    };
  }, [i]);
  const J = (f) => v((u) => u.includes(f) ? u.filter((d) => d !== f) : t === 1 ? [f] : u.length < t ? [...u, f] : u), b = async (f) => {
    if (f.length) {
      T(!0), C(null);
      try {
        for (const u of f) {
          const d = await e.upload(u);
          await e.saveToLibrary({ url: d, name: u.name, mime_type: u.type || void 0, size_bytes: u.size, media_type: u.type.startsWith("video") ? "video" : u.type.startsWith("audio") ? "audio" : u.type.startsWith("image") ? "image" : "archive" });
        }
        await E();
      } catch (u) {
        C(u.message), T(!1);
      }
    }
  }, q = async () => {
    var u;
    const f = p.trim();
    if (!/^https?:\/\//i.test(f)) {
      C("Enter a full http(s) URL");
      return;
    }
    T(!0), C(null);
    try {
      const d = ((u = f.split("?")[0].split(".").pop()) == null ? void 0 : u.toLowerCase()) ?? "", w = ["mp4", "webm", "mov"].includes(d) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(d) ? "audio" : ["zip", "rar", "7z"].includes(d) ? "archive" : "image";
      await e.saveToLibrary({ url: f, name: f.split("/").pop() || "link", media_type: w }), g(""), D(!1), await E();
    } catch (d) {
      C(d.message), T(!1);
    }
  }, B = async (f) => {
    if (window.confirm(`Delete "${f.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(f.id), v((u) => u.filter((d) => d !== f.url)), await E();
      } catch (u) {
        C(u.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (f) => {
    f.target === f.currentTarget && i();
  }, children: /* @__PURE__ */ s("div", { ref: $, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ s("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Ie, {}) }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ s("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ s("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
            (A == null ? void 0 : A.total) ?? 0,
            " ",
            (A == null ? void 0 : A.total) === 1 ? "item" : "items"
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
      /* @__PURE__ */ r("input", { ref: V, type: "file", hidden: !0, multiple: !0, onChange: (f) => {
        const u = Array.from(f.target.files ?? []);
        f.target.value = "", b(u);
      } }),
      /* @__PURE__ */ s("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var f;
        return (f = V.current) == null ? void 0 : f.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ r(Tt, { width: 14, height: 14 }),
        /* @__PURE__ */ r("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: i, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(fe, {}) })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Yr.map((f) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": l === f.id, onClick: () => o(f.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${l === f.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: f.label }, f.id)) }),
      /* @__PURE__ */ r("input", { value: m, onChange: (f) => k(f.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": M, onClick: () => D((f) => !f), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    M && /* @__PURE__ */ s("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: p, onChange: (f) => g(f.target.value), onKeyDown: (f) => f.key === "Enter" && void q(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void q(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      N && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: N }),
      O && !A ? /* @__PURE__ */ s("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(ge, {}),
        " Loading…"
      ] }) : A != null && A.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: A.items.map((f) => {
        const u = R.includes(f.url);
        return /* @__PURE__ */ s("li", { className: `group relative overflow-hidden rounded-card border ${u ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": u, "aria-label": `${u ? "Deselect" : "Select"} ${f.name ?? "file"}`, onClick: () => J(f.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Kr, { a: f }) }),
          u && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(ve, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${f.name ?? "file"}`, onClick: () => void B(f), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(fe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: f.name ?? "", children: f.name })
        ] }, f.id);
      }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ie, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      A && A.total_pages > 1 && /* @__PURE__ */ s("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: y <= 1, onClick: () => I((f) => f - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        y,
        " of ",
        A.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: y >= A.total_pages, onClick: () => I((f) => f + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ s("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ s("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: R.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !R.length, onClick: () => {
        n(R), i();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(ve, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const Gt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Xr = (e, t = "") => {
  const a = Gt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Qr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function Zr(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, i) => void e.saveToLibrary({ url: a[i], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: Qr(n) }).catch(() => {
  })), a;
}
function ze({ client: e, field: t, multiple: a, max: n, current: i, onUrls: l, onError: o }) {
  const m = K(null), [k, y] = S(!1), [I, A] = S(!1), [x, N] = S(!1), C = n - i.length, O = At(), T = async (p) => {
    if (p.length) {
      y(!0);
      try {
        l(await Zr(e, a ? p.slice(0, Math.max(C, 1)) : p.slice(0, 1)));
      } catch (g) {
        o(g.message);
      } finally {
        y(!1);
      }
    }
  }, R = Gt(t.prop.field, t.prop.name), v = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ s(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), A(!0);
      },
      onDragLeave: () => A(!1),
      onDrop: (p) => {
        p.preventDefault(), A(!1), T(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${I ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: m, type: "file", hidden: !0, accept: R, multiple: a, onChange: (p) => {
          const g = Array.from(p.target.files ?? []);
          p.target.value = "", T(g);
        } }),
        (a ? C > 0 : !0) && /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
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
          }, "aria-label": "Upload file", title: "Upload file", className: v, children: k ? /* @__PURE__ */ r(ge, { width: 16, height: 16 }) : /* @__PURE__ */ r(Tt, { width: 16, height: 16 }) }),
          O.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => N(!0), "aria-label": "Choose from media library", title: "Media library", className: v, children: /* @__PURE__ */ s("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        x && O.library && /* @__PURE__ */ r(Wr, { client: e, max: a ? Math.max(C, 1) : 1, initialType: Xr(t.prop.field, t.prop.name), onInsert: l, onClose: () => N(!1) })
      ]
    }
  );
}
function ea({ field: e, values: t, onChange: a, client: n, onError: i, tagCount: l = 0 }) {
  const { prop: o, kind: m, required: k } = e, y = t[o.name], I = (p) => a(o.name, p), A = o.title || o.name, x = `ms-f-${o.name}`, N = y == null ? "" : String(y), C = Array.isArray(y) ? y : [], O = t[pe(o.name)] === !0, T = K(null), R = (p) => {
    const g = T.current, M = typeof y == "string" ? y : "", D = (g == null ? void 0 : g.selectionStart) ?? M.length, $ = (g == null ? void 0 : g.selectionEnd) ?? D;
    I(M.slice(0, D) + p + " " + M.slice($)), requestAnimationFrame(() => {
      g == null || g.focus(), g == null || g.setSelectionRange(D + p.length + 1, D + p.length + 1);
    });
  };
  let v;
  if (m === "textarea" || m === "json")
    v = /* @__PURE__ */ s(Me, { children: [
      /* @__PURE__ */ r("textarea", { ref: T, id: x, rows: m === "json" ? 4 : 5, value: typeof y == "string" ? y : y ? JSON.stringify(y, null, 2) : "", onChange: (p) => I(p.target.value), className: `w-full resize-y p-3 text-sm ${m === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && l > 0 && /* @__PURE__ */ s("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(l, 9) }, (p, g) => `@image${g + 1}`).map((p) => /* @__PURE__ */ r("button", { type: "button", onClick: () => R(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (m === "select") {
    const p = o.enum ?? [];
    v = /* @__PURE__ */ r(
      Be,
      {
        id: x,
        label: A,
        options: Ur(p),
        value: y,
        onChange: (g) => {
          I(g), a(pe(o.name), !1);
        },
        allowAuto: ut(e),
        auto: O,
        onAuto: () => a(pe(o.name), !0)
      }
    );
  } else if (m === "boolean") {
    const p = y === !0;
    v = /* @__PURE__ */ r(
      "button",
      {
        id: x,
        type: "button",
        role: "switch",
        "aria-checked": p,
        onClick: () => I(!p),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${p ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${p ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (m === "number") {
    const p = o.minValue !== void 0 && o.maxValue !== void 0;
    v = /* @__PURE__ */ s("div", { className: `flex items-center gap-3 ${O ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ r("input", { type: "range", disabled: O, "aria-label": `${A} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: N === "" ? o.minValue : Number(N), onChange: (g) => I(Number(g.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: x, type: "number", disabled: O, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: N, onChange: (g) => I(g.target.value === "" ? "" : Number(g.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (m === "media")
    v = /* @__PURE__ */ r(ze, { client: n, field: e, multiple: !1, max: 1, current: N ? [N] : [], onUrls: (p) => I(p[0]), onError: i });
  else if (m === "media-list") {
    const p = o.maxItems ?? 8;
    v = /* @__PURE__ */ s("div", { className: "space-y-2", children: [
      C.map((g, M) => /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${A} ${M + 1}`, value: g, onChange: (D) => I(C.map(($, V) => V === M ? D.target.value : $)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${A} ${M + 1}`, onClick: () => I(C.filter((D, $) => $ !== M)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(fe, { width: 14, height: 14 }) })
      ] }, M)),
      /* @__PURE__ */ r(ze, { client: n, field: e, multiple: !0, max: p, current: C, onUrls: (g) => I([...C, ...g].slice(0, p)), onError: i })
    ] });
  } else
    v = /* @__PURE__ */ r("input", { id: x, value: N, onChange: (p) => I(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ s("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ s("label", { htmlFor: x, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        A,
        o.description && /* @__PURE__ */ r("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ r(Sr, { width: 13, height: 13 }) })
      ] }),
      ut(e) && m === "number" ? /* @__PURE__ */ s("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: O, onChange: (p) => a(pe(o.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: m === "media-list" ? `${C.length}/${o.maxItems ?? 8} items${k ? " · required" : ""}` : k ? "* required" : "" })
    ] }),
    v
  ] });
}
const Se = {
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
}, he = "Other", ta = 3, ra = 2, aa = 20, na = 2, oa = 4, ia = 40, sa = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Lt(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Se[t] ? Se[t] : Se[a] ? Se[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? he : sa(a);
}
function la(e) {
  const t = /* @__PURE__ */ new Map();
  for (const i of e) {
    const l = Lt(i.name);
    t.set(l, (t.get(l) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [i, l] of t)
    i === he || l < ta ? a += l : n.push({ id: i, label: i, count: l });
  return n.sort((i, l) => l.count - i.count || i.label.localeCompare(l.label)), a && n.push({ id: he, label: he, count: a }), n;
}
function Rt(e, t) {
  const a = Lt(e.name);
  return t.some((n) => n.id === a) ? a : he;
}
function ca(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function da(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const ht = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function ua(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const i = ht.indexOf(n);
    return i < 0 ? ht.length : i;
  };
  return [...t].map(([n, i]) => ({ id: n, count: i })).sort((n, i) => a(n.id) - a(i.id) || i.count - n.count || n.id.localeCompare(i.id));
}
const oe = "__favourites__", ae = "__all__";
function ma(e, t, a) {
  return e.filter((n) => {
    var i;
    return t.category !== ae && n.category !== t.category ? !1 : t.provider === oe ? !!((i = t.favourites) != null && i.includes(n.name)) : t.provider === ae || Rt(n, a) === t.provider;
  });
}
const pa = (e, t) => t.filter((a) => a.id !== he).length >= ra && e.length >= aa;
function ha(e) {
  const t = ua(e);
  return e.length >= ia ? t.filter((a) => a.count >= oa) : t;
}
const Ce = 200;
function fa({ model: e }) {
  const t = We(e);
  return t ? /* @__PURE__ */ s("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ne(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ne(t.current)
  ] }) : null;
}
const ft = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, gt = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function je({ label: e, active: t, onClick: a, hue: n, children: i }) {
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
function ga({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: i, usage: l, showGroup: o, scope: m = "default" }) {
  var G;
  const [k, y] = S(!1), [I, A] = S(""), [x, N] = S("popular"), [C, O] = S(!1), T = K(null), R = ee(() => la(e), [e]), v = ee(() => ha(e), [e]), p = pa(e, R), g = v.length >= na, [M, D] = S(() => ft(`muapi-studio:provider:${m}`, ae)), [$, V] = S(() => ft(`muapi-studio:category:${m}`, ae)), E = p && (M === oe || M === ae || R.some((c) => c.id === M)) ? M : ae, J = g && ($ === ae || v.some((c) => c.id === $)) ? $ : ae, b = (c) => {
    D(c), gt(`muapi-studio:provider:${m}`, c);
  }, q = (c) => {
    V(c), gt(`muapi-studio:category:${m}`, c);
  }, B = K(null);
  U(() => {
    k || O(!1);
  }, [k]), U(() => {
    if (!k) return;
    const c = (Y) => {
      var H;
      (H = T.current) != null && H.contains(Y.target) || y(!1);
    }, P = (Y) => {
      Y.key === "Escape" && y(!1);
    };
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", P), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", P);
    };
  }, [k]);
  const f = ee(() => {
    const c = I.trim().toLowerCase(), P = ma(e, { category: J, provider: E, favourites: n }, R), Y = c ? P.filter((te) => te.name.toLowerCase().includes(c) || te.category.toLowerCase().includes(c)) : P, H = Mt(Y, x, { usage: l, favorites: n });
    if (x === "favourites" || x === "most-used") return H;
    const Q = new Set(n);
    return [...H.filter((te) => Q.has(te.name)), ...H.filter((te) => !Q.has(te.name))];
  }, [e, I, x, n, l, J, E, R]), [u, d] = S(0);
  U(() => {
    var c, P;
    d(0), (P = (c = B.current) == null ? void 0 : c.scrollTo) == null || P.call(c, { top: 0 });
  }, [I, x, k, J, E]);
  const w = (c) => {
    c.key === "ArrowDown" ? (c.preventDefault(), d((P) => Math.min(P + 1, Math.min(f.length, Ce) - 1))) : c.key === "ArrowUp" ? (c.preventDefault(), d((P) => Math.max(P - 1, 0))) : c.key === "Enter" && f[u] && (c.preventDefault(), a(f[u].name), y(!1));
  };
  return U(() => {
    var c, P;
    (P = (c = document.getElementById(`ms-opt-${u}`)) == null ? void 0 : c.scrollIntoView) == null || P.call(c, { block: "nearest" });
  }, [u]), /* @__PURE__ */ s("div", { ref: T, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => y((c) => !c),
        "aria-haspopup": "listbox",
        "aria-expanded": k,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (G = (t ?? "?")[0]) == null ? void 0 : G.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r($e, { up: k, width: 16, height: 16 })
        ]
      }
    ),
    k && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ s("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(je, { label: "All providers", active: E === ae, onClick: () => b(ae), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(je, { label: "Favourites", active: E === oe, onClick: () => b(oe), children: /* @__PURE__ */ r(lt, { width: 14, height: 14, filled: E === oe }) }),
        R.map((c) => /* @__PURE__ */ r(je, { label: `${c.label} (${c.count})`, active: E === c.id, onClick: () => b(c.id), hue: da(c.label), children: ca(c.label) }, c.id))
      ] }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        g && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ae, label: "All" }, ...v.map((c) => ({ id: c.id, label: c.id }))].map((c) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": J === c.id,
            onClick: () => q(c.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${J === c.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: c.label
          },
          c.id
        )) }),
        /* @__PURE__ */ s("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ s("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(Ze, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: w, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${u}`, value: I, onChange: (c) => A(c.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ s("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": C,
                onClick: () => O((c) => !c),
                className: `flex h-full items-center rounded-ctl border px-3 ${C ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(Cr, { width: 16, height: 16 })
              }
            ),
            C && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: nr.map((c) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ s(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": x === c.id,
                onClick: () => {
                  N(c.id), O(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${x === c.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  c.label,
                  x === c.id && /* @__PURE__ */ r(ve, { width: 14, height: 14 })
                ]
              }
            ) }, c.id)) })
          ] })
        ] }),
        (p || g) && /* @__PURE__ */ s("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ s("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            E === oe ? "Favourites" : "All models",
            " · ",
            f.length
          ] }),
          p && E !== ae && E !== oe && /* @__PURE__ */ r("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: E })
        ] }),
        /* @__PURE__ */ s("ul", { id: "ms-listbox", ref: B, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          f.slice(0, Ce).map((c, P) => {
            const Y = c.name === t;
            return /* @__PURE__ */ r(
              "li",
              {
                id: `ms-opt-${P}`,
                role: "option",
                "aria-selected": Y,
                onClick: () => {
                  a(c.name), y(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${Y ? "bg-primary-soft" : P === u ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ r("div", { className: `min-w-0 flex-1 truncate text-sm ${Y ? "text-primary" : ""}`, title: c.name, children: c.name }),
                    /* @__PURE__ */ r(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(c.name) ? "Remove favorite" : "Add favorite",
                        onClick: (H) => {
                          H.stopPropagation(), i(c.name);
                        },
                        className: n.includes(c.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ r(lt, { width: 15, height: 15, filled: n.includes(c.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ s("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ r("span", { className: "truncate text-[10px] text-secondary", children: o ? `${c.group_of} · ${c.category}` : p && E === ae ? `${Rt(c, R)} · ${c.category}` : c.category }),
                    /* @__PURE__ */ r(fa, { model: c })
                  ] })
                ] })
              },
              c.name
            );
          }),
          f.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: x === "favourites" ? "No favourites yet. Tap the heart on a model." : x === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${I}”.` }),
          f.length > Ce && /* @__PURE__ */ s("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ce,
            " of ",
            f.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const bt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, Pe = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, Ot = 0.25;
function yt(e, t) {
  const a = qe(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (a[n.prop.name] = t[n.prop.name]);
  return a;
}
function ba({ mode: e, models: t, client: a, batch: n, onRun: i, usage: l, reuse: o, switcher: m }) {
  const k = ie.find((h) => h.id === e), y = ee(() => ar(t, e), [t, e]), [I, A] = S(), [x, N] = S(null), [C, O] = S(null), [T, R] = S({}), [v, p] = S(null), [g, M] = S(null), [D, $] = S(() => bt("muapi-studio:favorites", [])), [V, E] = S("form"), [J, b] = S(!1), [q, B] = S("{}"), [f, u] = S(null), d = K(0), w = K(null);
  U(() => {
    if (!J) return;
    const h = (F) => {
      var X;
      (X = w.current) != null && X.contains(F.target) || b(!1);
    }, L = (F) => {
      F.key === "Escape" && b(!1);
    };
    return document.addEventListener("mousedown", h), document.addEventListener("keydown", L), () => {
      document.removeEventListener("mousedown", h), document.removeEventListener("keydown", L);
    };
  }, [J]);
  const G = K(null), c = K(null);
  U(() => {
    var F, X, ke;
    const h = bt(`muapi-studio:model:${e}`, null), L = ((F = y.find((Le) => Le.name === h)) == null ? void 0 : F.name) ?? ((X = y.find((Le) => Le.name === tr[e])) == null ? void 0 : X.name) ?? ((ke = Mt(y, "popular")[0]) == null ? void 0 : ke.name);
    A(L);
  }, [e, y]), U(() => {
    if (!o) return;
    G.current = o.inputs;
    const h = c.current;
    if (h && h.name === o.model) {
      G.current = null, R(yt(Oe(h), o.inputs)), E("form");
      return;
    }
    y.some((L) => L.name === o.model) ? (A(o.model), Pe(`muapi-studio:model:${e}`, o.model)) : G.current = null, E("form");
  }, [o == null ? void 0 : o.nonce]);
  const P = y.find((h) => h.name === I);
  c.current = x, U(() => {
    if (!I) return;
    let h = !0;
    return N(null), O(null), p(null), M(null), u(null), a.model(I).then((L) => {
      if (!h) return;
      const F = Oe(L), X = G.current;
      G.current = null, N(L), R(yt(F, X));
    }).catch((L) => {
      h && O(L.message);
    }), () => {
      h = !1;
    };
  }, [I, a]);
  const Y = ee(() => x ? Oe(x) : [], [x]), H = ee(() => mt(Y, T), [Y, T]), Q = ee(() => {
    try {
      const h = JSON.parse(q);
      return h && typeof h == "object" && !Array.isArray(h) ? h : null;
    } catch {
      return null;
    }
  }, [q]), te = V === "json" ? Q ?? {} : H, se = JSON.stringify(te);
  U(() => {
    if (!x || V === "json" && !Q) return;
    const h = ++d.current, L = setTimeout(() => {
      a.estimate(x.name, te).then((F) => {
        h === d.current && p(F);
      }).catch(() => {
        h === d.current && p(null);
      });
    }, 500);
    return () => clearTimeout(L);
  }, [x, se, a]);
  const be = (h) => {
    A(h), Pe(`muapi-studio:model:${e}`, h);
  }, Te = (h) => $((L) => {
    const F = L.includes(h) ? L.filter((X) => X !== h) : [...L, h];
    return Pe("muapi-studio:favorites", F), F;
  }), we = (h) => {
    b(!1), h !== V && (h === "json" ? B(JSON.stringify(H, null, 2)) : Q && R((L) => {
      const F = { ...L };
      for (const X of Y) Q[X.prop.name] !== void 0 && (F[X.prop.name] = Q[X.prop.name]);
      return F;
    }), E(h), M(null));
  }, Z = P ? We(P, v) : null, le = re(async () => {
    if (!x) return;
    u(null);
    const h = Y.find((L) => L.prop.name === "prompt");
    await i({
      model: x.name,
      endpointUrl: x.endpoint_url,
      mode: e,
      payload: te,
      count: n,
      kind: Ke(x.category),
      prompt: h ? String(te.prompt ?? "") : "",
      unitCost: Z == null ? void 0 : Z.current
    });
  }, [x, Y, i, e, te, n, Z]), _e = re(async () => {
    if (!x) return;
    if (V === "json") {
      if (!Q) {
        M("The JSON is not valid");
        return;
      }
      const L = (x.required_fields ?? []).find((F) => Q[F] === void 0 || Q[F] === "");
      if (L) {
        M(`${L} is required`);
        return;
      }
    } else {
      const L = Pr(Y, T);
      if (L) {
        M(L);
        return;
      }
    }
    M(null);
    const h = ((Z == null ? void 0 : Z.current) ?? 0) * n;
    if (h > Ot) {
      u(h);
      return;
    }
    await le();
  }, [x, V, Q, Y, T, Z, n, le]), ce = !!x && !C, Ge = (() => {
    var L;
    const h = Y.find((F) => F.kind === "media-list");
    return h ? Math.max(((L = T[h.prop.name]) == null ? void 0 : L.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ s("section", { "aria-label": k.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ s("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: k.title }),
        /* @__PURE__ */ s("div", { ref: w, className: "relative", children: [
          /* @__PURE__ */ s("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": J, onClick: () => b((h) => !h), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            V === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r($e, { up: J, width: 12, height: 12 })
          ] }),
          J && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((h) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": V === h, type: "button", onClick: () => we(h), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${V === h ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: h === "json" ? "JSON" : "Form" }) }, h)) })
        ] })
      ] }),
      m,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(ga, { models: y, value: I, onChange: be, favorites: D, onToggleFavorite: Te, usage: l, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: V === "json" ? "Request body" : "Parameters" }),
      (P == null ? void 0 : P.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: P.description }),
      !ce && !C && I && /* @__PURE__ */ s("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(ge, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      C && /* @__PURE__ */ s("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        C
      ] }),
      y.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      ce && V === "json" && /* @__PURE__ */ s("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !Q, spellCheck: !1, rows: 16, value: q, onChange: (h) => B(h.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${Q ? "text-muted" : "text-danger"}`, children: Q ? `Sent as the body of POST /api/v1/${x.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      ce && V === "form" && Y.map((h) => /* @__PURE__ */ r(
        ea,
        {
          field: h,
          values: T,
          client: a,
          onError: M,
          tagCount: h.prop.name === "prompt" ? Ge : 0,
          onChange: (L, F) => R((X) => ({ ...X, [L]: F }))
        },
        h.prop.name
      ))
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      g && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: g }),
      f !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(f) }),
        " (",
        n,
        " × ",
        ne((Z == null ? void 0 : Z.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void le(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => u(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          x && (R(qe(Y)), B(JSON.stringify(mt(Y, qe(Y)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ s(
          "button",
          {
            type: "button",
            onClick: () => void _e(),
            disabled: !ce,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(Qe, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              Z && /* @__PURE__ */ s("span", { className: "font-normal", children: [
                "(",
                Z.original !== null ? /* @__PURE__ */ s(Me, { children: [
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
const ya = {
  image: Ie,
  video: yr,
  audio: xr,
  avatar: vr,
  "3d": Xe,
  "ai-tools": wr,
  text: Ar,
  more: Ir
};
function xa({ mode: e, onChange: t, layout: a = "rail", onChangeKey: n }) {
  return a === "tabs" ? /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    ie.map((i) => {
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
      /* @__PURE__ */ r(ct, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    ie.map((i) => {
      const l = ya[i.id], o = i.id === e;
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
      /* @__PURE__ */ r(ct, {}),
      "Key"
    ] })
  ] });
}
const va = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, xt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, wa = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], ka = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], Na = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], Sa = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), Ca = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], Aa = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), Ia = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], Ma = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], $a = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], Ea = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], Ta = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), _a = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Ga = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), La = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Dt = {
  seedream: { aspect: wa, resolution: ka },
  seedance: { aspect: Na, duration: Sa },
  minimax: { resolution: Ca, duration: Aa },
  wan: { aspect: Ia, resolution: Ma, quality: $a, duration: Ea },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, Ra = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, de = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function jt(e) {
  return ((a) => a.map((n, i) => {
    var l;
    return { ...n, label: ((l = va[e.slug]) == null ? void 0 : l[i]) ?? n.label };
  }))(Oa(e));
}
function Oa(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [de("base", "Target base image"), de("face", "New face image")];
    case "video-face-swap":
      return [de("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [de("start", "Starting frame image"), de("end", "Ending frame image", !0)];
    default:
      return [de("source", "Source image")];
  }
}
function Da(e) {
  return Ra[e.template];
}
function vt(e) {
  var n, i, l, o, m, k, y, I, A, x, N;
  const t = Dt[e.template], a = {};
  for (const C of e.sliders ?? []) a[C.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (l = (i = t.aspect) == null ? void 0 : i[0]) == null ? void 0 : l.value,
    resolution: (m = (o = t.resolution) == null ? void 0 : o[0]) == null ? void 0 : m.value,
    duration: ((y = (k = t.duration) == null ? void 0 : k.find((C) => C.value === 5)) == null ? void 0 : y.value) ?? ((A = (I = t.duration) == null ? void 0 : I[0]) == null ? void 0 : A.value),
    quality: (N = (x = t.quality) == null ? void 0 : x[0]) == null ? void 0 : N.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Pt(e, t) {
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
function wt(e, t, a) {
  var l;
  const n = (l = e.presets) == null ? void 0 : l.find((o) => o.id === a), i = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: i };
}
function ja(e, t) {
  for (const a of jt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function Pa(e, t) {
  const a = Pt(e, t), n = t.uploads;
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
function Va(e) {
  return xt[e.slug] ? xt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Ua = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], _ = (e, t, a, n, i) => ({ id: e, label: t, hint: a, prompt: n, values: i }), He = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, z = (e, t, a, n, i, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: i, prompt: l, ...o }), j = (e, t, a, n, i, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: i, prompt: l, ...o }), Ae = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${He(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${He(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], qa = [Ae[2], { ...Ae[1], id: "vertical", label: "Vertical angle" }, Ae[0]].map((e) => ({ ...e, id: e.id })), Fa = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${He(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Ba = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], za = "Keep the result tasteful and suitable for general audiences.", Vt = [
  // ---- Professional
  z(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Ae, presets: [
      _("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      _("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      _("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      _("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      _("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      _("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      _("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  z(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  z(
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
  z(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: qa.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
  z(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  z(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: Ba, presets: [
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
  z(
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
  z(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Fa }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  z(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  z(
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
  z(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  z(
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
  z(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  z(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  z(
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
  z(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  z(
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
  z("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
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
  z("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  j("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  j("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  j("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  z("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  z(
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
  z("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  z("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  z("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  z("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  z("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  z("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  z(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [_("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), _("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), _("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), _("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  z("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  j("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  j("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${za}`),
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
], Ee = (e) => Vt.find((t) => t.slug === e), Je = (e) => e.badge === "VIDEO" ? "video" : "image", tt = (e) => Vt.filter((t) => Je(t) === e), Ye = (e) => tt(e).length > 0;
function Ut(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = Ee(t.get("app"));
  return a === "apps" ? { mode: n ? Je(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === Je(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function Ha(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function Ja(e, t, a) {
  return `${e.pathname}${Ha(e.search, t, a)}${e.hash}`;
}
function Ya(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const Ka = (e) => Ua.filter((t) => tt(e).some((a) => a.category === t.id));
function Wa({ mode: e, value: t, onChange: a }) {
  const [n, i] = S(!1), [l, o] = S(""), [m, k] = S("all"), [y, I] = S(0), A = K(null), x = ee(() => Ka(e), [e]), N = ee(() => Ya(tt(e), { category: m, q: l }), [e, m, l]), C = Ee(t);
  U(() => I(0), [l, m, n]), U(() => {
    if (!n) return;
    const v = (g) => {
      var M;
      (M = A.current) != null && M.contains(g.target) || i(!1);
    }, p = (g) => {
      g.key === "Escape" && i(!1);
    };
    return document.addEventListener("mousedown", v), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", v), document.removeEventListener("keydown", p);
    };
  }, [n]), U(() => {
    var v, p;
    (p = (v = document.getElementById(`ms-app-${y}`)) == null ? void 0 : v.scrollIntoView) == null || p.call(v, { block: "nearest" });
  }, [y]);
  const O = (v) => {
    a(v), i(!1), o("");
  }, T = (v) => {
    v.key === "ArrowDown" ? (v.preventDefault(), I((p) => Math.min(p + 1, N.length - 1))) : v.key === "ArrowUp" ? (v.preventDefault(), I((p) => Math.max(p - 1, 0))) : v.key === "Enter" && N[y] && (v.preventDefault(), O(N[y].slug));
  }, R = (v) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${v ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ s("div", { ref: A, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => i((v) => !v),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (C == null ? void 0 : C.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (C == null ? void 0 : C.name) ?? "Choose an app" }),
          /* @__PURE__ */ r($e, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ s("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(Ze, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: T, value: l, onChange: (v) => o(v.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ s("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === "all", onClick: () => k("all"), className: R(m === "all"), children: "All" }),
        x.map((v) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === v.id, onClick: () => k(v.id), className: R(m === v.id), children: v.label }, v.id))
      ] }),
      /* @__PURE__ */ s("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        N.map((v, p) => /* @__PURE__ */ s(
          "li",
          {
            id: `ms-app-${p}`,
            role: "option",
            "aria-selected": v.slug === t,
            onClick: () => O(v.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${v.slug === t ? "bg-primary-soft" : p === y ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: v.emoji }),
              /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${v.slug === t ? "text-primary" : ""}`, children: v.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: v.blurb })
              ] })
            ]
          },
          v.slug
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
const Xa = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), ye = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function Qa({ mode: e, slug: t, onApp: a, switcher: n, models: i, client: l, batch: o, onRun: m }) {
  const k = Ee(t), y = ie.find((I) => I.id === e).title;
  return /* @__PURE__ */ s("section", { "aria-label": y, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: y }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(Wa, { mode: e, value: t, onChange: a }) })
    ] }),
    k ? /* @__PURE__ */ r(Za, { app: k, mode: e, models: i, client: l, batch: o, onRun: m }, k.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Za({ app: e, mode: t, models: a, client: n, batch: i, onRun: l }) {
  var J;
  const [o, m] = S(() => vt(e)), [k, y] = S(null), [I, A] = S(null), [x, N] = S(null), C = K(0);
  U(() => {
    m(vt(e)), y(null), A(null), N(null);
  }, [e]);
  const O = Da(e), T = a.find((b) => b.name === O), R = Dt[e.template], v = ee(() => Pa(e, o), [e, o]), p = JSON.stringify(v), g = (b) => m((q) => ({ ...q, ...b }));
  U(() => {
    if (!T) return;
    const b = ++C.current, q = setTimeout(() => {
      n.estimate(O, v).then((B) => {
        b === C.current && A(B);
      }).catch(() => {
        b === C.current && A(null);
      });
    }, 500);
    return () => clearTimeout(q);
  }, [p, T, n]);
  const M = T ? We(T, I) : null, D = jt(e), $ = async () => {
    T && (N(null), await l({ model: O, endpointUrl: T.endpoint_url, mode: t, prompt: Pt(e, o) || e.name, payload: v, count: i, kind: Ke(T.category), unitCost: M == null ? void 0 : M.current }));
  }, V = async () => {
    const b = ja(e, o);
    if (b) {
      y(b);
      return;
    }
    y(null);
    const q = ((M == null ? void 0 : M.current) ?? 0) * i;
    if (q > Ot) {
      N(q);
      return;
    }
    await $();
  }, E = (b, q, B, f) => q && q.length > 0 ? /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: ye, children: b }),
    /* @__PURE__ */ r(Be, { label: b, options: Xa(q), value: B, onChange: f })
  ] }) : null;
  return /* @__PURE__ */ s("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !T && /* @__PURE__ */ s("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        O,
        "”, which is not in your catalog right now."
      ] }),
      D.map((b) => /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: ye, children: [
          /* @__PURE__ */ r("span", { children: b.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: b.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          ze,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: o.uploads[b.id] ? [o.uploads[b.id]] : [],
            field: { prop: { name: `${b.kind}_${b.id}`, title: b.label, field: b.kind }, kind: "media", required: !b.optional },
            onUrls: (q) => g({ uploads: { ...o.uploads, [b.id]: q[0] ?? "" } }),
            onError: y
          }
        )
      ] }, b.id)),
      e.presets && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: ye, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(Be, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((b) => ({ value: b.id, label: b.label, hint: b.hint }))], value: o.preset, onChange: (b) => m(wt(e, o, String(b))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (J = e.sliders) == null ? void 0 : J.map((b) => /* @__PURE__ */ s("div", { className: "mb-4", children: [
        /* @__PURE__ */ s("div", { className: ye, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${b.id}`, children: b.label }),
          /* @__PURE__ */ s("span", { className: "tabular-nums text-primary", children: [
            o.sliders[b.id] ?? 0,
            b.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${b.id}`, type: "range", min: b.min, max: b.max, step: b.step, value: o.sliders[b.id] ?? 0, className: "w-full", onChange: (q) => g({ sliders: { ...o.sliders, [b.id]: Number(q.target.value) } }) })
      ] }, b.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => m(wt(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: ye, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: o.refinement, onChange: (b) => g({ refinement: b.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      E("Aspect Ratio", R.aspect, o.aspect, (b) => g({ aspect: b })),
      E(e.template === "seedream" ? "Output Resolution" : "Resolution", R.resolution, o.resolution, (b) => g({ resolution: b })),
      E("Quality Level", R.quality, o.quality, (b) => g({ quality: String(b) })),
      E("Duration", R.duration, o.duration, (b) => g({ duration: Number(b) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && E("Target Face Index", Ta, o.targetIndex, (b) => g({ targetIndex: Number(b) })),
      e.template === "video-face-swap" && E("Target Gender Filter", _a, o.gender, (b) => g({ gender: String(b) })),
      e.template === "bg-remover" && /* @__PURE__ */ s(Me, { children: [
        E("Background Color", Ga, o.background, (b) => g({ background: String(b) })),
        E("Output Container & Codec", La, o.container, (b) => g({ container: String(b) })),
        /* @__PURE__ */ s("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": o.keepAudio, onClick: () => g({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      k && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: k }),
      x !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(x) }),
        " (",
        i,
        " × ",
        ne((M == null ? void 0 : M.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void $(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => N(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !T, onClick: () => void V(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(Qe, { width: 16, height: 16, className: "shrink-0" }),
        Va(e),
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
function kt({ view: e, onChange: t }) {
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
function en() {
  try {
    const e = window.location.search, t = Ut(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return rr(a) ? a : null;
  } catch {
    return null;
  }
}
const xe = {
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
function Nt(e) {
  if (!Ye(e)) return { view: "models", app: null };
  try {
    const a = Ut(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = xe.get(`muapi-studio:app:${e}`);
  return { view: xe.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Ee(t) ? t : null };
}
function tn({ scope: e, apiBase: t = "/api/muapi", initialTab: a = "image", showHeader: n = !0, title: i = "Studio", teamId: l, theme: o = "lime", layout: m, apiKey: k, onRequestApiKey: y, getHeaders: I, connected: A, fetchImpl: x, features: N, className: C = "", onTabChange: O }) {
  const T = A === !1 || k === "" || k === null, R = K(I);
  R.current = I;
  const [v, p] = S(!1), g = ee(() => new Kt(t, l, { apiKey: k || void 0, getHeaders: () => {
    var h;
    return ((h = R.current) == null ? void 0 : h.call(R)) ?? {};
  }, fetchImpl: x, onKeyRejected: () => p(!0) }), [t, l, k, x]);
  U(() => p(!1), [g]);
  const [M, D] = S({ library: !0, deleteMedia: !0 }), $ = ee(() => ({ library: M.library && (N == null ? void 0 : N.library) !== !1, deleteMedia: (N == null ? void 0 : N.deleteMedia) !== !1 }), [M, N == null ? void 0 : N.library, N == null ? void 0 : N.deleteMedia]), V = m ?? Zt(o), [E, J] = S(() => en() ?? a), [b, q] = S(4), [B, f] = S(null), [u, d] = S(null), [w, G] = S(null), c = re(() => {
    g.balance().then(G).catch(() => G(null));
  }, [g]), [P, Y] = S(null), H = hr(g, B, c, e), Q = ee(() => cr(H.items), [H.items]);
  U(() => {
    T || (d(null), f(null), g.models().then(f).catch((h) => d(h.message)), c(), (N == null ? void 0 : N.library) !== !1 && g.probe().then(D));
  }, [g, c, T, N == null ? void 0 : N.library]);
  const [te, se] = S(() => Nt(E)), be = (h, L) => {
    try {
      window.history.replaceState(null, "", Ja(window.location, h, L));
    } catch {
    }
  }, Te = (h) => {
    const L = Nt(h);
    J(h), se(L), O == null || O(h), be(h, L.view === "apps" ? L.app : null);
  }, we = (h) => {
    se((L) => ({ ...L, view: h })), xe.set(`muapi-studio:view:${E}`, h), be(E, h === "apps" ? te.app : null);
  }, Z = (h) => {
    se({ view: "apps", app: h }), xe.set(`muapi-studio:app:${E}`, h), xe.set(`muapi-studio:view:${E}`, "apps"), be(E, h);
  }, le = re(async (h) => {
    await H.run(h);
  }, [H.run]), _e = re((h) => {
    var F;
    const L = B == null ? void 0 : B.find((X) => X.name === h);
    return L ? ((F = L.sale) == null ? void 0 : F.from) ?? L.cost ?? void 0 : void 0;
  }, [B]), ce = re((h) => {
    J(h.mode), se((L) => ({ ...L, view: "models" })), Y({ model: h.model, inputs: h.inputs, nonce: Date.now() });
  }, []), Ge = re((h) => {
    var X;
    const L = B == null ? void 0 : B.find((ke) => ke.name === h.model);
    if (!L) return;
    const F = ((X = L.sale) == null ? void 0 : X.from) ?? L.cost ?? 0;
    F > 0.25 && !window.confirm(`Re-run ${h.model} for about $${F.toFixed(2)}?`) || H.run({ model: h.model, endpointUrl: L.endpoint_url, mode: h.mode, prompt: h.prompt, payload: h.inputs, count: 1, unitCost: F, kind: Ke(L.category) });
  }, [B, H.run]);
  return /* @__PURE__ */ s("div", { className: `ms-root ${C}`.trim(), style: Qt(o), "data-layout": V, "data-btn": er(o), children: [
    n && /* @__PURE__ */ s("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: i }),
      w && /* @__PURE__ */ s("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(w.balance) })
      ] })
    ] }),
    T ? /* @__PURE__ */ s("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      y && /* @__PURE__ */ r("button", { type: "button", onClick: y, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ s(Ct.Provider, { value: $, children: [
      v && /* @__PURE__ */ s("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        y && /* @__PURE__ */ r("button", { type: "button", onClick: y, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ s("div", { className: `flex min-h-0 flex-1 flex-col ${V === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(xa, { mode: E, onChange: Te, layout: V, onChangeKey: y }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: u ? /* @__PURE__ */ s("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          u
        ] }) : B ? /* @__PURE__ */ s(Me, { children: [
          te.view === "apps" && Ye(E) ? /* @__PURE__ */ r(Qa, { mode: E, slug: te.app, onApp: Z, switcher: /* @__PURE__ */ r(kt, { view: "apps", onChange: we }), models: B, client: g, batch: b, onRun: le }) : /* @__PURE__ */ r(ba, { mode: E, models: B, client: g, batch: b, onRun: le, usage: Q, reuse: P, switcher: Ye(E) ? /* @__PURE__ */ r(kt, { view: "models", onChange: we }) : void 0 }),
          /* @__PURE__ */ r(Rr, { mode: E, items: H.items, batch: b, onBatch: q, onLabel: H.setLabel, onRemove: H.remove, onReuse: ce, onRerun: Ge, onDeleteMedia: H.deleteMedia, onLoadMore: H.loadMore, hasMore: H.hasMore, loadingMore: H.loadingMore, serverError: H.serverError, estimateFor: _e })
        ] }) : /* @__PURE__ */ s("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(ge, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function nn(e) {
  const t = e.accountId ?? ur(e.apiKey);
  return /* @__PURE__ */ r(tn, { scope: t, ...e }, t);
}
export {
  ue as ApiError,
  Kt as MuapiClient,
  nn as MuapiStudio,
  Xt as THEMES,
  Wt as cyanTheme,
  Zt as defaultLayout,
  Ke as generationKind,
  Ve as limeTheme,
  rt as pollUntilDone,
  It as resolveTheme,
  ur as scopeOfKey,
  Qt as themeStyle
};
