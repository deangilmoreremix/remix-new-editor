// ============================================================
// Cloudflare BYOC — Dashboard Component
// File: src/components/cloudflare/CloudflareDashboard.ts
// Purpose: Main dashboard for managing Cloudflare credentials and deployments
// ============================================================

import { useAuth } from '@clerk/react';

export function CloudflareDashboard(options: {
  onMount?: (container: HTMLElement) => void;
}): HTMLElement {
  const { onMount } = options;
  const { getToken } = useAuth();

  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-[#020205] text-white overflow-hidden';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between px-6 py-4 border-b border-white/10';
  header.innerHTML = `
    <div>
      <h1 class="text-xl font-semibold text-white">Cloudflare BYOC</h1>
      <p class="text-gray-400 text-sm">Manage your Cloudflare credentials and deployments</p>
    </div>
    <button id="setup-credentials" class="bg-cyan-400 hover:bg-cyan-300 text-black font-medium px-4 py-2 rounded-lg transition-colors">
      Connect Cloudflare
    </button>
  `;
  container.appendChild(header);

  // Content area
  const content = document.createElement('div');
  content.className = 'flex-1 overflow-y-auto p-6';
  content.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-[#0a0d16] border border-white/10 rounded-2xl p-6">
        <h2 class="text-lg font-medium text-white mb-4">Credential Status</h2>
        <div id="credential-status" class="text-gray-400">
          <div class="animate-pulse">Loading...</div>
        </div>
      </div>
      <div class="bg-[#0a0d16] border border-white/10 rounded-2xl p-6">
        <h2 class="text-lg font-medium text-white mb-4">Quick Actions</h2>
        <div class="space-y-3">
          <button id="deploy-site" class="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50" disabled>
            <div class="text-white font-medium">Deploy New Site</div>
            <div class="text-gray-400 text-sm">Deploy a new site to Cloudflare Pages</div>
          </button>
          <button id="manage-domains" class="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50" disabled>
            <div class="text-white font-medium">Manage Domains</div>
            <div class="text-gray-400 text-sm">Add or remove custom domains</div>
          </button>
        </div>
      </div>
    </div>
    <div class="mt-6 bg-[#0a0d16] border border-white/10 rounded-2xl p-6">
      <h2 class="text-lg font-medium text-white mb-4">Deployment History</h2>
      <div id="deployment-history" class="text-gray-400">
        <div class="animate-pulse">Loading...</div>
      </div>
    </div>
  `;
  container.appendChild(content);

  // Event handlers
  const setupBtn = header.querySelector('#setup-credentials');
  setupBtn?.addEventListener('click', async () => {
    // Dynamically import the modal to avoid circular dependencies
    const { CredentialSetupModal } = await import('./CredentialSetupModal');
    const modal = CredentialSetupModal({
      onClose: () => modal.remove(),
      onSave: async (credential) => {
        const token = await getToken();
        const res = await fetch('/api/cloudflare/credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(credential),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Failed to save' }));
          throw new Error(error.error);
        }
        loadCredentialStatus();
      },
      getToken,
    });
    document.body.appendChild(modal);
  });

  // Load credential status on mount
  async function loadCredentialStatus() {
    const statusDiv = content.querySelector('#credential-status');
    if (!statusDiv) return;

    try {
      const token = await getToken();
      const res = await fetch('/api/cloudflare/credentials', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 404) {
        statusDiv.innerHTML = `
          <div class="text-center py-4">
            <div class="text-gray-500 mb-2">No credentials connected</div>
            <button id="connect-now" class="text-cyan-400 hover:text-cyan-300 text-sm">Connect your Cloudflare account →</button>
          </div>
        `;
        statusDiv.querySelector('#connect-now')?.addEventListener('click', () => setupBtn?.click());
        return;
      }

      if (!res.ok) throw new Error('Failed to load');

      const credential = await res.json();
      statusDiv.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${credential.isValid ? 'bg-green-400' : 'bg-red-400'}"></span>
            <span class="text-white">${credential.accountEmail || credential.accountId}</span>
          </div>
          <div class="text-gray-400 text-sm space-y-1">
            <div>Account ID: ${credential.accountId}</div>
            <div>Deployments: ${credential.totalDeployments}</div>
            <div>Last used: ${credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleDateString() : 'Never'}</div>
            ${credential.rotationStatus === 'expiring_soon' ? 
              '<div class="text-yellow-400">⚠ Token rotation recommended</div>' : ''}
            ${credential.rotationStatus === 'expired' ? 
              '<div class="text-red-400">✗ Token expired - please rotate</div>' : ''}
          </div>
        </div>
      `;
    } catch (error) {
      statusDiv.innerHTML = `<div class="text-red-400 text-sm">Failed to load credential status</div>`;
    }
  }

  // Load deployment history
  async function loadDeploymentHistory() {
    const historyDiv = content.querySelector('#deployment-history');
    if (!historyDiv) return;

    try {
      const token = await getToken();
      const res = await fetch('/api/cloudflare/deployments?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load');

      const deployments = await res.json();

      if (deployments.length === 0) {
        historyDiv.innerHTML = '<div class="text-gray-500">No deployments yet</div>';
        return;
      }

      historyDiv.innerHTML = `
        <div class="space-y-2">
          ${deployments.map((d: any) => `
            <div class="flex items-center justify-between px-4 py-3 bg-white/5 rounded-lg">
              <div>
                <div class="text-white text-sm">${d.project_name}</div>
                <div class="text-gray-400 text-xs">${new Date(d.created_at).toLocaleDateString()}</div>
              </div>
              <span class="text-xs px-2 py-1 rounded-full ${d.status === 'live' ? 'bg-green-400/10 text-green-300' : d.status === 'failed' ? 'bg-red-400/10 text-red-300' : 'bg-yellow-400/10 text-yellow-300'}">
                ${d.status}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      historyDiv.innerHTML = `<div class="text-red-400 text-sm">Failed to load deployment history</div>`;
    }
  }

  // Initial load
  loadCredentialStatus();
  loadDeploymentHistory();

  onMount?.(container);

  return container;
}

export default CloudflareDashboard;
