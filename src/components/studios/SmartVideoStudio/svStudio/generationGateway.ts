/**
 * SmartVideo Studio — Generation Gateway
 *
 * Handles submission of generation requests to the backend.
 */

export interface GenerationJob {
  id: string;
  modelId: string;
  modelName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export async function submitGeneration(params: {
  modelId: string;
  values: Record<string, unknown>;
}): Promise<GenerationJob> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: params.modelId,
      parameters: params.values,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(error.error || `Generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data as GenerationJob;
}

export async function estimateGeneration(params: {
  modelId: string;
  values: Record<string, unknown>;
}): Promise<{ estimatedCost: number; modelName: string }> {
  const response = await fetch('/api/generate/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: params.modelId,
      parameters: params.values,
    }),
  });

  if (!response.ok) {
    return { estimatedCost: 0, modelName: params.modelId };
  }

  const data = await response.json();
  return {
    estimatedCost: data.cost ?? data.estimatedCost ?? 0,
    modelName: data.modelName ?? params.modelId,
  };
}

export function deleteJob(jobId: string): void {
  // In a real app, this would call an API to delete the job
  console.log('[GenerationGateway] Deleting job:', jobId);
}
