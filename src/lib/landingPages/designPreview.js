// src/lib/landingPages/designPreview.js
//
// A small, non-interactive LIVE picture of a landing page design: the real page is rendered (the editor's <Render>) at a fixed
// 1280px width and scaled down to fit the card. It is only drawn once the card scrolls into view, so a grid of 34 stays light.
//   const h = attachDesignPreview(box, template.editorData);  ...  h.destroy();
const PAGE_WIDTH = 1280;
const PREVIEW_PAGE = { id: 'preview', title: 'Preview', video_url: '', poster_url: null };
const TOKENS = { firstname: 'Alex', company: 'Brightline' };

export function attachDesignPreview(host, data, { aspect = 0.72, deps = {} } = {}) {
  host.style.position = 'relative';
  host.style.overflow = 'hidden';
  host.style.width = '100%';
  host.style.aspectRatio = `1 / ${aspect}`;
  host.style.borderRadius = '10px';
  host.style.background = 'rgba(0,0,0,.4)';
  host.style.border = '1px solid rgba(255,255,255,.08)';
  host.setAttribute('role', 'img');
  let inner = null;
  let mounted = null;
  let gone = false;
  let io = null;
  let ro = null;

  const fit = () => { if (inner && host.clientWidth) inner.style.transform = `scale(${host.clientWidth / PAGE_WIDTH})`; };
  const draw = async () => {
    if (gone || inner) return;
    inner = document.createElement('div');
    inner.setAttribute('aria-hidden', 'true');
    inner.setAttribute('inert', '');
    inner.style.cssText = `position:absolute;top:0;left:0;width:${PAGE_WIDTH}px;transform-origin:top left;pointer-events:none`;
    host.appendChild(inner);
    fit();
    try {
      const mount = deps.mountEditablePage || (await import('./editor/mount.jsx')).mountEditablePage;
      if (gone) return;
      mounted = mount(inner, { page: PREVIEW_PAGE, data, tokens: TOKENS, preview: true });
    } catch { /* a failed preview just leaves the card without a picture */ }
  };

  if (typeof globalThis.IntersectionObserver === 'function') {
    io = new globalThis.IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); void draw(); } }, { rootMargin: '200px' });
    io.observe(host);
  } else {
    void draw();
  }
  if (typeof globalThis.ResizeObserver === 'function') { ro = new globalThis.ResizeObserver(fit); ro.observe(host); }

  return {
    destroy() {
      gone = true;
      io?.disconnect();
      ro?.disconnect();
      try { mounted?.destroy(); } catch { /* already gone */ }
      inner?.remove();
    },
  };
}
