import { navigate } from '../lib/router.js';
import { showToast } from '../lib/loading.js';
import { escapeHtml } from '../lib/security.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { videoDb } from '../lib/videoDb.js';

/* ─── Name → id registry (must match the Python Director backend agent ids) ─── */
const AGENT_NAME_TO_ID = {
    'Video Summarizer': 'summarizer', 'Video Search': 'search', 'Clip Creator': 'clipper',
    'Video Dubbing': 'dubbing', 'Subtitle Generator': 'subtitler', 'Highlight Extractor': 'highlighter',
    'Scene Detector': 'scenes', 'B-Roll Adder': 'broll', 'Voiceover': 'voiceover',
    'Video Editor': 'editor', 'Video Enhancer': 'enhancer', 'Content Compiler': 'compiler',
    'Meme Generator': 'meme', 'Music Video Maker': 'musicvideo', 'Trailer Creator': 'trailer',
    'Compilation Builder': 'compilation', 'Social Media Clip': 'social', 'Preview Generator': 'preview',
    'Montage Builder': 'montage', 'Story Builder': 'story', 'Color Correction': 'color',
    'Video Stabilize': 'stabilize', 'Speed Control': 'speed', 'Reverse Video': 'reverse',
    'Voice Cloning': 'voice_cloning', 'Comparison Agent': 'comparison', 'Gen AI Audio Overlays': 'audio_overlays',
    'Keyword Search & Compilation': 'keyword_search', 'Intelligent Output Formatting': 'output_formatting',
    'Automated Video Highlights': 'auto_highlights', 'Thumbnail Agent': 'thumbnail',
    'Subtitle Agent': 'subtitle_agent', 'Visual Search': 'visual_search', 'Slack Agent': 'slack_agent',
    'Text to Movie': 'text_to_movie', 'Storyboarding Agent': 'storyboarding',
    'Faceless Video Creator': 'faceless_video_creator', 'AI Ad Films': 'ai_ad_films',
    'TikTok Lyric Video': 'tiktok_lyric_video', 'AI Voiceovers': 'ai_voiceovers',
    'Trailer Narration': 'trailer_narration', 'Kids Storyteller': 'kids_storyteller',
    'Year in Frames': 'year_in_frames', 'Profanity Remover': 'profanity_remover',
    'Sales Assistant': 'sales_assistant',
};

