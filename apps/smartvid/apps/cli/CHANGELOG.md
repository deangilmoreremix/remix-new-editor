# Changelog

All notable changes to `@smartvid/cli` are documented in this file.

The CLI follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), with versioning **decoupled from Smartvid Downloader Desktop**. CLI bug-fixes and new yt-dlp probe-flag support ship on the CLI's own cadence; Desktop continues on `1.x`.

## [Unreleased]

## [0.1.0] - 2026-05-02

First standalone release of `@smartvid/cli`. Tracks NEX-133 (CLI full-stack) and NEX-148 (standalone-only distribution).

### Added
- argv parser that splits `--smartvid-*` flags + `:` subcommands from yt-dlp passthrough; unknown `--smartvid-*` tokens fail with exit 2 instead of being silently forwarded.
- Probe vs download mode detection covering every public yt-dlp probe-class flag and alias.
- `:status`, `:download list/status/logs/cancel/pause/resume/retry`, `:history list/remove` against the shared `taskQueueContract`.
- `:version` — prints CLI + contract version + changelog URL with no host contact.
- `:upgrade` — checks `https://registry.npmjs.org/@vidbee/cli/latest`, caches the result for 30 days, and prints install commands for npm / pnpm / bun / brew. Does not spawn `npm install` automatically.
- Three transports: Desktop loopback (with descriptor handshake + 1h token + autostart), `--smartvid-api <url>` (HTTPS required outside loopback / RFC1918), and `--smartvid-local` (in-process TaskQueueAPI + YtDlpExecutor, with optional SQLite for crash-recovery).
- `dist/` bundle distributed via npm (`pnpm publish`) under `@smartvid/cli`. Tarball contains only `dist/`, README, CHANGELOG, LICENSE.
- Sensitive-argument redaction (`--password`, `--video-password`, `--ap-password`, `--twofactor`, `Authorization:` headers, URL `token=` / `access_token=` / `signature=` / `policy=` query strings).

### Distribution
- Standalone npm publishing via [`cli-publish.yml`](../../.github/workflows/cli-publish.yml), triggered by `cli-v*` tags.
- Shell installer at [`scripts/cli-install.sh`](../../scripts/cli-install.sh) — installs the npm tarball into `~/.smartvid/cli` and writes a `smartvid` shim into `~/.local/bin`.
- Homebrew tap (`smartvid/homebrew-tap`) tracked as a follow-up; the formula will wrap the same npm tarball.

### Removed
- Bundling with Smartvid Downloader Desktop. The Desktop installer no longer ships a CLI shim or rewrites your `PATH`. Install the CLI explicitly via npm / brew / shell installer. (NEX-148)
