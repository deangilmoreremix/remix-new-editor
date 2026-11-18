/**
 * "Personalize for" panel shared by the landing page picker and the Video Pages "New page" screen.
 *   const cp = createCustomerPanel({ loadCustomers });  host.append(cp.el);  cp.load();
 *   cp.selected()  chosen customers      cp.brand()  write-brand option (only meaningful with exactly one customer)
 * The active customer (current Personalize client / selected contact) is pre-selected.
 */
import { loadCustomers as defaultLoad } from './customerSources.js';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function createCustomerPanel({ loadCustomers = defaultLoad, onChange, preselect = 'active' } = {}) {
  const cust = { list: [], chosen: new Set(), brand: true, image: true, loaded: false };
  const panel = el('div');
  panel.dataset.customerPanel = '';
  const selected = () => cust.list.filter((c) => cust.chosen.has(c.id));
  const changed = () => { try { onChange?.(); } catch { /* caller bug */ } };

  function fill() {
    panel.replaceChildren();
    panel.style.cssText = 'border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px 14px;margin-bottom:14px;background:rgba(255,255,255,.04)';
    const head = el('div', '', 'Personalize for');
    head.style.cssText = 'font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.8;margin-bottom:6px';
    panel.appendChild(head);
    if (!cust.loaded) { panel.appendChild(el('div', 'text-xs text-secondary', 'Looking for your customers\u2026')); return; }
    if (!cust.list.length) {
      panel.appendChild(el('div', 'text-xs text-secondary', 'No customer found yet. Add one in the Personalization window (Find your business) and it appears here with their logo, colours and details.'));
      return;
    }
    const none = el('label');
    none.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:4px;cursor:pointer';
    const noneBox = el('input'); noneBox.type = 'checkbox'; noneBox.checked = cust.chosen.size === 0; noneBox.dataset.customerNone = '';
    noneBox.addEventListener('change', () => { cust.chosen = new Set(); fill(); changed(); });
    none.append(noneBox, el('span', '', 'Nobody (plain design)'));
    panel.appendChild(none);
    const list = el('div'); list.dataset.customerList = ''; list.style.cssText = 'max-height:140px;overflow:auto;display:grid;gap:4px';
    cust.list.forEach((c) => {
      const row = el('label'); row.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer';
      const box = el('input'); box.type = 'checkbox'; box.checked = cust.chosen.has(c.id); box.dataset.customerId = c.id;
      box.addEventListener('change', () => { if (box.checked) cust.chosen.add(c.id); else cust.chosen.delete(c.id); fill(); changed(); });
      const sub = [c.tokens.firstname && `${c.tokens.firstname} ${c.tokens.lastname}`.trim(), c.tokens.city, c.source === 'lead' ? 'lead' : ''].filter(Boolean).join(' \u00b7 ');
      row.append(box, el('span', '', c.label), el('span', 'text-xs text-secondary', sub));
      list.appendChild(row);
    });
    panel.appendChild(list);
    const n = cust.chosen.size;
    const brandRow = el('label'); brandRow.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:12px;margin-top:8px;cursor:pointer;opacity:' + (n === 1 ? '1' : '.5');
    const brandBox = el('input'); brandBox.type = 'checkbox'; brandBox.checked = cust.brand && n === 1; brandBox.disabled = n !== 1; brandBox.dataset.customerBrand = '';
    brandBox.addEventListener('change', () => { cust.brand = brandBox.checked; changed(); });
    brandRow.append(brandBox, el('span', '', 'Write their logo, colour, name and details into the page'));
    panel.appendChild(brandRow);
    const only = n === 1 ? selected()[0] : null;
    if (only?.image) {
      const imgRow = el('label'); imgRow.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:12px;margin-top:6px;cursor:pointer';
      const imgBox = el('input'); imgBox.type = 'checkbox'; imgBox.checked = cust.image; imgBox.dataset.customerImage = '';
      imgBox.addEventListener('change', () => { cust.image = imgBox.checked; changed(); });
      const thumb = el('img'); thumb.src = only.image; thumb.alt = ''; thumb.style.cssText = 'width:28px;height:28px;border-radius:6px;object-fit:cover';
      imgRow.append(imgBox, thumb, el('span', '', 'Use their personalized image in the video slot'));
      panel.appendChild(imgRow);
    }
    panel.appendChild(el('div', 'text-xs text-secondary', n === 0 ? 'The design is used as is.' : n === 1 ? 'A personal link is made for them, so their name, company and city fill in on the page.' : `One page, ${n} personal links (their own name, company and city on each). The page itself stays generic.`));
  }

  const load = () => Promise.resolve(loadCustomers()).then((r) => {
    cust.list = r?.customers || [];
    const active = cust.list.find((c) => c.id === r?.activeId) || (cust.list.length === 1 ? cust.list[0] : null);
    cust.chosen = new Set(preselect === 'all' ? cust.list.map((c) => c.id) : Array.isArray(preselect) ? cust.list.filter((c) => preselect.includes(c.id)).map((c) => c.id) : active ? [active.id] : []);
  }).catch(() => { cust.list = []; }).finally(() => { cust.loaded = true; if (panel.isConnected) fill(); changed(); });

  fill();
  return { el: panel, load, selected, brand: () => cust.brand && cust.chosen.size === 1, useImage: () => cust.image, fill };
}
