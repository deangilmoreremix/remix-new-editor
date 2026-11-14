/**
 * Draft snapshots and backup archives for the design settings (Stage 12). Pure.
 *
 * What a snapshot holds: the settings JSON. What it cannot hold: anything that only exists in this browser's memory (blob: URLs such as a
 * clip just recorded or a file just opened). Those are removed and COUNTED, and the owner is told, never silently lost or left dangling.
 */
import { templateFingerprint } from '../bulk/recipientInput'
import { buildZip, readZip, ZipError } from '../bulk/zip'
import { normalizePreviewSettings } from '../preview/presets'
import type { PersonalizationPreviewSettings } from '../preview/types'

export const SNAPSHOT_VERSION = 1
export const MAX_SNAPSHOTS = 5
export const MAX_SETTINGS_BYTES = 2_000_000

export interface Snapshot { version: 1; savedAt: string; hash: string; settings: unknown; strippedBlobUrls: number }

/** Deep copy with every `blob:` string replaced by "" (returns how many). Cycles and non-JSON values are dropped. */
export function stripEphemeral(value: unknown): { value: unknown; stripped: number } {
  let stripped = 0
  const walk = (v: unknown, depth: number): unknown => {
    if (typeof v === 'string') { if (v.startsWith('blob:')) { stripped += 1; return '' } return v }
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v
    if (depth > 24) return undefined
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1))
    if (typeof v === 'object') { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (k === '__proto__' || k === 'constructor') continue; const r = walk(x, depth + 1); if (r !== undefined) o[k] = r } return o }
    return undefined
  }
  return { value: walk(value, 0), stripped }
}
export const hashSettings = (settings: unknown): string => templateFingerprint(stripEphemeral(settings).value)

export function makeSnapshot(settings: PersonalizationPreviewSettings | unknown, now: Date = new Date()): Snapshot {
  const { value, stripped } = stripEphemeral(settings)
  return { version: 1, savedAt: now.toISOString(), hash: templateFingerprint(value), settings: value, strippedBlobUrls: stripped }
}
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || typeof r.savedAt !== 'string' || Number.isNaN(Date.parse(r.savedAt)) || typeof r.hash !== 'string' || !r.settings || typeof r.settings !== 'object') return null
  if (JSON.stringify(r.settings).length > MAX_SETTINGS_BYTES) return null
  return { version: 1, savedAt: r.savedAt, hash: r.hash.slice(0, 40), settings: r.settings, strippedBlobUrls: Number.isFinite(r.strippedBlobUrls) ? Number(r.strippedBlobUrls) : 0 }
}
/** Newest first, at most MAX_SNAPSHOTS, and a snapshot identical to the newest one only refreshes it. */
export function pushSnapshot(list: Snapshot[], snap: Snapshot): Snapshot[] {
  const rest = list[0] && list[0].hash === snap.hash ? list.slice(1) : list
  return [snap, ...rest].slice(0, MAX_SNAPSHOTS)
}
/** Should the owner be offered a saved draft? Only when it differs from what is on screen and is not just the starting state. */
export function draftToOffer(list: Snapshot[], current: unknown): Snapshot | null {
  const here = hashSettings(current)
  const newest = list[0]
  return newest && newest.hash !== here ? newest : null
}
export function restoreSettings(snap: Snapshot): PersonalizationPreviewSettings { return normalizePreviewSettings(snap.settings as never) }

// ---------------------------------------------------------------- backup archive
export interface Backup { settings: PersonalizationPreviewSettings; savedAt: string; strippedBlobUrls: number }
export async function buildBackup(settings: unknown, now: Date = new Date()): Promise<Blob> {
  const snap = makeSnapshot(settings, now)
  const manifest = { format: 'smartvideo-backup', version: SNAPSHOT_VERSION, savedAt: snap.savedAt, hash: snap.hash, strippedBlobUrls: snap.strippedBlobUrls }
  const readme = ['SmartVideo design backup', '', `Made: ${snap.savedAt}`, '', 'settings.json holds the video design (layers, effects, captions, audio mix, thumbnail and GIF choices).', 'It does NOT contain the video, music, pictures or recordings themselves, and anything that existed only in the browser\'s memory when the backup was made',
    `(${snap.strippedBlobUrls} item${snap.strippedBlobUrls === 1 ? '' : 's'}) was left out. Restore it from the editor with "Restore from a backup file".`].join('\n')
  const enc = new TextEncoder()
  return buildZip([{ name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)), modified: now }, { name: 'settings.json', data: enc.encode(JSON.stringify(snap.settings)), modified: now }, { name: 'README.txt', data: enc.encode(readme), modified: now }])
}
export class BackupError extends Error { constructor(message: string) { super(message); this.name = 'BackupError' } }
export async function readBackup(blob: Blob): Promise<Backup> {
  let files: Record<string, Uint8Array>
  try { files = await readZip(blob) } catch (e) { throw new BackupError(e instanceof ZipError ? e.message : 'That file could not be read.') }
  const text = (n: string) => { const f = files[n]; if (!f) throw new BackupError(`This is not a SmartVideo backup (no ${n}).`); try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(f)) } catch { throw new BackupError(`The ${n} in this backup is damaged.`) } }
  const manifest = text('manifest.json'); const settings = text('settings.json')
  if (manifest?.format !== 'smartvideo-backup') throw new BackupError('This is not a SmartVideo backup.')
  if (manifest.version !== SNAPSHOT_VERSION) throw new BackupError('This backup was made by a newer version of the app and cannot be restored here.')
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new BackupError('The settings in this backup are damaged.')
  if (templateFingerprint(settings) !== manifest.hash) throw new BackupError('The settings in this backup do not match their checksum, so it was not restored.')
  return { settings: normalizePreviewSettings(settings as never), savedAt: String(manifest.savedAt ?? ''), strippedBlobUrls: Number(manifest.strippedBlobUrls) || 0 }
}
