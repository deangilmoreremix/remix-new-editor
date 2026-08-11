import { mountStudioChrome } from '../lib/studioChrome.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { v2vModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { showInlineError, hideInlineError, startGenerationProgress, createAbortAwareGenerate, categorizeGenerationError } from '../lib/studioHelpers.js';
import { createLoadingOverlay, createProgressBar } from '../lib/loading.js';
import { mountModelSelector } from '../lib/modelSelectorUI.js';

export function VideoToVideoPage() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col items-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';
    mountStudioChrome(container, { currentRoute: 'video-to-video' });

    // ==========================================
    // State
    // ==========================================
    let selectedModel = v2vModels[0]?.id || '';
    let uploadedVideoUrl = null;
    let isLoading = false;
    let loadingOverlay = null;
    let progressHandle = null;
    let abortController = null;
    let generationError = null;

    // ==========================================
    // 1. HERO SECTION
    // ==========================================
    const hero = document.createElement('div');
    hero.className = 'flex flex-col items-center mb-2 md:mb-4 animate-fade-in-up transition-all duration-700 w-full';
    const heroBanner = createHeroSection('video', 'h-32 md:h-44 mb-3');
    if (heroBanner) {
        const heroContent = document.createElement('div');
        heroContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10';
        heroContent.innerHTML = `
            <h1 class="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-1">Video to Video</h1>
            <p class="text-white/60 text-sm font-medium">Transform and enhance your videos with AI-powered tools</p>
        `;
        heroBanner.appendChild(heroContent);
        hero.appendChild(heroBanner);
    }
    container.appendChild(hero);

    // ==========================================
    // 2. PROMPT BAR / STUDIO CONTROLS
    // ==========================================
    const promptWrapper = document.createElement('div');
    promptWrapper.className = 'w-full relative z-40 animate-fade-in-up';
    promptWrapper.style.animationDelay = '0.2s';

    const bar = document.createElement('div');
    bar.className = 'w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl';

    const topRow = document.createElement('div');
    topRow.className = 'flex items-start gap-5 px-2';

    // --- Video Upload Button ---
    const videoFileInput = document.createElement('input');
    videoFileInput.type = 'file';
    videoFileInput.accept = 'video/*';
    videoFileInput.className = 'hidden';

    const videoPickerBtn = document.createElement('button');
    videoPickerBtn.type = 'button';
    videoPickerBtn.title = 'Upload video for transformation';
    videoPickerBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';

    const videoIconEl = document.createElement('div');
    videoIconEl.className = 'flex items-center justify-center w-full h-full';
    videoIconEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

    const videoSpinnerEl = document.createElement('div');
    videoSpinnerEl.className = 'hidden items-center justify-center w-full h-full';
    videoSpinnerEl.innerHTML = `<span class="animate-spin text-primary text-sm">◌</span>`;

    const videoReadyEl = document.createElement('div');
    videoReadyEl.className = 'hidden items-center justify-center w-full h-full';
    videoReadyEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><polyline points="7 10 10 13 15 8" stroke="#d9ff00" stroke-width="2.5"/></svg>`;

    videoPickerBtn.appendChild(videoFileInput);
    videoPickerBtn.appendChild(videoIconEl);
    videoPickerBtn.appendChild(videoSpinnerEl);
    videoPickerBtn.appendChild(videoReadyEl);

    const showVideoIcon = () => {
        videoIconEl.classList.replace('hidden', 'flex');
        videoSpinnerEl.classList.add('hidden'); videoSpinnerEl.classList.remove('flex');
        videoReadyEl.classList.add('hidden'); videoReadyEl.classList.remove('flex');
        videoPickerBtn.classList.remove('border-primary/60');
        videoPickerBtn.classList.add('border-white/10');
        videoPickerBtn.title = 'Upload video for transformation';
    };

    const showVideoSpinner = () => {
        videoIconEl.classList.add('hidden'); videoIconEl.classList.remove('flex');
        videoSpinnerEl.classList.replace('hidden', 'flex');
        videoReadyEl.classList.add('hidden'); videoReadyEl.classList.remove('flex');
    };

    const showVideoReady = (filename) => {
        videoIconEl.classList.add('hidden'); videoIconEl.classList.remove('flex');
        videoSpinnerEl.classList.add('hidden'); videoSpinnerEl.classList.remove('flex');
        videoReadyEl.classList.replace('hidden', 'flex');
        videoPickerBtn.classList.remove('border-white/10');
        videoPickerBtn.classList.add('border-primary/60');
        videoPickerBtn.title = `${filename} — click to change`;
    };

    const clearVideoUpload = () => {
        uploadedVideoUrl = null;
        showVideoIcon();
        selectedModel = v2vModels[0]?.id || '';
        refreshModelSelector();
    };

    videoPickerBtn.onclick = (e) => {
        e.stopPropagation();
        if (uploadedVideoUrl) {
            clearVideoUpload();
        } else {
            videoFileInput.click();
        }
    };

    videoFileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const apiKey = apiKeyManager.getKey();
        if (!apiKey) {
            AuthModal(() => videoFileInput.click());
            return;
        }

        showVideoSpinner();
        try {
            const url = await muapi.uploadFile(file);
            uploadedVideoUrl = url;
            showVideoReady(file.name);
        } catch (err) {
            console.error('[VideoToVideoPage] Video upload failed:', err);
            showVideoIcon();
            alert(`Video upload failed: ${err.message}`);
        }
        videoFileInput.value = '';
    };

    topRow.appendChild(videoPickerBtn);

    // --- Prompt Textarea (disabled in V2V mode since tools don't use prompts) ---
    const textarea = document.createElement('textarea');
    textarea.id = 'v2v-prompt-textarea';
    textarea.placeholder = 'Upload a video, then click Generate';
    textarea.className = 'flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar';
    textarea.rows = 1;
    textarea.disabled = true;
    textarea.setAttribute('aria-label', 'Video prompt');
    textarea.oninput = () => {
        textarea.style.height = 'auto';
        const maxHeight = window.innerWidth < 768 ? 150 : 250;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    };
    topRow.appendChild(textarea);

    bar.appendChild(topRow);

    // --- Model Selector ---
    const modelSelectorContainer = document.createElement('div');
    modelSelectorContainer.className = 'w-full mb-4';
    bar.insertBefore(modelSelectorContainer, topRow.nextSibling);

    const selectedProvider = 'all';
    const searchQuery = '';

    const refreshModelSelector = () => {
        if (modelSelectorContainer) {
            modelSelectorContainer.innerHTML = '';
        }
        mountModelSelector(modelSelectorContainer, {
            models: v2vModels,
            selectedModelId: selectedModel,
            selectedProvider,
            search: searchQuery,
            onSelectModel: (modelId) => {
                selectedModel = modelId;
            },
        });
    };

    // --- Generate Button Row ---
    const generateRow = document.createElement('div');
    generateRow.className = 'flex items-center gap-3 px-2';

    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'flex-1 bg-primary text-black px-6 py-3 rounded-2xl font-black text-sm hover:shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed';
    generateBtn.textContent = 'Generate ✨';
    generateBtn.disabled = true;

    generateRow.appendChild(generateBtn);

    const controlsLeft = document.createElement('div');
    controlsLeft.className = 'flex items-center gap-1.5 md:gap-2.5 relative overflow-x-auto no-scrollbar pb-1 md:pb-0';

    bar.appendChild(controlsLeft);
    bar.appendChild(generateRow);

    // ==========================================
    // 3. CANVAS AREA
    // ==========================================
    const canvas = document.createElement('div');
    canvas.className = 'absolute inset-0 flex flex-col items-center justify-center p-4 min-[800px]:p-16 z-10 opacity-0 pointer-events-none transition-all duration-1000 translate-y-10 scale-95';
    canvas.setAttribute('role', 'status');
    canvas.setAttribute('aria-live', 'polite');

    const videoContainer = document.createElement('div');
    videoContainer.className = 'relative group';

    const resultVideo = document.createElement('video');
    resultVideo.className = 'max-h-[60vh] max-w-[80vw] rounded-3xl shadow-3xl border border-white/10 interactive-glow object-contain';
    resultVideo.controls = true;
    resultVideo.loop = true;
    resultVideo.autoplay = true;
    resultVideo.muted = true;
    resultVideo.playsInline = true;
    videoContainer.appendChild(resultVideo);

    // Canvas Controls
    const canvasControls = document.createElement('div');
    canvasControls.className = 'mt-6 flex gap-3 opacity-0 transition-opacity delay-500 duration-500 justify-center flex-wrap';

    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white';
    regenerateBtn.textContent = '↻ Regenerate';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'bg-primary text-black px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-glow active:scale-95';
    downloadBtn.textContent = '↓ Download';

    const newPromptBtn = document.createElement('button');
    newPromptBtn.className = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white';
    newPromptBtn.textContent = '+ New Video';

    canvasControls.appendChild(regenerateBtn);
    canvasControls.appendChild(downloadBtn);
    canvasControls.appendChild(newPromptBtn);

    canvas.appendChild(videoContainer);
    canvas.appendChild(canvasControls);
    container.appendChild(canvas);

    // ==========================================
    // 4. INLINE ERROR
    // ==========================================
    const errorRegion = document.createElement('div');
    errorRegion.className = 'w-full max-w-3xl mt-4';
    container.appendChild(errorRegion);

    // ==========================================
    // 5. GENERATION LOGIC
    // ==========================================
    generateBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;

        if (isLoading) return;

        if (generationError) {
            generationError = null;
            hideInlineError(container);
        }

        if (!uploadedVideoUrl) {
            showInlineError(container, 'Please upload a video first.');
            return;
        }

        const apiKey = apiKeyManager.getKey();
        if (!apiKey) {
            AuthModal(() => generateBtn.click());
            return;
        }

        isLoading = true;
        hero.classList.add('opacity-0', 'scale-95', '-translate-y-10', 'pointer-events-none');

        abortController = new AbortController();
        const { controller, showCancel, reset: resetCancel } = createAbortAwareGenerate(generateBtn);
        abortController = controller;

        loadingOverlay = createLoadingOverlay('Processing video...');
        const progressBar = createProgressBar(0);
        loadingOverlay.appendChild(progressBar);
        container.appendChild(loadingOverlay);
        progressHandle = startGenerationProgress({
            parent: loadingOverlay,
            type: 'video',
            message: 'Processing video (this may take a few minutes)...'
        });
        showCancel();

        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            if (abortController.signal.aborted) return;
            simulatedProgress = Math.min(simulatedProgress + Math.random() * 3, 90);
            if (progressBar.setProgress) progressBar.setProgress(simulatedProgress);
        }, 1500);

        try {
            const v2vParams = {
                model: selectedModel,
                video_url: uploadedVideoUrl,
                signal: abortController.signal,
            };

            const res = await muapi.processV2V(v2vParams);
            console.log('[VideoToVideoPage] V2V response:', res);

            if (res && res.url) {
                showVideoInCanvas(res.url);
            } else {
                throw new Error('No video URL returned by API');
            }
        } catch (e) {
            const { message } = categorizeGenerationError(e);
            generationError = message;
            showInlineError(container, message, 0);
            resetCancel();
            generateBtn.disabled = false;
            generateBtn.innerHTML = '↻ Retry';
            generateBtn.classList.add('border-red-500/50');
            return;
        } finally {
            clearInterval(progressInterval);
            if (progressHandle) { progressHandle.stop(); progressHandle = null; }
            if (loadingOverlay && loadingOverlay.parentNode) { loadingOverlay.remove(); loadingOverlay = null; }
            resetCancel();
            isLoading = false;
            abortController = null;
            if (!generationError) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = 'Generate ✨';
            }
        }
    };

    // ==========================================
    // 6. RESULT ACTIONS
    // ==========================================
    const showVideoInCanvas = (videoUrl) => {
        hero.classList.add('hidden');
        promptWrapper.classList.add('hidden');

        resultVideo.src = videoUrl;
        resultVideo.onloadeddata = () => {
            canvas.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
            canvas.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            canvasControls.classList.remove('opacity-0');
            canvasControls.classList.add('opacity-100');
        };
    };

    const resetToPromptBar = () => {
        canvas.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
        canvas.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        canvasControls.classList.add('opacity-0');
        canvasControls.classList.remove('opacity-100');
        hero.classList.remove('hidden', 'opacity-0', 'scale-95', '-translate-y-10', 'pointer-events-none');
        promptWrapper.classList.remove('hidden', 'opacity-40');
        generationError = null;
        hideInlineError(container);
    };

    newPromptBtn.onclick = () => {
        resetToPromptBar();
        uploadedVideoUrl = null;
        showVideoIcon();
        selectedModel = v2vModels[0]?.id || '';
        refreshModelSelector();
        generateBtn.disabled = false;
        generateBtn.innerHTML = 'Generate ✨';
        generateBtn.classList.remove('border-red-500/50');
    };

    downloadBtn.onclick = async () => {
        const current = resultVideo.src;
        if (!current) return;
        try {
            const response = await fetch(current);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'v2v-result.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(current, '_blank');
        }
    };

    regenerateBtn.onclick = () => generateBtn.click();

    // ==========================================
    // 7. INIT
    // ==========================================
    refreshModelSelector();
    generateBtn.disabled = true;

    videoFileInput.addEventListener('change', () => {
        generateBtn.disabled = !uploadedVideoUrl;
    });

    return container;
}

