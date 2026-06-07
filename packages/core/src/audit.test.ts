import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
  };
});

import { PromptEngine } from './index.js';

describe('Security and Performance Audit', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-engine-audit-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should prevent path traversal attacks', async () => {
    const secretFileId = 'secret';
    const secretFileContent = {
      id: secretFileId,
      name: 'Secret Prompt',
      messages: [{ role: 'system', content: 'Secret info' }],
      requiredVariables: []
    };
    
    // Write secret file to parent directory (outside of tempDir)
    const parentDir = path.dirname(tempDir);
    const secretFilePath = path.join(parentDir, `${secretFileId}.json`);
    await fs.writeFile(secretFilePath, JSON.stringify(secretFileContent, null, 2));

    const engine = new PromptEngine({ promptDir: tempDir });

    try {
      // Attempt to load the template using a relative path that traverses upwards
      await expect(engine.render(`../${secretFileId}`)).rejects.toThrow(
        /Security Error: Path traversal/i
      );
    } finally {
      // Clean up secret file
      await fs.rm(secretFilePath, { force: true });
    }
  });

  it('should handle high-concurrency loops efficiently with caching', async () => {
    const promptId = 'concurrency-prompt';
    const templateContent = {
      id: promptId,
      name: 'Concurrency Prompt',
      messages: [{ role: 'user', content: 'Hello {{name}}!' }],
      requiredVariables: ['name']
    };
    await fs.writeFile(
      path.join(tempDir, `${promptId}.json`),
      JSON.stringify(templateContent, null, 2)
    );

    const engineWithCache = new PromptEngine({
      promptDir: tempDir,
      cacheTtl: 10000
    });

    const engineWithoutCache = new PromptEngine({
      promptDir: tempDir
    });

    const iterations = 500;
    const readFileMock = vi.mocked(fs.readFile);

    // 1. Run with cache
    readFileMock.mockClear();
    const startCache = performance.now();
    const cachePromises = Array.from({ length: iterations }).map(() =>
      engineWithCache.render(promptId, { name: 'Alice' })
    );
    await Promise.all(cachePromises);
    const endCache = performance.now();
    const durationWithCache = endCache - startCache;

    // Verify fs.readFile was only called ONCE because of promise sharing & caching
    expect(readFileMock).toHaveBeenCalledTimes(1);

    // 2. Run without cache (each sequential call will perform fs.readFile)
    readFileMock.mockClear();
    const startNoCache = performance.now();
    const noCacheSeqCount = 5;
    for (let i = 0; i < noCacheSeqCount; i++) {
      await engineWithoutCache.render(promptId, { name: 'Alice' });
    }
    const endNoCache = performance.now();
    const durationWithoutCache = endNoCache - startNoCache;

    // Verify fs.readFile was called for EVERY sequential request when caching is disabled
    expect(readFileMock).toHaveBeenCalledTimes(noCacheSeqCount);

    console.log(`[Audit] Duration with Cache (500 concurrent ops): ${durationWithCache.toFixed(2)}ms`);
    console.log(`[Audit] Duration without Cache (${noCacheSeqCount} sequential ops): ${durationWithoutCache.toFixed(2)}ms`);

    // Memory usage comparison
    const initialMem = process.memoryUsage().heapUsed;
    
    // Run another massive batch of 2000 operations under cache
    await Promise.all(
      Array.from({ length: 2000 }).map(() =>
        engineWithCache.render(promptId, { name: 'Alice' })
      )
    );
    
    const finalMem = process.memoryUsage().heapUsed;
    const memIncreaseKb = (finalMem - initialMem) / 1024;
    console.log(`[Audit] Heap memory usage delta after 2000 cached renders: ${memIncreaseKb.toFixed(2)} KB`);
  });

  it('should catch validation and parsing errors gracefully without causing crashes', async () => {
    const engine = new PromptEngine({ promptDir: tempDir });

    // 1. Invalid JSON file
    await fs.writeFile(path.join(tempDir, 'invalid-json.json'), '{ malformed json: }');
    await expect(engine.render('invalid-json')).rejects.toThrow(
      /Failed to parse prompt template "invalid-json" as JSON/
    );

    // 2. Zod structural validation error
    const invalidTemplate = {
      id: 'invalid-struct',
      // missing 'name'
      messages: [{ role: 'user', content: 'Hello' }],
      requiredVariables: []
    };
    await fs.writeFile(
      path.join(tempDir, 'invalid-struct.json'),
      JSON.stringify(invalidTemplate)
    );
    await expect(engine.render('invalid-struct')).rejects.toThrow(
      /failed schema validation/
    );

    // 3. Evaluation missing variable error
    const validPromptId = 'missing-vars';
    await fs.writeFile(
      path.join(tempDir, `${validPromptId}.json`),
      JSON.stringify({
        id: validPromptId,
        name: 'Test',
        messages: [{ role: 'user', content: '{{name}}' }],
        requiredVariables: ['name']
      })
    );
    await expect(engine.render(validPromptId, {})).rejects.toThrow(
      /Evaluation Error: Missing required/
    );
  });
});
