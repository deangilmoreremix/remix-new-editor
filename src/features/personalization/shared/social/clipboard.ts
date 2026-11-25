/** Clipboard helpers that never throw: they return a typed result for the UI. */
export type ClipResult<T = void> = { ok: true; value: T } | { ok: false; reason: 'unsupported' | 'denied' | 'empty' | 'error'; message: string }

const fail = (reason: 'unsupported' | 'denied' | 'empty' | 'error', message: string): ClipResult<never> => ({ ok: false, reason, message }) as any

export async function copyText(text: string, nav: any = globalThis.navigator): Promise<ClipResult> {
  if (!nav?.clipboard?.writeText) return fail('unsupported', 'Clipboard is not available in this browser or context (needs HTTPS).')
  try { await nav.clipboard.writeText(text); return { ok: true, value: undefined } } catch (e: any) {
    return fail(e?.name === 'NotAllowedError' ? 'denied' : 'error', e?.name === 'NotAllowedError' ? 'The browser blocked clipboard access. Select the text and copy manually.' : `Copy failed: ${e?.message ?? e}`)
  }
}

export async function readClipboardText(nav: any = globalThis.navigator): Promise<ClipResult<string>> {
  if (!nav?.clipboard?.readText) return fail('unsupported', 'Reading the clipboard is not supported here. Paste with Ctrl/Cmd+V instead.')
  try {
    const t = await nav.clipboard.readText()
    return t ? { ok: true, value: t } : fail('empty', 'The clipboard has no text.')
  } catch (e: any) {
    return fail(e?.name === 'NotAllowedError' ? 'denied' : 'error', e?.name === 'NotAllowedError' ? 'Clipboard permission was denied. Paste with Ctrl/Cmd+V instead.' : `Paste failed: ${e?.message ?? e}`)
  }
}

/** Image files from a paste event (works without the async Clipboard API). */
export function imagesFromPasteEvent(e: { clipboardData?: { items?: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }> } | null }): File[] {
  const out: File[] = []
  for (const item of Array.from(e.clipboardData?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) out.push(f) }
  }
  return out
}
