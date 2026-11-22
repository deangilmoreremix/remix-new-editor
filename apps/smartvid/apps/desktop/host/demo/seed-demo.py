#!/usr/bin/env python3
"""Demo data for feature screenshots (host tool, not upstream, not used in normal operation).

Recreates the scenarios in upstream's marketing screenshots (screenshots/*.webp in nexmoe/VidBee) inside the app's own SQLite DB:
six downloads and a four-speaker transcript. Run with the host server STOPPED, then start it.
  seed-demo.py <data-dir> <download-dir>
All people, titles and text are invented placeholders; thumbnails/videos are generated with ffmpeg.
"""
import base64, json, os, sqlite3, subprocess, sys, uuid

data_dir, dl_dir = sys.argv[1], sys.argv[2]
demo = os.path.join(dl_dir, 'Demo')
os.makedirs(demo, exist_ok=True)
H = 3600_000
AUG = 1787000000000  # ~2026-08-17, anchor for plausible dates
def ts(day, hour, minute=0):  # 2026-08-<day> hh:mm UTC
    import datetime
    return int(datetime.datetime(2026, 8, day, hour, minute, tzinfo=datetime.timezone.utc).timestamp() * 1000)

ITEMS = [  # key, title, created, colors
    ('field', 'Behind the Scenes: Field Recording in Oregon', ts(22, 17, 40), ('0x2f4f3a', '0x8aa37b')),
    ('interview', 'Product Interview: Finding the Right Moment', ts(22, 18, 0), ('0x6b3a2a', '0xe0a267')),
    ('design', 'Design Review: Spring Product Launch', ts(22, 17, 12), ('0x2a4a6b', '0xe0b8a0')),
    ('practical', 'Practical AI, Episode 42: Local by Default', ts(21, 18, 0), ('0x1d1d22', '0x8a7a5a')),
    ('lecture', 'Lecture 08: How Transformers Use Attention', ts(20, 18, 0), ('0x14213d', '0x7aa2c9')),
    ('archive', 'I Built a Searchable Video Archive', ts(19, 18, 0), ('0x3a3f4a', '0xc9c2b0')),
]

def run(*a):
    subprocess.run(a, check=True, capture_output=True)

