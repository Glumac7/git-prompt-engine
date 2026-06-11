import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
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
    const promptIds = new Set<string>();

    for (const file of files) {
      let id: string | null = null;
      if (file.endsWith('.json')) {
        id = path.basename(file, '.json');
      } else if (file.endsWith('.yaml')) {
        id = path.basename(file, '.yaml');
      } else if (file.endsWith('.yml')) {
        id = path.basename(file, '.yml');
      }

      if (id && !promptIds.has(id)) {
        promptIds.add(id);
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

    const jsonPath = path.join(this.promptDir, `${id}.json`);
    const yamlPath = path.join(this.promptDir, `${id}.yaml`);
    const ymlPath = path.join(this.promptDir, `${id}.yml`);

    if (!isSafePath(jsonPath, this.promptDir) || !isSafePath(yamlPath, this.promptDir) || !isSafePath(ymlPath, this.promptDir)) {
      throw new Error('Security Error: Path traversal detected');
    }

    let targetPath = jsonPath;
    let format: 'json' | 'yaml' = 'json';

    let yamlExists = false;
    try {
      await fs.access(yamlPath);
      yamlExists = true;
    } catch {}

    let ymlExists = false;
    try {
      await fs.access(ymlPath);
      ymlExists = true;
    } catch {}

    if (yamlExists) {
      targetPath = yamlPath;
      format = 'yaml';
    } else if (ymlExists) {
      targetPath = ymlPath;
      format = 'yaml';
    } else {
      targetPath = jsonPath;
      format = 'json';
    }

    // 1. Zod validation
    const validatedPayload = PromptTemplateSchema.parse(payload);

    // Verify the payload's ID matches the route parameter
    if (validatedPayload.id !== id) {
      throw new Error(`Payload ID "${validatedPayload.id}" does not match URL path ID "${id}"`);
    }

    // 2. Atomic write
    const tempPath = `${targetPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const content = format === 'json'
      ? JSON.stringify(validatedPayload, null, 2)
      : stringifyYaml(validatedPayload);

    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, targetPath);

    // Clear the prompt engine cache for this template to ensure freshness
    this.engine.clearCache();

    return validatedPayload;
  }
}
