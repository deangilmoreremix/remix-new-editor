// src/components/personalize/PersonalizationHubPanel.js
//
// Personalization Hub panel — the user-reachable surface for the ported
// personalization subsystem.
//
// A small vanilla-DOM component (no framework, no new dependencies) that
// follows the same mount/unmount idiom as ./personalizePopover.js and the
// studio pages (see ../Personalizer.js). It renders into any container
// element and is driven EXCLUSIVELY by the existing stores:
//
//   - clientProfileStore   (client profiles: create / edit / select)
//   - assetLibraryStore    (asset library: add / set primary / remove / import)
//   - sharedMediaStore     (AI Assist outputs)
//   - studioBridge         (resolveForRenderStudio / resolveForCineGen)
//
// The panel owns NO personalization state of its own — the only local state
// is DOM handles plus the website-discovery poll timer.
//
// The OpenAI-backed AI Assist module is loaded lazily (dynamic import on
// first use), exactly like the popover lazy-loads PersonalizeModal, so
// mounting the hub never pulls the provider SDK graph into the host page.
//
// Website discovery runs on the SERVER: the pipeline is Node-only (SSRF-safe
// DNS resolution and private-IP checks require node:dns/node:crypto), so it
// is exposed through the personalization-discovery Netlify function. The
// discovery module itself is NEVER imported here — the panel only talks to
// that endpoint over fetch, which is also why no Node-only discovery code
// can reach the client bundle.
//
// Lifecycle:
//   const hub = mountPersonalizationHub(container); // renders + subscribes
//   unmountPersonalizationHub();                    // cleanup (no args)
// At most one hub is live at a time: mounting a second one unmounts the first.

import { clientProfileStore } from './clientProfileStore.js';
import { assetLibraryStore } from './assetLibraryStore.js';
import { sharedMediaStore } from './sharedMediaStore.js';
import {
  hasPersonalizationData,
  resolveForCineGen,
  resolveForRenderStudio,
} from './studioBridge.js';
import { getPersonalizationAccessToken } from '../../lib/personalizationAuth.js';

/**
 * The six spec roles the hub manages, with their display labels.
 * Mirrors AI_ASSIST_ROLE_LABELS in ./personalizeAiAssist.js 1:1 — duplicated
 * here (as plain data) so the hub does not statically import the
 * OpenAI-backed module.
 * @type {readonly {role: import('./types.js').AssetRole, label: string}[]}
 */
export const HUB_ROLES = Object.freeze([
  Object.freeze({ role: 'face_identity', label: 'Person' }),
  Object.freeze({ role: 'logo', label: 'Logo' }),
  Object.freeze({ role: 'product_reference', label: 'Product' }),
  Object.freeze({ role: 'brand_reference', label: 'Brand' }),
  Object.freeze({ role: 'first_frame', label: 'First frame' }),
  Object.freeze({ role: 'last_frame', label: 'Last frame' }),
]);

/**
 * Endpoint of the server-side discovery function (Netlify Functions v1
 * route). The Node-only discovery engine — SSRF-hardened DNS resolution and
 * private-IP checks — runs behind it; the panel only speaks HTTP to it.
 */
export const HUB_DISCOVERY_ENDPOINT = '/.netlify/functions/personalization-discovery';

/** Website-discovery poll cadence (ms) — kept between 800 and 1200ms. */
export const HUB_DISCOVERY_POLL_MS = 900;

/** Hard caps so a stuck or abandoned job can never poll forever. */
export const HUB_DISCOVERY_MAX_POLLS = 120;
export const HUB_DISCOVERY_TIMEOUT_MS = 150_000;

/** Matches the engine's URL length cap; the server enforces it too. */
export const HUB_DISCOVERY_MAX_URL_LENGTH = 2048;

/** Discovery buckets, mapped onto the asset-library roles they import as. */
const DISCOVERY_BUCKETS = Object.freeze([
  Object.freeze({ key: 'logos', label: 'Logos', role: 'logo' }),
  Object.freeze({ key: 'products', label: 'Products', role: 'product_reference' }),
  Object.freeze({ key: 'brandReferences', label: 'Brand references', role: 'brand_reference' }),
  Object.freeze({ key: 'urls', label: 'Other images', role: 'saved_reference' }),
]);

/** Server job statuses that end the polling loop. */
const TERMINAL_JOB_STATUSES = Object.freeze(['done', 'failed', 'cancelled', 'unknown']);

/** @type {{ element: HTMLElement, refresh: () => void, destroy: () => void } | null} */
let activeHub = null;

/**
 * Handles into the live hub's dynamic regions. Held at module level (like
 * `activeHub`) because the hub is a singleton: at most one panel exists.
 * @type {{ aiResults: HTMLElement | null, aiStatus: HTMLElement | null, discoverStatus: HTMLElement | null, discoverResults: HTMLElement | null }}
 */
