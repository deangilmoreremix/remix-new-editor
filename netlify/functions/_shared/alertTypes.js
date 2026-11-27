/** Owner alert types shared by the push and e-mail paths. */
export const CATEGORY_BY_TYPE = Object.freeze({
  new_lead: 'New lead',
  high_interest: 'Retarget',
  followup_opportunity: 'Retarget',
  interest_surge: 'Retarget',
  returning_engagement: 'Retarget',
  milestone: 'Video',
  pricing_cta: 'Video',
  contact_cta: 'Video',
  post_published: 'Publishing',
  post_failed: 'Publishing',
});

/** Results of the owner's own scheduled posts: always shown, they are not part of the retarget opt-in list. */
export const PUBLISH_TYPES = Object.freeze(['post_published', 'post_failed']);