/* ─── Agent metadata (id → {action, tool, success}) ─── */
const AGENT_META = {
    summarizer:              { action: 'summarize-video',        tool: 'video-analysis',        success: 'Video summary generated successfully' },
    search:                  { action: 'search-media',            tool: 'video-search',          success: 'Media search completed' },
    clipper:                 { action: 'create-clip',             tool: 'video-clipper',         success: 'Clip created successfully' },
    dubbing:                 { action: 'dub-video',               tool: 'video-dubbing',         success: 'Video dubbed successfully' },
    subtitler:               { action: 'generate-subtitles',      tool: 'video-subtitles',       success: 'Subtitles generated successfully' },
    subtitle_agent:          { action: 'generate-subtitles',      tool: 'video-subtitles',       success: 'Subtitle agent run completed successfully' },
    highlighter:             { action: 'extract-highlights',      tool: 'video-highlights',      success: 'Highlights extracted successfully' },
    auto_highlights:         { action: 'extract-highlights',      tool: 'video-highlights',      success: 'Automated highlights generated successfully' },
    scenes:                  { action: 'detect-scenes',           tool: 'scene-detection',       success: 'Scenes detected successfully' },
    broll:                   { action: 'add-broll',                tool: 'video-broll',           success: 'B-roll added successfully' },
    voiceover:               { action: 'add-voiceover',           tool: 'video-voiceover',       success: 'Voiceover added successfully' },
    voice_cloning:           { action: 'clone-voice',             tool: 'voice-cloning',         success: 'Voice cloned successfully' },
    audio_overlays:          { action: 'add-audio-overlay',       tool: 'audio-overlays',        success: 'Audio overlay added successfully' },
    ai_voiceovers:           { action: 'add-voiceover',           tool: 'ai-voiceovers',         success: 'AI voiceover generated successfully' },
    editor:                  { action: 'edit-video',              tool: 'video-editor',          success: 'Video edited successfully' },
    enhancer:                { action: 'enhance-video',           tool: 'video-enhancer',        success: 'Video enhanced successfully' },
    compiler:                { action: 'compile-videos',          tool: 'video-compiler',        success: 'Videos compiled successfully' },
    compilation:             { action: 'build-compilation',       tool: 'compilation-builder',   success: 'Compilation built successfully' },
    meme:                    { action: 'create-meme',             tool: 'meme-generator',        success: 'Meme created successfully' },
    musicvideo:              { action: 'create-music-video',      tool: 'music-video',           success: 'Music video generated successfully' },
    trailer:                 { action: 'create-trailer',          tool: 'trailer-maker',         success: 'Trailer created successfully' },
    trailer_narration:       { action: 'create-trailer',          tool: 'trailer-narration',     success: 'Trailer narration generated successfully' },
    social:                  { action: 'create-social-clip',      tool: 'social-clip',           success: 'Social media clip created successfully' },
    preview:                 { action: 'generate-preview',        tool: 'preview-generator',     success: 'Preview generated successfully' },
    montage:                 { action: 'create-montage',         tool: 'montage-builder',       success: 'Montage created successfully' },
    story:                   { action: 'build-story',             tool: 'story-builder',         success: 'Story built successfully' },
    color:                   { action: 'color-correct',           tool: 'color-correction',      success: 'Color correction applied successfully' },
    stabilize:               { action: 'stabilize-video',         tool: 'video-stabilize',       success: 'Video stabilized successfully' },
    speed:                   { action: 'adjust-speed',            tool: 'speed-control',         success: 'Speed adjusted successfully' },
    reverse:                 { action: 'reverse-video',           tool: 'video-reverse',         success: 'Video reversed successfully' },
    comparison:              { action: 'compare-videos',          tool: 'video-comparison',      success: 'Video comparison completed successfully' },
    keyword_search:          { action: 'keyword-search',          tool: 'keyword-search',        success: 'Keyword search & compilation completed successfully' },
    output_formatting:       { action: 'format-output',           tool: 'output-formatting',     success: 'Output formatted successfully' },
    thumbnail:               { action: 'generate-thumbnail',     tool: 'thumbnail-generator',   success: 'Thumbnail generated successfully' },
    visual_search:           { action: 'visual-search',           tool: 'visual-search',         success: 'Visual search completed successfully' },
    text_to_movie:           { action: 'text-to-movie',           tool: 'text-to-movie',         success: 'Movie generated from script successfully' },
    storyboarding:           { action: 'generate-storyboard',    tool: 'storyboarding',         success: 'Storyboard generated successfully' },
    faceless_video_creator:  { action: 'create-faceless-video',  tool: 'faceless-video',        success: 'Faceless video created successfully' },
    ai_ad_films:             { action: 'create-ad-film',         tool: 'ad-film-maker',         success: 'AI ad film created successfully' },
    tiktok_lyric_video:      { action: 'create-lyric-video',     tool: 'lyric-video-maker',     success: 'TikTok lyric video created successfully' },
    kids_storyteller:        { action: 'tell-kids-story',         tool: 'kids-storyteller',      success: 'Kids story generated successfully' },
    year_in_frames:          { action: 'build-year-recap',        tool: 'year-in-frames',        success: 'Year-in-frames montage built successfully' },
    profanity_remover:       { action: 'remove-profanity',       tool: 'profanity-remover',     success: 'Profanity removed successfully' },
    slack_agent:             { action: 'send-slack-message',      tool: 'slack-agent',           success: 'Slack message sent successfully' },
    sales_assistant:         { action: 'sales-assist',           tool: 'sales-assistant',       success: 'Sales assistant completed successfully' },
};

/* ─── Quick actions: [label, description, agentId, icon] ─── */
const quickActions = [
    ['Summarize', 'Generate video summary', 'summarizer', '📝'],
    ['Extract Highlights', 'Find best moments', 'highlighter', '⚡'],
    ['Detect Scenes', 'Identify boundaries', 'scenes', '🎬'],
    ['Add Subtitles', 'Auto-generate captions', 'subtitler', '💬'],
    ['Dub Video', 'Translate audio', 'dubbing', '🎤'],
    ['Add B-Roll', 'Overlay footage', 'broll', '🎞️'],
    ['Voiceover', 'Add AI narration', 'voiceover', '🎙️'],
    ['Create Shorts', 'TikTok/Reels/Shorts', 'social', '📱'],
    ['Color Correction', 'Adjust colors', 'color', '🎨'],
    ['Stabilize', 'Fix shaky footage', 'stabilize', '🪄'],
    ['Generate Thumbnail', 'Create cover image', 'thumbnail', '🖼️'],
    ['Make Music Video', 'Sync footage to music', 'musicvideo', '🎵'],
    ['Create Trailer', 'Build cinematic trailer', 'trailer', '🎥'],
    ['Faceless Video', 'No-face narration video', 'faceless_video_creator', '🕶️'],
    ['AI Ad Film', 'Product advertisement', 'ai_ad_films', '📣'],
    ['TikTok Lyric Video', 'Lyric music video', 'tiktok_lyric_video', '🎶'],
    ['Kids Story', 'Children storytelling', 'kids_storyteller', '🧒'],
    ['Year in Frames', 'Yearly recap montage', 'year_in_frames', '📅'],
    ['Remove Profanity', 'Clean audio language', 'profanity_remover', '🚫'],
    ['Text to Movie', 'Script to full movie', 'text_to_movie', '🎬'],
    ['Reverse Video', 'Play backwards', 'reverse', '🔄'],
    ['Speed Control', 'Adjust playback speed', 'speed', '⏱️'],
    ['Visual Search', 'Find by visual query', 'visual_search', '🔎'],
    ['Auto Highlights', 'AI-ranked highlights', 'auto_highlights', '🤖'],
];

