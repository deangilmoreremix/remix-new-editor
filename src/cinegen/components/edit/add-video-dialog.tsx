// [remix] "Add video": one place to bring a customer's video into the project by upload, drag and drop, or link.
import { useEffect, useRef, useState } from 'react';
import type { Asset } from '@cinegen/types/project';
import { filesToUrls, fetchVideoUrl } from '@cinegen/adapters/web-media';
import { createPortal } from 'react-dom';

interface AddVideoDialogProps {
  onFiles: (files: File[]) => Promise<void>;
  onUrl: (url: string) => Promise<string | void>;
  onClose: () => void;
}

export function AddVideoDialog({ onFiles, onUrl, onClose }: AddVideoDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const run = async (job: () => Promise<string | void>, ok: string) => {
    setBusy(true); setMessage(null);
    try { const note = await job(); setMessage({ kind: 'ok', text: note || ok }); }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) }); }
    finally { setBusy(false); }
  };
  const takeFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => /^(video|audio|image)\//.test(f.type));
    if (files.length === 0) { setMessage({ kind: 'error', text: 'Choose a video, audio or image file.' }); return; }
    void run(() => onFiles(files).then(() => undefined), `${files.length} file${files.length === 1 ? '' : 's'} added to the media pool.`);
  };

  return createPortal(
    <div className="element-modal__backdrop" onClick={onClose}>
      <div className="element-modal add-video-dialog" role="dialog" aria-label="Add video" onClick={(e) => e.stopPropagation()}>
        <div className="element-modal__header">
          <h3 className="element-modal__title">Add video</h3>
          <button className="element-modal__close" onClick={onClose} type="button" aria-label="Close">×</button>
        </div>
        <div className="element-modal__body">
          <div className="element-modal__field">
            <label className="element-modal__label">Upload or drag and drop</label>
            <div
              className={`element-upload ${dragging ? 'element-upload--dragging' : ''}`}
              role="button" tabIndex={0} aria-busy={busy}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); takeFiles(e.dataTransfer.files); }}
              onClick={() => !busy && inputRef.current?.click()}
              onKeyDown={(e) => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
            >
              <input ref={inputRef} type="file" accept="video/*,audio/*,image/*" multiple className="element-upload__input" data-testid="add-video-file"
                onChange={(e) => { takeFiles(e.target.files); e.target.value = ''; }} />
              <span className="element-upload__text">Drop videos here or click to browse</span>
              <span className="element-upload__hint">MP4, MOV, WebM · audio and pictures too</span>
            </div>
          </div>
          <div className="element-modal__field">
            <label className="element-modal__label">Or paste a link to the video file</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="element-modal__input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/customer-video.mp4" data-testid="add-video-url"
                onKeyDown={(e) => { if (e.key === 'Enter' && url.trim() && !busy) void run(() => onUrl(url.trim()), 'Video added to the media pool.'); }} />
              <button type="button" className="element-modal__save-btn" disabled={!url.trim() || busy}
                onClick={() => void run(() => onUrl(url.trim()), 'Video added to the media pool.')}>{busy ? 'Adding…' : 'Add link'}</button>
            </div>
          </div>
          {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'director-tab__warn' : 'director-tab__meta'}>{message.text}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Toolbar button + dialog for the media pool. */
export function AddVideoControl({ handleImport }: { handleImport: (paths?: string[]) => Promise<Asset[]> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="mp__tool-btn" onClick={() => setOpen(true)} title="Add video (upload, drag and drop, or link)">
        <span style={{ fontSize: 11 }}>Add video</span>
      </button>
      {open && (
        <AddVideoDialog
          onClose={() => setOpen(false)}
          onFiles={async (files) => { await handleImport(await filesToUrls(files)); }}
          onUrl={async (link) => {
            const r = await fetchVideoUrl(link);
            await handleImport(r.file ? await filesToUrls([r.file]) : [r.linkedUrl!]);
            return r.note;
          }}
        />
      )}
    </>
  );
}

/** Desktop files dropped on the timeline are imported by the media pool (it owns import), then placed by the timeline. */
export function useDesktopImport(handleImport: (paths?: string[]) => Promise<Asset[]>) {
  useEffect(() => {
    const onImportFiles = (event: Event) => {
      const { files, resolve } = (event as CustomEvent<{ files: File[]; resolve: (assets: Asset[]) => void }>).detail;
      void filesToUrls(files).then((urls) => handleImport(urls)).then(resolve, () => resolve([]));
    };
    window.addEventListener('remix:import-files', onImportFiles);
    return () => window.removeEventListener('remix:import-files', onImportFiles);
  }, [handleImport]);
}
