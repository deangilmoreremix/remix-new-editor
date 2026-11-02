/**
 * Centralized configuration for business asset discovery classification.
 *
 * Changing the classification model later should require only edits here,
 * not changes scattered across providers, routes, or classifiers.
 */

export function getBusinessAssetClassificationModel(): string {
  return process.env.OPENAI_ASSET_CLASSIFICATION_MODEL || 'gpt-4o-mini'
}
