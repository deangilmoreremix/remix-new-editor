/** postMessage protocol with SmartVid (parent window, same origin):
 *  parent → agent: { type: "sv:auth", token, openaiKey }   Clerk token + the user's own OpenAI key (BYOK)
 *  agent → parent: { type: "sv:ready" }
 *                  { type: "sv:exported", blob, name, prompt }  rendered MP4 to save to the library */
let token: string | null = null;
/** BYOK: the user's own OpenAI key from SmartVid's API key modal. Memory only. */
let openaiKey: string | null = null;

const post = (msg: Record<string, unknown>) => {
  if (window.parent !== window) window.parent.postMessage(msg, window.location.origin);
};

export const getHostToken = () => token;
export const isEmbedded = () => window.parent !== window;
export const notifyExported = (blob: Blob, name: string, prompt?: string) =>
  post({ type: "sv:exported", blob, name, prompt: prompt ?? "" });

export const initHostBridge = () => {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    const d = e.data as { type?: unknown; token?: unknown; openaiKey?: unknown } | null;
    if (d?.type === "sv:auth") {
      token = typeof d.token === "string" ? d.token : null;
      openaiKey = typeof d.openaiKey === "string" && d.openaiKey.trim() ? d.openaiKey.trim() : null;
    }
  });
  post({ type: "sv:ready" });
};

/** Server endpoint (Netlify Functions v2) replacing the template's Next.js /api/generate. */
export const GENERATE_ENDPOINT = "/.netlify/functions/video-agent-generate";

export const getUserOpenAIKey = () => openaiKey;

/** Generation runs on the user's own OpenAI key (BYOK). */
export const authHeaders = (): Record<string, string> => ({
  ...(openaiKey ? { "X-OpenAI-Key": openaiKey } : {}),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