const starterPrompts = [
    'Summarize this video',
    'Create a short clip of the best moment',
    'Add subtitles with cinematic styling',
    'Detect scenes and build highlights',
];

/* ─── The 45 agents rendered in the left panel. ───
   Kept under DIRECTOR_AGENTS so the existing template (`DIRECTOR_AGENTS.map(...)`)
   still works. Each entry carries `id` and `category` for the grid + filter. */
const ICON_BY_NAME = {
    'Video Summarizer': '📝', 'Video Search': '🔍', 'Clip Creator': '✂️', 'Video Dubbing': '🎤',
    'Subtitle Generator': '💬', 'Highlight Extractor': '⚡', 'Scene Detector': '🎬', 'B-Roll Adder': '🎞️',
    'Voiceover': '🎙️', 'Video Editor': '✏️', 'Video Enhancer': '✨', 'Content Compiler': '📚',
    'Meme Generator': '😂', 'Music Video Maker': '🎵', 'Trailer Creator': '🎥', 'Compilation Builder': '📋',
    'Social Media Clip': '📱', 'Preview Generator': '👁️', 'Montage Builder': '🎞️', 'Story Builder': '📖',
    'Color Correction': '🎨', 'Video Stabilize': '🪄', 'Speed Control': '⏱️', 'Reverse Video': '🔄',
    'Voice Cloning': '🗣️', 'Comparison Agent': '⚖️', 'Gen AI Audio Overlays': '🎚️',
    'Keyword Search & Compilation': '🔑', 'Intelligent Output Formatting': '📤', 'Automated Video Highlights': '🌟',
    'Thumbnail Agent': '🖼️', 'Subtitle Agent': '📝', 'Visual Search': '🔎', 'Slack Agent': '💬',
    'Text to Movie': '🎬', 'Storyboarding Agent': '📐', 'Faceless Video Creator': '🕶️', 'AI Ad Films': '📣',
    'TikTok Lyric Video': '🎶', 'AI Voiceovers': '🔊', 'Trailer Narration': '🎙️', 'Kids Storyteller': '🧒',
    'Year in Frames': '📅', 'Profanity Remover': '🚫', 'Sales Assistant': '💼',
};

/* Derive a category from an agent's registered tool so the category
   filter keeps working for all 45 agents. */
function categoryForAgent(id) {
    const tool = (AGENT_META[id] && AGENT_META[id].tool) || '';
    if (tool.includes('subtitle') || tool.includes('accessibility')) return 'accessibility';
    if (tool.includes('search') || tool.includes('visual')) return 'search';
    if (tool.includes('scene') || tool.includes('analysis')) return 'analysis';
    if (tool.includes('highlight') || tool.includes('clip') || tool.includes('extract') || tool.includes('comparison') || tool.includes('broll')) return 'extract';
    if (tool.includes('dub') || tool.includes('voice') || tool.includes('audio') || tool.includes('narration') || tool.includes('slack')) return 'audio';
    if (tool.includes('translate')) return 'translate';
    if (tool.includes('color') || tool.includes('enhance') || tool.includes('stabilize') || tool.includes('enhancer')) return 'enhance';
    if (tool.includes('editor') || tool.includes('speed') || tool.includes('reverse') || tool.includes('edit')) return 'edit';
    if (tool.includes('social') || tool.includes('lyric')) return 'social';
    return 'create';
}

const DIRECTOR_AGENTS = Object.entries(AGENT_NAME_TO_ID).map(([name, id]) => ({
    id,
    name,
    icon: ICON_BY_NAME[name] || '🤖',
    description: (AGENT_META[id] && AGENT_META[id].success.replace(/ successfully$/, '')) || name,
    category: categoryForAgent(id),
}));

const AGENT_CATEGORIES = {
    analysis: { name: 'Analysis', color: 'blue' },
    search: { name: 'Search', color: 'cyan' },
    extract: { name: 'Extract', color: 'purple' },
    translate: { name: 'Translate', color: 'pink' },
    accessibility: { name: 'Accessibility', color: 'orange' },
    enhance: { name: 'Enhance', color: 'green' },
    audio: { name: 'Audio', color: 'red' },
    edit: { name: 'Edit', color: 'yellow' },
    create: { name: 'Create', color: 'teal' },
    social: { name: 'Social', color: 'indigo' },
};

