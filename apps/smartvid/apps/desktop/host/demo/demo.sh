#!/usr/bin/env bash
# Demo setup for feature screenshots (host tool). usage: demo.sh <apps/smartvid dir> <data dir> <port>
# Starts the app with demo data: 4 seeded completed downloads + a 4-speaker transcript, 2 live throttled downloads, a demo AI provider.
set -euo pipefail
V=$(cd "$1" && pwd); DATA=$2; PORT=${3:-3300}
HOSTDIR=$V/apps/desktop/host/demo
pkill -f "out-web/server.mjs" || true; pkill -f live-sources.cjs || true; pkill -f "demo/mock-ai.cjs" || true; pkill -f rss-source.cjs || true; sleep 1
rm -rf "$DATA" "$DATA-dl"; mkdir -p "$DATA" "$DATA-dl"
start() { (cd "$V/apps/desktop" && SMARTVID_DATA_DIR="$DATA" SMARTVID_DOWNLOAD_DIR="$DATA-dl" SMARTVID_PORT=$PORT SMARTVID_STATIC_DIR=out-web/renderer SMARTVID_BASE_PATH=/smartvid SMARTVID_CSP_IMG_SRC=http://127.0.0.1:8114 SMARTVID_TRANSCRIPTION_BACKEND=fake nohup node out-web/server.mjs > "$DATA/server.log" 2>&1 &); }
start; for i in $(seq 1 40); do curl -sf localhost:$PORT/health >/dev/null && break; sleep 1; done; sleep 6   # first boot creates the schema
pkill -f "out-web/server.mjs"; sleep 2
python3 "$HOSTDIR/seed-demo.py" "$DATA" "$DATA-dl"
start; for i in $(seq 1 40); do curl -sf localhost:$PORT/health >/dev/null && break; sleep 1; done; sleep 8
(nohup node "$HOSTDIR/live-sources.cjs" >/dev/null 2>&1 &); (nohup node "$HOSTDIR/mock-ai.cjs" >/dev/null 2>&1 &); (nohup node "$HOSTDIR/rss-source.cjs" >/dev/null 2>&1 &); sleep 4
call() { curl -s -X POST localhost:$PORT/smartvid/ipc/invoke -H 'content-type: application/json' -d "{\"channel\":\"$1\",\"args\":$2}" >/dev/null; }
call ai.upsertProvider '[{"presetId":"custom","name":"Demo","baseUrl":"http://127.0.0.1:8112/v1","apiKey":"demo","modelId":"demo-model"}]'
call ai.setSkillTranscriptVisibility '[{"name":"bullet-points","showInTranscript":true}]'
call ai.setSkillTranscriptVisibility '[{"name":"improve-grammar","showInTranscript":true}]'
call ai.setSkillTranscriptVisibility '[{"name":"overview","showInTranscript":false}]'
call ai.setSkillTranscriptVisibility '[{"name":"create-mindmap","showInTranscript":false}]'
call download.startDownload '["download_demo_field",{"url":"http://127.0.0.1:8113/field.mp4","type":"video","format":"best","title":"Behind the Scenes: Field Recording in Oregon"}]'
for feed in northwind localfirst fieldnotes; do
  call subscriptions.create '[{"url":"http://127.0.0.1:8114/feed/'$feed'.xml","autoDownload":false,"onlyDownloadLatest":false}]'
done
call subscriptions.refresh '[]'
sleep 4
echo "demo ready on :$PORT"
