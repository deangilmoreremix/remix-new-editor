/**
 * Approved director plan → editable Motion Studio project.
 *
 * Builds the same structure as the Ink Press template / demo project: a Shots
 * track (recipe shots and title cards back to back), a Captions track, a
 * Transitions track (flash cuts on the scene changes the plan asked for), the
 * paper background, an SFX track (a whoosh on each cut, an impact on flash
 * cuts), and an optional music track. Every clip is an ordinary
 * card with props, so the whole film stays editable in the Workbench.
 */
import { CARDS } from '../cards/registry';
import { SFX_PEAKS } from '../demosrc/_generated/sfxPeaks';
import { CARD_FPS, type CardDef } from '../cards/types';
import type { AspectRatio } from '../projectContract';
import { t } from '../i18n';
import type { BrandInput } from '../demosrc/_fixtures/Brand';
import { uid, type ClipData, type ProjectData } from '../types';
import { motionCardId, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import { isProductTextureShot } from './productShots';
import { BRAND_SCENES, isBrandScene, type DirectorPlan, type SceneTransition } from './directorPlan';
import { seamFrames, type SeamKind } from './seams';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';
import { luma } from './palette';

export interface FilmCapture {
  /** Captured page URLs (1920 CSS px wide, 2x). */
  screens: string[];
  /** Captured element crops (cards). */
  crops: string[];
  /** The site's name, shown on the inset pictures. */
  title?: string;
  /** The site's own pictures from the asset finder, best first; they also lead `crops`. */
  assets?: Array<{ url: string; category: string; alt: string }>;
  /** Where the page's sections start (CSS px from the top of `screens[0]`) and its height; the insets show them one by one. */
  sections?: number[];
  pageH?: number;
  /** Section headings, best effort in page order, used as the inset labels. */
  sectionNames?: string[];
  /** The site's menu entries and calls to action: the nodes of the hub and the closing line. */
  nav?: string[];
  ctas?: string[];
  /** The site's address as typed (host and path). */
  address?: string;
  /** The pictures chosen for each scene (lib/assignPictures), by scene index; when present they replace the rotation. */
  scenes?: Array<{ screens: string[]; crops: string[] } | undefined>;
}

/** A video the user attached; it plays as its own scene before the closing card. */
export interface FilmVideo {
  url: string;
  name: string;
  /** Probed length in seconds, when known. */
  durationSec?: number;
}

export interface FilmMusic {
  url: string;
  name: string;
  /** Beat times (seconds) used to snap scene changes; empty = no snapping. */
  beats?: number[];
  /** First beat of each bar and the kick hits: a cut prefers these to a plain beat (the drum map from lib/beatSync). */
  downbeats?: number[];
  kicks?: number[];
}

const FPS = 30;
const SEAM_LABEL: Record<SeamKind, string> = { flash: 'Push-in flash', whip: 'Whip-pan', window: 'Through the window', wipe: 'Wipe', barn: 'Barn door', push: 'Bottom push', iris: 'Iris', ink: 'Ink bleed', portal: 'Portal', line: 'Line carry', dip: 'Dip', leak: 'Light leak', glitch: 'Glitch' };
/** Sound effects served from public/ (the ShotCraft SFX library: real-object and film-vocabulary sounds only, sound-design S1). */
/**
 * The sound of a scene change, by the seam's style (sound-design 4.2, anti-machine-gun): each style has two
 * similar but different samples that alternate, so the film never repeats one whoosh at every cut. None is
 * one of the library's byte-identical pairs (sound-design 3: swoosh-quick = sweep-fast-small, …).
 */
const SEAM_SOUNDS: Record<string, readonly [string, string]> = {
  cut: ['transition/swoosh-quick', 'transition/air-woosh-quick'],
  whip: ['transition/whoosh-fast', 'transition/sweep-fast'],
  window: ['camera/zoom-air-fast', 'transition/air-woosh-deep'],
  portal: ['camera/zoom-air-fast', 'transition/air-woosh-deep'],
  iris: ['camera/zoom-air-fast', 'transition/air-woosh-deep'],
  wipe: ['transition/sweep-short', 'transition/wind-swoosh-short'],
  barn: ['transition/sweep-short', 'transition/wind-swoosh-short'],
  line: ['transition/sweep-short', 'transition/wind-swoosh-short'],
  ink: ['transition/sweep-short', 'transition/wind-swoosh-short'],
  push: ['transition/transition-tech-slide', 'transition/warp-slide'],
  dip: ['transition/swoosh-slow', 'light/light-transition-magic'],
  leak: ['light/light-transition-magic', 'transition/swoosh-slow'],
  flash: ['impact/impact-transition', 'impact/impact-zoom-quick'],
  glitch: ['impact/impact-zoom-quick', 'impact/impact-transition'],
};
const sfxFile = (name: string) => `motion-studio/sfxlib/${name}.mp3`;
/**
 * The output's audio runs late by a fixed amount (the encoder's priming), so a sound pinned at its
 * target frame is heard late. Measured on this pipeline (Remotion web renderer 4.0.499, AAC 48 kHz,
 * mp4): a click pinned at 1.000 s and at 2.500 s came out 46.4 ms late on both = 1.39 frames at 30 fps
 * (upstream's AAC priming figure is 1.28). Recorded per pipeline: re-measure when any of the four changes.
 */
export const OUTPUT_AUDIO_OFFSET_F = 1.4;
const peakLagF = (name: string): number => ((SFX_PEAKS[name]?.peakMs ?? 0) / 1000) * FPS;
/**
 * A sound pinned by its PEAK: `peakFrame` is the frame the hit belongs to; the clip starts early by the file's
 * own peak lag and the output offset (sound-design 4.6). A hit that would have to start before frame 0 is
 * trimmed at its head instead. `tailMs` is how much after the peak is heard (long samples are cut, never played whole).
 */
/**
 * Volume is a multiplier of the file's own level, so a quietly recorded file (peak below −12 dB: 26 of the
 * library's 141) pinned at the usual 0.2–0.6 vanishes under the music. Those get a gain that brings their peak
 * to about −8 dB (capped at 5×; a file below −45 dB is practically silent and gets only the cap). The web
 * renderer plays gains above 1 for real (the preview clamps at 1); the mixed result was checked on an export.
 */
export const sfxGain = (name: string): number => {
  const db = SFX_PEAKS[name]?.peakDb;
  if (typeof db !== 'number' || db >= -12) return 1;
  return Math.min(5, Math.round(10 ** ((-8 - db) / 20) * 100) / 100);
};

const pinSfx = (name: string, peakFrame: number, o: { tailMs?: number; volume?: number; label?: string } = {}): ClipData => {
  const lag = peakLagF(name);
  const raw = peakFrame - lag - OUTPUT_AUDIO_OFFSET_F;
  const start = Math.max(0, Math.round(raw));
  const trim = raw < 0 ? Math.round(-raw) : 0;
  const frames = Math.max(2, Math.ceil(((o.tailMs ?? 700) / 1000) * FPS + (lag - trim)));
  const whole = Math.ceil(((SFX_PEAKS[name]?.durationMs ?? 60_000) / 1000) * FPS) - trim;
  return clip('audio-clip', start, Math.min(frames, whole), { file: sfxFile(name), volume: Math.round((o.volume ?? 0.6) * sfxGain(name) * 100) / 100 }, { label: o.label, inOffset: trim });
};
/** Frame of the closing scene where the impact lands (see BRAND_SOUNDS). */
const LOGO_IMPACT_F = 12;
/**
 * The ending's build (sound-design 4.3: riser → impact → sparkle): our own synthesised riser
 * (scripts/gen-riser.py, public/motion-studio/sfxlib/riser), pinned by its peak, which is the last
 * moment of the file, to the frame just before the impact lands.
 */
const riserBuild = (impactFrame: number): ClipData => pinSfx('riser/riser-rise-build', impactFrame - 1, { tailMs: 60, volume: 0.6, label: 'Build' });
/** Sound cues of each brand scene: [file, peak frame after the scene starts, tail after the peak (ms), volume, label]. Typing is a run of single key hits. */
type Cue = readonly [string, number, number, number, string];
const BRAND_SOUNDS: Record<string, ReadonlyArray<Cue>> = {
  'brand/url-scan': [['data/data-scan', 56, 900, 0.5, 'Scan']],
  'brand/hub': [['light/light-sweep-magic', 14, 900, 0.45, 'Sweep']],
  'brand/feature-zoom': [['camera/zoom-air-fast', 14, 700, 0.45, 'Push-in']],
  // Closing phrase (sound-design 4.3): a build, the hit on the logo, then the shimmer.
  'brand/logo-reveal': [['impact/impact-deep-whoosh', 12, 1400, 0.7, 'Impact'], ['light/stardust-swish', 38, 1200, 0.5, 'Sparkle']],
};
/** Key hits under a typed address: two different samples alternate and the level steps down (sound-design 4.2). */
const typingCues = (chars: number): Cue[] =>
  Array.from({ length: Math.min(14, Math.max(0, chars)) }, (_, i) => [i % 2 ? 'text/typewriter-hit-hard' : 'text/typewriter-hit-soft', 6 + i * 3, 220, Math.max(0.2, 0.45 - i * 0.015), 'Key'] as const);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Screen time an attached video gets as its own scene: its length, kept between 2 and 8 seconds. */
export const videoSceneSec = (v: { durationSec?: number }): number => clamp(v.durationSec ?? 4, 2, 8);

/** Delivery size of a built film: full HD at 30 fps, h264 on export. */
export const filmDimensions = (ratio: AspectRatio): { width: number; height: number } =>
  ratio === '9:16' ? { width: 1080, height: 1920 } : ratio === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };

