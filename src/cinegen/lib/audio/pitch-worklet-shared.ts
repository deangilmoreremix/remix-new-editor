// [remix] Stage 11 (port H): names and messages shared by the pitch AudioWorklet and its loader.
export const PITCH_PROCESSOR_NAME = 'cinegen-pitch-shift';
export type PitchWorkletMessage = { type: 'pitch'; semitones: number } | { type: 'reset' };
