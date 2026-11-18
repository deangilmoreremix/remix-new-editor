'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { clampLayer, hitTest, resizeLayer, rotationFromPointer, updateLayer, type DesignProject, type Handle, type Layer } from './model';
import { renderProject, type RenderAssets } from './render';

const HANDLES: { handle: Handle; x: number; y: number; cursor: string }[] = [
  { handle: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { handle: 'n', x: 50, y: 0, cursor: 'ns-resize' },
  { handle: 'ne', x: 100, y: 0, cursor: 'nesw-resize' },
  { handle: 'e', x: 100, y: 50, cursor: 'ew-resize' },
  { handle: 'se', x: 100, y: 100, cursor: 'nwse-resize' },
  { handle: 's', x: 50, y: 100, cursor: 'ns-resize' },
  { handle: 'sw', x: 0, y: 100, cursor: 'nesw-resize' },
  { handle: 'w', x: 0, y: 50, cursor: 'ew-resize' },
];

type Gesture = { started: boolean; start: { x: number; y: number }; orig: Layer } & ({ mode: 'move' } | { mode: 'resize'; handle: Handle } | { mode: 'rotate' });

export interface DesignerStageProps {
  project: DesignProject;
  assets: RenderAssets;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called before the first change of a gesture so the caller can record an undo step. */
  onGestureStart: (key?: string) => void;
  onChange: (project: DesignProject) => void;
  onDelete: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

/** The editing canvas: draws the project and turns pointer / keyboard input into layer changes. */
export default function DesignerStage({ project, assets, selectedId, onSelect, onGestureStart, onChange, onDelete, onUndo, onRedo }: DesignerStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // Pointer handlers read the latest project without being re-created on every drag step.
  const projectRef = useRef(project);
  useLayoutEffect(() => { projectRef.current = project; }, [project]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) renderProject(ctx, project, assets, { guides: true, selectedId });
  }, [project, assets, selectedId]);

  const toCanvas = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const p = projectRef.current;
    return { x: ((e.clientX - rect.left) * p.width) / (rect.width || p.width), y: ((e.clientY - rect.top) * p.height) / (rect.height || p.height) };
  }, []);

  const selected = selectedId ? project.layers.find((l) => l.id === selectedId) ?? null : null;
  const editable = !!selected && !selected.locked && !selected.hidden;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button > 0) return;
    wrapRef.current?.focus();
    const pt = toCanvas(e);
    const target = e.target as HTMLElement;
    const handleEl = target.closest?.('[data-handle]') as HTMLElement | null;
    const p = projectRef.current;
    if (handleEl && selected && editable) {
      gesture.current = handleEl.dataset.handle === 'rotate'
        ? { mode: 'rotate', started: false, start: pt, orig: selected }
        : { mode: 'resize', handle: handleEl.dataset.handle as Handle, started: false, start: pt, orig: selected };
    } else {
      const hit = hitTest(p, pt.x, pt.y);
      onSelect(hit ? hit.id : null);
      if (!hit) { gesture.current = null; return; }
      gesture.current = { mode: 'move', started: false, start: pt, orig: hit };
    }
    try { wrapRef.current?.setPointerCapture?.(e.pointerId); } catch { /* not capturable (synthetic event) */ }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = projectRef.current;
    const pt = toCanvas(e);
    const dx = pt.x - g.start.x;
    const dy = pt.y - g.start.y;
    if (!g.started) {
      if (g.mode === 'move' && Math.abs(dx) < 1 && Math.abs(dy) < 1) return; // a click, not a drag
      g.started = true;
      onGestureStart(); // one undo step per gesture, recorded when it really changes something
    }
    let next: Layer;
    if (g.mode === 'move') next = clampLayer(p, { ...g.orig, x: g.orig.x + dx, y: g.orig.y + dy } as Layer);
    else if (g.mode === 'resize') next = resizeLayer(g.orig, g.handle, dx, dy, { keepAspect: g.orig.kind === 'image' || e.shiftKey });
    else next = { ...g.orig, rotation: rotationFromPointer(g.orig, pt.x, pt.y, e.shiftKey ? 15 : 0) } as Layer;
    onChange(updateLayer(p, g.orig.id, { x: next.x, y: next.y, w: next.w, h: next.h, rotation: next.rotation }));
  };

  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    gesture.current = null;
    try { wrapRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) onRedo(); else onUndo();
      return;
    }
    if (!selected) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (!selected.locked) onDelete(selected.id);
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const delta = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : e.key === 'ArrowDown' ? [0, step] : null;
    if (!delta) return;
    e.preventDefault();
    if (selected.locked || selected.hidden) return;
    onGestureStart('nudge');
    const moved = clampLayer(project, { ...selected, x: selected.x + delta[0], y: selected.y + delta[1] } as Layer);
    onChange(updateLayer(project, selected.id, { x: moved.x, y: moved.y }));
  };

  return (
    <div className="flex justify-center">
      <div
        ref={wrapRef}
        data-testid="designer-stage"
        role="application"
        tabIndex={0}
        aria-label="Thumbnail canvas. Drag layers to move them. Arrow keys nudge the selected layer, Delete removes it."
        className="relative select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#d9ff00]"
        style={{ width: `min(100%, calc(62vh * ${project.width / project.height}))`, aspectRatio: `${project.width} / ${project.height}`, touchAction: 'none', background: '#000', cursor: 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} data-testid="designer-canvas" width={project.width} height={project.height} className="block h-full w-full rounded-lg" />
        {selected && editable && (
          <div
            data-testid="designer-handles"
            className="pointer-events-none absolute"
            style={{
              left: `${(selected.x / project.width) * 100}%`,
              top: `${(selected.y / project.height) * 100}%`,
              width: `${(selected.w / project.width) * 100}%`,
              height: `${(selected.h / project.height) * 100}%`,
              transform: `rotate(${selected.rotation}deg)`,
              transformOrigin: 'center',
            }}
          >
            <span aria-hidden className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-[#d9ff00]" style={{ height: 22, top: -22 }} />
            <button type="button" tabIndex={-1} data-handle="rotate" aria-label="Rotate layer" className="pointer-events-auto absolute left-1/2 h-[18px] w-[18px] -translate-x-1/2 rounded-full border-2 border-[#d9ff00] bg-black" style={{ top: -30, cursor: 'grab', touchAction: 'none' }} />
            {HANDLES.map((h) => (
              <button
                key={h.handle}
                type="button"
                tabIndex={-1}
                data-handle={h.handle}
                aria-label={`Resize ${h.handle}`}
                className="pointer-events-auto absolute h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-[4px] border-2 border-[#d9ff00] bg-white"
                style={{ left: `${h.x}%`, top: `${h.y}%`, cursor: h.cursor, touchAction: 'none' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
