import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Trash2, ArrowUp, ArrowDown, Save, GitCommit, 
  Play, Sliders, Settings, Activity, FileText, CheckCircle, 
  AlertTriangle, RefreshCw, Layers, Copy, Info, Sparkles
} from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';
import { Slider } from '@base-ui/react/slider';

import { 
  fetchPrompts, 
  savePrompt, 
  commitPrompt, 
  fetchMetrics, 
  PromptTemplate, 
  MessageTemplate, 
  ServerMetrics 
} from './services/api';

const MODEL_PRESETS = [
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

export default function App() {
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Dialog State
  const [newPromptOpen, setNewPromptOpen] = useState(false);
  const [newPromptId, setNewPromptId] = useState('');
  const [newPromptName, setNewPromptName] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);

  // Variables Playground
  const [playgroundVariables, setPlaygroundVariables] = useState<Record<string, string>>({});
  
  // Custom model text input
  const [customModelMode, setCustomModelMode] = useState(false);

  // Required Variable Input
  const [newVarName, setNewVarName] = useState('');

  // Load prompts & metrics on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const data = await fetchPrompts();
        setPrompts(data);
        if (data.length > 0) {
          selectPrompt(data[0].id, data);
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
  }, []);

  // Poll metrics every 4 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await fetchMetrics();
        setMetrics(data);
      } catch (err) {
        console.warn('Failed to poll metrics', err);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Trigger toast timeout
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const selectPrompt = (id: string, currentPrompts = prompts) => {
    if (isModified) {
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
      
      // Pre-populate playground variables
      const initialVars: Record<string, string> = {};
      cloned.requiredVariables.forEach(v => {
        initialVars[v] = playgroundVariables[v] || '';
      });
      setPlaygroundVariables(initialVars);

      // Determine model mode
      const isPreset = MODEL_PRESETS.includes(cloned.parameters.modelName);
      setCustomModelMode(!isPreset);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Handlers for active prompt editing
  const handleMetaChange = (field: keyof PromptTemplate, value: any) => {
    if (!activePrompt) return;
    setActivePrompt({
      ...activePrompt,
      [field]: value
    });
    setIsModified(true);
  };

  const handleParamChange = (field: string, value: any) => {
    if (!activePrompt) return;
    setActivePrompt({
      ...activePrompt,
      parameters: {
        ...activePrompt.parameters,
        [field]: value
      }
    });
    setIsModified(true);
  };

  // Add Variable
  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePrompt || !newVarName.trim()) return;
    const name = newVarName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (activePrompt.requiredVariables.includes(name)) {
      showToast(`Variable "${name}" already exists`, 'info');
      return;
    }
    const updatedVars = [...activePrompt.requiredVariables, name];
    handleMetaChange('requiredVariables', updatedVars);
    
    // Add to playground state
    setPlaygroundVariables({
      ...playgroundVariables,
      [name]: ''
    });
    
    setNewVarName('');
  };

  // Remove Variable
  const handleRemoveVariable = (varName: string) => {
    if (!activePrompt) return;
    const updatedVars = activePrompt.requiredVariables.filter(v => v !== varName);
    handleMetaChange('requiredVariables', updatedVars);
    
    // Remove from playground state
    const updatedPlayground = { ...playgroundVariables };
    delete updatedPlayground[varName];
    setPlaygroundVariables(updatedPlayground);
  };

  // Message edits
  const handleAddMessage = (role: 'system' | 'user' | 'assistant') => {
    if (!activePrompt) return;
    const newMsg: MessageTemplate = { role, content: '' };
    const updatedMessages = [...activePrompt.messages, newMsg];
    handleMetaChange('messages', updatedMessages);
  };

  const handleUpdateMessage = (index: number, content: string) => {
    if (!activePrompt) return;
    const updatedMessages = [...activePrompt.messages];
    updatedMessages[index] = { ...updatedMessages[index], content };
    handleMetaChange('messages', updatedMessages);
  };

  const handleUpdateMessageRole = (index: number, role: 'system' | 'user' | 'assistant') => {
    if (!activePrompt) return;
    const updatedMessages = [...activePrompt.messages];
    updatedMessages[index] = { ...updatedMessages[index], role };
    handleMetaChange('messages', updatedMessages);
  };

  const handleDeleteMessage = (index: number) => {
    if (!activePrompt) return;
    const updatedMessages = activePrompt.messages.filter((_, i) => i !== index);
    handleMetaChange('messages', updatedMessages);
  };

  const handleMoveMessage = (index: number, direction: 'up' | 'down') => {
    if (!activePrompt) return;
    const messages = [...activePrompt.messages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= messages.length) return;

    // Swap
    const temp = messages[index];
    messages[index] = messages[targetIndex];
    messages[targetIndex] = temp;

    handleMetaChange('messages', messages);
  };

  // Save Prompt to Disk
  const handleSave = async () => {
    if (!activePrompt) return;
    try {
      const response = await savePrompt(activePrompt.id, activePrompt);
      if (response.success) {
        // Update list of prompts
        const updatedList = prompts.map(p => p.id === activePrompt.id ? response.prompt : p);
        setPrompts(updatedList);
        setIsModified(false);
        setIsGitUncommitted(true);
        showToast(`Saved prompt "${activePrompt.id}" to local disk.`, 'success');
      }
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
    }
  };

  // Git Commit Prompt
  const handleGitCommit = async () => {
    if (!activePrompt) return;
    // Save first if modified
    if (isModified) {
      await handleSave();
    }
    try {
      const response = await commitPrompt(activePrompt.id);
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
  };

  // Create new prompt handler
  const handleCreatePrompt = async (e: React.FormEvent) => {
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

    if (prompts.some(p => p.id === id)) {
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
        const newList = [...prompts, response.prompt];
        setPrompts(newList);
        selectPrompt(id, newList);
        
        // Reset dialog states
        setNewPromptId('');
        setNewPromptName('');
        setNewPromptOpen(false);
        
        showToast(`Prompt template "${id}" initialized successfully.`, 'success');
      }
    } catch (err) {
      setDialogError((err as Error).message);
    }
  };

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


  // Filtered Prompt List
  const filteredPrompts = prompts.filter(p => {
    const query = searchQuery.toLowerCase();
    return p.id.toLowerCase().includes(query) || p.name.toLowerCase().includes(query);
  });

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
      <header className="flex items-center justify-between px-6 py-4 glass-panel border-b border-slate-800/80 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg shadow-lg shadow-indigo-500/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Prompt Workspace Studio
            </h1>
            <p className="text-xs text-slate-500">Git-Backed Prompt Engine Visual Client</p>
          </div>
        </div>

        {/* Action Header Tools */}
        {activePrompt && (
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
              isModified 
                ? 'bg-amber-950/20 text-amber-400 border-amber-800/40 animate-pulse' 
                : isGitUncommitted 
                  ? 'bg-blue-950/20 text-blue-400 border-blue-800/40' 
                  : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              {isModified ? 'Unsaved Changes' : isGitUncommitted ? 'Uncommitted (Git)' : 'All Saved & Committed'}
            </span>

            <button
              onClick={handleSave}
              disabled={!isModified}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isModified 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-600/10 cursor-pointer' 
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <Save size={14} />
              Save to Disk
            </button>

            <button
              onClick={handleGitCommit}
              disabled={!isGitUncommitted && !isModified}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isGitUncommitted || isModified
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-600/10 cursor-pointer' 
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <GitCommit size={14} />
              Commit to Git
            </button>
          </div>
        )}
      </header>

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
          {/* SIDEBAR */}
          <aside className="w-80 border-r border-slate-800/80 bg-[#090d16]/80 flex flex-col shrink-0">
            {/* Search and Add */}
            <div className="p-4 flex flex-col gap-3 border-b border-slate-800/60">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Search prompt templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-sm placeholder-slate-500 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Add New Prompt Dialog */}
              <Dialog.Root open={newPromptOpen} onOpenChange={setNewPromptOpen}>
                <Dialog.Trigger className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-all cursor-pointer">
                  <Plus size={14} />
                  New Prompt Template
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Backdrop className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity" />
                  <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 bg-[#0f1424] border border-slate-800/80 rounded-xl shadow-2xl z-50 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <Dialog.Title className="text-base font-bold text-slate-100 mb-2">Create New Prompt Template</Dialog.Title>
                    <p className="text-xs text-slate-500 mb-4">
                      Create a new JSON prompt template on disk. Prompt ID will represent the file name (e.g. `summarize-article`).
                    </p>
                    
                    <form onSubmit={handleCreatePrompt} className="space-y-4">
                      {dialogError && (
                        <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-rose-400 rounded-lg text-xs">
                          {dialogError}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Prompt ID / File Name</label>
                        <input
                          type="text"
                          placeholder="e.g. chatbot-greeting"
                          value={newPromptId}
                          onChange={(e) => setNewPromptId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0d17] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Descriptive Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Chatbot Initial Greeting"
                          value={newPromptName}
                          onChange={(e) => setNewPromptName(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0d17] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60 mt-4">
                        <Dialog.Close className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800/80 hover:bg-slate-800/50 rounded-lg transition cursor-pointer">
                          Cancel
                        </Dialog.Close>
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition cursor-pointer"
                        >
                          Create Template
                        </button>
                      </div>
                    </form>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </div>

            {/* Prompt List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredPrompts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-600">No prompt templates found.</p>
                </div>
              ) : (
                filteredPrompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPrompt(p.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start justify-between group cursor-pointer ${
                      activeId === p.id 
                        ? 'bg-indigo-950/20 border-indigo-500/60 text-indigo-200 shadow-md' 
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold font-mono truncate">{p.id}</div>
                      <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{p.name}</div>
                    </div>
                    
                    {/* Badge showing message counts */}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-500 shrink-0 self-center">
                      {p.messages?.length || 0} blks
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* METRICS DASHBOARD */}
            <div className="p-4 border-t border-slate-800/80 bg-[#070b12] flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <Activity size={12} className="text-indigo-400" />
                Live Performance Metrics
              </div>

              {metrics ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
                    <span className="text-slate-500 block">Cache Hit Rate</span>
                    <span className="font-semibold text-indigo-400 text-xs">
                      {metrics.core.cacheHitRate}%
                    </span>
                  </div>
                  <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
                    <span className="text-slate-500 block">Compiler Speed</span>
                    <span className="font-semibold text-emerald-400 text-xs">
                      {metrics.core.avgCompileMs}ms
                    </span>
                  </div>
                  <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
                    <span className="text-slate-500 block">Avg Disk Read</span>
                    <span className="font-semibold text-amber-400 text-xs">
                      {metrics.core.avgDiskReadMs}ms
                    </span>
                  </div>
                  <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
                    <span className="text-slate-500 block">Git Commits</span>
                    <span className="font-semibold text-slate-300 text-xs">
                      {metrics.git.commitsCount}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <span className="text-[10px] text-slate-600">Retrieving metrics...</span>
                </div>
              )}
            </div>
          </aside>

          {/* ACTIVE CANVAS & PLAYGROUND CONTAINER */}
          {activePrompt ? (
            <div className="flex-1 flex overflow-hidden bg-[#080c15]">
              {/* MAIN CANVAS */}
              <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                
                {/* Section: Active ID & Friendly Name */}
                <div className="glass-panel p-5 rounded-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                      <Settings size={13} />
                      Template Configuration
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Prompt ID (File Name)</label>
                      <div className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-sm text-slate-500 font-mono select-all select-none cursor-not-allowed">
                        {activePrompt.id}.json
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Descriptive Title</label>
                      <input
                        type="text"
                        value={activePrompt.name}
                        onChange={(e) => handleMetaChange('name', e.target.value)}
                        className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Define template name..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Description (Internal context)</label>
                    <textarea
                      value={activePrompt.description || ''}
                      onChange={(e) => handleMetaChange('description', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 resize-none"
                      placeholder="Specify who uses this prompt and what role it plays inside the codebase..."
                    />
                  </div>
                </div>

                {/* Section: Model Parameters & Variables */}
                <div className="grid grid-cols-2 gap-6">
                  
                  {/* Parameters Panel */}
                  <div className="glass-panel p-5 rounded-xl flex flex-col gap-4 justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                        <Sliders size={13} />
                        Model Parameters
                      </div>
                      
                      {/* Toggle Custom Model input */}
                      <button
                        onClick={() => {
                          setCustomModelMode(!customModelMode);
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                      >
                        {customModelMode ? 'Use Preset List' : 'Enter Custom Model'}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Model Name Combobox */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Targeted Model</label>
                        {customModelMode ? (
                          <input
                            type="text"
                            value={activePrompt.parameters?.modelName || ''}
                            onChange={(e) => handleParamChange('modelName', e.target.value)}
                            placeholder="e.g. custom-llama-3-100b"
                            className="w-full px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        ) : (
                          <select
                            value={activePrompt.parameters?.modelName || 'gemini-3.5-flash'}
                            onChange={(e) => handleParamChange('modelName', e.target.value)}
                            className="w-full px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          >
                            {MODEL_PRESETS.map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Temperature with Base UI Slider */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                          <span>Temperature</span>
                          <span className="font-mono text-indigo-400">{activePrompt.parameters?.temperature}</span>
                        </div>
                        <div className="px-1 py-1">
                          <Slider.Root 
                            value={[activePrompt.parameters?.temperature ?? 0.7]} 
                            onValueChange={(val) => handleParamChange('temperature', val[0])}
                            min={0} 
                            max={2} 
                            step={0.1}
                            className="relative flex items-center w-full h-5 touch-none select-none cursor-pointer"
                          >
                            <Slider.Control className="relative w-full h-1 bg-slate-800 rounded-full">
                              <Slider.Track className="w-full h-1 rounded-full">
                                <Slider.Indicator className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" />
                                <Slider.Thumb className="absolute block w-3.5 h-3.5 bg-white border border-indigo-500 rounded-full -translate-y-1.25 -translate-x-1.75 shadow focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-transform active:scale-110" />
                              </Slider.Track>
                            </Slider.Control>
                          </Slider.Root>
                        </div>
                      </div>

                      {/* Max Tokens */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Max Output Tokens</label>
                        <input
                          type="number"
                          value={activePrompt.parameters?.maxTokens || 2048}
                          onChange={(e) => handleParamChange('maxTokens', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                          min={1}
                          max={100000}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Required Variables Panel */}
                  <div className="glass-panel p-5 rounded-xl flex flex-col gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                      <Layers size={13} />
                      Required Application Variables
                    </div>

                    <form onSubmit={handleAddVariable} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. orderNumber"
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      >
                        Add
                      </button>
                    </form>

                    <div className="flex-1 border border-dashed border-slate-800 rounded-lg p-3 overflow-y-auto max-h-[140px] flex flex-wrap gap-1.5 align-content-start">
                      {activePrompt.requiredVariables.length === 0 ? (
                        <span className="text-[10px] text-slate-600 m-auto text-center">
                          No required application variables defined. Add a variable above to configure interpolation checks.
                        </span>
                      ) : (
                        activePrompt.requiredVariables.map((v) => (
                          <div 
                            key={v}
                            className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-indigo-950/20 text-indigo-300 border border-indigo-900/40 rounded-full text-xs font-medium"
                          >
                            {v}
                            <button
                              onClick={() => handleRemoveVariable(v)}
                              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-indigo-900/30 text-indigo-400 hover:text-indigo-200 cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Message Block Sequence */}
                <div className="glass-panel p-5 rounded-xl flex flex-col gap-4 flex-1 min-h-[300px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                      <FileText size={13} />
                      Message Block Sequence
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddMessage('system')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-950/30 border border-indigo-900/40 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-900/40 rounded-lg transition cursor-pointer"
                      >
                        + System Block
                      </button>
                      <button
                        onClick={() => handleAddMessage('user')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/30 border border-emerald-900/40 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900/40 rounded-lg transition cursor-pointer"
                      >
                        + User Block
                      </button>
                      <button
                        onClick={() => handleAddMessage('assistant')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/30 border border-amber-900/40 text-[10px] font-semibold text-amber-300 hover:bg-amber-900/40 rounded-lg transition cursor-pointer"
                      >
                        + Assistant Block
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    {activePrompt.messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg py-12 text-slate-500 gap-2">
                        <FileText size={24} className="text-slate-600" />
                        <span className="text-xs">No message blocks added yet.</span>
                        <span className="text-[10px] text-slate-600">Choose one of the roles above to define a text context block.</span>
                      </div>
                    ) : (
                      activePrompt.messages.map((msg, index) => {
                        // Validate variables inside message content
                        const variablesInMessage = Array.from(msg.content.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g)).map(m => m[1]);
                        const invalidVars = variablesInMessage.filter(v => !activePrompt.requiredVariables.includes(v));

                        return (
                          <div 
                            key={index} 
                            className={`glass-card p-4 rounded-xl border flex flex-col gap-3 transition-all relative ${
                              msg.role === 'system' ? 'border-l-4 border-l-indigo-500/70' : 
                              msg.role === 'user' ? 'border-l-4 border-l-emerald-500/70' : 
                              'border-l-4 border-l-amber-500/70'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-slate-500">Block #{index + 1}</span>
                                
                                {/* Role Badge Selector */}
                                <div className="flex bg-[#0c1220] p-0.5 rounded-lg border border-slate-800">
                                  {(['system', 'user', 'assistant'] as const).map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => handleUpdateMessageRole(index, r)}
                                      className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md transition cursor-pointer ${
                                        msg.role === r 
                                          ? r === 'system' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-800/40' : 
                                            r === 'user' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-800/40' : 
                                            'bg-amber-600/20 text-amber-400 border-amber-800/40'
                                          : 'text-slate-600 hover:text-slate-400 bg-transparent border border-transparent'
                                      }`}
                                    >
                                      {r}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Sequence controls */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveMessage(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800/55 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Move block up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  onClick={() => handleMoveMessage(index, 'down')}
                                  disabled={index === activePrompt.messages.length - 1}
                                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800/55 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Move block down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(index)}
                                  className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800/55 cursor-pointer ml-1"
                                  title="Delete block"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Message text input */}
                            <div className="relative">
                              <textarea
                                value={msg.content}
                                onChange={(e) => handleUpdateMessage(index, e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 bg-[#080d17] border border-slate-800/60 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-700 focus:outline-none focus:border-indigo-500/50"
                                placeholder={`Enter message body... Reference variables using {{variableName}}.`}
                              />
                            </div>

                            {/* Warnings / Inline errors if variables not specified */}
                            {invalidVars.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-950/20 border border-amber-900/40 p-2 rounded-lg">
                                <AlertTriangle size={12} />
                                Warning: {invalidVars.map(v => `{{${v}}}`).join(', ')} is/are referenced in block but NOT declared in Required Application Variables.
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </main>

              {/* LIVE PLAYGROUND (RIGHT PANEL) */}
              <aside className="w-[380px] border-l border-slate-800/80 bg-[#090d16]/80 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                    <Play size={13} />
                    Live Playground
                  </div>
                  <span className="text-[10px] text-slate-500">Local Rendering Sandbox</span>
                </div>

                {/* Variables Inputs Section */}
                <div className="p-4 border-b border-slate-800/60 flex flex-col gap-4 max-h-[300px] overflow-y-auto shrink-0 bg-[#060a11]/40">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Playground Parameters</span>
                  
                  {activePrompt.requiredVariables.length === 0 ? (
                    <span className="text-[10px] text-slate-600 text-center py-2">
                      Define variables on the left canvas to populate playground fields.
                    </span>
                  ) : (
                    <div className="space-y-3">
                      {activePrompt.requiredVariables.map((v) => (
                        <div key={v}>
                          <label className="block text-[10px] font-mono text-slate-400 mb-1">{v}</label>
                          <input
                            type="text"
                            value={playgroundVariables[v] || ''}
                            onChange={(e) => setPlaygroundVariables({
                              ...playgroundVariables,
                              [v]: e.target.value
                            })}
                            placeholder={`Enter test value for ${v}...`}
                            className="w-full px-3 py-1.5 bg-[#0a0d16] border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Real-time Rendered output transcript */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 bg-[#080c14] border-b border-slate-800/40 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Compiled Chat Transcript</span>
                    <button
                      onClick={() => {
                        const transcript = compiledMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
                        navigator.clipboard.writeText(transcript);
                        showToast('Copied compiled transcript to clipboard!', 'info');
                      }}
                      className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-900 cursor-pointer"
                      title="Copy compiled output"
                    >
                      <Copy size={12} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#05080e]/40">
                    {compiledMessages.length === 0 ? (
                      <div className="text-center py-12 text-slate-600 text-xs">
                        No messages defined to compile.
                      </div>
                    ) : (
                      compiledMessages.map((msg, i) => (
                        <div key={i} className="space-y-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            msg.role === 'system' ? 'text-indigo-400 bg-indigo-950/20 border-indigo-900/30' :
                            msg.role === 'user' ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' :
                            'text-amber-400 bg-amber-950/20 border-amber-900/30'
                          }`}>
                            {msg.role}
                          </span>
                          <div className={`p-3 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed border ${
                            msg.role === 'system' ? 'bg-[#0f1325]/45 border-slate-850' : 
                            msg.role === 'user' ? 'bg-[#0b1b17]/45 border-slate-850' : 
                            'bg-[#191510]/45 border-slate-850'
                          }`}>
                            {msg.content || <span className="text-slate-600 italic">Empty block content</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </aside>
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
    </div>
  );
}
