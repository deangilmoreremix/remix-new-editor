'use client';

import { audioReport, measureRenderedAudio } from '../lib/renderedAudio';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { semantic } from '../../../shared/styles/designTokens';
import { ActivityList, ChatBubble, PlanCard } from '../../design-agent/ui';
import { sceneDetail } from '../lib/coCreate';
import { motionTemplateTitle, resolveMotionTemplate, type MotionTemplate } from '../../../data/motionRecipeCatalog';
import { BRAND_SCENES, isBrandScene } from '../lib/directorPlan';
import { MainComposition } from '../preview/Composition';
import { projectDuration, projectEndFrame, type ProjectData } from '../types';
import { specMarkdown } from '../lib/designSpec';
import { createDownloadUrl, exportMp4, formatEta, guardTabWhileRendering, isChromiumBrowser, supportsHtmlInCanvas } from '../webRenderer';
import { t } from '../i18n';
import { estimateExportSec } from '../lib/exportCost';
import { drawsSampleScreen, isProductTextureShot } from '../lib/productShots';
import { RecipePreview } from './RecipePreview';
import type { SiteCapture } from '../lib/directorClient';
import { buildCatalogue } from '../lib/pictureCatalogue';
import { assignPictures } from '../lib/assignPictures';
import type { FilmChatMessage, FilmDirector } from './useFilmDirector';
import type { FilmStep, FilmStepState } from '../lib/filmSteps';

/**
 * The film conversation as it appears in chat: messages, the Ink Press
 * question, the storyboard card (approve / revise), progress, and the finished
 * film — a player, Render MP4, and Open in Motion Workbench.
 */

const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const FilmMessage: React.FC<{ message: Pick<FilmChatMessage, 'role' | 'content' | 'ts'> }> = ({ message }) => (
  <ChatBubble
    role={message.role}
    preWrap
    below={<div className={`text-[10px] ${message.role === 'user' ? 'text-right' : ''}`} style={{ color: semantic.textMuted }}>{clock(message.ts)}</div>}
  >
    {message.content}
  </ChatBubble>
);

const choiceStyle = (primary: boolean): React.CSSProperties =>
  primary
    ? { background: 'var(--color-primary)', color: 'white' }
    : { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: semantic.textSecondary };

/** Downloads the film's design spec as Markdown. */
const SpecLink: React.FC<{ spec: NonNullable<ProjectData['spec']> }> = ({ spec }) => {
  const url = useMemo(() => URL.createObjectURL(new Blob([specMarkdown(spec)], { type: 'text/markdown' })), [spec]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <a href={url} download={`${spec.product.replace(/[^\w-]+/g, '-').slice(0, 40) || 'film'}-design-spec.md`} className="px-3 py-2 rounded-lg text-xs" style={choiceStyle(false)} data-testid="film-spec">
      Design spec
    </a>
  );
};

