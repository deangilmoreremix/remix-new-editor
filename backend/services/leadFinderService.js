import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
const router = express.Router();
const UA = 'SmartVideo-LeadFinder/1.0 (business discovery tool)';
const OVERPASS = ['https://overpass-api.de/api/interpreter','https://overpass-kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const PHOTON = 'https://photon.komoot.io/api/';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const COUNTRY_ISO = {'United Kingdom':'GB','United States':'US','Australia':'AU','Canada':'CA','Ireland':'IE','New Zealand':'NZ','Germany':'DE','France':'FR','Spain':'ES','Italy':'IT','Netherlands':'NL','India':'IN','Japan':'JP','Brazil':'BR','Mexico':'MX','South Africa':'ZA','Turkey':'TR','UAE':'AE'};

// ── Response wrapper ──────────────────────────────────────────────────────────
function wrap(fn) { return async (req, res) => { try { const r = await fn(req, res); if (!res.writableEnded) res.json(r); } catch (e) { res.status(e.status || 500).json({ ok: false, error: { message: e.message } }); } }; }

// ── Geocoding ───────────────────────────────────────────────────────────────
async function geocode(place, rid) {
  for (const fn of [async () => { const { data } = await axios.get(NOMINATIM, { params: { q: place, format: 'json', limit: 1, addressdetails: 1 }, headers: { 'User-Agent': UA }, timeout: 30000 }); if (!data?.[0]) return null; const r = data[0], bb = r.boundingbox; if (!bb || bb.length !== 4) return null; const [s,n,w,e] = bb.map(parseFloat); return { display_name: r.display_name, country: r.address?.country || '', country_code: (r.address?.country_code || '').toLowerCase(), bbox: [s,w,n,e], lat: parseFloat(r.lat), lon: parseFloat(r.lon) }; }, async () => { const { data } = await axios.get(PHOTON, { params: { q: place, limit: 1 }, headers: { 'User-Agent': UA }, timeout: 30000 }); const f = data?.features?.[0]; if (!f) return null; const p = f.properties || {}, ext = p.extent; let s,w,n,e; if (ext?.length === 4) [w,n,e,s] = ext; else { const [lon,lat] = f.geometry.coordinates; s=lat-0.09;w=lon-0.14;n=lat+0.09;e=lon+0.14; } const [lon,lat] = f.geometry.coordinates; return { display_name: [p.name,p.state,p.country].filter(Boolean).join(', '), country: p.country || '', country_code: (p.countrycode || '').toLowerCase(), bbox: [s,w,n,e], lat, lon }; }]) { try { const g = await fn(place); if (g) return g; } catch {} }
  const err = new Error(`Couldn't find '${place}'. Try 'Leeds, United Kingdom'.`); err.status = 400; throw err;
}

// ── Overpass query ──────────────────────────────────────────────────────────
function buildQuery(tags, bbox, limit) { const [s,w,n,e] = bbox; const parts = []; for (const [k,v] of tags) for (const kind of ['node','way']) parts.push(`  ${kind}["${k}"="${v}""]["name"](${s},${w},${n},${e});`); return `[out:json][timeout:90];\n(\n${parts.join('\n')}\n);\nout center tags meta ${limit};`; }
async function overpass(query) { const data = new URLSearchParams({ data: query }).toString(); let last; for (const m of OVERPASS) { try { const r = await axios.post(m, data, { headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 150000, validateStatus: s => s < 500 }); if (r.status === 200) return r.data; last = new Error(`HTTP ${r.status}`); } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500)); } } const err = new Error('All OSM mirrors busy. Try again in a minute.'); err.status = 503; throw err; }

// ── Scoring ─────────────────────────────────────────────────────────────────
function scoreLead(l) { let s = 0; if (l.phone) s+=40; if (l.email) s+=30; if (l.socials && Object.keys(l.socials).length) s+=15; if (l.address) s+=5; if (l.opening_hours) s+=10; if (l.owner) s+=5; if (l.whatsapp) s+=20; s += Math.min(l.activity||0,5)*4; const vd = l.verified_date||''; if (vd >= '2024-07') s+=10; else if (vd >= '2022-07') s+=5; return s; }
function reachability(l) { if (l.whatsapp && l.email) return 'WhatsApp + Email'; if (l.whatsapp) return 'WhatsApp'; if (l.phone && l.email) return 'Phone + Email'; if (l.phone) return 'Phone only'; if (l.email) return 'Email only'; if (l.socials && Object.keys(l.socials).length) return 'Social only'; return 'Hard to reach'; }

