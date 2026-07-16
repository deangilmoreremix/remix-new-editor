import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';

// Point fluent-ffmpeg at the bundled static binaries.
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const TMP = path.join(os.tmpdir(), 'videoagent');
fs.mkdirSync(TMP, { recursive: true });

function tmpFile(ext) {
  return path.join(TMP, `va_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

export function ensureFfmpeg() {
  return !!(ffmpegStatic);
}

// Generate a synthetic test clip (with an audio track) so real ffmpeg runs
// even without an uploaded video.
export function makeSyntheticVideo(durationSec = 8) {
  const out = tmpFile('mp4');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`testsrc=size=320x240:rate=15`)
      .inputFormat('lavfi')
      .input(`sine=frequency=440:duration=${durationSec}`)
      .inputFormat('lavfi')
      .outputOptions([
        '-t', String(durationSec),
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
      ])
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

export function probe(input) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export function extractAudio(input, out = tmpFile('wav')) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .noVideo()
      .audioCodec('pcm_s16le')
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

export function upscale(input, out = tmpFile('mp4'), { width = 1920 } = {}) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoFilters(`scale=${width}:-2:flags=lanczos`)
      .outputOptions(['-c:a', 'copy'])
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

export function colorCorrect(
  input,
  out = tmpFile('mp4'),
  { brightness = 0, contrast = 1, saturation = 1 } = {}
) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoFilters(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`)
      .outputOptions(['-c:a', 'copy'])
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

export function stabilize(input, out = tmpFile('mp4')) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoFilters('deshake')
      .outputOptions(['-c:a', 'copy'])
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

export function mixAudio(videoInput, audioInput, out = tmpFile('mp4')) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoInput)
      .input(audioInput)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
      ])
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

export function finalize(input, out = tmpFile('mp4')) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-movflags', '+faststart',
      ])
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run();
  });
}

// Real scene detection using ffmpeg's scene-change filter.
export function detectScenes(input, threshold = 0.3) {
  return new Promise((resolve, reject) => {
    const timestamps = [];
    ffmpeg(input)
      .output('pipe:1')
      .outputOptions([
        '-filter:v', `select='gt(scene\\,${threshold})',showinfo`,
        '-f', 'null',
      ])
      .on('stderr', (line) => {
        const m = line.match(/pts_time:([\d.]+)/);
        if (m) timestamps.push(parseFloat(m[1]));
      })
      .on('end', () => {
        const unique = [...new Set(timestamps)].sort((a, b) => a - b);
        resolve(unique);
      })
      .on('error', reject)
      .run();
  });
}

// Resolve the input video: local path, remote URL download, or synthetic fallback.
export async function resolveInput(body = {}) {
  if (body.videoPath && fs.existsSync(body.videoPath)) {
    return body.videoPath;
  }
  if (body.videoUrl) {
    // The server can only fetch real, publicly reachable URLs. A blob:/data:
    // URL produced in the browser cannot be fetched here.
    if (/^(blob:|data:)/i.test(String(body.videoUrl))) {
      throw new Error('Cannot process a local blob/data URL on the server. Upload the media first and pass its https URL.');
    }
    const out = tmpFile('mp4');
    const resp = await axios({ url: body.videoUrl, method: 'GET', responseType: 'stream' });
    await new Promise((res, rej) => {
      const writer = fs.createWriteStream(out);
      resp.data.pipe(writer);
      writer.on('finish', res);
      writer.on('error', rej);
    });
    return out;
  }
  // No real source provided: synthesize a short test clip so the real ffmpeg
  // pipeline still runs (used by the studio's demo mode and the test suite).
  return makeSyntheticVideo(8);
}

export function cleanup(file) {
  try {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* best-effort */
  }
}
