// ============================================================
// Cloudflare BYOC — Deployment Panel
// File: src/components/cloudflare/DeploymentPanel.ts
// ============================================================

export interface DeploymentRecord {
  id: string;
  projectName: string;
  domain?: string;
  isCustomDomain: boolean;
  status: 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'rolled_back';
  url?: string;
  errorMessage?: string;
  errorCode?: string;
  deployedAt?: string;
  createdAt: string;
  completedAt?: string;
}

export function DeploymentPanel(options: {
  onDeploy: (projectName: string, files: Record<string, string>) => Promise<void>;
  onRollback: (deploymentId: string) => Promise<void>;
  onRefresh: () => void;
  deployments: DeploymentRecord[];
  isLoading?: boolean;
}): HTMLElement {
  const { onDeploy, onRollback, onRefresh, deployments, isLoading } = options;
  
  const panel = document.createElement('div');
  panel.className = 'bg-[#0a0d16] border border-white/10 rounded-2xl overflow-hidden';
  
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-400',
    building: 'bg-yellow-400',
    deploying: 'bg-blue-400',
    live: 'bg-green-400',
    failed: 'bg-red-400',
    rolled_back: 'bg-gray-400'
  };
  
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    building: 'Building',
    deploying: 'Deploying',
    live: 'Live',
    failed: 'Failed',
    rolled_back: 'Rolled Back'
  };
  
  function formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }
  
  function renderDeployments(): string {
    if (isLoading) {
      return `
        <div class="p-8 text-center">
          <div class="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto"></div>
          <p class="text-gray-400 text-sm mt-4">Loading deployments...</p>
        </div>
      `;
    }
    
    if (deployments.length === 0) {
      return `
        <div class="p-8 text-center">
          <div class="text-gray-500 text-4xl mb-3">🚀</div>
          <p class="text-gray-400 text-sm">No deployments yet</p>
          <p class="text-gray-500 text-xs mt-1">Connect your Cloudflare account to start deploying</p>
        </div>
      `;
    }
    
    return `
      <div class="divide-y divide-white/5">
        ${deployments.map(deployment => `
          <div class="p-4 hover:bg-white/[0.02] transition-colors">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full ${statusColors[deployment.status]}"></span>
                  <span class="text-white text-sm font-medium truncate">${deployment.projectName}</span>
                  ${deployment.isCustomDomain ? 
                    '<span class="text-[10px] bg-cyan-400/10 text-cyan-400 px-1.5 py-0.5 rounded">Custom Domain</span>' : ''}
                </div>
                <div class="text-gray-400 text-xs space-y-0.5">
                  ${deployment.domain ? `<div>Domain: ${deployment.domain}</div>` : ''}
                  <div>Status: ${statusLabels[deployment.status]}</div>
                  <div>Created: ${formatDate(deployment.createdAt)}</div>
                  ${deployment.deployedAt ? `<div>Deployed: ${formatDate(deployment.deployedAt)}</div>` : ''}
                  ${deployment.errorMessage ? `<div class="text-red-400">Error: ${deployment.errorMessage}</div>` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                ${deployment.url ? `
                  <a href="${deployment.url}" target="_blank" rel="noopener noreferrer"
                     class="text-cyan-400 hover:text-cyan-300 text-xs transition-colors">
                    Visit ↗
                  </a>
                ` : ''}
                ${deployment.status === 'live' ? `
                  <button class="rollback-btn text-gray-400 hover:text-white text-xs transition-colors"
                          data-id="${deployment.id}">
                    Rollback
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  panel.innerHTML = `
    <div class="p-4 border-b border-white/10 flex items-center justify-between">
      <div>
        <h3 class="text-white font-medium">Deployment History</h3>
        <p class="text-gray-500 text-xs mt-0.5">Track your Cloudflare Pages deployments</p>
      </div>
      <button class="refresh-btn text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>
    <div class="deployments-list max-h-96 overflow-y-auto">
      ${renderDeployments()}
    </div>
  `;
  
  // Event handlers
  const refreshBtn = panel.querySelector('.refresh-btn');
  refreshBtn?.addEventListener('click', onRefresh);
  
  const rollbackBtns = panel.querySelectorAll('.rollback-btn');
  rollbackBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const deploymentId = (btn as HTMLElement).dataset.id;
      if (deploymentId) {
        if (confirm('Are you sure you want to roll back to this deployment?')) {
          await onRollback(deploymentId);
        }
      }
    });
  });
  
  return panel;
}

export default DeploymentPanel;