/** Player + MP4 render + hand-off to the workbench for a built film. */
export const FilmResultCard: React.FC<{ project: ProjectData; onOpenWorkbench?: () => void; openLabel?: string }> = ({ project, onOpenWorkbench, openLabel = 'Open in Motion Workbench' }) => {
  const [render, setRender] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; progress: number; etaMs?: number | null; url?: string; error?: string; draft?: boolean; noMusic?: boolean }>({ status: 'idle', progress: 0 });
  const [fasterExportHint] = useState(() => isChromiumBrowser() && !supportsHtmlInCanvas());
  const abort = useRef<AbortController | null>(null);
  const inputProps = useMemo(() => ({ project }), [project]);
  useEffect(() => () => {
    abort.current?.abort();
  }, []);
  useEffect(() => () => {
    if (render.url) URL.revokeObjectURL(render.url);
  }, [render.url]);

  const [audioNote, setAudioNote] = useState<string[]>([]);
  /** `draft`: render at 2/3 size (1080p → 720p), about twice as fast — for long films and quick checks. */
  const start = async (draft = false, withoutMusic = false) => {
    abort.current = new AbortController();
    setRender({ status: 'running', progress: 0, draft });
    setAudioNote([]);
    // Same path as the toolbar export: browser check, then the Remotion web renderer in this tab.
    const releaseGuard = guardTabWhileRendering();
    try {
      const result = await exportMp4({
        // Without music: the film keeps its sound effects (a second version for the person's own music).
        project: withoutMusic ? { ...project, tracks: project.tracks.filter((track) => track.name !== t('track.music')) } : project,
        scale: draft ? 2 / 3 : 1,
        signal: abort.current.signal,
        onProgress: (progress, info) => setRender((r) => (r.status === 'running' ? { ...r, progress, etaMs: info?.etaMs ?? null } : r)),
      });
      setRender({ status: 'done', progress: 1, url: createDownloadUrl(result.blob), draft, noMusic: withoutMusic });
      // Measure the sound of the file that was just made (the preview cannot show clipping).
      void measureRenderedAudio(result.blob).then((stats) => stats && setAudioNote(audioReport(stats)));
    } catch (error) {
      const cancelled = abort.current?.signal.aborted;
      setRender({ status: cancelled ? 'idle' : 'error', progress: 0, error: cancelled ? undefined : error instanceof Error ? error.message : String(error) });
    } finally {
      releaseGuard();
    }
  };

  const fileName = `${(project.name || 'motion-studio-film').replace(/[^\w-]+/g, '-').slice(0, 60)}${render.draft ? '-draft-720p' : ''}${render.noMusic ? '-nobgm' : ''}.mp4`;
  const hasMusic = project.tracks.some((track) => track.name === t('track.music') && track.clips.length > 0);
  const filmSec = projectEndFrame(project) / project.fps;
  const draftSize = `${Math.round((project.width * 2) / 3)}×${Math.round((project.height * 2) / 3)}`;

  return (
    <div className="rounded-2xl p-3 space-y-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.28)' }} data-testid="film-result">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold" style={{ color: '#86efac' }}>FINAL FILM</div>
          <div className="text-sm font-semibold">{project.name}</div>
        </div>
        <div className="text-[11px]" style={{ color: semantic.textSecondary }}>
          {project.width}×{project.height} · {project.fps} fps · h264
        </div>
      </div>
      <div className="overflow-hidden rounded-xl" style={{ aspectRatio: `${project.width} / ${project.height}`, maxHeight: 420, background: '#000' }}>
        <Player
          component={MainComposition}
          inputProps={inputProps}
          durationInFrames={projectDuration(project)}
          compositionWidth={project.width}
          compositionHeight={project.height}
          fps={project.fps}
          controls
          numberOfSharedAudioTags={32}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {render.status === 'running' ? (
          <>
            <button type="button" disabled className="px-4 py-2 rounded-lg text-xs font-semibold opacity-70" style={choiceStyle(true)}>
              Rendering… {Math.round(render.progress * 100)}%
            </button>
            <button type="button" onClick={() => abort.current?.abort()} className="px-3 py-2 rounded-lg text-xs" style={choiceStyle(false)}>Cancel</button>
          </>
        ) : render.status === 'done' && render.url ? (
          <>
            <a href={render.url} download={fileName} className="px-4 py-2 rounded-lg text-xs font-semibold" style={choiceStyle(true)} data-testid="film-download">
              Download MP4{render.draft ? ` (draft ${draftSize})` : ''}
            </a>
            {project.spec && <SpecLink spec={project.spec} />}
            {audioNote.length > 0 && <div className="w-full text-[11px]" style={{ color: semantic.textSecondary }} data-testid="film-audio-check">{audioNote.join(' ')}</div>}
            {render.draft && (
              <button type="button" onClick={() => void start(false)} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)}>
                Render full {project.width}×{project.height}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => void start(false)} className="px-4 py-2 rounded-lg text-xs font-semibold" style={choiceStyle(true)} data-testid="film-render">
              {render.status === 'error' ? 'Render failed — retry' : 'Render MP4'}
            </button>
            <button
              type="button"
              onClick={() => void start(true)}
              className="px-4 py-2 rounded-lg text-xs"
              style={choiceStyle(false)}
              data-testid="film-render-draft"
              title={`Same frames at ${draftSize} — about twice as fast${filmSec > 20 ? ', handy for a long film' : ''}`}
            >
              Fast draft · {draftSize}
            </button>
            {hasMusic && (
              <button type="button" onClick={() => void start(false, true)} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)} data-testid="film-render-nomusic" title="Same film without the music bed, sound effects kept: for your own music">
                Render without music
              </button>
            )}
            {fasterExportHint && (
              <span className="text-[11px]" style={{ color: semantic.textMuted }} data-testid="film-faster-hint" title="Chrome's experimental HTML-in-canvas lets the renderer draw the page natively; it is off by default.">
                Faster export: in Chrome, search “canvas draw element” in chrome://flags, enable it and restart.
              </span>
            )}
            <span className="text-[11px]" style={{ color: semantic.textMuted }} data-testid="film-estimate" title="Rough export time on a slow computer; most machines are faster.">
              ~{Math.max(1, Math.round(estimateExportSec(project) / 60))} min to render
            </span>
          </>
        )}
        {onOpenWorkbench && (
          <button
            type="button"
            onClick={() => {
              // Leaving this view unmounts the card and stops its render: ask first.
              if (render.status === 'running' && !window.confirm('The MP4 is still rendering and leaving will cancel it. Open the workbench anyway?')) return;
              onOpenWorkbench();
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold"
            style={choiceStyle(false)}
            data-testid="film-open-workbench"
          >
            {openLabel}
          </button>
        )}
        {render.status === 'running' && (
          <span className="text-[11px]" style={{ color: semantic.textSecondary }} data-testid="film-render-status">
            Rendering in this tab with the Remotion web renderer — keep it open.{render.etaMs ? ` ${formatEta(render.etaMs)}.` : ''}
          </span>
        )}
        {render.status === 'error' && <span className="text-[11px]" style={{ color: '#fca5a5' }}>{render.error}</span>}
      </div>
    </div>
  );
};