const liveRegions = {
  aiResults: null,
  aiStatus: null,
  discoverStatus: null,
  discoverResults: null,
};

// ─── Pure helpers (exported for tests) ────────────────────────────────────

/**
 * Project the flat `assetLibraryStore` asset list into the bucketed
 * `AssetLibrary` shape that `resolveAssetForRole` (and therefore
 * `runAiAssistEdit`) expects.
 *
 * @param {import('./types.js').PersonalizationAsset[]} [assets]
 * @returns {import('./types.js').AssetLibrary}
 */
export function buildLibraryProjection(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const bucket = (...roles) => list.filter((a) => roles.includes(a.role));
  const identities = bucket('face_identity', 'presenter_identity', 'character_identity');
  const logos = bucket('logo');
  const products = bucket('product_reference');
  const brandReferences = bucket('brand_reference', 'background_reference');
  const savedReferences = bucket('saved_reference');
  const firstFrame = bucket('first_frame')[0] || null;
  const lastFrame = bucket('last_frame')[0] || null;
  const ctaGraphic = bucket('cta_graphic')[0] || null;
  const audio = bucket('audio_reference');
  const primaryOf = (arr) => arr.find((a) => a.isPrimary) || null;
  return {
    identities,
    primaryIdentity: primaryOf(identities),
    logos,
    primaryLogo: primaryOf(logos),
    products,
    brandReferences,
    firstFrame,
    lastFrame,
    ctaGraphic,
    audio,
    savedReferences,
  };
}

/**
 * Resolve the display src for an output URL on a shared-media entry.
 * AI Assist image outputs are base64 payloads and must become data URLs.
 * A value that is already a data URL (a provider that returned one, or a
 * re-render of a persisted record) passes through untouched — never
 * double-prefix it.
 *
 * @param {import('./types.js').SharedMediaEntry} entry
 * @param {string} url
 * @returns {string}
 */
export function toOutputSrc(entry, url) {
  if (typeof url !== 'string' || url.length === 0) return '';
  if (entry && entry.outputIsBase64) {
    if (url.slice(0, 5).toLowerCase() === 'data:') return url;
    return `data:${entry.outputMime || 'image/png'};base64,${url}`;
  }
  return url;
}

/**
 * Normalize a discovery `found` payload into renderable buckets.
 *
 * @param {{ urls?: string[], logos?: string[], products?: string[], brandReferences?: string[] }} [found]
 * @returns {{ key: string, label: string, role: import('./types.js').AssetRole, urls: string[] }[]}
 */
export function discoveryResultBuckets(found) {
  const source = found && typeof found === 'object' ? found : {};
  return DISCOVERY_BUCKETS
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      role: bucket.role,
      urls: Array.isArray(source[bucket.key]) ? source[bucket.key].filter((u) => typeof u === 'string') : [],
    }))
    .filter((bucket) => bucket.urls.length > 0);
}

/**
 * Decide, per discovered URL, whether it already exists in the library
 * (import) or is new (add). Pure so the decision is testable without DOM.
 *
 * @param {{ urls?: string[], logos?: string[], products?: string[], brandReferences?: string[] }} [found]
 * @param {import('./types.js').PersonalizationAsset[]} [existingAssets]
 * @returns {{ url: string, role: import('./types.js').AssetRole, name: string, action: 'add' | 'import', id?: string }[]}
 */
export function planDiscoveryImport(found, existingAssets) {
  const existing = Array.isArray(existingAssets) ? existingAssets : [];
  const plan = [];
  const seen = new Set();
  for (const bucket of discoveryResultBuckets(found)) {
    for (const url of bucket.urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      const match = existing.find((a) => a.url === url || a.uploadedUrl === url);
      if (match) {
        plan.push({ url, role: bucket.role, name: match.name || nameFromUrl(url), action: 'import', id: match.id });
      } else {
        plan.push({ url, role: bucket.role, name: nameFromUrl(url), action: 'add' });
      }
    }
  }
  return plan;
}

function nameFromUrl(url) {
  try {
    const path = String(url).split('?')[0].split('#')[0];
    const last = path.split('/').pop();
    return last || 'asset';
  } catch {
    return 'asset';
  }
}

// ─── Mount / unmount ──────────────────────────────────────────────────────

/**
 * Render the Personalization Hub into `container`.
 *
 * @param {HTMLElement} container
 * @returns {{ element: HTMLElement, refresh: () => void, destroy: () => void }}
 */
