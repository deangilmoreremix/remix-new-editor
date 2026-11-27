/**
 * User-facing business niches for the Find Local Business search.
 *
 * These keys MUST stay in sync with `NICHE_MAPPINGS` in
 * `src/server/businessDiscovery/nicheMappings.ts` — the
 * `/api/personalization/find-businesses` route rejects any niche that is not a
 * key of that map, so drift here surfaces as "Unsupported niche" errors at
 * runtime. A unit test (`__tests__/businessNiches.test.ts`) asserts the two
 * lists stay aligned.
 */

export interface BusinessNiche {
  key: string
  label: string
}

export const BUSINESS_NICHES: BusinessNiche[] = [
  { key: 'ecommerce', label: 'E-Commerce / Retail' },
  { key: 'real-estate', label: 'Real Estate' },
  { key: 'restaurants-food', label: 'Restaurants / Food' },
  { key: 'beauty', label: 'Beauty / Salon' },
  { key: 'wellness-fitness', label: 'Wellness / Fitness' },
  { key: 'education', label: 'Education' },
  { key: 'technology', label: 'Technology / SaaS' },
  { key: 'finance', label: 'Finance' },
  { key: 'entertainment-media', label: 'Entertainment / Media' },
  { key: 'automotive', label: 'Automotive' },
  { key: 'travel-hospitality', label: 'Travel / Hospitality' },
  { key: 'sports-outdoors', label: 'Sports / Outdoors' },
  { key: 'general-business', label: 'General Business' },
  { key: 'healthcare-medical', label: 'Healthcare / Medical' },
  { key: 'home-contractors', label: 'Home Contractors' },
  { key: 'auto-detailing', label: 'Auto Detailing' },
  { key: 'pet-services', label: 'Pet Services' },
  { key: 'professional-services', label: 'Professional Services' },
]
