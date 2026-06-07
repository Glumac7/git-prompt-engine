import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPrompts, savePrompt, commitPrompt, fetchMetrics, PromptTemplate } from './api';

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
      } as Response);

      const result = await fetchPrompts();
      expect(fetch).toHaveBeenCalledWith('/api/v1/prompts');
      expect(result).toEqual(mockPrompts);
    });

    it('should throw an error if the response is not OK', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      await expect(fetchPrompts()).rejects.toThrow('Internal Server Error');
    });

    it('should throw fallback error if response is not OK and text is empty', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => '',
      } as Response);

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
      } as Response);

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
      } as Response);

      await expect(savePrompt('p1', promptToSave)).rejects.toThrow('Invalid schema');
    });

    it('should throw fallback error message if JSON parsing fails on error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => { throw new Error('Bad JSON'); },
      } as Response);

      await expect(savePrompt('p1', promptToSave)).rejects.toThrow('Failed to save prompt: 400');
    });
  });

  describe('commitPrompt', () => {
    it('should commit prompt successfully', async () => {
      const mockResponse = { success: true, committed: true, message: 'Committed successfully' };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

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
      } as Response);

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
      } as Response);

      const result = await fetchMetrics();
      expect(fetch).toHaveBeenCalledWith('/api/v1/metrics');
      expect(result).toEqual(mockMetrics);
    });

    it('should throw error on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchMetrics()).rejects.toThrow('Failed to fetch metrics: 500');
    });
  });
});
