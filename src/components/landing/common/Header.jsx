// Landing Page Header - Cinematic Command Center style
import { navigate } from "../../../lib/router.js";

export function LandingHeader() {
  const header = document.createElement('header');
  header.className = 'sticky top-0 z-50 w-full h-16 backdrop-blur-md bg-[#0a0b0f] border-b border-white/10';
  header.setAttribute('data-testid', 'landing-header');
  
  // Navigation links mapping
  const navItems = [
    { label: 'Explore', href: '/explore' },
    { label: 'Image', href: '/image' },
    { label: 'Video', href: '/video' },
    { label: 'Audio', href: '/audio' },
    { label: 'Collab', href: '/generate' },
    { label: 'Canvas', href: '/canvas', isNew: true },
    { label: 'Edit', href: '/edit' },
    { label: 'Character', href: '/character' },
    { label: 'Marketing Studio', href: '/marketing-studio' },
    { label: 'Cinema Studio', href: '/cinema-studio' },
    { label: 'Originals', href: '/original-series' },
    { label: 'MCP', href: '/mcp', isNew: true },
    { label: 'Apps', href: '/apps' },
    { label: 'Assist', href: '/chat' },
    { label: 'Community', href: '/community' },
  ];

  const navLinks = navItems.map(item => `
    <a href="${item.href}" 
       class="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm"
       ${item.isNew ? 'data-new="true"' : ''}>
      ${item.label}${item.isNew ? '<span class="ml-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-cyan-400/20 text-cyan-400 px-1.5 py-0.5">New</span>' : ''}
    </a>
  `).join('');

  header.innerHTML = `
    <nav class="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[auto_1fr_auto] pr-4 h-full items-center relative container">
      <!-- Logo -->
      <a href="/" class="shrink-0 flex items-center gap-2 mr-2 transition hover:text-[#22d3ee] active:opacity-60">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10" style="box-shadow: 0 0 16px rgba(56,189,248,0.12);">
          <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
            <rect width="80" height="80" rx="16" fill="#22d3ee"/>
            <path d="M32 22 L58 40 L32 58 Z" fill="#020205"/>
          </svg>
        </div>
        <span class="hidden md:block text-lg font-bold text-white">Timeline Editor</span>
      </a>
      
      <!-- Navigation -->
      <div id="header__menu_list" class="hidden md:grid grid-flow-col-dense items-center auto-cols-min overflow-x-auto hide-scrollbar gap-1">
        ${navLinks}
      </div>
      
      <!-- Right actions -->
      <div class="shrink-0 flex items-center gap-3">
        <a href="/signin" class="px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium">Sign In</a>
        <a href="/signup" class="px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium" style="letter-spacing: 0.05em; text-transform: uppercase;">Get Started</a>
      </div>
    </nav>
  `;

  return header;
}
