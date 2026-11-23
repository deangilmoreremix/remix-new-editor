import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { apiDataDir, apiDefaultDownloadDir, apiSettingsFilesDir, isPathInside } from './api-paths'
import { webSettingsStore } from './web-settings-store'

const managedDownloadRoots = async (): Promise<string[]> => {
  const settings = await webSettingsStore.get()
  return [apiDefaultDownloadDir, settings.downloadPath.trim()].filter(
    (root, index, roots) => root.length > 0 && roots.indexOf(root) === index
  )
}

/**
 * Resolve a media file the web client is allowed to stream from the server.
 *
 * @param rawPath User-supplied filesystem path.
 * @returns Absolute file path, or null when the file is missing or outside the download roots.
 */
export const resolveReadableMediaFile = async (rawPath: string): Promise<string | null> => {
  const trimmed = rawPath.trim()
  if (!trimmed) {
    return null
  }
  const resolvedPath = path.resolve(trimmed)
  const roots = await managedDownloadRoots()
  if (!roots.some((root) => isPathInside(root, resolvedPath))) {
    return null
  }
  // The data directory can sit inside the default download directory; it holds the saved API key, databases
  // and uploaded cookie files, none of which may be served as media.
  const isPrivate = (candidate: string) =>
    [apiDataDir, apiSettingsFilesDir].some((dir) => isPathInside(path.resolve(dir), candidate))
  if (isPrivate(resolvedPath)) {
    return null
  }
  try {
    const info = await stat(resolvedPath)
    if (!info.isFile()) {
      return null
    }
    // A link inside a download root must not lead into the private directory either.
    const real = await realpath(resolvedPath)
    const privateReal = await Promise.all(
      [apiDataDir, apiSettingsFilesDir].map((dir) => realpath(dir).catch(() => path.resolve(dir)))
    )
    if (privateReal.some((dir) => isPathInside(dir, real))) {
      return null
    }
    return resolvedPath
  } catch {
    return null
  }
}
