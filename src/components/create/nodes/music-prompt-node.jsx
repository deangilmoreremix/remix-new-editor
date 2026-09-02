/**
 * Ported from CineGen: src/components/create/nodes/music-prompt-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/music-prompt-node.tsx
 *
 * Real per-node UI for music prompt nodes: style/genre/mood/tempo fields,
 * video connection indicator, and a generate button.
 *
 * EXECUTION / OVERLAP WITH PHASE 5:
 * CineGen's version calls `window.electronAPI.music.generatePrompt`, an
 * Electron-only IPC method that composes a music prompt from the fields
 * and optionally analyzes connected video frames. That API does not exist
 * in the browser.
 *
 * This port replaces that call with a local `composeMusicPrompt()` helper
 * that builds the prompt string from the same fields. The resulting
 * `generatedPrompt` is directly consumable by the existing Phase 5
 * `generateMusic()` in `src/lib/ai/muapiService.js`, which accepts a
 * `prompt` parameter along with `style`, `title`, `model`, etc.
 *
 * Reuse point: instead of building a parallel music-generation path,
 * this node's output feeds straight into `generateMusic()` from
 * `muapiService.js`. If you want the node to trigger generation directly,
 * call `generateMusic({ prompt: generatedPrompt, style, ... })` from
 * `src/lib/ai/muapiService.js`.
 *
 * FRAME EXTRACTION: CineGen extracts frames from a connected video via
 * canvas and uploads them through Electron IPC. In-browser frame
 * extraction is possible, but uploading to fal storage requires a
 * backend endpoint. That path is deferred here; the video connection
 * indicator remains, but frames are not uploaded.
 */

import { memo, useCallback, useState, useRef } from 'react';
import { useReactFlow, useEdges } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';
import { muapi } from '../../lib/muapi.js';

function composeMusicPrompt({ style, genre, mood, tempo, notes }) {
  const parts = [];
  if (style) parts.push(`Style: ${style}`);
  if (genre) parts.push(`Genre: ${genre}`);
  if (mood) parts.push(`Mood: ${mood}`);
  if (tempo) parts.push(`Tempo: ${tempo}`);
  if (notes) parts.push(`Notes: ${notes}`);
  return parts.join('\n');
}

export function MusicPromptNode({ id, data, selected }) {
  const { updateNodeData, getNode } = useReactFlow();
  const edges = useEdges();
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef(null);

  const style = String(data.config?.style ?? '');
  const genre = String(data.config?.genre ?? '');
  const mood = String(data.config?.mood ?? '');
  const tempo = String(data.config?.tempo ?? '');
  const notes = String(data.config?.additionalNotes ?? '');
  const generatedPrompt = String(data.config?.generatedPrompt ?? '');
  const musicUrl = String(data.config?.musicUrl ?? '');
  const musicStatus = String(data.config?.musicStatus ?? '');

  const updateConfig = useCallback(
    (partial) => {
      updateNodeData(id, { config: { ...data.config, ...partial } });
    },
    [id, data.config, updateNodeData],
  );

  /** Get the upstream video URL if connected. */
  const getVideoUrl = useCallback(() => {
    const videoEdge = edges.find(
      (e) => e.target === id && e.targetHandle === 'video',
    );
    if (!videoEdge) return undefined;
    const sourceNode = getNode(videoEdge.source);
    return sourceNode?.data?.result?.url;
  }, [edges, id, getNode]);

  const videoUrl = getVideoUrl();
  const hasVideo = !!videoUrl;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    abortRef.current = new AbortController();

    try {
      const prompt = composeMusicPrompt({ style, genre, mood, tempo, notes });
      updateConfig({ generatedPrompt: prompt, usedVideo: false });

      // Actually generate music via muapi so the node is functionally useful.
      const result = await muapi.generateMusic({
        prompt,
        style,
        title: 'Generated Music',
        model: 'suno-create-music',
      });

      const musicUrl = result?.url;
      if (musicUrl) {
        updateConfig({ musicUrl, musicStatus: 'complete' });
      }
    } catch (error) {
      updateConfig({ generatedPrompt: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, usedVideo: false });
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [style, genre, mood, tempo, notes, updateConfig]);

  return (
    <BaseNodeWrapper nodeType="musicPrompt" selected={!!selected}>
      <div className="music-prompt-node__fields">
        <div className="music-prompt-node__row">
          <input
            type="text"
            className="music-prompt-node__input nodrag"
            placeholder="Genre (e.g., cinematic, electronic)"
            value={genre}
            onChange={(e) => updateConfig({ genre: e.target.value })}
          />
          <input
            type="text"
            className="music-prompt-node__input nodrag"
            placeholder="Mood (e.g., tense, uplifting)"
            value={mood}
            onChange={(e) => updateConfig({ mood: e.target.value })}
          />
        </div>
        <div className="music-prompt-node__row">
          <input
            type="text"
            className="music-prompt-node__input nodrag"
            placeholder="Style (e.g., orchestral, lo-fi)"
            value={style}
            onChange={(e) => updateConfig({ style: e.target.value })}
          />
          <input
            type="text"
            className="music-prompt-node__input nodrag"
            placeholder="Tempo (e.g., slow, 120bpm)"
            value={tempo}
            onChange={(e) => updateConfig({ tempo: e.target.value })}
          />
        </div>
        <textarea
          className="music-prompt-node__textarea nodrag nowheel"
          rows={2}
          placeholder="Additional notes..."
          value={notes}
          onChange={(e) => updateConfig({ additionalNotes: e.target.value })}
        />
      </div>

      <div className="music-prompt-node__status">
        <span className={`music-prompt-node__indicator${hasVideo ? ' music-prompt-node__indicator--active' : ''}`} />
        {hasVideo ? 'Video connected' : 'No video — text only'}
      </div>

      {generatedPrompt && (
        <>
          <textarea
            className="music-prompt-node__result nodrag nowheel"
            rows={4}
            value={generatedPrompt}
            onChange={(e) => updateConfig({ generatedPrompt: e.target.value })}
          />
        </>
      )}

      {musicUrl && (
        <div className="audio-player nodrag nowheel" style={{ marginTop: 8 }}>
          <audio
            src={musicUrl}
            controls
            style={{ width: '100%', height: 32 }}
          />
        </div>
      )}

      <button
        type="button"
        className="music-prompt-node__generate-btn nodrag"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? 'Generating...' : 'Generate Music Prompt'}
      </button>
    </BaseNodeWrapper>
  );
}

export default memo(MusicPromptNode);
