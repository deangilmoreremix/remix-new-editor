import { jsx as r, jsxs as l, Fragment as Me } from "react/jsx-runtime";
import { createContext as Et, useContext as _t, useState as N, useRef as Q, useEffect as G, useCallback as re, useMemo as Y, useId as Lt, useLayoutEffect as Rt } from "react";
class ue extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function Dt(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Ot {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [b, S] of Object.entries(await this.opts.getHeaders())) n.set(b, S);
    const s = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), i = await s.text();
    let o = null;
    try {
      o = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!s.ok) throw new ue(Dt(o, `${s.status} ${s.statusText}`), s.status);
    if (o === null && i.trim()) throw new ue("Unexpected non-JSON response from the server", 502);
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
    if (!i) throw new ue("The API did not return a request id", 502);
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
    const t = (n) => n instanceof ue && [403, 404, 405].includes(n.status);
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
    if (!s) throw new ue("Upload returned no URL", 502);
    return s;
  }
}
async function jt(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: s = 15 * 60 * 1e3, signal: i, onUpdate: o } = a, b = Date.now();
  let S = 0;
  for (; Date.now() - b < s; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const h = await e.poll(t);
      if (S = 0, o == null || o(h), h.status === "completed" || h.status === "failed") return h;
    } catch (h) {
      if (++S >= 5) throw h;
    }
    await new Promise((h) => setTimeout(h, n));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const ft = Et({ library: !0, deleteMedia: !0 }), gt = () => _t(ft), Oe = {
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
}, Pt = {
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
}, Ut = { lime: Oe, cyan: Pt }, Xe = {
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
  for (const n of Object.keys(Xe)) a[Xe[n]] = t[n];
  return a;
}
function Vt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const se = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], Gt = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Be(e) {
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
const Bt = (e) => !!e && se.some((t) => t.id === e);
function zt(e, t) {
  const a = se.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const Ht = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function bt(e, t, a = {}) {
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
const Jt = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function Kt(e, t) {
  var n, s;
  const a = (n = t.find((i) => i.name === e)) == null ? void 0 : n.group_of;
  return ((s = se.find((i) => a && i.groups.includes(a))) == null ? void 0 : s.id) ?? "ai-tools";
}
function Wt(e, t, a = {}) {
  var i;
  const n = e.output ?? {}, s = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: Kt(e.model, t),
    prompt: typeof s.prompt == "string" ? s.prompt : "",
    inputs: s,
    status: Jt[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: n.error || void 0,
    cost: (i = n.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function Xt(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Set(e.map((i) => i.requestId).filter(Boolean));
  return [...e, ...t.filter((i) => !i.requestId || !n.has(i.requestId))].filter((i) => !(i.requestId && a.has(i.requestId))).sort((i, o) => o.createdAt - i.createdAt);
}
function Qt(e) {
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
function ze(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const yt = "muapi-studio:history:v1", Zt = 200;
function Qe() {
  try {
    const e = localStorage.getItem(yt);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function Yt(e) {
  try {
    localStorage.setItem(yt, JSON.stringify(e.slice(0, Zt)));
  } catch {
  }
}
const er = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, Ze = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, Ye = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, et = "muapi-studio:labels:v1", tt = "muapi-studio:hidden:v1";
function tr(e, t, a) {
  const [n, s] = N(() => Qe()), [i, o] = N([]), [b, S] = N(null), [h, $] = N(!1), [C, m] = N(null), _ = Q(!1), [w, O] = N(() => Ze(et, {})), [A, E] = N(() => Ze(tt, [])), f = Q(/* @__PURE__ */ new Set()), p = Q(new AbortController()), v = Q([]);
  v.current = t ?? [], G(() => Yt(n), [n]), G(() => Ye(et, w), [w]), G(() => Ye(tt, A), [A]), G(() => (p.current = new AbortController(), () => p.current.abort()), []);
  const k = re((c, d) => s((y) => y.map((I) => I.id === c ? { ...I, ...d } : I)), []), R = re(async (c, d) => {
    if (!f.current.has(c)) {
      f.current.add(c);
      try {
        const y = await jt(e, d, {
          signal: p.current.signal,
          onUpdate: (I) => k(c, { status: I.status, outputs: I.outputs, error: I.error, cost: I.cost })
        });
        k(c, { status: y.status, outputs: y.outputs, error: y.error, cost: y.cost }), a == null || a();
      } catch (y) {
        y.name !== "AbortError" && k(c, { status: "failed", error: y.message });
      } finally {
        f.current.delete(c);
      }
    }
  }, [e, k, a]);
  G(() => {
    for (const c of Qe()) (c.status === "pending" || c.status === "processing") && c.requestId && R(c.id, c.requestId);
  }, []);
  const M = re(async (c = !1) => {
    if (!_.current) {
      $(!0), m(null);
      try {
        const d = await e.history(c ? void 0 : b ?? void 0), y = d.items.map((I) => Wt(I, v.current));
        o((I) => c ? y : [...I, ...y]), S(d.next_cursor);
      } catch (d) {
        d instanceof ue && [403, 404, 405].includes(d.status) ? (_.current = !0, S(null)) : m(d.message);
      } finally {
        $(!1);
      }
    }
  }, [e, b]), j = Q(!1);
  G(() => {
    t && !j.current && (j.current = !0, M(!0));
  }, [t, M]);
  const L = re((c) => {
    const d = Array.from({ length: c.count }, () => ({
      id: er(),
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
        const { requestId: I, cost: J } = await e.submit(c.endpointUrl, c.payload, c.kind);
        k(y.id, { requestId: I, ...J !== void 0 ? { cost: J } : {} }), await R(y.id, I);
      } catch (I) {
        k(y.id, { status: "failed", error: I.message });
      }
    }));
  }, [e, k, R]), q = Y(() => {
    const c = (d) => ({ ...d, label: d.requestId && w[d.requestId] || d.label });
    return Xt(n.map(c), i.map(c), new Set(A));
  }, [n, i, w, A]), g = re((c, d) => {
    c.requestId && O((y) => {
      const I = { ...y };
      return d ? I[c.requestId] = d : delete I[c.requestId], I;
    }), k(c.id, { label: d });
  }, [k]), F = re((c) => {
    s((d) => d.filter((y) => y.id !== c.id)), c.requestId && E((d) => [.../* @__PURE__ */ new Set([...d, c.requestId])]);
  }, []), W = re(async (c) => {
    c.requestId && (await e.deleteMedia(c.requestId), k(c.id, { outputs: [] }), o((d) => d.map((y) => y.requestId === c.requestId ? { ...y, outputs: [] } : y)));
  }, [e, k]);
  return { items: q, run: L, setLabel: g, remove: F, deleteMedia: W, loadMore: () => M(!1), hasMore: !!b, loadingMore: h, serverError: C };
}
const rr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function xt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : rr.test(e) ? "file" : "image" : "text";
}
function ar(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const K = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Ce = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), nr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), or = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), ir = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), vt = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), sr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), He = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), rt = ({ filled: e, ...t }) => /* @__PURE__ */ r(K, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Je = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Ie = ({ up: e, ...t }) => /* @__PURE__ */ r(K, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), lr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), cr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), je = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), xe = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), fe = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), wt = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), dr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), ve = (e) => /* @__PURE__ */ r(K, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), ur = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), mr = (e) => /* @__PURE__ */ r(K, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), pr = (e) => /* @__PURE__ */ l(K, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), hr = ["All", "Approved", "Rejected", "Unlabeled"], fr = [1, 2, 4, 6, 8];
function gr({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, s = xt(e);
  return s === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: ar(e) }) : s === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : s === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : s === "3d" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(vt, { width: 32, height: 32 }),
    "Open 3D model"
  ] }) : s === "file" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(je, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function br({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: s, onRerun: i, onDeleteMedia: o, onOpen: b, estimateFor: S }) {
  const h = e.outputs[0], $ = !!h && xt(h) === "text", [C, m] = N(!1), [_, w] = N(null), O = gt(), A = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", E = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ l("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && h ? /* @__PURE__ */ r(gr, { url: h, hidden: t, onOpen: () => b(h) }) : e.status === "failed" ? /* @__PURE__ */ l("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
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
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ae(e.cost) : e.status === "completed" && (S == null ? void 0 : S(e.model)) !== void 0 ? `est. ${ae(S(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && h && ($ ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(h)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${E} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(je, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: h, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${E} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(je, { width: 14, height: 14 }) })),
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
        /* @__PURE__ */ r("button", { type: "button", onClick: () => s(e), title: "Load this model and settings back into the form", className: A, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: A, children: "Re-run" }),
        e.status === "completed" && h && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var f;
          (f = navigator.clipboard) == null || f.writeText(h).then(() => {
            m(!0), setTimeout(() => m(!1), 1500);
          });
        }, className: A, children: C ? "Copied" : $ ? "Copy text" : "Copy link" })
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
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (w(null), o(e).catch((f) => w(f.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function yr({ url: e, onClose: t }) {
  return G(() => {
    const a = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ l("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(fe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function xr({ mode: e, items: t, batch: a, onBatch: n, onLabel: s, onRemove: i, onReuse: o, onRerun: b, onDeleteMedia: S, onLoadMore: h, hasMore: $, loadingMore: C, serverError: m, estimateFor: _ }) {
  const [w, O] = N("All"), [A, E] = N(""), [f, p] = N(!1), [v, k] = N(null), R = Y(() => {
    const M = A.trim().toLowerCase();
    return t.filter((j) => j.mode !== e || w === "Approved" && j.label !== "approved" || w === "Rejected" && j.label !== "rejected" || w === "Unlabeled" && j.label !== null ? !1 : !M || j.prompt.toLowerCase().includes(M) || j.model.toLowerCase().includes(M));
  }, [t, e, w, A]);
  return /* @__PURE__ */ l("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: hr.map((M) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": w === M,
          onClick: () => O(M),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${w === M ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: M
        },
        M
      )) }),
      /* @__PURE__ */ l("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(Je, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: A, onChange: (M) => E(M.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: fr.map((M) => /* @__PURE__ */ r(
        "button",
        {
          role: "radio",
          "aria-checked": a === M,
          onClick: () => n(M),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${a === M ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: M
        },
        M
      )) }),
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": f, "aria-label": f ? "Show previews" : "Hide previews", title: f ? "Show previews" : "Hide previews", onClick: () => p((M) => !M), className: f ? "text-primary" : "text-secondary hover:text-fg", children: f ? /* @__PURE__ */ r(lr, { width: 18, height: 18 }) : /* @__PURE__ */ r(cr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      R.length === 0 ? /* @__PURE__ */ l("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(He, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some((M) => M.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((M) => M.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: R.map((M) => /* @__PURE__ */ r(br, { g: M, hidden: f, onLabel: s, onRemove: i, onReuse: o, onRerun: b, onDeleteMedia: S, onOpen: k, estimateFor: _ }, M.id)) }),
      m && /* @__PURE__ */ l("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        m
      ] }),
      $ && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: C, onClick: h, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: C ? "Loading…" : "Load more history" }) }),
      v && /* @__PURE__ */ r(yr, { url: v, onClose: () => k(null) })
    ] })
  ] });
}
const vr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, wr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function kr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? vr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || wr.test(e.name) ? "media" : "text" : "text";
}
function at(e) {
  var o, b;
  const t = (b = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : b.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), s = [...n.filter((S) => a[S]), ...Object.keys(a).filter((S) => !n.includes(S))], i = new Set(e.required_fields ?? []);
  return s.map((S) => ({ prop: { ...a[S], name: S }, kind: kr({ ...a[S], name: S }), required: i.has(S) }));
}
function _e(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: s, required: i } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : i && (s === "textarea" || s === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const pe = (e) => `__auto:${e}`, nt = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Pe = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function ot(e, t) {
  const a = {};
  for (const { prop: n, kind: s } of e) {
    if (t[pe(n.name)] === !0) continue;
    const i = t[n.name] ?? n.default;
    if (!Pe(i))
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
function Nr(e, t) {
  for (const { prop: a, kind: n, required: s } of e) {
    if (t[pe(a.name)] === !0) continue;
    const i = t[a.name] ?? a.default, o = a.title || a.name;
    if (s && Pe(i)) return `${o} is required`;
    if (n === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !Pe(i)) {
      const b = Number(i);
      if (!Number.isFinite(b)) return `${o} must be a number`;
      if (a.minValue !== void 0 && b < a.minValue) return `${o} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && b > a.maxValue) return `${o} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const Sr = 12, Ke = 240, ke = (e) => `${typeof e}:${e}`, Ar = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Cr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Mr(e, t, a = Ke) {
  return e >= a || e >= t ? "down" : "up";
}
const Ir = 40, $r = 48;
function Tr(e, t) {
  return Math.min(Ke, Math.max(1, e) * Ir + 8) + (t ? $r : 0);
}
function Er(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const it = "Auto (let model decide)", Le = "__auto__";
function Ue({ id: e, label: t, options: a, value: n, onChange: s, allowAuto: i, auto: o, onAuto: b, combobox: S }) {
  const h = Lt(), $ = e ?? `ms-dd-${h}`, C = S ?? a.length > Sr, [m, _] = N(!1), [w, O] = N(""), [A, E] = N(0), [f, p] = N("down"), v = Q(null), k = Q(null), R = Q(null), M = a.find((d) => n !== void 0 && ke(d.value) === ke(n)), j = Y(() => C ? Cr(a, w) : a, [C, a, w]), L = Y(
    () => [...i ? [{ key: Le, label: it, value: Le, isAuto: !0 }] : [], ...j.map((d) => ({ key: ke(d.value), label: d.label, hint: d.hint, value: d.value }))],
    [i, j]
  ), q = o ? Le : M ? ke(M.value) : void 0, g = () => {
    _(!1), O("");
  }, F = (d) => {
    d.isAuto ? b == null || b() : s(d.value), g();
  };
  Rt(() => {
    if (!m || !v.current) return;
    const d = v.current.getBoundingClientRect();
    let y = v.current.parentElement;
    for (; y && !/(auto|scroll)/.test(getComputedStyle(y).overflowY); ) y = y.parentElement;
    const I = y ? y.getBoundingClientRect() : null, J = Math.min(window.innerHeight, I ? I.bottom : window.innerHeight), u = Math.max(0, I ? I.top : 0);
    p(Mr(J - d.bottom, d.top - u, Tr(a.length + (i ? 1 : 0), C)));
  }, [m]), G(() => {
    if (!m) return;
    const d = L.findIndex((y) => y.key === q);
    E(d >= 0 ? d : 0);
  }, [m, w]), G(() => {
    var d, y, I;
    m && ((I = (y = (d = k.current) == null ? void 0 : d.querySelector(`[data-i="${A}"]`)) == null ? void 0 : y.scrollIntoView) == null || I.call(y, { block: "nearest" }));
  }, [A, m]), G(() => {
    var d;
    m && C && ((d = R.current) == null || d.focus());
  }, [m, C]), G(() => {
    if (!m) return;
    const d = (y) => {
      var I;
      (I = v.current) != null && I.contains(y.target) || g();
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
      d.preventDefault(), L[A] && F(L[A]);
      return;
    }
    if (d.key === "Tab") {
      g();
      return;
    }
    if (d.key === " " && !C) {
      d.preventDefault(), L[A] && F(L[A]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(d.key) && (d.preventDefault(), E((y) => Er(y, d.key, L.length)));
  }, c = o ? it : (M == null ? void 0 : M.label) ?? "Select…";
  return /* @__PURE__ */ l("div", { ref: v, className: "relative w-full", onKeyDown: W, children: [
    /* @__PURE__ */ l(
      "button",
      {
        id: $,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": m,
        "aria-label": `${t}: ${c}`,
        "aria-controls": `${$}-list`,
        onClick: () => _((d) => !d),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${m ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: c }),
          /* @__PURE__ */ r(Ie, { up: m, width: 16, height: 16 })
        ]
      }
    ),
    m && /* @__PURE__ */ l("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${f === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      C && /* @__PURE__ */ r(
        "input",
        {
          ref: R,
          value: w,
          onChange: (d) => O(d.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${$}-list`,
          "aria-activedescendant": L[A] ? `${$}-o${A}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ l("ul", { id: `${$}-list`, ref: k, role: "listbox", "aria-label": t, style: { maxHeight: Ke }, className: "overflow-y-auto", children: [
        L.map((d, y) => {
          const I = d.key === q;
          return /* @__PURE__ */ l(
            "li",
            {
              id: `${$}-o${y}`,
              "data-i": y,
              role: "option",
              "aria-selected": I,
              onMouseEnter: () => E(y),
              onClick: () => F(d),
              className: `flex cursor-pointer items-center justify-between gap-2 rounded-ctl px-3 py-2.5 text-sm ${I ? "bg-primary text-primary-ink" : y === A ? "bg-card-bg" : ""} ${d.isAuto && !I ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ l("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: d.label }),
                  d.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${I ? "opacity-70" : "text-muted"}`, children: d.hint })
                ] }),
                I && /* @__PURE__ */ r(xe, { width: 14, height: 14 })
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
const _r = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Lr({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Ce, {}) });
}
function Rr({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: s }) {
  const [i, o] = N(a), [b, S] = N(""), [h, $] = N(1), [C, m] = N(null), [_, w] = N(null), [O, A] = N(!1), [E, f] = N([]), [p, v] = N(""), [k, R] = N(!1), M = Q(null), j = Q(null), L = re(async () => {
    A(!0), w(null);
    try {
      m(await e.mediaLibrary({ mediaType: i, search: b, page: h }));
    } catch (c) {
      w(c.message);
    } finally {
      A(!1);
    }
  }, [e, i, b, h]);
  G(() => {
    const c = setTimeout(L, b ? 300 : 0);
    return () => clearTimeout(c);
  }, [L, b]), G(() => {
    $(1);
  }, [i, b]), G(() => {
    var y;
    const c = document.activeElement;
    (y = M.current) == null || y.focus();
    const d = (I) => {
      if (I.key === "Escape") {
        I.stopPropagation(), s();
        return;
      }
      if (I.key !== "Tab" || !M.current) return;
      const J = [...M.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!J.length) return;
      const u = J[0], B = J[J.length - 1];
      I.shiftKey && document.activeElement === u ? (I.preventDefault(), B.focus()) : !I.shiftKey && document.activeElement === B && (I.preventDefault(), u.focus());
    };
    return document.addEventListener("keydown", d), () => {
      var I;
      document.removeEventListener("keydown", d), (I = c == null ? void 0 : c.focus) == null || I.call(c);
    };
  }, [s]);
  const q = (c) => f((d) => d.includes(c) ? d.filter((y) => y !== c) : t === 1 ? [c] : d.length < t ? [...d, c] : d), g = async (c) => {
    if (c.length) {
      A(!0), w(null);
      try {
        for (const d of c) {
          const y = await e.upload(d);
          await e.saveToLibrary({ url: y, name: d.name, mime_type: d.type || void 0, size_bytes: d.size, media_type: d.type.startsWith("video") ? "video" : d.type.startsWith("audio") ? "audio" : d.type.startsWith("image") ? "image" : "archive" });
        }
        await L();
      } catch (d) {
        w(d.message), A(!1);
      }
    }
  }, F = async () => {
    var d;
    const c = p.trim();
    if (!/^https?:\/\//i.test(c)) {
      w("Enter a full http(s) URL");
      return;
    }
    A(!0), w(null);
    try {
      const y = ((d = c.split("?")[0].split(".").pop()) == null ? void 0 : d.toLowerCase()) ?? "", I = ["mp4", "webm", "mov"].includes(y) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(y) ? "audio" : ["zip", "rar", "7z"].includes(y) ? "archive" : "image";
      await e.saveToLibrary({ url: c, name: c.split("/").pop() || "link", media_type: I }), v(""), R(!1), await L();
    } catch (y) {
      w(y.message), A(!1);
    }
  }, W = async (c) => {
    if (window.confirm(`Delete "${c.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(c.id), f((d) => d.filter((y) => y !== c.url)), await L();
      } catch (d) {
        w(d.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (c) => {
    c.target === c.currentTarget && s();
  }, children: /* @__PURE__ */ l("div", { ref: M, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ l("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Ce, {}) }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ l("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
            (C == null ? void 0 : C.total) ?? 0,
            " ",
            (C == null ? void 0 : C.total) === 1 ? "item" : "items"
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
        const d = Array.from(c.target.files ?? []);
        c.target.value = "", g(d);
      } }),
      /* @__PURE__ */ l("button", { type: "button", onClick: () => {
        var c;
        return (c = j.current) == null ? void 0 : c.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ r(wt, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: s, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(fe, {}) })
    ] }),
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: _r.map((c) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": i === c.id, onClick: () => o(c.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === c.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: c.label }, c.id)) }),
      /* @__PURE__ */ r("input", { value: b, onChange: (c) => S(c.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": k, onClick: () => R((c) => !c), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    k && /* @__PURE__ */ l("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: p, onChange: (c) => v(c.target.value), onKeyDown: (c) => c.key === "Enter" && void F(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void F(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      _ && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: _ }),
      O && !C ? /* @__PURE__ */ l("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(ve, {}),
        " Loading…"
      ] }) : C != null && C.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: C.items.map((c) => {
        const d = E.includes(c.url);
        return /* @__PURE__ */ l("li", { className: `group relative overflow-hidden rounded-card border ${d ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": d, "aria-label": `${d ? "Deselect" : "Select"} ${c.name ?? "file"}`, onClick: () => q(c.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Lr, { a: c }) }),
          d && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(xe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${c.name ?? "file"}`, onClick: () => void W(c), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(fe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: c.name ?? "", children: c.name })
        ] }, c.id);
      }) }) : /* @__PURE__ */ l("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ce, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      C && C.total_pages > 1 && /* @__PURE__ */ l("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: h <= 1, onClick: () => $((c) => c - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        h,
        " of ",
        C.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: h >= C.total_pages, onClick: () => $((c) => c + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
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
        n(E), s();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(xe, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const kt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Dr = (e, t = "") => {
  const a = kt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Or = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function jr(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, s) => void e.saveToLibrary({ url: a[s], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: Or(n) }).catch(() => {
  })), a;
}
function qe({ client: e, field: t, multiple: a, max: n, current: s, onUrls: i, onError: o }) {
  const b = Q(null), [S, h] = N(!1), [$, C] = N(!1), [m, _] = N(!1), w = n - s.length, O = gt(), A = async (p) => {
    if (p.length) {
      h(!0);
      try {
        i(await jr(e, a ? p.slice(0, Math.max(w, 1)) : p.slice(0, 1)));
      } catch (v) {
        o(v.message);
      } finally {
        h(!1);
      }
    }
  }, E = kt(t.prop.field, t.prop.name), f = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ l(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), C(!0);
      },
      onDragLeave: () => C(!1),
      onDrop: (p) => {
        p.preventDefault(), C(!1), A(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${$ ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: b, type: "file", hidden: !0, accept: E, multiple: a, onChange: (p) => {
          const v = Array.from(p.target.files ?? []);
          p.target.value = "", A(v);
        } }),
        (a ? w > 0 : !0) && /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
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
          /* @__PURE__ */ r("button", { type: "button", disabled: S, onClick: () => {
            var p;
            return (p = b.current) == null ? void 0 : p.click();
          }, "aria-label": "Upload file", title: "Upload file", className: f, children: S ? /* @__PURE__ */ r(ve, { width: 16, height: 16 }) : /* @__PURE__ */ r(wt, { width: 16, height: 16 }) }),
          O.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => _(!0), "aria-label": "Choose from media library", title: "Media library", className: f, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        m && O.library && /* @__PURE__ */ r(Rr, { client: e, max: a ? Math.max(w, 1) : 1, initialType: Dr(t.prop.field, t.prop.name), onInsert: i, onClose: () => _(!1) })
      ]
    }
  );
}
function Pr({ field: e, values: t, onChange: a, client: n, onError: s, tagCount: i = 0 }) {
  const { prop: o, kind: b, required: S } = e, h = t[o.name], $ = (p) => a(o.name, p), C = o.title || o.name, m = `ms-f-${o.name}`, _ = h == null ? "" : String(h), w = Array.isArray(h) ? h : [], O = t[pe(o.name)] === !0, A = Q(null), E = (p) => {
    const v = A.current, k = typeof h == "string" ? h : "", R = (v == null ? void 0 : v.selectionStart) ?? k.length, M = (v == null ? void 0 : v.selectionEnd) ?? R;
    $(k.slice(0, R) + p + " " + k.slice(M)), requestAnimationFrame(() => {
      v == null || v.focus(), v == null || v.setSelectionRange(R + p.length + 1, R + p.length + 1);
    });
  };
  let f;
  if (b === "textarea" || b === "json")
    f = /* @__PURE__ */ l(Me, { children: [
      /* @__PURE__ */ r("textarea", { ref: A, id: m, rows: b === "json" ? 4 : 5, value: typeof h == "string" ? h : h ? JSON.stringify(h, null, 2) : "", onChange: (p) => $(p.target.value), className: `w-full resize-y p-3 text-sm ${b === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && i > 0 && /* @__PURE__ */ l("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (p, v) => `@image${v + 1}`).map((p) => /* @__PURE__ */ r("button", { type: "button", onClick: () => E(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (b === "select") {
    const p = o.enum ?? [];
    f = /* @__PURE__ */ r(
      Ue,
      {
        id: m,
        label: C,
        options: Ar(p),
        value: h,
        onChange: (v) => {
          $(v), a(pe(o.name), !1);
        },
        allowAuto: nt(e),
        auto: O,
        onAuto: () => a(pe(o.name), !0)
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
        onClick: () => $(!p),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${p ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${p ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (b === "number") {
    const p = o.minValue !== void 0 && o.maxValue !== void 0;
    f = /* @__PURE__ */ l("div", { className: `flex items-center gap-3 ${O ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ r("input", { type: "range", disabled: O, "aria-label": `${C} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: _ === "" ? o.minValue : Number(_), onChange: (v) => $(Number(v.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: m, type: "number", disabled: O, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: _, onChange: (v) => $(v.target.value === "" ? "" : Number(v.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (b === "media")
    f = /* @__PURE__ */ r(qe, { client: n, field: e, multiple: !1, max: 1, current: _ ? [_] : [], onUrls: (p) => $(p[0]), onError: s });
  else if (b === "media-list") {
    const p = o.maxItems ?? 8;
    f = /* @__PURE__ */ l("div", { className: "space-y-2", children: [
      w.map((v, k) => /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${C} ${k + 1}`, value: v, onChange: (R) => $(w.map((M, j) => j === k ? R.target.value : M)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${C} ${k + 1}`, onClick: () => $(w.filter((R, M) => M !== k)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(fe, { width: 14, height: 14 }) })
      ] }, k)),
      /* @__PURE__ */ r(qe, { client: n, field: e, multiple: !0, max: p, current: w, onUrls: (v) => $([...w, ...v].slice(0, p)), onError: s })
    ] });
  } else
    f = /* @__PURE__ */ r("input", { id: m, value: _, onChange: (p) => $(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ l("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ l("label", { htmlFor: m, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        C,
        o.description && /* @__PURE__ */ r("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ r(dr, { width: 13, height: 13 }) })
      ] }),
      nt(e) && b === "number" ? /* @__PURE__ */ l("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: O, onChange: (p) => a(pe(o.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: b === "media-list" ? `${w.length}/${o.maxItems ?? 8} items${S ? " · required" : ""}` : S ? "* required" : "" })
    ] }),
    f
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
}, he = "Other", Ur = 3, qr = 2, Fr = 20, Vr = 2, Gr = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Nt(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ne[t] ? Ne[t] : Ne[a] ? Ne[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? he : Gr(a);
}
function Br(e) {
  const t = /* @__PURE__ */ new Map();
  for (const s of e) {
    const i = Nt(s.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [s, i] of t)
    s === he || i < Ur ? a += i : n.push({ id: s, label: s, count: i });
  return n.sort((s, i) => i.count - s.count || s.label.localeCompare(i.label)), a && n.push({ id: he, label: he, count: a }), n;
}
function St(e, t) {
  const a = Nt(e.name);
  return t.some((n) => n.id === a) ? a : he;
}
function zr(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function Hr(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const st = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function Jr(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const s = st.indexOf(n);
    return s < 0 ? st.length : s;
  };
  return [...t].map(([n, s]) => ({ id: n, count: s })).sort((n, s) => a(n.id) - a(s.id) || s.count - n.count || n.id.localeCompare(s.id));
}
const me = "__favourites__", te = "__all__";
function Kr(e, t, a) {
  return e.filter((n) => {
    var s;
    return t.category !== te && n.category !== t.category ? !1 : t.provider === me ? !!((s = t.favourites) != null && s.includes(n.name)) : t.provider === te || St(n, a) === t.provider;
  });
}
const Wr = (e, t) => t.filter((a) => a.id !== he).length >= qr && e.length >= Fr, Se = 200;
function Xr({ model: e }) {
  const t = ze(e);
  return t ? /* @__PURE__ */ l("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ae(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ae(t.current)
  ] }) : null;
}
const lt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, ct = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Re({ label: e, active: t, onClick: a, hue: n, children: s }) {
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
function Qr({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: s, usage: i, showGroup: o, scope: b = "default" }) {
  var J;
  const [S, h] = N(!1), [$, C] = N(""), [m, _] = N("popular"), [w, O] = N(!1), A = Q(null), E = Y(() => Br(e), [e]), f = Y(() => Jr(e), [e]), p = Wr(e, E), v = f.length >= Vr, [k, R] = N(() => lt(`muapi-studio:provider:${b}`, te)), [M, j] = N(() => lt(`muapi-studio:category:${b}`, te)), L = p && (k === me || k === te || E.some((u) => u.id === k)) ? k : te, q = v && (M === te || f.some((u) => u.id === M)) ? M : te, g = (u) => {
    R(u), ct(`muapi-studio:provider:${b}`, u);
  }, F = (u) => {
    j(u), ct(`muapi-studio:category:${b}`, u);
  }, W = Q(null);
  G(() => {
    S || O(!1);
  }, [S]), G(() => {
    if (!S) return;
    const u = (z) => {
      var X;
      (X = A.current) != null && X.contains(z.target) || h(!1);
    }, B = (z) => {
      z.key === "Escape" && h(!1);
    };
    return document.addEventListener("mousedown", u), document.addEventListener("keydown", B), () => {
      document.removeEventListener("mousedown", u), document.removeEventListener("keydown", B);
    };
  }, [S]);
  const c = Y(() => {
    const u = $.trim().toLowerCase(), B = Kr(e, { category: q, provider: L, favourites: n }, E), z = u ? B.filter((ne) => ne.name.toLowerCase().includes(u) || ne.category.toLowerCase().includes(u)) : B, X = bt(z, m, { usage: i, favorites: n });
    if (m === "favourites" || m === "most-used") return X;
    const oe = new Set(n);
    return [...X.filter((ne) => oe.has(ne.name)), ...X.filter((ne) => !oe.has(ne.name))];
  }, [e, $, m, n, i, q, L, E]), [d, y] = N(0);
  G(() => {
    var u, B;
    y(0), (B = (u = W.current) == null ? void 0 : u.scrollTo) == null || B.call(u, { top: 0 });
  }, [$, m, S, q, L]);
  const I = (u) => {
    u.key === "ArrowDown" ? (u.preventDefault(), y((B) => Math.min(B + 1, Math.min(c.length, Se) - 1))) : u.key === "ArrowUp" ? (u.preventDefault(), y((B) => Math.max(B - 1, 0))) : u.key === "Enter" && c[d] && (u.preventDefault(), a(c[d].name), h(!1));
  };
  return G(() => {
    var u, B;
    (B = (u = document.getElementById(`ms-opt-${d}`)) == null ? void 0 : u.scrollIntoView) == null || B.call(u, { block: "nearest" });
  }, [d]), /* @__PURE__ */ l("div", { ref: A, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        onClick: () => h((u) => !u),
        "aria-haspopup": "listbox",
        "aria-expanded": S,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (J = (t ?? "?")[0]) == null ? void 0 : J.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Ie, { up: S, width: 16, height: 16 })
        ]
      }
    ),
    S && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ l("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(Re, { label: "All providers", active: L === te, onClick: () => g(te), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(Re, { label: "Favourites", active: L === me, onClick: () => g(me), children: /* @__PURE__ */ r(rt, { width: 14, height: 14, filled: L === me }) }),
        E.map((u) => /* @__PURE__ */ r(Re, { label: `${u.label} (${u.count})`, active: L === u.id, onClick: () => g(u.id), hue: Hr(u.label), children: zr(u.label) }, u.id))
      ] }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ l("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(Je, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: I, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${d}`, value: $, onChange: (u) => C(u.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ l("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": w,
                onClick: () => O((u) => !u),
                className: `flex h-full items-center rounded-ctl border px-3 ${w ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(ur, { width: 16, height: 16 })
              }
            ),
            w && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: Ht.map((u) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ l(
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
        v && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: te, label: "All" }, ...f.map((u) => ({ id: u.id, label: u.id }))].map((u) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": q === u.id,
            onClick: () => F(u.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${q === u.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: u.label
          },
          u.id
        )) }),
        p && /* @__PURE__ */ l("div", { className: "mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
          L === te ? "All models" : L === me ? "Favourites" : L,
          " · ",
          c.length
        ] }),
        /* @__PURE__ */ l("ul", { id: "ms-listbox", ref: W, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          c.slice(0, Se).map((u, B) => {
            const z = u.name === t;
            return /* @__PURE__ */ l(
              "li",
              {
                id: `ms-opt-${B}`,
                role: "option",
                "aria-selected": z,
                onClick: () => {
                  a(u.name), h(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${z ? "bg-primary-soft" : B === d ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: [
                  /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ r("div", { className: `truncate text-sm ${z ? "text-primary" : ""}`, children: u.name }),
                    /* @__PURE__ */ r("div", { className: "text-[10px] text-secondary", children: o ? `${u.group_of} · ${u.category}` : p && L === te ? `${St(u, E)} · ${u.category}` : u.category })
                  ] }),
                  /* @__PURE__ */ r(
                    "button",
                    {
                      type: "button",
                      "aria-label": n.includes(u.name) ? "Remove favorite" : "Add favorite",
                      onClick: (X) => {
                        X.stopPropagation(), s(u.name);
                      },
                      className: n.includes(u.name) ? "text-primary" : "text-muted hover:text-fg",
                      children: /* @__PURE__ */ r(rt, { width: 15, height: 15, filled: n.includes(u.name) })
                    }
                  ),
                  /* @__PURE__ */ r(Xr, { model: u })
                ]
              },
              u.name
            );
          }),
          c.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: m === "favourites" ? "No favourites yet. Tap the heart on a model." : m === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${$}”.` }),
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
const dt = (e, t) => {
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
}, At = 0.25;
function Zr({ mode: e, models: t, client: a, batch: n, onRun: s, usage: i, reuse: o, switcher: b }) {
  const S = se.find((x) => x.id === e), h = Y(() => zt(t, e), [t, e]), [$, C] = N(), [m, _] = N(null), [w, O] = N(null), [A, E] = N({}), [f, p] = N(null), [v, k] = N(null), [R, M] = N(() => dt("muapi-studio:favorites", [])), [j, L] = N("form"), [q, g] = N(!1), [F, W] = N("{}"), [c, d] = N(null), y = Q(0), I = Q(null);
  G(() => {
    var H, ee, ce;
    const x = dt(`muapi-studio:model:${e}`, null), U = ((H = h.find((ie) => ie.name === x)) == null ? void 0 : H.name) ?? ((ee = h.find((ie) => ie.name === Gt[e])) == null ? void 0 : ee.name) ?? ((ce = bt(h, "popular")[0]) == null ? void 0 : ce.name);
    C(U);
  }, [e, h]), G(() => {
    o && (I.current = o.inputs, h.some((x) => x.name === o.model) && (C(o.model), De(`muapi-studio:model:${e}`, o.model)), L("form"));
  }, [o == null ? void 0 : o.nonce]);
  const J = h.find((x) => x.name === $);
  G(() => {
    if (!$) return;
    let x = !0;
    return _(null), O(null), p(null), k(null), d(null), a.model($).then((U) => {
      if (!x) return;
      const H = at(U), ee = _e(H), ce = I.current;
      if (I.current = null, ce)
        for (const ie of H) ce[ie.prop.name] !== void 0 && (ee[ie.prop.name] = ce[ie.prop.name]);
      _(U), E(ee);
    }).catch((U) => {
      x && O(U.message);
    }), () => {
      x = !1;
    };
  }, [$, a]);
  const u = Y(() => m ? at(m) : [], [m]), B = Y(() => ot(u, A), [u, A]), z = Y(() => {
    try {
      const x = JSON.parse(F);
      return x && typeof x == "object" && !Array.isArray(x) ? x : null;
    } catch {
      return null;
    }
  }, [F]), X = j === "json" ? z ?? {} : B, oe = JSON.stringify(X);
  G(() => {
    if (!m || j === "json" && !z) return;
    const x = ++y.current, U = setTimeout(() => {
      a.estimate(m.name, X).then((H) => {
        x === y.current && p(H);
      }).catch(() => {
        x === y.current && p(null);
      });
    }, 500);
    return () => clearTimeout(U);
  }, [m, oe, a]);
  const ne = (x) => {
    C(x), De(`muapi-studio:model:${e}`, x);
  }, we = (x) => M((U) => {
    const H = U.includes(x) ? U.filter((ee) => ee !== x) : [...U, x];
    return De("muapi-studio:favorites", H), H;
  }), Te = (x) => {
    g(!1), x !== j && (x === "json" ? W(JSON.stringify(B, null, 2)) : z && E((U) => {
      const H = { ...U };
      for (const ee of u) z[ee.prop.name] !== void 0 && (H[ee.prop.name] = z[ee.prop.name]);
      return H;
    }), L(x), k(null));
  }, Z = J ? ze(J, f) : null, ge = re(async () => {
    if (!m) return;
    d(null);
    const x = u.find((U) => U.prop.name === "prompt");
    await s({
      model: m.name,
      endpointUrl: m.endpoint_url,
      mode: e,
      payload: X,
      count: n,
      kind: Be(m.category),
      prompt: x ? String(X.prompt ?? "") : "",
      unitCost: Z == null ? void 0 : Z.current
    });
  }, [m, u, s, e, X, n, Z]), Ee = re(async () => {
    if (!m) return;
    if (j === "json") {
      if (!z) {
        k("The JSON is not valid");
        return;
      }
      const U = (m.required_fields ?? []).find((H) => z[H] === void 0 || z[H] === "");
      if (U) {
        k(`${U} is required`);
        return;
      }
    } else {
      const U = Nr(u, A);
      if (U) {
        k(U);
        return;
      }
    }
    k(null);
    const x = ((Z == null ? void 0 : Z.current) ?? 0) * n;
    if (x > At) {
      d(x);
      return;
    }
    await ge();
  }, [m, j, z, u, A, Z, n, ge]), le = !!m && !w, P = (() => {
    var U;
    const x = u.find((H) => H.kind === "media-list");
    return x ? Math.max(((U = A[x.prop.name]) == null ? void 0 : U.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ l("section", { "aria-label": S.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ l("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: S.title }),
        /* @__PURE__ */ l("div", { className: "relative", children: [
          /* @__PURE__ */ l("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": q, onClick: () => g((x) => !x), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            j === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Ie, { up: q, width: 12, height: 12 })
          ] }),
          q && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((x) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": j === x, type: "button", onClick: () => Te(x), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${j === x ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: x === "json" ? "JSON" : "Form" }) }, x)) })
        ] })
      ] }),
      b,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(Qr, { models: h, value: $, onChange: ne, favorites: R, onToggleFavorite: we, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: j === "json" ? "Request body" : "Parameters" }),
      (J == null ? void 0 : J.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: J.description }),
      !le && !w && $ && /* @__PURE__ */ l("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(ve, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      w && /* @__PURE__ */ l("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        w
      ] }),
      h.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      le && j === "json" && /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !z, spellCheck: !1, rows: 16, value: F, onChange: (x) => W(x.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${z ? "text-muted" : "text-danger"}`, children: z ? `Sent as the body of POST /api/v1/${m.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      le && j === "form" && u.map((x) => /* @__PURE__ */ r(
        Pr,
        {
          field: x,
          values: A,
          client: a,
          onError: k,
          tagCount: x.prop.name === "prompt" ? P : 0,
          onChange: (U, H) => E((ee) => ({ ...ee, [U]: H }))
        },
        x.prop.name
      ))
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      v && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: v }),
      c !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(c) }),
        " (",
        n,
        " × ",
        ae((Z == null ? void 0 : Z.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void ge(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => d(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          m && (E(_e(u)), W(JSON.stringify(ot(u, _e(u)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ l(
          "button",
          {
            type: "button",
            onClick: () => void Ee(),
            disabled: !le,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(He, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              Z && /* @__PURE__ */ l("span", { className: "font-normal", children: [
                "(",
                Z.original !== null ? /* @__PURE__ */ l(Me, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: ae(Z.original * n) }),
                  " "
                ] }) : null,
                ae(Z.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Yr = {
  image: Ce,
  video: nr,
  audio: or,
  avatar: ir,
  "3d": vt,
  "ai-tools": sr,
  text: mr,
  more: pr
};
function ea({ mode: e, onChange: t, layout: a = "rail" }) {
  return a === "tabs" ? /* @__PURE__ */ r("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: se.map((n) => {
    const s = n.id === e;
    return /* @__PURE__ */ l(
      "button",
      {
        onClick: () => t(n.id),
        "aria-current": s ? "page" : void 0,
        className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${s ? "text-primary" : "text-secondary hover:text-fg"}`,
        children: [
          n.label,
          s && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
        ]
      },
      n.id
    );
  }) }) : /* @__PURE__ */ r("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: se.map((n) => {
    const s = Yr[n.id], i = n.id === e;
    return /* @__PURE__ */ l(
      "button",
      {
        onClick: () => t(n.id),
        "aria-current": i ? "page" : void 0,
        className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${i ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
        children: [
          /* @__PURE__ */ r(s, {}),
          n.label
        ]
      },
      n.id
    );
  }) });
}
const ta = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], ra = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], aa = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], na = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), oa = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], ia = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), sa = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], la = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], ca = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], da = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], ua = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), ma = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], pa = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), ha = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Ct = {
  seedream: { aspect: ta, resolution: ra },
  seedance: { aspect: aa, duration: na },
  minimax: { resolution: oa, duration: ia },
  wan: { aspect: sa, resolution: la, quality: ca, duration: da },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, fa = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, de = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Mt(e) {
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
function ga(e) {
  return fa[e.template];
}
function ut(e) {
  var n, s, i, o, b, S, h, $, C, m, _;
  const t = Ct[e.template], a = {};
  for (const w of e.sliders ?? []) a[w.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (i = (s = t.aspect) == null ? void 0 : s[0]) == null ? void 0 : i.value,
    resolution: (b = (o = t.resolution) == null ? void 0 : o[0]) == null ? void 0 : b.value,
    duration: ((h = (S = t.duration) == null ? void 0 : S.find((w) => w.value === 5)) == null ? void 0 : h.value) ?? ((C = ($ = t.duration) == null ? void 0 : $[0]) == null ? void 0 : C.value),
    quality: (_ = (m = t.quality) == null ? void 0 : m[0]) == null ? void 0 : _.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function It(e, t) {
  var s;
  const a = [e.prompt], n = (s = e.presets) == null ? void 0 : s.find((i) => i.id === t.preset);
  n != null && n.prompt && a.push(n.prompt);
  for (const i of e.sliders ?? []) {
    const o = t.sliders[i.id] ?? 0;
    if (o !== 0) {
      const b = i.phrase(o);
      b && a.push(b);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function mt(e, t, a) {
  var i;
  const n = (i = e.presets) == null ? void 0 : i.find((o) => o.id === a), s = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: s };
}
function ba(e, t) {
  for (const a of Mt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function ya(e, t) {
  const a = It(e, t), n = t.uploads;
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
function xa(e) {
  return e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const va = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], T = (e, t, a, n, s) => ({ id: e, label: t, hint: a, prompt: n, values: s }), Fe = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, V = (e, t, a, n, s, i, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: s, prompt: i, ...o }), D = (e, t, a, n, s, i, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: s, prompt: i, ...o }), Ae = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${Fe(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${Fe(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], wa = [Ae[2], { ...Ae[1], id: "vertical", label: "Vertical angle" }, Ae[0]].map((e) => ({ ...e, id: e.id })), ka = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${Fe(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Na = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], Sa = "Keep the result tasteful and suitable for general audiences.", $t = [
  // ---- Professional
  V(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Ae, presets: [
      T("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      T("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      T("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      T("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      T("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      T("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      T("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  V(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  V(
    "shots",
    "Shots",
    "🎥",
    "professional",
    "Reframe one photo as different cinematic shot types.",
    "Reframe this scene as a professional cinematic shot while keeping the same subject and setting.",
    { presetLabel: "Shot type", presets: [
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
  V(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: wa.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
    { presetLabel: "Transition", presets: [
      T("morph", "Morph", void 0, "Use a morph transition."),
      T("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      T("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      T("whip", "Whip pan", void 0, "Use a fast whip pan."),
      T("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  V(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  V(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { presetLabel: "Preset", sliders: Na, presets: [
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
  V(
    "ai-stylist",
    "AI Stylist",
    "👗",
    "enhance-style",
    "Try outfit styles on your photo while keeping your pose.",
    "Restyle the person in this photo with a new outfit while keeping their face, pose and the background natural.",
    { presetLabel: "Style", presets: [
      T("casual", "Casual", void 0, "Dress them in a relaxed casual outfit."),
      T("formal", "Formal", void 0, "Dress them in a sharp formal outfit."),
      T("street", "Streetwear", void 0, "Dress them in streetwear."),
      T("athletic", "Athletic", void 0, "Dress them in athletic wear."),
      T("evening", "Evening", void 0, "Dress them in an elegant evening outfit."),
      T("vintage", "Vintage", void 0, "Dress them in a vintage-style outfit.")
    ] }
  ),
  V(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: ka }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  V(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  V(
    "style-snap",
    "Style Snap",
    "📸",
    "enhance-style",
    "Quick style makeovers that keep your pose.",
    "Give the person a new fashion style while keeping the same pose, face and setting.",
    { presetLabel: "Style", presets: [
      T("boho", "Boho chic", void 0, "Use a boho chic look."),
      T("minimal", "Minimalist", void 0, "Use a clean minimalist look."),
      T("punk", "Punk rock", void 0, "Use a punk rock look."),
      T("preppy", "Preppy", void 0, "Use a preppy look."),
      T("y2k", "Y2K", void 0, "Use an early-2000s Y2K look."),
      T("cottage", "Cottagecore", void 0, "Use a cottagecore look.")
    ] }
  ),
  V(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  V(
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
  V(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  V(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  V(
    "headshot-generator",
    "Headshot Generator",
    "📷",
    "face-identity",
    "Studio-style professional headshots from a photo.",
    "Create a professional studio headshot of this person: flattering lighting, clean background, natural expression and sharp focus on the face.",
    { consent: !0, presetLabel: "Style", presets: [
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
  V(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  V(
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
  V("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
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
  V("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  D("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  D("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  D("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  V("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  V(
    "game-dump",
    "Game Dump",
    "🎮",
    "games-characters",
    "See yourself as a hero in different game genres.",
    "Transform the person in this photo into a video game character with a game-style interface overlay, keeping their likeness.",
    { presetLabel: "Game genre", presets: [
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
  V("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  V("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  V("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  V("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  V("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  V("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  V(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presetLabel: "Pixel style", presets: [T("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), T("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), T("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), T("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  V("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  D("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  D("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${Sa}`),
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
], $e = (e) => $t.find((t) => t.slug === e), Ve = (e) => e.badge === "VIDEO" ? "video" : "image", We = (e) => $t.filter((t) => Ve(t) === e), Ge = (e) => We(e).length > 0;
function Tt(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = $e(t.get("app"));
  return a === "apps" ? { mode: n ? Ve(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === Ve(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function Aa(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function Ca(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const Ma = (e) => va.filter((t) => We(e).some((a) => a.category === t.id));
function Ia({ mode: e, value: t, onChange: a }) {
  const [n, s] = N(!1), [i, o] = N(""), [b, S] = N("all"), [h, $] = N(0), C = Q(null), m = Y(() => Ma(e), [e]), _ = Y(() => Ca(We(e), { category: b, q: i }), [e, b, i]), w = $e(t);
  G(() => $(0), [i, b, n]), G(() => {
    if (!n) return;
    const f = (v) => {
      var k;
      (k = C.current) != null && k.contains(v.target) || s(!1);
    }, p = (v) => {
      v.key === "Escape" && s(!1);
    };
    return document.addEventListener("mousedown", f), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", f), document.removeEventListener("keydown", p);
    };
  }, [n]), G(() => {
    var f, p;
    (p = (f = document.getElementById(`ms-app-${h}`)) == null ? void 0 : f.scrollIntoView) == null || p.call(f, { block: "nearest" });
  }, [h]);
  const O = (f) => {
    a(f), s(!1), o("");
  }, A = (f) => {
    f.key === "ArrowDown" ? (f.preventDefault(), $((p) => Math.min(p + 1, _.length - 1))) : f.key === "ArrowUp" ? (f.preventDefault(), $((p) => Math.max(p - 1, 0))) : f.key === "Enter" && _[h] && (f.preventDefault(), O(_[h].slug));
  }, E = (f) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${f ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ l("div", { ref: C, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => s((f) => !f),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (w == null ? void 0 : w.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (w == null ? void 0 : w.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Ie, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ l("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(Je, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: A, value: i, onChange: (f) => o(f.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ l("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": b === "all", onClick: () => S("all"), className: E(b === "all"), children: "All" }),
        m.map((f) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": b === f.id, onClick: () => S(f.id), className: E(b === f.id), children: f.label }, f.id))
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
const $a = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), be = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function Ta({ mode: e, slug: t, onApp: a, switcher: n, models: s, client: i, batch: o, onRun: b }) {
  const S = $e(t), h = se.find(($) => $.id === e).title;
  return /* @__PURE__ */ l("section", { "aria-label": h, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: h }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(Ia, { mode: e, value: t, onChange: a }) })
    ] }),
    S ? /* @__PURE__ */ r(Ea, { app: S, mode: e, models: s, client: i, batch: o, onRun: b }, S.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Ea({ app: e, mode: t, models: a, client: n, batch: s, onRun: i }) {
  var q;
  const [o, b] = N(() => ut(e)), [S, h] = N(null), [$, C] = N(null), [m, _] = N(null), w = Q(0);
  G(() => {
    b(ut(e)), h(null), C(null), _(null);
  }, [e]);
  const O = ga(e), A = a.find((g) => g.name === O), E = Ct[e.template], f = Y(() => ya(e, o), [e, o]), p = JSON.stringify(f), v = (g) => b((F) => ({ ...F, ...g }));
  G(() => {
    if (!A) return;
    const g = ++w.current, F = setTimeout(() => {
      n.estimate(O, f).then((W) => {
        g === w.current && C(W);
      }).catch(() => {
        g === w.current && C(null);
      });
    }, 500);
    return () => clearTimeout(F);
  }, [p, A, n]);
  const k = A ? ze(A, $) : null, R = Mt(e), M = async () => {
    A && (_(null), await i({ model: O, endpointUrl: A.endpoint_url, mode: t, prompt: It(e, o) || e.name, payload: f, count: s, kind: Be(A.category), unitCost: k == null ? void 0 : k.current }));
  }, j = async () => {
    const g = ba(e, o);
    if (g) {
      h(g);
      return;
    }
    h(null);
    const F = ((k == null ? void 0 : k.current) ?? 0) * s;
    if (F > At) {
      _(F);
      return;
    }
    await M();
  }, L = (g, F, W, c) => F && F.length > 0 ? /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: be, children: g }),
    /* @__PURE__ */ r(Ue, { label: g, options: $a(F), value: W, onChange: c })
  ] }) : null;
  return /* @__PURE__ */ l("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !A && /* @__PURE__ */ l("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        O,
        "”, which is not in your catalog right now."
      ] }),
      R.map((g) => /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: be, children: [
          /* @__PURE__ */ r("span", { children: g.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: g.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          qe,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: o.uploads[g.id] ? [o.uploads[g.id]] : [],
            field: { prop: { name: `${g.kind}_${g.id}`, title: g.label, field: g.kind }, kind: "media", required: !g.optional },
            onUrls: (F) => v({ uploads: { ...o.uploads, [g.id]: F[0] ?? "" } }),
            onError: h
          }
        )
      ] }, g.id)),
      e.presets && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: be, children: e.presetLabel ?? "Preset" }),
        /* @__PURE__ */ r(Ue, { label: e.presetLabel ?? "Preset", options: [{ value: "", label: "Custom" }, ...e.presets.map((g) => ({ value: g.id, label: g.label, hint: g.hint }))], value: o.preset, onChange: (g) => b(mt(e, o, String(g))) })
      ] }),
      (q = e.sliders) == null ? void 0 : q.map((g) => /* @__PURE__ */ l("div", { className: "mb-4", children: [
        /* @__PURE__ */ l("div", { className: be, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${g.id}`, children: g.label }),
          /* @__PURE__ */ l("span", { className: "tabular-nums text-primary", children: [
            o.sliders[g.id] ?? 0,
            g.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${g.id}`, type: "range", min: g.min, max: g.max, step: g.step, value: o.sliders[g.id] ?? 0, className: "w-full", onChange: (F) => v({ sliders: { ...o.sliders, [g.id]: Number(F.target.value) } }) })
      ] }, g.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => b(mt(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: be, children: [
          "Extra instructions ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "optional" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Extra instructions", rows: 3, value: o.refinement, onChange: (g) => v({ refinement: g.target.value }), placeholder: "Anything to add or change…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      L("Aspect Ratio", E.aspect, o.aspect, (g) => v({ aspect: g })),
      L("Resolution", E.resolution, o.resolution, (g) => v({ resolution: g })),
      L("Quality", E.quality, o.quality, (g) => v({ quality: String(g) })),
      L("Duration", E.duration, o.duration, (g) => v({ duration: Number(g) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && L("Target face", ua, o.targetIndex, (g) => v({ targetIndex: Number(g) })),
      e.template === "video-face-swap" && L("Faces to swap", ma, o.gender, (g) => v({ gender: String(g) })),
      e.template === "bg-remover" && /* @__PURE__ */ l(Me, { children: [
        L("Background", pa, o.background, (g) => v({ background: String(g) })),
        L("Output format", ha, o.container, (g) => v({ container: String(g) })),
        /* @__PURE__ */ l("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Keep audio" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Keep audio", "aria-checked": o.keepAudio, onClick: () => v({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      S && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: S }),
      m !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(m) }),
        " (",
        s,
        " × ",
        ae((k == null ? void 0 : k.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void M(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => _(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !A, onClick: () => void j(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(He, { width: 16, height: 16, className: "shrink-0" }),
        xa(e),
        s > 1 ? ` ×${s}` : "",
        k && k.current > 0 && /* @__PURE__ */ l("span", { className: "font-normal", children: [
          "(",
          ae(k.current * s),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function pt({ view: e, onChange: t }) {
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
function _a() {
  try {
    const e = window.location.search, t = Tt(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return Bt(a) ? a : null;
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
function ht(e) {
  if (!Ge(e)) return { view: "models", app: null };
  try {
    const a = Tt(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = ye.get(`muapi-studio:app:${e}`);
  return { view: ye.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: $e(t) ? t : null };
}
function Da({ apiBase: e = "/api/muapi", initialTab: t = "image", showHeader: a = !0, title: n = "Studio", teamId: s, theme: i = "lime", layout: o, apiKey: b, onRequestApiKey: S, getHeaders: h, connected: $, fetchImpl: C, features: m, className: _ = "", onTabChange: w }) {
  const O = $ === !1 || b === "" || b === null, A = Q(h);
  A.current = h;
  const E = Y(() => new Ot(e, s, { apiKey: b || void 0, getHeaders: () => {
    var P;
    return ((P = A.current) == null ? void 0 : P.call(A)) ?? {};
  }, fetchImpl: C }), [e, s, b, C]), [f, p] = N({ library: !0, deleteMedia: !0 }), v = Y(() => ({ library: f.library && (m == null ? void 0 : m.library) !== !1, deleteMedia: (m == null ? void 0 : m.deleteMedia) !== !1 }), [f, m == null ? void 0 : m.library, m == null ? void 0 : m.deleteMedia]), k = o ?? Vt(i), [R, M] = N(() => _a() ?? t), [j, L] = N(4), [q, g] = N(null), [F, W] = N(null), [c, d] = N(null), y = re(() => {
    E.balance().then(d).catch(() => d(null));
  }, [E]), [I, J] = N(null), u = tr(E, q, y), B = Y(() => Qt(u.items), [u.items]);
  G(() => {
    O || (W(null), g(null), E.models().then(g).catch((P) => W(P.message)), y(), (m == null ? void 0 : m.library) !== !1 && E.probe().then(p));
  }, [E, y, O, m == null ? void 0 : m.library]);
  const [z, X] = N(() => ht(R)), oe = (P, x) => {
    try {
      window.history.replaceState(null, "", Aa(window.location.search, P, x));
    } catch {
    }
  }, ne = (P) => {
    const x = ht(P);
    M(P), X(x), w == null || w(P), oe(P, x.view === "apps" ? x.app : null);
  }, we = (P) => {
    X((x) => ({ ...x, view: P })), ye.set(`muapi-studio:view:${R}`, P), oe(R, P === "apps" ? z.app : null);
  }, Te = (P) => {
    X({ view: "apps", app: P }), ye.set(`muapi-studio:app:${R}`, P), ye.set(`muapi-studio:view:${R}`, "apps"), oe(R, P);
  }, Z = re(async (P) => {
    await u.run(P);
  }, [u.run]), ge = re((P) => {
    var U;
    const x = q == null ? void 0 : q.find((H) => H.name === P);
    return x ? ((U = x.sale) == null ? void 0 : U.from) ?? x.cost ?? void 0 : void 0;
  }, [q]), Ee = re((P) => {
    M(P.mode), X((x) => ({ ...x, view: "models" })), J({ model: P.model, inputs: P.inputs, nonce: Date.now() });
  }, []), le = re((P) => {
    var H;
    const x = q == null ? void 0 : q.find((ee) => ee.name === P.model);
    if (!x) return;
    const U = ((H = x.sale) == null ? void 0 : H.from) ?? x.cost ?? 0;
    U > 0.25 && !window.confirm(`Re-run ${P.model} for about $${U.toFixed(2)}?`) || u.run({ model: P.model, endpointUrl: x.endpoint_url, mode: P.mode, prompt: P.prompt, payload: P.inputs, count: 1, unitCost: U, kind: Be(x.category) });
  }, [q, u.run]);
  return /* @__PURE__ */ l("div", { className: `ms-root ${_}`.trim(), style: Ft(i), "data-layout": k, children: [
    a && /* @__PURE__ */ l("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: n }),
      c && /* @__PURE__ */ l("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ae(c.balance) })
      ] })
    ] }),
    O ? /* @__PURE__ */ l("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays in your own account." }),
      S && /* @__PURE__ */ r("button", { type: "button", onClick: S, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ r(ft.Provider, { value: v, children: /* @__PURE__ */ l("div", { className: `flex min-h-0 flex-1 flex-col ${k === "rail" ? "md:flex-row" : ""}`, children: [
      /* @__PURE__ */ r(ea, { mode: R, onChange: ne, layout: k }),
      /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: F ? /* @__PURE__ */ l("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
        "Could not load models: ",
        F
      ] }) : q ? /* @__PURE__ */ l(Me, { children: [
        z.view === "apps" && Ge(R) ? /* @__PURE__ */ r(Ta, { mode: R, slug: z.app, onApp: Te, switcher: /* @__PURE__ */ r(pt, { view: "apps", onChange: we }), models: q, client: E, batch: j, onRun: Z }) : /* @__PURE__ */ r(Zr, { mode: R, models: q, client: E, batch: j, onRun: Z, usage: B, reuse: I, switcher: Ge(R) ? /* @__PURE__ */ r(pt, { view: "models", onChange: we }) : void 0 }),
        /* @__PURE__ */ r(xr, { mode: R, items: u.items, batch: j, onBatch: L, onLabel: u.setLabel, onRemove: u.remove, onReuse: Ee, onRerun: le, onDeleteMedia: u.deleteMedia, onLoadMore: u.loadMore, hasMore: u.hasMore, loadingMore: u.loadingMore, serverError: u.serverError, estimateFor: ge })
      ] }) : /* @__PURE__ */ l("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
        /* @__PURE__ */ r(ve, {}),
        " Loading studio…"
      ] }) })
    ] }) })
  ] });
}
export {
  ue as ApiError,
  Ot as MuapiClient,
  Da as MuapiStudio,
  Ut as THEMES,
  Pt as cyanTheme,
  Vt as defaultLayout,
  Be as generationKind,
  Oe as limeTheme,
  jt as pollUntilDone,
  qt as resolveTheme,
  Ft as themeStyle
};
