// ============================================================
// Cloudflare BYOC — Encryption Module
// File: src/lib/cloudflare/encryption.ts
// Security: AES-256-GCM with per-user key derivation
// ============================================================

import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

// ============================================================
// Constants
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

// ============================================================
// Types
// ============================================================

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

// ============================================================
// Encryption Service
// ============================================================

class EncryptionService {
  private masterSecret: string;

  constructor() {
    this.masterSecret = process.env.KEY_ENCRYPTION_SECRET || '';
    if (!this.masterSecret || this.masterSecret.length < 32) {
      throw new EncryptionError('KEY_ENCRYPTION_SECRET must be at least 32 characters');
    }
  }

  /**
   * Derive a unique key per user from master secret + user ID.
   * This limits blast radius if a single user's data is compromised.
   */
  private deriveUserKey(userId: string): Buffer {
    const salt = scryptSync(userId, this.masterSecret, SALT_LENGTH);
    return scryptSync(this.masterSecret, salt, KEY_LENGTH);
  }

  /**
   * Encrypt a credential with per-user derived key.
   * Returns encrypted data with nonce and auth tag.
   */
  encrypt(plaintext: string, userId: string): EncryptedData {
    if (!plaintext) {
      throw new EncryptionError('Cannot encrypt empty plaintext');
    }
    if (!userId) {
      throw new EncryptionError('User ID is required for encryption');
    }

    const key = this.deriveUserKey(userId);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    // Zero out key from memory immediately after use
    key.fill(0);

    return { encrypted, iv, tag };
  }

  /**
   * Decrypt a credential. Caller is responsible for clearing
   * the returned string from memory when done.
   */
  decrypt(data: EncryptedData, userId: string): string {
    if (!data.encrypted || !data.iv || !data.tag) {
      throw new EncryptionError('Invalid encrypted data structure');
    }
    if (!userId) {
      throw new EncryptionError('User ID is required for decryption');
    }

    const key = this.deriveUserKey(userId);
    try {
      const decipher = createDecipheriv(ALGORITHM, key, data.iv, { authTagLength: TAG_LENGTH });
      decipher.setAuthTag(data.tag);

      const plaintext = decipher.update(data.encrypted) + decipher.final('utf8');
      return plaintext;
    } catch (error) {
      throw new EncryptionError(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Always zero out key
      key.fill(0);
    }
  }

  /**
   * Generate a token fingerprint for display purposes.
   * Shows first 4 and last 8 chars with asterisks in between.
   */
  generateFingerprint(token: string): string {
    if (!token || token.length < 12) {
      return '****';
    }
    const start = token.slice(0, 4);
    const end = token.slice(-8);
    const middle = '*'.repeat(Math.min(20, token.length - 12));
    return `${start}${middle}${end}`;
  }

  /**
   * Validate that encrypted data has the correct structure.
   */
  validateEncryptedData(data: EncryptedData): boolean {
    return (
      Buffer.isBuffer(data.encrypted) &&
      data.encrypted.length > 0 &&
      Buffer.isBuffer(data.iv) &&
      data.iv.length === IV_LENGTH &&
      Buffer.isBuffer(data.tag) &&
      data.tag.length === TAG_LENGTH
    );
  }

  /**
   * Securely zero out a buffer.
   */
  secureZero(buffer: Buffer): void {
    if (Buffer.isBuffer(buffer)) {
      buffer.fill(0);
    }
  }
}

// ============================================================
// Singleton instance
// ============================================================

let encryptionInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionInstance) {
    encryptionInstance = new EncryptionService();
  }
  return encryptionInstance;
}

export default EncryptionService;
