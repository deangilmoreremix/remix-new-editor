// Page script for the Edit Studio guide's apps gallery (markup: renderGuide.js, appsShowcase()).
// Search, category filter, and a preview dialog that opens the real Edit Studio tool UI in an iframe
// (/edit-preview?tool=app-<id>, see src/main.js). The preview never generates anything.

/** @param {HTMLElement} root  the guide page root */
export function wireAppShowcase(root) {
  const section = root.querySelector('#apps');
  const dialog = section?.querySelector('[data-app-preview]');
  if (!section || !dialog) return () => {};

  const cards = [...section.querySelectorAll('[data-app-slug]')];
  const groups = [...section.querySelectorAll('[data-app-group]')];
  const chips = [...section.querySelectorAll('[data-app-cat]')];
  const search = section.querySelector('[data-app-search]');
  const empty = section.querySelector('[data-app-empty]');
  const frame = dialog.querySelector('[data-pv-frame]');
  const titleEl = dialog.querySelector('[data-pv-title]');
  const countEl = dialog.querySelector('[data-pv-count]');
  const openLink = dialog.querySelector('[data-pv-open]');
  const closeBtn = dialog.querySelector('[data-pv-close]');
  let category = 'all';
  let current = -1;
  let opener = null;

  const visibleCards = () => cards.filter((c) => !c.hidden);

  function applyFilter() {
    const q = (search?.value || '').trim().toLowerCase();
    for (const c of cards) {
      const inCat = category === 'all' || c.closest('[data-app-group]')?.dataset.appGroup === category;
      c.hidden = !(inCat && (!q || c.dataset.appText.includes(q)));
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-app-slug]:not([hidden])');
    if (empty) empty.hidden = visibleCards().length > 0;
  }

  chips.forEach((chip) => chip.addEventListener('click', () => {
    category = chip.dataset.appCat;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    applyFilter();
  }));
  search?.addEventListener('input', applyFilter);

  function show(card) {
    const list = visibleCards();
    current = list.indexOf(card);
    const slug = card.dataset.appSlug;
    titleEl.textContent = card.dataset.appName;
    countEl.textContent = list.length > 1 ? `${current + 1} of ${list.length}` : '';
    openLink.href = `/?tool=${encodeURIComponent(slug)}#/edit`;
    frame.src = `/edit-preview?tool=${encodeURIComponent(slug)}`;
  }

  function open(card) {
    opener = card;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    show(card);
    closeBtn.focus();
  }

  function close() {
    dialog.hidden = true;
    frame.removeAttribute('src');
    document.body.style.overflow = '';
    current = -1;
    opener?.focus?.();
  }

  function step(delta) {
    const list = visibleCards();
    if (!list.length || current < 0) return;
    show(list[(current + delta + list.length) % list.length]);
  }

  cards.forEach((card) => card.addEventListener('click', () => open(card)));
  closeBtn.addEventListener('click', close);
  dialog.querySelector('[data-pv-prev]').addEventListener('click', () => step(-1));
  dialog.querySelector('[data-pv-next]').addEventListener('click', () => step(1));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  const onKey = (e) => {
    if (dialog.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') {
      // Keep keyboard focus inside the dialog while it is open.
      const f = [...dialog.querySelectorAll('button, a[href]')].filter((el) => !el.hidden);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  // The preview frame reports Esc (keys pressed inside it do not reach this page).
  const onMessage = (e) => {
    if (e.origin === window.location.origin && e.data?.source === 'sv-edit-preview' && e.data.type === 'close' && !dialog.hidden) close();
  };
  window.addEventListener('message', onMessage);

  // Deep link: /studios/edit-studio#app-<id> (or ?app=<id>) opens that app's preview.
  const wanted = new URLSearchParams(window.location.search).get('app');
  if (wanted) {
    const card = cards.find((c) => c.dataset.appSlug === `app-${wanted}`);
    if (card) open(card);
  }

  return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('message', onMessage); document.body.style.overflow = ''; };
}
