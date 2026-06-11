import { MessageTemplate } from '@git-prompt-engine/core';

export type LlmProvider = 'google' | 'openai' | 'anthropic';

export interface StreamCompletionOptions {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  messages: MessageTemplate[];
  temperature?: number;
  maxTokens?: number;
}

export class LlmService {
  public async streamCompletion(
    options: StreamCompletionOptions,
    onChunk: (text: string) => void
  ): Promise<void> {
    const { provider, apiKey, model, messages, temperature, maxTokens } = options;

    if (!apiKey) {
      throw new Error(`API key is required for provider "${provider}"`);
    }

    let url = '';
    const method = 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let body: any = {};

    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      
      const systemMessage = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');
      
      body = {
        model,
        system: systemMessage ? systemMessage.content : undefined,
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens || 1024,
        stream: true,
      };
    } else if (provider === 'google') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      headers['x-goog-api-key'] = apiKey;
      
      const systemMessage = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');
      
      body = {
        system_instruction: systemMessage ? {
          parts: [{ text: systemMessage.content }]
        } : undefined,
        contents: otherMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        }
      };
    } else {
      throw new Error(`Unsupported provider: "${provider}"`);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error?.message || parsed.error || errorText || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (provider === 'openai') {
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  onChunk(content);
                }
              } else if (provider === 'anthropic') {
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  onChunk(parsed.delta.text);
                }
              } else if (provider === 'google') {
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  onChunk(content);
                }
              }
            } catch {
              // Ignore lines that aren't valid JSON (like SSE comments/keepalives)
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
