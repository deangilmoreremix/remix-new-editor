// [remix] Published videos that Retarget cannot see yet (published before it existed, or from another editor), each with
// a "Turn on Retarget" button. Turning it on builds the video's project row, after which it shows in the overview below.
import { useCallback, useEffect, useState } from 'react';
import { getClient } from '@cinegen/components/leads/use-publish';
import { enableRetargetForVideo, listUnlinkedVideos } from '@cinegen/lib/leads/project-link';

type V = { id: string; title: string; published: boolean };

export function UnlinkedVideos({ onEnabled }: { onEnabled?: () => void }) {
  const [videos, setVideos] = useState<V[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const me = (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id;
    if (!me) { setVideos([]); return; }
    try { setVideos(await listUnlinkedVideos(await getClient(), me)); } catch { setVideos([]); /* the list is a convenience: the overview below still works */ }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const enable = async (id: string) => {
    setBusy(id); setError('');
    try { await enableRetargetForVideo(await getClient(), id); setVideos((vs) => vs.filter((v) => v.id !== id)); onEnabled?.(); }
    catch (e) { setError((e as Error).message || 'Could not turn on Retarget'); }
    finally { setBusy(''); }
  };
  if (!videos.length) return null;
  return (
    <section className="cg-analytics__empty" data-testid="unlinked-videos" style={{ textAlign: 'left' }}>
      <h3>Videos without Retarget</h3>
      <p>These published videos are not connected to Analytics and Retarget yet. Turn it on and viewer activity shows up here.</p>
      {error && <p role="alert">{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {videos.map((v) => (
          <li key={v.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span>{v.title}{v.published ? '' : ' (unpublished)'}</span>
            <button type="button" className="cg-analytics__btn" disabled={busy === v.id} onClick={() => void enable(v.id)}>{busy === v.id ? 'Working…' : 'Turn on Retarget'}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
