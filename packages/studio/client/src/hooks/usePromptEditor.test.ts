// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { useState } from 'react';
import { ClientPromptTemplateSchema, usePromptEditor } from './usePromptEditor';
import { PromptTemplate } from '../services/api';

describe('ClientPromptTemplateSchema', () => {
  it('should validate a valid prompt template', () => {
    const validPrompt: PromptTemplate = {
      id: 'test-id',
      name: 'Test Name',
      requiredVariables: ['var1'],
      messages: [{ role: 'user', content: 'Hello {{var1}}' }],
      parameters: {
        modelName: 'gemini-3.5-flash',
        temperature: 0.7,
        maxTokens: 100
      }
    };
    const result = ClientPromptTemplateSchema.safeParse(validPrompt);
    expect(result.success).toBe(true);
  });

  it('should reject a template with empty name', () => {
    const invalidPrompt: PromptTemplate = {
      id: 'test-id',
      name: '  ',
      requiredVariables: [],
      messages: []
    };
    const result = ClientPromptTemplateSchema.safeParse(invalidPrompt);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some(issue => issue.path.includes('name') && issue.message.includes('name cannot be empty'))).toBe(true);
    }
  });

  it('should reject a template message with empty content', () => {
    const invalidPrompt: PromptTemplate = {
      id: 'test-id',
      name: 'Valid Name',
      requiredVariables: [],
      messages: [
        { role: 'user', content: '  ' }
      ]
    };
    const result = ClientPromptTemplateSchema.safeParse(invalidPrompt);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some(issue => issue.path.includes('content') && issue.message.includes('content cannot be empty'))).toBe(true);
    }
  });

  it('should reject a template message with invalid role', () => {
    const invalidPrompt: PromptTemplate = {
      id: 'test-id',
      name: 'Valid Name',
      requiredVariables: [],
      messages: [
        { role: 'invalid-role' as any, content: 'Some content' }
      ]
    };
    const result = ClientPromptTemplateSchema.safeParse(invalidPrompt);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some(issue => issue.path.includes('role') && issue.message.includes('expected one of'))).toBe(true);
    }
  });
});

describe('usePromptEditor Hook', () => {
  const initialPrompt: PromptTemplate = {
    id: 'test-prompt',
    name: 'Test Prompt',
    requiredVariables: ['name'],
    messages: [
      { role: 'system', content: 'You are an assistant. Hello {{name}}' },
      { role: 'user', content: 'How are you?' }
    ],
    parameters: {
      modelName: 'gemini-3.5-flash',
      temperature: 0.5
    }
  };

  function useTestEditor() {
    const [activePrompt, setActivePrompt] = useState<PromptTemplate | null>(initialPrompt);
    const [isModified, setIsModified] = useState(false);
    const showToast = vi.fn();

    const editor = usePromptEditor({
      activePrompt,
      setActivePrompt,
      setIsModified,
      showToast
    });

    return {
      activePrompt,
      setActivePrompt,
      isModified,
      setIsModified,
      showToast,
      ...editor
    };
  }

  it('should initialize playground variables based on requiredVariables', () => {
    const { result } = renderHook(() => useTestEditor());
    expect(result.current.playgroundVariables).toEqual({});
  });

  it('should support modifying meta attributes like name or description', () => {
    const { result } = renderHook(() => useTestEditor());

    act(() => {
      result.current.handleMetaChange('name', 'New Title');
    });

    expect(result.current.activePrompt?.name).toBe('New Title');
    expect(result.current.isModified).toBe(true);
  });

  it('should support modifying parameters like temperature', () => {
    const { result } = renderHook(() => useTestEditor());

    act(() => {
      result.current.handleParamChange('temperature', 0.9);
    });

    expect(result.current.activePrompt?.parameters?.temperature).toBe(0.9);
    expect(result.current.isModified).toBe(true);
  });

  it('should handle adding and removing variables', () => {
    const { result } = renderHook(() => useTestEditor());

    // Mock form event submit
    const mockEvent = {
      preventDefault: vi.fn()
    } as unknown as React.FormEvent;

    act(() => {
      result.current.setNewVarName('age');
    });

    act(() => {
      result.current.handleAddVariable(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.activePrompt?.requiredVariables).toContain('age');
    expect(result.current.playgroundVariables.age).toBe('');
    expect(result.current.newVarName).toBe('');

    // Try to add duplicate
    act(() => {
      result.current.setNewVarName('age');
    });
    act(() => {
      result.current.handleAddVariable(mockEvent);
    });
    expect(result.current.showToast).toHaveBeenCalledWith('Variable "age" already exists', 'info');

    // Remove variable
    act(() => {
      result.current.handleRemoveVariable('name');
    });
    expect(result.current.activePrompt?.requiredVariables).not.toContain('name');
    expect(result.current.playgroundVariables.name).toBeUndefined();
  });

  it('should handle message lifecycle operations (add, update, delete, move)', () => {
    const { result } = renderHook(() => useTestEditor());

    // Add message
    act(() => {
      result.current.handleAddMessage('assistant');
    });
    expect(result.current.activePrompt?.messages).toHaveLength(3);
    expect(result.current.activePrompt?.messages[2]).toEqual({ role: 'assistant', content: '' });

    // Update message content
    act(() => {
      result.current.handleUpdateMessage(2, 'Hello back!');
    });
    expect(result.current.activePrompt?.messages[2].content).toBe('Hello back!');

    // Update message role
    act(() => {
      result.current.handleUpdateMessageRole(2, 'user');
    });
    expect(result.current.activePrompt?.messages[2].role).toBe('user');

    // Move message
    act(() => {
      result.current.handleMoveMessage(1, 'up'); // Swap with system message at 0
    });
    expect(result.current.activePrompt?.messages[0].role).toBe('user');
    expect(result.current.activePrompt?.messages[1].role).toBe('system');

    // Delete message
    act(() => {
      result.current.handleDeleteMessage(0);
    });
    expect(result.current.activePrompt?.messages).toHaveLength(2);
  });

  it('should compile messages by interpolating playground variables', () => {
    const { result } = renderHook(() => useTestEditor());

    act(() => {
      result.current.setPlaygroundVariables({ name: 'Alice' });
    });

    expect(result.current.compiledMessages[0].content).toBe('You are an assistant. Hello Alice');
    // Variable not in playground/empty should be left as-is
    act(() => {
      result.current.setPlaygroundVariables({});
    });
    expect(result.current.compiledMessages[0].content).toBe('You are an assistant. Hello {{name}}');
  });

  it('should calculate validation correctly', () => {
    const { result } = renderHook(() => useTestEditor());

    expect(result.current.validation.isValid).toBe(true);

    // Make it invalid by clearing the name
    act(() => {
      result.current.handleMetaChange('name', '');
    });
    expect(result.current.validation.isValid).toBe(false);
    expect(result.current.validation.errors.name).toBe('Template name cannot be empty');
  });
});
