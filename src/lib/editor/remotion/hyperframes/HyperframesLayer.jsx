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
import React, { useEffect, useRef, useState } from 'react';
import { useVideoConfig, useDelayRender } from 'remotion';
import enabled from '../../../hyperframes/catalog.enabled.json';
import { reportCodeError } from '../codeLayer.jsx';
import { componentHostHtml, routeVarsToInstance } from './host.js';

const byId = new Map(enabled.items.map((i) => [i.id, i]));
export const isEnabledBlock = (id) => byId.has(id);

/** Messages sent through the existing code-layer error bus carry this prefix so the editor (toast) and the export (fail-closed) can tell fatal problems from notes. */
export const HF_ERROR = '[hyperframes:error] ';
export const HF_NOTE = '[hyperframes:note] ';

const RuiClip = React.lazy(() => import('../remotionui/RemotionUiClip.jsx').then((m) => ({ default: m.RemotionUiClip })));

export function HyperframesLayer({ layer }) {
  // RemotionUI items share this layer kind (blockId "rui:<name>") so the lane, persistence, toasts, kill switch and export gating are the same
  if (String(layer.blockId || '').startsWith('rui:')) {
    if (layer.runtimeDisabled) { reportCodeError(layer.id, `${HF_ERROR}"${layer.title || layer.blockId}" was not rendered: Animations are temporarily switched off. Your project data is unchanged.`); return null; }
    return <React.Suspense fallback={null}><RuiClip layer={layer} /></React.Suspense>;
  }
  return <HyperframesBlockLayer layer={layer} />;
}

function HyperframesBlockLayer({ layer }) {
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
  const fatal = useRef(false);
  const title = layer.title || layer.blockId;
  useEffect(() => { // problems that exist before the adapter runs: emergency disable, unknown or no-longer-pinned block
    if (layer.runtimeDisabled) { fatal.current = true; reportCodeError(layer.id, `${HF_ERROR}"${title}" was not rendered: Animations are temporarily switched off. Your project data is unchanged.`); }
    else if (!item) { fatal.current = true; reportCodeError(layer.id, `${HF_ERROR}"${title}" is not available in this version of the editor and was not rendered.`); }
  }, [layer.id, layer.runtimeDisabled, !!item]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // adapter problems while mounting the block
    if (!mod || layer.runtimeDisabled) return undefined;
    return mod.onHyperframesError((e) => {
      if (e.name !== layer.blockId && !String(e.name).startsWith(layer.blockId)) return;
      if (e.fatal) { fatal.current = true; reportCodeError(layer.id, `${HF_ERROR}"${title}" could not be rendered correctly (${e.kind}: ${e.message}).`); }
      else if (!fatal.current) reportCodeError(layer.id, `${HF_NOTE}"${title}": ${e.message}`);
    });
  }, [mod, layer.id, layer.blockId, layer.runtimeDisabled]); // eslint-disable-line react-hooks/exhaustive-deps
  if (layer.runtimeDisabled || !mod || !item) return null; // unknown or non-enabled blocks render nothing; the editor shows their status instead
  const bw = item.dimensions?.width || layer.blockWidth || 1920, bh = item.dimensions?.height || layer.blockHeight || 1080;
  const k = Math.min(width / bw, height / bh);
  const BlockClip = mod.BlockClip;
  // components are mounted through a generated host; starter projects through their own pinned index.html
  const isHost = item.project?.host === true;
  const project = isHost ? { dir: item.project.dir, files: item.project.files, hostHtml: componentHostHtml({ id: item.id, duration: item.duration, width: bw, height: bh }) } : item.project;
  // a component shown through its own demo composition mounts the component as a nested instance: its variables are addressed by that instance
  const overrides = isHost ? routeVarsToInstance(layer.overrides) : (item.project?.instance ? routeVarsToInstance(layer.overrides, item.project.instance) : layer.overrides);
  return (
    <div style={{ position: 'absolute', left: (width - bw * k) / 2, top: (height - bh * k) / 2, width: bw, height: bh, transform: `scale(${k})`, transformOrigin: 'top left' }}>
      <BlockClip name={item.id} width={bw} height={bh} overrides={overrides} expectedSha256={item.sourceSha256} project={project} />
    </div>
  );
}
