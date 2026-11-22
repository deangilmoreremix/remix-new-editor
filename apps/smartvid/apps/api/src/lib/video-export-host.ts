/**
 * "Video with subtitles" export using the server's ffmpeg.
 *
 * `soft` muxes the subtitles as a selectable track without re-encoding the picture.
 * `burn` draws them into the picture (re-encodes, needs ffmpeg built with libass).
 * One export runs at a time because burning is CPU-heavy.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { exportTranscript, getTranscriptDetail } from './transcripts-host'
import { exportTranslation, listTranslations } from './translate-host'
import { resolveFfmpegLocation } from './engines'
import { createExclusive } from './exclusive'
import { resolveReadableMediaFile } from './managed-files'

const TIMEOUT_MS = 15 * 60 * 1000
const exportLock = createExclusive()

export class ExportBusyError extends Error {}

export interface VideoExportRequest {
  downloadId: string
  mode: 'soft' | 'burn'
  /** A finished translation's language, or empty for the transcript itself. */
  language: string
}

export interface VideoExportResult {
  filePath: string
  filename: string
  mimeType: string
  /** Delete the temporary files once the response has been sent. */
  cleanup: () => void
}

const ffmpegBinary = (): string => {
  const location = resolveFfmpegLocation()
  if (!location) {
    throw new Error('ffmpeg is not available on the server.')
  }
  return fs.existsSync(path.join(location, 'ffmpeg')) ? path.join(location, 'ffmpeg') : location
}

const run = (binary: string, args: string[], cwd: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000)
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('The export took too long and was stopped.'))
    }, TIMEOUT_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else if (/No such filter: 'subtitles'|Filter not found|libass/i.test(stderr)) {
        reject(new Error('This server\'s ffmpeg cannot burn in subtitles (built without libass). Use soft subtitles instead.'))
      } else {
        reject(new Error(`ffmpeg failed: ${stderr.trim().split('\n').slice(-2).join(' ') || `exit code ${code}`}`))
      }
    })
  })

/** One export at a time: burning is CPU-heavy. The lock covers validation as well as ffmpeg. */
export const exportVideoWithSubtitles = (request: VideoExportRequest): Promise<VideoExportResult> =>
  exportLock.run(
    () => runExport(request),
    () => {
      throw new ExportBusyError('Another video export is running. Try again in a moment.')
    }
  )

const runExport = async (request: VideoExportRequest): Promise<VideoExportResult> => {
  const detail = getTranscriptDetail(request.downloadId)
  if (!detail.record) {
    throw new Error('No transcript yet. Transcribe this download first.')
  }
  const sourcePath = detail.sourceFilePath ? await resolveReadableMediaFile(detail.sourceFilePath) : null
  if (!sourcePath) {
    throw new Error('The downloaded file is missing.')
  }
  const language = request.language.trim()
  if (language && !listTranslations(request.downloadId).some((t) => t.language === language && t.status === 'completed')) {
    throw new Error('That translation is not finished.')
  }
  const subtitles = language
    ? exportTranslation(request.downloadId, language, 'srt')
    : exportTranscript(request.downloadId, 'srt')

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartvid-export-'))
  const cleanup = (): void => {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  try {
    // ffmpeg runs inside `dir` with fixed relative names, so no path needs filter escaping.
    fs.writeFileSync(path.join(dir, 'subs.srt'), subtitles.content, 'utf-8')
    fs.copyFileSync(sourcePath, path.join(dir, `in${path.extname(sourcePath).toLowerCase() || '.mp4'}`))
    const inputName = `in${path.extname(sourcePath).toLowerCase() || '.mp4'}`
    const mp4Friendly = ['.mp4', '.m4v', '.mov'].includes(path.extname(inputName))
    const ext = request.mode === 'burn' || mp4Friendly ? 'mp4' : 'mkv'
    const outName = `out.${ext}`
    const args =
      request.mode === 'burn'
        ? [
            '-y', '-i', inputName,
            '-vf', "subtitles=subs.srt:force_style='FontSize=22,Outline=2'",
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outName
          ]
        : [
            '-y', '-i', inputName, '-i', 'subs.srt',
            '-map', '0', '-map', '1', '-c', 'copy',
            '-c:s', ext === 'mp4' ? 'mov_text' : 'srt',
            '-metadata:s:s:0', 'language=und',
            outName
          ]
    await run(ffmpegBinary(), args, dir)
    const stem = (detail.title ?? request.downloadId).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100)
    const tag = request.mode === 'burn' ? 'subtitled' : 'subs'
    return {
      filePath: path.join(dir, outName),
      filename: `${stem}.${language ? `${language}.` : ''}${tag}.${ext}`.replace(/\s+/g, '_'),
      mimeType: ext === 'mp4' ? 'video/mp4' : 'video/x-matroska',
      cleanup
    }
  } catch (error) {
    cleanup()
    throw error
  }
}
