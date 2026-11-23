/**
 * "Sample content" guard. The designs ship with sample testimonials, results, logos and dashboards so they look
 * finished in the editor. None of that is real, so before a page is published the studio lists the sections that
 * still hold the design's own sample content (unchanged since the template) and asks for confirmation.
 */
const PROOF_TYPE = /Quote|Testimonial|Stat|Kpi|Proof|Badge|Table|Panels|Case|Laurel|TrustBar|Logos|Integration|Columns/i;

function flatten(items, out = new Map()) {
  (Array.isArray(items) ? items : []).forEach((c) => {
    if (!c || typeof c.type !== 'string') return;
    const props = c.props || {};
    if (props.id) out.set(props.id, c);
    Object.values(props).forEach((v) => { if (Array.isArray(v) && v.length && v.every((x) => x && typeof x.type === 'string' && x.props)) flatten(v, out); });
    return undefined;
  });
  return out;
}

const withoutNested = (props) => {
  const o = {};
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'id') return;
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x.type === 'string' && x.props)) return;
    o[k] = v;
  });
  return JSON.stringify(o);
};

const isProof = (c, extraTypes) => {
  if (extraTypes.includes(c.type)) return true;
  if (c.type === 'Strip') return ['logos', 'stats'].includes(c.props?.kind);
  return PROOF_TYPE.test(c.type);
};

const titleOf = (c) => String(c.props?.title || c.props?.heading || c.props?.windowTitle || '').replace(/\[\[|\]\]/g, '').slice(0, 60);

/**
 * @param {object} current  the page's page data
 * @param {object} original the template's initial page data
 * @param {string[]} extraTypes component types the template marks as sample-bearing (template.sampleTypes)
 * @returns {{id:string,type:string,title:string}[]} sections whose content is still the design's sample content
 */
export function sampleSections(current, original, extraTypes = []) {
  if (!current || !original) return [];
  const before = flatten(original.content);
  const now = flatten(current.content);
  const out = [];
  now.forEach((c, id) => {
    const o = before.get(id);
    if (!o || o.type !== c.type || !isProof(c, extraTypes)) return;
    if (withoutNested(c.props) === withoutNested(o.props)) out.push({ id, type: c.type, title: titleOf(c) });
  });
  return out;
}
