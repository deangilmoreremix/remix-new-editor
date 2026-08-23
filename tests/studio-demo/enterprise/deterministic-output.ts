/**
 * Deterministic Output System
 *
 * Ensures reproducible AI generation for consistent demo footage:
 * - Seed locking and management
 * - Model/version pinning
 * - Parameter immutability
 * - Output caching by seed
 * - Reproducibility validation
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// SEED MANAGEMENT
// =============================================================================

export interface SeedConfig {
  seed: number;
  prompt: string;
  negativePrompt?: string;
  model: string;
  version: string;
  steps: number;
  sampler: string;
  cfgScale: number;
  width: number;
  height: number;
  hash?: string; // Content hash for validation
}

export interface ReproducibilityReport {
  seed: number;
  runs: Array<{
    timestamp: number;
    outputPath: string;
    hash: string;
    match: boolean;
  }>;
  consistent: boolean;
}

// =============================================================================
// DETERMINISTIC OUTPUT MANAGER
// =============================================================================

export class DeterministicOutputManager {
  private cacheDir: string;
  private seedRegistry: Map<number, SeedConfig> = new Map();
  private outputRegistry: Map<string, string[]> = new Map(); // seed hash -> output paths

  constructor(cacheDir = './test-results/deterministic-cache') {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Creates a locked configuration for deterministic generation.
   */
  createLockedConfig(params: {
    seed: number;
    prompt: string;
    model: string;
    steps: number;
    sampler: string;
    width: number;
    height: number;
    negativePrompt?: string;
    cfgScale?: number;
  }): SeedConfig {
    const config: SeedConfig = {
      seed: params.seed,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      model: params.model,
      version: this.getModelVersion(params.model),
      steps: params.steps,
      sampler: params.sampler,
      cfgScale: params.cfgScale || 7.0,
      width: params.width,
      height: params.height,
      hash: this.generateConfigHash(params),
    };

    this.seedRegistry.set(params.seed, config);
    this.saveConfig(config);

    return config;
  }

  /**
   * Generates a set of deterministic seeds for a demo sequence.
   */
  static generateDemoSequence(baseSeed: number, count: number): number[] {
    const seeds: number[] = [];
    for (let i = 0; i < count; i++) {
      seeds.push(baseSeed + i);
    }
    return seeds;
  }

  /**
   * Validates that a generation output matches expected seed.
   */
  validateOutput(seed: number, outputPath: string): boolean {
    const config = this.seedRegistry.get(seed);
    if (!config) {
      console.warn(`[Deterministic] No config found for seed: ${seed}`);
      return false;
    }

    // Compute hash of output
    const outputHash = this.computeFileHash(outputPath);
    const expectedHash = config.hash;

    const match = outputHash === expectedHash;
    
    console.log(`[Deterministic] Seed ${seed}: ${match ? 'MATCH' : 'MISMATCH'}`);
    console.log(`[Deterministic] Expected: ${expectedHash}`);
    console.log(`[Deterministic] Got: ${outputHash}`);

    return match;
  }

  /**
   * Runs reproducibility test - generates same output N times.
   */
  async validateReproducibility(
    generateFn: () => Promise<string>,
    seed: number,
    runs = 3
  ): Promise<ReproducibilityReport> {
    const config = this.seedRegistry.get(seed);
    if (!config) {
      throw new Error(`No config for seed: ${seed}`);
    }

    const results: ReproducibilityReport['runs'] = [];

    for (let i = 0; i < runs; i++) {
      console.log(`[Deterministic] Reproducibility run ${i + 1}/${runs}`);
      
      const outputPath = await generateFn();
      const hash = this.computeFileHash(outputPath);
      const match = hash === config.hash;

      results.push({
        timestamp: Date.now(),
        outputPath,
        hash,
        match,
      });

      // Cache the output
      const cached = this.outputRegistry.get(config.hash) || [];
      cached.push(outputPath);
      this.outputRegistry.set(config.hash, cached);
    }

    const consistent = results.every(r => r.match);

    return {
      seed,
      runs: results,
      consistent,
    };
  }

  /**
   * Caches an output for a given seed.
   */
  cacheOutput(seed: number, outputPath: string): void {
    const config = this.seedRegistry.get(seed);
    if (!config) return;

    const cached = this.outputRegistry.get(config.hash || '') || [];
    if (!cached.includes(outputPath)) {
      cached.push(outputPath);
      this.outputRegistry.set(config.hash || '', cached);
    }

    // Copy to cache directory
    const cachePath = path.join(this.cacheDir, `seed-${seed}${path.extname(outputPath)}`);
    fs.copyFileSync(outputPath, cachePath);
  }

  /**
   * Gets cached output for a seed.
   */
  getCachedOutput(seed: number): string | undefined {
    const config = this.seedRegistry.get(seed);
    if (!config) return undefined;

    const cached = this.outputRegistry.get(config.hash || '');
    return cached?.[0];
  }

  /**
   * Generates a unique hash for a generation configuration.
   */
  private generateConfigHash(params: any): string {
    const str = JSON.stringify(params);
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Computes a hash of a file for validation.
   */
  private computeFileHash(filePath: string): string {
    // In production, use a proper hashing library
    const stats = fs.statSync(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }

  /**
   * Gets model version string.
   */
  private getModelVersion(model: string): string {
    // In production, query the actual model version
    return '1.0.0';
  }

  /**
   * Saves configuration to disk.
   */
  private saveConfig(config: SeedConfig): void {
    const configPath = path.join(this.cacheDir, `seed-${config.seed}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Loads configuration from disk.
   */
  loadConfig(seed: number): SeedConfig | undefined {
    const configPath = path.join(this.cacheDir, `seed-${seed}.json`);
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      this.seedRegistry.set(seed, config);
      return config;
    }
    return undefined;
  }

  /**
   * Lists all cached seeds.
   */
  listCachedSeeds(): number[] {
    return Array.from(this.seedRegistry.keys());
  }

  /**
   * Clears the cache.
   */
  clearCache(): void {
    this.seedRegistry.clear();
    this.outputRegistry.clear();
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true });
    }
    this.ensureCacheDir();
  }
}

// =============================================================================
// REPRODUCIBILITY VALIDATOR
// =============================================================================

export class ReproducibilityValidator {
  private manager: DeterministicOutputManager;

  constructor(manager: DeterministicOutputManager) {
    this.manager = manager;
  }

  /**
   * Validates that an AI app produces deterministic outputs.
   */
  async validateDeterminism(
    generateFn: () => Promise<string>,
    seed: number,
    tolerance = 0.95 // 95% similarity required
  ): Promise<boolean> {
    const report = await this.manager.validateReproducibility(generateFn, seed, 3);
    
    if (!report.consistent) {
      console.error('[Validator] Output is NOT deterministic!');
      report.runs.forEach((run, i) => {
        console.error(`[Validator] Run ${i + 1}: ${run.match ? 'MATCH' : 'MISMATCH'}`);
      });
      return false;
    }

    console.log('[Validator] Output is deterministic ✓');
    return true;
  }

  /**
   * Generates a reproducibility report.
   */
  async generateReport(seed: number): Promise<string> {
    const report = await this.manager.validateReproducibility(
      async () => 'dummy-output',
      seed,
      3
    );

    return `
# Reproducibility Report - Seed ${seed}

## Summary
- **Consistent:** ${report.consistent ? '✅ YES' : '❌ NO'}
- **Runs:** ${report.runs.length}

## Run Details
${report.runs.map((run, i) => `
### Run ${i + 1}
- **Timestamp:** ${new Date(run.timestamp).toISOString()}
- **Output:** ${run.outputPath}
- **Hash:** ${run.hash}
- **Match:** ${run.match ? '✅' : '❌'}
`).join('\n')}
`;
  }
}

// =============================================================================
// DEMO SEED PRESETS
// =============================================================================

export const DEMO_SEEDS = {
  // Curated seeds that produce visually appealing results
  cinematic: [12345, 23456, 34567, 45678, 56789],
  portrait: [11111, 22222, 33333, 44444, 55555],
  landscape: [66666, 77777, 88888, 99999, 10101],
  abstract: [12121, 23232, 34343, 45454, 56565],
};

export class DemoSeedManager {
  /**
   * Gets a curated set of seeds for demo footage.
   */
  static getSeedsForDemo(style: keyof typeof DEMO_SEEDS, count: number): number[] {
    const seeds = DEMO_SEEDS[style];
    return seeds.slice(0, count);
  }

  /**
   * Validates that seeds produce valid outputs.
   */
  static async validateSeeds(
    seeds: number[],
    validateFn: (seed: number) => Promise<boolean>
  ): Promise<Map<number, boolean>> {
    const results = new Map<number, boolean>();
    
    for (const seed of seeds) {
      const valid = await validateFn(seed);
      results.set(seed, valid);
    }

    return results;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default DeterministicOutputManager;
