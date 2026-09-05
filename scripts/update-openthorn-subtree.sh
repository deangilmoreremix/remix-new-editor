#!/usr/bin/env bash
set -euo pipefail

# Update the OpenThorn git subtree from upstream.
# Usage: ./scripts/update-openthorn-subtree.sh [branch]
# Default branch: master

BRANCH="${1:-master}"
PREFIX="apps/openthorn"
REMOTE="https://github.com/deangilmoraremix/OpenThorn.git"

echo "Updating OpenThorn subtree from ${REMOTE} (${BRANCH})..."

# Fetch latest from upstream
git fetch "${REMOTE}" "${BRANCH}"

# Pull the changes into the subtree
git subtree pull --prefix="${PREFIX}" "${REMOTE}" "${BRANCH}" --squash

echo "OpenThorn subtree updated successfully."
echo "Review the changes with: git log --oneline -5 -- ${PREFIX}"
echo "Commit the update with: git commit -m 'chore: update OpenThorn subtree'"
