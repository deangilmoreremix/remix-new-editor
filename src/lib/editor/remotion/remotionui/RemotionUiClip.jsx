/**
 * Renders one vendored RemotionUI component (https://remotionui.com, MIT) as a timeline clip. Loaded lazily, runs only in the sandboxed
 * preview / export frames like every other animation layer. The component sees the CLIP's length through useVideoConfig (see shim.ts).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, useDelayRender } from 'remotion';
import { reportCodeError } from '../codeLayer.jsx';
import { LOADERS } from './loaders.generated.js';
import { TEMPLATE_LOADERS } from '../templates/loaders.generated.js';
import { TemplateTextContext } from '../templates/shim.tsx';
import { ClipDurationContext } from './shim.ts';

export const HF_ERROR = '[hyperframes:error] ';
const entryOf = (id) => LOADERS[id] || TEMPLATE_LOADERS[id]; // rui:<name> (RemotionUI) or tpl:<repo>:<name> (vendored template repos: [export, import(), defaultPropsExport])
export const hasRemotionUi = (id) => !!entryOf(id);

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(err) { reportCodeError(this.props.layerId, `${HF_ERROR}"${this.props.title}" could not be rendered correctly (${err?.message || err}).`); }

  render() { return this.state.failed ? null : this.props.children; }
}

export function RemotionUiClip({ layer }) {
  const { delayRender, continueRender } = useDelayRender();
  const [Comp, setComp] = useState(null);
  // The wait handle is taken on commit (not while rendering): React may render this component twice before it commits (Suspense), and a handle
  // created during a discarded render is never released, which makes the export wait for its timeout.
  const handle = useRef(null);
  const release = () => { if (handle.current !== null) { continueRender(handle.current); handle.current = null; } };
  useLayoutEffect(() => { handle.current = delayRender(`rui-${layer.blockId}`, { timeoutInMilliseconds: 60000 }); return release; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const title = layer.title || layer.blockId;
  useEffect(() => {
    let live = true;
    const entry = entryOf(layer.blockId);
    if (!entry) { reportCodeError(layer.id, `${HF_ERROR}"${title}" is not available in this version of the editor and was not rendered.`); release(); return undefined; }
    entry[1]().then((m) => { const C = m[entry[0]]; if (typeof C !== 'function' && typeof C !== 'object') throw new Error(`missing export ${entry[0]}`); if (live) setComp({ C, defaults: entry[2] ? m[entry[2]] : undefined }); })
      .catch((e) => reportCodeError(layer.id, `${HF_ERROR}"${title}" could not be loaded (${e?.message || e}).`))
      .finally(release);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.blockId]);
  if (!Comp) return null;
  return (
    <Boundary layerId={layer.id} title={title}>
      <ClipDurationContext.Provider value={layer.durationInFrames}>
        <TemplateTextContext.Provider value={layer.overrides || {}}>
          <AbsoluteFill><Comp.C {...(Comp.defaults || {})} {...(layer.overrides || {})} /></AbsoluteFill>
        </TemplateTextContext.Provider>
      </ClipDurationContext.Provider>
    </Boundary>
  );
}
