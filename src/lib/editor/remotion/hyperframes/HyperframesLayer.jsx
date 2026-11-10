/**
 * Timeline layer for a HyperFrames catalog block. Rendered inside the existing sandboxed pages
 * (export-runner / code-preview), by the existing Remotion composition and web renderer.
 *
 * layer = { id, kind: 'hyperframes', from, durationInFrames, blockId, overrides, blockWidth, blockHeight }
 *
 * Only blocks listed in catalog.enabled.json (verified, pinned) are ever executed, and each is checked against its
 * pinned sha256. The adapter chunk is loaded lazily so editors/pages without HyperFrames layers never download it.
 * The block is scaled uniformly to fit (contain) and centred in the composition.
 */
import React, { useEffect, useState } from 'react';
import { useVideoConfig, useDelayRender } from 'remotion';
import enabled from '../../../hyperframes/catalog.enabled.json';

const byId = new Map(enabled.items.map((i) => [i.id, i]));
export const isEnabledBlock = (id) => byId.has(id);

export function HyperframesLayer({ layer }) {
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [mod, setMod] = useState(null);
  const [handle] = useState(() => delayRender('hf-layer-chunk', { timeoutInMilliseconds: 60000 }));
  useEffect(() => {
    let live = true;
    import('./BlockClip.jsx').then((m) => { if (live) setMod(m); }).catch(() => {}).finally(() => continueRender(handle));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const item = byId.get(layer.blockId);
  if (!mod || !item) return null; // unknown or non-enabled blocks render nothing; the editor shows their status instead
  const bw = item.dimensions?.width || layer.blockWidth || 1920, bh = item.dimensions?.height || layer.blockHeight || 1080;
  const k = Math.min(width / bw, height / bh);
  const BlockClip = mod.BlockClip;
  return (
    <div style={{ position: 'absolute', left: (width - bw * k) / 2, top: (height - bh * k) / 2, width: bw, height: bh, transform: `scale(${k})`, transformOrigin: 'top left' }}>
      <BlockClip name={item.id} width={bw} height={bh} overrides={layer.overrides} expectedSha256={item.sourceSha256} />
    </div>
  );
}
