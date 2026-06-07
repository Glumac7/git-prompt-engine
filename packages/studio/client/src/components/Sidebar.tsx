import React from 'react';
import { Search, Plus } from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';
import { PromptTemplate } from '../services/api';

interface SidebarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  newPromptOpen: boolean;
  setNewPromptOpen: (open: boolean) => void;
  newPromptId: string;
  setNewPromptId: (id: string) => void;
  newPromptName: string;
  setNewPromptName: (name: string) => void;
  dialogError: string | null;
  onCreatePrompt: (e: React.FormEvent) => Promise<void>;
  filteredPrompts: PromptTemplate[];
  activeId: string | null;
  selectPrompt: (id: string) => void;
}

export const Sidebar = React.memo(function Sidebar({
  searchQuery,
  setSearchQuery,
  newPromptOpen,
  setNewPromptOpen,
  newPromptId,
  setNewPromptId,
  newPromptName,
  setNewPromptName,
  dialogError,
  onCreatePrompt,
  filteredPrompts,
  activeId,
  selectPrompt
}: SidebarProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
              
              <form onSubmit={onCreatePrompt} className="space-y-4">
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
    </div>
  );
});
