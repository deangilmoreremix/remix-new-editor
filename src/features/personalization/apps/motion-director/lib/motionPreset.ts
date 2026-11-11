/**
 * The film's motion personality (upstream pipeline stage 1, "brand → motion parameters"): the brand sits on
 * two axes, energy (calm ↔ energetic) and tone (serious ↔ playful), and the nearest of six presets sets how
 * the film moves. A film has one motion voice; mixing two reads as a patchwork. The recipes keep their own
 * tuned easing, so the preset decides what can be chosen around them: how long scenes may hold and which
 * seam transitions are in character (a bank does not glitch; a game studio does not dip politely).
 */
import type { SceneTransition } from './directorPlan';

export type MotionPresetId = 'trust' | 'premium' | 'bold' | 'playful' | 'calm' | 'friendly';

export interface MotionPreset {
  id: MotionPresetId;
  label: string;
  /** Upstream's table, kept for the design spec: main duration at 30 fps, entrance easing, overshoot, squash. */
  mainFrames: number;
  easing: string;
  overshoot: number;
  squash: number;
  /** Seam transitions that suit the voice (a plain cut is always allowed). */
  seams: readonly SceneTransition[];
  /** How much longer than its native length a recipe may hold when the film has room (1 = as tuned). */
  holdGrowth: number;
}

export const MOTION_PRESETS: Record<MotionPresetId, MotionPreset> = {
  trust: { id: 'trust', label: 'Steady and trustworthy', mainFrames: 21, easing: 'bezier(0,0,0.2,1)', overshoot: 1, squash: 0, seams: ['dip', 'wipe', 'iris', 'line', 'push', 'window'], holdGrowth: 1.2 },
  premium: { id: 'premium', label: 'Refined and unhurried', mainFrames: 48, easing: 'bezier(0.4,0,0.6,1)', overshoot: 1.02, squash: 0, seams: ['dip', 'iris', 'leak', 'ink', 'window'], holdGrowth: 1.3 },
  bold: { id: 'bold', label: 'Bold and fast', mainFrames: 18, easing: 'bezier(0.16,1,0.3,1)', overshoot: 1.12, squash: 0.25, seams: ['wipe', 'whip', 'flash', 'glitch', 'barn', 'line', 'push', 'window'], holdGrowth: 1.1 },
  playful: { id: 'playful', label: 'Playful and bouncy', mainFrames: 27, easing: 'bezier(0.34,1.56,0.64,1)', overshoot: 1.08, squash: 0.18, seams: ['whip', 'ink', 'portal', 'wipe', 'barn', 'window', 'push'], holdGrowth: 1.15 },
  calm: { id: 'calm', label: 'Calm and caring', mainFrames: 42, easing: 'ease-in-out', overshoot: 1, squash: 0.04, seams: ['dip', 'ink', 'iris', 'portal', 'window', 'push'], holdGrowth: 1.3 },
  friendly: { id: 'friendly', label: 'Warm and friendly', mainFrames: 26, easing: 'bezier(0.25,0.46,0.45,0.94)', overshoot: 1.04, squash: 0.08, seams: ['wipe', 'dip', 'ink', 'barn', 'portal', 'window', 'push'], holdGrowth: 1.2 },
};

const HIGH = /\b(startup|fast|instant|ship|launch|growth|viral|ai|automat\w*|game|gaming|sport\w*|esports?|creator|stream\w*|crypto|play)\b/i;
const LOW = /\b(secure|security|trusted?|enterprise|compliance|regulat\w*|care|health\w*|clinic\w*|medical|learn\w*|school|education|wellness|luxury|premium|craft\w*|heritage|bespoke|boutique|legal|insurance|bank\w*|financ\w*|invest\w*|it support|managed)\b/i;
const SERIOUS = /\b(secure|security|enterprise|compliance|regulat\w*|bank\w*|financ\w*|invest\w*|insurance|legal|managed|it support|cyber\w*|risk|audit|b2b)\b/i;
const PLAYFUL = /\b(fun|kids?|play\w*|game|gaming|social|creator|community|friends?|party|music|memes?|viral)\b/i;
const LUXE = /\b(luxury|premium|boutique|bespoke|couture|fashion|heritage|jewel\w*|fine)\b/i;
const CARE = /\b(health\w*|wellness|clinic\w*|therapy|learn\w*|school|education|care|medical)\b/i;
const LOCAL = /\b(local|neighbou?rhood|family-owned|community|small business|restaurant|bakery|salon|shop)\b/i;

/** Saturation and lightness (0–1) of a #rrggbb colour, or null. */
const hsl = (hex: string | null | undefined): { s: number; l: number } | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  return { s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
};

/**
 * Pick the preset from what the site says about itself and its accent colour. Words decide first (a
 * "managed IT" company is serious whatever its colours); a vivid accent leans energetic when the words are
 * silent. With no evidence at all the film gets the warm, middle-of-the-road voice.
 */
export function pickMotionPreset(input: { text?: string; accent?: string | null }): MotionPreset {
  const text = input.text ?? '';
  const count = (re: RegExp) => (text.match(new RegExp(re.source, 'gi')) ?? []).length;
  const c = hsl(input.accent);
  let energy = count(HIGH) - count(LOW);
  if (c && c.s > 0.75 && c.l > 0.4 && c.l < 0.65) energy += 0.5;
  const serious = count(SERIOUS) > 0;
  const playful = count(PLAYFUL) > 0;
  if (count(LUXE) > 0 && energy <= 0) return MOTION_PRESETS.premium;
  if (count(CARE) > 0 && !serious && energy <= 0) return MOTION_PRESETS.calm;
  if (serious) return MOTION_PRESETS.trust;
  if (energy > 0 && playful) return MOTION_PRESETS.playful;
  if (energy > 0) return MOTION_PRESETS.bold;
  if (playful) return MOTION_PRESETS.playful;
  if (count(LOCAL) > 0) return MOTION_PRESETS.friendly;
  return energy < 0 ? MOTION_PRESETS.trust : MOTION_PRESETS.friendly;
}

/** The words the preset is read from: the site's title, headline, description, headings and menu. */
export const presetText = (c: { title?: string; content?: { headline?: string; description?: string; headings?: string[]; nav?: string[] } | null } | null | undefined): string =>
  [c?.title, c?.content?.headline, c?.content?.description, ...(c?.content?.headings ?? []), ...(c?.content?.nav ?? [])].filter(Boolean).join(' . ');
