// ============================================================
// Cloudflare BYOC — API Client
// File: src/lib/cloudflare/api-client.ts
// Security: Server-side only, never expose to client
// ============================================================

// ============================================================
// Constants
// ============================================================

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RATE_LIMIT_REQUESTS = 1200;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// Types
// ============================================================

export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export interface ValidationResult {
  valid: boolean;
  email?: string;
  scopes?: string[];
  accountId?: string;
  error?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  error?: string;
  errorCode?: string;
}

export interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  created_on: string;
  source: {
    type: string;
    config: Record<string, unknown>;
  };
}

export interface CloudflareError extends Error {
  code?: string;
  status?: number;
}

// ============================================================
// Rate Limiter (Token Bucket)
// ============================================================

class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = RATE_LIMIT_REQUESTS,
    private refillIntervalMs: number = RATE_LIMIT_WINDOW_MS
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.refillIntervalMs) * this.maxTokens);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Calculate wait time until next token
    const waitTime = Math.ceil(this.refillIntervalMs / this.maxTokens);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return this.acquire();
  }
}

// ============================================================
// Cloudflare API Client
// ============================================================

class CloudflareAPI {
  private baseUrl = CLOUDFLARE_API_BASE;
  private rateLimiter: RateLimiter;

  constructor(private creds: CloudflareCredentials) {
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Make an authenticated request to Cloudflare API with rate limiting and retries.
   */
  private async request<T>(
    path: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    // Acquire rate limit token
    await this.rateLimiter.acquire();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.creds.apiToken}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      // Handle rate limiting (429)
      if (res.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(path, options, retryCount + 1);
      }

      // Handle server errors (5xx) with exponential backoff
      if (res.status >= 500 && retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(path, options, retryCount + 1);
      }

      const data = await res.json();

      if (!data.success) {
        const error: CloudflareError = new Error(
          data.errors?.[0]?.message || 'Cloudflare API request failed'
        );
        error.code = data.errors?.[0]?.code?.toString();
        error.status = res.status;
        throw error;
      }

      return data.result as T;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      // Network error
      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(path, options, retryCount + 1);
      }
      throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate token with Cloudflare API.
   * Returns validation result with scopes and account info.
   */
  async validateToken(): Promise<ValidationResult> {
    try {
      const data = await this.request<{
        id: string;
        status: string;
        name?: string;
      }>('/user/tokens/verify');

      return {
        valid: true,
        accountId: data.id
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Get account information.
   */
  async getAccountInfo(): Promise<{ id: string; name: string; status: string }> {
    return this.request<{ id: string; name: string; status: string }>(
      `/accounts/${this.creds.accountId}`
    );
  }

  /**
   * List all Pages projects in the account.
   */
  async listPagesProjects(): Promise<PagesProject[]> {
    const data = await this.request<{ items: PagesProject[] }>(
      `/accounts/${this.creds.accountId}/pages/projects`
    );
    return data ? [].concat(data) : [];
  }

  /**
   * Create a new Pages project.
   */
  async createPagesProject(name: string): Promise<{ id: string; url: string }> {
    const data = await this.request<{ id: string; subdomain: string }>(
      `/accounts/${this.creds.accountId}/pages/projects`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          production_branch: 'main'
        })
      }
    );

    return {
      id: data.id,
      url: data.subdomain
    };
  }

  /**
   * Deploy files to a Pages project.
   */
  async deploy(
    projectName: string,
    files: Record<string, string>
  ): Promise<DeploymentResult> {
    try {
      // Cloudflare Pages deployment API expects a multipart upload
      const formData = new FormData();
      
      for (const [filename, content] of Object.entries(files)) {
        const blob = new Blob([content], { type: 'text/plain' });
        formData.append(filename, blob, filename);
      }

      // Acquire rate limit token
      await this.rateLimiter.acquire();

      const res = await fetch(
        `${this.baseUrl}/accounts/${this.creds.accountId}/pages/projects/${projectName}/deployments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.creds.apiToken}`
          },
          body: formData
        }
      );

      const data = await res.json();

      if (!data.success) {
        return {
          success: false,
          error: data.errors?.[0]?.message || 'Deployment failed',
          errorCode: data.errors?.[0]?.code?.toString()
        };
      }

      return {
        success: true,
        deploymentId: data.result.id,
        url: data.result.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * List custom domains available in the account.
   */
  async listDomains(): Promise<string[]> {
    const projects = await this.listPagesProjects();
    const domains: string[] = [];
    
    for (const project of projects) {
      for (const domain of project.domains || []) {
        if (!domain.endsWith('.pages.dev')) {
          domains.push(domain);
        }
      }
    }

    return [...new Set(domains)];
  }

  /**
   * Add a custom domain to a Pages project.
   */
  async addCustomDomain(projectName: string, domain: string): Promise<void> {
    await this.request(
      `/accounts/${this.creds.accountId}/pages/projects/${projectName}/domains`,
      {
        method: 'POST',
        body: JSON.stringify({ name: domain })
      }
    );
  }

  /**
   * Delete a Pages project.
   */
  async deletePagesProject(projectName: string): Promise<void> {
    await this.request(
      `/accounts/${this.creds.accountId}/pages/projects/${projectName}`,
      { method: 'DELETE' }
    );
  }
}

// ============================================================
// Exports
// ============================================================

export { CloudflareAPI, RateLimiter };
export default CloudflareAPI;
