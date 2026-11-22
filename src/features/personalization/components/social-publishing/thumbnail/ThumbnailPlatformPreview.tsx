'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PLATFORM_ZONES, type DesignProject, type PlatformId } from './designer/model';
import { renderProject, type RenderAssets } from './designer/render';
import { coverFit } from './designer/coverFit';
import { loadImage } from './designer/designerAssets';

const TILES: { id: PlatformId; width: number }[] = [
  { id: 'youtube', width: 168 },
  { id: 'square', width: 92 },
  { id: 'portrait', width: 76 },
  { id: 'reels', width: 58 },
];

/** Share of each edge the platforms may trim or cover on small screens. */
const SAFE_INSET = 0.04;

function ProjectCanvas({ project, assets, width, height, label }: { project: DesignProject; assets: RenderAssets; width: number; height: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pxW = width * 2;
  const pxH = height * 2;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    // Centre-crop (cover) the whole design into the platform's shape, as the platform does.
    const fit = coverFit(project.width, project.height, pxW, pxH);
    ctx.save();
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.dx, fit.dy);
    renderProject(ctx, project, assets);
    ctx.restore();
  }, [project, assets, pxW, pxH]);
  return <canvas ref={ref} role="img" aria-label={label} data-testid="platform-preview-canvas" width={pxW} height={pxH} className="block h-full w-full" />;
}

function Overlays({ id }: { id: PlatformId }) {
  const zones = PLATFORM_ZONES[id];
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute" data-testid="safe-area" style={{ inset: `${SAFE_INSET * 100}%`, border: '1px dashed rgba(217,255,0,0.85)' }} />
      {zones.covered.map((z) => (
        <div key={z.label} aria-hidden data-testid="covered-zone" title={z.label} className="pointer-events-none absolute" style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, background: 'rgba(239,68,68,0.28)', border: '1px dashed rgba(248,113,113,0.9)' }} />
      ))}
    </>
  );
}

/**
 * Shows how the thumbnail looks on each platform: cropped to that platform's shape, with the parts the
 * platform covers (YouTube's duration badge, the Reels/TikTok caption strip and buttons) and the safe area marked.
 * Pass the layered `project` to see the real design (text and layers); otherwise the flat `imageUrl` is shown.
 */
export default function ThumbnailPlatformPreview({ imageUrl, project, assets }: { imageUrl?: string | null; project?: DesignProject | null; assets?: RenderAssets }) {
  const [safe, setSafe] = useState(true);
  const [own, setOwn] = useState<RenderAssets>({});
  const [failed, setFailed] = useState<Record<string, true>>({});

  // Without ready-made pictures (the step, not the designer) load what the design references.
  useEffect(() => {
    if (!project || assets) return;
    let live = true;
    const srcs = new Set<string>();
    if (project.background.imageSrc) srcs.add(project.background.imageSrc);
    for (const l of project.layers) if (l.kind === 'image') srcs.add(l.src);
    srcs.forEach((src) => {
      loadImage(src).then((img) => { if (live) setOwn((prev) => (prev[src] ? prev : { ...prev, [src]: img })); }).catch(() => { if (live) setFailed((prev) => ({ ...prev, [src]: true })); });
    });
    return () => { live = false; };
  }, [project, assets]);

  // A design with a missing picture would show an incomplete thumbnail; the exported picture is what is attached.
  const incomplete = !!project && !!imageUrl && !assets && (project.background.mode === 'image' && !!project.background.imageSrc && !!failed[project.background.imageSrc] || project.layers.some((l) => l.kind === 'image' && !l.hidden && failed[l.src]));
  const useProject = !!project && !incomplete;
  if (!useProject && !imageUrl) return null;
  const pics = assets ?? own;

  return (
    <div data-testid="thumbnail-platform-preview" className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] text-white/50">
        <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
        Show safe areas and what the platform covers
      </label>
      <div className="flex flex-wrap items-end gap-3">
        {TILES.map((t) => {
          const zones = PLATFORM_ZONES[t.id];
          const height = Math.round(t.width / zones.ratio);
          const label = `${zones.label} crop preview`;
          const tile = (
            <div className="relative overflow-hidden" style={{ width: t.width, height, borderRadius: t.id === 'reels' ? 8 : 6, background: '#000' }}>
              {useProject ? (
                <ProjectCanvas project={project!} assets={pics} width={t.width} height={height} label={label} />
              ) : (
                <img src={imageUrl!} alt={label} className="h-full w-full object-cover" />
              )}
              {safe && <Overlays id={t.id} />}
              {t.id === 'youtube' && (
                <span data-testid="duration-badge" className="absolute rounded px-1 text-[9px] font-semibold text-white" style={{ right: 4, bottom: 4, background: 'rgba(0,0,0,0.82)' }}>12:34</span>
              )}
            </div>
          );
          return (
            <figure key={t.id} className="m-0">
              {t.id === 'reels' ? (
                <div data-testid="phone-frame" className="rounded-[14px] p-[3px]" style={{ background: '#111', border: '2px solid rgba(255,255,255,0.35)' }}>
                  <div aria-hidden className="mx-auto mb-[3px] h-[3px] w-5 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
                  {tile}
                </div>
              ) : (
                <div className="rounded-md border border-white/10">{tile}</div>
              )}
              <figcaption className="mt-1 text-center text-[9px] text-white/35">{zones.label}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
