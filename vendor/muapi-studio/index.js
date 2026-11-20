import { jsx as r, jsxs as l, Fragment as Me } from "react/jsx-runtime";
import { createContext as Gt, useContext as Lt, useState as k, useRef as K, useEffect as B, useCallback as ae, useMemo as Z, useId as Rt, useLayoutEffect as Dt } from "react";
class ue extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function Ot(e, t) {
  var o;
  const a = e == null ? void 0 : e.detail;
  return ((o = a == null ? void 0 : a.error) == null ? void 0 : o.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Pt {
  constructor(t = "/api/muapi", a, o = {}) {
    this.base = t, this.teamId = a, this.opts = o;
  }
  async request(t, a = {}) {
    const o = new Headers(a.headers);
    if (this.opts.apiKey && o.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [b, N] of Object.entries(await this.opts.getHeaders())) o.set(b, N);
    const s = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: o }), i = await s.text();
    let n = null;
    try {
      n = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!s.ok) throw new ue(Ot(n, `${s.status} ${s.statusText}`), s.status);
    if (n === null && i.trim()) throw new ue("Unexpected non-JSON response from the server", 502);
    return n;
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
  async submit(t, a, o) {
    var n;
    const s = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...o ? { "x-ms-kind": o } : {} },
      body: JSON.stringify(a)
    }), i = s.request_id || s.id;
    if (!i) throw new ue("The API did not return a request id", 502);
    return { requestId: i, cost: (n = s.cost) == null ? void 0 : n.amount_usd };
  }
  async poll(t) {
    var n;
    const a = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), o = String(a.status || "").toLowerCase(), s = ["completed", "succeeded"].includes(o) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(o) ? "failed" : o === "pending" ? "pending" : "processing", i = Array.isArray(a.outputs) ? a.outputs : a.url ? [a.url] : [];
    return { status: s, outputs: i, error: a.error || void 0, cost: (n = a.cost) == null ? void 0 : n.amount_usd };
  }
  /** muapi's server-side generation history (works with an API key), newest first. */
  history(t, a = 30) {
    const o = new URLSearchParams({ limit: String(a) });
    return t && o.set("cursor", t), this.request(`/api/v1/history?${o}`);
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
    const t = (o) => o instanceof ue && [403, 404, 405].includes(o.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((o) => !t(o)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var i;
    const a = new FormData();
    a.append("file", t);
    const o = await this.request("/api/v1/upload_file", { method: "POST", body: a }), s = o.url || o.file_url || ((i = o.data) == null ? void 0 : i.url);
    if (!s) throw new ue("Upload returned no URL", 502);
    return s;
  }
}
async function jt(e, t, a = {}) {
  const { intervalMs: o = 2e3, timeoutMs: s = 15 * 60 * 1e3, signal: i, onUpdate: n } = a, b = Date.now();
  let N = 0;
  for (; Date.now() - b < s; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const h = await e.poll(t);
      if (N = 0, n == null || n(h), h.status === "completed" || h.status === "failed") return h;
    } catch (h) {
      if (++N >= 5) throw h;
    }
    await new Promise((h) => setTimeout(h, o));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const bt = Gt({ library: !0, deleteMedia: !0 }), yt = () => Lt(bt), Oe = {
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
  font: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
}, Vt = {
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
  font: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
}, Ut = { lime: Oe, cyan: Vt }, Xe = {
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
function qt(e = "lime") {
  return typeof e == "string" ? Ut[e] ?? Oe : { ...Oe, ...e };
}
function Ft(e = "lime") {
  const t = qt(e), a = {};
  for (const o of Object.keys(Xe)) a[Xe[o]] = t[o];
  return a;
}
function Bt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const le = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], zt = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function ze(e) {
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
const Ht = (e) => !!e && le.some((t) => t.id === e);
function Jt(e, t) {
  const a = le.find((o) => o.id === t).groups;
  return e.filter((o) => a.includes(o.group_of) && o.is_enabled && !o.is_coming_soon);
}
const Yt = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function xt(e, t, a = {}) {
  const o = (i) => {
    var n;
    return ((n = i.sale) == null ? void 0 : n.from) ?? i.cost ?? 1 / 0;
  }, s = [...e];
  return t === "a-z" ? s.sort((i, n) => i.name.localeCompare(n.name)) : t === "price-asc" ? s.sort((i, n) => o(i) - o(n)) : t === "price-desc" ? s.sort((i, n) => o(n) - o(i)) : t === "most-used" ? s.filter((i) => {
    var n;
    return (((n = a.usage) == null ? void 0 : n[i.name]) ?? 0) > 0;
  }).sort((i, n) => (a.usage[n.name] ?? 0) - (a.usage[i.name] ?? 0)) : t === "favourites" ? s.filter((i) => {
    var n;
    return (n = a.favorites) == null ? void 0 : n.includes(i.name);
  }) : s.sort((i, n) => +!!n.sale - +!!i.sale);
}
const Kt = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function Wt(e, t) {
  var o, s;
  const a = (o = t.find((i) => i.name === e)) == null ? void 0 : o.group_of;
  return ((s = le.find((i) => a && i.groups.includes(a))) == null ? void 0 : s.id) ?? "ai-tools";
}
function Xt(e, t, a = {}) {
  var i;
  const o = e.output ?? {}, s = o.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: Wt(e.model, t),
    prompt: typeof s.prompt == "string" ? s.prompt : "",
    inputs: s,
    status: Kt[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(o.outputs) ? o.outputs : [],
    error: o.error || void 0,
    cost: (i = o.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function Qt(e, t, a = /* @__PURE__ */ new Set()) {
  const o = new Set(e.map((i) => i.requestId).filter(Boolean));
  return [...e, ...t.filter((i) => !i.requestId || !o.has(i.requestId))].filter((i) => !(i.requestId && a.has(i.requestId))).sort((i, n) => n.createdAt - i.createdAt);
}
function Zt(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function ne(e) {
  var o;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((o = t.split(".")[1]) == null ? void 0 : o.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function He(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const vt = "muapi-studio:history:v1", er = 200;
function Qe() {
  try {
    const e = localStorage.getItem(vt);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function tr(e) {
  try {
    localStorage.setItem(vt, JSON.stringify(e.slice(0, er)));
  } catch {
  }
}
const rr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, Ze = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, et = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, tt = "muapi-studio:labels:v1", rt = "muapi-studio:hidden:v1";
function ar(e, t, a) {
  const [o, s] = k(() => Qe()), [i, n] = k([]), [b, N] = k(null), [h, M] = k(!1), [A, m] = k(null), _ = K(!1), [v, O] = k(() => Ze(tt, {})), [S, E] = k(() => Ze(rt, [])), f = K(/* @__PURE__ */ new Set()), p = K(new AbortController()), x = K([]);
  x.current = t ?? [], B(() => tr(o), [o]), B(() => et(tt, v), [v]), B(() => et(rt, S), [S]), B(() => (p.current = new AbortController(), () => p.current.abort()), []);
  const w = ae((c, d) => s((y) => y.map((T) => T.id === c ? { ...T, ...d } : T)), []), L = ae(async (c, d) => {
    if (!f.current.has(c)) {
      f.current.add(c);
      try {
        const y = await jt(e, d, {
          signal: p.current.signal,
          onUpdate: (T) => w(c, { status: T.status, outputs: T.outputs, error: T.error, cost: T.cost })
        });
        w(c, { status: y.status, outputs: y.outputs, error: y.error, cost: y.cost }), a == null || a();
      } catch (y) {
        y.name !== "AbortError" && w(c, { status: "failed", error: y.message });
      } finally {
        f.current.delete(c);
      }
    }
  }, [e, w, a]);
  B(() => {
    for (const c of Qe()) (c.status === "pending" || c.status === "processing") && c.requestId && L(c.id, c.requestId);
  }, []);
  const I = ae(async (c = !1) => {
    if (!_.current) {
      M(!0), m(null);
      try {
        const d = await e.history(c ? void 0 : b ?? void 0), y = d.items.map((T) => Xt(T, x.current));
        n((T) => c ? y : [...T, ...y]), N(d.next_cursor);
      } catch (d) {
        d instanceof ue && [403, 404, 405].includes(d.status) ? (_.current = !0, N(null)) : m(d.message);
      } finally {
        M(!1);
      }
    }
  }, [e, b]), P = K(!1);
  B(() => {
    t && !P.current && (P.current = !0, I(!0));
  }, [t, I]);
  const G = ae((c) => {
    const d = Array.from({ length: c.count }, () => ({
      id: rr(),
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
    return s((y) => [...d, ...y]), Promise.all(d.map(async (y) => {
      try {
        const { requestId: T, cost: X } = await e.submit(c.endpointUrl, c.payload, c.kind);
        w(y.id, { requestId: T, ...X !== void 0 ? { cost: X } : {} }), await L(y.id, T);
      } catch (T) {
        w(y.id, { status: "failed", error: T.message });
      }
    }));
  }, [e, w, L]), U = Z(() => {
    const c = (d) => ({ ...d, label: d.requestId && v[d.requestId] || d.label });
    return Qt(o.map(c), i.map(c), new Set(S));
  }, [o, i, v, S]), g = ae((c, d) => {
    c.requestId && O((y) => {
      const T = { ...y };
      return d ? T[c.requestId] = d : delete T[c.requestId], T;
    }), w(c.id, { label: d });
  }, [w]), q = ae((c) => {
    s((d) => d.filter((y) => y.id !== c.id)), c.requestId && E((d) => [.../* @__PURE__ */ new Set([...d, c.requestId])]);
  }, []), W = ae(async (c) => {
    c.requestId && (await e.deleteMedia(c.requestId), w(c.id, { outputs: [] }), n((d) => d.map((y) => y.requestId === c.requestId ? { ...y, outputs: [] } : y)));
  }, [e, w]);
  return { items: U, run: G, setLabel: g, remove: q, deleteMedia: W, loadMore: () => I(!1), hasMore: !!b, loadingMore: h, serverError: A };
}
const or = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function wt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : or.test(e) ? "file" : "image" : "text";
}
function nr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const Y = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Ie = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), ir = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), sr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), lr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), kt = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), cr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Je = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), at = ({ filled: e, ...t }) => /* @__PURE__ */ r(Y, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Ye = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Te = ({ up: e, ...t }) => /* @__PURE__ */ r(Y, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), dr = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), ur = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), Pe = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), xe = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), fe = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), Nt = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), mr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), ve = (e) => /* @__PURE__ */ r(Y, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), pr = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), hr = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), fr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), gr = ["All", "Approved", "Rejected", "Unlabeled"], br = [1, 2, 4, 6, 8];
function yr({ url: e, hidden: t, onOpen: a }) {
  const o = t ? { filter: "blur(18px)" } : void 0, s = wt(e);
  return s === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: o, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: nr(e) }) : s === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: o, className: "aspect-video w-full bg-black object-contain" }) : s === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : s === "3d" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(kt, { width: 32, height: 32 }),
    "Open 3D model"
  ] }) : s === "file" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Pe, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: o, className: "aspect-square w-full bg-black object-contain" }) });
}
function xr({ g: e, hidden: t, onLabel: a, onRemove: o, onReuse: s, onRerun: i, onDeleteMedia: n, onOpen: b, estimateFor: N }) {
  const h = e.outputs[0], M = !!h && wt(h) === "text", [A, m] = k(!1), [_, v] = k(null), O = yt(), S = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", E = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ l("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && h ? /* @__PURE__ */ r(yr, { url: h, hidden: t, onOpen: () => b(h) }) : e.status === "failed" ? /* @__PURE__ */ l("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(fe, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ l("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(ve, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ l("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ l("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ne(e.cost) : e.status === "completed" && (N == null ? void 0 : N(e.model)) !== void 0 ? `est. ${ne(N(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && h && (M ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(h)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${E} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Pe, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: h, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${E} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Pe, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${E} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ r(xe, { width: 14, height: 14 })
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
            className: `${E} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ r(fe, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => s(e), title: "Load this model and settings back into the form", className: S, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: S, children: "Re-run" }),
        e.status === "completed" && h && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var f;
          (f = navigator.clipboard) == null || f.writeText(h).then(() => {
            m(!0), setTimeout(() => m(!1), 1500);
          });
        }, className: S, children: A ? "Copied" : M ? "Copy text" : "Copy link" })
      ] }),
      _ && /* @__PURE__ */ l("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        _
      ] }),
      /* @__PURE__ */ l("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ l("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ l("span", { className: "flex shrink-0 gap-3", children: [
          O.deleteMedia && e.requestId && e.status === "completed" && h && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (v(null), n(e).catch((f) => v(f.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => o(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function vr({ url: e, onClose: t }) {
  return B(() => {
    const a = (o) => o.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ l("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(fe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function wr({ mode: e, items: t, batch: a, onBatch: o, onLabel: s, onRemove: i, onReuse: n, onRerun: b, onDeleteMedia: N, onLoadMore: h, hasMore: M, loadingMore: A, serverError: m, estimateFor: _ }) {
  const [v, O] = k("All"), [S, E] = k(""), [f, p] = k(!1), [x, w] = k(null), L = Z(() => {
    const I = S.trim().toLowerCase();
    return t.filter((P) => P.mode !== e || v === "Approved" && P.label !== "approved" || v === "Rejected" && P.label !== "rejected" || v === "Unlabeled" && P.label !== null ? !1 : !I || P.prompt.toLowerCase().includes(I) || P.model.toLowerCase().includes(I));
  }, [t, e, v, S]);
  return /* @__PURE__ */ l("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: gr.map((I) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": v === I,
          onClick: () => O(I),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${v === I ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: I
        },
        I
      )) }),
      /* @__PURE__ */ l("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(Ye, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: S, onChange: (I) => E(I.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: br.map((I) => /* @__PURE__ */ r(
        "button",
        {
          role: "radio",
          "aria-checked": a === I,
          onClick: () => o(I),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${a === I ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: I
        },
        I
      )) }),
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": f, "aria-label": f ? "Show previews" : "Hide previews", title: f ? "Show previews" : "Hide previews", onClick: () => p((I) => !I), className: f ? "text-primary" : "text-secondary hover:text-fg", children: f ? /* @__PURE__ */ r(dr, { width: 18, height: 18 }) : /* @__PURE__ */ r(ur, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      L.length === 0 ? /* @__PURE__ */ l("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Je, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some((I) => I.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((I) => I.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: L.map((I) => /* @__PURE__ */ r(xr, { g: I, hidden: f, onLabel: s, onRemove: i, onReuse: n, onRerun: b, onDeleteMedia: N, onOpen: w, estimateFor: _ }, I.id)) }),
      m && /* @__PURE__ */ l("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        m
      ] }),
      M && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: A, onClick: h, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: A ? "Loading…" : "Load more history" }) }),
      x && /* @__PURE__ */ r(vr, { url: x, onClose: () => w(null) })
    ] })
  ] });
}
const kr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Nr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Sr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? kr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Nr.test(e.name) ? "media" : "text" : "text";
}
function ot(e) {
  var n, b;
  const t = (b = (n = e.input_schema) == null ? void 0 : n.schemas) == null ? void 0 : b.input_data, a = (t == null ? void 0 : t.properties) ?? {}, o = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), s = [...o.filter((N) => a[N]), ...Object.keys(a).filter((N) => !o.includes(N))], i = new Set(e.required_fields ?? []);
  return s.map((N) => ({ prop: { ...a[N], name: N }, kind: Sr({ ...a[N], name: N }), required: i.has(N) }));
}
function Ge(e) {
  var a;
  const t = {};
  for (const { prop: o, kind: s, required: i } of e)
    o.default !== void 0 && o.default !== null ? t[o.name] = o.default : i && (s === "textarea" || s === "text") && typeof ((a = o.examples) == null ? void 0 : a[0]) == "string" && (t[o.name] = o.examples[0]);
  return t;
}
const pe = (e) => `__auto:${e}`, nt = (e) => (e.kind === "number" || e.kind === "select") && !e.required, je = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function it(e, t) {
  const a = {};
  for (const { prop: o, kind: s } of e) {
    if (t[pe(o.name)] === !0) continue;
    const i = t[o.name] ?? o.default;
    if (!je(i))
      if (s === "number") {
        const n = Number(i);
        Number.isFinite(n) && (a[o.name] = n);
      } else if (s === "json" && typeof i == "string")
        try {
          a[o.name] = JSON.parse(i);
        } catch {
        }
      else a[o.name] = i;
  }
  return a;
}
function Cr(e, t) {
  for (const { prop: a, kind: o, required: s } of e) {
    if (t[pe(a.name)] === !0) continue;
    const i = t[a.name] ?? a.default, n = a.title || a.name;
    if (s && je(i)) return `${n} is required`;
    if (o === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${n} must be valid JSON`;
      }
    if (o === "number" && !je(i)) {
      const b = Number(i);
      if (!Number.isFinite(b)) return `${n} must be a number`;
      if (a.minValue !== void 0 && b < a.minValue) return `${n} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && b > a.maxValue) return `${n} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const Ar = 12, Ke = 240, Ne = (e) => `${typeof e}:${e}`, Ir = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Mr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((o) => o.label.toLowerCase().includes(a)) : e;
}
function Tr(e, t, a = Ke) {
  return e >= a || e >= t ? "down" : "up";
}
const $r = 40, Er = 48;
function _r(e, t) {
  return Math.min(Ke, Math.max(1, e) * $r + 8) + (t ? Er : 0);
}
function Gr(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const st = "Auto (let model decide)", Le = "__auto__";
function Ve({ id: e, label: t, options: a, value: o, onChange: s, allowAuto: i, auto: n, onAuto: b, combobox: N }) {
  const h = Rt(), M = e ?? `ms-dd-${h}`, A = N ?? a.length > Ar, [m, _] = k(!1), [v, O] = k(""), [S, E] = k(0), [f, p] = k("down"), x = K(null), w = K(null), L = K(null), I = a.find((d) => o !== void 0 && Ne(d.value) === Ne(o)), P = Z(() => A ? Mr(a, v) : a, [A, a, v]), G = Z(
    () => [...i ? [{ key: Le, label: st, value: Le, isAuto: !0 }] : [], ...P.map((d) => ({ key: Ne(d.value), label: d.label, hint: d.hint, value: d.value }))],
    [i, P]
  ), U = n ? Le : I ? Ne(I.value) : void 0, g = () => {
    _(!1), O("");
  }, q = (d) => {
    d.isAuto ? b == null || b() : s(d.value), g();
  };
  Dt(() => {
    if (!m || !x.current) return;
    const d = x.current.getBoundingClientRect();
    let y = x.current.parentElement;
    for (; y && !/(auto|scroll)/.test(getComputedStyle(y).overflowY); ) y = y.parentElement;
    const T = y ? y.getBoundingClientRect() : null, X = Math.min(window.innerHeight, T ? T.bottom : window.innerHeight), u = Math.max(0, T ? T.top : 0);
    p(Tr(X - d.bottom, d.top - u, _r(a.length + (i ? 1 : 0), A)));
  }, [m]), B(() => {
    if (!m) return;
    const d = G.findIndex((y) => y.key === U);
    E(d >= 0 ? d : 0);
  }, [m, v]), B(() => {
    var d, y, T;
    m && ((T = (y = (d = w.current) == null ? void 0 : d.querySelector(`[data-i="${S}"]`)) == null ? void 0 : y.scrollIntoView) == null || T.call(y, { block: "nearest" }));
  }, [S, m]), B(() => {
    var d;
    m && A && ((d = L.current) == null || d.focus());
  }, [m, A]), B(() => {
    if (!m) return;
    const d = (y) => {
      var T;
      (T = x.current) != null && T.contains(y.target) || g();
    };
    return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
  }, [m]);
  const W = (d) => {
    if (!m) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(d.key) && (d.preventDefault(), _(!0));
      return;
    }
    if (d.key === "Escape") {
      d.preventDefault(), d.stopPropagation(), g();
      return;
    }
    if (d.key === "Enter") {
      d.preventDefault(), G[S] && q(G[S]);
      return;
    }
    if (d.key === "Tab") {
      g();
      return;
    }
    if (d.key === " " && !A) {
      d.preventDefault(), G[S] && q(G[S]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(d.key) && (d.preventDefault(), E((y) => Gr(y, d.key, G.length)));
  }, c = n ? st : (I == null ? void 0 : I.label) ?? "Select…";
  return /* @__PURE__ */ l("div", { ref: x, className: "relative w-full", onKeyDown: W, children: [
    /* @__PURE__ */ l(
      "button",
      {
        id: M,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": m,
        "aria-label": `${t}: ${c}`,
        "aria-controls": `${M}-list`,
        onClick: () => _((d) => !d),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${m ? "border-primary" : "border-line hover:border-muted"} ${n ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: c }),
          /* @__PURE__ */ r(Te, { up: m, width: 16, height: 16 })
        ]
      }
    ),
    m && /* @__PURE__ */ l("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${f === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      A && /* @__PURE__ */ r(
        "input",
        {
          ref: L,
          value: v,
          onChange: (d) => O(d.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${M}-list`,
          "aria-activedescendant": G[S] ? `${M}-o${S}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ l("ul", { id: `${M}-list`, ref: w, role: "listbox", "aria-label": t, style: { maxHeight: Ke }, className: "overflow-y-auto", children: [
        G.map((d, y) => {
          const T = d.key === U;
          return /* @__PURE__ */ l(
            "li",
            {
              id: `${M}-o${y}`,
              "data-i": y,
              role: "option",
              "aria-selected": T,
              onMouseEnter: () => E(y),
              onClick: () => q(d),
              className: `flex cursor-pointer items-center justify-between gap-2 rounded-ctl px-3 py-2.5 text-sm ${T ? "bg-primary text-primary-ink" : y === S ? "bg-card-bg" : ""} ${d.isAuto && !T ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ l("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: d.label }),
                  d.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${T ? "opacity-70" : "text-muted"}`, children: d.hint })
                ] }),
                T && /* @__PURE__ */ r(xe, { width: 14, height: 14 })
              ]
            },
            d.key
          );
        }),
        G.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Lr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Rr({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Ie, {}) });
}
function Dr({ client: e, max: t, initialType: a = "image", onInsert: o, onClose: s }) {
  const [i, n] = k(a), [b, N] = k(""), [h, M] = k(1), [A, m] = k(null), [_, v] = k(null), [O, S] = k(!1), [E, f] = k([]), [p, x] = k(""), [w, L] = k(!1), I = K(null), P = K(null), G = ae(async () => {
    S(!0), v(null);
    try {
      m(await e.mediaLibrary({ mediaType: i, search: b, page: h }));
    } catch (c) {
      v(c.message);
    } finally {
      S(!1);
    }
  }, [e, i, b, h]);
  B(() => {
    const c = setTimeout(G, b ? 300 : 0);
    return () => clearTimeout(c);
  }, [G, b]), B(() => {
    M(1);
  }, [i, b]), B(() => {
    var y;
    const c = document.activeElement;
    (y = I.current) == null || y.focus();
    const d = (T) => {
      if (T.key === "Escape") {
        T.stopPropagation(), s();
        return;
      }
      if (T.key !== "Tab" || !I.current) return;
      const X = [...I.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!X.length) return;
      const u = X[0], j = X[X.length - 1];
      T.shiftKey && document.activeElement === u ? (T.preventDefault(), j.focus()) : !T.shiftKey && document.activeElement === j && (T.preventDefault(), u.focus());
    };
    return document.addEventListener("keydown", d), () => {
      var T;
      document.removeEventListener("keydown", d), (T = c == null ? void 0 : c.focus) == null || T.call(c);
    };
  }, [s]);
  const U = (c) => f((d) => d.includes(c) ? d.filter((y) => y !== c) : t === 1 ? [c] : d.length < t ? [...d, c] : d), g = async (c) => {
    if (c.length) {
      S(!0), v(null);
      try {
        for (const d of c) {
          const y = await e.upload(d);
          await e.saveToLibrary({ url: y, name: d.name, mime_type: d.type || void 0, size_bytes: d.size, media_type: d.type.startsWith("video") ? "video" : d.type.startsWith("audio") ? "audio" : d.type.startsWith("image") ? "image" : "archive" });
        }
        await G();
      } catch (d) {
        v(d.message), S(!1);
      }
    }
  }, q = async () => {
    var d;
    const c = p.trim();
    if (!/^https?:\/\//i.test(c)) {
      v("Enter a full http(s) URL");
      return;
    }
    S(!0), v(null);
    try {
      const y = ((d = c.split("?")[0].split(".").pop()) == null ? void 0 : d.toLowerCase()) ?? "", T = ["mp4", "webm", "mov"].includes(y) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(y) ? "audio" : ["zip", "rar", "7z"].includes(y) ? "archive" : "image";
      await e.saveToLibrary({ url: c, name: c.split("/").pop() || "link", media_type: T }), x(""), L(!1), await G();
    } catch (y) {
      v(y.message), S(!1);
    }
  }, W = async (c) => {
    if (window.confirm(`Delete "${c.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(c.id), f((d) => d.filter((y) => y !== c.url)), await G();
      } catch (d) {
        v(d.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (c) => {
    c.target === c.currentTarget && s();
  }, children: /* @__PURE__ */ l("div", { ref: I, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ l("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Ie, {}) }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ l("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
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
      /* @__PURE__ */ r("input", { ref: P, type: "file", hidden: !0, multiple: !0, onChange: (c) => {
        const d = Array.from(c.target.files ?? []);
        c.target.value = "", g(d);
      } }),
      /* @__PURE__ */ l("button", { type: "button", onClick: () => {
        var c;
        return (c = P.current) == null ? void 0 : c.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ r(Nt, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: s, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(fe, {}) })
    ] }),
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Lr.map((c) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": i === c.id, onClick: () => n(c.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === c.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: c.label }, c.id)) }),
      /* @__PURE__ */ r("input", { value: b, onChange: (c) => N(c.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": w, onClick: () => L((c) => !c), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    w && /* @__PURE__ */ l("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: p, onChange: (c) => x(c.target.value), onKeyDown: (c) => c.key === "Enter" && void q(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void q(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      _ && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: _ }),
      O && !A ? /* @__PURE__ */ l("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(ve, {}),
        " Loading…"
      ] }) : A != null && A.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: A.items.map((c) => {
        const d = E.includes(c.url);
        return /* @__PURE__ */ l("li", { className: `group relative overflow-hidden rounded-card border ${d ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": d, "aria-label": `${d ? "Deselect" : "Select"} ${c.name ?? "file"}`, onClick: () => U(c.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Rr, { a: c }) }),
          d && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(xe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${c.name ?? "file"}`, onClick: () => void W(c), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(fe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: c.name ?? "", children: c.name })
        ] }, c.id);
      }) }) : /* @__PURE__ */ l("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ie, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      A && A.total_pages > 1 && /* @__PURE__ */ l("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: h <= 1, onClick: () => M((c) => c - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        h,
        " of ",
        A.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: h >= A.total_pages, onClick: () => M((c) => c + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ l("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ l("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: E.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !E.length, onClick: () => {
        o(E), s();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(xe, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const St = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Or = (e, t = "") => {
  const a = St(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Pr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function jr(e, t) {
  const a = await Promise.all(t.map((o) => e.upload(o)));
  return t.forEach((o, s) => void e.saveToLibrary({ url: a[s], name: o.name, mime_type: o.type || void 0, size_bytes: o.size, media_type: Pr(o) }).catch(() => {
  })), a;
}
function Ue({ client: e, field: t, multiple: a, max: o, current: s, onUrls: i, onError: n }) {
  const b = K(null), [N, h] = k(!1), [M, A] = k(!1), [m, _] = k(!1), v = o - s.length, O = yt(), S = async (p) => {
    if (p.length) {
      h(!0);
      try {
        i(await jr(e, a ? p.slice(0, Math.max(v, 1)) : p.slice(0, 1)));
      } catch (x) {
        n(x.message);
      } finally {
        h(!1);
      }
    }
  }, E = St(t.prop.field, t.prop.name), f = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ l(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), A(!0);
      },
      onDragLeave: () => A(!1),
      onDrop: (p) => {
        p.preventDefault(), A(!1), S(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${M ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: b, type: "file", hidden: !0, accept: E, multiple: a, onChange: (p) => {
          const x = Array.from(p.target.files ?? []);
          p.target.value = "", S(x);
        } }),
        (a ? v > 0 : !0) && /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ r(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: a ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: a ? void 0 : s[0] ?? "",
              defaultValue: void 0,
              onChange: a ? void 0 : (p) => i([p.target.value]),
              onKeyDown: a ? (p) => {
                p.key === "Enter" && p.currentTarget.value.trim() && (i([p.currentTarget.value.trim()]), p.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ r("button", { type: "button", disabled: N, onClick: () => {
            var p;
            return (p = b.current) == null ? void 0 : p.click();
          }, "aria-label": "Upload file", title: "Upload file", className: f, children: N ? /* @__PURE__ */ r(ve, { width: 16, height: 16 }) : /* @__PURE__ */ r(Nt, { width: 16, height: 16 }) }),
          O.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => _(!0), "aria-label": "Choose from media library", title: "Media library", className: f, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        m && O.library && /* @__PURE__ */ r(Dr, { client: e, max: a ? Math.max(v, 1) : 1, initialType: Or(t.prop.field, t.prop.name), onInsert: i, onClose: () => _(!1) })
      ]
    }
  );
}
function Vr({ field: e, values: t, onChange: a, client: o, onError: s, tagCount: i = 0 }) {
  const { prop: n, kind: b, required: N } = e, h = t[n.name], M = (p) => a(n.name, p), A = n.title || n.name, m = `ms-f-${n.name}`, _ = h == null ? "" : String(h), v = Array.isArray(h) ? h : [], O = t[pe(n.name)] === !0, S = K(null), E = (p) => {
    const x = S.current, w = typeof h == "string" ? h : "", L = (x == null ? void 0 : x.selectionStart) ?? w.length, I = (x == null ? void 0 : x.selectionEnd) ?? L;
    M(w.slice(0, L) + p + " " + w.slice(I)), requestAnimationFrame(() => {
      x == null || x.focus(), x == null || x.setSelectionRange(L + p.length + 1, L + p.length + 1);
    });
  };
  let f;
  if (b === "textarea" || b === "json")
    f = /* @__PURE__ */ l(Me, { children: [
      /* @__PURE__ */ r("textarea", { ref: S, id: m, rows: b === "json" ? 4 : 5, value: typeof h == "string" ? h : h ? JSON.stringify(h, null, 2) : "", onChange: (p) => M(p.target.value), className: `w-full resize-y p-3 text-sm ${b === "json" ? "font-mono text-xs" : ""}` }),
      n.name === "prompt" && i > 0 && /* @__PURE__ */ l("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (p, x) => `@image${x + 1}`).map((p) => /* @__PURE__ */ r("button", { type: "button", onClick: () => E(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (b === "select") {
    const p = n.enum ?? [];
    f = /* @__PURE__ */ r(
      Ve,
      {
        id: m,
        label: A,
        options: Ir(p),
        value: h,
        onChange: (x) => {
          M(x), a(pe(n.name), !1);
        },
        allowAuto: nt(e),
        auto: O,
        onAuto: () => a(pe(n.name), !0)
      }
    );
  } else if (b === "boolean") {
    const p = h === !0;
    f = /* @__PURE__ */ r(
      "button",
      {
        id: m,
        type: "button",
        role: "switch",
        "aria-checked": p,
        onClick: () => M(!p),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${p ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${p ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (b === "number") {
    const p = n.minValue !== void 0 && n.maxValue !== void 0;
    f = /* @__PURE__ */ l("div", { className: `flex items-center gap-3 ${O ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ r("input", { type: "range", disabled: O, "aria-label": `${A} slider`, min: n.minValue, max: n.maxValue, step: n.step ?? (n.type === "number" ? 0.01 : 1), value: _ === "" ? n.minValue : Number(_), onChange: (x) => M(Number(x.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: m, type: "number", disabled: O, min: n.minValue, max: n.maxValue, step: n.step ?? (n.type === "number" ? "any" : 1), value: _, onChange: (x) => M(x.target.value === "" ? "" : Number(x.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (b === "media")
    f = /* @__PURE__ */ r(Ue, { client: o, field: e, multiple: !1, max: 1, current: _ ? [_] : [], onUrls: (p) => M(p[0]), onError: s });
  else if (b === "media-list") {
    const p = n.maxItems ?? 8;
    f = /* @__PURE__ */ l("div", { className: "space-y-2", children: [
      v.map((x, w) => /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${A} ${w + 1}`, value: x, onChange: (L) => M(v.map((I, P) => P === w ? L.target.value : I)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${A} ${w + 1}`, onClick: () => M(v.filter((L, I) => I !== w)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(fe, { width: 14, height: 14 }) })
      ] }, w)),
      /* @__PURE__ */ r(Ue, { client: o, field: e, multiple: !0, max: p, current: v, onUrls: (x) => M([...v, ...x].slice(0, p)), onError: s })
    ] });
  } else
    f = /* @__PURE__ */ r("input", { id: m, value: _, onChange: (p) => M(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ l("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ l("label", { htmlFor: m, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        A,
        n.description && /* @__PURE__ */ r("span", { title: n.description, className: "text-muted", children: /* @__PURE__ */ r(mr, { width: 13, height: 13 }) })
      ] }),
      nt(e) && b === "number" ? /* @__PURE__ */ l("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: O, onChange: (p) => a(pe(n.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: b === "media-list" ? `${v.length}/${n.maxItems ?? 8} items${N ? " · required" : ""}` : N ? "* required" : "" })
    ] }),
    f
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
}, he = "Other", Ur = 3, qr = 2, Fr = 20, Br = 2, zr = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Ct(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Se[t] ? Se[t] : Se[a] ? Se[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? he : zr(a);
}
function Hr(e) {
  const t = /* @__PURE__ */ new Map();
  for (const s of e) {
    const i = Ct(s.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let a = 0;
  const o = [];
  for (const [s, i] of t)
    s === he || i < Ur ? a += i : o.push({ id: s, label: s, count: i });
  return o.sort((s, i) => i.count - s.count || s.label.localeCompare(i.label)), a && o.push({ id: he, label: he, count: a }), o;
}
function At(e, t) {
  const a = Ct(e.name);
  return t.some((o) => o.id === a) ? a : he;
}
function Jr(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function Yr(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const lt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function Kr(e) {
  const t = /* @__PURE__ */ new Map();
  for (const o of e) t.set(o.category, (t.get(o.category) ?? 0) + 1);
  const a = (o) => {
    const s = lt.indexOf(o);
    return s < 0 ? lt.length : s;
  };
  return [...t].map(([o, s]) => ({ id: o, count: s })).sort((o, s) => a(o.id) - a(s.id) || s.count - o.count || o.id.localeCompare(s.id));
}
const me = "__favourites__", re = "__all__";
function Wr(e, t, a) {
  return e.filter((o) => {
    var s;
    return t.category !== re && o.category !== t.category ? !1 : t.provider === me ? !!((s = t.favourites) != null && s.includes(o.name)) : t.provider === re || At(o, a) === t.provider;
  });
}
const Xr = (e, t) => t.filter((a) => a.id !== he).length >= qr && e.length >= Fr, Ce = 200;
function Qr({ model: e }) {
  const t = He(e);
  return t ? /* @__PURE__ */ l("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ne(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ne(t.current)
  ] }) : null;
}
const ct = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, dt = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Re({ label: e, active: t, onClick: a, hue: o, children: s }) {
  return /* @__PURE__ */ r(
    "button",
    {
      type: "button",
      role: "radio",
      "aria-checked": t,
      "aria-label": e,
      title: e,
      onClick: a,
      style: o !== void 0 && !t ? { boxShadow: `inset 0 0 0 1.5px hsl(${o} 60% 55% / 0.55)` } : void 0,
      className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${t ? "bg-primary text-primary-ink" : "bg-card-bg text-secondary hover:text-fg"}`,
      children: s
    }
  );
}
function Zr({ models: e, value: t, onChange: a, favorites: o, onToggleFavorite: s, usage: i, showGroup: n, scope: b = "default" }) {
  var X;
  const [N, h] = k(!1), [M, A] = k(""), [m, _] = k("popular"), [v, O] = k(!1), S = K(null), E = Z(() => Hr(e), [e]), f = Z(() => Kr(e), [e]), p = Xr(e, E), x = f.length >= Br, [w, L] = k(() => ct(`muapi-studio:provider:${b}`, re)), [I, P] = k(() => ct(`muapi-studio:category:${b}`, re)), G = p && (w === me || w === re || E.some((u) => u.id === w)) ? w : re, U = x && (I === re || f.some((u) => u.id === I)) ? I : re, g = (u) => {
    L(u), dt(`muapi-studio:provider:${b}`, u);
  }, q = (u) => {
    P(u), dt(`muapi-studio:category:${b}`, u);
  }, W = K(null);
  B(() => {
    N || O(!1);
  }, [N]), B(() => {
    if (!N) return;
    const u = (ee) => {
      var z;
      (z = S.current) != null && z.contains(ee.target) || h(!1);
    }, j = (ee) => {
      ee.key === "Escape" && h(!1);
    };
    return document.addEventListener("mousedown", u), document.addEventListener("keydown", j), () => {
      document.removeEventListener("mousedown", u), document.removeEventListener("keydown", j);
    };
  }, [N]);
  const c = Z(() => {
    const u = M.trim().toLowerCase(), j = Wr(e, { category: U, provider: G, favourites: o }, E), ee = u ? j.filter((ie) => ie.name.toLowerCase().includes(u) || ie.category.toLowerCase().includes(u)) : j, z = xt(ee, m, { usage: i, favorites: o });
    if (m === "favourites" || m === "most-used") return z;
    const oe = new Set(o);
    return [...z.filter((ie) => oe.has(ie.name)), ...z.filter((ie) => !oe.has(ie.name))];
  }, [e, M, m, o, i, U, G, E]), [d, y] = k(0);
  B(() => {
    var u, j;
    y(0), (j = (u = W.current) == null ? void 0 : u.scrollTo) == null || j.call(u, { top: 0 });
  }, [M, m, N, U, G]);
  const T = (u) => {
    u.key === "ArrowDown" ? (u.preventDefault(), y((j) => Math.min(j + 1, Math.min(c.length, Ce) - 1))) : u.key === "ArrowUp" ? (u.preventDefault(), y((j) => Math.max(j - 1, 0))) : u.key === "Enter" && c[d] && (u.preventDefault(), a(c[d].name), h(!1));
  };
  return B(() => {
    var u, j;
    (j = (u = document.getElementById(`ms-opt-${d}`)) == null ? void 0 : u.scrollIntoView) == null || j.call(u, { block: "nearest" });
  }, [d]), /* @__PURE__ */ l("div", { ref: S, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        onClick: () => h((u) => !u),
        "aria-haspopup": "listbox",
        "aria-expanded": N,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (X = (t ?? "?")[0]) == null ? void 0 : X.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Te, { up: N, width: 16, height: 16 })
        ]
      }
    ),
    N && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ l("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(Re, { label: "All providers", active: G === re, onClick: () => g(re), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(Re, { label: "Favourites", active: G === me, onClick: () => g(me), children: /* @__PURE__ */ r(at, { width: 14, height: 14, filled: G === me }) }),
        E.map((u) => /* @__PURE__ */ r(Re, { label: `${u.label} (${u.count})`, active: G === u.id, onClick: () => g(u.id), hue: Yr(u.label), children: Jr(u.label) }, u.id))
      ] }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ l("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(Ye, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: T, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${d}`, value: M, onChange: (u) => A(u.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ l("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": v,
                onClick: () => O((u) => !u),
                className: `flex h-full items-center rounded-ctl border px-3 ${v ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(pr, { width: 16, height: 16 })
              }
            ),
            v && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: Yt.map((u) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ l(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": m === u.id,
                onClick: () => {
                  _(u.id), O(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${m === u.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  u.label,
                  m === u.id && /* @__PURE__ */ r(xe, { width: 14, height: 14 })
                ]
              }
            ) }, u.id)) })
          ] })
        ] }),
        x && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: re, label: "All" }, ...f.map((u) => ({ id: u.id, label: u.id }))].map((u) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": U === u.id,
            onClick: () => q(u.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${U === u.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: u.label
          },
          u.id
        )) }),
        p && /* @__PURE__ */ l("div", { className: "mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
          G === re ? "All models" : G === me ? "Favourites" : G,
          " · ",
          c.length
        ] }),
        /* @__PURE__ */ l("ul", { id: "ms-listbox", ref: W, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          c.slice(0, Ce).map((u, j) => {
            const ee = u.name === t;
            return /* @__PURE__ */ l(
              "li",
              {
                id: `ms-opt-${j}`,
                role: "option",
                "aria-selected": ee,
                onClick: () => {
                  a(u.name), h(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${ee ? "bg-primary-soft" : j === d ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: [
                  /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ r("div", { className: `truncate text-sm ${ee ? "text-primary" : ""}`, children: u.name }),
                    /* @__PURE__ */ r("div", { className: "text-[10px] text-secondary", children: n ? `${u.group_of} · ${u.category}` : p && G === re ? `${At(u, E)} · ${u.category}` : u.category })
                  ] }),
                  /* @__PURE__ */ r(
                    "button",
                    {
                      type: "button",
                      "aria-label": o.includes(u.name) ? "Remove favorite" : "Add favorite",
                      onClick: (z) => {
                        z.stopPropagation(), s(u.name);
                      },
                      className: o.includes(u.name) ? "text-primary" : "text-muted hover:text-fg",
                      children: /* @__PURE__ */ r(at, { width: 15, height: 15, filled: o.includes(u.name) })
                    }
                  ),
                  /* @__PURE__ */ r(Qr, { model: u })
                ]
              },
              u.name
            );
          }),
          c.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: m === "favourites" ? "No favourites yet. Tap the heart on a model." : m === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${M}”.` }),
          c.length > Ce && /* @__PURE__ */ l("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ce,
            " of ",
            c.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const ut = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, De = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, It = 0.25;
function ea({ mode: e, models: t, client: a, batch: o, onRun: s, usage: i, reuse: n, switcher: b }) {
  const N = le.find((C) => C.id === e), h = Z(() => Jt(t, e), [t, e]), [M, A] = k(), [m, _] = k(null), [v, O] = k(null), [S, E] = k({}), [f, p] = k(null), [x, w] = k(null), [L, I] = k(() => ut("muapi-studio:favorites", [])), [P, G] = k("form"), [U, g] = k(!1), [q, W] = k("{}"), [c, d] = k(null), y = K(0), T = K(null);
  B(() => {
    if (!U) return;
    const C = (H) => {
      var te;
      (te = T.current) != null && te.contains(H.target) || g(!1);
    }, V = (H) => {
      H.key === "Escape" && g(!1);
    };
    return document.addEventListener("mousedown", C), document.addEventListener("keydown", V), () => {
      document.removeEventListener("mousedown", C), document.removeEventListener("keydown", V);
    };
  }, [U]);
  const X = K(null);
  B(() => {
    var H, te, ce;
    const C = ut(`muapi-studio:model:${e}`, null), V = ((H = h.find((se) => se.name === C)) == null ? void 0 : H.name) ?? ((te = h.find((se) => se.name === zt[e])) == null ? void 0 : te.name) ?? ((ce = xt(h, "popular")[0]) == null ? void 0 : ce.name);
    A(V);
  }, [e, h]), B(() => {
    n && (X.current = n.inputs, h.some((C) => C.name === n.model) && (A(n.model), De(`muapi-studio:model:${e}`, n.model)), G("form"));
  }, [n == null ? void 0 : n.nonce]);
  const u = h.find((C) => C.name === M);
  B(() => {
    if (!M) return;
    let C = !0;
    return _(null), O(null), p(null), w(null), d(null), a.model(M).then((V) => {
      if (!C) return;
      const H = ot(V), te = Ge(H), ce = X.current;
      if (X.current = null, ce)
        for (const se of H) ce[se.prop.name] !== void 0 && (te[se.prop.name] = ce[se.prop.name]);
      _(V), E(te);
    }).catch((V) => {
      C && O(V.message);
    }), () => {
      C = !1;
    };
  }, [M, a]);
  const j = Z(() => m ? ot(m) : [], [m]), ee = Z(() => it(j, S), [j, S]), z = Z(() => {
    try {
      const C = JSON.parse(q);
      return C && typeof C == "object" && !Array.isArray(C) ? C : null;
    } catch {
      return null;
    }
  }, [q]), oe = P === "json" ? z ?? {} : ee, ie = JSON.stringify(oe);
  B(() => {
    if (!m || P === "json" && !z) return;
    const C = ++y.current, V = setTimeout(() => {
      a.estimate(m.name, oe).then((H) => {
        C === y.current && p(H);
      }).catch(() => {
        C === y.current && p(null);
      });
    }, 500);
    return () => clearTimeout(V);
  }, [m, ie, a]);
  const we = (C) => {
    A(C), De(`muapi-studio:model:${e}`, C);
  }, Ee = (C) => I((V) => {
    const H = V.includes(C) ? V.filter((te) => te !== C) : [...V, C];
    return De("muapi-studio:favorites", H), H;
  }), ke = (C) => {
    g(!1), C !== P && (C === "json" ? W(JSON.stringify(ee, null, 2)) : z && E((V) => {
      const H = { ...V };
      for (const te of j) z[te.prop.name] !== void 0 && (H[te.prop.name] = z[te.prop.name]);
      return H;
    }), G(C), w(null));
  }, Q = u ? He(u, f) : null, ge = ae(async () => {
    if (!m) return;
    d(null);
    const C = j.find((V) => V.prop.name === "prompt");
    await s({
      model: m.name,
      endpointUrl: m.endpoint_url,
      mode: e,
      payload: oe,
      count: o,
      kind: ze(m.category),
      prompt: C ? String(oe.prompt ?? "") : "",
      unitCost: Q == null ? void 0 : Q.current
    });
  }, [m, j, s, e, oe, o, Q]), _e = ae(async () => {
    if (!m) return;
    if (P === "json") {
      if (!z) {
        w("The JSON is not valid");
        return;
      }
      const V = (m.required_fields ?? []).find((H) => z[H] === void 0 || z[H] === "");
      if (V) {
        w(`${V} is required`);
        return;
      }
    } else {
      const V = Cr(j, S);
      if (V) {
        w(V);
        return;
      }
    }
    w(null);
    const C = ((Q == null ? void 0 : Q.current) ?? 0) * o;
    if (C > It) {
      d(C);
      return;
    }
    await ge();
  }, [m, P, z, j, S, Q, o, ge]), R = !!m && !v, J = (() => {
    var V;
    const C = j.find((H) => H.kind === "media-list");
    return C ? Math.max(((V = S[C.prop.name]) == null ? void 0 : V.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ l("section", { "aria-label": N.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ l("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: N.title }),
        /* @__PURE__ */ l("div", { ref: T, className: "relative", children: [
          /* @__PURE__ */ l("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": U, onClick: () => g((C) => !C), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            P === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Te, { up: U, width: 12, height: 12 })
          ] }),
          U && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((C) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": P === C, type: "button", onClick: () => ke(C), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${P === C ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: C === "json" ? "JSON" : "Form" }) }, C)) })
        ] })
      ] }),
      b,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(Zr, { models: h, value: M, onChange: we, favorites: L, onToggleFavorite: Ee, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: P === "json" ? "Request body" : "Parameters" }),
      (u == null ? void 0 : u.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: u.description }),
      !R && !v && M && /* @__PURE__ */ l("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(ve, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      v && /* @__PURE__ */ l("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        v
      ] }),
      h.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      R && P === "json" && /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !z, spellCheck: !1, rows: 16, value: q, onChange: (C) => W(C.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${z ? "text-muted" : "text-danger"}`, children: z ? `Sent as the body of POST /api/v1/${m.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      R && P === "form" && j.map((C) => /* @__PURE__ */ r(
        Vr,
        {
          field: C,
          values: S,
          client: a,
          onError: w,
          tagCount: C.prop.name === "prompt" ? J : 0,
          onChange: (V, H) => E((te) => ({ ...te, [V]: H }))
        },
        C.prop.name
      ))
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      x && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: x }),
      c !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(c) }),
        " (",
        o,
        " × ",
        ne((Q == null ? void 0 : Q.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void ge(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => d(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          m && (E(Ge(j)), W(JSON.stringify(it(j, Ge(j)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ l(
          "button",
          {
            type: "button",
            onClick: () => void _e(),
            disabled: !R,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(Je, { width: 16, height: 16 }),
              "Generate",
              o > 1 ? ` ×${o}` : "",
              Q && /* @__PURE__ */ l("span", { className: "font-normal", children: [
                "(",
                Q.original !== null ? /* @__PURE__ */ l(Me, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: ne(Q.original * o) }),
                  " "
                ] }) : null,
                ne(Q.current * o),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const ta = {
  image: Ie,
  video: ir,
  audio: sr,
  avatar: lr,
  "3d": kt,
  "ai-tools": cr,
  text: hr,
  more: fr
};
function ra({ mode: e, onChange: t, layout: a = "rail" }) {
  return a === "tabs" ? /* @__PURE__ */ r("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: le.map((o) => {
    const s = o.id === e;
    return /* @__PURE__ */ l(
      "button",
      {
        onClick: () => t(o.id),
        "aria-current": s ? "page" : void 0,
        className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${s ? "text-primary" : "text-secondary hover:text-fg"}`,
        children: [
          o.label,
          s && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
        ]
      },
      o.id
    );
  }) }) : /* @__PURE__ */ r("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: le.map((o) => {
    const s = ta[o.id], i = o.id === e;
    return /* @__PURE__ */ l(
      "button",
      {
        onClick: () => t(o.id),
        "aria-current": i ? "page" : void 0,
        className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${i ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
        children: [
          /* @__PURE__ */ r(s, {}),
          o.label
        ]
      },
      o.id
    );
  }) });
}
const aa = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, mt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, oa = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], na = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], ia = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], sa = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), la = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], ca = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), da = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], ua = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], ma = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], pa = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], ha = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), fa = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], ga = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), ba = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Mt = {
  seedream: { aspect: oa, resolution: na },
  seedance: { aspect: ia, duration: sa },
  minimax: { resolution: la, duration: ca },
  wan: { aspect: da, resolution: ua, quality: ma, duration: pa },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, ya = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, de = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Tt(e) {
  return ((a) => a.map((o, s) => {
    var i;
    return { ...o, label: ((i = aa[e.slug]) == null ? void 0 : i[s]) ?? o.label };
  }))(xa(e));
}
function xa(e) {
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
function va(e) {
  return ya[e.template];
}
function pt(e) {
  var o, s, i, n, b, N, h, M, A, m, _;
  const t = Mt[e.template], a = {};
  for (const v of e.sliders ?? []) a[v.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((o = e.presets) != null && o[0], ""),
    sliders: a,
    aspect: (i = (s = t.aspect) == null ? void 0 : s[0]) == null ? void 0 : i.value,
    resolution: (b = (n = t.resolution) == null ? void 0 : n[0]) == null ? void 0 : b.value,
    duration: ((h = (N = t.duration) == null ? void 0 : N.find((v) => v.value === 5)) == null ? void 0 : h.value) ?? ((A = (M = t.duration) == null ? void 0 : M[0]) == null ? void 0 : A.value),
    quality: (_ = (m = t.quality) == null ? void 0 : m[0]) == null ? void 0 : _.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function $t(e, t) {
  var s;
  const a = [e.prompt], o = (s = e.presets) == null ? void 0 : s.find((i) => i.id === t.preset);
  o != null && o.prompt && a.push(o.prompt);
  for (const i of e.sliders ?? []) {
    const n = t.sliders[i.id] ?? 0;
    if (n !== 0) {
      const b = i.phrase(n);
      b && a.push(b);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function ht(e, t, a) {
  var i;
  const o = (i = e.presets) == null ? void 0 : i.find((n) => n.id === a), s = { ...Object.fromEntries((e.sliders ?? []).map((n) => [n.id, 0])), ...(o == null ? void 0 : o.values) ?? {} };
  return { ...t, preset: a, sliders: s };
}
function wa(e, t) {
  for (const a of Tt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function ka(e, t) {
  const a = $t(e, t), o = t.uploads;
  switch (e.template) {
    case "seedream":
      return { prompt: a, images_list: [o.source], aspect_ratio: t.aspect, resolution: t.resolution };
    case "seedance":
      return { prompt: a, images_list: [o.source], aspect_ratio: t.aspect, duration: Number(t.duration) };
    case "minimax":
      return { prompt: a, image_url: o.start, ...o.end ? { last_image_url: o.end } : {}, resolution: t.resolution, duration: Number(t.duration) };
    case "wan":
      return { prompt: a, image_url: o.start, ...o.end ? { last_image: o.end } : {}, aspect_ratio: t.aspect, resolution: t.resolution, quality: t.quality, duration: Number(t.duration) };
    case "skin":
      return { image_url: o.source };
    case "face-swap":
      return { image_url: o.base, swap_url: o.face, target_index: t.targetIndex };
    case "video-face-swap":
      return { image_url: o.face, video_url: o.video, target_gender: t.gender, target_index: t.targetIndex };
    case "bg-remover":
      return { video_url: o.video, background_color: t.background, output_container_and_codec: t.container, preserve_audio: t.keepAudio };
  }
}
function Na(e) {
  return mt[e.slug] ? mt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Sa = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], $ = (e, t, a, o, s) => ({ id: e, label: t, hint: a, prompt: o, values: s }), qe = (e, t, a, o = "") => `${e > 0 ? t : a} ${Math.abs(e)}${o}`, F = (e, t, a, o, s, i, n = {}) => ({ slug: e, name: t, emoji: a, category: o, badge: "IMAGE", template: "seedream", blurb: s, prompt: i, ...n }), D = (e, t, a, o, s, i, n = {}) => ({ slug: e, name: t, emoji: a, category: o, badge: "VIDEO", template: "seedance", blurb: s, prompt: i, ...n }), Ae = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${qe(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${qe(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Ca = [Ae[2], { ...Ae[1], id: "vertical", label: "Vertical angle" }, Ae[0]].map((e) => ({ ...e, id: e.id })), Aa = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${qe(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Ia = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], Ma = "Keep the result tasteful and suitable for general audiences.", Et = [
  // ---- Professional
  F(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Ae, presets: [
      $("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      $("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      $("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      $("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      $("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      $("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      $("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  F(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  F(
    "shots",
    "Shots",
    "🎥",
    "professional",
    "Reframe one photo as different cinematic shot types.",
    "Reframe this scene as a professional cinematic shot while keeping the same subject and setting.",
    { presets: [
      $("wide", "Wide", void 0, "Use a wide establishing shot."),
      $("medium", "Medium", void 0, "Use a medium shot from the waist up."),
      $("close", "Close-up", void 0, "Use a close-up on the subject’s face or key detail."),
      $("xcu", "Extreme close-up", void 0, "Use an extreme close-up on a small detail."),
      $("ots", "Over-the-shoulder", void 0, "Use an over-the-shoulder shot."),
      $("low", "Low angle", void 0, "Shoot from a low angle looking up."),
      $("high", "High angle", void 0, "Shoot from a high angle looking down."),
      $("dutch", "Dutch angle", void 0, "Tilt the camera for a Dutch angle.")
    ] }
  ),
  F(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Ca.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
  ),
  D(
    "behind-the-scenes",
    "Behind the Scenes",
    "🎞️",
    "professional",
    "Pull back from the photo to reveal the film set around it.",
    "Start on this photograph, then pull the camera back to reveal it is a film set with lighting rigs, cameras and crew working around the scene."
  ),
  D(
    "transitions",
    "Transitions",
    "🔄",
    "professional",
    "Animate a smooth cinematic transition out of the image.",
    "Create a smooth, professional cinematic transition starting from this image with fluid motion.",
    { presets: [
      $("morph", "Morph", void 0, "Use a morph transition."),
      $("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      $("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      $("whip", "Whip pan", void 0, "Use a fast whip pan."),
      $("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  F(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  F(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: Ia, presets: [
      $("natural", "Natural", "Clean, true to life", void 0, { saturation: 5, contrast: 5 }),
      $("cinematic", "Cinematic", "Teal and orange", "Give it a cinematic teal and orange look.", { contrast: 20, saturation: 10, temperature: -5 }),
      $("split", "Split tone", "Warm highlights, cool shadows", "Use split toning with warm highlights and cool shadows.", { contrast: 10 }),
      $("softskin", "Soft skin", "Gentle and flattering", "Soften skin tones gently.", { contrast: -10, highlights: -10 }),
      $("oldlens", "Old lens", "Vintage glass", "Mimic a vintage lens with soft edges and subtle flare.", { saturation: -10, grain: 20 }),
      $("film16", "16mm film", "Grain and warmth", "Mimic 16mm film stock.", { temperature: 15, grain: 55, contrast: 10 }),
      $("moody", "Moody", "Dark and desaturated", "Make it dark and moody.", { exposure: -20, saturation: -25, contrast: 25 })
    ] }
  ),
  // ---- Enhance & Style
  F(
    "ai-stylist",
    "AI Stylist",
    "👗",
    "enhance-style",
    "Try outfit styles on your photo while keeping your pose.",
    "Restyle the person in this photo with a new outfit while keeping their face, pose and the background natural.",
    { presets: [
      $("casual", "Casual", void 0, "Dress them in a relaxed casual outfit."),
      $("formal", "Formal", void 0, "Dress them in a sharp formal outfit."),
      $("street", "Streetwear", void 0, "Dress them in streetwear."),
      $("athletic", "Athletic", void 0, "Dress them in athletic wear."),
      $("evening", "Evening", void 0, "Dress them in an elegant evening outfit."),
      $("vintage", "Vintage", void 0, "Dress them in a vintage-style outfit.")
    ] }
  ),
  F(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Aa }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  F(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  F(
    "style-snap",
    "Style Snap",
    "📸",
    "enhance-style",
    "Quick style makeovers that keep your pose.",
    "Give the person a new fashion style while keeping the same pose, face and setting.",
    { presets: [
      $("boho", "Boho chic", void 0, "Use a boho chic look."),
      $("minimal", "Minimalist", void 0, "Use a clean minimalist look."),
      $("punk", "Punk rock", void 0, "Use a punk rock look."),
      $("preppy", "Preppy", void 0, "Use a preppy look."),
      $("y2k", "Y2K", void 0, "Use an early-2000s Y2K look."),
      $("cottage", "Cottagecore", void 0, "Use a cottagecore look.")
    ] }
  ),
  F(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  F(
    "glitter-sticker",
    "Glitter Sticker",
    "🌟",
    "enhance-style",
    "Turn a portrait into a holographic glitter sticker on a street wall.",
    "Turn this portrait into a shiny holographic glitter sticker stuck onto a gritty urban surface."
  ),
  D(
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
  F(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  F(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  F(
    "headshot-generator",
    "Headshot Generator",
    "📷",
    "face-identity",
    "Studio-style professional headshots from a photo.",
    "Create a professional studio headshot of this person: flattering lighting, clean background, natural expression and sharp focus on the face.",
    { consent: !0, presets: [
      $("corporate", "Corporate", void 0, "Use a classic corporate look."),
      $("creative", "Creative", void 0, "Use a modern creative look with a colored backdrop."),
      $("linkedin", "LinkedIn", void 0, "Frame it as a friendly LinkedIn profile photo."),
      $("exec", "Executive", void 0, "Use an authoritative executive look.")
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
  F(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  F(
    "japanese-show",
    "Japanese Show",
    "📺",
    "video-editing",
    "Retro variety-show look with CRT scanlines.",
    "Turn this photo into a still from a retro 2000s Japanese variety show, with CRT scanlines, on-screen captions and broadcast effects."
  ),
  { slug: "video-bg-remover", name: "Video Background Remover", emoji: "🎬", category: "video-editing", badge: "VIDEO", template: "bg-remover", blurb: "Remove the background from a video.", prompt: "" },
  // ---- Ads & Products (the uploaded image is the product or subject)
  D("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  D("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  D("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  F("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
  D("bullet-time-scene", "Bullet Time Scene", "⏱️", "ads", "Frozen-moment bullet-time camera move.", "Create a bullet-time effect: time freezes while the camera sweeps around the subject and product in the image."),
  D("chameleon", "Chameleon", "🦎", "ads", "A character changes to match the product’s look.", "Show the character smoothly transforming their outfit and colors to match the brand look of the product in the image."),
  D("asmr-host", "ASMR Host", "🎙️", "ads", "A whispering host presents the product.", "Create an ASMR presentation where a soft-spoken host presents the product from the image up close."),
  D("packshot", "Packshot", "📦", "ads", "Polished product showcase with slow rotation.", "Create a clean studio packshot video of the product in the image, slowly rotating under soft studio lighting."),
  D("macro-scene", "Macro Scene", "🔬", "ads", "Extreme close-up of product details.", "Create an extreme macro close-up video that glides over the textures and details of the product in the image."),
  D("magic-button", "Magic Button", "✨", "ads", "The product appears in a burst of light.", "Show the product from the image appearing magically in a burst of light and drifting particles."),
  D("truck-ad", "Truck Ad", "🚛", "ads", "Product displayed on a truck driving through a city.", "Show the product from the image printed large on the side of a truck driving through a busy city street."),
  D("giant-product", "Giant Product", "🦖", "ads", "A building-sized product towering over a person.", "Create a surreal scene where the product from the image is as tall as a building, towering over a small person on the street."),
  D("bullet-time-white", "Bullet Time White", "⚪", "ads", "360° rotation on a clean white background.", "Create a bullet-time 360 degree rotation around the subject and product in the image on a clean white background."),
  D("kick-ad", "Kick Ad", "🦵", "ads", "A character kicks the product into frame.", "Create an energetic action ad where a character kicks the product from the image into the frame."),
  D("billboard-ad", "Billboard Ad", "🏙️", "ads", "Product on a glowing billboard at night.", "Show the product from the image on a huge glowing billboard in a busy city at night."),
  F("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  D("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  D("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  D("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  F("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  F(
    "game-dump",
    "Game Dump",
    "🎮",
    "games-characters",
    "See yourself as a hero in different game genres.",
    "Transform the person in this photo into a video game character with a game-style interface overlay, keeping their likeness.",
    { presets: [
      $("fps", "FPS shooter", void 0, "Use a first-person shooter look."),
      $("rpg", "RPG fantasy", void 0, "Use a fantasy role-playing game look."),
      $("racing", "Racing", void 0, "Use a racing game look."),
      $("fighting", "Fighting", void 0, "Use a fighting game look."),
      $("horror", "Survival horror", void 0, "Use a survival horror game look."),
      $("sports", "Sports", void 0, "Use a sports game look."),
      $("open", "Open world", void 0, "Use an open-world adventure game look."),
      $("platform", "Platformer", void 0, "Use a colorful platformer look.")
    ] }
  ),
  F("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  F("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  F("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  F("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  F("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  F("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  F(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [$("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), $("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), $("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), $("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  F("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  D("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  D("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${Ma}`),
  D("roller-coaster", "Roller Coaster", "🎢", "trending-templates", "A thrilling roller-coaster ride.", "Put the person from this photo on a roller coaster ride with wind, speed and a dramatic camera."),
  D("60s-cafe", "60s Cafe", "☕", "trending-templates", "A vintage 1960s cafe scene.", "Place the person from this photo in a vintage 1960s cafe with retro decor, warm film tones and gentle motion."),
  D("victory-card", "Victory Card", "🃏", "trending-templates", "A winning playing-card moment.", "Turn this photo into a winning playing card, with the person triumphant as the card flips and glows."),
  D("sand-worm", "Sand Worm", "🐛", "trending-templates", "An epic desert creature scene.", "Place the person from this photo in an epic desert scene with a giant sand creature rising behind them."),
  D("skibidi", "Toilet Meme", "🚽", "trending-templates", "A silly toilet-character meme look.", "Turn this photo into a goofy toilet-themed meme character with exaggerated head bobbing."),
  D("j-poster", "J Poster", "🎌", "trending-templates", "A Japanese-style poster.", "Turn this photo into a bold Japanese-style poster with dramatic typography and animated accents."),
  D("mascot", "Mascot", "🏈", "trending-templates", "A sports mascot character.", "Transform the person in this photo into an energetic sports mascot character cheering in a stadium."),
  D("storm-creature", "Storm Creature", "⛈️", "trending-templates", "An epic storm creature scene.", "Place the person from this photo in a stormy sky scene with a giant creature made of clouds and lightning."),
  D("burning-sunset", "Burning Sunset", "🌅", "trending-templates", "An epic burning-sunset scene.", "Place the person from this photo against an epic burning sunset sky with drifting embers."),
  D("on-fire", "On Fire", "🔥", "trending-templates", "A calm-in-chaos burning-room meme scene.", "Show the person from this photo calmly sitting in a room that is on fire, in a humorous cartoon-like meme style."),
  D("comic-book", "Comic Book", "💥", "trending-templates", "Comic-book panels and action lines.", "Turn this photo into an animated comic-book page with bold ink lines, halftone dots and action bursts."),
  D("cloud-surf", "Cloud Surf", "☁️", "trending-templates", "Surfing on dreamy pink clouds.", "Show the person from this photo surfing on a wave of dreamy pink clouds at sunset."),
  D("mukbang", "Mukbang", "🍜", "trending-templates", "A viral eating-show scene.", "Turn this photo into a viral eating-show video with the person enjoying a big spread of food at a table."),
  D("melting-doodle", "Melting Doodle", "🫠", "trending-templates", "Mesmerizing melting doodle art.", "Turn this photo into colorful doodle art that slowly melts and swirls."),
  D("giallo-horror", "Giallo Horror", "🩸", "trending-templates", "A stylised 1970s thriller scene.", "Turn this photo into a stylised 1970s Italian thriller scene with saturated colors, dramatic shadows and a suspenseful camera move. Keep it non-graphic."),
  D("renaissance", "Renaissance", "🖼️", "trending-templates", "A classical gallery painting.", "Turn this photo into a classical Renaissance oil painting hanging in a gallery, subtly coming to life."),
  D("rap-god", "Rap God", "🎤", "trending-templates", "A rap-video style clip.", "Turn this photo into a stylish rap music video clip with the person performing, with dynamic lighting and camera moves.")
], $e = (e) => Et.find((t) => t.slug === e), Fe = (e) => e.badge === "VIDEO" ? "video" : "image", We = (e) => Et.filter((t) => Fe(t) === e), Be = (e) => We(e).length > 0;
function _t(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), o = $e(t.get("app"));
  return a === "apps" ? { mode: o ? Fe(o) : "image", app: (o == null ? void 0 : o.slug) ?? null } : o && a === Fe(o) ? { mode: a, app: o.slug } : { mode: null, app: null };
}
function Ta(e, t, a) {
  const o = new URLSearchParams(e);
  return o.set("tab", t), o.delete("category"), a ? o.set("app", a) : o.delete("app"), `?${o.toString()}`;
}
function $a(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((o) => (!t.category || t.category === "all" || o.category === t.category) && (!a || `${o.name} ${o.blurb}`.toLowerCase().includes(a)));
}
const Ea = (e) => Sa.filter((t) => We(e).some((a) => a.category === t.id));
function _a({ mode: e, value: t, onChange: a }) {
  const [o, s] = k(!1), [i, n] = k(""), [b, N] = k("all"), [h, M] = k(0), A = K(null), m = Z(() => Ea(e), [e]), _ = Z(() => $a(We(e), { category: b, q: i }), [e, b, i]), v = $e(t);
  B(() => M(0), [i, b, o]), B(() => {
    if (!o) return;
    const f = (x) => {
      var w;
      (w = A.current) != null && w.contains(x.target) || s(!1);
    }, p = (x) => {
      x.key === "Escape" && s(!1);
    };
    return document.addEventListener("mousedown", f), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", f), document.removeEventListener("keydown", p);
    };
  }, [o]), B(() => {
    var f, p;
    (p = (f = document.getElementById(`ms-app-${h}`)) == null ? void 0 : f.scrollIntoView) == null || p.call(f, { block: "nearest" });
  }, [h]);
  const O = (f) => {
    a(f), s(!1), n("");
  }, S = (f) => {
    f.key === "ArrowDown" ? (f.preventDefault(), M((p) => Math.min(p + 1, _.length - 1))) : f.key === "ArrowUp" ? (f.preventDefault(), M((p) => Math.max(p - 1, 0))) : f.key === "Enter" && _[h] && (f.preventDefault(), O(_[h].slug));
  }, E = (f) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${f ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ l("div", { ref: A, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": o,
        onClick: () => s((f) => !f),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (v == null ? void 0 : v.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (v == null ? void 0 : v.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Te, { up: o, width: 16, height: 16 })
        ]
      }
    ),
    o && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ l("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(Ye, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: S, value: i, onChange: (f) => n(f.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ l("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": b === "all", onClick: () => N("all"), className: E(b === "all"), children: "All" }),
        m.map((f) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": b === f.id, onClick: () => N(f.id), className: E(b === f.id), children: f.label }, f.id))
      ] }),
      /* @__PURE__ */ l("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        _.map((f, p) => /* @__PURE__ */ l(
          "li",
          {
            id: `ms-app-${p}`,
            role: "option",
            "aria-selected": f.slug === t,
            onClick: () => O(f.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${f.slug === t ? "bg-primary-soft" : p === h ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: f.emoji }),
              /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${f.slug === t ? "text-primary" : ""}`, children: f.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: f.blurb })
              ] })
            ]
          },
          f.slug
        )),
        _.length === 0 && /* @__PURE__ */ l("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          i,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const Ga = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), be = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function La({ mode: e, slug: t, onApp: a, switcher: o, models: s, client: i, batch: n, onRun: b }) {
  const N = $e(t), h = le.find((M) => M.id === e).title;
  return /* @__PURE__ */ l("section", { "aria-label": h, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: h }),
      o,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(_a, { mode: e, value: t, onChange: a }) })
    ] }),
    N ? /* @__PURE__ */ r(Ra, { app: N, mode: e, models: s, client: i, batch: n, onRun: b }, N.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Ra({ app: e, mode: t, models: a, client: o, batch: s, onRun: i }) {
  var U;
  const [n, b] = k(() => pt(e)), [N, h] = k(null), [M, A] = k(null), [m, _] = k(null), v = K(0);
  B(() => {
    b(pt(e)), h(null), A(null), _(null);
  }, [e]);
  const O = va(e), S = a.find((g) => g.name === O), E = Mt[e.template], f = Z(() => ka(e, n), [e, n]), p = JSON.stringify(f), x = (g) => b((q) => ({ ...q, ...g }));
  B(() => {
    if (!S) return;
    const g = ++v.current, q = setTimeout(() => {
      o.estimate(O, f).then((W) => {
        g === v.current && A(W);
      }).catch(() => {
        g === v.current && A(null);
      });
    }, 500);
    return () => clearTimeout(q);
  }, [p, S, o]);
  const w = S ? He(S, M) : null, L = Tt(e), I = async () => {
    S && (_(null), await i({ model: O, endpointUrl: S.endpoint_url, mode: t, prompt: $t(e, n) || e.name, payload: f, count: s, kind: ze(S.category), unitCost: w == null ? void 0 : w.current }));
  }, P = async () => {
    const g = wa(e, n);
    if (g) {
      h(g);
      return;
    }
    h(null);
    const q = ((w == null ? void 0 : w.current) ?? 0) * s;
    if (q > It) {
      _(q);
      return;
    }
    await I();
  }, G = (g, q, W, c) => q && q.length > 0 ? /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: be, children: g }),
    /* @__PURE__ */ r(Ve, { label: g, options: Ga(q), value: W, onChange: c })
  ] }) : null;
  return /* @__PURE__ */ l("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !S && /* @__PURE__ */ l("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        O,
        "”, which is not in your catalog right now."
      ] }),
      L.map((g) => /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: be, children: [
          /* @__PURE__ */ r("span", { children: g.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: g.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          Ue,
          {
            client: o,
            multiple: !1,
            max: 1,
            current: n.uploads[g.id] ? [n.uploads[g.id]] : [],
            field: { prop: { name: `${g.kind}_${g.id}`, title: g.label, field: g.kind }, kind: "media", required: !g.optional },
            onUrls: (q) => x({ uploads: { ...n.uploads, [g.id]: q[0] ?? "" } }),
            onError: h
          }
        )
      ] }, g.id)),
      e.presets && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: be, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(Ve, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((g) => ({ value: g.id, label: g.label, hint: g.hint }))], value: n.preset, onChange: (g) => b(ht(e, n, String(g))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (U = e.sliders) == null ? void 0 : U.map((g) => /* @__PURE__ */ l("div", { className: "mb-4", children: [
        /* @__PURE__ */ l("div", { className: be, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${g.id}`, children: g.label }),
          /* @__PURE__ */ l("span", { className: "tabular-nums text-primary", children: [
            n.sliders[g.id] ?? 0,
            g.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${g.id}`, type: "range", min: g.min, max: g.max, step: g.step, value: n.sliders[g.id] ?? 0, className: "w-full", onChange: (q) => x({ sliders: { ...n.sliders, [g.id]: Number(q.target.value) } }) })
      ] }, g.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => b(ht(e, n, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: be, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: n.refinement, onChange: (g) => x({ refinement: g.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      G("Aspect Ratio", E.aspect, n.aspect, (g) => x({ aspect: g })),
      G(e.template === "seedream" ? "Output Resolution" : "Resolution", E.resolution, n.resolution, (g) => x({ resolution: g })),
      G("Quality Level", E.quality, n.quality, (g) => x({ quality: String(g) })),
      G("Duration", E.duration, n.duration, (g) => x({ duration: Number(g) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && G("Target Face Index", ha, n.targetIndex, (g) => x({ targetIndex: Number(g) })),
      e.template === "video-face-swap" && G("Target Gender Filter", fa, n.gender, (g) => x({ gender: String(g) })),
      e.template === "bg-remover" && /* @__PURE__ */ l(Me, { children: [
        G("Background Color", ga, n.background, (g) => x({ background: String(g) })),
        G("Output Container & Codec", ba, n.container, (g) => x({ container: String(g) })),
        /* @__PURE__ */ l("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": n.keepAudio, onClick: () => x({ keepAudio: !n.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${n.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${n.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      N && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: N }),
      m !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(m) }),
        " (",
        s,
        " × ",
        ne((w == null ? void 0 : w.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void I(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => _(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !S, onClick: () => void P(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(Je, { width: 16, height: 16, className: "shrink-0" }),
        Na(e),
        s > 1 ? ` ×${s}` : "",
        w && w.current > 0 && /* @__PURE__ */ l("span", { className: "font-normal", children: [
          "(",
          ne(w.current * s),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function ft({ view: e, onChange: t }) {
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
function Da() {
  try {
    const e = window.location.search, t = _t(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return Ht(a) ? a : null;
  } catch {
    return null;
  }
}
const ye = {
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
function gt(e) {
  if (!Be(e)) return { view: "models", app: null };
  try {
    const a = _t(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = ye.get(`muapi-studio:app:${e}`);
  return { view: ye.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: $e(t) ? t : null };
}
function ja({ apiBase: e = "/api/muapi", initialTab: t = "image", showHeader: a = !0, title: o = "Studio", teamId: s, theme: i = "lime", layout: n, apiKey: b, onRequestApiKey: N, getHeaders: h, connected: M, fetchImpl: A, features: m, className: _ = "", onTabChange: v }) {
  const O = M === !1 || b === "" || b === null, S = K(h);
  S.current = h;
  const E = Z(() => new Pt(e, s, { apiKey: b || void 0, getHeaders: () => {
    var R;
    return ((R = S.current) == null ? void 0 : R.call(S)) ?? {};
  }, fetchImpl: A }), [e, s, b, A]), [f, p] = k({ library: !0, deleteMedia: !0 }), x = Z(() => ({ library: f.library && (m == null ? void 0 : m.library) !== !1, deleteMedia: (m == null ? void 0 : m.deleteMedia) !== !1 }), [f, m == null ? void 0 : m.library, m == null ? void 0 : m.deleteMedia]), w = n ?? Bt(i), [L, I] = k(() => Da() ?? t), [P, G] = k(4), [U, g] = k(null), [q, W] = k(null), [c, d] = k(null), y = ae(() => {
    E.balance().then(d).catch(() => d(null));
  }, [E]), [T, X] = k(null), u = ar(E, U, y), j = Z(() => Zt(u.items), [u.items]);
  B(() => {
    O || (W(null), g(null), E.models().then(g).catch((R) => W(R.message)), y(), (m == null ? void 0 : m.library) !== !1 && E.probe().then(p));
  }, [E, y, O, m == null ? void 0 : m.library]);
  const [ee, z] = k(() => gt(L)), oe = (R, J) => {
    try {
      window.history.replaceState(null, "", Ta(window.location.search, R, J));
    } catch {
    }
  }, ie = (R) => {
    const J = gt(R);
    I(R), z(J), v == null || v(R), oe(R, J.view === "apps" ? J.app : null);
  }, we = (R) => {
    z((J) => ({ ...J, view: R })), ye.set(`muapi-studio:view:${L}`, R), oe(L, R === "apps" ? ee.app : null);
  }, Ee = (R) => {
    z({ view: "apps", app: R }), ye.set(`muapi-studio:app:${L}`, R), ye.set(`muapi-studio:view:${L}`, "apps"), oe(L, R);
  }, ke = ae(async (R) => {
    await u.run(R);
  }, [u.run]), Q = ae((R) => {
    var C;
    const J = U == null ? void 0 : U.find((V) => V.name === R);
    return J ? ((C = J.sale) == null ? void 0 : C.from) ?? J.cost ?? void 0 : void 0;
  }, [U]), ge = ae((R) => {
    I(R.mode), z((J) => ({ ...J, view: "models" })), X({ model: R.model, inputs: R.inputs, nonce: Date.now() });
  }, []), _e = ae((R) => {
    var V;
    const J = U == null ? void 0 : U.find((H) => H.name === R.model);
    if (!J) return;
    const C = ((V = J.sale) == null ? void 0 : V.from) ?? J.cost ?? 0;
    C > 0.25 && !window.confirm(`Re-run ${R.model} for about $${C.toFixed(2)}?`) || u.run({ model: R.model, endpointUrl: J.endpoint_url, mode: R.mode, prompt: R.prompt, payload: R.inputs, count: 1, unitCost: C, kind: ze(J.category) });
  }, [U, u.run]);
  return /* @__PURE__ */ l("div", { className: `ms-root ${_}`.trim(), style: Ft(i), "data-layout": w, children: [
    a && /* @__PURE__ */ l("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: o }),
      c && /* @__PURE__ */ l("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ne(c.balance) })
      ] })
    ] }),
    O ? /* @__PURE__ */ l("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays in your own account." }),
      N && /* @__PURE__ */ r("button", { type: "button", onClick: N, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ r(bt.Provider, { value: x, children: /* @__PURE__ */ l("div", { className: `flex min-h-0 flex-1 flex-col ${w === "rail" ? "md:flex-row" : ""}`, children: [
      /* @__PURE__ */ r(ra, { mode: L, onChange: ie, layout: w }),
      /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: q ? /* @__PURE__ */ l("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
        "Could not load models: ",
        q
      ] }) : U ? /* @__PURE__ */ l(Me, { children: [
        ee.view === "apps" && Be(L) ? /* @__PURE__ */ r(La, { mode: L, slug: ee.app, onApp: Ee, switcher: /* @__PURE__ */ r(ft, { view: "apps", onChange: we }), models: U, client: E, batch: P, onRun: ke }) : /* @__PURE__ */ r(ea, { mode: L, models: U, client: E, batch: P, onRun: ke, usage: j, reuse: T, switcher: Be(L) ? /* @__PURE__ */ r(ft, { view: "models", onChange: we }) : void 0 }),
        /* @__PURE__ */ r(wr, { mode: L, items: u.items, batch: P, onBatch: G, onLabel: u.setLabel, onRemove: u.remove, onReuse: ge, onRerun: _e, onDeleteMedia: u.deleteMedia, onLoadMore: u.loadMore, hasMore: u.hasMore, loadingMore: u.loadingMore, serverError: u.serverError, estimateFor: Q })
      ] }) : /* @__PURE__ */ l("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
        /* @__PURE__ */ r(ve, {}),
        " Loading studio…"
      ] }) })
    ] }) })
  ] });
}
export {
  ue as ApiError,
  Pt as MuapiClient,
  ja as MuapiStudio,
  Ut as THEMES,
  Vt as cyanTheme,
  Bt as defaultLayout,
  ze as generationKind,
  Oe as limeTheme,
  jt as pollUntilDone,
  qt as resolveTheme,
  Ft as themeStyle
};
