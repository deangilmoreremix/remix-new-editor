// Ported from video-shotcraft (https://github.com/Vincentwei1021/video-shotcraft)
// Copyright 2026 Wei Yihao, Apache License 2.0. Rebranded as Motion Studio / SmartVideo GO.
//
// Motion Studio brand fixture — demos that draw a logo / brand name / pitch copy use this module:
// mark <MotionStudioMark> (the OpenHiggsBolt layered-boxes glyph on a cyan-to-purple gradient
// rounded tile), wordmark <MotionStudioWordmark>, brand colours BRAND, and the pitch copy library
// PITCH. Brand spec: gradient tile #06b6d4 -> #a855f7 with the dark layered-boxes glyph (tone="light"),
// solid white tile with the dark glyph (tone="dark"); Inter wordmark, no gradients or glow on the
// glyph itself, accent cyan #22d3ee / purple #a855f7 are the only accent colours.
// Pure props function, depends on react only; copy demos together with this file and fix the import path.
import React from 'react';
import { Img } from 'remotion';
import { skinLooks } from './Look';

/** The brand the demos draw. Defaults to SmartVideo GO (the studio's own demos); a company film sets its own with `setBrand`. */
export interface BrandTokens {
  name: string;
  short: string;
  repo: string;
  accent: string;
  accent2: string;
  amber: string;
  ink: string;
  paper: string;
  slate: string;
  font: string;
  /** The company's logo image (URL); the mark draws it instead of the SmartVideo glyph. */
  logo: string | null;
}

const DEFAULT_BRAND: Readonly<BrandTokens> = {
  name: 'SmartVideo GO', // formal product name
  short: 'Motion Studio', // short name in prose / tight spaces
  repo: 'github.com/deangilmoreremix/OpenHiggsBolt', // rendered by demo browser chrome
  accent: '#22d3ee', // brand accent (cyan)
  accent2: '#a855f7', // secondary accent (purple)
  amber: '#22d3ee', // legacy alias of accent, kept so existing consumers keep compiling
  ink: '#050505', // glyph ink on light tiles
  paper: '#ffffff', // wordmark / mark on dark grounds
  slate: '#a1a1aa', // secondary text on dark
  font: '"Inter", Inter, -apple-system, "Helvetica Neue", "PingFang SC", Arial, sans-serif', // wordmark font
  logo: null,
};

/** Read by the demos while they render. Mutated by `setBrand` (a composition sets it before its clips render). */
export const BRAND: BrandTokens = { ...DEFAULT_BRAND };

// The two path segments of the mark (viewBox 0 0 24 24): frame = the top stacked layer,
// cut = the two lower layers. Exported separately so each can animate on its own
// (the top layer draws first, the lower layers wipe in afterwards).
export const MARK_PATHS = {
  frame: 'M12 2L2 7l10 5 10-5-10-5z',
  cut: 'M2 17l10 5 10-5M2 12l10 5 10-5',
} as const;

