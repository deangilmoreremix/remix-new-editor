export const FPS = 30;
export const BPM = 124.0; // fitted from bgm-tech-house.mp3 (max grid residual 7ms)
export const BEAT_F = (60 / BPM) * FPS; // 14.516 frames
export const bf = (beats: number) => Math.round(beats * BEAT_F);
export const BGM_START_S = 15.743; // first fitted beat in bgm-tech-house.mp3
export const C = {
  bg: '#050505',
  text: '#f5f5f5',
  muted: '#8c8c8c',
  accent: '#d9ff00', // app primary
};
export const FONT = "'Inter Display','Inter',system-ui,sans-serif";
