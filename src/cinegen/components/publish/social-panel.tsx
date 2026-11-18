// [remix] Publish > Social: pick a video (your exports, your media, or a template video) and publish it to YouTube, TikTok, Instagram and the
// other networks the existing Social Publish window supports. This panel only chooses the video and gets it a public link; the 5-step window
// (thumbnail, caption, platform, preview) and the connection to the networks are the existing ones, opened with openSocialPublish.
import { useMemo, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { aspectOf, exportVideos, filterVideos, mediaVideos, resolvePublicUrl, SOCIAL_SOURCE_LABEL, sourceCounts, templateVideoList, type SocialSourceId, type SocialVideo } from '@cinegen/lib/publish/social-media';
// @ts-expect-error plain JS data module
import { templateVideos } from '../../../data/templateVideoLibrary.js';
// @ts-expect-error plain JS
import { uploadFileToStorage } from '../../../lib/hybrid-supabase.js';
// @ts-expect-error plain JS
import { openSocialPublish } from '../../../lib/socialPublishHelpers.js';
import { ChipRow, FilterField, PanelHead, PictureCard } from './publish-ui';

const INITIAL = 12;
const STEP = 24;
const FIRST_SOURCE = (n: Record<SocialSourceId, number>): SocialSourceId => (n.exports ? 'exports' : n.media ? 'media' : 'templates');

export function SocialPanel() {
  const { state } = useWorkspace();
  const [source, setSource] = useState<SocialSourceId | null>(null);
  const [q, setQ] = useState('');
  const [aspect, setAspect] = useState('all');
  const [shown, setShown] = useState(INITIAL);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const all = useMemo(() => [...exportVideos(state.exports ?? []), ...mediaVideos(state.assets), ...templateVideoList(templateVideos as never[])], [state.exports, state.assets]);
  const counts = useMemo(() => sourceCounts(all, q, aspect), [all, q, aspect]);
  const active: SocialSourceId = source ?? FIRST_SOURCE(sourceCounts(all, '', 'all'));
  const list = useMemo(() => filterVideos(all, active, q, aspect), [all, active, q, aspect]);

  const publish = async (v: SocialVideo) => {
    setError(''); setBusyId(v.id);
    try {
      const url = await resolvePublicUrl(v, (f) => uploadFileToStorage(f) as Promise<string>);
      openSocialPublish({ mediaUrl: url, mediaType: 'video', title: v.title });
    } catch (e) { setError(e instanceof Error ? e.message : 'That did not work.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="pub-panel" data-testid="publish-social">
      <PanelHead title="Publish to social networks" sub="Choose a video. You pick the networks, caption and thumbnail on the next screen." right={<span className="pub-count">{all.length} videos</span>} />
      <ChipRow label="Video source" active={active} onPick={(id) => { setSource(id as SocialSourceId); setShown(INITIAL); }}
        chips={(Object.keys(SOCIAL_SOURCE_LABEL) as SocialSourceId[]).map((id) => ({ id, label: SOCIAL_SOURCE_LABEL[id], count: counts[id], glyph: id === 'exports' ? '⬆' : id === 'media' ? '▣' : '🎬' }))} />
      <div className="pub-filters">
        <FilterField label="Search"><input className="pub-input" type="search" placeholder="Search videos…" aria-label="Search videos" value={q} onChange={(e) => { setQ(e.target.value); setShown(INITIAL); }} /></FilterField>
        <FilterField label="Aspect ratio">
          <select className="pub-input" aria-label="Aspect ratio" value={aspect} onChange={(e) => { setAspect(e.target.value); setShown(INITIAL); }}>
            <option value="all">All aspect ratios</option><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait (Reels, Shorts, TikTok)</option><option value="1:1">1:1 square</option>
          </select>
        </FilterField>
      </div>
      {!sourceCounts(all, '', 'all').exports && <p className="pub-note" data-testid="social-no-exports">Your own video isn’t here yet: render it in the <strong>Export</strong> tab and it shows up under “Your exports”. Until then you can post one of your media or a template video.</p>}
      {error && <p className="pub-error" role="alert" data-testid="social-error">{error}</p>}
      <div className="pub-summary">Showing {Math.min(shown, list.length)} of {list.length} videos</div>
      <div className="pub-grid">
        {list.slice(0, shown).map((v) => (
          <PictureCard key={v.id} testId={`social-video-${v.id}`} title={v.title} image={v.poster} badge={v.needsUpload ? 'Will upload' : undefined} tag={v.aspect}
            sub={`${v.duration ? `${Math.round(v.duration)}s · ` : ''}${SOCIAL_SOURCE_LABEL[v.source]}`} busy={busyId === v.id} onClick={() => void publish(v)} />
        ))}
        {!list.length && <span className="pub-empty">No videos match.</span>}
      </div>
      {shown < list.length && <button type="button" className="pub-more" onClick={() => setShown((n) => n + STEP)}>Show more ({list.length - shown} left)</button>}
    </div>
  );
}
// aspectOf is re-exported for the tests of the panel's inputs
export { aspectOf };
