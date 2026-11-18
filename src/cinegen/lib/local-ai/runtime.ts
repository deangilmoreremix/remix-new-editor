// [remix] Port I1: app-wide singletons (cache, consent, worker client, manager). Created lazily so importing this file has no side effects.
import { detectCapabilities } from './capabilities';
import { ConsentStore } from './consent';
import { ModelManager } from './manager';
import { ModelCache, idbBlobStore } from './model-cache.js';
import { LocalAiClient } from './worker-client';

let rt: { cache: ModelCache; consent: ConsentStore; client: LocalAiClient; manager: ModelManager } | null = null;
export function localAi() {
  if (!rt) {
    const cache = new ModelCache(idbBlobStore()); const consent = new ConsentStore(); const client = new LocalAiClient();
    const manager = new ModelManager({ cache, consent, loader: client, capabilities: detectCapabilities });
    void manager.refresh().catch(() => undefined);
    rt = { cache, consent, client, manager };
  }
  return rt;
}
