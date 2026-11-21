#!/usr/bin/env python3
"""Frame-timing check for a speed-curve export. usage: speedcurve-analyze.py export.mp4 calib.mp4 pieces.json
calib.mp4 = the SAME source clip exported plain (1x, same preset / fps) through the same renderer: its luma ramps with source time (the source encodes
luma = 16 + 219 * T / 10), so frame i of calib gives luma(t) = luma(source time t) as seen through the whole export pipeline (colour conversion, scaling,
H.264). For every frame of the curve export the source time is read back from its luma through that calibration and compared with the source time the
piece list (pieces.json = [{start, trimStart, speed, dur}] of the video pieces on the timeline) predicts for that output time."""
import json, subprocess, sys
import numpy as np

def frames(path, w=32, h=18, fps=None):
    vf = f"scale={w}:{h},format=gray" + (f",fps={fps}" if fps else "")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w)
    return a.reshape(a.shape[0], -1).mean(axis=1)

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,r_frame_rate,avg_frame_rate,nb_frames", "-of", "json", path], capture_output=True, check=True).stdout
    return json.loads(out)

exp, src, pj = sys.argv[1], sys.argv[2], sys.argv[3]
pieces = json.load(open(pj))
FPS = 30.0
cal = frames(src)  # src == calib.mp4 here; frame i is at source time (i + 0.5) / FPS
cal_t = (np.arange(len(cal)) + 0.5) / FPS
lo, hi = cal[2], cal[-3]
mask = (cal > cal[2] + 2) & (cal < cal[-3] - 2)  # drop the saturated ends
mono = np.maximum.accumulate(cal[mask]); tt = cal_t[mask]
def to_src_time(l): return np.interp(l, mono, tt)
info = probe(exp)
fps = FPS
el = frames(exp)
n = len(el)
t_out = (np.arange(n) + 0.5) / fps
def predicted(t):
    for p in pieces:
        end = p["start"] + p["dur"]
        if t < end + 1e-9: return p["trimStart"] + max(0.0, t - p["start"]) * p["speed"]
    p = pieces[-1]; return p["trimStart"] + p["dur"] * p["speed"]
meas = to_src_time(el)
pred = np.array([predicted(t) for t in t_out])
# skip the first / last frame (fade-in black frames, final partial frame)
sl = slice(2, n - 2)
valid = (el[sl] > cal[2] + 2) & (el[sl] < cal[-3] - 2)  # only frames whose luma is inside the calibrated range
err = np.abs(meas[sl] - pred[sl])[valid]
dur = float(info["format"]["duration"])
timeline_end = pieces[-1]["start"] + pieces[-1]["dur"]
res = {"frames": int(n), "container_duration": dur, "timeline_duration": timeline_end, "duration_error": dur - timeline_end,
       "max_abs_src_time_error": float(err.max()), "mean_abs_src_time_error": float(err.mean()), "p95_abs_src_time_error": float(np.percentile(err, 95)),
       "frames_compared": int(valid.sum()), "src_time_first": float(meas[2]), "src_time_last": float(meas[-3]), "streams": [s.get("codec_name") for s in info["streams"]],
       "slowest_local_speed": float(min(np.diff(meas[sl]) * fps)) if n > 6 else None}
# local speed (source seconds per output second) sampled every 0.5 s: shows the ramp
loc = []
for i in range(2, n - 8, 6):
    loc.append({"t": float(t_out[i]), "measured_speed": float((meas[i + 6] - meas[i]) / (t_out[i + 6] - t_out[i])), "predicted_speed": float((pred[i + 6] - pred[i]) / (t_out[i + 6] - t_out[i]))})
res["local_speed"] = loc
print(json.dumps(res, indent=1))
