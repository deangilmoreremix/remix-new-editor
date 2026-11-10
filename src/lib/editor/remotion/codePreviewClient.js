/**
 * Editor side of the AI animation preview frame (code-preview.html).
 *
 * AI-written animation clips never run in the editor page. When the
 * timeline has any, a sandboxed iframe (allow-scripts only → opaque origin)
 * is laid over the Remotion preview; it renders just those clips on a
 * transparent background and follows the playhead. In the preview they
 * draw above the other layers; the exported video keeps timeline order.
 */
import { inlineLocalMedia } from './exportClient.js';

export const PREVIEW_URL = '/code-preview.html';

export function createCodePreview(host, { onError } = {}) {
  let iframe = null;
  let ready = null;
  let lastModel = null;
  let lastFrame = 0;

  const ensure = () => {
    if (iframe?.isConnected) return ready;
    iframe = document.createElement('iframe');
    iframe.title = 'Animation preview';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.className = 'code-preview-frame';
    // Same color-scheme as the frame's document, or Chrome paints an opaque backdrop.
    Object.assign(iframe.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', background: 'transparent', pointerEvents: 'none', colorScheme: 'light' });
    iframe.allowTransparency = true;
    iframe.src = PREVIEW_URL;
    ready = new Promise((resolve) => {
      const onMsg = (e) => {
        if (e.source !== iframe?.contentWindow) return;
        if (e.data?.type === 'preview-ready') resolve();
        else if (e.data?.type === 'code-error') onError?.(e.data.layerId, e.data.message);
      };
      window.addEventListener('message', onMsg);
    });
    host.appendChild(iframe);
    return ready;
  };

  return {
    /** Show the model's animation clips (hides the frame when there are none). */
    async update(model) {
      const layers = (model?.layers || []).filter((l) => l.kind === 'code' || l.kind === 'hyperframes');
      if (!layers.length) {
        if (iframe) iframe.style.display = 'none';
        lastModel = null;
        return;
      }
      const codeModel = { ...model, layers, audio: [], transitions: [] };
      const key = JSON.stringify(codeModel);
      if (key === lastModel && iframe?.style.display !== 'none') return;
      lastModel = key;
      await ensure();
      iframe.style.display = '';
      iframe.contentWindow?.postMessage({ type: 'model', model: await inlineLocalMedia(codeModel) }, '*');
      iframe.contentWindow?.postMessage({ type: 'frame', frame: lastFrame }, '*');
    },
    frame(f) {
      lastFrame = f;
      if (iframe && lastModel && iframe.style.display !== 'none') iframe.contentWindow?.postMessage({ type: 'frame', frame: f }, '*');
    },
    get active() { return !!lastModel; },
    destroy() { iframe?.remove(); iframe = null; },
  };
}
