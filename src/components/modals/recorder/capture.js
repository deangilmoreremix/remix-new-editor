/* global InputDeviceInfo, MediaStream, FileSystemFileHandle */
// Capture helpers ported from Remotion Recorder (remotion-dev/recorder, src/helpers/*).
// Pure browser code: no DOM rendering lives here, so it can be tested on its own.

export const PREFIXES = ['webcam', 'display', 'alternative1', 'alternative2'];
export const VISIBLE_BY_DEFAULT = { webcam: true, display: true, alternative1: false, alternative2: false };
export const VIEW_LABELS = { webcam: 'Webcam', display: 'Screen', alternative1: 'Camera 2', alternative2: 'Camera 3' };

export const DEFAULT_MINIMUM_FPS = 23.976;
export const FPS_AVAILABLE = [240, 120, 60, 30];
export const VIDEO_SIZES = {
  '4K': { width: 3840, height: 2160 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 640, height: 480 }
};

// ----- device labels ----------------------------------------------------

export const formatDeviceLabel = (label = '') => {
  let l = label
    .replace(/\(\w{4}:\w{4}\)/, '')
    .trim()
    .replace(/\(Built-in\)/, '')
    .trim()
    .replace(/\(Virtual\)/, '')
    .trim()
    .replace(/\(m-de:vice\)/, '')
    .trim();
  const match = l.match(/\((.*)\)/);
  if (match) l = match[1] === 'Bluetooth' ? l.replace(/\(Bluetooth\)/, '').trim() : match[1];
  return l.replace(/^\d+- /, '').trim();
};

export const enumerateDevicesOrTimeOut = async () => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(
      'navigator.mediaDevices.enumerateDevices() has not responded within 10000ms. Usually this can be fixed by restarting your browser.'
    )), 10000);
  });
  try {
    return await Promise.race([timeout, navigator.mediaDevices.enumerateDevices()]);
  } finally {
    clearTimeout(timer);
  }
};

// ----- device discovery + permission (ported from the Recorder's get-devices.ts / DevicePermission.tsx) -----
// Until the user grants access, browsers return devices with EMPTY ids and labels, so a camera or microphone cannot be picked.
// Like the Recorder, ask once up front (which also unlocks the labels), then remember the clean labels in localStorage.

const LABELS_KEY = 'labels';
const readLabels = () => { try { return JSON.parse(safeStorageGet(LABELS_KEY) || '[]'); } catch { return []; } };
function safeStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }

export const storeLabelsToLS = (devices) => {
  const labels = readLabels();
  devices.forEach((device) => {
    const clean = formatDeviceLabel(device.label);
    if (device.deviceId && clean !== '' && !labels.some((l) => l.id === device.deviceId)) labels.push({ id: device.deviceId, label: clean });
  });
  try { localStorage.setItem(LABELS_KEY, JSON.stringify(labels)); } catch { /* storage unavailable */ }
};

export const hasNewDevices = (devices) => {
  const labels = readLabels();
  return !devices.every((d) => labels.some((l) => l.id === d.deviceId));
};

/** The label to show: the browser's current one, else the one remembered from an earlier visit. */
export const getDeviceLabel = (device) => {
  const cached = readLabels().find((l) => l.id === device.deviceId);
  return cached ? cached.label : formatDeviceLabel(device.label);
};

// Camera + microphone together first (one prompt); if the machine lacks one of them, fall back so the other can still be used.
const requestAnyMedia = async () => {
  const attempts = [{ video: true, audio: true }, { video: true }, { audio: true }];
  let firstError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') throw err; // blocked: asking again won't help
      firstError = firstError || err;
    }
  }
  throw firstError;
};

