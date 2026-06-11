import { useCallback, useRef } from 'react';
import { useToast } from './useToast';
import { useMetrics } from './useMetrics';
import { usePromptsManager } from './usePromptsManager';
import { usePromptDialog } from './usePromptDialog';
import { usePromptEditor } from './usePromptEditor';
import { PromptTemplate } from '../services/api';

export const MODEL_PRESETS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-3.1-pro',
  'gpt-5.5',
  'gpt-5.5-instant',
  'claude-opus-4.8',
  'claude-sonnet-4.6',
  'claude-haiku-4.5',
  'llama-3.3-70b',
  'llama-3.3-8b'
];

export function usePromptStudio() {
  const toastManager = useToast();
  const metricsManager = useMetrics();

  const onPromptSelectedRef = useRef<(prompt: PromptTemplate, isInitial?: boolean) => void>(() => {});

  const promptsManager = usePromptsManager({
    showToast: toastManager.showToast,
    setMetrics: metricsManager.setMetrics,
    onPromptSelected: useCallback((cloned, isInitial) => {
      onPromptSelectedRef.current(cloned, isInitial);
    }, [])
  });

  const dialogManager = usePromptDialog({
    prompts: promptsManager.prompts,
    setPrompts: promptsManager.setPrompts,
    selectPrompt: promptsManager.selectPrompt,
    showToast: toastManager.showToast
  });

  const editorManager = usePromptEditor({
    activePrompt: promptsManager.activePrompt,
    setActivePrompt: promptsManager.setActivePrompt,
    setIsModified: promptsManager.setIsModified,
    showToast: toastManager.showToast
  });

  // Wire up the prompt selection callback to the editor's setters
  onPromptSelectedRef.current = (cloned, isInitial) => {
    editorManager.setPlaygroundVariables(prev => {
      const initialVars: Record<string, string> = {};
      cloned.requiredVariables.forEach(v => {
        initialVars[v] = isInitial ? '' : (prev[v] || '');
      });
      return initialVars;
    });
  };

  return {
    // State
    prompts: promptsManager.prompts,
    activeId: promptsManager.activeId,
    activePrompt: promptsManager.activePrompt,
    isModified: promptsManager.isModified,
    isGitUncommitted: promptsManager.isGitUncommitted,
    searchQuery: promptsManager.searchQuery,
    setSearchQuery: promptsManager.setSearchQuery,
    loading: promptsManager.loading,
    error: promptsManager.error,
    toast: toastManager.toast,
    setToast: toastManager.setToast,
    newPromptOpen: dialogManager.newPromptOpen,
    setNewPromptOpen: dialogManager.setNewPromptOpen,
    newPromptId: dialogManager.newPromptId,
    setNewPromptId: dialogManager.setNewPromptId,
    newPromptName: dialogManager.newPromptName,
    setNewPromptName: dialogManager.setNewPromptName,
    dialogError: dialogManager.dialogError,
    metrics: metricsManager.metrics,
    playgroundVariables: editorManager.playgroundVariables,
    setPlaygroundVariables: editorManager.setPlaygroundVariables,
    newVarName: editorManager.newVarName,
    setNewVarName: editorManager.setNewVarName,
    compiledMessages: editorManager.compiledMessages,
    filteredPrompts: promptsManager.filteredPrompts,
    validation: editorManager.validation,

    // Actions
    selectPrompt: promptsManager.selectPrompt,
    handleMetaChange: editorManager.handleMetaChange,
    handleParamChange: editorManager.handleParamChange,
    handleAddVariable: editorManager.handleAddVariable,
    handleRemoveVariable: editorManager.handleRemoveVariable,
    handleAddMessage: editorManager.handleAddMessage,
    handleUpdateMessage: editorManager.handleUpdateMessage,
    handleUpdateMessageRole: editorManager.handleUpdateMessageRole,
    handleDeleteMessage: editorManager.handleDeleteMessage,
    handleMoveMessage: editorManager.handleMoveMessage,
    handleSave: promptsManager.handleSave,
    handleGitCommit: promptsManager.handleGitCommit,
    handleCheckoutBranch: promptsManager.handleCheckoutBranch,
    handlePushBranch: promptsManager.handlePushBranch,
    handleCreatePrompt: dialogManager.handleCreatePrompt,
    showToast: toastManager.showToast,
    gitStatus: promptsManager.gitStatus
  };
}
