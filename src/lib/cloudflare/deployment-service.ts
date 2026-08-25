// ============================================================
// Cloudflare BYOC — Deployment Service
// File: src/lib/cloudflare/deployment-service.ts
// Purpose: Full deployment lifecycle with history tracking
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CloudflareAPI } from './api-client';
import { getCredentialService } from './credential-service';

// ============================================================
// Types
// ============================================================

export interface DeploymentRequest {
  userId: string;
  projectName: string;
  files: Record<string, string>;
  domain?: string;
  isCustomDomain?: boolean;
}

export interface DeploymentRecord {
  id: string;
  userId: string;
  credentialId?: string;
  projectName: string;
  domain?: string;
  isCustomDomain: boolean;
  status: 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'rolled_back';
  cloudflareDeploymentId?: string;
  artifactUrl?: string;
  errorMessage?: string;
  errorCode?: string;
  rolledBackFrom?: string;
  deployedAt?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  error?: string;
  errorCode?: string;
}

// ============================================================
// Deployment Service
// ============================================================

class DeploymentService {
  private supabase: SupabaseClient;
  private credentialService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.credentialService = getCredentialService();
  }

  /**
   * Acquire a deployment lock to prevent concurrent deployments.
   */
  private async acquireLock(userId: string, projectName: string, requestId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('deployment_locks')
        .upsert({
          user_id: userId,
          project_name: projectName,
          locked_by: requestId,
          locked_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,project_name',
          ignoreDuplicates: false
        });

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Release a deployment lock.
   */
  private async releaseLock(userId: string, projectName: string): Promise<void> {
    await this.supabase
      .from('deployment_locks')
      .delete()
      .eq('user_id', userId)
      .eq('project_name', projectName);
  }

  /**
   * Validate deployment request before proceeding.
   */
  private validateRequest(request: DeploymentRequest): string | null {
    if (!request.userId) return 'User ID is required';
    if (!request.projectName) return 'Project name is required';
    if (!request.files || Object.keys(request.files).length === 0) return 'No files provided';
    
    // Check file count limit (Cloudflare Pages: 20,000 files)
    if (Object.keys(request.files).length > 20000) {
      return 'Too many files (max 20,000)';
    }

    // Check file size limit (Cloudflare Pages: 25MB per file)
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    for (const [filename, content] of Object.entries(request.files)) {
      if (content.length > MAX_FILE_SIZE) {
        return `File ${filename} exceeds 25MB limit`;
      }
    }

    // Validate project name format
    const nameRegex = /^[a-zA-Z0-9-]+$/;
    if (!nameRegex.test(request.projectName)) {
      return 'Project name must contain only letters, numbers, and hyphens';
    }

    return null;
  }

  /**
   * Create a deployment history record.
   */
  private async createHistoryRecord(
    userId: string,
    credentialId: string | undefined,
    request: DeploymentRequest
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('deployment_history')
      .insert({
        user_id: userId,
        credential_id: credentialId,
        project_name: request.projectName,
        domain: request.domain,
        is_custom_domain: request.isCustomDomain || false,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create deployment record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update deployment status.
   */
  private async updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentRecord['status'],
    updates: Partial<DeploymentRecord> = {}
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      ...updates
    };

    if (status === 'live' || status === 'failed' || status === 'rolled_back') {
      updateData.completed_at = new Date().toISOString();
    }

    await this.supabase
      .from('deployment_history')
      .update(updateData)
      .eq('id', deploymentId);
  }

  /**
   * Execute a deployment to Cloudflare Pages.
   */
  async deploy(request: DeploymentRequest): Promise<DeploymentResult> {
    const requestId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Validate request
    const validationError = this.validateRequest(request);
    if (validationError) {
      return { success: false, error: validationError, errorCode: 'VALIDATION_ERROR' };
    }

    // Acquire lock
    const lockAcquired = await this.acquireLock(request.userId, request.projectName, requestId);
    if (!lockAcquired) {
      return {
        success: false,
        error: 'A deployment is already in progress for this project',
        errorCode: 'CONCURRENT_DEPLOYMENT'
      };
    }

    let credential: { id: string; accountId: string; apiToken: string } | null = null;
    let deploymentId: string | undefined;

    try {
      // Get credentials
      credential = await this.credentialService.getCredentials(request.userId);
      if (!credential) {
        return { success: false, error: 'No Cloudflare credentials found', errorCode: 'NO_CREDENTIALS' };
      }

      // Create history record
      deploymentId = await this.createHistoryRecord(request.userId, credential.id, request);

      // Update status to building
      await this.updateDeploymentStatus(deploymentId, 'building');

      // Initialize Cloudflare API
      const cf = new CloudflareAPI({
        accountId: credential.accountId,
        apiToken: credential.apiToken
      });

      // Check if project exists, create if not
      const projects = await cf.listPagesProject();
      const existingProject = projects.find(p => p.name === request.projectName);

      if (!existingProject) {
        await cf.createPagesProject(request.projectName);
      }

      // Update status to deploying
      await this.updateDeploymentStatus(deploymentId, 'deploying');

      // Deploy files
      const result = await cf.deploy(request.projectName, request.files);

      if (result.success) {
        // Update status to live
        await this.updateDeploymentStatus(deploymentId, 'live', {
          cloudflare_deployment_id: result.deploymentId,
          url: result.url,
          deployed_at: new Date().toISOString()
        });

        // Update credential last used
        await this.credentialService.updateLastUsed(credential.id);

        return {
          success: true,
          deploymentId: result.deploymentId,
          url: result.url
        };
      } else {
        // Update status to failed
        await this.updateDeploymentStatus(deploymentId, 'failed', {
          error_message: result.error,
          error_code: result.errorCode
        });

        // Invalidate credentials if auth error
        if (result.errorCode === '401' || result.errorCode === '403') {
          await this.credentialService.invalidateCredentials(credential.id, result.error || 'Authentication failed');
        }

        return {
          success: false,
          error: result.error,
          errorCode: result.errorCode
        };
      }
    } catch (error) {
      // Update status to failed
      if (deploymentId) {
        await this.updateDeploymentStatus(deploymentId, 'failed', {
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_code: 'INTERNAL_ERROR'
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed',
        errorCode: 'INTERNAL_ERROR'
      };
    } finally {
      // Always release lock
      await this.releaseLock(request.userId, request.projectName);
    }
  }

  /**
   * Get deployment history for a user.
   */
  async getDeploymentHistory(userId: string, limit: number = 50): Promise<DeploymentRecord[]> {
    const { data, error } = await this.supabase
      .from('deployment_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(record => ({
      id: record.id,
      userId: record.user_id,
      credentialId: record.credential_id,
      projectName: record.project_name,
      domain: record.domain,
      isCustomDomain: record.is_custom_domain,
      status: record.status,
      cloudflareDeploymentId: record.cloudflare_deployment_id,
      artifactUrl: record.artifact_url,
      errorMessage: record.error_message,
      errorCode: record.error_code,
      rolledBackFrom: record.rolled_back_from,
      deployedAt: record.deployed_at,
      createdAt: record.created_at,
      completedAt: record.completed_at
    }));
  }

  /**
   * Rollback to a previous deployment.
   */
  async rollback(userId: string, deploymentId: string): Promise<DeploymentResult> {
    // Get the target deployment
    const { data: targetDeployment, error } = await this.supabase
      .from('deployment_history')
      .select('*')
      .eq('id', deploymentId)
      .eq('user_id', userId)
      .eq('status', 'live')
      .single();

    if (error || !targetDeployment) {
      return { success: false, error: 'Target deployment not found', errorCode: 'NOT_FOUND' };
    }

    // Get credentials
    const credential = await this.credentialService.getCredentials(userId);
    if (!credential) {
      return { success: false, error: 'No Cloudflare credentials found', errorCode: 'NO_CREDENTIALS' };
    }

    try {
      const cf = new CloudflareAPI({
        accountId: credential.accountId,
        apiToken: credential.apiToken
      });

      // Create rollback record
      const rollbackId = await this.createHistoryRecord(userId, credential.id, {
        userId,
        projectName: targetDeployment.project_name,
        files: {},
        domain: targetDeployment.domain,
        isCustomDomain: targetDeployment.is_custom_domain
      });

      // Deploy the previous version
      const result = await cf.deploy(targetDeployment.project_name, {});

      if (result.success) {
        await this.updateDeploymentStatus(rollbackId, 'live', {
          cloudflare_deployment_id: result.deploymentId,
          url: result.url,
          rolled_back_from: deploymentId,
          deployed_at: new Date().toISOString()
        });

        // Mark original as rolled back
        await this.updateDeploymentStatus(deploymentId, 'rolled_back');

        return { success: true, deploymentId: result.deploymentId, url: result.url };
      } else {
        await this.updateDeploymentStatus(rollbackId, 'failed', {
          error_message: result.error,
          error_code: result.errorCode
        });

        return { success: false, error: result.error, errorCode: result.errorCode };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rollback failed',
        errorCode: 'INTERNAL_ERROR'
      };
    }
  }
}

// ============================================================
// Singleton instance
// ============================================================

let deploymentInstance: DeploymentService | null = null;

export function getDeploymentService(): DeploymentService {
  if (!deploymentInstance) {
    deploymentInstance = new DeploymentService();
  }
  return deploymentInstance;
}

export default DeploymentService;
