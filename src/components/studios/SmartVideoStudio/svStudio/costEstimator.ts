/**
 * SmartVideo Studio — Cost Estimator
 */

import { estimateGeneration } from './generationGateway';

export async function estimateCost(modelId: string, values: Record<string, unknown>): Promise<{ estimatedCost: number; modelName: string }> {
  try {
    return await estimateGeneration({ modelId, values });
  } catch {
    return { estimatedCost: 0, modelName: modelId };
  }
}
