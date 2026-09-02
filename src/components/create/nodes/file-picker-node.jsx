/**
 * Ported from CineGen: src/components/create/nodes/file-picker-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/file-picker-node.tsx
 *
 * Real per-node UI for file picker nodes: drag-and-drop zone, file input,
 * preview with type-specific iconography, and clear action.
 *
 * INTENTIONAL SUBSTITUTION: CineGen's version uses
 * `window.electronAPI.dialog.showOpen` for native desktop file picking.
 * That API does not exist in the browser. This port removes the Electron
 * path entirely and uses a browser-native <input type="file"> plus
 * drag-and-drop, matching the pattern already used elsewhere in this
 * codebase (TimelineEditorPage, EditStudio, etc.).
 */

import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';
import { detectMediaType, resolveMediaFileUrl } from '../../lib/utils/media-file.js';

const ACCEPT = 'image/*,video/*,audio/*';

export function FilePickerNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fileUrl = String(data.config?.fileUrl ?? '');
  const fileType = String(data.config?.fileType ?? '');
  const fileName = String(data.config?.fileName ?? '');
  const configThumb = String(data.config?.thumbnailUrl ?? '');

  // For videos, extract a thumbnail frame from the video itself
  const [videoThumb, setVideoThumb] = useState('');
  useEffect(() => {
    if (fileType !== 'video' || !fileUrl || configThumb) {
      setVideoThumb('');
      return;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = fileUrl;
    const timeout = setTimeout(() => { video.src = ''; }, 10000);
    video.addEventListener('loadeddata', () => {
      video.currentTime = 0.1;
    }, { once: true });
    video.addEventListener('seeked', () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          setVideoThumb(canvas.toDataURL('image/jpeg', 0.8));
        }
      } catch {
        // tainted canvas
      }
    }, { once: true });
    video.addEventListener('error', () => clearTimeout(timeout), { once: true });
    video.load();
    return () => { clearTimeout(timeout); video.src = ''; };
  }, [fileUrl, fileType, configThumb]);

  const thumbSrc = configThumb || videoThumb;

  const uploadFile = useCallback(
    async (file) => {
      const mediaType = detectMediaType(file);
      if (!mediaType) {
        setError('Unsupported file type');
        return;
      }

      setUploading(true);
      setError('');

      try {
        const url = resolveMediaFileUrl(file);
        updateNodeData(id, {
          config: { ...data.config, fileUrl: url, fileType: mediaType, fileName: file.name },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [id, data.config, updateNodeData],
  );

  const handleFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) return;
      uploadFile(files[0]);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleClear = useCallback(() => {
    updateNodeData(id, {
      config: { ...data.config, fileUrl: '', fileType: '', fileName: '' },
    });
    setError('');
  }, [id, data.config, updateNodeData]);

  return (
    <BaseNodeWrapper nodeType="filePicker" selected={!!selected}>
      <div className="file-picker-node__body">
        {fileUrl ? (
          <div className="file-picker-node__preview">
            {fileType === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt={fileName} className="file-picker-node__preview-img" />
            )}
            {fileType === 'video' && thumbSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbSrc} alt={fileName} className="file-picker-node__preview-img" />
            )}
            {fileType === 'video' && !thumbSrc && (
              <div className="file-picker-node__video-placeholder">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            )}
            {fileType === 'audio' && (
              <div className="file-picker-node__audio-preview">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
            <div className="file-picker-node__preview-bar">
              <div className="file-picker-node__file-info">
                <span className="file-picker-node__file-name">{fileName}</span>
                <span className="file-picker-node__file-type">{fileType}</span>
              </div>
              <button
                type="button"
                className="file-picker-node__clear nodrag"
                onClick={handleClear}
                title="Remove file"
              >
                &times;
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`file-picker-node__dropzone nodrag${isDragging ? ' file-picker-node__dropzone--dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="file-picker-node__input"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <>
                <div className="file-picker-node__spinner" />
                <span className="file-picker-node__label">Uploading...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="file-picker-node__label">Drop file or click</span>
              </>
            )}
          </div>
        )}
        {error && <div className="file-picker-node__error">{error}</div>}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(FilePickerNode);
