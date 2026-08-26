#!/usr/bin/env node
// MuAPI model catalog sync health monitor.
// Compares upstream-muapi/main:models_dump.json against the local copy and
// reports drift, endpoint validity, and an overall health score.
//
// Usage:
//   node scripts/muapi-health-monitor.mjs --check-new-models
//   node scripts/muapi-health-monitor.mjs --check-removed-models
//   node scripts/muapi-health-monitor.mjs --check-changed-endpoints
//   node scripts/muapi-health-monitor.mjs --full-report
//   node scripts/muapi-health-monitor.mjs --full-report --output report.json
//   node scripts/muapi-health-monitor.mjs --full-report --verbose
//   node scripts/muapi-health-monitor.mjs --full-report --quiet

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const LOCAL_DUMP_PATH = join(rootDir, 'packages', 'studio', 'src', 'models_dump.json')
const UPSTREAM_REMOTE = 'upstream-muapi'
const UPSTREAM_FILE = 'models_dump.json'

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const flags = {
  checkNewModels: args.includes('--check-new-models'),
  checkRemovedModels: args.includes('--check-removed-models'),
  checkChangedEndpoints: args.includes('--check-changed-endpoints'),
  fullReport: args.includes('--full-report'),
  verbose: args.includes('--verbose'),
  quiet: args.includes('--quiet'),
  output: null,
}

const outputIdx = args.indexOf('--output')
if (outputIdx !== -1 && args[outputIdx + 1]) {
  flags.output = args[outputIdx + 1]
}

const hasAnyFlag =
  flags.checkNewModels ||
  flags.checkRemovedModels ||
  flags.checkChangedEndpoints ||
  flags.fullReport

if (!hasAnyFlag) {
  console.error(
    'Usage: node scripts/muapi-health-monitor.mjs [flags]\n' +
      '  --check-new-models        Detect models in upstream not present locally\n' +
      '  --check-removed-models    Detect models removed from upstream\n' +
      '  --check-changed-endpoints Detect endpoint/field changes\n' +
      '  --full-report             Generate comprehensive health report\n' +
      '  --output <file>           Write JSON report to file\n' +
      '  --verbose                 Detailed console output\n' +
      '  --quiet                   CI mode: only output failures\n'
  )
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(...msgs) {
  if (!flags.quiet) console.log(...msgs)
}

function logVerbose(...msgs) {
  if (flags.verbose && !flags.quiet) console.log(...msgs)
}

function execGit(args, options = {}) {
  try {
    return execSync(`git ${args}`, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.ignoreError ? 'pipe' : 'pipe'],
      ...options,
    })
  } catch (err) {
    if (options.ignoreError) return null
    throw err
  }
}

function fetchUpstreamDump() {
  try {
    const raw = execGit(`show ${UPSTREAM_REMOTE}/main:${UPSTREAM_FILE}`)
    return JSON.parse(raw.trim())
  } catch (err) {
    throw new Error(
      `Failed to fetch upstream models dump from ${UPSTREAM_REMOTE}/main: ${err.message}`
    )
  }
}

