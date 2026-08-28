import { apiKeyManager } from '../lib/apiKeyManager.js';
import { AuthModal } from './AuthModal.js';
import { getUploadHistory, saveUpload, removeUpload } from '../lib/uploadHistory.js';
import { fetchUrlAsFile, processFileUpload } from '../lib/editor/uploadPipeline.js';
import { showToast } from '../lib/loading.js';
import { formatErrorMessage } from '../lib/errorMessages.js';
import { UPLOAD_LIMITS, SUPABASE_PROXY_BODY_LIMIT_BYTES, categoryFromMimeType } from '../lib/editor/uploadLimits.js';

// ── Module-level: dedupe global listeners across all picker instances ──────────
const _globalCleanups = new Set();
const _registeredOutsideClick = new WeakSet();
const _registeredPaste = new WeakSet();

function registerGlobalListeners() {
    if (!_registeredOutsideClick.has(document)) {
        const clickHandler = (e) => {
            const panel = e.target?.closest?.('.upload-panel');
            if (!panel) return;
            const picker = panel.closest('[data-upload-picker]');
            if (!picker) return;
            const isOpen = panel.classList.contains('opacity-100');
            if (!isOpen) return;
            if (e.target === picker.querySelector('button[title]') || picker.querySelector('button[title]')?.contains(e.target)) return;
            if (panel.contains(e.target)) return;
            const close = panel._closeFn;
            if (typeof close === 'function') close();
        };
        document.addEventListener('click', clickHandler, true);
        _globalCleanups.add(() => document.removeEventListener('click', clickHandler, true));
        _registeredOutsideClick.add(document);
    }
    if (!_registeredPaste.has(document)) {
        const pasteHandler = (e) => {
            const panel = e.target?.closest?.('.upload-panel');
            if (!panel) return;
            const picker = panel.closest('[data-upload-picker]');
            if (!picker) return;
            const isOpen = panel.classList.contains('opacity-100');
            if (!isOpen) return;
            const onPaste = picker._onPaste;
            if (typeof onPaste === 'function') onPaste(e);
        };
        document.addEventListener('paste', pasteHandler);
        _globalCleanups.add(() => document.removeEventListener('paste', pasteHandler));
        _registeredPaste.add(document);
    }
}

registerGlobalListeners();

// ── MuAPI file-upload limits (per https://muapi.ai/docs/file-upload) ──────────
// Images: 10MB (.jpg/.png/.webp/...) · Videos: 50MB (.mp4/.mov/...) · Others: 10MB
// Sourced from uploadLimits.js — single source of truth
const MUAPI_LIMITS = UPLOAD_LIMITS;

// Accept strings grouped by category. The picker builds the file-input `accept`
// attribute from these so the OS dialog only offers MuAPI-supported types.
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/heic,image/bmp';
const ACCEPT_VIDEOS = 'video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo,video/x-m4v';
const ACCEPT_DOCUMENTS = 'application/pdf,application/json,application/zip,application/x-zip-compressed,.pdf,.json,.zip';

function buildAcceptString({ acceptVideo, acceptDocuments }) {
    const parts = [ACCEPT_IMAGES];
    if (acceptVideo) parts.push(ACCEPT_VIDEOS);
    if (acceptDocuments) parts.push(ACCEPT_DOCUMENTS);
    return parts.join(',');
}

// Heuristic: map a File to a MuAPI category so we can enforce its byte cap.
// (We can't run magic-byte detection synchronously here; MIME + extension is
// sufficient for the size-guard purpose.)
function muapiCategoryForFile(file) {
    const t = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    if (t.startsWith('image/')) return 'image';
    if (t.startsWith('video/')) return 'video';
    if (t.startsWith('audio/')) return 'audio';
    if (t === 'application/pdf' || ext === 'pdf') return 'document';
    if (t === 'application/json' || ext === 'json') return 'text';
    if (t.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (t.startsWith('text/')) return 'text';
    if (t.includes('officedocument') || t.includes('msword') || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
    return null;
}

function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)}MB`;
}

// Minimal inline file-type icon (data URI) used in the history grid when a
// non-media file (pdf/json/zip) has no generated thumbnail.
function fileIconSvg(kind) {
    const glyph = kind === 'video' ? '▶' : kind === 'audio' ? '♪' : '▤';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23cbd5e1" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="2"/><text x="12" y="15" font-size="9" text-anchor="middle" fill="%23cbd5e1" stroke="none">${glyph}</text></svg>`;
    return `data:image/svg+xml;utf8,${svg.replace(/\n/g, '')}`;
}

