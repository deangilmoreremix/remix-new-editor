/**
 * Deterministic follow-up recommendations from OBSERVED engagement.
 * No AI call: rules map each interest type to a follow-up brief. Each
 * recommendation separates what was observed (evidence) from what is suggested
 * (the recommendation), and carries the context the existing personalization
 * workflow needs (see followupContext()).
 *
 * Input rows come from the owner-only RPCs:
 *   interests: [{ interest, interest_type, sessions, decayed_score, high_interest_sessions }]
 *   segments:  { returning_viewers, pricing_interested, ... }  (anonymous session counts)
 */

const TEMPLATES = {
  service: (l) => ({ title: `${l}: options and next steps`, message: `Explain your ${l} options, what an assessment involves and how to book it.`, ctaPurpose: 'book_assessment' }),
  product: (l) => ({ title: `${l}: examples and details`, message: `Show real ${l} examples, what is included and how to get started.`, ctaPurpose: 'view_examples' }),
  pricing: () => ({ title: 'Pricing explained', message: 'Explain how pricing works, what affects the cost and how to get a quote or consultation.', ctaPurpose: 'request_quote' }),
  offer: (l) => ({ title: `${l}: offer reminder`, message: `Remind viewers of the ${l} offer, what it includes and when it ends.`, ctaPurpose: 'claim_offer' }),
  cta: (l) => ({ title: `${l}: follow-up`, message: `Follow up on ${l} with a short video that answers common questions and invites a reply.`, ctaPurpose: 'contact' }),
  topic: (l) => ({ title: `${l}: deeper dive`, message: `Go deeper on ${l} with a more detailed explanation.`, ctaPurpose: 'learn_more' }),
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The brief handed to the personalization workflow. */
export function followupContext({ projectId, projectName, interest, interestType, message, ctaPurpose, videoUrl = null }) {
  return {
    originalProjectId: projectId,
    originalProjectName: projectName,
    interest: interest || null,
    interestType: interestType || null,
    product: interestType === 'product' ? interest : null,
    service: interestType === 'service' ? interest : null,
    ctaPurpose: ctaPurpose || null,
    suggestedMessage: message || null,
    originalVideoUrl: videoUrl,
  };
}

/**
 * @returns {Array<{id, kind:'recommendation', interest, interestType, title, observed, suggestion, priority, followup}>}
 */
export function recommend({ interests = [], segments = {}, project = {}, minSessions = 2 } = {}) {
  const out = [];
  const ranked = interests
    .filter((r) => r && r.interest && (Number(r.high_interest_sessions) > 0 || Number(r.sessions) >= minSessions))
    .sort((a, b) => Number(b.decayed_score) - Number(a.decayed_score));

  for (const r of ranked.slice(0, 5)) {
    const type = TEMPLATES[r.interest_type] ? r.interest_type : 'topic';
    const t = TEMPLATES[type](r.interest);
    const high = Number(r.high_interest_sessions) || 0;
    const sessions = Number(r.sessions) || 0;
    out.push({
      id: `interest:${r.interest}`,
      kind: 'recommendation',
      interest: r.interest,
      interestType: type,
      title: t.title,
      observed: `${plural(sessions, 'viewing session')} showed interest in "${r.interest}"${high ? `, ${high} of them strongly` : ''}.`,
      suggestion: `Create a follow-up video: ${t.message}`,
      priority: Math.round(Number(r.decayed_score) || 0),
      followup: followupContext({ ...project, interest: r.interest, interestType: type, message: t.message, ctaPurpose: t.ctaPurpose }),
    });
  }

  const returning = Number(segments.returning_viewers) || 0;
  if (returning > 0 && ranked.length) {
    const top = ranked[0];
    out.push({
      id: 'segment:returning',
      kind: 'recommendation',
      interest: top.interest,
      interestType: top.interest_type,
      title: 'More detail for repeat viewers',
      observed: `${plural(returning, 'returning session')} came back to this video.`,
      suggestion: `Send a more detailed follow-up on ${top.interest}, the section they watched most.`,
      priority: Math.round(Number(top.decayed_score) || 0) + 1,
      followup: followupContext({ ...project, interest: top.interest, interestType: top.interest_type, message: `A more detailed look at ${top.interest}, for people who have already watched.`, ctaPurpose: 'learn_more' }),
    });
  }

  const pricing = Number(segments.pricing_interested) || 0;
  if (pricing > 0 && !out.some((x) => x.interestType === 'pricing')) {
    const t = TEMPLATES.pricing();
    out.push({
      id: 'segment:pricing',
      kind: 'recommendation',
      interest: 'Pricing',
      interestType: 'pricing',
      title: t.title,
      observed: `${plural(pricing, 'session')} engaged with pricing information.`,
      suggestion: `Create a follow-up video: ${t.message}`,
      priority: 50,
      followup: followupContext({ ...project, interest: 'Pricing', interestType: 'pricing', message: t.message, ctaPurpose: t.ctaPurpose }),
    });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/** Human labels for the anonymous segments (counts of sessions, never people). */
export const SEGMENT_LABELS = Object.freeze({
  new_viewers: 'New viewers',
  returning_viewers: 'Returning viewers',
  highly_engaged: 'Highly engaged',
  product_interested: 'Product-interested',
  service_interested: 'Service-interested',
  pricing_interested: 'Pricing-interested',
  cta_clickers: 'CTA clickers',
  lead_submitters: 'Lead form submitters',
  high_interest: 'High-interest sessions',
});

/** Plain-language explanation of how an interest score is built. */
export const SCORE_EXPLANATION = 'Interest scores are calculated from what viewers actually did: watching most of a section, rewatching it, clicking its call to action, asking about pricing, returning, or submitting a form. Repeat clicks count once, scores are capped, and older activity counts for less over time. They describe anonymous viewing sessions, not named people.';