const clip = (cardId: string, start: number, duration: number, props: Record<string, unknown>, extra: Partial<ClipData> = {}): ClipData => ({
  id: uid('clip'),
  cardId,
  start,
  duration,
  inOffset: 0,
  speed: 1,
  opacity: 1,
  scale: 1,
  x: 0,
  y: 0,
  props,
  ...extra,
});

/**
 * A recipe plays at its own speed: its tuned timings are the quality (upstream SKILL / every card), so a
 * scene shorter than the recipe cuts its tail rather than speeding it up. Only the card's own frame rate
 * is converted.
 */
const fitSpeed = (card: CardDef, _durationFrames: number): number => {
  if (card.timing === 'realtime') return 1;
  return Math.round(((card.sourceFps ?? CARD_FPS) / FPS) * 100) / 100;
};

/**
 * Move each scene boundary to a beat within `window` seconds, keeping scenes ≥ `minSec`. A downbeat or a
 * kick is worth a little extra distance (0.15 s / 0.08 s), so a cut lands on the first beat of the bar or
 * on the drum when one is nearly as close as a plain beat.
 */
export function snapToBeats(durations: number[], beats: number[], window = 0.35, minSec = 1.2, hits: { downbeats?: number[]; kicks?: number[] } = {}): number[] {
  if (!beats.length || durations.length < 2) return durations.slice();
  const bounds: number[] = [];
  let acc = 0;
  for (const d of durations) bounds.push((acc += d));
  const snapped = bounds.map((b, i) => {
    if (i === bounds.length - 1) return b;
    let best = b;
    let bestCost = window;
    const consider = (t: number, bonus: number) => {
      const dist = Math.abs(t - b);
      if (dist <= window && dist - bonus <= bestCost) {
        best = t;
        bestCost = dist - bonus;
      }
    };
    for (const beat of beats) consider(beat, 0);
    for (const k of hits.kicks ?? []) consider(k, 0.08);
    for (const d of hits.downbeats ?? []) consider(d, 0.15);
    return best;
  });
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < snapped.length; i++) {
    const end = i === snapped.length - 1 ? snapped[i] : Math.max(snapped[i], prev + minSec);
    out.push(Math.max(minSec, end - prev));
    prev = prev + out[i];
  }
  return out;
}

