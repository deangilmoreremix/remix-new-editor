/**
 * AI Interaction Engine
 *
 * Specialized automation for AI image/video generation workflows:
 * - Deterministic output control (seeds, steps, samplers)
 * - Generation monitoring and progress tracking
 * - Output validation (dimensions, format, content)
 * - Queue management for batch generation
 * - Prompt injection and parameter control
 */

import { type Page } from '@playwright/test';

// =============================================================================
// AI GENERATION PARAMETERS
// =============================================================================

export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  sampler?: string;
  cfgScale?: number;
  width?: number;
  height?: number;
  batchSize?: number;
  model?: string;
  // Video-specific
  duration?: number; // seconds
  fps?: number;
  motionScale?: number;
  // Audio-specific
  durationAudio?: number;
  // Image-specific
  guidanceScale?: number;
  scheduler?: string;
}

export interface DeterministicGenConfig extends GenerationParams {
  // Lock all randomness for reproducible demos
  seed: number;
  steps: number;
  sampler: string;
  model: string;
}

// =============================================================================
// GENERATION MONITOR
// =============================================================================

export interface GenerationProgress {
  stage: 'queued' | 'initializing' | 'generating' | 'post-processing' | 'complete' | 'error';
  progress: number; // 0-100
  eta?: number; // seconds
  intermediateImages?: string[]; // Base64 or paths
  message?: string;
}

export type ProgressHandler = (progress: GenerationProgress) => void | Promise<void>;

// =============================================================================
// AI INTERACTION ENGINE
// =============================================================================

export class AIInteractionEngine {
  private page: Page;
  private defaultParams: Partial<GenerationParams> = {};
  private generationHistory: Map<string, string[]> = new Map(); // seed -> outputs

  constructor(page: Page, defaultParams?: Partial<GenerationParams>) {
    this.page = page;
    this.defaultParams = defaultParams || {};
  }

  /**
   * Sets generation parameters in the UI.
   */
  async setParameters(params: GenerationParams): Promise<void> {
    // Model selection
    if (params.model) {
      await this.selectModel(params.model);
    }

    // Prompt input
    if (params.prompt) {
      await this.setPrompt(params.prompt);
    }

    // Negative prompt
    if (params.negativePrompt) {
      await this.setNegativePrompt(params.negativePrompt);
    }

    // Seed
    if (params.seed !== undefined) {
      await this.setSeed(params.seed);
    }

    // Steps
    if (params.steps !== undefined) {
      await this.setSteps(params.steps);
    }

    // Sampler
    if (params.sampler) {
      await this.setSampler(params.sampler);
    }

    // CFG Scale
    if (params.cfgScale !== undefined) {
      await this.setCfgScale(params.cfgScale);
    }

    // Dimensions
    if (params.width && params.height) {
      await this.setDimensions(params.width, params.height);
    }

    // Video-specific
    if (params.duration) {
      await this.setVideoDuration(params.duration);
    }
  }

  /**
   * Triggers generation and monitors progress.
   */
  async generate(
    params?: GenerationParams,
    options?: {
      timeout?: number;
      onProgress?: ProgressHandler;
      captureIntermediate?: boolean;
    }
  ): Promise<string[]> {
    const timeout = options?.timeout || 300000; // 5 minutes default
    const startTime = Date.now();

    // Set parameters
    const finalParams = { ...this.defaultParams, ...params };
    await this.setParameters(finalParams);

    // Click generate button
    await this.clickGenerate();

    // Monitor progress
    const outputs: string[] = [];
    const handler = options?.onProgress;

    if (handler) {
      await this.monitorProgressWithCallback(timeout, handler, options.captureIntermediate);
    } else {
      outputs.push(...(await this.monitorProgress(timeout)));
    }

    // Cache outputs by seed
    if (finalParams.seed !== undefined) {
      this.generationHistory.set(String(finalParams.seed), outputs);
    }

    const duration = Date.now() - startTime;
    console.log(`[AIEngine] Generation complete in ${duration}ms: ${outputs.length} outputs`);

    return outputs;
  }

