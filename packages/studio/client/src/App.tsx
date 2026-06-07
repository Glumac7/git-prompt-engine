import React from 'react';
import { 
  CheckCircle, AlertTriangle, Info, RefreshCw, Sparkles 
} from 'lucide-react';
import { usePromptStudio } from './hooks/usePromptStudio';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricsDashboard } from './components/MetricsDashboard';
import { TemplateConfig } from './components/TemplateConfig';
import { ModelParameters } from './components/ModelParameters';
import { RequiredVariables } from './components/RequiredVariables';
import { MessageSequence } from './components/MessageSequence';
import { Playground } from './components/Playground';
import { DiffModal } from './components/DiffModal';

export default function App() {
  const {
    // State
    prompts,
    activeId,
    activePrompt,
    isModified,
    isGitUncommitted,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    toast,
    newPromptOpen,
    setNewPromptOpen,
    newPromptId,
    setNewPromptId,
    newPromptName,
    setNewPromptName,
    dialogError,
    metrics,
    playgroundVariables,
    setPlaygroundVariables,
    newVarName,
    setNewVarName,
    compiledMessages,
    filteredPrompts,
    validation,

    // Actions
    selectPrompt,
    handleMetaChange,
    handleParamChange,
    handleAddVariable,
    handleRemoveVariable,
    handleAddMessage,
    handleUpdateMessage,
    handleUpdateMessageRole,
    handleDeleteMessage,
    handleMoveMessage,
    handleSave,
    handleGitCommit,
    handleCreatePrompt,
    showToast
  } = usePromptStudio();

  // Stable callbacks for specific sub-components to prevent re-renders
  const handleTemplateConfigChange = React.useCallback((field: 'name' | 'description', value: string) => {
    handleMetaChange(field, value);
  }, [handleMetaChange]);

  const handleCopyTranscript = React.useCallback(() => {
    const transcript = compiledMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
    navigator.clipboard.writeText(transcript);
    showToast('Copied compiled transcript to clipboard!', 'info');
  }, [compiledMessages, showToast]);

  // Visual Diff Modal control state
  const [diffModalOpen, setDiffModalOpen] = React.useState(false);

  const originalPrompt = React.useMemo(() => {
    if (!activePrompt) return null;
    return prompts.find(p => p.id === activePrompt.id) || null;
  }, [prompts, activePrompt]);

  const handleOpenDiff = React.useCallback(async () => {
    setDiffModalOpen(true);
  }, []);

  const handleConfirmSave = React.useCallback(async () => {
    await handleSave();
  }, [handleSave]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border z-50 transition-all duration-300 animate-slide-in ${
          toast.type === 'success' ? 'bg-[#0f1d1a] text-emerald-400 border-emerald-900/50' : 
          toast.type === 'error' ? 'bg-[#221316] text-rose-400 border-rose-900/50' : 
          'bg-[#10192a] text-indigo-400 border-indigo-900/50'
        }`}>
          <div className="text-lg">
            {toast.type === 'success' ? <CheckCircle size={18} /> : 
             toast.type === 'error' ? <AlertTriangle size={18} /> : 
             <Info size={18} />}
          </div>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Header
        activePrompt={activePrompt}
        isModified={isModified}
        isGitUncommitted={isGitUncommitted}
        isValid={validation.isValid}
        onSave={handleOpenDiff}
        onGitCommit={handleGitCommit}
      />

      {/* Main Workspace Body */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#080b11]">
          <RefreshCw className="animate-spin text-indigo-500" size={32} />
          <p className="text-slate-400 font-medium text-sm">Loading visual workspace...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-[#080b11]">
          <AlertTriangle className="text-rose-500" size={48} />
          <h2 className="text-lg font-bold text-slate-200">Local Bridge Server Connection Failure</h2>
          <p className="text-slate-500 text-sm max-w-md text-center">
            {error}. Ensure the Local Bridge Server is running on port 3000 and the dev proxy is active.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR CONTAINER */}
          <aside className="w-80 border-r border-slate-800/80 bg-[#090d16]/80 flex flex-col shrink-0 overflow-hidden">
            <Sidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              newPromptOpen={newPromptOpen}
              setNewPromptOpen={setNewPromptOpen}
              newPromptId={newPromptId}
              setNewPromptId={setNewPromptId}
              newPromptName={newPromptName}
              setNewPromptName={setNewPromptName}
              dialogError={dialogError}
              onCreatePrompt={handleCreatePrompt}
              filteredPrompts={filteredPrompts}
              activeId={activeId}
              selectPrompt={selectPrompt}
            />
            <MetricsDashboard metrics={metrics} />
          </aside>

          {/* ACTIVE CANVAS & PLAYGROUND CONTAINER */}
          {activePrompt ? (
            <div className="flex-1 flex overflow-hidden bg-[#080c15]">
              {/* MAIN CANVAS */}
              <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                
                {/* Section: Active ID & Friendly Name */}
                <TemplateConfig
                  id={activePrompt.id}
                  name={activePrompt.name}
                  description={activePrompt.description || ''}
                  onChange={handleTemplateConfigChange}
                />

                {/* Section: Model Parameters & Variables */}
                <div className="grid grid-cols-2 gap-6">
                  
                  {/* Parameters Panel */}
                  <ModelParameters
                    modelName={activePrompt.parameters?.modelName ?? 'gemini-3.5-flash'}
                    temperature={activePrompt.parameters?.temperature ?? 0.7}
                    maxTokens={activePrompt.parameters?.maxTokens ?? 2048}
                    onChange={handleParamChange}
                  />

                  {/* Required Variables Panel */}
                  <RequiredVariables
                    requiredVariables={activePrompt.requiredVariables}
                    newVarName={newVarName}
                    setNewVarName={setNewVarName}
                    onAddVariable={handleAddVariable}
                    onRemoveVariable={handleRemoveVariable}
                  />
                </div>

                {/* Section: Message Block Sequence */}
                <MessageSequence
                  messages={activePrompt.messages}
                  requiredVariables={activePrompt.requiredVariables}
                  validation={validation}
                  onAddMessage={handleAddMessage}
                  onUpdateMessage={handleUpdateMessage}
                  onUpdateMessageRole={handleUpdateMessageRole}
                  onDeleteMessage={handleDeleteMessage}
                  onMoveMessage={handleMoveMessage}
                />
              </main>

              {/* LIVE PLAYGROUND (RIGHT PANEL) */}
              <Playground
                requiredVariables={activePrompt.requiredVariables}
                playgroundVariables={playgroundVariables}
                setPlaygroundVariables={setPlaygroundVariables}
                compiledMessages={compiledMessages}
                onCopyTranscript={handleCopyTranscript}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#080b11]">
              <Sparkles className="text-slate-700" size={48} />
              <h2 className="text-slate-400 font-semibold text-sm">No Prompt Template Active</h2>
              <p className="text-slate-600 text-xs max-w-sm text-center">
                Select a prompt template from the sidebar or click "New Prompt Template" to begin visual engineering.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Visual Diff Canvas Modal */}
      <DiffModal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        onConfirm={handleConfirmSave}
        originalPrompt={originalPrompt}
        activePrompt={activePrompt}
      />
    </div>
  );
}
