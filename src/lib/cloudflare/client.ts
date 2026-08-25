// ============================================================
// Cloudflare BYOC — Frontend API Client
// File: src/lib/cloudflare/client.ts
// Purpose: Authenticated API calls to Cloudflare BYOC endpoints
// ============================================================

import { useAuth } from '@clerk/react';

const API_BASE = '/api/cloudflare';

// Hook for making authenticated Cloudflare API calls
export function useCloudflareApi() {
  const { getToken } = useAuth();

  async function apiCall<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const token = await getToken();
    
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `API error: ${res.status}`);
    }

    return res.json();
  }

  return {
    // Validate Cloudflare credentials
    validate: (accountId: string, apiToken: string) =>
      apiCall('/validate', {
        method: 'POST',
        body: { accountId, apiToken },
      }),

    // Store encrypted credentials
    storeCredentials: (accountId: string, apiToken: string, accountEmail?: string) =>
      apiCall('/credentials', {
        method: 'POST',
        body: { accountId, apiToken, accountEmail },
      }),

    // Get credential status
    getCredentialStatus: () =>
      apiCall('/credentials'),

    // Deactivate credentials
    deleteCredentials: (credentialId: string) =>
      apiCall('/credentials', {
        method: 'DELETE',
        body: { credentialId },
      }),

    // Deploy to Cloudflare
    deploy: (projectName: string, files: Record<string, string>, domain?: string) =>
      apiCall('/deploy', {
        method: 'POST',
        body: { projectName, files, domain },
      }),

    // Get deployment history
    getDeployments: (limit?: number) =>
      apiCall(`/deployments${limit ? `?limit=${limit}` : ''}`),

    // Rollback deployment
    rollback: (deploymentId: string) =>
      apiCall('/rollback', {
        method: 'POST',
        body: { deploymentId },
      }),
  };
}

export default useCloudflareApi;
