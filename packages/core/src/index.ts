import * as fs from 'fs/promises';
import * as path from 'path';
import { EngineOptions, PromptTemplate, MessageTemplate, PromptTemplateSchema } from './types/index.js';

export * from './types/index.js';

interface CacheEntry {
  template: PromptTemplate;
  expiresAt: number;
}

export class PromptEngine {
  private static readonly TEMPLATE_REGEX = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

  private options: EngineOptions;
  private cache: Map<string, CacheEntry>;

  constructor(options: EngineOptions) {
    this.options = {
      ...options,
    };
    this.cache = new Map();
  }

  /**
   * Clears the in-memory cache completely.
   */
  public clearCache(): void {
    this.cache.clear();
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
          return cached.template;
        } else {
          // Surpasses assigned TTL window, invalidate the cache
          this.cache.delete(promptId);
        }
      }
    }

    const template = await this.readTemplateFromDisk(promptId);

    if (hasTtl) {
      this.cache.set(promptId, {
        template,
        expiresAt: Date.now() + (this.options.cacheTtl || 0),
      });
    }

    return template;
  }

  /**
   * Compiles the prompt template with runtime variables.
   * Cross-references the keys of the incoming runtime payload against the prompt's requiredVariables.
   * Throws an explicit evaluation error if any required variables are missing.
   */
  public async compile(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    const template = await this.getTemplate(promptId);

    const mergedVariables = {
      ...this.options.fallbackParams,
      ...variables,
    };

    if (template.requiredVariables && Array.isArray(template.requiredVariables)) {
      for (const required of template.requiredVariables) {
        if (mergedVariables[required] === undefined) {
          throw new Error(
            `Evaluation Error: Missing required application parameter "${required}" for prompt template "${promptId}". (Missing required variable(s): ${required})`
          );
        }
      }
    }

    return template.messages.map((msg) => {
      const content = msg.content.replace(PromptEngine.TEMPLATE_REGEX, (match, key) => {
        const val = mergedVariables[key];
        return val !== undefined ? val : match;
      });

      return {
        role: msg.role,
        content,
      };
    });
  }

  /**
   * Retrieves the prompt template and interpolates variables.
   * Delegates to the core compile method.
   */
  public async render(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    return this.compile(promptId, variables);
  }

  private async readTemplateFromDisk(promptId: string): Promise<PromptTemplate> {
    const filePath = path.join(this.options.promptDir, `${promptId}.json`);
    
    let rawContent: string;
    try {
      rawContent = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to load prompt template "${promptId}" at path "${filePath}": ${(err as Error).message}`);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (err) {
      throw new Error(`Failed to parse prompt template "${promptId}" as JSON: ${(err as Error).message}`);
    }

    let template: PromptTemplate;
    try {
      template = PromptTemplateSchema.parse(parsedJson);
    } catch (err) {
      throw new Error(`Prompt template "${promptId}" at "${filePath}" failed schema validation: ${(err as Error).message}`);
    }

    return template;
  }
}
