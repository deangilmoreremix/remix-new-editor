/**
 * A short outreach message built ONLY from facts we actually found about a business. No AI, no invented
 * praise: every observation maps to a signal read from the business's own pages and is phrased as what we
 * did or didn't SEE ("on the pages I looked at"), never as a verdict. The sender edits it before use;
 * nothing is sent from here.
 */
import type { BusinessDiscoveryRecord } from './types';
import type { BusinessEnrichment } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/types';

export interface OutreachDraft {
  to: string
  subject: string
  body: string
  /** The facts the draft rests on, for display next to it. */
  observations: string[]
}

export function outreachDraft(
  business: Pick<BusinessDiscoveryRecord, 'name' | 'city' | 'category' | 'email'>,
  enrichment?: BusinessEnrichment | null,
  sender: { name?: string } = {},
): OutreachDraft {
  const sig = enrichment?.siteSignals;
  const observations: string[] = [];
  const lines: string[] = [];

  // Only observations a page could genuinely support. A missing signal is phrased as "didn't see", and is
  // only used when we actually read pages (signals present), otherwise there is nothing to say.
  if (sig) {
    if (!sig.booking) {
      observations.push('No online booking link found on the pages we read');
      lines.push("I didn't spot a way to book online on the pages I looked at");
    }
    if (!sig.video) {
      observations.push('No video found on the pages we read');
      lines.push("I didn't see a video on your site");
    }
    if (sig.quality && !sig.quality.mobileViewport) {
      observations.push('Homepage has no mobile viewport tag');
      lines.push('your homepage may not be set up for phones');
    }
  }

  const name = business.name.trim();
  const where = business.city ? ` in ${business.city}` : '';
  const intro = `Hi ${name} team,`;
  const context = `I came across ${name}${where}${lines.length ? ` and had a quick look at your website. ${capitalise(lines.join('; '))}.` : '.'}`;
  const offer = `I put together a short video for ${name} that you can use as-is or tweak: [link to your sample video]. Happy to adjust it to your branding.`;
  const close = `Would you be open to a quick reply if it's useful?\n\n${sender.name?.trim() || '[Your name]'}`;
  return {
    to: business.email?.trim() ?? '',
    subject: `A short video idea for ${name}`,
    body: [intro, '', context, '', offer, '', close].join('\n'),
    observations,
  };
}

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
