import { jsx as r, jsxs as c, Fragment as je } from "react/jsx-runtime";
import { createContext as Zt, useContext as er, useState as S, useRef as q, useEffect as B, useCallback as ae, useMemo as re, createElement as tr, useId as rr, useLayoutEffect as ar } from "react";
function nr(e, t, a = "") {
  return e === 401 ? !0 : e === 403 && /api[ -]?key|invalid key|x-api-key/i.test(typeof (t == null ? void 0 : t.error) == "string" ? t.error : typeof (t == null ? void 0 : t.detail) == "string" ? t.detail : a);
}
function or(e) {
  const t = Number(e);
  return e && Number.isFinite(t) && t >= 0 ? Math.min(t, 120) * 1e3 : void 0;
}
class be extends Error {
  constructor(t, a, n) {
    super(t), this.status = a, this.retryAfterMs = n;
  }
}
function it(e) {
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
function ir(e, t) {
  var n;
  const a = e == null ? void 0 : e.detail;
  return ((n = a == null ? void 0 : a.error) == null ? void 0 : n.message) || (typeof a == "string" ? a : "") || (typeof (e == null ? void 0 : e.error) == "string" ? e.error : "") || (e == null ? void 0 : e.message) || t;
}
class sr {
  constructor(t = "/api/muapi", a, n = {}) {
    this.base = t, this.teamId = a, this.opts = n;
  }
  async request(t, a = {}) {
    var m, y, b, A;
    const n = new Headers(a.headers);
    if (this.opts.apiKey && n.set("x-api-key", this.opts.apiKey), this.opts.getHeaders) for (const [N, h] of Object.entries(await this.opts.getHeaders())) n.set(N, h);
    const o = await (this.opts.fetchImpl ?? fetch)(this.base.replace(/\/$/, "") + this.withTeam(t), { ...a, headers: n }), i = await o.text();
    let s = null;
    try {
      s = i ? JSON.parse(i) : null;
    } catch {
    }
    if (!o.ok && nr(o.status, s, i) && !t.startsWith("/app/") && ((y = (m = this.opts).onKeyRejected) == null || y.call(m)), !o.ok) throw new be(ir(s, `${o.status} ${o.statusText}`), o.status, or((A = (b = o.headers) == null ? void 0 : b.get) == null ? void 0 : A.call(b, "retry-after")));
    if (s === null && i.trim()) throw new be("Unexpected non-JSON response from the server", 502);
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
  estimate(t, a) {
    return this.request(`/api/v1/models/${encodeURIComponent(t)}/estimate-cost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(a)
    });
  }
  /** Submit with the model's `endpoint_url` (the catalog's `endpoint` field can be wrong). */
  async submit(t, a, n) {
    var s;
    const o = await this.request(`/api/v1/${t}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...n ? { "x-ms-kind": n } : {} },
      body: JSON.stringify(a)
    }), i = o.request_id || o.id;
    if (!i) throw new be("The API did not return a request id", 502);
    return { requestId: i, cost: (s = o.cost) == null ? void 0 : s.amount_usd };
  }
  async poll(t, a) {
    var m;
    const n = await this.request(`/api/v1/predictions/${encodeURIComponent(t)}/result`, a ? { signal: a } : {}), o = String(n.status || "").toLowerCase(), i = ["completed", "succeeded", "success"].includes(o) ? "completed" : ["failed", "error", "cancelled", "canceled"].includes(o) ? "failed" : o === "pending" ? "pending" : "processing", s = Array.isArray(n.outputs) ? n.outputs : n.url ? [n.url] : [];
    return { status: i, outputs: s, error: it(n.error), cost: (m = n.cost) == null ? void 0 : m.amount_usd };
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
    const t = (n) => n instanceof be && [403, 404, 405].includes(n.status);
    return { library: await this.mediaLibrary({ pageSize: 1 }).then(() => !0).catch((n) => !t(n)), deleteMedia: !0 };
  }
  async balance() {
    return this.request("/api/v1/account/balance");
  }
  async upload(t) {
    var i;
    const a = new FormData();
    a.append("file", t);
    const n = await this.request("/api/v1/upload_file", { method: "POST", body: a }), o = n.url || n.file_url || ((i = n.data) == null ? void 0 : i.url);
    if (!o) throw new be("Upload returned no URL", 502);
    return o;
  }
}
const lr = (e) => Math.min(Math.round(e * 1.15), 6e3), cr = 3e4, dr = (e, t) => new Promise((a) => {
  const n = setTimeout(o, e);
  function o() {
    clearTimeout(n), t == null || t.removeEventListener("abort", o), a();
  }
  t == null || t.addEventListener("abort", o);
});
async function gt(e, t, a = {}) {
  const { intervalMs: n = 2e3, timeoutMs: o = 15 * 60 * 1e3, signal: i, onUpdate: s } = a, m = Date.now();
  let y = 0, b = n;
  for (; Date.now() - m < o; ) {
    if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
    let A = b;
    const N = new AbortController(), h = () => N.abort();
    i == null || i.addEventListener("abort", h);
    const v = setTimeout(() => N.abort(), Math.max(o - (Date.now() - m), 0));
    try {
      const w = await e.poll(t, N.signal);
      if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
      if (y = 0, s == null || s(w), w.status === "completed" || w.status === "failed") return w;
      b = lr(b), A = b;
    } catch (w) {
      if (i != null && i.aborted) throw new DOMException("Aborted", "AbortError");
      if (N.signal.aborted) break;
      if (w instanceof be && w.status === 429) A = w.retryAfterMs ?? cr;
      else if (++y >= 5) throw w;
    } finally {
      clearTimeout(v), i == null || i.removeEventListener("abort", h);
    }
    await dr(A, i);
  }
  return { status: "failed", outputs: [], error: "Timed out waiting for the result" };
}
const Rt = Zt({ library: !0, deleteMedia: !0 }), Ot = () => er(Rt), Ke = {
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
}, ur = {
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
}, mr = { lime: Ke, cyan: ur }, bt = {
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
function jt(e = "lime") {
  return typeof e == "string" ? mr[e] ?? Ke : { ...Ke, ...e };
}
function pr(e = "lime") {
  const t = jt(e), a = {};
  for (const n of Object.keys(bt)) a[bt[n]] = t[n];
  return a;
}
function hr(e = "lime") {
  return e === "cyan" ? "tabs" : "rail";
}
const fr = (e = "lime") => jt(e).buttonStyle, ve = [
  { id: "image", label: "Image", title: "Image Generator", groups: ["image", "photo-pack"] },
  { id: "video", label: "Video", title: "Video Generator", groups: ["video", "video-tools", "video-edit", "ai-effects"] },
  { id: "audio", label: "Audio", title: "Audio Generator", groups: ["music", "audio"] },
  { id: "avatar", label: "Avatar", title: "Avatar Generator", groups: ["avatar"] },
  { id: "3d", label: "3D", title: "3D Generator", groups: ["3d"] },
  { id: "ai-tools", label: "Tools", title: "Tools Generator", groups: ["ai-tools", "image-tools"] },
  // Beyond muapi's Studio page: the rest of the API catalog, so every model endpoint is reachable.
  { id: "text", label: "Text", title: "Text Generator", groups: ["text"] },
  { id: "more", label: "More", title: "More Tools", groups: ["enrichment", "seo", "utility", "sandbox", "training", "moderation"] }
], gr = {
  image: "nano-banana-pro-edit",
  video: "grok-imagine-image-to-video",
  audio: "minimax-speech-2.6-hd",
  avatar: "veed-lipsync",
  "3d": "tripo3d-h31-image-to-3d",
  "ai-tools": "ai-background-remover",
  text: "gpt-5-nano",
  more: "company-enrich"
};
function st(e) {
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
const br = (e) => !!e && ve.some((t) => t.id === e);
function yr(e, t) {
  const a = ve.find((n) => n.id === t).groups;
  return e.filter((n) => a.includes(n.group_of) && n.is_enabled && !n.is_coming_soon);
}
const xr = [
  { id: "popular", label: "Popular" },
  { id: "a-z", label: "A-Z" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "most-used", label: "My Most Used" },
  { id: "favourites", label: "Favourites" }
];
function Pt(e, t, a = {}) {
  const n = (i) => {
    var s;
    return ((s = i.sale) == null ? void 0 : s.from) ?? i.cost ?? 1 / 0;
  }, o = [...e];
  return t === "a-z" ? o.sort((i, s) => i.name.localeCompare(s.name)) : t === "price-asc" ? o.sort((i, s) => n(i) - n(s)) : t === "price-desc" ? o.sort((i, s) => n(s) - n(i)) : t === "most-used" ? o.filter((i) => {
    var s;
    return (((s = a.usage) == null ? void 0 : s[i.name]) ?? 0) > 0;
  }).sort((i, s) => (a.usage[s.name] ?? 0) - (a.usage[i.name] ?? 0)) : t === "favourites" ? o.filter((i) => {
    var s;
    return (s = a.favorites) == null ? void 0 : s.includes(i.name);
  }) : o.sort((i, s) => +!!s.sale - +!!i.sale);
}
const vr = { completed: "completed", succeeded: "completed", success: "completed", failed: "failed", error: "failed", pending: "pending", processing: "processing" };
function wr(e, t) {
  var n, o;
  const a = (n = t.find((i) => i.name === e)) == null ? void 0 : n.group_of;
  return ((o = ve.find((i) => a && i.groups.includes(a))) == null ? void 0 : o.id) ?? "ai-tools";
}
function kr(e, t, a = {}) {
  var i;
  const n = e.output ?? {}, o = n.inputs ?? {};
  return {
    id: "srv-" + e.request_id,
    requestId: e.request_id,
    model: e.model,
    mode: wr(e.model, t),
    prompt: typeof o.prompt == "string" ? o.prompt : "",
    inputs: o,
    status: vr[String(e.status).toLowerCase()] ?? "processing",
    outputs: Array.isArray(n.outputs) ? n.outputs : [],
    error: it(n.error),
    cost: (i = n.cost) == null ? void 0 : i.amount_usd,
    createdAt: Date.parse(e.created_at) || 0,
    label: a[e.request_id] ?? null,
    source: "server"
  };
}
function Nr(e, t, a = /* @__PURE__ */ new Set()) {
  const n = new Map(t.filter((m) => m.requestId).map((m) => [m.requestId, m])), o = new Set(e.map((m) => m.requestId).filter(Boolean));
  return [...e.map((m) => {
    const y = m.requestId ? n.get(m.requestId) : void 0;
    return m.status === "failed" && y && y.status === "completed" && y.outputs.length ? { ...m, status: y.status, outputs: y.outputs, error: void 0, cost: m.cost ?? y.cost } : m;
  }), ...t.filter((m) => !m.requestId || !o.has(m.requestId))].filter((m) => !(m.requestId && a.has(m.requestId))).sort((m, y) => y.createdAt - m.createdAt);
}
function Sr(e) {
  const t = {};
  for (const a of e) t[a.model] = (t[a.model] ?? 0) + 1;
  return t;
}
function ce(e) {
  var n;
  if (e > 0 && e < 1e-4) return "$" + e.toFixed(6).replace(/0+$/, "");
  let t = e.toFixed(4).replace(/0+$/, "");
  return (((n = t.split(".")[1]) == null ? void 0 : n.length) ?? 0) < 2 && (t = e.toFixed(2)), "$" + t;
}
function xe(e, t) {
  var a;
  return t && Number.isFinite(t.cost) ? { current: t.cost, original: t.original_cost && t.original_cost > t.cost ? t.original_cost : null, from: !1 } : ((a = e.sale) == null ? void 0 : a.from) !== void 0 ? { current: e.sale.from, original: e.sale.from_original ?? null, from: !0 } : typeof e.cost == "number" ? { current: e.cost, original: null, from: !1 } : null;
}
const Vt = "muapi-studio:history:v1", Ar = 200, Ne = (e, t) => t ? `${e}:${t}` : e;
function Cr(e) {
  if (!e) return "";
  let t = 2166136261, a = 16777619;
  for (let n = 0; n < e.length; n++)
    t = Math.imul(t ^ e.charCodeAt(n), 16777619) >>> 0, a = Math.imul(a ^ e.charCodeAt(e.length - 1 - n), 2246822507) >>> 0;
  return `${t.toString(36)}${a.toString(36)}`;
}
function Fe(e = "") {
  try {
    const t = localStorage.getItem(Ne(Vt, e));
    return (t ? JSON.parse(t) : []).map((n) => n.error !== void 0 && typeof n.error != "string" ? { ...n, error: it(n.error) } : n);
  } catch {
    return [];
  }
}
function Ir(e, t = "") {
  try {
    localStorage.setItem(Ne(Vt, t), JSON.stringify(e.slice(0, Ar)));
  } catch {
  }
}
const Mr = () => {
  var e, t;
  return ((t = (e = globalThis.crypto) == null ? void 0 : e.randomUUID) == null ? void 0 : t.call(e)) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}, yt = (e, t) => {
  try {
    const a = localStorage.getItem(e);
    return a ? JSON.parse(a) : t;
  } catch {
    return t;
  }
}, xt = (e, t) => {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {
  }
}, vt = "muapi-studio:labels:v1", wt = "muapi-studio:hidden:v1";
function Er(e, t, a, n = "", o = !0) {
  const [i, s] = S(() => Fe(n)), [m, y] = S([]), [b, A] = S(null), [N, h] = S(!1), [v, w] = S(null), R = q(!1), [C, G] = S(() => yt(Ne(vt, n), {})), [g, p] = S(() => yt(Ne(wt, n), [])), f = q(/* @__PURE__ */ new Set()), I = q(!1), U = q(new AbortController()), E = q([]);
  E.current = t ?? [], B(() => Ir(i, n), [i, n]), B(() => xt(Ne(vt, n), C), [C, n]), B(() => xt(Ne(wt, n), g), [g, n]), B(() => (U.current = new AbortController(), () => {
    U.current.abort(), f.current.clear(), I.current = !1;
  }), []);
  const _ = ae((d, l) => s((k) => k.map((L) => L.id === d ? { ...L, ...l } : L)), []), M = ae(async (d, l) => {
    if (!f.current.has(d)) {
      f.current.add(d);
      try {
        const k = await gt(e, l, {
          signal: U.current.signal,
          onUpdate: (L) => _(d, { status: L.status, outputs: L.outputs, error: L.error, cost: L.cost })
        });
        _(d, { status: k.status, outputs: k.outputs, error: k.error, cost: k.cost }), a == null || a();
      } catch (k) {
        k.name !== "AbortError" && _(d, { status: "failed", error: k.message });
      } finally {
        f.current.delete(d);
      }
    }
  }, [e, _, a]), O = ae(async (d) => {
    if (!d.requestId || f.current.has(d.id)) return;
    f.current.add(d.id);
    const l = (k) => y((L) => L.map((P) => P.id === d.id ? { ...P, status: k.status, outputs: k.outputs, error: k.error, cost: k.cost ?? P.cost } : P));
    try {
      const k = await gt(e, d.requestId, { signal: U.current.signal, onUpdate: l });
      l(k), a == null || a();
    } catch {
    } finally {
      f.current.delete(d.id);
    }
  }, [e, a]);
  B(() => {
    const d = new Set(Fe(n).map((l) => l.requestId));
    for (const l of m) (l.status === "pending" || l.status === "processing") && l.requestId && !d.has(l.requestId) && O(l);
  }, [m, n, O]), B(() => {
    if (!(!o || I.current)) {
      I.current = !0;
      for (const d of Fe(n))
        d.status !== "pending" && d.status !== "processing" || (d.requestId ? M(d.id, d.requestId) : Date.now() - d.createdAt > 6e4 && _(d.id, { status: "failed", error: "Interrupted before it was sent. Check your account activity, then run it again." }));
    }
  }, [o]);
  const W = ae(async (d = !1) => {
    if (!R.current) {
      h(!0), w(null);
      try {
        const l = await e.history(d ? void 0 : b ?? void 0), k = l.items.map((L) => kr(L, E.current));
        y((L) => d ? k : [...L, ...k]), A(l.next_cursor);
      } catch (l) {
        l instanceof be && [403, 404, 405].includes(l.status) ? (R.current = !0, A(null)) : w(l.message);
      } finally {
        h(!1);
      }
    }
  }, [e, b]), ee = q(!1);
  B(() => {
    t && !ee.current && (ee.current = !0, W(!0));
  }, [t, W]);
  const Y = ae((d) => {
    const l = Array.from({ length: d.count }, () => ({
      id: Mr(),
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
    return s((k) => [...l, ...k]), Promise.all(l.map(async (k) => {
      try {
        const { requestId: L, cost: P } = await e.submit(d.endpointUrl, d.payload, d.kind);
        _(k.id, { requestId: L, ...P !== void 0 ? { cost: P } : {} }), await M(k.id, L);
      } catch (L) {
        _(k.id, { status: "failed", error: L.message });
      }
    }));
  }, [e, _, M]), J = re(() => {
    const d = (l) => ({ ...l, label: l.requestId && C[l.requestId] || l.label });
    return Nr(i.map(d), m.map(d), new Set(g));
  }, [i, m, C, g]), u = ae((d, l) => {
    d.requestId && G((k) => {
      const L = { ...k };
      return l ? L[d.requestId] = l : delete L[d.requestId], L;
    }), _(d.id, { label: l });
  }, [_]), x = ae((d) => {
    s((l) => l.filter((k) => k.id !== d.id)), d.requestId && p((l) => [.../* @__PURE__ */ new Set([...l, d.requestId])]);
  }, []), D = ae(async (d) => {
    d.requestId && (await e.deleteMedia(d.requestId), _(d.id, { outputs: [] }), y((l) => l.map((k) => k.requestId === d.requestId ? { ...k, outputs: [] } : k)));
  }, [e, _]);
  return { items: J, run: Y, setLabel: u, remove: x, deleteMedia: D, loadMore: () => W(!1), hasMore: !!b, loadingMore: N, serverError: v };
}
const $r = /\.(zip|json|safetensors|txt|csv|pdf|md|html|bin|ckpt|pt|tar|gz|7z|rar|srt|vtt)(\?|#|$)/i;
function Ut(e) {
  return /^https?:\/\//i.test(e) ? /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(e) ? "video" : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|#|$)/i.test(e) ? "audio" : /\.(glb|gltf|obj|fbx|usdz|stl)(\?|#|$)/i.test(e) ? "3d" : $r.test(e) ? "file" : "image" : "text";
}
function Tr(e) {
  const t = e.trim();
  if (!/^[\[{]/.test(t)) return e;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return e;
  }
}
const _r = (e) => /\.(glb|gltf)(\?|#|$)/i.test(e), X = ({ children: e, ...t }) => /* @__PURE__ */ r("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...t, children: e }), Oe = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "9", cy: "9", r: "1.6" }),
  /* @__PURE__ */ r("path", { d: "m21 15-4.5-4.5L6 21" })
] }), Lr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2.5" }),
  /* @__PURE__ */ r("path", { d: "m16 10 6-3v10l-6-3" })
] }), Gr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M9 18V5l11-2v13" }),
  /* @__PURE__ */ r("circle", { cx: "6", cy: "18", r: "3" }),
  /* @__PURE__ */ r("circle", { cx: "17", cy: "16", r: "3" })
] }), Dr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "10", r: "3" }),
  /* @__PURE__ */ r("path", { d: "M6.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" })
] }), lt = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m12 2 9 5v10l-9 5-9-5V7z" }),
  /* @__PURE__ */ r("path", { d: "m3 7 9 5 9-5M12 12v10" })
] }), Rr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "m14.7 6.3 3 3-8.4 8.4H6.3v-3z" }),
  /* @__PURE__ */ r("path", { d: "m13 8 3 3M17 3l4 4M3 21l3-3" })
] }), ct = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" }) }), kt = ({ filled: e, ...t }) => /* @__PURE__ */ r(X, { ...t, fill: e ? "currentColor" : "none", children: /* @__PURE__ */ r("path", { d: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" }) }), dt = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "11", cy: "11", r: "7" }),
  /* @__PURE__ */ r("path", { d: "m20 20-3.5-3.5" })
] }), Pe = ({ up: e, ...t }) => /* @__PURE__ */ r(X, { ...t, children: /* @__PURE__ */ r("path", { d: e ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6" }) }), Or = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9" }) }), jr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" }),
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "3" })
] }), We = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16" }) }), $e = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "m5 12 5 5 9-10" }) }), Ae = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M6 6l12 12M18 6 6 18" }) }), qt = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M12 15V3m0 0L8 7m4-4 4 4M4 21h16" }) }), Pr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ r("path", { d: "M12 11v5M12 8v.01" })
] }), Ce = (e) => /* @__PURE__ */ r(X, { ...e, className: "ms-spin", children: /* @__PURE__ */ r("path", { d: "M21 12a9 9 0 1 1-6.2-8.55" }) }), Vr = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M3 6h13M3 12h9M3 18h5M18 8v12m0 0-3-3m3 3 3-3" }) }), Ur = (e) => /* @__PURE__ */ r(X, { ...e, children: /* @__PURE__ */ r("path", { d: "M4 6h16M4 12h16M4 18h10" }) }), qr = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }),
  /* @__PURE__ */ r("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })
] }), Nt = (e) => /* @__PURE__ */ c(X, { ...e, children: [
  /* @__PURE__ */ r("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ r("path", { d: "m11 12 9-9m-3 3 3 3m-6-0 2 2" })
] });
function Ft({ url: e }) {
  return /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(lt, { width: 32, height: 32 }),
    "Open 3D model"
  ] });
}
let St = null;
const Fr = () => St ?? (St = import("./model-viewer-DsEvqbXJ.js").catch((e) => {
  throw St = null, e;
}));
function Br({ url: e, hidden: t = !1 }) {
  const [a, n] = S("loading"), o = q(null);
  return B(() => {
    let i = !0;
    return n("loading"), Fr().catch(() => i && n("failed")), () => {
      i = !1;
    };
  }, [e]), B(() => {
    const i = o.current;
    if (!i) return;
    const s = () => n("ready"), m = () => n("failed");
    return i.addEventListener("load", s), i.addEventListener("error", m), () => {
      i.removeEventListener("load", s), i.removeEventListener("error", m);
    };
  }), a === "failed" ? /* @__PURE__ */ r(Ft, { url: e }) : /* @__PURE__ */ c("div", { className: "relative aspect-video w-full bg-card-bg", style: t ? { filter: "blur(18px)" } : void 0, children: [
    tr("model-viewer", {
      ref: o,
      src: e,
      "camera-controls": "",
      "auto-rotate": "",
      "shadow-intensity": "1",
      "interaction-prompt": "none",
      alt: "Generated 3D model",
      style: { width: "100%", height: "100%", background: "transparent", "--poster-color": "transparent" }
    }),
    a === "loading" && /* @__PURE__ */ c("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(Ce, { width: 16, height: 16 }),
      " Loading 3D model…"
    ] }),
    a === "ready" && /* @__PURE__ */ r("a", { href: e, target: "_blank", rel: "noopener noreferrer", "aria-label": "Open the 3D file", title: "Open the 3D file", className: "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-bg text-secondary hover:text-primary", children: /* @__PURE__ */ r(lt, { width: 14, height: 14 }) })
  ] });
}
const zr = ["All", "Approved", "Rejected", "Unlabeled"], Hr = [1, 2, 4, 6, 8];
function Jr({ url: e, hidden: t, onOpen: a }) {
  const n = t ? { filter: "blur(18px)" } : void 0, o = Ut(e);
  return o === "text" ? /* @__PURE__ */ r("pre", { tabIndex: 0, "aria-label": "Generated text", style: n, className: "max-h-72 min-h-[120px] overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs text-fg", children: Tr(e) }) : o === "video" ? /* @__PURE__ */ r("video", { src: e, controls: !0, preload: "metadata", style: n, className: "aspect-video w-full bg-black object-contain" }) : o === "audio" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center bg-card-bg p-3", children: /* @__PURE__ */ r("audio", { src: e, controls: !0, className: "w-full" }) }) : o === "3d" ? _r(e) ? /* @__PURE__ */ r(Br, { url: e, hidden: t }) : /* @__PURE__ */ r(Ft, { url: e }) : o === "file" ? /* @__PURE__ */ c("a", { href: e, target: "_blank", rel: "noopener noreferrer", className: "flex aspect-video flex-col items-center justify-center gap-2 bg-card-bg p-3 text-center text-xs text-secondary hover:text-primary", children: [
    /* @__PURE__ */ r(We, { width: 28, height: 28 }),
    /* @__PURE__ */ r("span", { className: "break-all", children: Yr(e.split("?")[0].split("/").pop() ?? "file") })
  ] }) : /* @__PURE__ */ r("button", { type: "button", onClick: a, "aria-label": "Open full size", className: "block w-full", children: /* @__PURE__ */ r("img", { src: e, alt: "Generated output", loading: "lazy", style: n, className: "aspect-square w-full bg-black object-contain" }) });
}
function Yr(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e;
  }
}
function Kr({ g: e, hidden: t, onLabel: a, onRemove: n, onReuse: o, onRerun: i, onDeleteMedia: s, onOpen: m, estimateFor: y }) {
  const [b, A] = S(0), N = e.outputs.length, h = Math.min(b, Math.max(N - 1, 0)), v = e.outputs[h], w = !!v && Ut(v) === "text", [R, C] = S(!1), [G, g] = S(null), p = Ot(), f = "flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[11px] text-secondary hover:text-primary", I = "flex h-7 w-7 items-center justify-center rounded-md border";
  return /* @__PURE__ */ c("article", { className: "overflow-hidden rounded-card border border-line bg-card-bg", children: [
    e.status === "completed" && v ? /* @__PURE__ */ c("div", { className: "relative", children: [
      /* @__PURE__ */ r(Jr, { url: v, hidden: t, onOpen: () => m(v) }),
      N > 1 && /* @__PURE__ */ c("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[11px] text-fg", children: [
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Previous output", disabled: h === 0, onClick: () => A(h - 1), className: "px-2 disabled:opacity-40", children: "‹" }),
        /* @__PURE__ */ c("span", { "aria-live": "polite", children: [
          h + 1,
          " / ",
          N
        ] }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": "Next output", disabled: h === N - 1, onClick: () => A(h + 1), className: "px-2 disabled:opacity-40", children: "›" })
      ] })
    ] }) : e.status === "failed" ? /* @__PURE__ */ c("div", { role: "alert", className: "flex aspect-video flex-col items-center justify-center gap-1 p-4 text-center text-xs text-danger", children: [
      /* @__PURE__ */ r(Ae, {}),
      e.error || "Generation failed"
    ] }) : e.status === "completed" ? /* @__PURE__ */ r("div", { className: "flex aspect-video items-center justify-center p-4 text-center text-xs text-muted", children: "Files were deleted" }) : /* @__PURE__ */ c("div", { className: "flex aspect-video flex-col items-center justify-center gap-2 text-xs text-secondary", children: [
      /* @__PURE__ */ r(Ce, {}),
      e.status === "pending" ? "Queued…" : "Generating…"
    ] }),
    /* @__PURE__ */ c("div", { className: "space-y-2 p-3", children: [
      /* @__PURE__ */ r("p", { className: "line-clamp-2 text-xs text-fg", title: e.prompt, children: e.prompt || e.model }),
      /* @__PURE__ */ c("p", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ r("span", { className: "truncate", children: e.model }),
        /* @__PURE__ */ r("span", { title: e.cost === void 0 ? "Estimated from the current catalog price" : void 0, children: e.cost !== void 0 ? ce(e.cost) : e.status === "completed" && (y == null ? void 0 : y(e.model)) !== void 0 ? `est. ${ce(y(e.model))}` : "" })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-1", children: [
        e.status === "completed" && v && (w ? /* @__PURE__ */ r("a", { href: `data:text/plain;charset=utf-8,${encodeURIComponent(v)}`, download: `${e.model}-${e.createdAt}.txt`, "aria-label": "Download as text file", title: "Download as text file", className: `${I} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(We, { width: 14, height: 14 }) }) : /* @__PURE__ */ r("a", { href: v, target: "_blank", rel: "noopener noreferrer", download: !0, "aria-label": "Download", title: "Download", className: `${I} border-line text-secondary hover:text-primary`, children: /* @__PURE__ */ r(We, { width: 14, height: 14 }) })),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            "aria-pressed": e.label === "approved",
            "aria-label": "Approve",
            title: "Approve",
            onClick: () => a(e, e.label === "approved" ? null : "approved"),
            className: `${I} ${e.label === "approved" ? "border-primary bg-primary-soft text-primary" : "border-line text-secondary hover:text-primary"}`,
            children: /* @__PURE__ */ r($e, { width: 14, height: 14 })
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
            className: `${I} ${e.label === "rejected" ? "border-danger text-danger" : "border-line text-secondary hover:text-danger"}`,
            children: /* @__PURE__ */ r(Ae, { width: 14, height: 14 })
          }
        ),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => o(e), title: "Load this model and settings back into the form", className: f, children: "Reuse" }),
        /* @__PURE__ */ r("button", { type: "button", onClick: () => i(e), title: "Generate again with the same settings", className: f, children: "Re-run" }),
        e.status === "completed" && v && /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          var U;
          (U = navigator.clipboard) == null || U.writeText(v).then(() => {
            C(!0), setTimeout(() => C(!1), 1500);
          }).catch(() => {
          });
        }, className: f, children: R ? "Copied" : w ? "Copy text" : "Copy link" })
      ] }),
      G && /* @__PURE__ */ c("p", { role: "alert", className: "text-[11px] text-danger", children: [
        "Could not delete: ",
        G
      ] }),
      /* @__PURE__ */ c("div", { className: "flex items-center justify-between text-[11px] text-muted", children: [
        /* @__PURE__ */ c("span", { className: "truncate", children: [
          new Date(e.createdAt).toLocaleString(),
          e.source === "server" ? " · synced" : ""
        ] }),
        /* @__PURE__ */ c("span", { className: "flex shrink-0 gap-3", children: [
          p.deleteMedia && e.requestId && e.status === "completed" && v && /* @__PURE__ */ r("button", { type: "button", title: "Delete the generated files from muapi", onClick: () => {
            window.confirm("Delete the generated files from muapi? This cannot be undone.") && (g(null), s(e).catch((U) => g(U.message || "Could not delete")));
          }, className: "hover:text-danger", children: "Delete" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => n(e), className: "hover:text-danger", title: "Hide from this view", children: "Hide" })
        ] })
      ] })
    ] })
  ] });
}
function Wr({ url: e, onClose: t }) {
  const a = q(null), n = q(null);
  return B(() => {
    var s;
    const o = document.activeElement;
    (s = n.current) == null || s.focus();
    const i = (m) => {
      var y;
      if (m.key === "Escape") {
        t();
        return;
      }
      m.key === "Tab" && (m.preventDefault(), (y = n.current) == null || y.focus());
    };
    return document.addEventListener("keydown", i), () => {
      var m;
      document.removeEventListener("keydown", i), (m = o == null ? void 0 : o.focus) == null || m.call(o);
    };
  }, [t]), /* @__PURE__ */ c("div", { ref: a, role: "dialog", "aria-modal": "true", "aria-label": "Full size preview", onClick: t, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4", children: [
    /* @__PURE__ */ r("button", { ref: n, type: "button", "aria-label": "Close preview", onClick: t, className: "absolute right-4 top-4 text-fg", children: /* @__PURE__ */ r(Ae, { width: 24, height: 24 }) }),
    /* @__PURE__ */ r("img", { src: e, alt: "Full size output", onClick: (o) => o.stopPropagation(), className: "max-h-full max-w-full object-contain" })
  ] });
}
function Xr({ mode: e, items: t, batch: a, onBatch: n, onLabel: o, onRemove: i, onReuse: s, onRerun: m, onDeleteMedia: y, onLoadMore: b, hasMore: A, loadingMore: N, serverError: h, estimateFor: v }) {
  const [w, R] = S("All"), [C, G] = S(""), [g, p] = S(!1), [f, I] = S(null), U = re(() => {
    const E = C.trim().toLowerCase();
    return t.filter((_) => _.mode !== e || w === "Approved" && _.label !== "approved" || w === "Rejected" && _.label !== "rejected" || w === "Unlabeled" && _.label !== null ? !1 : !E || _.prompt.toLowerCase().includes(E) || _.model.toLowerCase().includes(E));
  }, [t, e, w, C]);
  return /* @__PURE__ */ c("section", { "aria-label": "My generations", className: "flex min-h-[320px] min-w-0 flex-1 flex-col bg-app-bg", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("h2", { className: "text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "My generations" }),
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Filter generations", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: zr.map((E) => /* @__PURE__ */ r(
        "button",
        {
          role: "tab",
          "aria-selected": w === E,
          onClick: () => R(E),
          className: `rounded-full px-3 py-1 text-[11px] font-semibold ${w === E ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: E
        },
        E
      )) }),
      /* @__PURE__ */ c("label", { className: "relative min-w-[160px] flex-1", children: [
        /* @__PURE__ */ r(dt, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 9, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { value: C, onChange: (E) => G(E.target.value), placeholder: "Search prompts or models...", "aria-label": "Search generations", className: "w-full rounded-full py-1.5 pl-8 pr-3 text-xs" })
      ] }),
      /* @__PURE__ */ r("div", { role: "radiogroup", "aria-label": "Generations per click", className: "flex items-center gap-1 rounded-full border border-line bg-card-bg p-0.5", children: Hr.map((E) => /* @__PURE__ */ r(
        "button",
        {
          role: "radio",
          "aria-checked": a === E,
          onClick: () => n(E),
          className: `h-7 w-7 rounded-full text-xs font-semibold ${a === E ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`,
          children: E
        },
        E
      )) }),
      /* @__PURE__ */ r("button", { type: "button", "aria-pressed": g, "aria-label": g ? "Show previews" : "Hide previews", title: g ? "Show previews" : "Hide previews", onClick: () => p((E) => !E), className: g ? "text-primary" : "text-secondary hover:text-fg", children: g ? /* @__PURE__ */ r(Or, { width: 18, height: 18 }) : /* @__PURE__ */ r(jr, { width: 18, height: 18 }) })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      U.length === 0 ? /* @__PURE__ */ c("div", { className: "flex h-full min-h-[240px] flex-col items-center justify-center text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(ct, { width: 36, height: 36 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: t.some((E) => E.mode === e) ? "No matching generations" : "No generations yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-xs text-sm text-secondary", children: t.some((E) => E.mode === e) ? "Try a different filter or search." : "Select a model, configure parameters, and click Generate to create your first AI output." })
      ] }) : /* @__PURE__ */ r("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }, children: U.map((E) => /* @__PURE__ */ r(Kr, { g: E, hidden: g, onLabel: o, onRemove: i, onReuse: s, onRerun: m, onDeleteMedia: y, onOpen: I, estimateFor: v }, E.id)) }),
      h && /* @__PURE__ */ c("p", { role: "alert", className: "mt-3 text-center text-xs text-danger", children: [
        "Could not load your muapi history: ",
        h
      ] }),
      A && /* @__PURE__ */ r("div", { className: "mt-4 text-center", children: /* @__PURE__ */ r("button", { type: "button", disabled: N, onClick: b, className: "rounded-full border border-line px-5 py-2 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-50", children: N ? "Loading…" : "Load more history" }) }),
      f && /* @__PURE__ */ r(Wr, { url: f, onClose: () => I(null) })
    ] })
  ] });
}
const Qr = /^(prompt|negative_prompt|system_prompt|user_prompt|text|script|lyrics|instruction|instructions|description|input|content|message|query|code|html|markdown)$/i, Zr = /(image|video|audio|mask|file|photo|face|voice|reference)(_url|_urls)?$/i;
function ea(e) {
  var t;
  return e.type === "boolean" ? "boolean" : e.type === "array" ? ((t = e.items) == null ? void 0 : t.type) === "string" ? "media-list" : "json" : e.enum && e.enum.length ? "select" : ["int", "integer", "number", "float"].includes(e.type ?? "") ? "number" : e.type === "text" ? "textarea" : e.type === "string" || !e.type ? Qr.test(e.name) || (e.maxLength ?? 0) > 500 ? "textarea" : e.field === "image" || e.field === "video" || e.field === "audio" || /_url$/.test(e.name) || Zr.test(e.name) ? "media" : "text" : "text";
}
function Be(e) {
  var s, m;
  const t = (m = (s = e.input_schema) == null ? void 0 : s.schemas) == null ? void 0 : m.input_data, a = (t == null ? void 0 : t.properties) ?? {}, n = (t == null ? void 0 : t["x-order-properties"]) ?? e.input_fields ?? Object.keys(a), o = [...n.filter((y) => a[y]), ...Object.keys(a).filter((y) => !n.includes(y))], i = new Set(e.required_fields ?? []);
  return o.map((y) => ({ prop: { ...a[y], name: y }, kind: ea({ ...a[y], name: y }), required: i.has(y) }));
}
function Xe(e) {
  var a;
  const t = {};
  for (const { prop: n, kind: o, required: i } of e)
    n.default !== void 0 && n.default !== null ? t[n.name] = n.default : i && (o === "textarea" || o === "text") && typeof ((a = n.examples) == null ? void 0 : a[0]) == "string" && (t[n.name] = n.examples[0]);
  return t;
}
const ye = (e) => `__auto:${e}`, Qe = (e) => (e.kind === "number" || e.kind === "select") && !e.required, Ze = (e) => e == null || e === "" || Array.isArray(e) && e.length === 0;
function ze(e, t) {
  const a = {};
  for (const { prop: n, kind: o } of e) {
    if (t[ye(n.name)] === !0) continue;
    const i = t[n.name] ?? n.default;
    if (!Ze(i))
      if (o === "number") {
        const s = Number(i);
        Number.isFinite(s) && (a[n.name] = s);
      } else if (o === "json" && typeof i == "string")
        try {
          a[n.name] = JSON.parse(i);
        } catch {
        }
      else a[n.name] = i;
  }
  return a;
}
function ta(e, t) {
  for (const { prop: a, kind: n, required: o } of e) {
    if (t[ye(a.name)] === !0) continue;
    const i = t[a.name] ?? a.default, s = a.title || a.name;
    if (o && Ze(i)) return `${s} is required`;
    if (n === "json" && typeof i == "string" && i)
      try {
        JSON.parse(i);
      } catch {
        return `${s} must be valid JSON`;
      }
    if (n === "number" && !Ze(i)) {
      const m = Number(i);
      if (!Number.isFinite(m)) return `${s} must be a number`;
      if (a.minValue !== void 0 && m < a.minValue) return `${s} must be at least ${a.minValue}`;
      if (a.maxValue !== void 0 && m > a.maxValue) return `${s} must be at most ${a.maxValue}`;
    }
  }
  return null;
}
const ra = 12, ut = 240, Le = (e) => `${typeof e}:${e}`, aa = (e) => e.map((t) => ({ value: t, label: String(t) }));
function na(e, t) {
  const a = t.trim().toLowerCase();
  return a ? e.filter((n) => n.label.toLowerCase().includes(a)) : e;
}
function oa(e, t, a = ut) {
  return e >= a || e >= t ? "down" : "up";
}
const ia = 36, sa = 48;
function la(e, t) {
  return Math.min(ut, Math.max(1, e) * ia + 8) + (t ? sa : 0);
}
function ca(e, t, a) {
  return a <= 0 ? -1 : t === "ArrowDown" ? Math.min(e + 1, a - 1) : t === "ArrowUp" ? Math.max(e - 1, 0) : t === "Home" ? 0 : t === "End" ? a - 1 : t === "PageDown" ? Math.min(e + 5, a - 1) : t === "PageUp" ? Math.max(e - 5, 0) : e;
}
const At = "Auto (let model decide)", He = "__auto__";
function et({ id: e, label: t, options: a, value: n, onChange: o, allowAuto: i, auto: s, onAuto: m, combobox: y }) {
  const b = rr(), A = e ?? `ms-dd-${b}`, N = y ?? a.length > ra, [h, v] = S(!1), [w, R] = S(""), [C, G] = S(0), [g, p] = S("down"), f = q(null), I = q(null), U = q(null), E = a.find((u) => n !== void 0 && Le(u.value) === Le(n)), _ = re(() => N ? na(a, w) : a, [N, a, w]), M = re(
    () => [...i ? [{ key: He, label: At, value: He, isAuto: !0 }] : [], ..._.map((u) => ({ key: Le(u.value), label: u.label, hint: u.hint, value: u.value }))],
    [i, _]
  ), O = s ? He : E ? Le(E.value) : void 0, W = () => {
    v(!1), R("");
  }, ee = (u) => {
    u.isAuto ? m == null || m() : o(u.value), W();
  };
  ar(() => {
    if (!h || !f.current) return;
    const u = f.current.getBoundingClientRect();
    let x = f.current.parentElement;
    for (; x && !/(auto|scroll)/.test(getComputedStyle(x).overflowY); ) x = x.parentElement;
    const D = x ? x.getBoundingClientRect() : null, d = Math.min(window.innerHeight, D ? D.bottom : window.innerHeight), l = Math.max(0, D ? D.top : 0);
    p(oa(d - u.bottom, u.top - l, la(a.length + (i ? 1 : 0), N)));
  }, [h]), B(() => {
    if (!h) return;
    const u = M.findIndex((x) => x.key === O);
    G(u >= 0 ? u : 0);
  }, [h, w]), B(() => {
    var u, x, D;
    h && ((D = (x = (u = I.current) == null ? void 0 : u.querySelector(`[data-i="${C}"]`)) == null ? void 0 : x.scrollIntoView) == null || D.call(x, { block: "nearest" }));
  }, [C, h]), B(() => {
    var u;
    h && N && ((u = U.current) == null || u.focus());
  }, [h, N]), B(() => {
    if (!h) return;
    const u = (x) => {
      var D;
      (D = f.current) != null && D.contains(x.target) || W();
    };
    return document.addEventListener("mousedown", u), () => document.removeEventListener("mousedown", u);
  }, [h]);
  const Y = (u) => {
    if (!h) {
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(u.key) && (u.preventDefault(), v(!0));
      return;
    }
    if (u.key === "Escape") {
      u.preventDefault(), u.stopPropagation(), W();
      return;
    }
    if (u.key === "Enter") {
      u.preventDefault(), M[C] && ee(M[C]);
      return;
    }
    if (u.key === "Tab") {
      W();
      return;
    }
    if (u.key === " " && !N) {
      u.preventDefault(), M[C] && ee(M[C]);
      return;
    }
    ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(u.key) && (u.preventDefault(), G((x) => ca(x, u.key, M.length)));
  }, J = s ? At : (E == null ? void 0 : E.label) ?? "Select…";
  return /* @__PURE__ */ c("div", { ref: f, className: "relative w-full", onKeyDown: Y, children: [
    /* @__PURE__ */ c(
      "button",
      {
        id: A,
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": h,
        "aria-label": `${t}: ${J}`,
        "aria-controls": `${A}-list`,
        onClick: () => v((u) => !u),
        className: `flex w-full items-center justify-between gap-3 rounded-ctl border bg-card-bg px-3 py-3 text-left text-sm ${h ? "border-primary" : "border-line hover:border-muted"} ${s ? "text-secondary" : ""}`,
        children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: J }),
          /* @__PURE__ */ r(Pe, { up: h, width: 16, height: 16 })
        ]
      }
    ),
    h && /* @__PURE__ */ c("div", { className: `absolute left-0 right-0 z-40 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${g === "up" ? "bottom-full mb-1" : "top-full mt-1"}`, children: [
      N && /* @__PURE__ */ r(
        "input",
        {
          ref: U,
          value: w,
          onChange: (u) => R(u.target.value),
          placeholder: `Search ${t.toLowerCase()}…`,
          "aria-label": `Search ${t}`,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": `${A}-list`,
          "aria-activedescendant": M[C] ? `${A}-o${C}` : void 0,
          className: "mb-1 w-full px-3 py-2 text-sm"
        }
      ),
      /* @__PURE__ */ c("ul", { id: `${A}-list`, ref: I, role: "listbox", "aria-label": t, style: { maxHeight: ut }, className: "overflow-y-auto", children: [
        M.map((u, x) => {
          const D = u.key === O;
          return /* @__PURE__ */ c(
            "li",
            {
              id: `${A}-o${x}`,
              "data-i": x,
              role: "option",
              "aria-selected": D,
              onMouseEnter: () => G(x),
              onClick: () => ee(u),
              className: `flex cursor-pointer items-center justify-between gap-2 ${u.hint ? "min-h-9 py-1.5" : "h-9"} rounded-ctl px-3 text-sm ${D ? "bg-primary text-primary-ink" : x === C ? "bg-card-bg" : ""} ${u.isAuto && !D ? "text-secondary" : ""}`,
              children: [
                /* @__PURE__ */ c("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ r("span", { className: "block truncate", children: u.label }),
                  u.hint && /* @__PURE__ */ r("span", { className: `block truncate text-[11px] ${D ? "opacity-70" : "text-muted"}`, children: u.hint })
                ] }),
                D && /* @__PURE__ */ r($e, { width: 14, height: 14 })
              ]
            },
            u.key
          );
        }),
        M.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-3 text-center text-xs text-muted", children: "No matches" })
      ] })
    ] })
  ] });
}
const da = [{ id: "all", label: "All" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }, { id: "audio", label: "Audio" }, { id: "archive", label: "Archives" }];
function ua({ a: e }) {
  return e.media_type === "image" ? /* @__PURE__ */ r("img", { src: e.url, alt: e.name ?? "Image", loading: "lazy", className: "h-full w-full object-cover" }) : e.media_type === "video" ? /* @__PURE__ */ r("video", { src: e.url, preload: "metadata", muted: !0, className: "h-full w-full object-cover" }) : /* @__PURE__ */ r("div", { className: "flex h-full w-full items-center justify-center text-secondary", children: /* @__PURE__ */ r(Oe, {}) });
}
function ma({ client: e, max: t, initialType: a = "image", onInsert: n, onClose: o }) {
  const [i, s] = S(a), [m, y] = S(""), [b, A] = S(1), [N, h] = S(null), [v, w] = S(null), [R, C] = S(!1), [G, g] = S([]), [p, f] = S(""), [I, U] = S(!1), E = q(null), _ = q(null), M = q(0), O = ae(async () => {
    const u = ++M.current;
    C(!0), w(null);
    try {
      const x = await e.mediaLibrary({ mediaType: i, search: m, page: b });
      u === M.current && h(x);
    } catch (x) {
      u === M.current && w(x.message);
    } finally {
      u === M.current && C(!1);
    }
  }, [e, i, m, b]);
  B(() => {
    const u = setTimeout(O, m ? 300 : 0);
    return () => clearTimeout(u);
  }, [O, m]), B(() => {
    A(1);
  }, [i, m]), B(() => {
    var D;
    const u = document.activeElement;
    (D = E.current) == null || D.focus();
    const x = (d) => {
      if (d.key === "Escape") {
        d.stopPropagation(), o();
        return;
      }
      if (d.key !== "Tab" || !E.current) return;
      const l = [...E.current.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')];
      if (!l.length) return;
      const k = l[0], L = l[l.length - 1];
      d.shiftKey && document.activeElement === k ? (d.preventDefault(), L.focus()) : !d.shiftKey && document.activeElement === L && (d.preventDefault(), k.focus());
    };
    return document.addEventListener("keydown", x), () => {
      var d;
      document.removeEventListener("keydown", x), (d = u == null ? void 0 : u.focus) == null || d.call(u);
    };
  }, [o]);
  const W = (u) => g((x) => x.includes(u) ? x.filter((D) => D !== u) : t === 1 ? [u] : x.length < t ? [...x, u] : x), ee = async (u) => {
    if (u.length) {
      C(!0), w(null);
      try {
        for (const x of u) {
          const D = await e.upload(x);
          await e.saveToLibrary({ url: D, name: x.name, mime_type: x.type || void 0, size_bytes: x.size, media_type: x.type.startsWith("video") ? "video" : x.type.startsWith("audio") ? "audio" : x.type.startsWith("image") ? "image" : "archive" });
        }
        await O();
      } catch (x) {
        w(x.message), C(!1);
      }
    }
  }, Y = async () => {
    var x;
    const u = p.trim();
    if (!/^https?:\/\//i.test(u)) {
      w("Enter a full http(s) URL");
      return;
    }
    C(!0), w(null);
    try {
      const D = ((x = u.split("?")[0].split(".").pop()) == null ? void 0 : x.toLowerCase()) ?? "", d = ["mp4", "webm", "mov"].includes(D) ? "video" : ["mp3", "wav", "m4a", "ogg"].includes(D) ? "audio" : ["zip", "rar", "7z"].includes(D) ? "archive" : "image";
      await e.saveToLibrary({ url: u, name: u.split("/").pop() || "link", media_type: d }), f(""), U(!1), await O();
    } catch (D) {
      w(D.message), C(!1);
    }
  }, J = async (u) => {
    if (window.confirm(`Delete "${u.name ?? "this file"}" from your media library? This cannot be undone.`))
      try {
        await e.deleteFromLibrary(u.id), g((x) => x.filter((D) => D !== u.url)), await O();
      } catch (x) {
        w(x.message);
      }
  };
  return /* @__PURE__ */ r("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4", onMouseDown: (u) => {
    u.target === u.currentTarget && o();
  }, children: /* @__PURE__ */ c("div", { ref: E, role: "dialog", "aria-modal": "true", "aria-label": "Media Library", tabIndex: -1, className: "flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-card border border-line bg-panel-bg shadow-[0_30px_80px_rgba(0,0,0,0.9)] outline-none", children: [
    /* @__PURE__ */ c("header", { className: "flex items-center gap-3 border-b border-line p-4", children: [
      /* @__PURE__ */ r("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary", children: /* @__PURE__ */ r(Oe, {}) }),
      /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ c("h2", { className: "flex items-center gap-2 text-base font-semibold", children: [
          /* @__PURE__ */ r("span", { className: "truncate", children: "Media Library" }),
          " ",
          /* @__PURE__ */ c("span", { className: "hidden shrink-0 whitespace-nowrap rounded-full bg-card-bg px-2 py-0.5 text-[11px] font-normal text-secondary min-[420px]:inline", children: [
            (N == null ? void 0 : N.total) ?? 0,
            " ",
            (N == null ? void 0 : N.total) === 1 ? "item" : "items"
          ] })
        ] }),
        /* @__PURE__ */ c("p", { className: "hidden text-xs text-secondary sm:block", children: [
          "Select up to ",
          t,
          " item",
          t === 1 ? "" : "s",
          " to insert into your form"
        ] })
      ] }),
      /* @__PURE__ */ r("input", { ref: _, type: "file", hidden: !0, multiple: !0, onChange: (u) => {
        const x = Array.from(u.target.files ?? []);
        u.target.value = "", ee(x);
      } }),
      /* @__PURE__ */ c("button", { type: "button", "aria-label": "Upload files", onClick: () => {
        var u;
        return (u = _.current) == null ? void 0 : u.click();
      }, className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-ink hover:bg-primary-hover sm:px-4", children: [
        /* @__PURE__ */ r(qt, { width: 14, height: 14 }),
        /* @__PURE__ */ r("span", { className: "hidden sm:inline", children: "Upload Files" })
      ] }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Close", onClick: o, className: "text-secondary hover:text-fg", children: /* @__PURE__ */ r(Ae, {}) })
    ] }),
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 border-b border-line p-3", children: [
      /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Media type", className: "flex rounded-full border border-line bg-card-bg p-0.5", children: da.map((u) => /* @__PURE__ */ r("button", { role: "tab", "aria-selected": i === u.id, onClick: () => s(u.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold ${i === u.id ? "bg-primary text-primary-ink" : "text-secondary hover:text-fg"}`, children: u.label }, u.id)) }),
      /* @__PURE__ */ r("input", { value: m, onChange: (u) => y(u.target.value), placeholder: "Search files...", "aria-label": "Search files", className: "min-w-[160px] flex-1 rounded-full px-4 py-2 text-xs" }),
      /* @__PURE__ */ r("button", { type: "button", "aria-label": "Add by URL", title: "Add by URL", "aria-expanded": I, onClick: () => U((u) => !u), className: "flex h-9 w-9 items-center justify-center rounded-full border border-line text-secondary hover:text-primary", children: "+" })
    ] }),
    I && /* @__PURE__ */ c("div", { className: "flex gap-2 border-b border-line p-3", children: [
      /* @__PURE__ */ r("input", { value: p, onChange: (u) => f(u.target.value), onKeyDown: (u) => u.key === "Enter" && void Y(), placeholder: "https://example.com/file.png", "aria-label": "File URL", className: "flex-1 px-3 py-2 text-sm" }),
      /* @__PURE__ */ r("button", { type: "button", onClick: () => void Y(), className: "rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink", children: "Add" })
    ] }),
    /* @__PURE__ */ c("div", { className: "min-h-[240px] flex-1 overflow-y-auto p-4", children: [
      v && /* @__PURE__ */ r("p", { role: "alert", className: "mb-3 text-sm text-danger", children: v }),
      R && !N ? /* @__PURE__ */ c("div", { className: "flex items-center justify-center gap-2 py-16 text-secondary", children: [
        /* @__PURE__ */ r(Ce, {}),
        " Loading…"
      ] }) : N != null && N.items.length ? /* @__PURE__ */ r("ul", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }, children: N.items.map((u) => {
        const x = G.includes(u.url);
        return /* @__PURE__ */ c("li", { className: `group relative overflow-hidden rounded-card border ${x ? "border-primary" : "border-line"} bg-card-bg`, children: [
          /* @__PURE__ */ r("button", { type: "button", "aria-pressed": x, "aria-label": `${x ? "Deselect" : "Select"} ${u.name ?? "file"}`, onClick: () => W(u.url), className: "block aspect-square w-full", children: /* @__PURE__ */ r(ua, { a: u }) }),
          x && /* @__PURE__ */ r("span", { className: "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink", children: /* @__PURE__ */ r($e, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("button", { type: "button", "aria-label": `Delete ${u.name ?? "file"}`, onClick: () => void J(u), className: "absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-secondary hover:text-danger group-hover:flex group-focus-within:flex", children: /* @__PURE__ */ r(Ae, { width: 12, height: 12 }) }),
          /* @__PURE__ */ r("p", { className: "truncate px-2 py-1.5 text-[11px] text-secondary", title: u.name ?? "", children: u.name })
        ] }, u.id);
      }) }) : /* @__PURE__ */ c("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ r("div", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card-bg text-secondary", children: /* @__PURE__ */ r(Oe, { width: 28, height: 28 }) }),
        /* @__PURE__ */ r("p", { className: "font-semibold", children: "No items in this library tab yet" }),
        /* @__PURE__ */ r("p", { className: "mt-1 max-w-sm text-xs text-secondary", children: "Files uploaded from generation forms are automatically saved here so you can reuse them without re-uploading." })
      ] }),
      N && N.total_pages > 1 && /* @__PURE__ */ c("div", { className: "mt-4 flex items-center justify-center gap-3 text-xs text-secondary", children: [
        /* @__PURE__ */ r("button", { type: "button", disabled: b <= 1, onClick: () => A((u) => u - 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Previous" }),
        "Page ",
        b,
        " of ",
        N.total_pages,
        /* @__PURE__ */ r("button", { type: "button", disabled: b >= N.total_pages, onClick: () => A((u) => u + 1), className: "rounded-lg border border-line px-3 py-1.5 disabled:opacity-40", children: "Next" })
      ] })
    ] }),
    /* @__PURE__ */ c("footer", { className: "flex items-center justify-end gap-4 border-t border-line p-4", children: [
      /* @__PURE__ */ c("span", { className: "text-xs text-secondary", children: [
        /* @__PURE__ */ r("b", { className: "text-primary", children: G.length }),
        " of ",
        t,
        " selected"
      ] }),
      /* @__PURE__ */ c("button", { type: "button", disabled: !G.length, onClick: () => {
        n(G), o();
      }, className: "flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-ink disabled:opacity-40", children: [
        /* @__PURE__ */ r($e, { width: 14, height: 14 }),
        "Insert Selected"
      ] })
    ] })
  ] }) });
}
const Bt = (e, t = "") => {
  const a = `${e ?? ""} ${t}`.toLowerCase();
  return a.includes("video") ? "video/*" : a.includes("audio") || a.includes("voice") ? "audio/*" : a.includes("image") || a.includes("mask") || a.includes("photo") || a.includes("face") ? "image/*" : void 0;
}, pa = (e, t = "") => {
  const a = Bt(e, t);
  return a === "video/*" ? "video" : a === "audio/*" ? "audio" : a === "image/*" ? "image" : "all";
}, ha = (e) => e.type.startsWith("video") ? "video" : e.type.startsWith("audio") ? "audio" : e.type.startsWith("image") ? "image" : "archive";
async function fa(e, t) {
  const a = await Promise.all(t.map((n) => e.upload(n)));
  return t.forEach((n, o) => void e.saveToLibrary({ url: a[o], name: n.name, mime_type: n.type || void 0, size_bytes: n.size, media_type: ha(n) }).catch(() => {
  })), a;
}
function tt({ client: e, field: t, multiple: a, max: n, current: o, onUrls: i, onError: s }) {
  const m = q(null), [y, b] = S(!1), [A, N] = S(!1), [h, v] = S(!1), w = n - o.length, R = Ot(), C = async (p) => {
    if (!(!p.length || a && w <= 0)) {
      b(!0);
      try {
        i(await fa(e, a ? p.slice(0, w) : p.slice(0, 1)));
      } catch (f) {
        s(f.message);
      } finally {
        b(!1);
      }
    }
  }, G = Bt(t.prop.field, t.prop.name), g = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-primary";
  return /* @__PURE__ */ c(
    "div",
    {
      onDragOver: (p) => {
        p.preventDefault(), N(!0);
      },
      onDragLeave: () => N(!1),
      onDrop: (p) => {
        p.preventDefault(), N(!1), C(Array.from(p.dataTransfer.files));
      },
      className: `rounded-card border border-dashed p-2 ${A ? "border-primary bg-primary-soft" : "border-line"}`,
      children: [
        /* @__PURE__ */ r("input", { ref: m, type: "file", hidden: !0, accept: G, multiple: a, onChange: (p) => {
          const f = Array.from(p.target.files ?? []);
          p.target.value = "", C(f);
        } }),
        (a ? w > 0 : !0) && /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ r(
            "input",
            {
              "aria-label": `${t.prop.title || t.prop.name} URL`,
              placeholder: a ? "https://example.com/file.png" : "Paste a URL, or drop / upload a file",
              value: a ? void 0 : o[0] ?? "",
              defaultValue: void 0,
              onChange: a ? void 0 : (p) => i([p.target.value]),
              onKeyDown: a ? (p) => {
                p.key === "Enter" && p.currentTarget.value.trim() && (i([p.currentTarget.value.trim()]), p.currentTarget.value = "");
              } : void 0,
              className: "min-w-0 flex-1 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ r("button", { type: "button", disabled: y, onClick: () => {
            var p;
            return (p = m.current) == null ? void 0 : p.click();
          }, "aria-label": "Upload file", title: "Upload file", className: g, children: y ? /* @__PURE__ */ r(Ce, { width: 16, height: 16 }) : /* @__PURE__ */ r(qt, { width: 16, height: 16 }) }),
          R.library && /* @__PURE__ */ r("button", { type: "button", onClick: () => v(!0), "aria-label": "Choose from media library", title: "Media library", className: g, children: /* @__PURE__ */ c("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ r("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
            /* @__PURE__ */ r("path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" })
          ] }) })
        ] }),
        /* @__PURE__ */ r("p", { className: "mt-1.5 text-[11px] text-primary", children: "Drag & drop or click to upload" }),
        h && R.library && /* @__PURE__ */ r(ma, { client: e, max: a ? Math.max(w, 1) : 1, initialType: pa(t.prop.field, t.prop.name), onInsert: i, onClose: () => v(!1) })
      ]
    }
  );
}
function ga({ field: e, values: t, onChange: a, client: n, onError: o, tagCount: i = 0 }) {
  const { prop: s, kind: m, required: y } = e, b = t[s.name], A = (p) => a(s.name, p), N = s.title || s.name, h = `ms-f-${s.name}`, v = b == null ? "" : String(b), w = Array.isArray(b) ? b : [], R = t[ye(s.name)] === !0, C = q(null), G = (p) => {
    const f = C.current, I = typeof b == "string" ? b : "", U = (f == null ? void 0 : f.selectionStart) ?? I.length, E = (f == null ? void 0 : f.selectionEnd) ?? U;
    A(I.slice(0, U) + p + " " + I.slice(E)), requestAnimationFrame(() => {
      f == null || f.focus(), f == null || f.setSelectionRange(U + p.length + 1, U + p.length + 1);
    });
  };
  let g;
  if (m === "textarea" || m === "json")
    g = /* @__PURE__ */ c(je, { children: [
      /* @__PURE__ */ r("textarea", { ref: C, id: h, rows: m === "json" ? 4 : 5, value: typeof b == "string" ? b : b ? JSON.stringify(b, null, 2) : "", onChange: (p) => A(p.target.value), className: `w-full resize-y p-3 text-sm ${m === "json" ? "font-mono text-xs" : ""}` }),
      s.name === "prompt" && i > 0 && /* @__PURE__ */ c("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", "aria-label": "Reference image tags", children: [
        /* @__PURE__ */ r("span", { className: "text-[11px] text-muted", children: "Reference:" }),
        Array.from({ length: Math.min(i, 9) }, (p, f) => `@image${f + 1}`).map((p) => /* @__PURE__ */ r("button", { type: "button", onClick: () => G(p), className: "rounded-md border border-line px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft", children: p }, p))
      ] })
    ] });
  else if (m === "select") {
    const p = s.enum ?? [];
    g = /* @__PURE__ */ r(
      et,
      {
        id: h,
        label: N,
        options: aa(p),
        value: b,
        onChange: (f) => {
          A(f), a(ye(s.name), !1);
        },
        allowAuto: Qe(e),
        auto: R,
        onAuto: () => a(ye(s.name), !0)
      }
    );
  } else if (m === "boolean") {
    const p = b === !0;
    g = /* @__PURE__ */ r(
      "button",
      {
        id: h,
        type: "button",
        role: "switch",
        "aria-checked": p,
        onClick: () => A(!p),
        className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${p ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`,
        children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${p ? "bg-primary" : "bg-muted"}` })
      }
    );
  } else if (m === "number") {
    const p = s.minValue !== void 0 && s.maxValue !== void 0;
    g = /* @__PURE__ */ c("div", { className: `flex items-center gap-3 ${R ? "opacity-40" : ""}`, children: [
      p && /* @__PURE__ */ r("input", { type: "range", disabled: R, "aria-label": `${N} slider`, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? 0.01 : 1), value: v === "" ? s.minValue : Number(v), onChange: (f) => A(Number(f.target.value)), className: "min-w-0 flex-1" }),
      /* @__PURE__ */ r("input", { id: h, type: "number", disabled: R, min: s.minValue, max: s.maxValue, step: s.step ?? (s.type === "number" ? "any" : 1), value: v, onChange: (f) => A(f.target.value === "" ? "" : Number(f.target.value)), className: `px-3 py-2 text-sm ${p ? "w-24" : "w-full"}` })
    ] });
  } else if (m === "media")
    g = /* @__PURE__ */ r(tt, { client: n, field: e, multiple: !1, max: 1, current: v ? [v] : [], onUrls: (p) => A(p[0]), onError: o });
  else if (m === "media-list") {
    const p = s.maxItems ?? 8;
    g = /* @__PURE__ */ c("div", { className: "space-y-2", children: [
      w.map((f, I) => /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("input", { "aria-label": `${N} ${I + 1}`, value: f, onChange: (U) => A(w.map((E, _) => _ === I ? U.target.value : E)), className: "min-w-0 flex-1 px-3 py-2 text-sm" }),
        /* @__PURE__ */ r("button", { type: "button", "aria-label": `Remove ${N} ${I + 1}`, onClick: () => A(w.filter((U, E) => E !== I)), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl border border-line text-secondary hover:text-danger", children: /* @__PURE__ */ r(Ae, { width: 14, height: 14 }) })
      ] }, I)),
      /* @__PURE__ */ r(tt, { client: n, field: e, multiple: !0, max: p, current: w, onUrls: (f) => a(s.name, (I) => [...Array.isArray(I) ? I : [], ...f].slice(0, p)), onError: o })
    ] });
  } else
    g = /* @__PURE__ */ r("input", { id: h, value: v, onChange: (p) => A(p.target.value), className: "w-full px-3 py-3 text-sm" });
  return /* @__PURE__ */ c("div", { className: "mb-5", children: [
    /* @__PURE__ */ c("div", { className: "mb-1.5 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ c("label", { htmlFor: h, className: "flex items-center gap-1.5 text-xs font-medium text-secondary", children: [
        N,
        s.description && /* @__PURE__ */ r("span", { title: s.description, className: "text-muted", children: /* @__PURE__ */ r(Pr, { width: 13, height: 13 }) })
      ] }),
      Qe(e) && m === "number" ? /* @__PURE__ */ c("label", { className: "flex items-center gap-1.5 text-[11px] text-secondary", children: [
        /* @__PURE__ */ r("input", { type: "checkbox", checked: R, onChange: (p) => a(ye(s.name), p.target.checked), style: { width: 14, height: 14, padding: 0, accentColor: "var(--ms-primary)" } }),
        " Auto (let model decide)"
      ] }) : /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: m === "media-list" ? `${w.length}/${s.maxItems ?? 8} items${y ? " · required" : ""}` : y ? "* required" : "" })
    ] }),
    g
  ] });
}
const Ge = {
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
}, Se = "Other", ba = 3, ya = 2, xa = 20, va = 2, wa = 4, ka = 40, Na = (e) => e.charAt(0).toUpperCase() + e.slice(1);
function zt(e) {
  const t = e.toLowerCase().split(/[-_.\s]/)[0] ?? "", a = t.replace(/\d+[a-z]?$/, "") || t;
  return Ge[t] ? Ge[t] : Ge[a] ? Ge[a] : a.startsWith("tripo") ? "Tripo" : a === "ai" || a === "" || a.length < 2 ? Se : Na(a);
}
function Sa(e) {
  const t = /* @__PURE__ */ new Map();
  for (const o of e) {
    const i = zt(o.name);
    t.set(i, (t.get(i) ?? 0) + 1);
  }
  let a = 0;
  const n = [];
  for (const [o, i] of t)
    o === Se || i < ba ? a += i : n.push({ id: o, label: o, count: i });
  return n.sort((o, i) => i.count - o.count || o.label.localeCompare(i.label)), a && n.push({ id: Se, label: Se, count: a }), n;
}
function Ht(e, t) {
  const a = zt(e.name);
  return t.some((n) => n.id === a) ? a : Se;
}
function Aa(e) {
  const t = e.split(/[\s.]+/).filter(Boolean);
  return (t.length > 1 ? t[0][0] + t[1][0] : e.slice(0, 2)).toUpperCase();
}
function Ca(e) {
  let t = 7;
  for (const a of e) t = (t * 33 + a.charCodeAt(0)) % 360;
  return t;
}
const Ct = ["Text to Video", "Image to Video", "Video to Video", "Text to Image", "Image to Image", "Text to Audio", "Audio to Video"];
function Ia(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e) t.set(n.category, (t.get(n.category) ?? 0) + 1);
  const a = (n) => {
    const o = Ct.indexOf(n);
    return o < 0 ? Ct.length : o;
  };
  return [...t].map(([n, o]) => ({ id: n, count: o })).sort((n, o) => a(n.id) - a(o.id) || o.count - n.count || n.id.localeCompare(o.id));
}
const ge = "__favourites__", ne = "__all__";
function Ma(e, t, a) {
  return e.filter((n) => {
    var o;
    return t.category !== ne && n.category !== t.category ? !1 : t.provider === ge ? !!((o = t.favourites) != null && o.includes(n.name)) : t.provider === ne || Ht(n, a) === t.provider;
  });
}
const Ea = (e, t) => t.filter((a) => a.id !== Se).length >= ya && e.length >= xa;
function $a(e) {
  const t = Ia(e);
  return e.length >= ka ? t.filter((a) => a.count >= wa) : t;
}
const De = 200;
function Ta({ model: e }) {
  const t = xe(e);
  return t ? /* @__PURE__ */ c("span", { className: "flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary", children: [
    t.original !== null && /* @__PURE__ */ r("s", { className: "font-normal text-muted", children: ce(t.original) }),
    t.from && t.original !== null ? "from " : "",
    ce(t.current)
  ] }) : null;
}
const It = (e, t) => {
  try {
    return localStorage.getItem(e) ?? t;
  } catch {
    return t;
  }
}, Mt = (e, t) => {
  try {
    localStorage.setItem(e, t);
  } catch {
  }
};
function Je({ label: e, active: t, onClick: a, hue: n, children: o }) {
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
      children: o
    }
  );
}
function _a({ models: e, value: t, onChange: a, favorites: n, onToggleFavorite: o, usage: i, showGroup: s, scope: m = "default" }) {
  var d;
  const [y, b] = S(!1), [A, N] = S(""), [h, v] = S("popular"), [w, R] = S(!1), C = q(null), G = re(() => Sa(e), [e]), g = re(() => $a(e), [e]), p = Ea(e, G), f = g.length >= va, [I, U] = S(() => It(`muapi-studio:provider:${m}`, ne)), [E, _] = S(() => It(`muapi-studio:category:${m}`, ne)), M = p && (I === ge || I === ne || G.some((l) => l.id === I)) ? I : ne, O = f && (E === ne || g.some((l) => l.id === E)) ? E : ne, W = (l) => {
    U(l), Mt(`muapi-studio:provider:${m}`, l);
  }, ee = (l) => {
    _(l), Mt(`muapi-studio:category:${m}`, l);
  }, Y = q(null);
  B(() => {
    y || R(!1);
  }, [y]), B(() => {
    if (!y) return;
    const l = (L) => {
      var P;
      (P = C.current) != null && P.contains(L.target) || b(!1);
    }, k = (L) => {
      L.key === "Escape" && b(!1);
    };
    return document.addEventListener("mousedown", l), document.addEventListener("keydown", k), () => {
      document.removeEventListener("mousedown", l), document.removeEventListener("keydown", k);
    };
  }, [y]);
  const J = re(() => {
    const l = A.trim().toLowerCase(), k = Ma(e, { category: O, provider: M, favourites: n }, G), L = l ? k.filter((Z) => Z.name.toLowerCase().includes(l) || Z.category.toLowerCase().includes(l)) : k, P = Pt(L, h, { usage: i, favorites: n });
    if (h === "favourites" || h === "most-used") return P;
    const ie = new Set(n);
    return [...P.filter((Z) => ie.has(Z.name)), ...P.filter((Z) => !ie.has(Z.name))];
  }, [e, A, h, n, i, O, M, G]), [u, x] = S(0);
  B(() => {
    var l, k;
    x(0), (k = (l = Y.current) == null ? void 0 : l.scrollTo) == null || k.call(l, { top: 0 });
  }, [A, h, y, O, M]);
  const D = (l) => {
    l.key === "ArrowDown" ? (l.preventDefault(), x((k) => Math.min(k + 1, Math.min(J.length, De) - 1))) : l.key === "ArrowUp" ? (l.preventDefault(), x((k) => Math.max(k - 1, 0))) : l.key === "Enter" && J[u] && (l.preventDefault(), a(J[u].name), b(!1));
  };
  return B(() => {
    var l, k;
    (k = (l = document.getElementById(`ms-opt-${u}`)) == null ? void 0 : l.scrollIntoView) == null || k.call(l, { block: "nearest" });
  }, [u]), /* @__PURE__ */ c("div", { ref: C, className: "relative", children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        onClick: () => b((l) => !l),
        "aria-haspopup": "listbox",
        "aria-expanded": y,
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: (d = (t ?? "?")[0]) == null ? void 0 : d.toUpperCase() }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: t ?? "Select a model" }),
          /* @__PURE__ */ r(Pe, { up: y, width: 16, height: 16 })
        ]
      }
    ),
    y && /* @__PURE__ */ c("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 flex gap-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      p && /* @__PURE__ */ c("div", { role: "radiogroup", "aria-label": "Provider", className: "flex max-h-[22rem] w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line pr-2", children: [
        /* @__PURE__ */ r(Je, { label: "All providers", active: M === ne, onClick: () => W(ne), children: /* @__PURE__ */ r("span", { className: "text-[10px] font-bold", children: "ALL" }) }),
        /* @__PURE__ */ r(Je, { label: "Favourites", active: M === ge, onClick: () => W(ge), children: /* @__PURE__ */ r(kt, { width: 14, height: 14, filled: M === ge }) }),
        G.map((l) => /* @__PURE__ */ r(Je, { label: `${l.label} (${l.count})`, active: M === l.id, onClick: () => W(l.id), hue: Ca(l.label), children: Aa(l.label) }, l.id))
      ] }),
      /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
        f && /* @__PURE__ */ r("div", { role: "tablist", "aria-label": "Model category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [{ id: ne, label: "All" }, ...g.map((l) => ({ id: l.id, label: l.id }))].map((l) => /* @__PURE__ */ r(
          "button",
          {
            role: "tab",
            type: "button",
            "aria-selected": O === l.id,
            onClick: () => ee(l.id),
            className: `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${O === l.id ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`,
            children: l.label
          },
          l.id
        )) }),
        /* @__PURE__ */ c("div", { className: "mb-2 flex gap-2", children: [
          /* @__PURE__ */ c("label", { className: "relative flex-1", children: [
            /* @__PURE__ */ r(dt, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
            /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: D, "aria-controls": "ms-listbox", "aria-activedescendant": `ms-opt-${u}`, value: A, onChange: (l) => N(l.target.value), placeholder: "Search models...", "aria-label": "Search models", className: "w-full py-2 pl-8 pr-2 text-sm" })
          ] }),
          /* @__PURE__ */ c("div", { className: "relative", children: [
            /* @__PURE__ */ r(
              "button",
              {
                type: "button",
                "aria-label": "Sort models",
                "aria-haspopup": "menu",
                "aria-expanded": w,
                onClick: () => R((l) => !l),
                className: `flex h-full items-center rounded-ctl border px-3 ${w ? "border-primary bg-primary-soft text-primary" : "border-line bg-card-bg text-secondary hover:text-fg"}`,
                children: /* @__PURE__ */ r(Vr, { width: 16, height: 16 })
              }
            ),
            w && /* @__PURE__ */ r("ul", { role: "menu", "aria-label": "Sort by", className: "absolute right-0 top-full z-50 mt-1 w-44 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: xr.map((l) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ c(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": h === l.id,
                onClick: () => {
                  v(l.id), R(!1);
                },
                className: `flex w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm ${h === l.id ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`,
                children: [
                  l.label,
                  h === l.id && /* @__PURE__ */ r($e, { width: 14, height: 14 })
                ]
              }
            ) }, l.id)) })
          ] })
        ] }),
        (p || f) && /* @__PURE__ */ c("div", { className: "mb-1 flex items-center justify-between gap-2 px-1", children: [
          /* @__PURE__ */ c("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted", children: [
            M === ge ? "Favourites" : "All models",
            " · ",
            J.length
          ] }),
          p && M !== ne && M !== ge && /* @__PURE__ */ r("span", { className: "rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-secondary", children: M })
        ] }),
        /* @__PURE__ */ c("ul", { id: "ms-listbox", ref: Y, role: "listbox", className: "max-h-72 overflow-y-auto", children: [
          J.slice(0, De).map((l, k) => {
            const L = l.name === t;
            return /* @__PURE__ */ r(
              "li",
              {
                id: `ms-opt-${k}`,
                role: "option",
                "aria-selected": L,
                onClick: () => {
                  a(l.name), b(!1);
                },
                className: `flex cursor-pointer items-center gap-2 rounded-ctl px-3 py-2 ${L ? "bg-primary-soft" : k === u ? "bg-card-bg" : "hover:bg-card-bg"}`,
                children: /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ c("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ r("div", { className: `min-w-0 flex-1 truncate text-sm ${L ? "text-primary" : ""}`, title: l.name, children: l.name }),
                    /* @__PURE__ */ r(
                      "button",
                      {
                        type: "button",
                        "aria-label": n.includes(l.name) ? "Remove favorite" : "Add favorite",
                        onClick: (P) => {
                          P.stopPropagation(), o(l.name);
                        },
                        className: n.includes(l.name) ? "text-primary" : "text-muted hover:text-fg",
                        children: /* @__PURE__ */ r(kt, { width: 15, height: 15, filled: n.includes(l.name) })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ c("div", { className: "flex items-center justify-between gap-2", children: [
                    /* @__PURE__ */ r("span", { className: "truncate text-[10px] text-secondary", children: s ? `${l.group_of} · ${l.category}` : p && M === ne ? `${Ht(l, G)} · ${l.category}` : l.category }),
                    /* @__PURE__ */ r(Ta, { model: l })
                  ] })
                ] })
              },
              l.name
            );
          }),
          J.length === 0 && /* @__PURE__ */ r("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: h === "favourites" ? "No favourites yet. Tap the heart on a model." : h === "most-used" ? "No usage yet. Models you generate with appear here." : `No models match “${A}”.` }),
          J.length > De && /* @__PURE__ */ c("li", { className: "px-3 py-2 text-center text-[11px] text-muted", children: [
            "Showing ",
            De,
            " of ",
            J.length,
            ". Refine your search."
          ] })
        ] })
      ] })
    ] })
  ] });
}
const Et = (e, t) => {
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
}, Jt = 0.25;
function rt(e, t) {
  const a = Xe(e);
  if (t)
    for (const n of e) t[n.prop.name] !== void 0 && (a[n.prop.name] = t[n.prop.name]);
  return a;
}
function La(e, t) {
  const a = rt(e, t);
  for (const n of e)
    t[n.prop.name] === void 0 && (delete a[n.prop.name], Qe(n) && (a[ye(n.prop.name)] = !0));
  return a;
}
function Ga({ mode: e, models: t, client: a, batch: n, onRun: o, usage: i, reuse: s, switcher: m }) {
  var _e, pt;
  const y = ve.find(($) => $.id === e), b = re(() => yr(t, e), [t, e]), [A, N] = S(), [h, v] = S(null), [w, R] = S(null), [C, G] = S({}), [g, p] = S(null), [f, I] = S(null), [U, E] = S(() => Et("muapi-studio:favorites", [])), [_, M] = S("form"), [O, W] = S(!1), [ee, Y] = S("{}"), [J, u] = S(null), x = q(0), D = q(null), d = q(null), l = q({ payloadKey: "", batch: 0 }), k = q(!1), L = q(0), P = q(null);
  B(() => {
    if (!O) return;
    const $ = (H) => {
      var Q;
      (Q = P.current) != null && Q.contains(H.target) || W(!1);
    }, z = (H) => {
      H.key === "Escape" && W(!1);
    };
    return document.addEventListener("mousedown", $), document.addEventListener("keydown", z), () => {
      document.removeEventListener("mousedown", $), document.removeEventListener("keydown", z);
    };
  }, [O]);
  const ie = q(null), Z = q(null), ue = q("form");
  B(() => {
    var H, Q, he;
    const $ = Et(`muapi-studio:model:${e}`, null), z = ((H = b.find((le) => le.name === $)) == null ? void 0 : H.name) ?? ((Q = b.find((le) => le.name === gr[e])) == null ? void 0 : Q.name) ?? ((he = Pt(b, "popular")[0]) == null ? void 0 : he.name);
    N(z);
  }, [e, b]), B(() => {
    if (!s) return;
    ie.current = s.inputs;
    const $ = Z.current;
    if ($ && $.name === s.model) {
      ie.current = null, G(rt(Be($), s.inputs)), M("form");
      return;
    }
    b.some((z) => z.name === s.model) ? (N(s.model), Ye(`muapi-studio:model:${e}`, s.model)) : ie.current = null, M("form");
  }, [s == null ? void 0 : s.nonce]);
  const te = b.find(($) => $.name === A);
  Z.current = h, ue.current = _, B(() => {
    if (!A) {
      v(null), G({}), p(null), R(null), I(null), u(null);
      return;
    }
    let $ = !0;
    return v(null), R(null), p(null), I(null), u(null), a.model(A).then((z) => {
      if (!$) return;
      const H = Be(z), Q = ie.current;
      ie.current = null;
      const he = rt(H, Q);
      v(z), G(he), ue.current === "json" && Y(JSON.stringify(ze(H, he), null, 2));
    }).catch((z) => {
      $ && R(z.message);
    }), () => {
      $ = !1;
    };
  }, [A, a]);
  const oe = re(() => h ? Be(h) : [], [h]), Ie = re(() => ze(oe, C), [oe, C]), se = re(() => {
    try {
      const $ = JSON.parse(ee);
      return $ && typeof $ == "object" && !Array.isArray($) ? $ : null;
    } catch {
      return null;
    }
  }, [ee]), me = _ === "json" ? se ?? {} : Ie, pe = JSON.stringify(me);
  B(() => {
    if (!h || _ === "json" && !se) return;
    const $ = ++x.current;
    D.current = null;
    const z = setTimeout(() => {
      a.estimate(h.name, me).then((H) => {
        $ === x.current && (p(H), D.current = pe);
      }).catch(() => {
        $ === x.current && p(null);
      });
    }, 500);
    return () => clearTimeout(z);
  }, [h, pe, a]), B(() => {
    u(null);
  }, [n, pe, _]);
  const Ue = ($) => {
    N($), Ye(`muapi-studio:model:${e}`, $);
  }, qe = ($) => E((z) => {
    const H = z.includes($) ? z.filter((Q) => Q !== $) : [...z, $];
    return Ye("muapi-studio:favorites", H), H;
  }), V = ($) => {
    W(!1), $ !== _ && ($ === "json" ? Y(JSON.stringify(Ie, null, 2)) : se && G(La(oe, se)), M($), I(null));
  }, F = te ? xe(te, g) : null;
  l.current = { payloadKey: pe, batch: n };
  const de = ae(async ($) => {
    if (!h) return;
    u(null);
    const z = $ ?? { payload: me, batch: n, unit: (F == null ? void 0 : F.current) ?? 0 }, H = oe.find((Q) => Q.prop.name === "prompt");
    L.current = Date.now() + 1500, o({
      model: h.name,
      endpointUrl: h.endpoint_url,
      mode: e,
      payload: z.payload,
      count: z.batch,
      kind: st(h.category),
      prompt: H ? String(z.payload.prompt ?? "") : "",
      unitCost: z.unit
    });
  }, [h, oe, o, e, me, n, F]), fe = ae(async () => {
    var $, z;
    if (!(!h || k.current || Date.now() < L.current)) {
      if (_ === "json") {
        if (!se) {
          I("The JSON is not valid");
          return;
        }
        const H = (h.required_fields ?? []).find((Q) => se[Q] === void 0 || se[Q] === "");
        if (H) {
          I(`${H} is required`);
          return;
        }
      } else {
        const H = ta(oe, C);
        if (H) {
          I(H);
          return;
        }
      }
      I(null), k.current = !0;
      try {
        const H = pe, Q = n, he = me;
        let le = (F == null ? void 0 : F.current) ?? 0, ht = !0;
        if (D.current !== H) {
          try {
            le = te ? (($ = xe(te, await a.estimate(h.name, he))) == null ? void 0 : $.current) ?? le : le;
          } catch {
            ht = !1, le = te ? ((z = xe(te, null)) == null ? void 0 : z.current) ?? le : le;
          }
          if (l.current.payloadKey !== H || l.current.batch !== Q) return;
        }
        d.current = { payload: he, batch: Q, unit: le };
        const ft = le * Q;
        if (ft > Jt || !ht) {
          u(ft);
          return;
        }
        await de(d.current);
      } finally {
        k.current = !1;
      }
    }
  }, [h, _, se, oe, C, F, n, de, pe, te, a, me]), we = !!h && !w, Te = (() => {
    var z;
    const $ = oe.find((H) => H.kind === "media-list");
    return $ ? Math.max(((z = C[$.prop.name]) == null ? void 0 : z.length) ?? 0, 1) : 0;
  })();
  return /* @__PURE__ */ c("section", { "aria-label": y.title, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ c("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: y.title }),
        /* @__PURE__ */ c("div", { ref: P, className: "relative", children: [
          /* @__PURE__ */ c("button", { type: "button", "aria-haspopup": "menu", "aria-expanded": O, onClick: () => W(($) => !$), className: "flex items-center gap-1.5 rounded-ctl border border-line bg-card-bg px-3 py-1.5 text-xs", children: [
            _ === "json" ? "JSON" : "Form",
            /* @__PURE__ */ r(Pe, { up: O, width: 12, height: 12 })
          ] }),
          O && /* @__PURE__ */ r("ul", { role: "menu", className: "absolute right-0 top-full z-30 mt-1 w-28 rounded-card border border-line bg-panel-bg p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: ["form", "json"].map(($) => /* @__PURE__ */ r("li", { role: "none", children: /* @__PURE__ */ r("button", { role: "menuitemradio", "aria-checked": _ === $, type: "button", onClick: () => V($), className: `w-full rounded-md px-3 py-1.5 text-left text-xs ${_ === $ ? "bg-primary-soft text-primary" : "hover:bg-card-bg"}`, children: $ === "json" ? "JSON" : "Form" }) }, $)) })
        ] })
      ] }),
      m,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "Model" }),
      /* @__PURE__ */ r("div", { className: "mb-5", children: /* @__PURE__ */ r(_a, { models: b, value: A, onChange: Ue, favorites: U, onToggleFavorite: qe, usage: i, showGroup: e === "text" || e === "more", scope: e }) }),
      /* @__PURE__ */ r("div", { className: "mb-3 border-t border-line pt-4 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: _ === "json" ? "Request body" : "Parameters" }),
      (te == null ? void 0 : te.description) && /* @__PURE__ */ r("p", { className: "mb-4 line-clamp-3 text-xs text-secondary", children: te.description }),
      !we && !w && A && /* @__PURE__ */ c("div", { className: "flex items-center gap-2 py-6 text-sm text-secondary", children: [
        /* @__PURE__ */ r(Ce, { width: 16, height: 16 }),
        " Loading parameters…"
      ] }),
      w && /* @__PURE__ */ c("p", { role: "alert", className: "py-4 text-sm text-danger", children: [
        "Could not load this model: ",
        w
      ] }),
      b.length === 0 && /* @__PURE__ */ r("p", { className: "py-4 text-sm text-secondary", children: "No models available in this mode." }),
      we && _ === "json" && /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ r("textarea", { "aria-label": "Request JSON", "aria-invalid": !se, spellCheck: !1, rows: 16, value: ee, onChange: ($) => Y($.target.value), className: "w-full resize-y p-3 font-mono text-xs" }),
        /* @__PURE__ */ r("p", { className: `mt-1.5 text-[11px] ${se ? "text-muted" : "text-danger"}`, children: se ? `Sent as the body of POST /api/v1/${h.endpoint_url}` : "Not valid JSON yet" })
      ] }),
      we && _ === "form" && oe.map(($) => /* @__PURE__ */ r(
        ga,
        {
          field: $,
          values: C,
          client: a,
          onError: I,
          tagCount: $.prop.name === "prompt" ? Te : 0,
          onChange: (z, H) => G((Q) => ({ ...Q, [z]: typeof H == "function" ? H(Q[z]) : H }))
        },
        $.prop.name
      ))
    ] }),
    /* @__PURE__ */ c("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      f && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: f }),
      J !== null && /* @__PURE__ */ c("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ce(J) }),
        " (",
        ((_e = d.current) == null ? void 0 : _e.batch) ?? n,
        " × ",
        ce(((pt = d.current) == null ? void 0 : pt.unit) ?? (F == null ? void 0 : F.current) ?? 0),
        ").",
        /* @__PURE__ */ c("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void de(d.current ?? void 0), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => u(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ r("button", { type: "button", onClick: () => {
          h && (G(Xe(oe)), Y(JSON.stringify(ze(oe, Xe(oe)), null, 2)));
        }, className: "rounded-btn border border-line px-4 py-3 text-xs font-medium text-secondary hover:text-fg", children: "Reset" }),
        /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => void fe(),
            disabled: !we,
            className: "flex flex-1 items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none",
            children: [
              /* @__PURE__ */ r(ct, { width: 16, height: 16 }),
              "Generate",
              n > 1 ? ` ×${n}` : "",
              F && /* @__PURE__ */ c("span", { className: "font-normal", children: [
                "(",
                F.original !== null ? /* @__PURE__ */ c(je, { children: [
                  /* @__PURE__ */ r("s", { className: "opacity-60", children: ce(F.original * n) }),
                  " "
                ] }) : null,
                ce(F.current * n),
                ")"
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
const Da = {
  image: Oe,
  video: Lr,
  audio: Gr,
  avatar: Dr,
  "3d": lt,
  "ai-tools": Rr,
  text: Ur,
  more: qr
};
function Ra({ mode: e, onChange: t, layout: a = "rail", onChangeKey: n }) {
  return a === "tabs" ? /* @__PURE__ */ c("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg px-3", children: [
    ve.map((o) => {
      const i = o.id === e;
      return /* @__PURE__ */ c(
        "button",
        {
          onClick: () => t(o.id),
          "aria-current": i ? "page" : void 0,
          className: `relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${i ? "text-primary" : "text-secondary hover:text-fg"}`,
          children: [
            o.label,
            i && /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" })
          ]
        },
        o.id
      );
    }),
    n && /* @__PURE__ */ c("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold text-secondary hover:text-fg", children: [
      /* @__PURE__ */ r(Nt, { width: 14, height: 14 }),
      "Key"
    ] })
  ] }) : /* @__PURE__ */ c("nav", { "aria-label": "Studio modes", className: "flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel-bg p-2 md:w-20 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r", children: [
    ve.map((o) => {
      const i = Da[o.id], s = o.id === e;
      return /* @__PURE__ */ c(
        "button",
        {
          onClick: () => t(o.id),
          "aria-current": s ? "page" : void 0,
          className: `flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border px-2 py-3 text-[10px] font-semibold uppercase tracking-wide ${s ? "border-primary bg-primary-soft text-primary" : "border-transparent text-muted hover:text-fg"}`,
          children: [
            /* @__PURE__ */ r(i, {}),
            o.label
          ]
        },
        o.id
      );
    }),
    n && /* @__PURE__ */ c("button", { type: "button", onClick: n, title: "Change your MuAPI key", className: "flex min-w-[64px] flex-col items-center gap-1 rounded-ctl border border-transparent px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-fg md:mt-auto", children: [
      /* @__PURE__ */ r(Nt, {}),
      "Key"
    ] })
  ] });
}
const Oa = { angles: ["Source image"], "whats-next": ["Source image"], shots: ["Source image"], zooms: ["Source image"], "behind-the-scenes": ["Source image"], transitions: ["End frame"], "expand-image": ["Source image"], "color-grading": ["Source image"], "ai-stylist": ["Your photo"], relight: ["Source image"], "skin-enhancer": ["Portrait photo"], "outfit-swap": ["Outfit reference"], "style-snap": ["Your photo"], "outfit-vending": ["Your outfit photo"], "glitter-sticker": ["Portrait photo"], "outfit-shot": ["Clothing image"], recast: ["Character Persona Image", "Ending Frame Image"], "character-swap": ["Target scene"], "face-swap": ["Target Base Image", "New Face Image"], "commercial-faces": ["Your selfie"], "video-face-swap": ["Face / Identity Image", "Target Video"], "headshot-generator": ["Your selfie"], clipcut: ["Starting Frame Image", "Ending Frame Image"], "urban-cuts": ["Starting Frame Image", "Ending Frame Image"], "sticker-matchcut": ["Starting Frame Image", "Ending Frame Image"], breakdown: ["Source image"], "japanese-show": ["Your photo"], "video-bg-remover": ["Source Video"], "click-to-ad": ["Source Image"], "asmr-add-on": ["Source Image"], "asmr-classic": ["Source Image"], poster: ["Source Image"], "bullet-time-scene": ["Source Image"], chameleon: ["Source Image"], "asmr-host": ["Source Image"], packshot: ["Source Image"], "macro-scene": ["Source Image"], "magic-button": ["Source Image"], "truck-ad": ["Source Image"], "giant-product": ["Source Image"], "bullet-time-white": ["Source Image"], "kick-ad": ["Source Image"], "billboard-ad": ["Source Image"], "graffiti-ad": ["Source Image"], "bullet-time-splash": ["Source Image"], "fridge-ad": ["Source Image"], "volcano-ad": ["Source Image"], "macroshot-product": ["Source Image"], "game-dump": ["Your photo"], "nano-strike": ["Your photo"], "nano-theft": ["Your photo"], simlife: ["Your photo"], plushies: ["Your photo"], "3d-render": ["Source image"], "3d-figure": ["Your photo"], "pixel-game": ["Your photo"], "brick-cube": ["Your photo"], "sketch-to-real": ["Your sketch"], "j-magazine": ["Your photo"], "roller-coaster": ["Your photo"], "60s-cafe": ["Your photo"], "victory-card": ["Your photo"], "sand-worm": ["Your photo"], skibidi: ["Your photo"], "j-poster": ["Your photo"], mascot: ["Your photo"], "storm-creature": ["Your photo"], "burning-sunset": ["Your photo"], "on-fire": ["Your photo"], "comic-book": ["Your photo"], "cloud-surf": ["Your photo"], mukbang: ["Your photo"], "melting-doodle": ["Your photo"], "giallo-horror": ["Your photo"], renaissance: ["Your photo"], "rap-god": ["Your photo"] }, $t = { angles: "Generate Camera Angle", "whats-next": "Generate What's Next", shots: "Generate Shots", zooms: "Generate Zooms", "behind-the-scenes": "Generate Behind the Scenes Video", transitions: "Generate Transitions Video", "expand-image": "Generate Expand Image", "color-grading": "Generate Color Grading", "ai-stylist": "Generate AI Stylist", relight: "Generate Relight", "skin-enhancer": "Generate Skin Enhancer", "outfit-swap": "Generate Outfit Swap", "style-snap": "Generate Style Snap", "outfit-vending": "Generate Outfit Vending", "glitter-sticker": "Generate Glitter Sticker", "outfit-shot": "Generate Outfit Shot Video", recast: "Generate Recast Video", "character-swap": "Generate Character Swap", "face-swap": "Generate Face Swap", "commercial-faces": "Generate Commercial Faces", "video-face-swap": "Generate Video Face Swap Video", "headshot-generator": "Generate Headshot Generator", clipcut: "Generate ClipCut Video", "urban-cuts": "Generate Urban Cuts Video", "sticker-matchcut": "Generate Sticker Match Cut Video", breakdown: "Generate Breakdown", "japanese-show": "Generate Japanese Show", "video-bg-remover": "Generate Video Background Remover Video", "click-to-ad": "Generate Click to Ad Video", "asmr-add-on": "Generate ASMR Add-On Video", "asmr-classic": "Generate ASMR Classic Video", poster: "Generate Poster", "bullet-time-scene": "Generate Bullet Time Scene Video", chameleon: "Generate Chameleon Video", "asmr-host": "Generate ASMR Host Video", packshot: "Generate Packshot Video", "macro-scene": "Generate Macro Scene Video", "magic-button": "Generate Magic Button Video", "truck-ad": "Generate Truck Ad Video", "giant-product": "Generate Giant Product Video", "bullet-time-white": "Generate Bullet Time White Video", "kick-ad": "Generate Kick Ad Video", "billboard-ad": "Generate Billboard Ad Video", "graffiti-ad": "Generate Graffiti Ad", "bullet-time-splash": "Generate Bullet Time Splash Video", "fridge-ad": "Generate Fridge Ad Video", "volcano-ad": "Generate Volcano Ad Video", "macroshot-product": "Generate Macroshot Product", "game-dump": "Generate Game Dump", "nano-strike": "Generate Nano Strike", "nano-theft": "Generate Nano Theft", simlife: "Generate Simlife", plushies: "Generate Plushies", "3d-render": "Generate 3D Render", "3d-figure": "Generate 3D Figure", "pixel-game": "Generate Pixel Game", "brick-cube": "Generate Brick Cube", "sketch-to-real": "Generate Sketch to Real Video", "j-magazine": "Generate J-Magazine Video", "roller-coaster": "Generate Roller Coaster Video", "60s-cafe": "Generate 60s Cafe Video", "victory-card": "Generate Victory Card Video", "sand-worm": "Generate Sand Worm Video", skibidi: "Generate Skibidi Video", "j-poster": "Generate J-Poster Video", mascot: "Generate Mascot Video", "storm-creature": "Generate Storm Creature Video", "burning-sunset": "Generate Burning Sunset Video", "on-fire": "Generate On Fire Video", "comic-book": "Generate Comic Book Video", "cloud-surf": "Generate Cloud Surf Video", mukbang: "Generate Mukbang Video", "melting-doodle": "Generate Melting Doodle Video", "giallo-horror": "Generate Giallo Horror Video", renaissance: "Generate Renaissance Video", "rap-god": "Generate Rap God Video" }, ja = [
  { value: "1:1", title: "1:1 Square", hint: "Feed posts and avatars" },
  { value: "16:9", title: "16:9 Landscape", hint: "Desktop and video" },
  { value: "9:16", title: "9:16 Portrait", hint: "Stories and shorts" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "2:3", title: "2:3 Photo", hint: "Portrait photos" }
], Pa = [
  { value: "1K", title: "1K Standard HD", hint: "Fast and lowest cost" },
  { value: "2K", title: "2K Ultra HD", hint: "More detail, higher cost" }
], Va = [
  { value: "16:9", title: "16:9 Widescreen", hint: "Standard landscape video" },
  { value: "9:16", title: "9:16 Vertical", hint: "Stories, reels and shorts" },
  { value: "1:1", title: "1:1 Square", hint: "Feed video" },
  { value: "4:3", title: "4:3 Classic", hint: "Standard displays" },
  { value: "3:4", title: "3:4 Portrait", hint: "Social portraits" },
  { value: "21:9", title: "21:9 Cinematic", hint: "Ultra-wide" }
], Ua = [4, 5, 6, 8, 10, 12, 15].map((e) => ({ value: e, title: `${e} seconds`, hint: e <= 5 ? "Short clip" : e <= 8 ? "Standard clip" : "Extended clip" })), Tt = { minimax: "2k" }, qa = [{ value: "768p", title: "768p", hint: "Faster" }, { value: "2k", title: "2K Ultra HD", hint: "Highest detail" }], Fa = [5, 6, 7, 8, 9, 10].map((e) => ({ value: e, title: `${e} seconds` })), Ba = [{ value: "16:9", title: "16:9 Widescreen", hint: "Desktop and video" }, { value: "9:16", title: "9:16 Vertical", hint: "Stories and shorts" }], za = [{ value: "480p", title: "480p Standard", hint: "Fast and light" }, { value: "720p", title: "720p HD", hint: "High definition" }], Ha = [{ value: "medium", title: "Medium quality", hint: "Balanced quality and speed" }, { value: "high", title: "High quality", hint: "Best fidelity" }], Ja = [{ value: 5, title: "5 seconds" }, { value: 8, title: "8 seconds", hint: "Costs double" }], Ya = [0, 1, 2, 3].map((e) => ({ value: e, title: `Face ${e}`, hint: e === 0 ? "Primary (largest) face" : `Face number ${e} found in the scene` })), Ka = [{ value: "All", title: "All faces" }, { value: "Female", title: "Female faces" }, { value: "Male", title: "Male faces" }], Wa = ["Transparent", "Black", "White", "Gray", "Green", "Red"].map((e) => ({ value: e, title: e === "Transparent" ? "Transparent (alpha)" : e === "Green" ? "Green screen" : e })), Xa = [
  { value: "webm_vp9", title: "WebM (VP9 + alpha)", hint: "Best for transparent cutouts" },
  { value: "mp4_h264", title: "MP4 (H.264)", hint: "Plays everywhere" },
  { value: "mp4_h265", title: "MP4 (H.265)", hint: "Smaller files" },
  { value: "mov_h265", title: "MOV (H.265)" },
  { value: "mov_proresks", title: "MOV (ProRes)", hint: "Editing format" },
  { value: "mkv_h264", title: "MKV (H.264)" }
], Yt = {
  seedream: { aspect: ja, resolution: Pa },
  seedance: { aspect: Va, duration: Ua },
  minimax: { resolution: qa, duration: Fa },
  wan: { aspect: Ba, resolution: za, quality: Ha, duration: Ja },
  skin: {},
  "face-swap": {},
  "video-face-swap": {},
  "bg-remover": {}
}, Qa = {
  seedream: "bytedance-seedream-5.0-pro-edit",
  seedance: "seedance-2-image-to-video",
  minimax: "minimax-h3-image-to-video",
  wan: "wan2.2-image-to-video",
  skin: "ai-skin-enhancer",
  "face-swap": "ai-image-face-swap",
  "video-face-swap": "ai-video-face-swap",
  "bg-remover": "video-background-remover"
}, ke = (e, t, a = !1) => ({ id: e, label: t, kind: "image", optional: a });
function Kt(e) {
  return ((a) => a.map((n, o) => {
    var i;
    return { ...n, label: ((i = Oa[e.slug]) == null ? void 0 : i[o]) ?? n.label };
  }))(Za(e));
}
function Za(e) {
  if (e.uploads) return e.uploads;
  switch (e.template) {
    case "face-swap":
      return [ke("base", "Target base image"), ke("face", "New face image")];
    case "video-face-swap":
      return [ke("face", "Face / identity image"), { id: "video", label: "Target video", kind: "video" }];
    case "bg-remover":
      return [{ id: "video", label: "Source video", kind: "video" }];
    case "minimax":
    case "wan":
      return [ke("start", "Starting frame image"), ke("end", "Ending frame image", !0)];
    default:
      return [ke("source", "Source image")];
  }
}
function en(e) {
  return Qa[e.template];
}
function _t(e) {
  var n, o, i, s, m, y, b, A, N, h, v, w, R;
  const t = Yt[e.template], a = {};
  for (const C of e.sliders ?? []) a[C.id] = 0;
  return {
    uploads: {},
    refinement: "",
    preset: ((n = e.presets) != null && n[0], ""),
    sliders: a,
    aspect: (i = (o = t.aspect) == null ? void 0 : o[0]) == null ? void 0 : i.value,
    resolution: Tt[e.template] && ((m = (s = t.resolution) == null ? void 0 : s.find((C) => C.value === Tt[e.template])) == null ? void 0 : m.value) || ((b = (y = t.resolution) == null ? void 0 : y[0]) == null ? void 0 : b.value),
    duration: ((N = (A = t.duration) == null ? void 0 : A.find((C) => C.value === 5)) == null ? void 0 : N.value) ?? ((v = (h = t.duration) == null ? void 0 : h[0]) == null ? void 0 : v.value),
    quality: (R = (w = t.quality) == null ? void 0 : w[0]) == null ? void 0 : R.value,
    targetIndex: 0,
    gender: "All",
    background: "Transparent",
    container: "webm_vp9",
    keepAudio: !0
  };
}
function Wt(e, t) {
  var o;
  const a = [e.prompt], n = (o = e.presets) == null ? void 0 : o.find((i) => i.id === t.preset);
  n != null && n.prompt && a.push(n.prompt);
  for (const i of e.sliders ?? []) {
    const s = t.sliders[i.id] ?? 0;
    if (s !== 0) {
      const m = i.phrase(s);
      m && a.push(m);
    }
  }
  return t.refinement.trim() && a.push(t.refinement.trim()), a.filter(Boolean).join(" ");
}
function Lt(e, t, a) {
  var i;
  const n = (i = e.presets) == null ? void 0 : i.find((s) => s.id === a), o = { ...Object.fromEntries((e.sliders ?? []).map((s) => [s.id, 0])), ...(n == null ? void 0 : n.values) ?? {} };
  return { ...t, preset: a, sliders: o };
}
function tn(e, t) {
  for (const a of Kt(e)) if (!a.optional && !t.uploads[a.id]) return `${a.label} is required`;
  return null;
}
function rn(e, t) {
  const a = Wt(e, t), n = t.uploads;
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
function an(e) {
  return $t[e.slug] ? $t[e.slug] : e.template === "face-swap" || e.template === "video-face-swap" ? `Generate ${e.name}` : `Generate ${e.name}${e.badge === "VIDEO" && !/video/i.test(e.name) ? " video" : ""}`;
}
const nn = [
  { id: "professional", label: "Professional", blurb: "Camera moves, framing, transitions and grading" },
  { id: "enhance-style", label: "Enhance & Style", blurb: "Outfits, lighting and portrait touch-ups" },
  { id: "face-identity", label: "Face & Identity", blurb: "Face and character swaps, headshots" },
  { id: "video-editing", label: "Video Editing", blurb: "Montages, cutouts and stylised video effects" },
  { id: "ads", label: "Ads & Products", blurb: "Product videos, posters and ad scenes" },
  { id: "games-characters", label: "Games & Characters", blurb: "Game, toy and 3D character styles" },
  { id: "trending-templates", label: "Trending Templates", blurb: "Viral looks and scenes from one photo" }
], T = (e, t, a, n, o) => ({ id: e, label: t, hint: a, prompt: n, values: o }), at = (e, t, a, n = "") => `${e > 0 ? t : a} ${Math.abs(e)}${n}`, K = (e, t, a, n, o, i, s = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "IMAGE", template: "seedream", blurb: o, prompt: i, ...s }), j = (e, t, a, n, o, i, s = {}) => ({ slug: e, name: t, emoji: a, category: n, badge: "VIDEO", template: "seedance", blurb: o, prompt: i, ...s }), Re = [
  { id: "rotation", label: "Rotation", min: -180, max: 180, step: 5, unit: "°", phrase: (e) => `Orbit the camera ${at(e, "right", "left", " degrees")} around the subject.` },
  { id: "tilt", label: "Tilt", min: -90, max: 90, step: 5, unit: "°", phrase: (e) => `Tilt the camera ${at(e, "up", "down", " degrees")}.` },
  { id: "zoom", label: "Zoom", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Move in closer by ${e} percent.` : `Pull back to show ${Math.abs(e)} percent more of the scene.` }
], on = [Re[2], { ...Re[1], id: "vertical", label: "Vertical angle" }, Re[0]].map((e) => ({ ...e, id: e.id })), sn = [
  { id: "direction", label: "Light direction", min: -180, max: 180, step: 15, unit: "°", phrase: (e) => `Place the main light source ${at(e, "clockwise", "counter-clockwise", " degrees")} from the front of the subject.` },
  { id: "temperature", label: "Color temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Make the light warmer (${e} percent).` : `Make the light cooler (${Math.abs(e)} percent).` },
  { id: "brightness", label: "Brightness", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Brighten the image by ${e} percent.` : `Darken the image by ${Math.abs(e)} percent.` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise contrast by ${e} percent.` : `Lower contrast by ${Math.abs(e)} percent.` }
], ln = [
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Warm the color temperature (${e}).` : `Cool the color temperature (${Math.abs(e)}).` },
  { id: "contrast", label: "Contrast", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Increase contrast (${e}).` : `Decrease contrast (${Math.abs(e)}).` },
  { id: "saturation", label: "Saturation", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Boost saturation (${e}).` : `Reduce saturation (${Math.abs(e)}).` },
  { id: "highlights", label: "Highlights", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Lift the highlights (${e}).` : `Pull the highlights down (${Math.abs(e)}).` },
  { id: "exposure", label: "Exposure", min: -100, max: 100, step: 5, phrase: (e) => e > 0 ? `Raise exposure (${e}).` : `Lower exposure (${Math.abs(e)}).` },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100, step: 5, phrase: (e) => `Sharpen fine detail (${e}).` },
  { id: "grain", label: "Film grain", min: 0, max: 100, step: 5, phrase: (e) => `Add film grain (${e}).` }
], cn = "Keep the result tasteful and suitable for general audiences.", Xt = [
  // ---- Professional
  K(
    "angles",
    "Angles",
    "📐",
    "professional",
    "Re-shoot one photo from a new camera angle: rotate, tilt and zoom.",
    "Re-render this exact scene from a different camera angle while keeping the subject, lighting and environment consistent and photorealistic.",
    { presetLabel: "Angle preset", sliders: Re, presets: [
      T("front", "Front view", "Straight on", void 0, { rotation: 0, tilt: 0, zoom: 0 }),
      T("right45", "Right 45°", "Three-quarter right", void 0, { rotation: 45 }),
      T("left45", "Left 45°", "Three-quarter left", void 0, { rotation: -45 }),
      T("side", "Right profile", "90° side view", void 0, { rotation: 90 }),
      T("top", "Top-down", "Overhead view", void 0, { tilt: 40 }),
      T("hero", "Low hero angle", "Looking up", void 0, { tilt: -30 }),
      T("close", "Close-up", "Tighter crop", void 0, { zoom: 40 })
    ] }
  ),
  K(
    "whats-next",
    "What's Next",
    "🎬",
    "professional",
    "See the scene a moment later: a story continuation from one image.",
    "Continue the story of this scene: show the next moment with the same characters, setting and lighting, as a single compelling frame."
  ),
  K(
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
  K(
    "zooms",
    "Zooms",
    "🔍",
    "professional",
    "Zoom variations from macro close-up to wide angle.",
    "Re-render this image with a different zoom level and perspective, keeping the subject and style consistent.",
    { sliders: on.map((e) => e.id === "vertical" ? { ...e, label: "Vertical angle" } : e) }
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
      T("morph", "Morph", void 0, "Use a morph transition."),
      T("dissolve", "Dissolve", void 0, "Use a slow dissolve."),
      T("zoom", "Zoom through", void 0, "Zoom through the subject into the next scene."),
      T("whip", "Whip pan", void 0, "Use a fast whip pan."),
      T("match", "Match cut", void 0, "Use a match cut on a shared shape or motion.")
    ] }
  ),
  K(
    "expand-image",
    "Expand Image",
    "🖼️",
    "professional",
    "Extend the picture beyond its edges (outpainting).",
    "Extend this image beyond its current borders, seamlessly continuing the scene, lighting, perspective and style into the new area."
  ),
  K(
    "color-grading",
    "Color Grading",
    "🎨",
    "professional",
    "Apply a film-style color grade with presets and fine controls.",
    "Apply a professional color grade to this image without changing its content or composition.",
    { sliders: ln, presets: [
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
  K(
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
  K(
    "relight",
    "Relight",
    "💡",
    "enhance-style",
    "Change the direction, warmth and brightness of the light.",
    "Relight this photo as described, keeping the subject, composition and details unchanged.",
    { sliders: sn }
  ),
  { slug: "skin-enhancer", name: "Skin Enhancer", emoji: "✨", category: "enhance-style", badge: "IMAGE", template: "skin", blurb: "Smooth blur and noise from portraits while keeping natural skin texture.", prompt: "" },
  K(
    "outfit-swap",
    "Outfit Swap",
    "🔄",
    "enhance-style",
    "Put a clothing item from a reference photo onto your subject.",
    "Replace the clothing worn by the person with the outfit described in the instructions while keeping their face, body pose and the background natural."
  ),
  K(
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
  K(
    "outfit-vending",
    "Outfit Vending",
    "🏪",
    "enhance-style",
    "Show an outfit broken into items inside a lit vending machine.",
    "Show the outfit from this photo broken down item by item, each displayed in its own slot of a softly lit vending machine."
  ),
  K(
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
  K(
    "character-swap",
    "Character Swap",
    "🔀",
    "face-identity",
    "Place a different character into a scene.",
    "Replace the main character in this scene with the character described in the instructions, keeping the pose, lighting and setting consistent.",
    { consent: !0 }
  ),
  { slug: "face-swap", name: "Face Swap", emoji: "😎", category: "face-identity", badge: "IMAGE", template: "face-swap", consent: !0, blurb: "Swap a face from one photo onto a person in another.", prompt: "" },
  K(
    "commercial-faces",
    "Commercial Faces",
    "💼",
    "face-identity",
    "Ad-ready spokesperson imagery.",
    "Turn this photo into polished, ad-ready spokesperson imagery with professional lighting and a clean commercial look.",
    { consent: !0 }
  ),
  { slug: "video-face-swap", name: "Video Face Swap", emoji: "🎬", category: "face-identity", badge: "VIDEO", template: "video-face-swap", consent: !0, blurb: "Swap a face into a video.", prompt: "" },
  K(
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
  K(
    "breakdown",
    "Breakdown",
    "🔍",
    "video-editing",
    "Split an image into labeled components.",
    "Break this image down into its individual objects and items, separating and labeling each part one by one."
  ),
  K(
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
  K("poster", "Poster", "🖼️", "ads", "A marketing poster for your product.", "Design a professional marketing poster featuring the product in this image, with bold composition, clean typography space and strong lighting."),
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
  K("graffiti-ad", "Graffiti Ad", "🎨", "ads", "Product as colorful street art on a brick wall.", "Paint the product from this image as vibrant street-art graffiti on a textured brick wall."),
  j("bullet-time-splash", "Bullet Time Splash", "💧", "ads", "Rotation with dramatic liquid splashes.", "Create a bullet-time rotation around the product in the image with dramatic frozen liquid splashes."),
  j("fridge-ad", "Fridge Ad", "🧊", "ads", "Product revealed inside an opening fridge.", "Reveal the product from the image inside a fridge as the door opens, with cool mist and a fresh feel."),
  j("volcano-ad", "Volcano Ad", "🌋", "ads", "Product rises out of a volcanic eruption.", "Show the product from the image rising dramatically out of an erupting volcano with lava and smoke."),
  K("macroshot-product", "Macroshot Product", "📸", "ads", "Macro product photo with shallow depth of field.", "Create a professional macro photograph of the product in this image with very shallow depth of field and crisp detail."),
  // ---- Games & Characters (generic style wording, no brand names)
  K(
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
  K("nano-strike", "Nano Strike", "🔫", "games-characters", "A tactical shooter operator look.", "Transform the person in this photo into a battle-ready tactical shooter character in full gear, keeping their likeness."),
  K("nano-theft", "Nano Theft", "🚗", "games-characters", "Open-world crime-game character art.", "Redraw the person in this photo as stylised open-world crime game character art, keeping their likeness."),
  K("simlife", "Simlife", "💚", "games-characters", "A stylised life-simulation avatar.", "Turn the person in this photo into a stylised life-simulation game avatar with a simple glowing marker above their head."),
  K("plushies", "Plushies", "🧸", "games-characters", "Turn anything into a soft plush toy.", "Turn the subject of this photo into an adorable plush toy character with soft fabric texture and stitching."),
  K("3d-render", "3D Render", "🧊", "games-characters", "A polished 3D rendered object from a photo.", "Turn the subject of this photo into a polished 3D render with professional studio lighting and realistic materials."),
  K("3d-figure", "3D Figure", "🗿", "games-characters", "A detailed collectible figure.", "Turn the subject of this photo into a detailed collectible action figure on a display base, with packaging-style presentation."),
  K(
    "pixel-game",
    "Pixel Game",
    "👾",
    "games-characters",
    "Retro pixel-art game graphics.",
    "Redraw this photo as retro pixel art game graphics.",
    { presets: [T("8bit", "8-bit", void 0, "Use a limited 8-bit palette and chunky pixels."), T("16bit", "16-bit", void 0, "Use a richer 16-bit palette."), T("32bit", "32-bit", void 0, "Use a detailed 32-bit style."), T("gb", "Handheld green", void 0, "Use a four-shade green handheld screen palette.")] }
  ),
  K("brick-cube", "Brick Cube", "🧱", "games-characters", "A toy-brick block figure.", "Rebuild the subject of this photo as a toy-brick figure made of interlocking plastic blocks."),
  j("sketch-to-real", "Sketch to Real", "✏️", "games-characters", "Bring a hand-drawn sketch to life as a realistic scene.", "Transform this hand-drawn sketch into a realistic live-action scene, animating it as it comes to life."),
  // ---- Trending Templates
  j("j-magazine", "J Magazine", "📰", "trending-templates", "Your photo on a Japanese-style magazine cover.", `Place this person on the cover of a Japanese-style fashion magazine with layered text and a lively page-turn animation. ${cn}`),
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
], Ve = (e) => Xt.find((t) => t.slug === e), nt = (e) => e.badge === "VIDEO" ? "video" : "image", mt = (e) => Xt.filter((t) => nt(t) === e), ot = (e) => mt(e).length > 0;
function Qt(e) {
  const t = new URLSearchParams(e), a = t.get("tab"), n = Ve(t.get("app"));
  return a === "apps" ? { mode: n ? nt(n) : "image", app: (n == null ? void 0 : n.slug) ?? null } : n && a === nt(n) ? { mode: a, app: n.slug } : { mode: null, app: null };
}
function dn(e, t, a) {
  const n = new URLSearchParams(e);
  return n.set("tab", t), n.delete("category"), a ? n.set("app", a) : n.delete("app"), `?${n.toString()}`;
}
function un(e, t, a) {
  return `${e.pathname}${dn(e.search, t, a)}${e.hash}`;
}
function mn(e, t) {
  const a = (t.q ?? "").trim().toLowerCase();
  return e.filter((n) => (!t.category || t.category === "all" || n.category === t.category) && (!a || `${n.name} ${n.blurb}`.toLowerCase().includes(a)));
}
const pn = (e) => nn.filter((t) => mt(e).some((a) => a.category === t.id));
function hn({ mode: e, value: t, onChange: a }) {
  const [n, o] = S(!1), [i, s] = S(""), [m, y] = S("all"), [b, A] = S(0), N = q(null), h = re(() => pn(e), [e]), v = re(() => mn(mt(e), { category: m, q: i }), [e, m, i]), w = Ve(t);
  B(() => A(0), [i, m, n]), B(() => {
    if (!n) return;
    const g = (f) => {
      var I;
      (I = N.current) != null && I.contains(f.target) || o(!1);
    }, p = (f) => {
      f.key === "Escape" && o(!1);
    };
    return document.addEventListener("mousedown", g), document.addEventListener("keydown", p), () => {
      document.removeEventListener("mousedown", g), document.removeEventListener("keydown", p);
    };
  }, [n]), B(() => {
    var g, p;
    (p = (g = document.getElementById(`ms-app-${b}`)) == null ? void 0 : g.scrollIntoView) == null || p.call(g, { block: "nearest" });
  }, [b]);
  const R = (g) => {
    a(g), o(!1), s("");
  }, C = (g) => {
    g.key === "ArrowDown" ? (g.preventDefault(), A((p) => Math.min(p + 1, v.length - 1))) : g.key === "ArrowUp" ? (g.preventDefault(), A((p) => Math.max(p - 1, 0))) : g.key === "Enter" && v[b] && (g.preventDefault(), R(v[b].slug));
  }, G = (g) => `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${g ? "border-primary bg-primary text-primary-ink" : "border-line text-secondary hover:text-fg"}`;
  return /* @__PURE__ */ c("div", { ref: N, className: "relative", children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": n,
        onClick: () => o((g) => !g),
        className: "flex w-full items-center gap-2 rounded-ctl border border-line bg-card-bg px-3 py-3 text-left hover:border-muted",
        children: [
          /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "flex h-6 w-6 shrink-0 items-center justify-center text-base", children: (w == null ? void 0 : w.emoji) ?? "✨" }),
          /* @__PURE__ */ r("span", { className: "min-w-0 flex-1 truncate", children: (w == null ? void 0 : w.name) ?? "Choose an app" }),
          /* @__PURE__ */ r(Pe, { up: n, width: 16, height: 16 })
        ]
      }
    ),
    n && /* @__PURE__ */ c("div", { className: "absolute left-0 right-0 top-full z-30 mt-2 rounded-card border border-line bg-panel-bg p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", children: [
      /* @__PURE__ */ c("label", { className: "relative mb-2 block", children: [
        /* @__PURE__ */ r(dt, { width: 14, height: 14, style: { position: "absolute", left: 10, top: 11, color: "var(--ms-muted)" } }),
        /* @__PURE__ */ r("input", { autoFocus: !0, onKeyDown: C, value: i, onChange: (g) => s(g.target.value), placeholder: "Search apps...", "aria-label": "Search apps", "aria-controls": "ms-app-list", className: "w-full py-2 pl-8 pr-2 text-sm" })
      ] }),
      /* @__PURE__ */ c("div", { role: "tablist", "aria-label": "App category", className: "mb-2 flex gap-1.5 overflow-x-auto pb-1", children: [
        /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === "all", onClick: () => y("all"), className: G(m === "all"), children: "All" }),
        h.map((g) => /* @__PURE__ */ r("button", { role: "tab", type: "button", "aria-selected": m === g.id, onClick: () => y(g.id), className: G(m === g.id), children: g.label }, g.id))
      ] }),
      /* @__PURE__ */ c("ul", { id: "ms-app-list", role: "listbox", className: "max-h-72 overflow-y-auto", children: [
        v.map((g, p) => /* @__PURE__ */ c(
          "li",
          {
            id: `ms-app-${p}`,
            role: "option",
            "aria-selected": g.slug === t,
            onClick: () => R(g.slug),
            className: `flex cursor-pointer items-center gap-2.5 rounded-ctl px-3 py-2 ${g.slug === t ? "bg-primary-soft" : p === b ? "bg-card-bg" : "hover:bg-card-bg"}`,
            children: [
              /* @__PURE__ */ r("span", { "aria-hidden": "true", className: "text-lg", children: g.emoji }),
              /* @__PURE__ */ c("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ r("div", { className: `truncate text-sm ${g.slug === t ? "text-primary" : ""}`, children: g.name }),
                /* @__PURE__ */ r("div", { className: "truncate text-[10px] text-secondary", children: g.blurb })
              ] })
            ]
          },
          g.slug
        )),
        v.length === 0 && /* @__PURE__ */ c("li", { className: "px-3 py-6 text-center text-sm text-secondary", children: [
          "No apps match “",
          i,
          "”."
        ] })
      ] })
    ] })
  ] });
}
const fn = (e) => e.map((t) => ({ value: t.value, label: t.title, hint: t.hint })), Me = "mb-1.5 flex items-center justify-between text-xs font-medium text-secondary";
function gn({ mode: e, slug: t, onApp: a, switcher: n, models: o, client: i, batch: s, onRun: m }) {
  const y = Ve(t), b = ve.find((A) => A.id === e).title;
  return /* @__PURE__ */ c("section", { "aria-label": b, className: "flex max-h-[85dvh] min-h-0 w-full flex-col border-b border-line bg-panel-bg md:max-h-none md:w-[360px] md:shrink-0 md:border-b-0 md:border-r", children: [
    /* @__PURE__ */ c("div", { className: "shrink-0 p-4 pb-0", children: [
      /* @__PURE__ */ r("h2", { className: "mb-4 text-lg font-semibold", children: b }),
      n,
      /* @__PURE__ */ r("div", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: "App" }),
      /* @__PURE__ */ r("div", { className: "relative z-20", children: /* @__PURE__ */ r(hn, { mode: e, value: t, onChange: a }) })
    ] }),
    y ? /* @__PURE__ */ r(bn, { app: y, mode: e, models: o, client: i, batch: s, onRun: m }, y.slug) : /* @__PURE__ */ r("p", { className: "p-4 text-sm text-secondary", children: "Pick an app to turn a photo or video into a finished result in one step." })
  ] });
}
function bn({ app: e, mode: t, models: a, client: n, batch: o, onRun: i }) {
  var u, x, D;
  const [s, m] = S(() => _t(e)), [y, b] = S(null), [A, N] = S(null), [h, v] = S(null), w = q(0), R = q(null), C = q(null), G = q({ payloadKey: "", batch: 0 }), g = q(!1), p = q(0);
  B(() => {
    m(_t(e)), b(null), N(null), v(null);
  }, [e]);
  const f = en(e), I = a.find((d) => d.name === f), U = Yt[e.template], E = re(() => rn(e, s), [e, s]), _ = JSON.stringify(E), M = (d) => m((l) => ({ ...l, ...d }));
  B(() => {
    if (!I) return;
    const d = ++w.current;
    R.current = null;
    const l = setTimeout(() => {
      n.estimate(f, E).then((k) => {
        d === w.current && (N(k), R.current = _);
      }).catch(() => {
        d === w.current && N(null);
      });
    }, 500);
    return () => clearTimeout(l);
  }, [_, I, n]), B(() => {
    v(null);
  }, [o, _]);
  const O = I ? xe(I, A) : null;
  G.current = { payloadKey: _, batch: o };
  const W = Kt(e), ee = async (d) => {
    if (!I) return;
    v(null);
    const l = d ?? { payload: E, batch: o, unit: (O == null ? void 0 : O.current) ?? 0 };
    p.current = Date.now() + 1500, i({ model: f, endpointUrl: I.endpoint_url, mode: t, prompt: Wt(e, s) || e.name, payload: l.payload, count: l.batch, kind: st(I.category), unitCost: l.unit });
  }, Y = async () => {
    var l, k;
    if (g.current || Date.now() < p.current) return;
    const d = tn(e, s);
    if (d) {
      b(d);
      return;
    }
    b(null), g.current = !0;
    try {
      const L = _, P = o, ie = E;
      let Z = (O == null ? void 0 : O.current) ?? 0, ue = !0;
      if (I && R.current !== L) {
        try {
          Z = ((l = xe(I, await n.estimate(f, ie))) == null ? void 0 : l.current) ?? Z;
        } catch {
          ue = !1, Z = ((k = xe(I, null)) == null ? void 0 : k.current) ?? Z;
        }
        if (G.current.payloadKey !== L || G.current.batch !== P) return;
      }
      C.current = { payload: ie, batch: P, unit: Z };
      const te = Z * P;
      if (te > Jt || !ue) {
        v(te);
        return;
      }
      await ee(C.current);
    } finally {
      g.current = !1;
    }
  }, J = (d, l, k, L) => l && l.length > 0 ? /* @__PURE__ */ c("div", { className: "mb-5", children: [
    /* @__PURE__ */ r("div", { className: Me, children: d }),
    /* @__PURE__ */ r(et, { label: d, options: fn(l), value: k, onChange: L })
  ] }) : null;
  return /* @__PURE__ */ c("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    /* @__PURE__ */ c("div", { className: "min-h-0 flex-1 overflow-y-auto p-4", children: [
      /* @__PURE__ */ r("p", { className: "mb-4 text-xs text-secondary", children: e.blurb }),
      e.consent && /* @__PURE__ */ r("p", { role: "note", className: "mb-4 rounded-ctl border border-line bg-card-bg p-2.5 text-[11px] text-secondary", children: "Only use photos and videos of people who have agreed, or that you have the rights to use." }),
      !I && /* @__PURE__ */ c("p", { role: "alert", className: "mb-4 text-sm text-danger", children: [
        "This app needs the model “",
        f,
        "”, which is not in your catalog right now."
      ] }),
      W.map((d) => /* @__PURE__ */ c("div", { className: "mb-5", children: [
        /* @__PURE__ */ c("div", { className: Me, children: [
          /* @__PURE__ */ r("span", { children: d.label }),
          /* @__PURE__ */ r("span", { className: "text-[11px] text-primary", children: d.optional ? "optional" : "* required" })
        ] }),
        /* @__PURE__ */ r(
          tt,
          {
            client: n,
            multiple: !1,
            max: 1,
            current: s.uploads[d.id] ? [s.uploads[d.id]] : [],
            field: { prop: { name: `${d.kind}_${d.id}`, title: d.label, field: d.kind }, kind: "media", required: !d.optional },
            onUrls: (l) => m((k) => ({ ...k, uploads: { ...k.uploads, [d.id]: l[0] ?? "" } })),
            onError: b
          }
        )
      ] }, d.id)),
      e.presets && /* @__PURE__ */ c("div", { className: "mb-5", children: [
        /* @__PURE__ */ r("div", { className: Me, children: e.presetLabel ?? "Presets" }),
        /* @__PURE__ */ r(et, { label: e.presetLabel ?? "Presets", options: [{ value: "", label: "Custom" }, ...e.presets.map((d) => ({ value: d.id, label: d.label, hint: d.hint }))], value: s.preset, onChange: (d) => m(Lt(e, s, String(d))) })
      ] }),
      e.sliders && /* @__PURE__ */ r("div", { className: "mb-3 text-[11px] font-semibold uppercase tracking-wider text-secondary", children: e.slug === "angles" ? "3D camera angles" : "Adjustments & controls" }),
      (u = e.sliders) == null ? void 0 : u.map((d) => /* @__PURE__ */ c("div", { className: "mb-4", children: [
        /* @__PURE__ */ c("div", { className: Me, children: [
          /* @__PURE__ */ r("label", { htmlFor: `ms-sl-${d.id}`, children: d.label }),
          /* @__PURE__ */ c("span", { className: "tabular-nums text-primary", children: [
            s.sliders[d.id] ?? 0,
            d.unit ?? ""
          ] })
        ] }),
        /* @__PURE__ */ r("input", { id: `ms-sl-${d.id}`, type: "range", min: d.min, max: d.max, step: d.step, value: s.sliders[d.id] ?? 0, className: "w-full", onChange: (l) => M({ sliders: { ...s.sliders, [d.id]: Number(l.target.value) } }) })
      ] }, d.id)),
      e.sliders && /* @__PURE__ */ r("button", { type: "button", onClick: () => m(Lt(e, s, "")), className: "mb-5 rounded-md border border-line px-3 py-1.5 text-[11px] text-secondary hover:text-primary", children: "Reset All" }),
      e.template !== "skin" && e.template !== "face-swap" && e.template !== "video-face-swap" && e.template !== "bg-remover" && /* @__PURE__ */ c("div", { className: "mb-5", children: [
        /* @__PURE__ */ c("div", { className: Me, children: [
          "Prompt refinement ",
          /* @__PURE__ */ r("span", { className: "text-muted", children: "(optional)" })
        ] }),
        /* @__PURE__ */ r("textarea", { "aria-label": "Prompt refinement", rows: 3, value: s.refinement, onChange: (d) => M({ refinement: d.target.value }), placeholder: "e.g. cinematic lighting, detailed background…", className: "w-full resize-y p-3 text-sm" })
      ] }),
      J("Aspect Ratio", U.aspect, s.aspect, (d) => M({ aspect: d })),
      J(e.template === "seedream" ? "Output Resolution" : "Resolution", U.resolution, s.resolution, (d) => M({ resolution: d })),
      J("Quality Level", U.quality, s.quality, (d) => M({ quality: String(d) })),
      J("Duration", U.duration, s.duration, (d) => M({ duration: Number(d) })),
      (e.template === "face-swap" || e.template === "video-face-swap") && J("Target Face Index", Ya, s.targetIndex, (d) => M({ targetIndex: Number(d) })),
      e.template === "video-face-swap" && J("Target Gender Filter", Ka, s.gender, (d) => M({ gender: String(d) })),
      e.template === "bg-remover" && /* @__PURE__ */ c(je, { children: [
        J("Background Color", Wa, s.background, (d) => M({ background: String(d) })),
        J("Output Container & Codec", Xa, s.container, (d) => M({ container: String(d) })),
        /* @__PURE__ */ c("div", { className: "mb-5 flex items-center justify-between", children: [
          /* @__PURE__ */ r("span", { className: "text-xs font-medium text-secondary", children: "Audio Track" }),
          /* @__PURE__ */ r("button", { type: "button", role: "switch", "aria-label": "Audio track", "aria-checked": s.keepAudio, onClick: () => M({ keepAudio: !s.keepAudio }), className: `flex h-6 w-11 items-center rounded-full border px-0.5 ${s.keepAudio ? "justify-end border-primary bg-primary-soft" : "justify-start border-line bg-card-bg"}`, children: /* @__PURE__ */ r("span", { className: `h-5 w-5 rounded-full ${s.keepAudio ? "bg-primary" : "bg-muted"}` }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ c("div", { className: "border-t border-line bg-panel-bg p-3", children: [
      y && /* @__PURE__ */ r("p", { role: "alert", className: "mb-2 text-xs text-danger", children: y }),
      h !== null && /* @__PURE__ */ c("div", { role: "alertdialog", "aria-label": "Confirm spend", className: "mb-2 rounded-ctl border border-primary bg-primary-soft p-3 text-xs", children: [
        "This will spend about ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ce(h) }),
        " (",
        ((x = C.current) == null ? void 0 : x.batch) ?? o,
        " × ",
        ce(((D = C.current) == null ? void 0 : D.unit) ?? (O == null ? void 0 : O.current) ?? 0),
        ").",
        /* @__PURE__ */ c("div", { className: "mt-2 flex gap-2", children: [
          /* @__PURE__ */ r("button", { type: "button", onClick: () => void ee(C.current ?? void 0), className: "rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-ink", children: "Confirm" }),
          /* @__PURE__ */ r("button", { type: "button", onClick: () => v(null), className: "rounded-md border border-line px-3 py-1.5 text-secondary", children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ c("button", { type: "button", disabled: !I, onClick: () => void Y(), className: "flex w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none", children: [
        /* @__PURE__ */ r(ct, { width: 16, height: 16, className: "shrink-0" }),
        an(e),
        o > 1 ? ` ×${o}` : "",
        O && O.current > 0 && /* @__PURE__ */ c("span", { className: "font-normal", children: [
          "(",
          ce(O.current * o),
          ")"
        ] })
      ] })
    ] })
  ] });
}
function Gt({ view: e, onChange: t }) {
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
function yn() {
  try {
    const e = window.location.search, t = Qt(e);
    if (t.mode) return t.mode;
    const a = new URLSearchParams(e).get("tab");
    return br(a) ? a : null;
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
function Dt(e) {
  if (!ot(e)) return { view: "models", app: null };
  try {
    const a = Qt(window.location.search);
    if (a.mode === e && a.app) return { view: "apps", app: a.app };
    if (a.mode === e && new URLSearchParams(window.location.search).get("tab") === "apps") return { view: "apps", app: null };
  } catch {
  }
  const t = Ee.get(`muapi-studio:app:${e}`);
  return { view: Ee.get(`muapi-studio:view:${e}`) === "apps" ? "apps" : "models", app: Ve(t) ? t : null };
}
function xn({ scope: e, apiBase: t = "/api/muapi", initialTab: a = "image", showHeader: n = !0, title: o = "Studio", teamId: i, theme: s = "lime", layout: m, apiKey: y, onRequestApiKey: b, getHeaders: A, connected: N, fetchImpl: h, features: v, className: w = "", onTabChange: R }) {
  const C = N === !1 || y === "" || y === null, G = q(A);
  G.current = A;
  const [g, p] = S(!1), f = re(() => new sr(t, i, { apiKey: y || void 0, getHeaders: () => {
    var V;
    return ((V = G.current) == null ? void 0 : V.call(G)) ?? {};
  }, fetchImpl: h, onKeyRejected: () => p(!0) }), [t, i, y, h]);
  B(() => p(!1), [f]);
  const [I, U] = S({ library: !0, deleteMedia: !0 }), E = re(() => ({ library: I.library && (v == null ? void 0 : v.library) !== !1, deleteMedia: (v == null ? void 0 : v.deleteMedia) !== !1 }), [I, v == null ? void 0 : v.library, v == null ? void 0 : v.deleteMedia]), _ = m ?? hr(s), [M, O] = S(() => yn() ?? a), [W, ee] = S(4), [Y, J] = S(null), [u, x] = S(null), [D, d] = S(null), l = ae(() => {
    f.balance().then(d).catch(() => d(null));
  }, [f]), [k, L] = S(null), P = Er(f, Y, l, e, !C), ie = re(() => Sr(P.items), [P.items]);
  B(() => {
    C || (x(null), J(null), f.models().then(J).catch((V) => x(V.message)), l(), (v == null ? void 0 : v.library) !== !1 && f.probe().then(U));
  }, [f, l, C, v == null ? void 0 : v.library]);
  const [Z, ue] = S(() => Dt(M)), te = (V, F) => {
    try {
      window.history.replaceState(null, "", un(window.location, V, F));
    } catch {
    }
  }, oe = (V) => {
    const F = Dt(V);
    O(V), ue(F), R == null || R(V), te(V, F.view === "apps" ? F.app : null);
  }, Ie = (V) => {
    ue((F) => ({ ...F, view: V })), Ee.set(`muapi-studio:view:${M}`, V), te(M, V === "apps" ? Z.app : null);
  }, se = (V) => {
    ue({ view: "apps", app: V }), Ee.set(`muapi-studio:app:${M}`, V), Ee.set(`muapi-studio:view:${M}`, "apps"), te(M, V);
  }, me = ae(async (V) => {
    await P.run(V);
  }, [P.run]), pe = ae((V) => {
    var de;
    const F = Y == null ? void 0 : Y.find((fe) => fe.name === V);
    return F ? ((de = F.sale) == null ? void 0 : de.from) ?? F.cost ?? void 0 : void 0;
  }, [Y]), Ue = ae((V) => {
    O(V.mode), ue((F) => ({ ...F, view: "models" })), L({ model: V.model, inputs: V.inputs, nonce: Date.now() });
  }, []), qe = ae(async (V) => {
    var Te;
    const F = Y == null ? void 0 : Y.find((_e) => _e.name === V.model);
    if (!F) return;
    let de = ((Te = F.sale) == null ? void 0 : Te.from) ?? F.cost ?? 0, fe = !1;
    try {
      de = (await f.estimate(V.model, V.inputs)).cost, fe = !0;
    } catch {
    }
    const we = fe ? "" : " (the exact price could not be checked)";
    (de > 0.25 || !fe) && !window.confirm(`Re-run ${V.model} for about $${de.toFixed(2)}?${we}`) || P.run({ model: V.model, endpointUrl: F.endpoint_url, mode: V.mode, prompt: V.prompt, payload: V.inputs, count: 1, unitCost: de, kind: st(F.category) });
  }, [Y, P.run, f]);
  return /* @__PURE__ */ c("div", { className: `ms-root ${w}`.trim(), style: pr(s), "data-layout": _, "data-btn": fr(s), children: [
    n && /* @__PURE__ */ c("header", { className: "flex items-center justify-between border-b border-line bg-panel-bg px-4 py-3", children: [
      /* @__PURE__ */ r("h1", { className: "text-base font-semibold", children: o }),
      D && /* @__PURE__ */ c("span", { className: "rounded-full border border-line bg-card-bg px-3 py-1 text-xs text-secondary", title: "Account balance", children: [
        "Balance ",
        /* @__PURE__ */ r("b", { className: "text-primary", children: ce(D.balance) })
      ] })
    ] }),
    C ? /* @__PURE__ */ c("div", { className: "flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center", children: [
      /* @__PURE__ */ r("h2", { className: "text-lg font-semibold", children: "Connect your MuAPI key" }),
      /* @__PURE__ */ r("p", { className: "max-w-sm text-sm text-secondary", children: "Add your MuAPI API key to browse models and generate. Your key stays with your own account and is only used for your own requests." }),
      b && /* @__PURE__ */ r("button", { type: "button", onClick: b, className: "rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-glow hover:bg-primary-hover", children: "Add API key" })
    ] }) : /* @__PURE__ */ c(Rt.Provider, { value: E, children: [
      g && /* @__PURE__ */ c("div", { role: "alert", className: "flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-panel-bg px-4 py-2.5 text-sm", children: [
        /* @__PURE__ */ r("span", { className: "text-danger", children: "Your MuAPI key was rejected. Check it or add a new one." }),
        b && /* @__PURE__ */ r("button", { type: "button", onClick: b, className: "rounded-btn border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-card-bg", children: "Update key" })
      ] }),
      /* @__PURE__ */ c("div", { className: `flex min-h-0 flex-1 flex-col ${_ === "rail" ? "md:flex-row" : ""}`, children: [
        /* @__PURE__ */ r(Ra, { mode: M, onChange: oe, layout: _, onChangeKey: b }),
        /* @__PURE__ */ r("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row", children: u ? /* @__PURE__ */ c("div", { role: "alert", className: "flex-1 p-8 text-danger", children: [
          "Could not load models: ",
          u
        ] }) : Y ? /* @__PURE__ */ c(je, { children: [
          Z.view === "apps" && ot(M) ? /* @__PURE__ */ r(gn, { mode: M, slug: Z.app, onApp: se, switcher: /* @__PURE__ */ r(Gt, { view: "apps", onChange: Ie }), models: Y, client: f, batch: W, onRun: me }) : /* @__PURE__ */ r(Ga, { mode: M, models: Y, client: f, batch: W, onRun: me, usage: ie, reuse: k, switcher: ot(M) ? /* @__PURE__ */ r(Gt, { view: "models", onChange: Ie }) : void 0 }),
          /* @__PURE__ */ r(Xr, { mode: M, items: P.items, batch: W, onBatch: ee, onLabel: P.setLabel, onRemove: P.remove, onReuse: Ue, onRerun: qe, onDeleteMedia: P.deleteMedia, onLoadMore: P.loadMore, hasMore: P.hasMore, loadingMore: P.loadingMore, serverError: P.serverError, estimateFor: pe })
        ] }) : /* @__PURE__ */ c("div", { className: "flex flex-1 items-center justify-center gap-2 text-secondary", children: [
          /* @__PURE__ */ r(Ce, {}),
          " Loading studio…"
        ] }) })
      ] })
    ] })
  ] });
}
function kn(e) {
  const t = e.accountId ?? Cr(e.apiKey), a = e.teamId ? `${t}:t${e.teamId}` : t;
  return /* @__PURE__ */ r(xn, { scope: a, ...e }, `${a}|${e.apiBase ?? ""}`);
}
export {
  be as ApiError,
  sr as MuapiClient,
  kn as MuapiStudio,
  mr as THEMES,
  ur as cyanTheme,
  hr as defaultLayout,
  st as generationKind,
  Ke as limeTheme,
  gt as pollUntilDone,
  jt as resolveTheme,
  Cr as scopeOfKey,
  pr as themeStyle
};
