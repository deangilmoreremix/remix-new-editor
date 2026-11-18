// [remix] Fix C: inspector controls of the effects that have a dedicated editor (Curves, Path Mask, Corner Pin) and colour pickers.
// Rendered by ClipEffectsSection under an opened effect; the preview handles live in fx-edit-overlay.tsx.
import type { Clip, ClipFx } from '@cinegen/types/timeline';
import type { FxDef } from '../../../openchatcut/gl/fx/effects';
import type { ClipPatch } from '@cinegen/lib/editor/stage2/prop-edit';
import { bakeVertexKeys, dataPatch, hasVertexKeys, keyAllAnchorsPatch, sampledFxAt, scalarPatch, setPathPatch } from '@cinegen/lib/occ/fx-edit-model';
import { selectVertex, setMaskTool, useFxEdit } from '@cinegen/lib/occ/fx-edit-store';
import { ellipsePath, pathAt, rectPath, removeVertex } from '../../../openchatcut/gl/fx/s9/pathMask';
import { CORNER_KEYS, propsFromQuad } from '../../../openchatcut/gl/fx/s9/cornerPin';
import { IDENTITY_QUAD } from '../../../openchatcut/gl/fx/s9/homography';
import { FxCurvesEditor } from './fx-curves-editor';

interface Props {
  clip: Clip; index: number; fx: ClipFx; def: FxDef; clipT: number;
  editing: boolean; onToggleEdit: () => void;
  onPatch: (patch: ClipPatch) => void;
}
const btn = { padding: '2px 7px' } as const;

export function FxEditorControls({ clip, index, fx, def, clipT, editing, onToggleEdit, onPatch }: Props) {
  const { tool, selected } = useFxEdit();
  if (def.editor === 'curves') return <FxCurvesEditor props={fx.props} onChange={(values) => onPatch(dataPatch(clip, index, values))} />;
  if (def.editor === 'cornerpin') {
    return (
      <div className="clip-properties-panel__row" style={{ flexWrap: 'wrap', gap: 4 }}>
        <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="fx-edit-toggle" aria-pressed={editing} onClick={onToggleEdit}>{editing ? 'Done editing' : 'Edit corners on preview'}</button>
        <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="cornerpin-reset" title="Reset the four corners to the frame's corners" onClick={() => onPatch(scalarPatch(clip, index, propsFromQuad(IDENTITY_QUAD), clipT, false))}>Reset</button>
        <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="cornerpin-key" title="Add a keyframe for all eight corner values at the playhead" onClick={() => onPatch(scalarPatch(clip, index, Object.fromEntries(CORNER_KEYS.flatMap(([kx, ky]) => { const s = sampledFxAt(clip, index, clipT); return [[kx, num(s[kx], 0)], [ky, num(s[ky], 0)]]; })), clipT, true))}>Key corners</button>
      </div>
    );
  }
  if (def.editor === 'mask') {
    const path = pathAt(sampledFxAt(clip, index, clipT));
    const animated = hasVertexKeys(clip, index);
    const setStructure = (next: ReturnType<typeof pathAt>) => { onPatch(setPathPatch(clip, index, next, clipT, true)); selectVertex(-1); };
    return (
      <div style={{ marginBottom: 4 }}>
        <div className="clip-properties-panel__row" style={{ flexWrap: 'wrap', gap: 4 }}>
          <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="fx-edit-toggle" aria-pressed={editing} onClick={onToggleEdit}>{editing ? 'Done editing' : 'Edit path on preview'}</button>
          {editing && <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-pen" aria-pressed={tool === 'pen'} title="Pen: click on the preview to add points, drag to pull bezier handles" onClick={() => setMaskTool(tool === 'pen' ? 'edit' : 'pen')}>{tool === 'pen' ? 'Pen: on' : 'Pen: off'}</button>}
          {editing && <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-delete-point" disabled={selected < 0 || !path[selected]} onClick={() => setStructure(removeVertex(path, selected))}>Delete point</button>}
        </div>
        <div className="clip-properties-panel__row" style={{ flexWrap: 'wrap', gap: 4 }}>
          <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-new-ellipse" onClick={() => setStructure(ellipsePath())}>Ellipse</button>
          <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-new-rect" onClick={() => setStructure(rectPath())}>Rectangle</button>
          <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-clear" title="Remove all points, then draw with the pen" onClick={() => { setStructure([]); if (editing) setMaskTool('pen'); }}>Clear</button>
          <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-key-points" disabled={path.length < 3} title="Add a keyframe for every point at the playhead; then move the points at other times" onClick={() => onPatch(keyAllAnchorsPatch(clip, index, clipT))}>Key points</button>
          {animated && <button className="clip-properties-panel__toggle-btn" style={btn} data-testid="mask-clear-keys" title="Remove point animation (keeps the shape at the playhead)" onClick={() => onPatch(bakeVertexKeys(clip, index, clipT))}>Clear point keys</button>}
        </div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>{path.length < 3 ? 'Fewer than three points: the mask is off. Use the pen to add points.' : `${path.length} points${animated ? ' (animated)' : ''}. Double-click a point to smooth / sharpen it; Delete removes it.`}</div>
      </div>
    );
  }
  return null;
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
