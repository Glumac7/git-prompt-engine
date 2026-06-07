import { useState, useEffect, useCallback, useRef } from 'react';
import { savePrompt, PromptTemplate } from '../services/api';

interface UsePromptDialogOptions {
  prompts: PromptTemplate[];
  setPrompts: React.Dispatch<React.SetStateAction<PromptTemplate[]>>;
  selectPrompt: (id: string, currentPrompts?: PromptTemplate[]) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function usePromptDialog({
  prompts,
  setPrompts,
  selectPrompt,
  showToast
}: UsePromptDialogOptions) {
  const [newPromptOpen, setNewPromptOpen] = useState(false);
  const [newPromptId, setNewPromptId] = useState('');
  const [newPromptName, setNewPromptName] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const promptsRef = useRef<PromptTemplate[]>([]);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const handleCreatePrompt = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    const id = newPromptId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const name = newPromptName.trim();

    if (!id) {
      setDialogError('Prompt ID is required and must contain alphanumeric characters, hyphens or underscores only.');
      return;
    }
    if (!name) {
      setDialogError('Descriptive Name is required.');
      return;
    }

    if (promptsRef.current.some(p => p.id === id)) {
      setDialogError(`Prompt ID "${id}" already exists.`);
      return;
    }

    const newTemplate: PromptTemplate = {
      id,
      name,
      requiredVariables: [],
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      description: '',
      parameters: {
        modelName: 'gemini-3.5-flash',
        temperature: 0.7,
        maxTokens: 2048
      }
    };

    try {
      // Create atomically on disk
      const response = await savePrompt(id, newTemplate);
      if (response.success) {
        setPrompts(prev => {
          const newList = [...prev, response.prompt];
          setTimeout(() => selectPrompt(id, newList), 0);
          return newList;
        });
        
        // Reset dialog states
        setNewPromptId('');
        setNewPromptName('');
        setNewPromptOpen(false);
        
        showToast(`Prompt template "${id}" initialized successfully.`, 'success');
      }
    } catch (err) {
      setDialogError((err as Error).message);
    }
  }, [newPromptId, newPromptName, selectPrompt, showToast, setPrompts]);

  return {
    newPromptOpen,
    setNewPromptOpen,
    newPromptId,
    setNewPromptId,
    newPromptName,
    setNewPromptName,
    dialogError,
    setDialogError,
    handleCreatePrompt
  };
}
