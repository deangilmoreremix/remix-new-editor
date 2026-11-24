/**
 * The DEMO videos for the Analytics and Heatmaps tabs.
 *
 * They exist so that a person with no published video yet can see, and click through, what the real screens look like when
 * viewers have watched a video. Everything here is invented: the figures come from the profiles below through demoClient.js,
 * which stands in for the database ONLY while a demo video is open. Real analytics never read this file (analyticsData.js
 * and heatmapData.js take whatever client they are given; the real client never knows about demo ids).
 *
 * Three stories, so the screens can be compared:
 *   1. roofing quote ad    - a lead-generation ad that works (steady retention, clicks pile on the button, many leads)
 *   2. vertical teaser     - a social ad that loses people in the first seconds (steep drop-off, scattered taps, few clicks)
 *   3. personal outreach   - a video sent to named prospects (few viewers, finishes, replays, books calls; two campaigns)
 *
 * Positions in `heat` are fractions of the watch-page mock (public/analytics-demo/*.jpg, 1.6 : 1), made by
 * scripts/generate-analytics-demo-media.sh - keep the two in sync.
 */

export const DEMO_ID_PREFIX = 'demo-';
export const isDemoVideoId = (id) => typeof id === 'string' && id.startsWith(DEMO_ID_PREFIX);

const clipAt = (T, start, end, extra) => ({ left: (start / T) * 100, width: ((end - start) / T) * 100, ...extra });

/** The published-project snapshot the Analytics screens (and the preview player) read: sections, CTA labels, length, aspect. */
function buildProject(def) {
  const T = def.durationS;
  return {
    version: 1,
    title: def.title,
    timelineSeconds: T,
    ...(def.aspect !== '16:9' ? { aspect: def.aspect } : {}),
    interestMap: def.sections.map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end })),
    tracks: [
      { id: 'v', type: 'video', items: [clipAt(T, 0, T, { id: `${def.id}-video`, type: 'video', src: def.src })] },
      { id: 't', type: 'text', items: def.overlays.map((o) => clipAt(T, o.start, o.end, o.clip)) },
    ],
    listBuilder: null,
  };
}

