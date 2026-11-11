/**
 * Bottom-row panels for personalization: Personalization, Personalization
 * Editor, Token Editor and Batch Generator. They show real data from the
 * Personalization Studio (src/lib/contactStore.js: contacts, their
 * variables and the business details saved from Find a Business) and use
 * the studio's own look (.pz-ui, styles/personalize-ui.css).
 */
import { TOKEN_DEFS, TOKEN_LABELS, buildVariables, resolveToken, extractTokens } from '../../../components/personalize/tokenSchema.js';
import { contactName } from '../personalize/perContact.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wrap = (inner) => `<div class="pz-ui rp">${inner}</div>`;

/** [{ key, label, value }] for the details a contact actually has. */
export function contactValues(profile) {
  if (!profile) return [];
  const vars = buildVariables(profile);
  return TOKEN_DEFS
    .map((d) => ({ key: d.key, label: TOKEN_LABELS[d.key] || d.key, value: String(vars[d.key] ?? '').trim() }))
    .filter((v) => v.value && !/^https?:\/\//.test(v.value) && v.value.length < 200);
}

const contactSelect = (contacts, activeId) => `
  <select class="pz-select" data-rp="contact" aria-label="Contact">
    <option value="">${contacts.length ? 'No contact selected' : 'No contacts yet'}</option>
    ${contacts.map((p) => `<option value="${esc(p.id)}"${String(p.id) === String(activeId) ? ' selected' : ''}>${esc(contactName(p))}</option>`).join('')}
  </select>`;

/**
 * @param {HTMLElement} el
 * @param {object} s  { contacts(), active(), select(id), addText(text), openPersonalize() }
 */
export function renderPersonalizationPanel(el, s) {
  const draw = () => {
    const contacts = s.contacts();
    const active = s.active();
    const values = contactValues(active);
    el.innerHTML = wrap(`
      <p class="pz-hint">Details from the Personalization Studio for the contact the video is previewed as. Click “Add as text” to put one on the video as Smart Text.</p>
      <div class="rp-row">${contactSelect(contacts, active?.id)}<button type="button" class="pz-btn pz-btn-secondary pz-btn-xs" data-rp="open">Open Personalize</button></div>
      ${active ? (values.length ? `<ul class="rp-list">${values.map((v) => `
        <li class="rp-var"><div><strong>${esc(v.label)}</strong><code>{{${esc(v.key)}}}</code></div><span title="${esc(v.value)}">${esc(v.value)}</span>
          <button type="button" class="pz-btn pz-btn-secondary pz-btn-xs" data-add="${esc(v.key)}">Add as text</button></li>`).join('')}</ul>`
        : '<p class="pz-hint">This contact has no details yet. Add them in the Personalize window (including Find a Business).</p>')
        : '<p class="pz-hint">Pick a contact, or add contacts in the Personalize window.</p>'}`);
  };
  el.onchange = (e) => { if (e.target.dataset?.rp === 'contact') { s.select(e.target.value || null); } };
  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.rp === 'open') s.openPersonalize();
    else if (b.dataset.add) s.addText(`{{${b.dataset.add}}}`);
  };
  draw();
  return { redraw: draw };
}

/**
 * Live preview of text with {{tokens}} for the selected contact.
 * @param {object} s { active(), tokens: [[key,label]], resolve(text, profile), addText(text) }
 */
export function renderPersonalizationEditor(el, s) {
  let text = '';
  const preview = () => {
    const out = el.querySelector('[data-rp="preview"]');
    const missing = el.querySelector('[data-rp="missing"]');
    if (!out) return;
    const profile = s.active();
    const resolved = s.resolve(text, profile);
    out.textContent = resolved || 'Your text appears here with the contact’s details.';
    const gaps = extractTokens(text).filter((t) => profile == null || resolveToken(profile, t) == null);
    missing.hidden = !gaps.length;
    missing.textContent = gaps.length ? `${profile ? `${contactName(profile)} has no value for` : 'No contact selected. Not filled in:'} ${[...new Set(gaps)].map((g) => `{{${g}}}`).join(', ')}` : '';
  };
  const draw = () => {
    el.innerHTML = wrap(`
      <p class="pz-hint">Write text with dynamic tokens and see it as the selected contact would. Then add it to the video as Smart Text.</p>
      <textarea class="pz-select rp-text" data-rp="text" rows="4" placeholder="Hi {{firstName}}, here is an offer for {{businessName}}…" aria-label="Personalized text">${esc(text)}</textarea>
      <select class="pz-select" data-rp="token" aria-label="Insert token"><option value="">+ Insert token</option>${s.tokens.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select>
      <div class="pz-card"><span class="pz-label">Preview</span><div class="rp-preview" data-rp="preview"></div><p class="pz-warning" data-rp="missing" hidden></p></div>
      <button type="button" class="pz-btn pz-btn-primary" data-rp="add">Add as Smart Text</button>`);
    preview();
  };
  el.oninput = (e) => { if (e.target.dataset?.rp === 'text') { text = e.target.value; preview(); } };
  el.onchange = (e) => {
    if (e.target.dataset?.rp !== 'token' || !e.target.value) return;
    const ta = el.querySelector('[data-rp="text"]');
    const pos = ta.selectionStart ?? text.length;
    text = `${text.slice(0, pos)}{{${e.target.value}}}${text.slice(pos)}`;
    draw();
  };
  el.onclick = (e) => { if (e.target.closest('[data-rp="add"]') && text.trim()) s.addText(text.trim()); };
  window.addEventListener('remix:contact-changed', preview);
  draw();
  return { redraw: draw, destroy: () => window.removeEventListener('remix:contact-changed', preview) };
}

