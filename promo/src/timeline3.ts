// V3 engine clips: six single-shot clips, 13 beats (192f, 6.4 s) each, same BGM grid as V1/V2 (music beat 0 at video frame 0).
import { OUTPUT_AUDIO_OFFSET_F, beatF } from './timeline';
export const V3_DURATION = beatF(13); // 192
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
  // first cues use swoosh-quick (peak lag 10.1f) so nothing is clamped to frame 0 (whoosh-big's 21.6f lag cannot be compensated before f23)
  create: [mk(18, 'swoosh-quick.mp3', 0.7, 'first studio cell lights'), mk(60, 'transition-snap.mp3', 0.7, 'mid cascade'), mk(104, 'transition-snap.mp3', 0.7, 'last cell lit')],
  enhance: [mk(18, 'swoosh-quick.mp3', 0.7, 'parallax drive starts'), mk(108, 'transition-snap.mp3', 0.7, 'hero card lifts')],
  produce: [mk(18, 'swoosh-quick.mp3', 0.7, 'parallax drive starts'), mk(108, 'transition-snap.mp3', 0.7, 'hero card lifts')],
  localize: [mk(6, 'transition-snap.mp3', 0.7, 'first pane pops'), mk(22, 'swoosh-quick.mp3', 0.7, 'third pane pops'), mk(38, 'whoosh-fast.mp3', 0.5, 'whip push in the second pane')],
  automate: [mk(42, 'click-camera.mp3', 1.0, 'click into the agent input'), mk(50, 'keyboard.mp3', 0.6, 'typing window (94f)', 94), mk(146, 'transition-snap.mp3', 1.0, 'typing complete')],
  scale: [mk(30, 'swoosh-quick.mp3', 0.7, 'first cards dealt'), mk(62, 'whoosh-fast.mp3', 0.5, 'fast deal run'), mk(108, 'transition-snap.mp3', 0.7, 'board settles')],
};
