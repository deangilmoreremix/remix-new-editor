/**
 * The CLI's only argv splitter. Reference:
 *   docs/smartvid-desktop-first-cli-ytdlp-rss-design.md §4.1, §4.2, §4.5
 *
 * Rules:
 *   - Tokens matching a known `--smartvid-*` flag are consumed (along with
 *     their value when `kind === 'value'`).
 *   - Tokens that look like `--smartvid-*` / `--smartvid:*` but are NOT in the
 *     reserved table cause an error with exit code 2 — never silently
 *     passed through to yt-dlp.
 *   - The first positional token starting with `:` selects a Smartvid Downloader
 *     subcommand; subsequent positional tokens after a subcommand are the
 *     subcommand's own args (NOT yt-dlp args).
 *   - Everything else is order-preserved and handed to yt-dlp.
 *   - `--` is honored: every token after `--` is yt-dlp passthrough,
 *     including ones that would otherwise look like Smartvid Downloader flags.
 */

import { findProbeFlag } from './probe-flags'
import {
  findReservedFlag,
  isSmartvidPrefixed,
  type ReservedFlag
} from './reserved-flags'

export interface SmartvidFlags {
  api?: string
  local: boolean
  target?: 'desktop' | 'api' | 'local'
  json: boolean
  pretty: boolean
  wait: boolean
  detach: boolean
  priority?: 'user' | 'subscription' | 'background'
  maxAttempts?: number
  noRetry: boolean
  groupKey?: string
  timeoutMs?: number
  noAutostart: boolean
  token?: string
}

export type ParsedArgv =
  | { kind: 'subcommand'; flags: SmartvidFlags; subcommand: string; subArgs: readonly string[] }
  | {
      kind: 'ytdlp'
      flags: SmartvidFlags
      mode: 'probe' | 'download'
      ytArgs: readonly string[]
      probeFlag: string | null
    }

export class ParseError extends Error {
  readonly exitCode: 2
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.exitCode = 2
  }
}

const PRIORITY_VALUES = new Set<SmartvidFlags['priority']>([
  'user',
  'subscription',
  'background'
])
const TARGET_VALUES = new Set<SmartvidFlags['target']>(['desktop', 'api', 'local'])

export function parseArgv(argv: readonly string[]): ParsedArgv {
  const flags = defaultFlags()
  const yt: string[] = []
  let subcommand: string | null = null
  let passthroughOnly = false

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (tok === undefined) continue

    if (passthroughOnly) {
      yt.push(tok)
      continue
    }

    if (tok === '--') {
      passthroughOnly = true
      yt.push(tok)
      continue
    }

    // Subcommand: a `:` positional collects all remaining argv as its args.
    // We do not try to mix subcommand args with yt-dlp args.
    if (subcommand === null && tok.startsWith(':') && tok.length > 1) {
      subcommand = tok.slice(1)
      const subArgs = argv.slice(i + 1).filter((s): s is string => typeof s === 'string')
      // We still need to honor --smartvid-* in the subcommand tail (e.g.
      // `smartvid --smartvid-pretty :download list`); those have already been
      // consumed by earlier iterations. Anything inside subArgs is owned by
      // the subcommand handler — no further parsing here.
      return { kind: 'subcommand', flags, subcommand, subArgs }
    }

    // Smartvid Downloader-prefixed flags: must match the reserved table or we fail loud.
    if (isSmartvidPrefixed(tok)) {
      const eq = tok.indexOf('=')
      const name = eq === -1 ? tok : tok.slice(0, eq)
      const inlineValue = eq === -1 ? null : tok.slice(eq + 1)
      const def = findReservedFlag(name)
      if (!def) {
        throw new ParseError(
          'UNKNOWN_SMARTVID_FLAG',
          `unknown Smartvid Downloader flag: ${name}`
        )
      }
      const consumed = consumeReserved(flags, def, argv, i, inlineValue)
      i += consumed
      continue
    }

    // Anything else is yt-dlp territory.
    yt.push(tok)
  }

  if (subcommand !== null) {
    return { kind: 'subcommand', flags, subcommand, subArgs: [] }
  }

  // §4.5: -o - in non-probe modes is rejected up front. We don't pretend to
  // understand more of -o than that single edge case.
  const probeFlag = findProbeFlag(yt)
  const mode: 'probe' | 'download' = probeFlag === null ? 'download' : 'probe'
  if (mode === 'download' && hasStdoutOutput(yt)) {
    throw new ParseError(
      'STDOUT_OUTPUT_DISALLOWED',
      '-o - is only allowed in probe mode'
    )
  }

  return { kind: 'ytdlp', flags, mode, ytArgs: yt, probeFlag }
}

