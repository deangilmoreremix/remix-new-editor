#!/usr/bin/env python3
"""Re-encode every promo render in promo/out to a portable H.264 file, make posters, write manifest.json, README.md and a zip.
Usage: python3 scripts/package-portable.py [encode|manifest|zip|all]
Output goes to promo/portable/ (gitignored: videos). Only manifest.json, README.md and this script are committed.
Encoding: H.264 High, yuv420p, limited range, BT.709, constant 30 fps, faststart. Audio AAC 128k 48k kept on every file (the no-music versions keep their SFX)."""
import hashlib, json, os, subprocess, sys, zipfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, DST = os.path.join(ROOT, 'out'), os.path.join(ROOT, 'portable')
os.makedirs(DST, exist_ok=True)

V3 = ['create', 'enhance', 'produce', 'localize', 'automate', 'scale']
# id, source file in out/, title, music?, source, captions, notes
ITEMS = []
def add(i, f, title, music, source, captions, notes, review):
    ITEMS.append(dict(id=i, src=f, title=title, has_music=music, source=source, captions_burned_in=captions, quality_notes=notes, open_review_items=review))
add('v1-hero', 'v1-hero.mp4', 'V1 Hero (with music)', True, 'screenshots-with-camera-moves', 'yes: "Describe the shot." and "Your studios, one place."',
    'Real app captures animated with shot-card camera moves. The prompt typing is a simulated reveal of a real typed capture. The example clip is the app sample (a short tower clip), labelled as an example, not a live result.',
    ['audio never auditioned by a person', 'SFX licence: keyboard/riser/sparkle/whoosh-big sources untraceable'])
add('v1-hero-nobgm', 'v1-hero-nobgm.mp4', 'V1 Hero (no music, SFX kept)', False, 'screenshots-with-camera-moves', 'yes: same as V1', 'Same picture as V1 without the music bed.', ['audio never auditioned by a person'])
add('v2-feature', 'v2-feature.mp4', 'V2 Feature reel (with music)', True, 'mixed', 'yes: per-shot headline captions',
    'Real app captures with camera moves. The Backlot shot is a fictional seeded project ("The Last Lighthouse") run in the local Backlot tool, not a live generation. 3D shots (carousel, deck) are not bit-exact between renders.',
    ['audio never auditioned by a person', 'SFX licence untraceable for some cues'])
add('v2-feature-nobgm', 'v2-feature-nobgm.mp4', 'V2 Feature reel (no music, SFX kept)', False, 'mixed', 'yes: same as V2', 'Same picture as V2 without the music bed.', ['audio never auditioned by a person'])
for e in V3:
    add(f'v3-{e}', f'v3-{e}.mp4', f'V3 {e.capitalize()} engine clip (with music)', True, 'screenshots-with-camera-moves', 'yes: engine name and the landing card description',
        'Single shot card per clip, 6.4 s, real app captures in idle states. Does not loop: use poster + play-once.', ['audio never auditioned by a person'] + (['Localize does not demonstrate localization (shows related studios)'] if e == 'localize' else []))
    add(f'v3-{e}-nobgm', f'v3-{e}-nobgm.mp4', f'V3 {e.capitalize()} engine clip (no music, SFX kept)', False, 'screenshots-with-camera-moves', 'yes: same as the music version', 'Same picture without the music bed.', ['audio never auditioned by a person'])
add('v5-tour', 'v5-tour.mp4', 'V5 Guided tour of 14 studios (with music)', True, 'real-screen-recording', 'yes: studio title cards, step captions, studio counter',
    'Real recordings of the real UI with a cursor overlay; nothing is generated, no result is shown, Generate buttons are only hovered. Brand open and logo lockup are shot-card renders. Music loops every 210 beats. Some prompts are off-screen in Audio and Lip Sync.',
    ['independent review not yet run', 'audio never auditioned by a person', 'SFX alignment to clicks/typing not verified', 'some studios shorter than 25 s'])
add('v5-tour-nomusic', 'v5-tour-nomusic.mp4', 'V5 Guided tour (no music, SFX kept)', False, 'real-screen-recording', 'yes: same as the music version', 'Same picture without the music bed.', ['independent review not yet run', 'audio never auditioned by a person'])

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)

