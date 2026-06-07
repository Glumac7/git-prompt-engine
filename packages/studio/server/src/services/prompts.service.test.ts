import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { PromptEngine } from '@git-prompt-engine/core';
import { PromptsService } from './prompts.service.js';

describe('PromptsService', () => {
  let tempDir: string;
  let engine: PromptEngine;
  let service: PromptsService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompts-service-tests-'));
    engine = new PromptEngine({
      promptDir: tempDir,
      cacheTtl: 0,
    });
    service = new PromptsService(tempDir, engine);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should list prompts in directory', async () => {
    const validPrompt = {
      id: 'test-prompt',
      name: 'Test Prompt',
      messages: [{ role: 'user', content: 'Hello' }],
      requiredVariables: [],
    };
    await fs.writeFile(
      path.join(tempDir, 'test-prompt.json'),
      JSON.stringify(validPrompt, null, 2)
    );

    const prompts = await service.listPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].id).toBe('test-prompt');
  });

  it('should save and validate prompts', async () => {
    const payload = {
      id: 'new-prompt',
      name: 'New Prompt',
      messages: [{ role: 'system', content: 'Hello {{name}}' }],
      requiredVariables: ['name'],
    };

    const saved = await service.savePrompt('new-prompt', payload);
    expect(saved).toEqual(payload);

    const content = await fs.readFile(path.join(tempDir, 'new-prompt.json'), 'utf-8');
    expect(JSON.parse(content)).toEqual(payload);
  });

  it('should throw on path traversal or invalid id', async () => {
    await expect(service.savePrompt('../../invalid', {})).rejects.toThrow();
  });
});
