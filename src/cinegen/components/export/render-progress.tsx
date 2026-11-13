

import type { ExportJob } from '@cinegen/types/export';

interface RenderProgressProps {
  job: ExportJob;
  onCancel?: () => void;
}

export function RenderProgress({ job, onCancel }: RenderProgressProps) {
  return (
    <div className="render-progress">
      <div className="render-progress__header">
        <span className="render-progress__status">
          {job.status === 'queued' && 'Queued...'}
          {job.status === 'rendering' && 'Rendering...'}
          {job.status === 'complete' && 'Complete'}
          {job.status === 'failed' && 'Failed'}
        </span>
        {job.status === 'complete' && job.fileSize && (
          <span className="render-progress__size">
            {(job.fileSize / (1024 * 1024)).toFixed(1)} MB
          </span>
        )}
      </div>

      <div className="render-progress__bar-track">
        <div
          className={`render-progress__bar-fill${job.status === 'failed' ? ' render-progress__bar-fill--error' : ''}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      <div className="render-progress__footer">
        <span className="render-progress__percent">{Math.round(job.progress)}%</span>

        {(job.status === 'queued' || job.status === 'rendering') && onCancel && (
          <button className="render-progress__cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        )}

        {job.status === 'complete' && job.outputUrl && (
          <button
            className="render-progress__download-btn"
            onClick={() => window.electronAPI.shell.openPath(job.outputUrl!)}
          >
            Open Export
          </button>
        )}

        {job.status === 'failed' && job.error && (
          <span className="render-progress__error">{job.error}</span>
        )}
      </div>

      {/* [remix] OpenChatCut export QA (quality.ts assessExportQuality) on the rendered file */}
      {job.warnings?.map((w) => <p key={w} data-testid="export-warning" style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>{w}</p>)}
      {job.qaStatus && <p data-testid="export-qa-status" style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>{job.qaStatus}</p>}
      {job.qa && (
        <div data-testid="export-qa-report" style={{ marginTop: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: job.qa.ok ? '#34d399' : '#f87171' }}>
            {job.qa.issues.length === 0 ? 'Export check passed' : `Export check: ${job.qa.summary.errors} error${job.qa.summary.errors === 1 ? '' : 's'}, ${job.qa.summary.warnings} warning${job.qa.summary.warnings === 1 ? '' : 's'}`}
          </div>
          <div style={{ opacity: 0.7, marginTop: 2 }}>
            {job.qa.width}×{job.qa.height} · {job.qa.durationSeconds.toFixed(2)}s{job.qa.hasAudio ? ` · audio${job.qa.maxVolumeDb != null ? ` peak ${job.qa.maxVolumeDb.toFixed(1)} dBFS` : ''}` : ' · no audio'}
          </div>
          {job.qa.issues.map((i, k) => (
            <div key={k} style={{ marginTop: 4, color: i.severity === 'error' ? '#f87171' : '#f59e0b' }}>
              {i.severity === 'error' ? '✕' : '▲'} {i.message}{i.startSeconds != null ? ` (${i.startSeconds.toFixed(1)}s–${(i.endSeconds ?? i.startSeconds).toFixed(1)}s)` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
