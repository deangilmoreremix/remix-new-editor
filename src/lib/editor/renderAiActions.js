import {
  uploadVideoToDirector,
  executeDirectAgent,
  runDirectorFinishingOp,
  normalizeDirectorResult,
} from '../directorClient.js';

/**
 * Render Studio finishing ops delegate to the Director (VideoDB) backend.
 *
 * Every function returns a normalized result shape:
 *   { status, agent, sessionId, conversationId, collectionId, videoId,
 *     videoUrl, scenes, highlights, subtitles, data, error }
 *
 * There is no silent/mock fallback. Failures surface as loud errors or
 * result.error = null with status = 'error'.
 */

/**
 * generateSubtitles: run the Director `subtitle` agent on the source video.
 * Returns normalized result with videoUrl set to the subtitled stream.
 */
export async function generateSubtitles(videoUrl, language = 'auto') {
  if (!videoUrl) {
    return normalizeDirectorResult(
      { status: 'error', error: 'generateSubtitles requires a video URL' },
      'subtitle'
    );
  }

  try {
    const { result } = await runDirectorFinishingOp('subtitle', videoUrl, {
      params: { video_language: language },
    });
    return result;
  } catch (error) {
    return normalizeDirectorResult(
      { status: 'error', error: error.message },
      'subtitle'
    );
  }
}

/**
 * detectScenes: run the Director `scenes` agent on the source video.
 * Returns normalized result with scenes array populated.
 */
export async function detectScenes(videoUrl, sensitivity = 0.5) {
  if (!videoUrl) {
    return normalizeDirectorResult(
      { status: 'error', error: 'detectScenes requires a video URL' },
      'scenes'
    );
  }

  try {
    const { result } = await runDirectorFinishingOp('scenes', videoUrl, {
      params: { sensitivity },
    });
    return result;
  } catch (error) {
    return normalizeDirectorResult(
      { status: 'error', error: error.message },
      'scenes'
    );
  }
}

/**
 * generateHighlights: run the Director `highlight_reel` agent.
 * Returns normalized result with highlights array and videoUrl populated.
 */
export async function generateHighlights(videoUrl, sensitivity = 0.5) {
  if (!videoUrl) {
    return normalizeDirectorResult(
      { status: 'error', error: 'generateHighlights requires a video URL' },
      'highlight_reel'
    );
  }

  try {
    const { result } = await runDirectorFinishingOp('highlight_reel', videoUrl, {
      params: { sensitivity },
    });
    return result;
  } catch (error) {
    return normalizeDirectorResult(
      { status: 'error', error: error.message },
      'highlight_reel'
    );
  }
}

/**
 * generateVoiceover: upload the source, then run the Director `voiceover` agent.
 * Returns normalized result with videoUrl set to the narrated video.
 */
export async function generateVoiceover(script, videoUrl = '', voice = 'alloy') {
  if (!script || typeof script !== 'string') {
    return normalizeDirectorResult(
      { status: 'error', error: 'Script must be a non-empty string' },
      'voiceover'
    );
  }
  if (!videoUrl) {
    return normalizeDirectorResult(
      { status: 'error', error: 'generateVoiceover requires a video URL' },
      'voiceover'
    );
  }

  try {
    const { collectionId, videoId } = await uploadVideoToDirector(videoUrl);
    const result = await executeDirectAgent({
      agent: 'voiceover',
      videoId,
      collectionId,
      params: { script, voice_name: voice },
    });
    return result;
  } catch (error) {
    return normalizeDirectorResult(
      { status: 'error', error: error.message },
      'voiceover'
    );
  }
}

/**
 * createShorts: detect scenes via Director `scenes`, select the best segment.
 * Returns metadata describing the short segment without performing the edit.
 * For this phase, scenes metadata is sufficient; actual short rendering is later.
 */
export async function createShorts(videoUrl, maxDuration = 60) {
  if (!videoUrl) {
    return normalizeDirectorResult(
      { status: 'error', error: 'createShorts requires a video URL' },
      'scenes'
    );
  }

  try {
    const scenesResult = await detectScenes(videoUrl, 0.5);
    const scenes = scenesResult.scenes || [];
    if (!scenes.length) {
      return normalizeDirectorResult(
        { status: 'error', error: 'No scenes detected for short creation' },
        'scenes'
      );
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

    return normalizeDirectorResult(
      {
        status: 'success',
        data: {
          videoUrl,
          startTime: candidate.startTime,
          endTime: Math.min(endTime, candidate.startTime + maxDuration),
          duration: Math.min(endTime - candidate.startTime, maxDuration),
          scenes: contiguous,
          aspectRatio: '9:16',
        },
      },
      'scenes'
    );
  } catch (error) {
    return normalizeDirectorResult(
      { status: 'error', error: error.message },
      'scenes'
    );
  }
}

/**
 * runAiAutoEdit: orchestrate finishing (subtitles + highlights via Director),
 * then assemble an edit plan with the OpenAI Responses API.
 * Returns normalized results for each stage.
 */
export async function runAiAutoEdit(videoUrl, options = {}) {
  const sensitivity = options.sensitivity ?? 0.5;
  const subtitleLanguage = options.language || 'auto';

  const subtitles = await generateSubtitles(videoUrl, subtitleLanguage);
  const highlights = await generateHighlights(videoUrl, sensitivity);
  const scenesResult = await detectScenes(videoUrl, sensitivity);

  let plan;
  try {
    const { planAutoEdit } = await import('../openaiResponses.js');
    plan = await planAutoEdit({
      scenes: scenesResult.scenes || [],
      highlights: highlights.highlights || [],
      subtitles,
      captionStyle: options.captionStyle || 'minimal-premium',
      videoUrl,
    });
  } catch (error) {
    console.error('[renderAiActions] runAiAutoEdit plan failed:', error);
    plan = { error: error.message };
  }

  return {
    scenes: scenesResult,
    highlights,
    subtitles,
    plan,
  };
}