export const getDevices = async () => {
  const fetched = await enumerateDevicesOrTimeOut();
  const hasEmptyLabels = fetched.some((d) => d.label === '');
  const hasNew = hasNewDevices(fetched);
  if (hasNew && hasEmptyLabels) {
    const stream = await requestAnyMedia();
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      storeLabelsToLS(devices);
      return devices;
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
  if (hasNew) storeLabelsToLS(fetched);
  return fetched;
};

/** Friendly text for a getDevices()/getUserMedia failure. */
export const describePermissionError = (err) => {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Camera and microphone access is blocked. Click the camera or lock icon in your browser\'s address bar, allow access, then press "Rescan devices".';
  }
  if (err?.name === 'NotFoundError' || /Requested device not found|object can not be found/i.test(err?.message || '')) {
    return 'No camera or microphone was found. Connect one, then press "Rescan devices".';
  }
  return err?.message || 'Could not look for cameras and microphones.';
};

// The Recorder streams takes to the origin-private file system (Web FS). Private windows and some browsers do not offer it;
// takes then stay in memory, which is fine for short recordings but worth a warning.
export const canUseWebFsWriter = async () => {
  try {
    if (!navigator.storage?.getDirectory) return false;
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle('remotion-probe-web-fs-support', { create: true });
    return handle.createWritable !== undefined;
  } catch {
    return false;
  }
};

// ----- remembered choices (per device resolution, preferred devices) ------

const safeStorage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};
export const storage = safeStorage;

export const getPreferredResolutionForDevice = (deviceId) => {
  const none = { maxSize: null, minimumFps: null };
  if (!deviceId) return none;
  const stored = safeStorage.get(`preferred-constraint-${deviceId}`);
  if (!stored || stored === 'null') return none;
  try { return JSON.parse(stored); } catch { return none; }
};

export const setPreferredResolutionForDevice = (deviceId, constraint) => {
  safeStorage.set(`preferred-constraint-${deviceId}`, JSON.stringify(constraint));
};

// ----- constraints -------------------------------------------------------

export const getMaxResolutionOfDevice = (device) => {
  if (typeof InputDeviceInfo === 'undefined' || !(device instanceof InputDeviceInfo)) return null;
  const caps = device.getCapabilities?.();
  if (!caps) return null;
  const width = caps.width?.max ?? null;
  const height = caps.height?.max ?? null;
  if (width === null && height === null) return null;
  return { width, height, frameRate: caps.frameRate?.max ?? null };
};

export const getSelectedVideoSource = ({ resolutionConstraint, maxResolution, device }) => {
  const size = resolutionConstraint.maxSize ? VIDEO_SIZES[resolutionConstraint.maxSize] : null;
  const constrainedWidth = size ? size.width : null;
  const constrainedHeight = size ? size.height : null;

  if (maxResolution === null) {
    return { type: 'camera', deviceId: device.deviceId, maxWidth: constrainedWidth, maxHeight: constrainedHeight, minFps: null };
  }
  return {
    type: 'camera',
    deviceId: device.deviceId,
    maxWidth: constrainedWidth === null ? maxResolution.width : Math.min(constrainedWidth, maxResolution.width ?? Infinity),
    maxHeight: constrainedHeight === null ? maxResolution.height : Math.min(constrainedHeight, maxResolution.height ?? Infinity),
    minFps: Math.min(maxResolution.frameRate ?? Infinity, resolutionConstraint.minimumFps ?? DEFAULT_MINIMUM_FPS)
  };
};

export const getCameraStreamConstraints = (source, preferPortrait) => {
  if (source.type !== 'camera') return null;
  return {
    // Exact, so the browser cannot silently substitute the default webcam.
    deviceId: { exact: source.deviceId },
    width: preferPortrait ? undefined : (source.maxWidth ? { ideal: source.maxWidth } : undefined),
    height: preferPortrait ? (source.maxHeight ? { ideal: source.maxHeight } : undefined) : undefined,
    frameRate: { min: source.minFps ?? DEFAULT_MINIMUM_FPS }
  };
};

export const getAudioStreamConstraints = ({ recordAudio, selectedAudioSource }) => {
  if (!recordAudio || !selectedAudioSource) return undefined;
  return { deviceId: { exact: selectedAudioSource } };
};

const getDisplayStream = (source) => navigator.mediaDevices.getDisplayMedia({
  video: { height: { ideal: 1080 } },
  audio: source.type === 'display-with-audio'
});

