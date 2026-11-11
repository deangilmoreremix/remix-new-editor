// Small "≈ 5 USD" line beside Generate, ported from upstream's video-to-video
// cost estimate. It is best-effort: any failure (404, bad shape, offline) hides
// the line and stops asking for that model, so it can never block a studio.

export function createCostLine({ estimate }) {
  const el = document.createElement('span');
  el.dataset.costLine = '';
  el.className = 'hidden text-[11px] font-semibold text-white/50 whitespace-nowrap';
  const failed = new Set();
  let timer = null;
  let seq = 0;

  const hide = () => { el.classList.add('hidden'); el.textContent = ''; };

  /** @param {string|null} key identifies the request (model); pass null to clear. */
  function refresh(key, params) {
    clearTimeout(timer);
    seq += 1;
    if (!key || failed.has(key)) { hide(); return; }
    const mine = seq;
    timer = setTimeout(async () => {
      try {
        const data = await estimate(params);
        if (mine !== seq) return;
        const cost = typeof data?.cost === 'number' ? data.cost : Number(data?.cost);
        if (!Number.isFinite(cost) || cost < 0) throw new Error('bad cost');
        const currency = typeof data?.currency === 'string' ? data.currency.toUpperCase() : 'credits';
        el.textContent = `≈ ${Number(cost.toFixed(2))} ${currency}`;
        el.classList.remove('hidden');
      } catch {
        failed.add(key);
        if (mine === seq) hide();
      }
    }, 400);
  }

  return { el, refresh, hide };
}
