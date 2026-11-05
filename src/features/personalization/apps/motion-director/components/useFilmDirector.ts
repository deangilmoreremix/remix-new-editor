'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AspectRatio } from '../projectContract';
import type { ProjectData } from '../types';
import type { MediaAttachment } from '../lib/mediaUpload';
import type { MotionTemplate } from '../../../data/motionRecipeCatalog';
import { motionTemplateTitle, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import {
  INK_PRESS_INTRO,
  MAX_PICKED_SHOTS,
  isFilmRequest,
  isQuestion,
  parseFilmRequest,
  readTemplateAnswer,
  reviseRecipes,
  startsDifferentFilm,
  type FilmRequest,
  type FilmTemplateChoice,
} from '../lib/filmChat';
import { videoSceneSec } from '../lib/buildFilm';
import { askDirector, captureSite, DirectorError, requestBrief, requestDirections, requestMapping, requestFinalReview, fetchReferenceFrames, type GuidedContext, type SiteCapture } from '../lib/directorClient';
import type { DirectionOptions, DirectorBrief, MappingRow } from '../lib/directorPlan';
import { renderStyleframes, type Styleframe } from '../lib/styleframes';
import { applyReviewFixes, finalReviewLines, reviewStillApplies, runFinalReview } from '../lib/finalReview';
import { ACCEPT_RE, YOU_DECIDE_RE, briefMessage, briefText, directionMessage, directionText, mappingMessage, mappingText, pickDirection, sceneLine } from '../lib/coCreate';
import { releaseLine } from '../lib/releaseCheck';
import { initialSteps, markStep, type FilmStep, type FilmStepId, type FilmStepState } from '../lib/filmSteps';
import {
  buildFilmProject,
  checkFilmFrames,
  stillToJpeg,
  checkFilmStructure,
  storyboardFilm,
  type ActivityStatus,
  type FilmBrandKit,
  type FilmQaReport,
  type StoryboardResult,
} from '../lib/filmPipeline';
import { fixFilm } from '../lib/filmFix';
import { reviewSummary } from '../lib/filmReview';

/**
 * The film conversation: one chat turns a request into a finished film.
 *
 *   "make a promo for my product" → introduces Ink Press and asks → captures the
 *   pages → storyboard (shot recipe cards, approve / revise) → builds the film
 *   (beat sync, sound design) → frame QA → the film plays in the chat, renders
 *   to MP4, and opens in the Motion Workbench for editing.
 *
 * Shared by the entry composer and the studio's Agent panel.
 */

export interface FilmChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

/** `brief` → `direction` → `mapping` are the co-creation steps the person confirms before the storyboard. */
export type FilmStage = 'idle' | 'offer' | 'brief' | 'direction' | 'mapping' | 'storyboarding' | 'plan' | 'building' | 'film';

/** What a co-creation conversation has settled so far. */
interface GuidedState {
  req: FilmRequest;
  capture: SiteCapture | null;
  notes: string[];
  brief?: DirectorBrief;
  options?: DirectionOptions;
  direction?: string;
  mapping?: MappingRow[];
}

export interface FilmSettings {
  aspectRatio: AspectRatio;
  durationSec: number;
  brandKit?: FilmBrandKit | null;
  media: MediaAttachment[];
  /** Shots picked in the Templates picker; added to any named in chat. */
  pickedRecipes: MotionTemplate[];
}

export interface BuiltFilm {
  project: ProjectData;
  qa: FilmQaReport;
}

let seq = 0;
const msg = (role: FilmChatMessage['role'], content: string): FilmChatMessage => ({
  id: `fm-${Date.now().toString(36)}-${(seq++).toString(36)}`,
  role,
  content,
  ts: new Date().toISOString(),
});

const secs = (p: { scenes: { durationSec: number }[] }) => Math.round(p.scenes.reduce((s, sc) => s + sc.durationSec, 0));

export function useFilmDirector(opts: {
  settings: () => FilmSettings;
  /** Mirror of every message (e.g. into the studio session). */
  onMessage?: (m: FilmChatMessage) => void;
  /** Called when a film is built (the Agent panel installs it straight into the workbench). */
  onBuilt?: (film: BuiltFilm) => void;
  /**
   * The film as it is now where the caller keeps it (the workbench's project). A late review fix is only
   * applied while this is still the film that was reviewed, so edits made in the meantime are never lost.
   */
  currentProject?: () => unknown;
  /** Which messages start a new film (default `isFilmRequest`). */
  isRequest?: (text: string) => boolean;
  /**
   * The chat also edits the current film: while the Ink Press question is
   * open, a message that is not an answer goes back to the caller as an edit
   * (`send` returns false) instead of re-asking.
   */
  editFallback?: boolean;
}) {
  const [messages, setMessages] = useState<FilmChatMessage[]>([]);
  const [stage, setStage] = useState<FilmStage>('idle');
  const [activity, setActivity] = useState<Array<{ label: string; status: ActivityStatus }>>([]);
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null);
  /** Two real stills per visual direction, shown while the person chooses (best effort; empty when stills cannot be rendered). */
  const [styleframes, setStyleframes] = useState<Styleframe[]>([]);
  const styleframeUrls = useRef<string[]>([]);
  const setFrames = useCallback((frames: Styleframe[]) => {
    for (const url of styleframeUrls.current) URL.revokeObjectURL(url);
    styleframeUrls.current = frames.flatMap((f) => f.frames);
    setStyleframes(frames);
  }, []);
  useEffect(() => () => { for (const url of styleframeUrls.current) URL.revokeObjectURL(url); }, []);
  const [film, setFilm] = useState<BuiltFilm | null>(null);
  // The film this hook last installed, to tell whether a late review is still about the film on screen.
  const lastFilm = useRef<BuiltFilm | null>(null);
  useEffect(() => {
    lastFilm.current = film;
  }, [film]);
  /** The seven workflow steps (Product → Deliver) with their live state. */
  const [steps, setSteps] = useState<FilmStep[]>(initialSteps);
  const mark = useCallback((id: FilmStepId, state: FilmStepState, detail?: string) => setSteps((prev) => markStep(prev, id, state, detail)), []);
  const pending = useRef<{ req: FilmRequest; template: FilmTemplateChoice } | null>(null);
  const offerReq = useRef<FilmRequest | null>(null);
  const guided = useRef<GuidedState | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  /**
   * Conversation generation: `reset` (e.g. switching sessions) bumps it, and
   * every async step checks it before writing, so a storyboard or film that
   * finishes after the switch never lands in the other session.
   */
  const gen = useRef(0);
  // Unmounting (e.g. the rail switching to History) abandons in-flight work too, so a build
  // that finishes later can't install its film into whatever session is open by then.
  useEffect(
    () => () => {
      gen.current++;
    },
    [],
  );

  const say = useCallback((role: FilmChatMessage['role'], content: string) => {
    const m = msg(role, content);
    setMessages((prev) => [...prev, m]);
    optsRef.current.onMessage?.(m);
  }, []);

  const log = useCallback((label: string, status: ActivityStatus) => {
    setActivity((prev) => [...prev.filter((a) => a.status !== 'running'), { label, status }].slice(-8));
  }, []);

  const runStoryboard = useCallback(
    /** `reuseCapture`: only a revision of the storyboard on the table keeps its site capture. */
    async (req: FilmRequest, template: FilmTemplateChoice, reuseCapture = false, known: SiteCapture | null = null) => {
      const my = gen.current;
      const live = () => gen.current === my;
      const glog: typeof log = (label, status) => {
        if (!live()) return;
        log(label, status);
        if (/^Captured /.test(label)) mark('capture', 'done', label.replace(/^Captured [^·]*· ?/, ''));
        else if (/^Could not capture/.test(label)) {
          mark('capture', 'error', label);
          say('assistant', `${label}. The film will use sample pages instead of your site. Send the address again (or attach screenshots) and I'll re-capture.`);
        }
      };
      const s = optsRef.current.settings();
      // A revision carries its own (revised) list; a new film adds the shots picked in Templates.
      const wanted = reuseCapture ? req.recipes : [...req.recipes, ...s.pickedRecipes.filter((r) => !req.recipes.includes(r))];
      // A storyboard holds MAX_PICKED_SHOTS named shots; say so instead of silently losing the rest.
      const recipes = wanted.slice(0, MAX_PICKED_SHOTS);
      if (wanted.length > recipes.length && live()) {
        say('assistant', `A film can hold up to ${MAX_PICKED_SHOTS} chosen shots, so I'm using the first ${MAX_PICKED_SHOTS} (dropped: ${wanted.slice(MAX_PICKED_SHOTS).map((r) => r.slug).join(', ')}).`);
      }
      // "A close-up inspired by X" builds one shot — unless Templates picks add more shots, then it's a film of them all.
      const single = req.single && recipes.every((r) => r === req.single) ? req.single : null;
      const full = { ...req, recipes, single };
      // What the storyboard is planned with is what gets built, even if attachments change before approval.
      // Copy the records too: a video's length is probed after it is attached and lands on the same object.
      const media = s.media.map((m) => ({ ...m }));
      // Attached videos are scenes of the film too: they take their time out of the requested length.
      const videos = media.filter((m) => m.kind === 'video').map((m) => ({ name: m.name, sec: videoSceneSec(m) }));
      pending.current = { req: full, template };
      setStage('storyboarding');
      setStoryboard(null);
      setFilm(null);
      setActivity([]);
      const images = media.filter((m) => m.kind === 'image').length;
      let next = markStep(initialSteps(), 'product', 'done', req.siteUrl ?? 'From your message');
      next = known || (reuseCapture && storyboard?.capture)
        ? markStep(next, 'capture', 'done', 'Reusing the captured pages')
        : req.siteUrl
          ? markStep(next, 'capture', 'active', `Capturing ${req.siteUrl}`)
          : markStep(next, 'capture', images ? 'done' : 'skipped', images ? `${images} attached screenshot${images === 1 ? '' : 's'}` : 'No URL — sample pages');
      setSteps(markStep(next, 'storyboard', 'active'));
      if (!req.siteUrl && !media.some((m) => m.kind === 'image')) {
        say('assistant', 'No product URL or screenshots yet, so the product shots will use sample pages. Add your URL to the message (or attach screenshots) any time and I will re-capture.');
      }
      try {
        const result = await storyboardFilm(
          full,
          {
            template,
            durationSec: req.durationSec ?? s.durationSec,
            aspectRatio: req.aspectRatio ?? s.aspectRatio,
            brandKit: s.brandKit,
            capture: known ?? (reuseCapture ? storyboard?.capture ?? null : null),
            reservedSec: videos.reduce((sum, v) => sum + v.sec, 0),
            cancelled: () => !live(),
          },
          glog,
        );
        if (!live()) return;
        result.videos = videos;
        result.media = media;
        setStoryboard(result);
        setStage('plan');
        // Stage 1: the chosen direction as still key frames (opening, the site, the close), while the person reads the storyboard.
        setFrames([]);
        if (result.direction) {
          const chosen = result.direction.chosen;
          void renderStyleframes({ options: { directions: [chosen], recommended: 0 }, capture: result.capture, product: result.plan.title, opening: true }).then((frames) => {
            if (live() && frames.length) setFrames(frames);
          });
        }
        const videoSec = videos.reduce((sum, v) => sum + v.sec, 0);
        mark(
          'storyboard',
          'done',
          `${result.plan.scenes.length + videos.length} scene${result.plan.scenes.length + videos.length === 1 ? '' : 's'} · ${Math.round(secs(result.plan) + videoSec)}s · ${result.source === 'director' ? 'AI director' : 'Ink Press'}`,
        );
        if (result.capture) {
          const c = result.capture;
          const headline = c.content?.headline?.replace(/\s+/g, ' ').trim();
          const ctas = (c.content?.ctas ?? []).slice(0, 3);
          const found = [
            `${(c.pages?.length ?? 1)} page${(c.pages?.length ?? 1) === 1 ? '' : 's'}`,
            c.crops.length ? `${c.crops.length} card crop${c.crops.length === 1 ? '' : 's'}` : '',
            c.assets?.length ? `${c.assets.length} found pictures (${[...new Set(c.assets.map((a) => a.category.replace(/_/g, ' ')))].slice(0, 4).join(', ')})` : '',
            c.images?.length ? `${c.images.length} site image${c.images.length === 1 ? '' : 's'}` : '',
            c.logo ? 'the logo' : '',
          ].filter(Boolean);
          say(
            'assistant',
            `I read ${c.title || c.url}${headline ? ` — it says “${headline.slice(0, 120)}”` : ''}${ctas.length ? `, with calls to action ${ctas.map((x) => `“${x}”`).join(', ')}` : ''}. ${
              c.partial
                ? 'The page was too slow to screenshot in time, so the film uses sample pages with your site’s own words. Try again later, or attach screenshots, to use your real pages.'
                : `I captured ${found.join(', ')} to use in the film.`
            }`,
          );
        }
        let clockAt = 0;
        const lines = result.plan.scenes.map((sc) => {
          const line = sceneLine(sc, clockAt);
          clockAt += sc.durationSec;
          return line;
        });
        // Attached videos play just before the closing scene (after a one-scene film), as the build places them.
        lines.splice(lines.length > 1 ? lines.length - 1 : lines.length, 0, ...videos.map((v) => `Your video ${v.name} · ${v.sec}s`));
        const numbered = lines.map((line, i) => `${i + 1}. ${line}`);
        // The method's decisions stay in the chat (the step list only keeps the last few lines):
        // the visual direction (stage 1), the feature → shot map (stage 2) and the release check (stage 3).
        const d = result.direction?.chosen;
        const decided = [
          d ? `Visual direction: ${d.name} — ${d.claim}${d.why ? ` Why: ${d.why}.` : ''}${d.tradeoff ? ` Trade-off: ${d.tradeoff}.` : ''}${result.direction!.others.length ? ` (weighed against ${result.direction!.others.join(', ')})` : ''}` : '',
          result.mapping?.length ? `Feature → shot map:\n${mappingMessage(result.mapping).split('\n').slice(1).filter((l) => /^\d+\./.test(l)).join('\n')}` : '',
          result.release?.length ? releaseLine(result.release) : '',
        ].filter(Boolean);
        if (decided.length) say('assistant', decided.join('\n\n'));
        say(
          'assistant',
          `${result.note ? `${result.note} I used the Ink Press template instead.\n\n` : ''}${result.source === 'director' && result.plan.summary ? `${result.plan.summary}\n\n` : ''}Storyboard “${result.plan.title}” — ${lines.length} scene${lines.length === 1 ? '' : 's'}, ${Math.round(secs(result.plan) + videos.reduce((sum, v) => sum + v.sec, 0))}s${result.capture ? ', using your captured pages' : ''}:\n${numbered.join('\n')}\n\nApprove to build the film, ask me why I chose something, or tell me what to change.`,
        );
      } catch (error) {
        if (!live()) return;
        setStage('idle');
        mark('storyboard', 'error', error instanceof Error ? error.message : 'failed');
        say('assistant', `I could not storyboard that: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    },
    [log, mark, say, storyboard?.capture],
  );


  /** Co-creation (video-shotcraft's guided flow): brief → visual direction → feature-to-shot mapping → storyboard. */
  const guidedContext = useCallback((g: GuidedState, extra: Partial<GuidedContext> = {}): GuidedContext => {
    const set = optsRef.current.settings();
    return {
      prompt: g.req.prompt,
      durationSec: g.req.durationSec ?? set.durationSec,
      aspectRatio: g.req.aspectRatio ?? set.aspectRatio,
      capture: g.capture,
      brandKit: (set.brandKit as Record<string, unknown> | null | undefined) ?? null,
      notes: g.notes,
      requiredRecipes: g.req.recipes.map((r) => r.id),
      ...extra,
    };
  }, []);

  /** Run one co-creation step; its result is the next thing the person confirms. */
  const guidedStep = useCallback(
    async (step: 'brief' | 'direction' | 'mapping') => {
      const g = guided.current;
      if (!g) return;
      const my = gen.current;
      const live = () => gen.current === my && guided.current === g;
      setStage('storyboarding');
      try {
        if (step === 'brief') {
          const brief = await requestBrief(guidedContext(g));
          if (!live()) return;
          g.brief = brief;
          say('assistant', briefMessage(brief, !g.capture));
        } else if (step === 'direction') {
          const options = await requestDirections(guidedContext(g, { brief: g.brief ? briefText(g.brief) : '' }));
          if (!live()) return;
          g.options = options;
          say('assistant', directionMessage(options));
          // Each option as two real frames in its colours, while the person reads (never blocks the choice).
          void renderStyleframes({ options, capture: g.capture ?? null, product: g.req.prompt.slice(0, 60) }).then((frames) => {
            if (live() && frames.length) setFrames(frames);
          });
        } else {
          const mapping = await requestMapping(guidedContext(g, { brief: g.brief ? briefText(g.brief) : '', direction: g.direction ?? '' }));
          if (!live()) return;
          g.mapping = mapping;
          setFrames([]);
          say('assistant', mappingMessage(mapping));
        }
        setStage(step);
      } catch (error) {
        if (!live()) return;
        guided.current = null;
        const noKey = error instanceof DirectorError && (error.code === 'OPENAI_KEY_REQUIRED' || error.code === 'OPENAI_KEY_REJECTED');
        if (noKey) {
          say('assistant', 'Working it out together needs your OpenAI API key (add it in SmartVideo GO Settings). I used the Ink Press template instead.');
          void runStoryboard(g.req, 'inkpress', false, g.capture);
        } else {
          setStage('idle');
          mark('storyboard', 'error', error instanceof Error ? error.message : 'failed');
          say('assistant', `I could not do that step: ${error instanceof Error ? error.message : 'unknown error'}. Send your request again, or choose Ink Press.`);
        }
      }
    },
    [guidedContext, mark, runStoryboard, say],
  );

  /** The person confirmed the shot mapping (or handed the choices over): write the storyboard from everything settled. */
  const guidedFinish = useCallback(() => {
    const g = guided.current;
    if (!g) return;
    guided.current = null;
    const decisions = [
      g.brief ? `Brief:\n${briefText(g.brief)}` : '',
      g.direction ? `Direction: ${g.direction}` : '',
      g.mapping ? `Shot mapping (first choices, in film order):\n${mappingText(g.mapping)}` : '',
      g.notes.length ? `The person's notes:\n${g.notes.join('\n')}` : '',
    ].filter(Boolean);
    const lead = g.mapping
      ? g.mapping.map((m) => resolveMotionTemplate(m.firstShot)).filter((t): t is MotionTemplate => !!t)
      : [];
    const recipes = g.req.recipes.length ? g.req.recipes : lead;
    void runStoryboard(
      // Without a captured site the pages are sample pages; the site address is not captured a second time.
      { ...g.req, prompt: `${g.req.prompt}\n\n${decisions.join('\n\n')}`.slice(0, 3900), recipes, siteUrl: g.capture ? g.req.siteUrl : null, mapping: g.mapping ?? undefined },
      'director',
      false,
      g.capture,
    );
  }, [runStoryboard]);

  /** Start co-creation for the film asked for: read the site, then run the product check. */
  const startCoCreate = useCallback(
    async (req: FilmRequest) => {
      const my = gen.current;
      const live = () => gen.current === my;
      const g: GuidedState = { req, capture: null, notes: [] };
      guided.current = g;
      setStage('storyboarding');
      setStoryboard(null);
      setFilm(null);
      setActivity([]);
      let next = markStep(initialSteps(), 'product', 'done', req.siteUrl ?? 'From your message');
      next = req.siteUrl ? markStep(next, 'capture', 'active', `Capturing ${req.siteUrl}`) : markStep(next, 'capture', 'skipped', 'No URL — sample pages');
      setSteps(markStep(next, 'storyboard', 'active', 'Product check'));
      if (req.siteUrl) {
        log(`Capturing ${req.siteUrl}`, 'running');
        try {
          const capture = await captureSite(req.siteUrl, {
            cancelled: () => !live(),
            onProgress: (sec) => log(`Capturing ${req.siteUrl} · ${sec}s (reading the page and taking screenshots)`, 'running'),
          });
          if (!live()) return;
          g.capture = capture;
          log(`Captured ${capture.title || req.siteUrl}`, 'done');
          mark('capture', 'done', `${capture.pages?.length || 1} page${(capture.pages?.length || 1) === 1 ? '' : 's'} · ${capture.crops.length} card crops`);
        } catch (error) {
          if (!live()) return;
          const label = `Could not capture ${req.siteUrl}: ${error instanceof Error ? error.message : 'failed'}`;
          log(label, 'error');
          mark('capture', 'error', label);
          say('assistant', `${label}. I'll work from your message and sample pages — send the address again (or attach screenshots) and I'll re-capture.`);
        }
      }
      if (!live()) return;
      await guidedStep('brief');
    },
    [guidedStep, log, mark, say],
  );

  /** An answer during co-creation. Returns false when it is a new film instead (the caller handles it). */
  const answerGuided = useCallback(
    (text: string): boolean => {
      const g = guided.current;
      if (!g) return false;
      if (startsDifferentFilm(text, g.req)) {
        guided.current = null;
        return false;
      }
      say('user', text);
      if (YOU_DECIDE_RE.test(text)) {
        say('assistant', 'Understood — I’ll decide the rest and show you the storyboard to approve.');
        guidedFinish();
        return true;
      }
      if (stage === 'brief') {
        if (!ACCEPT_RE.test(text)) g.notes.push(`Brief: ${text}`);
        void guidedStep('direction');
      } else if (stage === 'direction') {
        const options = g.options;
        const i = options ? pickDirection(text, options) : -1;
        if (options && i >= 0) g.direction = directionText(options.directions[i]);
        else if (options && ACCEPT_RE.test(text)) g.direction = directionText(options.directions[options.recommended]);
        else g.direction = `Own direction: ${text}`;
        void guidedStep('mapping');
      } else {
        if (ACCEPT_RE.test(text)) guidedFinish();
        else {
          g.notes.push(`Mapping: ${text}`);
          void guidedStep('mapping');
        }
      }
      return true;
    },
    [guidedFinish, guidedStep, say, stage],
  );

  /** Handle a chat message. Returns false when it is not a film request (the caller treats it as an edit). */
  const send = useCallback(
    (raw: string, sendOpts: { force?: boolean } = {}): boolean => {
      const text = raw.trim();
      if (!text) return false;
      if (stage === 'storyboarding' || stage === 'building') {
        say('assistant', `I'm still ${stage === 'building' ? 'building the film' : 'working on the storyboard'} — press Stop to cancel it, then send that again.`);
        return true;
      }

      if ((stage === 'brief' || stage === 'direction' || stage === 'mapping') && guided.current) {
        if (answerGuided(text)) return true;
      }

      if (stage === 'offer' && offerReq.current) {
        const answer = readTemplateAnswer(text);
        const extra = parseFilmRequest(text);
        if (answer || extra.recipes.length) {
          say('user', text);
          const base = offerReq.current;
          // Keep what came with the answer: "yes, make it 30 seconds and focus on team features".
          const bareAnswer = /^\W*(?:y|yes|yep|yeah|sure|ok|okay|please|no|nope|go|go ahead|do it|use it|use ink ?press|ink ?press|let the director pick(?: the)? shots?)\W*$/i.test(text);
          const req = {
            ...base,
            prompt: bareAnswer ? base.prompt : `${base.prompt}\n\n${text}`,
            recipes: [...base.recipes, ...extra.recipes.filter((r) => !base.recipes.includes(r))],
            durationSec: extra.durationSec ?? base.durationSec,
            siteUrl: extra.siteUrl ?? base.siteUrl,
          };
          offerReq.current = null;
          void runStoryboard(req, extra.recipes.length && answer !== 'inkpress' ? 'director' : answer ?? 'director');
          return true;
        }
        if (!(optsRef.current.isRequest ?? isFilmRequest)(text)) {
          if (optsRef.current.editFallback) return false;
          say('user', text);
          say('assistant', 'Shall I use the Ink Press template? Say “yes” for Ink Press, “no” to let the director pick shots, or name the shot cards you want.');
          return true;
        }
      }

      // While a storyboard is on the table every message revises it ("use crash-zoom-punch instead"),
      // unless it plainly asks for a different film.
      const different = stage === 'plan' && pending.current ? startsDifferentFilm(text, pending.current.req) : false;
      if (stage === 'plan' && pending.current && !different) {
        // A revision of the storyboard on the table.
        say('user', text);
        const prev = pending.current;
        const extra = parseFilmRequest(text);
        // Shots picked in Templates while the storyboard is open are added to it.
        const picks = optsRef.current.settings().pickedRecipes;
        // A storyboard made without explicit picks keeps its own shots when picks are added to it.
        const open = !prev.req.recipes.length && picks.length
          ? (storyboard?.plan.scenes ?? []).flatMap((sc) => (sc.kind === 'shot' ? [resolveMotionTemplate(sc.recipeId)] : [])).filter((t): t is MotionTemplate => !!t)
          : prev.req.recipes;
        const base = reviseRecipes(open, text);
        const revised = [...base, ...picks.filter((p) => !base.includes(p))];
        const revise = () =>
          void runStoryboard(
            {
              ...prev.req,
              prompt: `${prev.req.prompt}\n\nRevise: ${text}`,
              recipes: revised,
              // A one-shot film follows its revision: "use crash-zoom-punch instead" builds that shot.
              single: prev.req.single ? (revised.length === 1 ? revised[0] : null) : null,
              durationSec: extra.durationSec ?? prev.req.durationSec,
              siteUrl: extra.siteUrl ?? prev.req.siteUrl,
            },
            extra.template ?? (extra.recipes.length ? 'director' : prev.template),
            true,
          );
        // A question about the storyboard gets an answer from the director; a request for a change revises it.
        if (storyboard && !picks.length && isQuestion(text)) {
          const my = gen.current;
          void askDirector({ message: text, plan: storyboard.plan, capture: storyboard.capture ?? null })
            .then((answer) => {
              if (gen.current !== my) return;
              if (answer.reply) say('assistant', answer.reply);
              if (answer.revise) revise();
            })
            .catch(() => {
              // No director to ask (no key, offline): treat it as feedback on the plan.
              if (gen.current === my) revise();
            });
          return true;
        }
        revise();
        return true;
      }

      // A message that plainly starts a different film is a film request even without a creation verb ("now beta.dev").
      if (!sendOpts.force && !different && !(optsRef.current.isRequest ?? isFilmRequest)(text)) return false;
      say('user', text);
      const req = parseFilmRequest(text);
      const picked = optsRef.current.settings().pickedRecipes;
      if (req.single) {
        say('assistant', `Designing one ${motionTemplateTitle(req.single)} shot, adapted to your product.`);
        void runStoryboard(req, 'inkpress');
      } else if (req.template) {
        void runStoryboard(req, req.template);
      } else if (req.recipes.length || picked.length) {
        const names = [...req.recipes, ...picked.filter((p) => !req.recipes.includes(p))].map(motionTemplateTitle);
        say('assistant', `Building the film around ${names.join(', ')}.`);
        void runStoryboard(req, 'director');
      } else {
        offerReq.current = req;
        setStage('offer');
        say('assistant', INK_PRESS_INTRO);
      }
      return true;
    },
    [answerGuided, runStoryboard, say, stage],
  );

  const chooseTemplate = useCallback(
    (choice: FilmTemplateChoice) => {
      const req = offerReq.current;
      if (!req) return;
      offerReq.current = null;
      say('user', choice === 'inkpress' ? 'Use Ink Press.' : 'Let the director pick the shots.');
      void runStoryboard(req, choice);
    },
    [runStoryboard, say],
  );

  /** The offer's "Work it out together" button. */
  const coCreate = useCallback(() => {
    const req = offerReq.current;
    if (!req) return;
    offerReq.current = null;
    say('user', 'Work it out together.');
    void startCoCreate(req);
  }, [say, startCoCreate]);

  const approve = useCallback(async () => {
    if (!storyboard) return;
    const my = gen.current;
    const live = () => gen.current === my;
    const glog: typeof log = (label, status) => {
      if (!live()) return;
      log(label, status);
      if (/^Finding the beat/.test(label)) mark('beat', 'active', label);
      else if (/^Frame QA/.test(label)) mark('qa', status === 'running' ? 'active' : status === 'error' ? 'error' : 'done', label.replace(/^Frame QA · /, ''));
    };
    const s = optsRef.current.settings();
    setStage('building');
    mark('animate', 'active', 'Building the Remotion project');
    try {
      // Build with the attachments the approved storyboard was planned with (a revision picks up new ones).
      const media = storyboard.media ?? s.media;
      const buildOut = await buildFilmProject(storyboard.plan, { aspectRatio: pending.current?.req.aspectRatio ?? s.aspectRatio, capture: storyboard.capture, media, logo: s.brandKit?.logo ?? null, prompt: pending.current?.req.prompt, mapping: storyboard.mapping, release: storyboard.release, direction: storyboard.direction ? `${storyboard.direction.chosen.name}: ${storyboard.direction.chosen.claim}${storyboard.direction.chosen.tradeoff ? ` Trade-off: ${storyboard.direction.chosen.tradeoff}.` : ''}` : undefined }, glog);
      // Findings the program can repair safely are repaired once, and said.
      const { project, fixed } = fixFilm(buildOut);
      const qa = checkFilmStructure(project, { hasProductImages: Boolean(storyboard.capture) || media.some((m) => m.kind === 'image') });
      const cuts = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'audio-clip' && /sfxlib/.test(String(c.props?.file ?? ''))).length;
      const musicClip = project.tracks.flatMap((t) => t.clips).find((c) => c.cardId === 'audio-clip' && /bgmlib|^blob:/.test(String(c.props?.file ?? '')));
      const music = media.find((m) => m.kind === 'audio') ?? (musicClip ? { name: String(musicClip.label ?? 'music') } : undefined);
      mark('animate', 'done', `${project.tracks.reduce((n, t) => n + t.clips.length, 0)} clips on ${project.tracks.length} tracks`);
      mark('beat', 'done', `${cuts} SFX hits${music ? ` · cuts on the beat of ${music.name}` : ' · attach music to beat-sync the cuts'}`);
      const frames = await checkFilmFrames(project, glog);
      if (!live()) return;
      qa.framesChecked = frames.checked;
      qa.issues.push(...frames.failed.map((f) => `Frame ${f}`));
      qa.ok = qa.issues.length === 0;
      const built = { project, qa };
      setFilm(built);
      setStage('film');
      if (!frames.checked && !frames.failed.length) mark('qa', qa.ok ? 'done' : 'error', qa.ok ? 'Structure checked' : `${qa.issues.length} issue(s)`);
      else if (!qa.ok) mark('qa', 'error', `${qa.issues.length} issue(s)`);
      mark('deliver', 'done', 'MP4 · Motion Workbench');
      optsRef.current.onBuilt?.(built);
      say(
        'assistant',
        [
          `Your film is ready: ${Math.round(project.tracks.reduce((m, t) => t.clips.reduce((mm, c) => Math.max(mm, c.start + c.duration), m), 0) / project.fps)}s at ${project.width}×${project.height}, ${project.fps} fps, ${project.tracks.map((t) => t.name).join(' / ')} tracks.`,
          qa.ok ? `Frame QA passed${qa.framesChecked ? ` (${qa.framesChecked} frames rendered)` : ''}.` : `Frame QA found ${qa.issues.length} issue${qa.issues.length === 1 ? '' : 's'}:\n- ${qa.issues.join('\n- ')}`,
          ...qa.warnings,
          ...(qa.review ? reviewSummary(qa.review) : []),
          ...(fixed.length ? ['Fixed before showing you:', ...fixed.map((f) => `- ${f}`)] : []),
          'Play it here, render the MP4, or open it in the Motion Workbench to edit shots, copy, timing and sound.',
        ].join('\n'),
      );
      // Stage 7: the independent reviewer (a model that did not make the film) gets the spec, every shot's card,
      // its reference frames next to the film's, the seams and the two checklists; it arrives as a follow-up,
      // and a seam it fails goes back to a plain cut (stage 3).
      void runFinalReview(project, {
        frame: async (p, f, signal) => stillToJpeg((await (await import('../webRenderer')).renderStillOnWebExport(p, f, signal, 0.25)).blob, 480),
        reference: fetchReferenceFrames,
        request: (body) => requestFinalReview(body),
      })
        .then((report) => {
          if (!live() || !report.items.length) return;
          const { project: repaired, fixed } = applyReviewFixes(project, report.items);
          // Only the film that was reviewed is repaired: if it was edited (here or in the workbench) while the
          // review ran, the fix is offered instead of replacing the edited film.
          const reader = optsRef.current.currentProject;
          const unchanged = reviewStillApplies({ installed: lastFilm.current, reviewed: built, current: reader, project });
          if (fixed.length && unchanged) {
            const next = { ...built, project: repaired };
            setFilm(next);
            optsRef.current.onBuilt?.(next);
          }
          const notes = !fixed.length ? [] : unchanged ? ['Fixed from the review:', ...fixed.map((f) => `- ${f}`)] : ['The film was edited while the review ran, so I left it as it is. To apply the review:', ...fixed.map((f) => `- ${f.replace(' is a plain cut now (the reviewer failed it).', ': make it a plain cut in the Transitions track.')}`)];
          say('assistant', [...finalReviewLines(report), ...notes].join('\n'));
        })
        .catch(() => {
          /* no key or no answer: the program's checks above stand */
        });
    } catch (error) {
      if (!live()) return;
      setStage('plan');
      mark('animate', 'error', error instanceof Error ? error.message : 'failed');
      log(error instanceof Error ? error.message : 'Could not build the film', 'error');
      say('assistant', `Building the film failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }, [log, mark, say, storyboard]);

  const revise = useCallback(() => {
    say('assistant', 'What should change? Name shots to swap in (e.g. “use crash-zoom-punch instead”), a new length, or new copy.');
  }, [say]);

  /**
   * Stop what is running. A storyboard in progress is dropped (back to a fresh chat
   * turn); a film being built is dropped and the approved storyboard stays on the
   * table to approve again or revise. Any result that arrives later is ignored.
   */
  const stop = useCallback(() => {
    if (stage !== 'storyboarding' && stage !== 'building') return;
    gen.current++;
    setActivity([]);
    setSteps((prev) => prev.map((st) => (st.state === 'active' ? { ...st, state: 'todo', detail: 'Stopped' } : st)));
    if (stage === 'storyboarding') {
      pending.current = null;
      guided.current = null;
      setStoryboard(null);
      setStage('idle');
      say('assistant', 'Stopped. Tell me what to make next.');
    } else {
      setFilm(null);
      setStage('plan');
      say('assistant', 'Stopped building the film. The storyboard is still here: approve it again or tell me what to change.');
    }
  }, [say, stage]);

  const reset = useCallback(() => {
    gen.current++;
    pending.current = null;
    offerReq.current = null;
    guided.current = null;
    setStage('idle');
    setStoryboard(null);
    setFilm(null);
    setActivity([]);
    setMessages([]);
    setSteps(initialSteps());
    setFrames([]);
  }, [setFrames]);

  return { messages, stage, activity, steps, storyboard, film, styleframes, send, chooseTemplate, coCreate, approve, revise, stop, reset };
}

export type FilmDirector = ReturnType<typeof useFilmDirector>;
