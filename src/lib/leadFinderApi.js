const API_BASE = '/api/leads';
export async function searchLeads({ niche, place, mode = 'no_website', limit = 60, tagPairs }) {
  const res = await fetch(`${API_BASE}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ niche, place, mode, limit, tagPairs }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'Search failed'); }
  return res.json();
}
export async function geocodePlace(place) { const res = await fetch(`${API_BASE}/geocode?place=${encodeURIComponent(place)}`); if (!res.ok) throw new Error('Geocoding failed'); return res.json(); }
export async function saveLeads(leads) { const res = await fetch(`${API_BASE}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Array.isArray(leads) ? leads : [leads]) }); if (!res.ok) throw new Error('Failed to save leads'); return res.json(); }
export async function loadLeads(filters = {}) { const params = new URLSearchParams(); for (const [k, v] of Object.entries(filters)) { if (v) params.set(k, v); } const res = await fetch(`${API_BASE}/list?${params}`); if (!res.ok) throw new Error('Failed to load leads'); return res.json(); }
export async function updateLead(id, fields) { const res = await fetch(`${API_BASE}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }); if (!res.ok) throw new Error('Failed to update lead'); return res.json(); }
export async function deleteLead(id) { const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Failed to delete lead'); return res.json(); }
export async function exportCSV() { const res = await fetch(`${API_BASE}/export.csv`); if (!res.ok) throw new Error('Export failed'); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click(); URL.revokeObjectURL(url); return { ok: true }; }
export async function getCities(countryCode) { const res = await fetch(`${API_BASE}/cities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: countryCode }) }); if (!res.ok) throw new Error('Failed to load cities'); return res.json(); }
export async function checkInstagram(urls) { const res = await fetch('/api/leads/instagram-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }) }); if (!res.ok) throw new Error('Instagram check failed'); return res.json(); }

// ── NEW: Personalization functions ──────────────────────────────────────────
export async function generateMessage(id, { kind = 'fb', lang = 'en', use_ai = false, name = 'Your Name', portfolio = '' }) {
  const res = await fetch(`${API_BASE}/${id}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, lang, use_ai, name, portfolio }) });
  if (!res.ok) throw new Error('Failed to generate message');
  return res.json();
}
export async function generateBrief(id, { use_ai = false, scrape_site = true }) {
  const res = await fetch(`${API_BASE}/${id}/brief`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ use_ai, scrape_site }) });
  if (!res.ok) throw new Error('Failed to generate brief');
  return res.json();
}
// ── Local message templates (fallback) ──────────────────────────────────────
const PRICE_BY_COUNTRY = { 'United Kingdom': '£199', 'Ireland': '€230', 'Germany': '€230', 'France': '€230', 'Spain': '€230', 'Italy': '€230', 'Netherlands': '€230', 'Portugal': '€230', 'Australia': 'A$380', 'New Zealand': 'NZ$400', 'Canada': 'C$340', 'United States': '$250' };
function priceFor(lead) { return PRICE_BY_COUNTRY[lead.country] || '$250'; }
const HOOKS = {
  'Bakery': ['orders come through DMs and get messy', 'a simple order form, photo gallery and pickup times'],
  'Cafe': ['people googling cafes in your area find your competitors, not you', 'your menu, hours and location showing up in Google search'],
  'Restaurant': ['people check the menu before deciding where to eat, and yours isn\'t online', 'your menu, booking info and photos on one page'],
  'Barber Shop': ['walk-ins can\'t check prices or opening hours before turning up', 'a price list, opening hours and an online booking button'],
  'Beauty Salon': ['nearby salons show up on Google and you don\'t', 'a booking page, price list and photo gallery that ranks on Google'],
  'Beauty / Nail Salon': ['nearby salons show up on Google and you don\'t', 'a booking page, price list and photo gallery that ranks on Google'],
  'Nail Salon': ['nearby salons show up on Google and you don\'t', 'a booking page, price list and photo gallery that ranks on Google'],
  'Dentist': ['patients research a practice online before they\'ll book', 'a professional page with services, team and an appointment form'],
  'Car Repair': ['people search for a garage on their phone at the roadside', 'a mobile page with services, hours and a click-to-call button'],
  'Gardener / Landscaper': ['you\'re quoting over messages one at a time', 'a quote-request form and a before/after gallery that sells the work for you'],
  'Plumber': ['emergency customers call whoever they find first on Google', 'a fast mobile page with a click-to-call button and your service area'],
  'Electrician': ['customers want to see you\'re qualified before they let you in the house', 'a page with your certifications, service area and a contact form'],
  'Hotel': ['guests book through sites that take 15-20% commission from you', 'a direct booking page so you keep the commission'],
  'Guest House / B&B': ['guests book through platforms that take a big commission', 'a direct booking page so more of the payment stays with you'],
  'Gym / Fitness': ['people compare gyms online before visiting one', 'a page with classes, pricing and a free-trial signup form'],
  'Florist': ['most flower orders start with a Google search', 'an online order page with your arrangements and delivery area'],
  'Pet Grooming': ['customers have to DM you to check availability', 'an online booking form, service area and before/after gallery'],
};
const GENERIC = ['customers can only find you if they\'re already following you on social media', 'a simple site with your services, prices and a contact form'];
function hook(niche) { return HOOKS[niche] || GENERIC; }

function facebookDmEn(lead, name) { const [pain, win] = hook(lead.niche); return `Hi! I came across ${lead.name} while looking at ${lead.niche.toLowerCase()} businesses in ${lead.city} — looks like a solid operation.\n\nI noticed you don't have a website, which means ${pain}. Smart Video builds simple, clean sites for small businesses at a flat ${priceFor(lead)}, usually live in about 5 days. For you that would be ${win}.\n\nBefore you decide anything I'm happy to build a free mockup with your real name and photos, so you can look at it instead of imagining it. Want me to send one over?\n\n— ${name}`; }
function coldEmailEn(lead, name, portfolio) { const [pain, win] = hook(lead.niche); const sig = portfolio ? `\n${portfolio}` : ''; return `Subject: Quick website idea for ${lead.name}\n\nHi,\n\nI'm ${name} — at Smart Video we build simple websites for independent local businesses.\n\nI came across ${lead.name} while looking at ${lead.niche.toLowerCase()} businesses in ${lead.city}, and noticed you don't have a website yet. That's workable, but it does mean ${pain}.\n\nWhat I'd build: ${win}. Flat ${priceFor(lead)}, no monthly fee, live in around 5 days.\n\nI'd rather show than tell — I'm happy to put together a free mockup using your real business name and photos, no obligation either way. Reply "yes" and I'll have it with you this week.\n${sig}\nBest,\n${name}\n\n---\nNot interested? Reply STOP and I'll remove you from my list straight away.`; }
function callScriptEn(lead, name) { const [pain, win] = hook(lead.niche); const n = lead.niche.toLowerCase(); return `COLD CALL SCRIPT — ${lead.name}\nNumber: ${lead.phone || 'not listed — check their social page'}\n${lead.address || ''}\n\nOPENER\n"Hi, is that ${lead.name}? My name's ${name}, I build websites with Smart Video for small businesses around ${lead.city}. Have you got thirty seconds? I'll be quick, I promise."\n\nWHY YOU'RE CALLED\n"I came across you while looking at ${n} businesses in the area. I noticed you don't have a website — which means ${pain}."\n\nTHE OFFER\n"What we do at Smart Video is build a simple site — ${win} — for a flat ${priceFor(lead)}. One payment, no monthly fees, done in about 5 days."\n\nTHE ASK\n"I'm not asking you to decide anything today. What I'd like to do is build you a free mockup with your actual name and photos. Would that be alright?"\n\n"We're not interested"\n→ "No problem at all, thanks for being straight with me."\n\nCLOSE\n"Brilliant, thanks for your time. Take care."`; }
function followUpEn(lead, name) { return `Hi again — just bringing this back to the top in case it got buried.\n\nStill happy to put together that free website mockup for ${lead.name} at Smart Video, no strings attached. And if it's not something you want right now, that's completely fine — just say so and I won't chase you again.\n\n— ${name}`; }
export function buildMessage(lead, kind = 'fb', name = 'Your Name', portfolio = '', lang = 'en') {
  if (kind === 'email') return coldEmailEn(lead, name, portfolio);
  if (kind === 'call') return callScriptEn(lead, name);
  if (kind === 'follow') return followUpEn(lead, name);
  return facebookDmEn(lead, name);
}
