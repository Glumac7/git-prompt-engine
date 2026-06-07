import * as fs from 'fs/promises';
import * as path from 'path';
import { EngineOptions, PromptTemplate, MessageTemplate, PromptTemplateSchema, TelemetryEvent } from './types/index.js';

export * from './types/index.js';

interface CacheEntry {
  template: PromptTemplate;
  expiresAt: number;
}

export class PromptEngine {
  private static readonly TEMPLATE_REGEX = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

  private options: EngineOptions;
  private cache: Map<string, CacheEntry>;
  private pendingReads: Map<string, Promise<PromptTemplate>>;

  constructor(options: EngineOptions) {
    this.options = {
      ...options,
    };
    this.cache = new Map();
    this.pendingReads = new Map();
  }

  /**
   * Clears the in-memory cache completely.
   */
  public clearCache(): void {
    this.cache.clear();
    this.pendingReads.clear();
  }

  /**
   * Retrieves the prompt template by promptId, checking cache first if TTL is active.
   */
  public async getTemplate(promptId: string): Promise<PromptTemplate> {
    const hasTtl = typeof this.options.cacheTtl === 'number' && this.options.cacheTtl > 0;
    
    if (hasTtl) {
      const cached = this.cache.get(promptId);
      if (cached) {
        if (Date.now() < cached.expiresAt) {
          this.options.onTelemetry?.({
            type: 'cache_hit',
            promptId,
            durationMs: 0,
            success: true,
          });
          return cached.template;
        } else {
          // Surpasses assigned TTL window, invalidate the cache
          this.cache.delete(promptId);
        }
      }
      this.options.onTelemetry?.({
        type: 'cache_miss',
        promptId,
        durationMs: 0,
        success: true,
      });
    }

    let pending = this.pendingReads.get(promptId);
    if (!pending) {
      pending = this.readTemplateFromDisk(promptId);
      this.pendingReads.set(promptId, pending);

      pending.then(
        (template) => {
          this.pendingReads.delete(promptId);
          if (hasTtl) {
            this.cache.set(promptId, {
              template,
              expiresAt: Date.now() + (this.options.cacheTtl || 0),
            });
          }
        },
        () => {
          this.pendingReads.delete(promptId);
        }
      );
    }

    return pending;
  }

  /**
   * Compiles the prompt template with runtime variables.
   * Cross-references the keys of the incoming runtime payload against the prompt's requiredVariables.
   * Throws an explicit evaluation error if any required variables are missing.
   */
  public async compile(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    return this.compileInternal(promptId, variables);
  }

  /**
   * Alias for compile. Compiles the prompt template with runtime variables.
   */
  public async getCompiledPrompt(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    return this.compile(promptId, variables);
  }

  private async compileInternal(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    const startCompile = performance.now();
    try {
      const template = await this.getTemplate(promptId);

      const mergedVariables = {
        ...this.options.fallbackParams,
        ...variables,
      };

      if (template.requiredVariables && Array.isArray(template.requiredVariables)) {
        for (const required of template.requiredVariables) {
          if (mergedVariables[required] === undefined) {
            const err = new Error(
              `Evaluation Error: Missing required application parameter "${required}" for prompt template "${promptId}". (Missing required variable(s): ${required})`
            );
            this.options.onTelemetry?.({
              type: 'compile',
              promptId,
              durationMs: performance.now() - startCompile,
              success: false,
              error: err.message,
            });
            throw err;
          }
        }
      }

      const result = template.messages.map((msg) => {
        const content = msg.content.replace(PromptEngine.TEMPLATE_REGEX, (match, key) => {
          const val = mergedVariables[key];
          return val !== undefined ? val : match;
        });

        return {
          role: msg.role,
          content,
        };
      });

      this.options.onTelemetry?.({
        type: 'compile',
        promptId,
        durationMs: performance.now() - startCompile,
        success: true,
      });

      return result;
    } catch (err) {
      this.options.onTelemetry?.({
        type: 'compile',
        promptId,
        durationMs: performance.now() - startCompile,
        success: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * Retrieves the prompt template and interpolates variables.
   * Delegates to the core compile method.
   */
  public async render(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    return this.compile(promptId, variables);
  }

  private async readTemplateFromDisk(promptId: string): Promise<PromptTemplate> {
    const resolvedPromptDir = path.resolve(this.options.promptDir);
    const filePath = path.resolve(resolvedPromptDir, `${promptId}.json`);

    const isWithinDir = resolvedPromptDir === path.sep
      ? filePath.startsWith(resolvedPromptDir)
      : filePath.startsWith(resolvedPromptDir + path.sep);

    if (!isWithinDir) {
      const err = new Error(`Security Error: Path traversal detected for promptId "${promptId}"`);
      this.options.onTelemetry?.({
        type: 'read_file',
        promptId,
        durationMs: 0,
        success: false,
        error: err.message,
      });
      throw err;
    }
    
    let rawContent: string;
    const startRead = performance.now();
    try {
      rawContent = await fs.readFile(filePath, 'utf-8');
      this.options.onTelemetry?.({
        type: 'read_file',
        promptId,
        durationMs: performance.now() - startRead,
        success: true,
      });
    } catch (err) {
      this.options.onTelemetry?.({
        type: 'read_file',
        promptId,
        durationMs: performance.now() - startRead,
        success: false,
        error: (err as Error).message,
      });
      throw new Error(`Failed to load prompt template "${promptId}" at path "${filePath}": ${(err as Error).message}`);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (err) {
      throw new Error(`Failed to parse prompt template "${promptId}" as JSON: ${(err as Error).message}`);
    }

    let template: PromptTemplate;
    const startVal = performance.now();
    try {
      template = PromptTemplateSchema.parse(parsedJson);
      this.options.onTelemetry?.({
        type: 'schema_validation',
        promptId,
        durationMs: performance.now() - startVal,
        success: true,
      });
    } catch (err) {
      this.options.onTelemetry?.({
        type: 'schema_validation',
        promptId,
        durationMs: performance.now() - startVal,
        success: false,
        error: (err as Error).message,
      });
      throw new Error(`Prompt template "${promptId}" at "${filePath}" failed schema validation: ${(err as Error).message}`);
    }

    return template;
  }
}
