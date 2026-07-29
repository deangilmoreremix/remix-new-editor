import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { AuthModal } from './AuthModal.js';
import { getUploadHistory, saveUpload, removeUpload, generateThumbnail } from '../lib/uploadHistory.js';
import { fetchUrlAsFile } from '../lib/editor/uploadPipeline.js';

/**
 * Creates a self-contained upload picker: a trigger button + history panel.
 * Supports single-image (maxImages=1) and multi-image (maxImages>1) modes.
 *
 * @param {object} options
 * @param {HTMLElement} options.anchorContainer - The container element the panel is positioned relative to
 * @param {function({ url: string, urls: string[], thumbnail: string }): void} options.onSelect
 * @param {function(): void} [options.onClear]
 * @param {number} [options.maxImages=1] - Maximum number of images selectable
 * @returns {{ trigger: HTMLElement, panel: HTMLElement, reset: function, setMaxImages: function }}
 */
export function createUploadPicker({ anchorContainer, onSelect, onClear, maxImages: initialMaxImages = 1, acceptVideo = false, onFilePreview = null }) {
    let panelOpen = false;
    let maxImages = initialMaxImages;
    let selectedEntries = [];

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = acceptVideo ? 'image/*,video/*' : 'image/*';
    fileInput.className = 'hidden';

    // ── Trigger button ────────────────────────────────────────────────────────
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Reference image';
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
        if (selectedEntries.length === 0) {
            showIcon();
            trigger.title = maxImages > 1 ? `Add up to ${maxImages} images` : 'Reference image';
            return;
        }

        // Show first image thumbnail
        thumbImg.src = selectedEntries[0].thumbnail;
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
            const singleLabel = acceptVideo ? 'Reference media' : 'Reference image';
            trigger.title = count > 1 ? `${count} ${itemLabel} selected` : singleLabel;
        }
    };

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'absolute z-50 opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 shadow-4xl border border-white/10 w-72 transition-all';

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
        panel.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        panel.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
        panelOpen = false;
    };

    const fireOnSelect = () => {
        if (selectedEntries.length === 0) return;
        const urls = selectedEntries.map(e => e.url);
        onSelect({
            url: urls[0],           // backward-compatible single URL
            urls,                   // full array for multi-image models
            thumbnail: selectedEntries[0].thumbnail
        });
    };

    const renderPanel = () => {
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
            doneBtn.className = 'flex items-center gap-1 px-3 py-1.5 bg-primary text-black rounded-xl text-xs font-black transition-all hover:scale-105';
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
        const uploadLabel = isMulti ? 'Upload files' : 'Upload new';
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
                        t.className = 'absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-primary text-black text-[10px] font-black rounded-md whitespace-nowrap z-50';
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
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
            fileInput.onchange({ target: fileInput });
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
            img.src = entry.thumbnail;
            img.className = 'w-full h-full object-cover';

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
                    selectedEntries = [{ url: entry.uploadedUrl, thumbnail: entry.thumbnail }];
                    updateTrigger();
                    fireOnSelect();
                    closePanel();
                } else {
                    // Multi-select: toggle
                    if (isSelected) {
                        selectedEntries.splice(selIdx, 1);
                        if (selectedEntries.length === 0) onClear?.();
                    } else {
                        selectedEntries.push({ url: entry.uploadedUrl, thumbnail: entry.thumbnail });
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
            doneBtn2.className = 'px-4 py-1.5 bg-primary text-black rounded-xl text-xs font-black transition-all hover:scale-105';
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
        hint.innerHTML = `
            <div class="flex items-center justify-center gap-3 flex-wrap">
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload</span>
                <span class="text-white/20">|</span>
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> URL</span>
                <span class="text-white/20">|</span>
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><path d="M12 8v6"/><polyline points="9 11 12 8 15 11"/></svg> Drop</span>
                <span class="text-white/20">|</span>
                <span class="flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2"/></svg> Paste <kbd class="px-1 py-0.5 bg-white/10 rounded text-[9px]">⌘V</kbd></span>
            </div>
        `;
        panel.appendChild(hint);
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
        loadBtn.className = 'px-3 py-1.5 bg-primary text-black rounded-lg text-[11px] font-black hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed';
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
                AuthModal(doLoad);
                return;
            }
            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading…';
            setStatus('Fetching…');
            try {
                const file = await fetchUrlAsFile(url);
                // Filter by accepted type
                const isImage = file.type.startsWith('image/');
                const isVideo = file.type.startsWith('video/');
                if (!acceptVideo && !isImage) {
                    throw new Error('Only image URLs are supported here.');
                }
                if (acceptVideo && !isImage && !isVideo) {
                    throw new Error('Only image or video URLs are supported here.');
                }
                // Reuse the file-input pipeline by calling fileInput.onchange synthetically
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.onchange({ target: fileInput });
                setStatus('Loaded ✓', 'ok');
                input.value = '';
                setTimeout(() => { try { wrap.remove(); } catch {} }, 600);
            } catch (err) {
                setStatus(err.message || 'Failed to fetch URL', 'error');
            } finally {
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
            // Reuse the file-input pipeline
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
            fileInput.onchange({ target: fileInput });
        });
    };
    setupDragAndDrop();

    // ── Clipboard paste ──────────────────────────────────────────────────────
    // Listen at document level so paste works while the panel is open.
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
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        fileInput.files = dt.files;
        fileInput.onchange({ target: fileInput });
    };
    document.addEventListener('paste', onPaste);

    // ── Trigger click ─────────────────────────────────────────────────────────
    trigger.onclick = (e) => {
        e.stopPropagation();
        if (panelOpen) closePanel();
        else openPanel();
    };

    // Close panel on outside click. Guard against the trigger and the panel
    // itself so the click that opened the panel doesn't immediately close it.
    window.addEventListener('click', (e) => {
        if (!panelOpen) return;
        if (e.target === trigger || trigger.contains(e.target)) return;
        if (panel.contains(e.target)) return;
        closePanel();
    });

    // ── File upload handler ───────────────────────────────────────────────────
    fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const apiKey = apiKeyManager.getMuapiKey();
        if (!apiKey) {
            AuthModal(() => fileInput.click());
            return;
        }

        if (onFilePreview) onFilePreview(files[0]);

        showSpinner();

        try {
            if (maxImages === 1) {
                const file = files[0];
                const [uploadedUrl, thumbnail] = await Promise.all([
                    muapi.uploadFile(file),
                    generateThumbnail(file)
                ]);
                const entry = { id: Date.now().toString(), name: file.name, uploadedUrl, thumbnail, timestamp: new Date().toISOString() };
                saveUpload(entry);
                selectedEntries = [{ url: uploadedUrl, thumbnail }];
                updateTrigger();
                fireOnSelect();
            } else {
                // Multi mode: upload all files (up to remaining slots)
                const slots = maxImages - selectedEntries.length;
                const toUpload = files.slice(0, Math.max(slots, 1));

                // Upload all in parallel
                const results = await Promise.all(toUpload.map(async (file) => {
                    const [uploadedUrl, thumbnail] = await Promise.all([
                        muapi.uploadFile(file),
                        generateThumbnail(file)
                    ]);
                    return { id: Date.now().toString() + Math.random(), name: file.name, uploadedUrl, thumbnail, timestamp: new Date().toISOString() };
                }));

                results.forEach(entry => {
                    saveUpload(entry);
                    if (selectedEntries.length < maxImages) {
                        selectedEntries.push({ url: entry.uploadedUrl, thumbnail: entry.thumbnail });
                    }
                });

                updateTrigger();
                // In multi-mode reopen panel so user can continue selecting / see Done button
                openPanel();
            }
        } catch (err) {
            console.error('[UploadPicker] Upload failed:', err);
            updateTrigger();
            const uploadType = acceptVideo ? 'Media' : 'Image';
            alert(`${uploadType} upload failed: ${err.message}`);
        }

        fileInput.value = '';
    };

    // ── Public API ────────────────────────────────────────────────────────────
    const reset = () => {
        selectedEntries = [];
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

    const getSelectedUrls = () => selectedEntries.map(e => e.url);

    // Programmatically select an image (e.g. for demo mode) without uploading
    const setImage = (url, thumbnail) => {
        selectedEntries = [{ url, thumbnail: thumbnail || url }];
        updateTrigger();
        fireOnSelect();
    };

    return { trigger, panel, reset, setMaxImages, getSelectedUrls, setImage };
}
