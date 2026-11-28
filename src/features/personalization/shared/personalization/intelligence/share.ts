/** Web Share with a clipboard fallback and a last-resort result the UI can show as selectable text. Never uploads anything. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unsupported'

export async function shareOrCopy(payload: { title?: string; text?: string; url?: string }): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (!nav) return 'unsupported'
  const data = { title: payload.title, text: payload.text, url: payload.url }
  try {
    if (typeof nav.share === 'function' && (typeof nav.canShare !== 'function' || nav.canShare(data))) {
      await nav.share(data)
      return 'shared'
    }
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
  }
  const text = [payload.text, payload.url].filter(Boolean).join('\n')
  try {
    if (nav.clipboard?.writeText && text) { await nav.clipboard.writeText(text); return 'copied' }
  } catch { /* fall through */ }
  return 'unsupported'
}