function defaultFlags(): SmartvidFlags {
  return {
    local: false,
    json: true,
    pretty: false,
    wait: false,
    detach: false,
    noRetry: false,
    noAutostart: false
  }
}

function consumeReserved(
  flags: SmartvidFlags,
  def: ReservedFlag,
  argv: readonly string[],
  i: number,
  inlineValue: string | null
): number {
  if (def.kind === 'switch') {
    if (inlineValue !== null) {
      throw new ParseError(
        'UNEXPECTED_VALUE',
        `${def.name} does not take a value`
      )
    }
    applySwitch(flags, def.name)
    return 0
  }
  // value flag
  let value: string
  let consumed = 0
  if (inlineValue !== null) {
    value = inlineValue
  } else {
    const next = argv[i + 1]
    if (next === undefined) {
      throw new ParseError('MISSING_VALUE', `${def.name} requires a value`)
    }
    value = next
    consumed = 1
  }
  applyValue(flags, def.name, value)
  return consumed
}

function applySwitch(flags: SmartvidFlags, name: string): void {
  switch (name) {
    case '--smartvid-local':
      flags.local = true
      break
    case '--smartvid-json':
      flags.json = true
      break
    case '--smartvid-pretty':
      flags.pretty = true
      break
    case '--smartvid-wait':
      flags.wait = true
      break
    case '--smartvid-detach':
      flags.detach = true
      break
    case '--smartvid-no-retry':
      flags.noRetry = true
      flags.maxAttempts = 0
      break
    case '--smartvid-no-autostart':
      flags.noAutostart = true
      break
    default:
      throw new ParseError(
        'UNKNOWN_SMARTVID_FLAG',
        `unknown Smartvid Downloader switch: ${name}`
      )
  }
}

function applyValue(flags: SmartvidFlags, name: string, value: string): void {
  switch (name) {
    case '--smartvid-api':
      flags.api = value
      break
    case '--smartvid-target':
      if (!(TARGET_VALUES as Set<string>).has(value)) {
        throw new ParseError(
          'INVALID_TARGET',
          `--smartvid-target must be one of desktop|api|local; got ${value}`
        )
      }
      flags.target = value as SmartvidFlags['target']
      break
    case '--smartvid-priority':
      if (!(PRIORITY_VALUES as Set<string>).has(value)) {
        throw new ParseError(
          'INVALID_PRIORITY',
          `--smartvid-priority must be user|subscription|background; got ${value}`
        )
      }
      flags.priority = value as SmartvidFlags['priority']
      break
    case '--smartvid-max-attempts': {
      const n = Number.parseInt(value, 10)
      if (!Number.isFinite(n) || n < 0 || `${n}` !== value) {
        throw new ParseError(
          'INVALID_MAX_ATTEMPTS',
          `--smartvid-max-attempts must be a non-negative integer; got ${value}`
        )
      }
      flags.maxAttempts = n
      if (n === 0) flags.noRetry = true
      break
    }
    case '--smartvid-group-key':
      flags.groupKey = value
      break
    case '--smartvid-timeout': {
      const n = Number.parseInt(value, 10)
      if (!Number.isFinite(n) || n <= 0) {
        throw new ParseError(
          'INVALID_TIMEOUT',
          `--smartvid-timeout must be a positive integer (ms); got ${value}`
        )
      }
      flags.timeoutMs = n
      break
    }
    case '--smartvid-token':
      flags.token = value
      break
    default:
      throw new ParseError(
        'UNKNOWN_SMARTVID_FLAG',
        `unknown Smartvid Downloader value flag: ${name}`
      )
  }
}

/**
 * §4.5: writing yt-dlp output to stdout (`-o -`) is only legal in probe
 * mode. We detect it by `-o`-followed-by-`-` or `-o-`/`--output -`.
 */
function hasStdoutOutput(argv: readonly string[]): boolean {
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (tok === '-o' || tok === '--output') {
      if (argv[i + 1] === '-') return true
    } else if (tok === '-o-' || tok === '--output=-' || tok === '-o=-') {
      return true
    }
  }
  return false
}

export type { SmartvidFlags as Flags }
