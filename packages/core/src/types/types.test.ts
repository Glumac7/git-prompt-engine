import { describe, it, expect } from 'vitest';
import { MessageTemplateSchema, PromptTemplateSchema } from './index.js';
import type { MessageTemplate, PromptTemplate, EngineOptions } from './index.js';

describe('Foundational Type Checking', () => {
  it('should compile and validate a MessageTemplate structure', () => {
    const systemMessage: MessageTemplate = {
      role: 'system',
      content: 'You are a helpful assistant.'
    };

    const userMessage: MessageTemplate = {
      role: 'user',
      content: 'Hello {{name}}!'
    };

    const assistantMessage: MessageTemplate = {
      role: 'assistant',
      content: 'Understood, processing...'
    };

    expect(systemMessage.role).toBe('system');
    expect(userMessage.role).toBe('user');
    expect(assistantMessage.role).toBe('assistant');
    expect(systemMessage.content).toBe('You are a helpful assistant.');
    expect(userMessage.content).toBe('Hello {{name}}!');
    expect(assistantMessage.content).toBe('Understood, processing...');
  });

  it('should compile and validate a PromptTemplate structure', () => {
    const template: PromptTemplate = {
      id: 'test-prompt',
      name: 'Test Prompt',
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User prompt with {{var}}' }
      ],
      requiredVariables: ['var']
    };

    expect(template.id).toBe('test-prompt');
    expect(template.name).toBe('Test Prompt');
    expect(template.messages).toHaveLength(2);
    expect(template.requiredVariables).toContain('var');
  });

  it('should compile and validate EngineOptions structure', () => {
    const options: EngineOptions = {
      promptDir: './prompts',
      cacheTtl: 5000,
      fallbackParams: {
        env: 'production'
      }
    };

    expect(options.promptDir).toBe('./prompts');
    expect(options.cacheTtl).toBe(5000);
    expect(options.fallbackParams?.env).toBe('production');
  });

  it('should validate schemas correctly using Zod', () => {
    const validMessage = {
      role: 'assistant',
      content: 'Assistant output'
    };
    expect(MessageTemplateSchema.safeParse(validMessage).success).toBe(true);

    const invalidMessage = {
      role: 'invalid-role',
      content: 'Hello'
    };
    expect(MessageTemplateSchema.safeParse(invalidMessage).success).toBe(false);

    const validTemplate = {
      id: 'test-id',
      name: 'Test Name',
      messages: [validMessage],
      requiredVariables: []
    };
    expect(PromptTemplateSchema.safeParse(validTemplate).success).toBe(true);

    const invalidTemplate = {
      id: 'test-id',
      // missing name
      messages: [validMessage],
      requiredVariables: []
    };
    expect(PromptTemplateSchema.safeParse(invalidTemplate).success).toBe(false);
  });
});
