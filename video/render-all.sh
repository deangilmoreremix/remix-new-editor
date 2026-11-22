#!/bin/bash
cd "$(dirname "$0")/project"
for id in A-hero-loop B-feature-reel D-social-9x16 C01-hero-prompt C02-apps-hub C03-model-picker C04-image-studio C05-cinema-studio C06-director C07-edit-tools C08-character C09-avatar C10-lip-sync C11-vfx-effects C12-templates; do
  echo "START $id $(date +%T)"; npx remotion render src/index.ts $id ../out/$id.mp4 --codec h264 --crf 24 --log=error 2>&1 | tail -2; echo "DONE $id $(ls -l ../out/$id.mp4 2>/dev/null | awk '{print $5}')"
done
echo ALLDONE
