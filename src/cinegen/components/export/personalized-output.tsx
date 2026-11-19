// [remix] Personalized output on the Export tab: pick contacts, then download one MP4 each (the options chosen on the
// left) and/or create their personal links. Same hub, same stored links and same guest rules as the classic editor
// (lib/editor/panels/personalPanels.js renderBatchHub, publish/personalLinksClient.js).
import { useEffect, useRef, type MutableRefObject } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { usePublished, getClient } from '@cinegen/components/leads/use-publish';
// @ts-expect-error plain JS
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS
import { listContactProfiles, contactName, contactEmail, personalLink, personalLinkIssues, linksCsv } from '../../../lib/editor/personalize/perContact.js';
import { overlayProject, tokensIn, personalLinkItems } from '@cinegen/lib/personal-links-deps';
// @ts-expect-error plain JS
import { contactImageGaps } from '../../../lib/personalization/imageReadiness.js';
// @ts-expect-error plain JS
import { renderBatchHub } from '../../../lib/editor/panels/personalPanels.js';
// @ts-expect-error plain JS
import * as publishClient from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import * as personalLinks from '../../../lib/editor/publish/personalLinksClient.js';
import '../../../../styles/personalize-ui.css';
import '../../../../styles/timeline-addons.css';

interface Props {
  /** set by ExportSettings: renders with the chosen options, one video per contact id */
  renderRef: MutableRefObject<((contactIds?: string[]) => void) | null>;
  /** a render is already running */
  busy: boolean;
  hasClips: boolean;
}

export function PersonalizedOutput({ renderRef, busy, hasClips }: Props) {
  const { state, dispatch } = useWorkspace();
  const pub = usePublished();
  const host = useRef<HTMLDivElement>(null);
  const hubRef = useRef<{ redraw?: () => void; destroy?: () => void } | null>(null);
  // The hub reads the freshest state through this ref, so it is drawn once and never re-mounted while you type.
  const latest = useRef({ overlays: state.overlays ?? [], pub, busy, hasClips });
  latest.current = { overlays: state.overlays ?? [], pub, busy, hasClips };

  useEffect(() => {
    if (!host.current) return undefined;
    const project = () => overlayProject(latest.current.overlays as never[]);
    const items = (contacts: unknown[]) => personalLinkItems(latest.current.overlays as never[], contacts as Array<{ id: unknown }>);
    const describe = (p: { contact?: { company?: string }; personalization?: { business?: { businessName?: string } } }) => ({ name: contactName(p), email: contactEmail(p), company: p?.contact?.company || p?.personalization?.business?.businessName || '' });
    hubRef.current = renderBatchHub(host.current, {
      contacts: () => listContactProfiles(contactStore),
      tokensUsed: () => tokensIn(latest.current.overlays as never[]),
      issues: (p: unknown) => {
        const gaps = new Map((contactImageGaps(project(), [p]) as Array<{ id: unknown; missing: string[] }>).map((g) => [String(g.id), g.missing]));
        const own = gaps.get(String((p as { id: unknown }).id)) || [];
        return [...own.map((m) => `no ${m}`), ...(personalLinkIssues(p, tokensIn(latest.current.overlays as never[])).length ? ['image only in this browser (links)'] : [])];
      },
      guest: () => !(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user,
      exportEach: () => { if (!latest.current.busy && latest.current.hasClips) renderRef.current?.(listContactProfiles(contactStore).map((p: { id: unknown }) => String(p.id))); },
      exportSelected: (ids: string[]) => { if (!latest.current.busy && latest.current.hasClips) renderRef.current?.(ids); },
      // The published video (and its stored links) is managed in the Leads tab.
      openShare: () => dispatch({ type: 'SET_TAB', tab: 'leads' }),
      createLinks: async (ids: string[]) => {
        const id = latest.current.pub.id;
        const client = await getClient();
        const info = id ? await publishClient.getMyVideo(client, id).catch(() => null) : null;
        if (!info?.published) throw Object.assign(new Error('Publish the video first (Leads tab): personal links open the published version.'), { code: 'not_published' });
        const picked = new Set((ids || []).map(String));
        const contacts = (listContactProfiles(contactStore) as Array<{ id: unknown }>).filter((p) => picked.has(String(p.id)));
        try {
          const r = await personalLinks.syncPersonalLinks(client, id, items(contacts));
          const byContact = new Map((r.links as Array<{ contactId: string; id: string; revoked: boolean }>).map((l) => [l.contactId, l]));
          return {
            rows: contacts.map((p) => {
              const l = byContact.get(String(p.id));
              return { ...describe(p as never), link: l && !l.revoked ? publishClient.personalizedUrl(info, l.id) : '', note: l?.revoked ? 'link is turned off' : '' };
            }),
            notice: r.created || r.updated ? `${r.created} new, ${r.updated} refreshed.` : '',
          };
        } catch (err) {
          if ((err as { code?: string })?.code !== 'links_unavailable') throw err;
          const base = publishClient.canonicalUrl(info);
          return {
            rows: contacts.map((p) => ({ ...describe(p as never), link: personalLink(base, p, tokensIn(latest.current.overlays as never[])), note: '' })),
            notice: 'Saved links turn on once the database update is installed; these links carry the details in the address.',
          };
        }
      },
      copy: (text: string) => navigator.clipboard.writeText(text),
      downloadCsv: (rows: unknown[]) => {
        const blob = new Blob([linksCsv(rows)], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${String(latest.current.pub.title || 'video').replace(/[^\w-]+/g, '_')}-personal-links.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      },
    });
    return () => { hubRef.current?.destroy?.(); hubRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- drawn once; fresh values come through `latest`
  }, []);

  // Redraw when the overlays (and so the tokens in use) or the published video change.
  useEffect(() => { hubRef.current?.redraw?.(); }, [state.overlays, pub.id]);
  return <div ref={host} className="pz-ui personalized-output" data-testid="personalized-output" />;
}
