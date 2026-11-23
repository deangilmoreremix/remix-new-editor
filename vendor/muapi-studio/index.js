import { jsx as a, jsxs as l, Fragment as Ve } from "react/jsx-runtime";
import { createContext as lt, useContext as ct, useState as A, useRef as q, useEffect as H, useCallback as re, useMemo as ae, createElement as dr, useId as ur, useLayoutEffect as mr } from "react";
function pr(e, t, r = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : r);
}
function hr(e) {
  const t = Number(e);
  return e && Number.isFinite(t) && t >= 0 ? Math.min(t, 120) * 1e3 : void 0;
}
class ye extends Error {
  constructor(t, r, n) {
    super(t), this.status = r, this.retryAfterMs = n;
  }
}
function dt(e) {
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
function fr(e, t) {
  var n;
  const r = e == null ? void 0 : e.detail;
  return ((n = r == null ? void 0 : r.error) == null ? void 0 : n.message) || (typeof r == "string" ? r : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class gr {
  constructor(t = "/api/muapi", r, n = {}) {
    this.base = t, this.teamId = r, this.opts = n;
  }
  async request(t, r = {}) {
    var m, y, p, g;
    const n = new Headers(r.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [C, f] of Object.entries(await this.opts.getHeaders())) n.set(C, f);
    const i = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...r, headers: n }), o = await i.text();
    let s = null;
    try {
      s = o ? JSON.parse(o) : null;
    } catch {
    }
    if (!i.ok && pr(i.status, s, o) && !t.startsWith("/app/") && ((y = (m = this.opts).onKeyRejected) == null || y.call(m)), !i.ok) throw new ye(fr(s, `${i.status} ${i.statusText}`), i.status, hr((g = (p = i.headers) == null ? void 0 : p.get) == null ? void 0 : g.call(p, "retry-after")));
    if (s === null && o.trim()) throw new ye("Unexpected non-JSON response from the server", 502);
    return s;
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
  estimate(t, r) {
    return this.request(`/api/v1/models/${encodeURIComponent(t)}/estimate-cost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(r)
    });
  }
  /** Submit with the model's `endpoint_url` (the catalog's `endpoint` field can be wrong). */
  async submit(t, r, n) {
    var s;
    const i = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(r)
    }), o = i.request_id || i.id;
    if (!o) throw new ye("The API did not return a request id", 502);
    return { requestId: o, cost: (s = i.cost) == null ? void 0 : s.amount_usd };
  }
  async poll(t, r) {
    var m;
    const n = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`, r ? { signal: r } : {}), i = String(n.status || "").toLowerCase(), o = ["completed", "succeeded", "success"].includes(i) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(i) ? "failed" : i === "pending" ? "pending" : "processing", s = Array.isArray(n.outputs) ? n.outputs : n.url ? [n.url] : [];
    return { status: o, outputs: s, error: dt(n.error), cost: (m = n.cost) == null ? void 0 : m.amount_usd };
  }
  /** muapi's server-side generation history (works with an API key), newest first. */
  history(t, r = 30) {
    const n = new URLSearchParams({ limit: String(r) });
    return t && n.set("cursor", t), this.request(`/api/v1/history?${n}`);
  }
  mediaLibrary(t = {}) {
    const r = new URLSearchParams({ page: String(t.page ?? 1), page_size: String(t.pageSize ?? 24) });
    return t.mediaType && t.mediaType !== "all" && r.set("media_type", t.mediaType), t.search && r.set("search", t.search), this.request(`/app/media-library?${r}`);
  }
  saveToLibrary(t) {
    return this.request("/app/media-library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) });
  }
  deleteFromLibrary(t) {
    return this.request(`/app/media-library/${t}`, { method: "DELETE" });
  }
  /** Removes the generated files on muapi's side (the history row is kept unless deleteRecord is true). */
  deleteMedia(t, r = !1) {
    return this.request(`/api/v1/predictions/${encodeURIComponent(t)}/media${r ? "?delete_record=true" : ""}`, { method: "DELETE" });
  }
  /** Which optional features the host's proxy supports. A 403/404/405 means the route is not forwarded, so the UI hides it. */
  async probe() {
    const t = (n) => n instanceof ye && [403, 404, 405].includes(n.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((n) => !t(n)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var o;
    const r = new FormData();
    r.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: r }), i = n.url || n.file_url || ((o = n.data) == null ? void 0 : o.url);
    if (!i) throw new ye("Upload returned no URL", 502);
    return i;
  }
}
const br = (e) => Math.min(Math.round(e * 1.15), 6e3), yr = 3e4, xr = (e, t) => new Promise((r) => {
  const n = setTimeout(i, e);
  function i() {
    clearTimeout(n), t == null || t.removeEventListener("abort", i), r();
  }
  t == null || t.addEventListener("abort", i);
});
async function Nt(e, t, r = {}) {
  const { intervalMs: n = 2e3, timeoutMs: i = 15 * 60 * 1e3, signal: o, onUpdate: s } = r, m = Date.now();
  let y = 0, p = n;
  for (; Date.now() - m < i; ) {
    if (o != null && o.aborted) throw new DOMException("Aborted", "AbortError");
    let g = p;
    const C = new AbortController(), f = () => C.abort();
    o == null || o.addEventListener("abort", f);
    const v = setTimeout(() => C.abort(), Math.max(i - (Date.now() - m), 0));
    try {
      const N = await e.poll(t, C.signal);
      if (o != null && o.aborted) throw new DOMException("Aborted", "AbortError");
      if (y = 0, s == null || s(N), N.status === "completed" || N.status === "failed") return N;
      p = br(p), g = p;
    } catch (N) {
      if (o != null && o.aborted) throw new DOMException("Aborted", "AbortError");
      if (C.signal.aborted) break;
      if (N instanceof ye && N.status === 429) g = N.retryAfterMs ?? yr;
      else if (++y >= 5) throw N;
    } finally {
      clearTimeout(v), o == null || o.removeEventListener("abort", f);
    }
    await xr(g, o);
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const zt = lt({ library: !0, deleteMedia: !0 }), Ht = () => ct(zt), Xe = {
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
}, vr = {
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
}, wr = { lime: Xe, cyan: vr }, St = {
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
function Jt(e = "lime") {
  return typeof e == "string" ? wr[e] ?? Xe : { ...Xe, ...e };
}
function kr(e = "lime") {
  const t = Jt(e), r = {};
  for (const n of Object.keys(St)) r[St[n]] = t[n];
  return r;
}
function Nr(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const Sr = (e = "lime") => Jt(e).buttonStyle, we = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], Cr = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function ut(e) {
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
const Ar = (e) => !!e && we.some((t) => t.id === e);
function Ir(e, t) {
  const r = we.find((n) => n.id === t).groups;
  return e.filter((n) => r.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const Mr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Wt(e, t, r = {}) {
  const n = (o) => {
    var s;
    return ((s = o.sale) == null ? void 0 : s.from) ?? o.cost ?? 1 / 0;
  }, i = [...e];
  return t === "a-z" ? i.sort((o, s) => o.name.localeCompare(s.name)) : t === "price-asc" ? i.sort((o, s) => n(o) - n(s)) : t === "price-desc" ? i.sort((o, s) => n(s) - n(o)) : t === "most-used" ? i.filter((o) => {
    var s;
    return (((s = r.usage) == null ? void 0 : s[o.name]) ?? 0) > 0;
  }).sort((o, s) => (r.usage[s.name] ?? 0) - (r.usage[o.name] ?? 0)) : t === "favourites" ? i.filter((o) => {
    var s;
    return (s = r.favorites) == null ? void 0 : s.includes(o.name);
  }) : i.sort((o, s) => +!!s.sale - +!!o.sale);
}
const Er = { completed: "completed", succeeded: "completed", success: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function $r(e, t) {
  var n, i;
  const r = (n = t.find((o) => o.name === e)) == null ? void 0 : n.group_of;
  return ((i = we.find((o) => r && o.groups.includes(r))) == null ? void 0 : i.id) ?? "ai-tools";
}
function Tr(e, t, r = {}) {
  var o;
  const n = e.output ?? {}, i = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: $r(e.model, t),
    prompt: typeof i.prompt == "string" ? i.prompt : "",
    inputs: i,
    status: Er[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: dt(n.error),
    cost: (o = n.cost) == null ? void 0 : o.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: r[e.request_id] ?? null,
    source: "server"
  };
}
function Lr(e, t, r = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((m) => m.requestId).map((m) => [m.requestId, m])), i = new Set(e.map((m) => m.requestId).filter(Boolean));
  return [...e.map((m) => {
    const y = m.requestId ? n.get(m.requestId) : void 0;
    return m.status === "failed" && y && y.status === "completed" && y.outputs.length ? { ...m, status: y.status, outputs: y.outputs, error: void 0, cost: m.cost ?? y.cost } : m;
  }), ...t.filter((m) => !m.requestId || !i.has(m.requestId))].filter((m) => !(m.requestId && r.has(m.requestId))).sort((m, y) => y.createdAt - m.createdAt);
}
function _r(e) {
  const t = {};
  for (const r of e) t[r.model] = (t[r.model] ?? 0) + 1;
  return t;
}
function ce(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function ve(e, t) {
  var r;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((r = e.sale) == null ? void 0 : r.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Yt = "muapi-studio:history:v1", Dr = 200, Ce = (e, t) => t ? `${e}:${t}` : e;
function Rr(e) {
  if (!e) return "";
  let t = 2166136261, r = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, r = Math.imul(r ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${r.toString(36)}`;
}
function ze(e = "") {
  try {
    const t = localStorage.getItem(Ce(Yt, e));
    return (t ? JSON.parse(t) : []).map((n) => n.error !== void 0 && typeof n.error != "string" ? { ...n, error: dt(n.error) } : n);
  } catch {
    return [];
  }
}
function Gr(e, t = "") {
  try {
    localStorage.setItem(Ce(Yt, t), JSON.stringify(e.slice(0, Dr)));
  } catch {
  }
}
const Or = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, Ct = (e, t) => {
  try {
    const r = localStorage.getItem(e);
    return r ? JSON.parse(r) : t;
  } catch {
    return t;
  }
}, At = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, It = "muapi-studio:labels:v1", Mt = "muapi-studio:hidden:v1";
function jr(e, t, r, n = "", i = !0) {
  const [o, s] = A(() => ze(n)), [m, y] = A([]), [p, g] = A(null), [C, f] = A(!1), [v, N] = A(null), G = q(!1), [M, j] = A(() => Ct(Ce(It, n), {})), [x, w] = A(() => Ct(Ce(Mt, n), [])), b = q(/* @__PURE__ */ new Set()), I = q(!1), U = q(new AbortController()), $ = q([]);
  $.current = t ?? [], H(() => Gr(o, n), [o, n]), H(() => At(Ce(It, n), M), [M, n]), H(() => At(Ce(Mt, n), x), [x, n]), H(() => (U.current = new AbortController(), () => {
    U.current.abort(), b.current.clear(), I.current = !1;
  }), []);
  const T = re((u, d) => s((S) => S.map((O) => O.id === u ? { ...O, ...d } : O)), []), E = re(async (u, d) => {
    if (!b.current.has(u)) {
      b.current.add(u);
      try {
        const S = await Nt(e, d, {
          signal: U.current.signal,
          onUpdate: (O) => T(u, { status: O.status, outputs: O.outputs, error: O.error, cost: O.cost })
        });
        T(u, { status: S.status, outputs: S.outputs, error: S.error, cost: S.cost }), r == null || r();
      } catch (S) {
        S.name !== "AbortError" && T(u, { status: "failed", error: S.message });
      } finally {
        b.current.delete(u);
      }
    }
  }, [e, T, r]), V = re(async (u) => {
    if (!u.requestId || b.current.has(u.id)) return;
    b.current.add(u.id);
    const d = (S) => y((O) => O.map((B) => B.id === u.id ? { ...B, status: S.status, outputs: S.outputs, error: S.error, cost: S.cost ?? B.cost } : B));
    try {
      const S = await Nt(e, u.requestId, { signal: U.current.signal, onUpdate: d });
      d(S), r == null || r();
    } catch {
    } finally {
      b.current.delete(u.id);
    }
  }, [e, r]);
  H(() => {
    const u = new Set(ze(n).map((d) => d.requestId));
    for (const d of m) (d.status === "pending" || d.status === "processing") && d.requestId && !u.has(d.requestId) && V(d);
  }, [m, n, V]), H(() => {
    if (!(!i || I.current)) {
      I.current = !0;
      for (const u of ze(n))
        u.status !== "pending" && u.status !== "processing" || (u.requestId ? E(u.id, u.requestId) : Date.now() - u.createdAt > 6e4 && T(u.id, { status: "failed", error: "Interrupted before it was sent. Check your account activity, then run it again." }));
    }
  }, [i]);
  const K = re(async (u = !1) => {
    if (!G.current) {
      f(!0), N(null);
      try {
        const d = await e.history(u ? void 0 : p ?? void 0), S = d.items.map((O) => Tr(O, $.current));
        y((O) => u ? S : [...O, ...S]), g(d.next_cursor);
      } catch (d) {
        d instanceof ye && [403, 404, 405].includes(d.status) ? (G.current = !0, g(null)) : N(d.message);
      } finally {
        f(!1);
      }
    }
  }, [e, p]), h = q(!1);
  H(() => {
    t && !h.current && (h.current = !0, K(!0));
  }, [t, K]);
  const D = re((u) => {
    const d = Array.from({ length: u.count }, () => ({
      id: Or(),
      model: u.model,
      mode: u.mode,
      prompt: u.prompt,
      inputs: u.payload,
      status: "pending",
      outputs: [],
      createdAt: Date.now(),
      label: null,
      cost: u.unitCost,
      source: "local"
    }));
    return s((S) => [...d, ...S]), Promise.all(d.map(async (S) => {
      try {
        const { requestId: O, cost: B } = await e.submit(u.endpointUrl, u.payload, u.kind);
        T(S.id, { requestId: O, ...B !== void 0 ? { cost: B } : {} }), await E(S.id, O);
      } catch (O) {
        T(S.id, { status: "failed", error: O.message });
      }
    }));
  }, [e, T, E]), R = ae(() => {
    const u = (d) => ({ ...d, label: d.requestId && M[d.requestId] || d.label });
    return Lr(o.map(u), m.map(u), new Set(x));
  }, [o, m, M, x]), c = re((u, d) => {
    u.requestId && j((S) => {
      const O = { ...S };
      return d ? O[u.requestId] = d : delete O[u.requestId], O;
    }), T(u.id, { label: d });
  }, [T]), k = re((u) => {
    s((d) => d.filter((S) => S.id !== u.id)), u.requestId && w((d) => [.../* @__PURE__ */ new Set([...d, u.requestId])]);
  }, []), P = re(async (u) => {
    u.requestId && (await e.deleteMedia(u.requestId), T(u.id, { outputs: [] }), y((d) => d.map((S) => S.requestId === u.requestId ? { ...S, outputs: [] } : S)));
  }, [e, T]);
  return { items: R, run: D, setLabel: c, remove: k, deleteMedia: P, loadMore: () => K(!1), hasMore: !!p, loadingMore: C, serverError: v };
}
const Pr = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Kt(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : Pr.test(e) ? "file" : "image" : "text";
}
function Vr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const Ur = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), Q = ({ children: e, ...t }) => /* @__PURE__ */ a("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), je = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ a("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ a("path", { d: "m21 15-4.5-4.5L6 21" })
] }), qr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ a("path", { d: "m16 10 6-3v10l-6-3" })
] }), Fr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ a("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ a("circle", { cx: "17", cy: "16", r: "3" })
] }), Br = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ a("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ a("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), mt = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ a("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), zr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ a("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), pt = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), Et = ({ filled: e, ...t }) => /* @__PURE__ */ a(Q, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ a("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), ht = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ a("path", { d: "m20 20-3.5-3.5" })
] }), Ue = ({ up: e, ...t }) => /* @__PURE__ */ a(Q, { ...t, children: /* @__PURE__ */ a("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), Hr = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), Jr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "3" })
] }), Qe = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), $e = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "m5 12 5 5 9-10" }) }), fe = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "M6 6l12 12M18 6 6 18" }) }), ft = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), Wr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ a("path", { d: "M12 11v5M12 8v.01" })
] }), ke = (e) => /* @__PURE__ */ a(Q, { ...e, className: "ms-spin", children: /* @__PURE__ */ a("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Yr = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Kr = (e) => /* @__PURE__ */ a(Q, { ...e, children: /* @__PURE__ */ a("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), Xr = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ a("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), $t = (e) => /* @__PURE__ */ l(Q, { ...e, children: [
  /* @__PURE__ */ a("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ a("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Xt({ url: e }) {
  return /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ a(mt, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let Tt = null;
const Qr = () => Tt ?? (Tt = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw Tt = null, e;
}));
function Zr({ url: e, hidden: t = !1 }) {
  const [r, n] = A("loading"), i = q(null);
  return H(() => {
    let o = !0;
    return n("loading"), Qr().catch(() => o && n("failed")), () => {
      o = !1;
    };
  }, [e]), H(() => {
    const o = i.current;
    if (!o) return;
    const s = () => n("ready"), m = () => n("failed");
    return o.addEventListener("load", s), o.addEventListener("error", m), () => {
      o.removeEventListener("load", s), o.removeEventListener("error", m);
    };
  }), r === "failed" ? /* @__PURE__ */ a(Xt, { url: e }) : /* @__PURE__ */ l("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    dr("model-viewer", {
      ref: i,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    r === "loading" && /* @__PURE__ */ l("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ a(ke, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    r === "ready" && /* @__PURE__ */ a("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ a(mt, { width: 14, height: 14 }) })
  ] });
}
const ea = ["All", "Approved", "Rejected", "Unlabeled"], ta = [1, 2, 4, 6, 8];
function ra({ url: e, hidden: t, onOpen: r }) {
  const n = t ? { filter: "blur(18px)" } : void 0, i = Kt(e);
  return i === "text" ? /* @__PURE__ */ a("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: Vr(e) }) : i === "video" ? /* @__PURE__ */ a("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : i === "audio" ? /* @__PURE__ */ a("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ a("audio", { src: e, controls: !0, className: "w-full" }) }) : i === "3d" ? Ur(e) ? /* @__PURE__ */ a(Zr, { url: e, hidden: t }) : /* @__PURE__ */ a(Xt, { url: e }) : i === "file" ? /* @__PURE__ */ l("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ a(Qe, { width: 28, height: 28 }),
    /* @__PURE__ */ a("span", { className: "break-all", children: aa(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ a("button", { type: "button", onClick: r, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ a("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function aa(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e;
  }
}
function na({ g: e, hidden: t, onLabel: r, onRemove: n, onReuse: i, onRerun: o, onDeleteMedia: s, onOpen: m, estimateFor: y }) {
  const [p, g] = A(0), C = e.outputs.length, f = Math.min(p, Math.max(C - 1, 0)), v = e.outputs[f], N = !!v && Kt(v) === "text", [G, M] = A(!1), [j, x] = A(null), w = Ht(), b = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", I = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ l("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && v ? /* @__PURE__ */ l("div", { className: "relative", children: [
      /* @__PURE__ */ a(ra, { url: v, hidden: t, onOpen: () => m(v) }),
      C > 1 && /* @__PURE__ */ l("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ a("button", { type: "button", "aria-label": "Previous output", disabled: f === 0, onClick: () => g(f - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ l("span", { "aria-live": "polite", children: [
          f + 1,
          " / ",
          C
        ] }),
        /* @__PURE__ */ a("button", { type: "button", "aria-label": "Next output", disabled: f === C - 1, onClick: () => g(f + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ l("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ a(fe, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ a("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ l("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ a(ke, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ l("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ a("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ l("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ a("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ a("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ce(e.cost) : e.status === "completed" && (y == null ? void 0 : y(e.model)) !== void 0 ? `est. ${ce(y(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && v && (N ? /* @__PURE__ */ a("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(v)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${I} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ a(Qe, { width: 14, height: 14 }) }) : /* @__PURE__ */ a("a", { href: v, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${I} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ a(Qe, { width: 14, height: 14 }) })),
        /* @__PURE__ */ a(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => r(e, e.label === "approved" ? null : "approved"),
            className: `${I} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ a($e, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ a(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "rejected",
            "aria-label": "Reject",
            title: "Reject",
            onClick: () => r(e, e.label === "rejected" ? null : "rejected"),
            className: `${I} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ a(fe, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ a("button", { type: "button", onClick: () => i(e), title: "Load this model and settings back into the form", className: b, children: "Reuse" }),
        /* @__PURE__ */ a("button", { type: "button", onClick: () => o(e), title: "Generate again with the same settings", className: b, children: "Re-run" }),
        e.status === "completed" && v && /* @__PURE__ */ a("button", { type: "button", onClick: () => {
          var U;
          (U = navigator.clipboard) == null || U.writeText(v).then(() => {
            M(!0), setTimeout(() => M(!1), 1500);
          }).catch(() => {
          });
        }, className: b, children: G ? "Copied" : N ? "Copy text" : "Copy link" })
      ] }),
      j && /* @__PURE__ */ l("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        j
      ] }),
      /* @__PURE__ */ l("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ l("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ l("span", { className: "flex shrink-0 gap-3", children: [
          w.deleteMedia && e.requestId && e.status === "completed" && v && /* @__PURE__ */ a("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (x(null), s(e).catch((U) => x(U.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function oa({ url: e, onClose: t }) {
  const r = q(null), n = q(null);
  return H(() => {
    var s;
    const i = document.activeElement;
    (s = n.current) == null || s.focus();
    const o = (m) => {
      var y;
      if (m.key === "Escape") {
        t();
        return;
      }
      m.key === "Tab" && (m.preventDefault(), (y = n.current) == null || y.focus());
    };
    return document.addEventListener("keydown", o), () => {
      var m;
      document.removeEventListener("keydown", o), (m = i == null ? void 0 : i.focus) == null || m.call(i);
    };
  }, [t]), /* @__PURE__ */ l("div", { ref: r, role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ a("button", { ref: n, type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ a(fe, { width: 24, height: 24 }) }),
    /* @__PURE__ */ a("img", { src: e, alt: "Full size output", onClick: (i) => i.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function ia({ mode: e, items: t, batch: r, onBatch: n, onLabel: i, onRemove: o, onReuse: s, onRerun: m, onDeleteMedia: y, onLoadMore: p, hasMore: g, loadingMore: C, serverError: f, estimateFor: v }) {
  const [N, G] = A("All"), [M, j] = A(""), [x, w] = A(!1), [b, I] = A(null), U = ae(() => {
    const $ = M.trim().toLowerCase();
    return t.filter((T) => T.mode !== e || N === "Approved" && T.label !== "approved" || N === "Rejected" && T.label !== "rejected" || N === "Unlabeled" && T.label !== null ? !1 : !$ || T.prompt.toLowerCase().includes($) || T.model.toLowerCase().includes($));
  }, [t, e, N, M]);
  return /* @__PURE__ */ l("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ a("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: ea.map(($) => /* @__PURE__ */ a(
        "button",
        {
          role: "tab",
          "aria-selected": N === $,
          onClick: () => G($),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${N === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ l("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ a(ht, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ a("input", { value: M, onChange: ($) => j($.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ a("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: ta.map(($) => /* @__PURE__ */ a(
        "button",
        {
          role: "radio",
          "aria-checked": r === $,
          onClick: () => n($),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${r === $ ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: $
        },
        $
      )) }),
      /* @__PURE__ */ a("button", { type: "button", "aria-pressed": x, "aria-label": x ? "Show previews" : "Hide previews", title: x ? "Show previews" : "Hide previews", onClick: () => w(($) => !$), className: x ? "text-primary" : "text-secondary hover:text-fg", children: x ? /* @__PURE__ */ a(Hr, { width: 18, height: 18 }) : /* @__PURE__ */ a(Jr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      U.length === 0 ? /* @__PURE__ */ l("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ a("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ a(pt, { width: 36, height: 36 }) }),
        /* @__PURE__ */ a("p", { className: "font-semibold", children: t.some(($) => $.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ a("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some(($) => $.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ a("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: U.map(($) => /* @__PURE__ */ a(na, { g: $, hidden: x, onLabel: i, onRemove: o, onReuse: s, onRerun: m, onDeleteMedia: y, onOpen: I, estimateFor: v }, $.id)) }),
      f && /* @__PURE__ */ l("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        f
      ] }),
      g && /* @__PURE__ */ a("div", { className: "mt-4 text-center", children: /* @__PURE__ */ a("button", { type: "button", disabled: C, onClick: p, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: C ? "Loading…" : "Load more history" }) }),
      b && /* @__PURE__ */ a(oa, { url: b, onClose: () => I(null) })
    ] })
  ] });
}
const sa = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
function Pe(e, t) {
  return t ? t.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean).some((r) => r.endsWith("/*") ? e.type.toLowerCase().startsWith(r.slice(0, -1)) : r.startsWith(".") ? e.name.toLowerCase().endsWith(r) : e.type.toLowerCase() === r) : !0;
}
const la = (e) => e ? e.startsWith("image") ? "image files" : e.startsWith("video") ? "video files" : e.startsWith("audio") ? "audio files" : "those file types" : "files", Lt = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function ca(e, t, r) {
  const n = t.map((p) => ({ id: sa(), name: p.name || "file", size: p.size, state: "queued", file: p })), i = (p) => r.onItem({ ...p });
  let o = Math.max(r.max, 0);
  const s = [];
  for (const p of n)
    Pe(p.file, r.accept) ? p.size === 0 ? (p.state = "failed", p.error = "The file is empty.") : o <= 0 ? (p.state = "failed", p.error = "No room left in this field.") : (o -= 1, s.push(p)) : (p.state = "failed", p.error = `This field takes ${la(r.accept)}.`), i(p);
  let m = 0;
  const y = async () => {
    for (; m < s.length; ) {
      const p = s[m++];
      p.state = "uploading", i(p);
      try {
        p.url = await e.upload(p.file), p.state = "done";
      } catch (g) {
        p.state = "failed", p.error = g.message || "Upload failed";
      }
      i(p);
    }
  };
  return await Promise.all(Array.from({ length: Math.min(r.concurrency ?? 3, s.length) }, y)), { urls: n.filter((p) => p.state === "done" && p.url).map((p) => p.url), items: n };
}
const _t = "muapi-studio:uploads:v1", da = 40, gt = (e) => e ? `${_t}:${e}` : _t;
function bt(e = "") {
  try {
    const t = localStorage.getItem(gt(e)), r = t ? JSON.parse(t) : [];
    return Array.isArray(r) ? r.filter((n) => n && typeof n.url == "string") : [];
  } catch {
    return [];
  }
}
function ua(e, t) {
  const r = /* @__PURE__ */ new Set(), n = [...t, ...bt(e)].filter((i) => r.has(i.url) ? !1 : (r.add(i.url), !0)).slice(0, da);
  try {
    localStorage.setItem(gt(e), JSON.stringify(n));
  } catch {
  }
  return n;
}
function ma(e, t) {
  const r = bt(e).filter((n) => n.url !== t);
  try {
    localStorage.setItem(gt(e), JSON.stringify(r));
  } catch {
  }
  return r;
}
const Qt = lt(null), Zt = lt("");
function pa(e) {
  const t = ct(Qt), r = q(e);
  r.current = e, H(() => t == null ? void 0 : t.register({
    get accept() {
      return r.current.accept;
    },
    hasRoom: () => r.current.hasRoom(),
    priority: () => r.current.priority(),
    receive: (n) => r.current.receive(n)
  }), [t]);
}
const _e = (e) => {
  var t;
  return Array.from(((t = e.dataTransfer) == null ? void 0 : t.types) ?? []).includes("Files");
};
function ha(e, t) {
  const r = t.map((o, s) => ({ t: o, i: s })).sort((o, s) => o.t.priority() - s.t.priority() || o.i - s.i).map((o) => o.t), n = /* @__PURE__ */ new Map(), i = [];
  for (const o of e) {
    const s = r.find((m) => m.hasRoom() && Pe(o, m.accept));
    if (!s) {
      i.push(o);
      continue;
    }
    n.set(s, [...n.get(s) ?? [], o]);
  }
  return { assigned: n, rejected: i };
}
function er({ children: e, className: t = "" }) {
  const r = q(/* @__PURE__ */ new Set()), [n, i] = A(!1), [o, s] = A(null), m = q(0), y = ae(() => ({ register: (g) => (r.current.add(g), () => {
    r.current.delete(g);
  }) }), []);
  H(() => {
    const g = () => {
      m.current = 0, i(!1);
    };
    return document.addEventListener("dragend", g), document.addEventListener("drop", g), () => {
      document.removeEventListener("dragend", g), document.removeEventListener("drop", g);
    };
  }, []), H(() => {
    if (!o) return;
    const g = setTimeout(() => s(null), 3500);
    return () => clearTimeout(g);
  }, [o]);
  const p = re((g) => {
    if (m.current = 0, i(!1), !_e(g) || g.defaultPrevented) return;
    g.preventDefault();
    const C = Array.from(g.dataTransfer.files);
    if (!C.length) return;
    const { assigned: f, rejected: v } = ha(C, [...r.current]);
    f.forEach((N, G) => G.receive(N)), v.length && s(f.size ? `${v.length} file${v.length > 1 ? "s" : ""} did not fit any field here.` : "No field here takes that kind of file.");
  }, []);
  return /* @__PURE__ */ a(Qt.Provider, { value: y, children: /* @__PURE__ */ l(
    "div",
    {
      className: `relative ${t}`,
      onDragEnter: (g) => {
        _e(g) && (m.current += 1, i(!0));
      },
      onDragOver: (g) => {
        _e(g) && g.preventDefault();
      },
      onDragLeave: (g) => {
        _e(g) && (m.current = Math.max(m.current - 1, 0), m.current === 0 && i(!1));
      },
      onDrop: p,
      children: [
        e,
        n && /* @__PURE__ */ l("div", { "aria-hidden": "true", className: "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-primary bg-black/70 text-sm font-semibold text-primary", children: [
          /* @__PURE__ */ a(ft, { width: 28, height: 28 }),
          "Drop to upload"
        ] }),
        o && /* @__PURE__ */ a("div", { role: "status", className: "sticky bottom-0 mt-2 rounded-ctl border border-line bg-panel-bg px-3 py-2 text-xs text-secondary", children: o })
      ]
    }
  ) });
}
const fa = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, ga = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function ba(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? fa.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || ga.test(e.name) ? "media" : "text" : "text";
}
function He(e) {
  var s, m;
  const t = (m = (s = e.input_schema) == null ? void 0 : s.schemas) == null ? void 0 : m.input_data, r = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(r), i = [...n.filter((y) => r[y]), ...Object.keys(r).filter((y) => !n.includes(y))], o = new Set(e.required_fields ?? []);
  return i.map((y) => ({ prop: { ...r[y], name: y }, kind: ba({ ...r[y], name: y }), required: o.has(y) }));
}
function Ze(e) {
  var r;
  const t = {};
  for (const { prop: n, kind: i, required: o } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : o && (i === "textarea" || i === "text") && typeof ((r = n.examples) == null ? void 0 : r[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const xe = (e) => `__auto:${e}`, et = (e) => (e.kind === "number" || e.kind === "select") && !e.required, tt = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function Je(e, t) {
  const r = {};
  for (const { prop: n, kind: i } of e) {
    if (t[xe(n.name)] === !0) continue;
    const o = t[n.name] ?? n.default;
    if (!tt(o))
      if (i === "number") {
        const s = Number(o);
        Number.isFinite(s) && (r[n.name] = s);
      } else if (i === "json" && typeof o == "string")
        try {
          r[n.name] = JSON.parse(o);
        } catch {
        }
      else r[n.name] = o;
  }
  return r;
}
function ya(e, t) {
  for (const { prop: r, kind: n, required: i } of e) {
    if (t[xe(r.name)] === !0) continue;
    const o = t[r.name] ?? r.default, s = r.title || r.name;
    if (i && tt(o)) return `${s} is required`;
    if (n === "json" && typeof o == "string" && o)
      try {
        JSON.parse(o);
      } catch {
        return `${s} must be valid JSON`;
      }
    if (n === "number" && !tt(o)) {
      const m = Number(o);
      if (!Number.isFinite(m)) return `${s} must be a number`;
      if (r.minValue !== void 0 && m < r.minValue) return `${s} must be at least ${r.minValue}`;
      if (r.maxValue !== void 0 && m > r.maxValue) return `${s} must be at most ${r.maxValue}`;
    }
  }
  return null;
}
const xa = 12, yt = 240, De = (e) => `${typeof e}:${e}`, va = (e) => e.map((t) => ({ value: t, label: String(t) }));
function wa(e, t) {
  const r = t.trim().toLowerCase();
  return r ? e.filter((n) => n.label.toLowerCase().includes(r)) : e;
}
function ka(e, t, r = yt) {
  return e >= r || e >= t ? "down" : "up";
}
const Na = 36, Sa = 48;
function Ca(e, t) {
  return Math.min(yt, Math.max(1, e) * Na + 8) + (t ? Sa : 0);
}
function Aa(e, t, r) {
  return r <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, r - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? r - 1 : t === "PageDown" ? Math.min(e + 5, r - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const Dt = "Auto (let model decide)", We = "__auto__";
function rt({ id: e, label: t, options: r, value: n, onChange: i, allowAuto: o, auto: s, onAuto: m, combobox: y }) {
  const p = ur(), g = e ?? `ms-dd-${p}`, C = y ?? r.length > xa, [f, v] = A(!1), [N, G] = A(""), [M, j] = A(0), [x, w] = A("down"), b = q(null), I = q(null), U = q(null), $ = r.find((c) => n !== void 0 && De(c.value) === De(n)), T = ae(() => C ? wa(r, N) : r, [C, r, N]), E = ae(
    () => [...o ? [{ key: We, label: Dt, value: We, isAuto: !0 }] : [], ...T.map((c) => ({ key: De(c.value), label: c.label, hint: c.hint, value: c.value }))],
    [o, T]
  ), V = s ? We : $ ? De($.value) : void 0, K = () => {
    v(!1), G("");
  }, h = (c) => {
    c.isAuto ? m == null || m() : i(c.value), K();
  };
  mr(() => {
    if (!f || !b.current) return;
    const c = b.current.getBoundingClientRect();
    let k = b.current.parentElement;
    for (; k && !/(auto|scroll)/.test(getComputedStyle(k).overflowY); ) k = k.parentElement;
    const P = k ? k.getBoundingClientRect() : null, u = Math.min(window.innerHeight, P ? P.bottom : window.innerHeight), d = Math.max(0, P ? P.top : 0);
    w(ka(u - c.bottom, c.top - d, Ca(r.length + (o ? 1 : 0), C)));
  }, [f]), H(() => {
    if (!f) return;
    const c = E.findIndex((k) => k.key === V);
    j(c >= 0 ? c : 0);
  }, [f, N]), H(() => {
    var c, k, P;
    f && ((P = (k = (c = I.current) == null ? void 0 : c.querySelector(`[data-i="${M}"]`)) == null ? void 0 : k.scrollIntoView) == null || P.call(k, { block: "nearest" }));
  }, [M, f]), H(() => {
    var c;
    f && C && ((c = U.current) == null || c.focus());
  }, [f, C]), H(() => {
    if (!f) return;
    const c = (k) => {
      var P;
      (P = b.current) != null && P.contains(k.target) || K();
    };
    return document.addEventListener("mousedown", c), () => document.removeEventListener("mousedown", c);
  }, [f]);
  const D = (c) => {
    if (!f) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(c.key) && (c.preventDefault(), v(!0));
      return;
    }
    if (c.key === "Escape") {
      c.preventDefault(), c.stopPropagation(), K();
      return;
    }
    if (c.key === "Enter") {
      c.preventDefault(), E[M] && h(E[M]);
      return;
    }
    if (c.key === "Tab") {
      K();
      return;
    }
    if (c.key === " " && !C) {
      c.preventDefault(), E[M] && h(E[M]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(c.key) && (c.preventDefault(), j((k) => Aa(k, c.key, E.length)));
  }, R = s ? Dt : ($ == null ? void 0 : $.label) ?? "Select…";
  return /* @__PURE__ */ l("div", { ref: b, className: "relative w-full", onKeyDown: D, children: [
    /* @__PURE__ */ l(
      "button",
      {
        id: g,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": f,
        "aria-label": `${t}: ${R}`,
        "aria-controls": `${g}-list`,
        onClick: () => v((c) => !c),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${f ? "border-primary" : "border-line hover:border-muted"} ${s ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ a("span", { className: "truncate", children: R }),
          /* @__PURE__ */ a(Ue, { up: f, width: 16, height: 16 })
        ]
      }
    ),
    f && /* @__PURE__ */ l("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${x === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      C && /* @__PURE__ */ a(
        "input",
        {
          ref: U,
          value: N,
          onChange: (c) => G(c.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${g}-list`,
          "aria-activedescendant": E[M] ? `${g}-o${M}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ l("ul", { id: `${g}-list`, ref: I, role: "listbox", "aria-label": t, style: { maxHeight: yt }, className: "overflow-y-auto", children: [
        E.map((c, k) => {
          const P = c.key === V;
          return /* @__PURE__ */ l(
            "li",
            {
              id: `${g}-o${k}`,
              "data-i": k,
              role: "option",
              "aria-selected": P,
              onMouseEnter: () => j(k),
              onClick: () => h(c),
              className: `flex cursor-pointer items-center justify-between gap-2 ${c.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${P ? "bg-primary text-primary-ink" : k === M ? "bg-card-bg" : ""} ${c.isAuto && !P ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ l("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ a("span", { className: "block truncate", children: c.label }),
                  c.hint && /* @__PURE__ */ a("span", { className: `block truncate text-[11px] ${P ? "opacity-70" : "text-muted"}`, children: c.hint })
                ] }),
                P && /* @__PURE__ */ a($e, { width: 14, height: 14 })
              ]
            },
            c.key
          );
        }),
        E.length === 0 && /* @__PURE__ */ a("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const Ia = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function Ma({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ a("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ a("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ a("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ a(je, {}) });
}
function Ea({ client: e, max: t, initialType: r = "image", onInsert: n, onClose: i }) {
  const [o, s] = A(r), [m, y] = A(""), [p, g] = A(1), [C, f] = A(null), [v, N] = A(null), [G, M] = A(!1), [j, x] = A([]), [w, b] = A(""), [I, U] = A(!1), $ = q(null), T = q(null), E = q(0), V = re(async () => {
    const c = ++E.current;
    M(!0), N(null);
    try {
      const k = await e.mediaLibrary({ mediaType: o, search: m, page: p });
      c === E.current && f(k);
    } catch (k) {
      c === E.current && N(k.message);
    } finally {
      c === E.current && M(!1);
    }
  }, [e, o, m, p]);
  H(() => {
    const c = setTimeout(V, m ? 300 : 0);
    return () => clearTimeout(c);
  }, [V, m]), H(() => {
    g(1);
  }, [o, m]), H(() => {
    var P;
    const c = document.activeElement;
    (P = $.current) == null || P.focus();
    const k = (u) => {
      if (u.key === "Escape") {
        u.stopPropagation(), i();
        return;
      }
      if (u.key !== "Tab" || !$.current) return;
      const d = [...$.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!d.length) return;
      const S = d[0], O = d[d.length - 1];
      u.shiftKey && document.activeElement === S ? (u.preventDefault(), O.focus()) : !u.shiftKey && document.activeElement === O && (u.preventDefault(), S.focus());
    };
    return document.addEventListener("keydown", k), () => {
      var u;
      document.removeEventListener("keydown", k), (u = c == null ? void 0 : c.focus) == null || u.call(c);
    };
  }, [i]);
  const K = (c) => x((k) => k.includes(c) ? k.filter((P) => P !== c) : t === 1 ? [c] : k.length < t ? [...k, c] : k), h = async (c) => {
    if (c.length) {
      M(!0), N(null);
      try {
        for (const k of c) {
          const P = await e.upload(k);
          await e.saveToLibrary({ url: P, name: k.name, mime_type: k.type || void 0, size_bytes: k.size, media_type: k.type.startsWith("video") ? "video" : k.type.startsWith("audio") ? "audio" : k.type.startsWith("image") ? "image" : "archive" });
        }
        await V();
      } catch (k) {
        N(k.message), M(!1);
      }
    }
  }, D = async () => {
    var k;
    const c = w.trim();
    if (!/^https?:\/\//i.test(c)) {
      N("Enter a full http(s) URL");
      return;
    }
    M(!0), N(null);
    try {
      const P = ((k = c.split("?")[0].split(".").pop()) == null ? void 0 : k.toLowerCase()) ?? "", u = ["mp4", "webm", "mov"].includes(P) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(P) ? "audio" : ["zip", "rar", "7z"].includes(P) ? "archive" : "image";
      await e.saveToLibrary({ url: c, name: c.split("/").pop() || "link", media_type: u }), b(""), U(!1), await V();
    } catch (P) {
      N(P.message), M(!1);
    }
  }, R = async (c) => {
    if (window.confirm(`Delete "${c.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(c.id), x((k) => k.filter((P) => P !== c.url)), await V();
      } catch (k) {
        N(k.message);
      }
  };
  return /* @__PURE__ */ a("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (c) => {
    c.target === c.currentTarget && i();
  }, children: /* @__PURE__ */ l("div", { ref: $, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ l("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ a("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ a(je, {}) }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ l("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ a("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ l("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
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
      /* @__PURE__ */ a("input", { ref: T, type: "file", hidden: !0, multiple: !0, onChange: (c) => {
        const k = Array.from(c.target.files ?? []);
        c.target.value = "", h(k);
      } }),
      /* @__PURE__ */ l("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var c;
        return (c = T.current) == null ? void 0 : c.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ a(ft, { width: 14, height: 14 }),
        /* @__PURE__ */ a("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ a("button", { type: "button", "aria-label": "Close", onClick: i, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ a(fe, {}) })
    ] }),
    /* @__PURE__ */ l("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: Ia.map((c) => /* @__PURE__ */ a("button", { role: "tab", "aria-selected": o === c.id, onClick: () => s(c.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${o === c.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: c.label }, c.id)) }),
      /* @__PURE__ */ a("input", { value: m, onChange: (c) => y(c.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ a("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": I, onClick: () => U((c) => !c), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    I && /* @__PURE__ */ l("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ a("input", { value: w, onChange: (c) => b(c.target.value), onKeyDown: (c) => c.key === "Enter" && void D(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ a("button", { type: "button", onClick: () => void D(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ l("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      v && /* @__PURE__ */ a("p", { role: "alert", className: "mb-3 text-sm text-danger", children: v }),
      G && !C ? /* @__PURE__ */ l("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ a(ke, {}),
        " Loading…"
      ] }) : C != null && C.items.length ? /* @__PURE__ */ a("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: C.items.map((c) => {
        const k = j.includes(c.url);
        return /* @__PURE__ */ l("li", { className: `group relative overflow-hidden rounded-card border ${k ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ a("button", { type: "button", "aria-pressed": k, "aria-label": `${k ? "Deselect" : "Select"} ${c.name ?? "file"}`, onClick: () => K(c.url), className: "block aspect-square w-full", children: /* @__PURE__ */ a(Ma, { a: c }) }),
          k && /* @__PURE__ */ a("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ a($e, { width: 12, height: 12 }) }),
          /* @__PURE__ */ a("button", { type: "button", "aria-label": `Delete ${c.name ?? "file"}`, onClick: () => void R(c), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ a(fe, { width: 12, height: 12 }) }),
          /* @__PURE__ */ a("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: c.name ?? "", children: c.name })
        ] }, c.id);
      }) }) : /* @__PURE__ */ l("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ a("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ a(je, { width: 28, height: 28 }) }),
        /* @__PURE__ */ a("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ a("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      C && C.total_pages > 1 && /* @__PURE__ */ l("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ a("button", { type: "button", disabled: p <= 1, onClick: () => g((c) => c - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        p,
        " of ",
        C.total_pages,
        /* @__PURE__ */ a("button", { type: "button", disabled: p >= C.total_pages, onClick: () => g((c) => c + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ l("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ l("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ a("b", { className: "text-primary", children: j.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !j.length, onClick: () => {
        n(j), i();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ a($e, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const tr = (e, t = "") => {
  const r = `${e ?? ""} ${t}`.toLowerCase();
  return r.includes("video") ? "video/*" : r.includes("audio") || r.includes("voice") ? "audio/*" : r.includes("image") || r.includes("mask") || r.includes("photo") || r.includes("face") ? "image/*" : void 0;
}, $a = (e, t = "") => {
  const r = tr(e, t);
  return r === "video/*" ? "video" : r === "audio/*" ? "audio" : r === "image/*" ? "image" : "all";
};
function at({ client: e, field: t, multiple: r, max: n, current: i, onUrls: o, onError: s }) {
  const m = q(null), [y, p] = A(!1), [g, C] = A(!1), [f, v] = A(!1), [N, G] = A([]), M = ct(Zt), [j, x] = A(() => bt(M)), w = n - i.length, b = Ht(), I = tr(t.prop.field, t.prop.name), U = N.some((h) => h.state === "queued" || h.state === "uploading"), $ = re((h) => {
    G((D) => D.some((R) => R.id === h.id) ? D.map((R) => R.id === h.id ? h : R) : [...D, h]), h.state === "done" && setTimeout(() => G((D) => D.filter((R) => R.id !== h.id)), 1800);
  }, []), T = async (h) => {
    if (!(!h.length || r && w <= 0))
      try {
        const D = await ca(e, r ? h : h.slice(0, 1), { accept: I, max: r ? w : 1, onItem: $ });
        if (D.urls.length) {
          o(D.urls);
          const R = D.items.filter((c) => c.state === "done" && c.url && c.file);
          x(ua(M, R.map((c) => ({ url: c.url, name: c.name, type: Lt(c.file), at: Date.now() })))), b.library && R.forEach((c) => void e.saveToLibrary({ url: c.url, name: c.name, mime_type: c.file.type || void 0, size_bytes: c.size, media_type: Lt(c.file) }).catch(() => {
          }));
        }
      } catch (D) {
        s(D.message);
      }
  }, E = (h) => {
    G((D) => D.filter((R) => R.id !== h.id)), h.file && T([h.file]);
  };
  pa({ accept: I, hasRoom: () => r ? w > 0 : !0, priority: () => i.length === 0 ? 0 : 1, receive: (h) => void T(h) });
  const V = j.filter((h) => Pe({ type: h.type === "archive" ? "" : `${h.type}/x`, name: h.name }, I)), K = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ l(
    "div",
    {
      onDragOver: (h) => {
        h.preventDefault(), p(!0);
      },
      onDragLeave: () => p(!1),
      onDrop: (h) => {
        h.preventDefault(), p(!1), T(Array.from(h.dataTransfer.files));
      },
      onPaste: (h) => {
        var R;
        const D = Array.from(((R = h.clipboardData) == null ? void 0 : R.files) ?? []);
        D.length && (h.preventDefault(), T(D));
      },
      className: `rounded-card border border-dashed p-2 ${y ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ a("input", { ref: m, type: "file", hidden: !0, accept: I, multiple: r, onChange: (h) => {
          const D = Array.from(h.target.files ?? []);
          h.target.value = "", T(D);
        } }),
        (r ? w > 0 : !0) && /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ a(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: r ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: r ? void 0 : i[0] ?? "",
              defaultValue: void 0,
              onChange: r ? void 0 : (h) => o([h.target.value]),
              onKeyDown: r ? (h) => {
                h.key === "Enter" && h.currentTarget.value.trim() && (o([h.currentTarget.value.trim()]), h.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ a("button", { type: "button", disabled: U, onClick: () => {
            var h;
            return (h = m.current) == null ? void 0 : h.click();
          }, "aria-label": "Upload file", title: "Upload file", className: K, children: U ? /* @__PURE__ */ a(ke, { width: 16, height: 16 }) : /* @__PURE__ */ a(ft, { width: 16, height: 16 }) }),
          V.length > 0 && /* @__PURE__ */ a("button", { type: "button", "aria-haspopup": "listbox", "aria-expanded": f, onClick: () => v((h) => !h), "aria-label": "Recent uploads", title: "Recent uploads", className: K, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ a("circle", { cx: "12", cy: "12", r: "9" }),
            /* @__PURE__ */ a("path", { d: "M12 7v5l3 2" })
          ] }) }),
          b.library && /* @__PURE__ */ a("button", { type: "button", onClick: () => C(!0), "aria-label": "Choose from media library", title: "Media library", className: K, children: /* @__PURE__ */ l("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ a("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ a("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        f && V.length > 0 && /* @__PURE__ */ a("ul", { role: "listbox", "aria-label": "Recent uploads", className: "mt-2 max-h-44 overflow-y-auto rounded-ctl border border-line bg-panel-bg p-1", children: V.map((h) => /* @__PURE__ */ l("li", { role: "none", className: "flex items-center gap-2", children: [
          /* @__PURE__ */ l("button", { type: "button", role: "option", "aria-selected": i.includes(h.url), onClick: () => {
            o([h.url]), v(!1);
          }, className: "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:text-primary", children: [
            h.type === "image" ? /* @__PURE__ */ a("img", { src: h.url, alt: "", loading: "lazy", className: "h-8 w-8 shrink-0 rounded object-cover" }) : /* @__PURE__ */ a("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line text-[10px] uppercase text-muted", children: h.type.slice(0, 3) }),
            /* @__PURE__ */ a("span", { className: "truncate", children: h.name })
          ] }),
          /* @__PURE__ */ a("button", { type: "button", "aria-label": `Forget ${h.name}`, title: "Forget", onClick: () => x(ma(M, h.url)), className: "flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:text-danger", children: /* @__PURE__ */ a(fe, { width: 12, height: 12 }) })
        ] }, h.url)) }),
        N.length > 0 && /* @__PURE__ */ a("ul", { "aria-label": "Uploads", className: "mt-2 space-y-1", children: N.map((h) => /* @__PURE__ */ l("li", { className: "flex items-center gap-2 text-[11px]", children: [
          h.state === "failed" ? /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-danger", children: "!" }) : h.state === "done" ? /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-primary", children: "✓" }) : /* @__PURE__ */ a(ke, { width: 12, height: 12 }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", title: h.name, children: h.name }),
          /* @__PURE__ */ a("span", { role: h.state === "failed" ? "alert" : void 0, className: h.state === "failed" ? "max-w-[55%] truncate text-danger" : "text-muted", title: h.error, children: h.state === "failed" ? h.error : h.state === "queued" ? "Waiting…" : h.state === "uploading" ? "Uploading…" : "Added" }),
          h.state === "failed" && h.file && Pe(h.file, I) && h.size > 0 && /* @__PURE__ */ a("button", { type: "button", onClick: () => E(h), className: "rounded-md border border-line px-2 py-0.5 text-secondary hover:text-primary", children: "Retry" }),
          h.state === "failed" && /* @__PURE__ */ a("button", { type: "button", "aria-label": `Dismiss ${h.name}`, onClick: () => G((D) => D.filter((R) => R.id !== h.id)), className: "text-muted hover:text-danger", children: /* @__PURE__ */ a(fe, { width: 12, height: 12 }) })
        ] }, h.id)) }),
        /* @__PURE__ */ a("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop, paste, or click to upload" }),
        g && b.library && /* @__PURE__ */ a(Ea, { client: e, max: r ? Math.max(w, 1) : 1, initialType: $a(t.prop.field, t.prop.name), onInsert: o, onClose: () => C(!1) })
      ]
    }
  );
}
function Ta({ field: e, values: t, onChange: r, client: n, onError: i, tagCount: o = 0 }) {
  const { prop: s, kind: m, required: y } = e, p = t[s.name], g = (w) => r(s.name, w), C = s.title || s.name, f = `ms-f-${s.name}`, v = p == null ? "" : String(p), N = Array.isArray(p) ? p : [], G = t[xe(s.name)] === !0, M = q(null), j = (w) => {
    const b = M.current, I = typeof p == "string" ? p : "", U = (b == null ? void 0 : b.selectionStart) ?? I.length, $ = (b == null ? void 0 : b.selectionEnd) ?? U;
    g(I.slice(0, U) + w + " " + I.slice($)), requestAnimationFrame(() => {
      b == null || b.focus(), b == null || b.setSelectionRange(U + w.length + 1, U + w.length + 1);
    });
  };
  let x;
  if (m === "textarea" || m === "json")
    x = /* @__PURE__ */ l(Ve, { children: [
      /* @__PURE__ */ a("textarea", { ref: M, id: f, rows: m === "json" ? 4 : 5, value: typeof p == "string" ? p : p ? JSON.stringify(p, null, 2) : "", onChange: (w) => g(w.target.value), className: `w-full resize-y p-3 text-sm ${m === "json" ? "font-mono text-xs" : ""}` }),
      s.name === "prompt" && o > 0 && /* @__PURE__ */ l("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ a("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(o, 9) }, (w, b) => `@image${b + 1}`).map((w) => /* @__PURE__ */ a("button", { type: "button", onClick: () => j(w), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: w }, w))
      ] })
    ] });
  else if (m === "select") {
    const w = s.enum ?? [];
    x = /* @__PURE__ */ a(
      rt,
      {
        id: f,
        label: C,
        options: va(w),
        value: p,
        onChange: (b) => {
          g(b), r(xe(s.name), !1);
        },
        allowAuto: et(e),
        auto: G,
        onAuto: () => r(xe(s.name), !0)
      }
    );
  } else if (m === "boolean") {
    const w = p === !0;
    x = /* @__PURE__ */ a(
      "button",
      {
        id: f,
        type: "button",
        role: "switch",
        "aria-checked": w,
        onClick: () => g(!w),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${w ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ a("span", { className: `h-5 w-5 rounded-full ${w ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (m === "number") {
    const w = s.minValue !== void 0 && s.maxValue !== void 0;
    x = /* @__PURE__ */ l("div", { className: `flex items-center gap-3 ${G ? "opacity-40" : ""}`, children: [
      w && /* @__PURE__ */ a("input", { type: "range", disabled: G, "aria-label": `${C} slider`, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? 0.01 : 1), value: v === "" ? s.minValue : Number(v), onChange: (b) => g(Number(b.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ a("input", { id: f, type: "number", disabled: G, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? "any" : 1), value: v, onChange: (b) => g(b.target.value === "" ? "" : Number(b.target.value)), className: `px-3 py-2 text-sm ${w ? "w-24" : "w-full"}` })
    ] });
  } else if (m === "media")
    x = /* @__PURE__ */ a(at, { client: n, field: e, multiple: !1, max: 1, current: v ? [v] : [], onUrls: (w) => g(w[0]), onError: i });
  else if (m === "media-list") {
    const w = s.maxItems ?? 8;
    x = /* @__PURE__ */ l("div", { className: "space-y-2", children: [
      N.map((b, I) => /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ a("input", { "aria-label": `${C} ${I + 1}`, value: b, onChange: (U) => g(N.map(($, T) => T === I ? U.target.value : $)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ a("button", { type: "button", "aria-label": `Remove ${C} ${I + 1}`, onClick: () => g(N.filter((U, $) => $ !== I)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ a(fe, { width: 14, height: 14 }) })
      ] }, I)),
      /* @__PURE__ */ a(at, { client: n, field: e, multiple: !0, max: w, current: N, onUrls: (b) => r(s.name, (I) => [...Array.isArray(I) ? I : [], ...b].slice(0, w)), onError: i })
    ] });
  } else
    x = /* @__PURE__ */ a("input", { id: f, value: v, onChange: (w) => g(w.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ l("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ l("label", { htmlFor: f, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        C,
        s.description && /* @__PURE__ */ a("span", { title: s.description, className: "text-muted", children: /* @__PURE__ */ a(Wr, { width: 13, height: 13 }) })
      ] }),
      et(e) && m === "number" ? /* @__PURE__ */ l("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ a("input", { type: "checkbox", checked: G, onChange: (w) => r(xe(s.name), w.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ a("span", { className: "text-[11px] text-primary", children: m === "media-list" ? `${N.length}/${s.maxItems ?? 8} items${y ? " · required" : ""}` : y ? "* required" : "" })
    ] }),
    x
  ] });
}
const Re = {
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
}, Ae = "Other", La = 3, _a = 2, Da = 20, Ra = 2, Ga = 4, Oa = 40, ja = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function rr(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", r = t.replace(/\d+[a-z]?$/, "") || t;
  return Re[t] ? Re[t] : Re[r] ? Re[r] : r.startsWith("tripo") ? "Tripo" : r === "ai" || r === "" || r.length < 2 ? Ae : ja(r);
}
function Pa(e) {
  const t = /* @__PURE__ */ new Map();
  for (const i of e) {
    const o = rr(i.name);
    t.set(o, (t.get(o) ?? 0) + 1);
  }
  let r = 0;
  const n = [];
  for (const [i, o] of t)
    i === Ae || o < La ? r += o : n.push({ id: i, label: i, count: o });
  return n.sort((i, o) => o.count - i.count || i.label.localeCompare(o.label)), r && n.push({ id: Ae, label: Ae, count: r }), n;
}
function ar(e, t) {
  const r = rr(e.name);
  return t.some((n) => n.id === r) ? r : Ae;
}
function Va(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function Ua(e) {
  let t = 7;
  for (const r of e) t = (t * 33 + r.charCodeAt(0)) % 360;
  return t;
}
const Rt = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function qa(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const r = (n) => {
    const i = Rt.indexOf(n);
    return i < 0 ? Rt.length : i;
  };
  return [...t].map(([n, i]) => ({ id: n, count: i })).sort((n, i) => r(n.id) - r(i.id) || i.count - n.count || n.id.localeCompare(i.id));
}
const be = "__favourites__", ne = "__all__";
function Fa(e, t, r) {
  return e.filter((n) => {
    var i;
    return t.category !== ne && n.category !== t.category ? !1 : t.provider === be ? !!((i = t.favourites) != null && i.includes(n.name)) : t.provider === ne || ar(n, r) === t.provider;
  });
}
const Ba = (e, t) => t.filter((r) => r.id !== Ae).length >= _a && e.length >= Da;
function za(e) {
  const t = qa(e);
  return e.length >= Oa ? t.filter((r) => r.count >= Ga) : t;
}
const Ge = 200;
function Ha({ model: e }) {
  const t = ve(e);
  return t ? /* @__PURE__ */ l("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ a("s", { className: "font-normal text-muted", children: ce(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ce(t.current)
  ] }) : null;
}
const Gt = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, Ot = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Ye({ label: e, active: t, onClick: r, hue: n, children: i }) {
  return /* @__PURE__ */ a(
    "button",
    {
      type: "button",
      role: "radio",
      "aria-checked": t,
      "aria-label": e,
      title: e,
      onClick: r,
      style: n !== void 0 && !t ? { boxShadow: `inset 0 0 0 1.5px hsl(${n} 60% 55% / 0.55)` } : void 0,
      className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${t ? "bg-primary text-primary-ink" : "bg-card-bg text-secondary hover:text-fg"}`,
      children: i
    }
  );
}
function Ja({ models: e, value: t, onChange: r, favorites: n, onToggleFavorite: i, usage: o, showGroup: s, scope: m = "default" }) {
  var u;
  const [y, p] = A(!1), [g, C] = A(""), [f, v] = A("popular"), [N, G] = A(!1), M = q(null), j = ae(() => Pa(e), [e]), x = ae(() => za(e), [e]), w = Ba(e, j), b = x.length >= Ra, [I, U] = A(() => Gt(`muapi-studio:provider:${m}`, ne)), [$, T] = A(() => Gt(`muapi-studio:category:${m}`, ne)), E = w && (I === be || I === ne || j.some((d) => d.id === I)) ? I : ne, V = b && ($ === ne || x.some((d) => d.id === $)) ? $ : ne, K = (d) => {
    U(d), Ot(`muapi-studio:provider:${m}`, d);
  }, h = (d) => {
    T(d), Ot(`muapi-studio:category:${m}`, d);
  }, D = q(null);
  H(() => {
    y || G(!1);
  }, [y]), H(() => {
    if (!y) return;
    const d = (O) => {
      var B;
      (B = M.current) != null && B.contains(O.target) || p(!1);
    }, S = (O) => {
      O.key === "Escape" && p(!1);
    };
    return document.addEventListener("mousedown", d), document.addEventListener("keydown", S), () => {
      document.removeEventListener("mousedown", d), document.removeEventListener("keydown", S);
    };
  }, [y]);
  const R = ae(() => {
    const d = g.trim().toLowerCase(), S = Fa(e, { category: V, provider: E, favourites: n }, j), O = d ? S.filter((ee) => ee.name.toLowerCase().includes(d) || ee.category.toLowerCase().includes(d)) : S, B = Wt(O, f, { usage: o, favorites: n });
    if (f === "favourites" || f === "most-used") return B;
    const ie = new Set(n);
    return [...B.filter((ee) => ie.has(ee.name)), ...B.filter((ee) => !ie.has(ee.name))];
  }, [e, g, f, n, o, V, E, j]), [c, k] = A(0);
  H(() => {
    var d, S;
    k(0), (S = (d = D.current) == null ? void 0 : d.scrollTo) == null || S.call(d, { top: 0 });
  }, [g, f, y, V, E]);
  const P = (d) => {
    d.key === "ArrowDown" ? (d.preventDefault(), k((S) => Math.min(S + 1, Math.min(R.length, Ge) - 1))) : d.key === "ArrowUp" ? (d.preventDefault(), k((S) => Math.max(S - 1, 0))) : d.key === "Enter" && R[c] && (d.preventDefault(), r(R[c].name), p(!1));
  };
  return H(() => {
    var d, S;
    (S = (d = document.getElementById(`ms-opt-${c}`)) == null ? void 0 : d.scrollIntoView) == null || S.call(d, { block: "nearest" });
  }, [c]), /* @__PURE__ */ l("div", { ref: M, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        onClick: () => p((d) => !d),
        "aria-haspopup": "listbox",
        "aria-expanded": y,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ a("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (u = (t ?? "?")[0]) == null ? void 0 : u.toUpperCase() }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ a(Ue, { up: y, width: 16, height: 16 })
        ]
      }
    ),
    y && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      w && /* @__PURE__ */ l("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ a(Ye, { label: "All providers", active: E === ne, onClick: () => K(ne), children: /* @__PURE__ */ a("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ a(Ye, { label: "Favourites", active: E === be, onClick: () => K(be), children: /* @__PURE__ */ a(Et, { width: 14, height: 14, filled: E === be }) }),
        j.map((d) => /* @__PURE__ */ a(Ye, { label: `${d.label} (${d.count})`, active: E === d.id, onClick: () => K(d.id), hue: Ua(d.label), children: Va(d.label) }, d.id))
      ] }),
      /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
        b && /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ne, label: "All" }, ...x.map((d) => ({ id: d.id, label: d.id }))].map((d) => /* @__PURE__ */ a(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": V === d.id,
            onClick: () => h(d.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${V === d.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: d.label
          },
          d.id
        )) }),
        /* @__PURE__ */ l("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ l("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ a(ht, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ a("input", { autoFocus: !0, onKeyDown: P, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${c}`, value: g, onChange: (d) => C(d.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ l("div", { className: "relative", children: [
            /* @__PURE__ */ a(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": N,
                onClick: () => G((d) => !d),
                className: `flex h-full items-center rounded-ctl border px-3 ${N ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ a(Yr, { width: 16, height: 16 })
              }
            ),
            N && /* @__PURE__ */ a("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: Mr.map((d) => /* @__PURE__ */ a("li", { role: "none", children: /* @__PURE__ */ l(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": f === d.id,
                onClick: () => {
                  v(d.id), G(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${f === d.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  d.label,
                  f === d.id && /* @__PURE__ */ a($e, { width: 14, height: 14 })
                ]
              }
            ) }, d.id)) })
          ] })
        ] }),
        (w || b) && /* @__PURE__ */ l("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ l("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            E === be ? "Favourites" : "All models",
            " · ",
            R.length
          ] }),
          w && E !== ne && E !== be && /* @__PURE__ */ a("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: E })
        ] }),
        /* @__PURE__ */ l("ul", { id: "ms-listbox", ref: D, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          R.slice(0, Ge).map((d, S) => {
            const O = d.name === t;
            return /* @__PURE__ */ a(
              "li",
              {
                id: `ms-opt-${S}`,
                role: "option",
                "aria-selected": O,
                onClick: () => {
                  r(d.name), p(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${O ? "bg-primary-soft" : S === c ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ l("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ a("div", { className: `min-w-0 flex-1 truncate text-sm ${O ? "text-primary" : ""}`, title: d.name, children: d.name }),
                    /* @__PURE__ */ a(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(d.name) ? "Remove favorite" : "Add favorite",
                        onClick: (B) => {
                          B.stopPropagation(), i(d.name);
                        },
                        className: n.includes(d.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ a(Et, { width: 15, height: 15, filled: n.includes(d.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ l("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ a("span", { className: "truncate text-[10px] text-secondary", children: s ? `${d.group_of} · ${d.category}` : w && E === ne ? `${ar(d, j)} · ${d.category}` : d.category }),
                    /* @__PURE__ */ a(Ha, { model: d })
                  ] })
                ] })
              },
              d.name
            );
          }),
          R.length === 0 && /* @__PURE__ */ a("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: f === "favourites" ? "No favourites yet. Tap the heart on a model." : f === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${g}”.` }),
          R.length > Ge && /* @__PURE__ */ l("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            Ge,
            " of ",
            R.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const jt = (e, t) => {
  try {
    const r = localStorage.getItem(e);
    return r ? JSON.parse(r) : t;
  } catch {
    return t;
  }
}, Ke = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, nr = 0.25;
function nt(e, t) {
  const r = Ze(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (r[n.prop.name] = t[n.prop.name]);
  return r;
}
function Wa(e, t) {
  const r = nt(e, t);
  for (const n of e)
    t[n.prop.name] === void 0 && (delete r[n.prop.name], et(n) && (r[xe(n.prop.name)] = !0));
  return r;
}
function Ya({ mode: e, models: t, client: r, batch: n, onRun: i, usage: o, reuse: s, switcher: m }) {
  var Le, vt;
  const y = we.find((L) => L.id === e), p = ae(() => Ir(t, e), [t, e]), [g, C] = A(), [f, v] = A(null), [N, G] = A(null), [M, j] = A({}), [x, w] = A(null), [b, I] = A(null), [U, $] = A(() => jt("muapi-studio:favorites", [])), [T, E] = A("form"), [V, K] = A(!1), [h, D] = A("{}"), [R, c] = A(null), k = q(0), P = q(null), u = q(null), d = q({ payloadKey: "", batch: 0 }), S = q(!1), O = q(0), B = q(null);
  H(() => {
    if (!V) return;
    const L = (Y) => {
      var Z;
      (Z = B.current) != null && Z.contains(Y.target) || K(!1);
    }, W = (Y) => {
      Y.key === "Escape" && K(!1);
    };
    return document.addEventListener("mousedown", L), document.addEventListener("keydown", W), () => {
      document.removeEventListener("mousedown", L), document.removeEventListener("keydown", W);
    };
  }, [V]);
  const ie = q(null), ee = q(null), ue = q("form");
  H(() => {
    var Y, Z, he;
    const L = jt(`muapi-studio:model:${e}`, null), W = ((Y = p.find((le) => le.name === L)) == null ? void 0 : Y.name) ?? ((Z = p.find((le) => le.name === Cr[e])) == null ? void 0 : Z.name) ?? ((he = Wt(p, "popular")[0]) == null ? void 0 : he.name);
    C(W);
  }, [e, p]), H(() => {
    if (!s) return;
    ie.current = s.inputs;
    const L = ee.current;
    if (L && L.name === s.model) {
      ie.current = null, j(nt(He(L), s.inputs)), E("form");
      return;
    }
    p.some((W) => W.name === s.model) ? (C(s.model), Ke(`muapi-studio:model:${e}`, s.model)) : ie.current = null, E("form");
  }, [s == null ? void 0 : s.nonce]);
  const te = p.find((L) => L.name === g);
  ee.current = f, ue.current = T, H(() => {
    if (!g) {
      v(null), j({}), w(null), G(null), I(null), c(null);
      return;
    }
    let L = !0;
    return v(null), G(null), w(null), I(null), c(null), r.model(g).then((W) => {
      if (!L) return;
      const Y = He(W), Z = ie.current;
      ie.current = null;
      const he = nt(Y, Z);
      v(W), j(he), ue.current === "json" && D(JSON.stringify(Je(Y, he), null, 2));
    }).catch((W) => {
      L && G(W.message);
    }), () => {
      L = !1;
    };
  }, [g, r]);
  const oe = ae(() => f ? He(f) : [], [f]), Ie = ae(() => Je(oe, M), [oe, M]), se = ae(() => {
    try {
      const L = JSON.parse(h);
      return L && typeof L == "object" && !Array.isArray(L) ? L : null;
    } catch {
      return null;
    }
  }, [h]), me = T === "json" ? se ?? {} : Ie, pe = JSON.stringify(me);
  H(() => {
    if (!f || T === "json" && !se) return;
    const L = ++k.current;
    P.current = null;
    const W = setTimeout(() => {
      r.estimate(f.name, me).then((Y) => {
        L === k.current && (w(Y), P.current = pe);
      }).catch(() => {
        L === k.current && w(null);
      });
    }, 500);
    return () => clearTimeout(W);
  }, [f, pe, r]), H(() => {
    c(null);
  }, [n, pe, T]);
  const Fe = (L) => {
    C(L), Ke(`muapi-studio:model:${e}`, L);
  }, Be = (L) => $((W) => {
    const Y = W.includes(L) ? W.filter((Z) => Z !== L) : [...W, L];
    return Ke("muapi-studio:favorites", Y), Y;
  }), z = (L) => {
    K(!1), L !== T && (L === "json" ? D(JSON.stringify(Ie, null, 2)) : se && j(Wa(oe, se)), E(L), I(null));
  }, J = te ? ve(te, x) : null;
  d.current = { payloadKey: pe, batch: n };
  const de = re(async (L) => {
    if (!f) return;
    c(null);
    const W = L ?? { payload: me, batch: n, unit: (J == null ? void 0 : J.current) ?? 0 }, Y = oe.find((Z) => Z.prop.name === "prompt");
    O.current = Date.now() + 1500, i({
      model: f.name,
      endpointUrl: f.endpoint_url,
      mode: e,
      payload: W.payload,
      count: W.batch,
      kind: ut(f.category),
      prompt: Y ? String(W.payload.prompt ?? "") : "",
      unitCost: W.unit
    });
  }, [f, oe, i, e, me, n, J]), ge = re(async () => {
    var L, W;
    if (!(!f || S.current || Date.now() < O.current)) {
      if (T === "json") {
        if (!se) {
          I("The JSON is not valid");
          return;
        }
        const Y = (f.required_fields ?? []).find((Z) => se[Z] === void 0 || se[Z] === "");
        if (Y) {
          I(`${Y} is required`);
          return;
        }
      } else {
        const Y = ya(oe, M);
        if (Y) {
          I(Y);
          return;
        }
      }
      I(null), S.current = !0;
      try {
        const Y = pe, Z = n, he = me;
        let le = (J == null ? void 0 : J.current) ?? 0, wt = !0;
        if (P.current !== Y) {
          try {
            le = te ? ((L = ve(te, await r.estimate(f.name, he))) == null ? void 0 : L.current) ?? le : le;
          } catch {
            wt = !1, le = te ? ((W = ve(te, null)) == null ? void 0 : W.current) ?? le : le;
          }
          if (d.current.payloadKey !== Y || d.current.batch !== Z) return;
        }
        u.current = { payload: he, batch: Z, unit: le };
        const kt = le * Z;
        if (kt > nr || !wt) {
          c(kt);
          return;
        }
        await de(u.current);
      } finally {
        S.current = !1;
      }
    }
  }, [f, T, se, oe, M, J, n, de, pe, te, r, me]), Ne = !!f && !N, Te = (() => {
    var W;
    const L = oe.find((Y) => Y.kind === "media-list");
    return L ? Math.max(((W = M[L.prop.name]) == null ? void 0 : W.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ l("section", { "aria-label": y.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l(er, { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ l("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ a("h2", { className: "text-lg font-semibold", children: y.title }),
        /* @__PURE__ */ l("div", { ref: B, className: "relative", children: [
          /* @__PURE__ */ l("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": V, onClick: () => K((L) => !L), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            T === "json" ? "JSON" : "Form",
            /* @__PURE__ */ a(Ue, { up: V, width: 12, height: 12 })
          ] }),
          V && /* @__PURE__ */ a("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map((L) => /* @__PURE__ */ a("li", { role: "none", children: /* @__PURE__ */ a("button", { role: "menuitemradio", "aria-checked": T === L, type: "button", onClick: () => z(L), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${T === L ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: L === "json" ? "JSON" : "Form" }) }, L)) })
        ] })
      ] }),
      m,
      /* @__PURE__ */ a("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ a("div", { className: "mb-5", children: /* @__PURE__ */ a(Ja, { models: p, value: g, onChange: Fe, favorites: U, onToggleFavorite: Be, usage: o, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ a("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: T === "json" ? "Request body" : "Parameters" }),
      (te == null ? void 0 : te.description) && /* @__PURE__ */ a("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: te.description }),
      !Ne && !N && g && /* @__PURE__ */ l("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ a(ke, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      N && /* @__PURE__ */ l("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        N
      ] }),
      p.length === 0 && /* @__PURE__ */ a("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      Ne && T === "json" && /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ a("textarea", { "aria-label": "Request JSON", "aria-invalid": !se, spellCheck: !1, rows: 16, value: h, onChange: (L) => D(L.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ a("p", { className: `mt-1.5 text-[11px] ${se ? "text-muted" : "text-danger"}`, children: se ? `Sent as the body of POST /api/v1/${f.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      Ne && T === "form" && oe.map((L) => /* @__PURE__ */ a(
        Ta,
        {
          field: L,
          values: M,
          client: r,
          onError: I,
          tagCount: L.prop.name === "prompt" ? Te : 0,
          onChange: (W, Y) => j((Z) => ({ ...Z, [W]: typeof Y == "function" ? Y(Z[W]) : Y }))
        },
        L.prop.name
      ))
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      b && /* @__PURE__ */ a("p", { role: "alert", className: "mb-2 text-xs text-danger", children: b }),
      R !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: ce(R) }),
        " (",
        ((Le = u.current) == null ? void 0 : Le.batch) ?? n,
        " × ",
        ce(((vt = u.current) == null ? void 0 : vt.unit) ?? (J == null ? void 0 : J.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ a("button", { type: "button", onClick: () => void de(u.current ?? void 0), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => c(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ a("button", { type: "button", onClick: () => {
          f && (j(Ze(oe)), D(JSON.stringify(Je(oe, Ze(oe)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ l(
          "button",
          {
            type: "button",
            onClick: () => void ge(),
            disabled: !Ne,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ a(pt, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              J && /* @__PURE__ */ l("span", { className: "font-normal", children: [
                "(",
                J.original !== null ? /* @__PURE__ */ l(Ve, { children: [
                  /* @__PURE__ */ a("s", { className: "opacity-60", children: ce(J.original * n) }),
                  " "
                ] }) : null,
                ce(J.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Ka = {
  image: je,
  video: qr,
  audio: Fr,
  avatar: Br,
  "3d": mt,
  "ai-tools": zr,
  text: Kr,
  more: Xr
};
function Xa({ mode: e, onChange: t, layout: r = "rail", onChangeKey: n }) {
  return r === "tabs" ? /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    we.map((i) => {
      const o = i.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(i.id),
          "aria-current": o ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${o ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            i.label,
            o && /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        i.id
      );
    }),
    n && /* @__PURE__ */ l("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ a($t, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ l("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    we.map((i) => {
      const o = Ka[i.id], s = i.id === e;
      return /* @__PURE__ */ l(
        "button",
        {
          onClick: () => t(i.id),
          "aria-current": s ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${s ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ a(o, {}),
            i.label
          ]
        },
        i.id
      );
    }),
    n && /* @__PURE__ */ l("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ a($t, {}),
      "Key"
    ] })
  ] });
}
const Qa = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, Pt = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, Za = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], en = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], tn = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], rn = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), Vt = { minimax: "2k" }, an = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], nn = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), on = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], sn = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], ln = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], cn = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], dn = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), un = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], mn = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), pn = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], or = {
  seedream: { aspect: Za, resolution: en },
  seedance: { aspect: tn, duration: rn },
  minimax: { resolution: an, duration: nn },
  wan: { aspect: on, resolution: sn, quality: ln, duration: cn },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, hn = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, Se = (e, t, r = !1) => ({ id: e, label: t, kind: "image", optional: r });
function ir(e) {
  return ((r) => r.map((n, i) => {
    var o;
    return { ...n, label: ((o = Qa[e.slug]) == null ? void 0 : o[i]) ?? n.label };
  }))(fn(e));
}
function fn(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [Se("base", "Target base image"), Se("face", "New face image")];
    case "video-face-swap":
      return [Se("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [Se("start", "Starting frame image"), Se("end", "Ending frame image", !0)];
    default:
      return [Se("source", "Source image")];
  }
}
function gn(e) {
  return hn[e.template];
}
function Ut(e) {
  var n, i, o, s, m, y, p, g, C, f, v, N, G;
  const t = or[e.template], r = {};
  for (const M of e.sliders ?? []) r[M.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: r,
    aspect: (o = (i = t.aspect) == null ? void 0 : i[0]) == null ? void 0 : o.value,
    resolution: Vt[e.template] && ((m = (s = t.resolution) == null ? void 0 : s.find((M) => M.value === Vt[e.template])) == null ? void 0 : m.value) || ((p = (y = t.resolution) == null ? void 0 : y[0]) == null ? void 0 : p.value),
    duration: ((C = (g = t.duration) == null ? void 0 : g.find((M) => M.value === 5)) == null ? void 0 : C.value) ?? ((v = (f = t.duration) == null ? void 0 : f[0]) == null ? void 0 : v.value),
    quality: (G = (N = t.quality) == null ? void 0 : N[0]) == null ? void 0 : G.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function sr(e, t) {
  var i;
  const r = [e.prompt], n = (i = e.presets) == null ? void 0 : i.find((o) => o.id === t.preset);
  n != null && n.prompt && r.push(n.prompt);
  for (const o of e.sliders ?? []) {
    const s = t.sliders[o.id] ?? 0;
    if (s !== 0) {
      const m = o.phrase(s);
      m && r.push(m);
    }
  }
  return t.refinement.trim() && r.push(t.refinement.trim()), r.filter(Boolean).join(" ");
}
function qt(e, t, r) {
  var o;
  const n = (o = e.presets) == null ? void 0 : o.find((s) => s.id === r), i = { ...Object.fromEntries((e.sliders ?? []).map((s) => [s.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: r, sliders: i };
}
function bn(e, t) {
  for (const r of ir(e)) if (!r.optional && !t.uploads[r.id]) return `${r.label} is required`;
  return null;
}
function yn(e, t) {
  const r = sr(e, t), n = t.uploads;
  switch (e.template) {
    case "seedream":
      return { prompt: r, images_list: [n.source], aspect_ratio: t.aspect, resolution: t.resolution };
    case "seedance":
      return { prompt: r, images_list: [n.source], aspect_ratio: t.aspect, duration: Number(t.duration) };
    case "minimax":
      return { prompt: r, image_url: n.start, ...n.end ? { last_image_url: n.end } : {}, resolution: t.resolution, duration: Number(t.duration) };
    case "wan":
      return { prompt: r, image_url: n.start, ...n.end ? { last_image: n.end } : {}, aspect_ratio: t.aspect, resolution: t.resolution, quality: t.quality, duration: Number(t.duration) };
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
function xn(e) {
  return Pt[e.slug] ? Pt[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const vn = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], _ = (e, t, r, n, i) => ({ id: e, label: t, hint: r, prompt: n, values: i }), ot = (e, t, r, n = "") => `${e > 0 ? t : r} ${Math.abs(e)}${n}`, X = (e, t, r, n, i, o, s = {}) => ({ slug: e, name: t, emoji: r, category: n, badge: "IMAGE", template: "seedream", blurb: i, prompt: o, ...s }), F = (e, t, r, n, i, o, s = {}) => ({ slug: e, name: t, emoji: r, category: n, badge: "VIDEO", template: "seedance", blurb: i, prompt: o, ...s }), Oe = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${ot(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${ot(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], wn = [Oe[2], { ...Oe[1], id: "vertical", label: "Vertical angle" }, Oe[0]].map((e) => ({ ...e, id: e.id })), kn = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${ot(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], Nn = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], Sn = "Keep the result tasteful and suitable for general audiences.", lr = [
  // ---- Professional
  X(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Oe, presets: [
      _("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      _("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      _("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      _("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      _("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      _("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      _("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  X(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  X(
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
  X(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: wn.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
  ),
  F(
    "behind-the-scenes",
    "Behind the Scenes",
    "🎞️",
    "professional",
    "Pull back from the photo to reveal the film set around it.",
    "Start on this photograph, then pull the camera back to reveal it is a film set with lighting rigs, cameras and crew working around the scene."
  ),
  F(
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
  X(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  X(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: Nn, presets: [
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
  X(
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
  X(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: kn }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  X(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  X(
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
  X(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  X(
    "glitter-sticker",
    "Glitter Sticker",
    "🌟",
    "enhance-style",
    "Turn a portrait into a holographic glitter sticker on a street wall.",
    "Turn this portrait into a shiny holographic glitter sticker stuck onto a gritty urban surface."
  ),
  F(
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
  X(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  X(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  X(
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
  X(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  X(
    "japanese-show",
    "Japanese Show",
    "📺",
    "video-editing",
    "Retro variety-show look with CRT scanlines.",
    "Turn this photo into a still from a retro 2000s Japanese variety show, with CRT scanlines, on-screen captions and broadcast effects."
  ),
  { slug: "video-bg-remover", name: "Video Background Remover", emoji: "🎬", category: "video-editing", badge: "VIDEO", template: "bg-remover", blurb: "Remove the background from a video.", prompt: "" },
  // ---- Ads & Products (the uploaded image is the product or subject)
  F("click-to-ad", "Click to Ad", "🎬", "ads", "A person interacts with your product in a short ad.", "Create a dynamic short video ad in which a character picks up and interacts with the product shown in the image."),
  F("asmr-add-on", "ASMR Add-on", "🎧", "ads", "Whispered, intimate ASMR product moment.", "Create an intimate ASMR-style video where a character quietly whispers about the product in the image, close to the camera."),
  F("asmr-classic", "ASMR Classic", "🤫", "ads", "Gentle tapping and touching ASMR product video.", "Create a calm ASMR product video with gentle touching, tapping and slow rotation of the item in the image."),
  X("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
  F("bullet-time-scene", "Bullet Time Scene", "⏱️", "ads", "Frozen-moment bullet-time camera move.", "Create a bullet-time effect: time freezes while the camera sweeps around the subject and product in the image."),
  F("chameleon", "Chameleon", "🦎", "ads", "A character changes to match the product’s look.", "Show the character smoothly transforming their outfit and colors to match the brand look of the product in the image."),
  F("asmr-host", "ASMR Host", "🎙️", "ads", "A whispering host presents the product.", "Create an ASMR presentation where a soft-spoken host presents the product from the image up close."),
  F("packshot", "Packshot", "📦", "ads", "Polished product showcase with slow rotation.", "Create a clean studio packshot video of the product in the image, slowly rotating under soft studio lighting."),
  F("macro-scene", "Macro Scene", "🔬", "ads", "Extreme close-up of product details.", "Create an extreme macro close-up video that glides over the textures and details of the product in the image."),
  F("magic-button", "Magic Button", "✨", "ads", "The product appears in a burst of light.", "Show the product from the image appearing magically in a burst of light and drifting particles."),
  F("truck-ad", "Truck Ad", "🚛", "ads", "Product displayed on a truck driving through a city.", "Show the product from the image printed large on the side of a truck driving through a busy city street."),
  F("giant-product", "Giant Product", "🦖", "ads", "A building-sized product towering over a person.", "Create a surreal scene where the product from the image is as tall as a building, towering over a small person on the street."),
  F("bullet-time-white", "Bullet Time White", "⚪", "ads", "360° rotation on a clean white background.", "Create a bullet-time 360 degree rotation around the subject and product in the image on a clean white background."),
  F("kick-ad", "Kick Ad", "🦵", "ads", "A character kicks the product into frame.", "Create an energetic action ad where a character kicks the product from the image into the frame."),
  F("billboard-ad", "Billboard Ad", "🏙️", "ads", "Product on a glowing billboard at night.", "Show the product from the image on a huge glowing billboard in a busy city at night."),
  X("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  F("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  F("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  F("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  X("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  X(
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
  X("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  X("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  X("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  X("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  X("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  X("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  X(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [_("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), _("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), _("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), _("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  X("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  F("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  F("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${Sn}`),
  F("roller-coaster", "Roller Coaster", "🎢", "trending-templates", "A thrilling roller-coaster ride.", "Put the person from this photo on a roller coaster ride with wind, speed and a dramatic camera."),
  F("60s-cafe", "60s Cafe", "☕", "trending-templates", "A vintage 1960s cafe scene.", "Place the person from this photo in a vintage 1960s cafe with retro decor, warm film tones and gentle motion."),
  F("victory-card", "Victory Card", "🃏", "trending-templates", "A winning playing-card moment.", "Turn this photo into a winning playing card, with the person triumphant as the card flips and glows."),
  F("sand-worm", "Sand Worm", "🐛", "trending-templates", "An epic desert creature scene.", "Place the person from this photo in an epic desert scene with a giant sand creature rising behind them."),
  F("skibidi", "Toilet Meme", "🚽", "trending-templates", "A silly toilet-character meme look.", "Turn this photo into a goofy toilet-themed meme character with exaggerated head bobbing."),
  F("j-poster", "J Poster", "🎌", "trending-templates", "A Japanese-style poster.", "Turn this photo into a bold Japanese-style poster with dramatic typography and animated accents."),
  F("mascot", "Mascot", "🏈", "trending-templates", "A sports mascot character.", "Transform the person in this photo into an energetic sports mascot character cheering in a stadium."),
  F("storm-creature", "Storm Creature", "⛈️", "trending-templates", "An epic storm creature scene.", "Place the person from this photo in a stormy sky scene with a giant creature made of clouds and lightning."),
  F("burning-sunset", "Burning Sunset", "🌅", "trending-templates", "An epic burning-sunset scene.", "Place the person from this photo against an epic burning sunset sky with drifting embers."),
  F("on-fire", "On Fire", "🔥", "trending-templates", "A calm-in-chaos burning-room meme scene.", "Show the person from this photo calmly sitting in a room that is on fire, in a humorous cartoon-like meme style."),
  F("comic-book", "Comic Book", "💥", "trending-templates", "Comic-book panels and action lines.", "Turn this photo into an animated comic-book page with bold ink lines, halftone dots and action bursts."),
  F("cloud-surf", "Cloud Surf", "☁️", "trending-templates", "Surfing on dreamy pink clouds.", "Show the person from this photo surfing on a wave of dreamy pink clouds at sunset."),
  F("mukbang", "Mukbang", "🍜", "trending-templates", "A viral eating-show scene.", "Turn this photo into a viral eating-show video with the person enjoying a big spread of food at a table."),
  F("melting-doodle", "Melting Doodle", "🫠", "trending-templates", "Mesmerizing melting doodle art.", "Turn this photo into colorful doodle art that slowly melts and swirls."),
  F("giallo-horror", "Giallo Horror", "🩸", "trending-templates", "A stylised 1970s thriller scene.", "Turn this photo into a stylised 1970s Italian thriller scene with saturated colors, dramatic shadows and a suspenseful camera move. Keep it non-graphic."),
  F("renaissance", "Renaissance", "🖼️", "trending-templates", "A classical gallery painting.", "Turn this photo into a classical Renaissance oil painting hanging in a gallery, subtly coming to life."),
  F("rap-god", "Rap God", "🎤", "trending-templates", "A rap-video style clip.", "Turn this photo into a stylish rap music video clip with the person performing, with dynamic lighting and camera moves.")
], qe = (e) => lr.find((t) => t.slug === e), it = (e) => e.badge === "VIDEO" ? "video" : "image", xt = (e) => lr.filter((t) => it(t) === e), st = (e) => xt(e).length > 0;
function cr(e) {
  const t = new URLSearchParams(e), r = t.get("tab"), n = qe(t.get("app"));
  return r === "apps" ? { mode: n ? it(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && r === it(n) ? { mode: r, app: n.slug } : { mode: null, app: null };
}
function Cn(e, t, r) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), r ? n.set("app", r) : n.delete("app"), `?${n.toString()}`;
}
function An(e, t, r) {
  return `${e.pathname}${Cn(e.search, t, r)}${e.hash}`;
}
function In(e, t) {
  const r = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!r || `${n.name} ${n.blurb}`.toLowerCase().includes(r)));
}
const Mn = (e) => vn.filter((t) => xt(e).some((r) => r.category === t.id));
function En({ mode: e, value: t, onChange: r }) {
  const [n, i] = A(!1), [o, s] = A(""), [m, y] = A("all"), [p, g] = A(0), C = q(null), f = ae(() => Mn(e), [e]), v = ae(() => In(xt(e), { category: m, q: o }), [e, m, o]), N = qe(t);
  H(() => g(0), [o, m, n]), H(() => {
    if (!n) return;
    const x = (b) => {
      var I;
      (I = C.current) != null && I.contains(b.target) || i(!1);
    }, w = (b) => {
      b.key === "Escape" && i(!1);
    };
    return document.addEventListener("mousedown", x), document.addEventListener("keydown", w), () => {
      document.removeEventListener("mousedown", x), document.removeEventListener("keydown", w);
    };
  }, [n]), H(() => {
    var x, w;
    (w = (x = document.getElementById(`ms-app-${p}`)) == null ? void 0 : x.scrollIntoView) == null || w.call(x, { block: "nearest" });
  }, [p]);
  const G = (x) => {
    r(x), i(!1), s("");
  }, M = (x) => {
    x.key === "ArrowDown" ? (x.preventDefault(), g((w) => Math.min(w + 1, v.length - 1))) : x.key === "ArrowUp" ? (x.preventDefault(), g((w) => Math.max(w - 1, 0))) : x.key === "Enter" && v[p] && (x.preventDefault(), G(v[p].slug));
  }, j = (x) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${x ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ l("div", { ref: C, className: "relative", children: [
    /* @__PURE__ */ l(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => i((x) => !x),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (N == null ? void 0 : N.emoji) ?? "✨" }),
          /* @__PURE__ */ a("span", { className: "min-w-0 flex-1 truncate", children: (N == null ? void 0 : N.name) ?? "Choose an app" }),
          /* @__PURE__ */ a(Ue, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ l("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ l("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ a(ht, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ a("input", { autoFocus: !0, onKeyDown: M, value: o, onChange: (x) => s(x.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ l("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ a("button", { role: "tab", type: "button", "aria-selected": m === "all", onClick: () => y("all"), className: j(m === "all"), children: "All" }),
        f.map((x) => /* @__PURE__ */ a("button", { role: "tab", type: "button", "aria-selected": m === x.id, onClick: () => y(x.id), className: j(m === x.id), children: x.label }, x.id))
      ] }),
      /* @__PURE__ */ l("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        v.map((x, w) => /* @__PURE__ */ l(
          "li",
          {
            id: `ms-app-${w}`,
            role: "option",
            "aria-selected": x.slug === t,
            onClick: () => G(x.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${x.slug === t ? "bg-primary-soft" : w === p ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ a("span", { "aria-hidden": "true", className: "text-lg", children: x.emoji }),
              /* @__PURE__ */ l("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ a("div", { className: `truncate text-sm ${x.slug === t ? "text-primary" : ""}`, children: x.name }),
                /* @__PURE__ */ a("div", { className: "truncate text-[10px] text-secondary", children: x.blurb })
              ] })
            ]
          },
          x.slug
        )),
        v.length === 0 && /* @__PURE__ */ l("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          o,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const $n = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), Me = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function Tn({ mode: e, slug: t, onApp: r, switcher: n, models: i, client: o, batch: s, onRun: m }) {
  const y = qe(t), p = we.find((g) => g.id === e).title;
  return /* @__PURE__ */ l("section", { "aria-label": p, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ l("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ a("h2", { className: "mb-4 text-lg font-semibold", children: p }),
      n,
      /* @__PURE__ */ a("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ a("div", { className: "relative z-20", children: /* @__PURE__ */ a(En, { mode: e, value: t, onChange: r }) })
    ] }),
    y ? /* @__PURE__ */ a(Ln, { app: y, mode: e, models: i, client: o, batch: s, onRun: m }, y.slug) : /* @__PURE__ */ a("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function Ln({ app: e, mode: t, models: r, client: n, batch: i, onRun: o }) {
  var c, k, P;
  const [s, m] = A(() => Ut(e)), [y, p] = A(null), [g, C] = A(null), [f, v] = A(null), N = q(0), G = q(null), M = q(null), j = q({ payloadKey: "", batch: 0 }), x = q(!1), w = q(0);
  H(() => {
    m(Ut(e)), p(null), C(null), v(null);
  }, [e]);
  const b = gn(e), I = r.find((u) => u.name === b), U = or[e.template], $ = ae(() => yn(e, s), [e, s]), T = JSON.stringify($), E = (u) => m((d) => ({ ...d, ...u }));
  H(() => {
    if (!I) return;
    const u = ++N.current;
    G.current = null;
    const d = setTimeout(() => {
      n.estimate(b, $).then((S) => {
        u === N.current && (C(S), G.current = T);
      }).catch(() => {
        u === N.current && C(null);
      });
    }, 500);
    return () => clearTimeout(d);
  }, [T, I, n]), H(() => {
    v(null);
  }, [i, T]);
  const V = I ? ve(I, g) : null;
  j.current = { payloadKey: T, batch: i };
  const K = ir(e), h = async (u) => {
    if (!I) return;
    v(null);
    const d = u ?? { payload: $, batch: i, unit: (V == null ? void 0 : V.current) ?? 0 };
    w.current = Date.now() + 1500, o({ model: b, endpointUrl: I.endpoint_url, mode: t, prompt: sr(e, s) || e.name, payload: d.payload, count: d.batch, kind: ut(I.category), unitCost: d.unit });
  }, D = async () => {
    var d, S;
    if (x.current || Date.now() < w.current) return;
    const u = bn(e, s);
    if (u) {
      p(u);
      return;
    }
    p(null), x.current = !0;
    try {
      const O = T, B = i, ie = $;
      let ee = (V == null ? void 0 : V.current) ?? 0, ue = !0;
      if (I && G.current !== O) {
        try {
          ee = ((d = ve(I, await n.estimate(b, ie))) == null ? void 0 : d.current) ?? ee;
        } catch {
          ue = !1, ee = ((S = ve(I, null)) == null ? void 0 : S.current) ?? ee;
        }
        if (j.current.payloadKey !== O || j.current.batch !== B) return;
      }
      M.current = { payload: ie, batch: B, unit: ee };
      const te = ee * B;
      if (te > nr || !ue) {
        v(te);
        return;
      }
      await h(M.current);
    } finally {
      x.current = !1;
    }
  }, R = (u, d, S, O) => d && d.length > 0 ? /* @__PURE__ */ l("div", { className: "mb-5", children: [
    /* @__PURE__ */ a("div", { className: Me, children: u }),
    /* @__PURE__ */ a(rt, { label: u, options: $n(d), value: S, onChange: O })
  ] }) : null;
  return /* @__PURE__ */ l("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ l(er, { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ a("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ a("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !I && /* @__PURE__ */ l("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        b,
        "”, which is not in your catalog right now."
      ] }),
      K.map((u) => /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: Me, children: [
          /* @__PURE__ */ a("span", { children: u.label }),
          /* @__PURE__ */ a("span", { className: "text-[11px] text-primary", children: u.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ a(
          at,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: s.uploads[u.id] ? [s.uploads[u.id]] : [],
            field: { prop: { name: `${u.kind}_${u.id}`, title: u.label, field: u.kind }, kind: "media", required: !u.optional },
            onUrls: (d) => m((S) => ({ ...S, uploads: { ...S.uploads, [u.id]: d[0] ?? "" } })),
            onError: p
          }
        )
      ] }, u.id)),
      e.presets && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ a("div", { className: Me, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ a(rt, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((u) => ({ value: u.id, label: u.label, hint: u.hint }))], value: s.preset, onChange: (u) => m(qt(e, s, String(u))) })
      ] }),
      e.sliders && /* @__PURE__ */ a("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (c = e.sliders) == null ? void 0 : c.map((u) => /* @__PURE__ */ l("div", { className: "mb-4", children: [
        /* @__PURE__ */ l("div", { className: Me, children: [
          /* @__PURE__ */ a("label", { htmlFor: `ms-sl-${u.id}`, children: u.label }),
          /* @__PURE__ */ l("span", { className: "tabular-nums text-primary", children: [
            s.sliders[u.id] ?? 0,
            u.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ a("input", { id: `ms-sl-${u.id}`, type: "range", min: u.min, max: u.max, step: u.step, value: s.sliders[u.id] ?? 0, className: "w-full", onChange: (d) => E({ sliders: { ...s.sliders, [u.id]: Number(d.target.value) } }) })
      ] }, u.id)),
      e.sliders && /* @__PURE__ */ a("button", { type: "button", onClick: () => m(qt(e, s, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ l("div", { className: "mb-5", children: [
        /* @__PURE__ */ l("div", { className: Me, children: [
          "Prompt refinement ",
          /* @__PURE__ */ a("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ a("textarea", { "aria-label": "Prompt refinement", rows: 3, value: s.refinement, onChange: (u) => E({ refinement: u.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      R("Aspect Ratio", U.aspect, s.aspect, (u) => E({ aspect: u })),
      R(e.template === "seedream" ? "Output Resolution" : "Resolution", U.resolution, s.resolution, (u) => E({ resolution: u })),
      R("Quality Level", U.quality, s.quality, (u) => E({ quality: String(u) })),
      R("Duration", U.duration, s.duration, (u) => E({ duration: Number(u) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && R("Target Face Index", dn, s.targetIndex, (u) => E({ targetIndex: Number(u) })),
      e.template === "video-face-swap" && R("Target Gender Filter", un, s.gender, (u) => E({ gender: String(u) })),
      e.template === "bg-remover" && /* @__PURE__ */ l(Ve, { children: [
        R("Background Color", mn, s.background, (u) => E({ background: String(u) })),
        R("Output Container & Codec", pn, s.container, (u) => E({ container: String(u) })),
        /* @__PURE__ */ l("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ a("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ a("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": s.keepAudio, onClick: () => E({ keepAudio: !s.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${s.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ a("span", { className: `h-5 w-5 rounded-full ${s.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      y && /* @__PURE__ */ a("p", { role: "alert", className: "mb-2 text-xs text-danger", children: y }),
      f !== null && /* @__PURE__ */ l("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: ce(f) }),
        " (",
        ((k = M.current) == null ? void 0 : k.batch) ?? i,
        " × ",
        ce(((P = M.current) == null ? void 0 : P.unit) ?? (V == null ? void 0 : V.current) ?? 0),
        ").",
        /* @__PURE__ */ l("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ a("button", { type: "button", onClick: () => void h(M.current ?? void 0), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ a("button", { type: "button", onClick: () => v(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", disabled: !I, onClick: () => void D(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ a(pt, { width: 16, height: 16, className: "shrink-0" }),
        xn(e),
        i > 1 ? ` ×${i}` : "",
        V && V.current > 0 && /* @__PURE__ */ l("span", { className: "font-normal", children: [
          "(",
          ce(V.current * i),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function Ft({ view: e, onChange: t }) {
  return /* @__PURE__ */ a("div", { role: "tablist", "aria-label": "Generate with", className: "mb-4 flex rounded-full border border-line bg-card-bg p-0.5", children: ["models", "apps"].map((r) => /* @__PURE__ */ a(
    "button",
    {
      role: "tab",
      type: "button",
      "aria-selected": e === r,
      onClick: () => t(r),
      className: `flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${e === r ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
      children: r === "models" ? "Models" : "Apps"
    },
    r
  )) });
}
function _n() {
  try {
    const e = window.location.search, t = cr(e);
    if (t.mode) return t.mode;
    const r = new URLSearchParams(e).get("tab");
    return Ar(r) ? r : null;
  } catch {
    return null;
  }
}
const Ee = {
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
function Bt(e) {
  if (!st(e)) return { view: "models", app: null };
  try {
    const r = cr(window.location.search);
    if (r.mode === e && r.app) return { view: "apps", app: r.app };
    if (r.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = Ee.get(`muapi-studio:app:${e}`);
  return { view: Ee.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: qe(t) ? t : null };
}
function Dn({ scope: e, apiBase: t = "/api/muapi", initialTab: r = "image", showHeader: n = !0, title: i = "Studio", teamId: o, theme: s = "lime", layout: m, apiKey: y, onRequestApiKey: p, getHeaders: g, connected: C, fetchImpl: f, features: v, className: N = "", onTabChange: G }) {
  const M = C === !1 || y === "" || y === null, j = q(g);
  j.current = g;
  const [x, w] = A(!1), b = ae(() => new gr(t, o, { apiKey: y || void 0, getHeaders: () => {
    var z;
    return ((z = j.current) == null ? void 0 : z.call(j)) ?? {};
  }, fetchImpl: f, onKeyRejected: () => w(!0) }), [t, o, y, f]);
  H(() => w(!1), [b]);
  const [I, U] = A({ library: !0, deleteMedia: !0 }), $ = ae(() => ({ library: I.library && (v == null ? void 0 : v.library) !== !1, deleteMedia: (v == null ? void 0 : v.deleteMedia) !== !1 }), [I, v == null ? void 0 : v.library, v == null ? void 0 : v.deleteMedia]), T = m ?? Nr(s), [E, V] = A(() => _n() ?? r), [K, h] = A(4), [D, R] = A(null), [c, k] = A(null), [P, u] = A(null), d = re(() => {
    b.balance().then(u).catch(() => u(null));
  }, [b]), [S, O] = A(null), B = jr(b, D, d, e, !M), ie = ae(() => _r(B.items), [B.items]);
  H(() => {
    M || (k(null), R(null), b.models().then(R).catch((z) => k(z.message)), d(), (v == null ? void 0 : v.library) !== !1 && b.probe().then(U));
  }, [b, d, M, v == null ? void 0 : v.library]);
  const [ee, ue] = A(() => Bt(E)), te = (z, J) => {
    try {
      window.history.replaceState(null, "", An(window.location, z, J));
    } catch {
    }
  }, oe = (z) => {
    const J = Bt(z);
    V(z), ue(J), G == null || G(z), te(z, J.view === "apps" ? J.app : null);
  }, Ie = (z) => {
    ue((J) => ({ ...J, view: z })), Ee.set(`muapi-studio:view:${E}`, z), te(E, z === "apps" ? ee.app : null);
  }, se = (z) => {
    ue({ view: "apps", app: z }), Ee.set(`muapi-studio:app:${E}`, z), Ee.set(`muapi-studio:view:${E}`, "apps"), te(E, z);
  }, me = re(async (z) => {
    await B.run(z);
  }, [B.run]), pe = re((z) => {
    var de;
    const J = D == null ? void 0 : D.find((ge) => ge.name === z);
    return J ? ((de = J.sale) == null ? void 0 : de.from) ?? J.cost ?? void 0 : void 0;
  }, [D]), Fe = re((z) => {
    V(z.mode), ue((J) => ({ ...J, view: "models" })), O({ model: z.model, inputs: z.inputs, nonce: Date.now() });
  }, []), Be = re(async (z) => {
    var Te;
    const J = D == null ? void 0 : D.find((Le) => Le.name === z.model);
    if (!J) return;
    let de = ((Te = J.sale) == null ? void 0 : Te.from) ?? J.cost ?? 0, ge = !1;
    try {
      de = (await b.estimate(z.model, z.inputs)).cost, ge = !0;
    } catch {
    }
    const Ne = ge ? "" : " (the exact price could not be checked)";
    (de > 0.25 || !ge) && !window.confirm(`Re-run ${z.model} for about $${de.toFixed(2)}?${Ne}`) || B.run({ model: z.model, endpointUrl: J.endpoint_url, mode: z.mode, prompt: z.prompt, payload: z.inputs, count: 1, unitCost: de, kind: ut(J.category) });
  }, [D, B.run, b]);
  return /* @__PURE__ */ l("div", { className: `ms-root ${N}`.trim(), style: kr(s), "data-layout": T, "data-btn": Sr(s), children: [
    n && /* @__PURE__ */ l("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ a("h1", { className: "text-base font-semibold", children: i }),
      P && /* @__PURE__ */ l("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ a("b", { className: "text-primary", children: ce(P.balance) })
      ] })
    ] }),
    M ? /* @__PURE__ */ l("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ a("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ a("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      p && /* @__PURE__ */ a("button", { type: "button", onClick: p, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ a(Zt.Provider, { value: e, children: /* @__PURE__ */ l(zt.Provider, { value: $, children: [
      x && /* @__PURE__ */ l("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ a("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        p && /* @__PURE__ */ a("button", { type: "button", onClick: p, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ l("div", { className: `flex min-h-0 flex-1 flex-col ${T === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ a(Xa, { mode: E, onChange: oe, layout: T, onChangeKey: p }),
        /* @__PURE__ */ a("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: c ? /* @__PURE__ */ l("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          c
        ] }) : D ? /* @__PURE__ */ l(Ve, { children: [
          ee.view === "apps" && st(E) ? /* @__PURE__ */ a(Tn, { mode: E, slug: ee.app, onApp: se, switcher: /* @__PURE__ */ a(Ft, { view: "apps", onChange: Ie }), models: D, client: b, batch: K, onRun: me }) : /* @__PURE__ */ a(Ya, { mode: E, models: D, client: b, batch: K, onRun: me, usage: ie, reuse: S, switcher: st(E) ? /* @__PURE__ */ a(Ft, { view: "models", onChange: Ie }) : void 0 }),
          /* @__PURE__ */ a(ia, { mode: E, items: B.items, batch: K, onBatch: h, onLabel: B.setLabel, onRemove: B.remove, onReuse: Fe, onRerun: Be, onDeleteMedia: B.deleteMedia, onLoadMore: B.loadMore, hasMore: B.hasMore, loadingMore: B.loadingMore, serverError: B.serverError, estimateFor: pe })
        ] }) : /* @__PURE__ */ l("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ a(ke, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] }) })
  ] });
}
function On(e) {
  const t = e.accountId ?? Rr(e.apiKey), r = e.teamId ? `${t}:t${e.teamId}` : t;
  return /* @__PURE__ */ a(Dn, { scope: r, ...e }, `${r}|${e.apiBase ?? ""}`);
}
export {
  ye as ApiError,
  gr as MuapiClient,
  On as MuapiStudio,
  wr as THEMES,
  vr as cyanTheme,
  Nr as defaultLayout,
  ut as generationKind,
  Xe as limeTheme,
  Nt as pollUntilDone,
  Jt as resolveTheme,
  Rr as scopeOfKey,
  kr as themeStyle
};
