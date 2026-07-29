// packages/assets/src/types.ts

import type { Asset } from '../../intelligence/src/types.ts';

export type { Asset };

export type AssetType = Asset['assetType'];

export interface AssetDiscoverySource {
  /** Where the asset was discovered: 'website', 'github', 'maigret', 'manual' */
  source: 'website' | 'github' | 'maigret' | 'manual';
  /** Original URL the asset was discovered at (before upload to Supabase) */
  sourceUrl?: string;
  /** Discovery timestamp */
  discoveredAt: string;
}

export interface DiscoveredAsset {
  assetType: AssetType;
  /** URL of the asset (either source URL or Supabase public URL after upload) */
  url: string;
  /** Storage path within the Supabase bucket (if uploaded) */
  storagePath?: string;
  /** Optional metadata (width, height, mime type, dominant colors, etc.) */
  metadata?: Record<string, any>;
  /** Source tracking */
  source: AssetDiscoverySource;
}

export interface AssetDiscoveryOptions {
  /** When true, download discovered assets and re-upload to Supabase. Default: true. */
  uploadToStorage?: boolean;
  /** When true, skip network fetches and only return source URLs. Default: false. */
  sourceOnly?: boolean;
  /** Per-extractor timeout in ms. Default: 10000. */
  timeoutMs?: number;
  /** User agent used for HTTP requests. */
  userAgent?: string;
  /** Max bytes per asset to download. Default: 5 MB. */
  maxBytes?: number;
}

export interface AssetDiscoveryResult {
  logos: DiscoveredAsset[];
  avatars: DiscoveredAsset[];
  screenshots: DiscoveredAsset[];
  icons: DiscoveredAsset[];
  productImages: DiscoveredAsset[];
  brandColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  errors: Array<{ source: string; error: string }>;
  durationMs: number;
}

export interface StorageConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  bucket: string;
}

export interface UploadResult {
  /** Public URL of the uploaded asset */
  url: string;
  /** Storage path inside the bucket */
  storagePath: string;
  /** Size in bytes */
  size: number;
  /** MIME type */
  contentType?: string;
}
