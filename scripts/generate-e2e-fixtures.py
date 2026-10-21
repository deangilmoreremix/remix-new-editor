#!/usr/bin/env python3
"""Generate deterministic, REAL media fixtures for the e2e upload suites.

Replaces the degenerate stubs that were previously committed:

  start-image.png  1x1 pixel PNG (69 bytes)   -> 320x240 RGB PNG with content
  sample-video.mp4 empty moov shell (44 bytes) -> real H.264 MP4, decodable frames
  sample-audio.mp3 empty ID3 frame (57 bytes)  -> real PCM WAV (audio/wav)

The video is encoded with macOS `avconvert` from a video that already lives in
this repository (.agents/skills/hyperframes-animation/examples/assets), trimmed
to one second so the fixture stays small. The audio is synthesised here as a
faded sine tone and written as a standard PCM WAV; `audio/wav` and the `wav`
extension are both on the upload allow-list (src/lib/editor/uploadLimits.js).

Run from the repository root:  python3 scripts/generate-e2e-fixtures.py
"""
import math
import os
import struct
import subprocess
import sys
import tempfile
import wave

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES = os.path.join(ROOT, "e2e", "fixtures")
VIDEO_SOURCE = os.path.join(
    ROOT, ".agents", "skills", "hyperframes-animation", "examples", "assets",
    "background-tech-data-flow.mp4",
)


def build_png(path, width=320, height=240):
    """A deterministic, visually distinct image (not a 1x1 stub)."""
    img = Image.new("RGB", (width, height))
    px = img.load()
    # Vertical sky->ground gradient so the image is unmistakably not uniform.
    for y in range(height):
        t = y / (height - 1)
        r = int(40 + 150 * t)
        g = int(90 + 90 * t)
        b = int(200 - 120 * t)
        for x in range(width):
            px[x, y] = (r, g, b)
    d = ImageDraw.Draw(img)
    # Distinct blocks make it obvious in a preview that a real image arrived.
    d.rectangle([16, 16, 111, 111], fill=(220, 40, 40))
    d.rectangle([width - 112, 16, width - 17, 111], fill=(40, 200, 90))
    d.rectangle([16, height - 112, 111, height - 17], fill=(250, 210, 40))
    d.rectangle([width - 112, height - 112, width - 17, height - 17], fill=(240, 240, 240))
    d.ellipse([width // 2 - 34, height // 2 - 34, width // 2 + 34, height // 2 + 34], fill=(20, 20, 20))
    d.text((18, height - 26), "UPLOAD-FIXTURE", fill=(255, 255, 255))
    img.save(path, format="PNG", optimize=True)
    return path


def build_wav(path, seconds=1.0, rate=22050, freq=440.0):
    """A real, decodable PCM WAV (faded sine tone)."""
    frames = bytearray()
    total = int(seconds * rate)
    for i in range(total):
        # Fade in/out so the tone never starts or stops on a click.
        env = min(1.0, i / (rate * 0.05), (total - i) / (rate * 0.05))
        sample = int(20000 * env * math.sin(2 * math.pi * freq * i / rate))
        frames += struct.pack("<h", sample)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    return path


def build_mp4(path, seconds=1.0):
    """A real H.264 MP4 with decodable frames, encoded from a repo-owned source."""
    if not os.path.exists(VIDEO_SOURCE):
        raise SystemExit(f"video source missing: {VIDEO_SOURCE}")
    subprocess.run(
        ["avconvert", "--source", VIDEO_SOURCE, "--preset", "Preset640x480",
         "--output", path, "--start", "0", "--duration", str(seconds), "--replace"],
        check=True, capture_output=True,
    )
    return path


def main():
    os.makedirs(FIXTURES, exist_ok=True)

    png = build_png(os.path.join(FIXTURES, "start-image.png"))
    print("PNG  ", os.path.relpath(png, ROOT), os.path.getsize(png), "bytes")

    with tempfile.TemporaryDirectory() as tmp:
        wav = build_wav(os.path.join(tmp, "sample-audio.wav"))
        out_wav = os.path.join(FIXTURES, "sample-audio.wav")
        os.replace(wav, out_wav)
        print("WAV  ", os.path.relpath(out_wav, ROOT), os.path.getsize(out_wav), "bytes")

    mp4 = build_mp4(os.path.join(FIXTURES, "sample-video.mp4"))
    print("MP4  ", os.path.relpath(mp4, ROOT), os.path.getsize(mp4), "bytes")

    # The old stub MP3 is replaced by the real WAV; remove it so the repo has
    # exactly one audio fixture and no empty-file stub left behind.
    stale_mp3 = os.path.join(FIXTURES, "sample-audio.mp3")
    if os.path.exists(stale_mp3):
        os.remove(stale_mp3)
        print("RM   ", os.path.relpath(stale_mp3, ROOT), "(stub replaced by sample-audio.wav)")


if __name__ == "__main__":
    sys.exit(main())
