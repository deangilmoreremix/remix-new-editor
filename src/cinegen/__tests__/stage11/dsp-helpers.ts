// Test helpers: synthetic sine and an FFT peak finder (Hann window, parabolic interpolation).
export const sine = (freq: number, seconds: number, sr: number, amp = 0.5): Float32Array => {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return out;
};

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k); const wi = Math.sin(ang * k);
        const ur = re[i + k]; const ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

/** Frequency (Hz) of the strongest component of x[from .. from+size), size a power of two. */
export function peakFrequency(x: Float32Array, sr: number, from: number, size = 32768): number {
  const re = new Float64Array(size); const im = new Float64Array(size);
  for (let i = 0; i < size; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  fft(re, im);
  let best = 1; let bm = 0;
  for (let k = 1; k < size / 2; k++) { const m = Math.hypot(re[k], im[k]); if (m > bm) { bm = m; best = k; } }
  const mag = (k: number) => Math.hypot(re[k], im[k]);
  const a = Math.log(mag(best - 1) + 1e-12); const b = Math.log(mag(best) + 1e-12); const c = Math.log(mag(best + 1) + 1e-12);
  const d = (0.5 * (a - c)) / (a - 2 * b + c);
  return ((best + (Number.isFinite(d) ? d : 0)) * sr) / size;
}

export const rms = (x: Float32Array, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, to - from)); };
