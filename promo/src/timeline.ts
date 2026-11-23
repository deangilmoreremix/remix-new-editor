// Single source of truth for V1 timing. Everything is written in beats of the BGM grid.
// BGM: house-vibez.mp3 (Lily J, Mixkit). Grid fit: 122.00 BPM, t0 = 7.9356 s, max residual 15.6 ms (analysis/beat_data_house-vibez.json).
export const FPS = 30;
export const SOURCE_BEAT0 = 7.9356; // seconds, audit truth from analysis, never mixed with render offsets
export const BEAT_INT = 0.4917954637470821; // seconds per beat
// Measured 2026-11-23 on this pipeline (Remotion 4.0.484, mp4/AAC 48 kHz): 7 SFX probes cross-correlated against the render, all +1.28..1.29f late; BGM +1.34f.
export const OUTPUT_AUDIO_OFFSET_F = 1.28;

export const beatT = (n: number) => n * BEAT_INT;
export const beatF = (n: number) => Math.round(beatT(n) * FPS);
/** Frame in the BGM file that plays at video frame 0 (so video beat 0 = music beat 0). */
export const BGM_START_FRAME = Math.round(SOURCE_BEAT0 * FPS + OUTPUT_AUDIO_OFFSET_F); // start the music OUTPUT_AUDIO_OFFSET_F frames later in the file to cancel the encoder delay

export const SHOTS = {
  open: { from: beatF(0), to: beatF(8) }, // brand-ink-open
  prompt: { from: beatF(8), to: beatF(30) }, // type-and-filter style typing, then example clip
  wall: { from: beatF(30), to: beatF(44) }, // wall-reveal-moves: bento-light-up
  lockup: { from: beatF(44), to: beatF(56) }, // logo-shrink-wordmark-lockup
} as const;
export const V1_TOTAL = SHOTS.lockup.to;

export const dur = (s: { from: number; to: number }) => s.to - s.from;

// Prompt typed in Video Studio (same string as captured in video-typed)
export const PROMPT_TEXT = 'A lone tower in golden wheat';

// Captions (text on screen). Sizes follow aesthetic-rules Q11 (>= 56px for narrative captions).
export const CAPTIONS = [
  { id: 'describe', text: 'Describe the shot.', from: SHOTS.prompt.from + 128, to: SHOTS.prompt.from + 210 },
  { id: 'studios', text: 'Your studios, one place.', from: SHOTS.wall.from + 10, to: SHOTS.wall.to - 8 },
] as const;

// SFX table: { from = SHOTS.x.from + offset - peakLag - outputOffset, src, volume }. Peaks measured in analysis/sfx_peaks.json.
const PEAK_F: Record<string, number> = {
  'transition-soft.mp3': 13.6, 'keyboard.mp3': 0, 'whoosh-big.mp3': 21.6, 'whoosh-fast.mp3': 21.8,
  'riser-cine.mp3': 35, 'impact-cine.mp3': 19, 'sparkle.mp3': 44.3, 'click-camera.mp3': 5.8, 'swoosh-quick.mp3': 10.1,
};
const sfxFrom = (targetPeakF: number, src: string) => Math.max(0, Math.round(targetPeakF - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));

export type Sfx = { from: number; src: string; volume: number; durationInFrames?: number; note: string };
export const SFX: Sfx[] = [
  { from: sfxFrom(SHOTS.open.from + 46, 'transition-soft.mp3'), src: 'transition-soft.mp3', volume: 0.55, note: 'wordmark letterpress lands (open, f46)' },
  { from: sfxFrom(SHOTS.prompt.from + 16, 'keyboard.mp3'), src: 'keyboard.mp3', volume: 1.0, durationInFrames: 86, note: 'typing in Video Studio prompt, window = typing length' },
  { from: sfxFrom(SHOTS.prompt.from + 150, 'whoosh-fast.mp3'), src: 'whoosh-fast.mp3', volume: 0.9, note: 'example clip card rises in' },
  { from: sfxFrom(SHOTS.wall.from + 20, 'whoosh-big.mp3'), src: 'whoosh-big.mp3', volume: 0.5, note: 'studio wall starts lighting' },
  { from: sfxFrom(SHOTS.lockup.from + 10, 'riser-cine.mp3'), src: 'riser-cine.mp3', volume: 0.45, durationInFrames: 60, note: 'riser into the logo collapse' },
  { from: sfxFrom(SHOTS.lockup.from + 36, 'impact-cine.mp3'), src: 'impact-cine.mp3', volume: 0.6, note: 'logo lands (brake on collapse)' },
  { from: sfxFrom(SHOTS.lockup.from + 100, 'sparkle.mp3'), src: 'sparkle.mp3', volume: 0.9, note: 'tagline fades in (local 94-110, peak pinned f100)' },
];
