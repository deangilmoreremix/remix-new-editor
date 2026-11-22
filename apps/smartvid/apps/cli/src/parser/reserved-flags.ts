/**
 * The full set of `--smartvid-*` flags the CLI knows about. Reference:
 *   docs/smartvid-desktop-first-cli-ytdlp-rss-design.md §4.2
 *
 * `kind` controls how the parser splits argv:
 *   - 'switch'        — boolean; presence sets value true
 *   - 'value'         — consumes the next argv token, OR accepts `--flag=value`
 *
 * Any unknown `--smartvid-*` token causes the parser to reject argv with
 * exit 2; we never silently forward unrecognized smartvid flags to yt-dlp.
 */

export type ReservedFlagKind = 'switch' | 'value'

export interface ReservedFlag {
  name: string
  kind: ReservedFlagKind
}

export const RESERVED_FLAGS: readonly ReservedFlag[] = [
  { name: '--smartvid-api', kind: 'value' },
  { name: '--smartvid-local', kind: 'switch' },
  { name: '--smartvid-target', kind: 'value' },
  { name: '--smartvid-json', kind: 'switch' },
  { name: '--smartvid-pretty', kind: 'switch' },
  { name: '--smartvid-wait', kind: 'switch' },
  { name: '--smartvid-detach', kind: 'switch' },
  { name: '--smartvid-priority', kind: 'value' },
  { name: '--smartvid-max-attempts', kind: 'value' },
  { name: '--smartvid-no-retry', kind: 'switch' },
  { name: '--smartvid-group-key', kind: 'value' },
  { name: '--smartvid-timeout', kind: 'value' },
  { name: '--smartvid-no-autostart', kind: 'switch' },
  { name: '--smartvid-token', kind: 'value' }
]

const RESERVED_BY_NAME = new Map<string, ReservedFlag>(
  RESERVED_FLAGS.map((f) => [f.name, f])
)

export function findReservedFlag(name: string): ReservedFlag | undefined {
  return RESERVED_BY_NAME.get(name)
}

/**
 * True if `tok` looks like a Smartvid Downloader flag. We deliberately match the loose
 * prefix `--vidb` (which has no overlap with any yt-dlp option as of
 * yt-dlp 2024.x — `--video-*` does not start with `--vidb`) so that typos
 * like `--vidbe-wait` are caught and reported instead of being silently
 * forwarded to yt-dlp. Reference: design doc §4.5 edge-case table.
 *
 * The strict membership check (against RESERVED_FLAGS) happens on the
 * canonical `--smartvid-*` / `--smartvid:*` form; anything else with the
 * `--vidb` prefix is rejected as an unknown Smartvid Downloader flag.
 */
export function isSmartvidPrefixed(tok: string): boolean {
  return tok.startsWith('--vidb')
}
