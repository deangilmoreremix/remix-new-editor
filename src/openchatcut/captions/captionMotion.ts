// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (apps/video-agent-studio), vendored.
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { TEXT_MOTION_PRESETS, isTextMotionPreset, splitUnits, unitStyle } from '../../cinegen/lib/editor/stage2/text-motion';
import type { CaptionMotionPreset, CaptionPage } from './types';

export const CAPTION_MOTION_OPTIONS = [
  { id: 'none', label: '无动效' },
  { id: 'fade-up', label: '淡入上浮' },
  { id: 'pop', label: '弹性入场' },
  { id: 'word-pop', label: '逐词弹出' },
  { id: 'karaoke-pulse', label: '卡拉 OK 脉冲' },
  { id: 'char-rise', label: '逐字上浮' },
  { id: 'char-pop', label: '逐字弹出' },
  { id: 'char-wave', label: '逐字波浪' },
  { id: 'word-rise', label: '逐词上浮' },
] as const satisfies ReadonlyArray<{ id: CaptionMotionPreset; label: string }>;

const PRESETS = new Set<CaptionMotionPreset>(CAPTION_MOTION_OPTIONS.map((option) => option.id));
const EMPTY_STYLE: CSSProperties = Object.freeze({});
const PAGE_ENTER_MS = 180;
const PAGE_EXIT_MS = 120;
const WORD_ENTER_MS = 140;

export function isCaptionMotionPreset(value: unknown): value is CaptionMotionPreset {
  return typeof value === 'string' && PRESETS.has(value as CaptionMotionPreset);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - (1 - clamped) ** 3;
}

function easeOutBack(value: number): number {
  const clamped = clamp01(value);
  const overshoot = 1.70158;
  return 1 + (overshoot + 1) * (clamped - 1) ** 3 + overshoot * (clamped - 1) ** 2;
}

function pageOpacity(page: CaptionPage, timelineMs: number): number {
  const enter = easeOutCubic((timelineMs - page.start) / PAGE_ENTER_MS);
  const exit = clamp01((page.end - timelineMs) / PAGE_EXIT_MS);
  return Math.min(enter, exit);
}

/** Page-level motion. Nest this below the placement container so layout transforms remain intact. */
export function captionPageMotionStyle(
  preset: CaptionMotionPreset | undefined,
  page: CaptionPage,
  timelineMs: number,
): CSSProperties {
  if (!preset || preset === 'none' || preset === 'word-pop' || preset === 'karaoke-pulse' || isTextMotionPreset(preset)) {
    return EMPTY_STYLE;
  }
  const enter = easeOutCubic((timelineMs - page.start) / PAGE_ENTER_MS);
  const opacity = pageOpacity(page, timelineMs);
  if (preset === 'fade-up') {
    return { opacity, transform: `translateY(${Number(((1 - enter) * 18).toFixed(3))}px)` };
  }
  const scale = easeOutBack((timelineMs - page.start) / PAGE_ENTER_MS);
  return { opacity, transform: `scale(${Number((0.78 + scale * 0.22).toFixed(4))})`, transformOrigin: 'center' };
}

/** Per-word motion derived only from absolute edited-timeline milliseconds. */
export function captionWordMotionStyle(
  preset: CaptionMotionPreset | undefined,
  word: Pick<CaptionPage['words'][number], 'start' | 'end'>,
  timelineMs: number,
): CSSProperties {
  if (!preset || preset === 'none' || preset === 'fade-up' || preset === 'pop') return EMPTY_STYLE;
  if (preset === 'word-rise') {
    const s = unitStyle(TEXT_MOTION_PRESETS['word-rise'], 0, 1, timelineMs - word.start);
    return { display: 'inline-block', opacity: s.opacity, ...(s.transform ? { transform: s.transform } : {}) };
  }
  if (isTextMotionPreset(preset)) return EMPTY_STYLE; // per-character presets animate inside the word (captionWordContent)
  if (preset === 'word-pop') {
    const enter = easeOutBack((timelineMs - word.start) / WORD_ENTER_MS);
    const visible = timelineMs >= word.start;
    return {
      display: 'inline-block',
      opacity: visible ? 1 : 0,
      transform: `scale(${Number((0.72 + enter * 0.28).toFixed(4))})`,
      transformOrigin: 'center bottom',
    };
  }
  if (timelineMs < word.start || timelineMs > word.end) return EMPTY_STYLE;
  const duration = Math.max(1, word.end - word.start);
  const progress = clamp01((timelineMs - word.start) / duration);
  const scale = 1 + Math.sin(progress * Math.PI) * 0.08;
  return {
    display: 'inline-block',
    transform: `scale(${Number(scale.toFixed(4))})`,
    transformOrigin: 'center bottom',
  };
}

/** [remix] Stage 2: the text of one caption word. Per-character presets split it into spans, each styled from the elapsed time since the word started. */
export function captionWordContent(
  preset: CaptionMotionPreset | undefined,
  word: Pick<CaptionPage['words'][number], 'start' | 'end'>,
  text: string,
  timelineMs: number,
): ReactNode {
  if (!preset || !isTextMotionPreset(preset) || TEXT_MOTION_PRESETS[preset].unit !== 'char') return text;
  const spec = TEXT_MOTION_PRESETS[preset];
  const units = splitUnits(text, 'char');
  return units.map((ch, i) => (/\s/u.test(ch)
    ? ch
    : createElement('span', { key: i, style: { display: 'inline-block', whiteSpace: 'pre', transformOrigin: 'center bottom', ...unitStyle(spec, i, units.length, timelineMs - word.start) } }, ch)));
}
