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

  describe('compile method', () => {
    it('should compile a prompt template successfully when all required variables are provided', async () => {
      const promptId = 'compile-success';
      const templateContent = {
        id: promptId,
        name: 'Compile Success',
        messages: [
          { role: 'system', content: 'You are a help desk agent.' },
          { role: 'user', content: 'Customer Name: {{name}}. Issue: {{issue}}.' }
        ],
        requiredVariables: ['name', 'issue']
      };

      await fs.writeFile(
        path.join(tempDir, `${promptId}.json`),
        JSON.stringify(templateContent, null, 2)
      );

      const engine = new PromptEngine({ promptDir: tempDir });
      const messages = await engine.compile(promptId, { name: 'Bob', issue: 'Login Failure' });

      expect(messages).toEqual([
        { role: 'system', content: 'You are a help desk agent.' },
        { role: 'user', content: 'Customer Name: Bob. Issue: Login Failure.' }
      ]);
    });

    it('should throw a highly explicit evaluation error specifying the exact missing key when a required variable is missing', async () => {
      const promptId = 'compile-missing';
      const templateContent = {
        id: promptId,
        name: 'Compile Missing',
        messages: [
          { role: 'user', content: 'Hello {{first_name}} {{last_name}}!' }
        ],
        requiredVariables: ['first_name', 'last_name']
      };

      await fs.writeFile(
        path.join(tempDir, `${promptId}.json`),
        JSON.stringify(templateContent, null, 2)
      );

      const engine = new PromptEngine({ promptDir: tempDir });

      await expect(engine.compile(promptId, { first_name: 'John' })).rejects.toThrow(
        /Evaluation Error: Missing required application parameter "last_name" for prompt template "compile-missing"/
      );
    });

    it('should respect caching TTL and avoid disk hits on subsequent compilation calls', async () => {
      const promptId = 'compile-cached';
      const templateContent = {
        id: promptId,
        name: 'Compile Cached',
        messages: [{ role: 'user', content: 'Greeting: {{greet}}' }],
        requiredVariables: ['greet']
      };

      const filePath = path.join(tempDir, `${promptId}.json`);
      await fs.writeFile(filePath, JSON.stringify(templateContent, null, 2));

      const engine = new PromptEngine({
        promptDir: tempDir,
        cacheTtl: 10000
      });

      const res1 = await engine.compile(promptId, { greet: 'Hello' });
      expect(res1[0].content).toBe('Greeting: Hello');

      // Overwrite the file on disk
      const updatedContent = {
        id: promptId,
        name: 'Compile Cached',
        messages: [{ role: 'user', content: 'Updated Greeting: {{greet}}' }],
        requiredVariables: ['greet']
      };
      await fs.writeFile(filePath, JSON.stringify(updatedContent, null, 2));

      // compile should still resolve with cached content structure
      const res2 = await engine.compile(promptId, { greet: 'Hi' });
      expect(res2[0].content).toBe('Greeting: Hi');
    });
  });

  describe('Robust Suite of Unit Tests', () => {
    describe('Requirement 1: Parses and caches valid prompt JSON files', () => {
      it('should successfully parse a valid prompt JSON file and cache it if cacheTtl is set', async () => {
        const promptId = 'req1-valid-prompt';
        const templateContent = {
          id: promptId,
          name: 'Valid Prompt',
          messages: [{ role: 'user', content: 'Hello {{name}}' }],
          requiredVariables: ['name']
        };
        await fs.writeFile(
          path.join(tempDir, `${promptId}.json`),
          JSON.stringify(templateContent, null, 2)
        );

        const engine = new PromptEngine({
          promptDir: tempDir,
          cacheTtl: 10000 // 10s
        });

        const readFileMock = vi.mocked(fs.readFile);
        readFileMock.mockClear();

        const res1 = await engine.getTemplate(promptId);
        expect(res1).toEqual(templateContent);
        expect(readFileMock).toHaveBeenCalledTimes(1);

        // Call again to verify cache is used
        const res2 = await engine.getTemplate(promptId);
        expect(res2).toEqual(templateContent);
        expect(readFileMock).toHaveBeenCalledTimes(1); // Still 1 call, cached
      });
    });

    describe('Requirement 2: Validation errors for structural syntax errors', () => {
      it('should throw an explicit validation error for missing fields in JSON using mock data', async () => {
        const readFileMock = vi.mocked(fs.readFile);
        
        // Missing required field 'name' and 'id'
        const invalidTemplate = {
          messages: [{ role: 'user', content: 'Hello' }],
          requiredVariables: []
        };
        
        readFileMock.mockResolvedValueOnce(JSON.stringify(invalidTemplate));
        
        const engine = new PromptEngine({ promptDir: tempDir });
        
        await expect(engine.getTemplate('mocked-invalid-fields')).rejects.toThrow(
          /failed schema validation/
        );
      });

      it('should throw an explicit validation error for invalid message roles using mock data', async () => {
        const readFileMock = vi.mocked(fs.readFile);
        
        // Invalid message role
        const invalidTemplate = {
          id: 'invalid-role-prompt',
          name: 'Invalid Role Prompt',
          messages: [{ role: 'invalid-role', content: 'Hello' }],
          requiredVariables: []
        };
        
        readFileMock.mockResolvedValueOnce(JSON.stringify(invalidTemplate));
        
        const engine = new PromptEngine({ promptDir: tempDir });
        
        await expect(engine.getTemplate('mocked-invalid-role')).rejects.toThrow(
          /failed schema validation/
        );
      });

      it('should throw an explicit validation error for malformed JSON using mock data', async () => {
        const readFileMock = vi.mocked(fs.readFile);
        
        readFileMock.mockResolvedValueOnce('{"id": "broken", "name": "Broken", "messages": ['); // Malformed JSON
        
        const engine = new PromptEngine({ promptDir: tempDir });
        
        await expect(engine.getTemplate('mocked-malformed-json')).rejects.toThrow(
          /Failed to parse prompt template "mocked-malformed-json" as JSON/
        );
      });
    });

    describe('Requirement 3: Compiler errors for missing required variables', () => {
      it('should throw an evaluation error when required variables are missing from runtime payload and fallbackParams', async () => {
        const promptId = 'req3-missing-vars';
        const templateContent = {
          id: promptId,
          name: 'Missing Variables Prompt',
          messages: [{ role: 'user', content: 'Hello {{first}} {{last}}' }],
          requiredVariables: ['first', 'last']
        };
        await fs.writeFile(
          path.join(tempDir, `${promptId}.json`),
          JSON.stringify(templateContent, null, 2)
        );

        const engine = new PromptEngine({ promptDir: tempDir });

        // Missing 'last'
        await expect(engine.compile(promptId, { first: 'John' })).rejects.toThrow(
          /Evaluation Error: Missing required application parameter "last"/
        );
      });

      it('should NOT throw an error when required variables are provided in fallbackParams', async () => {
        const promptId = 'req3-fallback-vars';
        const templateContent = {
          id: promptId,
          name: 'Fallback Variables Prompt',
          messages: [{ role: 'user', content: 'Hello {{first}} {{last}}' }],
          requiredVariables: ['first', 'last']
        };
        await fs.writeFile(
          path.join(tempDir, `${promptId}.json`),
          JSON.stringify(templateContent, null, 2)
        );

        const engine = new PromptEngine({
          promptDir: tempDir,
          fallbackParams: { last: 'Doe' }
        });

        // 'first' is in runtime payload, 'last' is in fallbackParams. Should succeed.
        const messages = await engine.compile(promptId, { first: 'John' });
        expect(messages).toEqual([
          { role: 'user', content: 'Hello John Doe' }
        ]);
      });
    });

    describe('Requirement 4: Cache hits prevent duplicate disk I/O reads within TTL window', () => {
      it('should only hit disk once inside TTL window, and hit disk again after TTL window expires', async () => {
        vi.useFakeTimers();
        const mockStartTime = 2000000;
        vi.setSystemTime(mockStartTime);

        const promptId = 'req4-ttl-cache';
        const templateContent = {
          id: promptId,
          name: 'TTL Cache Prompt',
          messages: [{ role: 'user', content: 'Count: {{count}}' }],
          requiredVariables: ['count']
        };
        await fs.writeFile(
          path.join(tempDir, `${promptId}.json`),
          JSON.stringify(templateContent, null, 2)
        );

        const engine = new PromptEngine({
          promptDir: tempDir,
          cacheTtl: 5000 // 5 seconds
        });

        const readFileMock = vi.mocked(fs.readFile);
        readFileMock.mockClear();

        // First call (cache miss -> reads disk)
        await engine.compile(promptId, { count: '1' });
        expect(readFileMock).toHaveBeenCalledTimes(1);

        // Advance time by 3 seconds (within 5 seconds TTL)
        vi.setSystemTime(mockStartTime + 3000);

        // Second call (cache hit -> no disk read)
        await engine.compile(promptId, { count: '2' });
        expect(readFileMock).toHaveBeenCalledTimes(1); // Still 1

        // Advance time by another 3 seconds (total 6 seconds, TTL expired)
        vi.setSystemTime(mockStartTime + 6000);

        // Third call (cache expired -> reads disk again)
        await engine.compile(promptId, { count: '3' });
        expect(readFileMock).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
      });
    });

    describe('Telemetry Events', () => {
      it('should fire telemetry events for disk reads, schema validation, compile, cache hits and misses', async () => {
        const promptId = 'telemetry-test';
        const templateContent = {
          id: promptId,
          name: 'Telemetry Prompt',
          messages: [{ role: 'user', content: 'Greeting: {{greet}}' }],
          requiredVariables: ['greet']
        };
        await fs.writeFile(
          path.join(tempDir, `${promptId}.json`),
          JSON.stringify(templateContent, null, 2)
        );

        const events: any[] = [];
        const engine = new PromptEngine({
          promptDir: tempDir,
          cacheTtl: 10000,
          onTelemetry: (e) => events.push(e)
        });

        // First compile: cache miss -> read file -> schema validation -> compile
        await engine.compile(promptId, { greet: 'Hello' });

        expect(events).toHaveLength(4);
        expect(events[0]).toMatchObject({ type: 'cache_miss', promptId, success: true });
        expect(events[1]).toMatchObject({ type: 'read_file', promptId, success: true });
        expect(events[2]).toMatchObject({ type: 'schema_validation', promptId, success: true });
        expect(events[3]).toMatchObject({ type: 'compile', promptId, success: true });
        expect(events[1].durationMs).toBeGreaterThanOrEqual(0);
        expect(events[2].durationMs).toBeGreaterThanOrEqual(0);
        expect(events[3].durationMs).toBeGreaterThanOrEqual(0);

        // Clear events list
        events.length = 0;

        // Second compile: cache hit -> compile
        await engine.compile(promptId, { greet: 'Welcome' });
        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({ type: 'cache_hit', promptId, success: true });
        expect(events[1]).toMatchObject({ type: 'compile', promptId, success: true });
      });

      it('should fire telemetry events with error message when compilation or validation fails', async () => {
        const promptId = 'invalid-telemetry';
        // Invalid template missing 'name' field
        const templateContent = {
          id: promptId,
          messages: [{ role: 'user', content: 'Greeting: {{greet}}' }]
        };
        await fs.writeFile(
          path.join(tempDir, `${promptId}.json`),
          JSON.stringify(templateContent, null, 2)
        );

        const events: any[] = [];
        const engine = new PromptEngine({
          promptDir: tempDir,
          onTelemetry: (e) => events.push(e)
        });

        await expect(engine.compile(promptId, { greet: 'Hello' })).rejects.toThrow();

        // Should trigger read_file (success), schema_validation (failure), compile (failure)
        expect(events).toHaveLength(3);
        expect(events[0]).toMatchObject({ type: 'read_file', promptId, success: true });
        expect(events[1]).toMatchObject({ type: 'schema_validation', promptId, success: false });
        expect(events[2]).toMatchObject({ type: 'compile', promptId, success: false });
        expect(events[1].error).toBeDefined();
        expect(events[2].error).toBeDefined();
      });
    });

    describe('YAML/YML Support', () => {
      it('should load a prompt template from a .yaml file', async () => {
        const promptId = 'yaml-prompt';
        const yamlContent = `
id: yaml-prompt
name: YAML Prompt
messages:
  - role: system
    content: "You are a YAML expert."
  - role: user
    content: "Tell me about {{topic}}."
requiredVariables:
  - topic
`;

        await fs.writeFile(
          path.join(tempDir, `${promptId}.yaml`),
          yamlContent
        );

        const engine = new PromptEngine({ promptDir: tempDir });
        const messages = await engine.render(promptId, { topic: 'indented syntax' });

        expect(messages).toEqual([
          { role: 'system', content: 'You are a YAML expert.' },
          { role: 'user', content: 'Tell me about indented syntax.' }
        ]);
      });

      it('should load a prompt template from a .yml file', async () => {
        const promptId = 'yml-prompt';
        const yamlContent = `
id: yml-prompt
name: YML Prompt
messages:
  - role: user
    content: "Short extension test: {{test}}."
requiredVariables:
  - test
`;

        await fs.writeFile(
          path.join(tempDir, `${promptId}.yml`),
          yamlContent
        );

        const engine = new PromptEngine({ promptDir: tempDir });
        const messages = await engine.render(promptId, { test: 'success' });

        expect(messages).toEqual([
          { role: 'user', content: 'Short extension test: success.' }
        ]);
      });

      it('should throw an error when parsing invalid YAML', async () => {
        const promptId = 'invalid-yaml-prompt';
        const yamlContent = `
id: invalid-yaml-prompt
messages:
  - role: user
    content: "{{test}"
  bad-indentation:
    - this is not
  valid:
`;

        await fs.writeFile(
          path.join(tempDir, `${promptId}.yaml`),
          yamlContent
        );

        const engine = new PromptEngine({ promptDir: tempDir });
        await expect(engine.render(promptId, { test: 'val' })).rejects.toThrow(/Failed to parse prompt template "invalid-yaml-prompt" as YAML/);
      });
    });
  });
});

