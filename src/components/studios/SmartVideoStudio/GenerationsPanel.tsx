/**
 * SmartVideo Studio — GenerationsPanel
 *
 * Displays generation history with retry, delete, and use-as-input actions.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { type GenerationJob, deleteJob as deleteGenerationJob } from './svStudio/generationGateway';
import { detectOutputType } from './svStudio/outputRenderer';

interface GenerationsPanelProps {
  jobs: GenerationJob[];
  loading?: boolean;
  onRetry?: (job: GenerationJob) => void;
  onDelete?: (jobId: string) => void;
  onUseAsInput?: (job: GenerationJob) => void;
}

type FilterType = 'all' | 'images' | 'video' | 'audio' | 'avatar' | '3d';

/** Put a finished picture or video on a landing page (opens the picker and editor with it loaded). */
async function openLanding(item: { url: string; type: string; prompt: string }) {
  // @ts-expect-error plain JS module
  const m = (await import('../../studio/landingPageAction.js')) as { openLandingPageFor: (i: unknown) => Promise<boolean> }
  await m.openLandingPageFor({ ...item, studio: 'smartvideo' })
}

export default function GenerationsPanel({ jobs, loading, onRetry, onDelete, onUseAsInput }: GenerationsPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredJobs = useMemo(() => {
    let result = jobs;

    // Filter by type
    if (filter !== 'all') {
      result = result.filter(j => {
        const type = j.outputType || detectOutputType(j.output, j.modelId);
        if (filter === 'images') return type === 'image';
        if (filter === 'video') return type === 'video';
        if (filter === 'audio') return type === 'audio';
        if (filter === 'avatar') return j.modelId.toLowerCase().includes('avatar') || j.modelId.toLowerCase().includes('lip');
        if (filter === '3d') return detectOutputType(j.output, j.modelId) === '3d';
        return true;
      });
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.modelName.toLowerCase().includes(q) ||
        (j.input.prompt && String(j.input.prompt).toLowerCase().includes(q))
      );
    }

    return result;
  }, [jobs, filter, searchQuery]);

  const handleDelete = useCallback((jobId: string) => {
    if (window.confirm('Are you sure you want to delete this generation?')) {
      deleteGenerationJob(jobId);
      onDelete?.(jobId);
    }
  }, [onDelete]);

  const handleRetry = useCallback((job: GenerationJob) => {
    onRetry?.(job);
  }, [onRetry]);

  const handleUseAsInput = useCallback((job: GenerationJob) => {
    onUseAsInput?.(job);
  }, [onUseAsInput]);

  if (loading) {
    return (
      <div className="generations-panel-loading">
        <div className="smart-skeleton" />
        <div className="smart-skeleton" />
        <div className="smart-skeleton" />
      </div>
    );
  }

  return (
    <div className="generations-panel">
      {/* Filters */}
      <div className="generations-panel-filters">
        <div className="generations-filter-tabs">
          {(['all', 'images', 'video', 'audio', 'avatar', '3d'] as FilterType[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`generations-filter-tab ${filter === f ? 'is-active' : ''}`}
            >
              {f === 'all' ? 'All' : f === 'images' ? 'Images' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search generations..."
          className="generations-search"
        />
      </div>

      {/* Jobs List */}
      <div className="generations-list">
        {filteredJobs.length === 0 ? (
          <div className="generations-empty">
            <p>No generations yet. Start by entering a prompt and clicking Generate.</p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const outputType = job.output ? detectOutputType(job.output, job.modelId) : 'unknown';
            const shownType = outputType === 'unknown' && job.output ? (job.outputType || 'unknown') : outputType;
            const statusClass = job.status === 'completed' ? 'is-completed' :
                               job.status === 'failed' ? 'is-failed' : 'is-processing';

            return (
              <div key={job.id} className={`generation-card ${statusClass}`}>
                {/* Generation Preview */}
                <div className="generation-card-preview">
                  {shownType === 'image' && job.output && (
                    <img src={String(job.output)} alt="Generated" />
                  )}
                  {shownType === 'video' && job.output && (
                    <video src={String(job.output)} controls />
                  )}
                  {shownType === 'audio' && job.output && (
                    <audio src={String(job.output)} controls />
                  )}
                  {shownType === 'unknown' && (
                    <div className="generation-card-placeholder">
                      {job.output ? (
                        <a href={String(job.output)} target="_blank" rel="noreferrer">Open output</a>
                      ) : (
                        <span>{job.status === 'failed' ? 'Failed' : job.status === 'completed' ? 'No output' : 'Generating...'}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Generation Info */}
                <div className="generation-card-info">
                  <div className="generation-card-header">
                    <span className="generation-card-model">{job.modelName}</span>
                    <span className={`generation-card-status ${statusClass}`}>{job.status}</span>
                  </div>
                  {job.status === 'failed' && job.error && (
                    <p className="generation-card-error" role="alert">{job.error}</p>
                  )}
                  {job.input.prompt && (
                    <p className="generation-card-prompt">{String(job.input.prompt)}</p>
                  )}
                  <div className="generation-card-meta">
                    <span>{new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="generation-card-actions">
                  {job.status === 'completed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRetry(job)}
                        className="generation-action-btn"
                        title="Retry"
                      >
                        🔄
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseAsInput(job)}
                        className="generation-action-btn"
                        title="Use as input"
                      >
                        ↗️
                      </button>
                      {(outputType === 'image' || outputType === 'video') && typeof job.output === 'string' && /^https:\/\//i.test(job.output) && (
                        <button
                          type="button"
                          data-action="create-landing-page"
                          onClick={() => { void openLanding({ url: String(job.output), type: /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(job.output)) ? 'video' : outputType, prompt: String(job.input.prompt || '') }) }}
                          className="generation-action-btn"
                          title="Create landing page"
                          aria-label="Create landing page"
                        >
                          ▤
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(job.id)}
                    className="generation-action-btn generation-action-delete"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
