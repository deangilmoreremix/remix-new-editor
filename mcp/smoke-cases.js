// Live smoke cases for the custom (non-catalog) tools. estUsd is an assumed upper figure, not a measured price:
// the spend cap counts it, and the plan prints it as "(assumed)". `needs` names the sample inputs the run needs.
const PROMPT = 'A small red ball on a plain white table, soft daylight';

export const cases = [
  { id: 'tool:video_fill_gap', tool: 'video_fill_gap', needs: ['image'], estUsd: 0.1, args: (s) => ({ first_frame_url: s.image, last_frame_url: s.image, prompt: PROMPT, duration: 2 }) },
  { id: 'tool:video_extend', tool: 'video_extend', needs: ['video'], estUsd: 0.15, args: (s) => ({ direction: 'after', video_url: s.video, duration: 2 }) },
  { id: 'tool:video_remove_watermark', tool: 'video_remove_watermark', needs: ['video'], estUsd: 0.1, args: (s) => ({ video_url: s.video }) },
  { id: 'tool:image_layers', tool: 'image_layers', needs: ['image'], estUsd: 0.1, args: (s) => ({ image_url: s.image }) },
  { id: 'tool:music_create', tool: 'music_create', estUsd: 0.15, args: () => ({ prompt: 'gentle ambient piano', style: 'ambient', duration: 10 }) },
  { id: 'tool:voiceover_create', tool: 'voiceover_create', estUsd: 0.1, args: () => ({ text: 'Hello from the smoke test.', voice: 'Calm_Woman' }) },
  { id: 'tool:zackd_submit', tool: 'zackd_submit', estUsd: 0.1, args: () => ({ kind: 'image', prompt: PROMPT, aspect: '1:1' }) },
  { id: 'tool:zackd_trends', tool: 'zackd_trends', estUsd: 0.02, args: () => ({ query: 'space' }) },
  { id: 'tool:zackd_script', tool: 'zackd_script', estUsd: 0.03, args: () => ({ topic: 'why the sky is blue', max_beats: 3 }) },
  { id: 'tool:brand_scrape', tool: 'brand_scrape', needs: ['url'], estUsd: 0, args: (s) => ({ url: s.url }) },
];

// Extra no-spend gateway checks specific to this brand.
export const extraNegatives = [
  { name: 'unknown studio is refused', path: '/studio/constructor', method: 'POST', body: {}, expect: [404] },
];