// ── Parse elements ──────────────────────────────────────────────────────────
function parseAddr(t) { return [t['addr:housenumber'],t['addr:street'],t['addr:city']||t['addr:town']||t['addr:suburb'],t['addr:postcode']].filter(Boolean).join(' ').trim(); }
function socialUrl(k,v) { if (!v) return ''; if (v.startsWith('http')) return v; const h = v.replace(/^@\/?/,''); return ({facebook:'https://www.facebook.com/',instagram:'https://www.instagram.com/',twitter:'https://twitter.com/'}[k] || '') + h; }
function looksClosed(t) { for (const k of Object.keys(t)) if (k.includes(':') && ['disused','abandoned','demolished','razed','removed','closed'].includes(k.split(':')[0])) return true; for (const f of ['disused','abandoned','closed','demolished','razed']) if (t[f]==='yes') return true; if (t.shop==='vacant'||t.office==='vacant') return true; const oh = (t.opening_hours||'').trim().toLowerCase(); return ['closed','off','no','none'].includes(oh) || ['permanently closed','closed down','now closed','out of business','to let','former '].some(h => (t.name||'').toLowerCase().includes(h)); }
function parseElements(els, niche, label, country, cc, minAct) {
  const out = []; for (const el of els) {
    const t = el.tags || {}; const name = (t.name||'').trim(); if (!name || looksClosed(t)) continue;
    const web = t.website||t['contact:website']||t.url||t['contact:url']||'';
    const phone = t.phone||t['contact:phone']||t['contact:mobile']||t.mobile||''; const email = t.email||t['contact:email']||'';
    const owner = t.operator||t.owner||t['contact:person']||t['name:etymology']||'';
    const socials = {}; for (const [k,keys] of Object.entries({facebook:['contact:facebook','facebook'],instagram:['contact:instagram','instagram'],twitter:['contact:twitter','twitter'],whatsapp:['contact:whatsapp','whatsapp']})) { const v = keys.map(k=>t[k]).find(Boolean); if (v) socials[k] = socialUrl(k,v); }
    const lat = el.lat||el.center?.lat, lon = el.lon||el.center?.lon; const lastSeen = t.check_date||t['survey:date']||''; const edited = (el.timestamp||'').slice(0,10);
    let act = 0; if (t.opening_hours && (t.opening_hours||'').trim().toLowerCase() !== 'closed') act++; if (t.phone||t['contact:phone']||t['contact:mobile']) act++; if (Object.keys(t).some(k=>k.startsWith('contact:'))) act++; if (t.check_date||t['survey:date']) act++; if (edited >= '2023-01') act++;
    if (minAct && act < minAct) continue;
    let whatsapp = ''; const wa = t['contact:whatsapp']||t.whatsapp; if (wa) { const d = wa.replace(/[^\d+]/g,''); if (d) whatsapp = `https://wa.me/${d.replace(/^\+/,'')}`; }
    out.push({ id: `${el.type||'n'}${el.id}`, name, niche, city: label, country, address: parseAddr(t), phone, email, owner, website: web||'', socials, opening_hours: t.opening_hours||'', verified_date: lastSeen||edited, lat, lon, osm_url: `https://www.openstreetmap.org/${el.type}/${el.id}`, whatsapp, activity: act, links_ok: {}, score: 0, reachability: '', stage: 'New', found_at: new Date().toISOString() });
  } return out;
}