// The mark. tone='dark' -> white tile (for dark grounds), tone='light' -> cyan-to-purple
// gradient tile; the layered-boxes glyph stays dark in both. frameColor / cutColor override
// the glyph colour. cutProgress 0->1: the lower layers wipe in left to right (default 1 = full);
// frameProgress likewise reveals the whole mark (tile + top layer) left to right.
export const MotionStudioMark: React.FC<{
  size?: number; tone?: 'dark' | 'light'; frameColor?: string; cutColor?: string;
  frameProgress?: number; cutProgress?: number; style?: React.CSSProperties;
}> = ({ size = 96, tone = 'dark', frameColor, cutColor, frameProgress = 1, cutProgress = 1, style }) => {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const fp = Math.max(0, Math.min(1, frameProgress));
  const cp = Math.max(0, Math.min(1, cutProgress));
  // A company's own mark: its logo image, revealed left to right like the studio's glyph.
  if (BRAND.logo) {
    return <Img src={BRAND.logo} style={{ display: 'block', width: size, height: size, objectFit: 'contain', clipPath: fp < 1 ? `inset(0 ${(1 - fp) * 100}% 0 0)` : undefined, ...style }} />;
  }
  // A company without a logo image: its initial on a tile in its accent colour (never the studio's glyph).
  if (BRAND.name !== DEFAULT_BRAND.name) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible', opacity: fp, ...style }}>
        <rect x={0} y={0} width={24} height={24} rx={5.5} fill={tone === 'dark' ? BRAND.paper : BRAND.accent} />
        <text x={12} y={17} textAnchor="middle" fontSize={15} fontWeight={800} fontFamily={BRAND.font} fill={frameColor ?? (tone === 'dark' ? BRAND.accent : BRAND.paper)}>
          {BRAND.name.trim().charAt(0).toUpperCase()}
        </text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible', ...style }}>
      <defs>
        {/* gradient tile: host favicon gradient */}
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        {/* whole mark reveals left to right with frameProgress */}
        <clipPath id={`f${id}`}><rect x={0} y={0} width={24 * fp} height={24} /></clipPath>
        {/* lower layers wipe in left to right with cutProgress */}
        <clipPath id={`c${id}`}><rect x={0} y={0} width={24 * cp} height={24} /></clipPath>
      </defs>
      <g clipPath={fp < 1 ? `url(#f${id})` : undefined}>
        <rect x={0} y={0} width={24} height={24} rx={5.5} fill={tone === 'dark' ? BRAND.paper : `url(#t${id})`} />
        {fp > 0 && (
          <path d={MARK_PATHS.frame} fill="none" stroke={frameColor ?? BRAND.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {cp > 0 && (
          <g clipPath={cp < 1 ? `url(#c${id})` : undefined}>
            <path d={MARK_PATHS.cut} fill="none" stroke={cutColor ?? BRAND.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </g>
    </svg>
  );
};

// Wordmark: mark + "SmartVideo GO" in a row (mark height = 2.1x the font size, 700 weight,
// +0.03em tracking). size = font size (px); pass mark={false} for text only.
export const MotionStudioWordmark: React.FC<{
  size?: number; tone?: 'dark' | 'light'; color?: string; mark?: boolean;
  markScale?: number; gap?: number; weight?: number; fontFamily?: string; style?: React.CSSProperties;
}> = ({ size = 48, tone = 'dark', color, mark = true, markScale = 2.1, gap, weight, fontFamily, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: gap ?? size * 0.5, ...style }}>
    {mark && <MotionStudioMark size={size * markScale} tone={tone} />}
    <span style={{
      fontFamily: fontFamily ?? BRAND.font,
      fontSize: size, fontWeight: weight ?? 700, lineHeight: 1, letterSpacing: '0.03em', whiteSpace: 'nowrap',
      color: color ?? (tone === 'dark' ? BRAND.paper : BRAND.ink),
    }}>{BRAND.name}</span>
  </div>
);

// Pitch copy library — pick from here (or rewrite in this voice) for slogans / titles / subtitles /
// quotes. Do not invent numbers that can go stale (demo counts, star counts, user counts).
const DEFAULT_PITCH = {
  en: {
    motto: 'Direct the film. Let the studio shoot it.', // brand line
    taglines: [
      'One prompt to a finished promo.',
      'Cinematic product videos from Motion Studio.',
      'Every shot, tuned in one place.',
      'Shot recipe cards for cinematic product films.',
      'Storyboard. Animate. Sound-design. Deliver.',
      'Your product, in motion.',
      'From screenshot to showreel.',
      'Premium motion, straight out of the studio.',
    ],
    features: [
      'Motion recipe cards', 'Real page captures', '2.5D camera moves', 'Beat-synced cuts',
      'Film-grade SFX', 'Remotion render', 'MP4 export', 'Part of SmartVideo GO',
    ],
    praise: [
      'Feels like a launch film from a real studio.',
      'The first motion studio that actually understands pacing.',
      'Our promo shipped the same afternoon.',
      'Camera moves I would have keyframed for a week.',
      'Motion design without the motion designer bill.',
    ],
    works: 'Part of SmartVideo GO · AI motion studio',
  },
  zh: {
    motto: '导演这部片，交给工作台去拍。', // brand line
    taglines: [
      '一句话，出一支片。',
      'Motion Studio 出电影感产品片。',
      '每一个镜头，都调到了位。',
      '镜头配方卡，宣传片一键直出。',
      '分镜、动效、音效、交付，一条龙。',
      '把截图，拍成大片。',
    ],
    features: ['镜头配方卡', '真实页面实拍', '2.5D 运镜', '踩点剪辑', '电影级音效', 'Remotion 渲染', 'MP4 导出', 'SmartVideo GO 出品'],
    praise: [
      '像专业工作室做的发布片。',
      '第一个真正懂节奏的动效工作台。',
      '下午提需求，晚上片子就上线了。',
      '这些运镜，我自己 K 帧要一周。',
    ],
    works: 'SmartVideo GO · AI 动效工作台',
  },
} as const;

type PitchCopy = { motto: string; taglines: string[]; features: string[]; praise: string[]; works: string };
const copyPitch = (p: { readonly motto: string; readonly taglines: readonly string[]; readonly features: readonly string[]; readonly praise: readonly string[]; readonly works: string }): PitchCopy => ({
  motto: p.motto, taglines: [...p.taglines], features: [...p.features], praise: [...p.praise], works: p.works,
});

/** Pitch copy the demos draw; `setBrand` swaps in a company's own lines. */
export const PITCH: { en: PitchCopy; zh: PitchCopy } = { en: copyPitch(DEFAULT_PITCH.en), zh: copyPitch(DEFAULT_PITCH.zh) };

/** What a company film says about itself (all optional: what is missing keeps the studio's default). */
export interface BrandInput extends Partial<Omit<BrandTokens, 'amber' | 'short'>> {
  short?: string;
  motto?: string;
  taglines?: string[];
  features?: string[];
}

/** Make the demos speak for a company (or, with null, for SmartVideo GO again). Call at the start of a render. */
export function setBrand(input: BrandInput | null | undefined): void {
  const b = input ?? {};
  // Every recipe that draws in a Look speaks in the company's colours too.
  skinLooks(b.name ? { accent: b.accent, accent2: b.accent2, ink: b.ink, paper: b.paper } : null);
  const pick = <K extends keyof BrandTokens>(k: K): BrandTokens[K] => (b[k as keyof BrandInput] as BrandTokens[K] | undefined) ?? DEFAULT_BRAND[k];
  Object.assign(BRAND, DEFAULT_BRAND, {
    name: pick('name'),
    short: b.short ?? b.name ?? DEFAULT_BRAND.short,
    accent: pick('accent'),
    accent2: pick('accent2'),
    amber: pick('accent'),
    ink: pick('ink'),
    paper: pick('paper'),
    slate: pick('slate'),
    font: pick('font'),
    logo: b.logo ?? null,
    repo: b.repo ?? (b.name ? '' : DEFAULT_BRAND.repo),
  });
  const en = copyPitch(DEFAULT_PITCH.en);
  if (b.name) {
    // A company: its own lines, never the studio's.
    en.motto = b.motto ?? b.taglines?.[0] ?? b.name;
    // As many lines as the recipes were designed with (they read taglines[0..7], features[0..]): the
    // company's own lines repeat rather than leave an index empty.
    const fill = (own: string[], n: number) => Array.from({ length: Math.max(n, own.length) }, (_, i) => own[i % own.length]);
    en.taglines = fill(b.taglines?.length ? [...b.taglines] : [b.motto ?? b.name], DEFAULT_PITCH.en.taglines.length);
    en.features = fill(b.features?.length ? [...b.features] : [b.name], DEFAULT_PITCH.en.features.length);
    en.praise = [];
    en.works = b.repo ?? b.name;
  }
  PITCH.en = en;
  PITCH.zh = b.name ? en : copyPitch(DEFAULT_PITCH.zh);
}
