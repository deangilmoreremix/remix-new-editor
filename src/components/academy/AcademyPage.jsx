// Smart Video Academy — browses ALL imported tracks (15) from the cloned
// upstream academy. Lessons/Templates are catalog-driven; track 01 keeps its
// rich interactive editors, the other 14 render as documents via the Markdown
// renderer. Mounted by the router as the `academy` route.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { navigate } from '../../lib/router.js';
import {
  ACADEMY_TRACKS,
  ACADEMY_LESSONS,
  ACADEMY_TEMPLATE_META,
  getLessonById,
  getTemplateMeta,
} from '../../data/academy/catalog.js';
import { ACADEMY_LESSONS as RICH_LESSONS } from '../../data/academy/lessons.js';
import { getAssetsForLesson } from '../../data/academyAssets.js';
import { executeRecipe } from '../../lib/recipes/executor.js';
import { getTemplateRecipeId } from '../../data/academy/template-recipes/index.js';
import { TemplateEditor, AssetGallery } from './InteractiveTemplates.jsx';
import { Markdown } from './Markdown.jsx';
import { Icon } from './icons.jsx';

const cardCls = 'rounded-2xl border border-white/10 bg-white/[0.03] p-4';
const BOOKMARKS_KEY = 'academy_bookmarks';
const STORAGE_KEY = 'academy_progress';