function fetchLocalDump() {
  if (!existsSync(LOCAL_DUMP_PATH)) {
    logVerbose(`Local dump not found at ${LOCAL_DUMP_PATH} — treating as empty catalog.`)
    return null
  }
  try {
    const raw = readFileSync(LOCAL_DUMP_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Failed to read local models dump: ${err.message}`)
  }
}

function getUpstreamCommit() {
  try {
    return execGit(`rev-parse ${UPSTREAM_REMOTE}/main`).trim()
  } catch {
    return 'unknown'
  }
}

function getLastSyncTimestamp() {
  if (!existsSync(LOCAL_DUMP_PATH)) return null
  try {
    const stat = statSync(LOCAL_DUMP_PATH)
    return stat.mtime.toISOString()
  } catch {
    return null
  }
}

// Normalize a dump into a map of modelId → model record.
// Handles three shapes:
//   1. Array: [ { id, ... }, ... ]
//   2. { models: [...] } or { data: [...] }
//   3. { t2i: [...], i2i: [...], ... } — models grouped by type
function normalizeDump(dump) {
  if (!dump) return new Map()
  const map = new Map()

  // Shape 3: models grouped by type (upstream's models_dump.json)
  const typeKeys = ['t2i', 'i2i', 't2v', 'i2v', 'v2v', 'lipsync', 'audio', 'recast']
  let isGrouped = false
  for (const key of typeKeys) {
    if (Array.isArray(dump[key])) {
      isGrouped = true
      for (const model of dump[key]) {
        if (model && model.id != null) {
          map.set(String(model.id), model)
        }
      }
    }
  }
  if (isGrouped) return map

  // Shape 1 & 2: array or { models: [...] } / { data: [...] }
  const list = Array.isArray(dump) ? dump : dump.models || dump.data || []
  for (const model of list) {
    if (model && model.id != null) {
      map.set(String(model.id), model)
    }
  }
  return map
}

function getModelCategory(model) {
  const type = (model.type || model.category || model.model_type || '').toLowerCase()
  if (type.includes('text') && type.includes('image')) return 't2i'
  if (type.includes('image') && type.includes('image')) return 'i2i'
  if (type.includes('text') && type.includes('video')) return 't2v'
  if (type.includes('image') && type.includes('video')) return 'i2v'
  if (type.includes('video') && type.includes('video')) return 'v2v'
  if (type.includes('lipsync') || type.includes('lip_sync')) return 'lipsync'
  if (type.includes('audio') || type.includes('music') || type.includes('speech')) return 'audio'
  return 't2i'
}

function countByCategory(modelsMap) {
  const counts = { t2i: 0, i2i: 0, t2v: 0, i2v: 0, v2v: 0, lipsync: 0, audio: 0 }
  for (const model of modelsMap.values()) {
    const cat = getModelCategory(model)
    if (cat in counts) counts[cat]++
  }
  return counts
}

function isValidEndpoint(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getModelEndpoint(model) {
  return model.endpoint || model.api_endpoint || model.url || model.invoke_url || null
}

function diffModelFields(localModel, upstreamModel) {
  const fields = ['endpoint', 'api_endpoint', 'url', 'invoke_url', 'inputs', 'capabilities', 'provider', 'cost', 'name', 'description']
  const changes = []
  for (const field of fields) {
    const localVal = JSON.stringify(localModel[field])
    const upstreamVal = JSON.stringify(upstreamModel[field])
    if (localVal !== upstreamVal) {
      changes.push({ field, local: localModel[field], upstream: upstreamModel[field] })
    }
  }
  return changes
}

// ── Core checks ───────────────────────────────────────────────────────────────

function checkNewModels(localMap, upstreamMap) {
  const newModels = []
  for (const [id, model] of upstreamMap) {
    if (!localMap.has(id)) {
      newModels.push({ id, name: model.name || model.id, category: getModelCategory(model) })
    }
  }
  return newModels
}

function checkRemovedModels(localMap, upstreamMap) {
  const removedModels = []
  for (const [id, model] of localMap) {
    if (!upstreamMap.has(id)) {
      removedModels.push({ id, name: model.name || model.id, category: getModelCategory(model) })
    }
  }
  return removedModels
}

function checkChangedModels(localMap, upstreamMap) {
  const changedModels = []
  for (const [id, localModel] of localMap) {
    const upstreamModel = upstreamMap.get(id)
    if (!upstreamModel) continue
    const changes = diffModelFields(localModel, upstreamModel)
    if (changes.length > 0) {
      changedModels.push({
        id,
        name: localModel.name || localModel.id,
        changedFields: changes.map((c) => c.field),
        details: flags.verbose ? changes : undefined,
      })
    }
  }
  return changedModels
}

function checkEndpointHealth(modelsMap) {
  const results = { valid: 0, invalid: 0, missing: 0, details: [] }
  for (const [id, model] of modelsMap) {
    const endpoint = getModelEndpoint(model)
    if (!endpoint) {
      results.missing++
      if (flags.verbose) results.details.push({ id, status: 'missing' })
    } else if (isValidEndpoint(endpoint)) {
      results.valid++
    } else {
      results.invalid++
      results.details.push({ id, status: 'invalid', endpoint })
    }
  }
  return results
}

// ── Health score ──────────────────────────────────────────────────────────────

function computeHealthScore({ newModels, removedModels, changedModels, endpointHealth, upstreamCount }) {
  if (upstreamCount === 0) return 100
  let score = 100
  score -= (removedModels.length / upstreamCount) * 40
  score -= (changedModels.length / upstreamCount) * 20
  score -= (newModels.length / upstreamCount) * 10
  const endpointTotal = endpointHealth.valid + endpointHealth.invalid + endpointHealth.missing
  if (endpointTotal > 0) {
    score -= (endpointHealth.invalid / endpointTotal) * 20
    score -= (endpointHealth.missing / endpointTotal) * 10
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

function determineStatus(healthScore, removedCount, changedCount) {
  if (healthScore >= 90 && removedCount === 0) return 'healthy'
  if (healthScore >= 60 && removedCount < 5) return 'warning'
  return 'critical'
}

function generateRecommendations({ newModels, removedModels, changedModels, endpointHealth }) {
  const recs = []
  if (newModels.length > 0) {
    recs.push(`Sync ${newModels.length} new model(s) from upstream to stay current.`)
  }
  if (removedModels.length > 0) {
    recs.push(`${removedModels.length} model(s) removed from upstream — review and update local catalog.`)
  }
  if (changedModels.length > 0) {
    recs.push(`${changedModels.length} model(s) have changed fields — verify endpoint and capability updates.`)
  }
  if (endpointHealth.invalid > 0) {
    recs.push(`${endpointHealth.invalid} model(s) have invalid endpoint URLs — fix or remove them.`)
  }
  if (endpointHealth.missing > 0) {
    recs.push(`${endpointHealth.missing} model(s) are missing endpoint configuration.`)
  }
  if (recs.length === 0) {
    recs.push('Catalog is in sync with upstream. No action required.')
  }
  return recs
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let upstreamMap, localMap

  try {
    const upstreamDump = fetchUpstreamDump()
    upstreamMap = normalizeDump(upstreamDump)
  } catch (err) {
    console.error(`ERROR: ${err.message}`)
    process.exit(1)
  }

  try {
    const localDump = fetchLocalDump()
    localMap = normalizeDump(localDump)
  } catch (err) {
    console.error(`ERROR: ${err.message}`)
    process.exit(1)
  }

  const upstreamCommit = getUpstreamCommit()
  const lastSync = getLastSyncTimestamp()
  const upstreamCounts = countByCategory(upstreamMap)
  const localCounts = countByCategory(localMap)

  const newModels = checkNewModels(localMap, upstreamMap)
  const removedModels = checkRemovedModels(localMap, upstreamMap)
  const changedModels = checkChangedModels(localMap, upstreamMap)
  const endpointHealth = checkEndpointHealth(localMap)

  const healthScore = computeHealthScore({
    newModels,
    removedModels,
    changedModels,
    endpointHealth,
    upstreamCount: upstreamMap.size,
  })

  const status = determineStatus(healthScore, removedModels.length, changedModels.length)
  const recommendations = generateRecommendations({ newModels, removedModels, changedModels, endpointHealth })

  const report = {
    status,
    lastSync,
    upstreamCommit,
    modelCounts: {
      upstream: upstreamCounts,
      local: localCounts,
    },
    newModels: newModels.map((m) => m.id),
    removedModels: removedModels.map((m) => m.id),
    changedModels: changedModels.map((m) => m.id),
    changedModelsDetail: flags.verbose ? changedModels : undefined,
    healthScore,
    recommendations,
    summary: {
      totalUpstream: upstreamMap.size,
      totalLocal: localMap.size,
      newCount: newModels.length,
      removedCount: removedModels.length,
      changedCount: changedModels.length,
      endpointHealth: {
        valid: endpointHealth.valid,
        invalid: endpointHealth.invalid,
        missing: endpointHealth.missing,
      },
    },
    generatedAt: new Date().toISOString(),
  }

  // Remove undefined fields
  for (const key of Object.keys(report)) {
    if (report[key] === undefined) delete report[key]
  }

  // ── Output ──────────────────────────────────────────────────────────────────

  if (flags.checkNewModels) {
    if (newModels.length > 0) {
      log(`New models in upstream (${newModels.length}):`)
      for (const m of newModels) {
        log(`  - ${m.id} (${m.category})`)
      }
    } else {
      log('No new models detected.')
    }
  }

  if (flags.checkRemovedModels) {
    if (removedModels.length > 0) {
      log(`Models removed from upstream (${removedModels.length}):`)
      for (const m of removedModels) {
        log(`  - ${m.id} (${m.category})`)
      }
    } else {
      log('No removed models detected.')
    }
  }

  if (flags.checkChangedEndpoints) {
    if (changedModels.length > 0) {
      log(`Models with changed fields (${changedModels.length}):`)
      for (const m of changedModels) {
        log(`  - ${m.id}: [${m.changedFields.join(', ')}]`)
      }
    } else {
      log('No changed models detected.')
    }
  }

  if (flags.fullReport) {
    if (!flags.quiet) {
      console.log(JSON.stringify(report, null, 2))
    }
  }

  if (flags.output) {
    try {
      writeFileSync(flags.output, JSON.stringify(report, null, 2) + '\n')
      logVerbose(`Report written to ${flags.output}`)
    } catch (err) {
      console.error(`ERROR: Failed to write output file: ${err.message}`)
      process.exit(1)
    }
  }

  // CI / quiet mode: exit non-zero on critical status
  if (flags.quiet && status !== 'healthy') {
    console.error(`Health check FAILED: status=${status}, score=${healthScore}`)
    process.exit(1)
  }

  // Exit non-zero if critical
  if (status === 'critical') {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`)
  process.exit(1)
})
