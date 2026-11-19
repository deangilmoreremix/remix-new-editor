import { jsx as t, jsxs as c, Fragment as ve } from "react/jsx-runtime";
import { createContext as Je, useContext as Ge, useState as k, useRef as G, useEffect as U, useCallback as F, useMemo as X } from "react";
class oe extends Error {
  constructor(r, n) {
    super(r), this.status = n;
  }
}
function He(e, r) {
  var a;
  const n = e == null ? void 0 : e.detail;
  return ((a = n == null ? void 0 : n.error) == null ? void 0 : a.message) || (typeof n == "string" ? n : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || r;
}
class Be {
  constructor(r = "/api/muapi", n, a = {}) {
    this.base = r, this.teamId = n, this.opts = a;
  }
  async request(r, n = {}) {
    const a = new Headers(n.headers);
    if (this.opts.apiKey && a.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [x, w] of Object.entries(await this.opts.getHeaders())) a.set(x, w);
    const d = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(r), { ...n, headers: a }), s = await d.text();
    let l = null;
    try {
      l = s ? JSON.parse(s) : null;
    } catch {
    }
    if (!d.ok) throw new oe(He(l, `${d.status} ${d.statusText}`), d.status);
    return l;
  }
  withTeam(r) {
    return this.teamId ? r + (r.includes("?") ? "&" : "?") + "team_id=" + encodeURIComponent(this.teamId) : r;
  }
  models() {
    return this.catalog ?? (this.catalog = this.request("/api/v1/models").then((r) => r.models).catch((r) => {
      throw this.catalog = void 0, r;
    })), this.catalog;
  }
  model(r) {
    return this.request(`/api/v1/models/${encodeURIComponent(r)}`);
  }
  estimate(r, n) {
    return this.request(`/api/v1/models/${encodeURIComponent(r)}/estimate-cost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(n)
    });
  }
  /** Submit with the model's `endpoint_url` (the catalog's `endpoint` field can be wrong). */
  async submit(r, n, a) {
    var l;
    const d = await this.request(`/api/v1/${r}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...a ? { "x-ms-kind": a } : {} },
      body: JSON.stringify(n)
    }), s = d.request_id || d.id;
    if (!s) throw new oe("The API did not return a request id", 502);
    return { requestId: s, cost: (l = d.cost) == null ? void 0 : l.amount_usd };
  }
  async poll(r) {
    var l;
    const n = await this.request(`/api/v1/predictions/${encodeURIComponent(r)}/result`), a = String(n.status || "").toLowerCase(), d = ["completed", "succeeded"].includes(a) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(a) ? "failed" : a === "pending" ? "pending" : "processing", s = Array.isArray(n.outputs) ? n.outputs : n.url ? [n.url] : [];
    return { status: d, outputs: s, error: n.error || void 0, cost: (l = n.cost) == null ? void 0 : l.amount_usd };
  }
  /** muapi's server-side generation history (works with an API key), newest first. */
  history(r, n = 30) {
    const a = new URLSearchParams({ limit: String(n) });
    return r && a.set("cursor", r), this.request(`/api/v1/history?${a}`);
  }
  mediaLibrary(r = {}) {
    const n = new URLSearchParams({ page: String(r.page ?? 1), page_size: String(r.pageSize ?? 24) });
    return r.mediaType && r.mediaType !== "all" && n.set("media_type", r.mediaType), r.search && n.set("search", r.search), this.request(`/app/media-library?${n}`);
  }
  saveToLibrary(r) {
    return this.request("/app/media-library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) });
  }
  deleteFromLibrary(r) {
    return this.request(`/app/media-library/${r}`, { method: "DELETE" });
  }
  /** Removes the generated files on muapi's side (the history row is kept unless deleteRecord is true). */
  deleteMedia(r, n = !1) {
    return this.request(`/api/v1/predictions/${encodeURIComponent(r)}/media${n ? "?delete_record=true" : ""}`, { method: "DELETE" });
  }
  /** Which optional features the host's proxy supports. A 403/404/405 means the route is not forwarded, so the UI hides it. */
  async probe() {
    const r = (a) => a instanceof oe && [403, 404, 405].includes(a.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((a) => !r(a)) };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(r) {
    var s;
    const n = new FormData();
    n.append("file", r);
    const a = await this.request("/api/v1/upload_file", { method: "POST", body: n }), d = a.url || a.file_url || ((s = a.data) == null ? void 0 : s.url);
    if (!d) throw new oe("Upload returned no URL", 502);
    return d;
  }
}
async function Ke(e, r, n = {}) {
  const { intervalMs: a = 2e3, timeoutMs: d = 15 * 60 * 1e3, signal: s, onUpdate: l } = n, x = Date.now();
  let w = 0;
  for (; Date.now() - x < d; ) {
    if (s != null && s.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const p = await e.poll(r);
      if (w = 0, l == null || l(p), p.status === "completed" || p.status === "failed") return p;
    } catch (p) {
      if (++w >= 5) throw p;
    }
    await new Promise((p) => setTimeout(p, a));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const je = Je({ library: !0 }), We = () => Ge(je), be = {
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
}, Xe = {
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
}, Qe = { lime: be, cyan: Xe }, we = {
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
function Ye(e = "lime") {
  return typeof e == "string" ? Qe[e] ?? be : { ...be, ...e };
}
function Ze(e = "lime") {
  const r = Ye(e), n = {};
  for (const a of Object.keys(we)) n[we[a]] = r[a];
  return n;
}
function et(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const ne = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], tt = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Te(e) {
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
const rt = (e) => !!e && ne.some((r) => r.id === e);
function nt(e, r) {
  const n = ne.find((a) => a.id === r).groups;
  return e.filter((a) => n.includes(a.group_of) && a.is_enabled && !a.is_coming_soon);
}
const at = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function _e(e, r, n = {}) {
  const a = (s) => {
    var l;
    return ((l = s.sale) == null ? void 0 : l.from) ?? s.cost ?? 1 / 0;
  }, d = [...e];
  return r === "a-z" ? d.sort((s, l) => s.name.localeCompare(l.name)) : r === "price-asc" ? d.sort((s, l) => a(s) - a(l)) : r === "price-desc" ? d.sort((s, l) => a(l) - a(s)) : r === "most-used" ? d.filter((s) => {
    var l;
    return (((l = n.usage) == null ? void 0 : l[s.name]) ?? 0) > 0;
  }).sort((s, l) => (n.usage[l.name] ?? 0) - (n.usage[s.name] ?? 0)) : r === "favourites" ? d.filter((s) => {
    var l;
    return (l = n.favorites) == null ? void 0 : l.includes(s.name);
  }) : d.sort((s, l) => +!!l.sale - +!!s.sale);
}
const ot = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function it(e, r) {
  var a, d;
  const n = (a = r.find((s) => s.name === e)) == null ? void 0 : a.group_of;
  return ((d = ne.find((s) => n && s.groups.includes(n))) == null ? void 0 : d.id) ?? "ai-tools";
}
function st(e, r, n = {}) {
  var s;
  const a = e.output ?? {}, d = a.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: it(e.model, r),
    prompt: typeof d.prompt == "string" ? d.prompt : "",
    inputs: d,
    status: ot[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(a.outputs) ? a.outputs : [],
    error: a.error || void 0,
    cost: (s = a.cost) == null ? void 0 : s.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: n[e.request_id] ?? null,
    source: "server"
  };
}
function lt(e, r, n = /* @__PURE__ */ new Set()) {
  const a = new Set(e.map((s) => s.requestId).filter(Boolean));
  return [...e, ...r.filter((s) => !s.requestId || !a.has(s.requestId))].filter((s) => !(s.requestId && n.has(s.requestId))).sort((s, l) => l.createdAt - s.createdAt);
}
function ct(e) {
  const r = {};
  for (const n of e) r[n.model] = (r[n.model] ?? 0) + 1;
  return r;
}
function Q(e) {
  var a;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let r = e.toFixed(4).replace(/0+$/, "");
  return (((a = r.split(".")[1]) == null ? void 0 : a.length) ?? 0) < 2 && (r = e.toFixed(2)), "$" + r;
}
function qe(e, r) {
  var n;
  return r && Number.isFinite(r.cost) ? { current: r.cost, original: r.original_cost && r.original_cost > r.cost ? r.original_cost : null, from: !1 } : ((n = e.sale) == null ? void 0 : n.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Ee = "muapi-studio:history:v1", dt = 200;
function Ne() {
  try {
    const e = localStorage.getItem(Ee);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function ut(e) {
  try {
    localStorage.setItem(Ee, JSON.stringify(e.slice(0, dt)));
  } catch {
  }
}
const mt = () => {
  var e, r;
  return ((r = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : r.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, ke = (e, r) => {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : r;
  } catch {
    return r;
  }
}, Ce = (e, r) => {
  try {
    localStorage.setItem(e, JSON.stringify(r));
  } catch {
  }
}, Se = "muapi-studio:labels:v1", Ie = "muapi-studio:hidden:v1";
function pt(e, r, n) {
  const [a, d] = k(() => Ne()), [s, l] = k([]), [x, w] = k(null), [p, $] = k(!1), [h, T] = k(null), I = G(!1), [g, S] = k(() => ke(Se, {})), [C, R] = k(() => ke(Ie, [])), M = G(/* @__PURE__ */ new Set()), i = G(new AbortController()), u = G([]);
  u.current = r ?? [], U(() => ut(a), [a]), U(() => Ce(Se, g), [g]), U(() => Ce(Ie, C), [C]), U(() => (i.current = new AbortController(), () => i.current.abort()), []);
  const v = F((o, m) => d((N) => N.map((b) => b.id === o ? { ...b, ...m } : b)), []), A = F(async (o, m) => {
    if (!M.current.has(o)) {
      M.current.add(o);
      try {
        const N = await Ke(e, m, {
          signal: i.current.signal,
          onUpdate: (b) => v(o, { status: b.status, outputs: b.outputs, error: b.error, cost: b.cost })
        });
        v(o, { status: N.status, outputs: N.outputs, error: N.error, cost: N.cost }), n == null || n();
      } catch (N) {
        N.name !== "AbortError" && v(o, { status: "failed", error: N.message });
      } finally {
        M.current.delete(o);
      }
    }
  }, [e, v, n]);
  U(() => {
    for (const o of Ne()) (o.status === "pending" || o.status === "processing") && o.requestId && A(o.id, o.requestId);
  }, []);
  const f = F(async (o = !1) => {
    if (!I.current) {
      $(!0), T(null);
      try {
        const m = await e.history(o ? void 0 : x ?? void 0), N = m.items.map((b) => st(b, u.current));
        l((b) => o ? N : [...b, ...N]), w(m.next_cursor);
      } catch (m) {
        m instanceof oe && [403, 404, 405].includes(m.status) ? (I.current = !0, w(null)) : T(m.message);
      } finally {
        $(!1);
      }
    }
  }, [e, x]), L = G(!1);
  U(() => {
    r && !L.current && (L.current = !0, f(!0));
  }, [r, f]);
  const z = F((o) => {
    const m = Array.from({ length: o.count }, () => ({
      id: mt(),
      model: o.model,
      mode: o.mode,
      prompt: o.prompt,
      inputs: o.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: o.unitCost,
      source: "local"
    }));
    return d((N) => [...m, ...N]), Promise.all(m.map(async (N) => {
      try {
        const { requestId: b, cost: q } = await e.submit(o.endpointUrl, o.payload, o.kind);
        v(N.id, { requestId: b, ...q !== void 0 ? { cost: q } : {} }), await A(N.id, b);
      } catch (b) {
        v(N.id, { status: "failed", error: b.message });
      }
    }));
  }, [e, v, A]), K = X(() => {
    const o = (m) => ({ ...m, label: m.requestId && g[m.requestId] || m.label });
    return lt(a.map(o), s.map(o), new Set(C));
  }, [a, s, g, C]), B = F((o, m) => {
    o.requestId && S((N) => {
      const b = { ...N };
      return m ? b[o.requestId] = m : delete b[o.requestId], b;
    }), v(o.id, { label: m });
  }, [v]), H = F((o) => {
    d((m) => m.filter((N) => N.id !== o.id)), o.requestId && R((m) => [.../* @__PURE__ */ new Set([...m, o.requestId])]);
  }, []), W = F(async (o) => {
    o.requestId && (await e.deleteMedia(o.requestId), v(o.id, { outputs: [] }), l((m) => m.map((N) => N.requestId === o.requestId ? { ...N, outputs: [] } : N)));
  }, [e, v]);
  return { items: K, run: z, setLabel: B, remove: H, deleteMedia: W, loadMore: () => f(!1), hasMore: !!x, loadingMore: p, serverError: h };
}
const ft = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Oe(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : ft.test(e) ? "file" : "image" : "text";
}
function ht(e) {
  const r = e.trim();
  if (!/^[\[{]/.test(r)) return e;
  try {
    return JSON.stringify(JSON.parse(r), null, 2);
  } catch {
    return e;
  }
}
const D = ({ children: e, ...r }) => /* @__PURE__ */ t("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...r, children: e }), ce = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ t("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ t("path", { d: "m21 15-4.5-4.5L6 21" })
] }), bt = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ t("path", { d: "m16 10 6-3v10l-6-3" })
] }), xt = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ t("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ t("circle", { cx: "17", cy: "16", r: "3" })
] }), yt = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ t("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ t("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), De = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ t("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), gt = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ t("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Re = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), vt = ({ filled: e, ...r }) => /* @__PURE__ */ t(D, { ...r, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ t("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Ue = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ t("path", { d: "m20 20-3.5-3.5" })
] }), Pe = ({ up: e, ...r }) => /* @__PURE__ */ t(D, { ...r, children: /* @__PURE__ */ t("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), wt = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), Nt = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ t("circle", { cx: "12", cy: "12", r: "3" })
] }), xe = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ye = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "m5 12 5 5 9-10" }) }), ae = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "M6 6l12 12M18 6 6 18" }) }), Fe = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), kt = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ t("path", { d: "M12 11v5M12 8v.01" })
] }), ie = (e) => /* @__PURE__ */ t(D, { ...e, className: "ms-spin", children: /* @__PURE__ */ t("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Ct = (e) => /* @__PURE__ */ t(D, { ...e, children: /* @__PURE__ */ t("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), St = (e) => /* @__PURE__ */ c(D, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), It = ["All", "Approved", "Rejected", "Unlabeled"], Mt = [1, 2, 4, 6, 8];
function $t({ url: e, hidden: r, onOpen: n }) {
  const a = r ? { filter: "blur(18px)" } : void 0, d = Oe(e);
  return d === "text" ? /* @__PURE__ */ t("pre", { tabIndex: 0, "aria-label": "Generated text", style: a, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: ht(e) }) : d === "video" ? /* @__PURE__ */ t("video", { src: e, controls: !0, preload: "metadata", style: a, className: "aspect-video w-full bg-black object-contain" }) : d === "audio" ? /* @__PURE__ */ t("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ t("audio", { src: e, controls: !0, className: "w-full" }) }) : d === "3d" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ t(De, { width: 32, height: 32 }),
    "Open 3D model"
  ] }) : d === "file" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ t(xe, { width: 28, height: 28 }),
    /* @__PURE__ */ t("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ t("button", { type: "button", onClick: n, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ t("img", { src: e, alt: "Generated output", loading: "lazy", style: a, className: "aspect-square w-full bg-black object-contain" }) });
}
function At({ g: e, hidden: r, onLabel: n, onRemove: a, onReuse: d, onRerun: s, onDeleteMedia: l, onOpen: x, estimateFor: w }) {
  const p = e.outputs[0], $ = !!p && Oe(p) === "text", [h, T] = k(!1), I = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", g = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ c("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && p ? /* @__PURE__ */ t($t, { url: p, hidden: r, onOpen: () => x(p) }) : e.status === "failed" ? /* @__PURE__ */ c("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ t(ae, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ t("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ c("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ t(ie, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ c("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ t("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ c("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ t("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ t("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? Q(e.cost) : e.status === "completed" && (w == null ? void 0 : w(e.model)) !== void 0 ? `est. ${Q(w(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && p && ($ ? /* @__PURE__ */ t("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(p)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${g} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ t(xe, { width: 14, height: 14 }) }) : /* @__PURE__ */ t("a", { href: p, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${g} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ t(xe, { width: 14, height: 14 }) })),
        /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => n(e, e.label === "approved" ? null : "approved"),
            className: `${g} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ t(ye, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "rejected",
            "aria-label": "Reject",
            title: "Reject",
            onClick: () => n(e, e.label === "rejected" ? null : "rejected"),
            className: `${g} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ t(ae, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ t("button", { type: "button", onClick: () => d(e), title: "Load this model and settings back into the form", className: I, children: "Reuse" }),
        /* @__PURE__ */ t("button", { type: "button", onClick: () => s(e), title: "Generate again with the same settings", className: I, children: "Re-run" }),
        e.status === "completed" && p && /* @__PURE__ */ t("button", { type: "button", onClick: () => {
          var S;
          (S = navigator.clipboard) == null || S.writeText(p).then(() => {
            T(!0), setTimeout(() => T(!1), 1500);
          });
        }, className: I, children: h ? "Copied" : $ ? "Copy text" : "Copy link" })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ c("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ c("span", { className: "flex shrink-0 gap-3", children: [
          e.requestId && e.status === "completed" && p && /* @__PURE__ */ t("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && l(e);
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ t("button", { type: "button", onClick: () => a(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Lt({ url: e, onClose: r }) {
  return U(() => {
    const n = (a) => a.key === "Escape" && r();
    return document.addEventListener("keydown", n), () => document.removeEventListener("keydown", n);
  }, [r]), /* @__PURE__ */ c("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: r, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ t("button", { type: "button", "aria-label": "Close preview", onClick: r, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ t(ae, { width: 24, height: 24 }) }),
    /* @__PURE__ */ t("img", { src: e, alt: "Full size output", onClick: (n) => n.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function jt({ mode: e, items: r, batch: n, onBatch: a, onLabel: d, onRemove: s, onReuse: l, onRerun: x, onDeleteMedia: w, onLoadMore: p, hasMore: $, loadingMore: h, serverError: T, estimateFor: I }) {
  const [g, S] = k("All"), [C, R] = k(""), [M, i] = k(!1), [u, v] = k(null), A = X(() => {
    const f = C.trim().toLowerCase();
    return r.filter((L) => L.mode !== e || g === "Approved" && L.label !== "approved" || g === "Rejected" && L.label !== "rejected" || g === "Unlabeled" && L.label !== null ? !1 : !f || L.prompt.toLowerCase().includes(f) || L.model.toLowerCase().includes(f));
  }, [r, e, g, C]);
  return /* @__PURE__ */ c("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ t("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: It.map((f) => /* @__PURE__ */ t(
        "button",
        {
          role: "tab",
          "aria-selected": g === f,
          onClick: () => S(f),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${g === f ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: f
        },
        f
      )) }),
      /* @__PURE__ */ c("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ t(Ue, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ t("input", { value: C, onChange: (f) => R(f.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ t("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Mt.map((f) => /* @__PURE__ */ t(
        "button",
        {
          role: "radio",
          "aria-checked": n === f,
          onClick: () => a(f),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${n === f ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: f
        },
        f
      )) }),
      /* @__PURE__ */ t("button", { type: "button", "aria-pressed": M, "aria-label": M ? "Show previews" : "Hide previews", title: M ? "Show previews" : "Hide previews", onClick: () => i((f) => !f), className: M ? "text-primary" : "text-secondary hover:text-fg", children: M ? /* @__PURE__ */ t(wt, { width: 18, height: 18 }) : /* @__PURE__ */ t(Nt, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      A.length === 0 ? /* @__PURE__ */ c("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ t("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ t(Re, { width: 36, height: 36 }) }),
        /* @__PURE__ */ t("p", { className: "font-semibold", children: r.some((f) => f.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ t("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: r.some((f) => f.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ t("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: A.map((f) => /* @__PURE__ */ t(At, { g: f, hidden: M, onLabel: d, onRemove: s, onReuse: l, onRerun: x, onDeleteMedia: w, onOpen: v, estimateFor: I }, f.id)) }),
      T && /* @__PURE__ */ c("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        T
      ] }),
      $ && /* @__PURE__ */ t("div", { className: "mt-4 text-center", children: /* @__PURE__ */ t("button", { type: "button", disabled: h, onClick: p, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: h ? "Loading…" : "Load more history" }) }),
      u && /* @__PURE__ */ t(Lt, { url: u, onClose: () => v(null) })
    ] })
  ] });
}
const Tt = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, _t = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function qt(e) {
  var r;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((r = e.items) == null ? void 0 : r.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Tt.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || _t.test(e.name) ? "media" : "text" : "text";
}
function Me(e) {
  var l, x;
  const r = (x = (l = e.input_schema) == null ? void 0 : l.schemas) == null ? void 0 : x.input_data, n = (r == null ? void 0 : r.properties) ?? {}, a = (r == null ? void 0 : r["x-order-properties"]) ?? e.input_fields ?? Object.keys(n), d = [...a.filter((w) => n[w]), ...Object.keys(n).filter((w) => !a.includes(w))], s = new Set(e.required_fields ?? []);
  return d.map((w) => ({ prop: { ...n[w], name: w }, kind: qt({ ...n[w], name: w }), required: s.has(w) }));
}
function fe(e) {
  var n;
  const r = {};
  for (const { prop: a, kind: d, required: s } of e)
    a.default !== void 0 && a.default !== null ? r[a.name] = a.default : s && (d === "textarea" || d === "text") && typeof ((n = a.examples) == null ? void 0 : n[0]) == "string" && (r[a.name] = a.examples[0]);
  return r;
}
const de = (e) => `__auto:${e}`, Et = (e) => e.kind === "number" && !e.required, ge = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function $e(e, r) {
  const n = {};
  for (const { prop: a, kind: d } of e) {
    if (r[de(a.name)] === !0) continue;
    const s = r[a.name] ?? a.default;
    if (!ge(s))
      if (d === "number") {
        const l = Number(s);
        Number.isFinite(l) && (n[a.name] = l);
      } else if (d === "json" && typeof s == "string")
        try {
          n[a.name] = JSON.parse(s);
        } catch {
        }
      else n[a.name] = s;
  }
  return n;
}
function Ot(e, r) {
  for (const { prop: n, kind: a, required: d } of e) {
    if (r[de(n.name)] === !0) continue;
    const s = r[n.name] ?? n.default, l = n.title || n.name;
    if (d && ge(s)) return `${l} is required`;
    if (a === "json" && typeof s == "string" && s)
      try {
        JSON.parse(s);
      } catch {
        return `${l} must be valid JSON`;
      }
    if (a === "number" && !ge(s)) {
      const x = Number(s);
      if (!Number.isFinite(x)) return `${l} must be a number`;
      if (n.minValue !== void 0 && x < n.minValue) return `${l} must be at least ${n.minValue}`;
      if (n.maxValue !== void 0 && x > n.maxValue) return `${l} must be at most ${n.maxValue}`;
    }
  }
  return null;
}
const Dt = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Rt({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ t("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ t("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ t("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ t(ce, {}) });
}
function Ut({ client: e, max: r, initialType: n = "image", onInsert: a, onClose: d }) {
  const [s, l] = k(n), [x, w] = k(""), [p, $] = k(1), [h, T] = k(null), [I, g] = k(null), [S, C] = k(!1), [R, M] = k([]), [i, u] = k(""), [v, A] = k(!1), f = G(null), L = G(null), z = F(async () => {
    C(!0), g(null);
    try {
      T(await e.mediaLibrary({ mediaType: s, search: x, page: p }));
    } catch (o) {
      g(o.message);
    } finally {
      C(!1);
    }
  }, [e, s, x, p]);
  U(() => {
    const o = setTimeout(z, x ? 300 : 0);
    return () => clearTimeout(o);
  }, [z, x]), U(() => {
    $(1);
  }, [s, x]), U(() => {
    var N;
    const o = document.activeElement;
    (N = f.current) == null || N.focus();
    const m = (b) => {
      if (b.key === "Escape") {
        b.stopPropagation(), d();
        return;
      }
      if (b.key !== "Tab" || !f.current) return;
      const q = [...f.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!q.length) return;
      const Z = q[0], P = q[q.length - 1];
      b.shiftKey && document.activeElement === Z ? (b.preventDefault(), P.focus()) : !b.shiftKey && document.activeElement === P && (b.preventDefault(), Z.focus());
    };
    return document.addEventListener("keydown", m), () => {
      var b;
      document.removeEventListener("keydown", m), (b = o == null ? void 0 : o.focus) == null || b.call(o);
    };
  }, [d]);
  const K = (o) => M((m) => m.includes(o) ? m.filter((N) => N !== o) : r === 1 ? [o] : m.length < r ? [...m, o] : m), B = async (o) => {
    if (o.length) {
      C(!0), g(null);
      try {
        for (const m of o) {
          const N = await e.upload(m);
          await e.saveToLibrary({ url: N, name: m.name, mime_type: m.type || void 0, size_bytes: m.size, media_type: m.type.startsWith("video") ? "video" : m.type.startsWith("audio") ? "audio" : m.type.startsWith("image") ? "image" : "archive" });
        }
        await z();
      } catch (m) {
        g(m.message), C(!1);
      }
    }
  }, H = async () => {
    var m;
    const o = i.trim();
    if (!/^https?:\/\//i.test(o)) {
      g("Enter a full http(s) URL");
      return;
    }
    C(!0), g(null);
    try {
      const N = ((m = o.split("?")[0].split(".").pop()) == null ? void 0 : m.toLowerCase()) ?? "", b = ["mp4", "webm", "mov"].includes(N) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(N) ? "audio" : ["zip", "rar", "7z"].includes(N) ? "archive" : "image";
      await e.saveToLibrary({ url: o, name: o.split("/").pop() || "link", media_type: b }), u(""), A(!1), await z();
    } catch (N) {
      g(N.message), C(!1);
    }
  }, W = async (o) => {
    if (window.confirm(`Delete "${o.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(o.id), M((m) => m.filter((N) => N !== o.url)), await z();
      } catch (m) {
        g(m.message);
      }
  };
  return /* @__PURE__ */ t("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (o) => {
    o.target === o.currentTarget && d();
  }, children: /* @__PURE__ */ c("div", { ref: f, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ c("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ t("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ t(ce, {}) }),
      /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ c("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ c("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
            (h == null ? void 0 : h.total) ?? 0,
            " ",
            (h == null ? void 0 : h.total) === 1 ? "item" : "items"
          ] })
        ] }),
        /* @__PURE__ */ c("p", { className: "hidden text-xs text-secondary sm:block", children: [
          "Select up to ",
          r,
          " item",
          r === 1 ? "" : "s",
          " to insert into your form"
        ] })
      ] }),
      /* @__PURE__ */ t("input", { ref: L, type: "file", hidden: !0, multiple: !0, onChange: (o) => {
        const m = Array.from(o.target.files ?? []);
        o.target.value = "", B(m);
      } }),
      /* @__PURE__ */ c("button", { type: "button", onClick: () => {
        var o;
        return (o = L.current) == null ? void 0 : o.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ t(Fe, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ t("button", { type: "button", "aria-label": "Close", onClick: d, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ t(ae, {}) })
    ] }),
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Dt.map((o) => /* @__PURE__ */ t("button", { role: "tab", "aria-selected": s === o.id, onClick: () => l(o.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${s === o.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: o.label }, o.id)) }),
      /* @__PURE__ */ t("input", { value: x, onChange: (o) => w(o.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ t("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": v, onClick: () => A((o) => !o), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    v && /* @__PURE__ */ c("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ t("input", { value: i, onChange: (o) => u(o.target.value), onKeyDown: (o) => o.key === "Enter" && void H(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ t("button", { type: "button", onClick: () => void H(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      I && /* @__PURE__ */ t("p", { role: "alert", className: "mb-3 text-sm text-danger", children: I }),
      S && !h ? /* @__PURE__ */ c("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ t(ie, {}),
        " Loading…"
      ] }) : h != null && h.items.length ? /* @__PURE__ */ t("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: h.items.map((o) => {
        const m = R.includes(o.url);
        return /* @__PURE__ */ c("li", { className: `group relative overflow-hidden rounded-card border ${m ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ t("button", { type: "button", "aria-pressed": m, "aria-label": `${m ? "Deselect" : "Select"} ${o.name ?? "file"}`, onClick: () => K(o.url), className: "block aspect-square w-full", children: /* @__PURE__ */ t(Rt, { a: o }) }),
          m && /* @__PURE__ */ t("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ t(ye, { width: 12, height: 12 }) }),
          /* @__PURE__ */ t("button", { type: "button", "aria-label": `Delete ${o.name ?? "file"}`, onClick: () => void W(o), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ t(ae, { width: 12, height: 12 }) }),
          /* @__PURE__ */ t("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: o.name ?? "", children: o.name })
        ] }, o.id);
      }) }) : /* @__PURE__ */ c("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ t("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ t(ce, { width: 28, height: 28 }) }),
        /* @__PURE__ */ t("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ t("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      h && h.total_pages > 1 && /* @__PURE__ */ c("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ t("button", { type: "button", disabled: p <= 1, onClick: () => $((o) => o - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        p,
        " of ",
        h.total_pages,
        /* @__PURE__ */ t("button", { type: "button", disabled: p >= h.total_pages, onClick: () => $((o) => o + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ c("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ c("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ t("b", { className: "text-primary", children: R.length }),
        " of ",
        r,
        " selected"
      ] }),
      /* @__PURE__ */ c("button", { type: "button", disabled: !R.length, onClick: () => {
        a(R), d();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ t(ye, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const ze = (e, r = "") => {
  const n = `${e ?? ""} ${r}`.toLowerCase();
  return n.includes("video") ? "video/*" : n.includes("audio") || n.includes("voice") ? "audio/*" : n.includes("image") || n.includes("mask") || n.includes("photo") || n.includes("face") ? "image/*" : void 0;
}, Pt = (e, r = "") => {
  const n = ze(e, r);
  return n === "video/*" ? "video" : n === "audio/*" ? "audio" : n === "image/*" ? "image" : "all";
}, Ft = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function zt(e, r) {
  const n = await Promise.all(r.map((a) => e.upload(a)));
  return r.forEach((a, d) => void e.saveToLibrary({ url: n[d], name: a.name, mime_type: a.type || void 0, size_bytes: a.size, media_type: Ft(a) }).catch(() => {
  })), n;
}
function Ae({ client: e, field: r, multiple: n, max: a, current: d, onUrls: s, onError: l }) {
  const x = G(null), [w, p] = k(!1), [$, h] = k(!1), [T, I] = k(!1), g = a - d.length, S = We(), C = async (i) => {
    if (i.length) {
      p(!0);
      try {
        s(await zt(e, n ? i.slice(0, Math.max(g, 1)) : i.slice(0, 1)));
      } catch (u) {
        l(u.message);
      } finally {
        p(!1);
      }
    }
  }, R = ze(r.prop.field, r.prop.name), M = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ c(
    "div",
    {
      onDragOver: (i) => {
        i.preventDefault(), h(!0);
      },
      onDragLeave: () => h(!1),
      onDrop: (i) => {
        i.preventDefault(), h(!1), C(Array.from(i.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${$ ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ t("input", { ref: x, type: "file", hidden: !0, accept: R, multiple: n, onChange: (i) => {
          const u = Array.from(i.target.files ?? []);
          i.target.value = "", C(u);
        } }),
        (n ? g > 0 : !0) && /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ t(
            "input",
            {
              "aria-label": `${r.prop.title || r.prop.name} URL`,
              placeholder: n ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: n ? void 0 : d[0] ?? "",
              defaultValue: void 0,
              onChange: n ? void 0 : (i) => s([i.target.value]),
              onKeyDown: n ? (i) => {
                i.key === "Enter" && i.currentTarget.value.trim() && (s([i.currentTarget.value.trim()]), i.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ t("button", { type: "button", disabled: w, onClick: () => {
            var i;
            return (i = x.current) == null ? void 0 : i.click();
          }, "aria-label": "Upload file", title: "Upload file", className: M, children: w ? /* @__PURE__ */ t(ie, { width: 16, height: 16 }) : /* @__PURE__ */ t(Fe, { width: 16, height: 16 }) }),
          S.library && /* @__PURE__ */ t("button", { type: "button", onClick: () => I(!0), "aria-label": "Choose from media library", title: "Media library", className: M, children: /* @__PURE__ */ c("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ t("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ t("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ t("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        T && S.library && /* @__PURE__ */ t(Ut, { client: e, max: n ? Math.max(g, 1) : 1, initialType: Pt(r.prop.field, r.prop.name), onInsert: s, onClose: () => I(!1) })
      ]
    }
  );
}
function Vt({ field: e, values: r, onChange: n, client: a, onError: d, tagCount: s = 0 }) {
  const { prop: l, kind: x, required: w } = e, p = r[l.name], $ = (i) => n(l.name, i), h = l.title || l.name, T = `ms-f-${l.name}`, I = p == null ? "" : String(p), g = Array.isArray(p) ? p : [], S = r[de(l.name)] === !0, C = G(null), R = (i) => {
    const u = C.current, v = typeof p == "string" ? p : "", A = (u == null ? void 0 : u.selectionStart) ?? v.length, f = (u == null ? void 0 : u.selectionEnd) ?? A;
    $(v.slice(0, A) + i + " " + v.slice(f)), requestAnimationFrame(() => {
      u == null || u.focus(), u == null || u.setSelectionRange(A + i.length + 1, A + i.length + 1);
    });
  };
  let M;
  if (x === "textarea" || x === "json")
    M = /* @__PURE__ */ c(ve, { children: [
      /* @__PURE__ */ t("textarea", { ref: C, id: T, rows: x === "json" ? 4 : 5, value: typeof p == "string" ? p : p ? JSON.stringify(p, null, 2) : "", onChange: (i) => $(i.target.value), className: `w-full resize-y p-3 text-sm ${x === "json" ? "font-mono text-xs" : ""}` }),
      l.name === "prompt" && s > 0 && /* @__PURE__ */ c("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ t("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(s, 9) }, (i, u) => `@image${u + 1}`).map((i) => /* @__PURE__ */ t("button", { type: "button", onClick: () => R(i), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: i }, i))
      ] })
    ] });
  else if (x === "select") {
    const i = l.enum ?? [], u = i.findIndex((v) => String(v) === I);
    M = /* @__PURE__ */ c("select", { id: T, value: u >= 0 ? u : "", onChange: (v) => $(i[Number(v.target.value)]), className: "w-full px-3 py-3 text-sm", children: [
      u < 0 && /* @__PURE__ */ t("option", { value: "", children: "Select…" }),
      i.map((v, A) => /* @__PURE__ */ t("option", { value: A, children: String(v) }, String(v)))
    ] });
  } else if (x === "boolean") {
    const i = p === !0;
    M = /* @__PURE__ */ t(
      "button",
      {
        id: T,
        type: "button",
        role: "switch",
        "aria-checked": i,
        onClick: () => $(!i),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${i ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ t("span", { className: `h-5 w-5 rounded-full ${i ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (x === "number") {
    const i = l.minValue !== void 0 && l.maxValue !== void 0;
    M = /* @__PURE__ */ c("div", { className: `flex items-center gap-3 ${S ? "opacity-40" : ""}`, children: [
      i && /* @__PURE__ */ t("input", { type: "range", disabled: S, "aria-label": `${h} slider`, min: l.minValue, max: l.maxValue, step: l.step ?? (l.type === "number" ? 0.01 : 1), value: I === "" ? l.minValue : Number(I), onChange: (u) => $(Number(u.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ t("input", { id: T, type: "number", disabled: S, min: l.minValue, max: l.maxValue, step: l.step ?? (l.type === "number" ? "any" : 1), value: I, onChange: (u) => $(u.target.value === "" ? "" : Number(u.target.value)), className: `px-3 py-2 text-sm ${i ? "w-24" : "w-full"}` })
    ] });
  } else if (x === "media")
    M = /* @__PURE__ */ t(Ae, { client: a, field: e, multiple: !1, max: 1, current: I ? [I] : [], onUrls: (i) => $(i[0]), onError: d });
  else if (x === "media-list") {
    const i = l.maxItems ?? 8;
    M = /* @__PURE__ */ c("div", { className: "space-y-2", children: [
      g.map((u, v) => /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ t("input", { "aria-label": `${h} ${v + 1}`, value: u, onChange: (A) => $(g.map((f, L) => L === v ? A.target.value : f)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ t("button", { type: "button", "aria-label": `Remove ${h} ${v + 1}`, onClick: () => $(g.filter((A, f) => f !== v)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ t(ae, { width: 14, height: 14 }) })
      ] }, v)),
      /* @__PURE__ */ t(Ae, { client: a, field: e, multiple: !0, max: i, current: g, onUrls: (u) => $([...g, ...u].slice(0, i)), onError: d })
    ] });
  } else
    M = /* @__PURE__ */ t("input", { id: T, value: I, onChange: (i) => $(i.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ c("div", { className: "mb-5", children: [
    /* @__PURE__ */ c("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ c("label", { htmlFor: T, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        h,
        l.description && /* @__PURE__ */ t("span", { title: l.description, className: "text-muted", children: /* @__PURE__ */ t(kt, { width: 13, height: 13 }) })
      ] }),
      Et(e) ? /* @__PURE__ */ c("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ t("input", { type: "checkbox", checked: S, onChange: (i) => n(de(l.name), i.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ t("span", { className: "text-[11px] text-primary", children: x === "media-list" ? `${g.length}/${l.maxItems ?? 8} items${w ? " · required" : ""}` : w ? "* required" : "" })
    ] }),
    M
  ] });
}
const le = 200;
function Jt({ model: e }) {
  const r = qe(e);
  return r ? /* @__PURE__ */ c("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    r.original !== null && /* @__PURE__ */ t("s", { className: "font-normal text-muted", children: Q(r.original) }),
    r.from && r.original !== null ? "from " : "",
    Q(r.current)
  ] }) : null;
}
function Gt({ models: e, value: r, onChange: n, favorites: a, onToggleFavorite: d, usage: s, showGroup: l }) {
  var M;
  const [x, w] = k(!1), [p, $] = k(""), [h, T] = k("popular"), I = G(null);
  U(() => {
    if (!x) return;
    const i = (v) => {
      var A;
      (A = I.current) != null && A.contains(v.target) || w(!1);
    }, u = (v) => {
      v.key === "Escape" && w(!1);
    };
    return document.addEventListener("mousedown", i), document.addEventListener("keydown", u), () => {
      document.removeEventListener("mousedown", i), document.removeEventListener("keydown", u);
    };
  }, [x]);
  const g = X(() => {
    const i = p.trim().toLowerCase(), u = i ? e.filter((f) => f.name.toLowerCase().includes(i) || f.category.toLowerCase().includes(i)) : e, v = _e(u, h, { usage: s, favorites: a });
    if (h === "favourites" || h === "most-used") return v;
    const A = new Set(a);
    return [...v.filter((f) => A.has(f.name)), ...v.filter((f) => !A.has(f.name))];
  }, [e, p, h, a, s]), [S, C] = k(0);
  U(() => C(0), [p, h, x]);
  const R = (i) => {
    i.key === "ArrowDown" ? (i.preventDefault(), C((u) => Math.min(u + 1, Math.min(g.length, le) - 1))) : i.key === "ArrowUp" ? (i.preventDefault(), C((u) => Math.max(u - 1, 0))) : i.key === "Enter" && g[S] && (i.preventDefault(), n(g[S].name), w(!1));
  };
  return U(() => {
    var i, u;
    (u = (i = document.getElementById(`ms-opt-${S}`)) == null ? void 0 : i.scrollIntoView) == null || u.call(i, { block: "nearest" });
  }, [S]), /* @__PURE__ */ c("div", { ref: I, className: "relative", children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        onClick: () => w((i) => !i),
        "aria-haspopup": "listbox",
        "aria-expanded": x,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ t("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (M = (r ?? "?")[0]) == null ? void 0 : M.toUpperCase() }),
          /* @__PURE__ */ t("span", { className: "min-w-0 flex-1 truncate", children: r ?? "Select a model" }),
          /* @__PURE__ */ t(Pe, { up: x, width: 16, height: 16 })
        ]
      }
    ),
    x && /* @__PURE__ */ c("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ c("div", { className: "mb-2 flex gap-2", children: [
        /* @__PURE__ */ c("label", { className: "relative flex-1", children: [
          /* @__PURE__ */ t(Ue, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
          /* @__PURE__ */ t("input", { autoFocus: !0, onKeyDown: R, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${S}`, value: p, onChange: (i) => $(i.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
        ] }),
        /* @__PURE__ */ t("select", { value: h, onChange: (i) => T(i.target.value), "aria-label": "Sort models", className: "px-2 text-xs", children: at.map((i) => /* @__PURE__ */ t("option", { value: i.id, children: i.label }, i.id)) })
      ] }),
      /* @__PURE__ */ c("ul", { id: "ms-listbox", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        g.slice(0, le).map((i, u) => {
          const v = i.name === r;
          return /* @__PURE__ */ c(
            "li",
            {
              id: `ms-opt-${u}`,
              role: "option",
              "aria-selected": v,
              onClick: () => {
                n(i.name), w(!1);
              },
              className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${v ? "bg-primary-soft" : u === S ? "bg-card-bg" : "hover:bg-card-bg"}`,
              children: [
                /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ t("div", { className: `truncate text-sm ${v ? "text-primary" : ""}`, children: i.name }),
                  /* @__PURE__ */ t("div", { className: "text-[10px] text-secondary", children: l ? `${i.group_of} · ${i.category}` : i.category })
                ] }),
                /* @__PURE__ */ t(
                  "button",
                  {
                    type: "button",
                    "aria-label": a.includes(i.name) ? "Remove favorite" : "Add favorite",
                    onClick: (A) => {
                      A.stopPropagation(), d(i.name);
                    },
                    className: a.includes(i.name) ? "text-primary" : "text-muted hover:text-fg",
                    children: /* @__PURE__ */ t(vt, { width: 15, height: 15, filled: a.includes(i.name) })
                  }
                ),
                /* @__PURE__ */ t(Jt, { model: i })
              ]
            },
            i.name
          );
        }),
        g.length === 0 && /* @__PURE__ */ t("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: h === "favourites" ? "No favourites yet. Tap the heart on a model." : h === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${p}”.` }),
        g.length > le && /* @__PURE__ */ c("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
          "Showing ",
          le,
          " of ",
          g.length,
          ". Refine your search."
        ] })
      ] })
    ] })
  ] });
}
const Le = (e, r) => {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : r;
  } catch {
    return r;
  }
}, he = (e, r) => {
  try {
    localStorage.setItem(e, JSON.stringify(r));
  } catch {
  }
}, Ht = 0.25;
function Bt({ mode: e, models: r, client: n, batch: a, onRun: d, usage: s, reuse: l }) {
  const x = ne.find((y) => y.id === e), w = X(() => nt(r, e), [r, e]), [p, $] = k(), [h, T] = k(null), [I, g] = k(null), [S, C] = k({}), [R, M] = k(null), [i, u] = k(null), [v, A] = k(() => Le("muapi-studio:favorites", [])), [f, L] = k("form"), [z, K] = k(!1), [B, H] = k("{}"), [W, o] = k(null), m = G(0), N = G(null);
  U(() => {
    var O, J, re;
    const y = Le(`muapi-studio:model:${e}`, null), j = ((O = w.find((te) => te.name === y)) == null ? void 0 : O.name) ?? ((J = w.find((te) => te.name === tt[e])) == null ? void 0 : J.name) ?? ((re = _e(w, "popular")[0]) == null ? void 0 : re.name);
    $(j);
  }, [e, w]), U(() => {
    l && (N.current = l.inputs, w.some((y) => y.name === l.model) && ($(l.model), he(`muapi-studio:model:${e}`, l.model)), L("form"));
  }, [l == null ? void 0 : l.nonce]);
  const b = w.find((y) => y.name === p);
  U(() => {
    if (!p) return;
    let y = !0;
    return T(null), g(null), M(null), u(null), o(null), n.model(p).then((j) => {
      if (!y) return;
      const O = Me(j), J = fe(O), re = N.current;
      if (N.current = null, re)
        for (const te of O) re[te.prop.name] !== void 0 && (J[te.prop.name] = re[te.prop.name]);
      T(j), C(J);
    }).catch((j) => {
      y && g(j.message);
    }), () => {
      y = !1;
    };
  }, [p, n]);
  const q = X(() => h ? Me(h) : [], [h]), Z = X(() => $e(q, S), [q, S]), P = X(() => {
    try {
      const y = JSON.parse(B);
      return y && typeof y == "object" && !Array.isArray(y) ? y : null;
    } catch {
      return null;
    }
  }, [B]), ee = f === "json" ? P ?? {} : Z, ue = JSON.stringify(ee);
  U(() => {
    if (!h || f === "json" && !P) return;
    const y = ++m.current, j = setTimeout(() => {
      n.estimate(h.name, ee).then((O) => {
        y === m.current && M(O);
      }).catch(() => {
        y === m.current && M(null);
      });
    }, 500);
    return () => clearTimeout(j);
  }, [h, ue, n]);
  const me = (y) => {
    $(y), he(`muapi-studio:model:${e}`, y);
  }, _ = (y) => A((j) => {
    const O = j.includes(y) ? j.filter((J) => J !== y) : [...j, y];
    return he("muapi-studio:favorites", O), O;
  }), V = (y) => {
    K(!1), y !== f && (y === "json" ? H(JSON.stringify(Z, null, 2)) : P && C((j) => {
      const O = { ...j };
      for (const J of q) P[J.prop.name] !== void 0 && (O[J.prop.name] = P[J.prop.name]);
      return O;
    }), L(y), u(null));
  }, E = b ? qe(b, R) : null, Y = F(async () => {
    if (!h) return;
    o(null);
    const y = q.find((j) => j.prop.name === "prompt");
    await d({
      model: h.name,
      endpointUrl: h.endpoint_url,
      mode: e,
      payload: ee,
      count: a,
      kind: Te(h.category),
      prompt: y ? String(ee.prompt ?? "") : "",
      unitCost: E == null ? void 0 : E.current
    });
  }, [h, q, d, e, ee, a, E]), pe = F(async () => {
    if (!h) return;
    if (f === "json") {
      if (!P) {
        u("The JSON is not valid");
        return;
      }
      const j = (h.required_fields ?? []).find((O) => P[O] === void 0 || P[O] === "");
      if (j) {
        u(`${j} is required`);
        return;
      }
    } else {
      const j = Ot(q, S);
      if (j) {
        u(j);
        return;
      }
    }
    u(null);
    const y = ((E == null ? void 0 : E.current) ?? 0) * a;
    if (y > Ht) {
      o(y);
      return;
    }
    await Y();
  }, [h, f, P, q, S, E, a, Y]), se = !!h && !I, Ve = (() => {
    var j;
    const y = q.find((O) => O.kind === "media-list");
    return y ? Math.max(((j = S[y.prop.name]) == null ? void 0 : j.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ c("section", { "aria-label": x.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ c("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ t("h2", { className: "text-lg font-semibold", children: x.title }),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ c("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": z, onClick: () => K((y) => !y), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            f === "json" ? "JSON" : "Form",
            /* @__PURE__ */ t(Pe, { up: z, width: 12, height: 12 })
          ] }),
          z && /* @__PURE__ */ t("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((y) => /* @__PURE__ */ t("li", { role: "none", children: /* @__PURE__ */ t("button", { role: "menuitemradio", "aria-checked": f === y, type: "button", onClick: () => V(y), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${f === y ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: y === "json" ? "JSON" : "Form" }) }, y)) })
        ] })
      ] }),
      /* @__PURE__ */ t("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ t("div", { className: "mb-5", children: /* @__PURE__ */ t(Gt, { models: w, value: p, onChange: me, favorites: v, onToggleFavorite: _, usage: s, showGroup: e === "text" || e === "more" }) }),
      /* @__PURE__ */ t("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: f === "json" ? "Request body" : "Parameters" }),
      (b == null ? void 0 : b.description) && /* @__PURE__ */ t("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: b.description }),
      !se && !I && p && /* @__PURE__ */ c("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ t(ie, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      I && /* @__PURE__ */ c("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        I
      ] }),
      w.length === 0 && /* @__PURE__ */ t("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      se && f === "json" && /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ t("textarea", { "aria-label": "Request JSON", "aria-invalid": !P, spellCheck: !1, rows: 16, value: B, onChange: (y) => H(y.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ t("p", { className: `mt-1.5 text-[11px] ${P ? "text-muted" : "text-danger"}`, children: P ? `Sent as the body of POST /api/v1/${h.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      se && f === "form" && q.map((y) => /* @__PURE__ */ t(
        Vt,
        {
          field: y,
          values: S,
          client: n,
          onError: u,
          tagCount: y.prop.name === "prompt" ? Ve : 0,
          onChange: (j, O) => C((J) => ({ ...J, [j]: O }))
        },
        y.prop.name
      ))
    ] }),
    /* @__PURE__ */ c("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      i && /* @__PURE__ */ t("p", { role: "alert", className: "mb-2 text-xs text-danger", children: i }),
      W !== null && /* @__PURE__ */ c("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ t("b", { className: "text-primary", children: Q(W) }),
        " (",
        a,
        " × ",
        Q((E == null ? void 0 : E.current) ?? 0),
        ").",
        /* @__PURE__ */ c("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ t("button", { type: "button", onClick: () => void Y(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ t("button", { type: "button", onClick: () => o(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ t("button", { type: "button", onClick: () => {
          h && (C(fe(q)), H(JSON.stringify($e(q, fe(q)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => void pe(),
            disabled: !se,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ t(Re, { width: 16, height: 16 }),
              "Generate",
              a > 1 ? ` ×${a}` : "",
              E && /* @__PURE__ */ c("span", { className: "font-normal", children: [
                "(",
                E.original !== null ? /* @__PURE__ */ c(ve, { children: [
                  /* @__PURE__ */ t("s", { className: "opacity-60", children: Q(E.original * a) }),
                  " "
                ] }) : null,
                Q(E.current * a),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Kt = {
  image: ce,
  video: bt,
  audio: xt,
  avatar: yt,
  "3d": De,
  "ai-tools": gt,
  text: Ct,
  more: St
};
function Wt({ mode: e, onChange: r, layout: n = "rail" }) {
  return n === "tabs" ? /* @__PURE__ */ t("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: ne.map((a) => {
    const d = a.id === e;
    return /* @__PURE__ */ c(
      "button",
      {
        onClick: () => r(a.id),
        "aria-current": d ? "page" : void 0,
        className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${d ? "text-primary" : "text-secondary hover:text-fg"}`,
        children: [
          a.label,
          d && /* @__PURE__ */ t("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
        ]
      },
      a.id
    );
  }) }) : /* @__PURE__ */ t("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: ne.map((a) => {
    const d = Kt[a.id], s = a.id === e;
    return /* @__PURE__ */ c(
      "button",
      {
        onClick: () => r(a.id),
        "aria-current": s ? "page" : void 0,
        className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${s ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
        children: [
          /* @__PURE__ */ t(d, {}),
          a.label
        ]
      },
      a.id
    );
  }) });
}
function Xt() {
  try {
    const e = new URLSearchParams(window.location.search).get("tab");
    return rt(e) ? e : null;
  } catch {
    return null;
  }
}
function Zt({ apiBase: e = "/api/muapi", initialTab: r = "image", showHeader: n = !0, title: a = "Studio", teamId: d, theme: s = "lime", layout: l, apiKey: x, onRequestApiKey: w, getHeaders: p, connected: $, fetchImpl: h, className: T = "", onTabChange: I }) {
  const g = $ === !1 || x === "" || x === null, S = G(p);
  S.current = p;
  const C = X(() => new Be(e, d, { apiKey: x || void 0, getHeaders: () => {
    var _;
    return ((_ = S.current) == null ? void 0 : _.call(S)) ?? {};
  }, fetchImpl: h }), [e, d, x, h]), [R, M] = k({ library: !0 }), i = l ?? et(s), [u, v] = k(() => Xt() ?? r), [A, f] = k(4), [L, z] = k(null), [K, B] = k(null), [H, W] = k(null), o = F(() => {
    C.balance().then(W).catch(() => W(null));
  }, [C]), [m, N] = k(null), b = pt(C, L, o), q = X(() => ct(b.items), [b.items]);
  U(() => {
    g || (B(null), z(null), C.models().then(z).catch((_) => B(_.message)), o(), C.probe().then(M));
  }, [C, o, g]);
  const Z = (_) => {
    v(_), I == null || I(_);
    try {
      const V = new URL(window.location.href);
      V.searchParams.set("tab", _), window.history.replaceState(null, "", V);
    } catch {
    }
  }, P = F(async (_) => {
    await b.run(_);
  }, [b.run]), ee = F((_) => {
    var E;
    const V = L == null ? void 0 : L.find((Y) => Y.name === _);
    return V ? ((E = V.sale) == null ? void 0 : E.from) ?? V.cost ?? void 0 : void 0;
  }, [L]), ue = F((_) => {
    v(_.mode), N({ model: _.model, inputs: _.inputs, nonce: Date.now() });
  }, []), me = F((_) => {
    var Y;
    const V = L == null ? void 0 : L.find((pe) => pe.name === _.model);
    if (!V) return;
    const E = ((Y = V.sale) == null ? void 0 : Y.from) ?? V.cost ?? 0;
    E > 0.25 && !window.confirm(`Re-run ${_.model} for about $${E.toFixed(2)}?`) || b.run({ model: _.model, endpointUrl: V.endpoint_url, mode: _.mode, prompt: _.prompt, payload: _.inputs, count: 1, unitCost: E, kind: Te(V.category) });
  }, [L, b.run]);
  return /* @__PURE__ */ c("div", { className: `ms-root ${T}`.trim(), style: Ze(s), "data-layout": i, children: [
    n && /* @__PURE__ */ c("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ t("h1", { className: "text-base font-semibold", children: a }),
      H && /* @__PURE__ */ c("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ t("b", { className: "text-primary", children: Q(H.balance) })
      ] })
    ] }),
    g ? /* @__PURE__ */ c("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ t("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ t("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays in your own account." }),
      w && /* @__PURE__ */ t("button", { type: "button", onClick: w, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ t(je.Provider, { value: R, children: /* @__PURE__ */ c("div", { className: `flex min-h-0 flex-1 flex-col ${i === "rail" ? "md:flex-row" : ""}`, children: [
      /* @__PURE__ */ t(Wt, { mode: u, onChange: Z, layout: i }),
      /* @__PURE__ */ t("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: K ? /* @__PURE__ */ c("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
        "Could not load models: ",
        K
      ] }) : L ? /* @__PURE__ */ c(ve, { children: [
        /* @__PURE__ */ t(Bt, { mode: u, models: L, client: C, batch: A, onRun: P, usage: q, reuse: m }),
        /* @__PURE__ */ t(jt, { mode: u, items: b.items, batch: A, onBatch: f, onLabel: b.setLabel, onRemove: b.remove, onReuse: ue, onRerun: me, onDeleteMedia: b.deleteMedia, onLoadMore: b.loadMore, hasMore: b.hasMore, loadingMore: b.loadingMore, serverError: b.serverError, estimateFor: ee })
      ] }) : /* @__PURE__ */ c("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
        /* @__PURE__ */ t(ie, {}),
        " Loading studio…"
      ] }) })
    ] }) })
  ] });
}
export {
  oe as ApiError,
  Be as MuapiClient,
  Zt as MuapiStudio,
  Qe as THEMES,
  Xe as cyanTheme,
  et as defaultLayout,
  Te as generationKind,
  be as limeTheme,
  Ke as pollUntilDone,
  Ye as resolveTheme,
  Ze as themeStyle
};
