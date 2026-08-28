/**
 * Pricing Engine
 *
 * Converts provider costs to SmartVideo credit costs.
 * Supports markup multipliers, minimum charges, and credit conversion rates.
 */

import { supabase } from '../supabase';
import type { CostEstimate, ModelPricingRule } from '../../types/ai';
import { getModelRegistry } from './ModelRegistry';

export class PricingEngine {
  private registry = getModelRegistry();
  private cache = new Map<string, ModelPricingRule>();
  private cacheTTL = 10 * 60 * 1000;
  private cacheExpiry = 0;

  async getPricingRule(provider: string, modelName: string): Promise<ModelPricingRule> {
    // Check cache
    const cacheKey = `${provider}:${modelName}`;
    if (this.cache.has(cacheKey) && Date.now() < this.cacheExpiry) {
      return this.cache.get(cacheKey)!;
    }

    // Load from DB
    const { data, error } = await supabase
      .from('model_pricing_rules')
      .select('*')
      .eq('provider', provider)
      .eq('model_name', modelName)
      .eq('active', true)
      .maybeSingle();

    if (error || !data) {
      // Return default rule
      const defaultRule: ModelPricingRule = {
        provider,
        modelName,
        markupMultiplier: 1.0,
        minimumCredits: 1,
        creditRate: 1,
        active: true,
      };
      return defaultRule;
    }

    const rule: ModelPricingRule = {
      id: data.id,
      provider: data.provider,
      modelName: data.model_name,
      markupMultiplier: Number(data.markup_multiplier) || 1.0,
      minimumCredits: Number(data.minimum_credits) || 1,
      creditRate: Number(data.credit_rate) || 1,
      subscriptionTier: data.subscription_tier,
      active: data.active,
    };

    this.cache.set(cacheKey, rule);
    this.cacheExpiry = Date.now() + this.cacheTTL;

    return rule;
  }

  async calculateCredits(
    provider: string,
    modelName: string,
    providerCost: number,
    currency: string = 'USD'
  ): Promise<{ credits: number; providerCost: number; currency: string }> {
    const rule = await this.getPricingRule(provider, modelName);
    const markupCost = providerCost * rule.markupMultiplier;
    const credits = Math.max(rule.minimumCredits, Math.ceil(markupCost * rule.creditRate));

    return {
      credits,
      providerCost,
      currency,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let pricingEngineInstance: PricingEngine | null = null;

export function getPricingEngine(): PricingEngine {
  if (!pricingEngineInstance) {
    pricingEngineInstance = new PricingEngine();
  }
  return pricingEngineInstance;
}
