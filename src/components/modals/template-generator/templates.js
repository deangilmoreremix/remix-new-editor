/**
 * Template Generator — reusable templates.
 *
 * A saved template is a *recipe*: everything the wizard collected (niche, script, clips, transition,
 * text elements, voice) so the user can open it again, swap footage or tweak words, and add it to a
 * timeline as many times as they like. It is plain JSON (no DOM, no network) so it can live in
 * localStorage today and in a database later without changing shape.
 *
 *   record = { id, version, name, description, niche, scriptId, script, transition, elements,
 *              voice, clips[], clipCount, duration, thumbnail, uses, createdAt, updatedAt }
 */
import { createWizardState, STEPS, clipDuration } from './rules.js';

export const TEMPLATE_VERSION = 1;
export const STORAGE_KEY = 'remix.templateGenerator.templates.v1';

/** URLs that stop working after a reload / on another device cannot be part of a reusable template. */
export const isDurableUrl = (u) => /^https?:\/\//i.test(String(u || '')) || String(u || '').startsWith('/');

const clipRecord = (it) => ({
  id: it.id, kind: it.kind, source: it.source, title: it.title,
  url: it.url, preview: it.preview, poster: it.poster, duration: it.duration || 0,
  width: it.width, height: it.height, user: it.user || '', pageURL: it.pageURL || '',
});

/** Split picked clips into the ones a template can keep and those it can't (blob:/data: links). */
export function splitDurable(items = []) {
  const keep = []; const dropped = [];
  for (const it of items) (isDurableUrl(it.url) ? keep : dropped).push(it);
  return { keep, dropped };
}

/** Wizard state → template record (no id / timestamps: the store adds them). */
export function snapshotTemplate(s, { name = '', description = '' } = {}) {
  const { keep } = splitDurable(s.selectedVideos);
  const first = keep[0];
  return {
    version: TEMPLATE_VERSION,
    name: String(name || s.selectedScript?.name || s.niche || 'Untitled template').trim().slice(0, 80),
    description: String(description || '').trim().slice(0, 240),
    niche: s.niche || s.selectedScript?.niche || null,
    scriptId: s.selectedScript?.id || null,
    scriptName: s.selectedScript?.name || null,
    script: { text: s.script.text, tone: s.script.tone, audience: s.script.audience, cta: s.script.cta },
    details: { ...(s.details || {}) },
    transition: s.selectedTransition ? { type: s.selectedTransition.type, duration: s.selectedTransition.duration || 1 } : null,
    elements: { ...s.elements },
    voice: { enabled: !!s.voice.enabled, provider: s.voice.provider, voice: s.voice.voice, instructions: s.voice.instructions },
    personalization: { enabled: !!s.personalization.enabled },
    animations: (s.selectedAnimations || []).map((a) => ({ ...a })),
    clips: keep.map(clipRecord),
    clipCount: keep.length,
    duration: Math.round(keep.reduce((n, v) => n + clipDuration(v), 0) * 10) / 10,
    // a real still when there is one; otherwise the first video itself (the library shows its first frame)
    thumbnail: first ? (first.poster || (first.kind === 'image' ? first.url : '')) : '',
    thumbnailVideo: first && !first.poster && first.kind === 'video' ? first.url : '',
  };
}

/**
 * Template record → a fresh wizard state, opened on the Video step so footage can be swapped.
 * `findScript(id)` resolves the niche script card (it is not stored in full, so edits to the
 * built-in scripts reach existing templates).
 */
export function restoreTemplate(rec, findScript = () => null) {
  const s = createWizardState();
  s.started = true;
  s.step = STEPS.VIDEO;
  s.niche = rec.niche || null;
  s.selectedScript = rec.scriptId ? findScript(rec.scriptId) : null;
  s.script = { text: '', tone: 'conversational', audience: 'general', cta: '', ...rec.script };
  s.details = { ...s.details, ...(rec.details || {}) };
  s.selectedTransition = rec.transition ? { ...rec.transition } : null;
  s.elements = { captions: true, title: '', lowerThird: '', cta: '', ...rec.elements };
  s.voice = { ...s.voice, ...rec.voice };
  s.personalization = { ...s.personalization, enabled: !!rec.personalization?.enabled };
  s.selectedVideos = (rec.clips || []).map((c) => ({ ...c }));
  s.selectedAnimations = (rec.animations || []).map((a) => ({ ...a }));
  s.templateId = rec.id || null;
  s.templateName = rec.name || '';
  return s;
}

// ---------------------------------------------------------------------------- store

const newId = () => `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function defaultStorage() {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* blocked */ }
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, v); } };
}

/**
 * localStorage-backed template library (same approach as the editor's other saved items).
 * `storage` is injectable for tests; falls back to memory when storage is blocked.
 */
export function createTemplateStore(storage = defaultStorage(), key = STORAGE_KEY) {
  const read = () => {
    try {
      const v = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(v) ? v.filter((t) => t && t.id) : [];
    } catch { return []; }
  };
  const write = (list) => {
    try { storage.setItem(key, JSON.stringify(list)); } catch (e) {
      throw new Error("Couldn't save the template — your browser storage is full. Delete an old template and try again.");
    }
  };
  const put = (list, rec) => { write(list); return rec; };
  const tombKey = `${key}.deleted`;
  const readTombs = () => {
    try { const v = JSON.parse(storage.getItem(tombKey) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
  };
  const writeTombs = (t) => { try { storage.setItem(tombKey, JSON.stringify(t)); } catch { /* best-effort */ } };

  return {
    list: () => read().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    get: (id) => read().find((t) => t.id === id) || null,
    /** Create a template, or overwrite `id` when given and found. */
    save(record, { id = null } = {}) {
      const list = read();
      const now = Date.now();
      const i = id ? list.findIndex((t) => t.id === id) : -1;
      if (i >= 0) {
        const rec = { ...list[i], ...record, id: list[i].id, createdAt: list[i].createdAt, uses: list[i].uses || 0, updatedAt: now };
        list[i] = rec;
        return put(list, rec);
      }
      const rec = { ...record, id: newId(), uses: 0, createdAt: now, updatedAt: now };
      list.push(rec);
      return put(list, rec);
    },
    duplicate(id) {
      const list = read();
      const t = list.find((x) => x.id === id);
      if (!t) return null;
      const now = Date.now();
      const rec = { ...t, id: newId(), name: `${t.name} (copy)`.slice(0, 80), uses: 0, createdAt: now, updatedAt: now };
      list.push(rec);
      return put(list, rec);
    },
    remove(id) {
      const list = read();
      const next = list.filter((t) => t.id !== id);
      if (next.length === list.length) return false;
      write(next);
      // Remember the delete so sync can tell other devices (otherwise they'd upload it again).
      const t = readTombs(); t[id] = Date.now(); writeTombs(t);
      return true;
    },
    // ---- used by sync: write / drop records exactly as given, without touching timestamps ----
    put(record) {
      const list = read();
      const i = list.findIndex((t) => t.id === record.id);
      if (i >= 0) list[i] = record; else list.push(record);
      write(list);
      return record;
    },
    forget(id) { write(read().filter((t) => t.id !== id)); },
    tombstones: () => readTombs(),
    clearTombstone(id) { const t = readTombs(); if (id in t) { delete t[id]; writeTombs(t); } },
    /** Count a use (keeps updatedAt so "recently edited" still means edited). */
    touch(id) {
      const list = read();
      const t = list.find((x) => x.id === id);
      if (!t) return;
      t.uses = (t.uses || 0) + 1;
      t.lastUsedAt = Date.now();
      try { write(list); } catch { /* usage count is best-effort */ }
    },
  };
}
