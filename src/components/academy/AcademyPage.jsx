// Smart Video Academy — browses ALL imported tracks (15) from the cloned
// upstream academy. Lessons/Templates are catalog-driven; track 01 keeps its
// rich interactive editors, the other 14 render as documents via the Markdown
// renderer. Mounted by the router as the `academy` route.
import React, { useState } from 'react';
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

function LessonView({ lesson, onOpenTemplate }) {
  const [tab, setTab] = useState('learn');
  const rich = RICH_LESSONS.find((l) => l.id === lesson.id);
  const relatedTemplates = lesson.relatedTemplateIds.map(getTemplateMeta).filter(Boolean);

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-white/40">Lesson {lesson.order}{lesson.time ? ' · ' + lesson.time : ''}</p>
        <h2 className="text-2xl font-bold text-white">{lesson.title}</h2>
        <p className="text-sm text-white/60 mt-1">{lesson.summary}</p>
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

function TrackView({ track, onOpenLesson, onOpenTemplate }) {
  const lessons = ACADEMY_LESSONS.filter((l) => l.trackSlug === track.slug);
  const templates = ACADEMY_TEMPLATE_META.filter((t) => t.trackSlug === track.slug);
  return (
    <div className="w-full max-w-5xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-wide text-white/40">Track {track.order}</p>
        <h1 className="text-2xl font-bold text-white">{track.title}</h1>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">{track.summary}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-white mb-3">Lessons ({lessons.length})</p>
          <div className="space-y-2">
            {lessons.map((l) => (
              <button
                key={l.id}
                onClick={() => onOpenLesson(l.id)}
                className={cardCls + ' w-full text-left hover:border-white/25 transition flex items-center gap-3'}
              >
                <span className="text-lg font-black text-white/30 w-6 text-center">{l.order}</span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">{l.title}</span>
                  <span className="block text-xs text-white/50 line-clamp-1">{l.summary}</span>
                </span>
                <Icon name="ChevronRight" size={16} className="text-white/40" />
              </button>
            ))}
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

function Hub({ onOpenTrack }) {
  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 mb-6">
        <p className="text-xs uppercase tracking-wide text-white/40">Smart Video Academy</p>
        <h1 className="text-3xl font-black text-white tracking-tight mt-1">AI Creator Academy</h1>
        <p className="text-sm text-white/60 mt-2 max-w-2xl">
          {ACADEMY_TRACKS.length} tracks, {ACADEMY_LESSONS.length} lessons and {ACADEMY_TEMPLATE_META.length} templates
          imported from the creator academy. Learn the concept, see the real examples, then create with SmartVideo's studios.
        </p>
      </div>
      <p className="text-sm font-semibold text-white mb-3">Tracks</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACADEMY_TRACKS.map((t) => (
          <button
            key={t.slug}
            onClick={() => onOpenTrack(t.slug)}
            className={cardCls + ' text-left hover:border-white/25 transition'}
          >
            <p className="text-xs text-white/40">Track {t.order}</p>
            <p className="text-sm font-semibold text-white mt-0.5">{t.title}</p>
            <p className="text-xs text-white/50 mt-1 line-clamp-2">{t.summary}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function AcademyApp() {
  const [selection, setSelection] = useState({ type: 'hub' });
  const openTrack = (slug) => setSelection({ type: 'track', slug });
  const openLesson = (id) => setSelection({ type: 'lesson', id });
  const openTemplate = (id) => setSelection({ type: 'template', id });

  let body = null;
  let crumb = 'Smart Video Academy';
  if (selection.type === 'hub') {
    body = <Hub onOpenTrack={openTrack} />;
  } else if (selection.type === 'track') {
    const track = ACADEMY_TRACKS.find((t) => t.slug === selection.slug);
    crumb = track ? track.title : crumb;
    body = track ? <TrackView track={track} onOpenLesson={openLesson} onOpenTemplate={openTemplate} /> : <Hub onOpenTrack={openTrack} />;
  } else if (selection.type === 'lesson') {
    const lesson = getLessonById(selection.id);
    crumb = lesson ? lesson.title : crumb;
    body = lesson ? <LessonView lesson={lesson} onOpenTemplate={openTemplate} /> : null;
  } else if (selection.type === 'template') {
    const meta = getTemplateMeta(selection.id);
    crumb = meta ? meta.title : crumb;
    body = meta ? <TemplateEditor meta={meta} onOpenLesson={openLesson} /> : null;
  }

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-app-bg text-white">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 sticky top-0 bg-app-bg/80 backdrop-blur z-10">
        <button
          onClick={() => setSelection({ type: 'hub' })}
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
