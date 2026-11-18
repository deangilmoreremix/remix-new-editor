import { rewrittenStudioPrompt, type StudioRewriteRequest, type StudioRewriteResult } from './prompt-rewrite';

async function requestRewrite(input: StudioRewriteRequest, signal: AbortSignal): Promise<StudioRewriteResult> {
  // [remix] The prompt editor runs on the user's own OpenAI key (no CineGen cloud account).
  signal.throwIfAborted();
  if (window.electronAPI?.prompts) return window.electronAPI.prompts.rewrite(input, '');
  const token = '';
  if (window.location.protocol === 'file:' || /Electron\//.test(navigator.userAgent)) throw new Error('Install the latest Timeline Studio Editor Mac build to use the AI prompt editor.');
  const response = await fetch('https://cinegen-api.christopherjohnogden.workers.dev/api/rpc/prompts/rewrite', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-cinegen-id-token': token, 'x-cinegen-origin': 'https://cinegen-film.vercel.app' },
    body: JSON.stringify({ args: [input] }), signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error?.message || 'The AI editor could not connect. Try again to recover this rewrite.');
  return data.result;
}

export async function rewriteStudioPrompt(input: StudioRewriteRequest, signal: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    signal.throwIfAborted();
    const result = await requestRewrite(input, signal);
    signal.throwIfAborted();
    if (result.status === 'complete') return rewrittenStudioPrompt({ prompt: result.text });
    if (result.status === 'error') throw Object.assign(new Error(result.error || 'The AI could not finish. Your prompt is unchanged.'), { rewriteFinished: true });
    await new Promise<void>((resolve, reject) => {
      const stop = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, 2000);
      signal.addEventListener('abort', stop, { once: true });
    });
  }
  throw new Error('The AI is still working. Try again to check this same rewrite.');
}
