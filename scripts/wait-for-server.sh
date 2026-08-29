#!/bin/bash
set -e

AI_VFX_URL="${1:-http://localhost:3000/}"
echo "⏳ Waiting for ai-vfx server at ${AI_VFX_URL} ..."

until curl -sf "${AI_VFX_URL}" > /dev/null 2>&1; do
  sleep 0.5
done

echo "✓ ai-vfx server ready at ${AI_VFX_URL}"
