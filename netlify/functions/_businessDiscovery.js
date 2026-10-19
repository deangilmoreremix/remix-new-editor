const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];
const USER_AGENT = 'SmartVideo-AI/1.0 (https://smartvid.app)';
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 25000;
const MAX_RESULTS = 50;

const CACHE = new Map();

export const BUSINESS_NICHES = Object.freeze({
  'general-business': {
    label: 'General Business',
    tags: [['office','company'],['shop','yes'],['amenity','cafe'],['amenity','restaurant']],
  },
  'restaurants-food': {
    label: 'Restaurants / Food',
    tags: [['amenity','restaurant'],['amenity','cafe'],['amenity','fast_food'],['amenity','bar'],['shop','bakery'],['amenity','ice_cream']],
  },
  'real-estate': {
    label: 'Real Estate',
    tags: [['office','estate_agent'],['shop','real_estate'],['office','insurance']],
  },
  beauty: {
    label: 'Beauty / Salon',
    tags: [['shop','beauty'],['shop','hairdresser'],['shop','cosmetics'],['amenity','spa'],['shop','perfumery']],
  },
  'wellness-fitness': {
    label: 'Wellness / Fitness',
    tags: [['amenity','gym'],['amenity','fitness_centre'],['leisure','fitness_centre'],['amenity','spa'],['leisure','swimming_pool'],['shop','nutrition_supplements']],
  },
  education: {
    label: 'Education',
    tags: [['amenity','school'],['amenity','university'],['amenity','college'],['amenity','language_school'],['office','educational_institution'],['amenity','library']],
  },
  technology: {
    label: 'Technology / SaaS',
    tags: [['office','company'],['office','coworking'],['shop','electronics'],['shop','computer'],['amenity','internet_cafe']],
  },
  finance: {
    label: 'Finance',
    tags: [['amenity','bank'],['office','financial'],['office','insurance'],['office','accountant']],
  },
  automotive: {
    label: 'Automotive',
    tags: [['shop','car'],['shop','car_repair'],['amenity','car_wash'],['amenity','fuel'],['shop','motorcycle'],['shop','tyres']],
  },
  'travel-hospitality': {
    label: 'Travel / Hospitality',
    tags: [['tourism','hotel'],['tourism','motel'],['tourism','hostel'],['tourism','guest_house'],['tourism','camp_site'],['tourism','caravan_site']],
  },
  'sports-outdoors': {
    label: 'Sports / Outdoors',
    tags: [['leisure','sports_centre'],['leisure','fitness_centre'],['leisure','swimming_pool'],['leisure','pitch'],['shop','sports'],['shop','bicycle']],
  },
  'entertainment-media': {
    label: 'Entertainment / Media',
    tags: [['amenity','cinema'],['leisure','bowling_alley'],['leisure','amusement_arcade'],['amenity','nightclub'],['amenity','bar'],['leisure','sports_centre']],
  },
  ecommerce: {
    label: 'E-Commerce / Retail',
    tags: [['shop','yes'],['shop','clothes'],['shop','fashion'],['shop','electronics'],['shop','jewelry'],['shop','shoes'],['shop','supermarket'],['office','company']],
  },
});

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (CACHE.size > 100) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(key, { value, createdAt: Date.now() });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function clean(value, max = 400) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export async function geocodeBusinessLocation(location) {
  const query = clean(location, 240);
  if (!query) throw new Error('Location is required.');

  const cacheKey = `geo:${query.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const url = new URL('/search', NOMINATIM_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  }, 15000);
  if (!response.ok) throw new Error(`Location lookup failed (HTTP ${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error(`Location not found: "${query}".`);

  const latitude = Number(rows[0].lat);
  const longitude = Number(rows[0].lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Location lookup returned invalid coordinates.');
  }

  const result = {
    latitude,
    longitude,
    displayName: clean(rows[0].display_name, 500),
  };
  cacheSet(cacheKey, result);
  return result;
}

function boundingBox(latitude, longitude, radiusMiles) {
  const earthRadiusMiles = 3958.8;
  const radiusRad = radiusMiles / earthRadiusMiles;
  const latRad = (latitude * Math.PI) / 180;
  return {
    south: latitude - (radiusRad * 180) / Math.PI,
    north: latitude + (radiusRad * 180) / Math.PI,
    west: longitude - (radiusRad * 180) / (Math.PI * Math.max(Math.cos(latRad), 0.01)),
    east: longitude + (radiusRad * 180) / (Math.PI * Math.max(Math.cos(latRad), 0.01)),
  };
}

function escapeOverpass(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildOverpassQuery({ latitude, longitude, radiusMiles, tags, limit }) {
  const box = boundingBox(latitude, longitude, radiusMiles);
  const bbox = `(${box.south},${box.west},${box.north},${box.east})`;
  const clauses = [];

  // Each niche mapping is an OR across tag/value pairs. Building one clause
  // per pair avoids the AND bug that occurs when unrelated tag keys are chained.
  for (const [key, value] of tags) {
    const k = escapeOverpass(key);
    const v = escapeOverpass(value);
    clauses.push(`node["${k}"="${v}"]${bbox};`);
    clauses.push(`way["${k}"="${v}"]${bbox};`);
    clauses.push(`relation["${k}"="${v}"]${bbox};`);
  }

  return `[out:json][timeout:25];(${clauses.join('')});out center tags ${Math.min(limit * 4, 200)};`;
}

const CLOSED_PREFIXES = ['abandoned','disused','demolished','razed','removed','closed','vacant','proposed','planned','construction'];
function isClosed(tags = {}) {
  for (const prefix of CLOSED_PREFIXES) {
    if (['yes','1','true'].includes(String(tags[prefix] || '').toLowerCase())) return true;
    for (const key of Object.keys(tags)) {
      if (key.startsWith(`${prefix}:`) && ['yes','1','true'].includes(String(tags[key] || '').toLowerCase())) return true;
    }
  }
  return false;
}

function first(tags, keys) {
  for (const key of keys) {
    const value = clean(tags?.[key]);
    if (value) return value;
  }
  return '';
}

function normalizedUrl(value) {
  const raw = clean(value, 1000);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeBusiness(element, category) {
  const tags = element?.tags || {};
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  const street = [clean(tags['addr:housenumber'], 40), clean(tags['addr:street'], 160)].filter(Boolean).join(' ');
  const city = first(tags, ['addr:city','addr:town','addr:village']);
  const region = first(tags, ['addr:state','addr:province']);
  const postalCode = clean(tags['addr:postcode'], 40);
  const country = clean(tags['addr:country'], 80);
  const address = [street, city, region, postalCode, country].filter(Boolean).join(', ');

  return {
    id: `osm-${element.type}-${element.id}`,
    source: 'OPENSTREETMAP',
    osmType: element.type,
    osmId: String(element.id),
    name: first(tags, ['name','name:en','brand','operator']) || 'Unnamed Business',
    category,
    address,
    city,
    region,
    postalCode,
    country,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    phone: first(tags, ['phone','contact:phone','contact:mobile','mobile']),
    email: first(tags, ['email','contact:email']),
    website: normalizedUrl(first(tags, ['website','contact:website','url','contact:url'])),
    facebook: normalizedUrl(first(tags, ['facebook','contact:facebook'])),
    instagram: normalizedUrl(first(tags, ['instagram','contact:instagram'])),
    linkedin: normalizedUrl(first(tags, ['linkedin','contact:linkedin'])),
    youtube: normalizedUrl(first(tags, ['youtube','contact:youtube'])),
    openingHours: clean(tags.opening_hours, 400),
    operator: clean(tags.operator, 200),
    websiteStatus: first(tags, ['website','contact:website','url','contact:url']) ? 'confirmed' : 'unknown',
    verificationStatus: 'unverified',
  };
}

function scoreBusiness(business) {
  let leadScore = 0;
  if (business.phone) leadScore += 25;
  if (business.email) leadScore += 15;
  if (business.website) leadScore += 20;
  if (business.address) leadScore += 10;
  if (business.latitude != null && business.longitude != null) leadScore += 10;
  if (business.facebook) leadScore += 5;
  if (business.instagram) leadScore += 5;
  if (business.linkedin) leadScore += 5;
  if (business.openingHours) leadScore += 5;

  let activityScore = 0;
  if (business.phone) activityScore += 20;
  if (business.website) activityScore += 20;
  if (business.openingHours) activityScore += 15;
  if (business.facebook || business.instagram) activityScore += 15;
  if (business.address) activityScore += 10;
  if (business.latitude != null && business.longitude != null) activityScore += 10;
  if (business.email) activityScore += 10;

  return {
    ...business,
    leadScore: Math.min(100, leadScore),
    activityScore: Math.min(100, activityScore),
  };
}

async function queryOverpass({ niche, latitude, longitude, radiusMiles, limit }) {
  const mapping = BUSINESS_NICHES[niche];
  if (!mapping) throw new Error('Unsupported business niche.');
  const query = buildOverpassQuery({ latitude, longitude, radiusMiles, tags: mapping.tags, limit });
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.elements)) throw new Error('Overpass returned no elements.');

      const seen = new Set();
      const businesses = [];
      for (const element of payload.elements) {
        if (isClosed(element.tags)) continue;
        const business = scoreBusiness(normalizeBusiness(element, mapping.label));
        const key = [
          business.name.toLowerCase(),
          business.city.toLowerCase(),
          business.region.toLowerCase(),
          business.latitude?.toFixed?.(4) || '',
          business.longitude?.toFixed?.(4) || '',
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        businesses.push(business);
      }
      return businesses.sort((a,b) => b.leadScore - a.leadScore).slice(0, limit);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message ? `Business search failed: ${lastError.message}` : 'Business search failed.');
}

export async function findNearbyBusinesses({
  niche = 'general-business',
  location,
  radiusMiles = 15,
  limit = 20,
} = {}) {
  if (!BUSINESS_NICHES[niche]) throw new Error('Unsupported business niche.');
  const cleanLocation = clean(location, 240);
  if (!cleanLocation) throw new Error('Location is required.');

  const radius = Math.max(1, Math.min(50, Number(radiusMiles) || 15));
  const max = Math.max(1, Math.min(30, Number(limit) || 20));
  const cacheKey = `business:${niche}:${cleanLocation.toLowerCase()}:${radius}:${max}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const startedAt = Date.now();
  const geocode = await geocodeBusinessLocation(cleanLocation);
  const businesses = await queryOverpass({
    niche,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
    radiusMiles: radius,
    limit: max,
  });

  const result = {
    query: { niche, location: cleanLocation, radiusMiles: radius },
    geocode,
    count: businesses.length,
    businesses,
    providerUsed: 'OPENSTREETMAP_OVERPASS',
    durationMs: Date.now() - startedAt,
    cached: false,
  };
  cacheSet(cacheKey, result);
  return result;
}
