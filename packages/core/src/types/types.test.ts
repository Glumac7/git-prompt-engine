import { describe, it, expect } from 'vitest';
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

    expect(systemMessage.role).toBe('system');
    expect(userMessage.role).toBe('user');
    expect(systemMessage.content).toBe('You are a helpful assistant.');
    expect(userMessage.content).toBe('Hello {{name}}!');
  });

  it('should compile and validate a PromptTemplate structure', () => {
    const template: PromptTemplate = {
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User prompt with {{var}}' }
      ],
      requiredVariables: ['var']
    };

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
});
