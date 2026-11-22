import { jsx as r, jsxs as l, Fragment as $e } from "react/jsx-runtime";
import { createContext as jt, useContext as Pt, useState as k, useRef as W, useEffect as F, useCallback as ee, useMemo as Q, createElement as Vt, useId as Ut, useLayoutEffect as qt } from "react";
function Ft(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
class me extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function Bt(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class zt {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    var y, w;
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [f, I] of Object.entries(await this.opts.getHeaders())) n.set(f, I);
    const s = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), i = await s.text();
    let o = null;
    try {
      o = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!s.ok && Ft(s.status, o, i) && !t.startsWith("/app/") && ((w = (y = this.opts).onKeyRejected) == null || w.call(y)), !s.ok) throw new me(Bt(o, `${s.status} ${s.statusText}`), s.status);
    if (o === null && i.trim()) throw new me("Unexpected non-JSON response from the server", 502);
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
    const s = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(a)
    }), i = s.request_id || s.id;
    if (!i) throw new me("The API did not return a request id", 502);
    return { requestId: i, cost: (o = s.cost) == null ? void 0 : o.amount_usd };
  }
  async poll(t) {
    var o;
    const a = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), n = String(a.status || "").toLowerCase(), s = ["completed", "succeeded"].includes(n) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(n) ? "failed" : n === "pending" ? "pending" : "processing", i = Array.isArray(a.outputs) ? a.outputs : a.url ? [a.url] : [];
    return { status: s, outputs: i, error: a.error || void 0, cost: (o = a.cost) == null ? void 0 : o.amount_usd };
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
    var i;
    const a = new FormData();
    a.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: a }), s = n.url || n.file_url || ((i = n.data) == null ? void 0 : i.url);
    if (!s) throw new me("Upload returned no URL", 502);
    return s;
  }
}
async function Ht(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: s = 15 * 60 * 1e3, signal: i, onUpdate: o } = a, y = Date.now();
  let w = 0;
  for (; Date.now() - y < s; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const f = await e.poll(t);
      if (w = 0, o == null || o(f), f.status === "completed" || f.status === "failed") return f;
    } catch (f) {
      if (++w >= 5) throw f;
    }
    await new Promise((f) => setTimeout(f, n));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const wt = jt({ library: !0, deleteMedia: !0 }), kt = () => Pt(wt), je = {
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
}, Jt = {
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
}, Yt = { lime: je, cyan: Jt }, Ze = {
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
function Nt(e = "lime") {
  return typeof e == "string" ? Yt[e] ?? je : { ...je, ...e };
}
function Kt(e = "lime") {
  const t = Nt(e), a = {};
  for (const n of Object.keys(Ze)) a[Ze[n]] = t[n];
  return a;
}
function Wt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const Xt = (e = "lime") => Nt(e).buttonStyle, le = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], Qt = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function He(e) {
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
const Zt = (e) => !!e && le.some((t) => t.id === e);
function er(e, t) {
  const a = le.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const tr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function St(e, t, a = {}) {
  const n = (i) => {
    var o;
    return ((o = i.sale) == null ? void 0 : o.from) ?? i.cost ?? 1 / 0;
  }, s = [...e];
  return t === "a-z" ? s.sort((i, o) => i.name.localeCompare(o.name)) : t === "price-asc" ? s.sort((i, o) => n(i) - n(o)) : t === "price-desc" ? s.sort((i, o) => n(o) - n(i)) : t === "most-used" ? s.filter((i) => {
    var o;
    return (((o = a.usage) == null ? void 0 : o[i.name]) ?? 0) > 0;
  }).sort((i, o) => (a.usage[o.name] ?? 0) - (a.usage[i.name] ?? 0)) : t === "favourites" ? s.filter((i) => {
    var o;
    return (o = a.favorites) == null ? void 0 : o.includes(i.name);
  }) : s.sort((i, o) => +!!o.sale - +!!i.sale);
}
const rr = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function ar(e, t) {
  var n, s;
  const a = (n = t.find((i) => i.name === e)) == null ? void 0 : n.group_of;
  return ((s = le.find((i) => a && i.groups.includes(a))) == null ? void 0 : s.id) ?? "ai-tools";
}
function nr(e, t, a = {}) {
  var i;
  const n = e.output ?? {}, s = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: ar(e.model, t),
    prompt: typeof s.prompt == "string" ? s.prompt : "",
    inputs: s,
    status: rr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: n.error || void 0,
    cost: (i = n.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function or(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Set(e.map((i) => i.requestId).filter(Boolean));
  return [...e, ...t.filter((i) => !i.requestId || !n.has(i.requestId))].filter((i) => !(i.requestId && a.has(i.requestId))).sort((i, o) => o.createdAt - i.createdAt);
}
function ir(e) {
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
function Je(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Ct = "muapi-studio:history:v1", sr = 200, pe = (e, t) => t ? `${e}:${t}` : e;
function lr(e) {
  if (!e) return "";
  let t = 2166136261, a = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, a = Math.imul(a ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${a.toString(36)}`;
}
function et(e = "") {
  try {
    const t = localStorage.getItem(pe(Ct, e));
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function cr(e, t = "") {
  try {
    localStorage.setItem(pe(Ct, t), JSON.stringify(e.slice(0, sr)));
  } catch {
  }
}
const dr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, tt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, rt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, at = "muapi-studio:labels:v1", nt = "muapi-studio:hidden:v1";
function ur(e, t, a, n = "") {
  const [s, i] = k(() => et(n)), [o, y] = k([]), [w, f] = k(null), [I, A] = k(!1), [g, v] = k(null), C = W(!1), [D, E] = k(() => tt(pe(at, n), {})), [L, b] = k(() => tt(pe(nt, n), [])), u = W(/* @__PURE__ */ new Set()), p = W(new AbortController()), M = W([]);
  M.current = t ?? [], F(() => cr(s, n), [s, n]), F(() => rt(pe(at, n), D), [D, n]), F(() => rt(pe(nt, n), L), [L, n]), F(() => (p.current = new AbortController(), () => p.current.abort()), []);
  const O = ee((c, x) => i((S) => S.map((V) => V.id === c ? { ...V, ...x } : V)), []), $ = ee(async (c, x) => {
    if (!u.current.has(c)) {
      u.current.add(c);
      try {
        const S = await Ht(e, x, {
          signal: p.current.signal,
          onUpdate: (V) => O(c, { status: V.status, outputs: V.outputs, error: V.error, cost: V.cost })
        });
        O(c, { status: S.status, outputs: S.outputs, error: S.error, cost: S.cost }), a == null || a();
      } catch (S) {
        S.name !== "AbortError" && O(c, { status: "failed", error: S.message });
      } finally {
        u.current.delete(c);
      }
    }
  }, [e, O, a]);
  F(() => {
    for (const c of et(n)) (c.status === "pending" || c.status === "processing") && c.requestId && $(c.id, c.requestId);
  }, []);
  const P = ee(async (c = !1) => {
    if (!C.current) {
      A(!0), v(null);
      try {
        const x = await e.history(c ? void 0 : w ?? void 0), S = x.items.map((V) => nr(V, M.current));
        y((V) => c ? S : [...V, ...S]), f(x.next_cursor);
      } catch (x) {
        x instanceof me && [403, 404, 405].includes(x.status) ? (C.current = !0, f(null)) : v(x.message);
      } finally {
        A(!1);
      }
    }
  }, [e, w]), _ = W(!1);
  F(() => {
    t && !_.current && (_.current = !0, P(!0));
  }, [t, P]);
  const J = ee((c) => {
    const x = Array.from({ length: c.count }, () => ({
      id: dr(),
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
    return i((S) => [...x, ...S]), Promise.all(x.map(async (S) => {
      try {
        const { requestId: V, cost: d } = await e.submit(c.endpointUrl, c.payload, c.kind);
        O(S.id, { requestId: V, ...d !== void 0 ? { cost: d } : {} }), await $(S.id, V);
      } catch (V) {
        O(S.id, { status: "failed", error: V.message });
      }
    }));
  }, [e, O, $]), h = Q(() => {
    const c = (x) => ({ ...x, label: x.requestId && D[x.requestId] || x.label });
    return or(s.map(c), o.map(c), new Set(L));
  }, [s, o, D, L]), B = ee((c, x) => {
    c.requestId && E((S) => {
      const V = { ...S };
      return x ? V[c.requestId] = x : delete V[c.requestId], V;
    }), O(c.id, { label: x });
  }, [O]), z = ee((c) => {
    i((x) => x.filter((S) => S.id !== c.id)), c.requestId && b((x) => [.../* @__PURE__ */ new Set([...x, c.requestId])]);
  }, []), m = ee(async (c) => {
    c.requestId && (await e.deleteMedia(c.requestId), O(c.id, { outputs: [] }), y((x) => x.map((S) => S.requestId === c.requestId ? { ...S, outputs: [] } : S)));
  }, [e, O]);
  return { items: h, run: J, setLabel: B, remove: z, deleteMedia: m, loadMore: () => P(!1), hasMore: !!w, loadingMore: I, serverError: g };
}
const mr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function At(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : mr.test(e) ? "file" : "image" : "text";
}
function pr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const hr = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), K = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Me = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), fr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), gr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), br = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), Ye = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), yr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Ke = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), ot = ({ filled: e, ...t }) => /* @__PURE__ */ r(K, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), We = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Ee = ({ up: e, ...t }) => /* @__PURE__ */ r(K, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), xr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), vr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), Pe = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ke = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), ge = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), It = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), wr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), be = (e) => /* @__PURE__ */ r(K, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), kr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Nr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Sr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), it = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Mt({ url: e }) {
  return /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Ye, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let st = null;
const Cr = () => st ?? (st = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw st = null, e;
}));
function Ar({ url: e, hidden: t = !1 }) {
  const [a, n] = k("loading"), s = W(null);
  return F(() => {
    let i = !0;
    return n("loading"), Cr().catch(() => i && n("failed")), () => {
      i = !1;
    };
  }, [e]), F(() => {
    const i = s.current;
    if (!i) return;
    const o = () => n("ready"), y = () => n("failed");
    return i.addEventListener("load", o), i.addEventListener("error", y), () => {
      i.removeEventListener("load", o), i.removeEventListener("error", y);
    };
  }), a === "failed" ? /* @__PURE__ */ r(Mt, { url: e }) : /* @__PURE__ */ l("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    Vt("model-viewer", {
      ref: s,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    a === "loading" && /* @__PURE__ */ l("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(be, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(Ye, { width: 14, height: 14 }) })
  ] });
}
const Ir = ["All", "Approved", "Rejected", "Unlabeled"], Mr = [1, 2, 4, 6, 8];
function $r({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, s = At(e);
  return s === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: pr(e) }) : s === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : s === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : s === "3d" ? hr(e) ? /* @__PURE__ */ r(Ar, { url: e, hidden: t }) : /* @__PURE__ */ r(Mt, { url: e }) : s === "file" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Pe, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function Er({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: s, onRerun: i, onDeleteMedia: o, onOpen: y, estimateFor: w }) {
  const [f, I] = k(0), A = e.outputs.length, g = Math.min(f, Math.max(A - 1, 0)), v = e.outputs[g], C = !!v && At(v) === "text", [D, E] = k(!1), [L, b] = k(null), u = kt(), p = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", M = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ l("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && v ? /* @__PURE__ */ l("div", { className: "relative", children: [
      /* @__PURE__ */ r($r, { url: v, hidden: t, onOpen: () => y(v) }),
      A > 1 && /* @__PURE__ */ l("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Previous output", disabled: g === 0, onClick: () => I(g - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ l("span", { "aria-live": "polite", children: [
          g + 1,
          " / ",
          A
        ] }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Next output", disabled: g === A - 1, onClick: () => I(g + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ l("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(ge, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ l("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(be, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ l("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ l("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ae(e.cost) : e.status === "completed" && (w == null ? void 0 : w(e.model)) !== void 0 ? `est. ${ae(w(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && v && (C ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(v)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Pe, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: v, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${M} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Pe, { width: 14, height: 14 }) })),
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
        /* @__PURE__ */ r("button", { type: "button", onClick: () => s(e), title: "Load this model and settings back into the form", className: p, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: p, children: "Re-run" }),
        e.status === "completed" && v && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var O;
          (O = navigator.clipboard) == null || O.writeText(v).then(() => {
            E(!0), setTimeout(() => E(!1), 1500);
          });
        }, className: p, children: D ? "Copied" : C ? "Copy text" : "Copy link" })
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
          u.deleteMedia && e.requestId && e.status === "completed" && v && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (b(null), o(e).catch((O) => b(O.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Tr({ url: e, onClose: t }) {
  return F(() => {
    const a = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ l("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(ge, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function _r({ mode: e, items: t, batch: a, onBatch: n, onLabel: s, onRemove: i, onReuse: o, onRerun: y, onDeleteMedia: w, onLoadMore: f, hasMore: I, loadingMore: A, serverError: g, estimateFor: v }) {
  const [C, D] = k("All"), [E, L] = k(""), [b, u] = k(!1), [p, M] = k(null), O = Q(() => {
    const $ = E.trim().toLowerCase();
    return t.filter((P) => P.mode !== e || C === "Approved" && P.label !== "approved" || C === "Rejected" && P.label !== "rejected" || C === "Unlabeled" && P.label !== null ? !1 : !$ || P.prompt.toLowerCase().includes($) || P.model.toLowerCase().includes($));
  }, [t, e, C, E]);
  return /* @__PURE__ */ l("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Ir.map(($) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": C === $,
          onClick: () => D($),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${C === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ l("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(We, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: E, onChange: ($) => L($.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Mr.map(($) => /* @__PURE__ */ r(
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
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": b, "aria-label": b ? "Show previews" : "Hide previews", title: b ? "Show previews" : "Hide previews", onClick: () => u(($) => !$), className: b ? "text-primary" : "text-secondary hover:text-fg", children: b ? /* @__PURE__ */ r(xr, { width: 18, height: 18 }) : /* @__PURE__ */ r(vr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      O.length === 0 ? /* @__PURE__ */ l("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ke, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some(($) => $.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some(($) => $.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: O.map(($) => /* @__PURE__ */ r(Er, { g: $, hidden: b, onLabel: s, onRemove: i, onReuse: o, onRerun: y, onDeleteMedia: w, onOpen: M, estimateFor: v }, $.id)) }),
      g && /* @__PURE__ */ l("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        g
      ] }),
      I && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: A, onClick: f, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: A ? "Loading…" : "Load more history" }) }),
      p && /* @__PURE__ */ r(Tr, { url: p, onClose: () => M(null) })
    ] })
  ] });
}
const Gr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Lr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Rr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Gr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Lr.test(e.name) ? "media" : "text" : "text";
}
function lt(e) {
  var o, y;
  const t = (y = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : y.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), s = [...n.filter((w) => a[w]), ...Object.keys(a).filter((w) => !n.includes(w))], i = new Set(e.required_fields ?? []);
  return s.map((w) => ({ prop: { ...a[w], name: w }, kind: Rr({ ...a[w], name: w }), required: i.has(w) }));
}
function Le(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: s, required: i } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : i && (s === "textarea" || s === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const he = (e) => `__auto:${e}`, ct = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Ve = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function dt(e, t) {
  const a = {};
  for (const { prop: n, kind: s } of e) {
    if (t[he(n.name)] === !0) continue;
    const i = t[n.name] ?? n.default;
    if (!Ve(i))
      if (s === "number") {
        const o = Number(i);
        Number.isFinite(o) && (a[n.name] = o);
      } else if (s === "json" && typeof i == "string")
        try {
          a[n.name] = JSON.parse(i);
        } catch {
        }
      else a[n.name] = i;
  }
  return a;
}
function Dr(e, t) {
  for (const { prop: a, kind: n, required: s } of e) {
    if (t[he(a.name)] === !0) continue;
    const i = t[a.name] ?? a.default, o = a.title || a.name;
    if (s && Ve(i)) return `${o} is required`;
    if (n === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !Ve(i)) {
      const y = Number(i);
      if (!Number.isFinite(y)) return `${o} must be a number`;
      if (a.minValue !== void 0 && y < a.minValue) return `${o} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && y > a.maxValue) return `${o} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const Or = 12, Xe = 240, Se = (e) => `${typeof e}:${e}`, jr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Pr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Vr(e, t, a = Xe) {
  return e >= a || e >= t ? "down" : "up";
}
const Ur = 36, qr = 48;
function Fr(e, t) {
  return Math.min(Xe, Math.max(1, e) * Ur + 8) + (t ? qr : 0);
}
function Br(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const ut = "Auto (let model decide)", Re = "__auto__";
function Ue({ id: e, label: t, options: a, value: n, onChange: s, allowAuto: i, auto: o, onAuto: y, combobox: w }) {
  const f = Ut(), I = e ?? `ms-dd-${f}`, A = w ?? a.length > Or, [g, v] = k(!1), [C, D] = k(""), [E, L] = k(0), [b, u] = k("down"), p = W(null), M = W(null), O = W(null), $ = a.find((c) => n !== void 0 && Se(c.value) === Se(n)), P = Q(() => A ? Pr(a, C) : a, [A, a, C]), _ = Q(
    () => [...i ? [{ key: Re, label: ut, value: Re, isAuto: !0 }] : [], ...P.map((c) => ({ key: Se(c.value), label: c.label, hint: c.hint, value: c.value }))],
    [i, P]
  ), J = o ? Re : $ ? Se($.value) : void 0, h = () => {
    v(!1), D("");
  }, B = (c) => {
    c.isAuto ? y == null || y() : s(c.value), h();
  };
  qt(() => {
    if (!g || !p.current) return;
    const c = p.current.getBoundingClientRect();
    let x = p.current.parentElement;
    for (; x && !/(auto|scroll)/.test(getComputedStyle(x).overflowY); ) x = x.parentElement;
    const S = x ? x.getBoundingClientRect() : null, V = Math.min(window.innerHeight, S ? S.bottom : window.innerHeight), d = Math.max(0, S ? S.top : 0);
    u(Vr(V - c.bottom, c.top - d, Fr(a.length + (i ? 1 : 0), A)));
  }, [g]), F(() => {
    if (!g) return;
    const c = _.findIndex((x) => x.key === J);
    L(c >= 0 ? c : 0);
  }, [g, C]), F(() => {
    var c, x, S;
    g && ((S = (x = (c = M.current) == null ? void 0 : c.querySelector(`[data-i="${E}"]`)) == null ? void 0 : x.scrollIntoView) == null || S.call(x, { block: "nearest" }));
  }, [E, g]), F(() => {
    var c;
    g && A && ((c = O.current) == null || c.focus());
  }, [g, A]), F(() => {
    if (!g) return;
    const c = (x) => {
      var S;
      (S = p.current) != null && S.contains(x.target) || h();
    };
    return document.addEventListener("mousedown", c), () => document.removeEventListener("mousedown", c);
  }, [g]);
  const z = (c) => {
    if (!g) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(c.key) && (c.preventDefault(), v(!0));
      return;
    }
    if (c.key === "Escape") {
      c.preventDefault(), c.stopPropagation(), h();
      return;
    }
    if (c.key === "Enter") {
      c.preventDefault(), _[E] && B(_[E]);
      return;
    }
    if (c.key === "Tab") {
      h();
      return;
    }
    if (c.key === " " && !A) {
      c.preventDefault(), _[E] && B(_[E]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(c.key) && (c.preventDefault(), L((x) => Br(x, c.key, _.length)));
  }, m = o ? ut : ($ == null ? void 0 : $.label) ?? "Select…";
  return /* @__PURE__ */ l("div", { ref: p, className: "relative w-full", onKeyDown: z, children: [
    /* @__PURE__ */ l(
      "button",
      {
        id: I,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": g,
        "aria-label": `${t}: ${m}`,
        "aria-controls": `${I}-list`,
        onClick: () => v((c) => !c),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${g ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: m }),
          /* @__PURE__ */ r(Ee, { up: g, width: 16, height: 16 })
        ]
      }
    ),
    g && /* @__PURE__ */ l("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${b === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      A && /* @__PURE__ */ r(
        "input",
        {
          ref: O,
          value: C,
          onChange: (c) => D(c.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${I}-list`,
          "aria-activedescendant": _[E] ? `${I}-o${E}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ l("ul", { id: `${I}-list`, ref: M, role: "listbox", "aria-label": t, style: { maxHeight: Xe }, className: "overflow-y-auto", children: [
        _.map((c, x) => {
          const S = c.key === J;
          return /* @__PURE__ */ l(
            "li",
            {
              id: `${I}-o${x}`,
              "data-i": x,
              role: "option",
              "aria-selected": S,
              onMouseEnter: () => L(x),
              onClick: () => B(c),
              className: `flex cursor-pointer items-center justify-between gap-2 ${c.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${S ? "bg-primary text-primary-ink" : x === E ? "bg-card-bg" : ""} ${c.isAuto && !S ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ l("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: c.label }),
                  c.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${S ? "opacity-70" : "text-muted"}`, children: c.hint })
                ] }),
                S && /* @__PURE__ */ r(ke, { width: 14, height: 14 })
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
const zr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Hr({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Me, {}) });
}
function Jr({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: s }) {
  const [i, o] = k(a), [y, w] = k(""), [f, I] = k(1), [A, g] = k(null), [v, C] = k(null), [D, E] = k(!1), [L, b] = k([]), [u, p] = k(""), [M, O] = k(!1), $ = W(null), P = W(null), _ = ee(async () => {
    E(!0), C(null);
    try {
      g(await e.mediaLibrary({ mediaType: i, search: y, page: f }));
    } catch (m) {
      C(m.message);
    } finally {
      E(!1);
    }
  }, [e, i, y, f]);
  F(() => {
    const m = setTimeout(_, y ? 300 : 0);
    return () => clearTimeout(m);
  }, [_, y]), F(() => {
    I(1);
  }, [i, y]), F(() => {
    var x;
    const m = document.activeElement;
    (x = $.current) == null || x.focus();
    const c = (S) => {
      if (S.key === "Escape") {
        S.stopPropagation(), s();
        return;
      }
      if (S.key !== "Tab" || !$.current) return;
      const V = [...$.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!V.length) return;
      const d = V[0], U = V[V.length - 1];
      S.shiftKey && document.activeElement === d ? (S.preventDefault(), U.focus()) : !S.shiftKey && document.activeElement === U && (S.preventDefault(), d.focus());
    };
    return document.addEventListener("keydown", c), () => {
      var S;
      document.removeEventListener("keydown", c), (S = m == null ? void 0 : m.focus) == null || S.call(m);
    };
  }, [s]);
  const J = (m) => b((c) => c.includes(m) ? c.filter((x) => x !== m) : t === 1 ? [m] : c.length < t ? [...c, m] : c), h = async (m) => {
    if (m.length) {
      E(!0), C(null);
      try {
        for (const c of m) {
          const x = await e.upload(c);
          await e.saveToLibrary({ url: x, name: c.name, mime_type: c.type || void 0, size_bytes: c.size, media_type: c.type.startsWith("video") ? "video" : c.type.startsWith("audio") ? "audio" : c.type.startsWith("image") ? "image" : "archive" });
        }
        await _();
      } catch (c) {
        C(c.message), E(!1);
      }
    }
  }, B = async () => {
    var c;
    const m = u.trim();
    if (!/^https?:\/\//i.test(m)) {
      C("Enter a full http(s) URL");
      return;
    }
    E(!0), C(null);
    try {
      const x = ((c = m.split("?")[0].split(".").pop()) == null ? void 0 : c.toLowerCase()) ?? "", S = ["mp4", "webm", "mov"].includes(x) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(x) ? "audio" : ["zip", "rar", "7z"].includes(x) ? "archive" : "image";
      await e.saveToLibrary({ url: m, name: m.split("/").pop() || "link", media_type: S }), p(""), O(!1), await _();
    } catch (x) {
      C(x.message), E(!1);
    }
  }, z = async (m) => {
    if (window.confirm(`Delete "${m.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(m.id), b((c) => c.filter((x) => x !== m.url)), await _();
      } catch (c) {
        C(c.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (m) => {
    m.target === m.currentTarget && s();
  }, children: /* @__PURE__ */ l("div", { ref: $, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ l("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Me, {}) }),
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
      /* @__PURE__ */ r("input", { ref: P, type: "file", hidden: !0, multiple: !0, onChange: (m) => {
        const c = Array.from(m.target.files ?? []);
        m.target.value = "", h(c);
      } }),
      /* @__PURE__ */ l("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var m;
        return (m = P.current) == null ? void 0 : m.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ r(It, { width: 14, height: 14 }),
        /* @__PURE__ */ r("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: s, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(ge, {}) })
    ] }),
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: zr.map((m) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": i === m.id, onClick: () => o(m.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === m.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: m.label }, m.id)) }),
      /* @__PURE__ */ r("input", { value: y, onChange: (m) => w(m.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": M, onClick: () => O((m) => !m), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    M && /* @__PURE__ */ l("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: u, onChange: (m) => p(m.target.value), onKeyDown: (m) => m.key === "Enter" && void B(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void B(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      v && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: v }),
      D && !A ? /* @__PURE__ */ l("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(be, {}),
        " Loading…"
      ] }) : A != null && A.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: A.items.map((m) => {
        const c = L.includes(m.url);
        return /* @__PURE__ */ l("li", { className: `group relative overflow-hidden rounded-card border ${c ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": c, "aria-label": `${c ? "Deselect" : "Select"} ${m.name ?? "file"}`, onClick: () => J(m.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Hr, { a: m }) }),
          c && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(ke, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${m.name ?? "file"}`, onClick: () => void z(m), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(ge, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: m.name ?? "", children: m.name })
        ] }, m.id);
      }) }) : /* @__PURE__ */ l("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Me, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      A && A.total_pages > 1 && /* @__PURE__ */ l("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: f <= 1, onClick: () => I((m) => m - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        f,
        " of ",
        A.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: f >= A.total_pages, onClick: () => I((m) => m + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
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
        n(L), s();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(ke, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const $t = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Yr = (e, t = "") => {
  const a = $t(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Kr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function Wr(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, s) => void e.saveToLibrary({ url: a[s], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: Kr(n) }).catch(() => {
  })), a;
}
function qe({ client: e, field: t, multiple: a, max: n, current: s, onUrls: i, onError: o }) {
  const y = W(null), [w, f] = k(!1), [I, A] = k(!1), [g, v] = k(!1), C = n - s.length, D = kt(), E = async (u) => {
    if (u.length) {
      f(!0);
      try {
        i(await Wr(e, a ? u.slice(0, Math.max(C, 1)) : u.slice(0, 1)));
      } catch (p) {
        o(p.message);
      } finally {
        f(!1);
      }
    }
  }, L = $t(t.prop.field, t.prop.name), b = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ l(
    "div",
    {
      onDragOver: (u) => {
        u.preventDefault(), A(!0);
      },
      onDragLeave: () => A(!1),
      onDrop: (u) => {
        u.preventDefault(), A(!1), E(Array.from(u.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${I ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: y, type: "file", hidden: !0, accept: L, multiple: a, onChange: (u) => {
          const p = Array.from(u.target.files ?? []);
          u.target.value = "", E(p);
        } }),
        (a ? C > 0 : !0) && /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ r(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: a ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: a ? void 0 : s[0] ?? "",
              defaultValue: void 0,
              onChange: a ? void 0 : (u) => i([u.target.value]),
              onKeyDown: a ? (u) => {
                u.key === "Enter" && u.currentTarget.value.trim() && (i([u.currentTarget.value.trim()]), u.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ r("button", { type: "button", disabled: w, onClick: () => {
            var u;
            return (u = y.current) == null ? void 0 : u.click();
          }, "aria-label": "Upload file", title: "Upload file", className: b, children: w ? /* @__PURE__ */ r(be, { width: 16, height: 16 }) : /* @__PURE__ */ r(It, { width: 16, height: 16 }) }),
          D.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => v(!0), "aria-label": "Choose from media library", title: "Media library", className: b, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        g && D.library && /* @__PURE__ */ r(Jr, { client: e, max: a ? Math.max(C, 1) : 1, initialType: Yr(t.prop.field, t.prop.name), onInsert: i, onClose: () => v(!1) })
      ]
    }
  );
}
function Xr({ field: e, values: t, onChange: a, client: n, onError: s, tagCount: i = 0 }) {
  const { prop: o, kind: y, required: w } = e, f = t[o.name], I = (u) => a(o.name, u), A = o.title || o.name, g = `ms-f-${o.name}`, v = f == null ? "" : String(f), C = Array.isArray(f) ? f : [], D = t[he(o.name)] === !0, E = W(null), L = (u) => {
    const p = E.current, M = typeof f == "string" ? f : "", O = (p == null ? void 0 : p.selectionStart) ?? M.length, $ = (p == null ? void 0 : p.selectionEnd) ?? O;
    I(M.slice(0, O) + u + " " + M.slice($)), requestAnimationFrame(() => {
      p == null || p.focus(), p == null || p.setSelectionRange(O + u.length + 1, O + u.length + 1);
    });
  };
  let b;
  if (y === "textarea" || y === "json")
    b = /* @__PURE__ */ l($e, { children: [
      /* @__PURE__ */ r("textarea", { ref: E, id: g, rows: y === "json" ? 4 : 5, value: typeof f == "string" ? f : f ? JSON.stringify(f, null, 2) : "", onChange: (u) => I(u.target.value), className: `w-full resize-y p-3 text-sm ${y === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && i > 0 && /* @__PURE__ */ l("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (u, p) => `@image${p + 1}`).map((u) => /* @__PURE__ */ r("button", { type: "button", onClick: () => L(u), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: u }, u))
      ] })
    ] });
  else if (y === "select") {
    const u = o.enum ?? [];
    b = /* @__PURE__ */ r(
      Ue,
      {
        id: g,
        label: A,
        options: jr(u),
        value: f,
        onChange: (p) => {
          I(p), a(he(o.name), !1);
        },
        allowAuto: ct(e),
        auto: D,
        onAuto: () => a(he(o.name), !0)
      }
    );
  } else if (y === "boolean") {
    const u = f === !0;
    b = /* @__PURE__ */ r(
      "button",
      {
        id: g,
        type: "button",
        role: "switch",
        "aria-checked": u,
        onClick: () => I(!u),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${u ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${u ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (y === "number") {
    const u = o.minValue !== void 0 && o.maxValue !== void 0;
    b = /* @__PURE__ */ l("div", { className: `flex items-center gap-3 ${D ? "opacity-40" : ""}`, children: [
      u && /* @__PURE__ */ r("input", { type: "range", disabled: D, "aria-label": `${A} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: v === "" ? o.minValue : Number(v), onChange: (p) => I(Number(p.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: g, type: "number", disabled: D, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: v, onChange: (p) => I(p.target.value === "" ? "" : Number(p.target.value)), className: `px-3 py-2 text-sm ${u ? "w-24" : "w-full"}` })
    ] });
  } else if (y === "media")
    b = /* @__PURE__ */ r(qe, { client: n, field: e, multiple: !1, max: 1, current: v ? [v] : [], onUrls: (u) => I(u[0]), onError: s });
  else if (y === "media-list") {
    const u = o.maxItems ?? 8;
    b = /* @__PURE__ */ l("div", { className: "space-y-2", children: [
      C.map((p, M) => /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${A} ${M + 1}`, value: p, onChange: (O) => I(C.map(($, P) => P === M ? O.target.value : $)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${A} ${M + 1}`, onClick: () => I(C.filter((O, $) => $ !== M)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(ge, { width: 14, height: 14 }) })
      ] }, M)),
      /* @__PURE__ */ r(qe, { client: n, field: e, multiple: !0, max: u, current: C, onUrls: (p) => I([...C, ...p].slice(0, u)), onError: s })
    ] });
  } else
    b = /* @__PURE__ */ r("input", { id: g, value: v, onChange: (u) => I(u.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ l("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ l("label", { htmlFor: g, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        A,
        o.description && /* @__PURE__ */ r("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ r(wr, { width: 13, height: 13 }) })
      ] }),
      ct(e) && y === "number" ? /* @__PURE__ */ l("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: D, onChange: (u) => a(he(o.name), u.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: y === "media-list" ? `${C.length}/${o.maxItems ?? 8} items${w ? " · required" : ""}` : w ? "* required" : "" })
    ] }),
    b
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
}, fe = "Other", Qr = 3, Zr = 2, ea = 20, ta = 2, ra = 4, aa = 40, na = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Et(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ce[t] ? Ce[t] : Ce[a] ? Ce[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? fe : na(a);
}
function oa(e) {
  const t = /* @__PURE__ */ new Map();
  for (const s of e) {
    const i = Et(s.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [s, i] of t)
    s === fe || i < Qr ? a += i : n.push({ id: s, label: s, count: i });
  return n.sort((s, i) => i.count - s.count || s.label.localeCompare(i.label)), a && n.push({ id: fe, label: fe, count: a }), n;
}
function Tt(e, t) {
  const a = Et(e.name);
  return t.some((n) => n.id === a) ? a : fe;
}
function ia(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function sa(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const mt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function la(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const s = mt.indexOf(n);
    return s < 0 ? mt.length : s;
  };
  return [...t].map(([n, s]) => ({ id: n, count: s })).sort((n, s) => a(n.id) - a(s.id) || s.count - n.count || n.id.localeCompare(s.id));
}
const se = "__favourites__", Z = "__all__";
function ca(e, t, a) {
  return e.filter((n) => {
    var s;
    return t.category !== Z && n.category !== t.category ? !1 : t.provider === se ? !!((s = t.favourites) != null && s.includes(n.name)) : t.provider === Z || Tt(n, a) === t.provider;
  });
}
const da = (e, t) => t.filter((a) => a.id !== fe).length >= Zr && e.length >= ea;
function ua(e) {
  const t = la(e);
  return e.length >= aa ? t.filter((a) => a.count >= ra) : t;
}
const Ae = 200;
function ma({ model: e }) {
  const t = Je(e);
  return t ? /* @__PURE__ */ l("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ae(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ae(t.current)
  ] }) : null;
}
const pt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, ht = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function De({ label: e, active: t, onClick: a, hue: n, children: s }) {
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
      children: s
    }
  );
}
function pa({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: s, usage: i, showGroup: o, scope: y = "default" }) {
  var V;
  const [w, f] = k(!1), [I, A] = k(""), [g, v] = k("popular"), [C, D] = k(!1), E = W(null), L = Q(() => oa(e), [e]), b = Q(() => ua(e), [e]), u = da(e, L), p = b.length >= ta, [M, O] = k(() => pt(`muapi-studio:provider:${y}`, Z)), [$, P] = k(() => pt(`muapi-studio:category:${y}`, Z)), _ = u && (M === se || M === Z || L.some((d) => d.id === M)) ? M : Z, J = p && ($ === Z || b.some((d) => d.id === $)) ? $ : Z, h = (d) => {
    O(d), ht(`muapi-studio:provider:${y}`, d);
  }, B = (d) => {
    P(d), ht(`muapi-studio:category:${y}`, d);
  }, z = W(null);
  F(() => {
    w || D(!1);
  }, [w]), F(() => {
    if (!w) return;
    const d = (te) => {
      var q;
      (q = E.current) != null && q.contains(te.target) || f(!1);
    }, U = (te) => {
      te.key === "Escape" && f(!1);
    };
    return document.addEventListener("mousedown", d), document.addEventListener("keydown", U), () => {
      document.removeEventListener("mousedown", d), document.removeEventListener("keydown", U);
    };
  }, [w]);
  const m = Q(() => {
    const d = I.trim().toLowerCase(), U = ca(e, { category: J, provider: _, favourites: n }, L), te = d ? U.filter((re) => re.name.toLowerCase().includes(d) || re.category.toLowerCase().includes(d)) : U, q = St(te, g, { usage: i, favorites: n });
    if (g === "favourites" || g === "most-used") return q;
    const oe = new Set(n);
    return [...q.filter((re) => oe.has(re.name)), ...q.filter((re) => !oe.has(re.name))];
  }, [e, I, g, n, i, J, _, L]), [c, x] = k(0);
  F(() => {
    var d, U;
    x(0), (U = (d = z.current) == null ? void 0 : d.scrollTo) == null || U.call(d, { top: 0 });
  }, [I, g, w, J, _]);
  const S = (d) => {
    d.key === "ArrowDown" ? (d.preventDefault(), x((U) => Math.min(U + 1, Math.min(m.length, Ae) - 1))) : d.key === "ArrowUp" ? (d.preventDefault(), x((U) => Math.max(U - 1, 0))) : d.key === "Enter" && m[c] && (d.preventDefault(), a(m[c].name), f(!1));
  };
  return F(() => {
    var d, U;
    (U = (d = document.getElementById(`ms-opt-${c}`)) == null ? void 0 : d.scrollIntoView) == null || U.call(d, { block: "nearest" });
  }, [c]), /* @__PURE__ */ l("div", { ref: E, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        onClick: () => f((d) => !d),
        "aria-haspopup": "listbox",
        "aria-expanded": w,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (V = (t ?? "?")[0]) == null ? void 0 : V.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Ee, { up: w, width: 16, height: 16 })
        ]
      }
    ),
    w && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      u && /* @__PURE__ */ l("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(De, { label: "All providers", active: _ === Z, onClick: () => h(Z), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(De, { label: "Favourites", active: _ === se, onClick: () => h(se), children: /* @__PURE__ */ r(ot, { width: 14, height: 14, filled: _ === se }) }),
        L.map((d) => /* @__PURE__ */ r(De, { label: `${d.label} (${d.count})`, active: _ === d.id, onClick: () => h(d.id), hue: sa(d.label), children: ia(d.label) }, d.id))
      ] }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        p && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: Z, label: "All" }, ...b.map((d) => ({ id: d.id, label: d.id }))].map((d) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": J === d.id,
            onClick: () => B(d.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${J === d.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: d.label
          },
          d.id
        )) }),
        /* @__PURE__ */ l("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ l("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(We, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: S, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${c}`, value: I, onChange: (d) => A(d.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ l("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": C,
                onClick: () => D((d) => !d),
                className: `flex h-full items-center rounded-ctl border px-3 ${C ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(kr, { width: 16, height: 16 })
              }
            ),
            C && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: tr.map((d) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ l(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": g === d.id,
                onClick: () => {
                  v(d.id), D(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${g === d.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  d.label,
                  g === d.id && /* @__PURE__ */ r(ke, { width: 14, height: 14 })
                ]
              }
            ) }, d.id)) })
          ] })
        ] }),
        (u || p) && /* @__PURE__ */ l("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ l("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            _ === se ? "Favourites" : "All models",
            " · ",
            m.length
          ] }),
          u && _ !== Z && _ !== se && /* @__PURE__ */ r("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: _ })
        ] }),
        /* @__PURE__ */ l("ul", { id: "ms-listbox", ref: z, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          m.slice(0, Ae).map((d, U) => {
            const te = d.name === t;
            return /* @__PURE__ */ r(
              "li",
              {
                id: `ms-opt-${U}`,
                role: "option",
                "aria-selected": te,
                onClick: () => {
                  a(d.name), f(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${te ? "bg-primary-soft" : U === c ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ l("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ r("div", { className: `min-w-0 flex-1 truncate text-sm ${te ? "text-primary" : ""}`, title: d.name, children: d.name }),
                    /* @__PURE__ */ r(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(d.name) ? "Remove favorite" : "Add favorite",
                        onClick: (q) => {
                          q.stopPropagation(), s(d.name);
                        },
                        className: n.includes(d.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ r(ot, { width: 15, height: 15, filled: n.includes(d.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ l("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ r("span", { className: "truncate text-[10px] text-secondary", children: o ? `${d.group_of} · ${d.category}` : u && _ === Z ? `${Tt(d, L)} · ${d.category}` : d.category }),
                    /* @__PURE__ */ r(ma, { model: d })
                  ] })
                ] })
              },
              d.name
            );
          }),
          m.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: g === "favourites" ? "No favourites yet. Tap the heart on a model." : g === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${I}”.` }),
          m.length > Ae && /* @__PURE__ */ l("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ae,
            " of ",
            m.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const ft = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, Oe = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, _t = 0.25;
function ha({ mode: e, models: t, client: a, batch: n, onRun: s, usage: i, reuse: o, switcher: y }) {
  const w = le.find((T) => T.id === e), f = Q(() => er(t, e), [t, e]), [I, A] = k(), [g, v] = k(null), [C, D] = k(null), [E, L] = k({}), [b, u] = k(null), [p, M] = k(null), [O, $] = k(() => ft("muapi-studio:favorites", [])), [P, _] = k("form"), [J, h] = k(!1), [B, z] = k("{}"), [m, c] = k(null), x = W(0), S = W(null);
  F(() => {
    if (!J) return;
    const T = (R) => {
      var Y;
      (Y = S.current) != null && Y.contains(R.target) || h(!1);
    }, N = (R) => {
      R.key === "Escape" && h(!1);
    };
    return document.addEventListener("mousedown", T), document.addEventListener("keydown", N), () => {
      document.removeEventListener("mousedown", T), document.removeEventListener("keydown", N);
    };
  }, [J]);
  const V = W(null);
  F(() => {
    var R, Y, ne;
    const T = ft(`muapi-studio:model:${e}`, null), N = ((R = f.find((ie) => ie.name === T)) == null ? void 0 : R.name) ?? ((Y = f.find((ie) => ie.name === Qt[e])) == null ? void 0 : Y.name) ?? ((ne = St(f, "popular")[0]) == null ? void 0 : ne.name);
    A(N);
  }, [e, f]), F(() => {
    o && (V.current = o.inputs, f.some((T) => T.name === o.model) && (A(o.model), Oe(`muapi-studio:model:${e}`, o.model)), _("form"));
  }, [o == null ? void 0 : o.nonce]);
  const d = f.find((T) => T.name === I);
  F(() => {
    if (!I) return;
    let T = !0;
    return v(null), D(null), u(null), M(null), c(null), a.model(I).then((N) => {
      if (!T) return;
      const R = lt(N), Y = Le(R), ne = V.current;
      if (V.current = null, ne)
        for (const ie of R) ne[ie.prop.name] !== void 0 && (Y[ie.prop.name] = ne[ie.prop.name]);
      v(N), L(Y);
    }).catch((N) => {
      T && D(N.message);
    }), () => {
      T = !1;
    };
  }, [I, a]);
  const U = Q(() => g ? lt(g) : [], [g]), te = Q(() => dt(U, E), [U, E]), q = Q(() => {
    try {
      const T = JSON.parse(B);
      return T && typeof T == "object" && !Array.isArray(T) ? T : null;
    } catch {
      return null;
    }
  }, [B]), oe = P === "json" ? q ?? {} : te, re = JSON.stringify(oe);
  F(() => {
    if (!g || P === "json" && !q) return;
    const T = ++x.current, N = setTimeout(() => {
      a.estimate(g.name, oe).then((R) => {
        T === x.current && u(R);
      }).catch(() => {
        T === x.current && u(null);
      });
    }, 500);
    return () => clearTimeout(N);
  }, [g, re, a]);
  const ce = (T) => {
    A(T), Oe(`muapi-studio:model:${e}`, T);
  }, ye = (T) => $((N) => {
    const R = N.includes(T) ? N.filter((Y) => Y !== T) : [...N, T];
    return Oe("muapi-studio:favorites", R), R;
  }), _e = (T) => {
    h(!1), T !== P && (T === "json" ? z(JSON.stringify(te, null, 2)) : q && L((N) => {
      const R = { ...N };
      for (const Y of U) q[Y.prop.name] !== void 0 && (R[Y.prop.name] = q[Y.prop.name]);
      return R;
    }), _(T), M(null));
  }, X = d ? Je(d, b) : null, xe = ee(async () => {
    if (!g) return;
    c(null);
    const T = U.find((N) => N.prop.name === "prompt");
    await s({
      model: g.name,
      endpointUrl: g.endpoint_url,
      mode: e,
      payload: oe,
      count: n,
      kind: He(g.category),
      prompt: T ? String(oe.prompt ?? "") : "",
      unitCost: X == null ? void 0 : X.current
    });
  }, [g, U, s, e, oe, n, X]), Ne = ee(async () => {
    if (!g) return;
    if (P === "json") {
      if (!q) {
        M("The JSON is not valid");
        return;
      }
      const N = (g.required_fields ?? []).find((R) => q[R] === void 0 || q[R] === "");
      if (N) {
        M(`${N} is required`);
        return;
      }
    } else {
      const N = Dr(U, E);
      if (N) {
        M(N);
        return;
      }
    }
    M(null);
    const T = ((X == null ? void 0 : X.current) ?? 0) * n;
    if (T > _t) {
      c(T);
      return;
    }
    await xe();
  }, [g, P, q, U, E, X, n, xe]), de = !!g && !C, Ge = (() => {
    var N;
    const T = U.find((R) => R.kind === "media-list");
    return T ? Math.max(((N = E[T.prop.name]) == null ? void 0 : N.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ l("section", { "aria-label": w.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ l("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: w.title }),
        /* @__PURE__ */ l("div", { ref: S, className: "relative", children: [
          /* @__PURE__ */ l("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": J, onClick: () => h((T) => !T), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            P === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Ee, { up: J, width: 12, height: 12 })
          ] }),
          J && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((T) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": P === T, type: "button", onClick: () => _e(T), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${P === T ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: T === "json" ? "JSON" : "Form" }) }, T)) })
        ] })
      ] }),
      y,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(pa, { models: f, value: I, onChange: ce, favorites: O, onToggleFavorite: ye, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: P === "json" ? "Request body" : "Parameters" }),
      (d == null ? void 0 : d.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: d.description }),
      !de && !C && I && /* @__PURE__ */ l("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(be, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      C && /* @__PURE__ */ l("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        C
      ] }),
      f.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      de && P === "json" && /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !q, spellCheck: !1, rows: 16, value: B, onChange: (T) => z(T.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${q ? "text-muted" : "text-danger"}`, children: q ? `Sent as the body of POST /api/v1/${g.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      de && P === "form" && U.map((T) => /* @__PURE__ */ r(
        Xr,
        {
          field: T,
          values: E,
          client: a,
          onError: M,
          tagCount: T.prop.name === "prompt" ? Ge : 0,
          onChange: (N, R) => L((Y) => ({ ...Y, [N]: R }))
        },
        T.prop.name
      ))
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      p && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: p }),
      m !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(m) }),
        " (",
        n,
        " × ",
        ae((X == null ? void 0 : X.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void xe(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => c(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          g && (L(Le(U)), z(JSON.stringify(dt(U, Le(U)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ l(
          "button",
          {
            type: "button",
            onClick: () => void Ne(),
            disabled: !de,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(Ke, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              X && /* @__PURE__ */ l("span", { className: "font-normal", children: [
                "(",
                X.original !== null ? /* @__PURE__ */ l($e, { children: [
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
const fa = {
  image: Me,
  video: fr,
  audio: gr,
  avatar: br,
  "3d": Ye,
  "ai-tools": yr,
  text: Nr,
  more: Sr
};
function ga({ mode: e, onChange: t, layout: a = "rail", onChangeKey: n }) {
  return a === "tabs" ? /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    le.map((s) => {
      const i = s.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(s.id),
          "aria-current": i ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${i ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            s.label,
            i && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        s.id
      );
    }),
    n && /* @__PURE__ */ l("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ r(it, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    le.map((s) => {
      const i = fa[s.id], o = s.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(s.id),
          "aria-current": o ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${o ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ r(i, {}),
            s.label
          ]
        },
        s.id
      );
    }),
    n && /* @__PURE__ */ l("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ r(it, {}),
      "Key"
    ] })
  ] });
}
const ba = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, gt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, ya = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], xa = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], va = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], wa = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), ka = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], Na = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), Sa = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], Ca = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], Aa = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], Ia = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], Ma = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), $a = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Ea = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), Ta = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Gt = {
  seedream: { aspect: ya, resolution: xa },
  seedance: { aspect: va, duration: wa },
  minimax: { resolution: ka, duration: Na },
  wan: { aspect: Sa, resolution: Ca, quality: Aa, duration: Ia },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, _a = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, ue = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Lt(e) {
  return ((a) => a.map((n, s) => {
    var i;
    return { ...n, label: ((i = ba[e.slug]) == null ? void 0 : i[s]) ?? n.label };
  }))(Ga(e));
}
function Ga(e) {
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
function La(e) {
  return _a[e.template];
}
function bt(e) {
  var n, s, i, o, y, w, f, I, A, g, v;
  const t = Gt[e.template], a = {};
  for (const C of e.sliders ?? []) a[C.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (i = (s = t.aspect) == null ? void 0 : s[0]) == null ? void 0 : i.value,
    resolution: (y = (o = t.resolution) == null ? void 0 : o[0]) == null ? void 0 : y.value,
    duration: ((f = (w = t.duration) == null ? void 0 : w.find((C) => C.value === 5)) == null ? void 0 : f.value) ?? ((A = (I = t.duration) == null ? void 0 : I[0]) == null ? void 0 : A.value),
    quality: (v = (g = t.quality) == null ? void 0 : g[0]) == null ? void 0 : v.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Rt(e, t) {
  var s;
  const a = [e.prompt], n = (s = e.presets) == null ? void 0 : s.find((i) => i.id === t.preset);
  n != null && n.prompt && a.push(n.prompt);
  for (const i of e.sliders ?? []) {
    const o = t.sliders[i.id] ?? 0;
    if (o !== 0) {
      const y = i.phrase(o);
      y && a.push(y);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function yt(e, t, a) {
  var i;
  const n = (i = e.presets) == null ? void 0 : i.find((o) => o.id === a), s = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: s };
}
function Ra(e, t) {
  for (const a of Lt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function Da(e, t) {
  const a = Rt(e, t), n = t.uploads;
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
function Oa(e) {
  return gt[e.slug] ? gt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const ja = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], G = (e, t, a, n, s) => ({ id: e, label: t, hint: a, prompt: n, values: s }), Fe = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, H = (e, t, a, n, s, i, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: s, prompt: i, ...o }), j = (e, t, a, n, s, i, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: s, prompt: i, ...o }), Ie = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${Fe(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${Fe(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Pa = [Ie[2], { ...Ie[1], id: "vertical", label: "Vertical angle" }, Ie[0]].map((e) => ({ ...e, id: e.id })), Va = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${Fe(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Ua = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], qa = "Keep the result tasteful and suitable for general audiences.", Dt = [
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
    { sliders: Pa.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
    { sliders: Ua, presets: [
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
    { sliders: Va }
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
  j("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  j("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${qa}`),
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
], Te = (e) => Dt.find((t) => t.slug === e), Be = (e) => e.badge === "VIDEO" ? "video" : "image", Qe = (e) => Dt.filter((t) => Be(t) === e), ze = (e) => Qe(e).length > 0;
function Ot(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = Te(t.get("app"));
  return a === "apps" ? { mode: n ? Be(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === Be(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function Fa(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function Ba(e, t, a) {
  return `${e.pathname}${Fa(e.search, t, a)}${e.hash}`;
}
function za(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const Ha = (e) => ja.filter((t) => Qe(e).some((a) => a.category === t.id));
function Ja({ mode: e, value: t, onChange: a }) {
  const [n, s] = k(!1), [i, o] = k(""), [y, w] = k("all"), [f, I] = k(0), A = W(null), g = Q(() => Ha(e), [e]), v = Q(() => za(Qe(e), { category: y, q: i }), [e, y, i]), C = Te(t);
  F(() => I(0), [i, y, n]), F(() => {
    if (!n) return;
    const b = (p) => {
      var M;
      (M = A.current) != null && M.contains(p.target) || s(!1);
    }, u = (p) => {
      p.key === "Escape" && s(!1);
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", u), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", u);
    };
  }, [n]), F(() => {
    var b, u;
    (u = (b = document.getElementById(`ms-app-${f}`)) == null ? void 0 : b.scrollIntoView) == null || u.call(b, { block: "nearest" });
  }, [f]);
  const D = (b) => {
    a(b), s(!1), o("");
  }, E = (b) => {
    b.key === "ArrowDown" ? (b.preventDefault(), I((u) => Math.min(u + 1, v.length - 1))) : b.key === "ArrowUp" ? (b.preventDefault(), I((u) => Math.max(u - 1, 0))) : b.key === "Enter" && v[f] && (b.preventDefault(), D(v[f].slug));
  }, L = (b) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${b ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ l("div", { ref: A, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => s((b) => !b),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (C == null ? void 0 : C.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (C == null ? void 0 : C.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Ee, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ l("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(We, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: E, value: i, onChange: (b) => o(b.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ l("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": y === "all", onClick: () => w("all"), className: L(y === "all"), children: "All" }),
        g.map((b) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": y === b.id, onClick: () => w(b.id), className: L(y === b.id), children: b.label }, b.id))
      ] }),
      /* @__PURE__ */ l("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        v.map((b, u) => /* @__PURE__ */ l(
          "li",
          {
            id: `ms-app-${u}`,
            role: "option",
            "aria-selected": b.slug === t,
            onClick: () => D(b.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${b.slug === t ? "bg-primary-soft" : u === f ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: b.emoji }),
              /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${b.slug === t ? "text-primary" : ""}`, children: b.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: b.blurb })
              ] })
            ]
          },
          b.slug
        )),
        v.length === 0 && /* @__PURE__ */ l("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          i,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const Ya = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), ve = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function Ka({ mode: e, slug: t, onApp: a, switcher: n, models: s, client: i, batch: o, onRun: y }) {
  const w = Te(t), f = le.find((I) => I.id === e).title;
  return /* @__PURE__ */ l("section", { "aria-label": f, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: f }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(Ja, { mode: e, value: t, onChange: a }) })
    ] }),
    w ? /* @__PURE__ */ r(Wa, { app: w, mode: e, models: s, client: i, batch: o, onRun: y }, w.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Wa({ app: e, mode: t, models: a, client: n, batch: s, onRun: i }) {
  var J;
  const [o, y] = k(() => bt(e)), [w, f] = k(null), [I, A] = k(null), [g, v] = k(null), C = W(0);
  F(() => {
    y(bt(e)), f(null), A(null), v(null);
  }, [e]);
  const D = La(e), E = a.find((h) => h.name === D), L = Gt[e.template], b = Q(() => Da(e, o), [e, o]), u = JSON.stringify(b), p = (h) => y((B) => ({ ...B, ...h }));
  F(() => {
    if (!E) return;
    const h = ++C.current, B = setTimeout(() => {
      n.estimate(D, b).then((z) => {
        h === C.current && A(z);
      }).catch(() => {
        h === C.current && A(null);
      });
    }, 500);
    return () => clearTimeout(B);
  }, [u, E, n]);
  const M = E ? Je(E, I) : null, O = Lt(e), $ = async () => {
    E && (v(null), await i({ model: D, endpointUrl: E.endpoint_url, mode: t, prompt: Rt(e, o) || e.name, payload: b, count: s, kind: He(E.category), unitCost: M == null ? void 0 : M.current }));
  }, P = async () => {
    const h = Ra(e, o);
    if (h) {
      f(h);
      return;
    }
    f(null);
    const B = ((M == null ? void 0 : M.current) ?? 0) * s;
    if (B > _t) {
      v(B);
      return;
    }
    await $();
  }, _ = (h, B, z, m) => B && B.length > 0 ? /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: ve, children: h }),
    /* @__PURE__ */ r(Ue, { label: h, options: Ya(B), value: z, onChange: m })
  ] }) : null;
  return /* @__PURE__ */ l("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !E && /* @__PURE__ */ l("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        D,
        "”, which is not in your catalog right now."
      ] }),
      O.map((h) => /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: ve, children: [
          /* @__PURE__ */ r("span", { children: h.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: h.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          qe,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: o.uploads[h.id] ? [o.uploads[h.id]] : [],
            field: { prop: { name: `${h.kind}_${h.id}`, title: h.label, field: h.kind }, kind: "media", required: !h.optional },
            onUrls: (B) => p({ uploads: { ...o.uploads, [h.id]: B[0] ?? "" } }),
            onError: f
          }
        )
      ] }, h.id)),
      e.presets && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: ve, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(Ue, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((h) => ({ value: h.id, label: h.label, hint: h.hint }))], value: o.preset, onChange: (h) => y(yt(e, o, String(h))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (J = e.sliders) == null ? void 0 : J.map((h) => /* @__PURE__ */ l("div", { className: "mb-4", children: [
        /* @__PURE__ */ l("div", { className: ve, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${h.id}`, children: h.label }),
          /* @__PURE__ */ l("span", { className: "tabular-nums text-primary", children: [
            o.sliders[h.id] ?? 0,
            h.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${h.id}`, type: "range", min: h.min, max: h.max, step: h.step, value: o.sliders[h.id] ?? 0, className: "w-full", onChange: (B) => p({ sliders: { ...o.sliders, [h.id]: Number(B.target.value) } }) })
      ] }, h.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => y(yt(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: ve, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: o.refinement, onChange: (h) => p({ refinement: h.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      _("Aspect Ratio", L.aspect, o.aspect, (h) => p({ aspect: h })),
      _(e.template === "seedream" ? "Output Resolution" : "Resolution", L.resolution, o.resolution, (h) => p({ resolution: h })),
      _("Quality Level", L.quality, o.quality, (h) => p({ quality: String(h) })),
      _("Duration", L.duration, o.duration, (h) => p({ duration: Number(h) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && _("Target Face Index", Ma, o.targetIndex, (h) => p({ targetIndex: Number(h) })),
      e.template === "video-face-swap" && _("Target Gender Filter", $a, o.gender, (h) => p({ gender: String(h) })),
      e.template === "bg-remover" && /* @__PURE__ */ l($e, { children: [
        _("Background Color", Ea, o.background, (h) => p({ background: String(h) })),
        _("Output Container & Codec", Ta, o.container, (h) => p({ container: String(h) })),
        /* @__PURE__ */ l("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": o.keepAudio, onClick: () => p({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      w && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: w }),
      g !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(g) }),
        " (",
        s,
        " × ",
        ae((M == null ? void 0 : M.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void $(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => v(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !E, onClick: () => void P(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(Ke, { width: 16, height: 16, className: "shrink-0" }),
        Oa(e),
        s > 1 ? ` ×${s}` : "",
        M && M.current > 0 && /* @__PURE__ */ l("span", { className: "font-normal", children: [
          "(",
          ae(M.current * s),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function xt({ view: e, onChange: t }) {
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
function Xa() {
  try {
    const e = window.location.search, t = Ot(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return Zt(a) ? a : null;
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
function vt(e) {
  if (!ze(e)) return { view: "models", app: null };
  try {
    const a = Ot(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = we.get(`muapi-studio:app:${e}`);
  return { view: we.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Te(t) ? t : null };
}
function Qa({ scope: e, apiBase: t = "/api/muapi", initialTab: a = "image", showHeader: n = !0, title: s = "Studio", teamId: i, theme: o = "lime", layout: y, apiKey: w, onRequestApiKey: f, getHeaders: I, connected: A, fetchImpl: g, features: v, className: C = "", onTabChange: D }) {
  const E = A === !1 || w === "" || w === null, L = W(I);
  L.current = I;
  const [b, u] = k(!1), p = Q(() => new zt(t, i, { apiKey: w || void 0, getHeaders: () => {
    var N;
    return ((N = L.current) == null ? void 0 : N.call(L)) ?? {};
  }, fetchImpl: g, onKeyRejected: () => u(!0) }), [t, i, w, g]);
  F(() => u(!1), [p]);
  const [M, O] = k({ library: !0, deleteMedia: !0 }), $ = Q(() => ({ library: M.library && (v == null ? void 0 : v.library) !== !1, deleteMedia: (v == null ? void 0 : v.deleteMedia) !== !1 }), [M, v == null ? void 0 : v.library, v == null ? void 0 : v.deleteMedia]), P = y ?? Wt(o), [_, J] = k(() => Xa() ?? a), [h, B] = k(4), [z, m] = k(null), [c, x] = k(null), [S, V] = k(null), d = ee(() => {
    p.balance().then(V).catch(() => V(null));
  }, [p]), [U, te] = k(null), q = ur(p, z, d, e), oe = Q(() => ir(q.items), [q.items]);
  F(() => {
    E || (x(null), m(null), p.models().then(m).catch((N) => x(N.message)), d(), (v == null ? void 0 : v.library) !== !1 && p.probe().then(O));
  }, [p, d, E, v == null ? void 0 : v.library]);
  const [re, ce] = k(() => vt(_)), ye = (N, R) => {
    try {
      window.history.replaceState(null, "", Ba(window.location, N, R));
    } catch {
    }
  }, _e = (N) => {
    const R = vt(N);
    J(N), ce(R), D == null || D(N), ye(N, R.view === "apps" ? R.app : null);
  }, X = (N) => {
    ce((R) => ({ ...R, view: N })), we.set(`muapi-studio:view:${_}`, N), ye(_, N === "apps" ? re.app : null);
  }, xe = (N) => {
    ce({ view: "apps", app: N }), we.set(`muapi-studio:app:${_}`, N), we.set(`muapi-studio:view:${_}`, "apps"), ye(_, N);
  }, Ne = ee(async (N) => {
    await q.run(N);
  }, [q.run]), de = ee((N) => {
    var Y;
    const R = z == null ? void 0 : z.find((ne) => ne.name === N);
    return R ? ((Y = R.sale) == null ? void 0 : Y.from) ?? R.cost ?? void 0 : void 0;
  }, [z]), Ge = ee((N) => {
    J(N.mode), ce((R) => ({ ...R, view: "models" })), te({ model: N.model, inputs: N.inputs, nonce: Date.now() });
  }, []), T = ee((N) => {
    var ne;
    const R = z == null ? void 0 : z.find((ie) => ie.name === N.model);
    if (!R) return;
    const Y = ((ne = R.sale) == null ? void 0 : ne.from) ?? R.cost ?? 0;
    Y > 0.25 && !window.confirm(`Re-run ${N.model} for about $${Y.toFixed(2)}?`) || q.run({ model: N.model, endpointUrl: R.endpoint_url, mode: N.mode, prompt: N.prompt, payload: N.inputs, count: 1, unitCost: Y, kind: He(R.category) });
  }, [z, q.run]);
  return /* @__PURE__ */ l("div", { className: `ms-root ${C}`.trim(), style: Kt(o), "data-layout": P, "data-btn": Xt(o), children: [
    n && /* @__PURE__ */ l("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: s }),
      S && /* @__PURE__ */ l("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(S.balance) })
      ] })
    ] }),
    E ? /* @__PURE__ */ l("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      f && /* @__PURE__ */ r("button", { type: "button", onClick: f, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ l(wt.Provider, { value: $, children: [
      b && /* @__PURE__ */ l("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        f && /* @__PURE__ */ r("button", { type: "button", onClick: f, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ l("div", { className: `flex min-h-0 flex-1 flex-col ${P === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(ga, { mode: _, onChange: _e, layout: P, onChangeKey: f }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: c ? /* @__PURE__ */ l("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          c
        ] }) : z ? /* @__PURE__ */ l($e, { children: [
          re.view === "apps" && ze(_) ? /* @__PURE__ */ r(Ka, { mode: _, slug: re.app, onApp: xe, switcher: /* @__PURE__ */ r(xt, { view: "apps", onChange: X }), models: z, client: p, batch: h, onRun: Ne }) : /* @__PURE__ */ r(ha, { mode: _, models: z, client: p, batch: h, onRun: Ne, usage: oe, reuse: U, switcher: ze(_) ? /* @__PURE__ */ r(xt, { view: "models", onChange: X }) : void 0 }),
          /* @__PURE__ */ r(_r, { mode: _, items: q.items, batch: h, onBatch: B, onLabel: q.setLabel, onRemove: q.remove, onReuse: Ge, onRerun: T, onDeleteMedia: q.deleteMedia, onLoadMore: q.loadMore, hasMore: q.hasMore, loadingMore: q.loadingMore, serverError: q.serverError, estimateFor: de })
        ] }) : /* @__PURE__ */ l("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(be, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function tn(e) {
  const t = e.accountId ?? lr(e.apiKey);
  return /* @__PURE__ */ r(Qa, { scope: t, ...e }, t);
}
export {
  me as ApiError,
  zt as MuapiClient,
  tn as MuapiStudio,
  Yt as THEMES,
  Jt as cyanTheme,
  Wt as defaultLayout,
  He as generationKind,
  je as limeTheme,
  Ht as pollUntilDone,
  Nt as resolveTheme,
  lr as scopeOfKey,
  Kt as themeStyle
};
