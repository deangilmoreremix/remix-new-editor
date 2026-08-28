#!/usr/bin/env node

/**
 * Comprehensive test runner.
 *
 * Runs all test suites in sequence:
 * 1. Unit tests (Vitest)
 * 2. Integration tests
 * 3. E2E tests (Playwright, if configured)
 *
 * Usage:
 *   node scripts/run-tests.js              # Run all tests
 *   node scripts/run-tests.js --unit       # Run unit tests only
 *   node scripts/run-tests.js --e2e        # Run E2E tests only
 *   node scripts/run-tests.js --coverage   # Run with coverage
 */

const { spawn } = require('child_process');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const runUnit = !args.includes('--e2e');
const runE2E = args.includes('--e2e') || args.includes('--all');
const coverage = args.includes('--coverage');

const COVERAGE_THRESHOLD = {
  lines: 70,
  functions: 70,
  branches: 70,
  statements: 70,
};

function runCommand(command, description) {
  console.log(`\n\x1b[36m%s\x1b[0m`, `━━━ ${description} ━━━`);
  console.log(`\x1b[90m%s\x1b[0m`, `Running: ${command}`);

  try {
    const output = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    console.log(`\x1b[32m%s\x1b[0m`, `✅ ${description} passed`);
    return true;
  } catch (error) {
    console.log(`\x1b[31m%s\x1b[0m`, `❌ ${description} failed`);
    return false;
  }
}

async function main() {
  console.log('\n\x1b[1m%s\x1b[0m', '🧪 SmartVideo Test Suite');
  console.log('\x1b[90m%s\x1b[0m', 'Running comprehensive tests...\n');

  let allPassed = true;

  if (runUnit) {
    const vitestCmd = coverage
      ? 'npx vitest run --coverage'
      : 'npx vitest run';

    if (!runCommand(vitestCmd, 'Unit & Integration Tests')) {
      allPassed = false;
    }
  }

  if (runE2E) {
    const playwrightCmd = coverage
      ? 'npx playwright test --reporter=list'
      : 'npx playwright test --reporter=list';

    if (!runCommand(playwrightCmd, 'E2E Tests')) {
      allPassed = false;
    }
  }

  // Security scan
  if (!runCommand('npm audit --audit-level=high', 'Security Audit')) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  Security audit found issues (non-blocking)');
  }

  // Summary
  console.log('\n\x1b[1m%s\x1b[0m', '━━━ Test Summary ━━━');

  if (allPassed) {
    console.log('\x1b[32m%s\x1b[0m', '✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\x1b[31m%s\x1b[0m', '❌ Some tests failed. Review the output above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
