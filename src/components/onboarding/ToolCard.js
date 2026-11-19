// src/components/onboarding/ToolCard.js
// One studio in the onboarding picker: its screenshot, name and one-line description. Click (or Enter / Space)
// selects it; the "Open" link goes straight to the studio (it is a real link, so it also works in a new tab).
import { el, card, svg, ICONS } from './ui.js';

/**
 * ToolCard(tool, { selected, recommended, onToggle(id), onOpen(id) }) -> HTMLElement
 * (call .refresh(selected) to restyle it).
 */
export function ToolCard(tool, { selected = false, recommended = false, onToggle = () => {}, onOpen = null } = {}) {
  const b = el('div', '');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.setAttribute('data-onb-tool', tool.id);

  const thumb = el('div', 'relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl bg-white/[0.04]');
  if (tool.thumb) {
    const img = document.createElement('img');
    img.alt = `${tool.name} screenshot`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.className = 'h-full w-full object-cover object-top';
    let triedFallback = false;
    img.onerror = () => {
      if (!triedFallback && tool.fallback && !img.src.endsWith(tool.fallback)) { triedFallback = true; img.src = tool.fallback; return; }
      img.style.display = 'none';
      thumb.classList.add('thumb-fallback');
    };
    img.src = tool.thumb;
    thumb.appendChild(img);
  } else {
    const icon = el('div', 'grid h-full w-full place-items-center text-white/40');
    icon.innerHTML = tool.icon;
    thumb.appendChild(icon);
  }
  const tick = el('span', 'absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-black');
  tick.innerHTML = svg(ICONS.check, 14);
  thumb.appendChild(tick);
  if (recommended) thumb.appendChild(el('span', 'absolute left-2 top-2 rounded-full bg-black px-2.5 py-0.5 text-[11px] font-bold text-primary ring-1 ring-primary/40', 'Recommended'));

  const text = el('div', 'flex flex-1 flex-col gap-1 p-4');
  const row = el('div', 'flex items-start justify-between gap-2');
  row.append(el('div', 'text-[15px] font-bold', tool.name));
  if (tool.href) {
    const open = el('a', 'shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-white/55 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50', 'Open ↗');
    open.href = tool.href;
    open.setAttribute('data-onb-open', tool.id);
    open.setAttribute('aria-label', `Open ${tool.name}`);
    open.addEventListener('click', (e) => {
      e.stopPropagation(); // do not also toggle the card
      if (onOpen && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onOpen(tool.id); }
    });
    row.append(open);
  }
  text.append(row, el('p', 'text-[13px] leading-snug text-white/55', tool.description));
  b.append(thumb, text);

  b.refresh = (on) => {
    b.className = `${card(on)} flex cursor-pointer flex-col overflow-hidden`;
    b.setAttribute('aria-pressed', String(on));
    tick.style.display = on ? '' : 'none';
  };
  b.refresh(selected);
  b.addEventListener('click', () => onToggle(tool.id));
  b.addEventListener('keydown', (e) => {
    if (e.target !== b) return; // the Open link handles its own keys
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(tool.id); }
  });
  return b;
}
