/**
 * Customer profiles for landing pages.
 *
 * The Personalization modal, Lead Finder, Brand DNA, website research and the contact store all hold facts about the
 * customer a page is for. This module turns any of them into ONE normalized shape and applies it to a page:
 *
 *   normalizeCustomer(raw, kind)   kind: 'client' | 'profile' | 'lead' | 'brand' | 'research'
 *   mergeCustomer(a, b)            richest value wins; `b` only fills gaps
 *   dedupeCustomers(list)          same id, or same business/person name, becomes one entry
 *   customerTokens(c)              the public page tokens ({{firstname}}, {{company}}, {{companylogo}}, ...)
 *   toContactFields(c)             a page contact row (email included; it stays owner-only)
 *   applyCustomerToPuck(data, c)   write brand name/logo/colour/links into a page's data (pure, returns what changed)
 *
 * Pure functions, no storage or network: each app gathers the raw records (customerSources.js / useCustomers.ts).
 * Everything is clipped and checked here (https logos only, valid colours, no scripts in links).
 */

const clip = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const first = (...vals) => vals.map((v) => clip(v)).find(Boolean) || '';
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const httpsUrl = (v) => { const s = clip(v, 2048); return /^https:\/\/[^\s"'<>()\\]+$/i.test(s) ? s : ''; };
export const hexColor = (v) => { const s = clip(v, 9); return HEX.test(s) ? s : ''; };
/** A website as an https link (adds https:// to a bare domain). */
export function websiteUrl(v) {
  const s = clip(v, 2048);
  if (!s) return '';
  if (/^https:\/\//i.test(s)) return httpsUrl(s);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s) ? httpsUrl(`https://${s}`) : '';
}
export const phoneNumber = (v) => { const s = clip(v, 40).replace(/[^\d+()\-.\s]/g, '').trim(); return /\d{6,}/.test(s.replace(/\D/g, '')) ? s : ''; };
const emailOk = (v) => { const s = clip(v, 254); return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(s) ? s : ''; };

function splitName(name) {
  const parts = clip(name, 120).split(/\s+/).filter(Boolean);
  return { firstname: parts[0] || '', lastname: parts.length > 1 ? parts.slice(1).join(' ') : '' };
}

const empty = () => ({
  id: '', label: '', source: '',
  tokens: { firstname: '', lastname: '', company: '', companylogo: '', role: '', city: '' },
  email: '',
  image: '', // the customer's personalized picture (from their saved Personalization projects), https only
  business: { name: '', industry: '', phone: '', website: '', offer: '', cta: '', ctaHeadline: '', description: '', location: '', tagline: '' },
  brand: { accent: '', logoUrl: '' },
});

function finish(c, source, rawId) {
  c.source = source;
  c.id = clip(rawId, 80) || `${source}:${(c.business.name || c.tokens.company || `${c.tokens.firstname} ${c.tokens.lastname}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
  c.business.name = c.business.name || c.tokens.company;
  c.tokens.company = c.tokens.company || c.business.name;
  c.brand.logoUrl = c.brand.logoUrl || c.tokens.companylogo;
  c.tokens.companylogo = c.tokens.companylogo || c.brand.logoUrl;
  c.label = c.business.name || `${c.tokens.firstname} ${c.tokens.lastname}`.trim() || c.email || 'Customer';
  const useful = c.business.name || c.tokens.firstname || c.tokens.company || c.email;
  return useful ? c : null;
}

const logoFromAssets = (assets) => httpsUrl(assets?.primaryLogo?.uploadedUrl) || httpsUrl(assets?.primaryLogo?.url) || httpsUrl(assets?.logos?.[0]?.uploadedUrl) || httpsUrl(assets?.logos?.[0]?.url);
const accentFrom = (colors) => hexColor(colors?.primary) || hexColor(colors?.accent) || hexColor(colors?.palette?.[0]) || hexColor(Array.isArray(colors) ? colors[0] : '');

/**
 * @param {object} raw a stored record
 * @param {'client'|'profile'|'lead'|'brand'|'research'|'contact'} kind
 * @param {{assets?: object, brandColors?: object}} [extra] logo library / colours kept beside the record
 * @returns {object|null} normalized customer or null when it holds nothing usable
 */
export function normalizeCustomer(raw, kind, extra = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const c = empty();
  const logo = logoFromAssets(extra.assets);
  const accent = accentFrom(extra.brandColors);
  if (kind === 'client') {
    const n = splitName(raw.name);
    Object.assign(c.tokens, { firstname: n.firstname, lastname: n.lastname, company: first(raw.businessName), city: first(raw.location) });
    Object.assign(c.business, { name: first(raw.businessName), industry: first(raw.industry), phone: phoneNumber(raw.phone), website: websiteUrl(raw.website), offer: first(raw.offer, raw.productService), cta: first(raw.callToAction), ctaHeadline: first(raw.ctaHeadline), description: first(raw.brandDescription, 400), location: first(raw.location) });
    c.email = emailOk(raw.email);
    c.brand = { accent, logoUrl: logo };
    c.tokens.companylogo = logo;
    return finish(c, 'client', raw.id);
  }
  if (kind === 'profile') {
    const ct = raw.contact || {}; const biz = raw.personalization?.business || {}; const co = raw.company || {};
    const name = splitName(first(ct.name, raw.name));
    Object.assign(c.tokens, { firstname: first(ct.firstName, name.firstname), lastname: first(ct.lastName, name.lastname), company: first(ct.company, biz.businessName, co.name), role: first(ct.title), city: first(ct.location, biz.location) });
    Object.assign(c.business, { name: first(biz.businessName, co.name, ct.company), industry: first(biz.industry, co.industry), phone: phoneNumber(first(biz.phone, ct.phone)), website: websiteUrl(first(biz.website, raw.website?.url, raw.social?.website)), offer: first(biz.offer, biz.productService), cta: first(biz.callToAction), ctaHeadline: first(biz.ctaHeadline), description: first(biz.brandDescription, co.summary, 400), location: first(biz.location, ct.location) });
    c.email = emailOk(first(ct.email, biz.email));
    c.brand = { accent: accent || hexColor(raw.brand?.colors?.primary), logoUrl: logo || httpsUrl(raw.assets?.logos?.[0]?.url) || httpsUrl(raw.assets?.logos?.[0]) || httpsUrl(raw.variables?.logoUrl) };
    c.tokens.companylogo = c.brand.logoUrl;
    return finish(c, 'profile', raw.id);
  }
  if (kind === 'lead') {
    const b = raw.business && typeof raw.business === 'object' ? raw.business : raw;
    Object.assign(c.tokens, { company: first(b.name), city: first(b.city, b.region) });
    Object.assign(c.business, { name: first(b.name), industry: first(b.category, raw.niche), phone: phoneNumber(b.phone), website: websiteUrl(b.website), location: first([b.address, b.city].filter(Boolean).join(', '), raw.location) });
    c.email = emailOk(b.email);
    c.brand = { accent, logoUrl: logo };
    c.tokens.companylogo = logo;
    return finish(c, 'lead', raw.id || raw.business_id || b.id);
  }
  if (kind === 'contact') {
    // a row imported in the Personalize hub / contact importer: { firstName, lastName, email, phone, company, title, city }
    const n = splitName(raw.name);
    Object.assign(c.tokens, { firstname: first(raw.firstName, raw.firstname, n.firstname), lastname: first(raw.lastName, raw.lastname, n.lastname), company: first(raw.company), role: first(raw.title, raw.role), city: first(raw.city, raw.location), companylogo: httpsUrl(raw.companylogo || raw.logoUrl) });
    Object.assign(c.business, { name: first(raw.company), phone: phoneNumber(raw.phone), website: websiteUrl(raw.website) });
    c.email = emailOk(raw.email);
    c.brand = { accent: '', logoUrl: c.tokens.companylogo };
    return finish(c, 'contact', raw.id);
  }
  if (kind === 'brand') {
    Object.assign(c.tokens, { company: first(raw.brandName) });
    Object.assign(c.business, { name: first(raw.brandName), industry: first(raw.industry), tagline: first(raw.tagline), description: first(raw.valueProposition, 400), website: websiteUrl(raw.website) });
    c.brand = { accent: hexColor(raw.primaryColors?.[0]), logoUrl: httpsUrl(raw.logoUrl) };
    c.tokens.companylogo = c.brand.logoUrl;
    return finish(c, 'brand', raw.id ? `brand:${raw.id}` : '');
  }
  if (kind === 'research') {
    const info = raw.contactInfo || {};
    Object.assign(c.tokens, { company: first(raw.title) });
    Object.assign(c.business, { name: first(raw.title), description: first(raw.description, 400), phone: phoneNumber(info.phones?.[0]), website: websiteUrl(raw.canonicalUrl) });
    c.email = emailOk(info.emails?.[0]);
    c.brand = { accent: accentFrom(raw.brandColors), logoUrl: httpsUrl(raw.logoUrl) || httpsUrl(raw.brandingAssets?.logoUrl) };
    c.tokens.companylogo = c.brand.logoUrl;
    return finish(c, 'research', '');
  }
  return null;
}

/** `b` only fills what `a` does not have. */
export function mergeCustomer(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const out = JSON.parse(JSON.stringify(a));
  ['tokens', 'business', 'brand'].forEach((k) => Object.keys(out[k]).forEach((f) => { if (!out[k][f] && b[k]?.[f]) out[k][f] = b[k][f]; }));
  if (!out.email && b.email) out.email = b.email;
  if (!out.image && b.image) out.image = b.image;
  out.label = out.business.name || `${out.tokens.firstname} ${out.tokens.lastname}`.trim() || out.email || out.label;
  return out;
}

const key = (c) => c.id || '';
const nameKey = (c) => (c.business.name || `${c.tokens.firstname} ${c.tokens.lastname}`).toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Who the person is (email, else first + last name); '' for a business-only record. */
const personKey = (c) => (c.email || '').trim().toLowerCase() || `${c.tokens.firstname || ''} ${c.tokens.lastname || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '');
/** The same customer: same id; or, when both are named people, the same person; else (a business-only record) the same business name. */
const sameCustomer = (a, b) => {
  if (key(a) && key(a) === key(b)) return true;
  const pa = personKey(a); const pb = personKey(b);
  if (pa && pb) return pa === pb; // Ann and Bob at Acme are two recipients, not one
  return !!nameKey(a) && nameKey(a) === nameKey(b);
};
/** Same id, same person, or (for business-only records) same business name => one customer (the first one's values win). Keeps order. */
export function dedupeCustomers(list) {
  const out = [];
  (list || []).filter(Boolean).forEach((c) => {
    const i = out.findIndex((o) => sameCustomer(o, c));
    if (i === -1) out.push(c); else out[i] = mergeCustomer(out[i], c);
  });
  return out;
}

/** The public page tokens for this customer (what {{firstname}}, {{company}}, ... show). */
export function customerTokens(c) {
  if (!c) return {};
  const t = { ...c.tokens, company: c.tokens.company || c.business.name, companylogo: httpsUrl(c.tokens.companylogo || c.brand.logoUrl) };
  // The industry designs read their city from {{custom1}} and the person's name from {{custom2}} (e.g. a pet owner).
  if (!t.custom1 && t.city) t.custom1 = t.city;
  if (!t.custom2 && t.firstname) t.custom2 = t.firstname;
  return Object.fromEntries(Object.entries(t).filter(([, v]) => v));
}

/** A page contact row, or null when there is nothing to personalize with. */
export function toContactFields(c) {
  if (!c) return null;
  const f = { ...customerTokens(c), ...(c.email ? { email: c.email } : {}) };
  return f.firstname || f.company ? f : null;
}

/** The brand object defaultConfig() understands. */
export const brandForConfig = (c) => (c ? { accent: c.brand.accent || '', logoUrl: c.brand.logoUrl || '', name: c.business.name || '' } : {});

const IMAGE_PATH = /\.(png|jpe?g|webp|gif|avif)$/i;
const isImageOutput = (url, outputType) => {
  const u = httpsUrl(url);
  if (!u) return false;
  const path = u.split(/[?#]/)[0];
  if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return false;
  return IMAGE_PATH.test(path) || String(outputType || '').toLowerCase() === 'image';
};

/**
 * The newest personalized picture per customer, taken from saved Personalization projects (rows as
 * /api/personalization/project returns them: { client, generation: { outputUrls }, output_type, updated_at }).
 * Matched by client id first, then by business name. Only https pictures; videos and blob: urls are ignored.
 */
/** When a project's picture was generated: its own stamp, else (older rows) the last time the project was saved. */
const generatedAt = (r) => String(r?.generation?.outputGeneratedAt || r?.outputGeneratedAt || r?.updated_at || r?.updatedAt || '');

export function personalImagesFromProjects(projects) {
  const rows = (Array.isArray(projects) ? projects : []).filter((r) => r && typeof r === 'object')
    .sort((a, b) => generatedAt(b).localeCompare(generatedAt(a)));
  const byId = Object.create(null); const byName = Object.create(null); // no inherited keys like "constructor"
  rows.forEach((r) => {
    const gen = r.generation && typeof r.generation === 'object' ? r.generation : {};
    const urls = [...(Array.isArray(gen.outputUrls) ? gen.outputUrls : []), ...(Array.isArray(r.outputUrls) ? r.outputUrls : [])];
    const img = urls.find((u) => isImageOutput(u, r.output_type || r.outputType));
    if (!img) return;
    // saved projects persist the customer as client.clientId
    const id = clip(r.client?.id || r.client?.clientId || r.clientId, 80); const name = clip(r.client?.businessName || r.client?.name, 120).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (id && !byId[id]) byId[id] = httpsUrl(img);
    if (name && !byName[name]) byName[name] = httpsUrl(img);
  });
  return { byId, byName };
}

/** Customers with `image` filled in from saved projects (never replaces a picture they already have). */
export function attachPersonalImages(customers, projects) {
  const { byId, byName } = personalImagesFromProjects(projects);
  return (customers || []).map((c) => {
    if (!c || c.image) return c;
    const nm = (c.business.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const image = byId[c.id] || (nm && byName[nm]) || '';
    return image ? { ...c, image } : c;
  });
}

const DEFAULT_FOOTER = /^Sent by \{\{sender\|us\}\}/;

/**
 * Write one customer's brand into a page's Puck data. Pure: returns { data, applied }.
 * Only brand slots change (page colour, menu-bar name and logo, the default footer line, empty links); no other copy.
 */
export function applyCustomerToPuck(puckData, customer, { useImage = true, brand: writeBrand = true } = {}) {
  const data = JSON.parse(JSON.stringify(puckData || {}));
  const applied = [];
  if (!customer || !Array.isArray(data.content)) return { data, applied };
  const { business, brand } = customer;
  const accent = writeBrand ? hexColor(brand.accent) : '';
  if (accent && data.root?.props) { data.root.props.accent = accent; applied.push('page colour'); }
  const image = useImage ? httpsUrl(customer.image) : '';
  data.content.forEach((item) => {
    const p = item.props || {};
    if (image && /Hero|VideoSection/.test(item.type) && ('slotImage' in p || 'photo' in p || 'poster' in p || item.type === 'Hero')) { p.slotImage = image; applied.push('personalized image'); }
    if (/Nav(Bar)?$/.test(item.type) && writeBrand) {
      if (business.name) { p.brand = business.name; applied.push('business name'); }
      if (httpsUrl(brand.logoUrl)) { p.logo = brand.logoUrl; applied.push('logo'); }
      if (!p.loginUrl && business.website) p.loginUrl = business.website;
    }
    if (item.type === 'Footer' && writeBrand && business.name && (!p.text || DEFAULT_FOOTER.test(p.text))) {
      p.text = [business.name, business.phone, business.website && business.website.replace(/^https:\/\//, '')].filter(Boolean).join(' · ');
      applied.push('footer');
    }
  });
  return { data, applied: [...new Set(applied)] };
}
