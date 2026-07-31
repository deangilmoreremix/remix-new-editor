import express from 'express';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  detectScenes,
  upscale,
  colorCorrect,
  stabilize,
  extractAudio,
  mixAudio,
  finalize,
  resolveInput,
  cleanup,
} from './video/ffmpegTools.js';

const router = express.Router();

router.use(cors());
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

const GLOBAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GLOBAL_VIDEO_DB_KEY = process.env.VIDEO_DB_API_KEY || '';

// Resolve the OpenAI key to use for a given job.
// Users may supply their own key in the request body (`apiKey`); that takes
// precedence over the server's global key (set via Render env). This lets the
// backend run on Render without a global key — each user brings their own.
function resolveApiKey(payload) {
  const fromBody = payload && (payload.apiKey || (payload.settings && payload.settings.apiKey));
  return (fromBody && String(fromBody).trim()) || GLOBAL_OPENAI_API_KEY || '';
}

// Resolve the user's VideoDB key. Sent in the request body (`videoDbKey` or
// `settings.videoDbKey`); falls back to a server global key if configured.
function resolveVideoDbKey(payload) {
  const fromBody =
    payload && (payload.videoDbKey || (payload.settings && payload.settings.videoDbKey));
  return (fromBody && String(fromBody).trim()) || GLOBAL_VIDEO_DB_KEY || '';
}

const VIDEODB_BASE_URL = 'https://api.videodb.io';

