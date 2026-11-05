import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { CardDef, PropField } from "./types";

/** Brand scenes lay out on the 1920×1080 design stage; the composition fits that stage into any film size. */
const STAGE = { width: 1920, height: 1080 } as const;

/**
 * Brand scenes — prop-driven scene cards that tell a product's story from its REAL
 * content: the captured page, the nav / section names, the logo and the site's words.
 * They reproduce the scenes of a hand-made product film: a URL typed and scanned, the
 * product as a hub with its features as nodes, a push-in on a real section, and a logo
 * reveal with the call to action. Every card is a pure function of the frame.
 */
const src = (file: string): string => (/^(?:blob:|data:|https?:\/\/)/i.test(file) ? file : staticFile(file));
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.2, 0.75, 0.3, 1);
const rise = (frame: number, from: number, to = from + 14) => interpolate(frame, [from, to], [0, 1], { ...clamp, easing: ease });
const list = (v: unknown, max: number): string[] =>
  String(v ?? "")
    .split(/\r?\n|\s*[|,]\s*/)
    .map((s) => s.replace(/\*/g, "").trim())
    .filter(Boolean)
    .slice(0, max);
/** Deterministic pseudo-random in [0,1) from an index. */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Look {
  bg?: string;
  ink?: string;
  accent?: string;
  font?: string;
}
const lookOf = (p: Look) => ({
  bg: p.bg || "#0b0b14",
  ink: p.ink || "#f5f5fa",
  accent: p.accent || "#8b6bff",
  font: p.font || "Inter, system-ui, -apple-system, sans-serif",
});

const Backdrop: React.FC<{ bg: string; accent: string }> = ({ bg, accent }) => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 50% 45%, ${accent}33, transparent 70%), ${bg}` }} />
);

// ——— Hub: the product page in the middle, its features as nodes on glowing lines ———
const BrandHub: React.FC<{ title?: string; file?: string; labels?: string } & Look> = ({ title = "", file = "", labels = "", ...look }) => {
  const frame = useCurrentFrame();
  const { width, height } = STAGE;
  const { bg, ink, accent, font } = lookOf(look);
  const names = list(labels, 12);
  const cx = width / 2;
  const cy = height * 0.54;
  const rx = width * 0.36;
  const ry = height * 0.34;
  const pageW = width * 0.3;
  const pageH = pageW * 0.625;
  const pageT = rise(frame, 6, 24);
  const titleT = rise(frame, 0, 12);
  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <Backdrop bg={bg} accent={accent} />
      {title ? (
        <div style={{ position: "absolute", top: height * 0.07, left: 0, right: 0, textAlign: "center", color: ink, fontSize: height * 0.062, fontWeight: 700, opacity: titleT, filter: `blur(${(1 - titleT) * 8}px)`, padding: "0 8%" }}>
          {title.replace(/\*/g, "")}
        </div>
      ) : null}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {names.map((_, i) => {
          const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * rx;
          const y = cy + Math.sin(a) * ry;
          const t = rise(frame, 22 + i * 3, 40 + i * 3);
          return <line key={i} x1={cx} y1={cy} x2={cx + (x - cx) * t} y2={cy + (y - cy) * t} stroke={accent} strokeWidth={2.5} strokeOpacity={0.7} style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: cx - pageW / 2, top: cy - pageH / 2, width: pageW, height: pageH, borderRadius: 16, overflow: "hidden", background: "#fff", border: `2px solid ${accent}`, boxShadow: `0 0 60px ${accent}66`, opacity: pageT, transform: `scale(${0.88 + 0.12 * pageT})` }}>
        {file ? <Img src={src(file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%" }} /> : null}
      </div>
      {names.map((name, i) => {
        const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
        const t = rise(frame, 30 + i * 3, 46 + i * 3);
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        const float = Math.sin((frame + i * 9) / 18) * 4;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y + float, transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * t})`, opacity: t, padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `1.5px solid ${accent}`, color: ink, fontSize: height * 0.032, fontWeight: 600, whiteSpace: "nowrap", boxShadow: `0 0 24px ${accent}55`, backdropFilter: "blur(6px)" }}>
            {name}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ——— URL scan: the address typed into a bar, then the page scanned and its parts tagged ———
