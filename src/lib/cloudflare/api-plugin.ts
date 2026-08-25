// ============================================================
// Cloudflare BYOC — API Routes Plugin
// File: src/lib/cloudflare/api-plugin.ts
// Purpose: Vite plugin that adds Cloudflare BYOC API endpoints
// ============================================================

import type { Plugin, ViteDevServer } from 'vite';
import { getCredentialService } from './credential-service';
import { getDeploymentService } from './deployment-service';
import { getEncryptionService } from './encryption';
import { verifyToken } from '@clerk/express';

// ============================================================
// Types
// ============================================================

interface ApiRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

interface ApiResponse {
  status: number;
  body: any;
}

type ApiHandler = (req: ApiRequest, userId: string) => Promise<ApiResponse>;

// ============================================================
// Rate Limiting (in-memory for dev, use Redis in production)
// ============================================================

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const timestamps = this.requests.get(key) || [];
    const recentTimestamps = timestamps.filter(t => t > windowStart);
    
    if (recentTimestamps.length >= this.maxRequests) {
      return false;
    }
    
    recentTimestamps.push(now);
    this.requests.set(key, recentTimestamps);
    return true;
  }
}

const credentialRateLimiter = new RateLimiter(5, 60000); // 5 per minute
const deploymentRateLimiter = new RateLimiter(10, 60000); // 10 per minute

// ============================================================
// API Handlers
// ============================================================

const validateCredential: ApiHandler = async (req, userId) => {
  const { accountId, apiToken } = req.body || {};
  
  if (!accountId || !apiToken) {
    return { status: 400, body: { error: 'Account ID and API Token are required' } };
  }

  const credentialService = getCredentialService();
  const result = await credentialService.validateToken(accountId, apiToken);

  return { status: result.valid ? 200 : 401, body: result };
};

const storeCredential: ApiHandler = async (req, userId) => {
  const { accountId, apiToken, accountEmail, accountName, scopes } = req.body || {};
  
  if (!accountId || !apiToken) {
    return { status: 400, body: { error: 'Account ID and API Token are required' } };
  }

  try {
    const credentialService = getCredentialService();
    const result = await credentialService.storeCredentials(
      userId,
      accountId,
      apiToken,
      accountEmail,
      accountName,
      scopes
    );

    return { status: 200, body: { id: result.id, message: 'Credentials stored successfully' } };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Failed to store credentials' }
    };
  }
};

const getCredentialStatus: ApiHandler = async (_req, userId) => {
  try {
    const credentialService = getCredentialService();
    const status = await credentialService.getCredentialStatus(userId);

    if (!status) {
      return { status: 404, body: { error: 'No credentials found' } };
    }

    return { status: 200, body: status };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Failed to get credential status' }
    };
  }
};

const deleteCredential: ApiHandler = async (req, userId) => {
  const { credentialId } = req.body || {};
  
  if (!credentialId) {
    return { status: 400, body: { error: 'Credential ID is required' } };
  }

  try {
    const credentialService = getCredentialService();
    await credentialService.deactivateCredentials(userId, credentialId);

    return { status: 200, body: { message: 'Credentials deactivated successfully' } };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Failed to deactivate credentials' }
    };
  }
};

const deployProject: ApiHandler = async (req, userId) => {
  const { projectName, files, domain, isCustomDomain } = req.body || {};
  
  if (!projectName || !files) {
    return { status: 400, body: { error: 'Project name and files are required' } };
  }

  try {
    const deploymentService = getDeploymentService();
    const result = await deploymentService.deploy({
      userId,
      projectName,
      files,
      domain,
      isCustomDomain
    });

    return { status: result.success ? 200 : 400, body: result };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Deployment failed' }
    };
  }
};

const getDeploymentHistory: ApiHandler = async (req, userId) => {
  const url = new URL(req.url, 'http://localhost');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    const deploymentService = getDeploymentService();
    const history = await deploymentService.getDeploymentHistory(userId, limit);

    return { status: 200, body: history };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Failed to get deployment history' }
    };
  }
};

const rollbackDeployment: ApiHandler = async (req, userId) => {
  const { deploymentId } = req.body || {};
  
  if (!deploymentId) {
    return { status: 400, body: { error: 'Deployment ID is required' } };
  }

  try {
    const deploymentService = getDeploymentService();
    const result = await deploymentService.rollback(userId, deploymentId);

    return { status: result.success ? 200 : 400, body: result };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Rollback failed' }
    };
  }
};

// ============================================================
// Route Definitions
// ============================================================

const routes: Record<string, Record<string, ApiHandler>> = {
  '/api/cloudflare': {
    'POST /validate': validateCredential,
    'POST /credentials': storeCredential,
    'GET /credentials': getCredentialStatus,
    'DELETE /credentials': deleteCredential,
    'POST /deploy': deployProject,
    'GET /deployments': getDeploymentHistory,
    'POST /rollback': rollbackDeployment
  }
};

// ============================================================
// Vite Plugin
// ============================================================

export function cloudflareApiPlugin(): Plugin {
  return {
    name: 'cloudflare-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        
        // Check if this is a Cloudflare API request
        if (!url.startsWith('/api/cloudflare')) {
          return next();
        }

        // Extract and verify Clerk JWT token
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        
        let userId: string;
        try {
          // Verify the Clerk token using the same Clerk instance as the parent app
          const verified = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
          });
          userId = verified.sub; // Clerk user ID
        } catch (error) {
          // Token verification failed
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unauthorized - invalid or expired token' }));
          return;
        }
        
        // Find matching route
        let handler: ApiHandler | null = null;
        let rateLimitKey = '';

        for (const [prefix, methods] of Object.entries(routes)) {
          if (url.startsWith(prefix)) {
            const path = url.slice(prefix.length);
            const method = (req.method || 'GET').toUpperCase();
            
            for (const [pattern, h] of Object.entries(methods)) {
              const [patternMethod, patternPath] = pattern.split(' ');
              if (patternMethod === method && path.startsWith(patternPath)) {
                handler = h;
                rateLimitKey = `${prefix}${patternPath}`;
                break;
              }
            }
            break;
          }
        }

        if (!handler) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        // Apply rate limiting
        const limiter = rateLimitKey.includes('/validate') || rateLimitKey.includes('/credentials')
          ? credentialRateLimiter
          : deploymentRateLimiter;
        
        if (!limiter.isAllowed(`${userId}:${rateLimitKey}`)) {
          res.statusCode = 429;
          res.end(JSON.stringify({ error: 'Too many requests' }));
          return;
        }

        // Parse body
        let body: any = undefined;
        if (req.method !== 'GET' && req.method !== 'DELETE') {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(chunk as Buffer);
            }
            const bodyStr = Buffer.concat(chunks).toString('utf8');
            if (bodyStr) {
              body = JSON.parse(bodyStr);
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Call handler
        try {
          const result = await handler(
            {
              url: url,
              method: req.method || 'GET',
              headers: req.headers as Record<string, string>,
              body
            },
            userId
          );

          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    }
  };
}

export default cloudflareApiPlugin;