const STEP_COLORS: Record<FilmStepState, { border: string; num: string; label: string }> = {
  todo: { border: 'var(--border-color)', num: semantic.textMuted, label: 'Waiting' },
  active: { border: 'rgba(232,176,92,0.7)', num: '#e8b05c', label: 'Working…' },
  done: { border: 'rgba(34,197,94,0.45)', num: '#86efac', label: 'Done' },
  skipped: { border: 'var(--border-color)', num: semantic.textMuted, label: 'Skipped' },
  error: { border: 'rgba(248,113,113,0.6)', num: '#fca5a5', label: 'Problem' },
};

/** The seven workflow steps — Product → Capture → Storyboard → Animate → Beat sync → Frame QA → Deliver — with live state. */
export const FilmSteps: React.FC<{ steps: FilmStep[] }> = ({ steps }) => (
  <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2" data-testid="film-steps" aria-label="Film workflow">
    {steps.map((step, i) => {
      const c = STEP_COLORS[step.state];
      return (
        <li
          key={step.id}
          data-step={step.id}
          data-state={step.state}
          className="rounded-xl p-2.5 min-w-0"
          style={{ background: 'var(--bg-card)', border: `1px solid ${c.border}`, opacity: step.state === 'todo' || step.state === 'skipped' ? 0.65 : 1 }}
          title={step.detail ?? c.label}
        >
          <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: c.num }}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <span>{step.state === 'active' ? '●' : step.state === 'done' ? '✓' : step.state === 'error' ? '!' : ''}</span>
          </div>
          <div className="mt-1 text-xs font-semibold truncate">{step.title}</div>
          <div className="text-[10px] truncate" style={{ color: semantic.textMuted }}>{step.sub}</div>
          <div className="mt-1 text-[10px] leading-snug line-clamp-2" style={{ color: semantic.textSecondary }}>{step.detail ?? c.label}</div>
        </li>
      );
    })}
  </ol>
);

export interface FilmDirectorChatProps {
  director: FilmDirector;
  /** Messages to show before the director's own (e.g. the session history). */
  history?: Array<Pick<FilmChatMessage, 'role' | 'content' | 'ts'>>;
  /** Hide the director's own messages (when they are already mirrored into `history`). */
  hideOwnMessages?: boolean;
  onOpenWorkbench?: () => void;
  openLabel?: string;
  /** Opens the Templates picker so shots can be chosen by hand. */
  onPickShots?: () => void;
  /** Called after "New film" clears the conversation (the parent clears its own unsent picks). */
  onNewFilm?: () => void;
  /** Show the finished-film card (off in the workbench, where the film is already loaded). */
  showFilm?: boolean;
}

