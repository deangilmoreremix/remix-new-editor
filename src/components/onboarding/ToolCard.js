// src/components/onboarding/ToolCard.js
// One tool in the onboarding picker: its thumbnail, name and one-line description. Toggles on click.
import { createThumbnailImg } from '../../lib/thumbnails.js';
import { el, card, svg, ICONS } from './ui.js';

/** ToolCard(tool, { selected, recommended, onToggle }) -> HTMLButtonElement (call .refresh(selected) to restyle). */
export function ToolCard(tool, { selected = false, recommended = false, onToggle = () => {} } = {}) {
  const b = el('button', '');
  b.type = 'button';
  b.setAttribute('data-onb-tool', tool.id);

  const thumb = el('div', 'relative aspect-video w-full overflow-hidden rounded-t-2xl bg-white/[0.04]');
  if (tool.thumb) {
    const img = createThumbnailImg(tool.thumb, tool.name, 'h-full w-full object-cover');
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

  const text = el('div', 'flex flex-col gap-1 p-4');
  text.append(el('div', 'text-[15px] font-bold', tool.name), el('p', 'text-[13px] leading-snug text-white/55', tool.description));
  b.append(thumb, text);

  b.refresh = (on) => {
    b.className = `${card(on)} flex flex-col overflow-hidden`;
    b.setAttribute('aria-pressed', String(on));
    tick.style.display = on ? '' : 'none';
  };
  b.refresh(selected);
  b.addEventListener('click', () => onToggle(tool.id));
  return b;
}
