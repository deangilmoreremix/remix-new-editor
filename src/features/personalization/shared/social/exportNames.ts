/** Clear, filesystem-safe filenames for exports. */
export function slug(s: string, max = 40): string {
  return (s || 'post').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'post'
}
export type ExportKind = 'image' | 'video' | 'thumbnail' | 'subtitles' | 'caption'
export function exportFilename(kind: ExportKind, title: string, ext: string, opts: { platform?: string; aspect?: string; date?: Date } = {}): string {
  const d = (opts.date ?? new Date()).toISOString().slice(0, 10)
  const parts = [slug(title), opts.platform, opts.aspect?.replace(':', 'x'), kind === 'thumbnail' ? 'thumbnail' : kind === 'caption' ? 'caption' : undefined, d].filter(Boolean)
  return `${parts.join('_')}.${ext.replace(/^\./, '')}`
}
export function downloadBlob(blob: Blob, filename: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob)
  const a = doc.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  doc.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