export function mountPersonalizationHub(container) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('mountPersonalizationHub: container must be a DOM element');
  }
  // At most one live hub: a second mount replaces the first.
  if (activeHub) unmountPersonalizationHub();

  const style = document.createElement('style');
  style.textContent = HUB_CSS;
  container.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'personalization-hub';
  panel.dataset.hubPanel = 'true';

  const head = document.createElement('div');
  head.className = 'pzh-head';
  head.textContent = 'Personalization Hub';
  panel.appendChild(head);

  // Sections whose bodies re-render on store changes.
  const clientSection = buildSection('Client profile');
  const librarySection = buildSection('Asset library');
  const studioSection = buildSection('Send to studio');

  // Sections built once (they own their own inputs / poll state).
  const aiSection = buildAiSection();
  const discoverySection = buildDiscoverySection();

  liveRegions.aiResults = aiSection.results;
  liveRegions.aiStatus = aiSection.status;
  liveRegions.discoverStatus = discoverySection.status;
  liveRegions.discoverResults = discoverySection.results;

  panel.append(clientSection.section, librarySection.section, aiSection.section, discoverySection.section, studioSection.section);
  container.appendChild(panel);

  const renderClient = () => renderClientSection(clientSection.body);
  const renderLibrary = () => renderLibrarySection(librarySection.body);
  const renderStudio = () => renderStudioSection(studioSection.body);

  // Per-store subscriptions: a change only rebuilds the sections that read
  // that store, so typing in the profile form is never interrupted by an
  // unrelated store update.
  const unsubscribers = [
    clientProfileStore.subscribe(() => {
      renderClient();
      renderStudio();
    }),
    assetLibraryStore.subscribe(() => {
      renderLibrary();
      renderStudio();
    }),
    sharedMediaStore.subscribe(() => {
      renderAiResults();
    }),
  ];

  renderClient();
  renderLibrary();
  renderStudio();
  renderAiResults();
  renderDiscoveryStatus();

  const refresh = () => {
    renderClient();
    renderLibrary();
    renderStudio();
    renderAiResults();
  };

  const destroy = () => {
    stopDiscoveryPolling();
    unsubscribers.forEach((off) => {
      try { off(); } catch { /* listener already gone */ }
    });
    liveRegions.aiResults = null;
    liveRegions.aiStatus = null;
    liveRegions.discoverStatus = null;
    liveRegions.discoverResults = null;
    style.remove();
    panel.remove();
  };

  const hub = { element: panel, refresh, destroy };
  activeHub = hub;
  return hub;
}

/** Tear down the live hub (panel DOM, subscriptions, poll timer, job). */
export function unmountPersonalizationHub() {
  const hub = activeHub;
  activeHub = null;
  if (hub) hub.destroy();
}

// ─── Section builders ─────────────────────────────────────────────────────

function buildSection(title) {
  const section = document.createElement('section');
  section.className = 'pzh-section';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'pzh-body';
  section.append(heading, body);
  return { section, body };
}

function makeButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pzh-btn ${className || ''}`.trim();
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeInput(placeholder, className) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = className || 'pzh-input';
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function renderClientSection(body) {
  body.replaceChildren();
  const state = clientProfileStore.getState();
  const clients = Array.isArray(state.clients) ? state.clients : [];
  const current = (state.currentClientId && clients.find((c) => c.id === state.currentClientId)) || null;

  if (current) {
    const summary = document.createElement('div');
    summary.className = 'pzh-summary';
    summary.dataset.hubActiveClient = current.id;
    [
      // Which profile is active must be explicit: every studio render
      // and every AI Assist output is scoped to THIS client.
      ['Active profile', current.businessName || current.name || current.id],
      ['Industry', current.industry],
      ['Product / service', current.productService],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'pzh-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'pzh-label';
      labelEl.textContent = `${label}:`;
      const valueEl = document.createElement('span');
      valueEl.textContent = value || '—';
      row.append(labelEl, valueEl);
      summary.appendChild(row);
    });
    body.appendChild(summary);
  } else {
    const hint = document.createElement('p');
    hint.className = 'pzh-muted';
    hint.textContent = 'No client profile yet. Create one to personalize every studio render.';
    body.appendChild(hint);
  }

  // Client selector: with more than one profile the user must be able
  // to see and switch which one is active.
  if (clients.length > 1 && typeof clientProfileStore.setCurrentClientId === 'function') {
    const select = document.createElement('select');
    select.className = 'pzh-select';
    select.dataset.hubClientSelect = 'true';
    clients.forEach((c) => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.businessName || c.name || c.id;
      if (current && c.id === current.id) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      clientProfileStore.setCurrentClientId(select.value);
    });
    body.appendChild(select);
  }

  const form = document.createElement('div');
  form.className = 'pzh-form';

  const fields = [
    { key: 'businessName', placeholder: 'Business name' },
    { key: 'industry', placeholder: 'Industry' },
    { key: 'productService', placeholder: 'Product / service' },
  ];
  const inputs = {};
  fields.forEach(({ key, placeholder }) => {
    const input = makeInput(placeholder);
    if (current && current[key]) input.value = current[key];
    inputs[key] = input;
    form.appendChild(input);
  });

  const save = makeButton(current ? 'Save profile' : 'Create profile', 'pzh-btn-primary', () => {
    const patch = {
      businessName: inputs.businessName.value.trim(),
      industry: inputs.industry.value.trim(),
      productService: inputs.productService.value.trim(),
    };
    if (current) {
      clientProfileStore.updateClient(current.id, patch);
    } else {
      const created = clientProfileStore.addClient(patch);
      // A freshly created profile must become the ACTIVE client —
      // `addClient` alone leaves `currentClientId` null, so the form
      // would keep re-rendering empty and studio resolution would
      // still see "no personalization data". Activate it, then
      // re-render from the newly current client.
      if (created && created.id && typeof clientProfileStore.setCurrentClientId === 'function') {
        clientProfileStore.setCurrentClientId(created.id);
      }
      if (activeHub && typeof activeHub.refresh === 'function') {
        activeHub.refresh();
      }
    }
  });
  form.appendChild(save);
  body.appendChild(form);
}

function renderLibrarySection(body) {
  body.replaceChildren();
  const assets = assetLibraryStore.getState().assets || [];

  HUB_ROLES.forEach(({ role, label }) => {
    const roleAssets = assets.filter((a) => a.role === role);
    const block = document.createElement('div');
    block.className = 'pzh-role';
    block.dataset.hubRole = role;

    const roleHead = document.createElement('div');
    roleHead.className = 'pzh-role-head';
    roleHead.textContent = `${label} (${roleAssets.length})`;
    block.appendChild(roleHead);

    const grid = document.createElement('div');
    grid.className = 'pzh-grid';
    roleAssets.forEach((asset) => {
      const tile = document.createElement('div');
      tile.className = `pzh-tile${asset.isPrimary ? ' is-primary' : ''}`;

      const thumb = document.createElement('img');
      thumb.className = 'pzh-thumb';
      thumb.src = asset.url;
      thumb.alt = asset.name || label;
      thumb.loading = 'lazy';
      tile.appendChild(thumb);

      if (asset.isPrimary) {
        const badge = document.createElement('span');
        badge.className = 'pzh-badge';
        badge.textContent = 'Primary';
        tile.appendChild(badge);
      }

      const actions = document.createElement('div');
      actions.className = 'pzh-tile-actions';
      if (!asset.isPrimary) {
        actions.appendChild(makeButton('Set primary', 'pzh-btn-small', () => {
          assetLibraryStore.setPrimary(role, asset.id);
        }));
      }
      actions.appendChild(makeButton('Remove', 'pzh-btn-small', () => {
        assetLibraryStore.removeAsset(asset.id);
      }));
      tile.appendChild(actions);
      grid.appendChild(tile);
    });
    block.appendChild(grid);

    const addRow = document.createElement('div');
    addRow.className = 'pzh-add-row';
    const urlInput = makeInput(`Add ${label.toLowerCase()} image URL`);
    urlInput.dataset.hubAddInput = role;
    const addBtn = makeButton('Add', '', () => {
      const url = urlInput.value.trim();
      if (!url) return;
      try {
        assetLibraryStore.addAsset({ role, name: nameFromUrl(url), url });
        urlInput.value = '';
      } catch (err) {
        urlInput.value = '';
        showInlineError(addRow, err.message);
      }
    });
    addRow.append(urlInput, addBtn);
    block.appendChild(addRow);
    body.appendChild(block);
  });
}

function renderStudioSection(body) {
  body.replaceChildren();
  if (!hasPersonalizationData()) {
    const hint = document.createElement('p');
    hint.className = 'pzh-muted';
    hint.textContent = 'No personalization data yet. Add a client profile or library assets and studios will pick them up automatically.';
    body.appendChild(hint);
    return;
  }

  const render = resolveForRenderStudio();
  const cine = resolveForCineGen({});

  const rows = [
    ['Status', 'Personalization data active'],
    ['Render Studio · reference images', String(render.referenceImages.length)],
    ['Render Studio · prompt prefix', render.promptPrefix || '—'],
    ['Render Studio · last frame', render.lastFrameUrl || '—'],
    ['CineGen · primary reference', cine.image_url || '—'],
    ['CineGen · extra references', String((cine.images_list || []).length)],
    ['CineGen · CTA copy', cine.promptSuffix ? cine.promptSuffix.trim() : '—'],
  ];
  const summary = document.createElement('div');
  summary.className = 'pzh-summary';
  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'pzh-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'pzh-label';
    labelEl.textContent = `${label}:`;
    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    summary.appendChild(row);
  });
  body.appendChild(summary);
}

// ─── AI Assist section ────────────────────────────────────────────────────

/** @type {typeof import('./personalizeAiAssist.js') | null} */
let aiAssistApi = null;

function buildAiSection() {
  const { section, body } = buildSection('AI Assist');

  const roleSelect = document.createElement('select');
  roleSelect.className = 'pzh-select';
  HUB_ROLES.forEach(({ role, label }) => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = label;
    roleSelect.appendChild(option);
  });

  const instruction = document.createElement('textarea');
  instruction.className = 'pzh-textarea';
  instruction.rows = 2;
  instruction.placeholder = 'Describe the edit, e.g. "remove the background and brighten the logo"';

  const status = document.createElement('p');
  status.className = 'pzh-muted';
  status.dataset.hubAiStatus = 'true';

  const results = document.createElement('div');
  results.className = 'pzh-results';
  results.dataset.hubAiResults = 'true';

  const runBtn = makeButton('Edit with AI', 'pzh-btn-primary', async () => {
    const role = roleSelect.value;
    const text = instruction.value.trim();
    if (!text) {
      status.textContent = 'An edit instruction is required.';
      return;
    }
    runBtn.disabled = true;
    status.textContent = 'Editing…';
    try {
      if (!aiAssistApi) {
        aiAssistApi = await import('./personalizeAiAssist.js');
      }
      const clientId = clientProfileStore.getState().currentClientId || null;
      const result = await aiAssistApi.runAiAssistEdit({
        role,
        instruction: text,
        options: {
          library: buildLibraryProjection(assetLibraryStore.getState().assets),
          clientId,
        },
      });
      if (result && result.ok) {
        status.textContent = 'Done — output saved to the results list below.';
        instruction.value = '';
      } else {
        status.textContent = (result && result.reason) || 'The AI edit could not be completed.';
      }
    } catch (err) {
      status.textContent = (err && err.message) || 'The AI edit could not be completed.';
    } finally {
      runBtn.disabled = false;
      renderAiResults();
    }
  });

  body.append(roleSelect, instruction, runBtn, status, results);

  // Availability hint — lazy so the provider module is only pulled in here.
  import('./personalizeAiAssist.js')
    .then((mod) => {
      aiAssistApi = mod;
      const availability = typeof mod.checkAiAssistAvailability === 'function'
        ? mod.checkAiAssistAvailability('image')
        : { ok: true };
      if (!availability.ok && liveRegions.aiStatus === status) {
        const hint = document.createElement('p');
        hint.className = 'pzh-muted';
        hint.dataset.hubAiAvailability = 'true';
        hint.textContent = availability.reason || 'AI Assist is unavailable.';
        body.insertBefore(hint, status);
      }
    })
    .catch(() => { /* provider module unavailable; the button reports the error */ });

  return { section, results, status };
}

function renderAiResults() {
  const results = liveRegions.aiResults;
  if (!results) return;
  results.replaceChildren();

  const clientId = clientProfileStore.getState().currentClientId || null;
  const entries = typeof sharedMediaStore.getEntriesByClient === 'function'
    ? sharedMediaStore.getEntriesByClient(clientId)
    : (sharedMediaStore.getState().entries || []).filter((e) => !clientId || e.clientId === clientId);
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'pzh-muted';
    empty.textContent = 'No AI Assist outputs yet.';
    results.appendChild(empty);
    return;
  }

  entries.slice(0, 12).forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'pzh-output';
    const meta = document.createElement('div');
    meta.className = 'pzh-row pzh-label';
    meta.textContent = `${entry.outputType || 'output'} · ${new Date(entry.createdAt || Date.now()).toLocaleString()}`;
    card.appendChild(meta);

    const urls = Array.isArray(entry.outputUrls) ? entry.outputUrls : [];
    const media = document.createElement('div');
    media.className = 'pzh-grid';
    urls.forEach((url) => {
      const src = toOutputSrc(entry, url);
      if (!src) return;
      if (entry.outputType === 'video') {
        const video = document.createElement('video');
        video.className = 'pzh-thumb';
        video.src = src;
        video.controls = true;
        video.preload = 'metadata';
        media.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.className = 'pzh-thumb';
        img.src = src;
        img.alt = 'AI Assist output';
        img.loading = 'lazy';
        media.appendChild(img);
      }
    });
    card.appendChild(media);
    results.appendChild(card);
  });
}

// ─── Website discovery section ────────────────────────────────────────────

/** @type {string | null} */
let discoveryJobId = null;
/** @type {ReturnType<typeof setInterval> | null} */
let discoveryTimer = null;
let discoveryPollCount = 0;
let discoveryDeadline = 0;

/**
 * Shown when the browser has no Clerk session token: the request is never
 * sent, so the server is never asked to reject it.
 */
const HUB_DISCOVERY_SIGN_IN_MESSAGE =
  'Sign in to run website discovery — the discovery pipeline runs on the server under your account.';

/**
 * Shown when the server rejects an otherwise-authorized request as
 * expired/invalid. The client never retries automatically: the user must
 * sign in again, which mints a fresh token.
 */
const HUB_DISCOVERY_EXPIRED_MESSAGE = 'Your session expired — sign in again.';

/**
 * The server-to-server shared secret, ONLY when this module is imported
 * outside the browser (e.g. a server context). The browser never has it:
 * `PERSONALIZATION_DISCOVERY_SECRET` is a Netlify function env var and is
 * never exposed to client bundles, so this returns null there.
 *
 * @returns {string | null}
 */
function discoveryServerSecret() {
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env.PERSONALIZATION_DISCOVERY_SECRET) {
      return process.env.PERSONALIZATION_DISCOVERY_SECRET;
    }
  } catch {
    /* no process object in the browser */
  }
  return null;
}

/**
 * Authorization for every discovery request (start, poll, cancel).
 *
 * The app authenticates with CLERK, not Supabase Auth — so the identity
 * token is a fresh Clerk session token from the verified session
 * (getPersonalizationAccessToken), exactly what src/lib/supabase.js sends
 * on every Supabase request and what the discovery function verifies
 * server-side. A caller with no Clerk session is NEVER sent to the server:
 * it gets an explicit sign-in state instead, so it cannot 401.
 *
 * Server contexts may instead present the internal `X-Discovery-Secret`
 * (see discoveryServerSecret).
 *
 * @returns {Promise<{ headers: Record<string, string> } | { error: string }>}
 */
async function discoveryAuth() {
  const secret = discoveryServerSecret();
  if (secret) {
    return {
      headers: {
        'Content-Type': 'application/json',
        'X-Discovery-Secret': secret,
      },
    };
  }

  let token;
  try {
    token = await getPersonalizationAccessToken();
  } catch (err) {
    const detail = err && err.message ? err.message : 'unknown error';
    return { error: `Could not read your session (${detail}) — try signing in again.` };
  }
  if (!token) return { error: HUB_DISCOVERY_SIGN_IN_MESSAGE };
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

function buildDiscoverySection() {
  const { section, body } = buildSection('Discover from website');

  const row = document.createElement('div');
  row.className = 'pzh-row';
  const urlInput = makeInput('https://example.com');
  urlInput.dataset.hubDiscoverInput = 'true';
  const startBtn = makeButton('Discover', 'pzh-btn-primary', () => {
    startDiscovery(urlInput.value);
  });
  row.append(urlInput, startBtn);

  const status = document.createElement('p');
  status.className = 'pzh-muted';
  status.dataset.hubDiscoverStatus = 'true';

  const results = document.createElement('div');
  results.className = 'pzh-results';
  results.dataset.hubDiscoverResults = 'true';

  body.append(row, status, results);
  return { section, results, status };
}

/**
 * Message to show when the server rejects a discovery request. SSRF and
 * validation rejections carry the engine's `reason` verbatim, so a blocked
 * URL explains WHY it was blocked.
 *
 * @param {any} data parsed JSON body (may be null)
 * @param {Response} [res]
 * @returns {string}
 */
function discoveryRejectionMessage(data, res) {
  if (data && typeof data.reason === 'string' && data.reason) return data.reason;
  if (data && typeof data.message === 'string' && data.message) return data.message;
  if (res && res.status === 401) {
    return HUB_DISCOVERY_EXPIRED_MESSAGE;
  }
  if (res && res.status === 429) return 'The discovery service is busy — try again in a moment.';
  if (res && (res.status === 502 || res.status === 503)) return 'Discovery service unavailable. Please try again later.';
  return `Discovery failed${res ? ` (HTTP ${res.status})` : ''}.`;
}

async function startDiscovery(url) {
  const status = liveRegions.discoverStatus;
  const results = liveRegions.discoverResults;

  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) {
    if (status) status.textContent = 'Enter a website URL to discover its images.';
    return;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    if (status) status.textContent = 'URL must start with http:// or https:// — only public web pages can be discovered.';
    return;
  }
  if (trimmed.length > HUB_DISCOVERY_MAX_URL_LENGTH) {
    if (status) status.textContent = `URL is too long (max ${HUB_DISCOVERY_MAX_URL_LENGTH} characters).`;
    return;
  }

  // The url is viable: stop any previous poll loop (and cancel its
  // server-side job) before starting the new one.
  await stopDiscoveryPolling();

  // Authorize FIRST: a caller without a Clerk session never reaches the
  // server (and can never collect a 401).
  const auth = await discoveryAuth();
  if (auth.error) {
    if (status) status.textContent = auth.error;
    return;
  }

  if (status) status.textContent = `Discovering assets from ${trimmed}…`;
  if (results) results.replaceChildren();

  let jobId;
  try {
    const res = await fetch(HUB_DISCOVERY_ENDPOINT, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify({ url: trimmed }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      // Expired/invalid token: explain and NEVER auto-retry — the user must
      // sign in again, which mints a fresh token.
      if (status) status.textContent = HUB_DISCOVERY_EXPIRED_MESSAGE;
      return;
    }
    if (!res.ok || !data || !data.jobId) {
      if (status) status.textContent = discoveryRejectionMessage(data, res);
      return;
    }
    jobId = data.jobId;
  } catch {
    if (status) status.textContent = 'Discovery service unavailable. Please try again later.';
    return;
  }

  discoveryJobId = jobId;
  discoveryPollCount = 0;
  discoveryDeadline = Date.now() + HUB_DISCOVERY_TIMEOUT_MS;
  await pollDiscoveryJob();
  // The first poll may already be terminal — then no timer is needed.
  if (!discoveryJobId) return;
  discoveryTimer = setInterval(() => {
    pollDiscoveryJob();
  }, HUB_DISCOVERY_POLL_MS);
}

async function pollDiscoveryJob() {
  const jobId = discoveryJobId;
  if (!jobId) return;
  const status = liveRegions.discoverStatus;
  const results = liveRegions.discoverResults;

  discoveryPollCount += 1;
  if (discoveryPollCount > HUB_DISCOVERY_MAX_POLLS || Date.now() > discoveryDeadline) {
    // Timed out: stop locally and cancel the server-side job best-effort.
    await stopDiscoveryPolling();
    if (status) status.textContent = 'Discovery timed out. The site may be too slow — try again.';
    return;
  }

  let res;
  let data;
  try {
    // A fresh token per poll: long discovery jobs outlive short-lived tokens.
    const auth = await discoveryAuth();
    if (auth.error) {
      // Session lost mid-job: stop polling, explain, never auto-retry.
      await stopDiscoveryPolling();
      if (status) status.textContent = auth.error;
      return;
    }
    res = await fetch(`${HUB_DISCOVERY_ENDPOINT}?jobId=${encodeURIComponent(jobId)}`, {
      headers: auth.headers,
    });
    data = await res.json().catch(() => null);
  } catch {
    // Transient network failure: keep polling until the deadline.
    if (status) status.textContent = `Discovery service unreachable — retrying (${discoveryPollCount}/${HUB_DISCOVERY_MAX_POLLS})…`;
    return;
  }

  if (res.status === 401) {
    // Expired/invalid token mid-job: stop the loop and explain. The user
    // must sign in again — the client never auto-retries on a 401.
    stopDiscoveryTimer();
    discoveryJobId = null;
    if (status) status.textContent = HUB_DISCOVERY_EXPIRED_MESSAGE;
    if (results) results.replaceChildren();
    return;
  }

  if (res.status === 404 || (data && data.status === 'unknown')) {
    stopDiscoveryTimer();
    discoveryJobId = null;
    if (status) status.textContent = 'Discovery job is no longer running (it may have expired). Re-submit the URL to try again.';
    if (results) results.replaceChildren();
    return;
  }
  if (!res.ok || !data) {
    // Transient server error: keep polling until the deadline.
    if (status) status.textContent = `Waiting for the discovery service (${discoveryPollCount}/${HUB_DISCOVERY_MAX_POLLS})…`;
    return;
  }

  if (!TERMINAL_JOB_STATUSES.includes(data.status)) {
    if (status) status.textContent = `Discovering assets… (${data.status || 'working'}, ${discoveryPollCount}/${HUB_DISCOVERY_MAX_POLLS})`;
    return;
  }

  // Terminal: stop the timer. The job is already finished server-side, so
  // there is nothing to cancel.
  stopDiscoveryTimer();
  discoveryJobId = null;
  if (data.status !== 'done') {
    const reason = (Array.isArray(data.errors) && data.errors[0]) || data.message || data.error || '';
    if (status) {
      status.textContent = data.status === 'cancelled'
        ? 'Discovery cancelled.'
        : `Discovery ${data.status}${reason ? `: ${reason}` : ''}.`;
    }
    if (results) results.replaceChildren();
    return;
  }
  if (status) status.textContent = 'Discovery complete. Select assets to import.';
  renderDiscoveryResults(data.found);
}

function stopDiscoveryTimer() {
  if (discoveryTimer) {
    clearInterval(discoveryTimer);
    discoveryTimer = null;
  }
}

/**
 * Stop the poll loop AND cancel the in-flight server-side job (cooperative —
 * the engine may already have finished). Safe to call when idle.
 */
async function stopDiscoveryPolling() {
  const jobId = discoveryJobId;
  stopDiscoveryTimer();
  discoveryJobId = null;
  discoveryPollCount = 0;
  discoveryDeadline = 0;
  if (!jobId) return;
  // Cancel is ownership-checked server-side, so it needs authorization too.
  // Best-effort: skip it (rather than fire a guaranteed-401 request) when
  // the session is gone — the engine GCs abandoned jobs on its own.
  const auth = await discoveryAuth();
  if (auth.error) return;
  try {
    await fetch(`${HUB_DISCOVERY_ENDPOINT}?jobId=${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: auth.headers,
    });
  } catch {
    /* best-effort cancel — the engine GCs abandoned jobs on its own */
  }
}

