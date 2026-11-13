// Sample data for the docs' usage examples that reference a variable the page does not define (`captions`, `weeks`, ...).
// Optional props are simply left undefined so the component shows its own built-in demo content.
export const SAMPLE_IMPORTS = {
  page: `import { createTikTokStyleCaptions } from "@remotion/captions";`,
  easyEase: `import { easyEase } from "../vendored/lib/ae-motion";`,
};
const CAPTIONS = `const captions = ["Ship", "the", "scene", "on", "Friday", "with", "confidence"].map((t, i) => ({ text: (i ? " " : "") + t, startMs: i * 450, endMs: i * 450 + 420, timestampMs: i * 450 + 210, confidence: 1 }));`;
export const SAMPLES = {
  captions: CAPTIONS,
  page: `${CAPTIONS}\nconst [page] = createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 1500 }).pages;`,
  vttSource: 'const vttSource = "WEBVTT\\n\\n00:00.000 --> 00:02.000\\nHello there\\n\\n00:02.000 --> 00:04.500\\nThis is a sample caption\\n\\n00:04.500 --> 00:07.000\\nShip it on Friday";',
  weeks: 'const weeks = Array.from({ length: 7 }, (_, r) => Array.from({ length: 20 }, (_, c) => ((r * 7 + c * 13) % 10) / 10));',
  metrics: 'const metrics = [{ label: "Views", value: 124000 }, { label: "Watch time (h)", value: 8200 }, { label: "Subscribers", value: 3150 }];',
  barData: 'const barData = [{ label: "Shorts", value: 124000 }, { label: "Long-form", value: 86000 }, { label: "Live", value: 41000 }];',
  steps: 'const steps = [{ title: "Plan", description: "Outline the story" }, { title: "Build", description: "Compose the scenes" }, { title: "Ship", description: "Render and publish" }];',
  items: 'const items = ["Design", "Build", "Ship"];',
  source: 'const source = "export function render(scene) {\\n  const frame = useCurrentFrame();\\n  const t = interpolate(frame, [0, 30], [0, 1]);\\n  return scene(t);\\n}";',
  sourceCode: 'const sourceCode = "export function render(scene) {\\n  const frame = useCurrentFrame();\\n  const t = interpolate(frame, [0, 30], [0, 1]);\\n  return scene(t);\\n}";',
  before: 'const before = "const total = items.map((i) => i.price).reduce((a, b) => a + b, 0);";',
  after: 'const after = "const total = sum(items, (i) => i.price);";',
};
// per item: statements replacing the generic ones above
export const OVERRIDES = {
  'split-screen': 'const svg = (a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'960\' height=\'1080\'><defs><linearGradient id=\'g\' x1=\'0\' y1=\'0\' x2=\'1\' y2=\'1\'><stop offset=\'0\' stop-color=\'${a}\'/><stop offset=\'1\' stop-color=\'${b}\'/></linearGradient></defs><rect width=\'960\' height=\'1080\' fill=\'url(#g)\'/></svg>`);\nconst before = svg("#1d4ed8", "#7c3aed");\nconst after = svg("#f97316", "#ec4899");',
};
// identifiers that are optional props: undefined makes the component use its own content
export const UNDEFINED_OK = ['messages', 'sections'];

// wrapper effects whose only visible text is the demo child: that text becomes editable fields text1, text2, ... (demos.mjs / catalog.mjs)
export const TEXT_WRAPPERS = ['blur-in', 'shake-emphasis', 'slide-left', 'stagger-children', 'blur-focus-in', 'fade-in', 'fade-out', 'scale-in', 'rotate-in', 'skew-in', 'slide-up', 'spring-in', 'squash-stretch', 'tracking-in', 'strikethrough-replace'];
