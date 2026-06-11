export interface MessageTemplate {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  requiredVariables: string[];
  messages: MessageTemplate[];
  // Extended fields for high-fidelity settings editing
  description?: string;
  parameters?: {
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface EndpointMetric {
  hits: number;
  avgDurationMs: number;
}

export interface ServerMetrics {
  endpoints: Record<string, EndpointMetric>;
  git: {
    commitsCount: number;
    avgCommitDurationMs: number;
  };
  core: {
    cacheHitRate: number;
    cacheHits: number;
    cacheMisses: number;
    avgDiskReadMs: number;
    avgSchemaValidationMs: number;
    avgCompileMs: number;
    totalErrors: number;
    recentErrors: string[];
  };
}

const API_BASE = '/api/v1';

export async function fetchPrompts(): Promise<PromptTemplate[]> {
  const response = await fetch(`${API_BASE}/prompts`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to fetch prompts: ${response.status}`);
  }
  return response.json();
}

export async function savePrompt(id: string, prompt: PromptTemplate): Promise<{ success: boolean; prompt: PromptTemplate }> {
  // Construct clean payload that conforms to core validation
  // Core schema is id, name, requiredVariables, messages.
  // Other fields like description/parameters can be saved inside JSON
  const response = await fetch(`${API_BASE}/prompts/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save prompt: ${response.status}`);
  }
  return response.json();
}

export async function commitPrompt(id: string): Promise<{ success: boolean; committed: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/git/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to commit prompt: ${response.status}`);
  }
  return response.json();
}

export interface GitStatus {
  currentBranch: string;
  branches: string[];
  isDirty: boolean;
}

export async function fetchMetrics(): Promise<ServerMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.status}`);
  }
  return response.json();
}

export async function fetchGitStatus(): Promise<GitStatus> {
  const response = await fetch(`${API_BASE}/git/status`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to fetch git status: ${response.status}`);
  }
  return response.json();
}

export async function checkoutBranch(name: string, create?: boolean): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/git/branch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, create }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to checkout branch: ${response.status}`);
  }
  return response.json();
}

export async function pushBranch(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/git/push`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to push branch: ${response.status}`);
  }
  return response.json();
}

export interface RunPlaygroundOptions {
  provider: 'google' | 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  messages: MessageTemplate[];
  parameters?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export async function runPlaygroundPrompt(
  options: RunPlaygroundOptions,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
): Promise<void> {
  const { provider, apiKey, model, messages, parameters } = options;
  try {
    const response = await fetch(`${API_BASE}/playground/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        provider,
        model,
        messages,
        parameters,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
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
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                onChunk(parsed.text);
              }
            } catch (err: any) {
              if (err.message && !err.message.startsWith('Unexpected token')) {
                throw err;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