/**
 * Token Editor: every token with what the selected contact has for it, and
 * a scene builder that turns the Intelligence timeline into Smart Text clips.
 * @param {object} s { active(), insert(token), autoTimeline() → Promise<number>, openContacts() }
 */
export function renderTokenEditor(el, s) {
  const draw = () => {
    const profile = s.active();
    const values = Object.fromEntries(contactValues(profile).map((v) => [v.key, v.value]));
    el.innerHTML = wrap(`
      <p class="pz-hint">Every token the studios understand. Click one to add it to the video as Smart Text; the value shown is the selected contact’s.</p>
      <div class="pz-token-grid">${TOKEN_DEFS.map((d) => `
        <button type="button" class="pz-token" data-rp="token" data-key="${esc(d.key)}" title="${esc(values[d.key] || 'No value for this contact')}">
          <span>${esc(TOKEN_LABELS[d.key] || d.key)}</span><span class="pz-token-code">{{${esc(d.key)}}}</span>${values[d.key] ? '' : '<span class="pz-chip pz-chip-warn">empty</span>'}</button>`).join('')}</div>
      <div class="pz-actions">
        <button type="button" class="pz-btn pz-btn-secondary" data-rp="refresh">Refresh</button>
        <button type="button" class="pz-btn pz-btn-primary" data-rp="auto" ${profile ? '' : 'disabled'}>✨ Build scenes for ${esc(profile ? contactName(profile) : 'a contact')}</button>
      </div>
      <p class="pz-hint" data-rp="status" role="status"></p>`);
  };
  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.rp === 'token') s.insert(`{{${b.dataset.key}}}`);
    else if (b.dataset.rp === 'refresh') draw();
    else if (b.dataset.rp === 'auto') {
      const status = el.querySelector('[data-rp="status"]');
      b.disabled = true;
      status.textContent = 'Building scenes…';
      try {
        const n = await s.autoTimeline();
        status.textContent = n ? `Added ${n} scene${n === 1 ? '' : 's'} to the timeline as Smart Text.` : 'No scenes came back. Complete the contact’s profile in the Personalize window and try again.';
      } catch (err) {
        status.textContent = `Could not build scenes: ${err.message}`;
      }
      b.disabled = false;
    }
  };
  window.addEventListener('remix:contact-changed', draw);
  draw();
  return { redraw: draw, destroy: () => window.removeEventListener('remix:contact-changed', draw) };
}

/**
 * Batch Generator: is every contact ready, then export one video each or
 * share personal links.
 * @param {object} s { contacts(), tokensUsed(), exportEach(), openShare() }
 */
export function renderBatchHub(el, s) {
  const draw = () => {
    const contacts = s.contacts();
    const used = s.tokensUsed();
    const rows = contacts.map((p) => ({ p, missing: used.filter((k) => resolveToken(p, k) == null) }));
    const ready = rows.filter((r) => !r.missing.length).length;
    el.innerHTML = wrap(`
      <p class="pz-hint">One video per contact: their details fill the text and images, and their own voice line plays. ${used.length ? `This video uses ${used.map((k) => `<code>{{${esc(k)}}}</code>`).join(', ')}.` : 'Add {{tokens}} to the video first, or every contact gets the same video.'}</p>
      ${contacts.length ? `
        <div class="pz-card"><span class="pz-label">${ready} of ${contacts.length} contacts ready</span>
          <ul class="rp-list">${rows.map(({ p, missing }) => `<li class="rp-var rp-var--2"><div><strong>${esc(contactName(p))}</strong>${p.source === 'lead-finder' ? '<span class="pz-chip">Lead</span>' : ''}</div>
            ${missing.length ? `<span class="pz-chip pz-chip-warn" title="Missing: ${esc(missing.join(', '))}">missing ${esc(missing.slice(0, 2).join(', '))}${missing.length > 2 ? '…' : ''}</span>` : '<span class="pz-chip">ready</span>'}</li>`).join('')}</ul></div>
        <div class="pz-actions">
          <button type="button" class="pz-btn pz-btn-primary" data-rp="export">Export one video per contact</button>
          <button type="button" class="pz-btn pz-btn-secondary" data-rp="share">Personal links</button>
        </div>`
        : '<p class="pz-hint">No contacts yet. Add them in the Personalize window (Personalization Studio), then come back.</p>'}`);
  };
  el.onclick = (e) => {
    const k = e.target.closest('button')?.dataset.rp;
    if (k === 'export') s.exportEach();
    else if (k === 'share') s.openShare();
  };
  window.addEventListener('remix:contact-changed', draw);
  draw();
  return { redraw: draw, destroy: () => window.removeEventListener('remix:contact-changed', draw) };
}
