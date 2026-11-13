// Decode the audio track of a recording to 16 kHz mono Float32, the input Whisper expects.
export const WHISPER_SAMPLE_RATE = 16000;

export const decodeToMono16k = async (blob: Blob): Promise<Float32Array> => {
  const buffer = await blob.arrayBuffer();
  const Ctx: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(buffer);
  } catch {
    throw new Error("This recording has no audio track to transcribe.");
  } finally {
    ctx.close().catch(() => {});
  }

  const frames = Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, Math.max(1, frames), WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination); // mixing to one channel happens in the offline context
  source.start();
  return (await offline.startRendering()).getChannelData(0).slice();
};
