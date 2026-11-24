// V2 feature reel timeline. Same BGM grid as V1 (house-vibez, 122.00 BPM, t0 7.9356 s); every cut is a beatF(n).
import { BEAT_INT, FPS, OUTPUT_AUDIO_OFFSET_F, SOURCE_BEAT0, beatF } from './timeline';
export { BEAT_INT, FPS, OUTPUT_AUDIO_OFFSET_F, SOURCE_BEAT0, beatF };

// [name, start beat, end beat]
export const V2_SHOTS = {
  open: { from: beatF(0), to: beatF(8) }, // brand-ink-open
  tour: { from: beatF(8), to: beatF(28) }, // cursor-flyover: Video Studio prompt + model picker + settings
  hub: { from: beatF(28), to: beatF(38) }, // depth-layer-moves: app hub
  zoom: { from: beatF(38), to: beatF(48) }, // crash-zoom-punch: Image Studio controls adapt to the model
  tilt: { from: beatF(48), to: beatF(58) }, // tilt-reveal: Cinema Studio
  backlot: { from: beatF(58), to: beatF(68) }, // timeline-travel: Backlot 8-step rail
  deal: { from: beatF(68), to: beatF(80) }, // deck-deal-flyin: Edit tools
  quad: { from: beatF(80), to: beatF(86) }, // quad-split-parallel-scenes: Character / Avatar / Lip Sync / AI VFX
  carousel: { from: beatF(86), to: beatF(96) }, // carousel-3d: Cinema Templates
  lockup: { from: beatF(96), to: beatF(108) }, // logo-shrink-wordmark-lockup
} as const;
export const V2_TOTAL = V2_SHOTS.lockup.to;

const PEAK_F: Record<string, number> = {
  'transition-soft.mp3': 13.6, 'keyboard.mp3': 0, 'whoosh-big.mp3': 21.6, 'whoosh-fast.mp3': 21.8, 'riser-cine.mp3': 35, 'impact-cine.mp3': 19,
  'sparkle.mp3': 44.3, 'click-camera.mp3': 5.8, 'swoosh-quick.mp3': 10.1, 'transition-snap.mp3': 3.4,
};
const sfxFrom = (peakTarget: number, src: string) => Math.max(0, Math.round(peakTarget - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));
export type Sfx2 = { from: number; src: string; volume: number; durationInFrames?: number; note: string };
const S = V2_SHOTS;
const mk = (at: number, src: string, volume: number, note: string, durationInFrames?: number): Sfx2 => ({ from: sfxFrom(at, src), src, volume, durationInFrames, note });

// local-frame constants mirrored from the shot files (kept here so the table is one place; checked by verify_sync2)
export const V2_SFX: Sfx2[] = [
  mk(S.open.from + 46, 'transition-soft.mp3', 0.55, 'wordmark letterpress lands'),
  mk(S.tour.from + 42, 'click-camera.mp3', 0.8, 'click 1: prompt field'),
  mk(S.tour.from + 50, 'keyboard.mp3', 0.6, 'typing window (104f)', 104),
  mk(S.tour.from + 182, 'click-camera.mp3', 0.8, 'click 2: model button opens the picker'),
  mk(S.tour.from + 232, 'click-camera.mp3', 0.8, 'click 3: Advanced chip opens the real Advanced Options panel'),
  mk(S.tour.from + 175, 'whoosh-fast.mp3', 0.7, 'camera flight to the model button'),
  mk(S.hub.from + 20, 'whoosh-big.mp3', 0.55, 'hub drive starts'),
  mk(S.hub.from + 108, 'transition-snap.mp3', 1.0, 'hero card lifts'),
  mk(S.zoom.from + 44, 'whoosh-fast.mp3', 0.55, 'crash zoom'),
  mk(S.zoom.from + 46, 'impact-cine.mp3', 0.6, 'crash zoom hit'),
  mk(S.tilt.from + 40, 'whoosh-big.mp3', 0.5, 'camera lifts'),
  mk(S.tilt.from + 60, 'transition-snap.mp3', 1.0, 'camera settles'),
  mk(S.backlot.from + 104, 'impact-cine.mp3', 0.6, 'travel brake'),
  mk(S.deal.from + 34, 'whoosh-big.mp3', 0.5, 'pull-back / first deals'),
  mk(S.deal.from + 62, 'whoosh-fast.mp3', 0.8, 'fast deal run'),
  mk(S.deal.from + 108, 'transition-snap.mp3', 1.0, 'board settles'),
  mk(S.quad.from + 6, 'transition-snap.mp3', 1.0, 'quad pop 1'),
  mk(S.quad.from + 22, 'swoosh-quick.mp3', 0.8, 'quad pop 3'),
  mk(S.quad.from + 38, 'whoosh-fast.mp3', 0.9, 'quad whip push'),
  mk(S.carousel.from + 29, 'swoosh-quick.mp3', 0.7, 'carousel step'),
  mk(S.carousel.from + 71, 'swoosh-quick.mp3', 0.7, 'carousel step'),
  mk(S.lockup.from + 10, 'riser-cine.mp3', 0.45, 'riser into logo collapse', 60),
  mk(S.lockup.from + 36, 'impact-cine.mp3', 0.6, 'logo lands'),
  mk(S.lockup.from + 100, 'sparkle.mp3', 0.9, 'tagline fades in'),
];
