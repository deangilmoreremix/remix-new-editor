// src/lib/personalization/batchExport.js
//
// The orchestration shared by every "one video per contact/client" export (the
// Timeline Editor and the Personalization window use different render engines,
// so each passes its own `renderOne`). Sequential because the renderers are
// single-flight; one failed contact never stops the rest; cancelling stops
// cleanly. Pure: no DOM, no network.

const abortedError = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

/** A name safe for a file: no path/control characters, trimmed, never empty. */
export function safeFileName(name, fallback = 'video') {
  const cleaned = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  return cleaned || fallback;
}

/** `base.ext`, or `base (2).ext`, `base (3).ext` ... when `used` already has it. `used` is updated. */
export function uniqueFileName(base, used, ext) {
  const stem = safeFileName(base);
  const dot = ext ? `.${String(ext).replace(/^\./, '')}` : '';
  let name = `${stem}${dot}`;
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${stem} (${n})${dot}`;
  used.add(name.toLowerCase());
  return name;
}

/**
 * Render each item in turn.
 * @param {{ id: string, name: string }[]} items
 * @param {(item, ctx: { index: number, total: number, onProgress: (p: number) => void, signal?: AbortSignal }) => Promise<any>} renderOne
 *        resolves with the result (usually a Blob); throwing marks that item failed.
 * @param {{ signal?: AbortSignal, onProgress?: (overall: number, info: object) => void, onItem?: (result: object, index: number) => void | Promise<void> }} opts
 * @returns {Promise<{ results: object[], cancelled: boolean }>}
 */
export async function runBatch(items, renderOne, { signal, onProgress, onItem } = {}) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const results = [];
  let cancelled = false;
  const clamp01 = (p) => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0);

  for (let index = 0; index < total; index += 1) {
    if (signal?.aborted) { cancelled = true; break; }
    const item = list[index];
    const base = { id: item.id, name: item.name };
    onProgress?.(index / total, { index, total, item, stage: 'start' });
    let result;
    try {
      const value = await renderOne(item, {
        index,
        total,
        signal,
        onProgress: (p) => onProgress?.((index + clamp01(p)) / total, { index, total, item, stage: 'render' }),
      });
      if (signal?.aborted) throw abortedError();
      result = { ...base, ok: true, value };
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError' || /^cancel/i.test(String(err?.message || ''))) { cancelled = true; break; }
      result = { ...base, ok: false, error: String(err?.message || err || 'Failed') };
    }
    results.push(result);
    await onItem?.(result, index);
    onProgress?.((index + 1) / total, { index, total, item, stage: 'done' });
  }
  return { results, cancelled };
}

/** One line for a toast / status: "Exported 4 of 5. Failed: Raj (reason)". */
export function summarizeBatch({ results = [], cancelled = false } = {}, { noun = 'video' } = {}) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const plural = (n) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  let text = failed.length || cancelled
    ? `Exported ${ok} of ${results.length}`
    : `Exported ${plural(ok)}`;
  if (cancelled) text += ' (cancelled)';
  if (failed.length) text += `. Failed: ${failed.map((f) => `${f.name} (${f.error})`).join(', ')}`;
  return text;
}
