import * as fs from 'fs/promises';
import * as path from 'path';
import { EngineOptions, PromptTemplate, MessageTemplate } from './types/index.js';

export * from './types/index.js';

interface CacheEntry {
  template: PromptTemplate;
  expiresAt: number;
}

export class PromptEngine {
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
   * Retrieves the prompt template and interpolates variables.
   */
  public async render(promptId: string, variables: Record<string, string> = {}): Promise<MessageTemplate[]> {
    const template = await this.getTemplate(promptId);
    return this.interpolate(template, variables);
  }

  private async readTemplateFromDisk(promptId: string): Promise<PromptTemplate> {
    const filePath = path.join(this.options.promptDir, `${promptId}.json`);
    
    let rawContent: string;
    try {
      rawContent = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to load prompt template "${promptId}" at path "${filePath}": ${(err as Error).message}`);
    }

    let template: PromptTemplate;
    try {
      template = JSON.parse(rawContent);
    } catch (err) {
      throw new Error(`Failed to parse prompt template "${promptId}" as JSON: ${(err as Error).message}`);
    }

    // Basic runtime check
    if (!template || !Array.isArray(template.messages)) {
      throw new Error(`Invalid prompt template structure for "${promptId}": messages array is required`);
    }

    return template;
  }

  private interpolate(template: PromptTemplate, variables: Record<string, string>): MessageTemplate[] {
    const mergedVariables = {
      ...this.options.fallbackParams,
      ...variables,
    };

    // Check for missing required variables
    if (template.requiredVariables && Array.isArray(template.requiredVariables)) {
      const missing: string[] = [];
      for (const required of template.requiredVariables) {
        if (mergedVariables[required] === undefined) {
          missing.push(required);
        }
      }
      if (missing.length > 0) {
        throw new Error(`Missing required variable(s): ${missing.join(', ')}`);
      }
    }

    // Interpolate placeholders: {{variableName}}
    return template.messages.map((msg) => {
      let content = msg.content;
      content = content.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
        const val = mergedVariables[key];
        return val !== undefined ? val : match;
      });

      return {
        role: msg.role,
        content,
      };
    });
  }
}
