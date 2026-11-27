// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/enumerate-devices-or-time-out.ts and get-devices.ts (label caching left out).
export async function enumerateDevicesOrTimeOut(timeoutMs = 10000, md = globalThis.navigator?.mediaDevices) {
  let timer;
  const timeOut = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`navigator.mediaDevices.enumerateDevices() has not responded within ${timeoutMs}ms. Usually this can be fixed by restarting your browser.`)), timeoutMs);
  });
  try {
    return await Promise.race([timeOut, md.enumerateDevices()]);
  } finally {
    clearTimeout(timer);
  }
}

/** Cameras and microphones, asking for permission once if the browser hides their labels. */
export async function getDevices(md = globalThis.navigator?.mediaDevices) {
  let devices = await enumerateDevicesOrTimeOut(10000, md);
  if (devices.some((d) => d.label === '')) {
    try {
      const stream = await md.getUserMedia({ video: true, audio: true });
      devices = await md.enumerateDevices();
      stream.getTracks().forEach((t) => t.stop());
    } catch { /* permission refused: keep the unlabelled list */ }
  }
  return {
    cameras: devices.filter((d) => d.kind === 'videoinput'),
    microphones: devices.filter((d) => d.kind === 'audioinput'),
  };
}
