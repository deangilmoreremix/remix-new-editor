/**
 * SmartVideo Universal Model Engine — Core Exports
 *
 * Re-exports types, adapters, registry, normalizer, and gateway.
 */

// Types
export type {
  SmartField,
  SmartFieldType,
  SmartFieldOption,
  SmartModel,
  SmartOutput,
  AIProviderAdapter,
  CostEstimate,
  GenerationJob,
  GenerationResult,
  FieldMapping,
  ModelUIOverride,
  ModelPricingRule,
  CatalogSyncResult,
  GenerationInput,
  ModelGeneratorFeatures,
} from '../../types/ai';

// Adapters
export { MuapiAdapter } from './MuapiAdapter';

// Registry
export { ModelRegistry, getModelRegistry } from './ModelRegistry';

// Normalizer
export { normalizeSchema, type NormalizeSchemaOptions } from './SchemaNormalizer';

// Aliases
export { FIELD_ALIASES, resolveCanonicalField } from './FieldAliases';

// Field inference
export { inferFieldType, inferFieldOptions } from './FieldTypeInference';

// Catalog sync
export { CatalogSync, getCatalogSync } from './CatalogSync';

// Generation gateway
export { GenerationGateway, getGenerationGateway } from './GenerationGateway';

// Pricing engine
export { PricingEngine, getPricingEngine } from './PricingEngine';
