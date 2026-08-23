#!/usr/bin/env bash
# scripts/run-e2e-tests.sh
#
# End-to-end test runner for the Template Studio against a deployed
# production environment.  See docs/E2E_TEST_RESULTS_TEMPLATE.md for the
# output schema.
#
# Usage:
#   E2E_BASE_URL=https://app.example.com \
#   E2E_MUAPI_KEY=mu_live_xxx \
#   E2E_ALLOW_NETWORK=1 \
#   E2E_PRODUCTION=1 \
#   ./scripts/run-e2e-tests.sh
#
# Exit codes:
#   0  — all tests passed
#   1  — one or more tests failed
#   2  — environment not configured (no base URL)
#   3  — dependency missing (Playwright not installed)

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

E2E_BASE_URL="${E2E_BASE_URL:-${PLAYWRIGHT_BASE_URL:-}}"
E2E_SUPABASE_URL="${E2E_SUPABASE_URL:-}"
E2E_ALLOWED_ORIGIN="${E2E_ALLOWED_ORIGIN:-${E2E_BASE_URL}}"
E2E_MUAPI_KEY="${E2E_MUAPI_KEY:-}"
E2E_ALLOW_NETWORK="${E2E_ALLOW_NETWORK:-}"
E2E_PRODUCTION="${E2E_PRODUCTION:-}"
E2E_REPORT_PATH="${E2E_REPORT_PATH:-$ROOT_DIR/test-results/e2e-report.json}"
E2E_REPORT_MD="${E2E_REPORT_MD:-$ROOT_DIR/docs/E2E_TEST_RESULTS.md}"
TEST_FILE="${TEST_FILE:-$ROOT_DIR/tests/e2e/template-studio.spec.js}"

REPORTER_FLAG=(--reporter=list --reporter=html)
if [[ -n "${E2E_REPORTER:-}" ]]; then
  REPORTER_FLAG=(--reporter="$E2E_REPORTER")
fi

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

log() { printf '\033[1;36m[e2e]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[e2e]\033[0m %s\n' "$*" >&2; }

if [[ -z "$E2E_BASE_URL" ]]; then
  err "E2E_BASE_URL (or PLAYWRIGHT_BASE_URL) is required."
  err "Example: E2E_BASE_URL=https://app.example.com $0"
  exit 2
fi

if ! command -v npx >/dev/null 2>&1; then
  err "npx is not on PATH — install Node.js first."
  exit 3
fi

if ! node -e "require.resolve('@playwright/test')" >/dev/null 2>&1; then
  err "@playwright/test is not installed.  Run: npm install"
  exit 3
fi

if [[ ! -f "$TEST_FILE" ]]; then
  err "Test file not found: $TEST_FILE"
  exit 3
fi

mkdir -p "$(dirname "$E2E_REPORT_PATH")" \
         "$(dirname "$E2E_REPORT_MD")" \
         "$ROOT_DIR/test-results"

# ---------------------------------------------------------------------------
# Environment export (Playwright reads these from process.env)
# ---------------------------------------------------------------------------

export E2E_BASE_URL
export E2E_SUPABASE_URL
export E2E_ALLOWED_ORIGIN
export E2E_MUAPI_KEY
export E2E_ALLOW_NETWORK
export E2E_PRODUCTION
export E2E_REPORT_PATH
export E2E_REPORT_MD
export PLAYWRIGHT_BASE_URL="$E2E_BASE_URL"
export PLAYWRIGHT_HTML_REPORT="$ROOT_DIR/playwright-report"

# ---------------------------------------------------------------------------
# Reachability probe
# ---------------------------------------------------------------------------

log "Probing $E2E_BASE_URL …"
probe_status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$E2E_BASE_URL" || echo "000")
if [[ "$probe_status" == "000" || "$probe_status" -ge 500 ]]; then
  err "Target $E2E_BASE_URL is unreachable (HTTP $probe_status)."
  exit 2
fi
log "Target reachable (HTTP $probe_status)."

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

log "Running Playwright test suite …"
set +e
npx playwright test "$TEST_FILE" "${REPORTER_FLAG[@]}"
RC=$?
set -e

# ---------------------------------------------------------------------------
# Markdown summary
# ---------------------------------------------------------------------------

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_VERSION="${BUILD_VERSION:-${GIT_COMMIT:-$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)}}"

{
  echo "# Template Studio — E2E Test Results"
  echo
  echo "- **Base URL:** $E2E_BASE_URL"
  echo "- **Timestamp:** $TIMESTAMP"
  echo "- **Build:** $BUILD_VERSION"
  echo "- **Network coverage:** $([[ -n "$E2E_ALLOW_NETWORK" && -n "$E2E_MUAPI_KEY" ]] && echo "full (live Muapi)" || echo "UI-only (network-dependent cases skipped)")"
  echo "- **Playwright exit code:** $RC"
  echo
  echo "## Coverage"
  echo
  echo "| Category | Sampled |"
  echo "| --- | --- |"
  echo "| Base templates (52 total) | 8 |"
  echo "| Niche templates (120 total) | 8 |"
  echo "| Matrix templates (120 total) | 8 |"
  echo "| Cinematic templates (129 total) | 8 |"
  echo "| GTM Boost integration | 4 |"
  echo "| Prompt combination | 3 |"
  echo "| Functional plan 2.1–2.15 | 15 |"
  echo "| Error plan 3.1–3.9 | 9 |"
  echo "| Security guards (CORS, dev bypass, mock) | 5 |"
  echo
  echo "## Pass / Fail"
  echo
  echo "See Playwright HTML report: \`playwright-report/index.html\`"
  echo "and machine-readable report: \`$E2E_REPORT_PATH\`."
  echo
  echo "## Sign-off"
  echo
  echo "- [ ] Engineering lead"
  echo "- [ ] QA"
  echo "- [ ] Product"
} > "$E2E_REPORT_MD"

log "Markdown summary written to $E2E_REPORT_MD"
log "JSON report written to $E2E_REPORT_PATH"

if [[ $RC -ne 0 ]]; then
  err "Playwright reported failures (exit $RC)."
  exit $RC
fi

log "All tests passed."
exit 0