/** The logo reveal holds this long: the brand name stays on screen for a beat before the film ends. */
const CLOSING_MIN_SEC = 3;

/**
 * A film of a captured site closes on the site's logo, call to action and address: a closing title
 * card becomes the logo reveal, and a film that ends on a shot gets one (its time taken from the
 * last shot). The reveal always holds at least CLOSING_MIN_SEC, borrowing from the scene before it.
 */
function withClosingScene(plan: DirectorPlan, opts: { brand?: BrandInput | null; capture?: FilmCapture | null }): { scenes: DirectorPlan['scenes']; seconds: number[] } {
  const scenes = plan.scenes.map((sc) => ({ ...sc }));
  const seconds = scenes.map((sc) => sc.durationSec);
  if (!opts.brand || !opts.capture || scenes.length < 2) return { scenes, seconds };
  const last = scenes.length - 1;
  if (scenes[last].recipeId !== 'brand/logo-reveal') {
    if (scenes[last].kind === 'title') {
      scenes[last] = { ...scenes[last], kind: 'shot', recipeId: 'brand/logo-reveal' };
    } else {
      scenes.push({ kind: 'shot', recipeId: 'brand/logo-reveal', durationSec: CLOSING_MIN_SEC, headline: opts.capture.ctas?.[0] ?? '', caption: '', transition: 'cut' });
      seconds.push(0);
    }
  }
  const end = scenes.length - 1;
  const need = CLOSING_MIN_SEC - seconds[end];
  if (need > 0) {
    const give = Math.min(need, Math.max(0, seconds[end - 1] - 1.5));
    seconds[end - 1] -= give;
    seconds[end] += give;
    // Whatever the previous scene could not give is added: a closing scene is never cut short.
    seconds[end] += need - give;
  }
  return { scenes, seconds };
}