export const getVideoStream = async ({ selectedVideoSource, preferPortrait, recordAudio, selectedAudioSource }) => {
  if (selectedVideoSource.type === 'display-with-audio') return getDisplayStream(selectedVideoSource);

  if (selectedVideoSource.type === 'display-without-audio') {
    const display = await getDisplayStream(selectedVideoSource);
    if (recordAudio && selectedAudioSource) {
      try {
        const audio = await navigator.mediaDevices.getUserMedia({
          audio: getAudioStreamConstraints({ recordAudio, selectedAudioSource })
        });
        return new MediaStream([...display.getVideoTracks(), ...audio.getAudioTracks()]);
      } catch (err) {
        display.getTracks().forEach((t) => t.stop());
        throw err;
      }
    }
    return display;
  }

  if (selectedVideoSource.type === 'camera') {
    return navigator.mediaDevices.getUserMedia({
      video: getCameraStreamConstraints(selectedVideoSource, preferPortrait) ?? undefined,
      audio: getAudioStreamConstraints({ recordAudio, selectedAudioSource })
    });
  }
  throw new Error('Unknown video source type');
};

export const describeStreamError = (e, source, preferPortrait) => {
  if (e?.name === 'NotReadableError') {
    return 'The selected device is not readable. This could be due to another app using this camera.';
  }
  if (e?.name === 'OverconstrainedError') {
    return `Could not find a resolution satisfying these constraints: ${JSON.stringify(getCameraStreamConstraints(source, preferPortrait))}`;
  }
  if (e?.name === 'NotAllowedError') return 'Permission was denied. Allow access and try again.';
  return e?.message || e?.name || 'Could not open this source.';
};

export const canRotateCamera = ({ selectedSource, preferPortrait, resolution }) => {
  if (!selectedSource || selectedSource.type !== 'camera' || !resolution) return false;
  if (preferPortrait) return selectedSource.maxWidth === null || selectedSource.maxWidth > resolution.width;
  return selectedSource.maxHeight === null || selectedSource.maxHeight > resolution.height;
};

// ----- codecs and recording ---------------------------------------------

const MP4_WITH_AUDIO = 'video/mp4;codecs=avc1,mp4a.40.2';
const MP4_WITHOUT_AUDIO = 'video/mp4;codecs=avc1';
const WEBM_WITH_AUDIO = 'video/webm;codecs=vp8,opus';
const WEBM_WITHOUT_AUDIO = 'video/webm;codecs=vp8';

export const findGoodSupportedCodec = (withAudio) => {
  const list = withAudio ? [MP4_WITH_AUDIO, WEBM_WITH_AUDIO] : [MP4_WITHOUT_AUDIO, WEBM_WITHOUT_AUDIO];
  const found = list.find((m) => MediaRecorder.isTypeSupported(m));
  if (!found) throw new Error('No supported codec found');
  return found;
};

export const getExtension = (mimeType) => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  throw new Error(`Unsupported mime type: ${mimeType}`);
};

// Streams chunks to the origin-private file system so long takes do not live in memory.
// Falls back to an in-memory list where OPFS is unavailable.
export const createFileStorage = async (filename) => {
  let dir = null;
  try { dir = await navigator.storage?.getDirectory?.(); } catch { dir = null; }

  if (!dir || typeof FileSystemFileHandle === 'undefined' || !('createWritable' in FileSystemFileHandle.prototype)) {
    const parts = [];
    let bytes = 0;
    return {
      write: async (blob) => { parts.push(blob); bytes += blob.size; },
      save: async (type) => new Blob(parts, { type }),
      getBytesWritten: () => bytes,
      release: async () => { parts.length = 0; }
    };
  }

  const handle = await dir.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  let written = 0;
  let chain = Promise.resolve();
  const closeQuietly = async () => { try { await writable.close(); } catch { /* already closed */ } };

  return {
    write: (blob) => {
      chain = chain.then(async () => {
        await writable.write({ type: 'write', position: written, data: blob });
        written += blob.size;
      });
      return chain;
    },
    save: async () => {
      await chain;
      await closeQuietly();
      return (await (await dir.getFileHandle(filename, { create: true })).getFile());
    },
    getBytesWritten: () => written,
    release: async () => {
      await closeQuietly();
      try { await dir.removeEntry(filename, { recursive: true }); } catch { /* already gone */ }
    }
  };
};

