import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptEngine } from './index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PromptEngine', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for prompt files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-engine-tests-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('should load a prompt template from disk, interpolate variables, and return message templates', async () => {
    const promptId = 'welcome-email';
    const templateContent = {
      id: promptId,
      name: 'Welcome Email',
      messages: [
        { role: 'system', content: 'You are an onboarding assistant.' },
        { role: 'user', content: 'Welcome to the platform, {{name}}! Your role is {{role}}.' }
      ],
      requiredVariables: ['name', 'role']
    };

    await fs.writeFile(
      path.join(tempDir, `${promptId}.json`),
      JSON.stringify(templateContent, null, 2)
    );

    const engine = new PromptEngine({ promptDir: tempDir });
    const messages = await engine.render(promptId, { name: 'Alice', role: 'Developer' });

    expect(messages).toEqual([
      { role: 'system', content: 'You are an onboarding assistant.' },
      { role: 'user', content: 'Welcome to the platform, Alice! Your role is Developer.' }
    ]);
  });

  it('should support spaces in placeholder tags', async () => {
    const promptId = 'space-tags';
    const templateContent = {
      id: promptId,
      name: 'Space Tags',
      messages: [
        { role: 'user', content: 'Hello {{ name }}! Welcome to {{   company   }}.' }
      ],
      requiredVariables: ['name', 'company']
    };

    await fs.writeFile(
      path.join(tempDir, `${promptId}.json`),
      JSON.stringify(templateContent, null, 2)
    );

    const engine = new PromptEngine({ promptDir: tempDir });
    const messages = await engine.render(promptId, { name: 'Bob', company: 'Google' });

    expect(messages).toEqual([
      { role: 'user', content: 'Hello Bob! Welcome to Google.' }
    ]);
  });

  it('should use fallback parameters if variables are missing from the render request', async () => {
    const promptId = 'welcome-email';
    const templateContent = {
      id: promptId,
      name: 'Welcome Email',
      messages: [
        { role: 'user', content: 'Welcome to {{company}}, {{name}}!' }
      ],
      requiredVariables: ['name', 'company']
    };

    await fs.writeFile(
      path.join(tempDir, `${promptId}.json`),
      JSON.stringify(templateContent, null, 2)
    );

    const engine = new PromptEngine({
      promptDir: tempDir,
      fallbackParams: { company: 'Acme Corp' }
    });

    // name is provided, company is omitted and should use fallbackParams
    const messages = await engine.render(promptId, { name: 'Alice' });

    expect(messages).toEqual([
      { role: 'user', content: 'Welcome to Acme Corp, Alice!' }
    ]);
  });

  it('should throw an error if a required variable is missing from both variables and fallbackParams', async () => {
    const promptId = 'missing-vars';
    const templateContent = {
      id: promptId,
      name: 'Missing Vars',
      messages: [
        { role: 'user', content: 'Welcome to {{company}}, {{name}}!' }
      ],
      requiredVariables: ['name', 'company']
    };

    await fs.writeFile(
      path.join(tempDir, `${promptId}.json`),
      JSON.stringify(templateContent, null, 2)
    );

    const engine = new PromptEngine({ promptDir: tempDir });

    await expect(engine.render(promptId, { name: 'Alice' })).rejects.toThrow(
      /Missing required variable\(s\): company/
    );
  });

  it('should hit the disk only once when caching is enabled and TTL is active', async () => {
    const promptId = 'cached-prompt';
    const templateContent = {
      id: promptId,
      name: 'Cached Prompt',
      messages: [{ role: 'user', content: 'Counter: {{count}}' }],
      requiredVariables: ['count']
    };

    const filePath = path.join(tempDir, `${promptId}.json`);
    await fs.writeFile(filePath, JSON.stringify(templateContent, null, 2));

    const engine = new PromptEngine({
      promptDir: tempDir,
      cacheTtl: 5000 // 5 seconds
    });

    // First load hits disk
    const messages1 = await engine.render(promptId, { count: '1' });
    expect(messages1[0].content).toBe('Counter: 1');

    // Overwrite the file on disk to see if engine returns cached version
    const updatedContent = {
      id: promptId,
      name: 'Cached Prompt',
      messages: [{ role: 'user', content: 'New Counter: {{count}}' }],
      requiredVariables: ['count']
    };
    await fs.writeFile(filePath, JSON.stringify(updatedContent, null, 2));

    // Second render should return cached version
    const messages2 = await engine.render(promptId, { count: '2' });
    expect(messages2[0].content).toBe('Counter: 2'); // Still old template structure
  });

  it('should invalidate cache and hit disk when TTL expires', async () => {
    vi.useFakeTimers();
    const mockStartTime = 1000000;
    vi.setSystemTime(mockStartTime);

    const promptId = 'ttl-prompt';
    const templateContent = {
      id: promptId,
      name: 'TTL Prompt',
      messages: [{ role: 'user', content: 'Value: {{val}}' }],
      requiredVariables: ['val']
    };

    const filePath = path.join(tempDir, `${promptId}.json`);
    await fs.writeFile(filePath, JSON.stringify(templateContent, null, 2));

    const engine = new PromptEngine({
      promptDir: tempDir,
      cacheTtl: 5000 // 5 seconds
    });

    // 1st Render (loads from disk, caches it)
    await engine.render(promptId, { val: 'A' });

    // Modify disk template
    const updatedContent = {
      id: promptId,
      name: 'TTL Prompt',
      messages: [{ role: 'user', content: 'New Value: {{val}}' }],
      requiredVariables: ['val']
    };
    await fs.writeFile(filePath, JSON.stringify(updatedContent, null, 2));

    // Advance time by 4.9 seconds (within TTL window)
    vi.setSystemTime(mockStartTime + 4900);
    const render2 = await engine.render(promptId, { val: 'B' });
    expect(render2[0].content).toBe('Value: B'); // Cached

    // Advance time past TTL window (total 5.1 seconds)
    vi.setSystemTime(mockStartTime + 5100);
    const render3 = await engine.render(promptId, { val: 'C' });
    expect(render3[0].content).toBe('New Value: C'); // Refreshed from disk
  });

  it('should throw clean errors if file is missing or contains invalid JSON', async () => {
    const engine = new PromptEngine({ promptDir: tempDir });

    // Test missing file
    await expect(engine.render('non-existent')).rejects.toThrow(
      /Failed to load prompt template "non-existent"/
    );

    // Test malformed JSON
    const promptId = 'bad-json';
    await fs.writeFile(path.join(tempDir, `${promptId}.json`), '{"invalid json...');
    await expect(engine.render(promptId)).rejects.toThrow(
      /Failed to parse prompt template "bad-json"/
    );
  });

  it('should throw a detailed validation error if the prompt template fails schema validation and not cache it', async () => {
    const promptId = 'invalid-schema-prompt';
    // Missing required fields 'id' and 'name'
    const templateContent = {
      messages: [
        { role: 'invalid-role', content: 'Hello' }
      ],
      requiredVariables: []
    };

    const filePath = path.join(tempDir, `${promptId}.json`);
    await fs.writeFile(filePath, JSON.stringify(templateContent, null, 2));

    const engine = new PromptEngine({ promptDir: tempDir, cacheTtl: 5000 });

    // 1st render attempt: should fail Zod validation
    await expect(engine.render(promptId)).rejects.toThrow(
      /Prompt template "invalid-schema-prompt" at ".*" failed schema validation/
    );

    // Now write a valid template to the same file
    const validContent = {
      id: promptId,
      name: 'Valid Schema Prompt',
      messages: [
        { role: 'user', content: 'Hello!' }
      ],
      requiredVariables: []
    };
    await fs.writeFile(filePath, JSON.stringify(validContent, null, 2));

    // 2nd render attempt: should succeed because the first failed attempt did NOT cache the bad configuration
    const messages = await engine.render(promptId);
    expect(messages).toEqual([{ role: 'user', content: 'Hello!' }]);
  });
});
