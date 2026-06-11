import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmService } from './llm.service.js';

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(() => {
    service = new LlmService();
    vi.restoreAllMocks();
  });

  const createMockResponseStream = (chunks: string[]) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      body: stream,
      headers: new Headers(),
      text: async () => chunks.join(''),
    } as unknown as Response;
  };

  it('should stream OpenAI completions correctly', async () => {
    const chunks = [
      'data: {"choices": [{"delta": {"content": "Hello"}}]    }\n',
      'data: {"choices": [{"delta": {"content": " world"}}]    }\n',
      'data: [DONE]\n',
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(createMockResponseStream(chunks));

    const receivedChunks: string[] = [];
    await service.streamCompletion(
      {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
      (chunk) => {
        receivedChunks.push(chunk);
      }
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
    expect(receivedChunks).toEqual(['Hello', ' world']);
  });

  it('should stream Anthropic completions correctly', async () => {
    const chunks = [
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " world"}}\n',
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(createMockResponseStream(chunks));

    const receivedChunks: string[] = [];
    await service.streamCompletion(
      {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-opus',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
      (chunk) => {
        receivedChunks.push(chunk);
      }
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );
    expect(receivedChunks).toEqual(['Hello', ' world']);
  });

  it('should stream Google Gemini completions correctly', async () => {
    const chunks = [
      'data: {"candidates": [{"content": {"parts": [{"text": "Hello"}]}}]}\n',
      'data: {"candidates": [{"content": {"parts": [{"text": " world"}]}}]}\n',
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(createMockResponseStream(chunks));

    const receivedChunks: string[] = [];
    await service.streamCompletion(
      {
        provider: 'google',
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
      (chunk) => {
        receivedChunks.push(chunk);
      }
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?alt=sse',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': 'test-key',
        }),
      })
    );
    expect(receivedChunks).toEqual(['Hello', ' world']);
  });

  it('should throw an error on API error response', async () => {
    const errorBody = {
      error: {
        message: 'Invalid API Key',
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify(errorBody),
    } as unknown as Response);

    await expect(
      service.streamCompletion(
        {
          provider: 'openai',
          apiKey: 'invalid-key',
          model: 'gpt-4o',
          messages: [],
        },
        () => {}
      )
    ).rejects.toThrow('Invalid API Key');
  });
});
