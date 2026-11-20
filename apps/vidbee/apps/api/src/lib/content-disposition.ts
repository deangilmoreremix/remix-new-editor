/**
 * Build a Content-Disposition header value for any filename.
 *
 * Node refuses header values with characters above Latin-1 (it throws ERR_INVALID_CHAR), so a Japanese or emoji
 * title would turn the download into a 500. This gives an ASCII fallback for old clients plus the RFC 5987/6266
 * `filename*=UTF-8''…` form that browsers use. Quotes, backslashes and line breaks are removed so a filename can
 * never break out of the header.
 */
export const contentDisposition = (type: 'attachment' | 'inline', filename: string): string => {
  const clean = filename.replace(/[\r\n"\\]/g, '_')
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(clean).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
