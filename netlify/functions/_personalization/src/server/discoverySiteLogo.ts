/**
 * Detects the image a website uses as its own logo.
 *
 * The problem this solves
 * ----------------------
 * A modern site very often publishes its logo as an uninformative file inside
 * a directory whose name says "icon":
 *
 *     <a href="/" aria-label="Home, Starbucks">
 *       <img src="./assets/icons/siren.svg" alt="" class="size-8"/>
 *     </a>
 *
 * The name-based junk rules drop that image (correctly, in general: an
 * `icons/` directory really is full of decorations), so the pipeline never
 * sees the brand mark of a site that has one. The logo is the single most
 * valuable asset a business site publishes, and the marketing library cannot
 * do without it.
 *
 * The signal
 * ----------
 * The site itself says which image is its logo: the image it links to its own
 * home page with. That is a statement by the publisher about its own brand,
 * not a guess from a file name, so it outranks the name-based rules.
 *
 * The rule is deliberately narrow:
 *
 *   - only an `<a href>` that resolves to the ORIGIN ROOT of the crawled site
 *     counts, and
 *   - only the FIRST image inside that link counts, and
 *   - the link must be on the same origin as the site being crawled.
 *
 * A social badge (`<a href="https://facebook.com/...">`) points at another
 * origin and is therefore not a site logo; a "home" link that contains three
 * photos contributes only its first image.
 */

import type { CheerioAPI } from 'cheerio'

/**
 * The `<img>` elements that are the site's own logo.
 *
 * The set holds DOM element identities, so a caller can test membership with
 * `set.has(element)` while iterating the same document.
 */
export function collectSiteLogoImages($: CheerioAPI, baseUrl: string): Set<any> {
  const logos = new Set<any>()

  let origin: string
  try {
    origin = new URL(baseUrl).origin
  } catch {
    return logos
  }

  $('a[href]').each((_index: number, element: any) => {
    const href = $(element).attr('href') || ''
    let resolved: URL
    try {
      resolved = new URL(href, baseUrl)
    } catch {
      return
    }

    // Another origin: a social link, a CDN link, a partner link. Not a logo.
    if (resolved.origin !== origin) return

    // The site root, and nothing else. `/about` is a page, not the brand.
    if (resolved.pathname !== '/' && resolved.pathname !== '') return

    const firstImage = $(element).find('img').first()
    if (firstImage.length === 0) return
    logos.add(firstImage.get(0))
  })

  return logos
}
