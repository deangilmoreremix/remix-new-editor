#!/bin/bash
# Setup script for git hooks
# Run this once after cloning the repo to enable pre-commit checks

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Setting up git hooks..."

# Configure git to use .githooks directory
git -C "$REPO_ROOT" config core.hooksPath .githooks

echo "✅ Git hooks configured to use .githooks/"
echo ""
echo "Pre-commit hook will warn when upload-related files are changed."
echo "To bypass (not recommended): git commit --no-verify"
