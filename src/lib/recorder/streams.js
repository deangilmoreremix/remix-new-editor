// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/get-video-stream.ts. Exact device ids, so Chrome cannot silently swap in
// the default camera or microphone; a screen without its own sound gets the microphone.
export const DEFAULT_MINIMUM_FPS = 23.976; // Recorder's preferred-resolution.ts default

// audioSettings (src/lib/recorder/audio.js): the browser's noise suppression, echo cancellation and
// automatic volume. Without them the browser's defaults apply.
export function getAudioStreamConstraints({ recordAudio, selectedAudioSource, audioSettings }) {
  if (!recordAudio) return undefined;
  const device = !selectedAudioSource || selectedAudioSource === 'default' ? null : { deviceId: { exact: selectedAudioSource } };
  if (!audioSettings) return device || true;
  const { noiseSuppression, echoCancellation, autoGainControl } = audioSettings;
  return { ...(device || {}), noiseSuppression: !!noiseSuppression, echoCancellation: !!echoCancellation, autoGainControl: !!autoGainControl };
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

export function getCameraStream({ camera, preferPortrait, recordAudio, selectedAudioSource, audioSettings }, md = globalThis.navigator?.mediaDevices) {
  return md.getUserMedia({
    video: getCameraStreamConstraints(camera, preferPortrait),
    audio: getAudioStreamConstraints({ recordAudio, selectedAudioSource, audioSettings }),
  });
}

/**
 * Screen, with the microphone added. With audioSettings.systemAudio the browser is also asked for the
 * shared tab's or screen's sound, and that is mixed with the microphone (mix: src/lib/recorder/audio.js).
 * An already-chosen screen (`display`) is used instead of asking again.
 */
export async function getDisplayStreamWithMic({ recordAudio, selectedAudioSource, audioSettings, display: chosen, mix } = {}, md = globalThis.navigator?.mediaDevices, Stream = globalThis.MediaStream) {
  const display = chosen || await getDisplayStream({ withAudio: !!audioSettings?.systemAudio }, md);
  const systemTracks = audioSettings?.systemAudio ? display.getAudioTracks() : [];
  if (!recordAudio) return new Stream([...display.getVideoTracks(), ...systemTracks]);
  const mic = await md.getUserMedia({ audio: getAudioStreamConstraints({ recordAudio, selectedAudioSource, audioSettings }) });
  const micTracks = mic.getAudioTracks();
  if (systemTracks.length && micTracks.length && mix) {
    const mixed = mix([micTracks[0], systemTracks[0]]);
    const out = new Stream([...display.getVideoTracks(), mixed.track]);
    out.stopMix = mixed.stop;
    out.sourceTracks = [...micTracks, ...systemTracks];
    return out;
  }
  return new Stream([...display.getVideoTracks(), ...(micTracks.length ? micTracks : systemTracks)]);
}

export function getMicStream({ selectedAudioSource, audioSettings }, md = globalThis.navigator?.mediaDevices) {
  return md.getUserMedia({ audio: getAudioStreamConstraints({ recordAudio: true, selectedAudioSource, audioSettings }) });
}
