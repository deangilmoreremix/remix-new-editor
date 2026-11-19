// src/components/onboarding/ToolCard.js
// One studio in the onboarding picker (src/styles/onboarding.css): its screenshot, name and one-line
// description. Click (or Enter / Space) selects it; "Open" goes straight to the studio (a real link, so it also
// works in a new tab).
import { el, svg, ICONS } from './obIcons.js';

/**
 * ToolCard(tool, { selected, recommended, onToggle(id), onOpen(id) }) -> HTMLElement
 * (call .refresh(selected) to restyle it).
 */
export function ToolCard(tool, { selected = false, recommended = false, onToggle = () => {}, onOpen = null } = {}) {
  const b = el('div', 'ob-tool');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.setAttribute('data-onb-tool', tool.id);

  const thumb = el('div', 'ob-tool-img');
  if (tool.thumb) {
    const img = document.createElement('img');
    img.alt = `${tool.name} screenshot`;
    img.loading = 'lazy';
    img.decoding = 'async';
    let triedFallback = false;
    img.onerror = () => {
      if (!triedFallback && tool.fallback && !img.src.endsWith(tool.fallback)) { triedFallback = true; img.src = tool.fallback; return; }
      img.style.display = 'none';
      thumb.classList.add('thumb-fallback');
    };
    img.src = tool.thumb;
    thumb.appendChild(img);
  }
  const tick = el('span', 'ob-tick');
  tick.innerHTML = svg(ICONS.check, 14);
  thumb.appendChild(tick);
  if (recommended) thumb.appendChild(el('span', 'ob-rec', 'Recommended'));

  const body = el('div', 'ob-tool-body');
  const row = el('div', 'ob-tool-row');
  row.append(el('div', 'ob-tool-name', tool.name));
  if (tool.href) {
    const open = el('a', 'ob-open', 'Open ↗');
    open.href = tool.href;
    open.setAttribute('data-onb-open', tool.id);
    open.setAttribute('aria-label', `Open ${tool.name}`);
    open.addEventListener('click', (e) => {
      e.stopPropagation(); // do not also toggle the card
      if (onOpen && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onOpen(tool.id); }
    });
    row.append(open);
  }
  body.append(row, el('p', 'ob-tool-desc', tool.description));
  b.append(thumb, body);

  b.refresh = (on) => b.setAttribute('aria-pressed', String(on));
  b.refresh(selected);
  b.addEventListener('click', () => onToggle(tool.id));
  b.addEventListener('keydown', (e) => {
    if (e.target !== b) return; // the Open link handles its own keys
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(tool.id); }
  });
  return b;
}
