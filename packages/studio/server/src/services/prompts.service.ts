import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PromptEngine, PromptTemplate, PromptTemplateSchema } from '@git-prompt-engine/core';
import { isSafePath, ID_REGEX } from '../utils/path.js';

export class PromptsService {
  constructor(
    private readonly promptDir: string,
    private readonly engine: PromptEngine
  ) {}

  public async listPrompts(): Promise<PromptTemplate[]> {
    const files = await fs.readdir(this.promptDir);
    const prompts: PromptTemplate[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const id = path.basename(file, '.json');
        try {
          const template = await this.engine.getTemplate(id);
          prompts.push(template);
        } catch (err) {
          console.warn(`[Studio Server] Skipping corrupted file "${file}":`, (err as Error).message);
        }
      }
    }

    return prompts;
  }

  public async savePrompt(id: string, payload: unknown): Promise<PromptTemplate> {
    if (!ID_REGEX.test(id)) {
      throw new Error('Invalid prompt ID format');
    }

    const filePath = path.join(this.promptDir, `${id}.json`);
    if (!isSafePath(filePath, this.promptDir)) {
      throw new Error('Security Error: Path traversal detected');
    }

    // 1. Zod validation
    const validatedPayload = PromptTemplateSchema.parse(payload);

    // Verify the payload's ID matches the route parameter
    if (validatedPayload.id !== id) {
      throw new Error(`Payload ID "${validatedPayload.id}" does not match URL path ID "${id}"`);
    }

    // 2. Atomic write
    const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await fs.writeFile(tempPath, JSON.stringify(validatedPayload, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);

    // Clear the prompt engine cache for this template to ensure freshness
    this.engine.clearCache();

    return validatedPayload;
  }
}
