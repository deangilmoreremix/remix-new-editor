import { jsx as t, jsxs as c, Fragment as we } from "react/jsx-runtime";
import { createContext as Ge, useContext as He, useState as N, useRef as H, useEffect as P, useCallback as V, useMemo as W } from "react";
class ne extends Error {
  constructor(r, n) {
    super(r), this.status = n;
  }
}
function Be(e, r) {
  var a;
  const n = e == null ? void 0 : e.detail;
  return ((a = n == null ? void 0 : n.error) == null ? void 0 : a.message) || (typeof n == "string" ? n : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || r;
}
class Ke {
  constructor(r = "/api/muapi", n, a = {}) {
    this.base = r, this.teamId = n, this.opts = a;
  }
  async request(r, n = {}) {
    const a = new Headers(n.headers);
    if (this.opts.apiKey && a.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [b, g] of Object.entries(await this.opts.getHeaders())) a.set(b, g);
    const d = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(r), { ...n, headers: a }), s = await d.text();
    let l = null;
    try {
      l = s ? JSON.parse(s) : null;
    } catch {
    }
    if (!d.ok) throw new ne(Be(l, `${d.status} ${d.statusText}`), d.status);
    if (l === null && s.trim()) throw new ne("Unexpected non-JSON response from the server", 502);
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
    if (!s) throw new ne("The API did not return a request id", 502);
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
    const r = (a) => a instanceof ne && [403, 404, 405].includes(a.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((a) => !r(a)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(r) {
    var s;
    const n = new FormData();
    n.append("file", r);
    const a = await this.request("/api/v1/upload_file", { method: "POST", body: n }), d = a.url || a.file_url || ((s = a.data) == null ? void 0 : s.url);
    if (!d) throw new ne("Upload returned no URL", 502);
    return d;
  }
}
async function We(e, r, n = {}) {
  const { intervalMs: a = 2e3, timeoutMs: d = 15 * 60 * 1e3, signal: s, onUpdate: l } = n, b = Date.now();
  let g = 0;
  for (; Date.now() - b < d; ) {
    if (s != null && s.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const h = await e.poll(r);
      if (g = 0, l == null || l(h), h.status === "completed" || h.status === "failed") return h;
    } catch (h) {
      if (++g >= 5) throw h;
    }
    await new Promise((h) => setTimeout(h, a));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Te = Ge({ library: !0, deleteMedia: !0 }), _e = () => He(Te), xe = {
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
}, Qe = { lime: xe, cyan: Xe }, Ne = {
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
  return typeof e == "string" ? Qe[e] ?? xe : { ...xe, ...e };
}
function Ze(e = "lime") {
  const r = Ye(e), n = {};
  for (const a of Object.keys(Ne)) n[Ne[a]] = r[a];
  return n;
}
function et(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const ae = [
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
function qe(e) {
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
const rt = (e) => !!e && ae.some((r) => r.id === e);
function nt(e, r) {
  const n = ae.find((a) => a.id === r).groups;
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
function Ee(e, r, n = {}) {
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
  return ((d = ae.find((s) => n && s.groups.includes(n))) == null ? void 0 : d.id) ?? "ai-tools";
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
function Y(e) {
  var a;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let r = e.toFixed(4).replace(/0+$/, "");
  return (((a = r.split(".")[1]) == null ? void 0 : a.length) ?? 0) < 2 && (r = e.toFixed(2)), "$" + r;
}
function Oe(e, r) {
  var n;
  return r && Number.isFinite(r.cost) ? { current: r.cost, original: r.original_cost && r.original_cost > r.cost ? r.original_cost : null, from: !1 } : ((n = e.sale) == null ? void 0 : n.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const De = "muapi-studio:history:v1", dt = 200;
function ke() {
  try {
    const e = localStorage.getItem(De);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function ut(e) {
  try {
    localStorage.setItem(De, JSON.stringify(e.slice(0, dt)));
  } catch {
  }
}
const mt = () => {
  var e, r;
  return ((r = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : r.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, Ce = (e, r) => {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : r;
  } catch {
    return r;
  }
}, Se = (e, r) => {
  try {
    localStorage.setItem(e, JSON.stringify(r));
  } catch {
  }
}, Ie = "muapi-studio:labels:v1", Me = "muapi-studio:hidden:v1";
function pt(e, r, n) {
  const [a, d] = N(() => ke()), [s, l] = N([]), [b, g] = N(null), [h, $] = N(!1), [f, k] = N(null), j = H(!1), [v, A] = N(() => Ce(Ie, {})), [I, T] = N(() => Ce(Me, [])), S = H(/* @__PURE__ */ new Set()), i = H(new AbortController()), m = H([]);
  m.current = r ?? [], P(() => ut(a), [a]), P(() => Se(Ie, v), [v]), P(() => Se(Me, I), [I]), P(() => (i.current = new AbortController(), () => i.current.abort()), []);
  const x = V((o, u) => d((w) => w.map((C) => C.id === o ? { ...C, ...u } : C)), []), L = V(async (o, u) => {
    if (!S.current.has(o)) {
      S.current.add(o);
      try {
        const w = await We(e, u, {
          signal: i.current.signal,
          onUpdate: (C) => x(o, { status: C.status, outputs: C.outputs, error: C.error, cost: C.cost })
        });
        x(o, { status: w.status, outputs: w.outputs, error: w.error, cost: w.cost }), n == null || n();
      } catch (w) {
        w.name !== "AbortError" && x(o, { status: "failed", error: w.message });
      } finally {
        S.current.delete(o);
      }
    }
  }, [e, x, n]);
  P(() => {
    for (const o of ke()) (o.status === "pending" || o.status === "processing") && o.requestId && L(o.id, o.requestId);
  }, []);
  const p = V(async (o = !1) => {
    if (!j.current) {
      $(!0), k(null);
      try {
        const u = await e.history(o ? void 0 : b ?? void 0), w = u.items.map((C) => st(C, m.current));
        l((C) => o ? w : [...C, ...w]), g(u.next_cursor);
      } catch (u) {
        u instanceof ne && [403, 404, 405].includes(u.status) ? (j.current = !0, g(null)) : k(u.message);
      } finally {
        $(!1);
      }
    }
  }, [e, b]), E = H(!1);
  P(() => {
    r && !E.current && (E.current = !0, p(!0));
  }, [r, p]);
  const J = V((o) => {
    const u = Array.from({ length: o.count }, () => ({
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
    return d((w) => [...u, ...w]), Promise.all(u.map(async (w) => {
      try {
        const { requestId: C, cost: q } = await e.submit(o.endpointUrl, o.payload, o.kind);
        x(w.id, { requestId: C, ...q !== void 0 ? { cost: q } : {} }), await L(w.id, C);
      } catch (C) {
        x(w.id, { status: "failed", error: C.message });
      }
    }));
  }, [e, x, L]), U = W(() => {
    const o = (u) => ({ ...u, label: u.requestId && v[u.requestId] || u.label });
    return lt(a.map(o), s.map(o), new Set(I));
  }, [a, s, v, I]), K = V((o, u) => {
    o.requestId && A((w) => {
      const C = { ...w };
      return u ? C[o.requestId] = u : delete C[o.requestId], C;
    }), x(o.id, { label: u });
  }, [x]), B = V((o) => {
    d((u) => u.filter((w) => w.id !== o.id)), o.requestId && T((u) => [.../* @__PURE__ */ new Set([...u, o.requestId])]);
  }, []), X = V(async (o) => {
    o.requestId && (await e.deleteMedia(o.requestId), x(o.id, { outputs: [] }), l((u) => u.map((w) => w.requestId === o.requestId ? { ...w, outputs: [] } : w)));
  }, [e, x]);
  return { items: U, run: J, setLabel: K, remove: B, deleteMedia: X, loadMore: () => p(!1), hasMore: !!b, loadingMore: h, serverError: f };
}
const ht = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Re(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : ht.test(e) ? "file" : "image" : "text";
}
function ft(e) {
  const r = e.trim();
  if (!/^[\[{]/.test(r)) return e;
  try {
    return JSON.stringify(JSON.parse(r), null, 2);
  } catch {
    return e;
  }
}
const R = ({ children: e, ...r }) => /* @__PURE__ */ t("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...r, children: e }), le = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ t("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ t("path", { d: "m21 15-4.5-4.5L6 21" })
] }), bt = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ t("path", { d: "m16 10 6-3v10l-6-3" })
] }), xt = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ t("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ t("circle", { cx: "17", cy: "16", r: "3" })
] }), yt = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ t("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ t("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), Ue = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ t("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), gt = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ t("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Pe = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), vt = ({ filled: e, ...r }) => /* @__PURE__ */ t(R, { ...r, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ t("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Fe = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ t("path", { d: "m20 20-3.5-3.5" })
] }), ze = ({ up: e, ...r }) => /* @__PURE__ */ t(R, { ...r, children: /* @__PURE__ */ t("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), wt = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), Nt = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ t("circle", { cx: "12", cy: "12", r: "3" })
] }), ye = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), ge = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "m5 12 5 5 9-10" }) }), oe = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "M6 6l12 12M18 6 6 18" }) }), Ve = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), kt = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ t("path", { d: "M12 11v5M12 8v.01" })
] }), ie = (e) => /* @__PURE__ */ t(R, { ...e, className: "ms-spin", children: /* @__PURE__ */ t("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Ct = (e) => /* @__PURE__ */ t(R, { ...e, children: /* @__PURE__ */ t("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), St = (e) => /* @__PURE__ */ c(R, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), It = ["All", "Approved", "Rejected", "Unlabeled"], Mt = [1, 2, 4, 6, 8];
function $t({ url: e, hidden: r, onOpen: n }) {
  const a = r ? { filter: "blur(18px)" } : void 0, d = Re(e);
  return d === "text" ? /* @__PURE__ */ t("pre", { tabIndex: 0, "aria-label": "Generated text", style: a, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: ft(e) }) : d === "video" ? /* @__PURE__ */ t("video", { src: e, controls: !0, preload: "metadata", style: a, className: "aspect-video w-full bg-black object-contain" }) : d === "audio" ? /* @__PURE__ */ t("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ t("audio", { src: e, controls: !0, className: "w-full" }) }) : d === "3d" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ t(Ue, { width: 32, height: 32 }),
    "Open 3D model"
  ] }) : d === "file" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ t(ye, { width: 28, height: 28 }),
    /* @__PURE__ */ t("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ t("button", { type: "button", onClick: n, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ t("img", { src: e, alt: "Generated output", loading: "lazy", style: a, className: "aspect-square w-full bg-black object-contain" }) });
}
function At({ g: e, hidden: r, onLabel: n, onRemove: a, onReuse: d, onRerun: s, onDeleteMedia: l, onOpen: b, estimateFor: g }) {
  const h = e.outputs[0], $ = !!h && Re(h) === "text", [f, k] = N(!1), [j, v] = N(null), A = _e(), I = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", T = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ c("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && h ? /* @__PURE__ */ t($t, { url: h, hidden: r, onOpen: () => b(h) }) : e.status === "failed" ? /* @__PURE__ */ c("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ t(oe, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ t("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ c("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ t(ie, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ c("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ t("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ c("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ t("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ t("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? Y(e.cost) : e.status === "completed" && (g == null ? void 0 : g(e.model)) !== void 0 ? `est. ${Y(g(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && h && ($ ? /* @__PURE__ */ t("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(h)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${T} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ t(ye, { width: 14, height: 14 }) }) : /* @__PURE__ */ t("a", { href: h, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${T} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ t(ye, { width: 14, height: 14 }) })),
        /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => n(e, e.label === "approved" ? null : "approved"),
            className: `${T} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ t(ge, { width: 14, height: 14 })
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
            className: `${T} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ t(oe, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ t("button", { type: "button", onClick: () => d(e), title: "Load this model and settings back into the form", className: I, children: "Reuse" }),
        /* @__PURE__ */ t("button", { type: "button", onClick: () => s(e), title: "Generate again with the same settings", className: I, children: "Re-run" }),
        e.status === "completed" && h && /* @__PURE__ */ t("button", { type: "button", onClick: () => {
          var S;
          (S = navigator.clipboard) == null || S.writeText(h).then(() => {
            k(!0), setTimeout(() => k(!1), 1500);
          });
        }, className: I, children: f ? "Copied" : $ ? "Copy text" : "Copy link" })
      ] }),
      j && /* @__PURE__ */ c("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        j
      ] }),
      /* @__PURE__ */ c("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ c("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ c("span", { className: "flex shrink-0 gap-3", children: [
          A.deleteMedia && e.requestId && e.status === "completed" && h && /* @__PURE__ */ t("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (v(null), l(e).catch((S) => v(S.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ t("button", { type: "button", onClick: () => a(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Lt({ url: e, onClose: r }) {
  return P(() => {
    const n = (a) => a.key === "Escape" && r();
    return document.addEventListener("keydown", n), () => document.removeEventListener("keydown", n);
  }, [r]), /* @__PURE__ */ c("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: r, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ t("button", { type: "button", "aria-label": "Close preview", onClick: r, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ t(oe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ t("img", { src: e, alt: "Full size output", onClick: (n) => n.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function jt({ mode: e, items: r, batch: n, onBatch: a, onLabel: d, onRemove: s, onReuse: l, onRerun: b, onDeleteMedia: g, onLoadMore: h, hasMore: $, loadingMore: f, serverError: k, estimateFor: j }) {
  const [v, A] = N("All"), [I, T] = N(""), [S, i] = N(!1), [m, x] = N(null), L = W(() => {
    const p = I.trim().toLowerCase();
    return r.filter((E) => E.mode !== e || v === "Approved" && E.label !== "approved" || v === "Rejected" && E.label !== "rejected" || v === "Unlabeled" && E.label !== null ? !1 : !p || E.prompt.toLowerCase().includes(p) || E.model.toLowerCase().includes(p));
  }, [r, e, v, I]);
  return /* @__PURE__ */ c("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ t("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: It.map((p) => /* @__PURE__ */ t(
        "button",
        {
          role: "tab",
          "aria-selected": v === p,
          onClick: () => A(p),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${v === p ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: p
        },
        p
      )) }),
      /* @__PURE__ */ c("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ t(Fe, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ t("input", { value: I, onChange: (p) => T(p.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ t("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Mt.map((p) => /* @__PURE__ */ t(
        "button",
        {
          role: "radio",
          "aria-checked": n === p,
          onClick: () => a(p),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${n === p ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: p
        },
        p
      )) }),
      /* @__PURE__ */ t("button", { type: "button", "aria-pressed": S, "aria-label": S ? "Show previews" : "Hide previews", title: S ? "Show previews" : "Hide previews", onClick: () => i((p) => !p), className: S ? "text-primary" : "text-secondary hover:text-fg", children: S ? /* @__PURE__ */ t(wt, { width: 18, height: 18 }) : /* @__PURE__ */ t(Nt, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      L.length === 0 ? /* @__PURE__ */ c("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ t("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ t(Pe, { width: 36, height: 36 }) }),
        /* @__PURE__ */ t("p", { className: "font-semibold", children: r.some((p) => p.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ t("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: r.some((p) => p.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ t("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: L.map((p) => /* @__PURE__ */ t(At, { g: p, hidden: S, onLabel: d, onRemove: s, onReuse: l, onRerun: b, onDeleteMedia: g, onOpen: x, estimateFor: j }, p.id)) }),
      k && /* @__PURE__ */ c("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        k
      ] }),
      $ && /* @__PURE__ */ t("div", { className: "mt-4 text-center", children: /* @__PURE__ */ t("button", { type: "button", disabled: f, onClick: h, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: f ? "Loading…" : "Load more history" }) }),
      m && /* @__PURE__ */ t(Lt, { url: m, onClose: () => x(null) })
    ] })
  ] });
}
const Tt = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, _t = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function qt(e) {
  var r;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((r = e.items) == null ? void 0 : r.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Tt.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || _t.test(e.name) ? "media" : "text" : "text";
}
function $e(e) {
  var l, b;
  const r = (b = (l = e.input_schema) == null ? void 0 : l.schemas) == null ? void 0 : b.input_data, n = (r == null ? void 0 : r.properties) ?? {}, a = (r == null ? void 0 : r["x-order-properties"]) ?? e.input_fields ?? Object.keys(n), d = [...a.filter((g) => n[g]), ...Object.keys(n).filter((g) => !a.includes(g))], s = new Set(e.required_fields ?? []);
  return d.map((g) => ({ prop: { ...n[g], name: g }, kind: qt({ ...n[g], name: g }), required: s.has(g) }));
}
function fe(e) {
  var n;
  const r = {};
  for (const { prop: a, kind: d, required: s } of e)
    a.default !== void 0 && a.default !== null ? r[a.name] = a.default : s && (d === "textarea" || d === "text") && typeof ((n = a.examples) == null ? void 0 : n[0]) == "string" && (r[a.name] = a.examples[0]);
  return r;
}
const ce = (e) => `__auto:${e}`, Et = (e) => e.kind === "number" && !e.required, ve = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function Ae(e, r) {
  const n = {};
  for (const { prop: a, kind: d } of e) {
    if (r[ce(a.name)] === !0) continue;
    const s = r[a.name] ?? a.default;
    if (!ve(s))
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
    if (r[ce(n.name)] === !0) continue;
    const s = r[n.name] ?? n.default, l = n.title || n.name;
    if (d && ve(s)) return `${l} is required`;
    if (a === "json" && typeof s == "string" && s)
      try {
        JSON.parse(s);
      } catch {
        return `${l} must be valid JSON`;
      }
    if (a === "number" && !ve(s)) {
      const b = Number(s);
      if (!Number.isFinite(b)) return `${l} must be a number`;
      if (n.minValue !== void 0 && b < n.minValue) return `${l} must be at least ${n.minValue}`;
      if (n.maxValue !== void 0 && b > n.maxValue) return `${l} must be at most ${n.maxValue}`;
    }
  }
  return null;
}
const Dt = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Rt({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ t("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ t("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ t("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ t(le, {}) });
}
function Ut({ client: e, max: r, initialType: n = "image", onInsert: a, onClose: d }) {
  const [s, l] = N(n), [b, g] = N(""), [h, $] = N(1), [f, k] = N(null), [j, v] = N(null), [A, I] = N(!1), [T, S] = N([]), [i, m] = N(""), [x, L] = N(!1), p = H(null), E = H(null), J = V(async () => {
    I(!0), v(null);
    try {
      k(await e.mediaLibrary({ mediaType: s, search: b, page: h }));
    } catch (o) {
      v(o.message);
    } finally {
      I(!1);
    }
  }, [e, s, b, h]);
  P(() => {
    const o = setTimeout(J, b ? 300 : 0);
    return () => clearTimeout(o);
  }, [J, b]), P(() => {
    $(1);
  }, [s, b]), P(() => {
    var w;
    const o = document.activeElement;
    (w = p.current) == null || w.focus();
    const u = (C) => {
      if (C.key === "Escape") {
        C.stopPropagation(), d();
        return;
      }
      if (C.key !== "Tab" || !p.current) return;
      const q = [...p.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!q.length) return;
      const O = q[0], F = q[q.length - 1];
      C.shiftKey && document.activeElement === O ? (C.preventDefault(), F.focus()) : !C.shiftKey && document.activeElement === F && (C.preventDefault(), O.focus());
    };
    return document.addEventListener("keydown", u), () => {
      var C;
      document.removeEventListener("keydown", u), (C = o == null ? void 0 : o.focus) == null || C.call(o);
    };
  }, [d]);
  const U = (o) => S((u) => u.includes(o) ? u.filter((w) => w !== o) : r === 1 ? [o] : u.length < r ? [...u, o] : u), K = async (o) => {
    if (o.length) {
      I(!0), v(null);
      try {
        for (const u of o) {
          const w = await e.upload(u);
          await e.saveToLibrary({ url: w, name: u.name, mime_type: u.type || void 0, size_bytes: u.size, media_type: u.type.startsWith("video") ? "video" : u.type.startsWith("audio") ? "audio" : u.type.startsWith("image") ? "image" : "archive" });
        }
        await J();
      } catch (u) {
        v(u.message), I(!1);
      }
    }
  }, B = async () => {
    var u;
    const o = i.trim();
    if (!/^https?:\/\//i.test(o)) {
      v("Enter a full http(s) URL");
      return;
    }
    I(!0), v(null);
    try {
      const w = ((u = o.split("?")[0].split(".").pop()) == null ? void 0 : u.toLowerCase()) ?? "", C = ["mp4", "webm", "mov"].includes(w) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(w) ? "audio" : ["zip", "rar", "7z"].includes(w) ? "archive" : "image";
      await e.saveToLibrary({ url: o, name: o.split("/").pop() || "link", media_type: C }), m(""), L(!1), await J();
    } catch (w) {
      v(w.message), I(!1);
    }
  }, X = async (o) => {
    if (window.confirm(`Delete "${o.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(o.id), S((u) => u.filter((w) => w !== o.url)), await J();
      } catch (u) {
        v(u.message);
      }
  };
  return /* @__PURE__ */ t("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (o) => {
    o.target === o.currentTarget && d();
  }, children: /* @__PURE__ */ c("div", { ref: p, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ c("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ t("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ t(le, {}) }),
      /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ c("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ c("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
            (f == null ? void 0 : f.total) ?? 0,
            " ",
            (f == null ? void 0 : f.total) === 1 ? "item" : "items"
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
      /* @__PURE__ */ t("input", { ref: E, type: "file", hidden: !0, multiple: !0, onChange: (o) => {
        const u = Array.from(o.target.files ?? []);
        o.target.value = "", K(u);
      } }),
      /* @__PURE__ */ c("button", { type: "button", onClick: () => {
        var o;
        return (o = E.current) == null ? void 0 : o.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ t(Ve, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ t("button", { type: "button", "aria-label": "Close", onClick: d, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ t(oe, {}) })
    ] }),
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Dt.map((o) => /* @__PURE__ */ t("button", { role: "tab", "aria-selected": s === o.id, onClick: () => l(o.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${s === o.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: o.label }, o.id)) }),
      /* @__PURE__ */ t("input", { value: b, onChange: (o) => g(o.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ t("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": x, onClick: () => L((o) => !o), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    x && /* @__PURE__ */ c("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ t("input", { value: i, onChange: (o) => m(o.target.value), onKeyDown: (o) => o.key === "Enter" && void B(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ t("button", { type: "button", onClick: () => void B(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      j && /* @__PURE__ */ t("p", { role: "alert", className: "mb-3 text-sm text-danger", children: j }),
      A && !f ? /* @__PURE__ */ c("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ t(ie, {}),
        " Loading…"
      ] }) : f != null && f.items.length ? /* @__PURE__ */ t("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: f.items.map((o) => {
        const u = T.includes(o.url);
        return /* @__PURE__ */ c("li", { className: `group relative overflow-hidden rounded-card border ${u ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ t("button", { type: "button", "aria-pressed": u, "aria-label": `${u ? "Deselect" : "Select"} ${o.name ?? "file"}`, onClick: () => U(o.url), className: "block aspect-square w-full", children: /* @__PURE__ */ t(Rt, { a: o }) }),
          u && /* @__PURE__ */ t("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ t(ge, { width: 12, height: 12 }) }),
          /* @__PURE__ */ t("button", { type: "button", "aria-label": `Delete ${o.name ?? "file"}`, onClick: () => void X(o), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ t(oe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ t("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: o.name ?? "", children: o.name })
        ] }, o.id);
      }) }) : /* @__PURE__ */ c("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ t("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ t(le, { width: 28, height: 28 }) }),
        /* @__PURE__ */ t("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ t("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      f && f.total_pages > 1 && /* @__PURE__ */ c("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ t("button", { type: "button", disabled: h <= 1, onClick: () => $((o) => o - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        h,
        " of ",
        f.total_pages,
        /* @__PURE__ */ t("button", { type: "button", disabled: h >= f.total_pages, onClick: () => $((o) => o + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ c("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ c("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ t("b", { className: "text-primary", children: T.length }),
        " of ",
        r,
        " selected"
      ] }),
      /* @__PURE__ */ c("button", { type: "button", disabled: !T.length, onClick: () => {
        a(T), d();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ t(ge, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const Je = (e, r = "") => {
  const n = `${e ?? ""} ${r}`.toLowerCase();
  return n.includes("video") ? "video/*" : n.includes("audio") || n.includes("voice") ? "audio/*" : n.includes("image") || n.includes("mask") || n.includes("photo") || n.includes("face") ? "image/*" : void 0;
}, Pt = (e, r = "") => {
  const n = Je(e, r);
  return n === "video/*" ? "video" : n === "audio/*" ? "audio" : n === "image/*" ? "image" : "all";
}, Ft = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function zt(e, r) {
  const n = await Promise.all(r.map((a) => e.upload(a)));
  return r.forEach((a, d) => void e.saveToLibrary({ url: n[d], name: a.name, mime_type: a.type || void 0, size_bytes: a.size, media_type: Ft(a) }).catch(() => {
  })), n;
}
function Le({ client: e, field: r, multiple: n, max: a, current: d, onUrls: s, onError: l }) {
  const b = H(null), [g, h] = N(!1), [$, f] = N(!1), [k, j] = N(!1), v = a - d.length, A = _e(), I = async (i) => {
    if (i.length) {
      h(!0);
      try {
        s(await zt(e, n ? i.slice(0, Math.max(v, 1)) : i.slice(0, 1)));
      } catch (m) {
        l(m.message);
      } finally {
        h(!1);
      }
    }
  }, T = Je(r.prop.field, r.prop.name), S = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ c(
    "div",
    {
      onDragOver: (i) => {
        i.preventDefault(), f(!0);
      },
      onDragLeave: () => f(!1),
      onDrop: (i) => {
        i.preventDefault(), f(!1), I(Array.from(i.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${$ ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ t("input", { ref: b, type: "file", hidden: !0, accept: T, multiple: n, onChange: (i) => {
          const m = Array.from(i.target.files ?? []);
          i.target.value = "", I(m);
        } }),
        (n ? v > 0 : !0) && /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
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
          /* @__PURE__ */ t("button", { type: "button", disabled: g, onClick: () => {
            var i;
            return (i = b.current) == null ? void 0 : i.click();
          }, "aria-label": "Upload file", title: "Upload file", className: S, children: g ? /* @__PURE__ */ t(ie, { width: 16, height: 16 }) : /* @__PURE__ */ t(Ve, { width: 16, height: 16 }) }),
          A.library && /* @__PURE__ */ t("button", { type: "button", onClick: () => j(!0), "aria-label": "Choose from media library", title: "Media library", className: S, children: /* @__PURE__ */ c("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ t("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ t("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ t("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        k && A.library && /* @__PURE__ */ t(Ut, { client: e, max: n ? Math.max(v, 1) : 1, initialType: Pt(r.prop.field, r.prop.name), onInsert: s, onClose: () => j(!1) })
      ]
    }
  );
}
function Vt({ field: e, values: r, onChange: n, client: a, onError: d, tagCount: s = 0 }) {
  const { prop: l, kind: b, required: g } = e, h = r[l.name], $ = (i) => n(l.name, i), f = l.title || l.name, k = `ms-f-${l.name}`, j = h == null ? "" : String(h), v = Array.isArray(h) ? h : [], A = r[ce(l.name)] === !0, I = H(null), T = (i) => {
    const m = I.current, x = typeof h == "string" ? h : "", L = (m == null ? void 0 : m.selectionStart) ?? x.length, p = (m == null ? void 0 : m.selectionEnd) ?? L;
    $(x.slice(0, L) + i + " " + x.slice(p)), requestAnimationFrame(() => {
      m == null || m.focus(), m == null || m.setSelectionRange(L + i.length + 1, L + i.length + 1);
    });
  };
  let S;
  if (b === "textarea" || b === "json")
    S = /* @__PURE__ */ c(we, { children: [
      /* @__PURE__ */ t("textarea", { ref: I, id: k, rows: b === "json" ? 4 : 5, value: typeof h == "string" ? h : h ? JSON.stringify(h, null, 2) : "", onChange: (i) => $(i.target.value), className: `w-full resize-y p-3 text-sm ${b === "json" ? "font-mono text-xs" : ""}` }),
      l.name === "prompt" && s > 0 && /* @__PURE__ */ c("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ t("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(s, 9) }, (i, m) => `@image${m + 1}`).map((i) => /* @__PURE__ */ t("button", { type: "button", onClick: () => T(i), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: i }, i))
      ] })
    ] });
  else if (b === "select") {
    const i = l.enum ?? [], m = i.findIndex((x) => String(x) === j);
    S = /* @__PURE__ */ c("select", { id: k, value: m >= 0 ? m : "", onChange: (x) => $(i[Number(x.target.value)]), className: "w-full px-3 py-3 text-sm", children: [
      m < 0 && /* @__PURE__ */ t("option", { value: "", children: "Select…" }),
      i.map((x, L) => /* @__PURE__ */ t("option", { value: L, children: String(x) }, String(x)))
    ] });
  } else if (b === "boolean") {
    const i = h === !0;
    S = /* @__PURE__ */ t(
      "button",
      {
        id: k,
        type: "button",
        role: "switch",
        "aria-checked": i,
        onClick: () => $(!i),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${i ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ t("span", { className: `h-5 w-5 rounded-full ${i ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (b === "number") {
    const i = l.minValue !== void 0 && l.maxValue !== void 0;
    S = /* @__PURE__ */ c("div", { className: `flex items-center gap-3 ${A ? "opacity-40" : ""}`, children: [
      i && /* @__PURE__ */ t("input", { type: "range", disabled: A, "aria-label": `${f} slider`, min: l.minValue, max: l.maxValue, step: l.step ?? (l.type === "number" ? 0.01 : 1), value: j === "" ? l.minValue : Number(j), onChange: (m) => $(Number(m.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ t("input", { id: k, type: "number", disabled: A, min: l.minValue, max: l.maxValue, step: l.step ?? (l.type === "number" ? "any" : 1), value: j, onChange: (m) => $(m.target.value === "" ? "" : Number(m.target.value)), className: `px-3 py-2 text-sm ${i ? "w-24" : "w-full"}` })
    ] });
  } else if (b === "media")
    S = /* @__PURE__ */ t(Le, { client: a, field: e, multiple: !1, max: 1, current: j ? [j] : [], onUrls: (i) => $(i[0]), onError: d });
  else if (b === "media-list") {
    const i = l.maxItems ?? 8;
    S = /* @__PURE__ */ c("div", { className: "space-y-2", children: [
      v.map((m, x) => /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ t("input", { "aria-label": `${f} ${x + 1}`, value: m, onChange: (L) => $(v.map((p, E) => E === x ? L.target.value : p)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ t("button", { type: "button", "aria-label": `Remove ${f} ${x + 1}`, onClick: () => $(v.filter((L, p) => p !== x)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ t(oe, { width: 14, height: 14 }) })
      ] }, x)),
      /* @__PURE__ */ t(Le, { client: a, field: e, multiple: !0, max: i, current: v, onUrls: (m) => $([...v, ...m].slice(0, i)), onError: d })
    ] });
  } else
    S = /* @__PURE__ */ t("input", { id: k, value: j, onChange: (i) => $(i.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ c("div", { className: "mb-5", children: [
    /* @__PURE__ */ c("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ c("label", { htmlFor: k, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        f,
        l.description && /* @__PURE__ */ t("span", { title: l.description, className: "text-muted", children: /* @__PURE__ */ t(kt, { width: 13, height: 13 }) })
      ] }),
      Et(e) ? /* @__PURE__ */ c("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ t("input", { type: "checkbox", checked: A, onChange: (i) => n(ce(l.name), i.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ t("span", { className: "text-[11px] text-primary", children: b === "media-list" ? `${v.length}/${l.maxItems ?? 8} items${g ? " · required" : ""}` : g ? "* required" : "" })
    ] }),
    S
  ] });
}
const se = 200;
function Jt({ model: e }) {
  const r = Oe(e);
  return r ? /* @__PURE__ */ c("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    r.original !== null && /* @__PURE__ */ t("s", { className: "font-normal text-muted", children: Y(r.original) }),
    r.from && r.original !== null ? "from " : "",
    Y(r.current)
  ] }) : null;
}
function Gt({ models: e, value: r, onChange: n, favorites: a, onToggleFavorite: d, usage: s, showGroup: l }) {
  var S;
  const [b, g] = N(!1), [h, $] = N(""), [f, k] = N("popular"), j = H(null);
  P(() => {
    if (!b) return;
    const i = (x) => {
      var L;
      (L = j.current) != null && L.contains(x.target) || g(!1);
    }, m = (x) => {
      x.key === "Escape" && g(!1);
    };
    return document.addEventListener("mousedown", i), document.addEventListener("keydown", m), () => {
      document.removeEventListener("mousedown", i), document.removeEventListener("keydown", m);
    };
  }, [b]);
  const v = W(() => {
    const i = h.trim().toLowerCase(), m = i ? e.filter((p) => p.name.toLowerCase().includes(i) || p.category.toLowerCase().includes(i)) : e, x = Ee(m, f, { usage: s, favorites: a });
    if (f === "favourites" || f === "most-used") return x;
    const L = new Set(a);
    return [...x.filter((p) => L.has(p.name)), ...x.filter((p) => !L.has(p.name))];
  }, [e, h, f, a, s]), [A, I] = N(0);
  P(() => I(0), [h, f, b]);
  const T = (i) => {
    i.key === "ArrowDown" ? (i.preventDefault(), I((m) => Math.min(m + 1, Math.min(v.length, se) - 1))) : i.key === "ArrowUp" ? (i.preventDefault(), I((m) => Math.max(m - 1, 0))) : i.key === "Enter" && v[A] && (i.preventDefault(), n(v[A].name), g(!1));
  };
  return P(() => {
    var i, m;
    (m = (i = document.getElementById(`ms-opt-${A}`)) == null ? void 0 : i.scrollIntoView) == null || m.call(i, { block: "nearest" });
  }, [A]), /* @__PURE__ */ c("div", { ref: j, className: "relative", children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        onClick: () => g((i) => !i),
        "aria-haspopup": "listbox",
        "aria-expanded": b,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ t("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (S = (r ?? "?")[0]) == null ? void 0 : S.toUpperCase() }),
          /* @__PURE__ */ t("span", { className: "min-w-0 flex-1 truncate", children: r ?? "Select a model" }),
          /* @__PURE__ */ t(ze, { up: b, width: 16, height: 16 })
        ]
      }
    ),
    b && /* @__PURE__ */ c("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ c("div", { className: "mb-2 flex gap-2", children: [
        /* @__PURE__ */ c("label", { className: "relative flex-1", children: [
          /* @__PURE__ */ t(Fe, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
          /* @__PURE__ */ t("input", { autoFocus: !0, onKeyDown: T, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${A}`, value: h, onChange: (i) => $(i.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
        ] }),
        /* @__PURE__ */ t("select", { value: f, onChange: (i) => k(i.target.value), "aria-label": "Sort models", className: "px-2 text-xs", children: at.map((i) => /* @__PURE__ */ t("option", { value: i.id, children: i.label }, i.id)) })
      ] }),
      /* @__PURE__ */ c("ul", { id: "ms-listbox", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        v.slice(0, se).map((i, m) => {
          const x = i.name === r;
          return /* @__PURE__ */ c(
            "li",
            {
              id: `ms-opt-${m}`,
              role: "option",
              "aria-selected": x,
              onClick: () => {
                n(i.name), g(!1);
              },
              className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${x ? "bg-primary-soft" : m === A ? "bg-card-bg" : "hover:bg-card-bg"}`,
              children: [
                /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ t("div", { className: `truncate text-sm ${x ? "text-primary" : ""}`, children: i.name }),
                  /* @__PURE__ */ t("div", { className: "text-[10px] text-secondary", children: l ? `${i.group_of} · ${i.category}` : i.category })
                ] }),
                /* @__PURE__ */ t(
                  "button",
                  {
                    type: "button",
                    "aria-label": a.includes(i.name) ? "Remove favorite" : "Add favorite",
                    onClick: (L) => {
                      L.stopPropagation(), d(i.name);
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
        v.length === 0 && /* @__PURE__ */ t("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: f === "favourites" ? "No favourites yet. Tap the heart on a model." : f === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${h}”.` }),
        v.length > se && /* @__PURE__ */ c("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
          "Showing ",
          se,
          " of ",
          v.length,
          ". Refine your search."
        ] })
      ] })
    ] })
  ] });
}
const je = (e, r) => {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : r;
  } catch {
    return r;
  }
}, be = (e, r) => {
  try {
    localStorage.setItem(e, JSON.stringify(r));
  } catch {
  }
}, Ht = 0.25;
function Bt({ mode: e, models: r, client: n, batch: a, onRun: d, usage: s, reuse: l }) {
  const b = ae.find((y) => y.id === e), g = W(() => nt(r, e), [r, e]), [h, $] = N(), [f, k] = N(null), [j, v] = N(null), [A, I] = N({}), [T, S] = N(null), [i, m] = N(null), [x, L] = N(() => je("muapi-studio:favorites", [])), [p, E] = N("form"), [J, U] = N(!1), [K, B] = N("{}"), [X, o] = N(null), u = H(0), w = H(null);
  P(() => {
    var D, G, re;
    const y = je(`muapi-studio:model:${e}`, null), _ = ((D = g.find((te) => te.name === y)) == null ? void 0 : D.name) ?? ((G = g.find((te) => te.name === tt[e])) == null ? void 0 : G.name) ?? ((re = Ee(g, "popular")[0]) == null ? void 0 : re.name);
    $(_);
  }, [e, g]), P(() => {
    l && (w.current = l.inputs, g.some((y) => y.name === l.model) && ($(l.model), be(`muapi-studio:model:${e}`, l.model)), E("form"));
  }, [l == null ? void 0 : l.nonce]);
  const C = g.find((y) => y.name === h);
  P(() => {
    if (!h) return;
    let y = !0;
    return k(null), v(null), S(null), m(null), o(null), n.model(h).then((_) => {
      if (!y) return;
      const D = $e(_), G = fe(D), re = w.current;
      if (w.current = null, re)
        for (const te of D) re[te.prop.name] !== void 0 && (G[te.prop.name] = re[te.prop.name]);
      k(_), I(G);
    }).catch((_) => {
      y && v(_.message);
    }), () => {
      y = !1;
    };
  }, [h, n]);
  const q = W(() => f ? $e(f) : [], [f]), O = W(() => Ae(q, A), [q, A]), F = W(() => {
    try {
      const y = JSON.parse(K);
      return y && typeof y == "object" && !Array.isArray(y) ? y : null;
    } catch {
      return null;
    }
  }, [K]), ee = p === "json" ? F ?? {} : O, de = JSON.stringify(ee);
  P(() => {
    if (!f || p === "json" && !F) return;
    const y = ++u.current, _ = setTimeout(() => {
      n.estimate(f.name, ee).then((D) => {
        y === u.current && S(D);
      }).catch(() => {
        y === u.current && S(null);
      });
    }, 500);
    return () => clearTimeout(_);
  }, [f, de, n]);
  const ue = (y) => {
    $(y), be(`muapi-studio:model:${e}`, y);
  }, me = (y) => L((_) => {
    const D = _.includes(y) ? _.filter((G) => G !== y) : [..._, y];
    return be("muapi-studio:favorites", D), D;
  }), pe = (y) => {
    U(!1), y !== p && (y === "json" ? B(JSON.stringify(O, null, 2)) : F && I((_) => {
      const D = { ..._ };
      for (const G of q) F[G.prop.name] !== void 0 && (D[G.prop.name] = F[G.prop.name]);
      return D;
    }), E(y), m(null));
  }, M = C ? Oe(C, T) : null, z = V(async () => {
    if (!f) return;
    o(null);
    const y = q.find((_) => _.prop.name === "prompt");
    await d({
      model: f.name,
      endpointUrl: f.endpoint_url,
      mode: e,
      payload: ee,
      count: a,
      kind: qe(f.category),
      prompt: y ? String(ee.prompt ?? "") : "",
      unitCost: M == null ? void 0 : M.current
    });
  }, [f, q, d, e, ee, a, M]), Z = V(async () => {
    if (!f) return;
    if (p === "json") {
      if (!F) {
        m("The JSON is not valid");
        return;
      }
      const _ = (f.required_fields ?? []).find((D) => F[D] === void 0 || F[D] === "");
      if (_) {
        m(`${_} is required`);
        return;
      }
    } else {
      const _ = Ot(q, A);
      if (_) {
        m(_);
        return;
      }
    }
    m(null);
    const y = ((M == null ? void 0 : M.current) ?? 0) * a;
    if (y > Ht) {
      o(y);
      return;
    }
    await z();
  }, [f, p, F, q, A, M, a, z]), Q = !!f && !j, he = (() => {
    var _;
    const y = q.find((D) => D.kind === "media-list");
    return y ? Math.max(((_ = A[y.prop.name]) == null ? void 0 : _.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ c("section", { "aria-label": b.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ c("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ t("h2", { className: "text-lg font-semibold", children: b.title }),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ c("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": J, onClick: () => U((y) => !y), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            p === "json" ? "JSON" : "Form",
            /* @__PURE__ */ t(ze, { up: J, width: 12, height: 12 })
          ] }),
          J && /* @__PURE__ */ t("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((y) => /* @__PURE__ */ t("li", { role: "none", children: /* @__PURE__ */ t("button", { role: "menuitemradio", "aria-checked": p === y, type: "button", onClick: () => pe(y), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${p === y ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: y === "json" ? "JSON" : "Form" }) }, y)) })
        ] })
      ] }),
      /* @__PURE__ */ t("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ t("div", { className: "mb-5", children: /* @__PURE__ */ t(Gt, { models: g, value: h, onChange: ue, favorites: x, onToggleFavorite: me, usage: s, showGroup: e === "text" || e === "more" }) }),
      /* @__PURE__ */ t("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: p === "json" ? "Request body" : "Parameters" }),
      (C == null ? void 0 : C.description) && /* @__PURE__ */ t("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: C.description }),
      !Q && !j && h && /* @__PURE__ */ c("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ t(ie, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      j && /* @__PURE__ */ c("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        j
      ] }),
      g.length === 0 && /* @__PURE__ */ t("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      Q && p === "json" && /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ t("textarea", { "aria-label": "Request JSON", "aria-invalid": !F, spellCheck: !1, rows: 16, value: K, onChange: (y) => B(y.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ t("p", { className: `mt-1.5 text-[11px] ${F ? "text-muted" : "text-danger"}`, children: F ? `Sent as the body of POST /api/v1/${f.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      Q && p === "form" && q.map((y) => /* @__PURE__ */ t(
        Vt,
        {
          field: y,
          values: A,
          client: n,
          onError: m,
          tagCount: y.prop.name === "prompt" ? he : 0,
          onChange: (_, D) => I((G) => ({ ...G, [_]: D }))
        },
        y.prop.name
      ))
    ] }),
    /* @__PURE__ */ c("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      i && /* @__PURE__ */ t("p", { role: "alert", className: "mb-2 text-xs text-danger", children: i }),
      X !== null && /* @__PURE__ */ c("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ t("b", { className: "text-primary", children: Y(X) }),
        " (",
        a,
        " × ",
        Y((M == null ? void 0 : M.current) ?? 0),
        ").",
        /* @__PURE__ */ c("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ t("button", { type: "button", onClick: () => void z(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ t("button", { type: "button", onClick: () => o(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ t("button", { type: "button", onClick: () => {
          f && (I(fe(q)), B(JSON.stringify(Ae(q, fe(q)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => void Z(),
            disabled: !Q,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ t(Pe, { width: 16, height: 16 }),
              "Generate",
              a > 1 ? ` ×${a}` : "",
              M && /* @__PURE__ */ c("span", { className: "font-normal", children: [
                "(",
                M.original !== null ? /* @__PURE__ */ c(we, { children: [
                  /* @__PURE__ */ t("s", { className: "opacity-60", children: Y(M.original * a) }),
                  " "
                ] }) : null,
                Y(M.current * a),
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
  image: le,
  video: bt,
  audio: xt,
  avatar: yt,
  "3d": Ue,
  "ai-tools": gt,
  text: Ct,
  more: St
};
function Wt({ mode: e, onChange: r, layout: n = "rail" }) {
  return n === "tabs" ? /* @__PURE__ */ t("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: ae.map((a) => {
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
  }) }) : /* @__PURE__ */ t("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: ae.map((a) => {
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
function Zt({ apiBase: e = "/api/muapi", initialTab: r = "image", showHeader: n = !0, title: a = "Studio", teamId: d, theme: s = "lime", layout: l, apiKey: b, onRequestApiKey: g, getHeaders: h, connected: $, fetchImpl: f, features: k, className: j = "", onTabChange: v }) {
  const A = $ === !1 || b === "" || b === null, I = H(h);
  I.current = h;
  const T = W(() => new Ke(e, d, { apiKey: b || void 0, getHeaders: () => {
    var M;
    return ((M = I.current) == null ? void 0 : M.call(I)) ?? {};
  }, fetchImpl: f }), [e, d, b, f]), [S, i] = N({ library: !0, deleteMedia: !0 }), m = W(() => ({ library: S.library && (k == null ? void 0 : k.library) !== !1, deleteMedia: (k == null ? void 0 : k.deleteMedia) !== !1 }), [S, k == null ? void 0 : k.library, k == null ? void 0 : k.deleteMedia]), x = l ?? et(s), [L, p] = N(() => Xt() ?? r), [E, J] = N(4), [U, K] = N(null), [B, X] = N(null), [o, u] = N(null), w = V(() => {
    T.balance().then(u).catch(() => u(null));
  }, [T]), [C, q] = N(null), O = pt(T, U, w), F = W(() => ct(O.items), [O.items]);
  P(() => {
    A || (X(null), K(null), T.models().then(K).catch((M) => X(M.message)), w(), (k == null ? void 0 : k.library) !== !1 && T.probe().then(i));
  }, [T, w, A, k == null ? void 0 : k.library]);
  const ee = (M) => {
    p(M), v == null || v(M);
    try {
      const z = new URL(window.location.href);
      z.searchParams.set("tab", M), window.history.replaceState(null, "", z);
    } catch {
    }
  }, de = V(async (M) => {
    await O.run(M);
  }, [O.run]), ue = V((M) => {
    var Z;
    const z = U == null ? void 0 : U.find((Q) => Q.name === M);
    return z ? ((Z = z.sale) == null ? void 0 : Z.from) ?? z.cost ?? void 0 : void 0;
  }, [U]), me = V((M) => {
    p(M.mode), q({ model: M.model, inputs: M.inputs, nonce: Date.now() });
  }, []), pe = V((M) => {
    var Q;
    const z = U == null ? void 0 : U.find((he) => he.name === M.model);
    if (!z) return;
    const Z = ((Q = z.sale) == null ? void 0 : Q.from) ?? z.cost ?? 0;
    Z > 0.25 && !window.confirm(`Re-run ${M.model} for about $${Z.toFixed(2)}?`) || O.run({ model: M.model, endpointUrl: z.endpoint_url, mode: M.mode, prompt: M.prompt, payload: M.inputs, count: 1, unitCost: Z, kind: qe(z.category) });
  }, [U, O.run]);
  return /* @__PURE__ */ c("div", { className: `ms-root ${j}`.trim(), style: Ze(s), "data-layout": x, children: [
    n && /* @__PURE__ */ c("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ t("h1", { className: "text-base font-semibold", children: a }),
      o && /* @__PURE__ */ c("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ t("b", { className: "text-primary", children: Y(o.balance) })
      ] })
    ] }),
    A ? /* @__PURE__ */ c("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ t("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ t("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays in your own account." }),
      g && /* @__PURE__ */ t("button", { type: "button", onClick: g, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ t(Te.Provider, { value: m, children: /* @__PURE__ */ c("div", { className: `flex min-h-0 flex-1 flex-col ${x === "rail" ? "md:flex-row" : ""}`, children: [
      /* @__PURE__ */ t(Wt, { mode: L, onChange: ee, layout: x }),
      /* @__PURE__ */ t("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: B ? /* @__PURE__ */ c("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
        "Could not load models: ",
        B
      ] }) : U ? /* @__PURE__ */ c(we, { children: [
        /* @__PURE__ */ t(Bt, { mode: L, models: U, client: T, batch: E, onRun: de, usage: F, reuse: C }),
        /* @__PURE__ */ t(jt, { mode: L, items: O.items, batch: E, onBatch: J, onLabel: O.setLabel, onRemove: O.remove, onReuse: me, onRerun: pe, onDeleteMedia: O.deleteMedia, onLoadMore: O.loadMore, hasMore: O.hasMore, loadingMore: O.loadingMore, serverError: O.serverError, estimateFor: ue })
      ] }) : /* @__PURE__ */ c("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
        /* @__PURE__ */ t(ie, {}),
        " Loading studio…"
      ] }) })
    ] }) })
  ] });
}
export {
  ne as ApiError,
  Ke as MuapiClient,
  Zt as MuapiStudio,
  Qe as THEMES,
  Xe as cyanTheme,
  et as defaultLayout,
  qe as generationKind,
  xe as limeTheme,
  We as pollUntilDone,
  Ye as resolveTheme,
  Ze as themeStyle
};