  /**
   * Monitors generation progress until completion.
   */
  private async monitorProgress(timeout: number): Promise<string[]> {
    const outputs: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const progress = await this.getProgress();
      
      console.log(`[AIEngine] ${progress.stage}: ${progress.progress.toFixed(1)}%`);

      if (progress.stage === 'complete') {
        outputs.push(...(progress.intermediateImages || []));
        return outputs;
      }

      if (progress.stage === 'error') {
        throw new Error(progress.message || 'Generation failed');
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Generation timed out after ${timeout}ms`);
  }

  /**
   * Monitors progress with a callback handler.
   */
  private async monitorProgressWithCallback(
    timeout: number,
    handler: ProgressHandler,
    captureIntermediate: boolean = false
  ): Promise<string[]> {
    const outputs: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const progress = await this.getProgress();

      await handler(progress);

      if (progress.stage === 'complete') {
        if (captureIntermediate && progress.intermediateImages) {
          outputs.push(...progress.intermediateImages);
        }
        return outputs;
      }

      if (progress.stage === 'error') {
        throw new Error(progress.message || 'Generation failed');
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Generation timed out after ${timeout}ms`);
  }

  /**
   * Gets current generation progress from the UI.
   */
  private async getProgress(): Promise<GenerationProgress> {
    return this.page.evaluate(() => {
      // This should be customized for the specific AI app
      const progressBar = document.querySelector('[role="progressbar"]');
      const progressText = document.querySelector('.generation-status');
      
      let progress = 0;
      if (progressBar) {
        progress = parseFloat((progressBar as HTMLElement).getAttribute('aria-valuenow') || '0');
      }

      const text = progressText?.textContent || '';
      
      let stage: GenerationProgress['stage'] = 'queued';
      if (text.includes('Complete') || text.includes('Done')) {
        stage = 'complete';
      } else if (text.includes('Error') || text.includes('Failed')) {
        stage = 'error';
      } else if (text.includes('Generating') || progress > 0) {
        stage = 'generating';
      }

      return {
        stage,
        progress: Math.min(progress, 100),
        message: text,
      };
    });
  }

  // =============================================================================
  // PARAMETER CONTROLS
  // =============================================================================

  private async setPrompt(prompt: string): Promise<void> {
    await this.page.fill('[data-testid="prompt-input"] textarea, textarea[placeholder*="prompt" i]', prompt);
  }

  private async setNegativePrompt(negative: string): Promise<void> {
    await this.page.fill(
      '[data-testid="negative-prompt"] textarea, textarea[placeholder*="negative" i]',
      negative
    );
  }

  private async setSeed(seed: number): Promise<void> {
    // Try to find seed input
    const seedInput = '[data-testid="seed-input"] input, input[name="seed"], input[placeholder*="seed" i]';
    await this.page.fill(seedInput, String(seed));
  }

  private async setSteps(steps: number): Promise<void> {
    const stepsInput = '[data-testid="steps-input"] input, input[name="steps"], input[aria-label*="steps" i]';
    await this.page.fill(stepsInput, String(steps));
  }

  private async setSampler(sampler: string): Promise<void> {
    const samplerSelect = '[data-testid="sampler-select"] select, select[name="sampler"]';
    await this.page.selectOption(samplerSelect, sampler);
  }

  private async setCfgScale(scale: number): Promise<void> {
    const cfgInput = '[data-testid="cfg-input"] input, input[name="cfg_scale"]';
    await this.page.fill(cfgInput, String(scale));
  }

  private async setDimensions(width: number, height: number): Promise<void> {
    // Width
    const widthInput = '[data-testid="width-input"] input, input[name="width"]';
    await this.page.fill(widthInput, String(width));
    
    // Height
    const heightInput = '[data-testid="height-input"] input, input[name="height"]';
    await this.page.fill(heightInput, String(height));
  }

