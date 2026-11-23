// App-wide tab tools, registered once at start-up: page state/navigation, Brand Studio store, render queue.
import { setBridgeTools } from './index.js';
import { getClerkSessionToken } from '../supabase.js';
import { createAppTools } from './adapters/app.js';
import { createBrandTools } from './adapters/brand.js';
import { createRenderQueueTools } from './adapters/renderQueue.js';
import { getCurrentPage, navigate, isKnownPage } from '../router.js';
import * as brandStore from '../brandStore.js';
import { listRenderQueue, enqueueRender, removeFromRenderQueue, processNextJob } from '../editor/renderQueueStore.js';

export function register() {
  setBridgeTools('app', createAppTools({ getCurrentPage, navigate, isKnownPage }));
  setBridgeTools('brand', createBrandTools(brandStore));
  setBridgeTools('render', createRenderQueueTools({ list: listRenderQueue, enqueue: enqueueRender, remove: removeFromRenderQueue, process: processNextJob }));
}

/** Only offered to signed-in users (the switch would not work for anyone else). Waits briefly for the sign-in session to load. */
export async function registerAppBridgeTools({ tries = 10, delayMs = 2000, signedIn = async () => !!(await getClerkSessionToken()) } = {}) {
  for (let i = 0; i < tries; i++) {
    try { if (await signedIn()) return register(); } catch { /* keep waiting */ }
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
