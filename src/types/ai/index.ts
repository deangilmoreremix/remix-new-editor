/**
 * SmartVideo Universal Model Engine — Core Types
 *
 * Provider-independent type system for the Universal Model Engine.
 */

// ── Canonical Field System ───────────────────────────────────────────────────

export type SmartFieldType =
  | 'prompt'
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'select'
  | 'chips'
  | 'toggle'
  | 'image'
  | 'images'
  | 'video'
  | 'audio'
  | 'aspect-ratio'
  | 'resolution'
  | 'duration'
  | 'seed'
  | 'lora'
  | 'camera-motion'
  | 'first-frame'
  | 'last-frame'
  | 'strength'
  | 'output-format';

export interface SmartFieldOption {
  label: string;
  value: unknown;
  icon?: string;
  description?: string;
}

export interface SmartField {
  key: string;
  providerField: string;
  canonicalField?: string;
  label: string;
  type: SmartFieldType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  options?: SmartFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  section?: string;
  advanced?: boolean;
  order?: number;
  hidden?: boolean;
  visibleWhen?: {
    field: string;
    equals: unknown;
  };
  rawSchema?: unknown;
}

// ── SmartModel ───────────────────────────────────────────────────────────────

export interface SmartModel {
  id: string;
  provider: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  family?: string;
  group?: string;
  endpoint: string;
  cost?: number;
  currency?: string;
  dynamicPricing: boolean;
  estimateEndpoint?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  studios: string[];
  enabled: boolean;
  featured: boolean;
  recommended: boolean;
  tags: string[];
  syncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Provider Adapter Interface ───────────────────────────────────────────────

export interface CostEstimate {
  providerCost: number;
  currency: string;
  estimatedCredits: number;
  dynamic: boolean;
  breakdown?: Record<string, unknown>;
}

export interface GenerationJob {
  requestId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  provider?: string;
  model?: string;
  estimatedCost?: CostEstimate;
  submittedAt: string;
}

export interface GenerationResult {
  requestId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  outputs?: SmartOutput[];
  error?: string;
  providerCost?: number;
  processingTimeMs?: number;
  metadata?: Record<string, unknown>;
  completedAt?: string;
}

export type SmartOutput =
  | { type: 'image'; urls: string[] }
  | { type: 'video'; urls: string[] }
  | { type: 'audio'; urls: string[] }
  | { type: '3d'; urls: string[] }
  | { type: 'text'; value: string };

export interface AIProviderAdapter {
  listModels(): Promise<SmartModel[]>;
  getModel(modelName: string): Promise<SmartModel>;
  estimateCost(modelName: string, input: Record<string, unknown>): Promise<CostEstimate>;
  generate(modelName: string, input: Record<string, unknown>): Promise<GenerationJob>;
  getResult(requestId: string): Promise<GenerationResult>;
}

// ── Field Mapping ────────────────────────────────────────────────────────────

export interface FieldMapping {
  canonical: string;
  providerField: string;
}

// ── Model UI Override ────────────────────────────────────────────────────────

export interface ModelUIOverride {
  id?: string;
  provider: string;
  modelName: string;
  fieldName: string;
  canonicalField?: string;
  component?: string;
  label?: string;
  description?: string;
  section?: string;
  sortOrder?: number;
  advanced?: boolean;
  hidden?: boolean;
  config?: Record<string, unknown>;
}

// ── Model Pricing Rule ───────────────────────────────────────────────────────

export interface ModelPricingRule {
  id?: string;
  provider: string;
  modelName: string;
  markupMultiplier: number;
  minimumCredits: number;
  creditRate: number;
  subscriptionTier?: string;
  active: boolean;
}

// ── Catalog Sync Result ──────────────────────────────────────────────────────

export interface CatalogSyncResult {
  syncedAt: string;
  totalModels: number;
  newModels: number;
  updatedModels: number;
  removedModels: number;
  errors: Array<{ model: string; error: string }>;
}

// ── Generation Input ─────────────────────────────────────────────────────────

export interface GenerationInput {
  provider: string;
  model: string;
  inputs: Record<string, unknown>;
  studioType?: string;
}

// ── Model Generator Features ─────────────────────────────────────────────────

export interface ModelGeneratorFeatures {
  modelPicker?: boolean;
  costEstimate?: boolean;
  advancedControls?: boolean;
  promptEnhancer?: boolean;
  mediaLibrary?: boolean;
}
