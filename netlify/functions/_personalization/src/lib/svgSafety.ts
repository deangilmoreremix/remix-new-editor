/**
 * OpenAI's SVG output is meant to be static vector art (no scripts, external resources or embedded rasters).
 * This is a defence-in-depth check: anything that could run code or pull in outside content is refused.
 */
export function isSafeSvg(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0 || text.length > 2_000_000) return false
  if (!/<svg[\s>]/i.test(text)) return false
  if (/<\s*(script|foreignObject|iframe|object|embed|image|audio|video|style\b[^>]*@import)/i.test(text)) return false
  if (/\son[a-z]+\s*=/i.test(text)) return false
  if (/javascript:|data:text\/html|@import/i.test(text)) return false
  // Links and references may only point inside the file (#id); external urls are refused.
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(text)) return false
  if (/url\(\s*["']?(?!#)/i.test(text)) return false
  return true
}

/** Decodes a data:image/svg+xml;base64 URL (or plain URL-encoded svg) back to text, or null. */
export function svgTextFromDataUrl(url: string): string | null {
  const m = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(url)
  if (!m) return null
  try {
    return m[1] ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2])
  } catch {
    return null
  }
}
