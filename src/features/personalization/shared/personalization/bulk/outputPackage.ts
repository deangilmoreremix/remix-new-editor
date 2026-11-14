/**
 * Turns a finished (or partly finished) batch into one downloadable ZIP: a folder per recipient with its thumbnail, GIF and video,
 * a manifest.csv that opens safely in a spreadsheet, and a README. Only files that were really produced are included; failures are
 * listed in the manifest with their reason, never hidden.
 */
import { toCsv, type Recipient } from './csv'
import { buildZip, safeZipName, type ZipEntry } from './zip'
import { artifactKey, isReadable, type ArtifactStore, type BatchJob, type StepName } from './batchJob'
import { recipientFolder } from './recipientInput'
import { planKitImport } from '../email/kitExport'

const EXT: Record<StepName, string> = { thumbnail: 'jpg', gif: 'gif', video: 'mp4' }
const FILE: Record<StepName, string> = { thumbnail: 'thumbnail', gif: 'personalized', video: 'video' }

export interface PackageResult { blob: Blob; files: string[]; manifestCsv: string; included: number; missing: number; missingSteps: Array<{ itemId: string; step: StepName }> }

export async function buildPackage(args: { job: BatchJob; recipients: Recipient[]; artifacts: ArtifactStore; links?: Record<string, string>; suppressedHashes?: Iterable<string>; now?: () => Date; thumbnailExt?: 'jpg' | 'png' }): Promise<PackageResult> {
  const { job, recipients, artifacts } = args
  const byId = new Map(recipients.map((r, i) => [r.id, { r, i }]))
  const entries: ZipEntry[] = []; const files: string[] = []; let included = 0; let missing = 0; const missingSteps: PackageResult['missingSteps'] = []
  const header = ['id', 'name', 'company', 'email', 'website', 'status', ...job.stepNames.map((s) => `${s}_file`), 'personal_link', 'error']
  const rows: string[][] = [header]
  for (const item of job.items) {
    const found = byId.get(item.id); if (!found) continue
    const { r, i } = found; const folder = recipientFolder(r, i)
    const cols: string[] = []
    for (const step of job.stepNames) {
      const st = item.steps[step]
      const stored = st?.status === 'done' ? await artifacts.get(artifactKey(job.id, item.id, step)) : null
      const blob = (await isReadable(stored)) ? stored : null
      if (blob) {
        const name = safeZipName(`${folder}/${FILE[step]}.${step === 'thumbnail' ? (args.thumbnailExt ?? (blob.type === 'image/png' ? 'png' : 'jpg')) : EXT[step]}`)
        entries.push({ name, data: blob, modified: args.now?.() }); files.push(name); cols.push(name); included += 1
      } else { cols.push(''); if (st?.status === 'done') { missing += 1; missingSteps.push({ itemId: item.id, step }) } }
    }
    rows.push([r.id, r.name, r.company, r.email, r.website, item.status, ...cols, args.links?.[r.id] ?? '', item.error ?? ''])
  }
  const manifestCsv = toCsv(rows)
  // A Kit import file when personal links exist (recipients with no valid address, no link or on the suppression list are left out and listed in the README).
  let kitNote = ''
  if (args.links && Object.keys(args.links).length > 0) {
    const kit = await planKitImport(recipients, { links: args.links, suppressedHashes: args.suppressedHashes })
    if (kit.rows.length) { entries.push({ name: 'kit-import.csv', data: new TextEncoder().encode('\uFEFF' + kit.csv) }); files.push('kit-import.csv') }
    kitNote = `kit-import.csv: ${kit.rows.length} subscriber${kit.rows.length === 1 ? '' : 's'} for Kit (columns email, first_name, company, smartvideo_link, smartvideo_gif). Left out: ${kit.skipped.length} (${args.suppressedHashes ? 'no or invalid email, no link, or unsubscribed in this app' : 'no or invalid email, or no link'}).${args.suppressedHashes ? '' : ' Unsubscribes made through this app are NOT checked here; Kit applies its own unsubscribes and suppression when you send from Kit.'}`
  }
  const readme = [
    'Personalized videos — package', '',
    `Made: ${(args.now?.() ?? new Date()).toISOString()}`, `Recipients in this batch: ${job.items.length}`, `Files included: ${included}`, ...(missing ? [`Files that were marked done but could not be read back: ${missing}`] : []), '',
    'Each folder holds one recipient\'s files. manifest.csv lists every recipient, what was made for them, their personal link (if you made one) and, for anyone whose files could not be made, the reason.',
    'Cells in manifest.csv that begin with = + - or @ have an apostrophe added so a spreadsheet shows them as text.', '',
    ...(kitNote ? [kitNote, ''] : []),
    'A GIF is the preview you put in an email: Outlook for Windows shows only its first frame, so the first frame is a real picture.',
  ].join('\n')
  entries.push({ name: 'manifest.csv', data: new TextEncoder().encode('﻿' + manifestCsv) }, { name: 'README.txt', data: new TextEncoder().encode(readme) })
  files.push('manifest.csv', 'README.txt')
  return { blob: await buildZip(entries), files, manifestCsv, included, missing, missingSteps }
}
