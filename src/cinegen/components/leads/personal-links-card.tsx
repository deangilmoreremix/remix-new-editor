// [remix] Publish tab: the personal links of the published video. View, edit what a link shows, give it a new address (the
// old one stops), turn it off or on, remove it, or download the list. It is the same panel the classic editor's Share
// panel uses (lib/editor/publish/sharePanel.js, linksOnly) and works for guests and signed-in owners alike.
import { useEffect, useRef } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { getClient, type usePublished } from './use-publish';
import { personalLinkItems, tokensIn } from '@cinegen/lib/personal-links-deps';
// @ts-expect-error plain JS
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS
import { listContactProfiles, contactName, contactEmail, personalLink, personalLinkIssues, linksCsv } from '../../../lib/editor/personalize/perContact.js';
// @ts-expect-error plain JS
import { TOKEN_DEFS } from '../../../components/personalize/tokenSchema.js';
// @ts-expect-error plain JS
import { renderSharePanel } from '../../../lib/editor/publish/sharePanel.js';
// @ts-expect-error plain JS
import * as publishClient from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import * as personalLinks from '../../../lib/editor/publish/personalLinksClient.js';
import '../../../../styles/personalize-ui.css';
import '../../../../styles/timeline-addons.css';

type Published = ReturnType<typeof usePublished>;
type Contact = { id: unknown; contact?: { company?: string }; personalization?: { business?: { businessName?: string } } };

export function PersonalLinksCard({ pub }: { pub: Published }) {
  const { state } = useWorkspace();
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<{ refresh?: () => void; destroy?: () => void } | null>(null);
  const latest = useRef({ overlays: state.overlays ?? [], pub });
  latest.current = { overlays: state.overlays ?? [], pub };

  useEffect(() => {
    if (!host.current) return undefined;
    const describe = (p: Contact) => ({ name: contactName(p), email: contactEmail(p), company: p?.contact?.company || p?.personalization?.business?.businessName || '' });
    const videoId = () => latest.current.pub.id;
    const tokens = () => tokensIn(latest.current.overlays as never[]);
    panel.current = renderSharePanel(host.current, {
      linksOnly: true,
      guest: () => !(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user,
      getInfo: async () => { const id = videoId(); return id ? publishClient.getMyVideo(await getClient(), id) : null; },
      copy: (text: string) => navigator.clipboard.writeText(text),
      // Older address-carried links, used only until the database update is installed.
      personalLinks: (link: string) => (listContactProfiles(contactStore) as Contact[]).map((p) => ({ ...describe(p), link: personalLink(link, p, tokens()), missing: [], localImages: personalLinkIssues(p, tokens()) })),
      links: {
        list: async () => personalLinks.listPersonalLinks(await getClient(), videoId()),
        sync: async () => personalLinks.syncPersonalLinks(await getClient(), videoId(), personalLinkItems(latest.current.overlays as never[], listContactProfiles(contactStore))),
        update: async (id: string, patch: unknown) => personalLinks.updatePersonalLink(await getClient(), id, patch),
        regenerate: async (id: string) => personalLinks.regeneratePersonalLink(await getClient(), id),
        remove: async (id: string) => personalLinks.deletePersonalLink(await getClient(), id),
        tokens,
        label: (key: string) => (TOKEN_DEFS as Array<{ key: string; label: string }>).find((d) => d.key === key)?.label || key,
        contact: (contactId: string) => { const p = contactStore.getProfile?.(contactId) as Contact | null; return p ? describe(p) : {}; },
      },
      contactLabel: (id: string) => { const p = contactStore.getProfile?.(id); return p ? contactName(p) : null; },
      downloadCsv: (rows: unknown[]) => {
        const blob = new Blob([linksCsv(rows)], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${String(latest.current.pub.title || 'video').replace(/[^\w-]+/g, '_')}-personal-links.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      },
    });
    return () => { panel.current?.destroy?.(); panel.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- drawn once; fresh values come through `latest`
  }, []);

  // A different or re-published video, or new tokens in the video, mean a different list.
  useEffect(() => { panel.current?.refresh?.(); }, [pub.id, pub.info?.published, state.overlays]);
  return (
    <section className="leads-card" data-testid="personal-links-card">
      <h3 className="leads-card__title">Personal links</h3>
      <div ref={host} className="pz-ui" />
    </section>
  );
}