export const FilmDirectorChat: React.FC<FilmDirectorChatProps> = ({ director, history = [], hideOwnMessages, onOpenWorkbench, openLabel, onPickShots, onNewFilm, showFilm = true }) => {
  const { messages, stage, activity, steps, storyboard, film } = director;
  const shown = hideOwnMessages ? history : [...history, ...messages];
  const plan = storyboard?.plan;
  // The pictures each scene will show (the same assignment the build uses), for the storyboard thumbnails.
  const scenePictures = useMemo(() => (plan && storyboard?.capture ? assignPictures(plan, buildCatalogue(storyboard.capture)) : []), [plan, storyboard?.capture]);
  const videos = storyboard?.videos ?? [];
  /** Attached videos sit just before the closing scene, where the build places them. */
  const withVideos = <T,>(steps: T[]): Array<T | { key: string; label: string; detail: string }> => {
    const out: Array<T | { key: string; label: string; detail: string }> = steps.slice();
    out.splice(steps.length > 1 ? steps.length - 1 : steps.length, 0, ...videos.map((v, i) => ({ key: `video-${i}`, label: 'Your video', detail: `${v.sec}s · ${v.name}` })));
    return out;
  };
  return (
    <div className="flex flex-col gap-3" data-testid="film-chat">
      {steps.some((s) => s.state !== 'todo') && (
        // Pinned while the conversation scrolls, so the seven steps stay in view.
        <div className="sticky -top-3 sm:-top-4 z-10 -mx-1 -mt-3 sm:-mt-4 px-1 pt-3 sm:pt-4 pb-1" style={{ background: 'var(--bg-app, #0b0b0d)' }}>
          <FilmSteps steps={steps} />
        </div>
      )}
      {shown.map((m, i) => <FilmMessage key={`${m.ts}-${i}`} message={m} />)}
      {stage === 'offer' && (
        <div className="flex flex-wrap gap-2" data-testid="inkpress-offer">
          <button type="button" onClick={() => director.chooseTemplate('inkpress')} className="px-4 py-2 rounded-lg text-xs font-semibold" style={choiceStyle(true)}>Use Ink Press</button>
          <button type="button" onClick={() => director.chooseTemplate('director')} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)}>Let the director pick shots</button>
          <button type="button" onClick={director.coCreate} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)} data-testid="cocreate-start" title="The director proposes a product check, a look and a shot plan; you confirm each step">Work it out together</button>
          {onPickShots && <button type="button" onClick={onPickShots} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)}>Choose shot cards…</button>}
        </div>
      )}
      {(stage === 'brief' || stage === 'direction' || stage === 'mapping') && (
        <div className="flex flex-wrap gap-2" data-testid="guided-choices" data-step={stage}>
          {stage === 'direction'
            ? ['A', 'B', 'C'].slice(0, 3).map((letter) => (
                <button key={letter} type="button" onClick={() => director.send(letter)} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)}>Use {letter}</button>
              ))
            : null}
          <button type="button" onClick={() => director.send('looks right')} className="px-4 py-2 rounded-lg text-xs font-semibold" style={choiceStyle(true)} data-testid="guided-accept">
            {stage === 'brief' ? 'Looks right — next' : stage === 'direction' ? 'Use my recommendation' : 'Looks right — write the storyboard'}
          </button>
          <button type="button" onClick={() => director.send('you decide')} className="px-4 py-2 rounded-lg text-xs" style={choiceStyle(false)} data-testid="guided-decide">You decide</button>
        </div>
      )}
      {(stage === 'storyboarding' || stage === 'building') && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: semantic.textSecondary }} role="status">
            {stage === 'storyboarding' ? 'Storyboarding…' : 'Building the film…'}
          </span>
          <button type="button" onClick={director.stop} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.5)', color: '#fca5a5' }} data-testid="film-stop">
            ■ Stop
          </button>
        </div>
      )}
      {(stage === 'offer' || stage === 'brief' || stage === 'direction' || stage === 'mapping' || stage === 'plan' || stage === 'film') && (
        <div>
          <button type="button" onClick={() => { director.reset(); onNewFilm?.(); }} className="px-3 py-1.5 rounded-lg text-xs" style={choiceStyle(false)} data-testid="film-new" title="Clear this conversation and start a different film">
            ↺ New film
          </button>
        </div>
      )}
      {(stage === 'direction' || stage === 'plan') && director.styleframes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-color)' }} data-testid="film-styleframes">
          <span className="text-[11px]" style={{ color: semantic.textMuted }}>
            {stage === 'plan' ? 'Styleframes of the chosen direction (the opening, your site, the close), before any video is made:' : "The options as frames (a real page and the closing logo in each direction's colours):"}
          </span>
          <div className="flex flex-wrap gap-3">
            {director.styleframes.map((sf, i) => (
              <div key={sf.direction + i} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold" style={{ color: semantic.textSecondary }}>{stage === 'plan' ? sf.direction : `${String.fromCharCode(65 + i)} · ${sf.direction}`}</span>
                <div className="flex gap-1">
                  {sf.frames.map((src, k) => (
                    <img key={src} src={src} alt={`${sf.direction}, frame ${k + 1}`} className="h-20 rounded object-cover" style={{ border: '1px solid var(--border-color)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activity.length > 0 && <ActivityList items={activity} />}
      {storyboard?.capture && (storyboard.capture.logo || storyboard.capture.images?.length) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-color)' }} data-testid="site-assets">
          <span className="text-[11px] mr-1" style={{ color: semantic.textMuted }}>From {storyboard.capture.title || 'your site'}:</span>
          {storyboard.capture.logo && (
            <img src={storyboard.capture.logo} alt="Site logo" title="Logo — goes on the title cards" className="h-10 max-w-[140px] rounded object-contain p-1" style={{ background: '#fff' }} />
          )}
          {(storyboard.capture.images ?? []).map((src, i) => (
            <img key={src} src={src} alt={`Site image ${i + 1}`} title="Site image — used in the product shots" className="h-10 w-16 rounded object-cover" />
          ))}
        </div>
      ) : null}
      {plan && (stage === 'plan' || stage === 'building') && (
        <PlanCard
          testId="director-plan"
          eyebrow={storyboard?.source === 'director' ? 'MOTION DIRECTOR STORYBOARD' : 'INK PRESS STORYBOARD'}
          title={plan.title}
          meta={`${plan.scenes.length + videos.length} scenes · ${Math.round(plan.scenes.reduce((sum, sc) => sum + sc.durationSec, 0) + videos.reduce((sum, v) => sum + v.sec, 0))}s${storyboard?.capture ? ' · uses your site' : ''}`}
          steps={withVideos(plan.scenes.map((scene, i) => {
            const startSec = plan.scenes.slice(0, i).reduce((sum, sc) => sum + sc.durationSec, 0);
            const template = scene.kind === 'shot' ? resolveMotionTemplate(scene.recipeId) : undefined;
            const brandScene = scene.kind === 'shot' && isBrandScene(scene.recipeId) ? BRAND_SCENES[scene.recipeId] : undefined;
            const onSite = Boolean(template && storyboard?.capture && isProductTextureShot(template.componentName));
            return {
              key: `${i}-${scene.recipeId || 'title'}`,
              label: template ? motionTemplateTitle(template) : brandScene ? brandScene.title : 'Title card',
              detail: [sceneDetail(scene, startSec), !scene.asset && onSite && 'shows your site', template && storyboard?.capture && drawsSampleScreen(template) && 'sample screen + your page beside it'].filter(Boolean).join(' · '),
              media: template ? (
                <StoryboardShot recipe={template} site={scenePictures[i]?.crops[0] ?? scenePictures[i]?.screens[0] ?? sitePicture(storyboard?.capture, i)} />
              ) : (
                // A title card shows its words on the film's colours, so it is not an empty tile beside a shot preview.
                <div
                  style={{ aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', borderRadius: 8, background: plan.palette.background, color: plan.palette.text, fontWeight: 700, fontSize: 18 }}
                >
                  {scene.headline.replace(/\*/g, '') || brandScene?.title || 'Title card'}
                </div>
              ),
            };
          }))}
          onApprove={() => void director.approve()}
          onReject={director.revise}
          busy={stage === 'building'}
          approveLabel={stage === 'building' ? 'Building…' : 'Approve & build film'}
          rejectLabel="Revise"
        />
      )}
      {showFilm && film && stage === 'film' && <FilmResultCard project={film.project} onOpenWorkbench={onOpenWorkbench} openLabel={openLabel} />}
    </div>
  );
};

/** The site picture a storyboard row will show (the same rotation the build uses). */
const sitePicture = (capture: SiteCapture | null | undefined, i: number): string | null => {
  if (!capture) return null;
  const pool = [...(capture.assets ?? []).map((a) => a.url), ...(capture.crops ?? []), ...(capture.page?.url ? [capture.page.url] : [])].filter(Boolean);
  return pool.length ? pool[i % pool.length] : null;
};

/** A storyboard row: the recipe's motion preview (plays on hover) with the site picture it will carry. */
const StoryboardShot: React.FC<{ recipe: MotionTemplate; site: string | null }> = ({ recipe, site }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <RecipePreview recipe={recipe} playing={hover} site={site} />
    </div>
  );
};

export default FilmDirectorChat;
