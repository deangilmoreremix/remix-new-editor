#!/bin/bash
cd /tmp/claude-0/-home-user-remix-new-editor/79878d73-742e-5247-a48c-15ecd2f96368/scratchpad/vw/video/project
for slug in $(python3 -c "import json;print(' '.join(c['slug'] for c in json.load(open('/tmp/claude-0/-home-user-remix-new-editor/79878d73-742e-5247-a48c-15ecd2f96368/scratchpad/studio-motion/clips.json'))))"); do
  npx remotion render src/index.ts S-$slug ../out/studio/$slug.mp4 --codec h264 --crf 24 --log=error 2>&1 | tail -1
  echo "DONE $slug $(stat -c %s ../out/studio/$slug.mp4 2>/dev/null)"
done
echo ALLDONE
