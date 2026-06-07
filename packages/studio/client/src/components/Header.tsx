import React from 'react';
import { Save, GitCommit, Sparkles, AlertTriangle } from 'lucide-react';
import { PromptTemplate } from '../services/api';

interface HeaderProps {
  activePrompt: PromptTemplate | null;
  isModified: boolean;
  isGitUncommitted: boolean;
  isValid: boolean;
  onSave: () => Promise<void>;
  onGitCommit: () => Promise<void>;
}

export const Header = React.memo(function Header({
  activePrompt,
  isModified,
  isGitUncommitted,
  isValid,
  onSave,
  onGitCommit
}: HeaderProps) {
  return (
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

          {!isValid && (
            <span className="text-xs text-rose-400 flex items-center gap-1 bg-rose-950/20 border border-rose-900/30 px-2 py-1 rounded-md transition-all animate-fade-in">
              <AlertTriangle size={12} className="text-rose-400" />
              Invalid Structure
            </span>
          )}

          <button
            onClick={onSave}
            disabled={!isModified || !isValid}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isModified && isValid
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-600/10 cursor-pointer' 
                : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
          >
            <Save size={14} />
            Save to Disk
          </button>

          <button
            onClick={onGitCommit}
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
  );
}, (prevProps, nextProps) => {
  return (
    !!prevProps.activePrompt === !!nextProps.activePrompt &&
    prevProps.activePrompt?.id === nextProps.activePrompt?.id &&
    prevProps.isModified === nextProps.isModified &&
    prevProps.isGitUncommitted === nextProps.isGitUncommitted &&
    prevProps.isValid === nextProps.isValid
  );
});
