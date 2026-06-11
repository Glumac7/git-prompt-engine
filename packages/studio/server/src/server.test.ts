import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';

// Mock execFile for Git interactions
vi.mock('node:child_process', () => {
  return {
    execFile: vi.fn((file, args, options, callback) => {
      if (typeof callback === 'function') {
        if (args[0] === 'branch') {
          if (args[1] === '--show-current') {
            callback(null, { stdout: 'main\n' }, '');
          } else if (args[1] === '--format=%(refname:short)') {
            callback(null, { stdout: 'main\nfeature-abc\n' }, '');
          } else {
            callback(null, { stdout: '' }, '');
          }
        } else if (args[0] === 'status' && args.includes('--porcelain')) {
          if (args.some((a: string) => a.includes('unchanged'))) {
            callback(null, { stdout: '' }, '');
          } else {
            callback(null, { stdout: ' M test-prompt.json' }, '');
          }
        } else {
          callback(null, { stdout: 'Mocked successful command' }, '');
        }
      }
    }),
  };
});

import { createServer } from './server.js';

describe('Studio Bridge Server API', () => {
  let tempDir: string;
  let app: any;

  beforeEach(async () => {
    // Create a temporary directory for prompt files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-server-tests-'));
    app = createServer(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/prompts', () => {
    it('should return empty list if no files exist', async () => {
      const res = await request(app).get('/api/v1/prompts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return validated prompts and skip corrupted files', async () => {
      // 1. Write a valid template
      const validPrompt = {
        id: 'valid-prompt',
        name: 'Valid Name',
        messages: [{ role: 'system', content: 'You are helpful.' }],
        requiredVariables: [],
      };
      await fs.writeFile(
        path.join(tempDir, 'valid-prompt.json'),
        JSON.stringify(validPrompt, null, 2)
      );

      // 2. Write a corrupted template (missing required field)
      const invalidPrompt = {
        id: 'invalid-prompt',
        messages: [{ role: 'system', content: 'You are helpful.' }],
      };
      await fs.writeFile(
        path.join(tempDir, 'invalid-prompt.json'),
        JSON.stringify(invalidPrompt, null, 2)
      );

      const res = await request(app).get('/api/v1/prompts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('valid-prompt');
      expect(res.body[0].name).toBe('Valid Name');
    });
  });

  describe('POST /api/v1/prompts/:id', () => {
    it('should successfully save a valid prompt template and overwrite the file atomically', async () => {
      const payload = {
        id: 'new-prompt',
        name: 'Updated Name',
        messages: [{ role: 'user', content: 'Welcome {{name}}' }],
        requiredVariables: ['name'],
      };

      const res = await request(app)
        .post('/api/v1/prompts/new-prompt')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.prompt).toEqual(payload);

      // Verify file is saved
      const savedContent = await fs.readFile(
        path.join(tempDir, 'new-prompt.json'),
        'utf-8'
      );
      expect(JSON.parse(savedContent)).toEqual(payload);
    });

    it('should return 400 validation error if payload is corrupted/invalid', async () => {
      const payload = {
        id: 'new-prompt',
        // missing required fields: name, messages
        requiredVariables: [],
      };

      const res = await request(app)
        .post('/api/v1/prompts/new-prompt')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 error if payload ID does not match path parameter ID', async () => {
      const payload = {
        id: 'mismatched-id',
        name: 'Correct Name',
        messages: [{ role: 'user', content: 'Hello' }],
        requiredVariables: [],
      };

      const res = await request(app)
        .post('/api/v1/prompts/path-id')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('does not match URL path ID');
    });

    it('should return 400 bad request if request contains malformed JSON', async () => {
      const res = await request(app)
        .post('/api/v1/prompts/some-id')
        .set('Content-Type', 'application/json')
        .send('{"invalid-json": '); // malformed

      expect(res.status).toBe(400);
    });

    it('should return 400 security/validation error if prompt ID contains path traversal sequences', async () => {
      const res = await request(app)
        .post('/api/v1/prompts/..%2fescape')
        .send({
          id: 'escape',
          name: 'Escape',
          messages: [],
          requiredVariables: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid prompt ID format');
    });

    it('should return 400 security/validation error if prompt ID contains invalid characters', async () => {
      const res = await request(app)
        .post('/api/v1/prompts/-invalid-start')
        .send({
          id: '-invalid-start',
          name: 'Invalid Start',
          messages: [],
          requiredVariables: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid prompt ID format');
    });
  });

  describe('POST /api/v1/git/commit', () => {
    it('should stage and commit changes if changes exist', async () => {
      const id = 'modified-prompt';
      const filePath = path.join(tempDir, `${id}.json`);
      
      // Create a prompt file on disk
      await fs.writeFile(filePath, '{}');

      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({ id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.committed).toBe(true);
      expect(execFile).toHaveBeenCalled();
    });

    it('should skip staging/committing if no changes exist', async () => {
      const id = 'unchanged-prompt';
      const filePath = path.join(tempDir, `${id}.json`);
      
      // Create a prompt file on disk
      await fs.writeFile(filePath, '{}');

      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({ id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.committed).toBe(false);
      expect(res.body.message).toBe('No changes to commit');
    });

    it('should return 404 if prompt file does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({ id: 'nonexistent-prompt' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if ID is missing', async () => {
      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if ID contains path traversal sequences', async () => {
      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({ id: '../../escape' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid prompt ID format');
    });

    it('should return 400 if ID contains invalid characters', async () => {
      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({ id: '-invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid prompt ID format');
    });

    it('should return 500 internal server error if git command fails', async () => {
      const id = 'error-prompt';
      const filePath = path.join(tempDir, `${id}.json`);
      await fs.writeFile(filePath, '{}');

      // Mock execFile to fail for this call
      vi.mocked(execFile).mockImplementationOnce((file: any, args: any, options: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(new Error('Git command failed: index locked'), null, 'stderr error');
        }
        return {} as any;
      });

      const res = await request(app)
        .post('/api/v1/git/commit')
        .send({ id });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Git commit operation failed: Git command failed: index locked');
    });
  });

  describe('GET /api/v1/metrics', () => {
    it('should return collected endpoint metrics and core engine events', async () => {
      // Populate some fake prompts to trigger core engine events
      const validPrompt = {
        id: 'metric-prompt',
        name: 'Metric Name',
        messages: [{ role: 'system', content: 'A' }],
        requiredVariables: [],
      };
      await fs.writeFile(
        path.join(tempDir, 'metric-prompt.json'),
        JSON.stringify(validPrompt, null, 2)
      );

      // Hit GET prompts to trigger cache misses & reads
      await request(app).get('/api/v1/prompts');

      // Hit POST /prompts/:id
      await request(app)
        .post('/api/v1/prompts/metric-prompt')
        .send(validPrompt);

      // Hit Git commit
      await request(app)
        .post('/api/v1/git/commit')
        .send({ id: 'metric-prompt' });

      // Request metrics
      const res = await request(app).get('/api/v1/metrics');

      expect(res.status).toBe(200);
      expect(res.body.endpoints).toBeDefined();
      expect(res.body.endpoints['GET /api/v1/prompts']).toBeDefined();
      expect(res.body.endpoints['GET /api/v1/prompts'].hits).toBe(1);

      expect(res.body.git).toBeDefined();
      expect(res.body.git.commitsCount).toBe(1);

      expect(res.body.core).toBeDefined();
      expect(res.body.core.cacheMisses).toBe(1);
      expect(res.body.core.avgDiskReadMs).toBeGreaterThanOrEqual(0);
      expect(res.body.core.avgSchemaValidationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/v1/git/status', () => {
    it('should return git repository status info', async () => {
      const res = await request(app).get('/api/v1/git/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        currentBranch: 'main',
        branches: ['main', 'feature-abc'],
        isDirty: true,
      });
    });
  });

  describe('POST /api/v1/git/branch', () => {
    it('should checkout an existing branch successfully', async () => {
      const res = await request(app)
        .post('/api/v1/git/branch')
        .send({ name: 'feature-abc' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Successfully checked out branch "feature-abc"');
    });

    it('should create and checkout a new branch successfully', async () => {
      const res = await request(app)
        .post('/api/v1/git/branch')
        .send({ name: 'new-feature', create: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Successfully checked out branch "new-feature"');
    });

    it('should fail if name is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/git/branch')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing or invalid branch name');
    });
  });

  describe('POST /api/v1/git/push', () => {
    it('should push current branch successfully', async () => {
      const res = await request(app).post('/api/v1/git/push');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Successfully pushed branch "main" to origin');
    });
  });

  describe('POST /api/v1/playground/run', () => {
    it('should fail if x-api-key is missing', async () => {
      const res = await request(app)
        .post('/api/v1/playground/run')
        .send({
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hello' }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing x-api-key header');
    });

    it('should fail if provider is missing', async () => {
      const res = await request(app)
        .post('/api/v1/playground/run')
        .set('x-api-key', 'mock-key')
        .send({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hello' }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing or invalid parameters');
    });

    it('should stream chunks and end with [DONE]', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"choices": [{"delta": {"content": "Hello"}}]}\n'));
          controller.enqueue(encoder.encode('data: {"choices": [{"delta": {"content": " world"}}]}\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        },
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: stream,
        headers: new Headers(),
      } as unknown as Response);

      const res = await request(app)
        .post('/api/v1/playground/run')
        .set('x-api-key', 'mock-key')
        .send({
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hello' }],
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data: {"text":"Hello"}');
      expect(res.text).toContain('data: {"text":" world"}');
      expect(res.text).toContain('data: [DONE]');
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe('Static files and client route routing', () => {
    it('should serve index.html for non-API routes when client/dist exists', async () => {
      const testClientDistDir = path.resolve(__dirname, '../../client/dist');
      const indexHtmlPath = path.join(testClientDistDir, 'index.html');
      let originalContent: string | null = null;
      try {
        originalContent = await fs.readFile(indexHtmlPath, 'utf8');
      } catch (e) {
        // Doesn't exist, we will create it
      }

      await fs.mkdir(testClientDistDir, { recursive: true });
      await fs.writeFile(indexHtmlPath, '<html>Mock Index</html>');

      try {
        const testApp = createServer(tempDir);
        const res = await request(testApp).get('/some-random-route');
        expect(res.status).toBe(200);
        expect(res.text).toBe('<html>Mock Index</html>');
      } finally {
        if (originalContent !== null) {
          await fs.writeFile(indexHtmlPath, originalContent);
        } else {
          await fs.rm(indexHtmlPath, { force: true });
        }
      }
    });
  });
});
