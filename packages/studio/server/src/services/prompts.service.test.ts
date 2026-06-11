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

  it('should list YAML/YML prompts in directory', async () => {
    const yamlPrompt = {
      id: 'yaml-prompt',
      name: 'YAML Prompt',
      messages: [{ role: 'user', content: 'Hello YAML' }],
      requiredVariables: [],
    };
    const ymlPrompt = {
      id: 'yml-prompt',
      name: 'YML Prompt',
      messages: [{ role: 'user', content: 'Hello YML' }],
      requiredVariables: [],
    };

    await fs.writeFile(
      path.join(tempDir, 'yaml-prompt.yaml'),
      `id: yaml-prompt\nname: YAML Prompt\nmessages:\n  - role: user\n    content: Hello YAML\nrequiredVariables: []`
    );
    await fs.writeFile(
      path.join(tempDir, 'yml-prompt.yml'),
      `id: yml-prompt\nname: YML Prompt\nmessages:\n  - role: user\n    content: Hello YML\nrequiredVariables: []`
    );

    const prompts = await service.listPrompts();
    expect(prompts.map(p => p.id)).toContain('yaml-prompt');
    expect(prompts.map(p => p.id)).toContain('yml-prompt');
  });

  it('should save to existing .yaml/.yml file as YAML', async () => {
    const id = 'existing-yaml';
    await fs.writeFile(
      path.join(tempDir, `${id}.yaml`),
      `id: ${id}\nname: Old Name\nmessages: []\nrequiredVariables: []`
    );

    const payload = {
      id,
      name: 'New YAML Name',
      messages: [{ role: 'user', content: 'Hello YAML {{name}}' }],
      requiredVariables: ['name'],
    };

    const saved = await service.savePrompt(id, payload);
    expect(saved).toEqual(payload);

    const content = await fs.readFile(path.join(tempDir, `${id}.yaml`), 'utf-8');
    expect(content).toContain('name: New YAML Name');
    expect(content).toContain('role: user');

    await expect(fs.access(path.join(tempDir, `${id}.json`))).rejects.toThrow();
  });

  it('should throw on path traversal or invalid id', async () => {
    await expect(service.savePrompt('../../invalid', {})).rejects.toThrow();
  });
});
