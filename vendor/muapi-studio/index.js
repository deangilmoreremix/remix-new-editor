import { jsx as r, jsxs as s, Fragment as $e } from "react/jsx-runtime";
import { createContext as Vt, useContext as Ut, useState as N, useRef as W, useEffect as F, useCallback as Z, useMemo as Q, createElement as qt, useId as Ft, useLayoutEffect as Bt } from "react";
function zt(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
class me extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function kt(e) {
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
function Ht(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Jt {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    var m, w;
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [b, I] of Object.entries(await this.opts.getHeaders())) n.set(b, I);
    const i = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), l = await i.text();
    let o = null;
    try {
      o = l ? JSON.parse(l) : null;
    } catch {
    }
    if (!i.ok && zt(i.status, o, l) && !t.startsWith("/app/") && ((w = (m = this.opts).onKeyRejected) == null || w.call(m)), !i.ok) throw new me(Ht(o, `${i.status} ${i.statusText}`), i.status);
    if (o === null && l.trim()) throw new me("Unexpected non-JSON response from the server", 502);
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
    if (!l) throw new me("The API did not return a request id", 502);
    return { requestId: l, cost: (o = i.cost) == null ? void 0 : o.amount_usd };
  }
  async poll(t) {
    var o;
    const a = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), n = String(a.status || "").toLowerCase(), i = ["completed", "succeeded"].includes(n) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(n) ? "failed" : n === "pending" ? "pending" : "processing", l = Array.isArray(a.outputs) ? a.outputs : a.url ? [a.url] : [];
    return { status: i, outputs: l, error: kt(a.error), cost: (o = a.cost) == null ? void 0 : o.amount_usd };
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
    const t = (n) => n instanceof me && [403, 404, 405].includes(n.status);
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
    if (!i) throw new me("Upload returned no URL", 502);
    return i;
  }
}
async function et(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: i = 15 * 60 * 1e3, signal: l, onUpdate: o } = a, m = Date.now();
  let w = 0;
  for (; Date.now() - m < i; ) {
    if (l != null && l.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const b = await e.poll(t);
      if (w = 0, o == null || o(b), b.status === "completed" || b.status === "failed") return b;
    } catch (b) {
      if (++w >= 5) throw b;
    }
    await new Promise((b) => setTimeout(b, n));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Nt = Vt({ library: !0, deleteMedia: !0 }), St = () => Ut(Nt), Pe = {
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
}, Yt = {
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
}, Kt = { lime: Pe, cyan: Yt }, tt = {
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
function Ct(e = "lime") {
  return typeof e == "string" ? Kt[e] ?? Pe : { ...Pe, ...e };
}
function Wt(e = "lime") {
  const t = Ct(e), a = {};
  for (const n of Object.keys(tt)) a[tt[n]] = t[n];
  return a;
}
function Xt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const Qt = (e = "lime") => Ct(e).buttonStyle, le = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], Zt = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Je(e) {
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
const er = (e) => !!e && le.some((t) => t.id === e);
function tr(e, t) {
  const a = le.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const rr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function At(e, t, a = {}) {
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
const ar = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function nr(e, t) {
  var n, i;
  const a = (n = t.find((l) => l.name === e)) == null ? void 0 : n.group_of;
  return ((i = le.find((l) => a && l.groups.includes(a))) == null ? void 0 : i.id) ?? "ai-tools";
}
function or(e, t, a = {}) {
  var l;
  const n = e.output ?? {}, i = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: nr(e.model, t),
    prompt: typeof i.prompt == "string" ? i.prompt : "",
    inputs: i,
    status: ar[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: kt(n.error),
    cost: (l = n.cost) == null ? void 0 : l.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function ir(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((m) => m.requestId).map((m) => [m.requestId, m])), i = new Set(e.map((m) => m.requestId).filter(Boolean));
  return [...e.map((m) => {
    const w = m.requestId ? n.get(m.requestId) : void 0;
    return m.status === "failed" && w && w.status === "completed" && w.outputs.length ? { ...m, status: w.status, outputs: w.outputs, error: void 0, cost: m.cost ?? w.cost } : m;
  }), ...t.filter((m) => !m.requestId || !i.has(m.requestId))].filter((m) => !(m.requestId && a.has(m.requestId))).sort((m, w) => w.createdAt - m.createdAt);
}
function sr(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function ae(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function Ye(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const It = "muapi-studio:history:v1", lr = 200, pe = (e, t) => t ? `${e}:${t}` : e;
function cr(e) {
  if (!e) return "";
  let t = 2166136261, a = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, a = Math.imul(a ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${a.toString(36)}`;
}
function Le(e = "") {
  try {
    const t = localStorage.getItem(pe(It, e));
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function dr(e, t = "") {
  try {
    localStorage.setItem(pe(It, t), JSON.stringify(e.slice(0, lr)));
  } catch {
  }
}
const ur = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, rt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, at = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, nt = "muapi-studio:labels:v1", ot = "muapi-studio:hidden:v1";
function mr(e, t, a, n = "") {
  const [i, l] = N(() => Le(n)), [o, m] = N([]), [w, b] = N(null), [I, A] = N(!1), [y, k] = N(null), C = W(!1), [j, E] = N(() => rt(pe(nt, n), {})), [R, x] = N(() => rt(pe(ot, n), [])), p = W(/* @__PURE__ */ new Set()), f = W(new AbortController()), M = W([]);
  M.current = t ?? [], F(() => dr(i, n), [i, n]), F(() => at(pe(nt, n), j), [j, n]), F(() => at(pe(ot, n), R), [R, n]), F(() => (f.current = new AbortController(), () => f.current.abort()), []);
  const P = Z((d, v) => l((L) => L.map((c) => c.id === d ? { ...c, ...v } : c)), []), $ = Z(async (d, v) => {
    if (!p.current.has(d)) {
      p.current.add(d);
      try {
        const L = await et(e, v, {
          signal: f.current.signal,
          onUpdate: (c) => P(d, { status: c.status, outputs: c.outputs, error: c.error, cost: c.cost })
        });
        P(d, { status: L.status, outputs: L.outputs, error: L.error, cost: L.cost }), a == null || a();
      } catch (L) {
        L.name !== "AbortError" && P(d, { status: "failed", error: L.message });
      } finally {
        p.current.delete(d);
      }
    }
  }, [e, P, a]), U = Z(async (d) => {
    if (!d.requestId || p.current.has(d.id)) return;
    p.current.add(d.id);
    const v = (L) => m((c) => c.map((O) => O.id === d.id ? { ...O, status: L.status, outputs: L.outputs, error: L.error, cost: L.cost ?? O.cost } : O));
    try {
      const L = await et(e, d.requestId, { signal: f.current.signal, onUpdate: v });
      v(L), a == null || a();
    } catch {
    } finally {
      p.current.delete(d.id);
    }
  }, [e, a]);
  F(() => {
    const d = new Set(Le(n).map((v) => v.requestId));
    for (const v of o) (v.status === "pending" || v.status === "processing") && v.requestId && !d.has(v.requestId) && U(v);
  }, [o, n, U]), F(() => {
    for (const d of Le(n)) (d.status === "pending" || d.status === "processing") && d.requestId && $(d.id, d.requestId);
  }, []);
  const T = Z(async (d = !1) => {
    if (!C.current) {
      A(!0), k(null);
      try {
        const v = await e.history(d ? void 0 : w ?? void 0), L = v.items.map((c) => or(c, M.current));
        m((c) => d ? L : [...c, ...L]), b(v.next_cursor);
      } catch (v) {
        v instanceof me && [403, 404, 405].includes(v.status) ? (C.current = !0, b(null)) : k(v.message);
      } finally {
        A(!1);
      }
    }
  }, [e, w]), J = W(!1);
  F(() => {
    t && !J.current && (J.current = !0, T(!0));
  }, [t, T]);
  const g = Z((d) => {
    const v = Array.from({ length: d.count }, () => ({
      id: ur(),
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
    return l((L) => [...v, ...L]), Promise.all(v.map(async (L) => {
      try {
        const { requestId: c, cost: O } = await e.submit(d.endpointUrl, d.payload, d.kind);
        P(L.id, { requestId: c, ...O !== void 0 ? { cost: O } : {} }), await $(L.id, c);
      } catch (c) {
        P(L.id, { status: "failed", error: c.message });
      }
    }));
  }, [e, P, $]), B = Q(() => {
    const d = (v) => ({ ...v, label: v.requestId && j[v.requestId] || v.label });
    return ir(i.map(d), o.map(d), new Set(R));
  }, [i, o, j, R]), z = Z((d, v) => {
    d.requestId && E((L) => {
      const c = { ...L };
      return v ? c[d.requestId] = v : delete c[d.requestId], c;
    }), P(d.id, { label: v });
  }, [P]), h = Z((d) => {
    l((v) => v.filter((L) => L.id !== d.id)), d.requestId && x((v) => [.../* @__PURE__ */ new Set([...v, d.requestId])]);
  }, []), u = Z(async (d) => {
    d.requestId && (await e.deleteMedia(d.requestId), P(d.id, { outputs: [] }), m((v) => v.map((L) => L.requestId === d.requestId ? { ...L, outputs: [] } : L)));
  }, [e, P]);
  return { items: B, run: g, setLabel: z, remove: h, deleteMedia: u, loadMore: () => T(!1), hasMore: !!w, loadingMore: I, serverError: y };
}
const pr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Mt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : pr.test(e) ? "file" : "image" : "text";
}
function hr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const fr = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), K = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Me = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), gr = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), br = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), yr = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), Ke = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), xr = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), We = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), it = ({ filled: e, ...t }) => /* @__PURE__ */ r(K, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Xe = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Ee = ({ up: e, ...t }) => /* @__PURE__ */ r(K, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), vr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), wr = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), Ve = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ke = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), ge = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), $t = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), kr = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), be = (e) => /* @__PURE__ */ r(K, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Nr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Sr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Cr = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), st = (e) => /* @__PURE__ */ s(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Et({ url: e }) {
  return /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Ke, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let lt = null;
const Ar = () => lt ?? (lt = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw lt = null, e;
}));
function Ir({ url: e, hidden: t = !1 }) {
  const [a, n] = N("loading"), i = W(null);
  return F(() => {
    let l = !0;
    return n("loading"), Ar().catch(() => l && n("failed")), () => {
      l = !1;
    };
  }, [e]), F(() => {
    const l = i.current;
    if (!l) return;
    const o = () => n("ready"), m = () => n("failed");
    return l.addEventListener("load", o), l.addEventListener("error", m), () => {
      l.removeEventListener("load", o), l.removeEventListener("error", m);
    };
  }), a === "failed" ? /* @__PURE__ */ r(Et, { url: e }) : /* @__PURE__ */ s("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    qt("model-viewer", {
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
      /* @__PURE__ */ r(be, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(Ke, { width: 14, height: 14 }) })
  ] });
}
const Mr = ["All", "Approved", "Rejected", "Unlabeled"], $r = [1, 2, 4, 6, 8];
function Er({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, i = Mt(e);
  return i === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: hr(e) }) : i === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : i === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : i === "3d" ? fr(e) ? /* @__PURE__ */ r(Ir, { url: e, hidden: t }) : /* @__PURE__ */ r(Et, { url: e }) : i === "file" ? /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Ve, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function Tr({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: i, onRerun: l, onDeleteMedia: o, onOpen: m, estimateFor: w }) {
  const [b, I] = N(0), A = e.outputs.length, y = Math.min(b, Math.max(A - 1, 0)), k = e.outputs[y], C = !!k && Mt(k) === "text", [j, E] = N(!1), [R, x] = N(null), p = St(), f = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", M = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ s("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && k ? /* @__PURE__ */ s("div", { className: "relative", children: [
      /* @__PURE__ */ r(Er, { url: k, hidden: t, onOpen: () => m(k) }),
      A > 1 && /* @__PURE__ */ s("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Previous output", disabled: y === 0, onClick: () => I(y - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ s("span", { "aria-live": "polite", children: [
          y + 1,
          " / ",
          A
        ] }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Next output", disabled: y === A - 1, onClick: () => I(y + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ s("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(ge, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ s("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(be, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ s("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ s("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ae(e.cost) : e.status === "completed" && (w == null ? void 0 : w(e.model)) !== void 0 ? `est. ${ae(w(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && k && (C ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(k)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Ve, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: k, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Ve, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${M} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ r(ke, { width: 14, height: 14 })
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
            children: /* @__PURE__ */ r(ge, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Load this model and settings back into the form", className: f, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => l(e), title: "Generate again with the same settings", className: f, children: "Re-run" }),
        e.status === "completed" && k && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var P;
          (P = navigator.clipboard) == null || P.writeText(k).then(() => {
            E(!0), setTimeout(() => E(!1), 1500);
          });
        }, className: f, children: j ? "Copied" : C ? "Copy text" : "Copy link" })
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
          p.deleteMedia && e.requestId && e.status === "completed" && k && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (x(null), o(e).catch((P) => x(P.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function _r({ url: e, onClose: t }) {
  return F(() => {
    const a = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ s("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(ge, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Gr({ mode: e, items: t, batch: a, onBatch: n, onLabel: i, onRemove: l, onReuse: o, onRerun: m, onDeleteMedia: w, onLoadMore: b, hasMore: I, loadingMore: A, serverError: y, estimateFor: k }) {
  const [C, j] = N("All"), [E, R] = N(""), [x, p] = N(!1), [f, M] = N(null), P = Q(() => {
    const $ = E.trim().toLowerCase();
    return t.filter((U) => U.mode !== e || C === "Approved" && U.label !== "approved" || C === "Rejected" && U.label !== "rejected" || C === "Unlabeled" && U.label !== null ? !1 : !$ || U.prompt.toLowerCase().includes($) || U.model.toLowerCase().includes($));
  }, [t, e, C, E]);
  return /* @__PURE__ */ s("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Mr.map(($) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": C === $,
          onClick: () => j($),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${C === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ s("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(Xe, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: E, onChange: ($) => R($.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: $r.map(($) => /* @__PURE__ */ r(
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
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": x, "aria-label": x ? "Show previews" : "Hide previews", title: x ? "Show previews" : "Hide previews", onClick: () => p(($) => !$), className: x ? "text-primary" : "text-secondary hover:text-fg", children: x ? /* @__PURE__ */ r(vr, { width: 18, height: 18 }) : /* @__PURE__ */ r(wr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      P.length === 0 ? /* @__PURE__ */ s("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(We, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some(($) => $.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some(($) => $.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: P.map(($) => /* @__PURE__ */ r(Tr, { g: $, hidden: x, onLabel: i, onRemove: l, onReuse: o, onRerun: m, onDeleteMedia: w, onOpen: M, estimateFor: k }, $.id)) }),
      y && /* @__PURE__ */ s("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        y
      ] }),
      I && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: A, onClick: b, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: A ? "Loading…" : "Load more history" }) }),
      f && /* @__PURE__ */ r(_r, { url: f, onClose: () => M(null) })
    ] })
  ] });
}
const Lr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Rr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Or(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Lr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Rr.test(e.name) ? "media" : "text" : "text";
}
function ct(e) {
  var o, m;
  const t = (m = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : m.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), i = [...n.filter((w) => a[w]), ...Object.keys(a).filter((w) => !n.includes(w))], l = new Set(e.required_fields ?? []);
  return i.map((w) => ({ prop: { ...a[w], name: w }, kind: Or({ ...a[w], name: w }), required: l.has(w) }));
}
function Re(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: i, required: l } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : l && (i === "textarea" || i === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const he = (e) => `__auto:${e}`, dt = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Ue = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function ut(e, t) {
  const a = {};
  for (const { prop: n, kind: i } of e) {
    if (t[he(n.name)] === !0) continue;
    const l = t[n.name] ?? n.default;
    if (!Ue(l))
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
function Dr(e, t) {
  for (const { prop: a, kind: n, required: i } of e) {
    if (t[he(a.name)] === !0) continue;
    const l = t[a.name] ?? a.default, o = a.title || a.name;
    if (i && Ue(l)) return `${o} is required`;
    if (n === "json" && typeof l == "string" && l)
      try {
        JSON.parse(l);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !Ue(l)) {
      const m = Number(l);
      if (!Number.isFinite(m)) return `${o} must be a number`;
      if (a.minValue !== void 0 && m < a.minValue) return `${o} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && m > a.maxValue) return `${o} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const jr = 12, Qe = 240, Se = (e) => `${typeof e}:${e}`, Pr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Vr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Ur(e, t, a = Qe) {
  return e >= a || e >= t ? "down" : "up";
}
const qr = 36, Fr = 48;
function Br(e, t) {
  return Math.min(Qe, Math.max(1, e) * qr + 8) + (t ? Fr : 0);
}
function zr(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const mt = "Auto (let model decide)", Oe = "__auto__";
function qe({ id: e, label: t, options: a, value: n, onChange: i, allowAuto: l, auto: o, onAuto: m, combobox: w }) {
  const b = Ft(), I = e ?? `ms-dd-${b}`, A = w ?? a.length > jr, [y, k] = N(!1), [C, j] = N(""), [E, R] = N(0), [x, p] = N("down"), f = W(null), M = W(null), P = W(null), $ = a.find((u) => n !== void 0 && Se(u.value) === Se(n)), U = Q(() => A ? Vr(a, C) : a, [A, a, C]), T = Q(
    () => [...l ? [{ key: Oe, label: mt, value: Oe, isAuto: !0 }] : [], ...U.map((u) => ({ key: Se(u.value), label: u.label, hint: u.hint, value: u.value }))],
    [l, U]
  ), J = o ? Oe : $ ? Se($.value) : void 0, g = () => {
    k(!1), j("");
  }, B = (u) => {
    u.isAuto ? m == null || m() : i(u.value), g();
  };
  Bt(() => {
    if (!y || !f.current) return;
    const u = f.current.getBoundingClientRect();
    let d = f.current.parentElement;
    for (; d && !/(auto|scroll)/.test(getComputedStyle(d).overflowY); ) d = d.parentElement;
    const v = d ? d.getBoundingClientRect() : null, L = Math.min(window.innerHeight, v ? v.bottom : window.innerHeight), c = Math.max(0, v ? v.top : 0);
    p(Ur(L - u.bottom, u.top - c, Br(a.length + (l ? 1 : 0), A)));
  }, [y]), F(() => {
    if (!y) return;
    const u = T.findIndex((d) => d.key === J);
    R(u >= 0 ? u : 0);
  }, [y, C]), F(() => {
    var u, d, v;
    y && ((v = (d = (u = M.current) == null ? void 0 : u.querySelector(`[data-i="${E}"]`)) == null ? void 0 : d.scrollIntoView) == null || v.call(d, { block: "nearest" }));
  }, [E, y]), F(() => {
    var u;
    y && A && ((u = P.current) == null || u.focus());
  }, [y, A]), F(() => {
    if (!y) return;
    const u = (d) => {
      var v;
      (v = f.current) != null && v.contains(d.target) || g();
    };
    return document.addEventListener("mousedown", u), () => document.removeEventListener("mousedown", u);
  }, [y]);
  const z = (u) => {
    if (!y) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(u.key) && (u.preventDefault(), k(!0));
      return;
    }
    if (u.key === "Escape") {
      u.preventDefault(), u.stopPropagation(), g();
      return;
    }
    if (u.key === "Enter") {
      u.preventDefault(), T[E] && B(T[E]);
      return;
    }
    if (u.key === "Tab") {
      g();
      return;
    }
    if (u.key === " " && !A) {
      u.preventDefault(), T[E] && B(T[E]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(u.key) && (u.preventDefault(), R((d) => zr(d, u.key, T.length)));
  }, h = o ? mt : ($ == null ? void 0 : $.label) ?? "Select…";
  return /* @__PURE__ */ s("div", { ref: f, className: "relative w-full", onKeyDown: z, children: [
    /* @__PURE__ */ s(
      "button",
      {
        id: I,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": y,
        "aria-label": `${t}: ${h}`,
        "aria-controls": `${I}-list`,
        onClick: () => k((u) => !u),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${y ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: h }),
          /* @__PURE__ */ r(Ee, { up: y, width: 16, height: 16 })
        ]
      }
    ),
    y && /* @__PURE__ */ s("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${x === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      A && /* @__PURE__ */ r(
        "input",
        {
          ref: P,
          value: C,
          onChange: (u) => j(u.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${I}-list`,
          "aria-activedescendant": T[E] ? `${I}-o${E}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ s("ul", { id: `${I}-list`, ref: M, role: "listbox", "aria-label": t, style: { maxHeight: Qe }, className: "overflow-y-auto", children: [
        T.map((u, d) => {
          const v = u.key === J;
          return /* @__PURE__ */ s(
            "li",
            {
              id: `${I}-o${d}`,
              "data-i": d,
              role: "option",
              "aria-selected": v,
              onMouseEnter: () => R(d),
              onClick: () => B(u),
              className: `flex cursor-pointer items-center justify-between gap-2 ${u.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${v ? "bg-primary text-primary-ink" : d === E ? "bg-card-bg" : ""} ${u.isAuto && !v ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ s("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: u.label }),
                  u.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${v ? "opacity-70" : "text-muted"}`, children: u.hint })
                ] }),
                v && /* @__PURE__ */ r(ke, { width: 14, height: 14 })
              ]
            },
            u.key
          );
        }),
        T.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Hr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Jr({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Me, {}) });
}
function Yr({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: i }) {
  const [l, o] = N(a), [m, w] = N(""), [b, I] = N(1), [A, y] = N(null), [k, C] = N(null), [j, E] = N(!1), [R, x] = N([]), [p, f] = N(""), [M, P] = N(!1), $ = W(null), U = W(null), T = Z(async () => {
    E(!0), C(null);
    try {
      y(await e.mediaLibrary({ mediaType: l, search: m, page: b }));
    } catch (h) {
      C(h.message);
    } finally {
      E(!1);
    }
  }, [e, l, m, b]);
  F(() => {
    const h = setTimeout(T, m ? 300 : 0);
    return () => clearTimeout(h);
  }, [T, m]), F(() => {
    I(1);
  }, [l, m]), F(() => {
    var d;
    const h = document.activeElement;
    (d = $.current) == null || d.focus();
    const u = (v) => {
      if (v.key === "Escape") {
        v.stopPropagation(), i();
        return;
      }
      if (v.key !== "Tab" || !$.current) return;
      const L = [...$.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!L.length) return;
      const c = L[0], O = L[L.length - 1];
      v.shiftKey && document.activeElement === c ? (v.preventDefault(), O.focus()) : !v.shiftKey && document.activeElement === O && (v.preventDefault(), c.focus());
    };
    return document.addEventListener("keydown", u), () => {
      var v;
      document.removeEventListener("keydown", u), (v = h == null ? void 0 : h.focus) == null || v.call(h);
    };
  }, [i]);
  const J = (h) => x((u) => u.includes(h) ? u.filter((d) => d !== h) : t === 1 ? [h] : u.length < t ? [...u, h] : u), g = async (h) => {
    if (h.length) {
      E(!0), C(null);
      try {
        for (const u of h) {
          const d = await e.upload(u);
          await e.saveToLibrary({ url: d, name: u.name, mime_type: u.type || void 0, size_bytes: u.size, media_type: u.type.startsWith("video") ? "video" : u.type.startsWith("audio") ? "audio" : u.type.startsWith("image") ? "image" : "archive" });
        }
        await T();
      } catch (u) {
        C(u.message), E(!1);
      }
    }
  }, B = async () => {
    var u;
    const h = p.trim();
    if (!/^https?:\/\//i.test(h)) {
      C("Enter a full http(s) URL");
      return;
    }
    E(!0), C(null);
    try {
      const d = ((u = h.split("?")[0].split(".").pop()) == null ? void 0 : u.toLowerCase()) ?? "", v = ["mp4", "webm", "mov"].includes(d) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(d) ? "audio" : ["zip", "rar", "7z"].includes(d) ? "archive" : "image";
      await e.saveToLibrary({ url: h, name: h.split("/").pop() || "link", media_type: v }), f(""), P(!1), await T();
    } catch (d) {
      C(d.message), E(!1);
    }
  }, z = async (h) => {
    if (window.confirm(`Delete "${h.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(h.id), x((u) => u.filter((d) => d !== h.url)), await T();
      } catch (u) {
        C(u.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (h) => {
    h.target === h.currentTarget && i();
  }, children: /* @__PURE__ */ s("div", { ref: $, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ s("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Me, {}) }),
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
      /* @__PURE__ */ r("input", { ref: U, type: "file", hidden: !0, multiple: !0, onChange: (h) => {
        const u = Array.from(h.target.files ?? []);
        h.target.value = "", g(u);
      } }),
      /* @__PURE__ */ s("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var h;
        return (h = U.current) == null ? void 0 : h.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ r($t, { width: 14, height: 14 }),
        /* @__PURE__ */ r("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: i, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(ge, {}) })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Hr.map((h) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": l === h.id, onClick: () => o(h.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${l === h.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: h.label }, h.id)) }),
      /* @__PURE__ */ r("input", { value: m, onChange: (h) => w(h.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": M, onClick: () => P((h) => !h), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    M && /* @__PURE__ */ s("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: p, onChange: (h) => f(h.target.value), onKeyDown: (h) => h.key === "Enter" && void B(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void B(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      k && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: k }),
      j && !A ? /* @__PURE__ */ s("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(be, {}),
        " Loading…"
      ] }) : A != null && A.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: A.items.map((h) => {
        const u = R.includes(h.url);
        return /* @__PURE__ */ s("li", { className: `group relative overflow-hidden rounded-card border ${u ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": u, "aria-label": `${u ? "Deselect" : "Select"} ${h.name ?? "file"}`, onClick: () => J(h.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Jr, { a: h }) }),
          u && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(ke, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${h.name ?? "file"}`, onClick: () => void z(h), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(ge, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: h.name ?? "", children: h.name })
        ] }, h.id);
      }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Me, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      A && A.total_pages > 1 && /* @__PURE__ */ s("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: b <= 1, onClick: () => I((h) => h - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        b,
        " of ",
        A.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: b >= A.total_pages, onClick: () => I((h) => h + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
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
        /* @__PURE__ */ r(ke, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const Tt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Kr = (e, t = "") => {
  const a = Tt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Wr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function Xr(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, i) => void e.saveToLibrary({ url: a[i], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: Wr(n) }).catch(() => {
  })), a;
}
function Fe({ client: e, field: t, multiple: a, max: n, current: i, onUrls: l, onError: o }) {
  const m = W(null), [w, b] = N(!1), [I, A] = N(!1), [y, k] = N(!1), C = n - i.length, j = St(), E = async (p) => {
    if (p.length) {
      b(!0);
      try {
        l(await Xr(e, a ? p.slice(0, Math.max(C, 1)) : p.slice(0, 1)));
      } catch (f) {
        o(f.message);
      } finally {
        b(!1);
      }
    }
  }, R = Tt(t.prop.field, t.prop.name), x = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ s(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), A(!0);
      },
      onDragLeave: () => A(!1),
      onDrop: (p) => {
        p.preventDefault(), A(!1), E(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${I ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: m, type: "file", hidden: !0, accept: R, multiple: a, onChange: (p) => {
          const f = Array.from(p.target.files ?? []);
          p.target.value = "", E(f);
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
          /* @__PURE__ */ r("button", { type: "button", disabled: w, onClick: () => {
            var p;
            return (p = m.current) == null ? void 0 : p.click();
          }, "aria-label": "Upload file", title: "Upload file", className: x, children: w ? /* @__PURE__ */ r(be, { width: 16, height: 16 }) : /* @__PURE__ */ r($t, { width: 16, height: 16 }) }),
          j.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => k(!0), "aria-label": "Choose from media library", title: "Media library", className: x, children: /* @__PURE__ */ s("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        y && j.library && /* @__PURE__ */ r(Yr, { client: e, max: a ? Math.max(C, 1) : 1, initialType: Kr(t.prop.field, t.prop.name), onInsert: l, onClose: () => k(!1) })
      ]
    }
  );
}
function Qr({ field: e, values: t, onChange: a, client: n, onError: i, tagCount: l = 0 }) {
  const { prop: o, kind: m, required: w } = e, b = t[o.name], I = (p) => a(o.name, p), A = o.title || o.name, y = `ms-f-${o.name}`, k = b == null ? "" : String(b), C = Array.isArray(b) ? b : [], j = t[he(o.name)] === !0, E = W(null), R = (p) => {
    const f = E.current, M = typeof b == "string" ? b : "", P = (f == null ? void 0 : f.selectionStart) ?? M.length, $ = (f == null ? void 0 : f.selectionEnd) ?? P;
    I(M.slice(0, P) + p + " " + M.slice($)), requestAnimationFrame(() => {
      f == null || f.focus(), f == null || f.setSelectionRange(P + p.length + 1, P + p.length + 1);
    });
  };
  let x;
  if (m === "textarea" || m === "json")
    x = /* @__PURE__ */ s($e, { children: [
      /* @__PURE__ */ r("textarea", { ref: E, id: y, rows: m === "json" ? 4 : 5, value: typeof b == "string" ? b : b ? JSON.stringify(b, null, 2) : "", onChange: (p) => I(p.target.value), className: `w-full resize-y p-3 text-sm ${m === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && l > 0 && /* @__PURE__ */ s("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(l, 9) }, (p, f) => `@image${f + 1}`).map((p) => /* @__PURE__ */ r("button", { type: "button", onClick: () => R(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (m === "select") {
    const p = o.enum ?? [];
    x = /* @__PURE__ */ r(
      qe,
      {
        id: y,
        label: A,
        options: Pr(p),
        value: b,
        onChange: (f) => {
          I(f), a(he(o.name), !1);
        },
        allowAuto: dt(e),
        auto: j,
        onAuto: () => a(he(o.name), !0)
      }
    );
  } else if (m === "boolean") {
    const p = b === !0;
    x = /* @__PURE__ */ r(
      "button",
      {
        id: y,
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
    x = /* @__PURE__ */ s("div", { className: `flex items-center gap-3 ${j ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ r("input", { type: "range", disabled: j, "aria-label": `${A} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: k === "" ? o.minValue : Number(k), onChange: (f) => I(Number(f.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: y, type: "number", disabled: j, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: k, onChange: (f) => I(f.target.value === "" ? "" : Number(f.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (m === "media")
    x = /* @__PURE__ */ r(Fe, { client: n, field: e, multiple: !1, max: 1, current: k ? [k] : [], onUrls: (p) => I(p[0]), onError: i });
  else if (m === "media-list") {
    const p = o.maxItems ?? 8;
    x = /* @__PURE__ */ s("div", { className: "space-y-2", children: [
      C.map((f, M) => /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${A} ${M + 1}`, value: f, onChange: (P) => I(C.map(($, U) => U === M ? P.target.value : $)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${A} ${M + 1}`, onClick: () => I(C.filter((P, $) => $ !== M)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(ge, { width: 14, height: 14 }) })
      ] }, M)),
      /* @__PURE__ */ r(Fe, { client: n, field: e, multiple: !0, max: p, current: C, onUrls: (f) => I([...C, ...f].slice(0, p)), onError: i })
    ] });
  } else
    x = /* @__PURE__ */ r("input", { id: y, value: k, onChange: (p) => I(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ s("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ s("label", { htmlFor: y, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        A,
        o.description && /* @__PURE__ */ r("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ r(kr, { width: 13, height: 13 }) })
      ] }),
      dt(e) && m === "number" ? /* @__PURE__ */ s("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: j, onChange: (p) => a(he(o.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: m === "media-list" ? `${C.length}/${o.maxItems ?? 8} items${w ? " · required" : ""}` : w ? "* required" : "" })
    ] }),
    x
  ] });
}
const Ce = {
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
}, fe = "Other", Zr = 3, ea = 2, ta = 20, ra = 2, aa = 4, na = 40, oa = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function _t(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ce[t] ? Ce[t] : Ce[a] ? Ce[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? fe : oa(a);
}
function ia(e) {
  const t = /* @__PURE__ */ new Map();
  for (const i of e) {
    const l = _t(i.name);
    t.set(l, (t.get(l) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [i, l] of t)
    i === fe || l < Zr ? a += l : n.push({ id: i, label: i, count: l });
  return n.sort((i, l) => l.count - i.count || i.label.localeCompare(l.label)), a && n.push({ id: fe, label: fe, count: a }), n;
}
function Gt(e, t) {
  const a = _t(e.name);
  return t.some((n) => n.id === a) ? a : fe;
}
function sa(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function la(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const pt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function ca(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const i = pt.indexOf(n);
    return i < 0 ? pt.length : i;
  };
  return [...t].map(([n, i]) => ({ id: n, count: i })).sort((n, i) => a(n.id) - a(i.id) || i.count - n.count || n.id.localeCompare(i.id));
}
const se = "__favourites__", ee = "__all__";
function da(e, t, a) {
  return e.filter((n) => {
    var i;
    return t.category !== ee && n.category !== t.category ? !1 : t.provider === se ? !!((i = t.favourites) != null && i.includes(n.name)) : t.provider === ee || Gt(n, a) === t.provider;
  });
}
const ua = (e, t) => t.filter((a) => a.id !== fe).length >= ea && e.length >= ta;
function ma(e) {
  const t = ca(e);
  return e.length >= na ? t.filter((a) => a.count >= aa) : t;
}
const Ae = 200;
function pa({ model: e }) {
  const t = Ye(e);
  return t ? /* @__PURE__ */ s("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ae(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ae(t.current)
  ] }) : null;
}
const ht = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, ft = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function De({ label: e, active: t, onClick: a, hue: n, children: i }) {
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
function ha({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: i, usage: l, showGroup: o, scope: m = "default" }) {
  var L;
  const [w, b] = N(!1), [I, A] = N(""), [y, k] = N("popular"), [C, j] = N(!1), E = W(null), R = Q(() => ia(e), [e]), x = Q(() => ma(e), [e]), p = ua(e, R), f = x.length >= ra, [M, P] = N(() => ht(`muapi-studio:provider:${m}`, ee)), [$, U] = N(() => ht(`muapi-studio:category:${m}`, ee)), T = p && (M === se || M === ee || R.some((c) => c.id === M)) ? M : ee, J = f && ($ === ee || x.some((c) => c.id === $)) ? $ : ee, g = (c) => {
    P(c), ft(`muapi-studio:provider:${m}`, c);
  }, B = (c) => {
    U(c), ft(`muapi-studio:category:${m}`, c);
  }, z = W(null);
  F(() => {
    w || j(!1);
  }, [w]), F(() => {
    if (!w) return;
    const c = (te) => {
      var q;
      (q = E.current) != null && q.contains(te.target) || b(!1);
    }, O = (te) => {
      te.key === "Escape" && b(!1);
    };
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", O), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", O);
    };
  }, [w]);
  const h = Q(() => {
    const c = I.trim().toLowerCase(), O = da(e, { category: J, provider: T, favourites: n }, R), te = c ? O.filter((re) => re.name.toLowerCase().includes(c) || re.category.toLowerCase().includes(c)) : O, q = At(te, y, { usage: l, favorites: n });
    if (y === "favourites" || y === "most-used") return q;
    const oe = new Set(n);
    return [...q.filter((re) => oe.has(re.name)), ...q.filter((re) => !oe.has(re.name))];
  }, [e, I, y, n, l, J, T, R]), [u, d] = N(0);
  F(() => {
    var c, O;
    d(0), (O = (c = z.current) == null ? void 0 : c.scrollTo) == null || O.call(c, { top: 0 });
  }, [I, y, w, J, T]);
  const v = (c) => {
    c.key === "ArrowDown" ? (c.preventDefault(), d((O) => Math.min(O + 1, Math.min(h.length, Ae) - 1))) : c.key === "ArrowUp" ? (c.preventDefault(), d((O) => Math.max(O - 1, 0))) : c.key === "Enter" && h[u] && (c.preventDefault(), a(h[u].name), b(!1));
  };
  return F(() => {
    var c, O;
    (O = (c = document.getElementById(`ms-opt-${u}`)) == null ? void 0 : c.scrollIntoView) == null || O.call(c, { block: "nearest" });
  }, [u]), /* @__PURE__ */ s("div", { ref: E, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => b((c) => !c),
        "aria-haspopup": "listbox",
        "aria-expanded": w,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (L = (t ?? "?")[0]) == null ? void 0 : L.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Ee, { up: w, width: 16, height: 16 })
        ]
      }
    ),
    w && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ s("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(De, { label: "All providers", active: T === ee, onClick: () => g(ee), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(De, { label: "Favourites", active: T === se, onClick: () => g(se), children: /* @__PURE__ */ r(it, { width: 14, height: 14, filled: T === se }) }),
        R.map((c) => /* @__PURE__ */ r(De, { label: `${c.label} (${c.count})`, active: T === c.id, onClick: () => g(c.id), hue: la(c.label), children: sa(c.label) }, c.id))
      ] }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        f && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ee, label: "All" }, ...x.map((c) => ({ id: c.id, label: c.id }))].map((c) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": J === c.id,
            onClick: () => B(c.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${J === c.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: c.label
          },
          c.id
        )) }),
        /* @__PURE__ */ s("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ s("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(Xe, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: v, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${u}`, value: I, onChange: (c) => A(c.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ s("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": C,
                onClick: () => j((c) => !c),
                className: `flex h-full items-center rounded-ctl border px-3 ${C ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(Nr, { width: 16, height: 16 })
              }
            ),
            C && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: rr.map((c) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ s(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": y === c.id,
                onClick: () => {
                  k(c.id), j(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${y === c.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  c.label,
                  y === c.id && /* @__PURE__ */ r(ke, { width: 14, height: 14 })
                ]
              }
            ) }, c.id)) })
          ] })
        ] }),
        (p || f) && /* @__PURE__ */ s("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ s("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            T === se ? "Favourites" : "All models",
            " · ",
            h.length
          ] }),
          p && T !== ee && T !== se && /* @__PURE__ */ r("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: T })
        ] }),
        /* @__PURE__ */ s("ul", { id: "ms-listbox", ref: z, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          h.slice(0, Ae).map((c, O) => {
            const te = c.name === t;
            return /* @__PURE__ */ r(
              "li",
              {
                id: `ms-opt-${O}`,
                role: "option",
                "aria-selected": te,
                onClick: () => {
                  a(c.name), b(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${te ? "bg-primary-soft" : O === u ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ r("div", { className: `min-w-0 flex-1 truncate text-sm ${te ? "text-primary" : ""}`, title: c.name, children: c.name }),
                    /* @__PURE__ */ r(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(c.name) ? "Remove favorite" : "Add favorite",
                        onClick: (q) => {
                          q.stopPropagation(), i(c.name);
                        },
                        className: n.includes(c.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ r(it, { width: 15, height: 15, filled: n.includes(c.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ s("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ r("span", { className: "truncate text-[10px] text-secondary", children: o ? `${c.group_of} · ${c.category}` : p && T === ee ? `${Gt(c, R)} · ${c.category}` : c.category }),
                    /* @__PURE__ */ r(pa, { model: c })
                  ] })
                ] })
              },
              c.name
            );
          }),
          h.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: y === "favourites" ? "No favourites yet. Tap the heart on a model." : y === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${I}”.` }),
          h.length > Ae && /* @__PURE__ */ s("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ae,
            " of ",
            h.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const gt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, je = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, Lt = 0.25;
function fa({ mode: e, models: t, client: a, batch: n, onRun: i, usage: l, reuse: o, switcher: m }) {
  const w = le.find((_) => _.id === e), b = Q(() => tr(t, e), [t, e]), [I, A] = N(), [y, k] = N(null), [C, j] = N(null), [E, R] = N({}), [x, p] = N(null), [f, M] = N(null), [P, $] = N(() => gt("muapi-studio:favorites", [])), [U, T] = N("form"), [J, g] = N(!1), [B, z] = N("{}"), [h, u] = N(null), d = W(0), v = W(null);
  F(() => {
    if (!J) return;
    const _ = (D) => {
      var Y;
      (Y = v.current) != null && Y.contains(D.target) || g(!1);
    }, S = (D) => {
      D.key === "Escape" && g(!1);
    };
    return document.addEventListener("mousedown", _), document.addEventListener("keydown", S), () => {
      document.removeEventListener("mousedown", _), document.removeEventListener("keydown", S);
    };
  }, [J]);
  const L = W(null);
  F(() => {
    var D, Y, ne;
    const _ = gt(`muapi-studio:model:${e}`, null), S = ((D = b.find((ie) => ie.name === _)) == null ? void 0 : D.name) ?? ((Y = b.find((ie) => ie.name === Zt[e])) == null ? void 0 : Y.name) ?? ((ne = At(b, "popular")[0]) == null ? void 0 : ne.name);
    A(S);
  }, [e, b]), F(() => {
    o && (L.current = o.inputs, b.some((_) => _.name === o.model) && (A(o.model), je(`muapi-studio:model:${e}`, o.model)), T("form"));
  }, [o == null ? void 0 : o.nonce]);
  const c = b.find((_) => _.name === I);
  F(() => {
    if (!I) return;
    let _ = !0;
    return k(null), j(null), p(null), M(null), u(null), a.model(I).then((S) => {
      if (!_) return;
      const D = ct(S), Y = Re(D), ne = L.current;
      if (L.current = null, ne)
        for (const ie of D) ne[ie.prop.name] !== void 0 && (Y[ie.prop.name] = ne[ie.prop.name]);
      k(S), R(Y);
    }).catch((S) => {
      _ && j(S.message);
    }), () => {
      _ = !1;
    };
  }, [I, a]);
  const O = Q(() => y ? ct(y) : [], [y]), te = Q(() => ut(O, E), [O, E]), q = Q(() => {
    try {
      const _ = JSON.parse(B);
      return _ && typeof _ == "object" && !Array.isArray(_) ? _ : null;
    } catch {
      return null;
    }
  }, [B]), oe = U === "json" ? q ?? {} : te, re = JSON.stringify(oe);
  F(() => {
    if (!y || U === "json" && !q) return;
    const _ = ++d.current, S = setTimeout(() => {
      a.estimate(y.name, oe).then((D) => {
        _ === d.current && p(D);
      }).catch(() => {
        _ === d.current && p(null);
      });
    }, 500);
    return () => clearTimeout(S);
  }, [y, re, a]);
  const ce = (_) => {
    A(_), je(`muapi-studio:model:${e}`, _);
  }, ye = (_) => $((S) => {
    const D = S.includes(_) ? S.filter((Y) => Y !== _) : [...S, _];
    return je("muapi-studio:favorites", D), D;
  }), _e = (_) => {
    g(!1), _ !== U && (_ === "json" ? z(JSON.stringify(te, null, 2)) : q && R((S) => {
      const D = { ...S };
      for (const Y of O) q[Y.prop.name] !== void 0 && (D[Y.prop.name] = q[Y.prop.name]);
      return D;
    }), T(_), M(null));
  }, X = c ? Ye(c, x) : null, xe = Z(async () => {
    if (!y) return;
    u(null);
    const _ = O.find((S) => S.prop.name === "prompt");
    await i({
      model: y.name,
      endpointUrl: y.endpoint_url,
      mode: e,
      payload: oe,
      count: n,
      kind: Je(y.category),
      prompt: _ ? String(oe.prompt ?? "") : "",
      unitCost: X == null ? void 0 : X.current
    });
  }, [y, O, i, e, oe, n, X]), Ne = Z(async () => {
    if (!y) return;
    if (U === "json") {
      if (!q) {
        M("The JSON is not valid");
        return;
      }
      const S = (y.required_fields ?? []).find((D) => q[D] === void 0 || q[D] === "");
      if (S) {
        M(`${S} is required`);
        return;
      }
    } else {
      const S = Dr(O, E);
      if (S) {
        M(S);
        return;
      }
    }
    M(null);
    const _ = ((X == null ? void 0 : X.current) ?? 0) * n;
    if (_ > Lt) {
      u(_);
      return;
    }
    await xe();
  }, [y, U, q, O, E, X, n, xe]), de = !!y && !C, Ge = (() => {
    var S;
    const _ = O.find((D) => D.kind === "media-list");
    return _ ? Math.max(((S = E[_.prop.name]) == null ? void 0 : S.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ s("section", { "aria-label": w.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ s("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: w.title }),
        /* @__PURE__ */ s("div", { ref: v, className: "relative", children: [
          /* @__PURE__ */ s("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": J, onClick: () => g((_) => !_), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            U === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Ee, { up: J, width: 12, height: 12 })
          ] }),
          J && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((_) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": U === _, type: "button", onClick: () => _e(_), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${U === _ ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: _ === "json" ? "JSON" : "Form" }) }, _)) })
        ] })
      ] }),
      m,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(ha, { models: b, value: I, onChange: ce, favorites: P, onToggleFavorite: ye, usage: l, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: U === "json" ? "Request body" : "Parameters" }),
      (c == null ? void 0 : c.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: c.description }),
      !de && !C && I && /* @__PURE__ */ s("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(be, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      C && /* @__PURE__ */ s("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        C
      ] }),
      b.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      de && U === "json" && /* @__PURE__ */ s("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !q, spellCheck: !1, rows: 16, value: B, onChange: (_) => z(_.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${q ? "text-muted" : "text-danger"}`, children: q ? `Sent as the body of POST /api/v1/${y.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      de && U === "form" && O.map((_) => /* @__PURE__ */ r(
        Qr,
        {
          field: _,
          values: E,
          client: a,
          onError: M,
          tagCount: _.prop.name === "prompt" ? Ge : 0,
          onChange: (S, D) => R((Y) => ({ ...Y, [S]: D }))
        },
        _.prop.name
      ))
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      f && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: f }),
      h !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(h) }),
        " (",
        n,
        " × ",
        ae((X == null ? void 0 : X.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void xe(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => u(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          y && (R(Re(O)), z(JSON.stringify(ut(O, Re(O)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ s(
          "button",
          {
            type: "button",
            onClick: () => void Ne(),
            disabled: !de,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(We, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              X && /* @__PURE__ */ s("span", { className: "font-normal", children: [
                "(",
                X.original !== null ? /* @__PURE__ */ s($e, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: ae(X.original * n) }),
                  " "
                ] }) : null,
                ae(X.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const ga = {
  image: Me,
  video: gr,
  audio: br,
  avatar: yr,
  "3d": Ke,
  "ai-tools": xr,
  text: Sr,
  more: Cr
};
function ba({ mode: e, onChange: t, layout: a = "rail", onChangeKey: n }) {
  return a === "tabs" ? /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    le.map((i) => {
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
      /* @__PURE__ */ r(st, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ s("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    le.map((i) => {
      const l = ga[i.id], o = i.id === e;
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
      /* @__PURE__ */ r(st, {}),
      "Key"
    ] })
  ] });
}
const ya = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, bt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, xa = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], va = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], wa = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], ka = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), Na = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], Sa = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), Ca = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], Aa = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], Ia = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], Ma = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], $a = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), Ea = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Ta = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), _a = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Rt = {
  seedream: { aspect: xa, resolution: va },
  seedance: { aspect: wa, duration: ka },
  minimax: { resolution: Na, duration: Sa },
  wan: { aspect: Ca, resolution: Aa, quality: Ia, duration: Ma },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, Ga = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, ue = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Ot(e) {
  return ((a) => a.map((n, i) => {
    var l;
    return { ...n, label: ((l = ya[e.slug]) == null ? void 0 : l[i]) ?? n.label };
  }))(La(e));
}
function La(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [ue("base", "Target base image"), ue("face", "New face image")];
    case "video-face-swap":
      return [ue("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [ue("start", "Starting frame image"), ue("end", "Ending frame image", !0)];
    default:
      return [ue("source", "Source image")];
  }
}
function Ra(e) {
  return Ga[e.template];
}
function yt(e) {
  var n, i, l, o, m, w, b, I, A, y, k;
  const t = Rt[e.template], a = {};
  for (const C of e.sliders ?? []) a[C.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (l = (i = t.aspect) == null ? void 0 : i[0]) == null ? void 0 : l.value,
    resolution: (m = (o = t.resolution) == null ? void 0 : o[0]) == null ? void 0 : m.value,
    duration: ((b = (w = t.duration) == null ? void 0 : w.find((C) => C.value === 5)) == null ? void 0 : b.value) ?? ((A = (I = t.duration) == null ? void 0 : I[0]) == null ? void 0 : A.value),
    quality: (k = (y = t.quality) == null ? void 0 : y[0]) == null ? void 0 : k.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Dt(e, t) {
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
function xt(e, t, a) {
  var l;
  const n = (l = e.presets) == null ? void 0 : l.find((o) => o.id === a), i = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: i };
}
function Oa(e, t) {
  for (const a of Ot(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function Da(e, t) {
  const a = Dt(e, t), n = t.uploads;
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
function ja(e) {
  return bt[e.slug] ? bt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Pa = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], G = (e, t, a, n, i) => ({ id: e, label: t, hint: a, prompt: n, values: i }), Be = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, H = (e, t, a, n, i, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: i, prompt: l, ...o }), V = (e, t, a, n, i, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: i, prompt: l, ...o }), Ie = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${Be(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${Be(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Va = [Ie[2], { ...Ie[1], id: "vertical", label: "Vertical angle" }, Ie[0]].map((e) => ({ ...e, id: e.id })), Ua = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${Be(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], qa = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], Fa = "Keep the result tasteful and suitable for general audiences.", jt = [
  // ---- Professional
  H(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Ie, presets: [
      G("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      G("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      G("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      G("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      G("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      G("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      G("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
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
      G("wide", "Wide", void 0, "Use a wide establishing shot."),
      G("medium", "Medium", void 0, "Use a medium shot from the waist up."),
      G("close", "Close-up", void 0, "Use a close-up on the subject’s face or key detail."),
      G("xcu", "Extreme close-up", void 0, "Use an extreme close-up on a small detail."),
      G("ots", "Over-the-shoulder", void 0, "Use an over-the-shoulder shot."),
      G("low", "Low angle", void 0, "Shoot from a low angle looking up."),
      G("high", "High angle", void 0, "Shoot from a high angle looking down."),
      G("dutch", "Dutch angle", void 0, "Tilt the camera for a Dutch angle.")
    ] }
  ),
  H(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Va.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
      G("morph", "Morph", void 0, "Use a morph transition."),
      G("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      G("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      G("whip", "Whip pan", void 0, "Use a fast whip pan."),
      G("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
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
    { sliders: qa, presets: [
      G("natural", "Natural", "Clean, true to life", void 0, { saturation: 5, contrast: 5 }),
      G("cinematic", "Cinematic", "Teal and orange", "Give it a cinematic teal and orange look.", { contrast: 20, saturation: 10, temperature: -5 }),
      G("split", "Split tone", "Warm highlights, cool shadows", "Use split toning with warm highlights and cool shadows.", { contrast: 10 }),
      G("softskin", "Soft skin", "Gentle and flattering", "Soften skin tones gently.", { contrast: -10, highlights: -10 }),
      G("oldlens", "Old lens", "Vintage glass", "Mimic a vintage lens with soft edges and subtle flare.", { saturation: -10, grain: 20 }),
      G("film16", "16mm film", "Grain and warmth", "Mimic 16mm film stock.", { temperature: 15, grain: 55, contrast: 10 }),
      G("moody", "Moody", "Dark and desaturated", "Make it dark and moody.", { exposure: -20, saturation: -25, contrast: 25 })
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
      G("casual", "Casual", void 0, "Dress them in a relaxed casual outfit."),
      G("formal", "Formal", void 0, "Dress them in a sharp formal outfit."),
      G("street", "Streetwear", void 0, "Dress them in streetwear."),
      G("athletic", "Athletic", void 0, "Dress them in athletic wear."),
      G("evening", "Evening", void 0, "Dress them in an elegant evening outfit."),
      G("vintage", "Vintage", void 0, "Dress them in a vintage-style outfit.")
    ] }
  ),
  H(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Ua }
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
      G("boho", "Boho chic", void 0, "Use a boho chic look."),
      G("minimal", "Minimalist", void 0, "Use a clean minimalist look."),
      G("punk", "Punk rock", void 0, "Use a punk rock look."),
      G("preppy", "Preppy", void 0, "Use a preppy look."),
      G("y2k", "Y2K", void 0, "Use an early-2000s Y2K look."),
      G("cottage", "Cottagecore", void 0, "Use a cottagecore look.")
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
      G("corporate", "Corporate", void 0, "Use a classic corporate look."),
      G("creative", "Creative", void 0, "Use a modern creative look with a colored backdrop."),
      G("linkedin", "LinkedIn", void 0, "Frame it as a friendly LinkedIn profile photo."),
      G("exec", "Executive", void 0, "Use an authoritative executive look.")
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
  V("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  V("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  V("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  H("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
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
  H("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  V("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  V("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  V("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
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
      G("fps", "FPS shooter", void 0, "Use a first-person shooter look."),
      G("rpg", "RPG fantasy", void 0, "Use a fantasy role-playing game look."),
      G("racing", "Racing", void 0, "Use a racing game look."),
      G("fighting", "Fighting", void 0, "Use a fighting game look."),
      G("horror", "Survival horror", void 0, "Use a survival horror game look."),
      G("sports", "Sports", void 0, "Use a sports game look."),
      G("open", "Open world", void 0, "Use an open-world adventure game look."),
      G("platform", "Platformer", void 0, "Use a colorful platformer look.")
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
    { presets: [G("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), G("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), G("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), G("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  H("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  V("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  V("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${Fa}`),
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
], Te = (e) => jt.find((t) => t.slug === e), ze = (e) => e.badge === "VIDEO" ? "video" : "image", Ze = (e) => jt.filter((t) => ze(t) === e), He = (e) => Ze(e).length > 0;
function Pt(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = Te(t.get("app"));
  return a === "apps" ? { mode: n ? ze(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === ze(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function Ba(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function za(e, t, a) {
  return `${e.pathname}${Ba(e.search, t, a)}${e.hash}`;
}
function Ha(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const Ja = (e) => Pa.filter((t) => Ze(e).some((a) => a.category === t.id));
function Ya({ mode: e, value: t, onChange: a }) {
  const [n, i] = N(!1), [l, o] = N(""), [m, w] = N("all"), [b, I] = N(0), A = W(null), y = Q(() => Ja(e), [e]), k = Q(() => Ha(Ze(e), { category: m, q: l }), [e, m, l]), C = Te(t);
  F(() => I(0), [l, m, n]), F(() => {
    if (!n) return;
    const x = (f) => {
      var M;
      (M = A.current) != null && M.contains(f.target) || i(!1);
    }, p = (f) => {
      f.key === "Escape" && i(!1);
    };
    return document.addEventListener("mousedown", x), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", x), document.removeEventListener("keydown", p);
    };
  }, [n]), F(() => {
    var x, p;
    (p = (x = document.getElementById(`ms-app-${b}`)) == null ? void 0 : x.scrollIntoView) == null || p.call(x, { block: "nearest" });
  }, [b]);
  const j = (x) => {
    a(x), i(!1), o("");
  }, E = (x) => {
    x.key === "ArrowDown" ? (x.preventDefault(), I((p) => Math.min(p + 1, k.length - 1))) : x.key === "ArrowUp" ? (x.preventDefault(), I((p) => Math.max(p - 1, 0))) : x.key === "Enter" && k[b] && (x.preventDefault(), j(k[b].slug));
  }, R = (x) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${x ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ s("div", { ref: A, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => i((x) => !x),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (C == null ? void 0 : C.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (C == null ? void 0 : C.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Ee, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ s("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(Xe, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: E, value: l, onChange: (x) => o(x.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ s("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === "all", onClick: () => w("all"), className: R(m === "all"), children: "All" }),
        y.map((x) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === x.id, onClick: () => w(x.id), className: R(m === x.id), children: x.label }, x.id))
      ] }),
      /* @__PURE__ */ s("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        k.map((x, p) => /* @__PURE__ */ s(
          "li",
          {
            id: `ms-app-${p}`,
            role: "option",
            "aria-selected": x.slug === t,
            onClick: () => j(x.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${x.slug === t ? "bg-primary-soft" : p === b ? "bg-card-bg" : "hover:bg-card-bg"}`,
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
        k.length === 0 && /* @__PURE__ */ s("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          l,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const Ka = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), ve = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function Wa({ mode: e, slug: t, onApp: a, switcher: n, models: i, client: l, batch: o, onRun: m }) {
  const w = Te(t), b = le.find((I) => I.id === e).title;
  return /* @__PURE__ */ s("section", { "aria-label": b, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: b }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(Ya, { mode: e, value: t, onChange: a }) })
    ] }),
    w ? /* @__PURE__ */ r(Xa, { app: w, mode: e, models: i, client: l, batch: o, onRun: m }, w.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Xa({ app: e, mode: t, models: a, client: n, batch: i, onRun: l }) {
  var J;
  const [o, m] = N(() => yt(e)), [w, b] = N(null), [I, A] = N(null), [y, k] = N(null), C = W(0);
  F(() => {
    m(yt(e)), b(null), A(null), k(null);
  }, [e]);
  const j = Ra(e), E = a.find((g) => g.name === j), R = Rt[e.template], x = Q(() => Da(e, o), [e, o]), p = JSON.stringify(x), f = (g) => m((B) => ({ ...B, ...g }));
  F(() => {
    if (!E) return;
    const g = ++C.current, B = setTimeout(() => {
      n.estimate(j, x).then((z) => {
        g === C.current && A(z);
      }).catch(() => {
        g === C.current && A(null);
      });
    }, 500);
    return () => clearTimeout(B);
  }, [p, E, n]);
  const M = E ? Ye(E, I) : null, P = Ot(e), $ = async () => {
    E && (k(null), await l({ model: j, endpointUrl: E.endpoint_url, mode: t, prompt: Dt(e, o) || e.name, payload: x, count: i, kind: Je(E.category), unitCost: M == null ? void 0 : M.current }));
  }, U = async () => {
    const g = Oa(e, o);
    if (g) {
      b(g);
      return;
    }
    b(null);
    const B = ((M == null ? void 0 : M.current) ?? 0) * i;
    if (B > Lt) {
      k(B);
      return;
    }
    await $();
  }, T = (g, B, z, h) => B && B.length > 0 ? /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: ve, children: g }),
    /* @__PURE__ */ r(qe, { label: g, options: Ka(B), value: z, onChange: h })
  ] }) : null;
  return /* @__PURE__ */ s("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !E && /* @__PURE__ */ s("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        j,
        "”, which is not in your catalog right now."
      ] }),
      P.map((g) => /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: ve, children: [
          /* @__PURE__ */ r("span", { children: g.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: g.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          Fe,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: o.uploads[g.id] ? [o.uploads[g.id]] : [],
            field: { prop: { name: `${g.kind}_${g.id}`, title: g.label, field: g.kind }, kind: "media", required: !g.optional },
            onUrls: (B) => f({ uploads: { ...o.uploads, [g.id]: B[0] ?? "" } }),
            onError: b
          }
        )
      ] }, g.id)),
      e.presets && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: ve, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(qe, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((g) => ({ value: g.id, label: g.label, hint: g.hint }))], value: o.preset, onChange: (g) => m(xt(e, o, String(g))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (J = e.sliders) == null ? void 0 : J.map((g) => /* @__PURE__ */ s("div", { className: "mb-4", children: [
        /* @__PURE__ */ s("div", { className: ve, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${g.id}`, children: g.label }),
          /* @__PURE__ */ s("span", { className: "tabular-nums text-primary", children: [
            o.sliders[g.id] ?? 0,
            g.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${g.id}`, type: "range", min: g.min, max: g.max, step: g.step, value: o.sliders[g.id] ?? 0, className: "w-full", onChange: (B) => f({ sliders: { ...o.sliders, [g.id]: Number(B.target.value) } }) })
      ] }, g.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => m(xt(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: ve, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: o.refinement, onChange: (g) => f({ refinement: g.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      T("Aspect Ratio", R.aspect, o.aspect, (g) => f({ aspect: g })),
      T(e.template === "seedream" ? "Output Resolution" : "Resolution", R.resolution, o.resolution, (g) => f({ resolution: g })),
      T("Quality Level", R.quality, o.quality, (g) => f({ quality: String(g) })),
      T("Duration", R.duration, o.duration, (g) => f({ duration: Number(g) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && T("Target Face Index", $a, o.targetIndex, (g) => f({ targetIndex: Number(g) })),
      e.template === "video-face-swap" && T("Target Gender Filter", Ea, o.gender, (g) => f({ gender: String(g) })),
      e.template === "bg-remover" && /* @__PURE__ */ s($e, { children: [
        T("Background Color", Ta, o.background, (g) => f({ background: String(g) })),
        T("Output Container & Codec", _a, o.container, (g) => f({ container: String(g) })),
        /* @__PURE__ */ s("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": o.keepAudio, onClick: () => f({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      w && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: w }),
      y !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(y) }),
        " (",
        i,
        " × ",
        ae((M == null ? void 0 : M.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void $(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => k(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !E, onClick: () => void U(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(We, { width: 16, height: 16, className: "shrink-0" }),
        ja(e),
        i > 1 ? ` ×${i}` : "",
        M && M.current > 0 && /* @__PURE__ */ s("span", { className: "font-normal", children: [
          "(",
          ae(M.current * i),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function vt({ view: e, onChange: t }) {
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
function Qa() {
  try {
    const e = window.location.search, t = Pt(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return er(a) ? a : null;
  } catch {
    return null;
  }
}
const we = {
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
function wt(e) {
  if (!He(e)) return { view: "models", app: null };
  try {
    const a = Pt(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = we.get(`muapi-studio:app:${e}`);
  return { view: we.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Te(t) ? t : null };
}
function Za({ scope: e, apiBase: t = "/api/muapi", initialTab: a = "image", showHeader: n = !0, title: i = "Studio", teamId: l, theme: o = "lime", layout: m, apiKey: w, onRequestApiKey: b, getHeaders: I, connected: A, fetchImpl: y, features: k, className: C = "", onTabChange: j }) {
  const E = A === !1 || w === "" || w === null, R = W(I);
  R.current = I;
  const [x, p] = N(!1), f = Q(() => new Jt(t, l, { apiKey: w || void 0, getHeaders: () => {
    var S;
    return ((S = R.current) == null ? void 0 : S.call(R)) ?? {};
  }, fetchImpl: y, onKeyRejected: () => p(!0) }), [t, l, w, y]);
  F(() => p(!1), [f]);
  const [M, P] = N({ library: !0, deleteMedia: !0 }), $ = Q(() => ({ library: M.library && (k == null ? void 0 : k.library) !== !1, deleteMedia: (k == null ? void 0 : k.deleteMedia) !== !1 }), [M, k == null ? void 0 : k.library, k == null ? void 0 : k.deleteMedia]), U = m ?? Xt(o), [T, J] = N(() => Qa() ?? a), [g, B] = N(4), [z, h] = N(null), [u, d] = N(null), [v, L] = N(null), c = Z(() => {
    f.balance().then(L).catch(() => L(null));
  }, [f]), [O, te] = N(null), q = mr(f, z, c, e), oe = Q(() => sr(q.items), [q.items]);
  F(() => {
    E || (d(null), h(null), f.models().then(h).catch((S) => d(S.message)), c(), (k == null ? void 0 : k.library) !== !1 && f.probe().then(P));
  }, [f, c, E, k == null ? void 0 : k.library]);
  const [re, ce] = N(() => wt(T)), ye = (S, D) => {
    try {
      window.history.replaceState(null, "", za(window.location, S, D));
    } catch {
    }
  }, _e = (S) => {
    const D = wt(S);
    J(S), ce(D), j == null || j(S), ye(S, D.view === "apps" ? D.app : null);
  }, X = (S) => {
    ce((D) => ({ ...D, view: S })), we.set(`muapi-studio:view:${T}`, S), ye(T, S === "apps" ? re.app : null);
  }, xe = (S) => {
    ce({ view: "apps", app: S }), we.set(`muapi-studio:app:${T}`, S), we.set(`muapi-studio:view:${T}`, "apps"), ye(T, S);
  }, Ne = Z(async (S) => {
    await q.run(S);
  }, [q.run]), de = Z((S) => {
    var Y;
    const D = z == null ? void 0 : z.find((ne) => ne.name === S);
    return D ? ((Y = D.sale) == null ? void 0 : Y.from) ?? D.cost ?? void 0 : void 0;
  }, [z]), Ge = Z((S) => {
    J(S.mode), ce((D) => ({ ...D, view: "models" })), te({ model: S.model, inputs: S.inputs, nonce: Date.now() });
  }, []), _ = Z((S) => {
    var ne;
    const D = z == null ? void 0 : z.find((ie) => ie.name === S.model);
    if (!D) return;
    const Y = ((ne = D.sale) == null ? void 0 : ne.from) ?? D.cost ?? 0;
    Y > 0.25 && !window.confirm(`Re-run ${S.model} for about $${Y.toFixed(2)}?`) || q.run({ model: S.model, endpointUrl: D.endpoint_url, mode: S.mode, prompt: S.prompt, payload: S.inputs, count: 1, unitCost: Y, kind: Je(D.category) });
  }, [z, q.run]);
  return /* @__PURE__ */ s("div", { className: `ms-root ${C}`.trim(), style: Wt(o), "data-layout": U, "data-btn": Qt(o), children: [
    n && /* @__PURE__ */ s("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: i }),
      v && /* @__PURE__ */ s("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(v.balance) })
      ] })
    ] }),
    E ? /* @__PURE__ */ s("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      b && /* @__PURE__ */ r("button", { type: "button", onClick: b, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ s(Nt.Provider, { value: $, children: [
      x && /* @__PURE__ */ s("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        b && /* @__PURE__ */ r("button", { type: "button", onClick: b, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ s("div", { className: `flex min-h-0 flex-1 flex-col ${U === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(ba, { mode: T, onChange: _e, layout: U, onChangeKey: b }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: u ? /* @__PURE__ */ s("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          u
        ] }) : z ? /* @__PURE__ */ s($e, { children: [
          re.view === "apps" && He(T) ? /* @__PURE__ */ r(Wa, { mode: T, slug: re.app, onApp: xe, switcher: /* @__PURE__ */ r(vt, { view: "apps", onChange: X }), models: z, client: f, batch: g, onRun: Ne }) : /* @__PURE__ */ r(fa, { mode: T, models: z, client: f, batch: g, onRun: Ne, usage: oe, reuse: O, switcher: He(T) ? /* @__PURE__ */ r(vt, { view: "models", onChange: X }) : void 0 }),
          /* @__PURE__ */ r(Gr, { mode: T, items: q.items, batch: g, onBatch: B, onLabel: q.setLabel, onRemove: q.remove, onReuse: Ge, onRerun: _, onDeleteMedia: q.deleteMedia, onLoadMore: q.loadMore, hasMore: q.hasMore, loadingMore: q.loadingMore, serverError: q.serverError, estimateFor: de })
        ] }) : /* @__PURE__ */ s("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(be, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function rn(e) {
  const t = e.accountId ?? cr(e.apiKey);
  return /* @__PURE__ */ r(Za, { scope: t, ...e }, t);
}
export {
  me as ApiError,
  Jt as MuapiClient,
  rn as MuapiStudio,
  Kt as THEMES,
  Yt as cyanTheme,
  Xt as defaultLayout,
  Je as generationKind,
  Pe as limeTheme,
  et as pollUntilDone,
  Ct as resolveTheme,
  cr as scopeOfKey,
  Wt as themeStyle
};