// ── Maps links ──────────────────────────────────────────────────────────────
function mapsLinks(name, lat, lon, addr, city) { const o = {}; if (lat == null) { if (name) o.maps_verify = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name,addr||city].filter(Boolean).join(' '))}`; return o; } const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`; const lbl = [name,addr||city].filter(Boolean).join(' ').trim(); o.maps_verify = lbl ? `https://www.google.com/maps/search/${encodeURIComponent(lbl)}/@${ll},18z` : `https://www.google.com/maps/search/?api=1&query=${ll}`; o.maps_pin = `https://www.google.com/maps/search/?api=1&query=${ll}`; o.maps_street = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}`; return o; }

// ═══════════════════════════════════════════════════════════════════════════
// PERSONALIZATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ── Trade-specific hooks (pain points + solutions) ──────────────────────────
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

// ── Pricing by country ─────────────────────────────────────────────────────
const PRICE_BY_COUNTRY = {'United Kingdom':'£199','Ireland':'€230','Germany':'€230','France':'€230','Spain':'€230','Italy':'€230','Netherlands':'€230','Portugal':'€230','Australia':'A$380','New Zealand':'NZ$400','Canada':'C$340','United States':'$250'};
function priceFor(lead) { return PRICE_BY_COUNTRY[lead.country] || '$250'; }

// ── Site scraper ────────────────────────────────────────────────────────────
async function scrapeSite(url, timeout = 8000) {
  if (!url) return '';
  const target = url.startsWith('http') ? url : 'http://' + url;
  try {
    const res = await axios.get(target, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartVideo-Bot/1.0)' }, timeout, validateStatus: () => true });
    if (res.status >= 400) return '';
    const html = res.data || '';
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
  } catch { return ''; }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE TEMPLATES (4 languages)
// ═══════════════════════════════════════════════════════════════════════════

function facebookDmEn(lead, name) {
  const [pain, win] = hook(lead.niche);
  return `Hi! I came across ${lead.name} while looking at ${lead.niche.toLowerCase()} businesses in ${lead.city} — looks like a solid operation.\n\nI noticed you don't have a website, which means ${pain}. Smart Video builds simple, clean sites for small businesses at a flat ${priceFor(lead)}, usually live in about 5 days. For you that would be ${win}.\n\nBefore you decide anything I'm happy to build a free mockup with your real name and photos, so you can look at it instead of imagining it. Want me to send one over?\n\n— ${name}`;
}
function facebookDmHi(lead, name) {
  return `Namaste! Main ${lead.city} ke ${lead.niche.toLowerCase()} businesses dekh raha tha, tabhi ${lead.name} par nazar padi.\n\nDekha ki aapki koi website nahi hai — matlab jo log Google par search karte hain, unhe aap milte hi nahi.\n\nSmart Video ke saath maine aapke liye ek simple website bana di hai, aapke apne photos se. Bilkul free hai, dekh lijiye — ${priceFor(lead)} mein poori ban jayegi agar pasand aaye.\n\nBhej doon?\n\n— ${name}`;
}
function facebookDmHing(lead, name) {
  return `Hi! ${lead.city} mein ${lead.niche.toLowerCase()} search kar raha tha aur ${lead.name} dikha — kaafi solid lag raha hai.\n\nEk baat noticed ki — website nahi hai aapki. Toh jo log Google pe search karte hain unhe aap milte nahi, sirf existing customers hi aate hain.\n\nSmart Video ke through already ek rough site bana di hai aapke photos use karke. Free hai, koi charge nahi. Full version ${priceFor(lead)} flat, 5 din mein ready.\n\nBhejun dekhne ke liye?\n\n— ${name}`;
}
function facebookDmEs(lead, name) {
  const [pain, win] = hook(lead.niche);
  return `Hola! Vi ${lead.name} mientras miraba negocios de ${lead.niche.toLowerCase()} en ${lead.city} — se ve muy bien.\n\nNoté que no tienen sitio web, así que quien los busca en Google encuentra a la competencia en vez de ustedes.\n\nCon Smart Video les armé uno sencillo con sus propias fotos. Es gratis verlo, sin compromiso. El completo sale ${priceFor(lead)}, listo en unos 5 días.\n\n¿Se lo mando?\n\n— ${name}`;
}
function coldEmailEn(lead, name, portfolio) {
  const [pain, win] = hook(lead.niche); const sig = portfolio ? `\n${portfolio}` : '';
  return `Subject: Quick website idea for ${lead.name}\n\nHi,\n\nI'm ${name} — at Smart Video we build simple websites for independent local businesses.\n\nI came across ${lead.name} while looking at ${lead.niche.toLowerCase()} businesses in ${lead.city}, and noticed you don't have a website yet. That's workable, but it does mean ${pain}.\n\nWhat I'd build: ${win}. Flat ${priceFor(lead)}, no monthly fee, live in around 5 days.\n\nI'd rather show than tell — I'm happy to put together a free mockup using your real business name and photos, no obligation either way. Reply "yes" and I'll have it with you this week.\n${sig}\nBest,\n${name}\n\n---\nNot interested? Reply STOP and I'll remove you from my list straight away.`;
}
function callScriptEn(lead, name) {
  const [pain, win] = hook(lead.niche); const n = lead.niche.toLowerCase();
  return `COLD CALL SCRIPT — ${lead.name}\nNumber: ${lead.phone || 'not listed — check their social page'}\n${lead.address || ''}\n\nOPENER\n"Hi, is that ${lead.name}? My name's ${name}, I build websites with Smart Video for small businesses around ${lead.city}. Have you got thirty seconds? I'll be quick, I promise."\n\nWHY YOU'RE CALLED\n"I came across you while looking at ${n} businesses in the area. I noticed you don't have a website — which means ${pain}."\n\nTHE OFFER\n"What we do at Smart Video is build a simple site — ${win} — for a flat ${priceFor(lead)}. One payment, no monthly fees, done in about 5 days."\n\nTHE ASK\n"I'm not asking you to decide anything today. What I'd like to do is build you a free mockup with your actual name and photos, send it over, and you tell me yes or no once you've seen it. Would that be alright?"\n\n── OBJECTIONS ──\n\n"I'm too busy right now"\n→ "Completely understand, that's exactly why I do the mockup first — it takes zero time from you. What's the best email to send it to?"\n\n"Facebook works fine for us"\n→ "It does, for people already following you. The gap is people googling '${n} ${lead.city}' — right now they find your competitors. That's the bit this fixes."\n\n"How much was it again?"\n→ "${priceFor(lead)} flat. No subscription to me. If you want changes later we can talk, but there's no monthly bill."\n\n"We're not interested"\n→ "No problem at all, thanks for being straight with me. Have a good day."   [DO NOT PUSH. Mark as Lost and move on.]\n\nCLOSE\n"Brilliant, thanks for your time. I'll have that over to you by [day]. Take care."`;
}
function followUpEn(lead, name) {
  return `Hi again — just bringing this back to the top in case it got buried.\n\nStill happy to put together that free website mockup for ${lead.name} at Smart Video, no strings attached. And if it's not something you want right now, that's completely fine — just say so and I won't chase you again.\n\n— ${name}`;
}
export function buildMessage(lead, kind = 'fb', name = 'Your Name', portfolio = '', lang = 'en') {
  if (kind === 'email') return coldEmailEn(lead, name, portfolio);
  if (kind === 'call') return callScriptEn(lead, name);
  if (kind === 'follow') return followUpEn(lead, name);
  if (lang === 'hi') return facebookDmHi(lead, name);
  if (lang === 'hinglish') return facebookDmHing(lead, name);
  if (lang === 'es') return facebookDmEs(lead, name);
  return facebookDmEn(lead, name);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS BRIEF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function briefTemplate(lead, siteText = '') {
  const soc = lead.socials || {};
  return [
    `BUSINESS BRIEF — ${lead.name}`, '='.repeat(46), '',
    'WHO THEY ARE', `- Name: ${lead.name}`, `- Trade: ${lead.niche}`,
    `- Location: ${lead.address || lead.city}, ${lead.country || ''}`,
    `- Run by: ${lead.owner || 'unknown (ask on first call)'}`,
    `- Opening hours: ${lead.opening_hours || 'not listed'}`, '',
    'HOW TO REACH THEM', `- Phone: ${lead.phone || 'not listed'}`,
    `- Email: ${lead.email || 'not listed'}`,
    `- Facebook: ${soc.facebook || 'not found'}`,
    `- Instagram: ${soc.instagram || 'not found'}`, '',
    'ONLINE PRESENCE GAP', `- ${lead.reason || 'No website'}`,
    siteText ? `- Current site content: ${siteText.substring(0, 500)}` : '', '',
    'WEBSITE TO BUILD THEM (paste this into any AI builder)',
    `Build a modern single-page website for "${lead.name}", a ${lead.niche.toLowerCase()} in ${lead.city}, ${lead.country || ''}.`,
    'Sections: hero with the business name and a one-line promise;',
    'services with prices; photo gallery; about the owner;',
    'opening hours; a contact/booking form; footer with phone, address and social links.',
    `Contact details to include: phone ${lead.phone || '[ask owner]'}, address ${lead.address || lead.city}.`,
    'Style: clean, mobile-first, fast, warm and local — not corporate.'
  ].join('\n');
}

async function callAI(prompt, provider, key) {
  if (provider === 'anthropic') {
    const r = await axios.post('https://api.anthropic.com/v1/messages',{model:'claude-sonnet-4-20250514',max_tokens:800,messages:[{role:'user',content:prompt}]},{headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},timeout:45000});
    return r.data.content[0].text.trim();
  }
  const r = await axios.post('https://api.openai.com/v1/chat/completions',{model:'gpt-4o-mini',messages:[{role:'user',content:prompt}],max_tokens:800,temperature:0.8},{headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},timeout:45000});
  return r.data.choices[0].message.content.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDRY LINK GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

