import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PromptTemplate, MessageTemplate } from '../services/api';

interface UsePromptEditorOptions {
  activePrompt: PromptTemplate | null;
  setActivePrompt: React.Dispatch<React.SetStateAction<PromptTemplate | null>>;
  setIsModified: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function usePromptEditor({
  activePrompt,
  setActivePrompt,
  setIsModified,
  showToast
}: UsePromptEditorOptions) {
  // Variables Playground
  const [playgroundVariables, setPlaygroundVariables] = useState<Record<string, string>>({});
  
  // Custom model text input
  const [customModelMode, setCustomModelMode] = useState(false);

  // Required Variable Input
  const [newVarName, setNewVarName] = useState('');

  const activePromptRef = useRef<PromptTemplate | null>(null);

  useEffect(() => {
    activePromptRef.current = activePrompt;
  }, [activePrompt]);

  // Handlers for active prompt editing
  const handleMetaChange = useCallback((field: keyof PromptTemplate, value: any) => {
    setActivePrompt(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  const handleParamChange = useCallback((field: string, value: any) => {
    setActivePrompt(prev => {
      if (!prev) return null;
      return {
        ...prev,
        parameters: {
          ...prev.parameters,
          [field]: value
        }
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  // Add Variable
  const handleAddVariable = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const currentPrompt = activePromptRef.current;
    if (!currentPrompt || !newVarName.trim()) return;
    const name = newVarName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (currentPrompt.requiredVariables.includes(name)) {
      showToast(`Variable "${name}" already exists`, 'info');
      return;
    }
    const updatedVars = [...currentPrompt.requiredVariables, name];
    handleMetaChange('requiredVariables', updatedVars);
    
    // Add to playground state
    setPlaygroundVariables(prev => ({
      ...prev,
      [name]: ''
    }));
    
    setNewVarName('');
  }, [newVarName, handleMetaChange, showToast]);

  // Remove Variable
  const handleRemoveVariable = useCallback((varName: string) => {
    const currentPrompt = activePromptRef.current;
    if (!currentPrompt) return;
    const updatedVars = currentPrompt.requiredVariables.filter(v => v !== varName);
    handleMetaChange('requiredVariables', updatedVars);
    
    // Remove from playground state
    setPlaygroundVariables(prev => {
      const updatedPlayground = { ...prev };
      delete updatedPlayground[varName];
      return updatedPlayground;
    });
  }, [handleMetaChange]);

  // Message edits
  const handleAddMessage = useCallback((role: 'system' | 'user' | 'assistant') => {
    setActivePrompt(prev => {
      if (!prev) return null;
      const newMsg: MessageTemplate = { role, content: '' };
      return {
        ...prev,
        messages: [...prev.messages, newMsg]
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  const handleUpdateMessage = useCallback((index: number, content: string) => {
    setActivePrompt(prev => {
      if (!prev) return null;
      const updatedMessages = [...prev.messages];
      updatedMessages[index] = { ...updatedMessages[index], content };
      return {
        ...prev,
        messages: updatedMessages
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  const handleUpdateMessageRole = useCallback((index: number, role: 'system' | 'user' | 'assistant') => {
    setActivePrompt(prev => {
      if (!prev) return null;
      const updatedMessages = [...prev.messages];
      updatedMessages[index] = { ...updatedMessages[index], role };
      return {
        ...prev,
        messages: updatedMessages
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  const handleDeleteMessage = useCallback((index: number) => {
    setActivePrompt(prev => {
      if (!prev) return null;
      const updatedMessages = prev.messages.filter((_, i) => i !== index);
      return {
        ...prev,
        messages: updatedMessages
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  const handleMoveMessage = useCallback((index: number, direction: 'up' | 'down') => {
    setActivePrompt(prev => {
      if (!prev) return null;
      const messages = [...prev.messages];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= messages.length) return prev;

      // Swap
      const temp = messages[index];
      messages[index] = messages[targetIndex];
      messages[targetIndex] = temp;

      return {
        ...prev,
        messages
      };
    });
    setIsModified(true);
  }, [setActivePrompt, setIsModified]);

  // Live Compiled output calculation
  const compiledMessages = useMemo(() => {
    if (!activePrompt) return [];
    return activePrompt.messages.map(msg => {
      // Interpolate placeholders
      const content = msg.content.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
        const val = playgroundVariables[key];
        return val !== undefined && val !== '' ? val : match;
      });
      return {
        role: msg.role,
        content
      };
    });
  }, [activePrompt, playgroundVariables]);

  return {
    playgroundVariables,
    setPlaygroundVariables,
    customModelMode,
    setCustomModelMode,
    newVarName,
    setNewVarName,
    compiledMessages,
    handleMetaChange,
    handleParamChange,
    handleAddVariable,
    handleRemoveVariable,
    handleAddMessage,
    handleUpdateMessage,
    handleUpdateMessageRole,
    handleDeleteMessage,
    handleMoveMessage
  };
}
