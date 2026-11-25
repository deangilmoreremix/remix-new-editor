// src/lib/outreach/browserCapture.js
//
// "Capture with my browser" (Video Outreach → Prospects, website backgrounds): screenshots of prospects'
// pages taken in the user's own browser, where they are already signed in (Facebook, Instagram, X…).
// We never see a password or cookie. Chrome's tab sharing (getDisplayMedia) shares one tab we opened;
// we load each page in it, wait for it to draw, and keep a frame. Chrome and Edge only.
//
//   openCaptureTab()                 → the tab (a window we opened, showing "choose this tab")
//   startTabShare(tab)               → { video, stop } once the user picks that tab in Chrome's prompt
//   captureInTab({ tab, share, urls, upload, signal, onProgress, onShot }) → { shots: {url: imageUrl}, failed: [] }

export const CAPTURE_MARK = [217, 255, 0]; // the capture tab's colour, so we can tell the right tab was picked
export const SETTLE_MS = 6000;
export const LOAD_TIMEOUT_MS = 20000;

export const browserCaptureSupported = () => !!globalThis.navigator?.mediaDevices?.getDisplayMedia && !!globalThis.window?.open;

/**
 * The part of a frame kept: the top bar cut off (the site's header, where a signed-in user's own name
 * and photo show), then at most 16:9 from the top. Sizes in frame pixels.
 */
export function frameCrop(width, height, { hideTopBar = true } = {}) {
  const top = hideTopBar ? Math.round(height * 0.075) : 0;
  const h = Math.min(height - top, Math.round((width * 9) / 16));
  return { sx: 0, sy: top, sw: width, sh: Math.max(1, h) };
}

/** True when the frame's background is the capture tab's colour (the user picked our tab, not another one). */
export function isMarkFrame(rgb) {
  return rgb.every((v, i) => Math.abs(v - CAPTURE_MARK[i]) < 40);
}

// The capture tab's own page (public/outreach-capture.html, same origin): Chrome lists it by its title,
// "SmartVideo capture tab", and it is the capture mark's colour.
export const CAPTURE_PAGE = '/outreach-capture.html';

/** Open the tab pages are captured in (must run on a click). */
export function openCaptureTab() {
  const tab = window.open(CAPTURE_PAGE, 'smartvideo-capture');
  if (!tab) throw new Error('Your browser blocked the capture tab. Allow pop-ups for SmartVideo and try again.');
  return tab;
}

const onCapturePage = (tab) => { try { return tab.location.pathname === CAPTURE_PAGE && tab.document.readyState === 'complete'; } catch { return false; } };

// A spot of plain background (the capture page's text is in the middle).
function markColour(video, canvas) {
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, Math.round(video.videoWidth * 0.12), Math.round(video.videoHeight * 0.12), 1, 1, 0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

/** Ask Chrome to share a tab (must run on a click). Checks the user picked the capture tab. */
export async function startTabShare(tab) {
  if (tab && !tab.closed && !onCapturePage(tab)) { tab.location = CAPTURE_PAGE; for (let i = 0; i < 40 && !onCapturePage(tab); i++) await new Promise((r) => setTimeout(r, 100)); }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser', frameRate: 5 }, audio: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', preferCurrentTab: false });
  const stop = () => stream.getTracks().forEach((t) => t.stop());
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, srcObject: stream });
  await video.play();
  // The first frames can be blank: look for up to 2 seconds.
  const canvas = document.createElement('canvas');
  let ok = false;
  for (let i = 0; i < 10 && !ok; i++) { await new Promise((r) => setTimeout(r, 200)); ok = video.videoWidth > 0 && isMarkFrame(markColour(video, canvas)); }
  if (!ok) {
    stop();
    throw new Error('That wasn’t the SmartVideo capture tab. Click Start capturing again and choose the tab named “SmartVideo capture tab”.');
  }
  return { video, stop, ended: () => stream.getVideoTracks()[0]?.readyState === 'ended' };
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })); }, { once: true });
});

/** Has the tab left our capture page for the prospect's page? (Reading another site's address throws.) */
export function tabLeftUs(tab) {
  try { return tab.location.pathname !== CAPTURE_PAGE && tab.location.href !== 'about:blank'; } catch { return true; }
}

/** One frame of the shared tab as a JPEG blob, cropped by frameCrop, 1280 wide at most. */
export function grabFrame(video, { hideTopBar = true } = {}) {
  const { sx, sy, sw, sh } = frameCrop(video.videoWidth, video.videoHeight, { hideTopBar });
  const scale = Math.min(1, 1280 / sw);
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(sw * scale), height: Math.round(sh * scale) });
  c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the tab.'))), 'image/jpeg', 0.86));
}

/**
 * Load each page in the shared tab and keep a frame. `deps` (grab, sleep, left) are for tests.
 * A page that never loads, or a tab that was closed or stopped sharing, ends in `failed`.
 */
export async function captureInTab({ tab, share, urls, upload, signal, onProgress = () => {}, onShot = () => {}, hideTopBar = true, settleMs = SETTLE_MS, deps = {} }) {
  const wait = deps.sleep || sleep;
  const left = deps.left || tabLeftUs;
  const grab = deps.grab || ((v) => grabFrame(v, { hideTopBar }));
  const shots = {};
  const failed = [];
  for (let i = 0; i < urls.length; i++) {
    if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
    if (tab.closed || share.ended?.()) throw new Error(`The capture tab was closed or stopped sharing. ${i} of ${urls.length} pages were captured.`);
    onProgress(i, urls.length, urls[i]);
    try {
      // Back to our page first, so "left us" means this prospect's page started loading.
      try { tab.location.replace(CAPTURE_PAGE); } catch { tab.location = CAPTURE_PAGE; }
      await wait(600, signal);
      tab.location = urls[i];
      let waited = 0;
      while (!left(tab) && waited < LOAD_TIMEOUT_MS) { await wait(250, signal); waited += 250; }
      if (!left(tab)) throw new Error('The page did not load');
      await wait(settleMs, signal);
      shots[urls[i]] = await upload(await grab(share.video), i);
      onShot(urls[i], shots[urls[i]]); // kept at once: a stop or a closed tab later loses nothing
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      failed.push(urls[i]);
    }
  }
  onProgress(urls.length, urls.length, '');
  return { shots, failed };
}
