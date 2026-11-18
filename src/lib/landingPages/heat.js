/**
 * Heat samples from a public landing page: where visitors click, how far they scroll, which video seconds they watch.
 * Privacy: only coordinates (permille of the page), a depth percentage and a second index leave the browser. No text,
 * element names, form values, keystrokes, pointer movement or IPs. Nothing runs in the editor preview.
 */
const FLUSH_MS = 5000;
const MAX_BATCH = 40;

export const viewportClass = (w) => (w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
export const permille = (n, d) => (d > 0 ? Math.max(0, Math.min(1000, Math.round((n / d) * 1000))) : 0);

export function createHeatCollector({ send, win = globalThis.window, doc = globalThis.document, setTimer = setInterval, clearTimer = clearInterval } = {}) {
  if (!win || !doc || typeof send !== 'function') return { stop() {}, flush() {} };
  let queue = [];
  let maxDepth = 0;
  let sentDepth = 0;
  const seenSeconds = new Set();
  const vp = () => viewportClass(win.innerWidth || 1280);
  const push = (e) => { queue.push({ ...e, vp: vp() }); if (queue.length >= MAX_BATCH) flush(); };
  function flush() {
    while (queue.length) { const batch = queue.slice(0, MAX_BATCH); queue = queue.slice(MAX_BATCH); send(batch); }
  }
  const onClick = (e) => {
    const root = doc.documentElement;
    const w = Math.max(root.scrollWidth, root.clientWidth, 1); const h = Math.max(root.scrollHeight, root.clientHeight, 1);
    const x = (e.pageX ?? e.clientX ?? 0); const y = (e.pageY ?? e.clientY ?? 0);
    push({ t: 'click', x: permille(x, w), y: permille(y, h) });
  };
  const onScroll = () => {
    const root = doc.documentElement; const h = Math.max(root.scrollHeight, 1);
    const seen = (win.scrollY || root.scrollTop || 0) + (win.innerHeight || root.clientHeight || 0);
    maxDepth = Math.max(maxDepth, Math.min(100, Math.round((seen / h) * 100)));
    const step = Math.floor(maxDepth / 10) * 10;
    if (step > sentDepth) { sentDepth = step; push({ t: 'scroll', d: step }); }
  };
  // The player's <video> fires timeupdate; one sample per whole second watched, however often it fires.
  const onTime = (e) => {
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO' || v.paused) return;
    const s = Math.floor(v.currentTime || 0);
    if (s >= 0 && s < 86400 && !seenSeconds.has(s)) { seenSeconds.add(s); push({ t: 'watch', s }); }
  };
  const onHide = () => { if (doc.visibilityState === 'hidden') flush(); };
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('timeupdate', onTime, true);
  win.addEventListener('scroll', onScroll, { passive: true });
  win.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', onHide);
  // The first depth reading waits until the page has rendered; measuring at mount would make a short, still-empty page look fully scrolled.
  const first = setTimeout(onScroll, 2000);
  const timer = setTimer(flush, FLUSH_MS);
  return {
    flush,
    stop() {
      clearTimer(timer); clearTimeout(first); flush();
      doc.removeEventListener('click', onClick, true); doc.removeEventListener('timeupdate', onTime, true);
      win.removeEventListener('scroll', onScroll); win.removeEventListener('pagehide', flush); doc.removeEventListener('visibilitychange', onHide);
    },
  };
}

/** The 40x40 click cells as percentage boxes for an overlay, heaviest first normalised to 0..1. */
export function heatCells(rows) {
  const list = (Array.isArray(rows) ? rows : []).map((r) => ({ cx: Number(r.cx), cy: Number(r.cy), clicks: Number(r.clicks) || 0, sessions: Number(r.sessions) || 0 })).filter((r) => r.clicks > 0);
  const max = Math.max(1, ...list.map((r) => r.clicks));
  return list.map((r) => ({ left: r.cx * 2.5, top: r.cy * 2.5, size: 2.5, weight: r.clicks / max, clicks: r.clicks, sessions: r.sessions }));
}
