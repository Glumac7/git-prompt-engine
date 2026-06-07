import { z } from 'zod';

export const MessageTemplateSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const PromptTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  requiredVariables: z.array(z.string()),
  messages: z.array(MessageTemplateSchema),
});

export type MessageTemplate = z.infer<typeof MessageTemplateSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export interface EngineOptions {
  promptDir: string;
  cacheTtl?: number; // In milliseconds
  fallbackParams?: Record<string, string>;
}