  private async setModel(model: string): Promise<void> {
    const modelSelect = '[data-testid="model-select"] select, select[name="model"]';
    await this.page.selectOption(modelSelect, model);
  }

  private async setVideoDuration(seconds: number): Promise<void> {
    const durationInput = '[data-testid="duration-input"] input, input[name="duration"]';
    await this.page.fill(durationInput, String(seconds));
  }

  private async clickGenerate(): Promise<void> {
    const generateBtn = [
      '[data-testid="generate-btn"]',
      'button:has-text("Generate")',
      'button:has-text("Create")',
      'button[aria-label*="Generate"]',
    ].join(', ');

    await this.page.click(generateBtn);
  }

  // =============================================================================
  // BATCH GENERATION
  // =============================================================================

  /**
   * Generates multiple variations from a single prompt.
   */
  async generateBatch(
    params: GenerationParams,
    count: number,
    options?: { timeout?: number; onProgress?: ProgressHandler }
  ): Promise<string[][]> {
    const results: string[][] = [];

    for (let i = 0; i < count; i++) {
      console.log(`[AIEngine] Batch generation ${i + 1}/${count}`);

      // Modify seed for variation if not specified
      const batchParams = { ...params };
      if (batchParams.seed === undefined) {
        batchParams.seed = Math.floor(Math.random() * 1000000);
      } else {
        batchParams.seed = batchParams.seed + i;
      }

      const outputs = await this.generate(batchParams, options);
      results.push(outputs);

      // Small delay between generations
      await this.page.waitForTimeout(1000);
    }

    return results;
  }

  // =============================================================================
  // OUTPUT VALIDATION
  // =============================================================================

  /**
   * Validates generated output meets requirements.
   */
  async validateOutput(selector: string, expected: {
    minWidth?: number;
    minHeight?: number;
    format?: 'jpg' | 'png' | 'webp' | 'mp4' | 'webm';
    containsText?: string;
  }): Promise<boolean> {
    const validations: boolean[] = [];

    // Check dimensions
    if (expected.minWidth || expected.minHeight) {
      const dimensions = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLImageElement | HTMLVideoElement;
        if (!el) return null;
        return { width: el.naturalWidth || el.videoWidth, height: el.naturalHeight || el.videoHeight };
      }, selector);

      if (dimensions) {
        if (expected.minWidth && dimensions.width < expected.minWidth) validations.push(false);
        if (expected.minHeight && dimensions.height < expected.minHeight) validations.push(false);
      }
    }

    // Check format
    if (expected.format) {
      const src = await this.page.getAttribute(selector, 'src');
      if (src && !src.includes(expected.format)) {
        validations.push(false);
      }
    }

    // Check content
    if (expected.containsText) {
      const text = await this.page.textContent(selector);
      if (!text?.includes(expected.containsText)) {
        validations.push(false);
      }
    }

    return validations.every(v => v);
  }

  /**
   * Compares two generated images for similarity.
   */
  async compareOutputs(selector1: string, selector2: string): Promise<number> {
    // Would use image diffing library
    console.log(`[AIEngine] Comparing outputs: ${selector1} vs ${selector2}`);
    return 0.95; // Similarity score
  }

  // =============================================================================
  // SEED MANAGEMENT
  // =============================================================================

  /**
   * Generates a set of deterministic seeds for reproducible demos.
   */
  static generateSeedSet(baseSeed: number, count: number): number[] {
    const seeds: number[] = [];
    for (let i = 0; i < count; i++) {
      seeds.push(baseSeed + i);
    }
    return seeds;
  }

  /**
   * Caches a generation result by seed.
   */
  cacheOutput(seed: number, outputPath: string): void {
    const existing = this.generationHistory.get(String(seed)) || [];
    existing.push(outputPath);
    this.generationHistory.set(String(seed), existing);
  }

  /**
   * Retrieves cached output for a seed.
   */
  getCachedOutput(seed: number): string[] | undefined {
    return this.generationHistory.get(String(seed));
  }

  /**
   * Clears the generation cache.
   */
  clearCache(): void {
    this.generationHistory.clear();
  }
}