const BrandUrlScan: React.FC<{ url?: string; file?: string; labels?: string } & Look> = ({ url = "yourbrand.com", file = "", labels = "BRANDING, PEOPLE, PRODUCTS, OFFERS, SERVICES", ...look }) => {
  const frame = useCurrentFrame();
  const { width, height } = STAGE;
  const { bg, ink, accent, font } = lookOf(look);
  const tags = list(labels, 6);
  const typed = Math.min(url.length, Math.floor(Math.max(0, frame - 4) / 2));
  const barW = width * 0.52;
  const barY = height * 0.12;
  const pageT = rise(frame, 36, 54);
  const pageW = width * 0.62;
  const pageH = height * 0.62;
  const pageX = (width - pageW) / 2;
  const pageY = height * 0.27;
  const scan = interpolate(frame, [54, 54 + 60], [0, 1], clamp);
  const signal = Math.min(tags.length, Math.floor(scan * tags.length) + (scan > 0 ? 1 : 0));
  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <Backdrop bg={bg} accent={accent} />
      <div style={{ position: "absolute", left: (width - barW) / 2, top: barY, width: barW, height: height * 0.075, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", padding: "0 28px", color: ink, fontSize: height * 0.034, fontFamily: MONO }}>
        {url.slice(0, typed)}
        <span style={{ width: 3, height: "60%", background: accent, marginLeft: 3, opacity: Math.floor(frame / 8) % 2 }} />
      </div>
      <div style={{ position: "absolute", left: pageX, top: pageY, width: pageW, height: pageH, borderRadius: 14, overflow: "hidden", background: "#fff", opacity: pageT, transform: `translateY(${(1 - pageT) * 40}px)`, boxShadow: `0 0 70px ${accent}55` }}>
        {file ? <Img src={src(file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%" }} /> : null}
        {scan > 0 && scan < 1 ? <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 4, background: accent, boxShadow: `0 0 28px 6px ${accent}` }} /> : null}
        {tags.map((tag, i) => {
          const on = i < signal;
          const col = i % 2;
          return (
            <div key={i} style={{ position: "absolute", left: `${6 + col * 48}%`, top: `${8 + Math.floor(i / 2) * 28}%`, width: "42%", height: "22%", border: `3px solid ${accent}`, borderRadius: 10, opacity: on ? 1 : 0, background: `${accent}18` }}>
              <span style={{ position: "absolute", left: -3, top: -34, background: accent, color: bg, padding: "4px 12px", fontFamily: MONO, fontSize: height * 0.03, fontWeight: 700, letterSpacing: "0.08em" }}>{tag.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: height * 0.045, left: 0, right: 0, textAlign: "center", fontFamily: MONO, letterSpacing: "0.3em", color: accent, fontSize: height * 0.03, opacity: pageT }}>
        {scan >= 1 ? "BRAND READ" : `SIGNALS ${String(signal).padStart(2, "0")}/${String(Math.max(tags.length, 1)).padStart(2, "0")} SCANNING`}
      </div>
    </AbsoluteFill>
  );
};

// ——— Feature zoom: a slow push-in on a real section of the page, with a label ———
const BrandFeatureZoom: React.FC<{ file?: string; label?: string; text?: string; focusY?: number; duration?: number } & Look> = ({ file = "", label = "", text = "", focusY = 0, duration = 90, ...look }) => {
  const frame = useCurrentFrame();
  const { height } = STAGE;
  const { bg, ink, accent, font } = lookOf(look);
  const push = interpolate(frame, [0, Math.max(30, duration)], [1, 1.14], { ...clamp, easing: Easing.out(Easing.cubic) });
  const chip = rise(frame, 10, 24);
  const fade = interpolate(frame, [duration - 8, duration], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: font, opacity: fade }}>
      <Backdrop bg={bg} accent={accent} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "78%", aspectRatio: "16 / 9", borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: `0 30px 90px rgba(0,0,0,0.5), 0 0 0 3px ${accent}66`, transform: `scale(${push})` }}>
          {file ? <Img src={src(file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `50% ${focusY}%` }} /> : null}
        </div>
      </AbsoluteFill>
      {label ? (
        <div style={{ position: "absolute", left: "11%", top: "8%", padding: "10px 24px", borderRadius: 999, background: accent, color: bg, fontSize: height * 0.03, fontWeight: 700, opacity: chip, transform: `translateY(${(1 - chip) * -16}px)` }}>{label.replace(/\*/g, "")}</div>
      ) : null}
      {text ? (
        <div style={{ position: "absolute", left: "11%", bottom: "6%", maxWidth: "78%", padding: "12px 28px", borderRadius: 16, background: "rgba(8,10,20,0.82)", color: "#fff", fontSize: height * 0.042, fontWeight: 700, opacity: rise(frame, 18, 32), transform: `translateY(${(1 - rise(frame, 18, 32)) * 20}px)` }}>{text.replace(/\*/g, "")}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— Gallery: the site's own pictures (people, products, cards), one after another with a fan behind ———
const BrandGallery: React.FC<{ images?: string; captions?: string; text?: string; duration?: number } & Look> = ({ images = "", captions = "", text = "", duration = 120, ...look }) => {
  const frame = useCurrentFrame();
  const { height } = STAGE;
  const { bg, ink, accent, font } = lookOf(look);
  const files = String(images).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 6);
  const notes = String(captions).split(/\r?\n/).map((x) => x.replace(/\*/g, "").trim());
  const n = Math.max(1, files.length);
  const per = Math.max(24, Math.floor((duration - 12) / n));
  const at = Math.min(n - 1, Math.floor(frame / per));
  const t = frame - at * per;
  const enter = interpolate(t, [0, 14], [0, 1], { ...clamp, easing: ease });
  const fade = interpolate(frame, [duration - 8, duration], [1, 0], clamp);
  const push = interpolate(t, [0, per], [1, 1.06], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: font, opacity: fade }}>
      <Backdrop bg={bg} accent={accent} />
      {files.slice(at + 1, at + 3).map((f, k) => (
        <AbsoluteFill key={f + k} style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: "46%", aspectRatio: "4 / 3", borderRadius: 18, overflow: "hidden", opacity: 0.5 - k * 0.2, transform: `translateX(${(k + 1) * 11}%) rotate(${(k + 1) * 4}deg) scale(${1 - (k + 1) * 0.06})`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <Img src={src(f)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </AbsoluteFill>
      ))}
      {files.length ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div key={at} style={{ width: "46%", aspectRatio: "4 / 3", borderRadius: 22, overflow: "hidden", background: "#fff", boxShadow: `0 30px 90px rgba(0,0,0,0.55), 0 0 0 3px ${accent}66`, opacity: enter, transform: `translateX(${(1 - enter) * -18}%) scale(${push})` }}>
            <Img src={src(files[at])} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }} />
          </div>
        </AbsoluteFill>
      ) : null}
      {notes[at] ? (
        <div style={{ position: "absolute", left: "27%", bottom: "9%", maxWidth: "46%", padding: "10px 24px", borderRadius: 14, background: accent, color: bg, fontSize: height * 0.034, fontWeight: 700, opacity: enter }}>{notes[at]}</div>
      ) : null}
      {text ? (
        <div style={{ position: "absolute", left: "8%", top: "10%", maxWidth: "26%", color: ink, fontSize: height * 0.05, fontWeight: 800, lineHeight: 1.1, opacity: rise(frame, 6, 22) }}>{text.replace(/\*/g, "")}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— Logo reveal: logo + name with sparks, then the call to action and the address ———
const BrandLogoReveal: React.FC<{ logo?: string; name?: string; cta?: string; url?: string; duration?: number } & Look> = ({ logo = "", name = "", cta = "", url = "", duration = 90, ...look }) => {
  const frame = useCurrentFrame();
  const { width, height } = STAGE;
  const { bg, ink, accent, font } = lookOf(look);
  const logoT = rise(frame, 2, 22);
  const nameT = rise(frame, 14, 30);
  const ctaT = rise(frame, 34, 50);
  const fade = interpolate(frame, [duration - 6, duration], [1, 0], clamp);
  const burst = interpolate(frame, [6, 50], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: font, opacity: fade }}>
      <Backdrop bg={bg} accent={accent} />
      {Array.from({ length: 26 }, (_, i) => {
        const a = rnd(i) * Math.PI * 2;
        const d = (0.12 + rnd(i + 40) * 0.38) * Math.min(width, height) * burst;
        return <div key={i} style={{ position: "absolute", left: width / 2 + Math.cos(a) * d * 1.5, top: height * 0.4 + Math.sin(a) * d, width: 6 + rnd(i + 9) * 8, height: 6 + rnd(i + 9) * 8, borderRadius: "50%", background: accent, opacity: (1 - burst) * 0.9 + 0.1 * burst, boxShadow: `0 0 16px ${accent}` }} />;
      })}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 8%" }}>
        {logo ? (
          <Img src={src(logo)} style={{ height: height * 0.2, maxWidth: width * 0.5, objectFit: "contain", opacity: logoT, transform: `scale(${1.25 - 0.25 * logoT})` }} />
        ) : name ? (
          <div style={{ width: height * 0.16, height: height * 0.16, borderRadius: height * 0.04, background: accent, color: bg, fontSize: height * 0.1, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", opacity: logoT, transform: `scale(${1.25 - 0.25 * logoT})` }}>
            {name.trim().charAt(0).toUpperCase()}
          </div>
        ) : null}
        {name ? <div style={{ color: ink, fontSize: height * 0.085, fontWeight: 800, marginTop: height * 0.03, opacity: nameT, filter: `blur(${(1 - nameT) * 8}px)` }}>{name.replace(/\*/g, "")}</div> : null}
        {cta ? <div style={{ color: ink, fontSize: height * 0.04, fontWeight: 500, marginTop: height * 0.035, opacity: ctaT }}>{cta.replace(/\*/g, "")}</div> : null}
        {url ? <div style={{ color: accent, fontFamily: MONO, fontSize: height * 0.034, letterSpacing: "0.08em", marginTop: height * 0.02, opacity: ctaT }}>{url}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const LOOK_FIELDS: PropField[] = [
  { type: "color", key: "bg", label: "Background", default: "#0b0b14" },
  { type: "color", key: "ink", label: "Text", default: "#f5f5fa" },
  { type: "color", key: "accent", label: "Accent", default: "#8b6bff" },
  { type: "text", key: "font", label: "Font", default: "" },
];

const brandCard = (id: string, nameEn: string, summaryEn: string, component: React.ComponentType<never>, durationInFrames: number, schema: PropField[], durationProp?: string): CardDef => ({
  id,
  name: nameEn,
  nameEn,
  category: "品牌场景",
  categoryEn: "Brand scenes",
  durationInFrames,
  accent: "#8b6bff",
  summaryEn,
  component: component as unknown as React.ComponentType<Record<string, unknown>>,
  schema: [...schema, ...LOOK_FIELDS],
  ...(durationProp ? { durationProp } : {}),
});

export const BRAND_SCENE_CARDS: CardDef[] = [
  brandCard("brand-hub", "Brand hub", "The product page in the middle with its features as glowing nodes (from the site's own menu and headings).", BrandHub, 120, [
    { type: "text", key: "title", label: "Title", default: "" },
    { type: "text", key: "file", label: "Page image", default: "" },
    { type: "textarea", key: "labels", label: "Nodes (one per line)", default: "" },
  ]),
  brandCard("brand-url-scan", "URL scan", "The address typed into a bar, then the page scanned and its parts tagged.", BrandUrlScan, 130, [
    { type: "text", key: "url", label: "Address", default: "yourbrand.com" },
    { type: "text", key: "file", label: "Page image", default: "" },
    { type: "textarea", key: "labels", label: "Tags (one per line)", default: "BRANDING\nPEOPLE\nPRODUCTS\nOFFERS\nSERVICES" },
  ]),
  brandCard("brand-feature-zoom", "Feature zoom", "A slow push-in on a real section of the page with a label.", BrandFeatureZoom, 90, [
    { type: "text", key: "file", label: "Page image", default: "" },
    { type: "text", key: "label", label: "Label", default: "" },
    { type: "text", key: "text", label: "Line", default: "" },
    { type: "slider", key: "focusY", label: "Page position", default: 0, min: 0, max: 100, step: 1, unit: "%" },
  ], "duration"),
  brandCard("brand-gallery", "People & pictures", "The site's own pictures (people, products, cards) one after another with a fan behind and the site's caption.", BrandGallery, 120, [
    { type: "textarea", key: "images", label: "Images (one per line)", default: "" },
    { type: "textarea", key: "captions", label: "Captions (one per line)", default: "" },
    { type: "text", key: "text", label: "Line", default: "" },
  ], "duration"),
  brandCard("brand-logo-reveal", "Logo reveal", "Logo and name with sparks, then the call to action and the address.", BrandLogoReveal, 90, [
    { type: "text", key: "logo", label: "Logo image", default: "" },
    { type: "text", key: "name", label: "Name", default: "" },
    { type: "text", key: "cta", label: "Call to action", default: "" },
    { type: "text", key: "url", label: "Address", default: "" },
  ], "duration"),
];
