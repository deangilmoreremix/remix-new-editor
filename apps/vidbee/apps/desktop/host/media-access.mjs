// Which folders the host's /media route may serve from (not upstream). Kept separate so it can be tested on its own.
import { realpathSync } from 'node:fs'
import path from 'node:path'

/**
 * Folders the player legitimately needs: the download folders, browser uploads, and the preview files the player
 * remuxes or transcodes for playback. The data folder as a whole is NOT included (it holds the database and settings).
 */
/** @param {{ downloadPath?: string; downloadDir?: string; dataRoot: string; tmpDir: string }} input */
export const mediaRoots = (input) =>
  [
    input.downloadPath,
    input.downloadDir,
    path.join(input.dataRoot, 'uploads'),
    path.join(input.dataRoot, 'html5-preview'),
    path.join(input.tmpDir, 'vidbee-html5-preview')
  ].filter(Boolean)

/** True when `real` (already passed through realpath, so symlinks cannot escape) is inside one of the roots. */
/** @param {string} real @param {string[]} roots */
export const isAllowedMedia = (real, roots) =>
  roots.some((root) => {
    try {
      const resolved = realpathSync(root)
      return real === resolved || real.startsWith(resolved + path.sep)
    } catch {
      return false
    }
  })