def thumb(key, colors):
    path = f'{demo}/{key}.jpg'
    run('ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f'gradients=s=280x158:c0={colors[0]}:c1={colors[1]}:d=1:speed=0.01', '-frames:v', '1', '-q:v', '5', path)
    return 'data:image/jpeg;base64,' + base64.b64encode(open(path, 'rb').read()).decode()

def video(key, seconds, colors):
    path = f'{demo}/{key}.mp4'
    run('ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f'gradients=s=640x360:c0={colors[0]}:c1={colors[1]}:d={seconds}:speed=0.02:r=10',
        '-f', 'lavfi', '-i', f'sine=frequency=220:duration={seconds}', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path)
    return path

db = sqlite3.connect(os.path.join(data_dir, 'smartvid.db'))
cols = [r[1] for r in db.execute('pragma table_info(tasks)')]
ids = {}

def add_task(row):
    db.execute(f"insert into tasks ({','.join(row)}) values ({','.join('?' * len(row))})", list(row.values()))

for key, title, created, colors in ITEMS:
    if key in ('field', 'design'):
        continue  # these two are real, live downloads started through the app (progress, speed, ETA come from yt-dlp)
    tid = f'download_demo_{key}'
    ids[key] = tid
    seconds = 200 if key == 'interview' else 4
    path = video(key, seconds, colors)
    size = os.path.getsize(path)
    add_task(dict(
        id=tid, kind='video', parent_id=None, status='completed', prev_status='processing', status_reason=None, entered_status_at=created + 60000, priority=0,
        group_key='demo', attempt=1, max_attempts=5, next_retry_at=None, pid=None, pid_started_at=None, created_at=created, updated_at=created + 60000,
        input_json=json.dumps({'url': f'https://example.com/{key}', 'kind': 'video', 'title': title, 'thumbnail': thumb(key, colors),
                               'options': {'type': 'video', 'format': 'bestvideo+bestaudio/best', 'origin': 'manual', 'downloadPath': demo, 'customDownloadPath': demo,
                                           'channel': 'Demo', 'uploader': 'Demo', 'duration': seconds, 'startedAt': created}}),
        progress_json=json.dumps({'percent': 100, 'bytesDownloaded': size, 'bytesTotal': size, 'speedBps': None, 'etaMs': None, 'ticks': 1}),
        output_json=json.dumps({'filePath': path, 'size': size, 'durationMs': seconds * 1000, 'sha256': None, 'formatId': '137', 'cookieSources': []}),
        last_error_json=None))

# ── four-speaker transcript for the "Product Interview" download ──────────────────────────────
people = [('maya', 'Maya Chen'), ('alex', 'Alex Rivera'), ('jordan', 'Jordan Kim'), ('samir', 'Samir Patel')]
lines = [
    ('maya', 1, 'Before we talk about features, walk me through the last time your team reviewed a customer interview.'),
    ('alex', 12, 'On Monday I had six recordings open, a notes document, and a spreadsheet of quotes. I knew the insight, but not which call it came from.'),
    ('jordan', 26, 'When you finally find the right clip, what information has to stay attached to it for the design team?'),
    ('alex', 38, 'The speaker name, the exact timestamp, and at least a few lines around the quote. A sentence on its own is too easy to misread.'),
    ('samir', 52, 'Support sees the same problem. A short complaint can mean a billing issue, a setup issue, or just confusion about the wording.'),
    ('maya', 65, 'Tell me about a recent example where searching the spoken words would have changed the outcome.'),
    ('alex', 76, 'We were reviewing pricing interviews. Three people used the phrase hidden cost, but I only found the third example after the decision meeting.'),
    ('jordan', 91, 'That is where a transcript with speakers helps: you can jump straight to who said it and what they said next.'),
    ('alex', 105, 'Exactly. And if a name is wrong, fixing it once should fix it everywhere that person speaks.'),
    ('samir', 118, 'Then support can export the clip with subtitles and share it with the team the same afternoon.'),
]
tr_id, tt_id = str(uuid.uuid4()), str(uuid.uuid4())
src = os.path.join(demo, 'interview.mp4')
now = ts(22, 18, 5)
add_task(dict(id=tt_id, kind='transcription', parent_id=ids['interview'], status='completed', prev_status='processing', status_reason=None, entered_status_at=now, priority=0,
              group_key='transcription', attempt=1, max_attempts=3, next_retry_at=None, pid=None, pid_started_at=None, created_at=now - 5000, updated_at=now,
              input_json=json.dumps({'url': f'smartvid://download/{ids["interview"]}', 'kind': 'transcription', 'title': ITEMS[1][1],
                                     'options': {'provider': 'local', 'origin': 'manual', 'downloadTaskId': ids['interview'], 'sourceFilePath': src, 'trigger': 'manual', 'skipVad': False, 'asrTier': 'minimal', 'language': 'en', 'speakerCount': 'auto', 'rediarize': False, 'startedAt': now - 5000}}),
              progress_json=json.dumps({'percent': 100, 'bytesDownloaded': None, 'bytesTotal': None, 'speedBps': None, 'etaMs': None, 'ticks': 1}),
              output_json=json.dumps({'filePath': src, 'size': 1, 'durationMs': 200000, 'sha256': None, 'transcript': {'resultKind': 'transcript', 'transcriptId': tr_id}}), last_error_json=None))
db.execute('insert into transcripts (id, download_task_id, transcription_task_id, result_kind, model_version, language, source_file_path, superseded_at, created_at, updated_at, asr_tier, source_kind) values (?,?,?,?,?,?,?,?,?,?,?,?)',
           (tr_id, ids['interview'], tt_id, 'transcript', 'smartvid-asr-2026.08.20-3', 'en', src, None, now, now, 'minimal', 'asr'))
spk = {}
for i, (key, name) in enumerate(people):
    spk[key] = str(uuid.uuid4())
    db.execute('insert into transcript_speakers (id, transcript_id, speaker_key, display_name, sort_index) values (?,?,?,?,?)', (spk[key], tr_id, f'speaker-{i + 1}', name, i))
for i, (key, sec, text) in enumerate(lines):
    end = (lines[i + 1][1] if i + 1 < len(lines) else sec + 10) - 1
    words, t = [], sec * 1000
    parts = text.split(' ')
    step = max(1, (end - sec) * 1000 // len(parts))
    for j, w in enumerate(parts):
        words.append({'text': (' ' if j else '') + w, 'startMs': t, 'endMs': t + step}); t += step
    db.execute('insert into transcript_segments (id, transcript_id, speaker_id, start_ms, end_ms, text, confidence, sort_index, words_json) values (?,?,?,?,?,?,?,?,?)',
               (str(uuid.uuid4()), tr_id, spk[key], sec * 1000, end * 1000, text, 0.9, i, json.dumps(words)))
db.commit()
print('seeded', list(ids.values()))
