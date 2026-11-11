// Glue between the embedded Screenity web recorder (public/recorder/) and the timeline editor.

// MediaRecorder/WebCodecs WebM files often have no duration header; read it from the media element.
export function probeBlobDuration(blob) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(blob);
    let finished = false;
    let seeked = false;
    const done = (d) => {
      if (finished) return;
      finished = true;
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : null);
    };
    // Resolve as soon as a real duration is known; an Infinity duration (headerless WebM) needs a seek.
    const check = () => {
      if (finished) return;
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) return done(d);
      if (d === Infinity && !seeked) { seeked = true; v.currentTime = 1e101; }
    };
    v.preload = 'auto';
    v.muted = true;
    ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay', 'timeupdate'].forEach((ev) => v.addEventListener(ev, check));
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    v.src = url;
  });
}

// Remux to MP4 so the clip has a real duration and seeks properly on the timeline.
// Returns { blob, duration } (duration in seconds, or null if unknown). Falls back to the
// original file if the browser/codec can't be remuxed.
export async function remuxForTimeline(blob) {
  if (blob.size > 1.5e9) return { blob, duration: null };
  try {
    const mb = await import('mediabunny');
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    let duration = null;
    try { const d = await input.computeDuration(); duration = Number.isFinite(d) && d > 0 ? d : null; } catch (_) { /* fall through */ }
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
    const conversion = await mb.Conversion.init({ input, output });
    if (!conversion.isValid) return { blob, duration };
    await conversion.execute();
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), duration };
  } catch (e) {
    console.warn('Remux to MP4 failed, using the original recording:', e);
    return { blob, duration: null };
  }
}

const OVERLAY_ID = 'smartvid-recorder-overlay';

// Opens the Screenity web recorder as a full-window overlay (an iframe of /recorder/web.html).
export function openScreenityRecorder({ onClose } = {}) {
  if (document.getElementById(OVERLAY_ID)) return null;
  const wrap = document.createElement('div');
  wrap.id = OVERLAY_ID;
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(8,10,20,.4)';

  const frame = document.createElement('iframe');
  frame.src = '/recorder/web.html';
  frame.title = 'Screen recorder';
  frame.allow = 'display-capture *; camera *; microphone *; autoplay *; clipboard-write *; fullscreen *';
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:normal';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close recorder';
  closeBtn.style.cssText = 'position:absolute;top:14px;left:14px;z-index:2;padding:8px 14px;border-radius:999px;border:0;background:#fff;color:#16203a;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.3)';

  let recording = false;
  const onMsg = (e) => {
    const d = e.data;
    if (e.origin === window.location.origin && d && d.source === 'smartvid-recorder' && d.type === 'recording-state') recording = !!d.recording;
  };
  window.addEventListener('message', onMsg);

  const close = () => {
    if (recording && !window.confirm('A recording is in progress. Close the recorder and lose it?')) return;
    window.removeEventListener('message', onMsg);
    wrap.remove();
    if (onClose) onClose();
  };
  closeBtn.onclick = close;
  wrap.append(frame, closeBtn);
  document.body.appendChild(wrap);
  return { close, frame };
}

export function closeScreenityRecorder() {
  document.getElementById(OVERLAY_ID)?.remove();
}
