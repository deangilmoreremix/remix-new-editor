// src/lib/outreach/audioQuality.js
//
// A sound check for a finished recording (requirement 1). Plain signal measurements on the decoded audio, done in the browser:
// how loud the speech is, whether it distorted, how quiet the quietest moments are, and so how far the voice stands above
// the background. It is a guide, not a verdict: it says "this part sounds quiet", never "this will convert better".
//
// samples: Float32Array of mono PCM in -1..1.

const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -90);
const round1 = (x) => Math.round(x * 10) / 10;

/**
 * @param {Float32Array|number[]} samples
 * @param {number} [sampleRate]
 * @returns {{ seconds:number, loudnessDb:number, peakDb:number, clippedPercent:number, noiseFloorDb:number, snrDb:number,
 *   score:number, level:'good'|'ok'|'poor', notes:string[] } | null}   null when there is nothing to measure
 */
export function analyzeAudio(samples, sampleRate = 16000) {
  const n = samples?.length || 0;
  if (!n || !(sampleRate > 0)) return null;
  const win = Math.max(1, Math.round(sampleRate * 0.05)); // 50 ms windows
  const rms = [];
  let peak = 0; let clipped = 0;
  for (let i = 0; i < n; i += win) {
    let sum = 0; const end = Math.min(n, i + win);
    for (let j = i; j < end; j += 1) {
      const v = Math.abs(Number(samples[j]) || 0);
      sum += v * v;
      if (v > peak) peak = v;
      if (v >= 0.999) clipped += 1;
    }
    rms.push(Math.sqrt(sum / (end - i)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const quiet = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1)));
  const noiseFloor = quiet.reduce((a, b) => a + b, 0) / quiet.length;
  // Speech level: the louder half of the windows (pauses do not drag the loudness down).
  const loud = sorted.slice(Math.floor(sorted.length / 2));
  const speech = Math.sqrt(loud.reduce((a, b) => a + b * b, 0) / loud.length);
  const loudnessDb = round1(db(speech));
  const noiseFloorDb = round1(db(noiseFloor));
  const snrDb = round1(loudnessDb - noiseFloorDb);
  const clippedPercent = round1((clipped / n) * 100);
  const peakDb = round1(db(peak));

  const notes = [];
  let score = 100;
  if (loudnessDb < -35) { score -= 40; notes.push('Very quiet: move closer to the microphone or raise its volume.'); }
  else if (loudnessDb < -26) { score -= 20; notes.push('Fairly quiet: a little closer to the microphone would help.'); }
  else if (loudnessDb > -8) { score -= 15; notes.push('Very loud: move back a little or lower the microphone volume.'); }
  if (clippedPercent >= 0.1) { score -= clippedPercent >= 1 ? 35 : 20; notes.push('Some of the sound is distorted (too loud at moments). Lower the microphone volume or move back.'); }
  if (snrDb < 12) { score -= 30; notes.push('Background noise is close to the loudness of your voice. A quieter room or a closer microphone will help.'); }
  else if (snrDb < 20) { score -= 12; notes.push('Some background noise. A quieter spot would sound cleaner.'); }
  if (noiseFloorDb > -40 && snrDb >= 12) { score -= 5; notes.push('The quietest moments are not very quiet (a fan, hum or room noise).'); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (!notes.length) notes.push('The sound looks good: clear, not distorted, and quiet in the background.');
  return { seconds: round1(n / sampleRate), loudnessDb, peakDb, clippedPercent, noiseFloorDb, snrDb, score, level: score >= 80 ? 'good' : score >= 55 ? 'ok' : 'poor', notes };
}

/** A saved check only counts for the recording it was measured on; for any other recording there is no result yet. */
export const soundCheckFor = (check, url) => (check && url && check.url === url ? check : null);
