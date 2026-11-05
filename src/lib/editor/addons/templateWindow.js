/**
 * Template library window (upstream "End Screens" / "Connect" windows):
 * the template list on the left; on the right, a looping live preview
 * rendered by the same Remotion composition as the editor, plus "Use
 * template". Plain DOM, styled with the timeline tokens (timeline-addons.css).
 */
import '../../../../styles/watch.css'; // the viewer's lead form, shown over form templates
import { TEMPLATE_LIBRARIES, templatePreviewProject } from './templateLibrary.js';
import { presetToClips } from './overlayPresets.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {object} o
 *   library    'endScreens' | 'connect'
 *   onUse(tpl) insert the template (called once; the window closes)
 *   buildModel(project) → composition model (timelineToComposition)
 *   createEngine   optional (host, opts) → engine; defaults to the Remotion Player
 *   mount      element to attach to (default document.body)
 * @returns {{ close(): void, select(id): void, el: HTMLElement }}
 */
export function openTemplateWindow({ library = 'endScreens', onUse, buildModel, createEngine, mount = document.body } = {}) {
  const lib = TEMPLATE_LIBRARIES[library];
  if (!lib) throw new Error(`Unknown template library: ${library}`);
  const backdrop = document.createElement('div');
  backdrop.className = 'tpl-win';
  backdrop.innerHTML = `
    <div class="tpl-win__dialog" role="dialog" aria-modal="true" aria-label="${esc(lib.title)}">
      <header class="tpl-win__head">
        <h3>${esc(lib.title)}</h3>
        <span class="tpl-win__where">${lib.anchor === 'end' ? 'Adds at the end of the video' : 'Adds at the playhead'}</span>
        <button type="button" class="tpl-win__close" aria-label="Close">✕</button>
      </header>
      <div class="tpl-win__body">
        <ul class="tpl-win__list" role="listbox" aria-label="Templates">
          ${lib.templates.map((t) => `
            <li><button type="button" role="option" class="tpl-win__item" data-tpl="${esc(t.id)}">
              <strong>${esc(t.name)}</strong><span>${esc(t.description)}</span>
            </button></li>`).join('')}
        </ul>
        <div class="tpl-win__main">
          <div class="tpl-win__frame"><div class="tpl-win__stage"></div><div class="tpl-win__layer"></div></div>
          <div class="tpl-win__meta">
            <div><strong class="tpl-win__name"></strong><p class="tpl-win__desc"></p></div>
            <button type="button" class="tpl-win__use">Use template</button>
          </div>
        </div>
      </div>
    </div>`;
  mount.appendChild(backdrop);

  const stage = backdrop.querySelector('.tpl-win__stage');
  const layer = backdrop.querySelector('.tpl-win__layer');
  let engine = null;
  let current = null;
  let formCard = null;
  let fps = 30;
  // Like a viewer who submits: the form shows first, then what follows it.
  const syncForm = (frame) => {
    if (formCard && current?.items.length > 1) formCard.hidden = frame / fps >= 2.5;
  };
  let closed = false;

  async function ensureEngine(model) {
    if (engine) { engine.update(model); return engine; }
    const make = createEngine || (await import('../remotion/previewEngine.jsx')).createPreviewEngine;
    if (closed) return null;
    engine = make(stage, {
      model,
      onFrame: syncForm,
      onReady: () => engine?.play(),
      onEnded: () => { engine?.seekToFrame(0); engine?.play(); },
    });
    return engine;
  }

  async function select(id) {
    const tpl = lib.templates.find((t) => t.id === id) || lib.templates[0];
    current = tpl;
    backdrop.querySelectorAll('.tpl-win__item').forEach((b) => {
      const on = b.dataset.tpl === tpl.id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    backdrop.querySelector('.tpl-win__name').textContent = tpl.name;
    backdrop.querySelector('.tpl-win__desc').textContent = tpl.description;
    // Lead forms are live UI, not frames: show the viewer's form over the preview.
    layer.innerHTML = '';
    formCard = null;
    const form = tpl.items.find((i) => i.type === 'lead-form');
    if (form) {
      const { showLeadForm } = await import('../publish/viewerOverlays.js');
      if (current !== tpl || closed) return;
      const clip = presetToClips({ items: [form] }, 0, Math.max(1, tpl.duration), 1)[0];
      const card = showLeadForm(layer, clip, {});
      card.setAttribute('inert', '');
      formCard = card;
    }
    try {
      const model = buildModel(templatePreviewProject(tpl, presetToClips));
      fps = model.fps || 30;
      const e = await ensureEngine(model);
      e?.seekToFrame(0);
      e?.play();
    } catch (err) {
      console.warn('[templates] preview failed', err);
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    engine?.destroy?.();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('.tpl-win__close')) { close(); return; }
    const item = e.target.closest('[data-tpl]');
    if (item) { select(item.dataset.tpl); return; }
    if (e.target.closest('.tpl-win__use') && current) {
      const tpl = current;
      close();
      onUse?.(tpl, lib);
    }
  });

  select(lib.templates[0].id);
  backdrop.querySelector('.tpl-win__close').focus({ preventScroll: true });
  return { close, select, el: backdrop };
}
