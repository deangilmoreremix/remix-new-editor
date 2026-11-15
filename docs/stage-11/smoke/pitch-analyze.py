"""Measure the pitch (FFT peak) and duration of the exported file's audio. Usage: python3 -I pitch-analyze.py <export.mp4> <expected_hz> [expected_seconds]"""
import json, subprocess, sys
import numpy as np
f, want = sys.argv[1], float(sys.argv[2])
dur_want = float(sys.argv[3]) if len(sys.argv) > 3 else None
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
sr = 48000
n = 32768
res = {'samples': int(len(x)), 'audio_seconds': len(x) / sr, 'peaks': []}
for start in (int(0.5 * sr), int(1.5 * sr), int(3 * sr)):
    seg = x[start:start + n]
    if len(seg) < n: continue
    w = np.hanning(n); s = np.abs(np.fft.rfft(seg * w)); k = int(np.argmax(s))
    a, b, c = np.log(s[k - 1] + 1e-12), np.log(s[k] + 1e-12), np.log(s[k + 1] + 1e-12)
    d = 0.5 * (a - c) / (a - 2 * b + c)
    res['peaks'].append(round((k + d) * sr / n, 2))
res['rms'] = float(np.sqrt(np.mean(x ** 2)))
res['expected_hz'] = want
res['ok_pitch'] = bool(res['peaks']) and all(abs(p - want) / want < 0.01 for p in res['peaks'])
if dur_want: res['ok_duration'] = abs(res['audio_seconds'] - dur_want) < 0.3
if len(sys.argv) > 4 and sys.argv[4] == 'windows':
    # peak frequency every 0.5 s (window 0.4 s, zero padded) for ramp checks
    w = int(0.4 * sr); out = []
    for t in np.arange(0.25, len(x) / sr - 0.45, 0.5):
        seg = x[int(t * sr):int(t * sr) + w]
        if np.sqrt(np.mean(seg ** 2)) < 0.01: out.append((round(float(t), 2), None)); continue
        sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 65536)); k = int(np.argmax(sp)); out.append((round(float(t), 2), round(k * sr / 65536, 1)))
    res['windows'] = out
print(json.dumps(res))