function useAcademyProgress() {
  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch {
      // ignore corrupt storage
    }
    return {};
  });

  const save = useCallback((next) => {
    setProgress(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const markInProgress = useCallback(
    (lessonId) => {
      setProgress((prev) => {
        if (prev[lessonId] === 'completed') return prev;
        const next = { ...prev, [lessonId]: 'in-progress' };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [save]
  );

  const toggleCompleted = useCallback(
    (lessonId) => {
      setProgress((prev) => {
        const next = { ...prev };
        if (next[lessonId] === 'completed') {
          delete next[lessonId];
        } else {
          next[lessonId] = 'completed';
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [save]
  );

  const resetProgress = useCallback(() => {
    save({});
  }, [save]);

  const getStatus = useCallback(
    (lessonId) => progress[lessonId] || null,
    [progress]
  );

  const getTrackProgress = useCallback(
    (track) => {
      const lessonIds = track.lessonIds || [];
      const completed = lessonIds.filter((id) => progress[id] === 'completed').length;
      const inProgress = lessonIds.filter((id) => progress[id] === 'in-progress').length;
      return { total: lessonIds.length, completed, inProgress };
    },
    [progress]
  );

  const overallProgress = useMemo(() => {
    const total = ACADEMY_LESSONS.length;
    const completed = ACADEMY_LESSONS.filter((l) => progress[l.id] === 'completed').length;
    return { total, completed };
  }, [progress]);

  return {
    progress,
    markInProgress,
    toggleCompleted,
    resetProgress,
    getStatus,
    getTrackProgress,
    overallProgress,
  };
}

function useAcademyBookmarks() {
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore corrupt storage
    }
    return [];
  });

  const toggle = useCallback((lessonId) => {
    setBookmarks((prev) => {
      const next = prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId];
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (lessonId) => bookmarks.includes(lessonId),
    [bookmarks]
  );

  return { bookmarks, toggleBookmark: toggle, isBookmarked };
}

function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        copyText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-white/15 text-white text-sm px-3 py-2 hover:bg-white/5 transition"
    >
      <Icon name="Copy" size={14} /> {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

function SectionTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-white/10 mb-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ' +
            (active === t.id ? 'border-white text-white' : 'border-transparent text-white/50 hover:text-white')
          }
        >
          <Icon name={t.icon} size={15} /> {t.label}
        </button>
      ))}
    </div>
  );
}

function Bullets({ title, items, accent }) {
  return (
    <div className={cardCls}>
      <p className="text-sm font-semibold text-white mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/70">
            <span className={'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' + (accent || 'bg-white/40')} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FullLesson({ rawPath }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <GhostBtn onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide full lesson' : 'Read full lesson'}
      </GhostBtn>
      {open ? (
        <div className={cardCls + ' mt-3 max-h-[60vh] overflow-auto'}>
          <Markdown rawPath={rawPath} />
        </div>
      ) : null}
    </div>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-white/15 text-white text-sm px-3 py-2 hover:bg-white/5 transition"
    >
      {children}
    </button>
  );
}

function ProgressBar({ completed, total, size = 'sm' }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';
  return (
    <div className={`w-full ${height} rounded-full bg-white/10 overflow-hidden`}>
      <div
        className="h-full rounded-full bg-emerald-400 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LessonRowCheck({ status, onToggle }) {
  if (status === 'completed') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/30 transition"
        title="Mark as incomplete"
      >
        <Icon name="Check" size={14} />
      </button>
    );
  }
  if (status === 'in-progress') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-sky-400/20 border border-sky-400/40 text-sky-400 hover:bg-sky-400/30 transition"
        title="Mark as completed"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
      </button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full border border-white/20 text-transparent hover:border-white/40 hover:text-white/30 transition"
      title="Mark as completed"
    >
      <Icon name="Check" size={14} />
    </button>
  );
}

function LessonView({ lesson, trackSlug, onOpenTemplate, onBackToTrack, isBookmarked, onToggleBookmark, status, onToggleCompleted }) {
  const [tab, setTab] = useState('learn');
  const rich = RICH_LESSONS.find((l) => l.id === lesson.id);
  const relatedTemplates = lesson.relatedTemplateIds.map(getTemplateMeta).filter(Boolean);
  const lessonUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}${window.location.search}#/academy/track/${trackSlug}/lesson/${lesson.id}`
    : '';

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <LessonRowCheck status={status} onToggle={onToggleCompleted} />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-white/40">Lesson {lesson.order}{lesson.time ? ' · ' + lesson.time : ''}</p>
              <h2 className="text-2xl font-bold text-white">{lesson.title}</h2>
              <p className="text-sm text-white/60 mt-1">{lesson.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button
              onClick={() => onToggleBookmark(lesson.id)}
              className={
                'inline-flex items-center gap-1.5 rounded-xl border text-sm px-3 py-2 transition ' +
                (isBookmarked
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                  : 'border-white/15 text-white/50 hover:text-white hover:border-white/25')
              }
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark for later'}
            >
              <span className="text-base leading-none">{isBookmarked ? '⭐' : '☆'}</span>
              <span className="hidden sm:inline">{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
            {lessonUrl ? <CopyLinkButton url={lessonUrl} /> : null}
            <GhostBtn onClick={onBackToTrack}>Back to track</GhostBtn>
          </div>
        </div>
      </div>

      <SectionTabs
        tabs={[
          { id: 'learn', label: 'Learn', icon: 'BookOpen' },
          { id: 'see', label: 'See', icon: 'Eye' },
          { id: 'create', label: 'Create', icon: 'Sparkles' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'learn' ? (
        <div className="space-y-3">
          {rich ? (
            <>
              <div className={cardCls}>
                <p className="text-sm font-semibold text-white mb-2">The problem</p>
                <p className="text-sm text-white/70 leading-relaxed">{rich.problem}</p>
              </div>
              <Bullets title="The concept" items={rich.concept} accent="bg-sky-400" />
              <Bullets title="Do it" items={rich.doIt} accent="bg-emerald-400" />
              <Bullets title="Launch it (get paid)" items={rich.launchIt} accent="bg-amber-400" />
              <Bullets title="Exercises" items={rich.exercises} />
            </>
          ) : (
            <div className={cardCls}>
              <p className="text-sm text-white/70 leading-relaxed">{lesson.summary}</p>
            </div>
          )}
          <FullLesson rawPath={lesson.rawPath} />
        </div>
      ) : null}

      {tab === 'see' ? (
        <div>
          <p className="text-sm text-white/60 mb-3">Example media referenced in this lesson.</p>
          <AssetGallery assetIds={lesson.relatedAssetIds} />
        </div>
      ) : null}

      {tab === 'create' ? (
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            Turn this lesson into a deliverable. Open a template to build it, or launch a linked SmartVideo recipe.
          </p>
          {relatedTemplates.map((t) => (
            <div key={t.id} className={cardCls + ' flex items-center justify-between gap-4'}>
              <div>
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="text-xs text-white/50 mt-0.5">{t.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onOpenTemplate(t.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 text-white text-sm px-3 py-2 hover:bg-white/5 transition"
                >
                  Open template <Icon name="ArrowRight" size={14} />
                </button>
                {getTemplateRecipeId(t.id) ? (
                  <button
                    onClick={() => executeRecipe(getTemplateRecipeId(t.id), {})}
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-neutral-900 font-semibold text-sm px-3 py-2 hover:bg-white/90 transition"
                  >
                    <Icon name="Sparkles" size={14} /> Create With Smart Video
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {relatedTemplates.length === 0 ? <p className="text-sm text-white/40">No linked templates.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function TrackView({ track, onOpenLesson, onOpenTemplate, onBackToHub, bookmarks, onToggleBookmark, progressApi }) {
  const lessons = ACADEMY_LESSONS.filter((l) => (track.lessonIds || []).includes(l.id));
  const templates = ACADEMY_TEMPLATE_META.filter((t) => t.trackSlug === track.slug);
  const trackProgress = progressApi.getTrackProgress(track);
  return (
    <div className="w-full max-w-5xl">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/40">Track {track.order}</p>
            <h1 className="text-2xl font-bold text-white">{track.title}</h1>
            <p className="text-sm text-white/60 mt-1 max-w-2xl">{track.summary}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 max-w-xs">
                <ProgressBar completed={trackProgress.completed} total={trackProgress.total} />
              </div>
              <p className="text-xs text-white/50">
                {trackProgress.completed}/{trackProgress.total} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <GhostBtn onClick={onBackToHub}>All tracks</GhostBtn>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-white mb-3">Lessons ({lessons.length})</p>
          <div className="space-y-2">
            {lessons.map((l) => {
              const isBookmarked = bookmarks.includes(l.id);
              const status = progressApi.getStatus(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => {
                    progressApi.markInProgress(l.id);
                    onOpenLesson(l.id);
                  }}
                  className={cardCls + ' w-full text-left hover:border-white/25 transition flex items-center gap-3'}
                >
                  <LessonRowCheck status={status} onToggle={() => progressApi.toggleCompleted(l.id)} />
                  <span className="text-lg font-black text-white/30 w-6 text-center">{l.order}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{l.title}</span>
                    <span className="block text-xs text-white/50 line-clamp-1">{l.summary}</span>
                  </span>
                  {isBookmarked ? (
                    <span className="text-sm shrink-0" title="Bookmarked">⭐</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(l.id);
                      }}
                      className="text-xs text-white/30 hover:text-white px-1.5 py-1 rounded-lg transition shrink-0"
                      title="Bookmark for later"
                    >
                      ☆
                    </button>
                  )}
                  <Icon name="ChevronRight" size={16} className="text-white/40 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-3">Templates ({templates.length})</p>
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpenTemplate(t.id)}
                className={cardCls + ' w-full text-left hover:border-white/25 transition flex items-center gap-3'}
              >
                <Icon name="FileText" size={18} className="text-white/50 shrink-0" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">{t.title}</span>
                  <span className="block text-xs text-white/50 line-clamp-1">{t.description}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-white/40 border border-white/10 rounded-full px-2 py-0.5 shrink-0">
                  {t.ctaLabel === 'Create With Smart Video' ? 'SV' : 'Tpl'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hub({ onOpenTrack, bookmarks, onToggleBookmark, onOpenLesson, progressApi }) {
  const bookmarkedLessons = ACADEMY_LESSONS.filter((l) => bookmarks.includes(l.id));
  const { overallProgress, resetProgress, getTrackProgress } = progressApi;

  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Smart Video Academy</p>
            <h1 className="text-3xl font-black text-white tracking-tight mt-1">AI Creator Academy</h1>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              {ACADEMY_TRACKS.length} tracks, {ACADEMY_LESSONS.length} lessons and {ACADEMY_TEMPLATE_META.length} templates
              imported from the creator academy. Learn the concept, see the real examples, then create with SmartVideo's studios.
            </p>
          </div>
          {overallProgress.total > 0 ? (
            <div className="shrink-0 w-48">
              <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                <span>Progress</span>
                <span>
                  {overallProgress.completed}/{overallProgress.total}
                </span>
              </div>
              <ProgressBar completed={overallProgress.completed} total={overallProgress.total} size="md" />
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <button
            onClick={resetProgress}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 text-white/60 text-xs px-3 py-1.5 hover:bg-white/5 hover:text-white transition"
          >
            <Icon name="X" size={12} /> Reset progress
          </button>
        </div>
      </div>

      {bookmarkedLessons.length > 0 ? (
        <div className="mb-6">
          <p className="text-sm font-semibold text-white mb-3">Bookmarks ({bookmarkedLessons.length})</p>
          <div className="space-y-2">
            {bookmarkedLessons.map((l) => (
              <button
                key={l.id}
                onClick={() => onOpenLesson(l.id)}
                className={cardCls + ' w-full text-left hover:border-white/25 transition flex items-center gap-3'}
              >
                <span className="text-lg shrink-0">⭐</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">{l.title}</span>
                  <span className="block text-xs text-white/50 line-clamp-1">{l.summary}</span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleBookmark(l.id); }}
                  className="text-xs text-white/40 hover:text-white px-2 py-1 rounded-lg border border-white/10 hover:border-white/25 transition shrink-0"
                  title="Remove bookmark"
                >
                  Remove
                </button>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-sm font-semibold text-white mb-3">Tracks</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACADEMY_TRACKS.map((t) => {
          const tp = getTrackProgress(t);
          return (
            <button
              key={t.slug}
              onClick={() => onOpenTrack(t.slug)}
              className={cardCls + ' text-left hover:border-white/25 transition'}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/40">Track {t.order}</p>
                {tp.total > 0 ? (
                  <span className="text-[10px] text-white/40">
                    {tp.completed}/{tp.total}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">{t.title}</p>
              <p className="text-xs text-white/50 mt-1 line-clamp-2">{t.summary}</p>
              {tp.total > 0 ? (
                <div className="mt-3">
                  <ProgressBar completed={tp.completed} total={tp.total} />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function parseAcademyHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = hash.match(/^#\/academy(?:\/track\/([^/]+))(?:\/(lesson|template)\/([^/]+))?$/);
  if (!match) return null;
  const [, trackSlug, kind, itemId] = match;
  if (!trackSlug) return { type: 'hub' };
  if (kind === 'lesson') return { type: 'lesson', trackSlug, id: itemId };
  if (kind === 'template') return { type: 'template', trackSlug, id: itemId };
  return { type: 'track', slug: trackSlug };
}

function buildAcademyHash(selection) {
  if (selection.type === 'hub') return '#/academy';
  if (selection.type === 'track') return `#/academy/track/${selection.slug}`;
  if (selection.type === 'lesson') {
    const trackSlug = selection.trackSlug || getLessonById(selection.id)?.trackSlug;
    return trackSlug ? `#/academy/track/${trackSlug}/lesson/${selection.id}` : '#/academy';
  }
  if (selection.type === 'template') {
    const trackSlug = selection.trackSlug || getTemplateMeta(selection.id)?.trackSlug;
    return trackSlug ? `#/academy/track/${trackSlug}/template/${selection.id}` : '#/academy';
  }
  return '#/academy';
}

function validateSelection(selection) {
  if (selection.type === 'hub') return selection;
  if (selection.type === 'track') {
    const track = ACADEMY_TRACKS.find((t) => t.slug === selection.slug);
    return track ? selection : { type: 'hub' };
  }
  if (selection.type === 'lesson') {
    const lesson = getLessonById(selection.id);
    if (!lesson) return { type: 'hub' };
    const track = ACADEMY_TRACKS.find((t) => t.slug === (selection.trackSlug || lesson.trackSlug));
    if (!track) return { type: 'hub' };
    return { type: 'lesson', id: selection.id, trackSlug: lesson.trackSlug };
  }
  if (selection.type === 'template') {
    const meta = getTemplateMeta(selection.id);
    if (!meta) return { type: 'hub' };
    const track = ACADEMY_TRACKS.find((t) => t.slug === (selection.trackSlug || meta.trackSlug));
    if (!track) return { type: 'hub' };
    return { type: 'template', id: selection.id, trackSlug: meta.trackSlug };
  }
  return { type: 'hub' };
}

function AcademyApp() {
  const parseHash = useCallback(() => {
    const parsed = parseAcademyHash();
    if (!parsed) return { type: 'hub' };
    return validateSelection(parsed);
  }, []);

  const [selection, setSelection] = useState(() => parseHash());
  const bookmarksApi = useAcademyBookmarks();
  const progressApi = useAcademyProgress();

  useEffect(() => {
    const handlePopState = () => {
      setSelection(parseHash());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseHash]);

  const pushAcademyHash = useCallback((newSelection) => {
    setSelection(newSelection);
    const hash = buildAcademyHash(newSelection);
    const newUrl = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.pushState({}, '', newUrl);
  }, []);

  const openTrack = useCallback((slug) => pushAcademyHash({ type: 'track', slug }), [pushAcademyHash]);
  const openLesson = useCallback((id) => {
    progressApi.markInProgress(id);
    const lesson = getLessonById(id);
    if (lesson) pushAcademyHash({ type: 'lesson', id, trackSlug: lesson.trackSlug });
  }, [pushAcademyHash, progressApi]);
  const openTemplate = useCallback((id) => {
    const meta = getTemplateMeta(id);
    if (meta) pushAcademyHash({ type: 'template', id, trackSlug: meta.trackSlug });
  }, [pushAcademyHash]);

  let body = null;
  let crumb = 'Smart Video Academy';
  if (selection.type === 'hub') {
    body = (
      <Hub
        onOpenTrack={openTrack}
        bookmarks={bookmarksApi.bookmarks}
        onToggleBookmark={bookmarksApi.toggleBookmark}
        onOpenLesson={openLesson}
        progressApi={progressApi}
      />
    );
  } else if (selection.type === 'track') {
    const track = ACADEMY_TRACKS.find((t) => t.slug === selection.slug);
    crumb = track ? track.title : crumb;
    body = track ? (
      <TrackView
        track={track}
        onOpenLesson={openLesson}
        onOpenTemplate={openTemplate}
        onBackToHub={() => pushAcademyHash({ type: 'hub' })}
        bookmarks={bookmarksApi.bookmarks}
        onToggleBookmark={bookmarksApi.toggleBookmark}
        progressApi={progressApi}
      />
    ) : (
      <Hub onOpenTrack={openTrack} bookmarks={bookmarksApi.bookmarks} onToggleBookmark={bookmarksApi.toggleBookmark} onOpenLesson={openLesson} progressApi={progressApi} />
    );
  } else if (selection.type === 'lesson') {
    const lesson = getLessonById(selection.id);
    crumb = lesson ? lesson.title : crumb;
    body = lesson ? (
      <LessonView
        lesson={lesson}
        trackSlug={selection.trackSlug}
        onOpenTemplate={openTemplate}
        onBackToTrack={() => pushAcademyHash({ type: 'track', slug: selection.trackSlug })}
        isBookmarked={bookmarksApi.isBookmarked(lesson.id)}
        onToggleBookmark={bookmarksApi.toggleBookmark}
        status={progressApi.getStatus(lesson.id)}
        onToggleCompleted={() => progressApi.toggleCompleted(lesson.id)}
      />
    ) : null;
  } else if (selection.type === 'template') {
    const meta = getTemplateMeta(selection.id);
    crumb = meta ? meta.title : crumb;
    body = meta ? (
      <TemplateEditor meta={meta} onOpenLesson={openLesson} />
    ) : null;
  }

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-app-bg text-white">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 sticky top-0 bg-app-bg/80 backdrop-blur z-10">
        <button
          onClick={() => {
            const newUrl = `${window.location.pathname}${window.location.search}#/academy`;
            window.history.pushState({}, '', newUrl);
            setSelection({ type: 'hub' });
          }}
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <Icon name="GraduationCap" size={18} /> Smart Video Academy
        </button>
        {selection.type !== 'hub' ? (
          <>
            <Icon name="ChevronRight" size={14} className="text-white/30" />
            <span className="text-sm text-white/70 truncate max-w-[60%]">{crumb}</span>
          </>
        ) : null}
        <div className="ml-auto">
          <button
            onClick={() => navigate('apps')}
            className="text-sm text-white/50 hover:text-white inline-flex items-center gap-1"
          >
            <Icon name="X" size={16} /> Exit
          </button>
        </div>
      </div>
      <div className="px-5 py-6 flex justify-center">{body}</div>
    </div>
  );
}

export function AcademyPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full';
  const root = createRoot(container);
  root.render(<AcademyApp />);
  container.cleanup = () => root.unmount();
  return container;
}
