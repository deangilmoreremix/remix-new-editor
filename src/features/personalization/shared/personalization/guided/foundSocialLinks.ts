import type { SocialLinks, SocialNetwork } from '../SocialIcons'

const NETWORKS: SocialNetwork[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok']

interface FoundSource {
  value?: string
  sourceUrl?: string
  method?: string
}

/**
 * Social profiles to show in the simple "Find your business" step: the links the website research found
 * (`research.socialLinks`), plus values the contact lookup found that the profile STILL holds (a value the
 * user typed over is never labelled as found). Lookup values win over research ones. Titles say where each
 * was found, for the icon's hover text.
 */
export function foundSocialLinks(input: {
  research?: { finalUrl?: string; socialLinks?: Partial<Record<string, string | undefined>> } | null
  clientForm?: Partial<Record<string, unknown>> | null
  contactSources?: Partial<Record<string, FoundSource | undefined>> | null
}): { links: SocialLinks; titles: Partial<Record<SocialNetwork, string>> } {
  const links: SocialLinks = {}
  const titles: Partial<Record<SocialNetwork, string>> = {}
  for (const n of NETWORKS) {
    const fromResearch = input.research?.socialLinks?.[n]
    if (typeof fromResearch === 'string' && fromResearch.trim()) {
      links[n] = fromResearch.trim()
      if (input.research?.finalUrl) titles[n] = `found on ${input.research.finalUrl}`
    }
    const source = input.contactSources?.[n]
    const value = input.clientForm?.[n]
    if (source && typeof value === 'string' && value && value === source.value) {
      links[n] = value
      titles[n] = source.sourceUrl ? `found on ${source.sourceUrl}${source.method ? ` (${source.method})` : ''}` : titles[n]
    }
  }
  return { links, titles }
}
