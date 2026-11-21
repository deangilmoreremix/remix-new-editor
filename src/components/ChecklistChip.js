// src/components/ChecklistChip.js
//
// "Get started 2/4" in the header: a small outline button that opens a popover with the four first steps
// (src/lib/onboarding/checklist.js). The popover is a plain group, not a dialog, so guided tours do not treat it as
// a blocking modal. It hides itself when all four are done or the person hides it.
import { CHECKLIST_ITEMS, checklistAction, checklistState, checklistVisible, dismissChecklist, installChecklistListeners } from '../lib/onboarding/checklist.js';
import { FAVORITES_EVENT } from '../lib/onboarding/store.js';
import { currentUserId } from '../lib/onboarding/yourStudios.js';

const el = (tag, cls = '', txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

export function createChecklistChip(navigate) {
  installChecklistListeners(currentUserId);
  const wrap = el('div', 'relative hidden');
  wrap.setAttribute('data-checklist', '');
  const chip = el('button', 'h-8 rounded-full border border-white/15 bg-transparent px-3 text-xs font-bold text-secondary whitespace-nowrap hover:text-white hover:border-white/30 transition-colors');
  chip.type = 'button';
  chip.setAttribute('data-checklist-chip', '');
  chip.setAttribute('aria-expanded', 'false');
  const pop = el('div', 'absolute right-0 top-10 z-[60] hidden w-72 rounded-2xl border border-white/10 bg-[#0b0c10] p-3 text-white shadow-2xl');
  pop.setAttribute('role', 'group');
  pop.setAttribute('aria-label', 'Get started');
  pop.setAttribute('data-checklist-popover', '');
  wrap.append(chip, pop);

  const close = () => { pop.classList.add('hidden'); chip.setAttribute('aria-expanded', 'false'); };
  const open = () => { pop.classList.remove('hidden'); chip.setAttribute('aria-expanded', 'true'); };

  function render() {
    const uid = currentUserId();
    const state = checklistState(uid);
    if (!checklistVisible(uid, state)) { wrap.classList.add('hidden'); close(); return; }
    wrap.classList.remove('hidden');
    chip.replaceChildren(el('span', 'hidden sm:inline', 'Get started '), el('span', 'text-primary', `${state.done}/${state.total}`)); // phones: just the count
    chip.setAttribute('aria-label', `Get started, ${state.done} of ${state.total} done`);
    pop.replaceChildren(el('div', 'px-1 pb-2 text-sm font-bold', 'Get started'));
    state.items.forEach((item) => {
      const row = el('div', 'flex items-center gap-2 rounded-xl px-2 py-2 text-sm');
      row.setAttribute('data-checklist-item', item.id);
      row.setAttribute('data-done', String(item.done));
      const mark = el('span', `grid h-5 w-5 flex-none place-items-center rounded-full border ${item.done ? 'border-primary text-primary' : 'border-white/20 text-transparent'}`);
      mark.innerHTML = CHECK;
      row.appendChild(mark);
      if (item.done) {
        row.appendChild(el('span', 'text-white/45 line-through', item.label));
      } else {
        const go = el('button', 'flex-1 text-left font-semibold text-white hover:text-primary', item.label);
        go.type = 'button';
        go.setAttribute('data-checklist-go', item.id);
        go.addEventListener('click', () => {
          close();
          const a = checklistAction(item.id, uid);
          if (a.kind === 'settings') window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'settings' } }));
          else navigate(a.route);
        });
        row.appendChild(go);
      }
      pop.appendChild(row);
    });
    const hide = el('button', 'mt-2 px-1 text-xs font-semibold text-white/45 underline-offset-2 hover:text-white hover:underline', 'Hide this');
    hide.type = 'button';
    hide.setAttribute('data-checklist-hide', '');
    hide.addEventListener('click', async () => { close(); wrap.classList.add('hidden'); await dismissChecklist(uid); render(); });
    pop.appendChild(hide);
  }

  chip.addEventListener('click', () => (pop.classList.contains('hidden') ? open() : close()));
  const onKey = (e) => { if (e.key === 'Escape' && !pop.classList.contains('hidden')) { close(); chip.focus(); } };
  const onDoc = (e) => { if (!pop.classList.contains('hidden') && !wrap.contains(e.target)) close(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onDoc);
  ['generation:saved', 'landing:published', FAVORITES_EVENT, 'app:route-ready', 'focus', 'muapi:job-finished'].forEach((ev) => window.addEventListener(ev, render));
  render();
  return { element: wrap, refresh: render, ids: CHECKLIST_ITEMS.map((i) => i.id) };
}
