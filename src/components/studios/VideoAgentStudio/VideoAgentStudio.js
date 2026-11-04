// SmartVid Video Agent — port of Remotion's prompt-to-motion-graphics template
// (apps/motion-agent, built to public/motion-agent/ by `npm run build:motion-agent`).
// Describe an animation, the agent writes Remotion code, the Player previews it live,
// follow-up chat edits it, and "Render & Download" renders the MP4 in the browser
// (@remotion/web-renderer). The finished video is uploaded and saved to the library.
//
// postMessage (same origin; see apps/motion-agent/src/host/bridge.ts):
//   → sv:auth      Clerk session token for /.netlify/functions/video-agent-generate
//   ← sv:ready
//   ← sv:exported  { blob, name, prompt }
import { mountStudioChrome } from '../../../lib/studioChrome.js';
import { saveGeneration } from '../../../lib/generationHistory.js';
import { uploadFileToSupabase } from '../../../lib/uploadService.js';

// Explicit index.html: the dev server's SPA fallback would otherwise serve the main app.
export const MOTION_AGENT_APP_PATH = '/motion-agent/index.html';
const TOKEN_REFRESH_MS = 45_000;

async function getClerkToken() {
  try {
    const session = window.Clerk?.session;
    return session && typeof session.getToken === 'function' ? (await session.getToken()) || null : null;
  } catch {
    return null;
  }
}

export function VideoAgentStudio() {
  const container = document.createElement('div');
  container.className = 'w-full flex flex-col overflow-hidden bg-app-bg';
  // The app shell grows to the sidebar's height; pin the agent to the viewport instead.
  const fit = () => {
    const header = document.querySelector('#app > header, header');
    const top = header ? Math.round(header.getBoundingClientRect().height) : 56;
    container.style.height = `calc(100dvh - ${top}px)`;
    container.style.position = 'sticky';
    container.style.top = `${top}px`;
  };
  fit();
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);

  const { topbar } = mountStudioChrome(container, { currentRoute: 'video-agent', title: 'Video Agent' });
  const status = document.createElement('span');
  status.className = 'text-xs text-secondary mr-3';
  status.setAttribute('aria-live', 'polite');
  topbar.appendChild(status);

  const body = document.createElement('div');
  body.className = 'relative flex-1 min-h-0';
  container.appendChild(body);

  const iframe = document.createElement('iframe');
  iframe.src = MOTION_AGENT_APP_PATH;
  iframe.title = 'SmartVid Video Agent';
  iframe.className = 'absolute inset-0 w-full h-full border-0 bg-black';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
  body.appendChild(iframe);

  let tokenTimer = null;
  const sendToken = async () => {
    iframe.contentWindow?.postMessage({ type: 'sv:auth', token: await getClerkToken() }, window.location.origin);
  };

  async function saveExport(blob, name, prompt) {
    status.textContent = 'Saving video to your library…';
    try {
      const file = new File([blob], name || 'video-agent.mp4', { type: 'video/mp4' });
      const { url } = await uploadFileToSupabase(file, { category: 'video' });
      saveGeneration({ studio: 'videoagent', type: 'video', url, prompt: prompt || 'Video Agent animation' });
      status.textContent = 'Saved to your library';
    } catch (e) {
      status.textContent = `Downloaded — couldn't save to library (${e?.message || 'upload failed'})`;
    }
  }

  const onMessage = (e) => {
    if (e.origin !== window.location.origin || e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (!d || typeof d.type !== 'string') return;
    if (d.type === 'sv:ready') {
      sendToken();
      clearInterval(tokenTimer);
      tokenTimer = setInterval(sendToken, TOKEN_REFRESH_MS);
    } else if (d.type === 'sv:exported' && d.blob instanceof Blob) {
      saveExport(d.blob, typeof d.name === 'string' ? d.name : 'video-agent.mp4', typeof d.prompt === 'string' ? d.prompt : '');
    }
  };
  window.addEventListener('message', onMessage);

  container.cleanup = () => {
    clearInterval(tokenTimer);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('resize', fit);
  };
  return container;
}

export default VideoAgentStudio;
