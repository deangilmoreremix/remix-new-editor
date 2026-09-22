async function getSession() {
  try {
    const { createClient } = await import('../supabase.js');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

async function post(path, body) {
  const session = await getSession();
  if (!session?.access_token) throw new Error('Sign in to use business discovery.');
  const response = await fetch(`/api/personalizer/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Business discovery failed (${response.status})`);
  return payload;
}

export const BUSINESS_DISCOVERY_NICHES = Object.freeze([
  ['general-business', 'General Business'],
  ['restaurants-food', 'Restaurants / Food'],
  ['real-estate', 'Real Estate'],
  ['beauty', 'Beauty / Salon'],
  ['wellness-fitness', 'Wellness / Fitness'],
  ['education', 'Education'],
  ['technology', 'Technology / SaaS'],
  ['finance', 'Finance'],
  ['automotive', 'Automotive'],
  ['travel-hospitality', 'Travel / Hospitality'],
  ['sports-outdoors', 'Sports / Outdoors'],
  ['entertainment-media', 'Entertainment / Media'],
  ['ecommerce', 'E-Commerce / Retail'],
]);

export async function findBusinesses({
  niche = 'general-business',
  location,
  radiusMiles = 15,
  limit = 20,
} = {}) {
  return post('find-businesses', { niche, location, radiusMiles, limit });
}

export async function researchBusiness({ websiteUrl } = {}) {
  if (!websiteUrl) throw new Error('Business website is required for research.');
  return post('research-business', { websiteUrl });
}
