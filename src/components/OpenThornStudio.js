// OpenThorn Studio — embedded iframe wrapper for the OpenThorn AI Website Builder.
// Served from the same smartvid.app deploy under /openthorn/.

const OPENTHORN_URL = '/openthorn/'

export function OpenThornStudio() {
  const container = document.createElement('div')
  container.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;'

  const header = document.createElement('div')
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:var(--color-surface);border-bottom:1px solid var(--color-border);
    flex-shrink:0;
  `
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="width:10px;height:10px;border-radius:50%;background:var(--color-accent);box-shadow:0 0 8px var(--color-accent-glow);"></span>
      <span style="color:var(--color-text);font-weight:600;font-size:14px;font-family:var(--font-body);">OpenThorn</span>
      <span style="color:var(--color-text-muted);font-size:12px;font-family:var(--font-body);">AI Website Builder</span>
    </div>
  `
  container.appendChild(header)

  const iframe = document.createElement('iframe')
  iframe.src = OPENTHORN_URL
  iframe.style.cssText = `
    flex:1;width:100%;border:none;background:var(--color-bg);
    display:block;
  `
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-same-origin')
  iframe.setAttribute('title', 'OpenThorn Studio')
  container.appendChild(iframe)

  return container
}

export default OpenThornStudio
