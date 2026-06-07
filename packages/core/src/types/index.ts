export interface MessageTemplate {
  role: 'system' | 'user';
  content: string;
}

export interface PromptTemplate {
  messages: MessageTemplate[];
  requiredVariables: string[];
}

export interface EngineOptions {
  promptDir: string;
  cacheTtl?: number; // In milliseconds
  fallbackParams?: Record<string, string>;
}
