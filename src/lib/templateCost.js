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
export function createTemplateCost({ getRequest, estimate = (params) => muapi.estimateV2VCost(params) } = {}) {
  const line = createCostLine({ estimate });
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
