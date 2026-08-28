/**
 * Generation Gateway
 *
 * Universal generation gateway that:
 * 1. Authenticates user
 * 2. Loads model definition
 * 3. Checks model is enabled
 * 4. Validates inputs
 * 5. Translates canonical fields to provider fields
 * 6. Estimates cost
 * 7. Checks subscription/credits
 * 8. Submits to provider
 * 9. Stores generation job
 * 10. Returns job ID
 *
 * The frontend must NOT call MuAPI directly.
 * All provider secrets stay server-side.
 */

import { supabase } from '../supabase';
import type { SmartModel, GenerationInput, GenerationJob, GenerationResult, CostEstimate } from '../../types/ai';
import { MuapiAdapter } from './MuapiAdapter';
import { getModelRegistry } from './ModelRegistry';
import { getPricingEngine } from './PricingEngine';

// Minimal auth shape; broaden if your real AuthContextType differs.
interface AuthContextMinimal {
  user?: { id: string } | null;
}

const PROVIDER_ADAPTERS = new Map<string, () => MuapiAdapter>([
  ['muapi', () => new MuapiAdapter()],
]);

export class GenerationGateway {
  private registry = getModelRegistry();
  private pricingEngine = getPricingEngine();

  async submitGeneration(
    input: GenerationInput,
    auth: AuthContextType
  ): Promise<GenerationJob> {
    // 1. Authenticate user
    if (!(auth as AuthContextMinimal).user) {
      throw new Error('Unauthorized: user must be signed in');
    }

    // 2. Load model definition
    const model = await this.registry.getModel(input.provider, input.model);
    if (!model) {
      throw new Error(`Model not found: ${input.provider}/${input.model}`);
    }

    // 3. Check model is enabled
    if (!model.enabled) {
      throw new Error(`Model is not enabled: ${input.model}`);
    }

    // 4. Validate inputs against schema
    this.validateInputs(model, input.inputs);

    // 5. Get adapter
    const adapter = this.getAdapter(input.provider);
    if (!adapter) {
      throw new Error(`Unsupported provider: ${input.provider}`);
    }

    // 6. Estimate cost
    const estimate = await adapter.estimateCost(input.model, input.inputs);

    // 7. Check subscription/credits (server-side)
    const creditCheck = await this.checkCredits(auth, estimate);
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || 'Insufficient credits');
    }

    // 8. Submit to provider
    const job = await adapter.generate(input.model, input.inputs);

    // 9. Store generation job
    await this.storeJob({
      ...job,
      provider: input.provider,
      model: input.model,
      userId: auth.user.id,
      inputs: input.inputs,
      estimatedCost: estimate,
    });

    // 10. Reserve credits
    await this.reserveCredits(auth, estimate);

    return job;
  }

  async pollResult(
    provider: string,
    requestId: string,
    auth: AuthContextMinimal
  ): Promise<GenerationResult> {
    if (!auth.user) {
      throw new Error('Unauthorized');
    }

    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const result = await adapter.getResult(requestId);

    // Update job in DB
    await this.updateJob(requestId, result);

    // If completed, save to library
    if (result.status === 'completed' && result.outputs) {
      await this.saveToLibrary(auth, provider, requestId, result);
    }

    return result;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private getAdapter(provider: string): MuapiAdapter | undefined {
    return PROVIDER_ADAPTERS.get(provider)?.();
  }

  private validateInputs(model: SmartModel, inputs: Record<string, unknown>): void {
    const schema = model.inputSchema as Record<string, unknown> | undefined;
    if (!schema) return;

    const properties = (schema.properties || {}) as Record<string, unknown>;
    const required = new Set((schema.required || []) as string[]);

    // Check required fields
    for (const field of required) {
      if (!(field in inputs) || inputs[field] === null || inputs[field] === undefined) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Type checks could be added here with AJV or similar
    // For now, basic presence validation is sufficient
  }

  private async checkCredits(
    auth: AuthContextMinimal,
    estimate: CostEstimate
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!auth.user) {
      return { allowed: false, reason: 'Unauthorized' };
    }

    // Get tenant
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', auth.user.id)
      .single();

    if (!profile?.tenant_id) {
      return { allowed: false, reason: 'No tenant found' };
    }

    // Check credit balance
    const { data: balance } = await supabase
      .from('credit_balances')
      .select('credits_available')
      .eq('tenant_id', profile.tenant_id)
      .single();

    const available = Number(balance?.credits_available || 0);
    const required = estimate.estimatedCredits || 1;

    if (available < required) {
      return { allowed: false, reason: `Insufficient credits. Required: ${required}, Available: ${available}` };
    }

    return { allowed: true };
  }

  private async reserveCredits(auth: AuthContextMinimal, estimate: CostEstimate): Promise<void> {
    if (!auth.user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', auth.user.id)
      .single();

    if (!profile?.tenant_id) return;

    const credits = estimate.estimatedCredits || 1;

    // Atomically decrement credits
    const { error } = await supabase.rpc('decrement_credits', {
      p_tenant_id: profile.tenant_id,
      p_amount: credits,
    });

    if (error) {
      console.error('[GenerationGateway] Failed to reserve credits:', error);
    }
  }

  private async storeJob(job: GenerationJob & {
    provider: string;
    model: string;
    userId: string;
    inputs: Record<string, unknown>;
    estimatedCost: CostEstimate;
  }): Promise<void> {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', job.userId)
      .single();

    if (!profile?.tenant_id) return;

    await supabase.from('generation_jobs').insert({
      tenant_id: profile.tenant_id,
      user_id: job.userId,
      provider: job.provider,
      model_name: job.model,
      provider_request_id: job.requestId,
      inputs: job.inputs,
      status: job.status,
      estimated_provider_cost: job.estimatedCost?.providerCost || 0,
      charged_credits: job.estimatedCost?.estimatedCredits || 0,
    });
  }

  private async updateJob(requestId: string, result: GenerationResult): Promise<void> {
    await supabase
      .from('generation_jobs')
      .update({
        status: result.status,
        outputs: result.outputs,
        error: result.error,
        actual_provider_cost: result.providerCost,
        completed_at: result.completedAt,
      })
      .eq('provider_request_id', requestId);
  }

  private async saveToLibrary(
    auth: AuthContextMinimal,
    provider: string,
    requestId: string,
    result: GenerationResult
  ): Promise<void> {
    if (!result.outputs || result.outputs.length === 0) return;

    // Get the generation job
    const { data: job } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('provider_request_id', requestId)
      .single();

    if (!job) return;

    // Save each output to assets
    for (const output of result.outputs) {
      if (output.type === 'text') continue;

      for (const url of output.urls) {
        await supabase.from('assets').insert({
          tenant_id: job.tenant_id,
          user_id: job.user_id,
          project_id: job.project_id,
          file_name: this.extractFileName(url),
          file_path: url,
          file_size_bytes: 0,
          mime_type: this.getMimeType(output.type, url),
          asset_type: output.type === '3d' ? '3d' : output.type,
          metadata: {
            provider,
            model: job.model_name,
            prompt: job.inputs?.prompt,
            generation_job_id: job.id,
          },
          tags: [provider, job.model_name],
        });
      }
    }

    // Also save to generation_history for compatibility
    await supabase.from('generation_history').insert({
      tenant_id: job.tenant_id,
      user_id: job.user_id,
      project_id: job.project_id,
      studio_type: job.studio_type || 'image',
      generation_type: result.outputs[0]?.type || 'image',
      model_name: job.model_name,
      prompt: job.inputs?.prompt || '',
      parameters: job.inputs,
      output_url: result.outputs[0]?.urls[0] || '',
      status: 'completed',
      cost_credits: job.estimated_provider_cost || 0,
    });
  }

  private extractFileName(url: string): string {
    try {
      const parts = url.split('/');
      return parts[parts.length - 1] || `generated_${Date.now()}`;
    } catch {
      return `generated_${Date.now()}`;
    }
  }

  private getMimeType(type: string, url: string): string {
    const lower = url.toLowerCase();
    if (type === 'video') {
      if (lower.endsWith('.webm')) return 'video/webm';
      return 'video/mp4';
    }
    if (type === 'audio') {
      if (lower.endsWith('.mp3')) return 'audio/mpeg';
      return 'audio/wav';
    }
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/png';
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let generationGatewayInstance: GenerationGateway | null = null;

export function getGenerationGateway(): GenerationGateway {
  if (!generationGatewayInstance) {
    generationGatewayInstance = new GenerationGateway();
  }
  return generationGatewayInstance;
}
