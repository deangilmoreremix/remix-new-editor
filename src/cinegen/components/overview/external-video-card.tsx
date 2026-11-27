// [remix] "Add a video from elsewhere": upload a file or paste an https link, name the sections by time, and it is published with
// Retarget already on. The new video then shows in the overview below like any other.
import { useState } from 'react';
import { getClient } from '@cinegen/components/leads/use-publish';
import { MAX_SECONDS, MAX_UPLOAD_BYTES, parseSections, publishExternalVideo, validateVideoUrl } from '@cinegen/lib/leads/external-video';
// @ts-expect-error plain JS
import { uploadFileToStorage } from '../../../lib/hybrid-supabase.js';
// @ts-expect-error plain JS
import { friendlyPublishError } from '../../../lib/editor/publish/guestMessages.js';
// @ts-expect-error plain JS
import { watchUrl } from '../../../lib/editor/publish/publishClient.js';

/** How long a video is, read from its metadata in the browser. */
function readDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(v.duration);
    v.onerror = () => reject(new Error('Could not read this video. Use an mp4 or webm file, or a direct link to one.'));
    v.src = src;
  });
}

export function ExternalVideoCard({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sectionText, setSectionText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async () => {
    setError(''); setDone('');
    if (file && file.size > MAX_UPLOAD_BYTES) { setError(`That file is over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Use a smaller file or paste a link.`); return; }
    if (!file) { const bad = validateVideoUrl(url); if (bad) { setError(bad); return; } }
    setBusy(true);
    try {
      let src = url.trim(); let duration: number;
      if (file) {
        const local = URL.createObjectURL(file);
        try { duration = await readDuration(local); } finally { URL.revokeObjectURL(local); }
      } else duration = await readDuration(src);
      if (!Number.isFinite(duration) || duration < 1 || duration > MAX_SECONDS) throw new Error(`The video must be between 1 second and ${MAX_SECONDS / 60} minutes long.`);
      const parsed = parseSections(sectionText, duration);
      if (parsed.error) throw new Error(parsed.error);
      if (file) src = await uploadFileToStorage(file);
      const id = await publishExternalVideo(await getClient(), { src, title: title || file?.name.replace(/\.[^.]+$/, '') || 'Untitled video', duration, sections: parsed.sections });
      setDone(watchUrl(id));
      setTitle(''); setUrl(''); setFile(null); setSectionText('');
      onAdded?.();
    } catch (e) { setError(friendlyPublishError(e) || (e as Error).message); }
    finally { setBusy(false); }
  };

  if (!open) return <div className="cg-analytics__empty" style={{ textAlign: 'left' }}><button type="button" className="cg-analytics__btn" onClick={() => setOpen(true)}>Add a video from elsewhere</button></div>;
  return (
    <section className="cg-analytics__empty" data-testid="external-video" style={{ textAlign: 'left' }}>
      <h3>Add a video from elsewhere</h3>
      <p>Upload a file (up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB) or paste a link to a video file. It is published with Retarget turned on.</p>
      <label>Title <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-label="Title" /></label>
      <label>Video file <input type="file" accept="video/mp4,video/webm" aria-label="Video file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {!file && <label>or link <input value={url} placeholder="https://example.com/video.mp4" onChange={(e) => setUrl(e.target.value)} aria-label="Video link" /></label>}
      <label>Sections, one per line (optional)
        <textarea rows={4} value={sectionText} placeholder={'0:00 Intro\n0:45 Pricing\n1:30 Book a call'} onChange={(e) => setSectionText(e.target.value)} aria-label="Sections" />
      </label>
      <p className="leads-note">Sections let you tie parts of the video to products or services for Retarget. Without them Retarget has nothing to map.</p>
      {error && <p role="alert">{error}</p>}
      {done && <p role="status">Published with Retarget on: <a href={done} target="_blank" rel="noreferrer">{done}</a></p>}
      <button type="button" className="cg-analytics__btn" disabled={busy || (!file && !url.trim())} onClick={() => void submit()}>{busy ? 'Working…' : 'Publish with Retarget'}</button>
      <button type="button" className="cg-analytics__btn" onClick={() => setOpen(false)}>Close</button>
    </section>
  );
}
