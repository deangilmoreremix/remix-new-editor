import { apiKeyManager } from '../lib/apiKeyManager.js';
import { muapi } from '../lib/muapi.js';
import { createNotificationsBell } from '../lib/notificationsBell.js';
import { supabase, primeSupabaseIdentity } from '../lib/supabase.js';

// App top bar: logo, credit balance, API key and account.
// Studio navigation lives only in the left side menu (src/components/Sidebar.js),
// so the top bar deliberately has no menu of its own.
export function Header(navigate) {
  const header = document.createElement('header');
  header.className = 'w-full flex flex-col z-50 sticky top-0';

  const navBar = document.createElement('div');
  // On phones the side menu's fixed hamburger sits at the top-left, so leave room for it.
  navBar.className = 'w-full h-14 bg-app-bg flex items-center justify-between pl-16 pr-4 md:px-6 border-b border-white/5 backdrop-blur-md';

  const leftPart = document.createElement('div');
  leftPart.className = 'flex items-center gap-6';

  const logoContainer = document.createElement('div');
  logoContainer.className = 'cursor-pointer hover:scale-110 transition-transform';
  logoContainer.innerHTML = `
    <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-lg">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="black"/>
        <path d="M2 17L12 22L22 17" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
  logoContainer.onclick = () => navigate('apps');
  logoContainer.setAttribute('role', 'link');
  logoContainer.setAttribute('aria-label', 'All apps');

  leftPart.appendChild(logoContainer);

  const rightPart = document.createElement('div');
  rightPart.className = 'flex items-center gap-3';

  const keyBtn = document.createElement('button');
  keyBtn.className = 'p-2 text-secondary hover:text-white transition-colors';
  keyBtn.title = 'Update API Key';
  keyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.25-2.25"/></svg>';
  keyBtn.onclick = () => {
    apiKeyManager.clearMuapiKey();
    window.location.reload();
  };

  // MuAPI credit balance, refreshed after each generation and when the tab
  // regains focus. Hidden until a balance has been read.
  const balanceChip = document.createElement('span');
  balanceChip.className = 'hidden px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-secondary whitespace-nowrap';
  balanceChip.title = 'MuAPI credit balance';
  const refreshBalance = async () => {
    try {
      const balance = await muapi.getBalance();
      if (balance === null) { balanceChip.classList.add('hidden'); return; }
      balanceChip.textContent = `$${balance.toFixed(2)}`;
      balanceChip.classList.remove('hidden');
    } catch {
      balanceChip.classList.add('hidden');
    }
  };
  let lastBalanceCheck = 0;
  const refreshBalanceOnFocus = () => {
    if (Date.now() - lastBalanceCheck < 30000) return;
    lastBalanceCheck = Date.now();
    refreshBalance();
  };
  refreshBalanceOnFocus();
  window.addEventListener('muapi:job-finished', refreshBalance);
  window.addEventListener('focus', refreshBalanceOnFocus);

  // Unread video alerts (owner-only; hidden when signed out).
  const bell = createNotificationsBell({
    navigate,
    getClient: async () => { await primeSupabaseIdentity(); return supabase; },
  });
  rightPart.appendChild(bell.element);
  rightPart.appendChild(balanceChip);
  rightPart.appendChild(keyBtn);

  const headerAuthSlot = document.createElement('div');
  headerAuthSlot.className = 'flex items-center';
  rightPart.appendChild(headerAuthSlot);

  navBar.appendChild(leftPart);
  navBar.appendChild(rightPart);
  header.appendChild(navBar);

  return { header, headerAuthSlot };
}
