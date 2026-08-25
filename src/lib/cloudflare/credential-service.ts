// ============================================================
// Cloudflare BYOC — Credential Service
// File: src/lib/cloudflare/credential-service.ts
// Purpose: Encrypted storage and retrieval of Cloudflare credentials
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEncryptionService, EncryptedData } from './encryption';
import { CloudflareAPI } from './api-client';

// ============================================================
// Types
// ============================================================

export interface CloudflareCredential {
  id: string;
  userId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface StoredCredential {
  id: string;
  accountId: string;
  apiToken: string;
}

export interface ValidationResult {
  valid: boolean;
  email?: string;
  scopes?: string[];
  error?: string;
}

// ============================================================
// Credential Service
// ============================================================

class CredentialService {
  private supabase: SupabaseClient;
  private encryption;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.encryption = getEncryptionService();
  }

  /**
   * Validate a Cloudflare API token before storing.
   */
  async validateToken(
    accountId: string,
    apiToken: string
  ): Promise<ValidationResult> {
    const cf = new CloudflareAPI({ accountId, apiToken });
    return cf.validateToken();
  }

  /**
   * Store encrypted credentials for a user.
   */
  async storeCredentials(
    userId: string,
    accountId: string,
    apiToken: string,
    accountEmail?: string,
    accountName?: string,
    scopes?: string[]
  ): Promise<{ id: string }> {
    const { encrypted, iv, tag } = this.encryption.encrypt(apiToken, userId);

    const { data, error } = await this.supabase
      .from('user_cloudflare_creds')
      .upsert({
        user_id: userId,
        account_id: accountId,
        encrypted_token: encrypted,
        token_nonce: iv,
        token_tag: tag,
        token_scope: scopes || [],
        account_email: accountEmail,
        account_name: accountName,
        is_active: true,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        last_rotated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,account_id'
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to store credentials: ${error.message}`);
    }

    return { id: data.id };
  }

  /**
   * Retrieve and decrypt credentials for a user.
   * Caller is responsible for clearing the token from memory.
   */
  async getCredentials(userId: string): Promise<StoredCredential | null> {
    const { data, error } = await this.supabase
      .from('user_cloudflare_creds')
      .select('id, account_id, encrypted_token, token_nonce, token_tag')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_valid', true)
      .single();

    if (error || !data) {
      return null;
    }

    const apiToken = this.encryption.decrypt(
      {
        encrypted: data.encrypted_token,
        iv: data.token_nonce,
        tag: data.token_tag
      },
      userId
    );

    return {
      id: data.id,
      accountId: data.account_id,
      apiToken
    };
  }

  /**
   * Get credential status (non-sensitive) for UI display.
   */
  async getCredentialStatus(userId: string): Promise<CloudflareCredential | null> {
    const { data, error } = await this.supabase
      .from('user_cloudflare_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      accountId: data.account_id,
      tokenScope: data.token_scope,
      accountEmail: data.account_email,
      accountName: data.account_name,
      isActive: data.is_active,
      isValid: data.is_valid,
      lastValidatedAt: data.last_validated_at,
      lastValidationError: data.last_validation_error,
      lastRotatedAt: data.last_rotated_at,
      lastUsedAt: data.last_used_at,
      totalDeployments: data.total_deployments,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Mark credentials as invalid (e.g., after failed deployment).
   */
  async invalidateCredentials(
    credentialId: string,
    reason: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('user_cloudflare_creds')
      .update({
        is_valid: false,
        last_validation_error: reason
      })
      .eq('id', credentialId);

    if (error) {
      throw new Error(`Failed to invalidate credentials: ${error.message}`);
    }
  }

  /**
   * Deactivate credentials (soft delete).
   */
  async deactivateCredentials(userId: string, credentialId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_cloudflare_creds')
      .update({ is_active: false })
      .eq('id', credentialId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to deactivate credentials: ${error.message}`);
    }
  }

  /**
   * Update last used timestamp.
   */
  async updateLastUsed(credentialId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_cloudflare_creds')
      .update({
        last_used_at: new Date().toISOString(),
        total_deployments: this.supabase.rpc('increment_deployments', {
          cred_id: credentialId
        })
      })
      .eq('id', credentialId);

    if (error) {
      // Non-critical error, log but don't throw
      console.warn(`Failed to update last_used: ${error.message}`);
    }
  }

  /**
   * Get credentials that need rotation (older than 75 days).
   */
  async getCredentialsNeedingRotation(): Promise<Array<{ userId: string; credentialId: string; accountEmail?: string }>> {
    const { data, error } = await this.supabase
      .from('user_cloudflare_creds')
      .select('id, user_id, account_email')
      .eq('is_active', true)
      .lt('last_rotated_at', new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString())
      .eq('rotation_reminder_sent', false);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      userId: item.user_id,
      credentialId: item.id,
      accountEmail: item.account_email
    }));
  }

  /**
   * Mark rotation reminder as sent.
   */
  async markRotationReminderSent(credentialId: string): Promise<void> {
    await this.supabase
      .from('user_cloudflare_creds')
      .update({ rotation_reminder_sent: true })
      .eq('id', credentialId);
  }
}

// ============================================================
// Singleton instance
// ============================================================

let credentialInstance: CredentialService | null = null;

export function getCredentialService(): CredentialService {
  if (!credentialInstance) {
    credentialInstance = new CredentialService();
  }
  return credentialInstance;
}

export default CredentialService;
