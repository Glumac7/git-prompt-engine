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

export async function fetchMetrics(): Promise<ServerMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.status}`);
  }
  return response.json();
}
