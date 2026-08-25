// ============================================================
// Cloudflare BYOC — Credential Setup Modal
// File: src/components/cloudflare/CredentialSetupModal.ts
// ============================================================

export interface CloudflareCredential {
  id: string;
  accountId: string;
  tokenScope: string[];
  accountEmail?: string;
  accountName?: string;
  isActive: boolean;
  isValid: boolean;
  lastValidatedAt?: string;
  lastValidationError?: string;
  lastRotatedAt: string;
  lastUsedAt?: string;
  totalDeployments: number;
  rotationStatus?: 'active' | 'expiring_soon' | 'expired';
  daysSinceRotation?: number;
}

export function CredentialSetupModal(options: {
  onClose: () => void;
  onSave: (credential: { accountId: string; apiToken: string }) => Promise<void>;
  existingCredential?: CloudflareCredential | null;
  getToken?: () => Promise<string | null>;
}): HTMLElement {
  const { onClose, onSave, existingCredential, getToken } = options;
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
  
  const container = document.createElement('div');
  container.className = 'bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl';
  
  container.innerHTML = `
    <div class="p-6 border-b border-white/10">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-white">
          ${existingCredential ? 'Update Cloudflare Credentials' : 'Connect Cloudflare Account'}
        </h2>
        <button class="close-btn text-gray-400 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <p class="text-gray-400 text-sm mt-2">
        Connect your Cloudflare account to deploy sites with your own infrastructure.
      </p>
    </div>
    
    <div class="p-6 space-y-4">
      ${existingCredential ? `
        <div class="bg-[#111] border border-white/5 rounded-xl p-4">
          <div class="flex items-center gap-3 mb-2">
            <span class="w-2 h-2 rounded-full ${existingCredential.isValid ? 'bg-green-400' : 'bg-red-400'}"></span>
            <span class="text-white text-sm font-medium">
              ${existingCredential.accountEmail || existingCredential.accountId}
            </span>
          </div>
          <div class="text-gray-400 text-xs space-y-1">
            <div>Account ID: ${existingCredential.accountId}</div>
            <div>Deployments: ${existingCredential.totalDeployments}</div>
            <div>Last used: ${existingCredential.lastUsedAt ? new Date(existingCredential.lastUsedAt).toLocaleDateString() : 'Never'}</div>
            ${existingCredential.rotationStatus === 'expiring_soon' ? 
              '<div class="text-yellow-400">⚠ Token rotation recommended</div>' : ''}
            ${existingCredential.rotationStatus === 'expired' ? 
              '<div class="text-red-400">✗ Token expired - please rotate</div>' : ''}
          </div>
        </div>
      ` : ''}
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Cloudflare Account ID</label>
          <input 
            type="text" 
            id="cf-account-id"
            placeholder="Enter your Cloudflare Account ID"
            value="${existingCredential?.accountId || ''}"
            class="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
          <p class="text-gray-500 text-xs mt-1">Found in the right sidebar of any Cloudflare dashboard page</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">API Token</label>
          <input 
            type="password" 
            id="cf-api-token"
            placeholder="Enter your Cloudflare API Token"
            class="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
          <p class="text-gray-500 text-xs mt-1">
            Create at dash.cloudflare.com/profile/api-tokens with "Cloudflare Pages: Edit" permission
          </p>
        </div>
        
        <div id="validation-status" class="hidden"></div>
      </div>
    </div>
    
    <div class="p-6 border-t border-white/10 flex items-center justify-between">
      <button id="test-connection" class="text-gray-400 hover:text-white text-sm transition-colors">
        Test Connection
      </button>
      <div class="flex items-center gap-3">
        <button class="cancel-btn px-4 py-2 text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button id="save-credentials" class="bg-cyan-400 hover:bg-cyan-300 text-black font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          ${existingCredential ? 'Update' : 'Connect'}
        </button>
      </div>
    </div>
  `;
  
  modal.appendChild(container);
  
  // Event handlers
  const closeBtn = container.querySelector('.close-btn');
  const cancelBtn = container.querySelector('.cancel-btn');
  const saveBtn = container.querySelector('#save-credentials') as HTMLButtonElement;
  const testBtn = container.querySelector('#test-connection') as HTMLButtonElement;
  const accountIdInput = container.querySelector('#cf-account-id') as HTMLInputElement;
  const apiTokenInput = container.querySelector('#cf-api-token') as HTMLInputElement;
  const statusDiv = container.querySelector('#validation-status') as HTMLElement;
  
  const close = () => modal.remove();
  
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  
  testBtn?.addEventListener('click', async () => {
    const accountId = accountIdInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    
    if (!accountId || !apiToken) {
      statusDiv.className = 'bg-red-900/20 border border-red-400/30 rounded-lg p-3';
      statusDiv.innerHTML = '<span class="text-red-400 text-sm">Please enter both Account ID and API Token</span>';
      statusDiv.classList.remove('hidden');
      return;
    }
    
    testBtn.textContent = 'Testing...';
    testBtn.classList.add('opacity-50');
    
    try {
      // Get Clerk token for authenticated API call
      const token = getToken ? await getToken() : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/cloudflare/validate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId, apiToken })
      });
      
      if (res.status === 401) {
        statusDiv.className = 'bg-red-900/20 border border-red-400/30 rounded-lg p-3';
        statusDiv.innerHTML = '<span class="text-red-400 text-sm">✗ Authentication required - please sign in</span>';
        statusDiv.classList.remove('hidden');
        testBtn.textContent = 'Test Connection';
        testBtn.classList.remove('opacity-50');
        return;
      }

      const result = await res.json();
      
      if (result.valid) {
        statusDiv.className = 'bg-green-900/20 border border-green-400/30 rounded-lg p-3';
        statusDiv.innerHTML = `<span class="text-green-400 text-sm">✓ Connected successfully${result.email ? ` (${result.email})` : ''}</span>`;
      } else {
        statusDiv.className = 'bg-red-900/20 border border-red-400/30 rounded-lg p-3';
        statusDiv.innerHTML = `<span class="text-red-400 text-sm">✗ ${result.error || 'Validation failed'}</span>`;
      }
    } catch {
      statusDiv.className = 'bg-red-900/20 border border-red-400/30 rounded-lg p-3';
      statusDiv.innerHTML = '<span class="text-red-400 text-sm">✗ Network error</span>';
    }
    
    statusDiv.classList.remove('hidden');
    testBtn.textContent = 'Test Connection';
    testBtn.classList.remove('opacity-50');
  });
  
  saveBtn?.addEventListener('click', async () => {
    const accountId = accountIdInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    
    if (!accountId || !apiToken) {
      statusDiv.className = 'bg-red-900/20 border border-red-400/30 rounded-lg p-3';
      statusDiv.innerHTML = '<span class="text-red-400 text-sm">Please enter both Account ID and API Token</span>';
      statusDiv.classList.remove('hidden');
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      await onSave({ accountId, apiToken });
      close();
    } catch (error) {
      statusDiv.className = 'bg-red-900/20 border border-red-400/30 rounded-lg p-3';
      statusDiv.innerHTML = `<span class="text-red-400 text-sm">✗ ${error instanceof Error ? error.message : 'Failed to save'}</span>`;
      statusDiv.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.textContent = existingCredential ? 'Update' : 'Connect';
    }
  });
  
  return modal;
}

export default CredentialSetupModal;
