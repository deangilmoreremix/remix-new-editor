/**
 * Generic host composition for catalog COMPONENTS. The catalog's mount contract is: a host document has a root composition and a clip
 * element carrying `data-composition-src` (+ timing and optional `data-variable-values`); the component file is a <template> that the host
 * clones in, and it fills the clip box. This builds that host in code (nothing from the customer is interpolated except validated numbers
 * and a catalog id), so one component can be mounted through the same nested-composition loader that runs the starter projects.
 */
const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const dim = (v, d) => (Number.isFinite(+v) && +v >= 16 && +v <= 8192 ? Math.round(+v) : d);

export const HOST_INSTANCE_ID = 'inst';

export function componentHostHtml({ id, duration, width = 1920, height = 1080 }) {
  if (!ID.test(String(id))) throw new Error('invalid component id');
  const d = Number.isFinite(+duration) && +duration > 0 && +duration <= 600 ? +duration : 5;
  const w = dim(width, 1920), h = dim(height, 1080);
  return `<!doctype html><html><body><div id="root" data-composition-id="hf-host" data-start="0" data-duration="${d}" data-width="${w}" data-height="${h}" style="position:relative;width:${w}px;height:${h}px;overflow:hidden">` +
    `<div id="${HOST_INSTANCE_ID}" class="clip" data-composition-id="${id}" data-composition-src="${id}.html" data-start="0" data-duration="${d}" data-track-index="0" data-width="${w}" data-height="${h}" style="position:absolute;inset:0"></div></div>` +
    `<script>window.__timelines=window.__timelines||{};window.__timelines["hf-host"]=gsap.timeline({paused:true});</script></body></html>`;
}

/** Customer `var.<id>` overrides address the component's own variables: route them to the generated host's single instance. */
export function routeVarsToInstance(overrides, instanceId = HOST_INSTANCE_ID) {
  const out = {};
  for (const [k, v] of Object.entries(overrides || {})) out[k.startsWith('var.') ? `ivar.${instanceId}.${k.slice(4)}` : k] = v;
  return out;
}
