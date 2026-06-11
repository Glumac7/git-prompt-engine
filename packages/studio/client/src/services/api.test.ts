import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPrompts, savePrompt, commitPrompt, fetchMetrics, fetchGitStatus, checkoutBranch, pushBranch, PromptTemplate, runPlaygroundPrompt } from './api';

describe('Client API Services', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchPrompts', () => {
    it('should fetch prompts successfully', async () => {
      const mockPrompts: PromptTemplate[] = [
        { id: 'p1', name: 'Prompt 1', requiredVariables: [], messages: [] }
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockPrompts,
      } as unknown as Response);

      const result = await fetchPrompts();
      expect(fetch).toHaveBeenCalledWith('/api/v1/prompts');
      expect(result).toEqual(mockPrompts);
    });

    it('should throw an error if the response is not OK', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as unknown as Response);

      await expect(fetchPrompts()).rejects.toThrow('Internal Server Error');
    });

    it('should throw fallback error if response is not OK and text is empty', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => '',
      } as unknown as Response);

      await expect(fetchPrompts()).rejects.toThrow('Failed to fetch prompts: 404');
    });
  });

  describe('savePrompt', () => {
    const promptToSave: PromptTemplate = {
      id: 'p1',
      name: 'Prompt 1',
      requiredVariables: [],
      messages: []
    };

    it('should save prompt successfully', async () => {
      const mockResponse = { success: true, prompt: promptToSave };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await savePrompt('p1', promptToSave);
      expect(fetch).toHaveBeenCalledWith('/api/v1/prompts/p1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptToSave),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error with API-provided message on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid schema' }),
      } as unknown as Response);

      await expect(savePrompt('p1', promptToSave)).rejects.toThrow('Invalid schema');
    });

    it('should throw fallback error message if JSON parsing fails on error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => { throw new Error('Bad JSON'); },
      } as unknown as Response);

      await expect(savePrompt('p1', promptToSave)).rejects.toThrow('Failed to save prompt: 400');
    });
  });

  describe('commitPrompt', () => {
    it('should commit prompt successfully', async () => {
      const mockResponse = { success: true, committed: true, message: 'Committed successfully' };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await commitPrompt('p1');
      expect(fetch).toHaveBeenCalledWith('/api/v1/git/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: 'p1' }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error with API-provided message on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Git binary not found' }),
      } as unknown as Response);

      await expect(commitPrompt('p1')).rejects.toThrow('Git binary not found');
    });
  });

  describe('fetchMetrics', () => {
    it('should fetch metrics successfully', async () => {
      const mockMetrics = {
        endpoints: {},
        git: { commitsCount: 0, avgCommitDurationMs: 0 },
        core: { cacheHitRate: 0, cacheHits: 0, cacheMisses: 0, avgDiskReadMs: 0, avgSchemaValidationMs: 0, avgCompileMs: 0, totalErrors: 0, recentErrors: [] }
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockMetrics,
      } as unknown as Response);

      const result = await fetchMetrics();
      expect(fetch).toHaveBeenCalledWith('/api/v1/metrics');
      expect(result).toEqual(mockMetrics);
    });

    it('should throw error on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(fetchMetrics()).rejects.toThrow('Failed to fetch metrics: 500');
    });
  });

  describe('fetchGitStatus', () => {
    it('should fetch git status successfully', async () => {
      const mockStatus = { currentBranch: 'main', branches: ['main'], isDirty: false };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockStatus,
      } as unknown as Response);

      const result = await fetchGitStatus();
      expect(fetch).toHaveBeenCalledWith('/api/v1/git/status');
      expect(result).toEqual(mockStatus);
    });

    it('should throw error on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Git status failure',
      } as unknown as Response);

      await expect(fetchGitStatus()).rejects.toThrow('Git status failure');
    });
  });

  describe('checkoutBranch', () => {
    it('should call branch switch endpoint successfully', async () => {
      const mockResponse = { success: true, message: 'Switched' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await checkoutBranch('feature', true);
      expect(fetch).toHaveBeenCalledWith('/api/v1/git/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'feature', create: true }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Branch exists' }),
      } as unknown as Response);

      await expect(checkoutBranch('feature')).rejects.toThrow('Branch exists');
    });
  });

  describe('pushBranch', () => {
    it('should call push endpoint successfully', async () => {
      const mockResponse = { success: true, message: 'Pushed' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await pushBranch();
      expect(fetch).toHaveBeenCalledWith('/api/v1/git/push', {
        method: 'POST',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Push failed' }),
      } as unknown as Response);

      await expect(pushBranch()).rejects.toThrow('Push failed');
    });
  });

  describe('runPlaygroundPrompt', () => {
    it('should successfully stream response chunks', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"text": "hello"}\n'));
          controller.enqueue(encoder.encode('data: {"text": " world"}\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        },
      });

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        body: stream,
      } as unknown as Response);

      const chunks: string[] = [];
      let done = false;

      await new Promise<void>((resolve, reject) => {
        runPlaygroundPrompt(
          {
            provider: 'openai',
            apiKey: 'key',
            model: 'gpt-4o',
            messages: [],
          },
          (chunk) => chunks.push(chunk),
          () => {
            done = true;
            resolve();
          },
          (err) => reject(err)
        );
      });

      expect(chunks).toEqual(['hello', ' world']);
      expect(done).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/v1/playground/run', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'key',
        },
      }));
    });

    it('should call onError on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad parameters' }),
      } as unknown as Response);

      let error: Error | null = null;

      await new Promise<void>((resolve) => {
        runPlaygroundPrompt(
          {
            provider: 'openai',
            apiKey: 'key',
            model: 'gpt-4o',
            messages: [],
          },
          () => {},
          () => {},
          (err) => {
            error = err;
            resolve();
          }
        );
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('Bad parameters');
    });
  });
});
