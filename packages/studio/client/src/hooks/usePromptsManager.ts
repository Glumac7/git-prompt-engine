import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  fetchPrompts, 
  savePrompt, 
  commitPrompt, 
  fetchMetrics, 
  PromptTemplate, 
  ServerMetrics 
} from '../services/api';

interface UsePromptsManagerOptions {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setMetrics: (metrics: ServerMetrics | null) => void;
  onPromptSelected: (prompt: PromptTemplate, isInitial?: boolean) => void;
}

export function usePromptsManager({
  showToast,
  setMetrics,
  onPromptSelected
}: UsePromptsManagerOptions) {
  // Prompts & Selection
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<PromptTemplate | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [isGitUncommitted, setIsGitUncommitted] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs to stabilize callback references
  const activePromptRef = useRef<PromptTemplate | null>(null);
  const isModifiedRef = useRef(false);
  const promptsRef = useRef<PromptTemplate[]>([]);

  useEffect(() => {
    activePromptRef.current = activePrompt;
  }, [activePrompt]);

  useEffect(() => {
    isModifiedRef.current = isModified;
  }, [isModified]);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const selectPrompt = useCallback((id: string, currentPrompts = promptsRef.current) => {
    if (isModifiedRef.current) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    const found = currentPrompts.find(p => p.id === id);
    if (found) {
      setActiveId(id);
      // Clone prompt template to avoid editing the shared state directly
      const cloned = JSON.parse(JSON.stringify(found)) as PromptTemplate;
      
      // Ensure extended fields are initialized
      if (!cloned.parameters) {
        cloned.parameters = {
          modelName: 'gemini-3.5-flash',
          temperature: 0.7,
          maxTokens: 2048
        };
      }
      if (cloned.parameters.temperature === undefined) {
        cloned.parameters.temperature = 0.7;
      }
      if (cloned.parameters.maxTokens === undefined) {
        cloned.parameters.maxTokens = 2048;
      }
      if (cloned.parameters.modelName === undefined) {
        cloned.parameters.modelName = 'gemini-3.5-flash';
      }
      if (!cloned.requiredVariables) {
        cloned.requiredVariables = [];
      }
      if (!cloned.messages) {
        cloned.messages = [];
      }
      
      setActivePrompt(cloned);
      setIsModified(false);
      setIsGitUncommitted(false);
      
      onPromptSelected(cloned, false);
    }
  }, [onPromptSelected]);

  // Load prompts & metrics on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const data = await fetchPrompts();
        setPrompts(data);
        if (data.length > 0) {
          const firstPrompt = data[0];
          setActiveId(firstPrompt.id);
          const cloned = JSON.parse(JSON.stringify(firstPrompt)) as PromptTemplate;
          
          // Ensure fields are initialized
          if (!cloned.parameters) {
            cloned.parameters = {
              modelName: 'gemini-3.5-flash',
              temperature: 0.7,
              maxTokens: 2048
            };
          }
          if (cloned.parameters.temperature === undefined) {
            cloned.parameters.temperature = 0.7;
          }
          if (cloned.parameters.maxTokens === undefined) {
            cloned.parameters.maxTokens = 2048;
          }
          if (cloned.parameters.modelName === undefined) {
            cloned.parameters.modelName = 'gemini-3.5-flash';
          }
          if (!cloned.requiredVariables) {
            cloned.requiredVariables = [];
          }
          if (!cloned.messages) {
            cloned.messages = [];
          }
          
          setActivePrompt(cloned);
          onPromptSelected(cloned, true);
        }
        
        const metricsData = await fetchMetrics();
        setMetrics(metricsData);
        setLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    }
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save Prompt to Disk
  const handleSave = useCallback(async () => {
    const currentPrompt = activePromptRef.current;
    if (!currentPrompt) return;
    try {
      const response = await savePrompt(currentPrompt.id, currentPrompt);
      if (response.success) {
        // Update list of prompts
        setPrompts(prev => prev.map(p => p.id === currentPrompt.id ? response.prompt : p));
        setIsModified(false);
        setIsGitUncommitted(true);
        showToast(`Saved prompt "${currentPrompt.id}" to local disk.`, 'success');
      }
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
    }
  }, [showToast]);

  // Git Commit Prompt
  const handleGitCommit = useCallback(async () => {
    const currentPrompt = activePromptRef.current;
    if (!currentPrompt) return;
    // Save first if modified
    if (isModifiedRef.current) {
      await handleSave();
    }
    try {
      const response = await commitPrompt(currentPrompt.id);
      if (response.success) {
        setIsGitUncommitted(false);
        showToast(response.message || 'Committed successfully to Git!', 'success');
        // Reload metrics to show update in git commits count
        const metricsData = await fetchMetrics();
        setMetrics(metricsData);
      }
    } catch (err) {
      showToast(`Git commit failed: ${(err as Error).message}`, 'error');
    }
  }, [handleSave, showToast, setMetrics]);

  // Filtered Prompt List
  const filteredPrompts = useMemo(() => {
    return prompts.filter(p => {
      const query = searchQuery.toLowerCase();
      return p.id.toLowerCase().includes(query) || p.name.toLowerCase().includes(query);
    });
  }, [prompts, searchQuery]);

  return {
    prompts,
    setPrompts,
    activeId,
    setActiveId,
    activePrompt,
    setActivePrompt,
    isModified,
    setIsModified,
    isGitUncommitted,
    setIsGitUncommitted,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    filteredPrompts,
    selectPrompt,
    handleSave,
    handleGitCommit
  };
}
