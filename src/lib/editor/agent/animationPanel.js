/**
 * Settings for an AI animation clip (`remotion-code`): edit its code and
 * props, see errors, and render a check frame. The code is gated here and
 * only ever executed in the sandboxed renderer.
 */
import { checkAnimationCode, normalizeAnimationCode } from './codeGate.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {HTMLElement} container
 * @param {object} o { clip, onApply({ code, props }), onCheck() → Promise<{ blob, error }> }
 */
export function renderAnimationPanel(container, { clip, onApply, onCheck }) {
  let still = null;
  container.innerHTML = `
    <div class="anim-panel">
      <h4 class="addon-panel__heading">Animation (Remotion code)</h4>
      <p class="addon-field__hint">Made by the AI Video agent. It runs in a sandbox and draws above other layers in the preview; the export keeps timeline order.</p>
      <div class="agent-msg agent-msg--error" data-anim-error role="alert" ${clip.lastError ? '' : 'hidden'}>${esc(clip.lastError || '')}</div>
      <label class="addon-field"><span>Code</span><textarea class="anim-code" data-anim-code rows="14" spellcheck="false">${esc(clip.code || '')}</textarea></label>
      <label class="addon-field"><span>Props (JSON)</span><textarea class="anim-code" data-anim-props rows="4" spellcheck="false">${esc(JSON.stringify(clip.props || {}, null, 2))}</textarea></label>
      <div class="cap-actions">
        <button type="button" class="mini-btn cap-primary" data-anim-apply>Apply changes</button>
        <button type="button" class="mini-btn" data-anim-check>Render check frame</button>
      </div>
      <div data-anim-still></div>
    </div>`;
  const $ = (s) => container.querySelector(s);
  const showError = (msg) => { const el = $('[data-anim-error]'); el.textContent = msg || ''; el.hidden = !msg; };

  const onClick = async (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    if (b.dataset.animApply !== undefined) {
      const code = normalizeAnimationCode($('[data-anim-code]').value);
      const gate = checkAnimationCode(code);
      if (!gate.ok) { showError(gate.errors.join(' · ')); return; }
      let props;
      try { props = JSON.parse($('[data-anim-props]').value || '{}'); } catch { showError('Props must be valid JSON'); return; }
      showError('');
      onApply?.({ code, props });
    } else if (b.dataset.animCheck !== undefined) {
      b.disabled = true;
      b.textContent = 'Rendering…';
      try {
        const { blob, error } = await onCheck();
        showError(error || '');
        if (still) URL.revokeObjectURL(still);
        still = blob ? URL.createObjectURL(blob) : null;
        $('[data-anim-still]').innerHTML = still ? `<img class="agent-still" src="${still}" alt="Rendered check frame"/>` : '';
      } catch (err) {
        showError(err?.message || String(err));
      } finally {
        b.disabled = false;
        b.textContent = 'Render check frame';
      }
    }
  };
  container.addEventListener('click', onClick);
  return {
    destroy() {
      container.removeEventListener('click', onClick);
      if (still) URL.revokeObjectURL(still);
    },
  };
}