const FOUNDRY_SLUGS = {'Barber Shop':'barber','Hair Salon':'beauty-salon','Beauty Salon':'beauty-salon','Nail Salon':'nail-salon','Spa':'spa','Tattoo Studio':'tattoo','Gym / Fitness':'gym','Dentist':'dentist','Doctor / GP':'medical-clinic','Restaurant':'restaurant','Cafe':'cafe','Bakery':'bakery','Bar':'bar','Pub':'pub','Hotel':'hotel','Guest House / B&B':'guest-house','Plumber':'plumber','Electrician':'electrician','Carpenter':'carpenter','Gardener / Landscaper':'landscaping','Cleaning Service':'cleaning','Auto Repair Garage':'auto-repair','Car Wash':'car-wash','Real Estate Agency':'real-estate','Law Firm':'law-firm','Accountant':'accounting','Marketing Agency':'marketing-agency','Photography Studio':'photography','School':'school','Driving School':'driving-school','Pet Grooming':'pet-grooming','Florist':'florist'};
const FOUNDRY_BASE = 'https://foundry.smartvid.app';
function encPayload(business,phone,city,slug,agency) { const cl = v => (v||'').replace(/\|/,'/').replace(/\s+/g,' ').trim(); return Buffer.from([cl(business),cl(phone),cl(city),cl(slug),cl(agency)].join('|').replace(/\|+$/,''),'utf-8').toString('base64url'); }