def encode_one(it):
    src, dst = os.path.join(OUT, it['src']), os.path.join(DST, it['id'] + '.mp4')
    crf = it.get('crf', 22)
    r = sh('ffmpeg', '-y', '-v', 'error', '-i', src,
           '-vf', 'scale=in_range=auto:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p', '-r', '30', '-fps_mode', 'cfr',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
           '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
           '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', dst)
    if r.returncode: print('ENCODE FAIL', it['id'], r.stderr[-300:])
    # posters at ~85% of the clip (V3: the existing poster frame at 185/192)
    dur = float(sh('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst).stdout or 0)
    t = dur * (0.96 if it['id'].startswith('v3') else 0.30 if it['id'].startswith('v5') else 0.85)
    for ext, extra in (('jpg', ['-q:v', '3']), ('webp', ['-quality', '85'])):
        sh('ffmpeg', '-y', '-v', 'error', '-ss', f'{t:.2f}', '-i', dst, '-frames:v', '1', *extra, os.path.join(DST, f"{it['id']}.poster.{ext}"))
    print('encoded', it['id'], os.path.getsize(dst) // 1024, 'KB')

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''): h.update(c)
    return h.hexdigest()

def probe(p):
    j = json.loads(sh('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', p).stdout)
    v = next(s for s in j['streams'] if s['codec_type'] == 'video')
    a = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    return j, v, a

def faststart_ok(p):
    with open(p, 'rb') as f: d = f.read(1 << 20)
    return d.find(b'moov') != -1 and (d.find(b'mdat') == -1 or d.find(b'moov') < d.find(b'mdat'))

def manifest():
    rows, bad = [], []
    for it in ITEMS:
        p = os.path.join(DST, it['id'] + '.mp4')
        j, v, a = probe(p)
        dec = sh('ffmpeg', '-v', 'error', '-i', p, '-f', 'null', '-')
        vol = sh('ffmpeg', '-i', p, '-af', 'volumedetect', '-vn', '-f', 'null', '-').stderr
        mean = next((l.split('mean_volume:')[1].strip() for l in vol.splitlines() if 'mean_volume' in l), None)
        fr = v['r_frame_rate']; num, den = map(int, fr.split('/'))
        ok = v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p' and num / den == 30 and v['width'] % 2 == 0 and v['height'] % 2 == 0 and faststart_ok(p) and not dec.stderr.strip()
        if not ok: bad.append(it['id'])
        rows.append(dict(id=it['id'], title=it['title'], file=it['id'] + '.mp4', poster_jpg=it['id'] + '.poster.jpg', poster_webp=it['id'] + '.poster.webp',
                         width=v['width'], height=v['height'], fps=num / den, duration_s=round(float(j['format']['duration']), 2), size_bytes=os.path.getsize(p),
                         pixel_format=v['pix_fmt'], color_range=v.get('color_range'), color_space=v.get('color_space'), video_codec=v['codec_name'], profile=v.get('profile'),
                         audio_codec=a['codec_name'] if a else None, audio_mean_volume=mean, has_music=it['has_music'], sound_effects=True,
                         source=it['source'], captions_burned_in=it['captions_burned_in'], quality_notes=it['quality_notes'], open_review_items=it['open_review_items'],
                         faststart=faststart_ok(p), decode_errors=bool(dec.stderr.strip()), sha256=sha(p)))
    man = dict(generated_by='promo/scripts/package-portable.py', note='V4 (9:16 social cut) does not exist yet.',
               music=dict(track='house-vibez (Lily J, Mixkit)', note='Mixkit-sourced; record in promo/CREDITS.md. The toolkit bgm-tech-house.mp3 mentioned elsewhere has an untraceable source and is NOT used here.', bpm=122.0),
               sfx_licence_note='Only the SFX bundled with the skill are used. keyboard, riser, sparkle and whoosh-big have untraceable sources (see promo/CREDITS.md).',
               verification=dict(failed=bad), files=rows)
    json.dump(man, open(os.path.join(DST, 'manifest.json'), 'w'), indent=1)
    json.dump(man, open(os.path.join(ROOT, 'portable-manifest.json'), 'w'), indent=1)
    print('manifest:', len(rows), 'files; failed checks:', bad)

README = """# SmartVideo promo videos (portable package)

Every `*.mp4` here is H.264 High, yuv420p, limited range (BT.709), constant 30 fps, `+faststart`, AAC 128 kbps 48 kHz audio. 1920x1080.
`<id>.mp4` is the with-music version; `<id>-nobgm.mp4` / `v5-tour-nomusic.mp4` keep the sound effects but have no music bed.
Each video has `<id>.poster.jpg` and `<id>.poster.webp`. `manifest.json` lists size, duration, sha256, source and open review items per file.

Usage:
    <video autoplay muted loop playsinline preload="metadata" poster="v1-hero.poster.jpg"><source src="v1-hero.mp4" type="video/mp4"></video>
(The V3 clips do not loop cleanly: use the poster and play once.)

What is burned into the picture: captions and titles (see `captions_burned_in` in the manifest). They are part of the video, not subtitles.
Honesty notes: nothing here is a live generation. V1-V3 animate real app captures (typing and clicks are simulated reveals); V2's Backlot shot is a fictional seeded project; V5 is a real screen recording where Generate is only hovered.
Music: house-vibez (Lily J, Mixkit). SFX: only the skill-bundled set; keyboard, riser, sparkle and whoosh-big have untraceable sources.
Open items: no person has auditioned the audio; V5 has not had its independent review; V4 (9:16 social cut) does not exist yet.
"""

def zipit():
    open(os.path.join(DST, 'README.md'), 'w').write(README)
    z = os.path.join(ROOT, 'promo-videos-portable.zip')
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as zf:
        for n in sorted(os.listdir(DST)): zf.write(os.path.join(DST, n), n)
    # verify: unzip and recheck checksums
    man = json.load(open(os.path.join(DST, 'manifest.json')))
    with zipfile.ZipFile(z) as zf:
        bad = [r['file'] for r in man['files'] if hashlib.sha256(zf.read(r['file'])).hexdigest() != r['sha256']]
    print('zip', os.path.getsize(z) // 1048576, 'MB; checksum mismatches after unzip:', bad)
    open(os.path.join(ROOT, 'PORTABLE-README.md'), 'w').write(README)

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if mode in ('encode', 'all'):
        with ThreadPoolExecutor(3) as ex: list(ex.map(encode_one, ITEMS))
    if mode in ('manifest', 'all'): manifest()
    if mode in ('zip', 'all'): zipit()