function renderDiscoveryResults(found) {
  const results = liveRegions.discoverResults;
  if (!results) return;
  results.replaceChildren();

  const buckets = discoveryResultBuckets(found);
  if (buckets.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'pzh-muted';
    empty.textContent = 'No assets found on that page.';
    results.appendChild(empty);
    return;
  }

  const selected = new Set();
  buckets.forEach((bucket) => {
    const block = document.createElement('div');
    block.className = 'pzh-role';
    const head = document.createElement('div');
    head.className = 'pzh-role-head';
    head.textContent = `${bucket.label} (${bucket.urls.length})`;
    block.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'pzh-grid';
    bucket.urls.forEach((url) => {
      const tile = document.createElement('label');
      tile.className = 'pzh-tile';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.hubDiscoveredUrl = url;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(url);
        else selected.delete(url);
      });
      selected.add(url);
      const thumb = document.createElement('img');
      thumb.className = 'pzh-thumb';
      thumb.src = url;
      thumb.alt = bucket.label;
      thumb.loading = 'lazy';
      tile.append(checkbox, thumb);
      grid.appendChild(tile);
    });
    block.appendChild(grid);
    results.appendChild(block);
  });

  const importBtn = makeButton('Import selected', 'pzh-btn-primary', () => {
    const plan = planDiscoveryImport(found, assetLibraryStore.getState().assets || [])
      .filter((item) => selected.has(item.url));
    const importIds = plan.filter((item) => item.action === 'import').map((item) => item.id);
    const additions = plan.filter((item) => item.action === 'add');
    if (importIds.length) assetLibraryStore.importSelectedAssetIds(importIds);
    additions.forEach((item) => {
      try {
        assetLibraryStore.addAsset({ role: item.role, name: item.name, url: item.url });
      } catch { /* invalid url — skip, the store already rejected it */ }
    });
    renderDiscoveryStatus();
  });
  results.appendChild(importBtn);
}

