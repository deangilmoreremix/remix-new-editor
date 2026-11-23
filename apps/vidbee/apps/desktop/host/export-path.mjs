// Resolve a browser export URL (/exports/<id>/<name>) to the file the main process saved (not upstream).
// Saving keeps the original basename (for example 日本語.txt), so retrieval must look that exact name up: re-sanitising it here
// turned every non-ASCII name into `_` and a 404. Safety comes from the layout instead: each export has its own server-made
// UUID folder, the name is reduced to a basename, and the result must be a regular file directly inside that folder.
import { statSync } from 'node:fs'
import path from 'node:path'

/**
 * @param {string} exportsDir
 * @param {string} id
 * @param {string} encodedName the URL path segment, still percent-encoded
 * @returns {string | null} the file path, or null when there is no such export
 */
export const resolveExportFile = (exportsDir, id, encodedName) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  let decoded
  try {
    decoded = decodeURIComponent(encodedName)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const dir = path.join(exportsDir, id)
  const file = path.join(dir, path.basename(decoded))
  if (path.dirname(file) !== dir) return null
  try {
    return statSync(file).isFile() ? file : null
  } catch {
    return null
  }
}
