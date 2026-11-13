import { createAnalytics } from '/home/user/wt-stage7/src/lib/editor/publish/analyticsClient.js';
import { createHeatmapCapture } from '/home/user/wt-stage7/src/lib/editor/publish/heatmapCapture.js';
const container = document.getElementById('c');
const frame = document.getElementById('frame');
const analytics = createAnalytics({ videoId: 'vidA000001', beacon: null });
const heat = createHeatmapCapture({ analytics, container, frame, labelFor: (id) => (id === 'cta1' ? 'Book a call' : null), leadClipId: null });
window.analytics = analytics; window.heat = heat;
window.tick = (time, playing = true) => { analytics.onPlayerChange({ playing, time, duration: 12 }); heat.onPlayerChange({ playing, time, duration: 12 }); };
window.ready = true;
