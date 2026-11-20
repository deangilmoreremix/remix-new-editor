import { jsx as t, jsxs as c, Fragment as ke } from "react/jsx-runtime";
import { createContext as Xe, useContext as Qe, useState as C, useRef as H, useEffect as D, useCallback as B, useMemo as W, useId as Ye, useLayoutEffect as Ze } from "react";
class ne extends Error {
  constructor(r, n) {
    super(r), this.status = n;
  }
}
function et(e, r) {
  var a;
  const n = e == null ? void 0 : e.detail;
  return ((a = n == null ? void 0 : n.error) == null ? void 0 : a.message) || (typeof n == "string" ? n : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || r;
}
class tt {
  constructor(r = "/api/muapi", n, a = {}) {
    this.base = r, this.teamId = n, this.opts = a;
  }
  async request(r, n = {}) {
    const a = new Headers(n.headers);
    if (this.opts.apiKey && a.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [x, N] of Object.entries(await this.opts.getHeaders())) a.set(x, N);
    const d = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(r), { ...n, headers: a }), s = await d.text();
    let l = null;
    try {
      l = s ? JSON.parse(s) : null;
    } catch {
    }
    if (!d.ok) throw new ne(et(l, `${d.status} ${d.statusText}`), d.status);
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
async function rt(e, r, n = {}) {
  const { intervalMs: a = 2e3, timeoutMs: d = 15 * 60 * 1e3, signal: s, onUpdate: l } = n, x = Date.now();
  let N = 0;
  for (; Date.now() - x < d; ) {
    if (s != null && s.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const b = await e.poll(r);
      if (N = 0, l == null || l(b), b.status === "completed" || b.status === "failed") return b;
    } catch (b) {
      if (++N >= 5) throw b;
    }
    await new Promise((b) => setTimeout(b, a));
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Re = Xe({ library: !0, deleteMedia: !0 }), Ue = () => Qe(Re), ve = {
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
}, nt = {
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
}, at = { lime: ve, cyan: nt }, Se = {
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
function ot(e = "lime") {
  return typeof e == "string" ? at[e] ?? ve : { ...ve, ...e };
}
function it(e = "lime") {
  const r = ot(e), n = {};
  for (const a of Object.keys(Se)) n[Se[a]] = r[a];
  return n;
}
function st(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const oe = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], lt = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function Pe(e) {
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
const ct = (e) => !!e && oe.some((r) => r.id === e);
function dt(e, r) {
  const n = oe.find((a) => a.id === r).groups;
  return e.filter((a) => n.includes(a.group_of) && a.is_enabled && !a.is_coming_soon);
}
const ut = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function ze(e, r, n = {}) {
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
const mt = { completed: "completed", succeeded: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function pt(e, r) {
  var a, d;
  const n = (a = r.find((s) => s.name === e)) == null ? void 0 : a.group_of;
  return ((d = oe.find((s) => n && s.groups.includes(n))) == null ? void 0 : d.id) ?? "ai-tools";
}
function ft(e, r, n = {}) {
  var s;
  const a = e.output ?? {}, d = a.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: pt(e.model, r),
    prompt: typeof d.prompt == "string" ? d.prompt : "",
    inputs: d,
    status: mt[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(a.outputs) ? a.outputs : [],
    error: a.error || void 0,
    cost: (s = a.cost) == null ? void 0 : s.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: n[e.request_id] ?? null,
    source: "server"
  };
}
function ht(e, r, n = /* @__PURE__ */ new Set()) {
  const a = new Set(e.map((s) => s.requestId).filter(Boolean));
  return [...e, ...r.filter((s) => !s.requestId || !a.has(s.requestId))].filter((s) => !(s.requestId && n.has(s.requestId))).sort((s, l) => l.createdAt - s.createdAt);
}
function bt(e) {
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
function Fe(e, r) {
  var n;
  return r && Number.isFinite(r.cost) ? { current: r.cost, original: r.original_cost && r.original_cost > r.cost ? r.original_cost : null, from: !1 } : ((n = e.sale) == null ? void 0 : n.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Ve = "muapi-studio:history:v1", xt = 200;
function Ie() {
  try {
    const e = localStorage.getItem(Ve);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function yt(e) {
  try {
    localStorage.setItem(Ve, JSON.stringify(e.slice(0, xt)));
  } catch {
  }
}
const gt = () => {
  var e, r;
  return ((r = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : r.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, $e = (e, r) => {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : r;
  } catch {
    return r;
  }
}, Ae = (e, r) => {
  try {
    localStorage.setItem(e, JSON.stringify(r));
  } catch {
  }
}, _e = "muapi-studio:labels:v1", Le = "muapi-studio:hidden:v1";
function vt(e, r, n) {
  const [a, d] = C(() => Ie()), [s, l] = C([]), [x, N] = C(null), [b, $] = C(!1), [p, y] = C(null), L = H(!1), [M, T] = C(() => $e(_e, {})), [w, _] = C(() => $e(Le, [])), S = H(/* @__PURE__ */ new Set()), h = H(new AbortController()), v = H([]);
  v.current = r ?? [], D(() => yt(a), [a]), D(() => Ae(_e, M), [M]), D(() => Ae(Le, w), [w]), D(() => (h.current = new AbortController(), () => h.current.abort()), []);
  const u = B((o, i) => d((f) => f.map((g) => g.id === o ? { ...g, ...i } : g)), []), I = B(async (o, i) => {
    if (!S.current.has(o)) {
      S.current.add(o);
      try {
        const f = await rt(e, i, {
          signal: h.current.signal,
          onUpdate: (g) => u(o, { status: g.status, outputs: g.outputs, error: g.error, cost: g.cost })
        });
        u(o, { status: f.status, outputs: f.outputs, error: f.error, cost: f.cost }), n == null || n();
      } catch (f) {
        f.name !== "AbortError" && u(o, { status: "failed", error: f.message });
      } finally {
        S.current.delete(o);
      }
    }
  }, [e, u, n]);
  D(() => {
    for (const o of Ie()) (o.status === "pending" || o.status === "processing") && o.requestId && I(o.id, o.requestId);
  }, []);
  const m = B(async (o = !1) => {
    if (!L.current) {
      $(!0), y(null);
      try {
        const i = await e.history(o ? void 0 : x ?? void 0), f = i.items.map((g) => ft(g, v.current));
        l((g) => o ? f : [...g, ...f]), N(i.next_cursor);
      } catch (i) {
        i instanceof ne && [403, 404, 405].includes(i.status) ? (L.current = !0, N(null)) : y(i.message);
      } finally {
        $(!1);
      }
    }
  }, [e, x]), E = H(!1);
  D(() => {
    r && !E.current && (E.current = !0, m(!0));
  }, [r, m]);
  const j = B((o) => {
    const i = Array.from({ length: o.count }, () => ({
      id: gt(),
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
    return d((f) => [...i, ...f]), Promise.all(i.map(async (f) => {
      try {
        const { requestId: g, cost: O } = await e.submit(o.endpointUrl, o.payload, o.kind);
        u(f.id, { requestId: g, ...O !== void 0 ? { cost: O } : {} }), await I(f.id, g);
      } catch (g) {
        u(f.id, { status: "failed", error: g.message });
      }
    }));
  }, [e, u, I]), U = W(() => {
    const o = (i) => ({ ...i, label: i.requestId && M[i.requestId] || i.label });
    return ht(a.map(o), s.map(o), new Set(w));
  }, [a, s, M, w]), J = B((o, i) => {
    o.requestId && T((f) => {
      const g = { ...f };
      return i ? g[o.requestId] = i : delete g[o.requestId], g;
    }), u(o.id, { label: i });
  }, [u]), G = B((o) => {
    d((i) => i.filter((f) => f.id !== o.id)), o.requestId && _((i) => [.../* @__PURE__ */ new Set([...i, o.requestId])]);
  }, []), X = B(async (o) => {
    o.requestId && (await e.deleteMedia(o.requestId), u(o.id, { outputs: [] }), l((i) => i.map((f) => f.requestId === o.requestId ? { ...f, outputs: [] } : f)));
  }, [e, u]);
  return { items: U, run: j, setLabel: J, remove: G, deleteMedia: X, loadMore: () => m(!1), hasMore: !!x, loadingMore: b, serverError: p };
}
const wt = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function He(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : wt.test(e) ? "file" : "image" : "text";
}
function Nt(e) {
  const r = e.trim();
  if (!/^[\[{]/.test(r)) return e;
  try {
    return JSON.stringify(JSON.parse(r), null, 2);
  } catch {
    return e;
  }
}
const P = ({ children: e, ...r }) => /* @__PURE__ */ t("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...r, children: e }), ue = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ t("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ t("path", { d: "m21 15-4.5-4.5L6 21" })
] }), kt = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ t("path", { d: "m16 10 6-3v10l-6-3" })
] }), Ct = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ t("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ t("circle", { cx: "17", cy: "16", r: "3" })
] }), Mt = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ t("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ t("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), Je = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ t("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), St = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ t("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), Ge = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), It = ({ filled: e, ...r }) => /* @__PURE__ */ t(P, { ...r, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ t("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), Be = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ t("path", { d: "m20 20-3.5-3.5" })
] }), Ce = ({ up: e, ...r }) => /* @__PURE__ */ t(P, { ...r, children: /* @__PURE__ */ t("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), $t = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), At = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ t("circle", { cx: "12", cy: "12", r: "3" })
] }), we = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), se = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "m5 12 5 5 9-10" }) }), ie = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "M6 6l12 12M18 6 6 18" }) }), Ke = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), _t = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ t("path", { d: "M12 11v5M12 8v.01" })
] }), le = (e) => /* @__PURE__ */ t(P, { ...e, className: "ms-spin", children: /* @__PURE__ */ t("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Lt = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Tt = (e) => /* @__PURE__ */ t(P, { ...e, children: /* @__PURE__ */ t("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Et = (e) => /* @__PURE__ */ c(P, { ...e, children: [
  /* @__PURE__ */ t("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ t("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), jt = ["All", "Approved", "Rejected", "Unlabeled"], qt = [1, 2, 4, 6, 8];
function Ot({ url: e, hidden: r, onOpen: n }) {
  const a = r ? { filter: "blur(18px)" } : void 0, d = He(e);
  return d === "text" ? /* @__PURE__ */ t("pre", { tabIndex: 0, "aria-label": "Generated text", style: a, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: Nt(e) }) : d === "video" ? /* @__PURE__ */ t("video", { src: e, controls: !0, preload: "metadata", style: a, className: "aspect-video w-full bg-black object-contain" }) : d === "audio" ? /* @__PURE__ */ t("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ t("audio", { src: e, controls: !0, className: "w-full" }) }) : d === "3d" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ t(Je, { width: 32, height: 32 }),
    "Open 3D model"
  ] }) : d === "file" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ t(we, { width: 28, height: 28 }),
    /* @__PURE__ */ t("span", { className: "break-all", children: decodeURIComponent(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ t("button", { type: "button", onClick: n, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ t("img", { src: e, alt: "Generated output", loading: "lazy", style: a, className: "aspect-square w-full bg-black object-contain" }) });
}
function Dt({ g: e, hidden: r, onLabel: n, onRemove: a, onReuse: d, onRerun: s, onDeleteMedia: l, onOpen: x, estimateFor: N }) {
  const b = e.outputs[0], $ = !!b && He(b) === "text", [p, y] = C(!1), [L, M] = C(null), T = Ue(), w = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", _ = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ c("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && b ? /* @__PURE__ */ t(Ot, { url: b, hidden: r, onOpen: () => x(b) }) : e.status === "failed" ? /* @__PURE__ */ c("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ t(ie, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ t("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ c("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ t(le, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ c("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ t("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ c("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ t("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ t("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? Y(e.cost) : e.status === "completed" && (N == null ? void 0 : N(e.model)) !== void 0 ? `est. ${Y(N(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && b && ($ ? /* @__PURE__ */ t("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(b)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${_} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ t(we, { width: 14, height: 14 }) }) : /* @__PURE__ */ t("a", { href: b, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${_} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ t(we, { width: 14, height: 14 }) })),
        /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => n(e, e.label === "approved" ? null : "approved"),
            className: `${_} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ t(se, { width: 14, height: 14 })
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
            className: `${_} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ t(ie, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ t("button", { type: "button", onClick: () => d(e), title: "Load this model and settings back into the form", className: w, children: "Reuse" }),
        /* @__PURE__ */ t("button", { type: "button", onClick: () => s(e), title: "Generate again with the same settings", className: w, children: "Re-run" }),
        e.status === "completed" && b && /* @__PURE__ */ t("button", { type: "button", onClick: () => {
          var S;
          (S = navigator.clipboard) == null || S.writeText(b).then(() => {
            y(!0), setTimeout(() => y(!1), 1500);
          });
        }, className: w, children: p ? "Copied" : $ ? "Copy text" : "Copy link" })
      ] }),
      L && /* @__PURE__ */ c("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        L
      ] }),
      /* @__PURE__ */ c("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ c("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ c("span", { className: "flex shrink-0 gap-3", children: [
          T.deleteMedia && e.requestId && e.status === "completed" && b && /* @__PURE__ */ t("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (M(null), l(e).catch((S) => M(S.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ t("button", { type: "button", onClick: () => a(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Rt({ url: e, onClose: r }) {
  return D(() => {
    const n = (a) => a.key === "Escape" && r();
    return document.addEventListener("keydown", n), () => document.removeEventListener("keydown", n);
  }, [r]), /* @__PURE__ */ c("div", { role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: r, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ t("button", { type: "button", "aria-label": "Close preview", onClick: r, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ t(ie, { width: 24, height: 24 }) }),
    /* @__PURE__ */ t("img", { src: e, alt: "Full size output", onClick: (n) => n.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Ut({ mode: e, items: r, batch: n, onBatch: a, onLabel: d, onRemove: s, onReuse: l, onRerun: x, onDeleteMedia: N, onLoadMore: b, hasMore: $, loadingMore: p, serverError: y, estimateFor: L }) {
  const [M, T] = C("All"), [w, _] = C(""), [S, h] = C(!1), [v, u] = C(null), I = W(() => {
    const m = w.trim().toLowerCase();
    return r.filter((E) => E.mode !== e || M === "Approved" && E.label !== "approved" || M === "Rejected" && E.label !== "rejected" || M === "Unlabeled" && E.label !== null ? !1 : !m || E.prompt.toLowerCase().includes(m) || E.model.toLowerCase().includes(m));
  }, [r, e, M, w]);
  return /* @__PURE__ */ c("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ t("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: jt.map((m) => /* @__PURE__ */ t(
        "button",
        {
          role: "tab",
          "aria-selected": M === m,
          onClick: () => T(m),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${M === m ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: m
        },
        m
      )) }),
      /* @__PURE__ */ c("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ t(Be, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ t("input", { value: w, onChange: (m) => _(m.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ t("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: qt.map((m) => /* @__PURE__ */ t(
        "button",
        {
          role: "radio",
          "aria-checked": n === m,
          onClick: () => a(m),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${n === m ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: m
        },
        m
      )) }),
      /* @__PURE__ */ t("button", { type: "button", "aria-pressed": S, "aria-label": S ? "Show previews" : "Hide previews", title: S ? "Show previews" : "Hide previews", onClick: () => h((m) => !m), className: S ? "text-primary" : "text-secondary hover:text-fg", children: S ? /* @__PURE__ */ t($t, { width: 18, height: 18 }) : /* @__PURE__ */ t(At, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      I.length === 0 ? /* @__PURE__ */ c("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ t("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ t(Ge, { width: 36, height: 36 }) }),
        /* @__PURE__ */ t("p", { className: "font-semibold", children: r.some((m) => m.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ t("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: r.some((m) => m.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ t("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: I.map((m) => /* @__PURE__ */ t(Dt, { g: m, hidden: S, onLabel: d, onRemove: s, onReuse: l, onRerun: x, onDeleteMedia: N, onOpen: u, estimateFor: L }, m.id)) }),
      y && /* @__PURE__ */ c("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        y
      ] }),
      $ && /* @__PURE__ */ t("div", { className: "mt-4 text-center", children: /* @__PURE__ */ t("button", { type: "button", disabled: p, onClick: b, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: p ? "Loading…" : "Load more history" }) }),
      v && /* @__PURE__ */ t(Rt, { url: v, onClose: () => u(null) })
    ] })
  ] });
}
const Pt = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, zt = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function Ft(e) {
  var r;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((r = e.items) == null ? void 0 : r.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Pt.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || zt.test(e.name) ? "media" : "text" : "text";
}
function Te(e) {
  var l, x;
  const r = (x = (l = e.input_schema) == null ? void 0 : l.schemas) == null ? void 0 : x.input_data, n = (r == null ? void 0 : r.properties) ?? {}, a = (r == null ? void 0 : r["x-order-properties"]) ?? e.input_fields ?? Object.keys(n), d = [...a.filter((N) => n[N]), ...Object.keys(n).filter((N) => !a.includes(N))], s = new Set(e.required_fields ?? []);
  return d.map((N) => ({ prop: { ...n[N], name: N }, kind: Ft({ ...n[N], name: N }), required: s.has(N) }));
}
function xe(e) {
  var n;
  const r = {};
  for (const { prop: a, kind: d, required: s } of e)
    a.default !== void 0 && a.default !== null ? r[a.name] = a.default : s && (d === "textarea" || d === "text") && typeof ((n = a.examples) == null ? void 0 : n[0]) == "string" && (r[a.name] = a.examples[0]);
  return r;
}
const ae = (e) => `__auto:${e}`, Ee = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Ne = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function je(e, r) {
  const n = {};
  for (const { prop: a, kind: d } of e) {
    if (r[ae(a.name)] === !0) continue;
    const s = r[a.name] ?? a.default;
    if (!Ne(s))
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
function Vt(e, r) {
  for (const { prop: n, kind: a, required: d } of e) {
    if (r[ae(n.name)] === !0) continue;
    const s = r[n.name] ?? n.default, l = n.title || n.name;
    if (d && Ne(s)) return `${l} is required`;
    if (a === "json" && typeof s == "string" && s)
      try {
        JSON.parse(s);
      } catch {
        return `${l} must be valid JSON`;
      }
    if (a === "number" && !Ne(s)) {
      const x = Number(s);
      if (!Number.isFinite(x)) return `${l} must be a number`;
      if (n.minValue !== void 0 && x < n.minValue) return `${l} must be at least ${n.minValue}`;
      if (n.maxValue !== void 0 && x > n.maxValue) return `${l} must be at most ${n.maxValue}`;
    }
  }
  return null;
}
const Ht = 12, Me = 240, ce = (e) => `${typeof e}:${e}`, Jt = (e) => e.map((r) => ({ value: r, label: String(r) }));
function Gt(e, r) {
  const n = r.trim().toLowerCase();
  return n ? e.filter((a) => a.label.toLowerCase().includes(n)) : e;
}
function Bt(e, r, n = Me) {
  return e >= n || e >= r ? "down" : "up";
}
const Kt = 40, Wt = 48;
function Xt(e, r) {
  return Math.min(Me, Math.max(1, e) * Kt + 8) + (r ? Wt : 0);
}
function Qt(e, r, n) {
  return n <= 0 ? -1 : r === "ArrowDown" ? Math.min(e + 1, n - 1) : r === "ArrowUp" ? Math.max(e - 1, 0) : r === "Home" ? 0 : r === "End" ? n - 1 : r === "PageDown" ? Math.min(e + 5, n - 1) : r === "PageUp" ? Math.max(e - 5, 0) : e;
}
const qe = "Auto (let model decide)", ye = "__auto__";
function Yt({ id: e, label: r, options: n, value: a, onChange: d, allowAuto: s, auto: l, onAuto: x, combobox: N }) {
  const b = Ye(), $ = e ?? `ms-dd-${b}`, p = N ?? n.length > Ht, [y, L] = C(!1), [M, T] = C(""), [w, _] = C(0), [S, h] = C("down"), v = H(null), u = H(null), I = H(null), m = n.find((i) => a !== void 0 && ce(i.value) === ce(a)), E = W(() => p ? Gt(n, M) : n, [p, n, M]), j = W(
    () => [...s ? [{ key: ye, label: qe, value: ye, isAuto: !0 }] : [], ...E.map((i) => ({ key: ce(i.value), label: i.label, value: i.value }))],
    [s, E]
  ), U = l ? ye : m ? ce(m.value) : void 0, J = () => {
    L(!1), T("");
  }, G = (i) => {
    i.isAuto ? x == null || x() : d(i.value), J();
  };
  Ze(() => {
    if (!y || !v.current) return;
    const i = v.current.getBoundingClientRect();
    let f = v.current.parentElement;
    for (; f && !/(auto|scroll)/.test(getComputedStyle(f).overflowY); ) f = f.parentElement;
    const g = f ? f.getBoundingClientRect() : null, O = Math.min(window.innerHeight, g ? g.bottom : window.innerHeight), R = Math.max(0, g ? g.top : 0);
    h(Bt(O - i.bottom, i.top - R, Xt(n.length + (s ? 1 : 0), p)));
  }, [y]), D(() => {
    if (!y) return;
    const i = j.findIndex((f) => f.key === U);
    _(i >= 0 ? i : 0);
  }, [y, M]), D(() => {
    var i, f, g;
    y && ((g = (f = (i = u.current) == null ? void 0 : i.querySelector(`[data-i="${w}"]`)) == null ? void 0 : f.scrollIntoView) == null || g.call(f, { block: "nearest" }));
  }, [w, y]), D(() => {
    var i;
    y && p && ((i = I.current) == null || i.focus());
  }, [y, p]), D(() => {
    if (!y) return;
    const i = (f) => {
      var g;
      (g = v.current) != null && g.contains(f.target) || J();
    };
    return document.addEventListener("mousedown", i), () => document.removeEventListener("mousedown", i);
  }, [y]);
  const X = (i) => {
    if (!y) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(i.key) && (i.preventDefault(), L(!0));
      return;
    }
    if (i.key === "Escape") {
      i.preventDefault(), i.stopPropagation(), J();
      return;
    }
    if (i.key === "Enter") {
      i.preventDefault(), j[w] && G(j[w]);
      return;
    }
    if (i.key === "Tab") {
      J();
      return;
    }
    if (i.key === " " && !p) {
      i.preventDefault(), j[w] && G(j[w]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(i.key) && (i.preventDefault(), _((f) => Qt(f, i.key, j.length)));
  }, o = l ? qe : (m == null ? void 0 : m.label) ?? "Select…";
  return /* @__PURE__ */ c("div", { ref: v, className: "relative w-full", onKeyDown: X, children: [
    /* @__PURE__ */ c(
      "button",
      {
        id: $,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": y,
        "aria-label": `${r}: ${o}`,
        "aria-controls": `${$}-list`,
        onClick: () => L((i) => !i),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${y ? "border-primary" : "border-line hover:border-muted"} ${l ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ t("span", { className: "truncate", children: o }),
          /* @__PURE__ */ t(Ce, { up: y, width: 16, height: 16 })
        ]
      }
    ),
    y && /* @__PURE__ */ c("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${S === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      p && /* @__PURE__ */ t(
        "input",
        {
          ref: I,
          value: M,
          onChange: (i) => T(i.target.value),
          placeholder: `Search ${r.toLowerCase()}…`,
          "aria-label": `Search ${r}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${$}-list`,
          "aria-activedescendant": j[w] ? `${$}-o${w}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ c("ul", { id: `${$}-list`, ref: u, role: "listbox", "aria-label": r, style: { maxHeight: Me }, className: "overflow-y-auto", children: [
        j.map((i, f) => {
          const g = i.key === U;
          return /* @__PURE__ */ c(
            "li",
            {
              id: `${$}-o${f}`,
              "data-i": f,
              role: "option",
              "aria-selected": g,
              onMouseEnter: () => _(f),
              onClick: () => G(i),
              className: `flex cursor-pointer items-center justify-between gap-2 rounded-ctl px-3 py-2.5 text-sm ${g ? "bg-primary text-primary-ink" : f === w ? "bg-card-bg" : ""} ${i.isAuto && !g ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ t("span", { className: "truncate", children: i.label }),
                g && /* @__PURE__ */ t(se, { width: 14, height: 14 })
              ]
            },
            i.key
          );
        }),
        j.length === 0 && /* @__PURE__ */ t("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Zt = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function er({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ t("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ t("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ t("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ t(ue, {}) });
}
function tr({ client: e, max: r, initialType: n = "image", onInsert: a, onClose: d }) {
  const [s, l] = C(n), [x, N] = C(""), [b, $] = C(1), [p, y] = C(null), [L, M] = C(null), [T, w] = C(!1), [_, S] = C([]), [h, v] = C(""), [u, I] = C(!1), m = H(null), E = H(null), j = B(async () => {
    w(!0), M(null);
    try {
      y(await e.mediaLibrary({ mediaType: s, search: x, page: b }));
    } catch (o) {
      M(o.message);
    } finally {
      w(!1);
    }
  }, [e, s, x, b]);
  D(() => {
    const o = setTimeout(j, x ? 300 : 0);
    return () => clearTimeout(o);
  }, [j, x]), D(() => {
    $(1);
  }, [s, x]), D(() => {
    var f;
    const o = document.activeElement;
    (f = m.current) == null || f.focus();
    const i = (g) => {
      if (g.key === "Escape") {
        g.stopPropagation(), d();
        return;
      }
      if (g.key !== "Tab" || !m.current) return;
      const O = [...m.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!O.length) return;
      const R = O[0], F = O[O.length - 1];
      g.shiftKey && document.activeElement === R ? (g.preventDefault(), F.focus()) : !g.shiftKey && document.activeElement === F && (g.preventDefault(), R.focus());
    };
    return document.addEventListener("keydown", i), () => {
      var g;
      document.removeEventListener("keydown", i), (g = o == null ? void 0 : o.focus) == null || g.call(o);
    };
  }, [d]);
  const U = (o) => S((i) => i.includes(o) ? i.filter((f) => f !== o) : r === 1 ? [o] : i.length < r ? [...i, o] : i), J = async (o) => {
    if (o.length) {
      w(!0), M(null);
      try {
        for (const i of o) {
          const f = await e.upload(i);
          await e.saveToLibrary({ url: f, name: i.name, mime_type: i.type || void 0, size_bytes: i.size, media_type: i.type.startsWith("video") ? "video" : i.type.startsWith("audio") ? "audio" : i.type.startsWith("image") ? "image" : "archive" });
        }
        await j();
      } catch (i) {
        M(i.message), w(!1);
      }
    }
  }, G = async () => {
    var i;
    const o = h.trim();
    if (!/^https?:\/\//i.test(o)) {
      M("Enter a full http(s) URL");
      return;
    }
    w(!0), M(null);
    try {
      const f = ((i = o.split("?")[0].split(".").pop()) == null ? void 0 : i.toLowerCase()) ?? "", g = ["mp4", "webm", "mov"].includes(f) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(f) ? "audio" : ["zip", "rar", "7z"].includes(f) ? "archive" : "image";
      await e.saveToLibrary({ url: o, name: o.split("/").pop() || "link", media_type: g }), v(""), I(!1), await j();
    } catch (f) {
      M(f.message), w(!1);
    }
  }, X = async (o) => {
    if (window.confirm(`Delete "${o.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(o.id), S((i) => i.filter((f) => f !== o.url)), await j();
      } catch (i) {
        M(i.message);
      }
  };
  return /* @__PURE__ */ t("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (o) => {
    o.target === o.currentTarget && d();
  }, children: /* @__PURE__ */ c("div", { ref: m, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ c("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ t("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ t(ue, {}) }),
      /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ c("h2", { className: "flex items-center gap-2 whitespace-nowrap text-base font-semibold", children: [
          "Media Library ",
          /* @__PURE__ */ c("span", { className: "shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary", children: [
            (p == null ? void 0 : p.total) ?? 0,
            " ",
            (p == null ? void 0 : p.total) === 1 ? "item" : "items"
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
        const i = Array.from(o.target.files ?? []);
        o.target.value = "", J(i);
      } }),
      /* @__PURE__ */ c("button", { type: "button", onClick: () => {
        var o;
        return (o = E.current) == null ? void 0 : o.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover", children: [
        /* @__PURE__ */ t(Ke, { width: 14, height: 14 }),
        "Upload Files"
      ] }),
      /* @__PURE__ */ t("button", { type: "button", "aria-label": "Close", onClick: d, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ t(ie, {}) })
    ] }),
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Zt.map((o) => /* @__PURE__ */ t("button", { role: "tab", "aria-selected": s === o.id, onClick: () => l(o.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${s === o.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: o.label }, o.id)) }),
      /* @__PURE__ */ t("input", { value: x, onChange: (o) => N(o.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ t("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": u, onClick: () => I((o) => !o), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    u && /* @__PURE__ */ c("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ t("input", { value: h, onChange: (o) => v(o.target.value), onKeyDown: (o) => o.key === "Enter" && void G(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ t("button", { type: "button", onClick: () => void G(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      L && /* @__PURE__ */ t("p", { role: "alert", className: "mb-3 text-sm text-danger", children: L }),
      T && !p ? /* @__PURE__ */ c("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ t(le, {}),
        " Loading…"
      ] }) : p != null && p.items.length ? /* @__PURE__ */ t("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: p.items.map((o) => {
        const i = _.includes(o.url);
        return /* @__PURE__ */ c("li", { className: `group relative overflow-hidden rounded-card border ${i ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ t("button", { type: "button", "aria-pressed": i, "aria-label": `${i ? "Deselect" : "Select"} ${o.name ?? "file"}`, onClick: () => U(o.url), className: "block aspect-square w-full", children: /* @__PURE__ */ t(er, { a: o }) }),
          i && /* @__PURE__ */ t("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ t(se, { width: 12, height: 12 }) }),
          /* @__PURE__ */ t("button", { type: "button", "aria-label": `Delete ${o.name ?? "file"}`, onClick: () => void X(o), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ t(ie, { width: 12, height: 12 }) }),
          /* @__PURE__ */ t("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: o.name ?? "", children: o.name })
        ] }, o.id);
      }) }) : /* @__PURE__ */ c("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ t("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ t(ue, { width: 28, height: 28 }) }),
        /* @__PURE__ */ t("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ t("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      p && p.total_pages > 1 && /* @__PURE__ */ c("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ t("button", { type: "button", disabled: b <= 1, onClick: () => $((o) => o - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        b,
        " of ",
        p.total_pages,
        /* @__PURE__ */ t("button", { type: "button", disabled: b >= p.total_pages, onClick: () => $((o) => o + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ c("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ c("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ t("b", { className: "text-primary", children: _.length }),
        " of ",
        r,
        " selected"
      ] }),
      /* @__PURE__ */ c("button", { type: "button", disabled: !_.length, onClick: () => {
        a(_), d();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ t(se, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const We = (e, r = "") => {
  const n = `${e ?? ""} ${r}`.toLowerCase();
  return n.includes("video") ? "video/*" : n.includes("audio") || n.includes("voice") ? "audio/*" : n.includes("image") || n.includes("mask") || n.includes("photo") || n.includes("face") ? "image/*" : void 0;
}, rr = (e, r = "") => {
  const n = We(e, r);
  return n === "video/*" ? "video" : n === "audio/*" ? "audio" : n === "image/*" ? "image" : "all";
}, nr = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function ar(e, r) {
  const n = await Promise.all(r.map((a) => e.upload(a)));
  return r.forEach((a, d) => void e.saveToLibrary({ url: n[d], name: a.name, mime_type: a.type || void 0, size_bytes: a.size, media_type: nr(a) }).catch(() => {
  })), n;
}
function Oe({ client: e, field: r, multiple: n, max: a, current: d, onUrls: s, onError: l }) {
  const x = H(null), [N, b] = C(!1), [$, p] = C(!1), [y, L] = C(!1), M = a - d.length, T = Ue(), w = async (h) => {
    if (h.length) {
      b(!0);
      try {
        s(await ar(e, n ? h.slice(0, Math.max(M, 1)) : h.slice(0, 1)));
      } catch (v) {
        l(v.message);
      } finally {
        b(!1);
      }
    }
  }, _ = We(r.prop.field, r.prop.name), S = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ c(
    "div",
    {
      onDragOver: (h) => {
        h.preventDefault(), p(!0);
      },
      onDragLeave: () => p(!1),
      onDrop: (h) => {
        h.preventDefault(), p(!1), w(Array.from(h.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${$ ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ t("input", { ref: x, type: "file", hidden: !0, accept: _, multiple: n, onChange: (h) => {
          const v = Array.from(h.target.files ?? []);
          h.target.value = "", w(v);
        } }),
        (n ? M > 0 : !0) && /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ t(
            "input",
            {
              "aria-label": `${r.prop.title || r.prop.name} URL`,
              placeholder: n ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: n ? void 0 : d[0] ?? "",
              defaultValue: void 0,
              onChange: n ? void 0 : (h) => s([h.target.value]),
              onKeyDown: n ? (h) => {
                h.key === "Enter" && h.currentTarget.value.trim() && (s([h.currentTarget.value.trim()]), h.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ t("button", { type: "button", disabled: N, onClick: () => {
            var h;
            return (h = x.current) == null ? void 0 : h.click();
          }, "aria-label": "Upload file", title: "Upload file", className: S, children: N ? /* @__PURE__ */ t(le, { width: 16, height: 16 }) : /* @__PURE__ */ t(Ke, { width: 16, height: 16 }) }),
          T.library && /* @__PURE__ */ t("button", { type: "button", onClick: () => L(!0), "aria-label": "Choose from media library", title: "Media library", className: S, children: /* @__PURE__ */ c("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ t("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ t("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ t("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        y && T.library && /* @__PURE__ */ t(tr, { client: e, max: n ? Math.max(M, 1) : 1, initialType: rr(r.prop.field, r.prop.name), onInsert: s, onClose: () => L(!1) })
      ]
    }
  );
}
function or({ field: e, values: r, onChange: n, client: a, onError: d, tagCount: s = 0 }) {
  const { prop: l, kind: x, required: N } = e, b = r[l.name], $ = (h) => n(l.name, h), p = l.title || l.name, y = `ms-f-${l.name}`, L = b == null ? "" : String(b), M = Array.isArray(b) ? b : [], T = r[ae(l.name)] === !0, w = H(null), _ = (h) => {
    const v = w.current, u = typeof b == "string" ? b : "", I = (v == null ? void 0 : v.selectionStart) ?? u.length, m = (v == null ? void 0 : v.selectionEnd) ?? I;
    $(u.slice(0, I) + h + " " + u.slice(m)), requestAnimationFrame(() => {
      v == null || v.focus(), v == null || v.setSelectionRange(I + h.length + 1, I + h.length + 1);
    });
  };
  let S;
  if (x === "textarea" || x === "json")
    S = /* @__PURE__ */ c(ke, { children: [
      /* @__PURE__ */ t("textarea", { ref: w, id: y, rows: x === "json" ? 4 : 5, value: typeof b == "string" ? b : b ? JSON.stringify(b, null, 2) : "", onChange: (h) => $(h.target.value), className: `w-full resize-y p-3 text-sm ${x === "json" ? "font-mono text-xs" : ""}` }),
      l.name === "prompt" && s > 0 && /* @__PURE__ */ c("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ t("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(s, 9) }, (h, v) => `@image${v + 1}`).map((h) => /* @__PURE__ */ t("button", { type: "button", onClick: () => _(h), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: h }, h))
      ] })
    ] });
  else if (x === "select") {
    const h = l.enum ?? [];
    S = /* @__PURE__ */ t(
      Yt,
      {
        id: y,
        label: p,
        options: Jt(h),
        value: b,
        onChange: (v) => {
          $(v), n(ae(l.name), !1);
        },
        allowAuto: Ee(e),
        auto: T,
        onAuto: () => n(ae(l.name), !0)
      }
    );
  } else if (x === "boolean") {
    const h = b === !0;
    S = /* @__PURE__ */ t(
      "button",
      {
        id: y,
        type: "button",
        role: "switch",
        "aria-checked": h,
        onClick: () => $(!h),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${h ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ t("span", { className: `h-5 w-5 rounded-full ${h ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (x === "number") {
    const h = l.minValue !== void 0 && l.maxValue !== void 0;
    S = /* @__PURE__ */ c("div", { className: `flex items-center gap-3 ${T ? "opacity-40" : ""}`, children: [
      h && /* @__PURE__ */ t("input", { type: "range", disabled: T, "aria-label": `${p} slider`, min: l.minValue, max: l.maxValue, step: l.step ?? (l.type === "number" ? 0.01 : 1), value: L === "" ? l.minValue : Number(L), onChange: (v) => $(Number(v.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ t("input", { id: y, type: "number", disabled: T, min: l.minValue, max: l.maxValue, step: l.step ?? (l.type === "number" ? "any" : 1), value: L, onChange: (v) => $(v.target.value === "" ? "" : Number(v.target.value)), className: `px-3 py-2 text-sm ${h ? "w-24" : "w-full"}` })
    ] });
  } else if (x === "media")
    S = /* @__PURE__ */ t(Oe, { client: a, field: e, multiple: !1, max: 1, current: L ? [L] : [], onUrls: (h) => $(h[0]), onError: d });
  else if (x === "media-list") {
    const h = l.maxItems ?? 8;
    S = /* @__PURE__ */ c("div", { className: "space-y-2", children: [
      M.map((v, u) => /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ t("input", { "aria-label": `${p} ${u + 1}`, value: v, onChange: (I) => $(M.map((m, E) => E === u ? I.target.value : m)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ t("button", { type: "button", "aria-label": `Remove ${p} ${u + 1}`, onClick: () => $(M.filter((I, m) => m !== u)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ t(ie, { width: 14, height: 14 }) })
      ] }, u)),
      /* @__PURE__ */ t(Oe, { client: a, field: e, multiple: !0, max: h, current: M, onUrls: (v) => $([...M, ...v].slice(0, h)), onError: d })
    ] });
  } else
    S = /* @__PURE__ */ t("input", { id: y, value: L, onChange: (h) => $(h.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ c("div", { className: "mb-5", children: [
    /* @__PURE__ */ c("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ c("label", { htmlFor: y, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        p,
        l.description && /* @__PURE__ */ t("span", { title: l.description, className: "text-muted", children: /* @__PURE__ */ t(_t, { width: 13, height: 13 }) })
      ] }),
      Ee(e) && x === "number" ? /* @__PURE__ */ c("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ t("input", { type: "checkbox", checked: T, onChange: (h) => n(ae(l.name), h.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ t("span", { className: "text-[11px] text-primary", children: x === "media-list" ? `${M.length}/${l.maxItems ?? 8} items${N ? " · required" : ""}` : N ? "* required" : "" })
    ] }),
    S
  ] });
}
const de = 200;
function ir({ model: e }) {
  const r = Fe(e);
  return r ? /* @__PURE__ */ c("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    r.original !== null && /* @__PURE__ */ t("s", { className: "font-normal text-muted", children: Y(r.original) }),
    r.from && r.original !== null ? "from " : "",
    Y(r.current)
  ] }) : null;
}
function sr({ models: e, value: r, onChange: n, favorites: a, onToggleFavorite: d, usage: s, showGroup: l }) {
  var v;
  const [x, N] = C(!1), [b, $] = C(""), [p, y] = C("popular"), [L, M] = C(!1), T = H(null);
  D(() => {
    x || M(!1);
  }, [x]), D(() => {
    if (!x) return;
    const u = (m) => {
      var E;
      (E = T.current) != null && E.contains(m.target) || N(!1);
    }, I = (m) => {
      m.key === "Escape" && N(!1);
    };
    return document.addEventListener("mousedown", u), document.addEventListener("keydown", I), () => {
      document.removeEventListener("mousedown", u), document.removeEventListener("keydown", I);
    };
  }, [x]);
  const w = W(() => {
    const u = b.trim().toLowerCase(), I = u ? e.filter((j) => j.name.toLowerCase().includes(u) || j.category.toLowerCase().includes(u)) : e, m = ze(I, p, { usage: s, favorites: a });
    if (p === "favourites" || p === "most-used") return m;
    const E = new Set(a);
    return [...m.filter((j) => E.has(j.name)), ...m.filter((j) => !E.has(j.name))];
  }, [e, b, p, a, s]), [_, S] = C(0);
  D(() => S(0), [b, p, x]);
  const h = (u) => {
    u.key === "ArrowDown" ? (u.preventDefault(), S((I) => Math.min(I + 1, Math.min(w.length, de) - 1))) : u.key === "ArrowUp" ? (u.preventDefault(), S((I) => Math.max(I - 1, 0))) : u.key === "Enter" && w[_] && (u.preventDefault(), n(w[_].name), N(!1));
  };
  return D(() => {
    var u, I;
    (I = (u = document.getElementById(`ms-opt-${_}`)) == null ? void 0 : u.scrollIntoView) == null || I.call(u, { block: "nearest" });
  }, [_]), /* @__PURE__ */ c("div", { ref: T, className: "relative", children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        onClick: () => N((u) => !u),
        "aria-haspopup": "listbox",
        "aria-expanded": x,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ t("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (v = (r ?? "?")[0]) == null ? void 0 : v.toUpperCase() }),
          /* @__PURE__ */ t("span", { className: "min-w-0 flex-1 truncate", children: r ?? "Select a model" }),
          /* @__PURE__ */ t(Ce, { up: x, width: 16, height: 16 })
        ]
      }
    ),
    x && /* @__PURE__ */ c("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ c("div", { className: "mb-2 flex gap-2", children: [
        /* @__PURE__ */ c("label", { className: "relative flex-1", children: [
          /* @__PURE__ */ t(Be, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
          /* @__PURE__ */ t("input", { autoFocus: !0, onKeyDown: h, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${_}`, value: b, onChange: (u) => $(u.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
        ] }),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ t(
            "button",
            {
              type: "button",
              "aria-label": "Sort models",
              "aria-haspopup": "menu",
              "aria-expanded": L,
              onClick: () => M((u) => !u),
              className: `flex h-full items-center rounded-ctl border px-3 ${L ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
              children: /* @__PURE__ */ t(Lt, { width: 16, height: 16 })
            }
          ),
          L && /* @__PURE__ */ t("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ut.map((u) => /* @__PURE__ */ t("li", { role: "none", children: /* @__PURE__ */ c(
            "button",
            {
              type: "button",
              role: "menuitemradio",
              "aria-checked": p === u.id,
              onClick: () => {
                y(u.id), M(!1);
              },
              className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${p === u.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
              children: [
                u.label,
                p === u.id && /* @__PURE__ */ t(se, { width: 14, height: 14 })
              ]
            }
          ) }, u.id)) })
        ] })
      ] }),
      /* @__PURE__ */ c("ul", { id: "ms-listbox", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        w.slice(0, de).map((u, I) => {
          const m = u.name === r;
          return /* @__PURE__ */ c(
            "li",
            {
              id: `ms-opt-${I}`,
              role: "option",
              "aria-selected": m,
              onClick: () => {
                n(u.name), N(!1);
              },
              className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${m ? "bg-primary-soft" : I === _ ? "bg-card-bg" : "hover:bg-card-bg"}`,
              children: [
                /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ t("div", { className: `truncate text-sm ${m ? "text-primary" : ""}`, children: u.name }),
                  /* @__PURE__ */ t("div", { className: "text-[10px] text-secondary", children: l ? `${u.group_of} · ${u.category}` : u.category })
                ] }),
                /* @__PURE__ */ t(
                  "button",
                  {
                    type: "button",
                    "aria-label": a.includes(u.name) ? "Remove favorite" : "Add favorite",
                    onClick: (E) => {
                      E.stopPropagation(), d(u.name);
                    },
                    className: a.includes(u.name) ? "text-primary" : "text-muted hover:text-fg",
                    children: /* @__PURE__ */ t(It, { width: 15, height: 15, filled: a.includes(u.name) })
                  }
                ),
                /* @__PURE__ */ t(ir, { model: u })
              ]
            },
            u.name
          );
        }),
        w.length === 0 && /* @__PURE__ */ t("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: p === "favourites" ? "No favourites yet. Tap the heart on a model." : p === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${b}”.` }),
        w.length > de && /* @__PURE__ */ c("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
          "Showing ",
          de,
          " of ",
          w.length,
          ". Refine your search."
        ] })
      ] })
    ] })
  ] });
}
const De = (e, r) => {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : r;
  } catch {
    return r;
  }
}, ge = (e, r) => {
  try {
    localStorage.setItem(e, JSON.stringify(r));
  } catch {
  }
}, lr = 0.25;
function cr({ mode: e, models: r, client: n, batch: a, onRun: d, usage: s, reuse: l }) {
  const x = oe.find((k) => k.id === e), N = W(() => dt(r, e), [r, e]), [b, $] = C(), [p, y] = C(null), [L, M] = C(null), [T, w] = C({}), [_, S] = C(null), [h, v] = C(null), [u, I] = C(() => De("muapi-studio:favorites", [])), [m, E] = C("form"), [j, U] = C(!1), [J, G] = C("{}"), [X, o] = C(null), i = H(0), f = H(null);
  D(() => {
    var z, K, re;
    const k = De(`muapi-studio:model:${e}`, null), q = ((z = N.find((te) => te.name === k)) == null ? void 0 : z.name) ?? ((K = N.find((te) => te.name === lt[e])) == null ? void 0 : K.name) ?? ((re = ze(N, "popular")[0]) == null ? void 0 : re.name);
    $(q);
  }, [e, N]), D(() => {
    l && (f.current = l.inputs, N.some((k) => k.name === l.model) && ($(l.model), ge(`muapi-studio:model:${e}`, l.model)), E("form"));
  }, [l == null ? void 0 : l.nonce]);
  const g = N.find((k) => k.name === b);
  D(() => {
    if (!b) return;
    let k = !0;
    return y(null), M(null), S(null), v(null), o(null), n.model(b).then((q) => {
      if (!k) return;
      const z = Te(q), K = xe(z), re = f.current;
      if (f.current = null, re)
        for (const te of z) re[te.prop.name] !== void 0 && (K[te.prop.name] = re[te.prop.name]);
      y(q), w(K);
    }).catch((q) => {
      k && M(q.message);
    }), () => {
      k = !1;
    };
  }, [b, n]);
  const O = W(() => p ? Te(p) : [], [p]), R = W(() => je(O, T), [O, T]), F = W(() => {
    try {
      const k = JSON.parse(J);
      return k && typeof k == "object" && !Array.isArray(k) ? k : null;
    } catch {
      return null;
    }
  }, [J]), ee = m === "json" ? F ?? {} : R, me = JSON.stringify(ee);
  D(() => {
    if (!p || m === "json" && !F) return;
    const k = ++i.current, q = setTimeout(() => {
      n.estimate(p.name, ee).then((z) => {
        k === i.current && S(z);
      }).catch(() => {
        k === i.current && S(null);
      });
    }, 500);
    return () => clearTimeout(q);
  }, [p, me, n]);
  const pe = (k) => {
    $(k), ge(`muapi-studio:model:${e}`, k);
  }, fe = (k) => I((q) => {
    const z = q.includes(k) ? q.filter((K) => K !== k) : [...q, k];
    return ge("muapi-studio:favorites", z), z;
  }), he = (k) => {
    U(!1), k !== m && (k === "json" ? G(JSON.stringify(R, null, 2)) : F && w((q) => {
      const z = { ...q };
      for (const K of O) F[K.prop.name] !== void 0 && (z[K.prop.name] = F[K.prop.name]);
      return z;
    }), E(k), v(null));
  }, A = g ? Fe(g, _) : null, V = B(async () => {
    if (!p) return;
    o(null);
    const k = O.find((q) => q.prop.name === "prompt");
    await d({
      model: p.name,
      endpointUrl: p.endpoint_url,
      mode: e,
      payload: ee,
      count: a,
      kind: Pe(p.category),
      prompt: k ? String(ee.prompt ?? "") : "",
      unitCost: A == null ? void 0 : A.current
    });
  }, [p, O, d, e, ee, a, A]), Z = B(async () => {
    if (!p) return;
    if (m === "json") {
      if (!F) {
        v("The JSON is not valid");
        return;
      }
      const q = (p.required_fields ?? []).find((z) => F[z] === void 0 || F[z] === "");
      if (q) {
        v(`${q} is required`);
        return;
      }
    } else {
      const q = Vt(O, T);
      if (q) {
        v(q);
        return;
      }
    }
    v(null);
    const k = ((A == null ? void 0 : A.current) ?? 0) * a;
    if (k > lr) {
      o(k);
      return;
    }
    await V();
  }, [p, m, F, O, T, A, a, V]), Q = !!p && !L, be = (() => {
    var q;
    const k = O.find((z) => z.kind === "media-list");
    return k ? Math.max(((q = T[k.prop.name]) == null ? void 0 : q.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ c("section", { "aria-label": x.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ c("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ t("h2", { className: "text-lg font-semibold", children: x.title }),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ c("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": j, onClick: () => U((k) => !k), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            m === "json" ? "JSON" : "Form",
            /* @__PURE__ */ t(Ce, { up: j, width: 12, height: 12 })
          ] }),
          j && /* @__PURE__ */ t("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((k) => /* @__PURE__ */ t("li", { role: "none", children: /* @__PURE__ */ t("button", { role: "menuitemradio", "aria-checked": m === k, type: "button", onClick: () => he(k), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${m === k ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: k === "json" ? "JSON" : "Form" }) }, k)) })
        ] })
      ] }),
      /* @__PURE__ */ t("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ t("div", { className: "mb-5", children: /* @__PURE__ */ t(sr, { models: N, value: b, onChange: pe, favorites: u, onToggleFavorite: fe, usage: s, showGroup: e === "text" || e === "more" }) }),
      /* @__PURE__ */ t("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: m === "json" ? "Request body" : "Parameters" }),
      (g == null ? void 0 : g.description) && /* @__PURE__ */ t("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: g.description }),
      !Q && !L && b && /* @__PURE__ */ c("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ t(le, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      L && /* @__PURE__ */ c("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        L
      ] }),
      N.length === 0 && /* @__PURE__ */ t("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      Q && m === "json" && /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ t("textarea", { "aria-label": "Request JSON", "aria-invalid": !F, spellCheck: !1, rows: 16, value: J, onChange: (k) => G(k.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ t("p", { className: `mt-1.5 text-[11px] ${F ? "text-muted" : "text-danger"}`, children: F ? `Sent as the body of POST /api/v1/${p.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      Q && m === "form" && O.map((k) => /* @__PURE__ */ t(
        or,
        {
          field: k,
          values: T,
          client: n,
          onError: v,
          tagCount: k.prop.name === "prompt" ? be : 0,
          onChange: (q, z) => w((K) => ({ ...K, [q]: z }))
        },
        k.prop.name
      ))
    ] }),
    /* @__PURE__ */ c("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      h && /* @__PURE__ */ t("p", { role: "alert", className: "mb-2 text-xs text-danger", children: h }),
      X !== null && /* @__PURE__ */ c("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ t("b", { className: "text-primary", children: Y(X) }),
        " (",
        a,
        " × ",
        Y((A == null ? void 0 : A.current) ?? 0),
        ").",
        /* @__PURE__ */ c("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ t("button", { type: "button", onClick: () => void V(), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ t("button", { type: "button", onClick: () => o(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ t("button", { type: "button", onClick: () => {
          p && (w(xe(O)), G(JSON.stringify(je(O, xe(O)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => void Z(),
            disabled: !Q,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ t(Ge, { width: 16, height: 16 }),
              "Generate",
              a > 1 ? ` ×${a}` : "",
              A && /* @__PURE__ */ c("span", { className: "font-normal", children: [
                "(",
                A.original !== null ? /* @__PURE__ */ c(ke, { children: [
                  /* @__PURE__ */ t("s", { className: "opacity-60", children: Y(A.original * a) }),
                  " "
                ] }) : null,
                Y(A.current * a),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const dr = {
  image: ue,
  video: kt,
  audio: Ct,
  avatar: Mt,
  "3d": Je,
  "ai-tools": St,
  text: Tt,
  more: Et
};
function ur({ mode: e, onChange: r, layout: n = "rail" }) {
  return n === "tabs" ? /* @__PURE__ */ t("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: oe.map((a) => {
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
  }) }) : /* @__PURE__ */ t("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: oe.map((a) => {
    const d = dr[a.id], s = a.id === e;
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
function mr() {
  try {
    const e = new URLSearchParams(window.location.search).get("tab");
    return ct(e) ? e : null;
  } catch {
    return null;
  }
}
function hr({ apiBase: e = "/api/muapi", initialTab: r = "image", showHeader: n = !0, title: a = "Studio", teamId: d, theme: s = "lime", layout: l, apiKey: x, onRequestApiKey: N, getHeaders: b, connected: $, fetchImpl: p, features: y, className: L = "", onTabChange: M }) {
  const T = $ === !1 || x === "" || x === null, w = H(b);
  w.current = b;
  const _ = W(() => new tt(e, d, { apiKey: x || void 0, getHeaders: () => {
    var A;
    return ((A = w.current) == null ? void 0 : A.call(w)) ?? {};
  }, fetchImpl: p }), [e, d, x, p]), [S, h] = C({ library: !0, deleteMedia: !0 }), v = W(() => ({ library: S.library && (y == null ? void 0 : y.library) !== !1, deleteMedia: (y == null ? void 0 : y.deleteMedia) !== !1 }), [S, y == null ? void 0 : y.library, y == null ? void 0 : y.deleteMedia]), u = l ?? st(s), [I, m] = C(() => mr() ?? r), [E, j] = C(4), [U, J] = C(null), [G, X] = C(null), [o, i] = C(null), f = B(() => {
    _.balance().then(i).catch(() => i(null));
  }, [_]), [g, O] = C(null), R = vt(_, U, f), F = W(() => bt(R.items), [R.items]);
  D(() => {
    T || (X(null), J(null), _.models().then(J).catch((A) => X(A.message)), f(), (y == null ? void 0 : y.library) !== !1 && _.probe().then(h));
  }, [_, f, T, y == null ? void 0 : y.library]);
  const ee = (A) => {
    m(A), M == null || M(A);
    try {
      const V = new URL(window.location.href);
      V.searchParams.set("tab", A), window.history.replaceState(null, "", V);
    } catch {
    }
  }, me = B(async (A) => {
    await R.run(A);
  }, [R.run]), pe = B((A) => {
    var Z;
    const V = U == null ? void 0 : U.find((Q) => Q.name === A);
    return V ? ((Z = V.sale) == null ? void 0 : Z.from) ?? V.cost ?? void 0 : void 0;
  }, [U]), fe = B((A) => {
    m(A.mode), O({ model: A.model, inputs: A.inputs, nonce: Date.now() });
  }, []), he = B((A) => {
    var Q;
    const V = U == null ? void 0 : U.find((be) => be.name === A.model);
    if (!V) return;
    const Z = ((Q = V.sale) == null ? void 0 : Q.from) ?? V.cost ?? 0;
    Z > 0.25 && !window.confirm(`Re-run ${A.model} for about $${Z.toFixed(2)}?`) || R.run({ model: A.model, endpointUrl: V.endpoint_url, mode: A.mode, prompt: A.prompt, payload: A.inputs, count: 1, unitCost: Z, kind: Pe(V.category) });
  }, [U, R.run]);
  return /* @__PURE__ */ c("div", { className: `ms-root ${L}`.trim(), style: it(s), "data-layout": u, children: [
    n && /* @__PURE__ */ c("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ t("h1", { className: "text-base font-semibold", children: a }),
      o && /* @__PURE__ */ c("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ t("b", { className: "text-primary", children: Y(o.balance) })
      ] })
    ] }),
    T ? /* @__PURE__ */ c("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ t("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ t("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays in your own account." }),
      N && /* @__PURE__ */ t("button", { type: "button", onClick: N, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ t(Re.Provider, { value: v, children: /* @__PURE__ */ c("div", { className: `flex min-h-0 flex-1 flex-col ${u === "rail" ? "md:flex-row" : ""}`, children: [
      /* @__PURE__ */ t(ur, { mode: I, onChange: ee, layout: u }),
      /* @__PURE__ */ t("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: G ? /* @__PURE__ */ c("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
        "Could not load models: ",
        G
      ] }) : U ? /* @__PURE__ */ c(ke, { children: [
        /* @__PURE__ */ t(cr, { mode: I, models: U, client: _, batch: E, onRun: me, usage: F, reuse: g }),
        /* @__PURE__ */ t(Ut, { mode: I, items: R.items, batch: E, onBatch: j, onLabel: R.setLabel, onRemove: R.remove, onReuse: fe, onRerun: he, onDeleteMedia: R.deleteMedia, onLoadMore: R.loadMore, hasMore: R.hasMore, loadingMore: R.loadingMore, serverError: R.serverError, estimateFor: pe })
      ] }) : /* @__PURE__ */ c("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
        /* @__PURE__ */ t(le, {}),
        " Loading studio…"
      ] }) })
    ] }) })
  ] });
}
export {
  ne as ApiError,
  tt as MuapiClient,
  hr as MuapiStudio,
  at as THEMES,
  nt as cyanTheme,
  st as defaultLayout,
  Pe as generationKind,
  ve as limeTheme,
  rt as pollUntilDone,
  ot as resolveTheme,
  it as themeStyle
};