export function createUploadPicker({
    anchorContainer,
    onSelect,
    onClear,
    maxImages: initialMaxImages = 1,
    acceptVideo = true,
    acceptDocuments = true,
    frameMode = false,
    onFilePreview = null,
    singleLabel,
    multiLabel,
}) {
    let panelOpen = false;
    let maxImages = initialMaxImages;
    let selectedEntries = [];
    // frameMode state: { start, end } — each an entry or null
    let frameEntries = { start: null, end: null };

    // Per-instance abort controller for in-flight uploads
    let abortController = null;

    // When a slot-specific upload is triggered in frame mode, this records
    // which slot the next file selection belongs to.
    let pendingFrameSlot = null;

    // Retry helper for transient upload failures (502/503/timeout)
    async function uploadWithRetry(file, opts, attempts = 0) {
        const maxAttempts = 3; // initial + 2 retries
        try {
            return await processFileUpload(file, opts);
        } catch (err) {
            const status = err.status || err.response?.status;
            const isTransient = status === 502 || status === 503 || err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('fetch');
            if (!isTransient || attempts >= maxAttempts - 1) throw err;
            const delay = Math.min(1000 * 2 ** attempts, 4000);
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, delay);
                const ac = new AbortController();
                abortController = ac;
                ac.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Upload cancelled')); });
            });
            return uploadWithRetry(file, opts, attempts + 1);
        }
    }

    // ── Abort helpers ──────────────────────────────────────────────────────────
    function getAbortSignal() {
        abortController = new AbortController();
        return abortController.signal;
    }

    function abortActiveUpload() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = buildAcceptString({ acceptVideo, acceptDocuments });
    fileInput.className = 'hidden';

    // ── Trigger button ────────────────────────────────────────────────────────
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Reference media';
    trigger.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';

    // State: icon
    const iconState = document.createElement('div');
    iconState.className = 'flex items-center justify-center w-full h-full';
    iconState.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

    // State: spinner
    const spinnerState = document.createElement('div');
    spinnerState.className = 'hidden items-center justify-center w-full h-full';
    spinnerState.innerHTML = `<span class="animate-spin text-primary text-sm">◌</span>`;

    // State: thumbnail (first selected image + optional count badge)
    const thumbnailState = document.createElement('div');
    thumbnailState.className = 'hidden w-full h-full';
    const thumbImg = document.createElement('img');
    thumbImg.className = 'w-full h-full object-cover';
    thumbImg.onerror = () => {
        thumbImg.onerror = null;
        thumbImg.src = '';
        showIcon();
    };
    const countBadge = document.createElement('div');
    countBadge.className = 'absolute bottom-0.5 right-0.5 min-w-[16px] h-4 bg-primary rounded-full flex items-center justify-center px-0.5';
    countBadge.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>`;
    thumbnailState.appendChild(thumbImg);
    thumbnailState.appendChild(countBadge);

    trigger.appendChild(fileInput);
    trigger.appendChild(iconState);
    trigger.appendChild(spinnerState);
    trigger.appendChild(thumbnailState);

    // ── Trigger state helpers ─────────────────────────────────────────────────
    const showIcon = () => {
        iconState.classList.replace('hidden', 'flex');
        spinnerState.classList.add('hidden'); spinnerState.classList.remove('flex');
        thumbnailState.classList.add('hidden'); thumbnailState.classList.remove('flex');
        trigger.classList.remove('border-primary/60');
        trigger.classList.add('border-white/10');
    };

    const showSpinner = () => {
        iconState.classList.add('hidden'); iconState.classList.remove('flex');
        spinnerState.classList.replace('hidden', 'flex');
        thumbnailState.classList.add('hidden'); thumbnailState.classList.remove('flex');
    };

    const updateTrigger = () => {
        if (frameMode) {
            // Prefer the start frame thumbnail, fall back to end.
            const entry = frameEntries.start || frameEntries.end;
            if (!entry) {
                showIcon();
                trigger.title = 'Add start / end frames';
                return;
            }
            thumbImg.src = entry.thumbnail || fileIconSvg(entry.type);
            iconState.classList.add('hidden'); iconState.classList.remove('flex');
            spinnerState.classList.add('hidden'); spinnerState.classList.remove('flex');
            thumbnailState.classList.replace('hidden', 'flex');
            trigger.classList.remove('border-white/10');
            trigger.classList.add('border-primary/60');
            const hasBoth = frameEntries.start && frameEntries.end;
            countBadge.className = 'absolute bottom-0.5 right-0.5 min-w-[16px] h-4 bg-primary rounded-full flex items-center justify-center px-0.5';
            countBadge.innerHTML = hasBoth
                ? `<span class="text-[9px] font-black text-black leading-none">2</span>`
                : `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>`;
            trigger.title = hasBoth ? 'Start & end frames set' : 'Start frame set — add an end frame';
            return;
        }

        if (selectedEntries.length === 0) {
            showIcon();
            trigger.title = maxImages > 1 ? `Add up to ${maxImages} images` : (singleLabel || 'Reference media');
            return;
        }

        // Show first image thumbnail
        thumbImg.src = selectedEntries[0].thumbnail || fileIconSvg(selectedEntries[0].type);
        iconState.classList.add('hidden'); iconState.classList.remove('flex');
        spinnerState.classList.add('hidden'); spinnerState.classList.remove('flex');
        thumbnailState.classList.replace('hidden', 'flex');
        trigger.classList.remove('border-white/10');
        trigger.classList.add('border-primary/60');

        const count = selectedEntries.length;
        const canAddMore = maxImages > 1 && count < maxImages;

        if (count > 1) {
            // Multiple selected — show count
            countBadge.className = 'absolute bottom-0.5 right-0.5 min-w-[16px] h-4 bg-primary rounded-full flex items-center justify-center px-0.5';
            countBadge.innerHTML = `<span class="text-[9px] font-black text-black leading-none">${count}</span>`;
            const itemLabel = acceptVideo ? 'items' : 'images';
            trigger.title = `${count} of ${maxImages} ${itemLabel} selected — click to manage`;
        } else if (canAddMore) {
            // 1 selected, multi-mode active — show "+" to invite adding more
            countBadge.className = 'absolute bottom-0.5 right-0.5 min-w-[16px] h-4 bg-white/80 rounded-full flex items-center justify-center px-0.5 border border-primary/60';
            countBadge.innerHTML = `<span class="text-[9px] font-black text-black leading-none">+</span>`;
            const itemLabel = acceptVideo ? 'item' : 'image';
            const itemsLabel = acceptVideo ? 'items' : 'images';
            trigger.title = `1 ${itemLabel} selected — click to add more (up to ${maxImages})`;
        } else {
            // Single mode or at max — show checkmark
            countBadge.className = 'absolute bottom-0.5 right-0.5 min-w-[16px] h-4 bg-primary rounded-full flex items-center justify-center px-0.5';
            countBadge.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>`;
            const itemLabel = acceptVideo ? 'items' : 'images';
            const singleLabelText = acceptVideo ? (singleLabel || 'Reference media') : (singleLabel || 'Reference image');
            trigger.title = count > 1 ? `${count} ${itemLabel} selected` : singleLabelText;
        }
    };

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'upload-panel absolute z-50 opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 shadow-4xl border border-white/10 w-72 transition-all';
    // Required so the module-level delegated click/paste listeners (registered
    // once per document) can locate this picker instance and route events to it.
    panel.setAttribute('data-upload-picker', '');

    const openPanel = () => {
        renderPanel();
        panel.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        panel.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
        const btnRect = trigger.getBoundingClientRect();
        const containerRect = anchorContainer.getBoundingClientRect();
        // Use the actual rendered panel height to decide above/below placement
        const panelH = panel.offsetHeight || 420;
        const margin = 8;
        const spaceAbove = btnRect.top;
        const spaceBelow = window.innerHeight - btnRect.bottom;
        // Prefer below the trigger; only go above if there's clearly more room
        const placeAbove = spaceAbove > panelH + margin && spaceBelow < panelH / 2;
        // Reset both before applying the active side
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.left = `${btnRect.left - containerRect.left}px`;
        if (placeAbove) {
            panel.style.bottom = `${containerRect.bottom - btnRect.top + margin}px`;
        } else {
            panel.style.top = `${btnRect.bottom - containerRect.top + margin}px`;
        }
        // Clamp the panel inside the viewport
        requestAnimationFrame(() => {
            const panelRect = panel.getBoundingClientRect();
            // Horizontal clamp
            const overflowRight = panelRect.right - window.innerWidth + 8;
            if (overflowRight > 0) {
                panel.style.left = `${parseFloat(panel.style.left) - overflowRight}px`;
            }
            const overflowLeft = 8 - panelRect.left;
            if (overflowLeft > 0) {
                panel.style.left = `${parseFloat(panel.style.left) + overflowLeft}px`;
            }
            // Vertical clamp: if panel extends past viewport bottom, shift it up
            const newRect = panel.getBoundingClientRect();
            if (newRect.bottom > window.innerHeight - 8) {
                const shift = newRect.bottom - window.innerHeight + 8;
                if (placeAbove) {
                    panel.style.bottom = `${parseFloat(panel.style.bottom) + shift}px`;
                } else {
                    panel.style.top = `${parseFloat(panel.style.top) - shift}px`;
                }
            }
            if (newRect.top < 8) {
                if (placeAbove) {
                    panel.style.bottom = `${parseFloat(panel.style.bottom) - 8}px`;
                } else {
                    panel.style.top = `${8}px`;
                }
            }
        });
        panelOpen = true;
    };

    const closePanel = () => {
        abortActiveUpload();
        panel.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        panel.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
        panelOpen = false;
    };

    const fireOnSelect = () => {
        if (frameMode) {
            const start = frameEntries.start?.uploadedUrl || null;
            const end = frameEntries.end?.uploadedUrl || null;
            const urls = [start, end].filter(Boolean);
            if (urls.length === 0) return;
            onSelect({
                startUrl: start,
                endUrl: end,
                urls,
                startThumbnail: frameEntries.start?.thumbnail || null,
                endThumbnail: frameEntries.end?.thumbnail || null,
            });
            return;
        }
        if (selectedEntries.length === 0) return;
        const urls = selectedEntries.map(e => e.url);
        onSelect({
            url: urls[0],           // backward-compatible single URL
            urls,                   // full array for multi-image models
            thumbnail: selectedEntries[0].thumbnail,
            type: selectedEntries[0].type
        });
    };

    // ── Frame-mode helpers ────────────────────────────────────────────────────
    const firstEmptyFrameSlot = () => {
        if (!frameEntries.start) return 'start';
        if (!frameEntries.end) return 'end';
        return 'start';
    };

    const setFrameEntry = (slot, entry) => {
        frameEntries[slot] = entry;
        updateTrigger();
        if (entry) {
            saveUpload(entry);
            fireOnSelect();
        }
    };

    const clearFrameEntry = (slot) => {
        if (frameEntries[slot]) {
            removeUpload(frameEntries[slot].id);
            frameEntries[slot] = null;
            updateTrigger();
            fireOnSelect();
            if (!frameEntries.start && !frameEntries.end) onClear?.();
        }
    };

    const renderPanel = () => {
        if (frameMode) {
            renderFramePanel();
            return;
        }
        renderStandardPanel();
    };

    // ── Standard (single / multi) panel ───────────────────────────────────────
    const renderStandardPanel = () => {
        panel.innerHTML = '';
        const history = getUploadHistory();
        const isMulti = maxImages > 1;

        // ── Header ──
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-1 pb-3 mb-2 border-b border-white/5';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'flex flex-col gap-0.5';
        const mediaLabel = acceptVideo ? 'Reference Media' : 'Reference Images';
        headerLeft.innerHTML = `<span class="text-[10px] font-bold text-secondary uppercase tracking-widest">${mediaLabel}</span>`;
        if (isMulti) {
            const hint = document.createElement('span');
            hint.className = 'text-[9px] text-muted';
            const itemLabel = acceptVideo ? 'items' : 'images';
            hint.textContent = `Select up to ${maxImages} ${itemLabel}`;
            headerLeft.appendChild(hint);
        }
        header.appendChild(headerLeft);

        const headerRight = document.createElement('div');
        headerRight.className = 'flex items-center gap-2';

        // Done button (multi-select only)
        if (isMulti && selectedEntries.length > 0) {
            const doneBtn = document.createElement('button');
            doneBtn.type = 'button';
            doneBtn.className = 'flex items-center gap-1 px-3 py-1.5 btn-secondary-modern rounded-xl text-xs font-black transition-all hover:scale-105';
            doneBtn.innerHTML = `✓ Done (${selectedEntries.length})`;
            doneBtn.onclick = (e) => {
                e.stopPropagation();
                closePanel();
                fireOnSelect();
            };
            headerRight.appendChild(doneBtn);
        }

        const uploadNewBtn = document.createElement('button');
        uploadNewBtn.type = 'button';
        uploadNewBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all border border-primary/20';
        const uploadLabel = isMulti ? 'Upload files' : (acceptVideo ? 'Upload new' : 'Upload new');
        uploadNewBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${uploadLabel}`;
        uploadNewBtn.onclick = (e) => { e.stopPropagation(); closePanel(); fileInput.click(); };
        headerRight.appendChild(uploadNewBtn);

        // "From URL" button — opens a URL paste field below
        const fromUrlBtn = document.createElement('button');
        fromUrlBtn.type = 'button';
        fromUrlBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-xs font-bold transition-all border border-white/10';
        fromUrlBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> From URL`;
        fromUrlBtn.onclick = (e) => {
            e.stopPropagation();
            const existing = panel.querySelector('.upload-url-input');
            if (existing) {
                existing.parentElement.remove();
            } else {
                appendUrlInput();
            }
        };
        headerRight.appendChild(fromUrlBtn);
        header.appendChild(headerRight);
        panel.appendChild(header);

        if (history.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'py-4 flex flex-col items-center gap-3';
            empty.innerHTML = `
                <div class="text-[10px] font-bold text-secondary uppercase tracking-widest">4 ways to upload</div>
                <div class="grid grid-cols-2 gap-2 w-full">
                    <button type="button" data-method="file" class="upload-method-tile flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/40 transition-all cursor-pointer text-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span class="text-[10px] font-black text-white">Upload</span>
                        <span class="text-[9px] text-muted leading-tight">Pick a file</span>
                    </button>
                    <button type="button" data-method="url" class="upload-method-tile flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/40 transition-all cursor-pointer text-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        <span class="text-[10px] font-black text-white">From URL</span>
                        <span class="text-[9px] text-muted leading-tight">Paste a link</span>
                    </button>
                    <button type="button" data-method="drop" class="upload-method-tile flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/40 transition-all cursor-pointer text-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3"/><path d="M12 8v6"/><polyline points="9 11 12 8 15 11"/></svg>
                        <span class="text-[10px] font-black text-white">Drop here</span>
                        <span class="text-[9px] text-muted leading-tight">Drag a file in</span>
                    </button>
                    <button type="button" data-method="paste" class="upload-method-tile flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/40 transition-all cursor-pointer text-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2"/></svg>
                        <span class="text-[10px] font-black text-white">Paste</span>
                        <span class="text-[9px] text-muted leading-tight">⌘V / Ctrl+V</span>
                    </button>
                </div>
            `;
            // Wire the tiles to the same actions as the header buttons
            empty.querySelectorAll('.upload-method-tile').forEach(tile => {
                tile.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const method = tile.getAttribute('data-method');
                    if (method === 'file') {
                        closePanel();
                        fileInput.click();
                    } else if (method === 'url') {
                        closePanel();
                        // Reopen and show the URL input
                        setTimeout(() => {
                            openPanel();
                            appendUrlInput();
                            // Re-position after the URL input changes the panel height
                            setTimeout(() => {
                                const btnRect = trigger.getBoundingClientRect();
                                const containerRect = anchorContainer.getBoundingClientRect();
                                const panelH = panel.offsetHeight;
                                const margin = 16;
                                const spaceAbove = btnRect.top - margin;
                                const placeAbove = spaceAbove >= panelH;
                                panel.style.top = '';
                                panel.style.bottom = '';
                                if (placeAbove) {
                                    panel.style.left = `${btnRect.left - containerRect.left}px`;
                                    panel.style.bottom = `${containerRect.bottom - btnRect.top + 8}px`;
                                } else {
                                    panel.style.left = `${btnRect.left - containerRect.left}px`;
                                    panel.style.top = `${btnRect.bottom - containerRect.top + 8}px`;
                                }
                            }, 50);
                        }, 50);
                    } else if (method === 'drop') {
                        // Briefly flash the drop hint
                        panel.classList.add('ring-2', 'ring-primary/50', 'bg-primary/5');
                        setTimeout(() => panel.classList.remove('ring-2', 'ring-primary/50', 'bg-primary/5'), 600);
                    } else if (method === 'paste') {
                        // Focus the panel so paste is captured, show toast
                        panel.focus?.();
                        const t = document.createElement('div');
                        t.className = 'absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 btn-secondary-modern text-[10px] font-black rounded-md whitespace-nowrap z-50';
                        t.textContent = 'Press ⌘V / Ctrl+V to paste';
                        panel.style.position || (panel.style.position = 'relative');
                        panel.appendChild(t);
                        setTimeout(() => t.remove(), 1800);
                    }
                });
            });
            panel.appendChild(empty);
            return;
        }

        // Drop zone hint — a persistent dashed border on the grid area so users
        // know they can drop files here even when there's already history.
        const dropZone = document.createElement('div');
        dropZone.className = 'relative rounded-xl border-2 border-dashed border-white/10 p-2 transition-colors';
        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-primary/60', 'bg-primary/5');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('border-primary/60', 'bg-primary/5');
            }
        });
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('border-primary/60', 'bg-primary/5');
                const files = Array.from(e.dataTransfer?.files || []);
                if (!files.length) return;
                uploadFiles(files);
            });

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-3 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-0.5';

        history.forEach(entry => {
            const selIdx = selectedEntries.findIndex(e => e.url === entry.uploadedUrl);
            const isSelected = selIdx !== -1;

            const cell = document.createElement('div');
            cell.className = `relative rounded-xl overflow-hidden border-2 cursor-pointer group/cell aspect-square transition-all ${isSelected ? 'border-primary shadow-glow' : 'border-white/10 hover:border-white/30'}`;
            cell.title = entry.name;

            const img = document.createElement('img');
            img.src = entry.thumbnail || fileIconSvg(entry.type);
            img.className = 'w-full h-full object-cover';
            img.onerror = () => { img.src = fileIconSvg(entry.type); };

            // Hover overlay with delete button
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-black/60 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-end justify-end p-1';

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-md flex items-center justify-center transition-colors';
            delBtn.title = 'Remove from history';
            delBtn.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            delBtn.onclick = (e) => {
                e.stopPropagation();
                removeUpload(entry.id);
                const idx = selectedEntries.findIndex(e => e.url === entry.uploadedUrl);
                if (idx !== -1) {
                    selectedEntries.splice(idx, 1);
                    updateTrigger();
                    if (selectedEntries.length === 0) onClear?.();
                }
                renderPanel();
            };
            overlay.appendChild(delBtn);

            // Selection badge: order number (multi) or checkmark (single)
            if (isSelected) {
                const badge = document.createElement('div');
                badge.className = 'absolute top-1 left-1 min-w-[20px] h-5 bg-primary rounded-full flex items-center justify-center px-1';
                if (isMulti) {
                    badge.innerHTML = `<span class="text-[10px] font-black text-black">${selIdx + 1}</span>`;
                } else {
                    badge.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>`;
                }
                cell.appendChild(badge);
            }

            // Not-yet-reachable dim (when at max)
            const atMax = isMulti && !isSelected && selectedEntries.length >= maxImages;
            if (atMax) {
                cell.classList.add('opacity-40');
                cell.style.cursor = 'not-allowed';
            }

            cell.appendChild(img);
            cell.appendChild(overlay);

            cell.onclick = (e) => {
                e.stopPropagation();
                if (atMax) return; // can't select more

                if (!isMulti) {
                    // Single-select: select & close immediately
                    selectedEntries = [{ url: entry.uploadedUrl, thumbnail: entry.thumbnail, type: entry.type }];
                    updateTrigger();
                    fireOnSelect();
                    closePanel();
                } else {
                    // Multi-select: toggle
                    if (isSelected) {
                        selectedEntries.splice(selIdx, 1);
                        if (selectedEntries.length === 0) onClear?.();
                    } else {
                        selectedEntries.push({ url: entry.uploadedUrl, thumbnail: entry.thumbnail, type: entry.type });
                    }
                    updateTrigger();
                    renderPanel(); // re-render to update badges / dim state
                }
            };

            grid.appendChild(cell);
        });

        dropZone.appendChild(grid);
        panel.appendChild(dropZone);

        // Bottom "Done" bar for multi-select (always visible when items selected)
        if (isMulti && selectedEntries.length > 0) {
            const bottomBar = document.createElement('div');
            bottomBar.className = 'mt-3 pt-3 border-t border-white/5 flex items-center justify-between';
            bottomBar.innerHTML = `<span class="text-xs text-secondary">${selectedEntries.length} of ${maxImages} selected</span>`;
            const doneBtn2 = document.createElement('button');
            doneBtn2.type = 'button';
            doneBtn2.className = 'px-4 py-1.5 btn-secondary-modern rounded-xl text-xs font-black transition-all hover:scale-105';
            doneBtn2.textContent = 'Use Selected';
            doneBtn2.onclick = (e) => {
                e.stopPropagation();
                closePanel();
                fireOnSelect();
            };
            bottomBar.appendChild(doneBtn2);
            panel.appendChild(bottomBar);
        }

        // Footer hint — reminds users about all available upload methods
        const hint = document.createElement('div');
        hint.className = 'mt-2.5 pt-2.5 border-t border-white/5 text-[10px] text-muted leading-relaxed text-center';
        const acceptsVid = acceptVideo ? `<span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Video</span><span class="text-white/20">|</span>` : '';
        const acceptsDoc = acceptDocuments ? `<span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Docs</span><span class="text-white/20">|</span>` : '';
        hint.innerHTML = `
            <div class="flex items-center justify-center gap-3 flex-wrap">
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload</span>
                <span class="text-white/20">|</span>
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> URL</span>
                <span class="text-white/20">|</span>
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><path d="M12 8v6"/><polyline points="9 11 12 8 15 11"/></svg> Drop</span>
                <span class="text-white/20">|</span>
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2"/></svg> Paste <kbd class="px-1 py-0.5 bg-white/10 rounded text-[9px]">⌘V</kbd></span>
                ${acceptsVid}${acceptsDoc}
            </div>
        `;
        panel.appendChild(hint);
    };

    // ── Frame-mode panel (start + end image) ─────────────────────────────────
    const renderFramePanel = () => {
        panel.innerHTML = '';
        const history = getUploadHistory();

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-1 pb-3 mb-2 border-b border-white/5';
        header.innerHTML = `<div class="flex flex-col gap-0.5"><span class="text-[10px] font-bold text-secondary uppercase tracking-widest">Frames</span><span class="text-[9px] text-muted">Start &amp; end image for first/last-frame video</span></div>`;

        const uploadNewBtn = document.createElement('button');
        uploadNewBtn.type = 'button';
        uploadNewBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all border border-primary/20';
        uploadNewBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload new`;
        uploadNewBtn.onclick = (e) => { e.stopPropagation(); closePanel(); pendingFrameSlot = firstEmptyFrameSlot(); fileInput.click(); };
        header.appendChild(uploadNewBtn);
        panel.appendChild(header);

        const buildSlot = (slot, label, badge) => {
            const entry = frameEntries[slot];
            const slotEl = document.createElement('div');
            slotEl.className = 'frame-slot relative rounded-xl border-2 p-3 flex items-center gap-3 transition-all cursor-pointer mb-2 ' +
                (entry ? 'border-primary/60 bg-primary/5' : 'border-white/15 hover:border-primary/40 bg-white/5');
            slotEl.dataset.frameSlot = slot;

            const thumb = document.createElement('div');
            thumb.className = 'w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-black/40 shrink-0 flex items-center justify-center';
            if (entry && entry.thumbnail) {
                const im = document.createElement('img');
                im.src = entry.thumbnail;
                im.className = 'w-full h-full object-cover';
                im.onerror = () => { im.remove(); };
                thumb.appendChild(im);
            } else {
                thumb.innerHTML = `<span class="text-[10px] text-muted">${badge}</span>`;
            }

            const meta = document.createElement('div');
            meta.className = 'flex-1 min-w-0';
            meta.innerHTML = `
                <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-black px-1.5 py-0.5 rounded btn-secondary-modern">${badge}</span>
                    <span class="text-[11px] font-bold text-white">${label}</span>
                </div>
                <div class="text-[9px] text-muted mt-0.5 truncate">${entry ? entry.name : 'Click to add'}</div>
            `;

            slotEl.appendChild(thumb);
            slotEl.appendChild(meta);

            if (entry) {
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-md flex items-center justify-center transition-colors shrink-0';
                clearBtn.title = `Remove ${label}`;
                clearBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                clearBtn.onclick = (e) => { e.stopPropagation(); clearFrameEntry(slot); renderPanel(); };
                slotEl.appendChild(clearBtn);
            }

            slotEl.onclick = (e) => {
                e.stopPropagation();
                if (entry) return; // already set; use clear to change
                closePanel();
                pendingFrameSlot = slot;
                fileInput.click();
            };

            // Per-slot drag & drop
            slotEl.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); slotEl.classList.add('border-primary/60', 'bg-primary/10'); });
            slotEl.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (!slotEl.contains(e.relatedTarget)) slotEl.classList.remove('border-primary/60', 'bg-primary/10'); });
            slotEl.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
            slotEl.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation();
                slotEl.classList.remove('border-primary/60', 'bg-primary/10');
                const files = Array.from(e.dataTransfer?.files || []);
                if (!files.length) return;
                pendingFrameSlot = slot;
                uploadFiles(files);
            });

            return slotEl;
        };

        panel.appendChild(buildSlot('start', 'Start image (first frame)', 'START'));
        panel.appendChild(buildSlot('end', 'End image (last frame)', 'END'));

        // History grid — clicking fills the first empty slot.
        if (history.length > 0) {
            const sep = document.createElement('div');
            sep.className = 'text-[9px] font-bold text-secondary uppercase tracking-widest mt-2 mb-1.5';
            sep.textContent = 'Or pick from history';
            panel.appendChild(sep);

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-4 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-0.5';
            history.forEach(entry => {
                const used = (frameEntries.start && frameEntries.start.url === entry.uploadedUrl) ||
                    (frameEntries.end && frameEntries.end.url === entry.uploadedUrl);
                const cell = document.createElement('div');
                cell.className = `relative rounded-lg overflow-hidden border-2 cursor-pointer aspect-square transition-all ${used ? 'border-primary' : 'border-white/10 hover:border-white/30'}`;
                cell.title = entry.name;
                const img = document.createElement('img');
                img.src = entry.thumbnail || fileIconSvg(entry.type);
                img.className = 'w-full h-full object-cover';
                img.onerror = () => { img.src = fileIconSvg(entry.type); };
                cell.appendChild(img);
                cell.onclick = (e) => {
                    e.stopPropagation();
                    const slot = firstEmptyFrameSlot();
                    setFrameEntry(slot, { id: entry.id, name: entry.name, uploadedUrl: entry.uploadedUrl, thumbnail: entry.thumbnail, type: entry.type });
                    if (frameEntries.start && frameEntries.end) closePanel();
                    else renderPanel();
                };
                grid.appendChild(cell);
            });
            panel.appendChild(grid);
        }
    };

    // ── URL input ────────────────────────────────────────────────────────────
    // Renders a small inline form below the header for pasting a remote image
    // or video URL. Fetches the file via fetchUrlAsFile and runs it through
    // the same upload pipeline as a local file selection.
    const appendUrlInput = () => {
        const wrap = document.createElement('div');
        wrap.className = 'mb-3 p-2.5 rounded-xl bg-white/5 border border-white/10';

        const label = document.createElement('div');
        label.className = 'text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5';
        label.textContent = 'Paste image or video URL';
        wrap.appendChild(label);

        const row = document.createElement('div');
        row.className = 'flex items-center gap-1.5';

        const input = document.createElement('input');
        input.type = 'url';
        input.placeholder = 'https://example.com/image.jpg';
        input.className = 'upload-url-input flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50';
        row.appendChild(input);

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'px-3 py-1.5 btn-secondary-modern rounded-lg text-[11px] font-black hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed';
        loadBtn.textContent = 'Load';
        row.appendChild(loadBtn);

        const status = document.createElement('div');
        status.className = 'text-[10px] mt-1.5 hidden';

        const setStatus = (text, kind = 'muted') => {
            status.textContent = text;
            status.className = `text-[10px] mt-1.5 ${kind === 'error' ? 'text-rose-400' : kind === 'ok' ? 'text-emerald-400' : 'text-muted'}`;
        };

        const doLoad = async () => {
            const url = input.value.trim();
            if (!url) {
                setStatus('Enter a URL first.', 'error');
                return;
            }
            if (!apiKeyManager.getMuapiKey()) {
                // Guard against infinite recursion: if auth modal fires and key
                // is still missing after it returns, show an error instead of
                // re-opening the modal forever.
                AuthModal(doLoad);
                return;
            }
            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading…';
            setStatus('Fetching…');

            const urlAbort = new AbortController();
            const FETCH_TIMEOUT_MS = 30000;
            const FETCH_TIMEOUT_ID = setTimeout(() => urlAbort.abort(), FETCH_TIMEOUT_MS);
            const URL_BYTE_CAP = acceptVideo ? UPLOAD_LIMITS.video : UPLOAD_LIMITS.image;

            try {
                let contentLength = null;
                try {
                    const head = await fetch(url, { method: 'HEAD', mode: 'cors', signal: urlAbort.signal });
                    if (head.ok) {
                        const cl = head.headers.get('content-length');
                        if (cl) contentLength = parseInt(cl, 10);
                    }
                } catch { /* non-fatal: proceed without Content-Length */ }

                if (contentLength !== null && contentLength > URL_BYTE_CAP) {
                    const maxMB = URL_BYTE_CAP / 1024 / 1024;
                    throw new Error(`Remote file is ${(contentLength / 1024 / 1024).toFixed(1)}MB; exceeds ${maxMB}MB limit.`);
                }

                clearTimeout(FETCH_TIMEOUT_ID);
                const file = await fetchUrlAsFile(url);

                if (file.size > URL_BYTE_CAP) {
                    const maxMB = URL_BYTE_CAP / 1024 / 1024;
                    throw new Error(`Downloaded file is ${(file.size / 1024 / 1024).toFixed(1)}MB; exceeds ${maxMB}MB limit.`);
                }
                // Filter by accepted type
                const isImage = file.type.startsWith('image/');
                const isVideo = file.type.startsWith('video/');
                if (!acceptVideo && !isImage) {
                    throw new Error('Only image URLs are supported here.');
                }
                if (acceptVideo && !isImage && !isVideo) {
                    throw new Error('Only image or video URLs are supported here.');
                }
                // Reuse the same upload pipeline as a local file selection
                uploadFiles([file]);
                setStatus('Loaded ✓', 'ok');
                input.value = '';
                setTimeout(() => { try { wrap.remove(); } catch {} }, 600);
            } catch (err) {
                setStatus(err.message || 'Failed to fetch URL', 'error');
            } finally {
                clearTimeout(FETCH_TIMEOUT_ID);
                urlAbort.abort();
                loadBtn.disabled = false;
                loadBtn.textContent = 'Load';
            }
        };

        loadBtn.onclick = (e) => { e.stopPropagation(); doLoad(); };
        input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doLoad(); } };
        input.onclick = (e) => e.stopPropagation();

        wrap.appendChild(row);
        wrap.appendChild(status);

        // Insert after header
        const header = panel.querySelector('.flex.items-center.justify-between');
        if (header && header.nextSibling) {
            panel.insertBefore(wrap, header.nextSibling);
        } else {
            panel.appendChild(wrap);
        }
        setTimeout(() => input.focus(), 50);
    };

    // ── Drag and drop on the panel ───────────────────────────────────────────
    const setupDragAndDrop = () => {
        panel.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.classList.add('ring-2', 'ring-primary/50', 'bg-primary/5');
        });
        panel.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        panel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!panel.contains(e.relatedTarget)) {
                panel.classList.remove('ring-2', 'ring-primary/50', 'bg-primary/5');
            }
        });
        panel.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.classList.remove('ring-2', 'ring-primary/50', 'bg-primary/5');
            const files = Array.from(e.dataTransfer?.files || []);
            if (!files.length) return;
            uploadFiles(files);
        });
    };
    setupDragAndDrop();

    // ── Clipboard paste ──────────────────────────────────────────────────────
    // Handler exposed on the panel element so the module-level delegated
    // document paste listener (registered once at import time) can route
    // paste events to this instance without adding a per-instance listener.
    const onPaste = (e) => {
        if (!panelOpen) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
        if (!files.length) return;
        e.preventDefault();
        if (!apiKeyManager.getMuapiKey()) {
            AuthModal(() => onPaste(e));
            return;
        }
        uploadFiles(files);
    };
    // Expose on the DOM node so the module-level delegated listener can reach it
    panel._onPaste = onPaste;

    // ── Trigger click ─────────────────────────────────────────────────────────
    trigger.onclick = (e) => {
        e.stopPropagation();
        if (panelOpen) closePanel();
        else openPanel();
    };

    // Expose the panel close function for the module-level delegated listener
    panel._closeFn = () => { if (panelOpen) closePanel(); };

    // ── File upload handler ───────────────────────────────────────────────────
    const minState = {
        tracks: [],
        assets: [],
        mediaLibrary: [],
        undoStack: [],
        redoStack: [],
        selectedClipId: null
    };

    fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        uploadFiles(files);
    };

    // Shared upload entry point used by file selection, paste, drag/drop, and the
    // "From URL" loader. Takes a plain array of Files (no reliance on the
    // non-standard `input.files` assignment / DataTransfer hacks).
    const uploadFiles = async (files) => {
        if (!files || !files.length) return;

        // Local preview is network-free, so show it immediately — even when no
        // API key is present. The user still gets responsive feedback; the key
        // is only required to actually upload to MuAPI.
        if (onFilePreview) onFilePreview(files[0]);

        const apiKey = apiKeyManager.getMuapiKey();
        if (!apiKey) {
            AuthModal(() => fileInput.click());
            return;
        }

        // Enforce MuAPI per-type byte caps before uploading (the validation
        // pipeline uses looser caps; MuAPI rejects anything over its limits).
        const cap = MUAPI_LIMITS[muapiCategoryForFile(files[0])] || MUAPI_LIMITS.image;
        if (files[0].size > cap) {
            showToast(`File too large. MuAPI allows up to ${formatBytes(cap)} for this type.`, 'error');
            fileInput.value = '';
            return;
        }

        showSpinner();

        // One signal per upload batch; aborting cancels all in-flight requests
        const signal = getAbortSignal();

        try {
            if (frameMode) {
                // Upload a single file into the targeted frame slot.
                const slot = pendingFrameSlot || firstEmptyFrameSlot();
                const file = files[0];
                // Do NOT pass showToast: processFileUpload would otherwise show its
                // own toast, and the catch below would show a duplicate. The picker
                // owns the single user-facing message.
                const result = await uploadWithRetry(file, { state: minState, showToast: null, signal });
                if (!result.success) {
                    const upErr = new Error(result.error || 'Upload failed');
                    if (result.errorStatus) upErr.status = result.errorStatus;
                    throw upErr;
                }
                const { asset } = result;
                const entry = {
                    id: Date.now().toString() + Math.random(),
                    name: file.name,
                    uploadedUrl: asset.url,
                    thumbnail: asset.thumbnail || fileIconSvg(muapiCategoryForFile(file)),
                    type: asset.type || muapiCategoryForFile(file),
                };
                saveUpload(entry);
                setFrameEntry(slot, entry);
                pendingFrameSlot = null;
                if (frameEntries.start && frameEntries.end) closePanel();
                updateTrigger();
                return;
            }

            if (maxImages === 1) {
                const file = files[0];
                const result = await uploadWithRetry(file, {
                    state: minState,
                    showToast: null,
                    signal
                });
                if (!result.success) {
                    const upErr = new Error(result.error || 'Upload failed');
                    if (result.errorStatus) upErr.status = result.errorStatus;
                    throw upErr;
                }
                const { asset } = result;
                const entry = { id: Date.now().toString(), name: file.name, uploadedUrl: asset.url, thumbnail: asset.thumbnail, type: asset.type || muapiCategoryForFile(file) };
                saveUpload(entry);
                selectedEntries = [{ url: asset.url, thumbnail: asset.thumbnail || fileIconSvg(entry.type), type: entry.type }];
                updateTrigger();
                fireOnSelect();
            } else {
                // Multi mode: upload all files (up to remaining slots) with per-file retry
                const slots = maxImages - selectedEntries.length;
                const toUpload = files.slice(0, Math.max(slots, 1));

                const results = await Promise.allSettled(
                    toUpload.map(async (file) => {
                        const result = await uploadWithRetry(file, {
                            state: minState,
                            showToast: null,
                            signal
                        });
                        if (!result.success) {
                            throw new Error(result.error || 'Upload failed');
                        }
                        const { asset } = result;
                        return { id: Date.now().toString() + Math.random(), name: file.name, uploadedUrl: asset.url, thumbnail: asset.thumbnail, type: asset.type || muapiCategoryForFile(file) };
                    })
                );

                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length > 0) {
                    const failedReason = failed[0]?.reason;
                    showToast(`${acceptVideo ? 'Media' : 'Image'} upload failed: ${formatErrorMessage(failedReason)}`, 'error');
                }

                const succeeded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
                succeeded.forEach(entry => {
                    saveUpload(entry);
                    if (selectedEntries.length < maxImages) {
                        selectedEntries.push({ url: entry.uploadedUrl, thumbnail: entry.thumbnail, type: entry.type });
                    }
                });

                updateTrigger();
                // In multi-mode reopen panel so user can continue selecting / see Done button
                openPanel();
            }
        } catch (err) {
            // Silently swallow AbortError — user intentionally cancelled
            if (err.message !== 'Upload cancelled' && err.name !== 'AbortError') {
                console.error('[UploadPicker] Upload failed:', err);
                updateTrigger();
                const uploadType = acceptVideo ? 'Media' : 'Image';
                showToast(`${uploadType} upload failed: ${formatErrorMessage(err)}`, 'error');
            }
        } finally {
            // Always reset the file input so the same file can be re-selected
            fileInput.value = '';
            // Always restore spinner/icon state, even on abort or error
            showIcon();
        }
    };

    // ── Public API ────────────────────────────────────────────────────────────
    const reset = () => {
        abortActiveUpload();
        selectedEntries = [];
        frameEntries = { start: null, end: null };
        showIcon();
        closePanel();
    };

    const setMaxImages = (n) => {
        maxImages = n;
        // Enable multi-file selection in file picker when multi-mode
        fileInput.multiple = n > 1;
        // Trim selection if exceeding new limit
        if (selectedEntries.length > n) {
            selectedEntries = selectedEntries.slice(0, n);
            if (selectedEntries.length === 0) onClear?.();
        }
        // Always refresh trigger so badge/tooltip reflects new mode
        updateTrigger();
    };

    const getSelectedUrls = () => frameMode
        ? [frameEntries.start?.uploadedUrl, frameEntries.end?.uploadedUrl].filter(Boolean)
        : selectedEntries.map(e => e.url);

    // Programmatically select an image (e.g. for demo mode) without uploading
    const setImage = (url, thumbnail) => {
        if (frameMode) {
            setFrameEntry('start', { id: 'demo', name: 'Demo', uploadedUrl: url, thumbnail: thumbnail || url, type: 'image' });
            return;
        }
        selectedEntries = [{ url, thumbnail: thumbnail || url, type: 'image' }];
        updateTrigger();
        fireOnSelect();
    };

    return { trigger, panel, reset, setMaxImages, getSelectedUrls, setImage };
}
