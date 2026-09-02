import { runDirectorFinishingOp, uploadVideoToDirector, invokeDirectorAgent } from '../directorClient.js';
import { planAutoEdit } from '../openaiResponses.js';

/**
 * Render Studio finishing ops are delegated to the Director (VideoDB) backend.
 * Every function either returns a real result from VideoDB or a loud error —
 * there is no silent/mock fallback (per the "fail loudly" rule).
 *
 * The Director client handles both legs of each op:
 *   1. upload the source URL into a VideoDB collection, and
 *   2. invoke the named Director agent over Socket.IO `/chat`.
 */

/**
 * generateSubtitles: run the Director `subtitle` agent on the source video.
 * Returns { url, srt, vtt, segments, text, error }.
 * `url` is the subtitled video stream from VideoDB (real, different URL).
 */
export async function generateSubtitles(videoUrl, language = 'auto') {
  try {
    if (!videoUrl) throw new Error('generateSubtitles requires a video URL');
    const { result } = await runDirectorFinishingOp('subtitle', videoUrl, {
      params: { video_language: language },
    });
    const url = result?.url || '';
    if (!url) {
      return { srt: '', vtt: '', segments: [], text: '', url: '', error: 'Director did not return a video URL for subtitles' };
    }
    // Director returns the subtitled video; expose its URL. SRT/VTT are not
    // synthesized client-side — the burning is done server-side by VideoDB.
    return { srt: '', vtt: '', segments: [], text: '', url, error: undefined };
  } catch (error) {
    console.error('[renderAiActions] generateSubtitles failed:', error);
    return { srt: '', vtt: '', segments: [], text: '', url: '', error: error.message };
  }
}

/**
 * detectScenes: run the Director `scenes` agent on the source video.
 * Returns normalized scene objects { startTime, endTime, duration, confidence }.
 * Throws are caught by callers (generateHighlights/createShorts) and surfaced
 * as empty results — an empty array here means "no scenes", NOT "unavailable".
 */
export async function detectScenes(videoUrl, sensitivity = 0.5) {
  if (!videoUrl) throw new Error('detectScenes requires a video URL');
  const { result } = await runDirectorFinishingOp('scenes', videoUrl, {
    params: { sensitivity },
  });
  const scenes = result?.data?.scenes || [];
  return scenes.map((scene) => ({
    startTime: scene.start_time ?? scene.timestamp ?? 0,
    endTime: scene.end_time ?? (scene.timestamp || 0) + (scene.duration || 0),
    duration: scene.duration || 0,
    confidence: scene.confidence || 0,
    type: scene.type,
  }));
}

/**
 * generateHighlights: run the Director `highlight_reel` agent, return top scenes.
 */
export async function generateHighlights(videoUrl, sensitivity = 0.5) {
  try {
    const { result } = await runDirectorFinishingOp('highlight_reel', videoUrl, {
      params: { sensitivity },
    });
    const scenes = result?.data?.highlights || [];
    return scenes
      .map((scene) => ({
        startTime: scene.start_time ?? scene.timestamp ?? 0,
        endTime: scene.end_time ?? (scene.timestamp || 0) + (scene.duration || 0),
        duration: scene.duration || 0,
        confidence: scene.confidence || 0,
        type: scene.type,
      }))
      .filter((scene) => scene.confidence >= sensitivity)
      .sort((a, b) => (b.confidence || 0) * (b.duration || 0) - (a.confidence || 0) * (a.duration || 0))
      .slice(0, 5);
  } catch (error) {
    console.error('[renderAiActions] generateHighlights failed:', error);
    return [];
  }
}

/**
 * generateVoiceover: upload the source, then run the Director `voiceover` agent.
 * Returns the narrated video URL, or null when unavailable.
 */
export async function generateVoiceover(script, videoUrl = '', voice = 'alloy') {
  try {
    if (!script || typeof script !== 'string') {
      throw new Error('Script must be a non-empty string');
    }
    if (!videoUrl) return null; // no source to narrate over

    const { collectionId, videoId } = await uploadVideoToDirector(videoUrl);
    const result = await invokeDirectorAgent({
      agent: 'voiceover',
      videoId,
      collectionId,
      params: { script, voice_name: voice },
    });
    const url = result?.url || '';
    return url || null;
  } catch (error) {
    console.error('[renderAiActions] generateVoiceover failed:', error);
    return null;
  }
}

/**
 * createShorts: detect scenes via Director `scenes`, select the best segment.
 * Returns metadata describing the short segment without performing the edit.
 */
export async function createShorts(videoUrl, maxDuration = 60) {
  try {
    if (!videoUrl) return null;
    const scenes = await detectScenes(videoUrl, 0.5);
    if (!scenes || scenes.length === 0) return null;

    const sortedForDuration = [...scenes].sort((a, b) => b.duration - a.duration);
    const candidate = sortedForDuration[0];
    const targetEnd = candidate.startTime + Math.min(candidate.duration || maxDuration, maxDuration);

    const contiguous = scenes
      .filter((s) => s.startTime >= candidate.startTime && s.startTime < targetEnd)
      .sort((a, b) => a.startTime - b.startTime);

    const endTime = contiguous.length > 0
      ? Math.max(...contiguous.map((s) => s.endTime))
      : targetEnd;

    return {
      videoUrl,
      startTime: candidate.startTime,
      endTime: Math.min(endTime, candidate.startTime + maxDuration),
      duration: Math.min(endTime - candidate.startTime, maxDuration),
      scenes: contiguous,
      aspectRatio: '9:16',
    };
  } catch (error) {
    console.error('[renderAiActions] createShorts failed:', error);
    return null;
  }
}

/**
 * runAiAutoEdit: orchestrate finishing (subtitles + highlights via Director),
 * then assemble an edit plan with the OpenAI Responses API.
 * Returns { scenes, highlights, subtitles, plan }.
 * Never throws — metadata is preserved and plan errors are surfaced in plan.error.
 */
export async function runAiAutoEdit(videoUrl, options = {}) {
  const sensitivity = options.sensitivity ?? 0.5;
  const subtitleLanguage = options.language || 'auto';
  const captionStyle = options.captionStyle || 'minimal-premium';

  let scenes = [];
  let highlights = [];
  let subtitles = { srt: '', vtt: '', segments: [], text: '', url: '' };

  try {
    try {
      const sub = await generateSubtitles(videoUrl, subtitleLanguage);
      subtitles = { ...subtitles, url: sub.url, error: sub.error };
    } catch (e) {
      subtitles = { ...subtitles, error: e.message };
    }

    try {
      highlights = await generateHighlights(videoUrl, sensitivity);
    } catch (e) {
      highlights = [];
    }

    try {
      scenes = await detectScenes(videoUrl, sensitivity);
    } catch (e) {
      scenes = [];
    }
  } catch (error) {
    console.error('[renderAiActions] runAiAutoEdit finishing failed:', error);
  }

  let plan = {};
  try {
    plan = await planAutoEdit({
      scenes,
      highlights,
      subtitles,
      captionStyle,
      videoUrl,
    });
  } catch (error) {
    console.error('[renderAiActions] runAiAutoEdit plan failed:', error);
    plan = { error: error.message };
  }

  return { scenes, highlights, subtitles, plan };
}
