/**
 * Upstream measures the sound of the RENDERED file, not the preview (final-review A6): is it clipping,
 * and is anything audible? This reads the exported MP4's audio track in the browser and reports it.
 */
export interface AudioStats {
  /** Highest sample, in dB below full scale (0 = at the limit). */
  peakDb: number;
  /** Samples at or above −0.1 dBFS. */
  clipped: number;
  /** Seconds of the file the track covers. */
  seconds: number;
  /** Loudest level (dB) of each second, to see whether sound effects stand out of the music. */
  perSecondDb: number[];
}

const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -120);

/** Pure: stats of decoded channels. */
export function audioStats(channels: readonly Float32Array[], sampleRate: number): AudioStats {
  const length = channels.reduce((m, c) => Math.max(m, c.length), 0);
  const perSec: number[] = [];
  let peak = 0;
  let clipped = 0;
  for (let start = 0; start < length; start += sampleRate) {
    let secPeak = 0;
    const end = Math.min(length, start + sampleRate);
    for (const ch of channels) {
      for (let i = start; i < Math.min(end, ch.length); i++) {
        const a = Math.abs(ch[i]);
        if (a > secPeak) secPeak = a;
        if (a >= 0.988) clipped++;
      }
    }
    peak = Math.max(peak, secPeak);
    perSec.push(Math.round(db(secPeak) * 10) / 10);
  }
  return { peakDb: Math.round(db(peak) * 10) / 10, clipped, seconds: length / sampleRate, perSecondDb: perSec };
}

/** The lines for the chat: what the rendered sound did, with no claim beyond what was measured. */
export function audioReport(stats: AudioStats): string[] {
  const lines: string[] = [];
  lines.push(stats.clipped > 0 ? `✗ The rendered sound clips: ${stats.clipped} samples at the limit (peak ${stats.peakDb} dBFS).` : `✓ The rendered sound peaks at ${stats.peakDb} dBFS and does not clip.`);
  const silent = stats.perSecondDb.filter((x) => x < -60).length;
  if (stats.seconds > 0 && silent / Math.max(1, stats.perSecondDb.length) > 0.4) lines.push(`? ${silent} of ${stats.perSecondDb.length} seconds are nearly silent.`);
  return lines;
}

/** Decode the audio of an exported MP4. Null when the browser cannot (no audio track, no AudioContext). */
export async function measureRenderedAudio(blob: Blob): Promise<AudioStats | null> {
  try {
    const Ctx = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    try {
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      return audioStats(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)), buffer.sampleRate);
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}
