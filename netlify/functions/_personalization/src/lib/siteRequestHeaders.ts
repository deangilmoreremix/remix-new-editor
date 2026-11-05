/**
 * Request headers for fetching business WEBSITES.
 *
 * The agent identifies the crawler honestly in the standard
 * `Mozilla/5.0 (compatible; Name/version; +url)` form that search-engine
 * crawlers use. An earlier version imitated desktop Chrome; a before/after
 * check against real sites showed it changed nothing on ordinary sites and
 * got the crawl BLOCKED (403) by a bot-managed site that served the honest
 * agent, because a "Chrome" that does not behave like Chrome is exactly what
 * bot management looks for. A site that refuses the crawler is respected:
 * nothing here tries to get past a refusal.
 *
 * What is kept from the browser-like set are the content-negotiation headers
 * (Accept, Accept-Language), which some hosts need to serve the normal HTML.
 *
 * OpenStreetMap services (Nominatim / Overpass) keep their own
 * `SmartVideoGO-AI/1.0` agent, per their usage policies.
 */

/** The crawler's identifying agent. */
export const SITE_USER_AGENT = 'Mozilla/5.0 (compatible; SmartVideoGO/1.0; +https://go.smartvid.app)'

/** Headers for an HTML page. */
export const SITE_PAGE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'User-Agent': SITE_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
})

/**
 * Headers for an image. Lists ONLY the formats the asset pipeline keeps
 * (downloadImage accepts jpeg / png / webp / gif; SVG logos are served as-is).
 * Image CDNs (Shopify, Cloudinary, Wix) negotiate the format from Accept, so
 * advertising AVIF here would make them send files the download step drops.
 */
export const SITE_IMAGE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'User-Agent': SITE_USER_AGENT,
  Accept: 'image/webp,image/png,image/jpeg,image/gif,image/svg+xml;q=0.9,*/*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.9',
})

/** Headers for a stylesheet. */
export const SITE_STYLESHEET_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'User-Agent': SITE_USER_AGENT,
  Accept: 'text/css,*/*;q=0.1',
  'Accept-Language': 'en-US,en;q=0.9',
})

/** Headers for an XML document (sitemap). */
export const SITE_XML_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'User-Agent': SITE_USER_AGENT,
  Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
})
