import { jsx as r, jsxs as l, Fragment as Ie } from "react/jsx-runtime";
import { createContext as Ot, useContext as jt, useState as N, useRef as K, useEffect as V, useCallback as te, useMemo as Z, createElement as Pt, useId as Vt, useLayoutEffect as Ut } from "react";
function qt(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
class ue extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function Ft(e, t) {
  var o;
  const a = e == null ? void 0 : e.detail;
  return ((o = a == null ? void 0 : a.error) == null ? void 0 : o.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Bt {
  constructor(t = "/api/muapi", a, o = {}) {
    this.base = t, this.teamId = a, this.opts = o;
  }
  async request(t, a = {}) {
    var b, k;
    const o = new Headers(a.headers);
    if (this.opts.apiKey && o.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [f, A] of Object.entries(await this.opts.getHeaders())) o.set(f, A);
    const s = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: o }), i = await s.text();
    let n = null;
    try {
      n = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!s.ok && qt(s.status, n, i) && !t.startsWith("/app/") && ((k = (b = this.opts).onKeyRejected) == null || k.call(b)), !s.ok) throw new ue(Ft(n, `${s.status} ${s.statusText}`), s.status);
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
async function zt(e, t, a = {}) {
  const { intervalMs: o = 2e3, timeoutMs: s = 15 * 60 * 1e3, signal: i, onUpdate: n } = a, b = Date.now();
  let k = 0;
  for (; Date.now() - b < s; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const f = await e.poll(t);
      if (k = 0, n == null || n(f), f.status === "completed" || f.status === "failed") return f;
    } catch (f) {
      if (++k >= 5) throw f;
    }
    await new Promise((f) => setTimeout(f, o));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const vt = Ot({ library: !0, deleteMedia: !0 }), wt = () => jt(vt), Oe = {
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
}, Ht = {
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
}, Yt = { lime: Oe, cyan: Ht }, Qe = {
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
function kt(e = "lime") {
  return typeof e == "string" ? Yt[e] ?? Oe : { ...Oe, ...e };
}
function Jt(e = "lime") {
  const t = kt(e), a = {};
  for (const o of Object.keys(Qe)) a[Qe[o]] = t[o];
  return a;
}
function Kt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const Wt = (e = "lime") => kt(e).buttonStyle, se = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], Xt = {
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
const Qt = (e) => !!e && se.some((t) => t.id === e);
function Zt(e, t) {
  const a = se.find((o) => o.id === t).groups;
  return e.filter((o) => a.includes(o.group_of) && o.is_enabled && !o.is_coming_soon);
}
const er = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Nt(e, t, a = {}) {
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
const tr = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function rr(e, t) {
  var o, s;
  const a = (o = t.find((i) => i.name === e)) == null ? void 0 : o.group_of;
  return ((s = se.find((i) => a && i.groups.includes(a))) == null ? void 0 : s.id) ?? "ai-tools";
}
function ar(e, t, a = {}) {
  var i;
  const o = e.output ?? {}, s = o.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: rr(e.model, t),
    prompt: typeof s.prompt == "string" ? s.prompt : "",
    inputs: s,
    status: tr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(o.outputs) ? o.outputs : [],
    error: o.error || void 0,
    cost: (i = o.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function or(e, t, a = /* @__PURE__ */ new Set()) {
  const o = new Set(e.map((i) => i.requestId).filter(Boolean));
  return [...e, ...t.filter((i) => !i.requestId || !o.has(i.requestId))].filter((i) => !(i.requestId && a.has(i.requestId))).sort((i, n) => n.createdAt - i.createdAt);
}
function nr(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function oe(e) {
  var o;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((o = t.split(".")[1]) == null ? void 0 : o.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function He(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const St = "muapi-studio:history:v1", ir = 200;
function Ze() {
  try {
    const e = localStorage.getItem(St);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function sr(e) {
  try {
    localStorage.setItem(St, JSON.stringify(e.slice(0, ir)));
  } catch {
  }
}
const lr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, et = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, tt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, rt = "muapi-studio:labels:v1", at = "muapi-studio:hidden:v1";
function cr(e, t, a) {
  const [o, s] = N(() => Ze()), [i, n] = N([]), [b, k] = N(null), [f, A] = N(!1), [M, p] = N(null), G = K(!1), [w, j] = N(() => et(rt, {})), [S, R] = N(() => et(at, [])), g = K(/* @__PURE__ */ new Set()), u = K(new AbortController()), v = K([]);
  v.current = t ?? [], V(() => sr(o), [o]), V(() => tt(rt, w), [w]), V(() => tt(at, S), [S]), V(() => (u.current = new AbortController(), () => u.current.abort()), []);
  const C = te((c, d) => s((x) => x.map((E) => E.id === c ? { ...E, ...d } : E)), []), F = te(async (c, d) => {
    if (!g.current.has(c)) {
      g.current.add(c);
      try {
        const x = await zt(e, d, {
          signal: u.current.signal,
          onUpdate: (E) => C(c, { status: E.status, outputs: E.outputs, error: E.error, cost: E.cost })
        });
        C(c, { status: x.status, outputs: x.outputs, error: x.error, cost: x.cost }), a == null || a();
      } catch (x) {
        x.name !== "AbortError" && C(c, { status: "failed", error: x.message });
      } finally {
        g.current.delete(c);
      }
    }
  }, [e, C, a]);
  V(() => {
    for (const c of Ze()) (c.status === "pending" || c.status === "processing") && c.requestId && F(c.id, c.requestId);
  }, []);
  const I = te(async (c = !1) => {
    if (!G.current) {
      A(!0), p(null);
      try {
        const d = await e.history(c ? void 0 : b ?? void 0), x = d.items.map((E) => ar(E, v.current));
        n((E) => c ? x : [...E, ...x]), k(d.next_cursor);
      } catch (d) {
        d instanceof ue && [403, 404, 405].includes(d.status) ? (G.current = !0, k(null)) : p(d.message);
      } finally {
        A(!1);
      }
    }
  }, [e, b]), _ = K(!1);
  V(() => {
    t && !_.current && (_.current = !0, I(!0));
  }, [t, I]);
  const L = te((c) => {
    const d = Array.from({ length: c.count }, () => ({
      id: lr(),
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
    return s((x) => [...d, ...x]), Promise.all(d.map(async (x) => {
      try {
        const { requestId: E, cost: W } = await e.submit(c.endpointUrl, c.payload, c.kind);
        C(x.id, { requestId: E, ...W !== void 0 ? { cost: W } : {} }), await F(x.id, E);
      } catch (E) {
        C(x.id, { status: "failed", error: E.message });
      }
    }));
  }, [e, C, F]), z = Z(() => {
    const c = (d) => ({ ...d, label: d.requestId && w[d.requestId] || d.label });
    return or(o.map(c), i.map(c), new Set(S));
  }, [o, i, w, S]), y = te((c, d) => {
    c.requestId && j((x) => {
      const E = { ...x };
      return d ? E[c.requestId] = d : delete E[c.requestId], E;
    }), C(c.id, { label: d });
  }, [C]), D = te((c) => {
    s((d) => d.filter((x) => x.id !== c.id)), c.requestId && R((d) => [.../* @__PURE__ */ new Set([...d, c.requestId])]);
  }, []), X = te(async (c) => {
    c.requestId && (await e.deleteMedia(c.requestId), C(c.id, { outputs: [] }), n((d) => d.map((x) => x.requestId === c.requestId ? { ...x, outputs: [] } : x)));
  }, [e, C]);
  return { items: z, run: L, setLabel: y, remove: D, deleteMedia: X, loadMore: () => I(!1), hasMore: !!b, loadingMore: f, serverError: M };
}
const dr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Ct(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : dr.test(e) ? "file" : "image" : "text";
}
function ur(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const mr = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), Y = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Ae = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), pr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), hr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), fr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), Ye = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), gr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Je = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), ot = ({ filled: e, ...t }) => /* @__PURE__ */ r(Y, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Ke = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Me = ({ up: e, ...t }) => /* @__PURE__ */ r(Y, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), br = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), yr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), je = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ve = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), fe = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), At = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), xr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), ge = (e) => /* @__PURE__ */ r(Y, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), vr = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), wr = (e) => /* @__PURE__ */ r(Y, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), kr = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), nt = (e) => /* @__PURE__ */ l(Y, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function It({ url: e }) {
  return /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Ye, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let it = null;
const Nr = () => it ?? (it = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw it = null, e;
}));
function Sr({ url: e, hidden: t = !1 }) {
  const [a, o] = N("loading"), s = K(null);
  return V(() => {
    let i = !0;
    return o("loading"), Nr().catch(() => i && o("failed")), () => {
      i = !1;
    };
  }, [e]), V(() => {
    const i = s.current;
    if (!i) return;
    const n = () => o("ready"), b = () => o("failed");
    return i.addEventListener("load", n), i.addEventListener("error", b), () => {
      i.removeEventListener("load", n), i.removeEventListener("error", b);
    };
  }), a === "failed" ? /* @__PURE__ */ r(It, { url: e }) : /* @__PURE__ */ l("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    Pt("model-viewer", {
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
      /* @__PURE__ */ r(ge, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(Ye, { width: 14, height: 14 }) })
  ] });
}
const Cr = ["All", "Approved", "Rejected", "Unlabeled"], Ar = [1, 2, 4, 6, 8];
function Ir({ url: e, hidden: t, onOpen: a }) {
  const o = t ? { filter: "blur(18px)" } : void 0, s = Ct(e);
  return s === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: o, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: ur(e) }) : s === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: o, className: "aspect-video w-full bg-black object-contain" }) : s === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : s === "3d" ? mr(e) ? /* @__PURE__ */ r(Sr, { url: e, hidden: t }) : /* @__PURE__ */ r(It, { url: e }) : s === "file" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(je, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: o, className: "aspect-square w-full bg-black object-contain" }) });
}
function Mr({ g: e, hidden: t, onLabel: a, onRemove: o, onReuse: s, onRerun: i, onDeleteMedia: n, onOpen: b, estimateFor: k }) {
  const f = e.outputs[0], A = !!f && Ct(f) === "text", [M, p] = N(!1), [G, w] = N(null), j = wt(), S = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", R = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ l("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && f ? /* @__PURE__ */ r(Ir, { url: f, hidden: t, onOpen: () => b(f) }) : e.status === "failed" ? /* @__PURE__ */ l("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(fe, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ l("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(ge, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ l("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ l("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? oe(e.cost) : e.status === "completed" && (k == null ? void 0 : k(e.model)) !== void 0 ? `est. ${oe(k(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && f && (A ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(f)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${R} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(je, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: f, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${R} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(je, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${R} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
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
            className: `${R} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ r(fe, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => s(e), title: "Load this model and settings back into the form", className: S, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: S, children: "Re-run" }),
        e.status === "completed" && f && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var g;
          (g = navigator.clipboard) == null || g.writeText(f).then(() => {
            p(!0), setTimeout(() => p(!1), 1500);
          });
        }, className: S, children: M ? "Copied" : A ? "Copy text" : "Copy link" })
      ] }),
      G && /* @__PURE__ */ l("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        G
      ] }),
      /* @__PURE__ */ l("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ l("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ l("span", { className: "flex shrink-0 gap-3", children: [
          j.deleteMedia && e.requestId && e.status === "completed" && f && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (w(null), n(e).catch((g) => w(g.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => o(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Er({ url: e, onClose: t }) {
  return V(() => {
    const a = (o) => o.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ l("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(fe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Tr({ mode: e, items: t, batch: a, onBatch: o, onLabel: s, onRemove: i, onReuse: n, onRerun: b, onDeleteMedia: k, onLoadMore: f, hasMore: A, loadingMore: M, serverError: p, estimateFor: G }) {
  const [w, j] = N("All"), [S, R] = N(""), [g, u] = N(!1), [v, C] = N(null), F = Z(() => {
    const I = S.trim().toLowerCase();
    return t.filter((_) => _.mode !== e || w === "Approved" && _.label !== "approved" || w === "Rejected" && _.label !== "rejected" || w === "Unlabeled" && _.label !== null ? !1 : !I || _.prompt.toLowerCase().includes(I) || _.model.toLowerCase().includes(I));
  }, [t, e, w, S]);
  return /* @__PURE__ */ l("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Cr.map((I) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": w === I,
          onClick: () => j(I),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${w === I ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: I
        },
        I
      )) }),
      /* @__PURE__ */ l("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(Ke, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: S, onChange: (I) => R(I.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Ar.map((I) => /* @__PURE__ */ r(
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
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": g, "aria-label": g ? "Show previews" : "Hide previews", title: g ? "Show previews" : "Hide previews", onClick: () => u((I) => !I), className: g ? "text-primary" : "text-secondary hover:text-fg", children: g ? /* @__PURE__ */ r(br, { width: 18, height: 18 }) : /* @__PURE__ */ r(yr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      F.length === 0 ? /* @__PURE__ */ l("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Je, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some((I) => I.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((I) => I.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: F.map((I) => /* @__PURE__ */ r(Mr, { g: I, hidden: g, onLabel: s, onRemove: i, onReuse: n, onRerun: b, onDeleteMedia: k, onOpen: C, estimateFor: G }, I.id)) }),
      p && /* @__PURE__ */ l("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        p
      ] }),
      A && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: M, onClick: f, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: M ? "Loading…" : "Load more history" }) }),
      v && /* @__PURE__ */ r(Er, { url: v, onClose: () => C(null) })
    ] })
  ] });
}
const $r = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, _r = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Gr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? $r.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || _r.test(e.name) ? "media" : "text" : "text";
}
function st(e) {
  var n, b;
  const t = (b = (n = e.input_schema) == null ? void 0 : n.schemas) == null ? void 0 : b.input_data, a = (t == null ? void 0 : t.properties) ?? {}, o = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), s = [...o.filter((k) => a[k]), ...Object.keys(a).filter((k) => !o.includes(k))], i = new Set(e.required_fields ?? []);
  return s.map((k) => ({ prop: { ...a[k], name: k }, kind: Gr({ ...a[k], name: k }), required: i.has(k) }));
}
function Ge(e) {
  var a;
  const t = {};
  for (const { prop: o, kind: s, required: i } of e)
    o.default !== void 0 && o.default !== null ? t[o.name] = o.default : i && (s === "textarea" || s === "text") && typeof ((a = o.examples) == null ? void 0 : a[0]) == "string" && (t[o.name] = o.examples[0]);
  return t;
}
const pe = (e) => `__auto:${e}`, lt = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Pe = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function ct(e, t) {
  const a = {};
  for (const { prop: o, kind: s } of e) {
    if (t[pe(o.name)] === !0) continue;
    const i = t[o.name] ?? o.default;
    if (!Pe(i))
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
function Lr(e, t) {
  for (const { prop: a, kind: o, required: s } of e) {
    if (t[pe(a.name)] === !0) continue;
    const i = t[a.name] ?? a.default, n = a.title || a.name;
    if (s && Pe(i)) return `${n} is required`;
    if (o === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${n} must be valid JSON`;
      }
    if (o === "number" && !Pe(i)) {
      const b = Number(i);
      if (!Number.isFinite(b)) return `${n} must be a number`;
      if (a.minValue !== void 0 && b < a.minValue) return `${n} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && b > a.maxValue) return `${n} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const Rr = 12, We = 240, ke = (e) => `${typeof e}:${e}`, Dr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Or(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((o) => o.label.toLowerCase().includes(a)) : e;
}
function jr(e, t, a = We) {
  return e >= a || e >= t ? "down" : "up";
}
const Pr = 40, Vr = 48;
function Ur(e, t) {
  return Math.min(We, Math.max(1, e) * Pr + 8) + (t ? Vr : 0);
}
function qr(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const dt = "Auto (let model decide)", Le = "__auto__";
function Ve({ id: e, label: t, options: a, value: o, onChange: s, allowAuto: i, auto: n, onAuto: b, combobox: k }) {
  const f = Vt(), A = e ?? `ms-dd-${f}`, M = k ?? a.length > Rr, [p, G] = N(!1), [w, j] = N(""), [S, R] = N(0), [g, u] = N("down"), v = K(null), C = K(null), F = K(null), I = a.find((d) => o !== void 0 && ke(d.value) === ke(o)), _ = Z(() => M ? Or(a, w) : a, [M, a, w]), L = Z(
    () => [...i ? [{ key: Le, label: dt, value: Le, isAuto: !0 }] : [], ..._.map((d) => ({ key: ke(d.value), label: d.label, hint: d.hint, value: d.value }))],
    [i, _]
  ), z = n ? Le : I ? ke(I.value) : void 0, y = () => {
    G(!1), j("");
  }, D = (d) => {
    d.isAuto ? b == null || b() : s(d.value), y();
  };
  Ut(() => {
    if (!p || !v.current) return;
    const d = v.current.getBoundingClientRect();
    let x = v.current.parentElement;
    for (; x && !/(auto|scroll)/.test(getComputedStyle(x).overflowY); ) x = x.parentElement;
    const E = x ? x.getBoundingClientRect() : null, W = Math.min(window.innerHeight, E ? E.bottom : window.innerHeight), m = Math.max(0, E ? E.top : 0);
    u(jr(W - d.bottom, d.top - m, Ur(a.length + (i ? 1 : 0), M)));
  }, [p]), V(() => {
    if (!p) return;
    const d = L.findIndex((x) => x.key === z);
    R(d >= 0 ? d : 0);
  }, [p, w]), V(() => {
    var d, x, E;
    p && ((E = (x = (d = C.current) == null ? void 0 : d.querySelector(`[data-i="${S}"]`)) == null ? void 0 : x.scrollIntoView) == null || E.call(x, { block: "nearest" }));
  }, [S, p]), V(() => {
    var d;
    p && M && ((d = F.current) == null || d.focus());
  }, [p, M]), V(() => {
    if (!p) return;
    const d = (x) => {
      var E;
      (E = v.current) != null && E.contains(x.target) || y();
    };
    return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
  }, [p]);
  const X = (d) => {
    if (!p) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(d.key) && (d.preventDefault(), G(!0));
      return;
    }
    if (d.key === "Escape") {
      d.preventDefault(), d.stopPropagation(), y();
      return;
    }
    if (d.key === "Enter") {
      d.preventDefault(), L[S] && D(L[S]);
      return;
    }
    if (d.key === "Tab") {
      y();
      return;
    }
    if (d.key === " " && !M) {
      d.preventDefault(), L[S] && D(L[S]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(d.key) && (d.preventDefault(), R((x) => qr(x, d.key, L.length)));
  }, c = n ? dt : (I == null ? void 0 : I.label) ?? "Select…";
  return /* @__PURE__ */ l("div", { ref: v, className: "relative w-full", onKeyDown: X, children: [
    /* @__PURE__ */ l(
      "button",
      {
        id: A,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": p,
        "aria-label": `${t}: ${c}`,
        "aria-controls": `${A}-list`,
        onClick: () => G((d) => !d),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${p ? "border-primary" : "border-line hover:border-muted"} ${n ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: c }),
          /* @__PURE__ */ r(Me, { up: p, width: 16, height: 16 })
        ]
      }
    ),
    p && /* @__PURE__ */ l("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${g === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      M && /* @__PURE__ */ r(
        "input",
        {
          ref: F,
          value: w,
          onChange: (d) => j(d.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${A}-list`,
          "aria-activedescendant": L[S] ? `${A}-o${S}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ l("ul", { id: `${A}-list`, ref: C, role: "listbox", "aria-label": t, style: { maxHeight: We }, className: "overflow-y-auto", children: [
        L.map((d, x) => {
          const E = d.key === z;
          return /* @__PURE__ */ l(
            "li",
            {
              id: `${A}-o${x}`,
              "data-i": x,
              role: "option",
              "aria-selected": E,
              onMouseEnter: () => R(x),
              onClick: () => D(d),
              className: `flex cursor-pointer items-center justify-between gap-2 rounded-ctl px-3 py-2.5 text-sm ${E ? "bg-primary text-primary-ink" : x === S ? "bg-card-bg" : ""} ${d.isAuto && !E ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ l("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: d.label }),
                  d.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${E ? "opacity-70" : "text-muted"}`, children: d.hint })
                ] }),
                E && /* @__PURE__ */ r(ve, { width: 14, height: 14 })
              ]
            },
            d.key
          );
        }),
        L.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Fr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Br({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Ae, {}) });
}
function zr({ client: e, max: t, initialType: a = "image", onInsert: o, onClose: s }) {
  const [i, n] = N(a), [b, k] = N(""), [f, A] = N(1), [M, p] = N(null), [G, w] = N(null), [j, S] = N(!1), [R, g] = N([]), [u, v] = N(""), [C, F] = N(!1), I = K(null), _ = K(null), L = te(async () => {
    S(!0), w(null);
    try {
      p(await e.mediaLibrary({ mediaType: i, search: b, page: f }));
    } catch (c) {
      w(c.message);
    } finally {
      S(!1);
    }
  }, [e, i, b, f]);
  V(() => {
    const c = setTimeout(L, b ? 300 : 0);
    return () => clearTimeout(c);
  }, [L, b]), V(() => {
    A(1);
  }, [i, b]), V(() => {
    var x;
    const c = document.activeElement;
    (x = I.current) == null || x.focus();
    const d = (E) => {
      if (E.key === "Escape") {
        E.stopPropagation(), s();
        return;
      }
      if (E.key !== "Tab" || !I.current) return;
      const W = [...I.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!W.length) return;
      const m = W[0], P = W[W.length - 1];
      E.shiftKey && document.activeElement === m ? (E.preventDefault(), P.focus()) : !E.shiftKey && document.activeElement === P && (E.preventDefault(), m.focus());
    };
    return document.addEventListener("keydown", d), () => {
      var E;
      document.removeEventListener("keydown", d), (E = c == null ? void 0 : c.focus) == null || E.call(c);
    };
  }, [s]);
  const z = (c) => g((d) => d.includes(c) ? d.filter((x) => x !== c) : t === 1 ? [c] : d.length < t ? [...d, c] : d), y = async (c) => {
    if (c.length) {
      S(!0), w(null);
      try {
        for (const d of c) {
          const x = await e.upload(d);
          await e.saveToLibrary({ url: x, name: d.name, mime_type: d.type || void 0, size_bytes: d.size, media_type: d.type.startsWith("video") ? "video" : d.type.startsWith("audio") ? "audio" : d.type.startsWith("image") ? "image" : "archive" });
        }
        await L();
      } catch (d) {
        w(d.message), S(!1);
      }
    }
  }, D = async () => {
    var d;
    const c = u.trim();
    if (!/^https?:\/\//i.test(c)) {
      w("Enter a full http(s) URL");
      return;
    }
    S(!0), w(null);
    try {
      const x = ((d = c.split("?")[0].split(".").pop()) == null ? void 0 : d.toLowerCase()) ?? "", E = ["mp4", "webm", "mov"].includes(x) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(x) ? "audio" : ["zip", "rar", "7z"].includes(x) ? "archive" : "image";
      await e.saveToLibrary({ url: c, name: c.split("/").pop() || "link", media_type: E }), v(""), F(!1), await L();
    } catch (x) {
      w(x.message), S(!1);
    }
  }, X = async (c) => {
    if (window.confirm(`Delete "${c.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(c.id), g((d) => d.filter((x) => x !== c.url)), await L();
      } catch (d) {
        w(d.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (c) => {
    c.target === c.currentTarget && s();
  }, children: /* @__PURE__ */ l("div", { ref: I, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ l("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Ae, {}) }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ l("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
            (M == null ? void 0 : M.total) ?? 0,
            " ",
            (M == null ? void 0 : M.total) === 1 ? "item" : "items"
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
      /* @__PURE__ */ r("input", { ref: _, type: "file", hidden: !0, multiple: !0, onChange: (c) => {
        const d = Array.from(c.target.files ?? []);
        c.target.value = "", y(d);
      } }),
      /* @__PURE__ */ l("button", { type: "button", onClick: () => {
        var c;
        return (c = _.current) == null ? void 0 : c.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ r(At, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: s, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(fe, {}) })
    ] }),
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Fr.map((c) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": i === c.id, onClick: () => n(c.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === c.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: c.label }, c.id)) }),
      /* @__PURE__ */ r("input", { value: b, onChange: (c) => k(c.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": C, onClick: () => F((c) => !c), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    C && /* @__PURE__ */ l("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: u, onChange: (c) => v(c.target.value), onKeyDown: (c) => c.key === "Enter" && void D(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void D(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      G && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: G }),
      j && !M ? /* @__PURE__ */ l("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(ge, {}),
        " Loading…"
      ] }) : M != null && M.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: M.items.map((c) => {
        const d = R.includes(c.url);
        return /* @__PURE__ */ l("li", { className: `group relative overflow-hidden rounded-card border ${d ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": d, "aria-label": `${d ? "Deselect" : "Select"} ${c.name ?? "file"}`, onClick: () => z(c.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Br, { a: c }) }),
          d && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(ve, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${c.name ?? "file"}`, onClick: () => void X(c), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(fe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: c.name ?? "", children: c.name })
        ] }, c.id);
      }) }) : /* @__PURE__ */ l("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ae, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      M && M.total_pages > 1 && /* @__PURE__ */ l("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: f <= 1, onClick: () => A((c) => c - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        f,
        " of ",
        M.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: f >= M.total_pages, onClick: () => A((c) => c + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ l("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ l("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: R.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !R.length, onClick: () => {
        o(R), s();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(ve, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const Mt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Hr = (e, t = "") => {
  const a = Mt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Yr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function Jr(e, t) {
  const a = await Promise.all(t.map((o) => e.upload(o)));
  return t.forEach((o, s) => void e.saveToLibrary({ url: a[s], name: o.name, mime_type: o.type || void 0, size_bytes: o.size, media_type: Yr(o) }).catch(() => {
  })), a;
}
function Ue({ client: e, field: t, multiple: a, max: o, current: s, onUrls: i, onError: n }) {
  const b = K(null), [k, f] = N(!1), [A, M] = N(!1), [p, G] = N(!1), w = o - s.length, j = wt(), S = async (u) => {
    if (u.length) {
      f(!0);
      try {
        i(await Jr(e, a ? u.slice(0, Math.max(w, 1)) : u.slice(0, 1)));
      } catch (v) {
        n(v.message);
      } finally {
        f(!1);
      }
    }
  }, R = Mt(t.prop.field, t.prop.name), g = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ l(
    "div",
    {
      onDragOver: (u) => {
        u.preventDefault(), M(!0);
      },
      onDragLeave: () => M(!1),
      onDrop: (u) => {
        u.preventDefault(), M(!1), S(Array.from(u.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${A ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: b, type: "file", hidden: !0, accept: R, multiple: a, onChange: (u) => {
          const v = Array.from(u.target.files ?? []);
          u.target.value = "", S(v);
        } }),
        (a ? w > 0 : !0) && /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
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
          /* @__PURE__ */ r("button", { type: "button", disabled: k, onClick: () => {
            var u;
            return (u = b.current) == null ? void 0 : u.click();
          }, "aria-label": "Upload file", title: "Upload file", className: g, children: k ? /* @__PURE__ */ r(ge, { width: 16, height: 16 }) : /* @__PURE__ */ r(At, { width: 16, height: 16 }) }),
          j.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => G(!0), "aria-label": "Choose from media library", title: "Media library", className: g, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        p && j.library && /* @__PURE__ */ r(zr, { client: e, max: a ? Math.max(w, 1) : 1, initialType: Hr(t.prop.field, t.prop.name), onInsert: i, onClose: () => G(!1) })
      ]
    }
  );
}
function Kr({ field: e, values: t, onChange: a, client: o, onError: s, tagCount: i = 0 }) {
  const { prop: n, kind: b, required: k } = e, f = t[n.name], A = (u) => a(n.name, u), M = n.title || n.name, p = `ms-f-${n.name}`, G = f == null ? "" : String(f), w = Array.isArray(f) ? f : [], j = t[pe(n.name)] === !0, S = K(null), R = (u) => {
    const v = S.current, C = typeof f == "string" ? f : "", F = (v == null ? void 0 : v.selectionStart) ?? C.length, I = (v == null ? void 0 : v.selectionEnd) ?? F;
    A(C.slice(0, F) + u + " " + C.slice(I)), requestAnimationFrame(() => {
      v == null || v.focus(), v == null || v.setSelectionRange(F + u.length + 1, F + u.length + 1);
    });
  };
  let g;
  if (b === "textarea" || b === "json")
    g = /* @__PURE__ */ l(Ie, { children: [
      /* @__PURE__ */ r("textarea", { ref: S, id: p, rows: b === "json" ? 4 : 5, value: typeof f == "string" ? f : f ? JSON.stringify(f, null, 2) : "", onChange: (u) => A(u.target.value), className: `w-full resize-y p-3 text-sm ${b === "json" ? "font-mono text-xs" : ""}` }),
      n.name === "prompt" && i > 0 && /* @__PURE__ */ l("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (u, v) => `@image${v + 1}`).map((u) => /* @__PURE__ */ r("button", { type: "button", onClick: () => R(u), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: u }, u))
      ] })
    ] });
  else if (b === "select") {
    const u = n.enum ?? [];
    g = /* @__PURE__ */ r(
      Ve,
      {
        id: p,
        label: M,
        options: Dr(u),
        value: f,
        onChange: (v) => {
          A(v), a(pe(n.name), !1);
        },
        allowAuto: lt(e),
        auto: j,
        onAuto: () => a(pe(n.name), !0)
      }
    );
  } else if (b === "boolean") {
    const u = f === !0;
    g = /* @__PURE__ */ r(
      "button",
      {
        id: p,
        type: "button",
        role: "switch",
        "aria-checked": u,
        onClick: () => A(!u),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${u ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${u ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (b === "number") {
    const u = n.minValue !== void 0 && n.maxValue !== void 0;
    g = /* @__PURE__ */ l("div", { className: `flex items-center gap-3 ${j ? "opacity-40" : ""}`, children: [
      u && /* @__PURE__ */ r("input", { type: "range", disabled: j, "aria-label": `${M} slider`, min: n.minValue, max: n.maxValue, step: n.step ?? (n.type === "number" ? 0.01 : 1), value: G === "" ? n.minValue : Number(G), onChange: (v) => A(Number(v.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: p, type: "number", disabled: j, min: n.minValue, max: n.maxValue, step: n.step ?? (n.type === "number" ? "any" : 1), value: G, onChange: (v) => A(v.target.value === "" ? "" : Number(v.target.value)), className: `px-3 py-2 text-sm ${u ? "w-24" : "w-full"}` })
    ] });
  } else if (b === "media")
    g = /* @__PURE__ */ r(Ue, { client: o, field: e, multiple: !1, max: 1, current: G ? [G] : [], onUrls: (u) => A(u[0]), onError: s });
  else if (b === "media-list") {
    const u = n.maxItems ?? 8;
    g = /* @__PURE__ */ l("div", { className: "space-y-2", children: [
      w.map((v, C) => /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${M} ${C + 1}`, value: v, onChange: (F) => A(w.map((I, _) => _ === C ? F.target.value : I)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${M} ${C + 1}`, onClick: () => A(w.filter((F, I) => I !== C)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(fe, { width: 14, height: 14 }) })
      ] }, C)),
      /* @__PURE__ */ r(Ue, { client: o, field: e, multiple: !0, max: u, current: w, onUrls: (v) => A([...w, ...v].slice(0, u)), onError: s })
    ] });
  } else
    g = /* @__PURE__ */ r("input", { id: p, value: G, onChange: (u) => A(u.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ l("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ l("label", { htmlFor: p, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        M,
        n.description && /* @__PURE__ */ r("span", { title: n.description, className: "text-muted", children: /* @__PURE__ */ r(xr, { width: 13, height: 13 }) })
      ] }),
      lt(e) && b === "number" ? /* @__PURE__ */ l("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: j, onChange: (u) => a(pe(n.name), u.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: b === "media-list" ? `${w.length}/${n.maxItems ?? 8} items${k ? " · required" : ""}` : k ? "* required" : "" })
    ] }),
    g
  ] });
}
const Ne = {
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
}, he = "Other", Wr = 3, Xr = 2, Qr = 20, Zr = 2, ea = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Et(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ne[t] ? Ne[t] : Ne[a] ? Ne[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? he : ea(a);
}
function ta(e) {
  const t = /* @__PURE__ */ new Map();
  for (const s of e) {
    const i = Et(s.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let a = 0;
  const o = [];
  for (const [s, i] of t)
    s === he || i < Wr ? a += i : o.push({ id: s, label: s, count: i });
  return o.sort((s, i) => i.count - s.count || s.label.localeCompare(i.label)), a && o.push({ id: he, label: he, count: a }), o;
}
function Tt(e, t) {
  const a = Et(e.name);
  return t.some((o) => o.id === a) ? a : he;
}
function ra(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function aa(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const ut = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function oa(e) {
  const t = /* @__PURE__ */ new Map();
  for (const o of e) t.set(o.category, (t.get(o.category) ?? 0) + 1);
  const a = (o) => {
    const s = ut.indexOf(o);
    return s < 0 ? ut.length : s;
  };
  return [...t].map(([o, s]) => ({ id: o, count: s })).sort((o, s) => a(o.id) - a(s.id) || s.count - o.count || o.id.localeCompare(s.id));
}
const me = "__favourites__", ee = "__all__";
function na(e, t, a) {
  return e.filter((o) => {
    var s;
    return t.category !== ee && o.category !== t.category ? !1 : t.provider === me ? !!((s = t.favourites) != null && s.includes(o.name)) : t.provider === ee || Tt(o, a) === t.provider;
  });
}
const ia = (e, t) => t.filter((a) => a.id !== he).length >= Xr && e.length >= Qr, Se = 200;
function sa({ model: e }) {
  const t = He(e);
  return t ? /* @__PURE__ */ l("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: oe(t.original) }),
    t.from && t.original !== null ? "from " : "",
    oe(t.current)
  ] }) : null;
}
const mt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, pt = (e, t) => {
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
function la({ models: e, value: t, onChange: a, favorites: o, onToggleFavorite: s, usage: i, showGroup: n, scope: b = "default" }) {
  var W;
  const [k, f] = N(!1), [A, M] = N(""), [p, G] = N("popular"), [w, j] = N(!1), S = K(null), R = Z(() => ta(e), [e]), g = Z(() => oa(e), [e]), u = ia(e, R), v = g.length >= Zr, [C, F] = N(() => mt(`muapi-studio:provider:${b}`, ee)), [I, _] = N(() => mt(`muapi-studio:category:${b}`, ee)), L = u && (C === me || C === ee || R.some((m) => m.id === C)) ? C : ee, z = v && (I === ee || g.some((m) => m.id === I)) ? I : ee, y = (m) => {
    F(m), pt(`muapi-studio:provider:${b}`, m);
  }, D = (m) => {
    _(m), pt(`muapi-studio:category:${b}`, m);
  }, X = K(null);
  V(() => {
    k || j(!1);
  }, [k]), V(() => {
    if (!k) return;
    const m = (B) => {
      var H;
      (H = S.current) != null && H.contains(B.target) || f(!1);
    }, P = (B) => {
      B.key === "Escape" && f(!1);
    };
    return document.addEventListener("mousedown", m), document.addEventListener("keydown", P), () => {
      document.removeEventListener("mousedown", m), document.removeEventListener("keydown", P);
    };
  }, [k]);
  const c = Z(() => {
    const m = A.trim().toLowerCase(), P = na(e, { category: z, provider: L, favourites: o }, R), B = m ? P.filter((re) => re.name.toLowerCase().includes(m) || re.category.toLowerCase().includes(m)) : P, H = Nt(B, p, { usage: i, favorites: o });
    if (p === "favourites" || p === "most-used") return H;
    const ae = new Set(o);
    return [...H.filter((re) => ae.has(re.name)), ...H.filter((re) => !ae.has(re.name))];
  }, [e, A, p, o, i, z, L, R]), [d, x] = N(0);
  V(() => {
    var m, P;
    x(0), (P = (m = X.current) == null ? void 0 : m.scrollTo) == null || P.call(m, { top: 0 });
  }, [A, p, k, z, L]);
  const E = (m) => {
    m.key === "ArrowDown" ? (m.preventDefault(), x((P) => Math.min(P + 1, Math.min(c.length, Se) - 1))) : m.key === "ArrowUp" ? (m.preventDefault(), x((P) => Math.max(P - 1, 0))) : m.key === "Enter" && c[d] && (m.preventDefault(), a(c[d].name), f(!1));
  };
  return V(() => {
    var m, P;
    (P = (m = document.getElementById(`ms-opt-${d}`)) == null ? void 0 : m.scrollIntoView) == null || P.call(m, { block: "nearest" });
  }, [d]), /* @__PURE__ */ l("div", { ref: S, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        onClick: () => f((m) => !m),
        "aria-haspopup": "listbox",
        "aria-expanded": k,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (W = (t ?? "?")[0]) == null ? void 0 : W.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Me, { up: k, width: 16, height: 16 })
        ]
      }
    ),
    k && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      u && /* @__PURE__ */ l("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(Re, { label: "All providers", active: L === ee, onClick: () => y(ee), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(Re, { label: "Favourites", active: L === me, onClick: () => y(me), children: /* @__PURE__ */ r(ot, { width: 14, height: 14, filled: L === me }) }),
        R.map((m) => /* @__PURE__ */ r(Re, { label: `${m.label} (${m.count})`, active: L === m.id, onClick: () => y(m.id), hue: aa(m.label), children: ra(m.label) }, m.id))
      ] }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ l("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(Ke, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: E, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${d}`, value: A, onChange: (m) => M(m.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ l("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": w,
                onClick: () => j((m) => !m),
                className: `flex h-full items-center rounded-ctl border px-3 ${w ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(vr, { width: 16, height: 16 })
              }
            ),
            w && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: er.map((m) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ l(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": p === m.id,
                onClick: () => {
                  G(m.id), j(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${p === m.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  m.label,
                  p === m.id && /* @__PURE__ */ r(ve, { width: 14, height: 14 })
                ]
              }
            ) }, m.id)) })
          ] })
        ] }),
        v && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ee, label: "All" }, ...g.map((m) => ({ id: m.id, label: m.id }))].map((m) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": z === m.id,
            onClick: () => D(m.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${z === m.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: m.label
          },
          m.id
        )) }),
        u && /* @__PURE__ */ l("div", { className: "mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
          L === ee ? "All models" : L === me ? "Favourites" : L,
          " · ",
          c.length
        ] }),
        /* @__PURE__ */ l("ul", { id: "ms-listbox", ref: X, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          c.slice(0, Se).map((m, P) => {
            const B = m.name === t;
            return /* @__PURE__ */ l(
              "li",
              {
                id: `ms-opt-${P}`,
                role: "option",
                "aria-selected": B,
                onClick: () => {
                  a(m.name), f(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${B ? "bg-primary-soft" : P === d ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: [
                  /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ r("div", { className: `truncate text-sm ${B ? "text-primary" : ""}`, children: m.name }),
                    /* @__PURE__ */ r("div", { className: "text-[10px] text-secondary", children: n ? `${m.group_of} · ${m.category}` : u && L === ee ? `${Tt(m, R)} · ${m.category}` : m.category })
                  ] }),
                  /* @__PURE__ */ r(
                    "button",
                    {
                      type: "button",
                      "aria-label": o.includes(m.name) ? "Remove favorite" : "Add favorite",
                      onClick: (H) => {
                        H.stopPropagation(), s(m.name);
                      },
                      className: o.includes(m.name) ? "text-primary" : "text-muted hover:text-fg",
                      children: /* @__PURE__ */ r(ot, { width: 15, height: 15, filled: o.includes(m.name) })
                    }
                  ),
                  /* @__PURE__ */ r(sa, { model: m })
                ]
              },
              m.name
            );
          }),
          c.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: p === "favourites" ? "No favourites yet. Tap the heart on a model." : p === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${A}”.` }),
          c.length > Se && /* @__PURE__ */ l("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Se,
            " of ",
            c.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const ht = (e, t) => {
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
}, $t = 0.25;
function ca({ mode: e, models: t, client: a, batch: o, onRun: s, usage: i, reuse: n, switcher: b }) {
  const k = se.find((h) => h.id === e), f = Z(() => Zt(t, e), [t, e]), [A, M] = N(), [p, G] = N(null), [w, j] = N(null), [S, R] = N({}), [g, u] = N(null), [v, C] = N(null), [F, I] = N(() => ht("muapi-studio:favorites", [])), [_, L] = N("form"), [z, y] = N(!1), [D, X] = N("{}"), [c, d] = N(null), x = K(0), E = K(null);
  V(() => {
    if (!z) return;
    const h = (U) => {
      var J;
      (J = E.current) != null && J.contains(U.target) || y(!1);
    }, $ = (U) => {
      U.key === "Escape" && y(!1);
    };
    return document.addEventListener("mousedown", h), document.addEventListener("keydown", $), () => {
      document.removeEventListener("mousedown", h), document.removeEventListener("keydown", $);
    };
  }, [z]);
  const W = K(null);
  V(() => {
    var U, J, ne;
    const h = ht(`muapi-studio:model:${e}`, null), $ = ((U = f.find((ie) => ie.name === h)) == null ? void 0 : U.name) ?? ((J = f.find((ie) => ie.name === Xt[e])) == null ? void 0 : J.name) ?? ((ne = Nt(f, "popular")[0]) == null ? void 0 : ne.name);
    M($);
  }, [e, f]), V(() => {
    n && (W.current = n.inputs, f.some((h) => h.name === n.model) && (M(n.model), De(`muapi-studio:model:${e}`, n.model)), L("form"));
  }, [n == null ? void 0 : n.nonce]);
  const m = f.find((h) => h.name === A);
  V(() => {
    if (!A) return;
    let h = !0;
    return G(null), j(null), u(null), C(null), d(null), a.model(A).then(($) => {
      if (!h) return;
      const U = st($), J = Ge(U), ne = W.current;
      if (W.current = null, ne)
        for (const ie of U) ne[ie.prop.name] !== void 0 && (J[ie.prop.name] = ne[ie.prop.name]);
      G($), R(J);
    }).catch(($) => {
      h && j($.message);
    }), () => {
      h = !1;
    };
  }, [A, a]);
  const P = Z(() => p ? st(p) : [], [p]), B = Z(() => ct(P, S), [P, S]), H = Z(() => {
    try {
      const h = JSON.parse(D);
      return h && typeof h == "object" && !Array.isArray(h) ? h : null;
    } catch {
      return null;
    }
  }, [D]), ae = _ === "json" ? H ?? {} : B, re = JSON.stringify(ae);
  V(() => {
    if (!p || _ === "json" && !H) return;
    const h = ++x.current, $ = setTimeout(() => {
      a.estimate(p.name, ae).then((U) => {
        h === x.current && u(U);
      }).catch(() => {
        h === x.current && u(null);
      });
    }, 500);
    return () => clearTimeout($);
  }, [p, re, a]);
  const be = (h) => {
    M(h), De(`muapi-studio:model:${e}`, h);
  }, Te = (h) => I(($) => {
    const U = $.includes(h) ? $.filter((J) => J !== h) : [...$, h];
    return De("muapi-studio:favorites", U), U;
  }), we = (h) => {
    y(!1), h !== _ && (h === "json" ? X(JSON.stringify(B, null, 2)) : H && R(($) => {
      const U = { ...$ };
      for (const J of P) H[J.prop.name] !== void 0 && (U[J.prop.name] = H[J.prop.name]);
      return U;
    }), L(h), C(null));
  }, Q = m ? He(m, g) : null, le = te(async () => {
    if (!p) return;
    d(null);
    const h = P.find(($) => $.prop.name === "prompt");
    await s({
      model: p.name,
      endpointUrl: p.endpoint_url,
      mode: e,
      payload: ae,
      count: o,
      kind: ze(p.category),
      prompt: h ? String(ae.prompt ?? "") : "",
      unitCost: Q == null ? void 0 : Q.current
    });
  }, [p, P, s, e, ae, o, Q]), $e = te(async () => {
    if (!p) return;
    if (_ === "json") {
      if (!H) {
        C("The JSON is not valid");
        return;
      }
      const $ = (p.required_fields ?? []).find((U) => H[U] === void 0 || H[U] === "");
      if ($) {
        C(`${$} is required`);
        return;
      }
    } else {
      const $ = Lr(P, S);
      if ($) {
        C($);
        return;
      }
    }
    C(null);
    const h = ((Q == null ? void 0 : Q.current) ?? 0) * o;
    if (h > $t) {
      d(h);
      return;
    }
    await le();
  }, [p, _, H, P, S, Q, o, le]), ce = !!p && !w, _e = (() => {
    var $;
    const h = P.find((U) => U.kind === "media-list");
    return h ? Math.max((($ = S[h.prop.name]) == null ? void 0 : $.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ l("section", { "aria-label": k.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ l("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: k.title }),
        /* @__PURE__ */ l("div", { ref: E, className: "relative", children: [
          /* @__PURE__ */ l("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": z, onClick: () => y((h) => !h), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            _ === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Me, { up: z, width: 12, height: 12 })
          ] }),
          z && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((h) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": _ === h, type: "button", onClick: () => we(h), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${_ === h ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: h === "json" ? "JSON" : "Form" }) }, h)) })
        ] })
      ] }),
      b,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(la, { models: f, value: A, onChange: be, favorites: F, onToggleFavorite: Te, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: _ === "json" ? "Request body" : "Parameters" }),
      (m == null ? void 0 : m.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: m.description }),
      !ce && !w && A && /* @__PURE__ */ l("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(ge, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      w && /* @__PURE__ */ l("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        w
      ] }),
      f.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      ce && _ === "json" && /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !H, spellCheck: !1, rows: 16, value: D, onChange: (h) => X(h.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${H ? "text-muted" : "text-danger"}`, children: H ? `Sent as the body of POST /api/v1/${p.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      ce && _ === "form" && P.map((h) => /* @__PURE__ */ r(
        Kr,
        {
          field: h,
          values: S,
          client: a,
          onError: C,
          tagCount: h.prop.name === "prompt" ? _e : 0,
          onChange: ($, U) => R((J) => ({ ...J, [$]: U }))
        },
        h.prop.name
      ))
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      v && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: v }),
      c !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: oe(c) }),
        " (",
        o,
        " × ",
        oe((Q == null ? void 0 : Q.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void le(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => d(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          p && (R(Ge(P)), X(JSON.stringify(ct(P, Ge(P)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ l(
          "button",
          {
            type: "button",
            onClick: () => void $e(),
            disabled: !ce,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(Je, { width: 16, height: 16 }),
              "Generate",
              o > 1 ? ` ×${o}` : "",
              Q && /* @__PURE__ */ l("span", { className: "font-normal", children: [
                "(",
                Q.original !== null ? /* @__PURE__ */ l(Ie, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: oe(Q.original * o) }),
                  " "
                ] }) : null,
                oe(Q.current * o),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const da = {
  image: Ae,
  video: pr,
  audio: hr,
  avatar: fr,
  "3d": Ye,
  "ai-tools": gr,
  text: wr,
  more: kr
};
function ua({ mode: e, onChange: t, layout: a = "rail", onChangeKey: o }) {
  return a === "tabs" ? /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    se.map((s) => {
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
    o && /* @__PURE__ */ l("button", { type: "button", onClick: o, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ r(nt, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    se.map((s) => {
      const i = da[s.id], n = s.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(s.id),
          "aria-current": n ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${n ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ r(i, {}),
            s.label
          ]
        },
        s.id
      );
    }),
    o && /* @__PURE__ */ l("button", { type: "button", onClick: o, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ r(nt, {}),
      "Key"
    ] })
  ] });
}
const ma = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, ft = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, pa = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], ha = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], fa = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], ga = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), ba = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], ya = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), xa = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], va = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], wa = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], ka = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], Na = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), Sa = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Ca = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), Aa = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], _t = {
  seedream: { aspect: pa, resolution: ha },
  seedance: { aspect: fa, duration: ga },
  minimax: { resolution: ba, duration: ya },
  wan: { aspect: xa, resolution: va, quality: wa, duration: ka },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, Ia = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, de = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Gt(e) {
  return ((a) => a.map((o, s) => {
    var i;
    return { ...o, label: ((i = ma[e.slug]) == null ? void 0 : i[s]) ?? o.label };
  }))(Ma(e));
}
function Ma(e) {
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
function Ea(e) {
  return Ia[e.template];
}
function gt(e) {
  var o, s, i, n, b, k, f, A, M, p, G;
  const t = _t[e.template], a = {};
  for (const w of e.sliders ?? []) a[w.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((o = e.presets) != null && o[0], ""),
    sliders: a,
    aspect: (i = (s = t.aspect) == null ? void 0 : s[0]) == null ? void 0 : i.value,
    resolution: (b = (n = t.resolution) == null ? void 0 : n[0]) == null ? void 0 : b.value,
    duration: ((f = (k = t.duration) == null ? void 0 : k.find((w) => w.value === 5)) == null ? void 0 : f.value) ?? ((M = (A = t.duration) == null ? void 0 : A[0]) == null ? void 0 : M.value),
    quality: (G = (p = t.quality) == null ? void 0 : p[0]) == null ? void 0 : G.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Lt(e, t) {
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
function bt(e, t, a) {
  var i;
  const o = (i = e.presets) == null ? void 0 : i.find((n) => n.id === a), s = { ...Object.fromEntries((e.sliders ?? []).map((n) => [n.id, 0])), ...(o == null ? void 0 : o.values) ?? {} };
  return { ...t, preset: a, sliders: s };
}
function Ta(e, t) {
  for (const a of Gt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function $a(e, t) {
  const a = Lt(e, t), o = t.uploads;
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
function _a(e) {
  return ft[e.slug] ? ft[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Ga = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], T = (e, t, a, o, s) => ({ id: e, label: t, hint: a, prompt: o, values: s }), qe = (e, t, a, o = "") => `${e > 0 ? t : a} ${Math.abs(e)}${o}`, q = (e, t, a, o, s, i, n = {}) => ({ slug: e, name: t, emoji: a, category: o, badge: "IMAGE", template: "seedream", blurb: s, prompt: i, ...n }), O = (e, t, a, o, s, i, n = {}) => ({ slug: e, name: t, emoji: a, category: o, badge: "VIDEO", template: "seedance", blurb: s, prompt: i, ...n }), Ce = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${qe(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${qe(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], La = [Ce[2], { ...Ce[1], id: "vertical", label: "Vertical angle" }, Ce[0]].map((e) => ({ ...e, id: e.id })), Ra = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${qe(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Da = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], Oa = "Keep the result tasteful and suitable for general audiences.", Rt = [
  // ---- Professional
  q(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Ce, presets: [
      T("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      T("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      T("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      T("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      T("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      T("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      T("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  q(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  q(
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
  q(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: La.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
  ),
  O(
    "behind-the-scenes",
    "Behind the Scenes",
    "🎞️",
    "professional",
    "Pull back from the photo to reveal the film set around it.",
    "Start on this photograph, then pull the camera back to reveal it is a film set with lighting rigs, cameras and crew working around the scene."
  ),
  O(
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
  q(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  q(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: Da, presets: [
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
  q(
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
  q(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: Ra }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  q(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  q(
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
  q(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  q(
    "glitter-sticker",
    "Glitter Sticker",
    "🌟",
    "enhance-style",
    "Turn a portrait into a holographic glitter sticker on a street wall.",
    "Turn this portrait into a shiny holographic glitter sticker stuck onto a gritty urban surface."
  ),
  O(
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
  q(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  q(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  q(
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
  q(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  q(
    "japanese-show",
    "Japanese Show",
    "📺",
    "video-editing",
    "Retro variety-show look with CRT scanlines.",
    "Turn this photo into a still from a retro 2000s Japanese variety show, with CRT scanlines, on-screen captions and broadcast effects."
  ),
  { slug: "video-bg-remover", name: "Video Background Remover", emoji: "🎬", category: "video-editing", badge: "VIDEO", template: "bg-remover", blurb: "Remove the background from a video.", prompt: "" },
  // ---- Ads & Products (the uploaded image is the product or subject)
  O("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  O("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  O("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  q("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
  O("bullet-time-scene", "Bullet Time Scene", "⏱️", "ads", "Frozen-moment bullet-time camera move.", "Create a bullet-time effect: time freezes while the camera sweeps around the subject and product in the image."),
  O("chameleon", "Chameleon", "🦎", "ads", "A character changes to match the product’s look.", "Show the character smoothly transforming their outfit and colors to match the brand look of the product in the image."),
  O("asmr-host", "ASMR Host", "🎙️", "ads", "A whispering host presents the product.", "Create an ASMR presentation where a soft-spoken host presents the product from the image up close."),
  O("packshot", "Packshot", "📦", "ads", "Polished product showcase with slow rotation.", "Create a clean studio packshot video of the product in the image, slowly rotating under soft studio lighting."),
  O("macro-scene", "Macro Scene", "🔬", "ads", "Extreme close-up of product details.", "Create an extreme macro close-up video that glides over the textures and details of the product in the image."),
  O("magic-button", "Magic Button", "✨", "ads", "The product appears in a burst of light.", "Show the product from the image appearing magically in a burst of light and drifting particles."),
  O("truck-ad", "Truck Ad", "🚛", "ads", "Product displayed on a truck driving through a city.", "Show the product from the image printed large on the side of a truck driving through a busy city street."),
  O("giant-product", "Giant Product", "🦖", "ads", "A building-sized product towering over a person.", "Create a surreal scene where the product from the image is as tall as a building, towering over a small person on the street."),
  O("bullet-time-white", "Bullet Time White", "⚪", "ads", "360° rotation on a clean white background.", "Create a bullet-time 360 degree rotation around the subject and product in the image on a clean white background."),
  O("kick-ad", "Kick Ad", "🦵", "ads", "A character kicks the product into frame.", "Create an energetic action ad where a character kicks the product from the image into the frame."),
  O("billboard-ad", "Billboard Ad", "🏙️", "ads", "Product on a glowing billboard at night.", "Show the product from the image on a huge glowing billboard in a busy city at night."),
  q("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  O("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  O("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  O("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  q("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  q(
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
  q("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  q("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  q("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  q("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  q("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  q("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  q(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [T("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), T("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), T("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), T("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  q("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  O("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  O("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${Oa}`),
  O("roller-coaster", "Roller Coaster", "🎢", "trending-templates", "A thrilling roller-coaster ride.", "Put the person from this photo on a roller coaster ride with wind, speed and a dramatic camera."),
  O("60s-cafe", "60s Cafe", "☕", "trending-templates", "A vintage 1960s cafe scene.", "Place the person from this photo in a vintage 1960s cafe with retro decor, warm film tones and gentle motion."),
  O("victory-card", "Victory Card", "🃏", "trending-templates", "A winning playing-card moment.", "Turn this photo into a winning playing card, with the person triumphant as the card flips and glows."),
  O("sand-worm", "Sand Worm", "🐛", "trending-templates", "An epic desert creature scene.", "Place the person from this photo in an epic desert scene with a giant sand creature rising behind them."),
  O("skibidi", "Toilet Meme", "🚽", "trending-templates", "A silly toilet-character meme look.", "Turn this photo into a goofy toilet-themed meme character with exaggerated head bobbing."),
  O("j-poster", "J Poster", "🎌", "trending-templates", "A Japanese-style poster.", "Turn this photo into a bold Japanese-style poster with dramatic typography and animated accents."),
  O("mascot", "Mascot", "🏈", "trending-templates", "A sports mascot character.", "Transform the person in this photo into an energetic sports mascot character cheering in a stadium."),
  O("storm-creature", "Storm Creature", "⛈️", "trending-templates", "An epic storm creature scene.", "Place the person from this photo in a stormy sky scene with a giant creature made of clouds and lightning."),
  O("burning-sunset", "Burning Sunset", "🌅", "trending-templates", "An epic burning-sunset scene.", "Place the person from this photo against an epic burning sunset sky with drifting embers."),
  O("on-fire", "On Fire", "🔥", "trending-templates", "A calm-in-chaos burning-room meme scene.", "Show the person from this photo calmly sitting in a room that is on fire, in a humorous cartoon-like meme style."),
  O("comic-book", "Comic Book", "💥", "trending-templates", "Comic-book panels and action lines.", "Turn this photo into an animated comic-book page with bold ink lines, halftone dots and action bursts."),
  O("cloud-surf", "Cloud Surf", "☁️", "trending-templates", "Surfing on dreamy pink clouds.", "Show the person from this photo surfing on a wave of dreamy pink clouds at sunset."),
  O("mukbang", "Mukbang", "🍜", "trending-templates", "A viral eating-show scene.", "Turn this photo into a viral eating-show video with the person enjoying a big spread of food at a table."),
  O("melting-doodle", "Melting Doodle", "🫠", "trending-templates", "Mesmerizing melting doodle art.", "Turn this photo into colorful doodle art that slowly melts and swirls."),
  O("giallo-horror", "Giallo Horror", "🩸", "trending-templates", "A stylised 1970s thriller scene.", "Turn this photo into a stylised 1970s Italian thriller scene with saturated colors, dramatic shadows and a suspenseful camera move. Keep it non-graphic."),
  O("renaissance", "Renaissance", "🖼️", "trending-templates", "A classical gallery painting.", "Turn this photo into a classical Renaissance oil painting hanging in a gallery, subtly coming to life."),
  O("rap-god", "Rap God", "🎤", "trending-templates", "A rap-video style clip.", "Turn this photo into a stylish rap music video clip with the person performing, with dynamic lighting and camera moves.")
], Ee = (e) => Rt.find((t) => t.slug === e), Fe = (e) => e.badge === "VIDEO" ? "video" : "image", Xe = (e) => Rt.filter((t) => Fe(t) === e), Be = (e) => Xe(e).length > 0;
function Dt(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), o = Ee(t.get("app"));
  return a === "apps" ? { mode: o ? Fe(o) : "image", app: (o == null ? void 0 : o.slug) ?? null } : o && a === Fe(o) ? { mode: a, app: o.slug } : { mode: null, app: null };
}
function ja(e, t, a) {
  const o = new URLSearchParams(e);
  return o.set("tab", t), o.delete("category"), a ? o.set("app", a) : o.delete("app"), `?${o.toString()}`;
}
function Pa(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((o) => (!t.category || t.category === "all" || o.category === t.category) && (!a || `${o.name} ${o.blurb}`.toLowerCase().includes(a)));
}
const Va = (e) => Ga.filter((t) => Xe(e).some((a) => a.category === t.id));
function Ua({ mode: e, value: t, onChange: a }) {
  const [o, s] = N(!1), [i, n] = N(""), [b, k] = N("all"), [f, A] = N(0), M = K(null), p = Z(() => Va(e), [e]), G = Z(() => Pa(Xe(e), { category: b, q: i }), [e, b, i]), w = Ee(t);
  V(() => A(0), [i, b, o]), V(() => {
    if (!o) return;
    const g = (v) => {
      var C;
      (C = M.current) != null && C.contains(v.target) || s(!1);
    }, u = (v) => {
      v.key === "Escape" && s(!1);
    };
    return document.addEventListener("mousedown", g), document.addEventListener("keydown", u), () => {
      document.removeEventListener("mousedown", g), document.removeEventListener("keydown", u);
    };
  }, [o]), V(() => {
    var g, u;
    (u = (g = document.getElementById(`ms-app-${f}`)) == null ? void 0 : g.scrollIntoView) == null || u.call(g, { block: "nearest" });
  }, [f]);
  const j = (g) => {
    a(g), s(!1), n("");
  }, S = (g) => {
    g.key === "ArrowDown" ? (g.preventDefault(), A((u) => Math.min(u + 1, G.length - 1))) : g.key === "ArrowUp" ? (g.preventDefault(), A((u) => Math.max(u - 1, 0))) : g.key === "Enter" && G[f] && (g.preventDefault(), j(G[f].slug));
  }, R = (g) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${g ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ l("div", { ref: M, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": o,
        onClick: () => s((g) => !g),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (w == null ? void 0 : w.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (w == null ? void 0 : w.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Me, { up: o, width: 16, height: 16 })
        ]
      }
    ),
    o && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ l("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(Ke, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: S, value: i, onChange: (g) => n(g.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ l("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": b === "all", onClick: () => k("all"), className: R(b === "all"), children: "All" }),
        p.map((g) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": b === g.id, onClick: () => k(g.id), className: R(b === g.id), children: g.label }, g.id))
      ] }),
      /* @__PURE__ */ l("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        G.map((g, u) => /* @__PURE__ */ l(
          "li",
          {
            id: `ms-app-${u}`,
            role: "option",
            "aria-selected": g.slug === t,
            onClick: () => j(g.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${g.slug === t ? "bg-primary-soft" : u === f ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: g.emoji }),
              /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${g.slug === t ? "text-primary" : ""}`, children: g.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: g.blurb })
              ] })
            ]
          },
          g.slug
        )),
        G.length === 0 && /* @__PURE__ */ l("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          i,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const qa = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), ye = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function Fa({ mode: e, slug: t, onApp: a, switcher: o, models: s, client: i, batch: n, onRun: b }) {
  const k = Ee(t), f = se.find((A) => A.id === e).title;
  return /* @__PURE__ */ l("section", { "aria-label": f, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: f }),
      o,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(Ua, { mode: e, value: t, onChange: a }) })
    ] }),
    k ? /* @__PURE__ */ r(Ba, { app: k, mode: e, models: s, client: i, batch: n, onRun: b }, k.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Ba({ app: e, mode: t, models: a, client: o, batch: s, onRun: i }) {
  var z;
  const [n, b] = N(() => gt(e)), [k, f] = N(null), [A, M] = N(null), [p, G] = N(null), w = K(0);
  V(() => {
    b(gt(e)), f(null), M(null), G(null);
  }, [e]);
  const j = Ea(e), S = a.find((y) => y.name === j), R = _t[e.template], g = Z(() => $a(e, n), [e, n]), u = JSON.stringify(g), v = (y) => b((D) => ({ ...D, ...y }));
  V(() => {
    if (!S) return;
    const y = ++w.current, D = setTimeout(() => {
      o.estimate(j, g).then((X) => {
        y === w.current && M(X);
      }).catch(() => {
        y === w.current && M(null);
      });
    }, 500);
    return () => clearTimeout(D);
  }, [u, S, o]);
  const C = S ? He(S, A) : null, F = Gt(e), I = async () => {
    S && (G(null), await i({ model: j, endpointUrl: S.endpoint_url, mode: t, prompt: Lt(e, n) || e.name, payload: g, count: s, kind: ze(S.category), unitCost: C == null ? void 0 : C.current }));
  }, _ = async () => {
    const y = Ta(e, n);
    if (y) {
      f(y);
      return;
    }
    f(null);
    const D = ((C == null ? void 0 : C.current) ?? 0) * s;
    if (D > $t) {
      G(D);
      return;
    }
    await I();
  }, L = (y, D, X, c) => D && D.length > 0 ? /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: ye, children: y }),
    /* @__PURE__ */ r(Ve, { label: y, options: qa(D), value: X, onChange: c })
  ] }) : null;
  return /* @__PURE__ */ l("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !S && /* @__PURE__ */ l("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        j,
        "”, which is not in your catalog right now."
      ] }),
      F.map((y) => /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: ye, children: [
          /* @__PURE__ */ r("span", { children: y.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: y.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          Ue,
          {
            client: o,
            multiple: !1,
            max: 1,
            current: n.uploads[y.id] ? [n.uploads[y.id]] : [],
            field: { prop: { name: `${y.kind}_${y.id}`, title: y.label, field: y.kind }, kind: "media", required: !y.optional },
            onUrls: (D) => v({ uploads: { ...n.uploads, [y.id]: D[0] ?? "" } }),
            onError: f
          }
        )
      ] }, y.id)),
      e.presets && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: ye, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(Ve, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((y) => ({ value: y.id, label: y.label, hint: y.hint }))], value: n.preset, onChange: (y) => b(bt(e, n, String(y))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (z = e.sliders) == null ? void 0 : z.map((y) => /* @__PURE__ */ l("div", { className: "mb-4", children: [
        /* @__PURE__ */ l("div", { className: ye, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${y.id}`, children: y.label }),
          /* @__PURE__ */ l("span", { className: "tabular-nums text-primary", children: [
            n.sliders[y.id] ?? 0,
            y.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${y.id}`, type: "range", min: y.min, max: y.max, step: y.step, value: n.sliders[y.id] ?? 0, className: "w-full", onChange: (D) => v({ sliders: { ...n.sliders, [y.id]: Number(D.target.value) } }) })
      ] }, y.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => b(bt(e, n, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: ye, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: n.refinement, onChange: (y) => v({ refinement: y.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      L("Aspect Ratio", R.aspect, n.aspect, (y) => v({ aspect: y })),
      L(e.template === "seedream" ? "Output Resolution" : "Resolution", R.resolution, n.resolution, (y) => v({ resolution: y })),
      L("Quality Level", R.quality, n.quality, (y) => v({ quality: String(y) })),
      L("Duration", R.duration, n.duration, (y) => v({ duration: Number(y) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && L("Target Face Index", Na, n.targetIndex, (y) => v({ targetIndex: Number(y) })),
      e.template === "video-face-swap" && L("Target Gender Filter", Sa, n.gender, (y) => v({ gender: String(y) })),
      e.template === "bg-remover" && /* @__PURE__ */ l(Ie, { children: [
        L("Background Color", Ca, n.background, (y) => v({ background: String(y) })),
        L("Output Container & Codec", Aa, n.container, (y) => v({ container: String(y) })),
        /* @__PURE__ */ l("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": n.keepAudio, onClick: () => v({ keepAudio: !n.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${n.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${n.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      k && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: k }),
      p !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: oe(p) }),
        " (",
        s,
        " × ",
        oe((C == null ? void 0 : C.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void I(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => G(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !S, onClick: () => void _(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(Je, { width: 16, height: 16, className: "shrink-0" }),
        _a(e),
        s > 1 ? ` ×${s}` : "",
        C && C.current > 0 && /* @__PURE__ */ l("span", { className: "font-normal", children: [
          "(",
          oe(C.current * s),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function yt({ view: e, onChange: t }) {
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
function za() {
  try {
    const e = window.location.search, t = Dt(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return Qt(a) ? a : null;
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
function xt(e) {
  if (!Be(e)) return { view: "models", app: null };
  try {
    const a = Dt(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = xe.get(`muapi-studio:app:${e}`);
  return { view: xe.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Ee(t) ? t : null };
}
function Ja({ apiBase: e = "/api/muapi", initialTab: t = "image", showHeader: a = !0, title: o = "Studio", teamId: s, theme: i = "lime", layout: n, apiKey: b, onRequestApiKey: k, getHeaders: f, connected: A, fetchImpl: M, features: p, className: G = "", onTabChange: w }) {
  const j = A === !1 || b === "" || b === null, S = K(f);
  S.current = f;
  const [R, g] = N(!1), u = Z(() => new Bt(e, s, { apiKey: b || void 0, getHeaders: () => {
    var h;
    return ((h = S.current) == null ? void 0 : h.call(S)) ?? {};
  }, fetchImpl: M, onKeyRejected: () => g(!0) }), [e, s, b, M]);
  V(() => g(!1), [u]);
  const [v, C] = N({ library: !0, deleteMedia: !0 }), F = Z(() => ({ library: v.library && (p == null ? void 0 : p.library) !== !1, deleteMedia: (p == null ? void 0 : p.deleteMedia) !== !1 }), [v, p == null ? void 0 : p.library, p == null ? void 0 : p.deleteMedia]), I = n ?? Kt(i), [_, L] = N(() => za() ?? t), [z, y] = N(4), [D, X] = N(null), [c, d] = N(null), [x, E] = N(null), W = te(() => {
    u.balance().then(E).catch(() => E(null));
  }, [u]), [m, P] = N(null), B = cr(u, D, W), H = Z(() => nr(B.items), [B.items]);
  V(() => {
    j || (d(null), X(null), u.models().then(X).catch((h) => d(h.message)), W(), (p == null ? void 0 : p.library) !== !1 && u.probe().then(C));
  }, [u, W, j, p == null ? void 0 : p.library]);
  const [ae, re] = N(() => xt(_)), be = (h, $) => {
    try {
      window.history.replaceState(null, "", ja(window.location.search, h, $));
    } catch {
    }
  }, Te = (h) => {
    const $ = xt(h);
    L(h), re($), w == null || w(h), be(h, $.view === "apps" ? $.app : null);
  }, we = (h) => {
    re(($) => ({ ...$, view: h })), xe.set(`muapi-studio:view:${_}`, h), be(_, h === "apps" ? ae.app : null);
  }, Q = (h) => {
    re({ view: "apps", app: h }), xe.set(`muapi-studio:app:${_}`, h), xe.set(`muapi-studio:view:${_}`, "apps"), be(_, h);
  }, le = te(async (h) => {
    await B.run(h);
  }, [B.run]), $e = te((h) => {
    var U;
    const $ = D == null ? void 0 : D.find((J) => J.name === h);
    return $ ? ((U = $.sale) == null ? void 0 : U.from) ?? $.cost ?? void 0 : void 0;
  }, [D]), ce = te((h) => {
    L(h.mode), re(($) => ({ ...$, view: "models" })), P({ model: h.model, inputs: h.inputs, nonce: Date.now() });
  }, []), _e = te((h) => {
    var J;
    const $ = D == null ? void 0 : D.find((ne) => ne.name === h.model);
    if (!$) return;
    const U = ((J = $.sale) == null ? void 0 : J.from) ?? $.cost ?? 0;
    U > 0.25 && !window.confirm(`Re-run ${h.model} for about $${U.toFixed(2)}?`) || B.run({ model: h.model, endpointUrl: $.endpoint_url, mode: h.mode, prompt: h.prompt, payload: h.inputs, count: 1, unitCost: U, kind: ze($.category) });
  }, [D, B.run]);
  return /* @__PURE__ */ l("div", { className: `ms-root ${G}`.trim(), style: Jt(i), "data-layout": I, "data-btn": Wt(i), children: [
    a && /* @__PURE__ */ l("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: o }),
      x && /* @__PURE__ */ l("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: oe(x.balance) })
      ] })
    ] }),
    j ? /* @__PURE__ */ l("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      k && /* @__PURE__ */ r("button", { type: "button", onClick: k, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ l(vt.Provider, { value: F, children: [
      R && /* @__PURE__ */ l("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        k && /* @__PURE__ */ r("button", { type: "button", onClick: k, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ l("div", { className: `flex min-h-0 flex-1 flex-col ${I === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(ua, { mode: _, onChange: Te, layout: I, onChangeKey: k }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: c ? /* @__PURE__ */ l("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          c
        ] }) : D ? /* @__PURE__ */ l(Ie, { children: [
          ae.view === "apps" && Be(_) ? /* @__PURE__ */ r(Fa, { mode: _, slug: ae.app, onApp: Q, switcher: /* @__PURE__ */ r(yt, { view: "apps", onChange: we }), models: D, client: u, batch: z, onRun: le }) : /* @__PURE__ */ r(ca, { mode: _, models: D, client: u, batch: z, onRun: le, usage: H, reuse: m, switcher: Be(_) ? /* @__PURE__ */ r(yt, { view: "models", onChange: we }) : void 0 }),
          /* @__PURE__ */ r(Tr, { mode: _, items: B.items, batch: z, onBatch: y, onLabel: B.setLabel, onRemove: B.remove, onReuse: ce, onRerun: _e, onDeleteMedia: B.deleteMedia, onLoadMore: B.loadMore, hasMore: B.hasMore, loadingMore: B.loadingMore, serverError: B.serverError, estimateFor: $e })
        ] }) : /* @__PURE__ */ l("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(ge, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
export {
  ue as ApiError,
  Bt as MuapiClient,
  Ja as MuapiStudio,
  Yt as THEMES,
  Ht as cyanTheme,
  Kt as defaultLayout,
  ze as generationKind,
  Oe as limeTheme,
  zt as pollUntilDone,
  kt as resolveTheme,
  Jt as themeStyle
};
