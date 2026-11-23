// "≈ 0.45 USD" estimate under Generate in the template studios. Best-effort:
// it asks MuAPI's estimate-cost endpoint for the model + duration / resolution
// that Generate would use, and stays hidden if the model can't be priced.
import { createCostLine } from '../components/studio/costEstimate.js';
import { muapi } from './muapi.js';

/**
 * @param {Object} opts
 * @param {() => ({model?: string, settings?: Object} | null)} opts.getRequest
 *        current model id and the video settings Generate would send
 * @param {(params: Object) => Promise<any>} [opts.estimate] override for tests
 */
export function createTemplateCost({ getRequest, estimate = (params) => muapi.estimateV2VCost(params), fallbackUsd = null } = {}) {
  // Templates that carry a known default price (muapi Studio apps) fall back to it
  // when the estimate endpoint can't price the model. It is the price at the app's
  // default settings, so it is shown as an approximate "≈" amount.
  const hasFallback = typeof fallbackUsd === 'number' && Number.isFinite(fallbackUsd) && fallbackUsd >= 0;
  const priced = hasFallback
    ? async (params) => {
        try {
          const data = await estimate(params);
          const cost = typeof data?.cost === 'number' ? data.cost : Number(data?.cost);
          if (Number.isFinite(cost) && cost >= 0) return data;
        } catch { /* fall through to the default price */ }
        // Round up to the next cent: the shared line shows 2 decimals, and 0.045 would otherwise read "0.04".
        return { cost: Math.ceil(fallbackUsd * 100 - 1e-9) / 100, currency: 'USD' };
      }
    : estimate;
  const line = createCostLine({ estimate: priced });
  line.el.title = 'Estimated cost of one generation with these settings';
  line.el.setAttribute('aria-live', 'polite');
  line.el.classList.add('mt-2', 'block', 'text-center');

  function refresh() {
    let req = null;
    try { req = getRequest ? getRequest() : null; } catch { req = null; }
    if (!req || !req.model) { line.refresh(null); return; }
    const s = req.settings || {};
    const payload = { model: req.model, prompt: 'estimate', sound: !!s.native_audio };
    if (s.duration != null) payload.duration = s.duration;
    if (s.resolution) payload.resolution = s.resolution;
    line.refresh(`${req.model}|${s.duration ?? ''}|${s.resolution ?? ''}|${s.native_audio ? 1 : 0}`, payload);
  }

  return { element: line.el, refresh, hide: line.hide };
}
