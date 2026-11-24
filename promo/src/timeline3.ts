// V3 engine clips: six single-shot clips, 14 beats (207f, 6.9 s) each, same BGM grid as V1/V2 (music beat 0 at video frame 0).
import { OUTPUT_AUDIO_OFFSET_F, beatF } from './timeline';
export const V3_DURATION = beatF(14); // 207
export const ENGINES = {
  create: { name: 'Create', desc: 'Start from scratch with AI-powered generation' },
  enhance: { name: 'Enhance', desc: 'Transform and improve existing content' },
  produce: { name: 'Produce', desc: 'Plan, structure, and assemble projects' },
  localize: { name: 'Localize', desc: 'Adapt content for global audiences' },
  automate: { name: 'Automate', desc: 'Streamline workflows with AI assistance' },
  scale: { name: 'Scale', desc: 'Manage, reuse, and grow your creative assets' },
} as const; // descriptions are the landing page's own SixEnginesSection strings (src/components/landing/sections/SixEnginesSection.jsx)
export type EngineId = keyof typeof ENGINES;

const PEAK_F: Record<string, number> = { 'transition-snap.mp3': 3.4, 'whoosh-big.mp3': 21.6, 'whoosh-fast.mp3': 21.8, 'swoosh-quick.mp3': 10.1, 'impact-cine.mp3': 19, 'click-camera.mp3': 5.8, 'keyboard.mp3': 0 };
const sfxFrom = (peakTarget: number, src: string) => Math.max(0, Math.round(peakTarget - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));
export type Sfx3 = { from: number; src: string; volume: number; durationInFrames?: number; note: string };
const mk = (at: number, src: string, volume: number, note: string, durationInFrames?: number): Sfx3 => ({ from: sfxFrom(at, src), src, volume, durationInFrames, note });

export const V3_SFX: Record<EngineId, Sfx3[]> = {
  create: [mk(20, 'whoosh-big.mp3', 0.5, 'first studio cell lights'), mk(60, 'swoosh-quick.mp3', 0.65, 'mid cascade'), mk(104, 'transition-snap.mp3', 0.75, 'last cell lit')],
  enhance: [mk(20, 'whoosh-big.mp3', 0.5, 'parallax drive starts'), mk(108, 'transition-snap.mp3', 1.0, 'hero card lifts')],
  produce: [mk(30, 'whoosh-fast.mp3', 0.6, 'travel accelerates'), mk(104, 'impact-cine.mp3', 0.55, 'travel brake')],
  localize: [mk(40, 'whoosh-big.mp3', 0.5, 'page lifts'), mk(62, 'transition-snap.mp3', 1.0, 'page settles')],
  automate: [mk(42, 'click-camera.mp3', 0.8, 'click into the agent input'), mk(50, 'keyboard.mp3', 0.6, 'typing window (94f)', 94), mk(160, 'transition-snap.mp3', 1.0, 'pull-back / title')],
  scale: [mk(34, 'whoosh-big.mp3', 0.5, 'pull-back / first deals'), mk(62, 'whoosh-fast.mp3', 0.6, 'fast deal run'), mk(108, 'transition-snap.mp3', 1.0, 'board settles')],
};