// ═══════════════════════════════════════════════════════════════════════════
// INSTAGRAM CHECKER
// ═══════════════════════════════════════════════════════════════════════════

function extractHandle(url) { if (!url) return ''; const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/); return m ? m[1] : url.replace(/^@\/?/,'').split('/')[0]; }
async function checkInsta(handle) { const out = { handle, status: 'unknown', last_post: '', days_since: null, note: '' }; if (!handle) return out; try { const r = await axios.get(`https://www.instagram.com/${handle}/?__a=1&__d=dis`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000, validateStatus: ()=>true }); const d = r.data; if (!d?.graphql?.user) return { ...out, status: 'unknown', note: 'Could not fetch' }; const u = d.graphql.user; if (u.is_private) return { ...out, status: 'private', note: 'Private account' }; const edges = u.edge_owner_to_timeline_media?.edges || []; if (!edges.length) return { ...out, status: 'empty', note: 'No posts' }; const newest = edges[0].node.taken_at_timestamp; const days = Math.floor((Date.now()/1000 - newest) / 86400); out.last_post = new Date(newest*1000).toISOString().slice(0,10); out.days_since = days; out.status = days <= 30 ? 'active' : days <= 180 ? 'quiet' : 'dormant'; } catch { out.note = 'Could not check'; } return out; }

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/leads/search
router.post('/search', wrap(async (req, res) => {
  const { niche, place, mode = 'no_website', limit = 60, tagPairs } = req.body;
  if (!place) { const e = new Error('Type a city and country'); e.status = 400; throw e; }
  const geo = await geocode(place, req.requestId);
  const result = await overpass(buildQuery(tagPairs, geo.bbox, limit * 4));
  const thin = ['in','pk','bd','lk','np','ng','ke','id','ph','vn','th','eg','za'].includes(geo.country_code);
  let leads = parseElements(result.elements || [], niche, geo.display_name.split(',')[0], geo.country, geo.country_code, thin ? 1 : 2);
  const seen = new Set(); leads = leads.filter(l => { const k = `${l.name.toLowerCase()}|${l.address.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const noSite = leads.filter(l => !l.website), withSite = leads.filter(l => l.website); for (const l of noSite) { l.qualified = true; l.reason = 'No website at all'; }
  let chosen;
  if (mode === 'no_website') chosen = noSite;
  else {
    if (withSite.length) { const checks = await Promise.all(withSite.slice(0,limit*2).map(l => checkWebsite(l.website,5000))); withSite.forEach((l,i) => { l.qualified = checks[i].isBad; l.reason = checks[i].reason; }); }
    chosen = mode === 'bad_website' ? withSite.filter(l=>l.qualified) : [...noSite,...withSite];
  }
  for (const l of chosen) { l.score = scoreLead(l); l.reachability = reachability(l); Object.assign(l, mapsLinks(l.name,l.lat,l.lon,l.address,l.city)); }
  chosen.sort((a,b) => b.score-a.score); const final = chosen.slice(0,limit);
  return { ok: true, place: geo.display_name, country: geo.country, niche, scanned: leads.length, found: chosen.length, leads: final };
}));

// GET /api/leads/geocode
router.get('/geocode', wrap(async (req, res) => { const g = await geocode(req.query.place, req.requestId); return { ok: true, ...g }; }));

// GET /api/leads/list
router.get('/list', wrap(async (req, res) => {
  if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; }
  const { niche, country, city, stage, starred, q, limit=100, offset=0 } = req.query;
  let qry = supabase.from('osm_leads').select('*',{count:'exact'}).order('score',{ascending:false}).order('starred',{ascending:false});
  if (niche) qry = qry.eq('niche',niche); if (country) qry = qry.eq('country',country); if (city) qry = qry.eq('city',city); if (stage) qry = qry.eq('stage',stage); if (starred==='true') qry = qry.eq('starred',true); if (q) qry = qry.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
  const { data, error, count } = await qry.range(+offset, +offset + +limit - 1);
  if (error) throw new Error(error.message);
  const { data: sd } = await supabase.from('osm_leads').select('stage'); const stages = {}; for (const s of sd||[]) stages[s.stage] = (stages[s.stage]||0)+1;
  return { ok: true, leads: data||[], total: count||0, stages, facets: { niches: [], countries: [], cities: [] } };
}));

// POST /api/leads/save
router.post('/save', wrap(async (req, res) => {
  if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; }
  const leads = Array.isArray(req.body) ? req.body : [req.body]; if (!leads.length) return { ok: true, saved: 0 };
  const c = leads.map(l => ({ id:l.id, name:l.name||'', niche:l.niche||'', city:l.city||'', country:l.country||'', address:l.address||'', phone:l.phone||'', email:l.email||'', website:l.website||'', socials:l.socials||{}, opening_hours:l.opening_hours||'', lat:l.lat||null, lon:l.lon||null, osm_url:l.osm_url||'', reason:l.reason||'', score:l.score||0, reachability:l.reachability||'', stage:l.stage||'New', notes:l.notes||'', starred:l.starred||false, owner:l.owner||'', verified_date:l.verified_date||'', links_ok:l.links_ok||{}, whatsapp:l.whatsapp||'', activity:l.activity||0, segment:l.segment||'', maps_verify:l.maps_verify||'', maps_pin:l.maps_pin||'', maps_street:l.maps_street||'', search_niche:l.search_niche||'', search_city:l.search_city||'', search_country:l.search_country||'', updated_at:new Date().toISOString() }));
  const { error } = await supabase.from('osm_leads').upsert(c, { onConflict: 'id' }); if (error) throw new Error(error.message); return { ok: true, saved: c.length };
}));

// PATCH /api/leads/:id
router.patch('/:id', wrap(async (req, res) => { if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; } const u = {}; for (const k of ['stage','notes','phone','email','starred','name','address']) if (req.body[k] !== undefined) u[k] = req.body[k]; u.updated_at = new Date().toISOString(); const { error } = await supabase.from('osm_leads').update(u).eq('id', req.params.id); if (error) throw new Error(error.message); return { ok: true }; }));
// DELETE /api/leads/:id
router.delete('/:id', wrap(async (req, res) => { if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; } const { error } = await supabase.from('osm_leads').delete().eq('id',req.params.id); if (error) throw new Error(error.message); return { ok: true }; }));

// GET /api/leads/export.csv
router.get('/export.csv', wrap(async (req, res) => { if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; } const { niche, country, city, stage, starred } = req.query; let q = supabase.from('osm_leads').select('*').order('score',{ascending:false}).order('starred',{ascending:false}); if (niche) q = q.eq('niche',niche); if (country) q = q.eq('country',country); if (city) q = q.eq('city',city); if (stage) q = q.eq('stage',stage); if (starred==='true') q = q.eq('starred',true); const { data, error } = await q; if (error) throw new Error(error.message); const esc = v => { const s = String(v??''); return s.includes(',')||s.includes('"')||s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; }; const h = ['Name','Starred','Owner','Niche','City','Country','Address','Phone','Email','Website','Facebook','Instagram','WhatsApp','Reason','Score','Reachability','Stage','Notes','Found']; const lines = [h.map(esc).join(',')]; for (const l of data||[]) lines.push([l.name,l.starred?'yes':'',l.owner,l.niche,l.city,l.country,l.address,l.phone,l.email,l.website,l.socials?.facebook||'',l.socials?.instagram||'',l.whatsapp,l.reason,l.score,l.reachability,l.stage,l.notes,l.found_at].map(esc).join(',')); res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename=leads.csv'); res.send(lines.join('\n')); }));

// POST /api/leads/cities
router.post('/cities', wrap(async (req, res) => { const iso = COUNTRY_ISO[req.body.country] || req.body.country; if (!iso) return { ok: true, cities: [] }; const q = `[out:json][timeout:60];area["ISO3166-1"="${iso}"]["admin_level"="2"]->.c;(node["place"="city"](area.c);node["place"="town"](area.c););out tags 400;`; try { const r = await overpass(q); const seen = new Set(), cities = []; for (const el of r.elements||[]) { const n = (el.tags?.['name:en']||el.tags?.name||'').trim(); if (!n || seen.has(n.toLowerCase())) continue; seen.add(n.toLowerCase()); cities.push(n); } cities.sort(); return { ok: true, cities }; } catch { return { ok: true, cities: [] }; } }));

// ═══════════════════════════════════════════════════════════════════════════
// NEW: PERSONALIZATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/leads/:id/message — Generate personalized message
router.post('/:id/message', wrap(async (req, res) => {
  if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; }
  const { data: lead } = await supabase.from('osm_leads').select('*').eq('id', req.params.id).single();
  if (!lead) { const e = new Error('Lead not found'); e.status = 404; throw e; }
  const { kind = 'fb', lang = 'en', use_ai = false, name = 'Your Name', portfolio = '' } = req.body;
  
  if (!use_ai) {
    const message = buildMessage(lead, kind, name, portfolio, lang);
    return { ok: true, message, source: 'template', facts_used: { business_name: lead.name, niche: lead.niche, city: lead.city, owner: lead.owner || 'unknown', price: priceFor(lead) } };
  }
  
  // AI rewrite
  const provider = process.env.LEAD_AI_PROVIDER || 'openai';
  const key = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) return { ok: true, message: buildMessage(lead, kind, name, portfolio, lang), source: 'no_key' };
  
  const label = {fb:'a short Facebook/Instagram DM',email:'a cold email (include Subject:)',call:'a cold call script',follow:'a short follow-up'}[kind] || 'a short DM';
  const facts = { business_name: lead.name, industry: lead.niche, city: lead.city, country: lead.country||'', owner_or_operator: lead.owner||'unknown', why_they_qualify: lead.reason||'No website', has_phone: !!lead.phone, price_to_quote: priceFor(lead), my_name: name, turnaround: '5 days' };
  const prompt = `Write ${label} pitching a small-business website build.\n\nFacts (do not invent):\n${JSON.stringify(facts,null,2)}\n\nRules:\n- Warm, direct, human. No hype words.\n- Reference something concrete about THIS business.\n- If owner name is known, address them by it.\n- Lead with a free mockup offer.\n- Do not claim to have visited them.\n- Under 130 words unless call script.\n- Output only the message text.`;
  try { const message = await callAI(prompt, provider, key); return { ok: true, message, source: `ai:${provider}`, facts_used: facts }; } catch { return { ok: true, message: buildMessage(lead, kind, name, portfolio, lang), source: 'fallback' }; }
}));

// POST /api/leads/:id/brief — Generate business brief
router.post('/:id/brief', wrap(async (req, res) => {
  if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; }
  const { data: lead } = await supabase.from('osm_leads').select('*').eq('id', req.params.id).single();
  if (!lead) { const e = new Error('Lead not found'); e.status = 404; throw e; }
  const { use_ai = false, scrape_site = true } = req.body;
  
  let siteText = '';
  let site_scraped = false;
  if (scrape_site && lead.website) { siteText = await scrapeSite(lead.website); site_scraped = !!siteText; }
  
  if (!use_ai) {
    return { ok: true, brief: briefTemplate(lead, siteText), source: 'template', site_scraped, site_content_length: siteText.length };
  }
  
  // AI brief
  const provider = process.env.LEAD_AI_PROVIDER || 'openai';
  const key = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) return { ok: true, brief: briefTemplate(lead, siteText), source: 'no_key', site_scraped, site_content_length: siteText.length };
  
  const prompt = `Write a detailed business brief for this local business, ending with a ready-to-paste prompt for an AI website builder.\n\nKnown facts (do not invent):\n${JSON.stringify(lead,null,2)}\n\n${siteText ? `Current website content:\n${siteText.substring(0,2000)}` : 'No current website.'}\n\nStructure:\n1. WHO THEY ARE — 3-4 sentences on the business, its trade and locality.\n2. HOW TO REACH THEM — every contact channel known.\n3. ONLINE PRESENCE GAP — why they need a site, concretely.\n4. LIKELY SERVICES & CUSTOMERS — inferred from the trade, clearly marked as inference.\n5. WEBSITE BUILD PROMPT — a complete paste-ready prompt for an AI website builder.\nPlain text only.`;
  try { const brief = await callAI(prompt, provider, key); return { ok: true, brief, source: `ai:${provider}`, site_scraped, site_content_length: siteText.length }; } catch { return { ok: true, brief: briefTemplate(lead, siteText), source: 'fallback', site_scraped, site_content_length: siteText.length }; }
}));

// POST /api/leads/:id/foundry-links — Generate Foundry demo links
router.post('/:id/foundry-links', wrap(async (req, res) => {
  if (!supabase) { const e = new Error('Supabase not configured'); e.status = 503; throw e; }
  const { data: lead } = await supabase.from('osm_leads').select('*').eq('id', req.params.id).single();
  if (!lead) { const e = new Error('Lead not found'); e.status = 404; throw e; }
  const slug = FOUNDRY_SLUGS[lead.niche] || lead.niche.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  const token = encPayload(lead.name, lead.phone, lead.city, slug, 'Smart Video');
  return { ok: true, slug, token, demo: `${FOUNDRY_BASE}/demo/${slug}/?d=${token}`, app: `${FOUNDRY_BASE}/app/${slug}/?d=${token}` };
}));

// POST /api/leads/instagram-check
router.post('/instagram-check', wrap(async (req, res) => { const urls = (req.body.urls || []).slice(0, 10); const results = {}; for (const url of urls) { const handle = extractHandle(url); results[url] = await checkInsta(handle); await new Promise(r => setTimeout(r, 2000)); } return { ok: true, results }; }));
router.get('/instagram-available', (req, res) => res.json({ ok: true, available: true }));

// GET /api/leads/health
router.get('/health', (req, res) => res.json({ ok: true, service: 'leadfinder' }));

export default router;
