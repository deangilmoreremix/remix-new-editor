import { directorClient } from '../directorClient.js';

/**
 * generateSubtitles: delegate to the Director `subtitle` agent (VideoDB).
 * Returns a real subtitled-video URL plus any raw transcript segments the
 * agent surfaces. Fails loudly (throws) if Director/VideoDB is unavailable —
 * there is no mock fallback.
 */
export async function generateSubtitles(videoUrl, language = 'auto') {
  try {
    const { videoId, result } = await directorClient.runDirectorFinishingOp('subtitle', videoUrl, {
      params: { video_language: language },
    });
    // Socket.IO result shape: { status, url, data: outputMessage }.
    const streamUrl = result?.url || result?.data?.stream_url || result?.data?.video?.stream_url;
    if (!streamUrl) {
      throw new Error('Director subtitle agent did not return a video URL');
    }
    const segments = result?.data?.segments || result?.segments || [];
    return {
      url: streamUrl,
      videoId,
      srt: '',
      vtt: '',
      segments,
      text: result?.data?.text || result?.text || '',
    };
  } catch (error) {
    console.error('[renderAiActions] generateSubtitles failed:', error);
    return { url: '', srt: '', vtt: '', segments: [], text: '', error: error.message };
  }
}

/**
 * generateHighlights: delegate to the Director `highlight_reel` agent (VideoDB).
 * Returns highlight segments. Fails loudly if Director is unavailable.
 */
export async function generateHighlights(videoUrl, sensitivity = 0.5) {
  try {
    const { result } = await directorClient.runDirectorFinishingOp('highlight_reel', videoUrl, {
      params: { sensitivity },
    });
    const scenes = normalizeDirectorScenes(result?.data || result);
    if (!scenes || scenes.length === 0) return [];
    const filtered = scenes.filter((scene) => (scene.confidence || 0) >= sensitivity);
    const sorted = filtered.sort((a, b) => {
      const scoreA = (a.confidence || 0) * (a.duration || 0);
      const scoreB = (b.confidence || 0) * (b.duration || 0);
      return scoreB - scoreA;
    });
    return sorted.slice(0, 5);
  } catch (error) {
    console.error('[renderAiActions] generateHighlights failed:', error);
    return [];
  }
}

/**
 * detectScenes: delegate to the Director `scenes` agent (VideoDB scene detection).
 * Returns raw scene objects. Fails loudly if Director is unavailable.
 */
export async function detectScenes(videoUrl, sensitivity = 0.5) {
  try {
    const { result } = await directorClient.runDirectorFinishingOp('scenes', videoUrl, {
      params: { sensitivity },
    });
    return normalizeDirectorScenes(result?.data || result);
  } catch (error) {
    console.error('[renderAiActions] detectScenes failed:', error);
    return [];
  }
}

/**
 * Normalize the various Director agent result shapes into a common scene list.
 */
function normalizeDirectorScenes(result) {
  // Accepts either the raw socket.io outputMessage (with .content) or a plain
  // result object with top-level scene/highlight arrays.
  const content = Array.isArray(result?.content) ? result.content : [];
  // Pull scene/highlight metadata out of VideoContent parts if present.
  const fromContent = content
    .filter((p) => p?.type === 'video' || p?.type === 'videos')
    .flatMap((p) => p.scenes || p.highlights || []);

  const raw =
    fromContent.length
      ? fromContent
      : result?.scenes ||
        result?.highlights ||
        result?.data?.scenes ||
        result?.data?.highlights ||
        result?.data?.video?.scenes ||
        [];
  return (raw || []).map((scene) => ({
    startTime: Number(scene.start_time ?? scene.startTime ?? scene.timestamp ?? 0),
    endTime: Number(
      scene.end_time ??
        scene.endTime ??
        (scene.timestamp != null ? scene.timestamp + (scene.duration || 0) : 0)
    ),
    duration: Number(scene.duration || (scene.end_time ?? scene.endTime ?? 0) - (scene.start_time ?? scene.startTime ?? 0) || 0),
    confidence: Number(scene.confidence ?? 0),
    type: scene.type || scene.scene_type,
  }));
}

/**
 * generateVoiceover: delegate to the Director `voiceover` agent (VideoDB TTS).
 * Uploads the source video to VideoDB, then overlays the generated voiceover.
 * Returns the narrated video URL, or null when Director/VideoDB is unavailable.
 */
export async function generateVoiceover(script, videoUrl = '', voice = 'alloy') {
  try {
    if (!script || typeof script !== 'string' || !script.trim()) {
      throw new Error('Script must be a non-empty string');
    }
    if (!videoUrl) {
      throw new Error('A source video URL is required for voiceover');
    }
    const { videoId, collectionId } = await directorClient.uploadVideoToDirector(videoUrl);
    const result = await directorClient.invokeDirectorAgent({
      agent: 'voiceover',
      videoId,
      collectionId,
      params: { script: script.trim(), voice_name: voice },
    });
    const url = result?.url || result?.data?.stream_url || result?.data?.video?.stream_url;
    if (!url) {
      throw new Error('Director voiceover agent did not return a video URL');
    }
    return url;
  } catch (error) {
    console.error('[renderAiActions] generateVoiceover failed:', error);
    return null;
  }
}

/**
 * createShorts: detect scenes, select best 60s segment for vertical short.
 * Returns metadata describing the short segment without performing edit.
 */
export async function createShorts(videoUrl, maxDuration = 60) {
  try {
    const scenes = await detectScenes(videoUrl, 0.5);
    if (!scenes || scenes.length === 0) {
      return null;
    }

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
 * runAiAutoEdit: orchestrate the finishing pipeline via Director (VideoDB),
 * then assemble an edit plan with the OpenAI Responses API.
 *
 *  - Subtitles + highlights/scenes come from Director agents (real media work).
 *  - The OpenAI Responses API (Structured Outputs) turns that metadata into a
 *    validated edit plan. It performs NO video operation.
 *
 * Returns { scenes, highlights, subtitles, plan }.
 */
export async function runAiAutoEdit(videoUrl, options = {}) {
  try {
    const sensitivity = options.sensitivity ?? 0.5;
    const subtitleLanguage = options.language || 'auto';
    const captionStyle = options.captionStyle || 'minimal-premium';

    const [scenes, subtitles, highlights] = await Promise.all([
      detectScenes(videoUrl, sensitivity),
      generateSubtitles(videoUrl, subtitleLanguage),
      generateHighlights(videoUrl, sensitivity),
    ]);

    let plan = null;
    try {
      const { planAutoEdit } = await import('../openaiResponses.js');
      plan = await planAutoEdit({
        scenes,
        highlights,
        subtitles,
        captionStyle,
      });
    } catch (planErr) {
      console.error('[renderAiActions] AI Auto-Edit plan step failed:', planErr);
      // Plan is an enhancement layer; surface the failure but keep the metadata.
      plan = { error: planErr.message };
    }

    return { scenes, highlights, subtitles, plan };
  } catch (error) {
    console.error('[renderAiActions] runAiAutoEdit failed:', error);
    return {
      scenes: [],
      highlights: [],
      subtitles: { url: '', srt: '', vtt: '', segments: [], text: '' },
      plan: { error: error.message },
    };
  }
}
