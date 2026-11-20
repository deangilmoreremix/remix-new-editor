'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy as CopyIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Hash,
  MessageSquare,
  Target,
  Wand2,
  Type,
  AlignLeft,
  ImageIcon,
  Film,
} from 'lucide-react';
import { WriteStepProps, CopyState } from '../types';
import { SocialCopyEditor } from '../copy/SocialCopyEditor';
import { AiWritingToolbar } from '../copy/AiWritingToolbar';
import { PlatformCopyTabs } from '../copy/PlatformCopyTabs';
import { CopyVariantCards } from '../copy/CopyVariantCards';
import {
  generateCopy,
  rewrite,
  enhance,
  shorten,
  expand,
  hook,
  cta,
  hashtags,
  professional,
  conversational,
  persuasive,
  platformize,
  refine,
} from '@ohb/shared/api/socialCopyService';

const PLATFORMS = [
  { id: 'master', label: 'Master' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'threads', label: 'Threads' },
  { id: 'x', label: 'X' },
];

/** True when an AI action failed only because the customer has not saved an OpenAI key. */
export function isMissingOpenAiKeyError(message: string): boolean {
  return /UNAUTHENTICATED|OpenAI error: 401|No OpenAI API key|OpenAI key/i.test(message);
}

const VARIANT_LABELS = [
  { id: 'v1', label: 'VERSION 1 — Direct' },
  { id: 'v2', label: 'VERSION 2 — High Energy' },
  { id: 'v3', label: 'VERSION 3 — Storytelling' },
];

type Tone = 'professional' | 'conversational' | 'persuasive'
type Length = 'short' | 'medium' | 'long'

const emptyPlatforms: CopyState['platforms'] = {
  youtube: { title: '', description: '' },
  instagram: { caption: '' },
  tiktok: { caption: '' },
  facebook: { caption: '' },
  linkedin: { caption: '' },
  pinterest: { caption: '' },
  threads: { caption: '' },
  x: { caption: '' },
};

function buildEmptyCopy(master = ''): CopyState {
  return {
    master,
    platforms: JSON.parse(JSON.stringify(emptyPlatforms)),
    variants: VARIANT_LABELS.map((v) => ({
      id: v.id,
      label: v.label,
      text: '',
    })),
  };
}

function getPrefillTopic(asset: WriteStepProps['asset']): string {
  return (
    asset.title ||
    asset.description ||
    asset.prompt ||
    asset.script ||
    asset.studio ||
    ''
  );
}