const rotated = <T,>(list: T[], by: number): T[] => (list.length > 1 ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list);

export function planToProject(
  plan: DirectorPlan,
  opts: {
    aspectRatio: AspectRatio;
    capture?: FilmCapture | null;
    music?: FilmMusic | null;
    /** Brand Kit logo, stamped on the title / call-to-action cards. */
    logo?: string | null;
    videos?: FilmVideo[];
    /** The company the film is for: the recipe demos speak with its name, colours, font, logo and words instead of SmartVideo GO. */
    brand?: BrandInput | null;
    /** Scene index -> (template words -> the words to draw), from the director or the site's own words. */
    texts?: Record<number, Record<string, string>>;
    /** The film's theme (lib/palette): a preset, or the site's own colours ("Your site"). */
    theme?: { id: string; colors?: Record<string, string> | null } | null;
  },
): ProjectData {
  const { width, height } = filmDimensions(opts.aspectRatio);
  // Caption text is read on a phone: at least 5.2 % of the frame height (aesthetic-rules Q11).
  const captionPx = Math.round(Math.min(height, width * 0.9) * 0.052);
  const palette = plan.palette;
  const { scenes, seconds } = withClosingScene(plan, opts);
  const durations = snapToBeats(seconds, opts.music?.beats ?? [], 0.35, 1.2, { downbeats: opts.music?.downbeats, kicks: opts.music?.kicks });
  const screens = opts.capture?.screens ?? [];
  const crops = opts.capture?.crops ?? [];
  /** CSS px of a 1920-wide page that a 16:10 inset shows. */
const INSET_PAGE_H = 1200;
/** Pictures of the user's site for the shots that cannot draw captured pages themselves. */
  const insetPool = [...crops, ...screens];

  const shots: ClipData[] = [];
  const insets: ClipData[] = [];
  const captions: ClipData[] = [];
  const flashes: ClipData[] = [];
  const sfx: ClipData[] = [];
  let at = 0;
  let featureZooms = 0;
  const videos = opts.videos ?? [];
  const lastIndex = scenes.length - 1;
  /**
   * A scene change: whoosh on every cut, an impact on flash cuts. The seam itself is built after every shot
   * is placed (`connectSeams`): both real shots play through it, so here only where and how is recorded.
   */
  const seams: Array<{ at: number; kind: SceneTransition; n: number }> = [];
  const soundTurn: Record<string, number> = {};
  const cut = (kind: SceneTransition, wipeIndex: number) => {
    const hit = kind === 'flash' || kind === 'glitch';
    if (kind !== 'cut') seams.push({ at, kind, n: wipeIndex });
    const pair = SEAM_SOUNDS[kind] ?? SEAM_SOUNDS.cut;
    const turn = (soundTurn[kind] = (soundTurn[kind] ?? -1) + 1);
    sfx.push(pinSfx(pair[turn % 2], at, { tailMs: hit ? 900 : 500, volume: 0.6, label: hit ? 'Impact' : 'Whoosh' }));
  };
  let wipes = 0;

  scenes.forEach((scene, i) => {
    // Attached videos play just before the closing scene (or at the end of a one-scene film).
    if (i === lastIndex && lastIndex > 0) {
      for (const v of videos) {
        const frames = Math.round(videoSceneSec(v) * FPS);
        shots.push(clip('video-clip', at, frames, { file: v.url, fit: 'cover', muted: Boolean(opts.music?.url) }, { label: v.name.slice(0, 32) }));
        at += frames;
        cut('cut', 0);
      }
    }
    const frames = Math.max(2, Math.round(durations[i] * FPS));
    if (scene.kind === 'title') {
      sfx.push(pinSfx('text/typewriter-hit-soft', at + 8, { tailMs: 250, volume: 0.4, label: 'Stamp' }));
      shots.push(
        clip('inkpress-title-card', at, frames, {
          text: scene.headline,
          sub: scene.caption,
          bg: palette.background,
          ink: palette.text,
          accent: palette.accent,
          ...(opts.logo ? { logo: opts.logo } : {}),
        }, { label: scene.headline.replace(/\*/g, '').slice(0, 24) }),
      );
    } else if (isBrandScene(scene.recipeId)) {
      const page = screens[0] ?? crops[0] ?? '';
      const look = { bg: palette.background, ink: palette.text, accent: palette.accent, ...(opts.brand?.font ? { font: opts.brand.font } : {}) };
      const title = scene.headline.replace(/\*/g, '');
      // Accessibility links ("Skip to content") are not features of the product.
      const names = [...(opts.capture?.nav ?? []), ...(opts.capture?.sectionNames ?? [])].filter((v, n, all) => v && all.indexOf(v) === n && !/^\s*skip (?:to|navigation)\b/i.test(v));
      let props: Record<string, unknown> = look;
      if (scene.recipeId === 'brand/url-scan') {
        props = { ...look, file: page, url: opts.capture?.address ?? opts.brand?.repo ?? '', labels: (opts.capture?.sectionNames ?? []).slice(0, 5).join('\n') || 'BRANDING\nPEOPLE\nPRODUCTS\nOFFERS\nSERVICES' };
      } else if (scene.recipeId === 'brand/hub') {
        props = { ...look, file: page, title, labels: names.slice(0, 10).join('\n') };
      } else if (scene.recipeId === 'brand/feature-zoom') {
        const k = featureZooms++;
        const ys = opts.capture?.sections ?? [];
        const pageH = opts.capture?.pageH ?? 0;
        const bySection = Boolean(screens[0] && pageH > INSET_PAGE_H && ys.length >= 2);
        const focusY = bySection ? Math.round(Math.min(1, Math.max(0, (ys[k % ys.length] - 60) / (pageH - INSET_PAGE_H))) * 100) : 0;
        const own = opts.capture?.scenes?.[i];
        // The page of this scene's feature when one was matched; else a section of the home page.
        props = own?.screens[0] && own.screens[0] !== screens[0] ? { ...look, file: own.screens[0], focusY: 0, label: '', text: title } : { ...look, file: bySection ? screens[0] : (insetPool[k % Math.max(1, insetPool.length)] ?? page), focusY, label: (bySection ? opts.capture?.sectionNames?.[k % ys.length] : '') || '', text: title };
      } else if (scene.recipeId === 'brand/people-gallery') {
        const assets = opts.capture?.assets ?? [];
        const chosen = opts.capture?.scenes?.[i]?.crops ?? [];
        // The people and photos chosen for this scene; without a catalogue, the finder's pictures then the crops.
        const pics = (chosen.length ? chosen : [...assets.map((a) => a.url), ...crops, ...screens.slice(1)]).filter((v, n, all) => v && all.indexOf(v) === n).slice(0, 6);
        // Each picture the asset finder labelled keeps its own caption (what it shows); the rest take the site's section names in order.
        const label = (a: { category: string; alt: string }) => (a.alt || a.category.replace(/_/g, ' ')).replace(/^\w/, (c) => c.toUpperCase());
        const notes = [...assets.map(label), ...(opts.capture?.sectionNames ?? [])];
        props = { ...look, images: (pics.length ? pics : [page]).join('\n'), captions: notes.slice(0, 6).join('\n'), text: title };
      } else {
        props = { ...look, logo: opts.brand?.logo ?? opts.logo ?? '', name: opts.brand?.name ?? opts.capture?.title ?? '', cta: title, url: opts.capture?.address ?? opts.brand?.repo ?? '' };
      }
      const url = String(props.url ?? '');
      const cues = [...(scene.recipeId === 'brand/url-scan' ? typingCues(url.length) : []), ...(BRAND_SOUNDS[scene.recipeId] ?? [])];
      for (const [file, peak, tail, volume, label] of cues) {
        if (peak < frames) sfx.push(pinSfx(file, at + peak, { tailMs: Math.min(tail, ((frames - peak) / FPS) * 1000 + 200), volume, label }));
      }
      if (scene.recipeId === 'brand/logo-reveal') sfx.push(riserBuild(at + LOGO_IMPACT_F));
      shots.push(clip(BRAND_SCENES[scene.recipeId].cardId, at, frames, props, { label: BRAND_SCENES[scene.recipeId].title }));
    } else {
      const template = resolveMotionTemplate(scene.recipeId);
      const cardId = template ? motionCardId(template) : '';
      const card = CARDS[cardId];
      if (!template || !card) return;
      const usesCapture = isProductTextureShot(template.componentName) && (screens.length > 0 || crops.length > 0);
      shots.push(
        // Shots carry their own typography; the headline goes in the caption
        // strip rather than over the shot.
        clip(cardId, at, frames, {
          accent: palette.accent,
          // Each repeat of a recipe starts further along the site's pictures, so scenes do not show the same crops.
          // Shots that draw their own sample UI carry the scene's pictures too, for the shot adapter (lib/adaptLoop).
          ...(!usesCapture && opts.capture?.scenes?.[i]?.crops.length ? { scenePictures: { screens: opts.capture.scenes[i]!.screens.slice(0, 3), crops: opts.capture.scenes[i]!.crops } } : {}),
          ...(usesCapture
            ? opts.capture?.scenes?.[i]?.crops.length
              ? { screens: opts.capture.scenes[i]!.screens, crops: opts.capture.scenes[i]!.crops }
              : { screens: rotated(screens, i), crops: rotated(crops, i * 3) }
            : {}),
          ...(opts.texts?.[i] && Object.keys(opts.texts[i]).length ? { texts: opts.texts[i] } : {}),
        }, { speed: fitSpeed(card, frames) }),
      );
      // A shot that draws its own sample UI still shows the user's site: a framed picture in a corner.
      if (!usesCapture && insetPool.length) {
        const k = insets.length;
        // One section of the page per scene when the page is tall enough to have them: hero, features, pricing…
        const ys = opts.capture?.sections ?? [];
        const pageH = opts.capture?.pageH ?? 0;
        const bySection = Boolean(screens[0] && pageH > INSET_PAGE_H && ys.length >= 2);
        const focusY = bySection ? Math.round(Math.min(1, Math.max(0, (ys[k % ys.length] - 60) / (pageH - INSET_PAGE_H))) * 100) : 0;
        const label = (bySection ? opts.capture?.sectionNames?.[k % ys.length] : '') || opts.capture?.title || '';
        insets.push(
          clip('site-inset', at, frames, { file: opts.capture?.scenes?.[i]?.crops[0] ?? (bySection ? screens[0] : insetPool[k % insetPool.length]), side: k % 2 === 0 ? 'right' : 'left', accent: palette.accent, label: label.slice(0, 40), focusY }, { label: 'Site' }),
        );
      }
      // `*word*` marks emphasis on the title card only; everywhere else the markers are dropped.
      const line = (scene.caption || scene.headline).replace(/\*/g, '');
      if (line) {
        // The caption sits on the shot: a recipe drawn on a dark ground keeps it in a light film (it only takes
        // the accent), so its caption is drawn light there, and dark on a light recipe in a dark film.
        const ground = SHOT_FACTS[template.componentName]?.ground;
        const filmDark = luma(palette.background) < 0.5;
        const captionColor = ground === 'dark' && !filmDark ? '#f5f5f2' : ground === 'light' && filmDark ? '#16171c' : palette.text;
        captions.push(clip('inkpress-caption', at, frames, { text: line, color: captionColor, backdrop: true, accent: palette.accent, fontSize: captionPx, uppercase: line.length <= 40, bottom: Math.round(height * 0.07) }));
      }
    }
    at += frames;
    if (i < lastIndex) cut(scene.transition ?? 'cut', scene.transition === 'wipe' ? wipes++ : 0);
  });
  if (lastIndex === 0) {
    for (const v of videos) {
      cut('cut', 0);
      const frames = Math.round(videoSceneSec(v) * FPS);
      shots.push(clip('video-clip', at, frames, { file: v.url, fit: 'cover', muted: Boolean(opts.music?.url) }, { label: v.name.slice(0, 32) }));
      at += frames;
    }
  }

  // Every dressed seam is built from its two neighbours (upstream shot-transitions card): half of the seam's
  // frames come from the end of the outgoing shot's hold, half from the start of the incoming shot, which
  // therefore starts that far into its own motion on the timeline. The film keeps its length.
  let side = 0;
  for (const s of seams) {
    const out = shots.find((c) => c.start + c.duration === s.at);
    const inc = shots.find((c) => c.start === s.at);
    if (!out || !inc || out.cardId === 'video-clip' || inc.cardId === 'video-clip') continue;
    const kind = s.kind as SeamKind;
    const half = seamFrames(kind, out.duration, inc.duration) / 2;
    if (half < 2) continue;
    inc.inOffset += half * inc.speed;
    flashes.push(clip('connected-seam', s.at - half, half * 2, { kind, outId: out.id, inId: inc.id, half, dir: side++ % 2 === 0 ? 1 : -1, accent: palette.accent, page: palette.background }, { label: SEAM_LABEL[kind] }));
  }

  const total = Math.max(at, FPS);
  const tracks = [
    { id: uid('track'), name: t('track.transitions'), clips: flashes },
    { id: uid('track'), name: t('track.captions'), clips: captions },
    { id: uid('track'), name: 'Site', clips: insets },
    { id: uid('track'), name: t('track.shots'), clips: shots },
    { id: uid('track'), name: t('track.background'), clips: [clip('bg-paper', 0, total, { color: palette.background })] },
    { id: uid('track'), name: t('track.sfx'), clips: sfx },
  ];
  if (opts.music?.url) {
    tracks.push({
      id: uid('track'),
      name: t('track.music'),
      role: 'music',
      // Music sits under the SFX at about a third of full volume, with a 1 s fade in and a 1.7 s fade out (sound-design 3).
      clips: [clip('audio-clip', 0, total, { file: opts.music.url, volume: 0.34, fadeInFrames: 30, fadeOutFrames: 50, durationFrames: total }, { label: opts.music.name.slice(0, 32) })],
    });
  }

  return {
    name: plan.title,
    fps: FPS,
    width,
    height,
    background: opts.theme?.colors?.page ?? palette.background,
    ...(opts.brand ? { brand: opts.brand } : {}),
    // Every recipe draws in the film's theme (re-skinned to the product, SKILL principle 2); the Themes tab changes it.
    ...(opts.theme ? { themeId: opts.theme.id, ...(opts.theme.colors ? { sitePalette: { ...opts.theme.colors } } : {}) } : {}),
    tracks: tracks.filter((track) => track.clips.length > 0 || track.name === t('track.shots')),
  };
}