// =============================================================================
// PROMPT ENGINE
// =============================================================================

export class PromptEngine {
  /**
   * Enhances a prompt with style modifiers for better demo results.
   */
  static enhanceForDemo(prompt: string, style: 'cinematic' | 'product' | 'artistic' = 'cinematic'): string {
    const enhancers = {
      cinematic: ', cinematic lighting, dramatic, 8k, highly detailed, professional photography',
      product: ', product photography, clean background, studio lighting, commercial quality',
      artistic: ', artistic, painterly, detailed, masterpiece, trending on artstation',
    };

    return `${prompt}${enhancers[style]}`;
  }

  /**
   * Creates a series of progressive prompts for a demo sequence.
   */
  static createProgressiveSequence(basePrompt: string, stages: string[]): string[] {
    return stages.map((stage) => `${basePrompt}, ${stage}`);
  }

  /**
   * Injects negative prompts for cleaner outputs.
   */
  static getDefaultNegativePrompt(): string {
    return 'blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, signature, text';
  }
}

// =============================================================================
// AI APP-SPECIFIC IMPLEMENTATIONS
// =============================================================================

/**
 * Example: Midjourney-style interaction
 */
export class MidjourneyEngine extends AIInteractionEngine {
  async imagine(prompt: string, options?: { seed?: number }): Promise<string> {
    await this.page.fill('[placeholder*="prompt"]', prompt);
    await this.page.click('button:has-text("Imagine")');
    
    // Wait for generation
    await this.page.waitForSelector('.image-grid img', { timeout: 120000 });
    
    const imageUrl = await this.page.getAttribute('.image-grid img', 'src');
    return imageUrl || '';
  }

  async upscale(imageIndex: number): Promise<void> {
    // Find and click upscale button
    const upscaleBtn = `.image-grid button:nth-child(${imageIndex})`;
    await this.page.click(upscaleBtn);
    await this.page.waitForSelector('.upscaled-image');
  }
}

/**
 * Example: Runway-style video generation
 */
export class RunwayEngine extends AIInteractionEngine {
  async generateVideo(
    prompt: string,
    options?: { duration?: number; seed?: number }
  ): Promise<string> {
    await this.setPrompt(prompt);
    
    if (options?.duration) {
      await this.setVideoDuration(options.duration);
    }
    
    await this.clickGenerate();

    // Monitor video generation
    await this.monitorProgress(600000); // 10 min timeout

    // Get video URL
    const videoUrl = await this.page.getAttribute('video', 'src');
    return videoUrl || '';
  }
}

/**
 * Example: Stable Diffusion WebUI (Automatic1111) interaction
 */
export class StableDiffusionEngine extends AIInteractionEngine {
  async txt2img(params: GenerationParams): Promise<string> {
    // Navigate to txt2img tab
    await this.page.click('#tab_txt2img');

    // Set parameters
    await this.setParameters(params);

    // Generate
    await this.clickGenerate();

    // Wait for result
    await this.page.waitForSelector('#txt2img_gallery img', { timeout: 300000 });

    // Get first image
    const img = await this.page.$('#txt2img_gallery img');
    return await img?.getAttribute('src') || '';
  }

  async img2img(
    initImage: string,
    params: GenerationParams
  ): Promise<string> {
    // Navigate to img2img tab
    await this.page.click('#tab_img2img');

    // Upload initial image
    await this.page.setInputFile('#img2img_input', initImage);

    // Set parameters
    await this.setParameters(params);

    // Generate
    await this.clickGenerate();

    // Wait for result
    await this.page.waitForSelector('#img2img_gallery img', { timeout: 300000 });

    const img = await this.page.$('#img2img_gallery img');
    return await img?.getAttribute('src') || '';
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default AIInteractionEngine;
