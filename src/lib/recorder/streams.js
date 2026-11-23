// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/get-video-stream.ts. Exact device ids, so Chrome cannot silently swap in
// the default camera or microphone; a screen without its own sound gets the microphone.
export const DEFAULT_MINIMUM_FPS = 23.976; // Recorder's preferred-resolution.ts default

export function getAudioStreamConstraints({ recordAudio, selectedAudioSource }) {
  if (!recordAudio) return undefined;
  if (!selectedAudioSource || selectedAudioSource === 'default') return true;
  return { deviceId: { exact: selectedAudioSource } };
}

export function getCameraStreamConstraints({ deviceId, maxWidth, maxHeight, minFps } = {}, preferPortrait = false) {
  return {
    ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
    width: preferPortrait ? undefined : maxWidth ? { ideal: maxWidth } : undefined,
    height: preferPortrait ? (maxHeight ? { ideal: maxHeight } : undefined) : undefined,
    // Recorder asks for a minimum frame rate, which suits its own device picker. Here any webcam must
    // work (some run at 15-20 fps in low light), so the rate is a preference instead of a minimum.
    frameRate: { ideal: Math.max(30, minFps ?? DEFAULT_MINIMUM_FPS) },
  };
}

export function getDisplayStream({ withAudio = false } = {}, md = globalThis.navigator?.mediaDevices) {
  return md.getDisplayMedia({ video: { height: { ideal: 1080 } }, audio: withAudio });
}

export function getCameraStream({ camera, preferPortrait, recordAudio, selectedAudioSource }, md = globalThis.navigator?.mediaDevices) {
  return md.getUserMedia({
    video: getCameraStreamConstraints(camera, preferPortrait),
    audio: getAudioStreamConstraints({ recordAudio, selectedAudioSource }),
  });
}

/** Screen, with the microphone added when it has no sound of its own. */
export async function getDisplayStreamWithMic({ recordAudio, selectedAudioSource }, md = globalThis.navigator?.mediaDevices, Stream = globalThis.MediaStream) {
  const display = await getDisplayStream({}, md);
  if (!recordAudio) return display;
  const mic = await md.getUserMedia({ audio: getAudioStreamConstraints({ recordAudio, selectedAudioSource }) });
  return new Stream([...display.getVideoTracks(), ...mic.getAudioTracks()]);
}

export function getMicStream({ selectedAudioSource }, md = globalThis.navigator?.mediaDevices) {
  return md.getUserMedia({ audio: getAudioStreamConstraints({ recordAudio: true, selectedAudioSource }) });
}
