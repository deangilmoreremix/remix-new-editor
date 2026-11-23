// src/components/FindMyBrandPage.js
//
// NOTE: this page now opens the standalone Brand Kit modal (components/modals/BrandKitModal.js), not the
// personalization modal it used to open.
//
// Free, signed-out "Find My Brand" (route: #/find-my-brand) — the remix port of
// OpenHiggsBolt's /demo page (src/components/FreeDiscoveryDemo.tsx). It owns no
// discovery UI of its own: it opens the ONE shared personalization modal in
// anonymous mode, where "Find My Brand" runs the free POST /api/demo/discover
// pipeline. The modal opens automatically on arrival, as in OpenHiggsBolt.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function FindMyBrandPage() {
  const container = el('main', 'w-full min-h-full flex flex-col items-center justify-center text-center px-5 py-12 bg-app-bg text-white');

  container.appendChild(el('span', 'text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary mb-3.5', 'SmartVideo — Free Discovery'));
  container.appendChild(el('h1', 'm-0 mb-3.5 text-[clamp(28px,5vw,46px)] leading-[1.1] font-black', 'Find My Brand'));
  container.appendChild(el('p', 'm-0 mb-6 max-w-[560px] text-[15px] leading-relaxed text-secondary',
    'Paste a business website and SmartVideo reads the page it already has — the logo, photos, products and branding found on it, ready to review, then make a video from it. Nothing is generated or charged, and nothing is saved unless you press Save Brand Kit.'));

  const button = el('button', 'min-h-12 px-6 rounded-xl border border-primary bg-primary text-black text-[13px] font-extrabold uppercase tracking-[0.06em] hover:shadow-glow transition-shadow', '✦ Find My Brand');
  button.type = 'button';
  button.dataset.testid = 'free-discovery-open';
  const open = async () => {
    const { openBrandKitModal } = await import('./modals/BrandKitModal.js');
    openBrandKitModal();
  };
  button.addEventListener('click', open);
  container.appendChild(button);

  // Auto-open once on arrival.
  requestAnimationFrame(() => { open().catch((err) => console.error('[FindMyBrand] could not open', err)); });

  return container;
}
