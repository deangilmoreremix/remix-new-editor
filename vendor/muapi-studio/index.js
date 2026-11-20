import { jsx as r, jsxs as s, Fragment as he } from "react/jsx-runtime";
import { createContext as $t, useContext as Tt, useState as N, useRef as Q, useEffect as z, useCallback as te, useMemo as Y, useId as Et, useLayoutEffect as _t } from "react";
class ue extends Error {
  constructor(t, a) {
    super(t), this.status = a;
  }
}
function Lt(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class Rt {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [y, m] of Object.entries(await this.opts.getHeaders())) n.set(y, m);
    const d = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), l = await d.text();
    let o = null;
    try {
      o = l ? JSON.parse(l) : null;
    } catch {
    }
    if (!d.ok) throw new ue(Lt(o, `${d.status} ${d.statusText}`), d.status);
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
    const d = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(a)
    }), l = d.request_id || d.id;
    if (!l) throw new ue("The API did not return a request id", 502);
    return { requestId: l, cost: (o = d.cost) == null ? void 0 : o.amount_usd };
  }
  async poll(t) {
    var o;
    const a = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`), n = String(a.status || "").toLowerCase(), d = ["completed", "succeeded"].includes(n) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(n) ? "failed" : n === "pending" ? "pending" : "processing", l = Array.isArray(a.outputs) ? a.outputs : a.url ? [a.url] : [];
    return { status: d, outputs: l, error: a.error || void 0, cost: (o = a.cost) == null ? void 0 : o.amount_usd };
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
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: a }), d = n.url || n.file_url || ((l = n.data) == null ? void 0 : l.url);
    if (!d) throw new ue("Upload returned no URL", 502);
    return d;
  }
}
async function Ot(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: d = 15 * 60 * 1e3, signal: l, onUpdate: o } = a, y = Date.now();
  let m = 0;
  for (; Date.now() - y < d; ) {
    if (l != null && l.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const p = await e.poll(t);
      if (m = 0, o == null || o(p), p.status === "completed" || p.status === "failed") return p;
    } catch (p) {
      if (++m >= 5) throw p;
    }
    await new Promise((p) => setTimeout(p, n));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const ft = $t({ library: !0, deleteMedia: !0 }), gt = () => Tt(ft), Re = {
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
}, Dt = {
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
}, jt = { lime: Re, cyan: Dt }, Je = {
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
function Pt(e = "lime") {
  return typeof e == "string" ? jt[e] ?? Re : { ...Re, ...e };
}
function Ut(e = "lime") {
  const t = Pt(e), a = {};
  for (const n of Object.keys(Je)) a[Je[n]] = t[n];
  return a;
}
function qt(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const ge = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  { id: "apps", label: "Apps", title: "Apps", groups: [] },
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
  apps: "",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Ge(e) {
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
const Ft = (e) => !!e && ge.some((t) => t.id === e);
function Vt(e, t) {
  const a = ge.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const Bt = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function bt(e, t, a = {}) {
  const n = (l) => {
    var o;
    return ((o = l.sale) == null ? void 0 : o.from) ?? l.cost ?? 1 / 0;
  }, d = [...e];
  return t === "a-z" ? d.sort((l, o) => l.name.localeCompare(o.name)) : t === "price-asc" ? d.sort((l, o) => n(l) - n(o)) : t === "price-desc" ? d.sort((l, o) => n(o) - n(l)) : t === "most-used" ? d.filter((l) => {
    var o;
    return (((o = a.usage) == null ? void 0 : o[l.name]) ?? 0) > 0;
  }).sort((l, o) => (a.usage[o.name] ?? 0) - (a.usage[l.name] ?? 0)) : t === "favourites" ? d.filter((l) => {
    var o;
    return (o = a.favorites) == null ? void 0 : o.includes(l.name);
  }) : d.sort((l, o) => +!!o.sale - +!!l.sale);
}
const Ht = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function zt(e, t) {
  var n, d;
  const a = (n = t.find((l) => l.name === e)) == null ? void 0 : n.group_of;
  return ((d = ge.find((l) => a && l.groups.includes(a))) == null ? void 0 : d.id) ?? "ai-tools";
}
function Jt(e, t, a = {}) {
  var l;
  const n = e.output ?? {}, d = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: zt(e.model, t),
    prompt: typeof d.prompt == "string" ? d.prompt : "",
    inputs: d,
    status: Ht[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: n.error || void 0,
    cost: (l = n.cost) == null ? void 0 : l.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function Kt(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Set(e.map((l) => l.requestId).filter(Boolean));
  return [...e, ...t.filter((l) => !l.requestId || !n.has(l.requestId))].filter((l) => !(l.requestId && a.has(l.requestId))).sort((l, o) => o.createdAt - l.createdAt);
}
function Wt(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function oe(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function Fe(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const yt = "muapi-studio:history:v1", Xt = 200;
function Ke() {
  try {
    const e = localStorage.getItem(yt);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function Qt(e) {
  try {
    localStorage.setItem(yt, JSON.stringify(e.slice(0, Xt)));
  } catch {
  }
}
const Zt = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, We = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, Xe = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, Qe = "muapi-studio:labels:v1", Ze = "muapi-studio:hidden:v1";
function Yt(e, t, a) {
  const [n, d] = N(() => Ke()), [l, o] = N([]), [y, m] = N(null), [p, $] = N(!1), [x, b] = N(null), _ = Q(!1), [A, L] = N(() => We(Qe, {})), [C, E] = N(() => We(Ze, [])), T = Q(/* @__PURE__ */ new Set()), g = Q(new AbortController()), v = Q([]);
  v.current = t ?? [], z(() => Qt(n), [n]), z(() => Xe(Qe, A), [A]), z(() => Xe(Ze, C), [C]), z(() => (g.current = new AbortController(), () => g.current.abort()), []);
  const I = te((i, c) => d((f) => f.map((k) => k.id === i ? { ...k, ...c } : k)), []), q = te(async (i, c) => {
    if (!T.current.has(i)) {
      T.current.add(i);
      try {
        const f = await Ot(e, c, {
          signal: g.current.signal,
          onUpdate: (k) => I(i, { status: k.status, outputs: k.outputs, error: k.error, cost: k.cost })
        });
        I(i, { status: f.status, outputs: f.outputs, error: f.error, cost: f.cost }), a == null || a();
      } catch (f) {
        f.name !== "AbortError" && I(i, { status: "failed", error: f.message });
      } finally {
        T.current.delete(i);
      }
    }
  }, [e, I, a]);
  z(() => {
    for (const i of Ke()) (i.status === "pending" || i.status === "processing") && i.requestId && q(i.id, i.requestId);
  }, []);
  const w = te(async (i = !1) => {
    if (!_.current) {
      $(!0), b(null);
      try {
        const c = await e.history(i ? void 0 : y ?? void 0), f = c.items.map((k) => Jt(k, v.current));
        o((k) => i ? f : [...k, ...f]), m(c.next_cursor);
      } catch (c) {
        c instanceof ue && [403, 404, 405].includes(c.status) ? (_.current = !0, m(null)) : b(c.message);
      } finally {
        $(!1);
      }
    }
  }, [e, y]), G = Q(!1);
  z(() => {
    t && !G.current && (G.current = !0, w(!0));
  }, [t, w]);
  const D = te((i) => {
    const c = Array.from({ length: i.count }, () => ({
      id: Zt(),
      model: i.model,
      mode: i.mode,
      prompt: i.prompt,
      inputs: i.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: i.unitCost,
      source: "local"
    }));
    return d((f) => [...c, ...f]), Promise.all(c.map(async (f) => {
      try {
        const { requestId: k, cost: B } = await e.submit(i.endpointUrl, i.payload, i.kind);
        I(f.id, { requestId: k, ...B !== void 0 ? { cost: B } : {} }), await q(f.id, k);
      } catch (k) {
        I(f.id, { status: "failed", error: k.message });
      }
    }));
  }, [e, I, q]), V = Y(() => {
    const i = (c) => ({ ...c, label: c.requestId && A[c.requestId] || c.label });
    return Kt(n.map(i), l.map(i), new Set(C));
  }, [n, l, A, C]), J = te((i, c) => {
    i.requestId && L((f) => {
      const k = { ...f };
      return c ? k[i.requestId] = c : delete k[i.requestId], k;
    }), I(i.id, { label: c });
  }, [I]), F = te((i) => {
    d((c) => c.filter((f) => f.id !== i.id)), i.requestId && E((c) => [.../* @__PURE__ */ new Set([...c, i.requestId])]);
  }, []), h = te(async (i) => {
    i.requestId && (await e.deleteMedia(i.requestId), I(i.id, { outputs: [] }), o((c) => c.map((f) => f.requestId === i.requestId ? { ...f, outputs: [] } : f)));
  }, [e, I]);
  return { items: V, run: D, setLabel: J, remove: F, deleteMedia: h, loadMore: () => w(!1), hasMore: !!y, loadingMore: p, serverError: x };
}
const er = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function xt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : er.test(e) ? "file" : "image" : "text";
}
function tr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const W = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Ie = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), rr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), ar = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), nr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), vt = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), or = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Ve = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), Ye = ({ filled: e, ...t }) => /* @__PURE__ */ r(W, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Be = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), He = ({ up: e, ...t }) => /* @__PURE__ */ r(W, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), ir = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), sr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), Oe = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ve = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), be = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), wt = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), lr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), we = (e) => /* @__PURE__ */ r(W, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), cr = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), dr = (e) => /* @__PURE__ */ r(W, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), ur = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), mr = (e) => /* @__PURE__ */ s(W, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("path", { d: "M17.5 14v7M14 17.5h7" })
] }), pr = ["All", "Approved", "Rejected", "Unlabeled"], hr = [1, 2, 4, 6, 8];
function fr({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, d = xt(e);
  return d === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: tr(e) }) : d === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : d === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : d === "3d" ? /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(vt, { width: 32, height: 32 }),
    "Open 3D model"
  ] }) : d === "file" ? /* @__PURE__ */ s("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(Oe, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function gr({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: d, onRerun: l, onDeleteMedia: o, onOpen: y, estimateFor: m }) {
  const p = e.outputs[0], $ = !!p && xt(p) === "text", [x, b] = N(!1), [_, A] = N(null), L = gt(), C = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", E = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ s("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && p ? /* @__PURE__ */ r(fr, { url: p, hidden: t, onOpen: () => y(p) }) : e.status === "failed" ? /* @__PURE__ */ s("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(be, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ s("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(we, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ s("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ s("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? oe(e.cost) : e.status === "completed" && (m == null ? void 0 : m(e.model)) !== void 0 ? `est. ${oe(m(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && p && ($ ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(p)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${E} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Oe, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: p, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${E} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(Oe, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${E} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
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
            className: `${E} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ r(be, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => d(e), title: "Load this model and settings back into the form", className: C, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => l(e), title: "Generate again with the same settings", className: C, children: "Re-run" }),
        e.status === "completed" && p && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var T;
          (T = navigator.clipboard) == null || T.writeText(p).then(() => {
            b(!0), setTimeout(() => b(!1), 1500);
          });
        }, className: C, children: x ? "Copied" : $ ? "Copy text" : "Copy link" })
      ] }),
      _ && /* @__PURE__ */ s("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        _
      ] }),
      /* @__PURE__ */ s("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ s("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ s("span", { className: "flex shrink-0 gap-3", children: [
          L.deleteMedia && e.requestId && e.status === "completed" && p && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (A(null), o(e).catch((T) => A(T.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function br({ url: e, onClose: t }) {
  return z(() => {
    const a = (n) => n.key === "Escape" && t();
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [t]), /* @__PURE__ */ s("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(be, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (a) => a.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function et({ mode: e, items: t, batch: a, onBatch: n, onLabel: d, onRemove: l, onReuse: o, onRerun: y, onDeleteMedia: m, onLoadMore: p, hasMore: $, loadingMore: x, serverError: b, estimateFor: _ }) {
  const [A, L] = N("All"), [C, E] = N(""), [T, g] = N(!1), [v, I] = N(null), q = Y(() => {
    const w = C.trim().toLowerCase();
    return t.filter((G) => G.mode !== e || A === "Approved" && G.label !== "approved" || A === "Rejected" && G.label !== "rejected" || A === "Unlabeled" && G.label !== null ? !1 : !w || G.prompt.toLowerCase().includes(w) || G.model.toLowerCase().includes(w));
  }, [t, e, A, C]);
  return /* @__PURE__ */ s("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: pr.map((w) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": A === w,
          onClick: () => L(w),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${A === w ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: w
        },
        w
      )) }),
      /* @__PURE__ */ s("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(Be, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: C, onChange: (w) => E(w.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: hr.map((w) => /* @__PURE__ */ r(
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
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": T, "aria-label": T ? "Show previews" : "Hide previews", title: T ? "Show previews" : "Hide previews", onClick: () => g((w) => !w), className: T ? "text-primary" : "text-secondary hover:text-fg", children: T ? /* @__PURE__ */ r(ir, { width: 18, height: 18 }) : /* @__PURE__ */ r(sr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      q.length === 0 ? /* @__PURE__ */ s("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ve, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some((w) => w.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((w) => w.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: q.map((w) => /* @__PURE__ */ r(gr, { g: w, hidden: T, onLabel: d, onRemove: l, onReuse: o, onRerun: y, onDeleteMedia: m, onOpen: I, estimateFor: _ }, w.id)) }),
      b && /* @__PURE__ */ s("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        b
      ] }),
      $ && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: x, onClick: p, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: x ? "Loading…" : "Load more history" }) }),
      v && /* @__PURE__ */ r(br, { url: v, onClose: () => I(null) })
    ] })
  ] });
}
const yr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, xr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function vr(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? yr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || xr.test(e.name) ? "media" : "text" : "text";
}
function tt(e) {
  var o, y;
  const t = (y = (o = e.input_schema) == null ? void 0 : o.schemas) == null ? void 0 : y.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), d = [...n.filter((m) => a[m]), ...Object.keys(a).filter((m) => !n.includes(m))], l = new Set(e.required_fields ?? []);
  return d.map((m) => ({ prop: { ...a[m], name: m }, kind: vr({ ...a[m], name: m }), required: l.has(m) }));
}
function Te(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: d, required: l } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : l && (d === "textarea" || d === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const pe = (e) => `__auto:${e}`, rt = (e) => (e.kind === "number" || e.kind === "select") && !e.required, De = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function at(e, t) {
  const a = {};
  for (const { prop: n, kind: d } of e) {
    if (t[pe(n.name)] === !0) continue;
    const l = t[n.name] ?? n.default;
    if (!De(l))
      if (d === "number") {
        const o = Number(l);
        Number.isFinite(o) && (a[n.name] = o);
      } else if (d === "json" && typeof l == "string")
        try {
          a[n.name] = JSON.parse(l);
        } catch {
        }
      else a[n.name] = l;
  }
  return a;
}
function wr(e, t) {
  for (const { prop: a, kind: n, required: d } of e) {
    if (t[pe(a.name)] === !0) continue;
    const l = t[a.name] ?? a.default, o = a.title || a.name;
    if (d && De(l)) return `${o} is required`;
    if (n === "json" && typeof l == "string" && l)
      try {
        JSON.parse(l);
      } catch {
        return `${o} must be valid JSON`;
      }
    if (n === "number" && !De(l)) {
      const y = Number(l);
      if (!Number.isFinite(y)) return `${o} must be a number`;
      if (a.minValue !== void 0 && y < a.minValue) return `${o} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && y > a.maxValue) return `${o} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const kr = 12, ze = 240, Se = (e) => `${typeof e}:${e}`, Nr = (e) => e.map((t) => ({ value: t, label: String(t) }));
function Sr(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function Ar(e, t, a = ze) {
  return e >= a || e >= t ? "down" : "up";
}
const Cr = 40, Mr = 48;
function Ir(e, t) {
  return Math.min(ze, Math.max(1, e) * Cr + 8) + (t ? Mr : 0);
}
function $r(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const nt = "Auto (let model decide)", Ee = "__auto__";
function je({ id: e, label: t, options: a, value: n, onChange: d, allowAuto: l, auto: o, onAuto: y, combobox: m }) {
  const p = Et(), $ = e ?? `ms-dd-${p}`, x = m ?? a.length > kr, [b, _] = N(!1), [A, L] = N(""), [C, E] = N(0), [T, g] = N("down"), v = Q(null), I = Q(null), q = Q(null), w = a.find((c) => n !== void 0 && Se(c.value) === Se(n)), G = Y(() => x ? Sr(a, A) : a, [x, a, A]), D = Y(
    () => [...l ? [{ key: Ee, label: nt, value: Ee, isAuto: !0 }] : [], ...G.map((c) => ({ key: Se(c.value), label: c.label, hint: c.hint, value: c.value }))],
    [l, G]
  ), V = o ? Ee : w ? Se(w.value) : void 0, J = () => {
    _(!1), L("");
  }, F = (c) => {
    c.isAuto ? y == null || y() : d(c.value), J();
  };
  _t(() => {
    if (!b || !v.current) return;
    const c = v.current.getBoundingClientRect();
    let f = v.current.parentElement;
    for (; f && !/(auto|scroll)/.test(getComputedStyle(f).overflowY); ) f = f.parentElement;
    const k = f ? f.getBoundingClientRect() : null, B = Math.min(window.innerHeight, k ? k.bottom : window.innerHeight), u = Math.max(0, k ? k.top : 0);
    g(Ar(B - c.bottom, c.top - u, Ir(a.length + (l ? 1 : 0), x)));
  }, [b]), z(() => {
    if (!b) return;
    const c = D.findIndex((f) => f.key === V);
    E(c >= 0 ? c : 0);
  }, [b, A]), z(() => {
    var c, f, k;
    b && ((k = (f = (c = I.current) == null ? void 0 : c.querySelector(`[data-i="${C}"]`)) == null ? void 0 : f.scrollIntoView) == null || k.call(f, { block: "nearest" }));
  }, [C, b]), z(() => {
    var c;
    b && x && ((c = q.current) == null || c.focus());
  }, [b, x]), z(() => {
    if (!b) return;
    const c = (f) => {
      var k;
      (k = v.current) != null && k.contains(f.target) || J();
    };
    return document.addEventListener("mousedown", c), () => document.removeEventListener("mousedown", c);
  }, [b]);
  const h = (c) => {
    if (!b) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(c.key) && (c.preventDefault(), _(!0));
      return;
    }
    if (c.key === "Escape") {
      c.preventDefault(), c.stopPropagation(), J();
      return;
    }
    if (c.key === "Enter") {
      c.preventDefault(), D[C] && F(D[C]);
      return;
    }
    if (c.key === "Tab") {
      J();
      return;
    }
    if (c.key === " " && !x) {
      c.preventDefault(), D[C] && F(D[C]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(c.key) && (c.preventDefault(), E((f) => $r(f, c.key, D.length)));
  }, i = o ? nt : (w == null ? void 0 : w.label) ?? "Select…";
  return /* @__PURE__ */ s("div", { ref: v, className: "relative w-full", onKeyDown: h, children: [
    /* @__PURE__ */ s(
      "button",
      {
        id: $,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": b,
        "aria-label": `${t}: ${i}`,
        "aria-controls": `${$}-list`,
        onClick: () => _((c) => !c),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${b ? "border-primary" : "border-line hover:border-muted"} ${o ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: i }),
          /* @__PURE__ */ r(He, { up: b, width: 16, height: 16 })
        ]
      }
    ),
    b && /* @__PURE__ */ s("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${T === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      x && /* @__PURE__ */ r(
        "input",
        {
          ref: q,
          value: A,
          onChange: (c) => L(c.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${$}-list`,
          "aria-activedescendant": D[C] ? `${$}-o${C}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ s("ul", { id: `${$}-list`, ref: I, role: "listbox", "aria-label": t, style: { maxHeight: ze }, className: "overflow-y-auto", children: [
        D.map((c, f) => {
          const k = c.key === V;
          return /* @__PURE__ */ s(
            "li",
            {
              id: `${$}-o${f}`,
              "data-i": f,
              role: "option",
              "aria-selected": k,
              onMouseEnter: () => E(f),
              onClick: () => F(c),
              className: `flex cursor-pointer items-center justify-between gap-2 rounded-ctl px-3 py-2.5 text-sm ${k ? "bg-primary text-primary-ink" : f === C ? "bg-card-bg" : ""} ${c.isAuto && !k ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ s("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: c.label }),
                  c.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${k ? "opacity-70" : "text-muted"}`, children: c.hint })
                ] }),
                k && /* @__PURE__ */ r(ve, { width: 14, height: 14 })
              ]
            },
            c.key
          );
        }),
        D.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Tr = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Er({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Ie, {}) });
}
function _r({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: d }) {
  const [l, o] = N(a), [y, m] = N(""), [p, $] = N(1), [x, b] = N(null), [_, A] = N(null), [L, C] = N(!1), [E, T] = N([]), [g, v] = N(""), [I, q] = N(!1), w = Q(null), G = Q(null), D = te(async () => {
    C(!0), A(null);
    try {
      b(await e.mediaLibrary({ mediaType: l, search: y, page: p }));
    } catch (i) {
      A(i.message);
    } finally {
      C(!1);
    }
  }, [e, l, y, p]);
  z(() => {
    const i = setTimeout(D, y ? 300 : 0);
    return () => clearTimeout(i);
  }, [D, y]), z(() => {
    $(1);
  }, [l, y]), z(() => {
    var f;
    const i = document.activeElement;
    (f = w.current) == null || f.focus();
    const c = (k) => {
      if (k.key === "Escape") {
        k.stopPropagation(), d();
        return;
      }
      if (k.key !== "Tab" || !w.current) return;
      const B = [...w.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!B.length) return;
      const u = B[0], P = B[B.length - 1];
      k.shiftKey && document.activeElement === u ? (k.preventDefault(), P.focus()) : !k.shiftKey && document.activeElement === P && (k.preventDefault(), u.focus());
    };
    return document.addEventListener("keydown", c), () => {
      var k;
      document.removeEventListener("keydown", c), (k = i == null ? void 0 : i.focus) == null || k.call(i);
    };
  }, [d]);
  const V = (i) => T((c) => c.includes(i) ? c.filter((f) => f !== i) : t === 1 ? [i] : c.length < t ? [...c, i] : c), J = async (i) => {
    if (i.length) {
      C(!0), A(null);
      try {
        for (const c of i) {
          const f = await e.upload(c);
          await e.saveToLibrary({ url: f, name: c.name, mime_type: c.type || void 0, size_bytes: c.size, media_type: c.type.startsWith("video") ? "video" : c.type.startsWith("audio") ? "audio" : c.type.startsWith("image") ? "image" : "archive" });
        }
        await D();
      } catch (c) {
        A(c.message), C(!1);
      }
    }
  }, F = async () => {
    var c;
    const i = g.trim();
    if (!/^https?:\/\//i.test(i)) {
      A("Enter a full http(s) URL");
      return;
    }
    C(!0), A(null);
    try {
      const f = ((c = i.split("?")[0].split(".").pop()) == null ? void 0 : c.toLowerCase()) ?? "", k = ["mp4", "webm", "mov"].includes(f) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(f) ? "audio" : ["zip", "rar", "7z"].includes(f) ? "archive" : "image";
      await e.saveToLibrary({ url: i, name: i.split("/").pop() || "link", media_type: k }), v(""), q(!1), await D();
    } catch (f) {
      A(f.message), C(!1);
    }
  }, h = async (i) => {
    if (window.confirm(`Delete "${i.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(i.id), T((c) => c.filter((f) => f !== i.url)), await D();
      } catch (c) {
        A(c.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (i) => {
    i.target === i.currentTarget && d();
  }, children: /* @__PURE__ */ s("div", { ref: w, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ s("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Ie, {}) }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ s("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ s("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
            (x == null ? void 0 : x.total) ?? 0,
            " ",
            (x == null ? void 0 : x.total) === 1 ? "item" : "items"
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
      /* @__PURE__ */ r("input", { ref: G, type: "file", hidden: !0, multiple: !0, onChange: (i) => {
        const c = Array.from(i.target.files ?? []);
        i.target.value = "", J(c);
      } }),
      /* @__PURE__ */ s("button", { type: "button", onClick: () => {
        var i;
        return (i = G.current) == null ? void 0 : i.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ r(wt, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: d, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(be, {}) })
    ] }),
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Tr.map((i) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": l === i.id, onClick: () => o(i.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${l === i.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: i.label }, i.id)) }),
      /* @__PURE__ */ r("input", { value: y, onChange: (i) => m(i.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": I, onClick: () => q((i) => !i), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    I && /* @__PURE__ */ s("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: g, onChange: (i) => v(i.target.value), onKeyDown: (i) => i.key === "Enter" && void F(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void F(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ s("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      _ && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: _ }),
      L && !x ? /* @__PURE__ */ s("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(we, {}),
        " Loading…"
      ] }) : x != null && x.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: x.items.map((i) => {
        const c = E.includes(i.url);
        return /* @__PURE__ */ s("li", { className: `group relative overflow-hidden rounded-card border ${c ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": c, "aria-label": `${c ? "Deselect" : "Select"} ${i.name ?? "file"}`, onClick: () => V(i.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(Er, { a: i }) }),
          c && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r(ve, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${i.name ?? "file"}`, onClick: () => void h(i), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(be, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: i.name ?? "", children: i.name })
        ] }, i.id);
      }) }) : /* @__PURE__ */ s("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Ie, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      x && x.total_pages > 1 && /* @__PURE__ */ s("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: p <= 1, onClick: () => $((i) => i - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        p,
        " of ",
        x.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: p >= x.total_pages, onClick: () => $((i) => i + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ s("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ s("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: E.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !E.length, onClick: () => {
        n(E), d();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r(ve, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const kt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, Lr = (e, t = "") => {
  const a = kt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, Rr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function Or(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, d) => void e.saveToLibrary({ url: a[d], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: Rr(n) }).catch(() => {
  })), a;
}
function Pe({ client: e, field: t, multiple: a, max: n, current: d, onUrls: l, onError: o }) {
  const y = Q(null), [m, p] = N(!1), [$, x] = N(!1), [b, _] = N(!1), A = n - d.length, L = gt(), C = async (g) => {
    if (g.length) {
      p(!0);
      try {
        l(await Or(e, a ? g.slice(0, Math.max(A, 1)) : g.slice(0, 1)));
      } catch (v) {
        o(v.message);
      } finally {
        p(!1);
      }
    }
  }, E = kt(t.prop.field, t.prop.name), T = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ s(
    "div",
    {
      onDragOver: (g) => {
        g.preventDefault(), x(!0);
      },
      onDragLeave: () => x(!1),
      onDrop: (g) => {
        g.preventDefault(), x(!1), C(Array.from(g.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${$ ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: y, type: "file", hidden: !0, accept: E, multiple: a, onChange: (g) => {
          const v = Array.from(g.target.files ?? []);
          g.target.value = "", C(v);
        } }),
        (a ? A > 0 : !0) && /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ r(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: a ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: a ? void 0 : d[0] ?? "",
              defaultValue: void 0,
              onChange: a ? void 0 : (g) => l([g.target.value]),
              onKeyDown: a ? (g) => {
                g.key === "Enter" && g.currentTarget.value.trim() && (l([g.currentTarget.value.trim()]), g.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ r("button", { type: "button", disabled: m, onClick: () => {
            var g;
            return (g = y.current) == null ? void 0 : g.click();
          }, "aria-label": "Upload file", title: "Upload file", className: T, children: m ? /* @__PURE__ */ r(we, { width: 16, height: 16 }) : /* @__PURE__ */ r(wt, { width: 16, height: 16 }) }),
          L.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => _(!0), "aria-label": "Choose from media library", title: "Media library", className: T, children: /* @__PURE__ */ s("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        b && L.library && /* @__PURE__ */ r(_r, { client: e, max: a ? Math.max(A, 1) : 1, initialType: Lr(t.prop.field, t.prop.name), onInsert: l, onClose: () => _(!1) })
      ]
    }
  );
}
function Dr({ field: e, values: t, onChange: a, client: n, onError: d, tagCount: l = 0 }) {
  const { prop: o, kind: y, required: m } = e, p = t[o.name], $ = (g) => a(o.name, g), x = o.title || o.name, b = `ms-f-${o.name}`, _ = p == null ? "" : String(p), A = Array.isArray(p) ? p : [], L = t[pe(o.name)] === !0, C = Q(null), E = (g) => {
    const v = C.current, I = typeof p == "string" ? p : "", q = (v == null ? void 0 : v.selectionStart) ?? I.length, w = (v == null ? void 0 : v.selectionEnd) ?? q;
    $(I.slice(0, q) + g + " " + I.slice(w)), requestAnimationFrame(() => {
      v == null || v.focus(), v == null || v.setSelectionRange(q + g.length + 1, q + g.length + 1);
    });
  };
  let T;
  if (y === "textarea" || y === "json")
    T = /* @__PURE__ */ s(he, { children: [
      /* @__PURE__ */ r("textarea", { ref: C, id: b, rows: y === "json" ? 4 : 5, value: typeof p == "string" ? p : p ? JSON.stringify(p, null, 2) : "", onChange: (g) => $(g.target.value), className: `w-full resize-y p-3 text-sm ${y === "json" ? "font-mono text-xs" : ""}` }),
      o.name === "prompt" && l > 0 && /* @__PURE__ */ s("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(l, 9) }, (g, v) => `@image${v + 1}`).map((g) => /* @__PURE__ */ r("button", { type: "button", onClick: () => E(g), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: g }, g))
      ] })
    ] });
  else if (y === "select") {
    const g = o.enum ?? [];
    T = /* @__PURE__ */ r(
      je,
      {
        id: b,
        label: x,
        options: Nr(g),
        value: p,
        onChange: (v) => {
          $(v), a(pe(o.name), !1);
        },
        allowAuto: rt(e),
        auto: L,
        onAuto: () => a(pe(o.name), !0)
      }
    );
  } else if (y === "boolean") {
    const g = p === !0;
    T = /* @__PURE__ */ r(
      "button",
      {
        id: b,
        type: "button",
        role: "switch",
        "aria-checked": g,
        onClick: () => $(!g),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${g ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${g ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (y === "number") {
    const g = o.minValue !== void 0 && o.maxValue !== void 0;
    T = /* @__PURE__ */ s("div", { className: `flex items-center gap-3 ${L ? "opacity-40" : ""}`, children: [
      g && /* @__PURE__ */ r("input", { type: "range", disabled: L, "aria-label": `${x} slider`, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? 0.01 : 1), value: _ === "" ? o.minValue : Number(_), onChange: (v) => $(Number(v.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: b, type: "number", disabled: L, min: o.minValue, max: o.maxValue, step: o.step ?? (o.type === "number" ? "any" : 1), value: _, onChange: (v) => $(v.target.value === "" ? "" : Number(v.target.value)), className: `px-3 py-2 text-sm ${g ? "w-24" : "w-full"}` })
    ] });
  } else if (y === "media")
    T = /* @__PURE__ */ r(Pe, { client: n, field: e, multiple: !1, max: 1, current: _ ? [_] : [], onUrls: (g) => $(g[0]), onError: d });
  else if (y === "media-list") {
    const g = o.maxItems ?? 8;
    T = /* @__PURE__ */ s("div", { className: "space-y-2", children: [
      A.map((v, I) => /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${x} ${I + 1}`, value: v, onChange: (q) => $(A.map((w, G) => G === I ? q.target.value : w)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${x} ${I + 1}`, onClick: () => $(A.filter((q, w) => w !== I)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(be, { width: 14, height: 14 }) })
      ] }, I)),
      /* @__PURE__ */ r(Pe, { client: n, field: e, multiple: !0, max: g, current: A, onUrls: (v) => $([...A, ...v].slice(0, g)), onError: d })
    ] });
  } else
    T = /* @__PURE__ */ r("input", { id: b, value: _, onChange: (g) => $(g.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ s("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ s("label", { htmlFor: b, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        x,
        o.description && /* @__PURE__ */ r("span", { title: o.description, className: "text-muted", children: /* @__PURE__ */ r(lr, { width: 13, height: 13 }) })
      ] }),
      rt(e) && y === "number" ? /* @__PURE__ */ s("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: L, onChange: (g) => a(pe(o.name), g.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: y === "media-list" ? `${A.length}/${o.maxItems ?? 8} items${m ? " · required" : ""}` : m ? "* required" : "" })
    ] }),
    T
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
}, fe = "Other", jr = 3, Pr = 2, Ur = 20, qr = 2, Gr = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function Nt(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ae[t] ? Ae[t] : Ae[a] ? Ae[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? fe : Gr(a);
}
function Fr(e) {
  const t = /* @__PURE__ */ new Map();
  for (const d of e) {
    const l = Nt(d.name);
    t.set(l, (t.get(l) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [d, l] of t)
    d === fe || l < jr ? a += l : n.push({ id: d, label: d, count: l });
  return n.sort((d, l) => l.count - d.count || d.label.localeCompare(l.label)), a && n.push({ id: fe, label: fe, count: a }), n;
}
function St(e, t) {
  const a = Nt(e.name);
  return t.some((n) => n.id === a) ? a : fe;
}
function Vr(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function Br(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const ot = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function Hr(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const d = ot.indexOf(n);
    return d < 0 ? ot.length : d;
  };
  return [...t].map(([n, d]) => ({ id: n, count: d })).sort((n, d) => a(n.id) - a(d.id) || d.count - n.count || n.id.localeCompare(d.id));
}
const me = "__favourites__", ee = "__all__";
function zr(e, t, a) {
  return e.filter((n) => {
    var d;
    return t.category !== ee && n.category !== t.category ? !1 : t.provider === me ? !!((d = t.favourites) != null && d.includes(n.name)) : t.provider === ee || St(n, a) === t.provider;
  });
}
const Jr = (e, t) => t.filter((a) => a.id !== fe).length >= Pr && e.length >= Ur, Ce = 200;
function Kr({ model: e }) {
  const t = Fe(e);
  return t ? /* @__PURE__ */ s("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: oe(t.original) }),
    t.from && t.original !== null ? "from " : "",
    oe(t.current)
  ] }) : null;
}
const it = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, st = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function _e({ label: e, active: t, onClick: a, hue: n, children: d }) {
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
      children: d
    }
  );
}
function Wr({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: d, usage: l, showGroup: o, scope: y = "default" }) {
  var B;
  const [m, p] = N(!1), [$, x] = N(""), [b, _] = N("popular"), [A, L] = N(!1), C = Q(null), E = Y(() => Fr(e), [e]), T = Y(() => Hr(e), [e]), g = Jr(e, E), v = T.length >= qr, [I, q] = N(() => it(`muapi-studio:provider:${y}`, ee)), [w, G] = N(() => it(`muapi-studio:category:${y}`, ee)), D = g && (I === me || I === ee || E.some((u) => u.id === I)) ? I : ee, V = v && (w === ee || T.some((u) => u.id === w)) ? w : ee, J = (u) => {
    q(u), st(`muapi-studio:provider:${y}`, u);
  }, F = (u) => {
    G(u), st(`muapi-studio:category:${y}`, u);
  }, h = Q(null);
  z(() => {
    m || L(!1);
  }, [m]), z(() => {
    if (!m) return;
    const u = (O) => {
      var ae;
      (ae = C.current) != null && ae.contains(O.target) || p(!1);
    }, P = (O) => {
      O.key === "Escape" && p(!1);
    };
    return document.addEventListener("mousedown", u), document.addEventListener("keydown", P), () => {
      document.removeEventListener("mousedown", u), document.removeEventListener("keydown", P);
    };
  }, [m]);
  const i = Y(() => {
    const u = $.trim().toLowerCase(), P = zr(e, { category: V, provider: D, favourites: n }, E), O = u ? P.filter((ne) => ne.name.toLowerCase().includes(u) || ne.category.toLowerCase().includes(u)) : P, ae = bt(O, b, { usage: l, favorites: n });
    if (b === "favourites" || b === "most-used") return ae;
    const se = new Set(n);
    return [...ae.filter((ne) => se.has(ne.name)), ...ae.filter((ne) => !se.has(ne.name))];
  }, [e, $, b, n, l, V, D, E]), [c, f] = N(0);
  z(() => {
    var u, P;
    f(0), (P = (u = h.current) == null ? void 0 : u.scrollTo) == null || P.call(u, { top: 0 });
  }, [$, b, m, V, D]);
  const k = (u) => {
    u.key === "ArrowDown" ? (u.preventDefault(), f((P) => Math.min(P + 1, Math.min(i.length, Ce) - 1))) : u.key === "ArrowUp" ? (u.preventDefault(), f((P) => Math.max(P - 1, 0))) : u.key === "Enter" && i[c] && (u.preventDefault(), a(i[c].name), p(!1));
  };
  return z(() => {
    var u, P;
    (P = (u = document.getElementById(`ms-opt-${c}`)) == null ? void 0 : u.scrollIntoView) == null || P.call(u, { block: "nearest" });
  }, [c]), /* @__PURE__ */ s("div", { ref: C, className: "relative", children: [
    /* @__PURE__ */ s(
      "button",
      {
        type: "button",
        onClick: () => p((u) => !u),
        "aria-haspopup": "listbox",
        "aria-expanded": m,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (B = (t ?? "?")[0]) == null ? void 0 : B.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(He, { up: m, width: 16, height: 16 })
        ]
      }
    ),
    m && /* @__PURE__ */ s("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      g && /* @__PURE__ */ s("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(_e, { label: "All providers", active: D === ee, onClick: () => J(ee), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(_e, { label: "Favourites", active: D === me, onClick: () => J(me), children: /* @__PURE__ */ r(Ye, { width: 14, height: 14, filled: D === me }) }),
        E.map((u) => /* @__PURE__ */ r(_e, { label: `${u.label} (${u.count})`, active: D === u.id, onClick: () => J(u.id), hue: Br(u.label), children: Vr(u.label) }, u.id))
      ] }),
      /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ s("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ s("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(Be, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: k, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${c}`, value: $, onChange: (u) => x(u.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ s("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": A,
                onClick: () => L((u) => !u),
                className: `flex h-full items-center rounded-ctl border px-3 ${A ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(cr, { width: 16, height: 16 })
              }
            ),
            A && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: Bt.map((u) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ s(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": b === u.id,
                onClick: () => {
                  _(u.id), L(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${b === u.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  u.label,
                  b === u.id && /* @__PURE__ */ r(ve, { width: 14, height: 14 })
                ]
              }
            ) }, u.id)) })
          ] })
        ] }),
        v && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ee, label: "All" }, ...T.map((u) => ({ id: u.id, label: u.id }))].map((u) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": V === u.id,
            onClick: () => F(u.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${V === u.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: u.label
          },
          u.id
        )) }),
        g && /* @__PURE__ */ s("div", { className: "mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
          D === ee ? "All models" : D === me ? "Favourites" : D,
          " · ",
          i.length
        ] }),
        /* @__PURE__ */ s("ul", { id: "ms-listbox", ref: h, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          i.slice(0, Ce).map((u, P) => {
            const O = u.name === t;
            return /* @__PURE__ */ s(
              "li",
              {
                id: `ms-opt-${P}`,
                role: "option",
                "aria-selected": O,
                onClick: () => {
                  a(u.name), p(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${O ? "bg-primary-soft" : P === c ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: [
                  /* @__PURE__ */ s("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ r("div", { className: `truncate text-sm ${O ? "text-primary" : ""}`, children: u.name }),
                    /* @__PURE__ */ r("div", { className: "text-[10px] text-secondary", children: o ? `${u.group_of} · ${u.category}` : g && D === ee ? `${St(u, E)} · ${u.category}` : u.category })
                  ] }),
                  /* @__PURE__ */ r(
                    "button",
                    {
                      type: "button",
                      "aria-label": n.includes(u.name) ? "Remove favorite" : "Add favorite",
                      onClick: (ae) => {
                        ae.stopPropagation(), d(u.name);
                      },
                      className: n.includes(u.name) ? "text-primary" : "text-muted hover:text-fg",
                      children: /* @__PURE__ */ r(Ye, { width: 15, height: 15, filled: n.includes(u.name) })
                    }
                  ),
                  /* @__PURE__ */ r(Kr, { model: u })
                ]
              },
              u.name
            );
          }),
          i.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: b === "favourites" ? "No favourites yet. Tap the heart on a model." : b === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${$}”.` }),
          i.length > Ce && /* @__PURE__ */ s("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ce,
            " of ",
            i.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const lt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, Le = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, At = 0.25;
function Xr({ mode: e, models: t, client: a, batch: n, onRun: d, usage: l, reuse: o }) {
  const y = ge.find((S) => S.id === e), m = Y(() => Vt(t, e), [t, e]), [p, $] = N(), [x, b] = N(null), [_, A] = N(null), [L, C] = N({}), [E, T] = N(null), [g, v] = N(null), [I, q] = N(() => lt("muapi-studio:favorites", [])), [w, G] = N("form"), [D, V] = N(!1), [J, F] = N("{}"), [h, i] = N(null), c = Q(0), f = Q(null);
  z(() => {
    var K, re, ce;
    const S = lt(`muapi-studio:model:${e}`, null), U = ((K = m.find((ie) => ie.name === S)) == null ? void 0 : K.name) ?? ((re = m.find((ie) => ie.name === Gt[e])) == null ? void 0 : re.name) ?? ((ce = bt(m, "popular")[0]) == null ? void 0 : ce.name);
    $(U);
  }, [e, m]), z(() => {
    o && (f.current = o.inputs, m.some((S) => S.name === o.model) && ($(o.model), Le(`muapi-studio:model:${e}`, o.model)), G("form"));
  }, [o == null ? void 0 : o.nonce]);
  const k = m.find((S) => S.name === p);
  z(() => {
    if (!p) return;
    let S = !0;
    return b(null), A(null), T(null), v(null), i(null), a.model(p).then((U) => {
      if (!S) return;
      const K = tt(U), re = Te(K), ce = f.current;
      if (f.current = null, ce)
        for (const ie of K) ce[ie.prop.name] !== void 0 && (re[ie.prop.name] = ce[ie.prop.name]);
      b(U), C(re);
    }).catch((U) => {
      S && A(U.message);
    }), () => {
      S = !1;
    };
  }, [p, a]);
  const B = Y(() => x ? tt(x) : [], [x]), u = Y(() => at(B, L), [B, L]), P = Y(() => {
    try {
      const S = JSON.parse(J);
      return S && typeof S == "object" && !Array.isArray(S) ? S : null;
    } catch {
      return null;
    }
  }, [J]), O = w === "json" ? P ?? {} : u, ae = JSON.stringify(O);
  z(() => {
    if (!x || w === "json" && !P) return;
    const S = ++c.current, U = setTimeout(() => {
      a.estimate(x.name, O).then((K) => {
        S === c.current && T(K);
      }).catch(() => {
        S === c.current && T(null);
      });
    }, 500);
    return () => clearTimeout(U);
  }, [x, ae, a]);
  const se = (S) => {
    $(S), Le(`muapi-studio:model:${e}`, S);
  }, ne = (S) => q((U) => {
    const K = U.includes(S) ? U.filter((re) => re !== S) : [...U, S];
    return Le("muapi-studio:favorites", K), K;
  }), ke = (S) => {
    V(!1), S !== w && (S === "json" ? F(JSON.stringify(u, null, 2)) : P && C((U) => {
      const K = { ...U };
      for (const re of B) P[re.prop.name] !== void 0 && (K[re.prop.name] = P[re.prop.name]);
      return K;
    }), G(S), v(null));
  }, X = k ? Fe(k, E) : null, le = te(async () => {
    if (!x) return;
    i(null);
    const S = B.find((U) => U.prop.name === "prompt");
    await d({
      model: x.name,
      endpointUrl: x.endpoint_url,
      mode: e,
      payload: O,
      count: n,
      kind: Ge(x.category),
      prompt: S ? String(O.prompt ?? "") : "",
      unitCost: X == null ? void 0 : X.current
    });
  }, [x, B, d, e, O, n, X]), Ne = te(async () => {
    if (!x) return;
    if (w === "json") {
      if (!P) {
        v("The JSON is not valid");
        return;
      }
      const U = (x.required_fields ?? []).find((K) => P[K] === void 0 || P[K] === "");
      if (U) {
        v(`${U} is required`);
        return;
      }
    } else {
      const U = wr(B, L);
      if (U) {
        v(U);
        return;
      }
    }
    v(null);
    const S = ((X == null ? void 0 : X.current) ?? 0) * n;
    if (S > At) {
      i(S);
      return;
    }
    await le();
  }, [x, w, P, B, L, X, n, le]), j = !!x && !_, Z = (() => {
    var U;
    const S = B.find((K) => K.kind === "media-list");
    return S ? Math.max(((U = L[S.prop.name]) == null ? void 0 : U.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ s("section", { "aria-label": y.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ s("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: y.title }),
        /* @__PURE__ */ s("div", { className: "relative", children: [
          /* @__PURE__ */ s("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": D, onClick: () => V((S) => !S), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            w === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(He, { up: D, width: 12, height: 12 })
          ] }),
          D && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((S) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": w === S, type: "button", onClick: () => ke(S), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${w === S ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: S === "json" ? "JSON" : "Form" }) }, S)) })
        ] })
      ] }),
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(Wr, { models: m, value: p, onChange: se, favorites: I, onToggleFavorite: ne, usage: l, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: w === "json" ? "Request body" : "Parameters" }),
      (k == null ? void 0 : k.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: k.description }),
      !j && !_ && p && /* @__PURE__ */ s("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(we, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      _ && /* @__PURE__ */ s("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        _
      ] }),
      m.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      j && w === "json" && /* @__PURE__ */ s("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !P, spellCheck: !1, rows: 16, value: J, onChange: (S) => F(S.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${P ? "text-muted" : "text-danger"}`, children: P ? `Sent as the body of POST /api/v1/${x.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      j && w === "form" && B.map((S) => /* @__PURE__ */ r(
        Dr,
        {
          field: S,
          values: L,
          client: a,
          onError: v,
          tagCount: S.prop.name === "prompt" ? Z : 0,
          onChange: (U, K) => C((re) => ({ ...re, [U]: K }))
        },
        S.prop.name
      ))
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      g && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: g }),
      h !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: oe(h) }),
        " (",
        n,
        " × ",
        oe((X == null ? void 0 : X.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void le(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => i(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          x && (C(Te(B)), F(JSON.stringify(at(B, Te(B)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ s(
          "button",
          {
            type: "button",
            onClick: () => void Ne(),
            disabled: !j,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(Ve, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              X && /* @__PURE__ */ s("span", { className: "font-normal", children: [
                "(",
                X.original !== null ? /* @__PURE__ */ s(he, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: oe(X.original * n) }),
                  " "
                ] }) : null,
                oe(X.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Qr = {
  image: Ie,
  video: rr,
  audio: ar,
  avatar: nr,
  "3d": vt,
  "ai-tools": or,
  apps: mr,
  text: dr,
  more: ur
};
function Zr({ mode: e, onChange: t, layout: a = "rail" }) {
  return a === "tabs" ? /* @__PURE__ */ r("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: ge.map((n) => {
    const d = n.id === e;
    return /* @__PURE__ */ s(
      "button",
      {
        onClick: () => t(n.id),
        "aria-current": d ? "page" : void 0,
        className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${d ? "text-primary" : "text-secondary hover:text-fg"}`,
        children: [
          n.label,
          d && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
        ]
      },
      n.id
    );
  }) }) : /* @__PURE__ */ r("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: ge.map((n) => {
    const d = Qr[n.id], l = n.id === e;
    return /* @__PURE__ */ s(
      "button",
      {
        onClick: () => t(n.id),
        "aria-current": l ? "page" : void 0,
        className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${l ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
        children: [
          /* @__PURE__ */ r(d, {}),
          n.label
        ]
      },
      n.id
    );
  }) });
}
const $e = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], M = (e, t, a, n, d) => ({ id: e, label: t, hint: a, prompt: n, values: d }), Ue = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, H = (e, t, a, n, d, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: d, prompt: l, ...o }), R = (e, t, a, n, d, l, o = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: d, prompt: l, ...o }), Me = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${Ue(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${Ue(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], Yr = [Me[2], { ...Me[1], id: "vertical", label: "Vertical angle" }, Me[0]].map((e) => ({ ...e, id: e.id })), ea = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${Ue(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], ta = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], ra = "Keep the result tasteful and suitable for general audiences.", qe = [
  // ---- Professional
  H(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Me, presets: [
      M("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      M("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      M("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      M("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      M("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      M("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      M("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
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
    { presetLabel: "Shot type", presets: [
      M("wide", "Wide", void 0, "Use a wide establishing shot."),
      M("medium", "Medium", void 0, "Use a medium shot from the waist up."),
      M("close", "Close-up", void 0, "Use a close-up on the subject’s face or key detail."),
      M("xcu", "Extreme close-up", void 0, "Use an extreme close-up on a small detail."),
      M("ots", "Over-the-shoulder", void 0, "Use an over-the-shoulder shot."),
      M("low", "Low angle", void 0, "Shoot from a low angle looking up."),
      M("high", "High angle", void 0, "Shoot from a high angle looking down."),
      M("dutch", "Dutch angle", void 0, "Tilt the camera for a Dutch angle.")
    ] }
  ),
  H(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: Yr.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
  ),
  R(
    "behind-the-scenes",
    "Behind the Scenes",
    "🎞️",
    "professional",
    "Pull back from the photo to reveal the film set around it.",
    "Start on this photograph, then pull the camera back to reveal it is a film set with lighting rigs, cameras and crew working around the scene."
  ),
  R(
    "transitions",
    "Transitions",
    "🔄",
    "professional",
    "Animate a smooth cinematic transition out of the image.",
    "Create a smooth, professional cinematic transition starting from this image with fluid motion.",
    { presetLabel: "Transition", presets: [
      M("morph", "Morph", void 0, "Use a morph transition."),
      M("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      M("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      M("whip", "Whip pan", void 0, "Use a fast whip pan."),
      M("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
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
    { presetLabel: "Preset", sliders: ta, presets: [
      M("natural", "Natural", "Clean, true to life", void 0, { saturation: 5, contrast: 5 }),
      M("cinematic", "Cinematic", "Teal and orange", "Give it a cinematic teal and orange look.", { contrast: 20, saturation: 10, temperature: -5 }),
      M("split", "Split tone", "Warm highlights, cool shadows", "Use split toning with warm highlights and cool shadows.", { contrast: 10 }),
      M("softskin", "Soft skin", "Gentle and flattering", "Soften skin tones gently.", { contrast: -10, highlights: -10 }),
      M("oldlens", "Old lens", "Vintage glass", "Mimic a vintage lens with soft edges and subtle flare.", { saturation: -10, grain: 20 }),
      M("film16", "16mm film", "Grain and warmth", "Mimic 16mm film stock.", { temperature: 15, grain: 55, contrast: 10 }),
      M("moody", "Moody", "Dark and desaturated", "Make it dark and moody.", { exposure: -20, saturation: -25, contrast: 25 })
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
    { presetLabel: "Style", presets: [
      M("casual", "Casual", void 0, "Dress them in a relaxed casual outfit."),
      M("formal", "Formal", void 0, "Dress them in a sharp formal outfit."),
      M("street", "Streetwear", void 0, "Dress them in streetwear."),
      M("athletic", "Athletic", void 0, "Dress them in athletic wear."),
      M("evening", "Evening", void 0, "Dress them in an elegant evening outfit."),
      M("vintage", "Vintage", void 0, "Dress them in a vintage-style outfit.")
    ] }
  ),
  H(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: ea }
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
    { presetLabel: "Style", presets: [
      M("boho", "Boho chic", void 0, "Use a boho chic look."),
      M("minimal", "Minimalist", void 0, "Use a clean minimalist look."),
      M("punk", "Punk rock", void 0, "Use a punk rock look."),
      M("preppy", "Preppy", void 0, "Use a preppy look."),
      M("y2k", "Y2K", void 0, "Use an early-2000s Y2K look."),
      M("cottage", "Cottagecore", void 0, "Use a cottagecore look.")
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
  R(
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
    { consent: !0, presetLabel: "Style", presets: [
      M("corporate", "Corporate", void 0, "Use a classic corporate look."),
      M("creative", "Creative", void 0, "Use a modern creative look with a colored backdrop."),
      M("linkedin", "LinkedIn", void 0, "Frame it as a friendly LinkedIn profile photo."),
      M("exec", "Executive", void 0, "Use an authoritative executive look.")
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
  R("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  R("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  R("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  H("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
  R("bullet-time-scene", "Bullet Time Scene", "⏱️", "ads", "Frozen-moment bullet-time camera move.", "Create a bullet-time effect: time freezes while the camera sweeps around the subject and product in the image."),
  R("chameleon", "Chameleon", "🦎", "ads", "A character changes to match the product’s look.", "Show the character smoothly transforming their outfit and colors to match the brand look of the product in the image."),
  R("asmr-host", "ASMR Host", "🎙️", "ads", "A whispering host presents the product.", "Create an ASMR presentation where a soft-spoken host presents the product from the image up close."),
  R("packshot", "Packshot", "📦", "ads", "Polished product showcase with slow rotation.", "Create a clean studio packshot video of the product in the image, slowly rotating under soft studio lighting."),
  R("macro-scene", "Macro Scene", "🔬", "ads", "Extreme close-up of product details.", "Create an extreme macro close-up video that glides over the textures and details of the product in the image."),
  R("magic-button", "Magic Button", "✨", "ads", "The product appears in a burst of light.", "Show the product from the image appearing magically in a burst of light and drifting particles."),
  R("truck-ad", "Truck Ad", "🚛", "ads", "Product displayed on a truck driving through a city.", "Show the product from the image printed large on the side of a truck driving through a busy city street."),
  R("giant-product", "Giant Product", "🦖", "ads", "A building-sized product towering over a person.", "Create a surreal scene where the product from the image is as tall as a building, towering over a small person on the street."),
  R("bullet-time-white", "Bullet Time White", "⚪", "ads", "360° rotation on a clean white background.", "Create a bullet-time 360 degree rotation around the subject and product in the image on a clean white background."),
  R("kick-ad", "Kick Ad", "🦵", "ads", "A character kicks the product into frame.", "Create an energetic action ad where a character kicks the product from the image into the frame."),
  R("billboard-ad", "Billboard Ad", "🏙️", "ads", "Product on a glowing billboard at night.", "Show the product from the image on a huge glowing billboard in a busy city at night."),
  H("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  R("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  R("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  R("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  H("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  H(
    "game-dump",
    "Game Dump",
    "🎮",
    "games-characters",
    "See yourself as a hero in different game genres.",
    "Transform the person in this photo into a video game character with a game-style interface overlay, keeping their likeness.",
    { presetLabel: "Game genre", presets: [
      M("fps", "FPS shooter", void 0, "Use a first-person shooter look."),
      M("rpg", "RPG fantasy", void 0, "Use a fantasy role-playing game look."),
      M("racing", "Racing", void 0, "Use a racing game look."),
      M("fighting", "Fighting", void 0, "Use a fighting game look."),
      M("horror", "Survival horror", void 0, "Use a survival horror game look."),
      M("sports", "Sports", void 0, "Use a sports game look."),
      M("open", "Open world", void 0, "Use an open-world adventure game look."),
      M("platform", "Platformer", void 0, "Use a colorful platformer look.")
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
    { presetLabel: "Pixel style", presets: [M("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), M("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), M("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), M("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  H("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  R("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  R("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${ra}`),
  R("roller-coaster", "Roller Coaster", "🎢", "trending-templates", "A thrilling roller-coaster ride.", "Put the person from this photo on a roller coaster ride with wind, speed and a dramatic camera."),
  R("60s-cafe", "60s Cafe", "☕", "trending-templates", "A vintage 1960s cafe scene.", "Place the person from this photo in a vintage 1960s cafe with retro decor, warm film tones and gentle motion."),
  R("victory-card", "Victory Card", "🃏", "trending-templates", "A winning playing-card moment.", "Turn this photo into a winning playing card, with the person triumphant as the card flips and glows."),
  R("sand-worm", "Sand Worm", "🐛", "trending-templates", "An epic desert creature scene.", "Place the person from this photo in an epic desert scene with a giant sand creature rising behind them."),
  R("skibidi", "Toilet Meme", "🚽", "trending-templates", "A silly toilet-character meme look.", "Turn this photo into a goofy toilet-themed meme character with exaggerated head bobbing."),
  R("j-poster", "J Poster", "🎌", "trending-templates", "A Japanese-style poster.", "Turn this photo into a bold Japanese-style poster with dramatic typography and animated accents."),
  R("mascot", "Mascot", "🏈", "trending-templates", "A sports mascot character.", "Transform the person in this photo into an energetic sports mascot character cheering in a stadium."),
  R("storm-creature", "Storm Creature", "⛈️", "trending-templates", "An epic storm creature scene.", "Place the person from this photo in a stormy sky scene with a giant creature made of clouds and lightning."),
  R("burning-sunset", "Burning Sunset", "🌅", "trending-templates", "An epic burning-sunset scene.", "Place the person from this photo against an epic burning sunset sky with drifting embers."),
  R("on-fire", "On Fire", "🔥", "trending-templates", "A calm-in-chaos burning-room meme scene.", "Show the person from this photo calmly sitting in a room that is on fire, in a humorous cartoon-like meme style."),
  R("comic-book", "Comic Book", "💥", "trending-templates", "Comic-book panels and action lines.", "Turn this photo into an animated comic-book page with bold ink lines, halftone dots and action bursts."),
  R("cloud-surf", "Cloud Surf", "☁️", "trending-templates", "Surfing on dreamy pink clouds.", "Show the person from this photo surfing on a wave of dreamy pink clouds at sunset."),
  R("mukbang", "Mukbang", "🍜", "trending-templates", "A viral eating-show scene.", "Turn this photo into a viral eating-show video with the person enjoying a big spread of food at a table."),
  R("melting-doodle", "Melting Doodle", "🫠", "trending-templates", "Mesmerizing melting doodle art.", "Turn this photo into colorful doodle art that slowly melts and swirls."),
  R("giallo-horror", "Giallo Horror", "🩸", "trending-templates", "A stylised 1970s thriller scene.", "Turn this photo into a stylised 1970s Italian thriller scene with saturated colors, dramatic shadows and a suspenseful camera move. Keep it non-graphic."),
  R("renaissance", "Renaissance", "🖼️", "trending-templates", "A classical gallery painting.", "Turn this photo into a classical Renaissance oil painting hanging in a gallery, subtly coming to life."),
  R("rap-god", "Rap God", "🎤", "trending-templates", "A rap-video style clip.", "Turn this photo into a stylish rap music video clip with the person performing, with dynamic lighting and camera moves.")
], xe = (e) => qe.find((t) => t.slug === e), aa = (e) => !!e && $e.some((t) => t.id === e);
function na(e) {
  const t = new URLSearchParams(e), a = xe(t.get("app")) ? t.get("app") : null, n = t.get("category");
  return { category: aa(n) ? n : a ? xe(a).category : "all", app: a };
}
function oa(e, t) {
  const a = new URLSearchParams(e);
  return a.set("tab", "apps"), t.category === void 0 || t.category === "all" ? a.delete("category") : a.set("category", t.category), t.app ? a.set("app", t.app) : a.delete("app"), `?${a.toString()}`;
}
function ct(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb} ${n.badge}`.toLowerCase().includes(a)));
}
const dt = 5, ia = (e) => {
  let t = 0;
  for (const a of e) t = (t * 31 + a.charCodeAt(0)) % 360;
  return t;
};
function sa({ app: e }) {
  const t = ia(e.slug);
  return /* @__PURE__ */ r("div", { "aria-hidden": "true", className: "flex aspect-[4/3] md:aspect-[4/3] items-center justify-center text-4xl", style: { background: `linear-gradient(135deg, hsl(${t} 45% 22%), hsl(${(t + 50) % 360} 55% 12%))` }, children: e.emoji });
}
function ut({ app: e, onOpen: t }) {
  return /* @__PURE__ */ s("button", { type: "button", onClick: () => t(e.slug), className: "group flex flex-col overflow-hidden rounded-card border border-line bg-card-bg text-left hover:border-primary focus-visible:border-primary", children: [
    /* @__PURE__ */ s("div", { className: "relative", children: [
      /* @__PURE__ */ r(sa, { app: e }),
      /* @__PURE__ */ r("span", { className: "absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary", children: e.badge })
    ] }),
    /* @__PURE__ */ s("div", { className: "p-3", children: [
      /* @__PURE__ */ r("div", { className: "text-sm font-semibold", children: e.name }),
      /* @__PURE__ */ r("div", { className: "mt-0.5 line-clamp-2 text-xs text-secondary", children: e.blurb })
    ] })
  ] });
}
const mt = { gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" };
function la({ category: e, onCategory: t, onOpen: a }) {
  const [n, d] = N(""), l = n.trim() !== "", o = Y(() => ct(qe, { category: e, q: n }), [e, n]), y = (m) => `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${m ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ s("section", { "aria-label": "Apps", className: "min-h-0 min-w-0 flex-1 overflow-y-auto bg-app-bg p-4 md:p-8", children: [
    /* @__PURE__ */ r("h2", { className: "text-center text-xl font-bold tracking-wide md:text-2xl", children: "One-click AI tools for creators and marketers" }),
    /* @__PURE__ */ r("p", { className: "mx-auto mt-2 max-w-xl text-center text-sm text-secondary", children: "Pick an app, add your media, and get a finished result. Each app runs on a model from the catalog." }),
    /* @__PURE__ */ s("label", { className: "relative mx-auto mt-5 block max-w-md", children: [
      /* @__PURE__ */ r(Be, { width: 16, height: 16, style: { position: "absolute", left: 14, top: 12, color: "var(--ms-muted)" } }),
      /* @__PURE__ */ r("input", { value: n, onChange: (m) => d(m.target.value), placeholder: "Search apps…", "aria-label": "Search apps", className: "w-full rounded-full py-2.5 pl-10 pr-4 text-sm" })
    ] }),
    /* @__PURE__ */ s("div", { role: "tablist", "aria-label": "App categories", className: "mt-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:justify-center", children: [
      /* @__PURE__ */ r("button", { role: "tab", "aria-selected": e === "all", onClick: () => t("all"), className: y(e === "all"), children: "All" }),
      $e.map((m) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": e === m.id, onClick: () => t(m.id), className: y(e === m.id), children: m.label }, m.id))
    ] }),
    /* @__PURE__ */ r("div", { className: "mx-auto mt-6 max-w-6xl", children: e !== "all" || l ? o.length ? /* @__PURE__ */ r("div", { className: "grid gap-3", style: mt, children: o.map((m) => /* @__PURE__ */ r(ut, { app: m, onOpen: a }, m.slug)) }) : /* @__PURE__ */ s("p", { className: "py-16 text-center text-sm text-secondary", children: [
      "No apps match “",
      n,
      "”."
    ] }) : $e.map((m) => {
      const p = ct(qe, { category: m.id });
      return p.length ? /* @__PURE__ */ s("div", { className: "mb-8", "aria-label": m.label, role: "group", children: [
        /* @__PURE__ */ s("div", { className: "mb-3 flex items-end justify-between gap-3", children: [
          /* @__PURE__ */ s("div", { children: [
            /* @__PURE__ */ r("h3", { className: "text-base font-semibold", children: m.label }),
            /* @__PURE__ */ r("p", { className: "text-xs text-secondary", children: m.blurb })
          ] }),
          p.length > dt && /* @__PURE__ */ s("button", { type: "button", onClick: () => t(m.id), className: "shrink-0 text-xs font-semibold text-primary hover:underline", children: [
            "See all (",
            p.length,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "grid gap-3", style: mt, children: p.slice(0, dt).map(($) => /* @__PURE__ */ r(ut, { app: $, onOpen: a }, $.slug)) })
      ] }, m.id) : null;
    }) })
  ] });
}
const ca = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], da = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], ua = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], ma = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), pa = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], ha = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), fa = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], ga = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], ba = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], ya = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], xa = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), va = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], wa = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), ka = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Ct = {
  seedream: { aspect: ca, resolution: da },
  seedance: { aspect: ua, duration: ma },
  minimax: { resolution: pa, duration: ha },
  wan: { aspect: fa, resolution: ga, quality: ba, duration: ya },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, Na = {
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
function Sa(e) {
  return Na[e.template];
}
function pt(e) {
  var n, d, l, o, y, m, p, $, x, b, _;
  const t = Ct[e.template], a = {};
  for (const A of e.sliders ?? []) a[A.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (l = (d = t.aspect) == null ? void 0 : d[0]) == null ? void 0 : l.value,
    resolution: (y = (o = t.resolution) == null ? void 0 : o[0]) == null ? void 0 : y.value,
    duration: ((p = (m = t.duration) == null ? void 0 : m.find((A) => A.value === 5)) == null ? void 0 : p.value) ?? ((x = ($ = t.duration) == null ? void 0 : $[0]) == null ? void 0 : x.value),
    quality: (_ = (b = t.quality) == null ? void 0 : b[0]) == null ? void 0 : _.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function It(e, t) {
  var d;
  const a = [e.prompt], n = (d = e.presets) == null ? void 0 : d.find((l) => l.id === t.preset);
  n != null && n.prompt && a.push(n.prompt);
  for (const l of e.sliders ?? []) {
    const o = t.sliders[l.id] ?? 0;
    if (o !== 0) {
      const y = l.phrase(o);
      y && a.push(y);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function ht(e, t, a) {
  var l;
  const n = (l = e.presets) == null ? void 0 : l.find((o) => o.id === a), d = { ...Object.fromEntries((e.sliders ?? []).map((o) => [o.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: d };
}
function Aa(e, t) {
  for (const a of Mt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function Ca(e, t) {
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
function Ma(e) {
  return e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const Ia = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), ye = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function $a({ app: e, models: t, client: a, batch: n, onBack: d, onRun: l }) {
  var J, F;
  const [o, y] = N(() => pt(e)), [m, p] = N(null), [$, x] = N(null), [b, _] = N(null), A = Q(0);
  z(() => {
    y(pt(e)), p(null), x(null), _(null);
  }, [e]);
  const L = Sa(e), C = t.find((h) => h.name === L), E = Ct[e.template], T = Y(() => Ca(e, o), [e, o]), g = JSON.stringify(T), v = (h) => y((i) => ({ ...i, ...h }));
  z(() => {
    if (!C) return;
    const h = ++A.current, i = setTimeout(() => {
      a.estimate(L, T).then((c) => {
        h === A.current && x(c);
      }).catch(() => {
        h === A.current && x(null);
      });
    }, 500);
    return () => clearTimeout(i);
  }, [g, C, a]);
  const I = C ? Fe(C, $) : null, q = ((J = $e.find((h) => h.id === e.category)) == null ? void 0 : J.label) ?? "", w = Mt(e), G = async () => {
    C && (_(null), await l({ model: L, endpointUrl: C.endpoint_url, mode: "apps", prompt: It(e, o) || e.name, payload: T, count: n, kind: Ge(C.category), unitCost: I == null ? void 0 : I.current }));
  }, D = async () => {
    const h = Aa(e, o);
    if (h) {
      p(h);
      return;
    }
    p(null);
    const i = ((I == null ? void 0 : I.current) ?? 0) * n;
    if (i > At) {
      _(i);
      return;
    }
    await G();
  }, V = (h, i, c, f) => i && i.length > 0 ? /* @__PURE__ */ s("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: ye, children: h }),
    /* @__PURE__ */ r(je, { label: h, options: Ia(i), value: c, onChange: f })
  ] }) : null;
  return /* @__PURE__ */ s("section", { "aria-label": e.name, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ s("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ s("button", { type: "button", onClick: d, className: "mb-4 flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary", children: [
        /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-base leading-none", children: "‹" }),
        " All Apps"
      ] }),
      /* @__PURE__ */ s("div", { className: "mb-3 flex items-center gap-3", children: [
        /* @__PURE__ */ r("div", { "aria-hidden": "true", className: "flex h-11 w-11 items-center justify-center rounded-ctl border border-line bg-card-bg text-2xl", children: e.emoji }),
        /* @__PURE__ */ s("div", { className: "min-w-0", children: [
          /* @__PURE__ */ r("h2", { className: "truncate text-lg font-semibold", children: e.name }),
          /* @__PURE__ */ s("p", { className: "text-[11px] uppercase tracking-wider text-secondary", children: [
            q,
            " · ",
            e.badge
          ] })
        ] })
      ] }),
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !C && /* @__PURE__ */ s("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        L,
        "”, which is not in your catalog right now."
      ] }),
      w.map((h) => /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: ye, children: [
          /* @__PURE__ */ r("span", { children: h.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: h.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          Pe,
          {
            client: a,
            multiple: !1,
            max: 1,
            current: o.uploads[h.id] ? [o.uploads[h.id]] : [],
            field: { prop: { name: `${h.kind}_${h.id}`, title: h.label, field: h.kind }, kind: "media", required: !h.optional },
            onUrls: (i) => v({ uploads: { ...o.uploads, [h.id]: i[0] ?? "" } }),
            onError: p
          }
        )
      ] }, h.id)),
      e.presets && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: ye, children: e.presetLabel ?? "Preset" }),
        /* @__PURE__ */ r(je, { label: e.presetLabel ?? "Preset", options: [{ value: "", label: "Custom" }, ...e.presets.map((h) => ({ value: h.id, label: h.label, hint: h.hint }))], value: o.preset, onChange: (h) => y(ht(e, o, String(h))) })
      ] }),
      (F = e.sliders) == null ? void 0 : F.map((h) => /* @__PURE__ */ s("div", { className: "mb-4", children: [
        /* @__PURE__ */ s("div", { className: ye, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${h.id}`, children: h.label }),
          /* @__PURE__ */ s("span", { className: "tabular-nums text-primary", children: [
            o.sliders[h.id] ?? 0,
            h.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${h.id}`, type: "range", min: h.min, max: h.max, step: h.step, value: o.sliders[h.id] ?? 0, className: "w-full", onChange: (i) => v({ sliders: { ...o.sliders, [h.id]: Number(i.target.value) } }) })
      ] }, h.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => y(ht(e, o, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ s("div", { className: "mb-5", children: [
        /* @__PURE__ */ s("div", { className: ye, children: [
          "Extra instructions ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "optional" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Extra instructions", rows: 3, value: o.refinement, onChange: (h) => v({ refinement: h.target.value }), placeholder: "Anything to add or change…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      V("Aspect Ratio", E.aspect, o.aspect, (h) => v({ aspect: h })),
      V("Resolution", E.resolution, o.resolution, (h) => v({ resolution: h })),
      V("Quality", E.quality, o.quality, (h) => v({ quality: String(h) })),
      V("Duration", E.duration, o.duration, (h) => v({ duration: Number(h) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && V("Target face", xa, o.targetIndex, (h) => v({ targetIndex: Number(h) })),
      e.template === "video-face-swap" && V("Faces to swap", va, o.gender, (h) => v({ gender: String(h) })),
      e.template === "bg-remover" && /* @__PURE__ */ s(he, { children: [
        V("Background", wa, o.background, (h) => v({ background: String(h) })),
        V("Output format", ka, o.container, (h) => v({ container: String(h) })),
        /* @__PURE__ */ s("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Keep audio" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Keep audio", "aria-checked": o.keepAudio, onClick: () => v({ keepAudio: !o.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${o.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${o.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ s("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      m && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: m }),
      b !== null && /* @__PURE__ */ s("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: oe(b) }),
        " (",
        n,
        " × ",
        oe((I == null ? void 0 : I.current) ?? 0),
        ").",
        /* @__PURE__ */ s("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void G(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => _(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ s("button", { type: "button", disabled: !C, onClick: () => void D(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(Ve, { width: 16, height: 16, className: "shrink-0" }),
        Ma(e),
        n > 1 ? ` ×${n}` : "",
        I && I.current > 0 && /* @__PURE__ */ s("span", { className: "font-normal", children: [
          "(",
          oe(I.current * n),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function Ta() {
  try {
    const e = new URLSearchParams(window.location.search).get("tab");
    return Ft(e) ? e : null;
  } catch {
    return null;
  }
}
function La({ apiBase: e = "/api/muapi", initialTab: t = "image", showHeader: a = !0, title: n = "Studio", teamId: d, theme: l = "lime", layout: o, apiKey: y, onRequestApiKey: m, getHeaders: p, connected: $, fetchImpl: x, features: b, className: _ = "", onTabChange: A }) {
  const L = $ === !1 || y === "" || y === null, C = Q(p);
  C.current = p;
  const E = Y(() => new Rt(e, d, { apiKey: y || void 0, getHeaders: () => {
    var j;
    return ((j = C.current) == null ? void 0 : j.call(C)) ?? {};
  }, fetchImpl: x }), [e, d, y, x]), [T, g] = N({ library: !0, deleteMedia: !0 }), v = Y(() => ({ library: T.library && (b == null ? void 0 : b.library) !== !1, deleteMedia: (b == null ? void 0 : b.deleteMedia) !== !1 }), [T, b == null ? void 0 : b.library, b == null ? void 0 : b.deleteMedia]), I = o ?? qt(l), [q, w] = N(() => Ta() ?? t), [G, D] = N(() => {
    try {
      return na(window.location.search);
    } catch {
      return { category: "all", app: null };
    }
  }), [V, J] = N(4), [F, h] = N(null), [i, c] = N(null), [f, k] = N(null), B = te(() => {
    E.balance().then(k).catch(() => k(null));
  }, [E]), [u, P] = N(null), O = Yt(E, F, B), ae = Y(() => Wt(O.items), [O.items]);
  z(() => {
    L || (c(null), h(null), E.models().then(h).catch((j) => c(j.message)), B(), (b == null ? void 0 : b.library) !== !1 && E.probe().then(g));
  }, [E, B, L, b == null ? void 0 : b.library]);
  const se = (j) => {
    w(j), A == null || A(j);
    try {
      const Z = new URL(window.location.href);
      Z.searchParams.set("tab", j), j !== "apps" && (Z.searchParams.delete("category"), Z.searchParams.delete("app")), window.history.replaceState(null, "", Z);
    } catch {
    }
  }, ne = (j) => {
    D(j);
    try {
      window.history.replaceState(null, "", oa(window.location.search, j));
    } catch {
    }
  }, ke = te(async (j) => {
    await O.run(j);
  }, [O.run]), X = te((j) => {
    var S;
    const Z = F == null ? void 0 : F.find((U) => U.name === j);
    return Z ? ((S = Z.sale) == null ? void 0 : S.from) ?? Z.cost ?? void 0 : void 0;
  }, [F]), le = te((j) => {
    w(j.mode), P({ model: j.model, inputs: j.inputs, nonce: Date.now() });
  }, []), Ne = te((j) => {
    var U;
    const Z = F == null ? void 0 : F.find((K) => K.name === j.model);
    if (!Z) return;
    const S = ((U = Z.sale) == null ? void 0 : U.from) ?? Z.cost ?? 0;
    S > 0.25 && !window.confirm(`Re-run ${j.model} for about $${S.toFixed(2)}?`) || O.run({ model: j.model, endpointUrl: Z.endpoint_url, mode: j.mode, prompt: j.prompt, payload: j.inputs, count: 1, unitCost: S, kind: Ge(Z.category) });
  }, [F, O.run]);
  return /* @__PURE__ */ s("div", { className: `ms-root ${_}`.trim(), style: Ut(l), "data-layout": I, children: [
    a && /* @__PURE__ */ s("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: n }),
      f && /* @__PURE__ */ s("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: oe(f.balance) })
      ] })
    ] }),
    L ? /* @__PURE__ */ s("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays in your own account." }),
      m && /* @__PURE__ */ r("button", { type: "button", onClick: m, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ r(ft.Provider, { value: v, children: /* @__PURE__ */ s("div", { className: `flex min-h-0 flex-1 flex-col ${I === "rail" ? "md:flex-row" : ""}`, children: [
      /* @__PURE__ */ r(Zr, { mode: q, onChange: se, layout: I }),
      /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: i ? /* @__PURE__ */ s("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
        "Could not load models: ",
        i
      ] }) : F ? q === "apps" ? /* @__PURE__ */ r(he, { children: G.app && xe(G.app) ? /* @__PURE__ */ s(he, { children: [
        /* @__PURE__ */ r($a, { app: xe(G.app), models: F, client: E, batch: V, onBack: () => ne({ category: G.category, app: null }), onRun: ke }),
        /* @__PURE__ */ r(et, { mode: "apps", items: O.items, batch: V, onBatch: J, onLabel: O.setLabel, onRemove: O.remove, onReuse: le, onRerun: Ne, onDeleteMedia: O.deleteMedia, onLoadMore: O.loadMore, hasMore: O.hasMore, loadingMore: O.loadingMore, serverError: O.serverError, estimateFor: X })
      ] }) : /* @__PURE__ */ r(la, { category: G.category, onCategory: (j) => ne({ category: j, app: null }), onOpen: (j) => ne({ category: xe(j).category, app: j }) }) }) : /* @__PURE__ */ s(he, { children: [
        /* @__PURE__ */ r(Xr, { mode: q, models: F, client: E, batch: V, onRun: ke, usage: ae, reuse: u }),
        /* @__PURE__ */ r(et, { mode: q, items: O.items, batch: V, onBatch: J, onLabel: O.setLabel, onRemove: O.remove, onReuse: le, onRerun: Ne, onDeleteMedia: O.deleteMedia, onLoadMore: O.loadMore, hasMore: O.hasMore, loadingMore: O.loadingMore, serverError: O.serverError, estimateFor: X })
      ] }) : /* @__PURE__ */ s("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
        /* @__PURE__ */ r(we, {}),
        " Loading studio…"
      ] }) })
    ] }) })
  ] });
}
export {
  ue as ApiError,
  Rt as MuapiClient,
  La as MuapiStudio,
  jt as THEMES,
  Dt as cyanTheme,
  qt as defaultLayout,
  Ge as generationKind,
  Re as limeTheme,
  Ot as pollUntilDone,
  Pt as resolveTheme,
  Ut as themeStyle
};
