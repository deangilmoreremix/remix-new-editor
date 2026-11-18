import { socialHref, type SocialLinks, type SocialNetwork } from '../SocialIcons'

const NETWORKS: SocialNetwork[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok']

interface FoundSource {
  value?: string
  sourceUrl?: string
  method?: string
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * A profile link only when `SocialIcons` will really render it. A bare handle is turned into a URL by
 * `socialHref`, and that URL is checked again when the icon is drawn (share/login paths are refused), so a
 * handle like `@login` (-> facebook.com/login) passes the first check but not the second.
 */
function usable(n: SocialNetwork, raw: string): string | null {
  const href = socialHref(n, raw)
  return href && socialHref(n, href) ? href : null
}

/**
 * Social profiles to show in the simple "Find your business" step: the links the website research found
 * (`research.socialLinks`), plus values the contact lookup found that the profile STILL holds (a value the
 * user typed over is never labelled as found). Only links `socialHref` accepts are returned (host allowlist,
 * no share/login URLs), so a rejected value never hides a good one and the caller can count the result.
 * The lookup wins for a network only when its value is usable. Titles say where each was found.
 */
export function foundSocialLinks(input: {
  research?: { finalUrl?: string; socialLinks?: Partial<Record<string, string | undefined>> } | null
  clientForm?: Partial<Record<string, unknown>> | null
  contactSources?: Partial<Record<string, FoundSource | undefined>> | null
}): { links: SocialLinks; titles: Partial<Record<SocialNetwork, string>> } {
  const links: SocialLinks = {}
  const titles: Partial<Record<SocialNetwork, string>> = {}
  for (const n of NETWORKS) {
    const research = input.research?.socialLinks?.[n]
    const researchHref = typeof research === 'string' ? usable(n, research) : null

    const source = input.contactSources?.[n]
    const value = input.clientForm?.[n]
    const lookupHref =
      source && typeof source.value === 'string' && typeof value === 'string' && value && same(value, source.value)
        ? usable(n, value)
        : null

    if (lookupHref) {
      links[n] = lookupHref
      titles[n] = source?.sourceUrl
        ? `found on ${source.sourceUrl}${source.method ? ` (${source.method})` : ''}`
        : 'found by the contact lookup'
    } else if (researchHref) {
      links[n] = researchHref
      if (input.research?.finalUrl) titles[n] = `found on ${input.research.finalUrl}`
    }
  }
  return { links, titles }
}
