// [remix] Port I2: 16-bit PCM mono WAV encoder (a normal audio file the preview, the waveform job and the Remotion export all read).
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, samples[i] || 0)); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

export function concatSamples(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Peak and RMS of a buffer; used to reject silent output before it reaches the timeline. */
export function audioStats(samples: Float32Array): { peak: number; rms: number } {
  let peak = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; sum += samples[i] * samples[i]; }
  return { peak, rms: samples.length ? Math.sqrt(sum / samples.length) : 0 };
}

/** Split narration text into sentence-sized pieces (<= maxChars) so a long script generates and cancels in steps. */
export function chunkText(text: string, maxChars = 280): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*\s*/g) ?? [];
  const out: string[] = []; let cur = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const s of sentences) {
    if (s.length > maxChars) { push(); for (let i = 0; i < s.length; i += maxChars) { const part = s.slice(i, i + maxChars).trim(); if (part) out.push(part); } continue; }
    if ((cur + s).length > maxChars) push();
    cur += s;
  }
  push();
  return out;
}
