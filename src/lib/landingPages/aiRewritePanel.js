// src/lib/landingPages/aiRewritePanel.js
//
// "Write with AI" for a whole page (or one section): the same panel in the Studio and in the picker's editor.
// It changes WORDS only (see rewrite.js), shows every proposed change with a checkbox, and can undo.
// The business line is remembered per page and shared with the per-field "Write with AI" buttons.
import { sectionList, proposeRewrite, applyChanges, revertChanges } from './rewrite.js';
import { readBrief, saveBrief } from './editor/tokenFields.jsx';

const INPUT = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
const FALLBACK = {
  wrap: 'border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.04);color:#a1a1aa;font-size:12px',
  input: 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:8px 10px;font-size:13px',
  primary: 'background:transparent;border:1px solid var(--lp-accent,#d9ff00);color:var(--lp-accent,#d9ff00);border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer',
  ghost: 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer',
};

function el(tag, className, text, style) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (style) n.style.cssText = style;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** Pure: the instruction sent to the AI, from the business line and what the user typed. */
export function buildInstruction(brief, typed) {
  const b = String(brief || '').trim();
  const t = String(typed || '').trim();
  return [b ? `About the business: ${b}.` : '', t].filter(Boolean).join(' ').slice(0, 600);
}

/**
 * @param {object} o
 * @param {() => object} o.getData      the page's editor data right now
 * @param {(d: object) => void} o.setData  apply new data (the caller re-mounts its editor)
 * @param {string} [o.context]          page title / design, sent as context
 * @param {string} [o.pageId]           key for the remembered business line
 * @param {Function} [o.propose]        test hook
 */
