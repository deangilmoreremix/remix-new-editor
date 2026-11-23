/**
 * Centralized configuration for business asset discovery classification.
 *
 * Changing the classification model later should require only edits here,
 * not changes scattered across providers, routes, or classifiers.
 */

import { OPENAI_FAST_MODEL } from '../../../_shared/openaiModels.js'

export function getBusinessAssetClassificationModel(): string {
  return process.env.OPENAI_ASSET_CLASSIFICATION_MODEL || OPENAI_FAST_MODEL
}