const DEMOS = [
  {
    id: 'demo-roofing-quote',
    title: 'Roofing quote ad',
    tagline: 'A lead-generation ad that works',
    story: 'Viewers stay, click the button and ask for quotes. Use it to see what a healthy video looks like.',
    lookFor: [
      'Retention stays above half the way to the end.',
      'The click heatmap glows on the quote button and the phone number.',
      'Version 2 beat version 1 on completion and on leads.',
    ],
    src: '/analytics-demo/roofing-quote-ad.mp4',
    thumbnailUrl: '/analytics-demo/roofing-quote-ad.jpg',
    aspect: '16:9',
    durationS: 30,
    sections: [
      { id: 'hook', title: 'Hook', start: 0, end: 6 },
      { id: 'problem', title: 'The problem', start: 6, end: 14 },
      { id: 'offer', title: 'The offer', start: 14, end: 22 },
      { id: 'proof', title: 'Proof', start: 22, end: 27 },
      { id: 'cta', title: 'Call to action', start: 27, end: 30 },
    ],
    // The button is drawn into the video (centre 50 % / 76 %, 34 % wide); the player lays a tap target over it.
    overlays: [
      { start: 27, end: 30, clip: { id: 'cta-quote', type: 'click-to-call', linkUrl: 'https://example.com/quote', buttonText: 'Get my free quote', style: { posLeft: 50, posTop: 76, posWidth: 34 } } },
      { start: 27, end: 30, clip: { id: 'cta-call', type: 'click-to-call', phoneNumber: '+15555550142', buttonText: 'Call 555 0142', style: { posLeft: 50, posTop: 91, posWidth: 22 } } },
    ],
    profile: {
      publishedDaysAgo: 44, v2Day: 16, basePlays: 150, uniqueRatio: 0.74, visitsPerPlay: 1.4,
      rates: {
        1: { complete: 0.41, cta: 0.07, call: 0.03, lead: 0.032, overlay: 0, watch: 0.52 },
        2: { complete: 0.58, cta: 0.12, call: 0.045, lead: 0.064, overlay: 0, watch: 0.7 },
      },
      retention: {
        1: [[0, 100], [10, 88], [20, 74], [30, 66], [47, 58], [60, 52], [75, 47], [90, 43], [100, 40]],
        2: [[0, 100], [10, 93], [20, 83], [30, 77], [47, 71], [60, 66], [75, 62], [90, 58], [100, 56]],
      },
      sectionEngagement: { hook: 91, problem: 78, offer: 72, proof: 66, cta: 58 },
      ctas: [
        { id: 'cta-quote', type: 'cta_click', kind: 'get_offer', label: 'Get my free quote', share: 1, exposure: 0.56 },
        { id: 'cta-call', type: 'call_click', kind: 'call_now', label: 'Call 555 0142', share: 1, exposure: 0.54 },
        { id: 'form-quote', type: 'lead_submit', kind: 'lead_capture', label: 'Free quote form', share: 1, exposure: 0.52 },
      ],
      audience: {
        referrer: [[null, 0.42, 1, 0.9], ['google.com', 0.26, 1.08, 1.2], ['facebook.com', 0.19, 0.84, 0.8], ['mail.google.com', 0.13, 1.1, 1.3]],
        device: [['mobile', 0.62, 0.92, 0.95], ['desktop', 0.33, 1.15, 1.1], ['tablet', 0.05, 1, 0.9]],
        country: [['US', 0.78, 1, 1], ['CA', 0.09, 1.05, 1.1], ['GB', 0.06, 0.9, 0.8], ['AU', 0.04, 1, 1], ['DE', 0.03, 0.8, 0.7]],
      },
      notes: [
        { daysAgo: 1, type: 'pricing_cta', title: 'The quote button is getting a lot of attention', summary: 'More viewers than usual clicked "Get my free quote" yesterday.', suggestion: 'Send the next visitor straight to a booking page.' },
        { daysAgo: 4, type: 'new_lead', title: 'New lead from the free quote form', summary: 'Someone finished the form after watching the whole video.', suggestion: 'Reply within the hour while the offer is fresh.' },
        { daysAgo: 11, type: 'interest_surge', title: 'Plays doubled after the Facebook post', summary: 'Most of the extra views came from facebook.com.', suggestion: 'Post again on the same day next week.' },
      ],
      heat: {
        // Where each button sits on the page mock, and where the stray taps land. A button's clicks come from its own click count
        // (ctaTaps clicks per session that used it), so the heat and the CTA table always agree.
        pageBucket: 2, clickSessionRate: 0.34, ctaTaps: 1.15, scatterPerSession: 0.35,
        ctaSpots: {
          'cta-quote': { x: 0.5, y: 0.683, sx: 0.06, sy: 0.035 },
          'cta-call': { x: 0.5, y: 0.79, sx: 0.05, sy: 0.02 },
        },
        scatter: [
          { x: 0.5, y: 0.34, sx: 0.2, sy: 0.05, w: 0.02 },
          { x: 0.5, y: 0.5, sx: 0.2, sy: 0.14, w: 0.2 },
        ],
        scroll: { 25: 0.96, 50: 0.7, 75: 0.47, 100: 0.31 }, ctaExposed: 0.52,
        replayAt: [[14, 18, 0.1]], skipAt: [[6, 8, 0.09]],
      },
      campaigns: null,
    },
  },
  {
    id: 'demo-vertical-teaser',
    title: 'Vertical product teaser',
    tagline: 'A social ad that loses viewers early',
    story: 'Most viewers leave in the first few seconds and only a few reach the button. Use it to see what a drop-off looks like and what to fix.',
    lookFor: [
      'Retention falls off a cliff in the first four seconds.',
      'Clicks are scattered over the frame instead of landing on the button.',
      'Version 2 improved a little, but the hook is still the problem.',
    ],
    src: '/analytics-demo/serum-vertical-ad.mp4',
    thumbnailUrl: '/analytics-demo/serum-vertical-ad.jpg',
    aspect: '9:16',
    durationS: 20,
    sections: [
      { id: 'hook', title: 'Hook', start: 0, end: 4 },
      { id: 'benefit', title: 'The product', start: 4, end: 10 },
      { id: 'proof', title: 'Reviews', start: 10, end: 16 },
      { id: 'cta', title: 'Offer and button', start: 16, end: 20 },
    ],
    // Button: centre 50 % / 80 %, 70 % wide.
    overlays: [
      { start: 16, end: 20, clip: { id: 'cta-shop', type: 'click-to-call', linkUrl: 'https://example.com/shop', buttonText: 'Shop now', style: { posLeft: 50, posTop: 80, posWidth: 70 } } },
    ],
    profile: {
      publishedDaysAgo: 30, v2Day: 12, basePlays: 52, uniqueRatio: 0.91, visitsPerPlay: 1.1,
      rates: {
        1: { complete: 0.12, cta: 0.016, call: 0, lead: 0.011, overlay: 0, watch: 0.24 },
        2: { complete: 0.17, cta: 0.026, call: 0, lead: 0.015, overlay: 0, watch: 0.3 },
      },
      retention: {
        1: [[0, 100], [10, 55], [20, 38], [30, 31], [50, 22], [75, 16], [100, 12]],
        2: [[0, 100], [10, 63], [20, 45], [30, 38], [50, 28], [75, 21], [100, 17]],
      },
      sectionEngagement: { hook: 52, benefit: 34, proof: 25, cta: 19 },
      ctas: [
        { id: 'cta-shop', type: 'cta_click', kind: 'get_offer', label: 'Shop now', share: 1, exposure: 0.2 },
        { id: 'form-notify', type: 'lead_submit', kind: 'lead_capture', label: 'Back in stock alert', share: 1, exposure: 0.18 },
      ],
      audience: {
        referrer: [['instagram.com', 0.52, 0.8, 0.8], ['tiktok.com', 0.31, 0.75, 0.7], [null, 0.12, 1.3, 1.5], ['youtube.com', 0.05, 1.1, 1]],
        device: [['mobile', 0.89, 0.97, 0.97], ['desktop', 0.09, 1.4, 1.5], ['tablet', 0.02, 1, 1]],
        country: [['US', 0.55, 1, 1], ['GB', 0.14, 1.1, 1], ['CA', 0.1, 1, 1], ['BR', 0.09, 0.7, 0.6], ['FR', 0.07, 0.9, 0.9], ['MX', 0.05, 0.7, 0.7]],
      },
      notes: [
        { daysAgo: 2, type: 'high_interest', title: 'Most viewers leave in the first 4 seconds', summary: 'Under half of viewers are still watching after the opening line.', suggestion: 'Try opening on the product instead of the text.' },
        { daysAgo: 9, type: 'milestone', title: 'This video passed 1,000 plays', summary: 'Plays are steady, but few viewers reach the button.', suggestion: 'Move the offer earlier in the video.' },
      ],
      heat: {
        pageBucket: 2, clickSessionRate: 0.22, ctaTaps: 1.15, scatterPerSession: 1.3,
        ctaSpots: {
          'cta-shop': { x: 0.5, y: 0.768, sx: 0.05, sy: 0.035 },
        },
        scatter: [
          { x: 0.5, y: 0.26, sx: 0.1, sy: 0.05, w: 0.18 },
          { x: 0.5, y: 0.5, sx: 0.12, sy: 0.3, w: 0.35 },
          { x: 0.3, y: 0.3, sx: 0.12, sy: 0.25, w: 0.12 },
          { x: 0.7, y: 0.35, sx: 0.12, sy: 0.25, w: 0.13 },
        ],
        scroll: { 25: 0.82, 50: 0.4, 75: 0.19, 100: 0.1 }, ctaExposed: 0.2,
        replayAt: [[1, 3, 0.03]], skipAt: [[2, 4, 0.2], [10, 12, 0.07]],
      },
      campaigns: null,
    },
  },
  {
    id: 'demo-personal-outreach',
    title: 'Personal outreach video',
    tagline: 'A video sent to named prospects',
    story: 'A small, hand-picked audience that watches to the end, replays and books calls. Use it to see how a personalized video performs, and the campaign filter.',
    lookFor: [
      'Very few viewers, but most finish and many replay the offer.',
      'The "Book a call" link gets clicks from a high share of the people who saw it.',
      'Use the Campaign filter in Heatmaps to compare the two prospect lists.',
    ],
    src: '/media/outreach-sample/presenter.mp4',
    thumbnailUrl: '/analytics-demo/personal-outreach.jpg',
    aspect: '1:1',
    durationS: 26,
    sections: [
      { id: 'greeting', title: 'Greeting', start: 0, end: 6 },
      { id: 'why', title: 'Why them', start: 6, end: 14 },
      { id: 'offer', title: 'The offer', start: 14, end: 21 },
      { id: 'book', title: 'Book a call', start: 21, end: 26 },
    ],
    // The player draws this link as a text overlay (left 30 %, top 78 %, 40 % x 12 % of the frame).
    overlays: [
      { start: 21, end: 26, clip: { id: 'cta-book', type: 'overlay-text', addon: { text: 'Book a call', linkUrl: 'https://example.com/book', geometry: { left: 30, top: 78, width: 40, height: 12 } } } },
    ],
    profile: {
      publishedDaysAgo: 24, v2Day: 9, basePlays: 24, uniqueRatio: 0.88, visitsPerPlay: 1.25,
      rates: {
        1: { complete: 0.66, cta: 0, call: 0, lead: 0.07, overlay: 0.16, watch: 0.79 },
        2: { complete: 0.79, cta: 0, call: 0, lead: 0.11, overlay: 0.24, watch: 0.88 },
      },
      retention: {
        1: [[0, 100], [10, 95], [30, 87], [50, 80], [70, 74], [90, 69], [100, 66]],
        2: [[0, 100], [10, 98], [30, 94], [50, 89], [70, 85], [90, 81], [100, 79]],
      },
      sectionEngagement: { greeting: 97, why: 93, offer: 88, book: 82 },
      ctas: [
        { id: 'cta-book', type: 'overlay_click', kind: 'book_call', label: 'Book a call', share: 1, exposure: 0.8 },
        { id: 'form-reply', type: 'lead_submit', kind: 'lead_capture', label: 'Reply form', share: 1, exposure: 0.74 },
      ],
      audience: {
        referrer: [['mail.google.com', 0.52, 1.05, 1.1], ['linkedin.com', 0.26, 0.95, 0.9], [null, 0.14, 1, 1], ['outlook.live.com', 0.08, 1.1, 1.2]],
        device: [['desktop', 0.71, 1.06, 1.1], ['mobile', 0.27, 0.85, 0.8], ['tablet', 0.02, 1, 1]],
        country: [['US', 0.64, 1, 1], ['GB', 0.16, 1.05, 1.1], ['CA', 0.12, 1, 1], ['AU', 0.08, 0.95, 0.9]],
      },
      notes: [
        { daysAgo: 1, type: 'returning_engagement', title: 'A prospect watched this video twice', summary: 'One viewer came back and replayed the offer.', suggestion: 'Follow up today: they are clearly interested.' },
        { daysAgo: 3, type: 'contact_cta', title: 'Someone clicked "Book a call"', summary: 'A prospect from the Q4 SaaS list opened your booking link.', suggestion: 'Check the calendar for a new booking.' },
        { daysAgo: 8, type: 'followup_opportunity', title: '5 prospects watched but did not click', summary: 'They finished the video and left without booking.', suggestion: 'Send a short follow-up with the booking link.' },
      ],
      heat: {
        pageBucket: 2, clickSessionRate: 0.38, ctaTaps: 1.15, scatterPerSession: 0.4,
        ctaSpots: {
          'cta-book': { x: 0.5, y: 0.7, sx: 0.04, sy: 0.02 },
        },
        scatter: [
          { x: 0.5, y: 0.32, sx: 0.07, sy: 0.08, w: 0.14 },
          { x: 0.5, y: 0.55, sx: 0.12, sy: 0.15, w: 0.12 },
        ],
        scroll: { 25: 0.98, 50: 0.91, 75: 0.8, 100: 0.64 }, ctaExposed: 0.8,
        replayAt: [[14, 21, 0.18]], skipAt: [[0, 2, 0.03]],
      },
      campaigns: [
        { id: 'camp-saas-q4', name: 'Q4 SaaS prospects', share: 0.6 },
        { id: 'camp-webinar', name: 'Webinar attendees', share: 0.4 },
      ],
    },
  },
];

export const DEMO_VIDEOS = DEMOS.map((d) => ({ ...d, project: buildProject(d) }));

export const getDemoVideo = (id) => DEMO_VIDEOS.find((d) => d.id === id) || null;