const MEDIA_RECORDER_OPTIONS = {
  audioBitsPerSecond: 128000,
  videoBitsPerSecond: 8 * 4000000,
  videoKeyFrameIntervalDuration: 2 * 1000
};

export const startMediaRecorder = async ({ prefix, timestamp, stream }) => {
  const mimeType = findGoodSupportedCodec(stream.getAudioTracks().length > 0);
  const filename = `${prefix}${timestamp}.${getExtension(mimeType)}`;
  const recorder = new MediaRecorder(stream, { ...MEDIA_RECORDER_OPTIONS, mimeType });
  const writer = await createFileStorage(filename);

  const periodic = new AbortController();
  recorder.addEventListener('dataavailable', ({ data }) => { writer.write(data); }, { signal: periodic.signal });

  let stopped = null;
  const stopAndWaitUntilDone = () => {
    if (stopped) return stopped;
    periodic.abort();
    stopped = new Promise((resolve, reject) => {
      const once = new AbortController();
      recorder.addEventListener('error', () => reject(new Error(`Error recording ${prefix}`)), { once: true, signal: once.signal });
      recorder.addEventListener('dataavailable', ({ data }) => {
        writer.write(data)
          .then(() => resolve({
            prefix,
            mimeType,
            endDate: Date.now(),
            data: () => writer.save(mimeType),
            releaseData: () => writer.release()
          }))
          .catch(reject);
      }, { once: true, signal: once.signal });
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve({ prefix, mimeType, endDate: Date.now(), data: () => writer.save(mimeType), releaseData: () => writer.release() });
    });
    return stopped;
  };

  // A track ending mid-take would leave corrupt timestamps, so stop right away.
  stream.getTracks().forEach((track) => track.addEventListener('ended', () => { stopAndWaitUntilDone(); }, { once: true }));

  recorder.start(10_000); // chunk (and persist) every 10 seconds
  return { recorder, stopAndWaitUntilDone, mimeType, stream };
};

// ----- volume meter (same analyser settings as the Recorder's) -----------

export const attachVolumeMeter = (stream, onLevel) => {
  if (!stream || stream.getAudioTracks().length === 0) return () => {};
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.smoothingTimeConstant = 0.9;
  analyser.fftSize = 512;
  analyser.minDecibels = -123;
  analyser.maxDecibels = 0;
  ctx.createMediaStreamSource(stream).connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  let level = 0;
  let raf = 0;
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, v) => a + v, 0) / data.length;
    level = (level + avg) / 2; // extra smoothing
    onLevel(level);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ctx.close().catch(() => {});
  };
};

// Cover width (%) for the meter: the gradient is hidden by a dark bar of this width.
export const volumeCoverPercent = (level) => (level < 100 ? 85 - level : 0);

// ----- post-processing ---------------------------------------------------

// Remux through mediabunny so MediaRecorder output has proper duration/timestamps
// (same as the Recorder's convertInBrowser). Falls back to the raw file on failure.
export const convertTake = async ({ src, mimeType, onProgress }) => {
  try {
    const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat } = await import('mediabunny');
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(src) });
    const output = new Output({
      format: mimeType.includes('mp4') ? new Mp4OutputFormat() : new WebMOutputFormat(),
      target: new BufferTarget()
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: (track, n) => (n > 1 ? { discard: true } : { height: Math.min(track.displayHeight, 1080) })
    });
    conversion.onProgress = (p) => onProgress?.(p, () => conversion.cancel());
    if (!conversion.isValid) throw new Error('Conversion is not valid');
    await conversion.execute();
    if (!output.target.buffer) throw new Error('Conversion failed');
    return new Blob([output.target.buffer], { type: mimeType.split(';')[0] });
  } catch (err) {
    console.warn('Take conversion skipped, using the raw recording:', err);
    return src;
  }
};

export const formatMilliseconds = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