export function DirectorPage() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
    
    const urlParams = new URLSearchParams(window.location.search);
    let videoId = urlParams.get('videoId') || '';
    let videoUrl = urlParams.get('videoUrl') || '';
    
    let chatHistory = [];
    let activeAgents = new Set();
    let isProcessing = false;
    
    container.innerHTML = `
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-white/5 bg-black/50">
            <div class="flex items-center gap-4">
                <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-xl font-black text-white">DIRECTOR</h1>
                        <p class="text-xs text-secondary">AI Agentic Editor • ${DIRECTOR_AGENTS.length} Agents</p>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button id="clear-chat-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors">
                    Clear Chat
                </button>
                <span class="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center gap-2">
                    <span class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    REASONING ENGINE
                </span>
            </div>
        </div>
        
        <!-- Main Content -->
        <div class="flex-1 flex overflow-hidden">
            <!-- Left: Agents Panel -->
            <div class="w-72 border-r border-white/5 overflow-hidden bg-black/30 flex flex-col">
                <div class="p-4 overflow-auto flex-1">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-bold text-white text-sm uppercase tracking-wider">AI AGENTS</h3>
                        <select id="category-filter" class="bg-white/5 text-xs text-secondary rounded px-2 py-1 border border-white/10">
                            <option value="">All Categories</option>
                            ${Object.entries(AGENT_CATEGORIES).map(([key, val]) => 
                                `<option value="${key}">${val.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div id="agents-grid" class="grid grid-cols-2 gap-2">
                        ${DIRECTOR_AGENTS.map(agent => `
                            <button class="agent-btn p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all hover:scale-[1.02] cursor-pointer" data-agent="${agent.id}" data-category="${agent.category}">
                                <div class="text-lg mb-1">${agent.icon}</div>
                                <div class="font-bold text-white text-xs leading-tight">${agent.name}</div>
                                <div class="text-[10px] text-secondary truncate">${agent.description}</div>
                            </button>
                        `).join('')}
                    </div>
                    
                    <!-- Active Agents -->
                    <div class="mt-6">
                        <h4 class="font-bold text-white text-sm mb-3 flex items-center gap-2">
                            <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            ACTIVE AGENTS
                        </h4>
                        <div id="active-agents" class="space-y-2 max-h-48 overflow-auto">
                            <div class="text-xs text-secondary italic p-2">No agents running</div>
                        </div>
                    </div>
                    
                    <!-- Recent History -->
                    <div class="mt-6">
                        <h4 class="font-bold text-white text-sm mb-3">RECENT ACTIONS</h4>
                        <div id="action-history" class="space-y-2 max-h-40 overflow-auto">
                            <div class="text-xs text-secondary italic p-2">No actions yet</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Center: Video + Chat -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- Video Preview + Upload -->
                <div class="p-4 border-b border-white/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-bold text-white text-sm flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                            </svg>
                            VIDEO PREVIEW
                        </h3>
                        <div class="flex items-center gap-2">
                            <button id="director-upload-btn" class="px-3 py-1.5 bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                                Upload Video
                            </button>
                            <input type="file" id="director-upload-input" accept="video/*" class="hidden" />
                            <span id="director-upload-status" class="text-[11px] text-secondary"></span>
                        </div>
                    </div>
                    <div class="bg-black rounded-2xl overflow-hidden">
                        <div id="director-player-wrap" class="aspect-video flex items-center justify-center bg-black/80 relative">
                            ${videoUrl ? `
                                <video
                                    id="director-video"
                                    class="w-full h-full object-contain bg-black"
                                    controls
                                    src="${escapeHtml(videoUrl)}"
                                >
                                    Your browser does not support video playback.
                                </video>
                            ` : `
                                <div id="director-empty" class="text-center p-8">
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-secondary mx-auto mb-4">
                                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                        <line x1="7" y1="2" x2="7" y2="22"/>
                                        <line x1="17" y1="2" x2="17" y2="22"/>
                                        <line x1="2" y1="12" x2="22" y2="12"/>
                                        <line x1="2" y1="7" x2="7" y2="7"/>
                                        <line x1="2" y1="17" x2="7" y2="17"/>
                                        <line x1="17" y1="17" x2="22" y2="17"/>
                                        <line x1="17" y1="7" x2="22" y2="7"/>
                                    </svg>
                                    <p class="text-secondary">No video loaded</p>
                                    <p class="text-xs text-muted mt-2">Upload a video or open Director with <code>?videoUrl=</code> / <code>?videoId=</code></p>
                                    <button id="director-empty-upload" class="mt-4 px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold rounded-lg transition-colors cursor-pointer">
                                        Choose a video file
                                    </button>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <!-- Chat Interface -->
                <div class="flex-1 flex flex-col overflow-hidden p-4">
                    <h3 class="font-bold text-white mb-3 text-sm flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        AI CHAT
                        <span class="ml-auto text-xs text-secondary font-normal">Powered by VideoDB</span>
                    </h3>
                    
                    <!-- Chat Messages -->
                    <div id="chat-messages" class="flex-1 overflow-auto space-y-3 mb-4 min-h-[180px] max-h-[280px]">
                        <div class="chat-message flex gap-3">
                            <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                            <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                                <p class="text-sm text-white">Hello! I'm Director, your AI video assistant with ${DIRECTOR_AGENTS.length}+ specialized agents.</p>
                                <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div class="bg-white/5 p-2 rounded">
                                        <span class="text-primary font-bold">🎬</span> Scene Detection
                                    </div>
                                    <div class="bg-white/5 p-2 rounded">
                                        <span class="text-primary font-bold">⚡</span> Highlights
                                    </div>
                                    <div class="bg-white/5 p-2 rounded">
                                        <span class="text-primary font-bold">💬</span> Subtitles
                                    </div>
                                    <div class="bg-white/5 p-2 rounded">
                                        <span class="text-primary font-bold">🎤</span> Dubbing
                                    </div>
                                </div>
                                <p class="text-xs text-primary mt-3">Select an agent or type a command below.</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Command Input -->
                    <div class="flex gap-3">
                        <input 
                            type="text" 
                            id="command-input" 
                            placeholder="Type your command (e.g., 'Create a short clip of the best moment')"
                            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary/50"
                        >
                        <button id="send-command-btn" class="px-6 py-3 bg-primary text-black text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Right: Tools Panel -->
            <div class="w-80 border-l border-white/5 p-4 overflow-auto bg-black/30">
                <!-- Processing Status -->
                <div id="processing-status" class="hidden mb-6">
                    <h4 class="font-bold text-white text-sm mb-3 flex items-center gap-2">
                        <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        PROCESSING
                    </h4>
                    <div class="bg-white/5 rounded-xl p-3">
                        <div class="mb-3">
                            <span id="processing-title" class="text-sm text-white font-bold">Processing...</span>
                        </div>
                        <div id="processing-steps" class="space-y-1 text-xs">
                        </div>
                        <div class="mt-3 pt-3 border-t border-white/10">
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-secondary">Progress</span>
                                <span id="progress-percent" class="text-primary font-bold">0%</span>
                            </div>
                            <div class="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div id="progress-bar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <h3 class="font-bold text-white mb-3 text-sm uppercase tracking-wider">QUICK ACTIONS</h3>
                <div class="space-y-2">
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="summarize">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">📝</div>
                        <div>
                            <div class="font-bold text-white text-sm">Summarize</div>
                            <div class="text-xs text-secondary">Generate video summary</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="highlights">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">⚡</div>
                        <div>
                            <div class="font-bold text-white text-sm">Extract Highlights</div>
                            <div class="text-xs text-secondary">Find best moments</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="scenes">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎬</div>
                        <div>
                            <div class="font-bold text-white text-sm">Detect Scenes</div>
                            <div class="text-xs text-secondary">Identify boundaries</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="subtitles">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">💬</div>
                        <div>
                            <div class="font-bold text-white text-sm">Add Subtitles</div>
                            <div class="text-xs text-secondary">Auto-generate captions</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="dubbing">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎤</div>
                        <div>
                            <div class="font-bold text-white text-sm">Dub Video</div>
                            <div class="text-xs text-secondary">Translate audio</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="broll">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎞️</div>
                        <div>
                            <div class="font-bold text-white text-sm">Add B-Roll</div>
                            <div class="text-xs text-secondary">Overlay footage</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="voiceover">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎙️</div>
                        <div>
                            <div class="font-bold text-white text-sm">Voiceover</div>
                            <div class="text-xs text-secondary">Add AI narration</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="shorts">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">📱</div>
                        <div>
                            <div class="font-bold text-white text-sm">Create Shorts</div>
                            <div class="text-xs text-secondary">TikTok/Reels/Shorts</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="color">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎨</div>
                        <div>
                            <div class="font-bold text-white text-sm">Color Correction</div>
                            <div class="text-xs text-secondary">Adjust colors</div>
                        </div>
                    </button>
                    
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="stabilize">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🪄</div>
                        <div>
                            <div class="font-bold text-white text-sm">Stabilize</div>
                            <div class="text-xs text-secondary">Fix shaky footage</div>
                        </div>
                    </button>
                </div>
                
                <!-- Video Timeline Preview -->
                <div class="mt-6">
                    <h4 class="font-bold text-white text-sm mb-3">TIMELINE PREVIEW</h4>
                    <div class="bg-white/5 rounded-xl p-3">
                        <div class="h-16 bg-black/30 rounded relative overflow-hidden">
                            <div class="absolute inset-0 flex items-center justify-center text-xs text-secondary">No timeline data</div>
                        </div>
                        <div class="flex justify-between text-xs text-secondary mt-2">
                            <span>0:00</span>
                            <span>--:--</span>
                        </div>
                    </div>
                </div>
                
                <!-- Export Options -->
                <div class="mt-6">
                    <h4 class="font-bold text-white text-sm mb-3">EXPORT</h4>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="export-btn p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-center text-secondary hover:text-white transition-colors cursor-pointer" data-format="mp4">
                            MP4
                        </button>
                        <button class="export-btn p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-center text-secondary hover:text-white transition-colors cursor-pointer" data-format="webm">
                            WebM
                        </button>
                        <button class="export-btn p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-center text-secondary hover:text-white transition-colors cursor-pointer" data-format="gif">
                            GIF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Event Handlers
    container.querySelector('#back-btn').onclick = () => {
        navigate('render', { videoId, videoUrl });
    };
    
    container.querySelector('#clear-chat-btn').onclick = () => {
        const chatMessages = container.querySelector('#chat-messages');
        chatMessages.innerHTML = `
            <div class="chat-message flex gap-3">
                <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">Chat cleared. How can I help you with your video?</p>
                </div>
            </div>
        `;
        chatHistory = [];
    };

    /* ─── Video upload + player/previewer ─── */
    const playerWrap = container.querySelector('#director-player-wrap');
    const uploadInput = container.querySelector('#director-upload-input');
    const uploadStatus = container.querySelector('#director-upload-status');
    let localObjectUrl = null;

    const renderPlayer = (src, { fromVideoDB = false } = {}) => {
        if (!playerWrap) return;
        playerWrap.innerHTML = `
            <video id="director-video" class="w-full h-full object-contain bg-black" controls src="${escapeHtml(src)}">
                Your browser does not support video playback.
            </video>
        `;
        if (fromVideoDB) {
            // Persist the resolved VideoDB id so agents can operate on it.
            const idMatch = /[?&]id=([^&]+)/.exec(src) || /videodb\.io\/.*\/([a-z0-9-]{8,})/.exec(src);
        }
    };

    const setStatus = (msg) => { if (uploadStatus) uploadStatus.textContent = msg || ''; };

    const handleFile = async (file) => {
        if (!file) return;
        // 1) Instant local preview (no key required).
        if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
        localObjectUrl = URL.createObjectURL(file);
        renderPlayer(localObjectUrl);
        videoUrl = localObjectUrl;
        videoId = '';

        // 2) If the user has a VideoDB key, upload + index so agents can run.
        if (!apiKeyManager.hasVideoDBKey()) {
            setStatus('Local preview ready — add VideoDB key in Settings to enable agents');
            return;
        }
        try {
            setStatus('Uploading to VideoDB…');
            const form = new FormData();
            form.append('file', file);
            form.append('name', file.name);
            form.append('media_type', 'video');
            form.append('endpoint', 'collection/default/upload');
            form.append('videoDbKey', apiKeyManager.getVideoDBKey());
            const proxyBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
                ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')
                : (window.__BACKEND_URL__ || '');
            const res = await fetch(`${proxyBase}/api/videodb/proxy`, {
                method: 'POST',
                body: form,
            });
            const json = await res.json().catch(() => ({}));
            const data = json?.data ?? json;
            if (data?.id) {
                videoId = data.id;
                setStatus(`Indexed as ${data.id}`);
                if (data.stream_url) renderPlayer(data.stream_url, { fromVideoDB: true });
            } else {
                setStatus('Uploaded (no stream returned)');
            }
        } catch (err) {
            console.warn('[Director] VideoDB upload failed:', err.message);
            setStatus('Local preview only — VideoDB upload failed');
        }
    };

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            handleFile(file);
            uploadInput.value = '';
        });
    }
    const uploadBtn = container.querySelector('#director-upload-btn');
    if (uploadBtn) uploadBtn.onclick = () => uploadInput && uploadInput.click();
    const emptyUpload = container.querySelector('#director-empty-upload');
    if (emptyUpload) emptyUpload.onclick = () => uploadInput && uploadInput.click();

    // Category filter
    container.querySelector('#category-filter').onchange = (e) => {
        const category = e.target.value;
        container.querySelectorAll('.agent-btn').forEach(btn => {
            if (!category || btn.dataset.category === category) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        });
    };
    
    // Chat functionality
    const commandInput = container.querySelector('#command-input');
    const sendCommandBtn = container.querySelector('#send-command-btn');
    const chatMessages = container.querySelector('#chat-messages');
    
    const addMessage = (text, isUser = false, agents = [], isAction = false) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message flex gap-3';
        
        if (isUser) {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary rounded-full flex-shrink-0 flex items-center justify-center text-black text-xs font-bold">YOU</div>
                <div class="bg-primary/20 rounded-2xl rounded-tr-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${escapeHtml(text)}</p>
                </div>
            `;
        } else if (isAction) {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">✓</div>
                <div class="bg-green-500/20 rounded-2xl rounded-tr-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${escapeHtml(text)}</p>
                    ${agents.length > 0 ? `
                        <div class="mt-2 pt-2 border-t border-white/10">
                            <p class="text-xs text-secondary">Agents activated:</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${agents.map(a => `<span class="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">${a}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${escapeHtml(text)}</p>
                    ${agents.length > 0 ? `
                        <div class="mt-2 pt-2 border-t border-white/10">
                            <p class="text-xs text-secondary">Agents activated:</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${agents.map(a => `<span class="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">${a}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        chatHistory.push({ text, isUser, agents, isAction });
    };
    
    const updateActiveAgents = () => {
        const activeEl = container.querySelector('#active-agents');
        
        if (activeAgents.size === 0) {
            activeEl.innerHTML = '<div class="text-xs text-secondary italic p-2">No agents running</div>';
            return;
        }
        
        activeEl.innerHTML = Array.from(activeAgents).map(agentId => {
            const agent = DIRECTOR_AGENTS.find(a => a.id === agentId);
            // Use escapeHtml to prevent XSS from agent IDs
            const safeName = escapeHtml(agent?.name || agentId);
            const safeIcon = escapeHtml(agent?.icon || '🤖');
            return `
                <div class="p-2 bg-white/5 rounded-lg flex items-center gap-2">
                    <span class="text-lg">${safeIcon}</span>
                    <span class="text-xs text-white flex-1">${safeName}</span>
                    <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                </div>
            `;
        }).join('');
    };
    
    const addToHistory = (command, agents) => {
        const historyEl = container.querySelector('#action-history');
        if (historyEl.querySelector('.italic')) {
            historyEl.innerHTML = '';
        }
        
        const actionEl = document.createElement('div');
        actionEl.className = 'p-2 bg-white/5 rounded-lg text-xs text-white flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors';
        actionEl.innerHTML = `
            <span class="text-primary">✓</span>
            <span class="flex-1 truncate">${escapeHtml(command.slice(0, 25))}${command.length > 25 ? '...' : ''}</span>
            <span class="text-secondary ml-auto">${agents.slice(0, 2).join(', ')}</span>
        `;
        actionEl.onclick = () => {
            commandInput.value = command;
            commandInput.focus();
        };
        historyEl.insertBefore(actionEl, historyEl.firstChild);
        
        // Keep only last 10 items
        while (historyEl.children.length > 10) {
            historyEl.removeChild(historyEl.lastChild);
        }
    };
    
    const addAssistantMessage = (html) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message flex gap-3';
        msgDiv.innerHTML = `
            <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
            <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                ${html}
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleSend = () => {
        const text = commandInput.value;
        if (!text || !text.trim()) return;
        processCommand(text);
    };

    /* ─── Keyword → agent id (for free-text command inference) ─── */
    const KEYWORD_TO_AGENT = [
        ['summarize', 'summarizer'], ['summary', 'summarizer'],
        ['highlight', 'highlighter'], ['best moment', 'highlighter'],
        ['auto highlight', 'auto_highlights'],
        ['scene', 'scenes'], ['detect scene', 'scenes'],
        ['subtitle', 'subtitler'], ['caption', 'subtitler'],
        ['dub', 'dubbing'], ['translate audio', 'dubbing'],
        ['b-roll', 'broll'], ['broll', 'broll'], ['overlay footage', 'broll'],
        ['voiceover', 'voiceover'], ['narration', 'voiceover'],
        ['voice clone', 'voice_cloning'], ['clone voice', 'voice_cloning'],
        ['audio overlay', 'audio_overlays'],
        ['ai voiceover', 'ai_voiceovers'],
        ['thumbnail', 'thumbnail'], ['cover image', 'thumbnail'],
        ['social', 'social'], ['short', 'social'], ['tiktok', 'social'], ['reel', 'social'],
        ['comparison', 'comparison'], ['compare', 'comparison'],
        ['keyword search', 'keyword_search'], ['compile by keyword', 'keyword_search'],
        ['output format', 'output_formatting'],
        ['visual search', 'visual_search'],
        ['search', 'search'],
        ['clip', 'clipper'],
        ['edit', 'editor'], ['trim', 'editor'], ['cut', 'editor'],
        ['enhance', 'enhancer'], ['upscale', 'enhancer'],
        ['compile', 'compiler'], ['content compiler', 'compiler'],
        ['compilation', 'compilation'],
        ['meme', 'meme'],
        ['music video', 'musicvideo'],
        ['trailer', 'trailer'],
        ['trailer narration', 'trailer_narration'],
        ['preview', 'preview'],
        ['montage', 'montage'],
        ['story', 'story'], ['narrative', 'story'],
        ['color', 'color'], ['color correct', 'color'], ['color grade', 'color'],
        ['stabilize', 'stabilize'], ['fix shaky', 'stabilize'],
        ['speed', 'speed'], ['slow motion', 'speed'], ['fast forward', 'speed'],
        ['reverse', 'reverse'], ['play backwards', 'reverse'],
        ['text to movie', 'text_to_movie'], ['script to movie', 'text_to_movie'],
        ['storyboard', 'storyboarding'],
        ['faceless', 'faceless_video_creator'], ['no face', 'faceless_video_creator'],
        ['ad film', 'ai_ad_films'], ['advertisement', 'ai_ad_films'], ['product ad', 'ai_ad_films'],
        ['lyric video', 'tiktok_lyric_video'], ['tiktok lyric', 'tiktok_lyric_video'],
        ['kids story', 'kids_storyteller'], ['children', 'kids_storyteller'],
        ['year in frames', 'year_in_frames'], ['yearly recap', 'year_in_frames'],
        ['profanity', 'profanity_remover'], ['clean audio', 'profanity_remover'],
        ['slack', 'slack_agent'],
        ['sales', 'sales_assistant'], ['crm', 'sales_assistant'],
    ];

    const inferAgentId = (text) => {
        const lower = text.toLowerCase();
        for (const [keyword, id] of KEYWORD_TO_AGENT) {
            if (lower.includes(keyword)) return id;
        }
        return null;
    };

    const showProcessing = (label) => {
        const statusEl = container.querySelector('#processing-status');
        if (!statusEl) return;
        statusEl.classList.remove('hidden');
        container.querySelector('#processing-title').textContent = `Running ${label}...`;
        container.querySelector('#processing-steps').innerHTML = '';
        container.querySelector('#progress-bar').style.width = '50%';
        container.querySelector('#progress-percent').textContent = '50%';
    };

    const hideProcessing = () => {
        const statusEl = container.querySelector('#processing-status');
        if (!statusEl) return;
        statusEl.classList.add('hidden');
        container.querySelector('#progress-bar').style.width = '0%';
        container.querySelector('#progress-percent').textContent = '0%';
    };

    /**
     * Dispatch a real request to the backend Director proxy for a single agent.
     * Never fakes a success — on any failure it surfaces the real error.
     */
    const runAgent = async (agentId, input) => {
        const label = DIRECTOR_AGENTS.find(a => a.id === agentId)?.name || agentId;

        if (!apiKeyManager.hasVideoDBKey()) {
            addMessage('Please add your VideoDB API key in Settings to use Director agents.', false);
            showToast('VideoDB key required', 'error');
            return;
        }

        isProcessing = true;
        showProcessing(label);
        activeAgents.add(agentId);
        updateActiveAgents();

        let json;
        try {
            const res = await fetch(`/api/director/agent/${encodeURIComponent(agentId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input, videoId, videoUrl }),
            });
            json = await res.json().catch(() => ({}));
        } catch (err) {
            hideProcessing();
            isProcessing = false;
            activeAgents.delete(agentId);
            updateActiveAgents();
            addMessage(`Agent failed: network error (${escapeHtml(String(err.message || err))})`, false);
            return;
        }

        hideProcessing();
        isProcessing = false;
        activeAgents.delete(agentId);
        updateActiveAgents();

        if (json && json.ok) {
            if (json.streamUrl) {
                let src = json.streamUrl;
                const looksLikeId = typeof src === 'string' && !/^https?:\/\//.test(src);
                if (looksLikeId) {
                    try {
                        src = await videoDb.getStreamUrl(src);
                    } catch (e) {
                        addMessage('Agent finished but failed to resolve the video stream.', false);
                        return;
                    }
                }
                const safeSrc = escapeHtml(src);
                addAssistantMessage(`
                    <p class="text-sm text-white">${escapeHtml(json.message || `${label} finished.`)}</p>
                    <video controls class="mt-2 max-w-full rounded-lg" src="${safeSrc}">
                        Your browser does not support video playback.
                    </video>
                `);
            } else if (json.summary || json.script || json.text) {
                addMessage(escapeHtml(json.summary || json.script || json.text), false);
            } else {
                const fallback = (json.raw && json.raw.message) || (AGENT_META[agentId] && AGENT_META[agentId].success) || 'Done';
                addMessage(escapeHtml(String(fallback)), false);
            }
        } else {
            addMessage(escapeHtml(json && json.error ? String(json.error) : 'Agent failed'), false);
        }
    };

    /**
     * Free-text command: prefer the selected agent card, else infer from keywords.
     */
    const processCommand = async (command) => {
        if (!command.trim() || isProcessing) return;

        addMessage(command, true);
        commandInput.value = '';

        const selectedBtn = container.querySelector('.agent-btn.selected, .agent-btn.bg-primary\\/20');
        const selectedId = selectedBtn ? selectedBtn.dataset.agent : null;
        const agentId = selectedId || inferAgentId(command) || 'editor';

        await runAgent(agentId, command);
        addToHistory(command, [agentId]);
    };
    
    sendCommandBtn.onclick = handleSend;
    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
    });
    
    // Agent card buttons → dispatch to the matching backend agent.
    container.querySelectorAll('.agent-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.agent-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const agentId = btn.dataset.agent;
            runAgent(agentId, `Run ${DIRECTOR_AGENTS.find(a => a.id === agentId)?.name || agentId}`);
        };
    });

    // Quick action buttons → dispatch using the agentId from quickActions.
    const quickActionById = Object.fromEntries(quickActions.map(([, , id]) => [id, id]));
    container.querySelectorAll('.action-btn').forEach(btn => {
        btn.onclick = () => {
            const action = btn.dataset.action;
            const agentId = quickActionById[action] || inferAgentId(action) || 'editor';
            runAgent(agentId, action);
        };
    });

    // Starter prompts → send to chat when clicked.
    starterPrompts.forEach(prompt => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-colors cursor-pointer';
        chip.textContent = prompt;
        chip.onclick = () => {
            commandInput.value = prompt;
            processCommand(prompt);
        };
        chatMessages.appendChild(chip);
    });

    // Export buttons
    container.querySelectorAll('.export-btn').forEach(btn => {
        btn.onclick = () => {
            const format = btn.dataset.format;
            showToast(`Exporting as ${format.toUpperCase()}...`, 'info');
        };
    });
    
    return container;
}
