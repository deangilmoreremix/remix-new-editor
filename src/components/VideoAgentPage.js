import { navigate } from '../lib/router.js';
import { showToast } from '../lib/loading.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { getSupabaseUrl, isSupabaseConfigured, uploadFileToStorage } from '../lib/supabase.js';
import { browserVideoProcessor } from '../lib/browserVideoProcessor.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';

const AI_TOOLS = [
    { id: 'scene-detection', name: 'Scene Detection', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>', thumbnail: '/thumbnails/videoagent/scene-detection.png', color: 'blue', description: 'Identify scene boundaries', category: 'understanding' },
    { id: 'clip-segmentation', name: 'Clip Segmentation', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20" stroke-dasharray="2 2"/></svg>', thumbnail: '/thumbnails/videoagent/clip-segmentation.png', color: 'purple', description: 'Split into clip segments', category: 'editing' },
    { id: 'highlight-detection', name: 'Highlight Detection', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>', thumbnail: '/thumbnails/videoagent/highlight-detection.png', color: 'orange', description: 'Find key moments', category: 'understanding' },
    { id: 'cosyvoice', name: 'CosyVoice', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>', thumbnail: '/thumbnails/videoagent/cosyvoice.png', color: 'pink', description: 'Voice cloning & TTS', category: 'audio' },
    { id: 'fish-speech', name: 'Fish Speech', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M2 10c1.5-1 3-1.5 4.5-1s3 1.5 4.5 1 3-1.5 4.5-1 3 1 4.5 1"/></svg>', thumbnail: '/thumbnails/videoagent/fish-speech.png', color: 'cyan', description: 'Voice synthesis', category: 'audio' },
    { id: 'seed-vc', name: 'Seed-VC', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 3l7 7"/><path d="M3 21l7-7"/><path d="M21 21l-7-7"/></svg>', thumbnail: '/thumbnails/videoagent/seed-vc.png', color: 'teal', description: 'Voice conversion', category: 'audio' },
    { id: 'whisper', name: 'Whisper', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', thumbnail: '/thumbnails/videoagent/whisper.png', color: 'green', description: 'Audio transcription', category: 'audio' },
    { id: 'imagebind', name: 'ImageBind', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', thumbnail: '/thumbnails/videoagent/imagebind.png', color: 'indigo', description: 'Multimodal understanding', category: 'understanding' },
    { id: 'dubbing', name: 'Cross-lingual Dub', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>', thumbnail: '/thumbnails/videoagent/dubbing.png', color: 'yellow', description: 'Translate & dub video', category: 'translate' },
    { id: 'color-correct', name: 'Color Correction', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22c-4.97 0-9-2.69-9-6v-.01C3 12.2 7.03 8.6 12 8.6s9 3.6 9 7.39V16c0 3.31-4.03 6-9 6z"/></svg>', thumbnail: '/thumbnails/videoagent/color-correct.png', color: 'rose', description: 'Adjust colors & tones', category: 'enhance' },
    { id: 'upscale', name: 'Video Upscale', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>', thumbnail: '/thumbnails/videoagent/upscale.png', color: 'emerald', description: 'Enhance resolution', category: 'enhance' },
    { id: 'stabilize', name: 'Stabilize', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>', thumbnail: '/thumbnails/videoagent/stabilize.png', color: 'violet', description: 'Fix shaky footage', category: 'enhance' },
];

const USE_CASES = [
    { id: 'standup', name: 'Stand-up Comedy', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>', thumbnail: '/thumbnails/videoagent/standup.png', description: 'Transform video with comedy timing' },
    { id: 'commentary', name: 'Commentary', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', thumbnail: '/thumbnails/videoagent/commentary.png', description: 'Add AI commentary overlay' },
    { id: 'overview', name: 'Video Overview', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>', thumbnail: '/thumbnails/videoagent/overview.png', description: 'Generate summary overview' },
    { id: 'meme', name: 'Meme Generator', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10"/><path d="M7 12h4"/><path d="M7 16h6"/></svg>', thumbnail: '/thumbnails/videoagent/meme.png', description: 'Create meme videos' },
    { id: 'music-video', name: 'Music Video', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', thumbnail: '/thumbnails/videoagent/music-video.png', description: 'Set video to music' },
    { id: 'qa', name: 'Video Q&A', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', thumbnail: '/thumbnails/videoagent/qa.png', description: 'Interactive video Q&A' },
];

export function VideoAgentPage() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col items-center justify-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';

    // AbortController for cancelling async operations
    const abortController = new AbortController();

    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('videoId') || '';
    let videoUrl = urlParams.get('videoUrl') || '';
    
    const processingQueue = [];
    let isProcessing = false;
    
    // ==========================================
    // 1. HERO SECTION
    // ==========================================
    const hero = document.createElement('div');
    hero.className = 'flex flex-col items-center mb-8 md:mb-12 animate-fade-in-up transition-all duration-700 w-full max-w-5xl';
    const heroBanner = createHeroSection('videoagent', 'h-32 md:h-44 mb-4');
    if (heroBanner) {
        const heroContent = document.createElement('div');
        heroContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10';
        heroContent.innerHTML = `
            <h1 class="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mb-1">VideoAgent</h1>
            <p class="text-white/60 text-sm font-medium">AI-powered video processing & enhancement</p>
        `;
        heroBanner.appendChild(heroContent);
        hero.appendChild(heroBanner);
    }
    container.appendChild(hero);
    
    // Main content wrapper with max-width
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'w-full max-w-5xl relative z-40 animate-fade-in-up';
    contentWrapper.style.animationDelay = '0.1s';
    
    contentWrapper.innerHTML = `
        <!-- Back Button -->
        <div class="mb-6">
            <button id="back-btn" class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/70 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back to Video
            </button>
        </div>
        
        <!-- Main Content -->
        <div class="flex flex-col lg:flex-row gap-6">
            <!-- Left: Video Preview + Use Cases -->
            <div class="flex-1 flex flex-col">
                <!-- Video Preview Card -->
                <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 md:p-6 shadow-3xl mb-6">
                    <div class="aspect-video flex items-center justify-center bg-black rounded-xl overflow-hidden relative" id="video-preview-stage">
                        ${videoUrl ? `
                            <video 
                                id="videoagent-video" 
                                class="max-w-full max-h-full" 
                                controls
                                src="${escapeHtml(videoUrl)}"
                            >
                                Your browser does not support video playback.
                            </video>
                        ` : `
                            <div class="relative w-full h-full flex items-center justify-center overflow-hidden">
                                <img src="/thumbnails/videoagent/empty-video.png" alt="No video loaded" class="absolute inset-0 w-full h-full object-cover opacity-40" onerror="this.style.display='none'" />
                                <div class="relative text-center p-8 z-10">
                                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-muted mx-auto mb-4">
                                        <polygon points="5 3 19 12 5 21 5 3"/>
                                    </svg>
                                    <p class="text-white/50">No video loaded</p>
                                    <p class="text-xs text-muted mt-2">Upload a video to start processing</p>
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="mt-3 flex items-center gap-3">
                        <button id="load-video-btn" class="flex items-center gap-2 px-4 py-2.5 bg-primary text-black font-bold rounded-xl hover:scale-[1.02] transition-transform text-sm">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                            </svg>
                            Load Video
                        </button>
                        <span id="load-video-status" class="text-xs text-muted truncate"></span>
                        <input id="video-file-input" type="file" accept="video/*" class="hidden" />
                    </div>
                </div>
                
                <!-- Use Cases -->
                <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] overflow-hidden shadow-3xl">
                    <div class="relative w-full h-28 overflow-hidden">
                        <img src="/thumbnails/videoagent/header-use-cases.png" alt="AI Use Cases" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'" />
                        <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/50 to-transparent"></div>
                        <h3 class="absolute bottom-3 left-5 font-black text-white text-sm tracking-wide z-10">AI USE CASES</h3>
                    </div>
                    <div class="p-4 md:p-6 pt-4">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        ${USE_CASES.map(uc => `
                            <button class="usecase-btn overflow-hidden bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 rounded-2xl text-left transition-all hover:scale-[1.02] cursor-pointer" data-usecase="${uc.id}">
                                <div class="relative w-full aspect-square overflow-hidden">
                                    <img src="${uc.thumbnail}" alt="${uc.name}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'" />
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                                    <div class="absolute bottom-0 left-0 right-0 p-3">
                                        <div class="font-bold text-white text-sm">${uc.name}</div>
                                        <div class="text-[10px] text-white/60">${uc.description}</div>
                                    </div>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                    </div>
                </div>
                
                <!-- Processing Results -->
                <div id="results-panel" class="mt-6 hidden">
                    <h3 class="font-black text-white mb-3 text-sm tracking-wide">PROCESSING RESULTS</h3>
                    <div id="results-content" class="space-y-2">
                    </div>
                </div>
            </div>
            
            <!-- Right Panel - AI Tools -->
            <div class="w-full lg:w-96 flex-shrink-0">
                <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] overflow-hidden shadow-3xl">
                    <!-- Tools Header Banner -->
                    <div class="relative w-full h-28 overflow-hidden">
                        <img src="/thumbnails/videoagent/header-tools.png" alt="AI Processing Tools" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'" />
                        <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/50 to-transparent"></div>
                        <h3 class="absolute bottom-3 left-5 font-black text-white text-sm tracking-wide z-10">AI PROCESSING TOOLS</h3>
                    </div>
                    <div class="p-4 md:p-6 pt-4">
                    <!-- Category Tabs -->
                    <div class="flex border-b border-white/10 mb-4 -mx-4 px-4">
                        <button class="category-tab flex-1 py-2 text-xs font-bold text-primary border-b-2 border-primary" data-category="all">
                            ALL
                        </button>
                        <button class="category-tab flex-1 py-2 text-xs font-bold text-muted hover:text-white" data-category="understanding">
                            UNDERSTAND
                        </button>
                        <button class="category-tab flex-1 py-2 text-xs font-bold text-muted hover:text-white" data-category="editing">
                            EDIT
                        </button>
                        <button class="category-tab flex-1 py-2 text-xs font-bold text-muted hover:text-white" data-category="audio">
                            AUDIO
                        </button>
                    </div>
                    
                    <!-- AI Tools Grid -->
                    <div id="tools-grid" class="grid grid-cols-2 gap-3 mb-6">
                        ${AI_TOOLS.map(tool => `
                            <button class="tool-btn overflow-hidden bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 rounded-2xl text-left transition-all hover:scale-[1.02] cursor-pointer" data-tool="${tool.id}" data-category="${tool.category}">
                                <div class="relative w-full aspect-square overflow-hidden">
                                    <img src="${tool.thumbnail}" alt="${tool.name}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'" />
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                                    <div class="absolute bottom-0 left-0 right-0 p-2.5">
                                        <div class="font-bold text-white text-xs">${tool.name}</div>
                                        <div class="text-[9px] text-white/60">${tool.description}</div>
                                    </div>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                    
                    <!-- Processing Queue -->
                    <div class="border-t border-white/10 pt-4 mb-4">
                        <h3 class="font-black text-white mb-3 text-sm flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            PROCESSING QUEUE
                        </h3>
                        <div id="queue-list" class="space-y-2 max-h-40 overflow-auto">
                            <div class="text-sm text-muted italic p-2">No jobs in queue</div>
                        </div>
                    </div>
                    
                    <!-- Full Pipeline -->
                    <button id="run-full-pipeline" class="w-full py-4 bg-primary text-black font-black rounded-2xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 mb-4">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        Run Full Pipeline
                    </button>
                    
                    <!-- Settings -->
                    <div class="border-t border-white/10 pt-4">
                        <h4 class="font-black text-white text-sm mb-3">SETTINGS</h4>
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs text-muted block mb-1">Output Quality</label>
                                <select class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                                    <option>720p</option>
                                    <option selected>1080p</option>
                                    <option>4K</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs text-muted block mb-1">Output Format</label>
                                <select class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                                    <option selected>MP4</option>
                                    <option>WebM</option>
                                    <option>MOV</option>
                                </select>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-muted">Auto-save results</span>
                                <button class="w-10 h-5 bg-primary rounded-full relative">
                                    <span class="absolute right-0.5 top-0.5 w-4 h-4 bg-black rounded-full"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Processing Modal -->
        <div id="processing-modal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 hidden">
            <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-md w-full mx-4 shadow-3xl">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center">
                        <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                    </div>
                    <h3 class="text-xl font-black text-white mb-2">Processing Video</h3>
                    <p id="processing-name" class="text-sm text-muted">Initializing...</p>
                </div>
                
                <div class="mb-6">
                    <div class="flex justify-between text-xs mb-2">
                        <span class="text-muted">Progress</span>
                        <span id="processing-percent" class="text-primary font-black">0%</span>
                    </div>
                    <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div id="modal-progress-bar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
                
                <div id="processing-steps" class="space-y-2 mb-6">
                </div>
                
                <button id="cancel-processing" class="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    // Append content wrapper
    container.appendChild(contentWrapper);

    // ---- Video upload (Supabase Storage) ----
    const previewStage = container.querySelector('#video-preview-stage');
    const fileInput = container.querySelector('#video-file-input');
    const loadBtn = container.querySelector('#load-video-btn');
    const loadStatus = container.querySelector('#load-video-status');

    function renderVideoPreview() {
        if (!previewStage) return;
        previewStage.innerHTML = videoUrl
            ? `<video id="videoagent-video" class="max-w-full max-h-full" controls src="${escapeHtml(videoUrl)}">Your browser does not support video playback.</video>`
            : `<div class="relative w-full h-full flex items-center justify-center overflow-hidden">
                   <img src="/thumbnails/videoagent/empty-video.png" alt="No video loaded" class="absolute inset-0 w-full h-full object-cover opacity-40" onerror="this.style.display='none'" />
                   <div class="relative text-center p-8 z-10">
                       <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-muted mx-auto mb-4"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                       <p class="text-white/50">No video loaded</p>
                       <p class="text-xs text-muted mt-2">Upload a video to start processing</p>
                   </div>
               </div>`;
    }

    async function handleVideoFile(file) {
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            showToast('Please choose a video file', 'error');
            return;
        }
        if (!isSupabaseConfigured()) {
            showToast('Storage not configured. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.', 'error');
            return;
        }
        try {
            loadStatus.textContent = 'Uploading…';
            loadBtn.disabled = true;
            const url = await uploadFileToStorage(file);
            videoUrl = url; // server-reachable https URL the backend can fetch
            renderVideoPreview();
            loadStatus.textContent = 'Loaded ✓';
            showToast('Video loaded', 'success');
        } catch (err) {
            console.error('[VideoAgentPage] upload failed:', err);
            loadStatus.textContent = 'Upload failed';
            showToast('Upload failed: ' + (err && err.message ? err.message : 'unknown error'), 'error');
        } finally {
            loadBtn.disabled = false;
        }
    }

    if (loadBtn) loadBtn.onclick = () => fileInput && fileInput.click();
    if (fileInput) fileInput.onchange = (e) => handleVideoFile(e.target.files && e.target.files[0]);
    // Drag & drop onto the preview stage
    if (previewStage) {
        previewStage.addEventListener('dragover', (e) => { e.preventDefault(); previewStage.classList.add('ring-2', 'ring-primary'); });
        previewStage.addEventListener('dragleave', () => previewStage.classList.remove('ring-2', 'ring-primary'));
        previewStage.addEventListener('drop', (e) => {
            e.preventDefault();
            previewStage.classList.remove('ring-2', 'ring-primary');
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            handleVideoFile(f);
        });
    }
    renderVideoPreview();

    // Event handlers
    container.querySelector('#back-btn').onclick = () => {
        navigate('render', { videoId, videoUrl });
    };
    
    // Category tabs
    container.querySelectorAll('.category-tab').forEach(tab => {
        tab.onclick = () => {
            container.querySelectorAll('.category-tab').forEach(t => {
                t.classList.remove('text-primary', 'border-primary');
                t.classList.add('text-muted');
            });
            tab.classList.remove('text-muted');
            tab.classList.add('text-primary', 'border-primary');
            
            const category = tab.dataset.category;
            container.querySelectorAll('.tool-btn').forEach(btn => {
                if (category === 'all' || btn.dataset.category === category) {
                    btn.style.display = 'block';
                } else {
                    btn.style.display = 'none';
                }
            });
        };
    });
    
    // Tool buttons
    container.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = () => {
            const toolId = btn.dataset.tool;
            const tool = AI_TOOLS.find(t => t.id === toolId);
            runTool(tool);
        };
    });
    
    // Use case buttons
    container.querySelectorAll('.usecase-btn').forEach(btn => {
        btn.onclick = () => {
            const usecaseId = btn.dataset.usecase;
            const usecase = USE_CASES.find(u => u.id === usecaseId);
            runUseCase(usecase);
        };
    });
    
    // Full pipeline button
    container.querySelector('#run-full-pipeline').onclick = async () => {
        await runFullPipeline();
    };
    
    // Cancel processing
    container.querySelector('#cancel-processing').onclick = async () => {
        container.querySelector('#processing-modal').classList.add('hidden');
        isProcessing = false;
        abortController.abort();
        if (currentJobId) {
            try { await fetch(`/videoagent/cancel/${currentJobId}`, { method: 'POST' }); } catch (_) {}
            try {
                if (isSupabaseConfigured()) {
                    await fetch(`${getSupabaseUrl()}/functions/v1/videoagent/cancel/${currentJobId}`, { method: 'POST' });
                }
            } catch (_) {}
            currentJobId = null;
        }
        showToast('Processing cancelled', 'info');
    };
    
    const runTool = async (tool) => {
        if (isProcessing) {
            showToast('Already processing', 'error');
            return;
        }

        // Voice/tts tools don't need a loaded video; everything else does.
        const NO_VIDEO_TOOLS = ['cosyvoice', 'fish-speech', 'seed-vc'];
        if (!videoId && !videoUrl && !NO_VIDEO_TOOLS.includes(tool.id)) {
            showToast('Please load a video first', 'error');
            return;
        }

        isProcessing = true;
        addToQueue(tool.name, 'pending');

        const modal = container.querySelector('#processing-modal');
        const nameEl = container.querySelector('#processing-name');
        const stepsEl = container.querySelector('#processing-steps');
        const progressBar = container.querySelector('#modal-progress-bar');
        const percentEl = container.querySelector('#processing-percent');

        nameEl.textContent = tool.description;
        modal.classList.remove('hidden');

        // Try Express direct (real OpenAI Whisper, TTS, agent orchestrator).
        // Fall back to Supabase edge function (which proxies to Express).
        // Fall back to simulation ONLY if both fail.
        const directEndpoint = '/videoagent/process';
        const supabaseEndpoint = isSupabaseConfigured()
            ? `${getSupabaseUrl()}/functions/v1/videoagent`
            : null;

        const callProcess = async (endpoint) => {
            // Send the user's own OpenAI key so the backend (Render) bills/uses
            // their account. Falls back to empty (backend uses its global key if set).
            const userOpenAIKey = apiKeyManager.getOpenAIKey() || '';
            return await fetch(endpoint, {
                method: 'POST',
                signal: AbortSignal.any([abortController.signal, AbortSignal.timeout(90000)]),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'process-tool',
                    tool: tool.id,
                    toolName: tool.name,
                    videoId,
                    videoUrl,
                    apiKey: userOpenAIKey,
                    text: (NO_VIDEO_TOOLS.includes(tool.id)
                        ? 'Welcome to the studio. This is a synthesized voice sample for your project.'
                        : tool.description),
                    settings: {
                        quality: container.querySelector('select')?.value || '1080p',
                        format: container.querySelectorAll('select')[1]?.value || 'MP4',
                        apiKey: userOpenAIKey,
                    },
                }),
            });
        };

        let response = null;
        let usedEndpoint = null;
        try {
            response = await callProcess(directEndpoint);
            usedEndpoint = 'direct';
            if (!response.ok) throw new Error(`Direct: ${response.status}`);
        } catch (_) {
            if (supabaseEndpoint) {
                try {
                    response = await callProcess(supabaseEndpoint);
                    usedEndpoint = 'supabase';
                    if (!response.ok) throw new Error(`Supabase: ${response.status}`);
                } catch (e) {
                    response = null;
                }
            }
        }

        if (!response) {
            // Both backends down — fall through to simulation
            showToast('Backends unavailable. Using offline mode.', 'info');
            modal.classList.add('hidden');
            await fallbackOrSimulate(tool);
            return;
        }

        const result = await response.json();
        let finalResult = result;

        if (result.jobId) {
            setCurrentJob(result.jobId);
            // Poll for completion. Use the same endpoint that returned the job.
            const pollUrl = usedEndpoint === 'direct'
                ? `/videoagent/job/${result.jobId}`
                : `${supabaseEndpoint}?jobId=${result.jobId}`;
            try {
                const finalJob = await pollJob(pollUrl, result.steps || getToolSteps(tool.id), stepsEl, progressBar, percentEl, abortController.signal);
                finalResult = finalJob || result;
            } catch (e) {
                showToast('Polling failed. Using offline mode.', 'error');
                modal.classList.add('hidden');
                setCurrentJob(null);
                await fallbackOrSimulate(tool);
                return;
            }
            setCurrentJob(null);
        } else if (result.status === 'completed' || result.success) {
            updateProgress(stepsEl, progressBar, percentEl, 100);
            await new Promise((r) => setTimeout(r, 300));
        } else {
            // No jobId and no completion — treat as failure.
            showToast('Backend returned no job. Using offline mode.', 'info');
            modal.classList.add('hidden');
            await fallbackOrSimulate(tool);
            return;
        }

        modal.classList.add('hidden');
        isProcessing = false;
        updateQueueItem(tool.name, 'complete');
        showResults(tool, finalResult.result || finalResult);
        showToast(`${tool.name} completed!`, 'success');
    };
    
    const runUseCase = async (usecase) => {
        if (isProcessing) {
            showToast('Already processing', 'error');
            return;
        }

        if (!videoId && !videoUrl) {
            showToast('Please load a video first', 'error');
            return;
        }

        isProcessing = true;
        addToQueue(usecase.name, 'pending');

        const modal = container.querySelector('#processing-modal');
        const nameEl = container.querySelector('#processing-name');
        const stepsEl = container.querySelector('#processing-steps');
        const progressBar = container.querySelector('#modal-progress-bar');
        const percentEl = container.querySelector('#processing-percent');

        nameEl.textContent = usecase.description;
        modal.classList.remove('hidden');

        const directEndpoint = '/videoagent/process';
        const supabaseEndpoint = isSupabaseConfigured()
            ? `${getSupabaseUrl()}/functions/v1/videoagent`
            : null;

        const callProcess = async (endpoint) => {
            const userOpenAIKey = apiKeyManager.getOpenAIKey() || '';
            return await fetch(endpoint, {
                method: 'POST',
                signal: AbortSignal.any([abortController.signal, AbortSignal.timeout(90000)]),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'process-usecase',
                    usecase: usecase.id,
                    usecaseName: usecase.name,
                    videoId,
                    videoUrl,
                    apiKey: userOpenAIKey,
                    settings: { apiKey: userOpenAIKey },
                }),
            });
        };

        let response = null;
        let usedEndpoint = null;
        try {
            response = await callProcess(directEndpoint);
            usedEndpoint = 'direct';
            if (!response.ok) throw new Error(`Direct: ${response.status}`);
        } catch (_) {
            if (supabaseEndpoint) {
                try {
                    response = await callProcess(supabaseEndpoint);
                    usedEndpoint = 'supabase';
                    if (!response.ok) throw new Error(`Supabase: ${response.status}`);
                } catch (e) {
                    response = null;
                }
            }
        }

        if (!response) {
            showToast('Backends unavailable. Using offline mode.', 'info');
            modal.classList.add('hidden');
            await handleUnavailable(usecase, 'No backend is running and this use case cannot run in your browser.');
            return;
        }

        const result = await response.json();
        let finalResult = result;
        if (result.jobId) {
            setCurrentJob(result.jobId);
            const pollUrl = usedEndpoint === 'direct'
                ? `/videoagent/job/${result.jobId}`
                : `${supabaseEndpoint}?jobId=${result.jobId}`;
            try {
                const finalJob = await pollJob(pollUrl, getUseCaseSteps(usecase.id), stepsEl, progressBar, percentEl, abortController.signal);
                finalResult = finalJob || result;
            } catch (e) {
                showToast('Polling failed. Using offline mode.', 'error');
                modal.classList.add('hidden');
                setCurrentJob(null);
                await handleUnavailable(usecase, 'No backend is running and this use case cannot run in your browser.');
                return;
            }
            setCurrentJob(null);
        } else if (result.status === 'completed' || result.success) {
            updateProgress(stepsEl, progressBar, percentEl, 100);
            await new Promise((r) => setTimeout(r, 300));
        } else {
            showToast('Backend returned no job. Using offline mode.', 'info');
            modal.classList.add('hidden');
            await handleUnavailable(usecase, 'No backend is running and this use case cannot run in your browser.');
            return;
        }

        modal.classList.add('hidden');
        isProcessing = false;
        updateQueueItem(usecase.name, 'complete');
        showResults({ name: usecase.name, icon: usecase.icon }, finalResult.result || finalResult);
        showToast(`${usecase.name} completed!`, 'success');
    };

    const runFullPipeline = async () => {
        if (isProcessing) {
            showToast('Already processing', 'error');
            return;
        }

        if (!videoId && !videoUrl) {
            showToast('Please load a video first', 'error');
            return;
        }

        isProcessing = true;

        const modal = container.querySelector('#processing-modal');
        const nameEl = container.querySelector('#processing-name');
        const stepsEl = container.querySelector('#processing-steps');
        const progressBar = container.querySelector('#modal-progress-bar');
        const percentEl = container.querySelector('#processing-percent');

        nameEl.textContent = 'Running full AI processing pipeline';
        modal.classList.remove('hidden');

        const directEndpoint = '/videoagent/process';
        const supabaseEndpoint = isSupabaseConfigured()
            ? `${getSupabaseUrl()}/functions/v1/videoagent`
            : null;

        const callProcess = async (endpoint) => {
            const userOpenAIKey = apiKeyManager.getOpenAIKey() || '';
            return await fetch(endpoint, {
                method: 'POST',
                signal: AbortSignal.any([abortController.signal, AbortSignal.timeout(90000)]),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'full-pipeline',
                    videoId,
                    videoUrl,
                    apiKey: userOpenAIKey,
                    settings: { quality: '1080p', format: 'MP4', apiKey: userOpenAIKey },
                }),
            });
        };

        let response = null;
        let usedEndpoint = null;
        try {
            response = await callProcess(directEndpoint);
            usedEndpoint = 'direct';
            if (!response.ok) throw new Error(`Direct: ${response.status}`);
        } catch (_) {
            if (supabaseEndpoint) {
                try {
                    response = await callProcess(supabaseEndpoint);
                    usedEndpoint = 'supabase';
                    if (!response.ok) throw new Error(`Supabase: ${response.status}`);
                } catch (e) {
                    response = null;
                }
            }
        }

        if (!response) {
            showToast('Backends unavailable. Using offline mode.', 'info');
            modal.classList.add('hidden');
            await handleUnavailable({ name: 'Full Pipeline', icon: '⚙️' }, 'No backend is running and the full pipeline cannot run in your browser.');
            return;
        }

        const result = await response.json();
        let finalResult = result;
        if (result.jobId) {
            setCurrentJob(result.jobId);
            const pollUrl = usedEndpoint === 'direct'
                ? `/videoagent/job/${result.jobId}`
                : `${supabaseEndpoint}?jobId=${result.jobId}`;
            try {
                const finalJob = await pollJob(pollUrl, getUseCaseSteps('overview'), stepsEl, progressBar, percentEl, abortController.signal);
                finalResult = finalJob || result;
            } catch (e) {
                showToast('Polling failed. Using offline mode.', 'error');
                modal.classList.add('hidden');
                setCurrentJob(null);
                await handleUnavailable({ name: 'Full Pipeline', icon: '⚙️' }, 'No backend is running and the full pipeline cannot run in your browser.');
                return;
            }
            setCurrentJob(null);
        } else if (result.status === 'completed' || result.success) {
            updateProgress(stepsEl, progressBar, percentEl, 100);
            await new Promise((r) => setTimeout(r, 300));
        } else {
            showToast('Backend returned no job. Using offline mode.', 'info');
            modal.classList.add('hidden');
            await handleUnavailable({ name: 'Full Pipeline', icon: '⚙️' }, 'No backend is running and the full pipeline cannot run in your browser.');
            return;
        }

        modal.classList.add('hidden');
        isProcessing = false;
        showResults({ name: 'Full Pipeline', icon: '⚙️' }, finalResult.result || finalResult);
        showToast('Full pipeline completed!', 'success');
    };
    
    const addToQueue = (name, status) => {
        processingQueue.push({ name, status, id: Date.now() });
        renderQueue();
    };
    
    const updateQueueItem = (name, status) => {
        const item = processingQueue.find(q => q.name === name);
        if (item) item.status = status;
        renderQueue();
    };
    
    const renderQueue = () => {
        const queueEl = container.querySelector('#queue-list');
        
        if (processingQueue.length === 0) {
            queueEl.innerHTML = '<div class="text-sm text-muted italic p-2">No jobs in queue</div>';
            return;
        }
        
        queueEl.innerHTML = processingQueue.map(item => `
            <div class="flex items-center gap-2 p-2 bg-white/5 rounded-xl">
                ${item.status === 'complete' ? `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-primary">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                ` : item.status === 'running' ? `
                    <div class="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full"></div>
                ` : `
                    <span class="w-3 h-3 rounded-full bg-muted"></span>
                `}
                <span class="text-xs text-white flex-1">${item.name}</span>
            </div>
        `).join('');
    };
    
    const showResults = (tool, payload) => {
        const resultsPanel = container.querySelector('#results-panel');
        const resultsContent = container.querySelector('#results-content');

        resultsPanel.classList.remove('hidden');

        const isAudioUrl = (u) =>
            /\.(mp3|wav|m4a|ogg)$/i.test(u) ||
            (payload && /audio\//.test(payload.mimeType || ''));
        const videoUrl =
            payload && typeof payload === 'object'
                ? payload.url || payload.downloadUrl || payload.audioUrl || (payload.shorts && payload.shorts[0] && payload.shorts[0].url)
                : null;
        const isAudio =
            isAudioUrl(videoUrl) ||
            (payload && payload.mimeType && /audio\//.test(payload.mimeType)) ||
            (payload && payload.audioBase64);

        const resultEl = document.createElement('div');
        resultEl.className = 'p-3 bg-white/5 rounded-xl flex flex-col gap-2';

        // Header
        const header = document.createElement('div');
        header.className = 'flex items-center gap-3';
        header.innerHTML = `
            <div class="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <span class="text-lg">${tool.icon || '✓'}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm text-white font-bold truncate">${tool.name}</div>
                <div class="text-[11px] text-secondary truncate">${escapeHtml(payload && payload.source ? String(payload.source) : 'result')}</div>
            </div>
        `;
        resultEl.appendChild(header);

        // Honest "unavailable" state — no faked completion.
        if (payload && payload.unavailable) {
            const note = document.createElement('div');
            note.className = 'text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2';
            note.textContent =
                (payload.error || 'This tool is not available.') +
                ' Start the backend (npm run dev:backend) to enable real processing.';
            resultEl.appendChild(note);
            resultsContent.insertBefore(resultEl, resultsContent.firstChild);
            return;
        }

        // Real playable video/audio output.
        if (videoUrl) {
            resultEl.appendChild(buildMediaPlayer(videoUrl, { isAudio, mimeType: payload && payload.mimeType }));
            const dlBtn = document.createElement('button');
            dlBtn.className = 'self-start mt-1 text-xs text-primary hover:underline flex items-center gap-1';
            dlBtn.textContent = '↓ Download result';
            dlBtn.onclick = () => {
                try {
                    const a = document.createElement('a');
                    a.href = videoUrl;
                    a.download = `${(tool.id || 'video')}.${isAudio ? 'mp3' : 'mp4'}`;
                    a.click();
                } catch (_) {}
            };
            resultEl.appendChild(dlBtn);
        }

        // TTS that was spoken live in the browser (no downloadable file).
        if (payload && payload.spoken) {
            const note = document.createElement('div');
            note.className = 'text-xs text-white/70';
            note.textContent = `Spoken via your browser’s speech synthesis: “${String(payload.text || '')}”`;
            resultEl.appendChild(note);
        }

        // Audio returned as base64 (backend TTS / browser) without a URL.
        if (payload && payload.audioBase64 && !videoUrl) {
            try {
                const bytes = Uint8Array.from(atob(payload.audioBase64), (c) => c.charCodeAt(0));
                const blob = new Blob([bytes], { type: payload.mimeType || 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                resultEl.appendChild(buildMediaPlayer(url, { isAudio: true, mimeType: payload.mimeType }));
            } catch (_) {}
        }

        // Summary line.
        let summary = '';
        if (payload && typeof payload === 'object') {
            if (payload.transcription) summary = `Transcript: “${String(payload.transcription).slice(0, 120)}…”`;
            else if (payload.summary) summary = String(payload.summary);
            else if (payload.result) summary = String(payload.result);
            else if (typeof payload.chapters === 'number') summary = `${payload.chapters} chapters`;
            else if (Array.isArray(payload.scenes)) summary = `${payload.scenes.length} scenes detected`;
            else if (Array.isArray(payload.segments)) summary = `${payload.segments.length} clips segmented`;
            else if (Array.isArray(payload.highlights)) summary = `${payload.highlights.length} highlights found`;
        }
        if (summary) {
            const s = document.createElement('div');
            s.className = 'text-xs text-secondary truncate';
            s.textContent = summary;
            resultEl.appendChild(s);
        }

        // Metadata rows for scene/segment/highlight detection.
        const listRows = (arr, fmt) => {
            if (!Array.isArray(arr) || !arr.length) return;
            const ul = document.createElement('div');
            ul.className = 'text-[11px] text-white/60 flex flex-col gap-0.5 mt-1';
            arr.slice(0, 8).forEach((it) => {
                const row = document.createElement('div');
                row.textContent = fmt(it);
                ul.appendChild(row);
            });
            resultEl.appendChild(ul);
        };
        listRows(payload && payload.scenes, (s) => `Scene ${s.index}: ${s.start}s–${s.end}s`);
        listRows(payload && payload.segments, (s) => `Clip ${s.index}: ${s.start}s–${s.end}s`);
        listRows(payload && payload.highlights, (h) => `Highlight: ${h.start}s–${h.end}s (score ${h.score})`);

        resultsContent.insertBefore(resultEl, resultsContent.firstChild);
    };
    
    const getToolSteps = (toolId) => {
        const stepsMap = {
            'scene-detection': ['Analyzing video frames...', 'Detecting scene changes...', 'Labeling scenes...', 'Generating scene map...'],
            'clip-segmentation': ['Identifying segment boundaries...', 'Creating clip markers...', 'Optimizing cut points...', 'Finalizing segments...'],
            'highlight-detection': ['Analyzing content...', 'Scoring moments...', 'Ranking highlights...', 'Extracting clips...'],
            'cosyvoice': ['Loading voice model...', 'Processing audio...', 'Generating voice...', 'Finalizing output...'],
            'fish-speech': ['Synthesizing speech...', 'Applying voice characteristics...', 'Optimizing audio...', 'Complete!'],
            'seed-vc': ['Analyzing source voice...', 'Processing conversion...', 'Applying target voice...', 'Done!'],
            'whisper': ['Extracting audio...', 'Transcribing speech...', 'Formatting text...', 'Complete!'],
            'imagebind': ['Binding modalities...', 'Analyzing content...', 'Generating insights...', 'Complete!'],
            'dubbing': ['Translating content...', 'Synthesizing speech...', 'Syncing to video...', 'Complete!'],
            'color-correct': ['Analyzing color palette...', 'Applying corrections...', 'Balancing tones...', 'Final render...'],
            'upscale': ['Analyzing frames...', 'Enhancing resolution...', 'Applying AI scaling...', 'Complete!'],
            'stabilize': ['Analyzing motion...', 'Computing vectors...', 'Applying stabilization...', 'Done!'],
        };
        return stepsMap[toolId] || ['Processing...', 'Finalizing...'];
    };
    
    const getUseCaseSteps = (usecaseId) => {
        const stepsMap = {
            'standup': ['Analyzing content...', 'Detecting pacing...', 'Adding comedy timing...', 'Optimizing delivery...'],
            'commentary': ['Analyzing video...', 'Generating commentary...', 'Syncing overlay...', 'Complete!'],
            'overview': ['Summarizing content...', 'Generating chapters...', 'Creating overview...', 'Done!'],
            'meme': ['Analyzing frames...', 'Generating captions...', 'Applying effects...', 'Complete!'],
            'music-video': ['Analyzing audio...', 'Syncing to beat...', 'Adding effects...', 'Done!'],
            'qa': ['Analyzing content...', 'Generating questions...', 'Creating interaction...', 'Complete!'],
        };
        return stepsMap[usecaseId] || ['Processing...', 'Finalizing...'];
    };
    
    // ==========================================
    // API HELPER FUNCTIONS (need container access)
    // ==========================================
    
    function getModalElements() {
        return {
            modal: container.querySelector('#processing-modal'),
            nameEl: container.querySelector('#processing-name'),
            stepsEl: container.querySelector('#processing-steps'),
            progressBar: container.querySelector('#modal-progress-bar'),
            percentEl: container.querySelector('#processing-percent'),
            queueList: container.querySelector('#queue-list'),
            resultsPanel: container.querySelector('#results-panel'),
            resultsContent: container.querySelector('#results-content')
        };
    }
    
    // Generic job poller (used by both tool and pipeline flows).
    let currentJobId = null;
    async function pollJob(pollUrl, steps, stepsEl, progressBar, percentEl, abortSignal) {
        const maxAttempts = 90;
        const stepList = steps || ['Processing...'];
        for (let i = 0; i < maxAttempts; i++) {
            if (abortSignal?.aborted) return;
            try {
                const response = await fetch(pollUrl);
                if (!response.ok) throw new Error(`Poll: ${response.status}`);
                const result = await response.json();
                if (result.status === 'completed' || result.status === 'cancelled') {
                    updateProgress(stepsEl, progressBar, percentEl, 100);
                    try {
                        updateStepsDisplay(stepsEl, stepList, stepList.length - 1);
                    } catch (_) {}
                    return result;
                } else if (result.status === 'failed') {
                    throw new Error(result.error || 'Job failed');
                } else if (result.currentStep) {
                    const stepIndex = Math.min(result.currentStep - 1, stepList.length - 1);
                    updateStepsDisplay(stepsEl, stepList, stepIndex);
                    const percent = Math.round(((stepIndex + 1) / stepList.length) * 100);
                    updateProgress(stepsEl, progressBar, percentEl, percent);
                }
                await new Promise((resolve) => setTimeout(resolve, 1500));
            } catch (error) {
                if (i === maxAttempts - 1) throw error;
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        }
        throw new Error('Job timed out');
    }

    // Track the active jobId so the cancel button can call /cancel.
    function setCurrentJob(jobId) {
        currentJobId = jobId;
    }
    
    // Update progress bar and percentage
    function updateProgress(stepsEl, progressBar, percentEl, percent) {
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (percentEl) percentEl.textContent = `${percent}%`;
    }
    
    // Update steps display during polling
    function updateStepsDisplay(stepsEl, steps, currentIndex) {
        if (!stepsEl) return;
        stepsEl.innerHTML = steps.map((s, idx) => `
            <div class="flex items-center gap-2 text-sm ${idx <= currentIndex ? 'text-white' : 'text-muted'}">
                <span class="w-1.5 h-1.5 rounded-full ${idx < currentIndex ? 'bg-primary' : idx === currentIndex ? 'bg-primary animate-pulse' : 'bg-muted'}"></span>
                ${s}
            </div>
        `).join('');
    }
    
    // Fallback simulation for tool processing
    // Try to process a tool entirely in the browser (FFmpeg-free fallback).
    // Returns true if it produced a result, false if it couldn't (e.g. the
    // video bytes aren't locally accessible or the browser lacks MediaRecorder).
    const tryBrowserProcessing = async (item) => {
        if (!browserVideoProcessor.supports(item.id)) return false;
        try {
            const result = await browserVideoProcessor.processInBrowser({
                action: item.id,
                videoUrl,
                settings: {
                    quality: container.querySelector('select')?.value || '1080p',
                    format: container.querySelectorAll('select')[1]?.value || 'MP4',
                },
            });
            if (!result) return false;
            getModalElements().modal.classList.add('hidden');
            isProcessing = false;
            updateQueueItem(item.name, 'complete');
            showResults(item, result);
            showToast(`${item.name} done in your browser!`, 'success');
            return true;
        } catch (e) {
            console.warn('[VideoAgentPage] browser processing failed:', e.message);
            return false;
        }
    };

    // If the backend is unreachable AND the browser can't do the work, show an
    // honest "unavailable" result instead of a fake progress animation.
    const fallbackOrSimulate = async (item) => {
        if (!(await tryBrowserProcessing(item))) {
            handleUnavailable(item, 'No backend is running and this tool cannot run in your browser.');
        }
    };

    // Honest fallback: when the backend is unreachable AND the browser can't do
    // the work, surface "unavailable" instead of faking a completed result.
    function handleUnavailable(item, reason) {
        const m = getModalElements();
        m.modal.classList.add('hidden');
        isProcessing = false;
        if (item && item.name) updateQueueItem(item.name, 'failed');
        showResults(item || { name: 'Tool' }, {
            unavailable: true,
            error: reason || 'This tool is not available right now.',
        });
        showToast(reason || 'Tool unavailable', 'error');
    }

    // Build a playable <video>/<audio> element for a real result URL.
    function buildMediaPlayer(url, { isAudio = false, mimeType = '' } = {}) {
        const el = document.createElement(isAudio ? 'audio' : 'video');
        el.src = url;
        el.controls = true;
        if (!isAudio) {
            el.className = 'w-full rounded-xl mt-2 bg-black max-h-64';
            el.loop = true;
        } else {
            el.className = 'w-full mt-2';
        }
        if (mimeType) el.type = mimeType;
        return el;
    }

    // Cleanup function to abort ongoing operations
    container.cleanup = () => {
        abortController.abort();
    };

    return container;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