function renderDiscoveryStatus() {
  const status = document.querySelector('[data-hub-discover-status]');
  if (status && !status.textContent) status.textContent = 'Paste a website URL to import its images.';
}

function showInlineError(host, message) {
  const err = document.createElement('p');
  err.className = 'pzh-muted';
  err.style.color = 'rgba(248,113,113,0.9)';
  err.textContent = message || 'That asset could not be added.';
  host.appendChild(err);
}

// ─── Styles (scoped to .personalization-hub) ──────────────────────────────

const HUB_CSS = `
.personalization-hub {
  font-family: inherit;
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 16px;
}
.pzh-head {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.5);
}
.pzh-section {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  padding: 10px;
}
.pzh-section > h4 {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.55);
}
.pzh-body { display: flex; flex-direction: column; gap: 8px; }
.pzh-muted { margin: 0; color: rgba(255,255,255,0.45); font-size: 11px; }
.pzh-summary { display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
.pzh-row { display: flex; gap: 6px; align-items: baseline; }
.pzh-label { color: rgba(255,255,255,0.45); }
.pzh-form { display: flex; flex-direction: column; gap: 6px; }
.pzh-input, .pzh-select, .pzh-textarea {
  width: 100%;
  box-sizing: border-box;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  padding: 5px 6px;
}
.pzh-textarea { resize: vertical; }
.pzh-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  padding: 5px 9px;
  white-space: nowrap;
}
.pzh-btn:hover { background: rgba(255,255,255,0.14); }
.pzh-btn:disabled { opacity: 0.5; cursor: default; }
.pzh-btn-primary { background: var(--color-primary, #6366f1); border-color: transparent; }
.pzh-btn-primary:hover { filter: brightness(1.1); }
.pzh-btn-small { font-size: 10px; padding: 2px 5px; flex: 1; }
.pzh-role { display: flex; flex-direction: column; gap: 5px; }
.pzh-role-head { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.5); }
.pzh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; }
.pzh-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  background: rgba(0,0,0,0.3);
  overflow: hidden;
  padding: 0;
}
.pzh-tile.is-primary { border-color: var(--color-primary, #6366f1); }
.pzh-thumb { width: 100%; height: 48px; object-fit: cover; display: block; background: rgba(0,0,0,0.4); }
.pzh-badge {
  position: absolute;
  top: 3px;
  left: 3px;
  background: var(--color-primary, #6366f1);
  border-radius: 4px;
  color: #fff;
  font-size: 8px;
  padding: 1px 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pzh-tile-actions { display: flex; gap: 4px; padding: 4px; }
.pzh-add-row { display: flex; gap: 6px; }
.pzh-add-row .pzh-input { flex: 1; }
.pzh-results { display: flex; flex-direction: column; gap: 8px; }
.pzh-output { display: flex; flex-direction: column; gap: 4px; }
.pzh-tile input[type="checkbox"] { position: absolute; top: 4px; right: 4px; }
`;

export default mountPersonalizationHub;
