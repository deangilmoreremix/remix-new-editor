/**
 * The captions clip's inspector section. Captions are made and edited in ONE place, the free Caption Studio window
 * (src/lib/captionStudio): on-device transcription, script editing, looks and colours, SRT/VTT/TXT/ASS export. This section only
 * summarises the clip's captions and opens that window.
 *
 * @param {HTMLElement} container
 * @param {{ captions?: object[], style?: object, onOpenStudio: () => void }} opts
 * @returns {{ destroy(): void }}
 */
import { sortCaptions, captionPages, CAPITE_PRESETS, CAPTION_PRESETS } from './captions.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderCaptionsPanel(container, opts = {}) {
  const captions = sortCaptions(opts.captions);
  const style = opts.style || {};
  const look = CAPITE_PRESETS[style.preset]?.label || CAPTION_PRESETS[style.preset]?.label || 'Custom';
  const lines = captions.length ? captionPages(captions, style).length : 0;
  container.innerHTML = `
    <div class="cap-panel">
      <h4 class="addon-panel__heading">Captions</h4>
      <p class="addon-field__hint" data-cap-summary>${captions.length ? `${captions.length} words · ${lines} lines · ${esc(look)} look` : 'No captions yet.'}</p>
      <button type="button" class="mini-btn cap-primary" data-cap-studio>✨ Open Caption Studio (free)</button>
      <p class="addon-field__hint">Transcribe on your device, edit the script, restyle and recolour, and export SRT, VTT, TXT or ASS — all in one window. No credits are used.</p>
    </div>`;
  const onClick = (e) => { if (e.target.closest('[data-cap-studio]')) opts.onOpenStudio?.(); };
  container.addEventListener('click', onClick);
  return { destroy: () => { container.removeEventListener('click', onClick); container.innerHTML = ''; } };
}