export function WriteStep({ asset, copy, onUpdateCopy, onRequestApiKey, sessionId }: WriteStepProps) {
  // AI writing can still be running when the modal is reopened for another asset: its answer must not land there.
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const isStale = (startedIn: number | undefined) => !mountedRef.current || sessionRef.current !== startedIn;

  const [topic, setTopic] = useState(getPrefillTopic(asset));
  const [activePlatform, setActivePlatform] = useState('master');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsOpenAiKey, setNeedsOpenAiKey] = useState(false);
  const [localCopy, setLocalCopy] = useState<CopyState>(() => {
    const start = copy.master || (copy.variants?.length || 0) > 0 ? copy : buildEmptyCopy('');
    // A copy that arrives with a master post but no variant slots still gets its three slots.
    return start.variants?.length ? start : { ...start, variants: buildEmptyCopy('').variants };
  });

  useEffect(() => {
    setTopic(getPrefillTopic(asset));
  }, [asset]);

  const currentText = useMemo(() => {
    if (activePlatform === 'master') return localCopy.master;
    // YouTube's body is its description (that is what publishing sends); other platforms use the caption
    if (activePlatform === 'youtube') return localCopy.platforms.youtube?.description || localCopy.platforms.youtube?.caption || '';
    return localCopy.platforms[activePlatform]?.caption || '';
  }, [activePlatform, localCopy]);

  const counts = useMemo(() => {
    const text = currentText || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const hashCount = (text.match(/#\w+/g) || []).length;
    return { chars, words, hashCount };
  }, [currentText]);

  const platformWarnings = useMemo(() => {
    const warnings: string[] = [];
    const chars = counts.chars;
    if (activePlatform === 'youtube' && chars > 5000) warnings.push('YouTube description exceeds 5000 chars');
    if (activePlatform === 'instagram' && chars > 2200) warnings.push('Instagram caption exceeds 2200 chars');
    if (activePlatform === 'tiktok' && chars > 2200) warnings.push('TikTok caption exceeds 2200 chars');
    if (activePlatform === 'facebook' && chars > 63206) warnings.push('Facebook post exceeds 63206 chars');
    if (activePlatform === 'x' && chars > 280) warnings.push('X posts are limited to 280 characters');
    if (counts.hashCount > 30) warnings.push('Too many hashtags may reduce reach');
    return warnings;
  }, [activePlatform, counts]);

  function emit(copyState: CopyState) {
    // remember what the learner touched, so an edit (even clearing a field) beats studio-supplied values later
    const edited = { ...(localCopy.edited || {}), ...(copyState.edited || {}) };
    if (copyState.master !== localCopy.master) edited.master = true;
    if ((copyState.title ?? '') !== (localCopy.title ?? '')) edited.title = true;
    const next = { ...copyState, edited };
    setLocalCopy(next);
    onUpdateCopy(next);
  }

  function updateMaster(text: string) {
    emit({ ...localCopy, master: text });
  }

  function updatePlatformText(platformId: string, text: string) {
    // YouTube publishes `description`; keep the generated and the edited text in the same field
    const field = platformId === 'youtube' ? 'description' : 'caption';
    const prevEdited = localCopy.edited || {};
    const next: CopyState = {
      ...localCopy,
      // remember the touch (even a cleared field) so the studio's value cannot come back for this platform
      edited: { ...prevEdited, platforms: { ...(prevEdited.platforms || {}), [platformId]: { ...(prevEdited.platforms?.[platformId] || {}), [field]: true } } },
      platforms: {
        ...localCopy.platforms,
        [platformId]: {
          ...localCopy.platforms[platformId],
          [field]: text,
        },
      },
    };
    emit(next);
  }

  async function handleGenerateVariants() {
    if (!topic.trim()) {
      setError('Enter a post topic first');
      return;
    }
    const startedIn = sessionRef.current;
    setLoading(true);
    setError(null);
    setNeedsOpenAiKey(false);
    setStatus('Generating copy variants…');
    try {
      const result = await generateCopy(topic, asset);
      if (isStale(startedIn)) return;
      const master = result.masterPost || '';
      // The publish flow can open with a title (so a master post) but no variant slots yet: build them, never map over [].
      const slots = localCopy.variants.length > 0 ? localCopy.variants : buildEmptyCopy('').variants;
      const variants = slots.map((v, idx) => ({
        ...v,
        text: result.variants?.[idx] || '',
      }));
      const next: CopyState = {
        ...localCopy,
        master,
        variants,
        selectedVariantId: 'v1',
        // fill the fields publishing needs; never overwrite what the user already typed
        title: localCopy.title?.trim() ? localCopy.title : result.youtube?.title || '',
        platforms: {
          ...localCopy.platforms,
          youtube: {
            ...localCopy.platforms.youtube,
            title: localCopy.platforms.youtube?.title?.trim() ? localCopy.platforms.youtube.title : result.youtube?.title || '',
            description: localCopy.platforms.youtube?.description?.trim() ? localCopy.platforms.youtube.description : result.youtube?.description || '',
          },
          instagram: { ...localCopy.platforms.instagram, caption: localCopy.platforms.instagram?.caption?.trim() ? localCopy.platforms.instagram.caption : result.instagram?.caption || '' },
          tiktok: { ...localCopy.platforms.tiktok, caption: localCopy.platforms.tiktok?.caption?.trim() ? localCopy.platforms.tiktok.caption : result.tiktok?.caption || '' },
        },
      };
      emit(next);
      setStatus('Variants generated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate copy';
      if (isMissingOpenAiKeyError(msg)) setNeedsOpenAiKey(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleAiAction(
    action: 'write' | 'improve' | 'hook' | 'cta' | 'hashtags' | 'tone' | 'length' | 'platformize' | 'refine',
    tone?: Tone,
    length?: Length
  ) {
    if (action === 'write') {
      await handleGenerateVariants();
      return;
    }
    const base = currentText || topic;
    if (!base.trim()) {
      setError('Add some copy first');
      return;
    }
    const startedIn = sessionRef.current;
    setLoading(true);
    setError(null);
    setNeedsOpenAiKey(false);
    setStatus(`Running ${action}…`);
    try {
      let resultText = '';
      switch (action) {
        case 'improve':
          resultText = (await enhance(base, asset)).masterPost || base;
          break;
        case 'hook':
          resultText = (await hook(base, asset)).masterPost || base;
          break;
        case 'cta':
          resultText = (await cta(base, asset)).masterPost || base;
          break;
        case 'hashtags':
          resultText = (await hashtags(base, asset)).masterPost || base;
          break;
        case 'tone':
          if (!tone) throw new Error('Select a tone');
          const toneResult =
            tone === 'professional'
              ? await professional(base, asset)
              : tone === 'conversational'
                ? await conversational(base, asset)
                : await persuasive(base, asset);
          resultText = toneResult.masterPost || base;
          break;
        case 'length':
          if (!length) throw new Error('Select a length');
          if (length === 'short') {
            resultText = (await shorten(base, asset)).masterPost || base;
          } else if (length === 'long') {
            resultText = (await expand(base, asset)).masterPost || base;
          } else {
            resultText = base;
          }
          break;
        case 'platformize':
          resultText = (await platformize(base, activePlatform === 'master' ? 'youtube' : activePlatform, asset)).masterPost || base;
          break;
        case 'refine':
          resultText = (await refine(base, asset)).masterPost || base;
          break;
        default:
          throw new Error('Unknown action');
      }
      if (isStale(startedIn)) return;
      if (activePlatform === 'master') {
        updateMaster(resultText);
      } else {
        updatePlatformText(activePlatform, resultText);
      }
      setStatus('Done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI action failed';
      if (isMissingOpenAiKeyError(msg)) setNeedsOpenAiKey(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectVariant(id: string) {
    const variant = localCopy.variants.find((v) => v.id === id);
    if (!variant) return;
    emit({
      ...localCopy,
      master: variant.text,
      selectedVariantId: id,
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Write</h2>
          <p className="text-[11px] text-white/40">
            {asset.type === 'video' ? 'Video' : 'Image'} · {asset.studio || 'Social Publishing'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLocalCopy(buildEmptyCopy(''));
              onUpdateCopy(buildEmptyCopy(''));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        </div>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <label className="block text-[11px] font-bold uppercase tracking-wide text-white/40 mb-1.5">
          Post topic
        </label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What is this post about?"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d9ff00]/50"
        />
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="social-post-title" className="block text-[11px] font-bold uppercase tracking-wide text-white/40">
            Title <span className="font-normal normal-case text-white/30">(required for YouTube, used by TikTok and Pinterest)</span>
          </label>
          <span className="text-[10px] text-white/40" aria-live="polite">{(localCopy.title || '').length}/100</span>
        </div>
        <input
          id="social-post-title"
          value={localCopy.title || ''}
          maxLength={150}
          onChange={(e) =>
            // the visible Title is the one title: keep YouTube's own title (generated or not) in step with it
            emit({ ...localCopy, title: e.target.value, platforms: { ...localCopy.platforms, youtube: { ...localCopy.platforms.youtube, title: e.target.value } } })
          }
          placeholder="Give your post a title"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d9ff00]/50"
        />
        {(localCopy.title || '').length > 100 && (
          <p className="mt-1 text-[11px] text-amber-300">YouTube allows up to 100 characters; TikTok up to 150.</p>
        )}
      </div>

      <SocialCopyEditor
        text={currentText}
        onChange={(text) => {
          if (activePlatform === 'master') updateMaster(text);
          else updatePlatformText(activePlatform, text);
        }}
        counts={counts}
        warnings={platformWarnings}
        loading={loading}
      />

      <AiWritingToolbar
        onAction={handleAiAction}
        loading={loading}
        disabled={!topic.trim() && !currentText}
      />

      <PlatformCopyTabs
        platforms={PLATFORMS}
        active={activePlatform}
        onChange={setActivePlatform}
      />

      <CopyVariantCards
        variants={localCopy.variants}
        selectedId={localCopy.selectedVariantId}
        onSelect={handleSelectVariant}
        onGenerate={handleGenerateVariants}
        loading={loading}
      />

      {needsOpenAiKey && (
        <div role="alert" data-testid="social-needs-openai-key" className="rounded-xl border p-3" style={{ borderColor: 'rgba(217,255,0,0.3)', background: 'rgba(217,255,0,0.06)' }}>
          <p className="text-sm font-bold text-white">Add your OpenAI key to use AI writing</p>
          <p className="mt-1 text-xs text-white/50">
            AI writing runs on your own OpenAI account. You can still write your post by hand and publish without it.
          </p>
          {onRequestApiKey && (
            <button type="button" onClick={onRequestApiKey} className="mt-2 rounded-lg bg-[#d9ff00] px-3 py-1.5 text-xs font-bold text-black">
              Open API keys
            </button>
          )}
        </div>
      )}

      {(status || error) && (
        <div
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg p-3 text-xs"
          style={{
            background: error ? 'rgba(239,68,68,0.1)' : 'rgba(217,255,0,0.1)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.2)' : 'rgba(217,255,0,0.2)'}`,
            color: error ? '#fca5a5' : '#a5f3fc',
          }}
        >
          {error ? <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> : <Sparkles size={14} className="mt-0.5 flex-shrink-0" />}
          <span>{error || status}</span>
        </div>
      )}
    </div>
  );
}