export function createAiRewritePanel({ getData, setData, context = '', pageId = 'draft', propose = proposeRewrite }) {
  const wrap = el('details', 'rounded-xl border border-white/10 bg-white/5 text-xs text-secondary', undefined, FALLBACK.wrap);
  wrap.dataset.aiRewritePanel = '';
  const sum = el('summary', 'cursor-pointer select-none px-3 py-2 font-bold text-primary', 'Write the page with AI', 'cursor:pointer;padding:8px 12px;font-weight:800;color:var(--lp-accent,#d9ff00)');
  const body = el('div', 'flex flex-col gap-2 p-3', undefined, 'display:flex;flex-direction:column;gap:8px;padding:12px');
  const brief = el('input', INPUT, undefined, FALLBACK.input);
  brief.placeholder = 'About your business (remembered): e.g. family plumber in Reno, 24/7 emergency calls';
  brief.maxLength = 300;
  brief.dataset.aiBrief = '';
  brief.setAttribute('aria-label', 'About your business');
  brief.value = readBrief({ id: pageId });
  const row = el('div', 'flex flex-wrap items-end gap-2', undefined, 'display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end');
  const scope = el('select', INPUT, undefined, FALLBACK.input);
  scope.dataset.aiScope = '';
  const fillScope = () => {
    scope.replaceChildren();
    const all = el('option', '', 'Whole page'); all.value = ''; scope.appendChild(all);
    sectionList(getData()).forEach((sec) => { if (!sec.count) return; const o = el('option', '', `${sec.index + 1}. ${sec.label} (${sec.count} texts)`); o.value = String(sec.index); scope.appendChild(o); });
  };
  fillScope();
  wrap.addEventListener('toggle', fillScope);
  const instr = el('input', `${INPUT} flex-1 min-w-[16rem]`, undefined, `${FALLBACK.input};flex:1;min-width:16rem`);
  instr.placeholder = 'What should change? e.g. friendlier, for dentists in Texas, shorter (optional)';
  instr.maxLength = 300;
  instr.dataset.aiInstruction = '';
  const run = el('button', 'rounded-lg bg-primary px-3 py-2 font-bold text-black', 'Write it', FALLBACK.primary);
  run.type = 'button'; run.dataset.aiRun = '';
  const undo = el('button', 'rounded-lg border border-white/20 px-3 py-2 font-bold', 'Undo', FALLBACK.ghost);
  undo.type = 'button'; undo.hidden = true; undo.dataset.aiUndo = '';
  row.append(scope, instr, run, undo);
  const out = el('div', 'flex flex-col gap-2', undefined, 'display:flex;flex-direction:column;gap:8px');
  out.dataset.aiOut = '';
  body.append(
    el('p', '', 'Writes the words only (headlines, buttons, text, names, quotes, numbers) from what you say about your business. Sections, layout, links, images and form fields stay exactly as they are. You review every change before it is applied.', 'margin:0'),
    brief, row, out,
  );
  wrap.append(sum, body);

  let before = null;
  const preview = (changes, skipped) => {
    out.replaceChildren();
    if (!changes.length) { out.appendChild(el('p', 'text-amber-300', 'The AI returned nothing usable. Try a different instruction.', 'margin:0;color:#fcd34d')); return; }
    const list = el('div', 'flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 p-2', undefined, 'display:flex;flex-direction:column;gap:4px;max-height:288px;overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px');
    const boxes = [];
    changes.forEach((c) => {
      const line = el('label', 'flex cursor-pointer items-start gap-2 rounded p-1 hover:bg-white/5', undefined, 'display:flex;gap:8px;align-items:flex-start;cursor:pointer;padding:4px');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = true; boxes.push([cb, c]);
      const t = el('div', 'min-w-0', undefined, 'min-width:0');
      t.append(el('div', 'text-secondary/70 line-through break-words', c.text, 'text-decoration:line-through;opacity:.6;word-break:break-word'), el('div', 'text-primary break-words', c.after, 'color:var(--lp-accent,#d9ff00);word-break:break-word'));
      line.append(cb, t); list.appendChild(line);
    });
    const acts = el('div', 'flex flex-wrap items-center gap-2', undefined, 'display:flex;flex-wrap:wrap;gap:8px;align-items:center');
    const apply = el('button', 'rounded-lg bg-primary px-3 py-2 font-bold text-black', `Apply ${changes.length} change${changes.length === 1 ? '' : 's'}`, FALLBACK.primary);
    apply.type = 'button'; apply.dataset.aiApply = '';
    const cancel = el('button', 'rounded-lg border border-white/20 px-3 py-2 font-bold', 'Discard', FALLBACK.ghost);
    cancel.type = 'button';
    cancel.addEventListener('click', () => out.replaceChildren());
    apply.addEventListener('click', () => {
      const chosen = boxes.filter(([cb]) => cb.checked).map(([, c]) => c);
      if (!chosen.length) { out.replaceChildren(); return; }
      const current = getData();
      const fresh = chosen.filter((c) => { let n = current; for (let i = 0; i < c.path.length - 1; i += 1) n = n?.[c.path[i]]; return n && n[c.path[c.path.length - 1]] === c.text; });
      before = fresh;
      setData(applyChanges(current, fresh));
      const stale = chosen.length - fresh.length;
      out.replaceChildren(el('p', 'text-emerald-300', `Applied ${fresh.length} change${fresh.length === 1 ? '' : 's'}${stale ? ` (${stale} skipped: that text was edited meanwhile)` : ''}. Save to keep them.`, 'margin:0;color:#6ee7b7'));
      undo.hidden = false;
      fillScope();
      wrap.open = false;   // give the editor its room back; open the panel again to undo
    });
    acts.append(apply, cancel);
    if (skipped) acts.appendChild(el('span', 'text-secondary/70', `${skipped} text${skipped === 1 ? '' : 's'} kept as they were (the AI broke a {{token}} or marker).`));
    out.append(list, acts);
  };
  run.addEventListener('click', async () => {
    const idx = scope.value === '' ? null : Number(scope.value);
    saveBrief({ id: pageId }, brief.value);
    run.disabled = true; run.textContent = 'Writing…'; out.replaceChildren();
    try {
      const r = await propose(getData(), { section: idx, instruction: buildInstruction(brief.value, instr.value), context });
      preview(r.changes, r.skipped);
    } catch (err) {
      out.replaceChildren(el('p', 'text-red-300', err.message || 'The AI writer failed.', 'margin:0;color:#fca5a5'));
    } finally { run.disabled = false; run.textContent = 'Write it'; }
  });
  undo.addEventListener('click', () => {
    if (!before) return;
    setData(revertChanges(getData(), before)); before = null; undo.hidden = true; fillScope();
    out.replaceChildren(el('p', 'text-secondary', 'Restored the text from before.', 'margin:0'));
  });
  return wrap;
}
