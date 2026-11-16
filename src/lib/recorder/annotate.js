// src/lib/recorder/annotate.js
//
// Drawing on screen while recording (Sendspark "Record Videos": point things out). The screen
// take is drawn through a canvas that also paints your pen, arrow and box marks, so they are in
// the recording. Marks are kept in 0..1 coordinates of the screen picture and fade out a few
// seconds after you finish them (or stay until Clear, for boxes and arrows kept with "Hold").

export const TOOLS = ['pen', 'arrow', 'box'];
export const COLORS = ['#ef4444', '#facc15', '#d9ff00', '#38bdf8', '#ffffff'];
export const FADE_AFTER_MS = 3500;
export const FADE_MS = 600;

/** Opacity of a finished mark at time `now` (unfinished marks are fully visible). */
export function markOpacity(mark, now) {
  if (mark.endedAt == null || mark.hold) return 1;
  const age = now - mark.endedAt;
  if (age <= FADE_AFTER_MS) return 1;
  return Math.max(0, 1 - (age - FADE_AFTER_MS) / FADE_MS);
}

/** Paint marks on a canvas context of size w×h. Pure canvas calls (testable with a fake ctx). */
export function drawMarks(ctx, marks, w, h, now) {
  for (const m of marks) {
    const a = markOpacity(m, now);
    if (a <= 0 || !m.points?.length) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = m.color;
    ctx.fillStyle = m.color;
    ctx.lineWidth = Math.max(3, Math.round(Math.min(w, h) * 0.006));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = m.points.map(([x, y]) => [x * w, y * h]);
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[pts.length - 1];
    ctx.beginPath();
    if (m.tool === 'box') {
      ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.stroke();
    } else if (m.tool === 'arrow') {
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const head = ctx.lineWidth * 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45));
      ctx.lineTo(x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(x0, y0);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Where a pointer at (clientX, clientY) lands on a video drawn with object-fit: contain inside
 * `rect`, in 0..1 picture coordinates (null outside the picture).
 */
export function pointOnPicture(clientX, clientY, rect, videoW, videoH) {
  if (!videoW || !videoH) return null;
  const s = Math.min(rect.width / videoW, rect.height / videoH);
  const pw = videoW * s; const ph = videoH * s;
  const x = (clientX - rect.left - (rect.width - pw) / 2) / pw;
  const y = (clientY - rect.top - (rect.height - ph) / 2) / ph;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return [x, y];
}

/**
 * Wrap a screen stream so marks can be drawn into it. Returns { stream, begin, move, end, clear,
 * marks, stop }. `stream` has the composited video track plus the original audio tracks.
 */
export async function createAnnotator(display, { document: doc = document, now = () => globalThis.performance.now() } = {}) {
  const track = display.getVideoTracks()[0];
  const video = doc.createElement('video');
  video.muted = true; video.playsInline = true;
  video.srcObject = new globalThis.MediaStream([track]);
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  const w = video.videoWidth || 1920; const h = video.videoHeight || 1080;
  const canvas = doc.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const marks = [];
  let current = null;
  let stopped = false;
  const paint = () => {
    if (stopped) return;
    ctx.drawImage(video, 0, 0, w, h);
    const t = now();
    // Drop marks that have faded out.
    for (let i = marks.length - 1; i >= 0; i -= 1) if (markOpacity(marks[i], t) <= 0) marks.splice(i, 1);
    drawMarks(ctx, marks, w, h, t);
    // A timer, not requestAnimationFrame: screen recording continues while you work in another tab.
    setTimeout(paint, 33);
  };
  paint();
  const out = canvas.captureStream(30);
  const outTrack = out.getVideoTracks()[0];
  const stop = () => { stopped = true; video.srcObject = null; track.stop(); };
  const nativeStop = outTrack.stop.bind(outTrack);
  outTrack.stop = () => { nativeStop(); stop(); };
  // The browser's "Stop sharing" ends the take, as before.
  track.addEventListener('ended', () => { nativeStop(); stop(); outTrack.dispatchEvent(new Event('ended')); }, { once: true });
  return {
    stream: new globalThis.MediaStream([outTrack, ...display.getAudioTracks()]),
    width: w,
    height: h,
    marks,
    begin(tool, color, pt, { hold = false } = {}) { current = { tool, color, hold, points: [pt], endedAt: null }; marks.push(current); },
    move(pt) { if (!current) return; if (current.tool === 'pen') current.points.push(pt); else current.points[1] = pt; },
    end() { if (current) current.endedAt = now(); current = null; },
    clear() { marks.length = 0; current = null; },
    stop: () => { nativeStop(); stop(); },
  };
}