// Index/ingest a video URL into a VideoDB collection. Returns the media object.
async function videoDbIndex(url, videoDbKey, { name, collectionId = 'default' } = {}) {
  const res = await fetch(`${VIDEODB_BASE_URL}/collection/${encodeURIComponent(collectionId)}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-access-token': videoDbKey },
    body: JSON.stringify({ url, name, media_type: 'video' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`VideoDB index failed (${res.status}): ${(json.error || json.message || '').toString().slice(0, 200)}`);
  const data = json.data ?? json;
  return { id: data.id || data.media_id || data.video_id, streamUrl: data.stream_url || data.player_url, raw: data };
}

// Semantic search a query within a single indexed video (or a collection).
async function videoDbSearch(videoId, query, videoDbKey, { indexType = 'scene', searchType = 'semantic', resultThreshold = 10 } = {}) {
  const endpoint = videoId
    ? `${VIDEODB_BASE_URL}/video/${encodeURIComponent(videoId)}/search/`
    : `${VIDEODB_BASE_URL}/collection/default/search/`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-access-token': videoDbKey },
    body: JSON.stringify({ query, index_type: indexType, search_type: searchType, result_threshold: resultThreshold }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`VideoDB search failed (${res.status}): ${(json.error || json.message || '').toString().slice(0, 200)}`);
  const data = json.data ?? json;
  return Array.isArray(data) ? data : (data.results || []);
}

// OpenAI Responses API call (https://api.openai.com/v1/responses). Used for all
// agent reasoning/generation in the Video Agent. Honors the user's own key.
async function callResponsesApi(apiKey, { model = 'gpt-4.1', input, tools, text, temperature = 0.4 }) {
  if (!apiKey) throw new Error('An OpenAI API key is required. Add your key in Settings → OpenAI.');
  const body = { model, input, temperature };
  if (tools) body.tools = tools;
  if (text) body.text = text;
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI Responses API failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  // Extract the assistant text from the Responses API output items.
  const out = json.output || [];
  const textParts = out
    .filter((o) => o.type === 'message' || o.type === 'response.output_text')
    .flatMap((o) => (o.content ? o.content.filter((c) => c.type === 'output_text').map((c) => c.text) : []));
  const fullText = textParts.join('') || json.output_text || '';
  return { text: fullText, raw: json };
}

const jobs = new Map();

// Real processed outputs are persisted here and served via GET
// /videoagent/file/:fileId so the frontend can actually play/download what
// ffmpeg produced (previously the output filename was returned but the file
// was deleted and never served, so results were invisible).
const EXPORTS_DIR = path.join(os.tmpdir(), 'videoagent-exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

function safeBase(name) {
  return path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Persist a produced file (path or Buffer) into EXPORTS_DIR and return the
// same-origin serve URL used by GET /videoagent/file/:fileId.
function storeOutput(jobId, fileOrBuffer, extOverride) {
  let ext = extOverride;
  if (!ext) {
    ext = typeof fileOrBuffer === 'string' ? path.extname(fileOrBuffer) || '.mp4' : '.mp4';
  }
  const destName = `${safeBase(jobId)}${ext}`;
  const dest = path.join(EXPORTS_DIR, destName);
  if (Buffer.isBuffer(fileOrBuffer)) {
    fs.writeFileSync(dest, fileOrBuffer);
  } else {
    fs.copyFileSync(fileOrBuffer, dest);
  }
  return `/videoagent/file/${destName}`;
}

function createJob(action, payload = {}) {
  const jobId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(jobId, {
    id: jobId,
    action,
    payload,
    status: 'processing',
    progress: 0,
    currentStep: 1,
    result: null,
    error: null,
    createdAt: Date.now(),
  });
  return jobId;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

function completeJob(jobId, result) {
  return updateJob(jobId, { status: 'completed', progress: 100, currentStep: 99, result });
}

function failJob(jobId, error) {
  return updateJob(jobId, {
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  });
}

function buildJobResult(job) {
  if (job.status === 'completed') {
    return { status: 'completed', jobId: job.id, ...job.result };
  }
  if (job.status === 'failed') {
    return { status: 'failed', jobId: job.id, error: job.error };
  }
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scenesFromTimestamps(timestamps, duration = 120) {
  const points = [0, ...timestamps, duration].filter((t, i, arr) => arr.indexOf(t) === i).sort((a, b) => a - b);
  const scenes = [];
  for (let i = 0; i < points.length - 1; i++) {
    scenes.push({
      index: i + 1,
      start: +points[i].toFixed(2),
      end: +points[i + 1].toFixed(2),
    });
  }
  return scenes;
}

// Build contiguous clip segments from detected scene boundaries. If too few
// scene changes are found, split the whole clip into 4 equal segments.
function segmentsFromTimestamps(timestamps, duration = 120) {
  let bounds = [0, ...timestamps, duration]
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .sort((a, b) => a - b);
  if (bounds.length < 3) {
    const N = 4;
    bounds = [];
    for (let i = 0; i <= N; i++) bounds.push(+(i * (duration / N)).toFixed(2));
  }
  const segments = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    segments.push({
      index: i + 1,
      start: +bounds[i].toFixed(2),
      end: +bounds[i + 1].toFixed(2),
      label: `Clip ${i + 1}`,
    });
  }
  return segments;
}

async function runSceneDetection(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 35, currentStep: 1 });
    const timestamps = await detectScenes(input, 0.3);
    updateJob(jobId, { progress: 75, currentStep: 3 });
    const scenes = scenesFromTimestamps(timestamps, 120);
    cleanup(input);
    completeJob(jobId, {
      scenes,
      totalScenes: scenes.length,
      source: 'ffmpeg',
      summary: `Detected ${scenes.length} scene boundaries`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runClipSegmentation(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 35, currentStep: 1 });
    const timestamps = await detectScenes(input, 0.3);
    updateJob(jobId, { progress: 75, currentStep: 3 });
    const segments = segmentsFromTimestamps(timestamps, 120);
    cleanup(input);
    completeJob(jobId, {
      segments,
      segmentCount: segments.length,
      source: 'ffmpeg',
      summary: `Segmented into ${segments.length} clips`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runHighlightDetection(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 35, currentStep: 1 });
    const timestamps = await detectScenes(input, 0.3);
    updateJob(jobId, { progress: 75, currentStep: 3 });
    // Rank the gaps between scene boundaries; the largest gaps are highlights.
    const pts = [0, ...timestamps, 120].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < pts.length; i++) {
      gaps.push({ start: +pts[i - 1].toFixed(2), end: +pts[i].toFixed(2), score: +(pts[i] - pts[i - 1]).toFixed(2) });
    }
    gaps.sort((a, b) => b.score - a.score);
    const highlights = gaps
      .slice(0, 3)
      .sort((a, b) => a.start - b.start)
      .map((g, i) => ({ ...g, label: `Highlight ${i + 1}` }));
    cleanup(input);
    completeJob(jobId, {
      highlights,
      source: 'ffmpeg',
      summary: `Extracted ${highlights.length} highlight moments`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runDubbing(jobId, payload) {
  const input = await resolveInput(payload);
  const apiKey = resolveApiKey(payload);
  try {
    updateJob(jobId, { progress: 30, currentStep: 1 });
    const audioPath = await extractAudio(input);

    let transcript = '';
    let targetText = '';
    if (apiKey) {
      const buffer = fs.readFileSync(audioPath);
      const t = await transcribeWithWhisper(buffer, apiKey);
      transcript = t.text || '';
      targetText = await translateText(transcript, payload.targetLanguage || 'es', apiKey);
    }

    let dubbedAudio = audioPath;
    if (targetText && apiKey) {
      const syn = await synthesizeSpeech({ text: targetText, voice: payload.voice || 'alloy', apiKey });
      dubbedAudio = path.join(os.tmpdir(), `videoagent/va_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${syn.ext || 'mp3'}`);
      fs.writeFileSync(dubbedAudio, syn.audioBuffer);
    }

    const out = await mixAudio(input, dubbedAudio);
    cleanup(input);
    cleanup(audioPath);
    cleanup(dubbedAudio);

    const url = storeOutput(jobId, out);
    completeJob(jobId, {
      dubbedVideo: path.basename(out),
      url,
      downloadUrl: url,
      transcript: transcript || null,
      targetLanguage: payload.targetLanguage || 'es',
      source: apiKey ? 'ffmpeg+openai' : 'ffmpeg',
      exported: true,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runTranscription(jobId, payload) {
  const apiKey = resolveApiKey(payload);
  if (!apiKey) {
    return failJob(jobId, new Error('An OpenAI API key is required for transcription. Add your key in Settings → OpenAI.'));
  }
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 30, currentStep: 1 });
    const audioPath = await extractAudio(input);
    updateJob(jobId, { progress: 60, currentStep: 2 });
    const buffer = fs.readFileSync(audioPath);
    const result = await transcribeWithWhisper(buffer, apiKey);
    cleanup(input);
    cleanup(audioPath);
    completeJob(jobId, {
      transcription: result.text || '',
      segments: (result.segments || []).map((s, i) => ({ index: i + 1, start: s.start || 0, end: s.end || 0, text: s.text || '' })),
      source: 'openai-whisper',
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runVoiceSynthesis(jobId, payload) {
  const apiKey = resolveApiKey(payload);
  if (!apiKey) {
    return failJob(jobId, new Error('An OpenAI API key is required for voice synthesis (TTS). Add your key in Settings → OpenAI.'));
  }
  try {
    const text = payload.text || payload.prompt;
    if (!text) {
      return failJob(jobId, new Error('text or prompt is required for voice synthesis.'));
    }
    const syn = await synthesizeSpeech({ text, voice: payload.voice || 'alloy', model: payload.model || 'tts-1', apiKey });
    const url = storeOutput(jobId, syn.audioBuffer, '.' + (syn.ext || 'mp3'));
    completeJob(jobId, {
      audioUrl: url,
      downloadUrl: url,
      mimeType: syn.mimeType || 'audio/mpeg',
      voice: payload.voice || 'alloy',
      text,
      source: 'openai-tts',
    });
  } catch (err) {
    failJob(jobId, err);
  }
}

async function runVisualTool(jobId, toolId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 40, currentStep: 2 });
    let out;
    if (toolId === 'upscale') {
      out = await upscale(input, undefined, { width: 1920 });
    } else if (toolId === 'color-correct') {
      const opts = payload.options || {};
      out = await colorCorrect(input, undefined, {
        brightness: opts.brightness ?? 0,
        contrast: opts.contrast ?? 1,
        saturation: opts.saturation ?? 1,
        gamma: opts.gamma ?? 1,
      });
    } else if (toolId === 'stabilize') {
      out = await stabilize(input);
    } else {
      throw new Error(`Unknown visual tool: ${toolId}`);
    }
    updateJob(jobId, { progress: 80, currentStep: 3 });
    const url = storeOutput(jobId, out);
    cleanup(input);
    const resultMap = {
      upscale: { upscaledVideo: path.basename(out), url, downloadUrl: url, width: 1920, source: 'ffmpeg', exported: true },
      'color-correct': { correctedVideo: path.basename(out), url, downloadUrl: url, source: 'ffmpeg', exported: true },
      stabilize: { stabilizedVideo: path.basename(out), url, downloadUrl: url, source: 'ffmpeg', exported: true },
    };
    completeJob(jobId, resultMap[toolId]);
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Video Agent "Agents" — VideoDB + OpenAI Responses API powered features.
//
// Each agent: (1) indexes the uploaded video into the user's VideoDB
// collection (when a videoUrl + VideoDB key are present), (2) uses VideoDB
// semantic/spoken/visual search to find moments, (3) uses the OpenAI
// Responses API to generate the agent output. Results are real and served
// via the job result. Agents that need no video (e.g. text-to-movie) work
// from a prompt alone.
// ─────────────────────────────────────────────────────────────────────────

// Index the source video to VideoDB once per job (cached on the job payload).
async function ensureIndexed(jobId, payload) {
  const videoDbKey = resolveVideoDbKey(payload);
  if (!videoDbKey) return null;
  if (!payload.videoUrl || /^(blob:|data:)/i.test(payload.videoUrl)) return null;
  if (payload._videoDbId) return payload._videoDbId;
  updateJob(jobId, { stage: 'indexing-to-videodb' });
  const indexed = await videoDbIndex(payload.videoUrl, videoDbKey, { name: payload.videoName || 'videoagent-source' });
  payload._videoDbId = indexed.id;
  return indexed.id;
}

async function runAgentJob(jobId, agentId, payload) {
  const apiKey = resolveApiKey(payload);
  const videoDbKey = resolveVideoDbKey(payload);
  const needsKey = !['keyword-search', 'visual-search'].includes(agentId);
  if (needsKey && !apiKey) {
    return failJob(jobId, new Error('An OpenAI API key is required for this agent. Add your key in Settings → OpenAI.'));
  }
  try {
    updateJob(jobId, { progress: 10, currentStep: 1, stage: 'preparing' });
    const videoId = await ensureIndexed(jobId, payload);
    const prompt = payload.prompt || payload.text || payload.query || '';

    switch (agentId) {
      case 'storyboarding': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'analyzing-scenes' });
        const scenes = videoId ? await videoDbSearch(videoId, 'key scenes, actions and setting', videoDbKey, { indexType: 'scene' }) : [];
        const sceneText = scenes.slice(0, 8).map((s, i) => `Scene ${i + 1} [${(s.start ?? 0)}s-${(s.end ?? 0)}s]: ${s.text || ''}`).join('\n');
        const story = await callResponsesApi(apiKey, {
          input: `You are a professional storyboard artist. Create a shot-by-shot storyboard for this video.\n\nVideo context:\n${sceneText || prompt}\n\nReturn a JSON array of shots, each with: shot_number, timestamp (seconds), description, camera (e.g. wide/close-up), and narration.`,
        });
        return completeJob(jobId, { agent: 'storyboarding', storyboard: story.text, shots: parseJsonArray(story.text), source: 'videodb+openai', exported: false });
      }
      case 'highlights': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'finding-highlights' });
        const res = videoId ? await videoDbSearch(videoId, 'most exciting, important or emotional moments', videoDbKey, { indexType: 'scene', resultThreshold: 8 }) : [];
        const moments = res.map((r, i) => ({ rank: i + 1, start: r.start ?? 0, end: r.end ?? 0, reason: (r.text || '').slice(0, 160) }));
        const summary = await callResponsesApi(apiKey, {
          input: `Summarize the top highlight moments of this video as a bulleted list. Moments:\n${moments.map((m) => `${m.start}s: ${m.reason}`).join('\n')}`,
        });
        return completeJob(jobId, { agent: 'highlights', highlights: moments, summary: summary.text, source: 'videodb+openai' });
      }
      case 'text-to-movie':
      case 'text-to-video': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'writing-screenplay' });
        const script = await callResponsesApi(apiKey, {
          input: `You are a GenAI movie director. Turn this prompt into a cinematic shot list / screenplay for a short AI-generated film.\n\nPrompt: ${prompt}\n\nReturn JSON: { title, logline, shots: [{ shot, camera, action, voiceover }] }.`,
        });
        return completeJob(jobId, { agent: 'text-to-movie', screenplay: script.text, shots: parseJsonArray(script.text), source: 'openai-responses' });
      }
      case 'visual-search':
      case 'keyword-search': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'searching' });
        if (!videoId) return failJob(jobId, new Error('A video must be loaded (and a VideoDB key set) to search it.'));
        const idx = agentId === 'keyword-search' ? 'spoken' : 'visual';
        const res = await videoDbSearch(videoId, prompt || 'anything notable', videoDbKey, { indexType: idx });
        const clips = res.map((r, i) => ({ index: i + 1, start: r.start ?? 0, end: r.end ?? 0, text: (r.text || '').slice(0, 200), score: r.score }));
        return completeJob(jobId, { agent: agentId, query: prompt, results: clips, count: clips.length, source: 'videodb' });
      }
      case 'voice-cloning': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'synthesizing' });
        const text = payload.text;
        if (!text) {
          return failJob(jobId, new Error('text is required for voice cloning.'));
        }
        const syn = await synthesizeSpeech({ text, voice: payload.voice || 'alloy', apiKey });
        const url = storeOutput(jobId, syn.audioBuffer, '.' + (syn.ext || 'mp3'));
        return completeJob(jobId, { agent: 'voice-cloning', audioUrl: url, downloadUrl: url, text, note: 'OpenAI voice (clone with a Voiceprint when available)', source: 'openai-tts' });
      }
      case 'audio-overlay':
      case 'gen-audio-overlays': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'generating-audio' });
        const text = payload.text || payload.description;
        if (!text) {
          return failJob(jobId, new Error('text or description is required for audio overlay.'));
        }
        const syn = await synthesizeSpeech({ text, voice: payload.voice || 'nova', apiKey });
        const url = storeOutput(jobId, syn.audioBuffer, '.' + (syn.ext || 'mp3'));
        return completeJob(jobId, { agent: 'audio-overlay', audioUrl: url, downloadUrl: url, text, source: 'openai-tts' });
      }
      case 'sales-assistant': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'analyzing-pitch' });
        const transcript = videoId ? (await videoDbSearch(videoId, 'spoken words, product pitch, pricing, offer', videoDbKey, { indexType: 'spoken' })).map((r) => r.text || '').join(' ') : (payload.transcript || '');
        const plan = await callResponsesApi(apiKey, {
          input: `You are a sales-assistant CRM copilot. From this video/pitch, extract: customer pain, product offered, price, CTA, and a suggested CRM follow-up task + email. Pitch:\n${transcript.slice(0, 3000) || prompt}`,
        });
        return completeJob(jobId, { agent: 'sales-assistant', analysis: plan.text, crmTask: extractField(plan.text, 'follow-up'), source: 'videodb+openai' });
      }
      case 'comparison': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'comparing' });
        const a = payload.videoUrlA || payload.textA || prompt;
        const b = payload.videoUrlB || payload.textB || '';
        const cmp = await callResponsesApi(apiKey, {
          input: `Compare these two videos/descriptions on: content, style, audience, strengths, weaknesses. A: ${a}\nB: ${b}`,
        });
        return completeJob(jobId, { agent: 'comparison', comparison: cmp.text, source: 'openai-responses' });
      }
      case 'output-formatting': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'formatting' });
        const fmt = payload.format || 'vertical 9:16';
        const out = await callResponsesApi(apiKey, {
          input: `Suggest the optimal export/output formatting for this video given target "${fmt}". Include resolution, aspect ratio, codec, platform (TikTok/IG/YT), and a caption template. Context: ${prompt}`,
        });
        return completeJob(jobId, { agent: 'output-formatting', recommendation: out.text, targetFormat: fmt, source: 'openai-responses' });
      }
      case 'dubbing':
        return runDubbing(jobId, payload);
      case 'thumbnail': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'choosing-thumbnail' });
        const shots = videoId ? await videoDbSearch(videoId, 'most visually striking frame', videoDbKey, { indexType: 'visual', resultThreshold: 5 }) : [];
        const pick = await callResponsesApi(apiKey, {
          input: `Pick the best thumbnail frame and write a click-worthy title + 3 hashtags. Candidate frames:\n${shots.map((s, i) => `${i + 1}. ${s.text || ''} (${(s.start ?? 0)}s)`).join('\n')}\nVideo: ${prompt}`,
        });
        return completeJob(jobId, { agent: 'thumbnail', title: extractField(pick.text, 'title'), hashtags: extractHashtags(pick.text), rationale: pick.text, source: 'videodb+openai' });
      }
      case 'profanity': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'scanning-language' });
        const transcript = videoId ? (await videoDbSearch(videoId, 'all spoken words', videoDbKey, { indexType: 'spoken', resultThreshold: 50 })).map((r) => r.text || '').join(' ') : (payload.transcript || '');
        const clean = await callResponsesApi(apiKey, {
          input: `Detect and list any profanity/non-family-safe language in this transcript, with timestamps if available, and suggest clean replacements. Transcript:\n${transcript.slice(0, 4000)}`,
        });
        return completeJob(jobId, { agent: 'profanity', report: clean.text, hasProfanity: /profan|inappropriate|not safe/i.test(clean.text), source: 'videodb+openai' });
      }
      case 'subtitle': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'generating-subtitles' });
        const transcript = videoId ? (await videoDbSearch(videoId, 'all spoken words with timing', videoDbKey, { indexType: 'spoken', resultThreshold: 50 })).map((r) => r.text || '').join(' ') : '';
        const sub = await callResponsesApi(apiKey, {
          input: `Generate SRT subtitles (timestamped) from this transcript. Transcript:\n${transcript.slice(0, 4000) || prompt}`,
        });
        const srtUrl = storeOutput(jobId, sub.text, '.srt');
        return completeJob(jobId, { agent: 'subtitle', srt: sub.text, srtUrl, downloadUrl: srtUrl, source: 'videodb+openai' });
      }
      case 'slack': {
        updateJob(jobId, { progress: 40, currentStep: 2, stage: 'posting-to-slack' });
        const summary = videoId ? (await videoDbSearch(videoId, 'summary of this video', videoDbKey, { indexType: 'scene' })).map((r) => r.text || '').join(' ') : prompt;
        const webhook = process.env.SLACK_WEBHOOK_URL || (payload.settings && payload.settings.slackWebhook);
        if (!webhook) return completeJob(jobId, { agent: 'slack', posted: false, note: 'Set SLACK_WEBHOOK_URL (Render env) or pass slackWebhook to post.', summary: summary.slice(0, 500) });
        await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `🎬 Video Agent: ${summary.slice(0, 500)}` }) });
        return completeJob(jobId, { agent: 'slack', posted: true, summary: summary.slice(0, 500) });
      }
      default:
        return failJob(jobId, new Error(`Unsupported agent: ${agentId}`));
    }
  } catch (err) {
    failJob(jobId, err);
  }
}

// Small helpers for parsing agent LLM output.
function parseJsonArray(text) {
  if (!text) return [];
  try {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch { /* ignore */ }
  return [];
}
function extractField(text, label) {
  if (!text) return '';
  const m = text.match(new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : '';
}
function extractHashtags(text) {
  if (!text) return [];
  return (text.match(/#[\w-]+/g) || []).slice(0, 10);
}

async function runToolJob(jobId, toolId, payload) {
  switch (toolId) {
    case 'scene-detection':
      return runSceneDetection(jobId, payload);
    case 'clip-segmentation':
      return runClipSegmentation(jobId, payload);
    case 'highlight-detection':
      return runHighlightDetection(jobId, payload);
    case 'upscale':
    case 'color-correct':
    case 'stabilize':
      return runVisualTool(jobId, toolId, payload);
    case 'dubbing':
      return runDubbing(jobId, payload);
    case 'whisper':
      return runTranscription(jobId, payload);
    case 'cosyvoice':
    case 'fish-speech':
    case 'seed-vc':
      return runVoiceSynthesis(jobId, payload);
    case 'imagebind':
      return runAgentJob(jobId, 'visual-search', payload);
    case 'meme':
      // Meme generator: VideoDB scene context + OpenAI to write the meme concept.
      return runMemeJob(jobId, payload);
    // ── New VideoDB + OpenAI Responses API agents ──
    case 'storyboarding':
    case 'highlights':
    case 'text-to-movie':
    case 'text-to-video':
    case 'visual-search':
    case 'keyword-search':
    case 'voice-cloning':
    case 'audio-overlay':
    case 'gen-audio-overlays':
    case 'sales-assistant':
    case 'comparison':
    case 'output-formatting':
    case 'thumbnail':
    case 'profanity':
    case 'subtitle':
    case 'slack':
    case 'faceless-video':
    case 'ai-ad-films':
    case 'kids-storyteller':
    case 'trailer-narration':
    case 'tiktok-lyric':
    case 'year-in-frames':
    case 'intro-outro':
    case 'brand-elements':
    case 'dynamic-ads':
      return runAgentJob(jobId, toolId, payload);
    default:
      return failJob(jobId, new Error(`Unsupported tool: ${toolId}`));
  }
}

async function runUseCaseJob(jobId, usecaseId, payload) {
  // Use-case aliases → real VideoDB + OpenAI agent handlers (no more fakes).
  const AGENT_ALIAS = {
    overview: 'highlights',
    qa: 'visual-search',
    commentary: 'audio-overlay',
    meme: 'meme',
  };
  if (AGENT_ALIAS[usecaseId]) {
    // `meme` has its own handler below; the rest delegate to runAgentJob.
    if (usecaseId === 'meme') {
      return runMemeJob(jobId, payload);
    }
    return runAgentJob(jobId, AGENT_ALIAS[usecaseId], payload);
  }

  const input = await resolveInput(payload);
  try {
    const steps = ['analyzing', 'processing', 'applying', 'complete'];
    updateJob(jobId, { progress: 15, currentStep: 1 });

    if (usecaseId === 'music-video') {
      const up = await upscale(input, undefined, { width: 1920 });
      cleanup(up);
    } else if (usecaseId === 'standup') {
      const st = await stabilize(input);
      cleanup(st);
    } else {
      const cc = await colorCorrect(input);
      cleanup(cc);
    }

    updateJob(jobId, { progress: 60, currentStep: 2 });

    let finalOut = null;
    switch (usecaseId) {
      case 'standup':
        finalOut = await stabilize(input);
        break;
      case 'music-video':
        finalOut = await finalize(input);
        break;
      default:
        break;
    }

    cleanup(input);

    const outputs = {
      standup: { result: 'Video stabilized', exported: true },
      'music-video': { result: 'Video finalized', exported: true },
    };

    const result = outputs[usecaseId] || { result: 'Processing complete', exported: !!finalOut };
    if (finalOut) {
      const url = storeOutput(jobId, finalOut);
      result.url = url;
      result.downloadUrl = url;
      result.source = 'ffmpeg';
    }
    updateJob(jobId, { progress: 90, currentStep: 3 });
    completeJob(jobId, result);
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

// Meme generator: uses VideoDB scene context + OpenAI to write a meme concept,
// then returns a downloadable titled caption card (real, not a fake string).
async function runMemeJob(jobId, payload) {
  const apiKey = resolveApiKey(payload);
  if (!apiKey) return failJob(jobId, new Error('An OpenAI API key is required for the Meme Generator. Add your key in Settings → OpenAI.'));
  try {
    updateJob(jobId, { progress: 30, currentStep: 1, stage: 'brainstorming-meme' });
    const videoDbKey = resolveVideoDbKey(payload);
    const videoId = await ensureIndexed(jobId, payload);
    const ctx = videoId ? (await videoDbSearch(videoId, 'funny or relatable moment', videoDbKey, { indexType: 'scene' })).map((r) => r.text || '').join(' ') : (payload.prompt || '');
    const meme = await callResponsesApi(apiKey, {
      input: `Create a viral meme based on this video. Return JSON: { topText, bottomText, format, caption }. Context: ${ctx.slice(0, 1500)}`,
    });
    const card = `MEME\n${(parseJsonObj(meme.text).topText) || ''}\n${(parseJsonObj(meme.text).bottomText) || ''}`;
    const url = storeOutput(jobId, card, '.txt');
    return completeJob(jobId, { agent: 'meme', meme: parseJsonObj(meme.text), text: card, downloadUrl: url, source: 'videodb+openai' });
  } catch (err) {
    failJob(jobId, err);
  }
}

function parseJsonObj(text) {
  if (!text) return {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch { /* ignore */ }
  return {};
}

async function runFullPipelineJob(jobId, payload) {
  let input = await resolveInput(payload);
  try {
    const stages = [
      { name: 'scene-detection', duration: 1500 },
      { name: 'clip-segmentation', duration: 1200 },
      { name: 'highlight-detection', duration: 1200 },
      { name: 'transcription', duration: 1200 },
      { name: 'color-correction', duration: 1200 },
      { name: 'final-export', duration: 1500 },
    ];
    let elapsed = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      updateJob(jobId, { progress: Math.round((elapsed / 8700) * 100), currentStep: i + 1, stage: stage.name });

      if (stage.name === 'scene-detection') {
        const ts = await detectScenes(input, 0.3);
        updateJob(jobId, { scenes: scenesFromTimestamps(ts, 120).length });
        elapsed += stage.duration;
        continue;
      }
      if (stage.name === 'clip-segmentation') {
        const timestamps = await detectScenes(input, 0.3);
        const segments = segmentsFromTimestamps(timestamps, 120);
        updateJob(jobId, { segments: segments.length, clipSegments: segments.slice(0, 5) });
        elapsed += stage.duration;
        continue;
      }
      if (stage.name === 'highlight-detection') {
        const timestamps = await detectScenes(input, 0.3);
        const pts = [0, ...timestamps, 120].sort((a, b) => a - b);
        const gaps = [];
        for (let j = 1; j < pts.length; j++) {
          gaps.push({ start: +pts[j - 1].toFixed(2), end: +pts[j].toFixed(2), score: +(pts[j] - pts[j - 1]).toFixed(2) });
        }
        gaps.sort((a, b) => b.score - a.score);
        const highlights = gaps.slice(0, 3).sort((a, b) => a.start - b.start).map((g, idx) => ({ ...g, label: `Highlight ${idx + 1}` }));
        updateJob(jobId, { highlights, highlightCount: highlights.length });
        elapsed += stage.duration;
        continue;
      }
      if (stage.name === 'transcription') {
        const apiKey = resolveApiKey(payload);
        if (!apiKey) {
          updateJob(jobId, { transcriptionError: 'OpenAI API key required for transcription' });
        } else {
          try {
            const audioPath = await extractAudio(input);
            const buffer = fs.readFileSync(audioPath);
            const result = await transcribeWithWhisper(buffer, apiKey);
            cleanup(audioPath);
            updateJob(jobId, {
              transcription: result.text || '',
              segments: (result.segments || []).map((s, idx) => ({ index: idx + 1, start: s.start || 0, end: s.end || 0, text: s.text || '' })),
            });
          } catch (err) {
            updateJob(jobId, { transcriptionError: err.message });
          }
        }
        elapsed += stage.duration;
        continue;
      }
      if (stage.name === 'color-correction') {
        const cc = await colorCorrect(input);
        cleanup(cc);
      }
      if (stage.name === 'final-export') {
        const out = await finalize(input);
        const url = storeOutput(jobId, out);
        updateJob(jobId, { exportedUrl: url, url, downloadUrl: url });
        cleanup(out);
      }
      elapsed += stage.duration;
    }

    cleanup(input);
    completeJob(jobId, {
      pipeline: 'completed',
      stages: stages.map((s) => s.name),
      exportedUrl: `/videoagent/file/${safeBase(jobId)}.mp4`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

router.post('/process', async (req, res) => {
  const body = req.body || {};
  const action = body.action;
  if (!action) {
    return res.status(400).json({ error: 'Missing action in request body' });
  }

  try {
    switch (action) {
      case 'process-tool': {
        const toolId = body.tool;
        if (!toolId) {
          return res.status(400).json({ error: 'Missing tool in request body' });
        }
        const jobId = createJob('process-tool', { toolId, payload: body });
        runToolJob(jobId, toolId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'process-usecase': {
        const usecaseId = body.usecase;
        if (!usecaseId) {
          return res.status(400).json({ error: 'Missing usecase in request body' });
        }
        const jobId = createJob('process-usecase', { usecaseId, payload: body });
        runUseCaseJob(jobId, usecaseId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'scene-detection': {
        const jobId = createJob('scene-detection', { payload: body });
        runSceneDetection(jobId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'full-pipeline': {
        const jobId = createJob('full-pipeline', { payload: body });
        runFullPipelineJob(jobId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'transcribe':
        return res.json({ status: 'error', error: 'Use /transcribe endpoint for transcription' });
      case 'tts':
        return res.json({ status: 'error', error: 'Use /tts/synthesize endpoint for TTS' });
      default:
        return res.status(400).json({ error: `Unsupported action: ${action}` });
    }
  } catch (error) {
    console.error('[videoagent] process failed:', error);
    return res.status(500).json({ error: 'Processing failed', message: error.message });
  }
});

router.get('/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: 'not_found', error: 'Job not found' });
  }
  return res.json(buildJobResult(job));
});

// Cancel an in-flight job (best-effort; jobs live in an in-memory Map).
router.post('/cancel/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: 'not_found', error: 'Job not found' });
  }
  updateJob(req.params.jobId, { status: 'cancelled', error: 'Cancelled by user' });
  return res.json({ status: 'cancelled', jobId: req.params.jobId });
});

// Serve real processed outputs (video/audio) produced by the jobs above.
router.get('/file/:fileId', (req, res) => {
  const base = safeBase(req.params.fileId);
  const candidates = [
    path.join(EXPORTS_DIR, base),
    path.join(EXPORTS_DIR, base + '.mp4'),
    path.join(EXPORTS_DIR, base + '.mp3'),
    path.join(EXPORTS_DIR, base + '.wav'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    return res.status(404).json({ status: 'not_found', error: 'Export not found' });
  }
  const ext = path.extname(found).toLowerCase();
  const ct = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : 'video/mp4';
  res.set('Content-Type', ct);
  res.set('Content-Disposition', 'inline');
  res.set('Accept-Ranges', 'bytes');
  fs.createReadStream(found).pipe(res);
});

router.post('/transcribe', async (req, res) => {
  try {
    const apiKey = resolveApiKey(req.body || {});
    const result = await transcribeWithWhisper(req.body && req.body.input, apiKey);
    res.json({ success: true, transcription: result.text, raw: result });
  } catch (error) {
    console.error('[videoagent] transcription failed:', error);
    res.status(500).json({ error: 'Transcription failed', message: error.message });
  }
});

router.post('/tts/synthesize', async (req, res) => {
  try {
    const { text, voice, model } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const apiKey = resolveApiKey(req.body || {});
    const result = await synthesizeSpeech({ text, voice: voice || 'alloy', model: model || 'tts-1', apiKey });
    res.set('Content-Type', result.mimeType);
    res.send(result.audioBuffer);
  } catch (error) {
    console.error('[videoagent] tts failed:', error);
    res.status(500).json({ error: 'TTS failed', message: error.message });
  }
});

// OpenAI Whisper transcription
async function transcribeWithWhisper(input, apiKey) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Add your key in Settings → OpenAI.');
  }

  let formData;
  if (Buffer.isBuffer(input) || typeof input === 'string') {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
  } else if (typeof FormData !== 'undefined' && input instanceof FormData) {
    formData = input;
    if (!formData.has('model')) {
      formData.append('model', 'whisper-1');
    }
  } else {
    throw new Error('Unsupported input for transcription');
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Whisper transcription failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

// OpenAI TTS synthesis
async function synthesizeSpeech({ text, voice = 'alloy', model = 'tts-1', apiKey }) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Add your key in Settings → OpenAI.');
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text, voice }),
  });

  if (!response.ok) {
    const text0 = await response.text();
    throw new Error(`TTS failed: ${response.status} ${response.statusText} - ${text0}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    audioBuffer: buffer,
    mimeType: response.headers.get('content-type') || 'audio/mpeg',
    ext: mimeToExt(response.headers.get('content-type')),
  };
}

// OpenAI chat translation (used by dubbing)
async function translateText(text, targetLanguage, apiKey) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Add your key in Settings → OpenAI.');
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Translate the following text to ${targetLanguage}. Return only the translation.` },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Translation failed: ${response.status} ${t}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

function mimeToExt(mime) {
  if (!mime || typeof mime !== 'string') return 'bin';
  const map = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
  };
  return map[mime.split(';')[0].trim().toLowerCase()] || 'bin';
}

export default router;
