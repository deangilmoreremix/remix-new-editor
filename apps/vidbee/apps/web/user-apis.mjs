/* global process, fetch, setTimeout, setInterval */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/**
 * [host patch] One private VidBee API per user (VIDBEE_PER_USER=1), so users never share a library, queue or settings.
 * The gate sends an opaque per-user id; this pool starts that user's API on demand with its own data and download
 * folders (`<dataRoot>/<id>/{vidbee,downloads}`), reuses it while it is busy, and stops it when idle.
 */

const USER_ID = /^[a-f0-9]{32}$/

/** Whether `value` is an id made by the gate (also the only form allowed into a folder name). */
export const isUserId = (value) => typeof value === 'string' && USER_ID.test(value)

/** Every slot is taken by an API that is in use right now. */
export class PoolBusyError extends Error {
  constructor() {
    super('All SmartVidDownloader slots are busy.')
    this.name = 'PoolBusyError'
  }
}

/** Poll the API's /health until it answers (default: up to 60 s). */
export const defaultWaitHealthy = async (url, { timeoutMs = 60_000, intervalMs = 500 } = {}) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`)
      if (res.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`VidBee API at ${url} did not become healthy`)
}

/** Start one real API process for a user: migrate the history DB, then run the API (same steps as beam/start.sh). */
export const defaultSpawnApi = ({ port, dataDir, downloadDir }) => {
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(downloadDir, { recursive: true })
  const child = spawn('sh', ['-c', 'node dist/migrate-history.js && exec node dist/index.js'], {
    cwd: process.env.VIDBEE_API_DIR || '/app/api',
    env: {
      ...process.env,
      VIDBEE_API_HOST: '127.0.0.1',
      VIDBEE_API_PORT: String(port),
      VIDBEE_DATA_DIR: dataDir,
      VIDBEE_DOWNLOAD_DIR: downloadDir
    },
    stdio: 'inherit'
  })
  return {
    stop: () => child.kill('SIGTERM'),
    onExit: (callback) => child.once('exit', callback)
  }
}

/**
 * @param {object} options
 * @param {string} options.dataRoot folder that holds one sub-folder per user
 * @param {number} options.basePort first loopback port handed to an API
 * @param {number} options.maxActive most APIs running at once
 * @param {number} options.idleMs stop an API this long after its last request
 * @param {(a: {id: string, port: number, dataDir: string, downloadDir: string}) => {stop: () => void, onExit?: (cb: () => void) => void}} [options.spawnApi]
 * @param {(url: string) => Promise<void>} [options.waitHealthy]
 * @param {() => number} [options.now]
 * @param {number} [options.sweepEveryMs] how often idle APIs are stopped (0 = only when sweep() is called)
 */
export const createUserApiPool = ({
  dataRoot,
  basePort,
  maxActive,
  idleMs,
  spawnApi = defaultSpawnApi,
  waitHealthy = defaultWaitHealthy,
  now = Date.now,
  sweepEveryMs = 0
}) => {
  /** @type {Map<string, {id: string, url: string, active: number, lastUsed: number, ready: Promise<void>, handle?: {stop: () => void}}>} */
  const entries = new Map()
  // Ports rotate through a wider range than maxActive so a port that is still shutting down is not reused at once.
  let nextPort = 0
  const takePort = () => basePort + (nextPort++ % (maxActive * 4))

  const stopEntry = (entry) => {
    if (entries.get(entry.id) === entry) entries.delete(entry.id)
    entry.handle?.stop()
  }

  const makeRoom = () => {
    if (entries.size < maxActive) return
    const idle = [...entries.values()].filter((e) => e.active === 0).sort((a, b) => a.lastUsed - b.lastUsed)[0]
    if (!idle) throw new PoolBusyError()
    stopEntry(idle)
  }

  const start = (id) => {
    makeRoom()
    const port = takePort()
    const entry = {
      id,
      url: `http://127.0.0.1:${port}`,
      active: 0,
      lastUsed: now(),
      ready: Promise.resolve()
    }
    entries.set(id, entry)
    entry.ready = (async () => {
      try {
        entry.handle = spawnApi({
          id,
          port,
          dataDir: path.join(dataRoot, id, 'vidbee'),
          downloadDir: path.join(dataRoot, id, 'downloads')
        })
        entry.handle.onExit?.(() => {
          if (entries.get(id) === entry) entries.delete(id)
        })
        await waitHealthy(entry.url)
      } catch (error) {
        stopEntry(entry)
        throw error
      }
    })()
    return entry
  }

  const sweep = () => {
    for (const entry of [...entries.values()]) {
      if (entry.active === 0 && now() - entry.lastUsed > idleMs) stopEntry(entry)
    }
  }
  if (sweepEveryMs > 0) setInterval(sweep, sweepEveryMs).unref()

  return {
    /** The user's API, started if needed. Call `release()` when the request ends. Throws PoolBusyError when full. */
    async acquire(id) {
      if (!isUserId(id)) throw new Error('Invalid user id.')
      const entry = entries.get(id) ?? start(id)
      entry.active += 1
      entry.lastUsed = now()
      let released = false
      const release = () => {
        if (released) return
        released = true
        entry.active -= 1
        entry.lastUsed = now()
      }
      try {
        await entry.ready
      } catch (error) {
        release()
        throw error
      }
      return { url: entry.url, release }
    },
    sweep,
    stopAll() {
      for (const entry of [...entries.values()]) stopEntry(entry)
    }
  }
}

/** The pool the container runs, configured from the environment. */
export const createUserApiPoolFromEnv = (env = process.env) =>
  createUserApiPool({
    dataRoot: env.VIDBEE_USERS_DIR || '/data/users',
    basePort: Number(env.VIDBEE_USER_API_BASE_PORT || 3200),
    maxActive: Number(env.VIDBEE_MAX_ACTIVE_USERS || 3),
    idleMs: Number(env.VIDBEE_USER_IDLE_MINUTES || 15) * 60_000,
    sweepEveryMs: 60_000
  })
