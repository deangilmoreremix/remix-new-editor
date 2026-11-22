# `@smartvid/cli`

Standalone command-line interface to [Smartvid Downloader](https://github.com/nexmoe/vidbee), built on the shared `@smartvid/task-queue` kernel. CLI invocations land in the same queue that the Desktop UI and Web/API host use; nothing bypasses the application.

The CLI is **distributed independently** of Smartvid Downloader Desktop: you do not need to install or run the desktop app to use it. Common targets are CI runners, Docker images, agents, and headless Linux servers — places where shipping a 100 MB Electron bundle to invoke `yt-dlp` would be wrong.

> Reference designs: `docs/smartvid-desktop-first-cli-ytdlp-rss-design.md` (CLI surface), `docs/smartvid-task-queue-state-machine-design.md` (kernel).

---

## Install

Pick one. All three install the same `@smartvid/cli` Node package — there is no native binary today; we rely on Node ≥ 20 being available.

### npm / pnpm / bun

```sh
# npm (most common)
npm install -g @smartvid/cli

# pnpm
pnpm add -g @smartvid/cli

# bun
bun install -g @smartvid/cli
```

`npx @smartvid/cli ...` works without a global install.

### Homebrew (macOS / Linux)

```sh
brew install smartvid/tap/smartvid
```

> The tap (`smartvid/homebrew-tap`) is a separate repository tracked under NEX-148 follow-ups. The formula wraps the same npm tarball.

### Shell installer

```sh
curl -fsSL https://vidbee.dev/cli/install.sh | sh
```

The installer downloads the npm tarball into `~/.smartvid/cli` and writes a `smartvid` shim into `~/.local/bin`, picking up your shell from `$SHELL`. Source: [`scripts/cli-install.sh`](https://github.com/nexmoe/vidbee/blob/main/scripts/cli-install.sh).

### Windows

Use the npm channel (`npm install -g @smartvid/cli`) for now. The shell installer requires bash + tar; on Windows we recommend WSL or an `npm i -g` install from PowerShell. If your PowerShell execution policy blocks scripts, run `Set-ExecutionPolicy -Scope Process Bypass` once for the current shell.

### Need crash-recovery for `--smartvid-local`?

The in-process transport persists task state in SQLite when `better-sqlite3` is available. It is declared as an `optionalDependency`; install it explicitly if you want crash-recovery:

```sh
npm install -g @smartvid/cli better-sqlite3
```

---

## Three transports

The CLI talks to a `taskQueueContract` host. There are three transports, all wire-compatible:

- **Desktop loopback** (default when a Desktop install is detected): reads the per-user automation descriptor (`~/Library/Application Support/Smartvid/automation.json` on macOS, `${XDG_CONFIG_HOME:-~/.config}/Smartvid/automation.json` on Linux, `%APPDATA%\Smartvid Downloader\automation.json` on Windows), handshakes for a 1h bearer token, and POSTs JSON to `http://127.0.0.1:<port>/automation/v1/*`.
- **Remote API** (`--smartvid-api <url>`): same wire format against any Smartvid Downloader Web/API host. Plain HTTP is rejected unless the host is loopback or RFC1918 private. HTTPS is required everywhere else.
- **In-process** (`--smartvid-local`): instantiates `TaskQueueAPI` + `YtDlpExecutor` directly. No Desktop, no API server, no descriptor. Used for CI and Docker images.

If the Desktop descriptor is missing or its PID is stale, the CLI tries to launch Desktop in background mode. Pass `--smartvid-no-autostart` to opt out and exit `3` instead. On a host with no Desktop installed, use `--smartvid-api` or `--smartvid-local`.

---

## Argv contract

A single rule splits argv:

- Tokens starting with `--smartvid-` are reserved (full list below). Unknown `--smartvid-*` tokens are treated as typos and rejected with exit code `2` — they are **not** silently passed through to yt-dlp.
- Tokens starting with `:` are Smartvid Downloader subcommands (`:status`, `:download list`, `:version`, …).
- Everything else is order-preserved and forwarded to yt-dlp.

### `--smartvid-*` flags

| flag | meaning |
| --- | --- |
| `--smartvid-api <url>` | connect to a remote Smartvid Downloader API instead of the local Desktop |
| `--smartvid-local` | run TaskQueueAPI in-process (CI / Docker) |
| `--smartvid-target <desktop\|api\|local>` | explicit transport selection |
| `--smartvid-pretty` | indent JSON output |
| `--smartvid-wait` | block until terminal status |
| `--smartvid-detach` | return immediately after enqueue (default) |
| `--smartvid-priority <user\|subscription\|background>` | set task priority (default: user) |
| `--smartvid-max-attempts <n>` | override outer retry cap (`0` disables) |
| `--smartvid-no-retry` | shortcut for `--smartvid-max-attempts 0` |
| `--smartvid-group-key <key>` | override per-group concurrency key |
| `--smartvid-timeout <ms>` | autostart wait budget (default `10000`) |
| `--smartvid-no-autostart` | do not launch Desktop in background mode |
| `--smartvid-token <token>` | skip handshake (for CI / smoke tests) |

### Probe vs download

The CLI inspects argv exactly once: if any of `-j / --dump-json / -J / --dump-single-json / -F / --list-formats / --list-formats-as-table / --list-formats-old / --print / --get-* / -s / --simulate / --skip-download / --list-subs / --list-extractors / --list-extractor-descriptions / --update / --version` is present, the run is a **probe**: yt-dlp is spawned directly, output is captured into the §4.4 envelope, and no task is enqueued. Otherwise the run is a **download** and goes through `taskQueueContract.add({ kind: 'yt-dlp-forward', … })`.

`-o -` (write yt-dlp output to stdout) is allowed in probe mode only.

---

## Subcommands

```sh
smartvid :status
smartvid :version
smartvid :upgrade [--force] [--cache <path>]
smartvid :download list [--status queued|running|...] [--limit N] [--cursor C]
smartvid :download status <id>
smartvid :download logs <id>
smartvid :download cancel <id>
smartvid :download pause <id> [--reason text]
smartvid :download resume <id>
smartvid :download retry <id>
smartvid :history list
smartvid :history remove <id...>
```

`:rss …` is owned by NEX-132 and shares the same dispatch.

### `:version`

Prints the installed CLI version + contract version + a link to the changelog. Does not contact any host — safe to run on a machine with no Desktop and no network.

```json
{
  "ok": true,
  "mode": "subcommand",
  "subcommand": "version",
  "result": {
    "cli": "0.1.0",
    "contract": "0.1.0",
    "changelog": "https://github.com/nexmoe/vidbee/blob/main/apps/cli/CHANGELOG.md"
  }
}
```

### `:upgrade`

Checks `https://registry.npmjs.org/@vidbee/cli/latest` and prints whether a newer version exists, along with the install command for each supported package manager. Does **not** auto-spawn `npm install`: global installs touch sudo / system PATH and are best left to the user.

The result is cached for 30 days under `~/Library/Caches/Smartvid/cli-upgrade-check.json` (macOS), `${XDG_CACHE_HOME:-~/.cache}/smartvid/cli-upgrade-check.json` (Linux), or `%LOCALAPPDATA%\Smartvid Downloader\cli-upgrade-check.json` (Windows). Pass `--force` to bypass the cache, or `--cache <path>` to redirect it.

```json
{
  "ok": true,
  "mode": "subcommand",
  "subcommand": "upgrade",
  "result": {
    "current": "0.1.0",
    "latest": "0.2.0",
    "upToDate": false,
    "cached": false,
    "cachedAt": "2026-05-02T00:00:00.000Z",
    "registryUrl": "https://registry.npmjs.org/@vidbee/cli/latest",
    "installCommands": {
      "npm": "npm install -g @smartvid/cli",
      "pnpm": "pnpm add -g @smartvid/cli",
      "bun": "bun install -g @smartvid/cli",
      "brew": "brew upgrade smartvid/tap/smartvid"
    }
  }
}
```

---

## Output

Every invocation prints exactly one JSON document on stdout. Exit codes follow design §4.4:

| code | meaning |
| --- | --- |
| `0` | success (probe / detached enqueue / wait-mode terminal success) |
| `1` | wait-mode reached non-success (`failed`, `retry-scheduled`, `paused`, timeout) |
| `2` | argv parse error |
| `3` | Desktop / API unreachable |
| `4` | authentication failure |
| `5` | contract / version mismatch |

Sensitive arguments (`--password`, `--video-password`, `--ap-password`, `--twofactor`, `--add-headers Authorization:…`, URL query strings with `token=` / `access_token=` / `signature=` / `policy=`) are redacted to `<redacted>` before any envelope, persisted task row, or projection sees them.

---

## Versioning & releasing

CLI semver is **independent of Smartvid Downloader Desktop**. The CLI starts at `0.1.0`; Desktop continues on `1.x`. We bump the CLI on its own cadence so a `yt-dlp` probe-flag fix doesn't have to wait for a Desktop release.

To cut a release:

1. Update `apps/cli/package.json` `version` and add a `CHANGELOG.md` entry.
2. Push a `cli-vX.Y.Z` tag. The [`cli-publish.yml`](https://github.com/nexmoe/vidbee/blob/main/.github/workflows/cli-publish.yml) workflow typechecks, builds, and publishes to npm with `pnpm publish` using the `NPM_TOKEN` secret.
3. Verify on a clean machine: `npx @smartvid/cli@latest :version` should report the new version.

`pnpm --filter @smartvid/cli build` produces `dist/index.mjs` (single bundled ESM file) and `dist/bin/smartvid.mjs` (the npm `bin`). The published tarball includes only `dist/`, the README, the CHANGELOG, and the LICENSE — no source.
